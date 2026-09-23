import 'server-only';

/*
 * Who is signed in to the admin, and what they may do.
 *
 * Sessions are plain and database-backed: a random 32-byte token in an httpOnly cookie, its
 * SHA-256 in web_session. Nothing about the user travels in the cookie, so revoking a session —
 * or disabling an account, or taking a right out of a Permission Set — takes effect on the very
 * next request rather than whenever a token happens to expire. That is the reason not to use a
 * self-contained JWT for a handful of editors.
 *
 * Rights are resolved per request from the Permission Sets the account holds (lib/permissions.ts):
 * the union of the primary role and any extra sets, with per-user override lines replacing the
 * role's line for a single object. `requireAction` is what every Server Action calls first — a
 * Server Action is a POST endpoint the whole internet can reach, and the page that rendered the
 * form having checked the right proves nothing about the request that arrives.
 *
 * Note what is NOT here: no parent, pupil or staff login, and no connection to the management
 * system's user table. The only accounts that exist are the people who edit the website.
 */
import { randomBytes, createHash } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { all, one, run, audit, type Actor } from './db.ts';
import { hashPassword, verifyPassword } from './password.ts';
import { AppError } from './errors.ts';
import { rateLimit, clientIp } from './rate-limit.ts';
import { canAction, canPage, linesToPermissions, type ActionKey } from './permissions.ts';
import { EMPTY_PERMISSIONS, type PermissionLine, type SessionUser } from './types.ts';

export const SESSION_COOKIE = 'school_site_session';
const SESSION_DAYS = 7;

/* Re-exported so a Server Action setting a password needs one import rather than two. */
export { hashPassword };

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

/* ---------------------------------------------------------------- resolving rights */

interface AccountRow {
  id: number;
  name: string;
  email: string;
  role_id: number | null;
  role_name: string | null;
  is_system: boolean;
  status: 'ACTIVE' | 'DISABLED';
  title: string | null;
  avatar_url: string | null;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
  created_by: string | null;
}

const ACCOUNT_SELECT = `
  SELECT u.id, u.name, u.email, u.role_id, r.name AS role_name,
         COALESCE(bool_or(extra.is_system), FALSE) OR COALESCE(r.is_system, FALSE) AS is_system,
         u.status, u.title, u.avatar_url, u.must_change_password, u.last_login_at, u.created_at, u.created_by
  FROM web_user u
  LEFT JOIN web_role r ON r.id = u.role_id
  LEFT JOIN web_user_role ur ON ur.user_id = u.id
  LEFT JOIN web_role extra ON extra.id = ur.role_id`;

const ACCOUNT_GROUP = ' GROUP BY u.id, r.name, r.is_system';

/**
 * Every right the account has: the union of its Permission Sets, then the per-user override lines
 * laid on top. An override REPLACES the role's line for that object — which is how one person is
 * restricted, or given one extra screen, without a set being edited for everybody who holds it.
 */
async function loadPermissions(userId: number): Promise<{ permissions: ReturnType<typeof linesToPermissions>; roles: { id: number; name: string; is_system: boolean }[] }> {
  const [roles, roleLines, userLines] = await Promise.all([
    all<{ id: number; name: string; is_system: boolean }>(
      `SELECT DISTINCT r.id, r.name, r.is_system FROM web_role r
       WHERE r.id = (SELECT role_id FROM web_user WHERE id = @user)
          OR r.id IN (SELECT role_id FROM web_user_role WHERE user_id = @user)
       ORDER BY r.name`,
      { user: userId },
    ),
    all<PermissionLine>(
      `SELECT object_type, object_name, read_perm, insert_perm, modify_perm, delete_perm, execute_perm
       FROM web_permission_line
       WHERE role_id = (SELECT role_id FROM web_user WHERE id = @user)
          OR role_id IN (SELECT role_id FROM web_user_role WHERE user_id = @user)`,
      { user: userId },
    ),
    all<PermissionLine>(
      `SELECT object_type, object_name, read_perm, insert_perm, modify_perm, delete_perm, execute_perm
       FROM web_user_permission_line WHERE user_id = ?`,
      userId,
    ),
  ]);

  const overridden = new Set(userLines.map((l) => `${l.object_type}:${l.object_name}`));
  const effective = [...roleLines.filter((l) => !overridden.has(`${l.object_type}:${l.object_name}`)), ...userLines];
  return { permissions: linesToPermissions(effective), roles };
}

/**
 * The signed-in user with their rights resolved, or null.
 *
 * Wrapped in React's `cache` so the layout, the page and every Server Component below them share
 * one lookup per request rather than each running the four queries.
 */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = await one<AccountRow>(
    `${ACCOUNT_SELECT}
     JOIN web_session s ON s.user_id = u.id
     WHERE s.token = @token AND s.expires_at > @now
     ${ACCOUNT_GROUP}, s.token`,
    { token: hashToken(token), now: new Date().toISOString() },
  );
  if (!row || row.status !== 'ACTIVE') return null;

  // A System Administrator has no lines at all — full access comes from the flag, exactly as the
  // management system does it, so there is no wildcard row anyone could delete by accident.
  if (row.is_system) {
    const { roles } = await loadPermissions(row.id);
    return { ...row, permissions: EMPTY_PERMISSIONS, roles };
  }
  const { permissions, roles } = await loadPermissions(row.id);
  return { ...row, permissions, roles };
});

/** The signed-in user, or a redirect to the sign-in page. Every admin page starts with this. */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect('/admin/login');
  return user;
}

/**
 * A page guard: the user must be signed in and hold Execute on this screen. Sends them to the
 * admin's front door rather than a bare 403, because the commonest cause is a bookmarked link to
 * a screen someone's Permission Set no longer includes.
 */
export async function requirePage(code: string): Promise<SessionUser> {
  const user = await requireUser();
  if (!canPage(user, code)) redirect(`/admin?denied=${encodeURIComponent(code)}`);
  return user;
}

/**
 * The guard every Server Action calls first. Throws an AppError the form can display, rather than
 * redirecting — an action has no page to send anybody to.
 */
export async function requireAction(key: ActionKey): Promise<Actor & { user: SessionUser }> {
  const user = await currentUser();
  if (!user) throw new AppError('Your session has expired. Please sign in again.', 'FORBIDDEN');
  if (!canAction(user, key)) {
    throw new AppError('Your Permission Set does not allow that. Ask an administrator.', 'FORBIDDEN');
  }
  return { id: user.id, name: user.name, email: user.email, user };
}

export const actorOf = (user: SessionUser): Actor => ({ id: user.id, name: user.name, email: user.email });

/* ------------------------------------------------------------ sign in and sign out */

export async function signIn(emailInput: string, passwordInput: string): Promise<SessionUser> {
  const head = await headers();
  const ip = clientIp(head);
  const email = String(emailInput ?? '').trim().toLowerCase();

  // Two windows: a burst per address, and a ceiling per account so one login cannot be ground at.
  if (!rateLimit(`login:ip:${ip}`, 10, 5 * 60_000).ok) {
    throw new AppError('Too many attempts from this connection. Wait five minutes and try again.', 'RATE_LIMITED');
  }
  if (!rateLimit(`login:user:${email}`, 8, 15 * 60_000).ok) {
    throw new AppError('Too many attempts for this account. Wait a few minutes and try again.', 'RATE_LIMITED');
  }

  // Looked up in two steps on purpose: the credential check reads nothing but the hash and the
  // account's own state, and the permission resolution only happens once the password is right.
  const credential = await one<{ id: number; password_hash: string }>(
    'SELECT id, password_hash FROM web_user WHERE lower(email) = ? LIMIT 1',
    email,
  );
  const correct = await verifyPassword(String(passwordInput ?? ''), credential?.password_hash ?? null);

  if (!credential || !correct) {
    await audit(null, 'LOGIN_FAILED', 'web_user', credential?.id ?? null, { email, ip });
    throw new AppError('That email and password do not match an account.', 'FORBIDDEN');
  }

  const account = await one<AccountRow>(`${ACCOUNT_SELECT} WHERE u.id = ? ${ACCOUNT_GROUP}`, credential.id);
  if (!account) throw new AppError('That email and password do not match an account.', 'FORBIDDEN');
  if (account.status !== 'ACTIVE') {
    throw new AppError('That account has been disabled. Ask an administrator to re-enable it.', 'FORBIDDEN');
  }
  if (!account.role_id) {
    throw new AppError('That account has no Permission Set yet, so there is nothing it can open. Ask an administrator.', 'FORBIDDEN');
  }

  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86_400_000);

  await run(
    'INSERT INTO web_session (token, user_id, expires_at, created_at, ip, user_agent) VALUES (?,?,?,?,?,?) RETURNING user_id AS id',
    hashToken(token), account.id, expires.toISOString(), now.toISOString(), ip, head.get('user-agent')?.slice(0, 300) ?? null,
  );
  await run('UPDATE web_user SET last_login_at = ? WHERE id = ?', now.toISOString(), account.id);
  // Sessions that have simply run out, for anybody — keeps the table from growing forever.
  await run('DELETE FROM web_session WHERE expires_at < ?', now.toISOString());

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires,
  });

  const { permissions, roles } = await loadPermissions(account.id);
  const user: SessionUser = { ...account, permissions: account.is_system ? EMPTY_PERMISSIONS : permissions, roles };
  await audit(actorOf(user), 'LOGIN', 'web_user', account.id, { ip, role: account.role_name });
  return user;
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await run('DELETE FROM web_session WHERE token = ?', hashToken(token));
  jar.delete(SESSION_COOKIE);
}

/** Ends every session for one account — a password reset, or a disabled user. */
export async function signOutEverywhere(userId: number): Promise<void> {
  await run('DELETE FROM web_session WHERE user_id = ?', userId);
}

/**
 * A password change by the account's owner. The current password must be given, and every other
 * session is dropped: the commonest reason to change a password is suspecting someone else has it.
 */
export async function changeOwnPassword(userId: number, currentPassword: string, newHash: string): Promise<void> {
  const account = await one<{ password_hash: string }>('SELECT password_hash FROM web_user WHERE id = ?', userId);
  if (!account || !(await verifyPassword(currentPassword, account.password_hash))) {
    throw new AppError('Your current password is not correct.', 'FORBIDDEN');
  }
  await run('UPDATE web_user SET password_hash = ?, must_change_password = FALSE WHERE id = ?', newHash, userId);
  await signOutEverywhere(userId);
}

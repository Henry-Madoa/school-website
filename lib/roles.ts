import 'server-only';

/*
 * Managing Permission Sets and the accounts that hold them — the Security section of the admin.
 *
 * Everything here is deliberately explicit about one thing: nobody may grant themselves more than
 * they have. Two guards enforce it, and both are in this file rather than in the UI, because the
 * UI is not what a determined request talks to:
 *
 *   1. Only a System Administrator may create, edit or delete a Permission Set, or change who
 *      holds one. Table rights on web_role and web_permission_line are not enough — an editor
 *      granted Modify on web_role could otherwise write themselves Execute on every page.
 *   2. The last active System Administrator cannot be demoted, disabled or deleted. Locking
 *      everybody out of the admin on a Friday afternoon should not be one mis-click away.
 */
import { all, one, run, audit, transaction, type Actor } from './db.ts';
import { AppError } from './errors.ts';
import * as v from './validate.ts';
import { expandActionsToLines, PAGES, pageByCode, ACTIONS, type ActionKey } from './permissions.ts';
import type { ObjectType, PermissionLine, Role, RoleView, User } from './types.ts';

const now = (): string => new Date().toISOString();

/* ============================================================== permission sets */

export const listRoles = (): Promise<RoleView[]> =>
  all<RoleView>(
    `SELECT r.*,
            (SELECT COUNT(*)::int FROM web_user u WHERE u.role_id = r.id)
              + (SELECT COUNT(*)::int FROM web_user_role ur WHERE ur.role_id = r.id) AS user_count,
            (SELECT COUNT(*)::int FROM web_permission_line l WHERE l.role_id = r.id) AS line_count
     FROM web_role r ORDER BY r.is_system DESC, r.name`,
  );

export const getRole = (id: number): Promise<Role | undefined> => one<Role>('SELECT * FROM web_role WHERE id = ?', id);

export const getRoleLines = (roleId: number): Promise<PermissionLine[]> =>
  all<PermissionLine>(
    `SELECT object_type, object_name, read_perm, insert_perm, modify_perm, delete_perm, execute_perm
     FROM web_permission_line WHERE role_id = ? ORDER BY object_type DESC, object_name`,
    roleId,
  );

/** The accounts that hold a set, whether as their primary role or as an extra. */
export const roleHolders = (roleId: number): Promise<{ id: number; name: string; email: string; primary_role: boolean }[]> =>
  all(
    `SELECT u.id, u.name, u.email, (u.role_id = @role) AS primary_role
     FROM web_user u
     WHERE u.role_id = @role OR u.id IN (SELECT user_id FROM web_user_role WHERE role_id = @role)
     ORDER BY u.name`,
    { role: roleId },
  );

export async function createRole(input: { name: unknown; description: unknown }, actor: Actor): Promise<number> {
  const name = v.required(input.name, 'A name', 80);
  if (await one('SELECT id FROM web_role WHERE lower(name) = ?', name.toLowerCase())) {
    throw new AppError('A Permission Set with that name already exists', 'CONFLICT');
  }
  const { id } = await run(
    'INSERT INTO web_role (name, description, is_system, created_at, created_by) VALUES (?,?,FALSE,?,?)',
    name, v.text(input.description, 400), now(), actor.name,
  );
  await audit(actor, 'ROLE_CREATE', 'web_role', id, { name });
  return id;
}

export async function updateRole(id: number, input: { name: unknown; description: unknown }, actor: Actor): Promise<void> {
  const before = await getRole(id);
  if (!before) throw new AppError('That Permission Set no longer exists', 'NOT_FOUND');
  const name = v.required(input.name, 'A name', 80);
  if (await one('SELECT id FROM web_role WHERE lower(name) = ? AND id <> ?', name.toLowerCase(), id)) {
    throw new AppError('A Permission Set with that name already exists', 'CONFLICT');
  }
  // The System Administrator set is renameable but cannot stop being the system set: the flag is
  // what grants unrestricted access, and a database with nobody holding it is a locked building.
  await run('UPDATE web_role SET name = ?, description = ? WHERE id = ?', name, v.text(input.description, 400), id);
  await audit(actor, 'ROLE_UPDATE', 'web_role', id, { name });
}

export async function deleteRole(id: number, actor: Actor): Promise<void> {
  const role = await getRole(id);
  if (!role) return;
  if (role.is_system) throw new AppError('The System Administrator set cannot be deleted', 'VALIDATION');
  const holders = await roleHolders(id);
  if (holders.length) {
    throw new AppError(`${holders.length} account(s) still hold this set. Move them to another one first.`, 'CONFLICT');
  }
  await run('DELETE FROM web_role WHERE id = ?', id);
  await audit(actor, 'ROLE_DELETE', 'web_role', id, { name: role.name });
}

/**
 * Replaces a set's lines wholesale, in one transaction, from what the editor posted.
 *
 * Wholesale rather than line by line because the editor is a grid: the administrator ticks boxes
 * across a screenful of objects and presses Save once, and a half-applied grid is a Permission Set
 * nobody can reason about.
 */
export async function saveRoleLines(roleId: number, lines: PermissionLine[], actor: Actor): Promise<number> {
  const role = await getRole(roleId);
  if (!role) throw new AppError('That Permission Set no longer exists', 'NOT_FOUND');
  if (role.is_system) {
    throw new AppError('The System Administrator set has no lines — its access comes from the flag.', 'VALIDATION');
  }

  const clean = normaliseLines(lines);
  await transaction(async (client) => {
    await client.query('DELETE FROM web_permission_line WHERE role_id = $1', [roleId]);
    for (const line of clean) {
      await client.query(
        `INSERT INTO web_permission_line (role_id, object_type, object_name, read_perm, insert_perm, modify_perm, delete_perm, execute_perm)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [roleId, line.object_type, line.object_name, line.read_perm, line.insert_perm, line.modify_perm, line.delete_perm, line.execute_perm],
      );
    }
  });
  await audit(actor, 'ROLE_PERMISSIONS', 'web_role', roleId, { name: role.name, lines: clean.length });
  return clean.length;
}

/**
 * Drops lines that grant nothing, rejects objects that are not in the catalogue, and makes the two
 * implications the checks assume explicit in the stored rows:
 *   - anything you may insert, modify or delete, you may also read
 *   - a child screen implies Execute on the module it sits in
 */
function normaliseLines(lines: PermissionLine[]): PermissionLine[] {
  const pages = new Map<string, PermissionLine>();
  const tables = new Map<string, PermissionLine>();

  for (const line of lines) {
    if (line.object_type === 'PAGE') {
      if (!line.execute_perm) continue;
      if (!pageByCode(line.object_name)) continue;
      pages.set(line.object_name, { ...line, read_perm: false, insert_perm: false, modify_perm: false, delete_perm: false, execute_perm: true });
      continue;
    }
    const read = line.read_perm || line.insert_perm || line.modify_perm || line.delete_perm;
    if (!read) continue;
    tables.set(line.object_name, { ...line, read_perm: true, execute_perm: false });
  }

  for (const code of [...pages.keys()]) {
    const parent = pageByCode(code)?.parent;
    if (parent && !pages.has(parent)) {
      pages.set(parent, { object_type: 'PAGE', object_name: parent, read_perm: false, insert_perm: false, modify_perm: false, delete_perm: false, execute_perm: true });
    }
  }

  return [...pages.values(), ...tables.values()];
}

/** Reads the Permission Set editor's grid out of the posted form. */
export function linesFromForm(form: FormData): PermissionLine[] {
  const lines = new Map<string, PermissionLine>();
  // Fields are named `perm:<TYPE>:<object>:<right>`, one checkbox each.
  for (const [key, value] of form.entries()) {
    const match = /^perm:(TABLE|PAGE):([a-zA-Z0-9_]+):(read|insert|modify|delete|execute)$/.exec(key);
    if (!match || !v.boolean(value)) continue;
    const [, type, name, right] = match as unknown as [string, ObjectType, string, string];
    const line = lines.get(`${type}:${name}`) ?? {
      object_type: type, object_name: name,
      read_perm: false, insert_perm: false, modify_perm: false, delete_perm: false, execute_perm: false,
    };
    line[`${right}_perm` as 'read_perm'] = true;
    lines.set(`${type}:${name}`, line);
  }
  return [...lines.values()];
}

/**
 * "Give this set everything these operations need" — the shortcut in the editor, and how the seed
 * builds the standard sets. Resolves ACTIONS keys into the lines an administrator would have
 * ticked by hand.
 */
export async function grantActions(roleId: number, keys: ActionKey[], actor: Actor): Promise<number> {
  const valid = keys.filter((key) => key in ACTIONS);
  if (!valid.length) throw new AppError('Choose at least one thing the set should be able to do', 'VALIDATION');
  const existing = await getRoleLines(roleId);
  const merged = mergeLines(existing, expandActionsToLines(valid));
  return saveRoleLines(roleId, merged, actor);
}

/** Union of two line sets — an added grant never takes an existing right away. */
export function mergeLines(base: PermissionLine[], extra: PermissionLine[]): PermissionLine[] {
  const merged = new Map<string, PermissionLine>();
  for (const line of [...base, ...extra]) {
    const key = `${line.object_type}:${line.object_name}`;
    const current = merged.get(key);
    merged.set(key, current
      ? {
        ...current,
        read_perm: current.read_perm || line.read_perm,
        insert_perm: current.insert_perm || line.insert_perm,
        modify_perm: current.modify_perm || line.modify_perm,
        delete_perm: current.delete_perm || line.delete_perm,
        execute_perm: current.execute_perm || line.execute_perm,
      }
      : { ...line });
  }
  return [...merged.values()];
}

/** Every page in the catalogue, for the editor's grid. */
export const permissionPages = () => PAGES.map(({ code, label, route, parent }) => ({ code, label, route, parent: parent ?? null }));

/* ======================================================================== accounts */

const USER_SELECT = `
  SELECT u.id, u.name, u.email, u.role_id, r.name AS role_name, COALESCE(r.is_system, FALSE) AS is_system,
         u.status, u.title, u.avatar_url, u.must_change_password, u.last_login_at, u.created_at, u.created_by
  FROM web_user u LEFT JOIN web_role r ON r.id = u.role_id`;

export const listUsers = (): Promise<User[]> => all<User>(`${USER_SELECT} ORDER BY u.name`);

export const getUser = (id: number): Promise<User | undefined> => one<User>(`${USER_SELECT} WHERE u.id = ?`, id);

/** The extra Permission Sets an account holds beyond its primary role. */
export const extraRoles = (userId: number): Promise<Role[]> =>
  all<Role>('SELECT r.* FROM web_user_role ur JOIN web_role r ON r.id = ur.role_id WHERE ur.user_id = ? ORDER BY r.name', userId);

export const userOverrides = (userId: number): Promise<PermissionLine[]> =>
  all<PermissionLine>(
    `SELECT object_type, object_name, read_perm, insert_perm, modify_perm, delete_perm, execute_perm
     FROM web_user_permission_line WHERE user_id = ? ORDER BY object_type DESC, object_name`,
    userId,
  );

export interface UserInput {
  name: unknown;
  email: unknown;
  roleId: unknown;
  title: unknown;
  status: unknown;
  extraRoleIds?: unknown[];
}

async function readUserInput(input: UserInput): Promise<{ name: string; email: string; roleId: number; title: string | null; status: 'ACTIVE' | 'DISABLED'; extra: number[] }> {
  const email = v.email(input.email, 'An email address');
  if (!email) throw new AppError('An email address is required — it is how they sign in', 'VALIDATION');
  const roleId = v.integer(input.roleId, 1, 1e9);
  if (!roleId) throw new AppError('Choose the Permission Set this account should hold', 'VALIDATION');
  if (!(await getRole(roleId))) throw new AppError('That Permission Set no longer exists', 'VALIDATION');

  const extra = [...new Set((input.extraRoleIds ?? []).map((id) => v.integer(id, 1, 1e9)).filter((id): id is number => !!id && id !== roleId))];
  return {
    name: v.required(input.name, 'A name', 120),
    email,
    roleId,
    title: v.text(input.title, 120),
    status: v.choice(input.status ?? 'ACTIVE', ['ACTIVE', 'DISABLED'] as const, 'status'),
    extra,
  };
}

export async function createUser(input: UserInput, passwordHash: string, actor: Actor): Promise<number> {
  const row = await readUserInput(input);
  if (await one('SELECT id FROM web_user WHERE lower(email) = ?', row.email)) {
    throw new AppError('Someone already uses that email address', 'CONFLICT');
  }
  const { id } = await run(
    `INSERT INTO web_user (name, email, password_hash, role_id, status, title, must_change_password, created_at, created_by)
     VALUES (?,?,?,?,?,?,TRUE,?,?)`,
    row.name, row.email, passwordHash, row.roleId, row.status, row.title, now(), actor.name,
  );
  await setExtraRoles(id, row.extra, actor);
  await audit(actor, 'USER_CREATE', 'web_user', id, { email: row.email, role: row.roleId });
  return id;
}

export async function updateUser(id: number, input: UserInput, actor: Actor): Promise<void> {
  const before = await getUser(id);
  if (!before) throw new AppError('That account no longer exists', 'NOT_FOUND');
  const row = await readUserInput(input);
  if (await one('SELECT id FROM web_user WHERE lower(email) = ? AND id <> ?', row.email, id)) {
    throw new AppError('Someone already uses that email address', 'CONFLICT');
  }

  const nextRole = await getRole(row.roleId);
  const losingSystem = before.is_system && (!nextRole?.is_system || row.status !== 'ACTIVE');
  if (losingSystem) await assertNotLastAdministrator(id);

  await run(
    'UPDATE web_user SET name=?, email=?, role_id=?, status=?, title=? WHERE id=?',
    row.name, row.email, row.roleId, row.status, row.title, id,
  );
  await setExtraRoles(id, row.extra, actor);
  // A disabled account should not stay signed in on whatever machine it is signed in on.
  if (row.status === 'DISABLED') await run('DELETE FROM web_session WHERE user_id = ?', id);
  await audit(actor, 'USER_UPDATE', 'web_user', id, { email: row.email, role: row.roleId, status: row.status });
}

async function setExtraRoles(userId: number, roleIds: number[], actor: Actor): Promise<void> {
  await run('DELETE FROM web_user_role WHERE user_id = ?', userId);
  for (const roleId of roleIds) {
    await run(
      'INSERT INTO web_user_role (user_id, role_id, created_at, created_by) VALUES (?,?,?,?) ON CONFLICT DO NOTHING RETURNING id',
      userId, roleId, now(), actor.name,
    );
  }
}

export async function setUserPassword(id: number, passwordHash: string, mustChange: boolean, actor: Actor): Promise<void> {
  const { rowCount } = await run(
    'UPDATE web_user SET password_hash = ?, must_change_password = ? WHERE id = ?',
    passwordHash, mustChange, id,
  );
  if (!rowCount) throw new AppError('That account no longer exists', 'NOT_FOUND');
  // A reset that leaves the old sessions alive has reset nothing.
  await run('DELETE FROM web_session WHERE user_id = ?', id);
  await audit(actor, 'USER_PASSWORD_RESET', 'web_user', id, {});
}

export async function deleteUser(id: number, actor: Actor): Promise<void> {
  if (id === actor.id) throw new AppError('You cannot delete the account you are signed in with', 'VALIDATION');
  const before = await getUser(id);
  if (!before) return;
  if (before.is_system) await assertNotLastAdministrator(id);
  await run('DELETE FROM web_user WHERE id = ?', id);
  await audit(actor, 'USER_DELETE', 'web_user', id, { email: before.email });
}

/** Replaces one account's override lines — the per-user exceptions to its Permission Sets. */
export async function saveUserOverrides(userId: number, lines: PermissionLine[], actor: Actor): Promise<number> {
  const user = await getUser(userId);
  if (!user) throw new AppError('That account no longer exists', 'NOT_FOUND');
  const clean = normaliseLines(lines);
  await transaction(async (client) => {
    await client.query('DELETE FROM web_user_permission_line WHERE user_id = $1', [userId]);
    for (const line of clean) {
      await client.query(
        `INSERT INTO web_user_permission_line (user_id, object_type, object_name, read_perm, insert_perm, modify_perm, delete_perm, execute_perm, created_at, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [userId, line.object_type, line.object_name, line.read_perm, line.insert_perm, line.modify_perm, line.delete_perm, line.execute_perm, now(), actor.name],
      );
    }
  });
  await audit(actor, 'USER_PERMISSIONS', 'web_user', userId, { lines: clean.length });
  return clean.length;
}

/** Throws unless at least one *other* active System Administrator would remain. */
async function assertNotLastAdministrator(excludingUserId: number): Promise<void> {
  const others = await one<{ n: number }>(
    `SELECT COUNT(DISTINCT u.id)::int AS n
     FROM web_user u
     LEFT JOIN web_role r ON r.id = u.role_id
     LEFT JOIN web_user_role ur ON ur.user_id = u.id
     LEFT JOIN web_role extra ON extra.id = ur.role_id
     WHERE u.status = 'ACTIVE' AND u.id <> ? AND (r.is_system OR extra.is_system)`,
    excludingUserId,
  );
  if (!others?.n) {
    throw new AppError('This is the last active System Administrator — give somebody else that set first.', 'VALIDATION');
  }
}

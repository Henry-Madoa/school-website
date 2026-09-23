import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth.ts';
import { getUser, listRoles, extraRoles, userOverrides, permissionPages } from '@/lib/roles.ts';
import { listPermissionTables } from '@/lib/permissions.ts';
import { formatDateTime } from '@/lib/format.ts';
import { saveUser, resetUserPassword, deleteUser, saveUserPermissions } from '@/app/actions/security.ts';
import { ActionForm, ActionFormRedirect, ConfirmSubmit, Submit } from '../../../ui.tsx';
import { SecurityTabs } from '../../tabs.tsx';
import { PermissionGrid } from '../../permission-grid.tsx';

export const metadata = { title: 'User' };

export default async function UserCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requirePage('SECURITY_USERS');
  const account = await getUser(Number(id));
  if (!account) notFound();

  const [roles, extras, overrides, tables] = await Promise.all([
    listRoles(),
    extraRoles(account.id),
    userOverrides(account.id),
    listPermissionTables(),
  ]);
  const pages = permissionPages();
  const mayManage = viewer.is_system;
  const isSelf = viewer.id === account.id;

  return (
    <>
      <SecurityTabs user={viewer} current="users" />

      <div className="crumb">
        <Link href="/admin/security/users">Users</Link><span aria-hidden="true">›</span>{account.name}
      </div>

      {!mayManage ? (
        <div className="note note-info">Only a System Administrator may change an account.</div>
      ) : isSelf ? (
        <div className="note note-warn">
          This is your own account. You cannot delete it, and you cannot take the System Administrator set away from
          yourself if you are the last one holding it.
        </div>
      ) : null}

      <ActionForm action={saveUser} success="Saved.">
        <input type="hidden" name="id" value={account.id} />
        <fieldset disabled={!mayManage} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="panel">
            <header>
              <div>
                <h2>{account.name}</h2>
                <p>
                  {account.email}
                  {account.last_login_at ? ` · last signed in ${formatDateTime(account.last_login_at)}` : ' · never signed in'}
                </p>
              </div>
              <span style={{ flex: 1 }} />
              <Link href="/admin/security/users" className="btn btn-ghost btn-xs">Back</Link>
              {mayManage ? <Submit>Save account</Submit> : null}
            </header>
            <div className="body">
              <div className="grid-3">
                <div className="field">
                  <label htmlFor="name">Full name</label>
                  <input id="name" name="name" type="text" required maxLength={120} defaultValue={account.name} />
                </div>
                <div className="field">
                  <label htmlFor="email">Email address</label>
                  <input id="email" name="email" type="email" required maxLength={160} defaultValue={account.email} />
                </div>
                <div className="field">
                  <label htmlFor="title">Job title</label>
                  <input id="title" name="title" type="text" maxLength={120} defaultValue={account.title ?? ''} />
                </div>
              </div>

              <div className="grid-2">
                <div className="field">
                  <label htmlFor="role_id">Primary Permission Set</label>
                  <select id="role_id" name="role_id" required defaultValue={String(account.role_id ?? '')}>
                    <option value="">— none —</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>{role.name}{role.is_system ? ' (unrestricted)' : ''}</option>
                    ))}
                  </select>
                  <p className="help">An account with no set can sign in to nothing.</p>
                </div>
                <div className="field">
                  <label htmlFor="status">Status</label>
                  <select id="status" name="status" defaultValue={account.status}>
                    <option value="ACTIVE">Active</option>
                    <option value="DISABLED">Disabled</option>
                  </select>
                  <p className="help">Disabling ends every session they have open, immediately.</p>
                </div>
              </div>

              <div className="field">
                <label>Additional Permission Sets</label>
                <p className="help" style={{ marginTop: 0, marginBottom: 8 }}>
                  Rights are the union of every set held — useful for somebody who does two jobs.
                </p>
                <div className="grid-3">
                  {roles.filter((role) => role.id !== account.role_id).map((role) => (
                    <label key={role.id} className="check-row">
                      <input
                        type="checkbox"
                        name="extra_roles"
                        value={role.id}
                        defaultChecked={extras.some((held) => held.id === role.id)}
                      />
                      <span style={{ fontSize: '0.82rem' }}>
                        {role.name}
                        {role.is_system ? <span className="badge badge-bad" style={{ marginLeft: 6 }}>unrestricted</span> : null}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </fieldset>
      </ActionForm>

      {mayManage ? (
        <>
          <ActionForm action={resetUserPassword} success="Password reset. They must change it when they next sign in.">
            <input type="hidden" name="id" value={account.id} />
            <div className="panel">
              <header>
                <div>
                  <h2>Reset the password</h2>
                  <p>Every session of theirs ends at once, and they must choose a new password on their next sign-in.</p>
                </div>
                <span style={{ flex: 1 }} />
                <Submit className="btn btn-ghost">Reset</Submit>
              </header>
              <div className="body">
                <div className="grid-2">
                  <div className="field">
                    <label htmlFor="password">New password</label>
                    <input id="password" name="password" type="text" required minLength={10} maxLength={72} />
                    <p className="help">At least 10 characters. Hand it over in person, not by email.</p>
                  </div>
                </div>
              </div>
            </div>
          </ActionForm>

          <ActionForm action={saveUserPermissions} success="Overrides saved.">
            <input type="hidden" name="user_id" value={account.id} />
            <div className="panel">
              <header>
                <div>
                  <h2>Exceptions for this person</h2>
                  <p>
                    A tick here <em>replaces</em> what their Permission Sets say about that one object — for restricting
                    or extending one person without editing a set everybody else holds.
                  </p>
                </div>
                <span style={{ flex: 1 }} />
                <Submit>Save exceptions</Submit>
              </header>
              <div className="body">
                {overrides.length === 0 ? (
                  <div className="note note-info" style={{ marginBottom: 16 }}>
                    There are no exceptions: this account has exactly what its Permission Sets grant. Anything you tick
                    below becomes an exception and overrides the set for that object alone.
                  </div>
                ) : (
                  <div className="note note-warn" style={{ marginBottom: 16 }}>
                    {overrides.length} exception{overrides.length === 1 ? '' : 's'} are in force for this account.
                    Clearing every box and saving removes them all and returns the person to their sets.
                  </div>
                )}
                <PermissionGrid pages={pages} tables={tables} lines={overrides} />
              </div>
            </div>
          </ActionForm>

          {!isSelf ? (
            <div className="panel">
              <header><h2>Delete this account</h2></header>
              <div className="body" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <p className="help" style={{ margin: 0, flex: '1 1 320px' }}>
                  Disabling is nearly always better: it keeps the audit trail readable, because the rows this person
                  wrote still point at a real account. Deleting leaves their name in the trail but no account behind it.
                </p>
                <ActionFormRedirect action={deleteUser} to="/admin/security/users">
                  <input type="hidden" name="id" value={account.id} />
                  <ConfirmSubmit message={`Delete the account for ${account.name}?`} className="btn btn-danger">
                    Delete account
                  </ConfirmSubmit>
                </ActionFormRedirect>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}

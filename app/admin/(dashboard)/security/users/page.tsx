import Link from 'next/link';
import { requirePage } from '@/lib/auth.ts';
import { listUsers, listRoles } from '@/lib/roles.ts';
import { formatDateShort, relativeDays } from '@/lib/format.ts';
import { saveUser } from '@/app/actions/security.ts';
import { ActionFormRedirect, RowFilter, Submit } from '../../ui.tsx';
import { SecurityTabs } from '../tabs.tsx';

export const metadata = { title: 'Users' };

export default async function UsersPage() {
  const user = await requirePage('SECURITY_USERS');
  const [users, roles] = await Promise.all([listUsers(), listRoles()]);
  const mayManage = user.is_system;

  return (
    <>
      <SecurityTabs user={user} current="users" />

      {!mayManage ? (
        <div className="note note-info">
          Only a System Administrator may create accounts or change what they may do.
        </div>
      ) : null}

      <div className="panel">
        <header>
          <div>
            <h2>Users</h2>
            <p>
              {users.length} account{users.length === 1 ? '' : 's'} ·{' '}
              {users.filter((account) => account.status === 'ACTIVE').length} active ·{' '}
              {users.filter((account) => account.is_system).length} System Administrator(s)
            </p>
          </div>
        </header>

        <div className="body">
          <RowFilter placeholder="Filter by name, email or Permission Set…">
            <div className="table-wrap">
              <table className="list">
                <thead>
                  <tr><th>Name</th><th>Permission Set</th><th>Last signed in</th><th>Status</th><th className="actions">&nbsp;</th></tr>
                </thead>
                <tbody>
                  {users.map((account) => (
                    <tr key={account.id} data-filter={`${account.name} ${account.email} ${account.role_name ?? ''} ${account.title ?? ''}`}>
                      <td>
                        <Link href={`/admin/security/users/${account.id}`} className="row-link">{account.name}</Link>
                        <span className="sub">{account.email}{account.title ? ` · ${account.title}` : ''}</span>
                      </td>
                      <td>
                        {account.role_name
                          ? <span className={`badge ${account.is_system ? 'badge-bad' : 'badge-brand'}`}>{account.role_name}</span>
                          : <span className="badge badge-warn">None</span>}
                      </td>
                      <td>
                        {account.last_login_at ? formatDateShort(account.last_login_at) : <span className="help">Never</span>}
                        {account.last_login_at ? <span className="sub">{relativeDays(account.last_login_at)}</span> : null}
                      </td>
                      <td>
                        {account.status === 'ACTIVE' ? <span className="badge badge-ok">Active</span> : <span className="badge">Disabled</span>}
                        {account.must_change_password ? <span className="sub"><span className="badge badge-warn">Must change password</span></span> : null}
                      </td>
                      <td className="actions">
                        <Link href={`/admin/security/users/${account.id}`} className="btn btn-ghost btn-xs">
                          {mayManage ? 'Edit' : 'View'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </RowFilter>
        </div>
      </div>

      {mayManage ? (
        <ActionFormRedirect action={saveUser} to="/admin/security/users/:id">
          <div className="panel">
            <header>
              <div>
                <h2>New account</h2>
                <p>They must change the password you set the first time they sign in.</p>
              </div>
              <span style={{ flex: 1 }} />
              <Submit>Create account</Submit>
            </header>
            <div className="body">
              <div className="grid-3">
                <div className="field">
                  <label htmlFor="name">Full name</label>
                  <input id="name" name="name" type="text" required maxLength={120} />
                </div>
                <div className="field">
                  <label htmlFor="email">Email address</label>
                  <input id="email" name="email" type="email" required maxLength={160} />
                  <p className="help">This is how they sign in.</p>
                </div>
                <div className="field">
                  <label htmlFor="title">Job title</label>
                  <input id="title" name="title" type="text" maxLength={120} placeholder="Communications Officer" />
                </div>
              </div>
              <div className="grid-3">
                <div className="field">
                  <label htmlFor="role_id">Permission Set</label>
                  <select id="role_id" name="role_id" required defaultValue="">
                    <option value="">— choose —</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>{role.name}{role.is_system ? ' (unrestricted)' : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="password">First password</label>
                  <input id="password" name="password" type="text" required minLength={10} maxLength={72} />
                  <p className="help">At least 10 characters. Hand it over in person, not by email.</p>
                </div>
                <div className="field">
                  <label htmlFor="status">Status</label>
                  <select id="status" name="status" defaultValue="ACTIVE">
                    <option value="ACTIVE">Active</option>
                    <option value="DISABLED">Disabled</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </ActionFormRedirect>
      ) : null}
    </>
  );
}

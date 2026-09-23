import Link from 'next/link';
import { requireUser } from '@/lib/auth.ts';
import { visiblePages } from '@/lib/permissions.ts';
import { formatDateTime } from '@/lib/format.ts';
import { PasswordForm } from './password-form.tsx';

export const metadata = { title: 'My account' };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const [user, { password }] = await Promise.all([requireUser(), searchParams]);
  const forced = password === 'required' || user.must_change_password;
  const screens = visiblePages(user);

  return (
    <>
      {forced ? (
        <div className="note note-warn">
          <strong>Please choose your own password.</strong> The one you were given is known to whoever set it up, and
          it should stop working. Changing it signs you out everywhere, including here — sign back in with the new one.
        </div>
      ) : null}

      <div className="grid-side">
        <div style={{ display: 'grid', gap: 20 }}>
          <div className="panel">
            <header>
              <div>
                <h2>{user.name}</h2>
                <p>{user.email}{user.title ? ` · ${user.title}` : ''}</p>
              </div>
            </header>
            <div className="table-wrap">
              <table className="list">
                <tbody>
                  <tr>
                    <td style={{ width: 200 }}>Permission Sets</td>
                    <td>
                      {user.roles.length
                        ? user.roles.map((role) => (
                          <span key={role.id} className={`badge ${role.is_system ? 'badge-bad' : 'badge-brand'}`} style={{ marginRight: 6 }}>
                            {role.name}
                          </span>
                        ))
                        : <span className="badge badge-warn">None</span>}
                    </td>
                  </tr>
                  <tr><td>Account created</td><td>{formatDateTime(user.created_at)}{user.created_by ? ` by ${user.created_by}` : ''}</td></tr>
                  <tr><td>Last signed in</td><td>{user.last_login_at ? formatDateTime(user.last_login_at) : 'This is your first visit'}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <PasswordForm forced={forced} />
        </div>

        <aside>
          <div className="panel">
            <header><h2>What you can open</h2></header>
            <div className="body">
              {user.is_system ? (
                <p className="help" style={{ margin: 0 }}>
                  You hold the System Administrator set, so every screen is open to you — including Permission Sets and
                  the audit trail. There are two things even you cannot do: delete your own account, and take the last
                  System Administrator set away from the last person holding it.
                </p>
              ) : (
                <>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                    {screens.map((screen) => (
                      <li key={screen.code} style={{ fontSize: '0.84rem' }}>
                        <Link href={screen.route} style={{ textDecoration: 'none', color: 'var(--ink)' }}>
                          <span aria-hidden="true" style={{ marginRight: 8 }}>{screen.icon}</span>{screen.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <p className="help" style={{ marginTop: 14 }}>
                    Need a screen that is not here? Ask a System Administrator to add it to your Permission Set, or to
                    grant it to you alone as an exception.
                  </p>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

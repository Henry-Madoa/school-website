import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth.ts';
import { getRole, getRoleLines, roleHolders, permissionPages } from '@/lib/roles.ts';
import { listPermissionTables, ACTIONS, type ActionKey } from '@/lib/permissions.ts';
import { saveRole, saveRolePermissions, grantRoleActions } from '@/app/actions/security.ts';
import { ActionForm, RowFilter, Submit } from '../../../ui.tsx';
import { SecurityTabs } from '../../tabs.tsx';
import { PermissionGrid } from '../../permission-grid.tsx';

export const metadata = { title: 'Permission Set' };

/** The ACTIONS registry, grouped by the screen each operation is reached from. */
function actionsByPage(): { page: string; keys: ActionKey[] }[] {
  const grouped = new Map<string, ActionKey[]>();
  for (const key of Object.keys(ACTIONS) as ActionKey[]) {
    const page = ACTIONS[key].page;
    grouped.set(page, [...(grouped.get(page) ?? []), key]);
  }
  return [...grouped.entries()].map(([page, keys]) => ({ page, keys }));
}

export default async function RoleCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePage('SECURITY_ROLES');
  const role = await getRole(Number(id));
  if (!role) notFound();

  const [lines, holders, tables] = await Promise.all([
    getRoleLines(role.id),
    roleHolders(role.id),
    listPermissionTables(),
  ]);
  const pages = permissionPages();
  const mayManage = user.is_system && !role.is_system;

  return (
    <>
      <SecurityTabs user={user} current="roles" />

      <div className="crumb">
        <Link href="/admin/security/roles">Permission Sets</Link><span aria-hidden="true">›</span>{role.name}
      </div>

      {role.is_system ? (
        <div className="note note-warn">
          This is the <strong>System Administrator</strong> set. Its access comes from a flag rather than from lines,
          so there is nothing to tick here — it can open every screen and change every record, including this one.
        </div>
      ) : !user.is_system ? (
        <div className="note note-info">
          Only a System Administrator may change a Permission Set. This is what this one currently grants.
        </div>
      ) : null}

      <ActionForm action={saveRole} success="Saved.">
        <input type="hidden" name="id" value={role.id} />
        <fieldset disabled={!user.is_system} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="panel">
            <header>
              <div>
                <h2>{role.name}</h2>
                <p>
                  {holders.length} account{holders.length === 1 ? '' : 's'} hold this set
                  {role.is_system ? '' : ` · ${lines.length} line${lines.length === 1 ? '' : 's'}`}
                </p>
              </div>
              <span style={{ flex: 1 }} />
              <Link href="/admin/security/roles" className="btn btn-ghost btn-xs">Back</Link>
              {user.is_system ? <Submit>Save name</Submit> : null}
            </header>
            <div className="body">
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="name">Name</label>
                  <input id="name" name="name" type="text" required maxLength={80} defaultValue={role.name} />
                </div>
                <div className="field">
                  <label htmlFor="description">What it is for</label>
                  <input id="description" name="description" type="text" maxLength={400} defaultValue={role.description ?? ''} />
                </div>
              </div>
            </div>
          </div>
        </fieldset>
      </ActionForm>

      {holders.length ? (
        <div className="panel">
          <header><h2>Who holds it</h2></header>
          <div className="body">
            <RowFilter placeholder="Search by name or email…">
              <div className="table-wrap">
                <table className="list">
                  <tbody>
                    {holders.map((holder) => (
                      <tr key={holder.id}>
                        <td>
                          <Link href={`/admin/security/users/${holder.id}`} className="row-link">{holder.name}</Link>
                          <span className="sub">{holder.email}</span>
                        </td>
                        <td className="num">
                          {holder.primary_role ? <span className="badge badge-brand">Primary</span> : <span className="badge">Additional</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </RowFilter>
          </div>
        </div>
      ) : null}

      {!role.is_system ? (
        <>
          {mayManage ? (
            <ActionForm action={grantRoleActions} success="Rights added.">
              <input type="hidden" name="role_id" value={role.id} />
              <div className="panel">
                <header>
                  <div>
                    <h2>Grant by job, rather than box by box</h2>
                    <p>Tick the operations this set should be able to perform; the screens and record rights they need are worked out and added.</p>
                  </div>
                  <span style={{ flex: 1 }} />
                  <Submit>Add these rights</Submit>
                </header>
                <div className="body">
                  <div className="grid-3">
                    {actionsByPage().map(({ page, keys }) => (
                      <div key={page}>
                        <h3 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', margin: '0 0 6px' }}>
                          {pages.find((candidate) => candidate.code === page)?.label ?? page}
                        </h3>
                        {keys.map((key) => (
                          <label key={key} className="check-row" style={{ padding: '4px 0' }}>
                            <input type="checkbox" name="actions" value={key} />
                            <span style={{ fontSize: '0.8rem' }}>{key.split('_').slice(1).join(' ').toLowerCase() || key.toLowerCase()}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                  <p className="help">
                    This only ever adds. To take a right away, untick it in the grid below and save that instead.
                  </p>
                </div>
              </div>
            </ActionForm>
          ) : null}

          <ActionForm action={saveRolePermissions} success="Permission Set saved.">
            <input type="hidden" name="role_id" value={role.id} />
            <div className="panel">
              <header>
                <div>
                  <h2>What this set grants</h2>
                  <p>The whole grid is saved at once, so what you see here is exactly what the set will be.</p>
                </div>
                <span style={{ flex: 1 }} />
                {mayManage ? <Submit>Save Permission Set</Submit> : null}
              </header>
              <div className="body">
                <PermissionGrid pages={pages} tables={tables} lines={lines} disabled={!mayManage} />
              </div>
            </div>
          </ActionForm>
        </>
      ) : null}
    </>
  );
}

import Link from 'next/link';
import { requirePage } from '@/lib/auth.ts';
import { listRoles } from '@/lib/roles.ts';
import { saveRole, deleteRole } from '@/app/actions/security.ts';
import { ActionForm, ActionFormRedirect, ConfirmSubmit, RowFilter, Submit } from '../../ui.tsx';
import { SecurityTabs } from '../tabs.tsx';

export const metadata = { title: 'Permission Sets' };

/**
 * Permission Sets, in the same sense the school's management system uses the term: a named role
 * whose access is a list of lines granting rights on screens and on records.
 *
 * Only a System Administrator may change them. That is stricter than the model itself — table
 * rights on web_role would otherwise let somebody grant themselves everything — and it is
 * enforced in the Server Action, not here.
 */
export default async function RolesPage() {
  const user = await requirePage('SECURITY_ROLES');
  const roles = await listRoles();
  const mayManage = user.is_system;

  return (
    <>
      <SecurityTabs user={user} current="roles" />

      {!mayManage ? (
        <div className="note note-info">
          Only a System Administrator may create or change a Permission Set. You can see what each one grants.
        </div>
      ) : null}

      <div className="panel">
        <header>
          <div>
            <h2>Permission Sets</h2>
            <p>{roles.length} sets. A person holds one as their primary role, and may hold others as well.</p>
          </div>
        </header>

        <div className="body">
          <RowFilter placeholder="Search Permission Sets…">
            <div className="table-wrap">
              <table className="list">
                <thead>
                  <tr><th>Set</th><th>What it is for</th><th className="num">Lines</th><th className="num">People</th><th className="actions">&nbsp;</th></tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role.id}>
                      <td>
                        <Link href={`/admin/security/roles/${role.id}`} className="row-link">{role.name}</Link>
                        {role.is_system ? <span className="sub"><span className="badge badge-bad">Unrestricted</span></span> : null}
                      </td>
                      <td className="help">{role.description ?? '—'}</td>
                      <td className="num">{role.is_system ? <span className="help">all</span> : role.line_count}</td>
                      <td className="num">{role.user_count}</td>
                      <td className="actions">
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <Link href={`/admin/security/roles/${role.id}`} className="btn btn-ghost btn-xs">
                            {mayManage && !role.is_system ? 'Edit' : 'View'}
                          </Link>
                          {mayManage && !role.is_system && role.user_count === 0 ? (
                            <ActionForm action={deleteRole}>
                              <input type="hidden" name="id" value={role.id} />
                              <ConfirmSubmit message={`Delete the "${role.name}" Permission Set?`}>Delete</ConfirmSubmit>
                            </ActionForm>
                          ) : null}
                        </div>
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
        <ActionFormRedirect action={saveRole} to="/admin/security/roles/:id">
          <div className="panel">
            <header>
              <div>
                <h2>New Permission Set</h2>
                <p>Create it first; you choose what it grants on its own screen.</p>
              </div>
              <span style={{ flex: 1 }} />
              <Submit>Create</Submit>
            </header>
            <div className="body">
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="name">Name</label>
                  <input id="name" name="name" type="text" required maxLength={80} placeholder="Sports Coordinator" />
                  <p className="help">Name it after the job, not the person.</p>
                </div>
                <div className="field">
                  <label htmlFor="description">What it is for</label>
                  <input id="description" name="description" type="text" maxLength={400} placeholder="Fixtures, results and the sports photographs." />
                </div>
              </div>
            </div>
          </div>
        </ActionFormRedirect>
      ) : null}

      <div className="panel">
        <header><h2>How a set is put together</h2></header>
        <div className="body">
          <p className="help" style={{ margin: 0 }}>
            A set grants two kinds of thing. <strong>Screens</strong> decide whether somebody can open a page at all —
            without one, the entry is not even in their sidebar. <strong>Records</strong> decide what they may do once
            they are there: Read, Insert, Modify, Delete, table by table. Both are needed. Modify on notices without the
            News screen grants nothing, and the News screen without Read on notices opens a page that cannot load.
          </p>
          <p className="help">
            The <strong>System Administrator</strong> set carries no lines at all — its access comes from a flag, exactly
            as the management system does it, so there is no wildcard row anybody can delete by mistake. The last active
            holder of it cannot be demoted, disabled or deleted.
          </p>
        </div>
      </div>
    </>
  );
}

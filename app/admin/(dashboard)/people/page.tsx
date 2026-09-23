import Link from 'next/link';
import { requirePage } from '@/lib/auth.ts';
import { canAction } from '@/lib/permissions.ts';
import { adminStaff } from '@/lib/content.ts';
import { cdn } from '@/lib/cloudinary.ts';
import { initials, truncate } from '@/lib/format.ts';
import { STAFF_CATEGORIES } from '@/lib/types.ts';
import { deleteStaff } from '@/app/actions/content.ts';
import { ActionForm, ConfirmSubmit, RowFilter } from '../ui.tsx';

export const metadata = { title: 'Staff & leadership' };

export default async function PeopleListPage() {
  const user = await requirePage('PEOPLE');
  const staff = await adminStaff();
  const mayDelete = canAction(user, 'PEOPLE_DELETE');

  return (
    <div className="panel">
      <header>
        <div>
          <h2>Staff &amp; leadership</h2>
          <p>
            {staff.length} profile{staff.length === 1 ? '' : 's'} ·{' '}
            {STAFF_CATEGORIES.map((category) => `${staff.filter((person) => person.category === category.value).length} ${category.label.toLowerCase()}`).join(' · ')}
          </p>
        </div>
        <span style={{ flex: 1 }} />
        {canAction(user, 'PEOPLE_CREATE') ? <Link href="/admin/people/new" className="btn btn-primary">Add a profile</Link> : null}
      </header>

      <div className="body">
        {staff.length === 0 ? (
          <div className="empty">
            <span className="big" aria-hidden="true">👥</span>
            <h3>No profiles yet</h3>
            <p>Profiles appear on the website&rsquo;s Staff page, and the leadership ones also appear on the About page.</p>
            {canAction(user, 'PEOPLE_CREATE') ? <Link href="/admin/people/new" className="btn btn-primary">Add the first one</Link> : null}
          </div>
        ) : (
          <RowFilter placeholder="Filter by name, role or department…">
            <div className="table-wrap">
              <table className="list">
                <thead>
                  <tr><th>Name</th><th>Role</th><th>Section</th><th className="num">Order</th><th>Status</th><th className="actions">&nbsp;</th></tr>
                </thead>
                <tbody>
                  {staff.map((person) => (
                    <tr key={person.id} data-filter={`${person.name} ${person.role_title} ${person.qualification ?? ''} ${person.category}`}>
                      <td>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <span
                            aria-hidden="true"
                            style={{
                              width: 34, height: 34, borderRadius: '50%', flex: '0 0 auto', overflow: 'hidden',
                              background: 'color-mix(in srgb, var(--brand) 14%, transparent)', color: 'var(--brand)',
                              display: 'grid', placeItems: 'center', fontSize: '0.7rem', fontWeight: 800,
                            }}
                          >
                            {person.photo_url
                              ? <img src={cdn(person.photo_url, { width: 80, height: 80 })} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : initials(person.name)}
                          </span>
                          <span>
                            <Link href={`/admin/people/${person.id}`} className="row-link">{person.name}</Link>
                            {person.qualification ? <span className="sub">{truncate(person.qualification, 46)}</span> : null}
                          </span>
                        </div>
                      </td>
                      <td>{person.role_title}</td>
                      <td><span className="badge">{STAFF_CATEGORIES.find((c) => c.value === person.category)?.label ?? person.category}</span></td>
                      <td className="num">{person.sort}</td>
                      <td>{person.is_published ? <span className="badge badge-ok">Live</span> : <span className="badge badge-warn">Hidden</span>}</td>
                      <td className="actions">
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <Link href={`/admin/people/${person.id}`} className="btn btn-ghost btn-xs">Open</Link>
                          {mayDelete ? (
                            <ActionForm action={deleteStaff}>
                              <input type="hidden" name="id" value={person.id} />
                              <ConfirmSubmit message={`Remove ${person.name} from the website?`}>Delete</ConfirmSubmit>
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
        )}
      </div>
    </div>
  );
}

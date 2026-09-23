import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth.ts';
import { canAction } from '@/lib/permissions.ts';
import { getApplication } from '@/lib/inbox.ts';
import { getSettings } from '@/lib/site.ts';
import { formatDate, formatDateTime, telHref, whatsappHref } from '@/lib/format.ts';
import { APPLICATION_STATUSES } from '@/lib/types.ts';
import { setApplicationStatus, deleteApplication } from '@/app/actions/content.ts';
import { ActionForm, ActionFormRedirect, ConfirmSubmit, Submit } from '../../ui.tsx';

export const metadata = { title: 'Application' };

/** Years between a date of birth and 1 January of the coming year, as the Ministry measures it. */
function ageAtEntry(dob: string | null): string {
  if (!dob) return '—';
  const entry = new Date(Date.UTC(new Date().getFullYear() + 1, 0, 1));
  const born = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(born.getTime())) return '—';
  const years = (entry.getTime() - born.getTime()) / (365.25 * 86_400_000);
  return `${Math.floor(years)} on 1 January`;
}

export default async function ApplicationCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePage('APPLICATIONS');
  const [application, school] = await Promise.all([getApplication(Number(id)), getSettings()]);
  if (!application) notFound();

  const mayUpdate = canAction(user, 'APPLICATIONS_UPDATE');
  const mayDelete = canAction(user, 'APPLICATIONS_DELETE');
  const short = school.short_name ?? school.name;
  const childName = [application.first_name, application.middle_name, application.last_name].filter(Boolean).join(' ');

  return (
    <>
      <div className="crumb"><Link href="/admin/applications">Applications</Link><span aria-hidden="true">›</span>{application.no}</div>

      <div className="grid-side">
        <div style={{ display: 'grid', gap: 20 }}>
          <div className="panel">
            <header>
              <div>
                <h2>{childName}</h2>
                <p>
                  {application.no} · received {formatDateTime(application.created_at)}
                  {application.source_page ? ` from ${application.source_page}` : ''}
                </p>
              </div>
              <span style={{ flex: 1 }} />
              <span className="badge badge-info">{application.status.toLowerCase()}</span>
            </header>

            <div className="table-wrap">
              <table className="list">
                <tbody>
                  <tr><td style={{ width: 190 }}>Applying for</td><td>{application.grade_name ?? '—'}{application.level_name ? ` · ${application.level_name}` : ''}</td></tr>
                  <tr><td>Day or boarding</td><td>{application.boarding_status === 'BOARDER' ? 'Boarder' : 'Day scholar'}</td></tr>
                  {application.transport_route ? <tr><td>School bus</td><td>{application.transport_route}</td></tr> : null}
                  <tr><td>Date of birth</td><td>{application.date_of_birth ? formatDate(application.date_of_birth) : '—'}<span className="sub">{ageAtEntry(application.date_of_birth)}</span></td></tr>
                  <tr><td>Gender</td><td>{application.gender === 'MALE' ? 'Boy' : application.gender === 'FEMALE' ? 'Girl' : '—'}</td></tr>
                  <tr><td>Current / previous school</td><td>{application.previous_school ?? <span className="help">Not given</span>}</td></tr>
                  <tr>
                    <td>Medical or learning needs</td>
                    <td style={{ whiteSpace: 'pre-wrap' }}>{application.medical ?? <span className="help">Nothing declared</span>}</td>
                  </tr>
                  <tr>
                    <td>Photography consent</td>
                    <td>{application.photo_consent ? <span className="badge badge-ok">Given</span> : <span className="badge badge-warn">Not given</span>}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <header><h2>Parent or guardian</h2></header>
            <div className="table-wrap">
              <table className="list">
                <tbody>
                  <tr><td style={{ width: 190 }}>Name</td><td>{application.guardian_name}</td></tr>
                  <tr><td>Relationship</td><td>{application.guardian_relationship ?? 'Parent'}</td></tr>
                  <tr>
                    <td>Phone</td>
                    <td>
                      <a href={telHref(application.guardian_phone)}>{application.guardian_phone}</a>
                      {' · '}
                      <a href={whatsappHref(application.guardian_phone, `Hello, this is ${short} about application ${application.no}.`)} target="_blank" rel="noreferrer">WhatsApp</a>
                    </td>
                  </tr>
                  <tr>
                    <td>Email</td>
                    <td>{application.guardian_email ? <a href={`mailto:${application.guardian_email}?subject=${encodeURIComponent(`${short} — application ${application.no}`)}`}>{application.guardian_email}</a> : <span className="help">Not given</span>}</td>
                  </tr>
                  <tr>
                    <td>Their note</td>
                    <td style={{ whiteSpace: 'pre-wrap' }}>{application.message ?? <span className="help">No note</span>}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {application.notes ? (
            <div className="panel">
              <header><h2>Office notes</h2></header>
              <div className="body">
                <p style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: '0.88rem' }}>{application.notes}</p>
              </div>
            </div>
          ) : null}
        </div>

        <aside style={{ display: 'grid', gap: 20 }}>
          {mayUpdate ? (
            <ActionForm action={setApplicationStatus} success="Recorded.">
              <input type="hidden" name="id" value={application.id} />
              <div className="panel">
                <header><h2>Move it on</h2></header>
                <div className="body">
                  <div className="field">
                    <label htmlFor="status">Where it has got to</label>
                    <select id="status" name="status" defaultValue={application.status}>
                      {APPLICATION_STATUSES.map((value) => <option key={value} value={value}>{value.toLowerCase()}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="notes">Note</label>
                    <textarea id="notes" name="notes" maxLength={2000} placeholder="Assessment booked for Saturday 10 am. Bring birth certificate." />
                    <p className="help">Replaces the note above.</p>
                  </div>
                  <Submit>Save</Submit>
                </div>
              </div>
            </ActionForm>
          ) : (
            <div className="note note-info">Your Permission Set lets you read applications but not update them.</div>
          )}

          <div className="panel">
            <header><h2>Contact the family</h2></header>
            <div className="body" style={{ display: 'grid', gap: 8 }}>
              <a href={telHref(application.guardian_phone)} className="btn btn-primary">📞 Call {application.guardian_phone}</a>
              <a
                href={whatsappHref(application.guardian_phone, `Hello, this is ${short} about ${childName}'s application, reference ${application.no}.`)}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost"
              >
                ✆ WhatsApp
              </a>
              {application.guardian_email ? (
                <a href={`mailto:${application.guardian_email}?subject=${encodeURIComponent(`${short} — application ${application.no}`)}`} className="btn btn-ghost">✉ Email</a>
              ) : null}
            </div>
          </div>

          <div className="panel">
            <header><h2>Next step</h2></header>
            <div className="body">
              <p className="help" style={{ margin: 0 }}>
                Once a place is accepted, admit the child in the management system — that is where the pupil record,
                the fee account and the portal login are created. Nothing on this website does any of those things.
              </p>
            </div>
          </div>

          {mayDelete ? (
            <div className="panel">
              <header><h2>Delete</h2></header>
              <div className="body">
                <p className="help">
                  The privacy notice says unsuccessful applications are kept 12 months. Delete sooner only if asked.
                </p>
                <ActionFormRedirect action={deleteApplication} to="/admin/applications">
                  <input type="hidden" name="id" value={application.id} />
                  <ConfirmSubmit message={`Delete application ${application.no} for ${childName}?`} className="btn btn-danger">
                    Delete application
                  </ConfirmSubmit>
                </ActionFormRedirect>
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}

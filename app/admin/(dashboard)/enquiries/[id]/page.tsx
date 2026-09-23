import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth.ts';
import { canAction } from '@/lib/permissions.ts';
import { getEnquiry } from '@/lib/inbox.ts';
import { getSettings } from '@/lib/site.ts';
import { formatDateTime, formatDate, telHref, whatsappHref } from '@/lib/format.ts';
import { ENQUIRY_STATUSES } from '@/lib/types.ts';
import { setEnquiryStatus, deleteEnquiry } from '@/app/actions/content.ts';
import { ActionForm, ActionFormRedirect, ConfirmSubmit, Submit } from '../../ui.tsx';

export const metadata = { title: 'Enquiry' };

export default async function EnquiryCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePage('ENQUIRIES');
  const enquiry = await getEnquiry(Number(id));
  if (!enquiry) notFound();

  const [school, user] = await Promise.all([getSettings(), requirePage('ENQUIRIES')]);
  const mayUpdate = canAction(user, 'ENQUIRIES_UPDATE');
  const mayDelete = canAction(user, 'ENQUIRIES_DELETE');
  const short = school.short_name ?? school.name;

  return (
    <>
      <div className="crumb"><Link href="/admin/enquiries">Enquiries &amp; visits</Link><span aria-hidden="true">›</span>{enquiry.name}</div>

      <div className="grid-side">
        <div style={{ display: 'grid', gap: 20 }}>
          <div className="panel">
            <header>
              <div>
                <h2>{enquiry.name}</h2>
                <p>
                  {enquiry.kind === 'TOUR' ? 'Visit booking' : 'Enquiry'} · arrived {formatDateTime(enquiry.created_at)}
                  {enquiry.source_page ? ` from ${enquiry.source_page}` : ''}
                </p>
              </div>
              <span style={{ flex: 1 }} />
              <span className={`badge ${enquiry.status === 'NEW' ? 'badge-bad' : 'badge-info'}`}>{enquiry.status.replace('_', ' ')}</span>
            </header>

            <div className="table-wrap">
              <table className="list">
                <tbody>
                  <tr>
                    <td style={{ width: 170 }}>Phone</td>
                    <td>
                      <a href={telHref(enquiry.phone)}>{enquiry.phone}</a>
                      {' · '}
                      <a href={whatsappHref(enquiry.phone, `Hello ${enquiry.name}, this is ${short} replying to your enquiry.`)} target="_blank" rel="noreferrer">WhatsApp</a>
                    </td>
                  </tr>
                  <tr>
                    <td>Email</td>
                    <td>{enquiry.email ? <a href={`mailto:${enquiry.email}?subject=${encodeURIComponent(`${short} — your enquiry`)}`}>{enquiry.email}</a> : <span className="help">Not given</span>}</td>
                  </tr>
                  <tr><td>Grade of interest</td><td>{enquiry.grade_name ?? <span className="help">Not given</span>}</td></tr>
                  {enquiry.kind === 'TOUR' ? (
                    <>
                      <tr><td>Visiting</td><td>{enquiry.preferred_date ? formatDate(enquiry.preferred_date) : '—'}{enquiry.preferred_time ? ` at ${enquiry.preferred_time}` : ''}</td></tr>
                      <tr><td>How many coming</td><td>{enquiry.visitors ?? 1}</td></tr>
                    </>
                  ) : null}
                  <tr>
                    <td>Their message</td>
                    <td style={{ whiteSpace: 'pre-wrap' }}>{enquiry.message ?? <span className="help">No message</span>}</td>
                  </tr>
                  {enquiry.handled_by ? (
                    <tr><td>Last handled</td><td>{enquiry.handled_by}{enquiry.handled_at ? ` · ${formatDateTime(enquiry.handled_at)}` : ''}</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {enquiry.notes ? (
            <div className="panel">
              <header><h2>Notes so far</h2></header>
              <div className="body">
                <p style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: '0.88rem' }}>{enquiry.notes}</p>
              </div>
            </div>
          ) : null}
        </div>

        <aside style={{ display: 'grid', gap: 20 }}>
          {mayUpdate ? (
            <ActionForm action={setEnquiryStatus} success="Recorded.">
              <input type="hidden" name="id" value={enquiry.id} />
              <div className="panel">
                <header>
                  <div>
                    <h2>Record what happened</h2>
                  </div>
                </header>
                <div className="body">
                  <div className="field">
                    <label htmlFor="status">Where it has got to</label>
                    <select id="status" name="status" defaultValue={enquiry.status}>
                      {ENQUIRY_STATUSES.map((value) => (
                        <option key={value} value={value}>{value.replace('_', ' ').toLowerCase()}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="notes">Note</label>
                    <textarea id="notes" name="notes" maxLength={2000} placeholder="Called at 10.15, wants Grade 5 for January, sending the fee structure." />
                    <p className="help">Replaces the note above. Leave it empty to change only the status.</p>
                  </div>
                  <Submit>Save</Submit>
                </div>
              </div>
            </ActionForm>
          ) : (
            <div className="note note-info">Your Permission Set lets you read enquiries but not update them.</div>
          )}

          <div className="panel">
            <header><h2>Reply</h2></header>
            <div className="body" style={{ display: 'grid', gap: 8 }}>
              <a href={telHref(enquiry.phone)} className="btn btn-primary">📞 Call {enquiry.phone}</a>
              <a
                href={whatsappHref(enquiry.phone, `Hello ${enquiry.name}, this is ${short} replying to your enquiry about ${enquiry.grade_name ?? 'a place'}.`)}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost"
              >
                ✆ WhatsApp
              </a>
              {enquiry.email ? (
                <a href={`mailto:${enquiry.email}?subject=${encodeURIComponent(`${short} — your enquiry`)}`} className="btn btn-ghost">✉ Email</a>
              ) : null}
              <p className="help" style={{ margin: 0 }}>
                The website does not send anything on the school&rsquo;s behalf — a reply is a person, which is what a
                parent wants anyway.
              </p>
            </div>
          </div>

          {mayDelete ? (
            <div className="panel">
              <header><h2>Delete</h2></header>
              <div className="body">
                <p className="help">Enquiries are kept for 12 months under the privacy notice. Delete only on request.</p>
                <ActionFormRedirect action={deleteEnquiry} to="/admin/enquiries">
                  <input type="hidden" name="id" value={enquiry.id} />
                  <ConfirmSubmit message={`Delete the enquiry from ${enquiry.name}?`} className="btn btn-danger">Delete enquiry</ConfirmSubmit>
                </ActionFormRedirect>
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}

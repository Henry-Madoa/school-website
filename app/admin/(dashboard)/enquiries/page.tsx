import Link from 'next/link';
import { requirePage } from '@/lib/auth.ts';
import { listEnquiries, enquiryCounts, funnel } from '@/lib/inbox.ts';
import { formatDateShort, truncate } from '@/lib/format.ts';
import { ENQUIRY_STATUSES } from '@/lib/types.ts';

export const metadata = { title: 'Enquiries & visits' };

const STATUS_CLASS: Record<string, string> = {
  NEW: 'badge-bad',
  CONTACTED: 'badge-info',
  TOUR_BOOKED: 'badge-brand',
  APPLIED: 'badge-warn',
  ENROLLED: 'badge-ok',
  LOST: '',
};

/**
 * The admissions desk's own list.
 *
 * An enquiry is worked NEW → CONTACTED → TOUR_BOOKED → APPLIED → ENROLLED or LOST, so at the end
 * of a term the school can say how many enquiries the website produced and how many became
 * pupils. That is the number the website is actually judged on, and it is on this page.
 */
export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requirePage('ENQUIRIES');
  const { status = '', q = '' } = await searchParams;

  const ninetyDaysAgo = new Date(new Date().getTime() - 90 * 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const [enquiries, counts, quarter] = await Promise.all([
    listEnquiries(status === 'OPEN' || ENQUIRY_STATUSES.includes(status as never) ? (status as never) : '', q),
    enquiryCounts(),
    funnel(ninetyDaysAgo, today),
  ]);

  const count = (key: string) => counts.find((row) => row.status === key)?.n ?? 0;
  const conversion = quarter.enquiries ? Math.round((quarter.enrolled / quarter.enquiries) * 100) : 0;

  return (
    <>
      <div className="tiles">
        <div className="tile-stat"><div className="k">Last 90 days</div><div className="v">{quarter.enquiries}</div><div className="n">enquiries, {quarter.tours} of them visits</div></div>
        <div className="tile-stat"><div className="k">Answered</div><div className="v">{quarter.contacted}</div><div className="n">of {quarter.enquiries} — {quarter.enquiries ? Math.round((quarter.contacted / quarter.enquiries) * 100) : 0}%</div></div>
        <div className="tile-stat"><div className="k">Became applications</div><div className="v">{quarter.applied}</div><div className="n">{quarter.enrolled} enrolled</div></div>
        <div className={`tile-stat ${quarter.stale ? 'alert' : ''}`}>
          <div className="k">Waiting over 48 hours</div>
          <div className="v">{quarter.stale}</div>
          <div className="n">{conversion}% of enquiries became pupils</div>
        </div>
      </div>

      <div className="panel">
        <header>
          <div>
            <h2>Enquiries &amp; visits</h2>
            <p>{enquiries.length} shown · {count('NEW')} new, {count('CONTACTED')} contacted, {count('TOUR_BOOKED')} visits booked</p>
          </div>
        </header>

        <div className="body">
          <form method="get" className="toolbar">
            <div className="grow">
              <label htmlFor="q" className="sr-only">Search</label>
              <input id="q" name="q" type="search" defaultValue={q} placeholder="A name, a phone number, a word from the message…" />
            </div>
            <div style={{ minWidth: 190 }}>
              <label htmlFor="status" className="sr-only">Status</label>
              <select id="status" name="status" defaultValue={status}>
                <option value="">Every enquiry</option>
                <option value="OPEN">Still open</option>
                {ENQUIRY_STATUSES.map((value) => (
                  <option key={value} value={value}>{value.replace('_', ' ').toLowerCase()} ({count(value)})</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-ghost">Filter</button>
            {status || q ? <Link href="/admin/enquiries" className="btn btn-quiet">Clear</Link> : null}
          </form>
        </div>

        {enquiries.length === 0 ? (
          <div className="empty">
            <span className="big" aria-hidden="true">📭</span>
            <h3>{status || q ? 'Nothing matches that' : 'No enquiries yet'}</h3>
            <p>
              {status || q
                ? 'Try clearing the filter.'
                : 'Every enquiry and visit booking sent from the website lands here, and the admissions desk works it from this list.'}
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="list">
              <thead>
                <tr><th>From</th><th>About</th><th>Kind</th><th>Arrived</th><th>Status</th></tr>
              </thead>
              <tbody>
                {enquiries.map((enquiry) => (
                  <tr key={enquiry.id}>
                    <td>
                      <Link href={`/admin/enquiries/${enquiry.id}`} className="row-link">{enquiry.name}</Link>
                      <span className="sub">{enquiry.phone}{enquiry.email ? ` · ${enquiry.email}` : ''}</span>
                    </td>
                    <td>
                      {enquiry.grade_name ?? <span className="help">No grade given</span>}
                      <span className="sub">{truncate(enquiry.message ?? '', 70) || '—'}</span>
                    </td>
                    <td>
                      {enquiry.kind === 'TOUR'
                        ? <span className="badge badge-brand">Visit{enquiry.preferred_date ? ` ${formatDateShort(enquiry.preferred_date)}` : ''}</span>
                        : <span className="badge">Enquiry</span>}
                    </td>
                    <td>
                      {formatDateShort(enquiry.created_at)}
                      <span className="sub">{enquiry.age_days === 0 ? 'today' : `${enquiry.age_days} day${enquiry.age_days === 1 ? '' : 's'} ago`}</span>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_CLASS[enquiry.status] ?? ''}`}>{enquiry.status.replace('_', ' ')}</span>
                      {enquiry.handled_by ? <span className="sub">{enquiry.handled_by}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

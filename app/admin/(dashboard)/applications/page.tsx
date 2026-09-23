import Link from 'next/link';
import { requirePage } from '@/lib/auth.ts';
import { listApplications, applicationCounts } from '@/lib/inbox.ts';
import { formatDateShort, relativeDays } from '@/lib/format.ts';
import { APPLICATION_STATUSES } from '@/lib/types.ts';

export const metadata = { title: 'Applications' };

const STATUS_CLASS: Record<string, string> = {
  RECEIVED: 'badge-bad',
  REVIEWING: 'badge-info',
  ASSESSMENT: 'badge-brand',
  OFFERED: 'badge-warn',
  ACCEPTED: 'badge-ok',
  DECLINED: '',
  WITHDRAWN: '',
};

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requirePage('APPLICATIONS');
  const { status = '', q = '' } = await searchParams;

  const [applications, counts] = await Promise.all([
    listApplications(APPLICATION_STATUSES.includes(status as never) ? (status as never) : '', q),
    applicationCounts(),
  ]);
  const count = (key: string) => counts.find((row) => row.status === key)?.n ?? 0;
  const total = counts.reduce((sum, row) => sum + row.n, 0);

  return (
    <>
      <div className="tiles">
        <div className="tile-stat"><div className="k">All time</div><div className="v">{total}</div><div className="n">applications through the website</div></div>
        <div className={`tile-stat ${count('RECEIVED') ? 'alert' : ''}`}><div className="k">Not yet looked at</div><div className="v">{count('RECEIVED')}</div><div className="n">waiting for the office</div></div>
        <div className="tile-stat"><div className="k">At assessment</div><div className="v">{count('ASSESSMENT') + count('REVIEWING')}</div><div className="n">being worked</div></div>
        <div className="tile-stat"><div className="k">Offered or accepted</div><div className="v">{count('OFFERED') + count('ACCEPTED')}</div><div className="n">{count('ACCEPTED')} accepted a place</div></div>
      </div>

      <div className="panel">
        <header>
          <div>
            <h2>Applications</h2>
            <p>{applications.length} shown. Each one was filled in on the website and has never been re-typed.</p>
          </div>
        </header>

        <div className="body">
          <form method="get" className="toolbar">
            <div className="grow">
              <label htmlFor="q" className="sr-only">Search</label>
              <input id="q" name="q" type="search" defaultValue={q} placeholder="Application number, child's name, parent's name or phone…" />
            </div>
            <div style={{ minWidth: 180 }}>
              <label htmlFor="status" className="sr-only">Status</label>
              <select id="status" name="status" defaultValue={status}>
                <option value="">Every application</option>
                {APPLICATION_STATUSES.map((value) => (
                  <option key={value} value={value}>{value.toLowerCase()} ({count(value)})</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-ghost">Filter</button>
            {status || q ? <Link href="/admin/applications" className="btn btn-quiet">Clear</Link> : null}
          </form>
        </div>

        {applications.length === 0 ? (
          <div className="empty">
            <span className="big" aria-hidden="true">📝</span>
            <h3>{status || q ? 'Nothing matches that' : 'No applications yet'}</h3>
            <p>
              {status || q
                ? 'Try clearing the filter.'
                : 'Applications filled in on the website land here with a reference number the parent already has.'}
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="list">
              <thead>
                <tr><th>No.</th><th>Child</th><th>Grade</th><th>Parent</th><th>Received</th><th>Status</th></tr>
              </thead>
              <tbody>
                {applications.map((application) => (
                  <tr key={application.id}>
                    <td>
                      <Link href={`/admin/applications/${application.id}`} className="row-link">{application.no}</Link>
                      <span className="sub">{application.boarding_status === 'BOARDER' ? 'Boarder' : 'Day scholar'}</span>
                    </td>
                    <td>
                      {application.first_name} {application.last_name}
                      <span className="sub">{application.date_of_birth ? `born ${formatDateShort(application.date_of_birth)}` : 'no date of birth'}</span>
                    </td>
                    <td>
                      {application.grade_name ?? '—'}
                      {application.level_name ? <span className="sub">{application.level_name}</span> : null}
                    </td>
                    <td>
                      {application.guardian_name}
                      <span className="sub">{application.guardian_phone}</span>
                    </td>
                    <td>
                      {formatDateShort(application.created_at)}
                      <span className="sub">{relativeDays(application.created_at)}</span>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_CLASS[application.status] ?? ''}`}>{application.status.toLowerCase()}</span>
                      {application.handled_by ? <span className="sub">{application.handled_by}</span> : null}
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

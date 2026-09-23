import Link from 'next/link';
import { requireUser } from '@/lib/auth.ts';
import { canNav, canAction, pageByCode } from '@/lib/permissions.ts';
import { inboxSummary, listEnquiries, listApplications } from '@/lib/inbox.ts';
import { adminPosts, adminEvents } from '@/lib/content.ts';
import { getSettings } from '@/lib/site.ts';
import { formatDateShort, relativeDays, truncate } from '@/lib/format.ts';
import { parseRange } from '@/lib/insights.ts';
import { Insights } from './insights.tsx';

/*
 * The dashboard.
 *
 * Built out of what this particular person may actually see: an editor who cannot open Enquiries
 * gets no enquiry numbers, and every query behind a tile is skipped unless the tile will be
 * rendered. That keeps the screen honest and keeps it fast.
 */

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string; range?: string }> }) {
  const [user, { denied, range }] = await Promise.all([requireUser(), searchParams]);
  const school = await getSettings();

  const mayEnquiries = canNav(user, 'ENQUIRIES');
  const mayApplications = canNav(user, 'APPLICATIONS');
  const mayNews = canNav(user, 'NEWS');
  const mayEvents = canNav(user, 'EVENTS');
  const mayInbox = mayEnquiries || mayApplications;

  const [summary, enquiries, applications, posts, events] = await Promise.all([
    mayInbox || mayNews || mayEvents ? inboxSummary() : null,
    mayEnquiries ? listEnquiries('OPEN') : [],
    mayApplications ? listApplications() : [],
    mayNews ? adminPosts() : [],
    mayEvents ? adminEvents() : [],
  ]);

  const now = new Date().toISOString();
  const drafts = posts.filter((post) => !post.is_published);
  // adminEvents() is newest-first; the diary wants the soonest first.
  const upcoming = events
    .filter((event) => event.is_published && event.starts_at >= now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const deniedPage = denied ? pageByCode(denied) : null;

  return (
    <>
      {deniedPage ? (
        <div className="note note-warn">
          Your Permission Set does not include <strong>{deniedPage.label}</strong>. If you need it, ask a System
          Administrator to add it to your set.
        </div>
      ) : null}

      <div className="panel">
        <header>
          <div>
            <h2>Good to see you, {user.name.split(' ')[0]}</h2>
            <p>
              {user.is_system
                ? 'You hold the System Administrator set — every screen, including Permission Sets and the audit trail.'
                : `You hold ${user.roles.map((role) => role.name).join(' and ') || 'no Permission Set'}.`}
            </p>
          </div>
          <span style={{ flex: 1 }} />
          <Link href="/" target="_blank" className="btn btn-ghost btn-xs">View the website ↗</Link>
        </header>
      </div>

      {summary ? (
        <div className="tiles">
          {mayEnquiries ? (
            <Link href="/admin/enquiries?status=NEW" className={`tile-stat ${summary.enquiries_new ? 'alert' : ''}`}>
              <div className="k">New enquiries</div>
              <div className="v">{summary.enquiries_new}</div>
              <div className="n">{summary.enquiries_open} open · {summary.enquiries_week} this week</div>
            </Link>
          ) : null}

          {mayApplications ? (
            <Link href="/admin/applications" className={`tile-stat ${summary.applications_week ? 'alert' : ''}`}>
              <div className="k">Applications</div>
              <div className="v">{summary.applications_open}</div>
              <div className="n">being worked · {summary.applications_week} arrived this week</div>
            </Link>
          ) : null}

          {mayEnquiries ? (
            <Link href="/admin/enquiries?status=TOUR_BOOKED" className="tile-stat">
              <div className="k">Visits booked</div>
              <div className="v">{summary.tours_upcoming}</div>
              <div className="n">still to happen</div>
            </Link>
          ) : null}

          {mayNews ? (
            <Link href="/admin/news" className="tile-stat">
              <div className="k">Published notices</div>
              <div className="v">{summary.posts_published}</div>
              <div className="n">{summary.posts_draft} draft{summary.posts_draft === 1 ? '' : 's'} waiting</div>
            </Link>
          ) : null}

          {mayEvents ? (
            <Link href="/admin/events" className="tile-stat">
              <div className="k">Events ahead</div>
              <div className="v">{summary.events_upcoming}</div>
              <div className="n">{summary.rsvps_week} booking{summary.rsvps_week === 1 ? '' : 's'} this week</div>
            </Link>
          ) : null}

          {canNav(user, 'SUBSCRIBERS') ? (
            <Link href="/admin/subscribers" className="tile-stat">
              <div className="k">Newsletter</div>
              <div className="v">{summary.subscribers}</div>
              <div className="n">active subscribers</div>
            </Link>
          ) : null}
        </div>
      ) : null}

      <Insights user={user} range={parseRange(range)} upcoming={upcoming} />

      <div className="grid-side">
        <div style={{ display: 'grid', gap: 20 }}>
          {mayEnquiries ? (
            <div className="panel">
              <header>
                <h2>Enquiries waiting for a reply</h2>
                <span style={{ flex: 1 }} />
                <Link href="/admin/enquiries" className="btn btn-ghost btn-xs">All enquiries</Link>
              </header>
              {enquiries.length === 0 ? (
                <div className="empty">
                  <span className="big" aria-hidden="true">📭</span>
                  <h3>Nothing waiting</h3>
                  <p>Every enquiry the website has produced has been answered.</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="list">
                    <thead>
                      <tr><th>From</th><th>About</th><th>Waiting</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {enquiries.slice(0, 8).map((enquiry) => (
                        <tr key={enquiry.id}>
                          <td>
                            <Link href={`/admin/enquiries/${enquiry.id}`} className="row-link">{enquiry.name}</Link>
                            <span className="sub">{enquiry.phone}</span>
                          </td>
                          <td>
                            {enquiry.grade_name ?? '—'}
                            <span className="sub">{truncate(enquiry.message ?? '', 60) || (enquiry.kind === 'TOUR' ? 'Visit booking' : '—')}</span>
                          </td>
                          <td className={enquiry.age_days >= 2 ? 'num' : 'num'}>
                            <span className={`badge ${enquiry.age_days >= 2 ? 'badge-warn' : ''}`}>
                              {enquiry.age_days === 0 ? 'today' : `${enquiry.age_days}d`}
                            </span>
                          </td>
                          <td><span className={`badge ${enquiry.status === 'NEW' ? 'badge-bad' : 'badge-info'}`}>{enquiry.status.replace('_', ' ')}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          {mayApplications && applications.length ? (
            <div className="panel">
              <header>
                <h2>Latest applications</h2>
                <span style={{ flex: 1 }} />
                <Link href="/admin/applications" className="btn btn-ghost btn-xs">All applications</Link>
              </header>
              <div className="table-wrap">
                <table className="list">
                  <thead><tr><th>No.</th><th>Child</th><th>Grade</th><th>Received</th><th>Status</th></tr></thead>
                  <tbody>
                    {applications.slice(0, 6).map((application) => (
                      <tr key={application.id}>
                        <td><Link href={`/admin/applications/${application.id}`} className="row-link">{application.no}</Link></td>
                        <td>{application.first_name} {application.last_name}<span className="sub">{application.guardian_name}</span></td>
                        <td>{application.grade_name ?? '—'}</td>
                        <td>{relativeDays(application.created_at)}</td>
                        <td><span className="badge badge-info">{application.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {mayNews && drafts.length ? (
            <div className="panel">
              <header>
                <h2>Drafts not yet published</h2>
                <span style={{ flex: 1 }} />
                <Link href="/admin/news" className="btn btn-ghost btn-xs">All notices</Link>
              </header>
              <div className="table-wrap">
                <table className="list">
                  <tbody>
                    {drafts.slice(0, 5).map((post) => (
                      <tr key={post.id}>
                        <td>
                          <Link href={`/admin/news/${post.id}`} className="row-link">{post.title}</Link>
                          <span className="sub">{truncate(post.excerpt ?? post.body, 70)}</span>
                        </td>
                        <td className="num"><span className="badge badge-warn">Draft</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>

        <aside style={{ display: 'grid', gap: 20 }}>
          <div className="panel">
            <header><h2>Publish something</h2></header>
            <div className="body" style={{ display: 'grid', gap: 8 }}>
              {canAction(user, 'NEWS_CREATE') ? <Link href="/admin/news/new" className="btn btn-primary">📰 Write a notice</Link> : null}
              {canAction(user, 'EVENTS_CREATE') ? <Link href="/admin/events/new" className="btn btn-ghost">📅 Add an event</Link> : null}
              {canAction(user, 'GALLERY_CREATE') ? <Link href="/admin/gallery/new" className="btn btn-ghost">🖼 New photo album</Link> : null}
              {canAction(user, 'PEOPLE_CREATE') ? <Link href="/admin/people/new" className="btn btn-ghost">👥 Add a staff profile</Link> : null}
              {!canAction(user, 'NEWS_CREATE') && !canAction(user, 'EVENTS_CREATE') && !canAction(user, 'GALLERY_CREATE') ? (
                <p className="help" style={{ margin: 0 }}>Your Permission Set is read-only for the publishing screens.</p>
              ) : null}
            </div>
          </div>

          {mayEvents && upcoming.length ? (
            <div className="panel">
              <header><h2>Next in the diary</h2></header>
              <div className="body">
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
                  {upcoming.slice(0, 5).map((event) => (
                    <li key={event.id} style={{ fontSize: '0.84rem' }}>
                      <Link href={`/admin/events/${event.id}`} style={{ fontWeight: 650, textDecoration: 'none', color: 'var(--ink)' }}>
                        {event.title}
                      </Link>
                      <span style={{ display: 'block', color: 'var(--muted)', fontSize: '0.76rem' }}>
                        {formatDateShort(event.starts_at)}
                        {event.rsvp_enabled ? ` · ${event.rsvp_guests} booked` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          <div className="panel">
            <header><h2>This website</h2></header>
            <div className="body">
              <table className="kv">
                <tbody>
                  <tr><th scope="row">School</th><td>{school.name}</td></tr>
                  <tr><th scope="row">Brand colour</th><td><span className="badge" style={{ background: school.brand_primary, color: '#fff' }}>{school.brand_primary}</span></td></tr>
                  <tr><th scope="row">Image uploads</th><td>{process.env.CLOUDINARY_API_KEY ? <span className="badge badge-ok">Cloudinary ready</span> : <span className="badge badge-bad">Not configured</span>}</td></tr>
                </tbody>
              </table>
              {canNav(user, 'SETTINGS') ? (
                <Link href="/admin/settings" className="btn btn-ghost" style={{ width: '100%' }}>School profile &amp; theme</Link>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

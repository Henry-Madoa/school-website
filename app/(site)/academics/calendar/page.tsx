import Link from 'next/link';
import type { Metadata } from 'next';
import { getSettings, getTerms, getUpcomingEvents } from '@/lib/site.ts';
import { formatDate, formatDateShort, dateParts } from '@/lib/format.ts';

export const metadata: Metadata = {
  title: 'Term dates & academic calendar',
  description: 'When each term opens and closes, taken straight from the school’s own calendar.',
  alternates: { canonical: '/academics/calendar' },
};

const weeks = (from: string, to: string): number =>
  Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000 / 7));

export default async function CalendarPage() {
  const [school, terms, events] = await Promise.all([getSettings(), getTerms(), getUpcomingEvents(8)]);
  const today = new Date().toISOString().slice(0, 10);
  const next = terms.find((term) => term.start_date > today);
  const portal = school.portal_url ?? process.env.NEXT_PUBLIC_PORTAL_URL ?? '/portal';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': terms.map((term) => ({
      '@type': 'Event',
      name: `${term.name} ${term.year_name}`,
      startDate: term.start_date,
      endDate: term.end_date,
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: { '@type': 'Place', name: school.name, address: school.physical_address ?? undefined },
      organizer: { '@type': 'Organization', name: school.name },
    })),
  };

  return (
    <>
      {terms.length ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /> : null}

      <div className="page-head">
        <div className="wrap">
          <div className="crumbs">
            <Link href="/">Home</Link><span aria-hidden="true">›</span>
            <Link href="/academics">Academics</Link><span aria-hidden="true">›</span>
            Term dates
          </div>
          <h1>Term dates</h1>
          <p className="lead">
            Published straight from the school&rsquo;s own calendar, so these are the dates the school actually works to.
            {next ? ` The next term opens on ${formatDate(next.start_date)}.` : ''}
          </p>
        </div>
      </div>

      <section className="section">
        <div className="wrap split">
          <div>
            {terms.length ? (
              <div className="table-scroll">
                <table className="data">
                  <thead>
                    <tr><th>Term</th><th>Opens</th><th>Closes</th><th className="num">Weeks</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {terms.map((term) => {
                      const state = term.is_current ? 'Current' : term.start_date > today ? 'Upcoming' : 'Completed';
                      return (
                        <tr key={term.id} style={term.is_current ? { fontWeight: 600 } : undefined}>
                          <td>
                            {term.name} {term.year_name}
                            {term.note ? <><br /><span className="optional">{term.note}</span></> : null}
                          </td>
                          <td>{formatDateShort(term.start_date)}</td>
                          <td>{formatDateShort(term.end_date)}</td>
                          <td className="num">{weeks(term.start_date, term.end_date)}</td>
                          <td>
                            <span className={`pill ${term.is_current ? 'pill-ok' : state === 'Upcoming' ? 'pill-brand' : ''}`}>{state}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="callout">
                <h3>The calendar for the coming year is being finalised</h3>
                <p className="small" style={{ margin: 0 }}>Please call the school office for the dates you need.</p>
              </div>
            )}

            <div className="callout" style={{ marginTop: 28 }}>
              <h3>Also worth knowing</h3>
              <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
                <li>Half-term breaks, exam weeks and closing days are announced as notices — see <Link href="/news">News &amp; notices</Link>.</li>
                <li>Reporting times on opening day differ for boarders and day scholars; the notice before each term gives both.</li>
                <li>Parents signed in to the <a href={portal}>portal</a> see term dates alongside their child&rsquo;s timetable.</li>
              </ul>
            </div>
          </div>

          <aside>
            <div className="callout callout-accent">
              <h3>Coming up</h3>
              {events.length ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 14 }}>
                  {events.map((event) => {
                    const when = dateParts(event.starts_at);
                    return (
                      <li key={event.id} style={{ display: 'grid', gridTemplateColumns: '46px 1fr', gap: 12, alignItems: 'start' }}>
                        <span className="stamp" style={{ display: 'grid', placeContent: 'center', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', padding: '6px 2px' }}>
                          <b style={{ display: 'block', fontSize: '1rem', lineHeight: 1 }}>{when.day}</b>
                          <span style={{ fontSize: '0.6rem', letterSpacing: '0.08em', color: 'var(--muted)' }}>{when.month}</span>
                        </span>
                        <span className="tiny">
                          <Link href={`/events/${event.slug}`}><strong>{event.title}</strong></Link>
                          {event.location ? <><br /><span className="muted">{event.location}</span></> : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="tiny muted" style={{ margin: 0 }}>Nothing in the diary yet for the coming weeks.</p>}
              <p style={{ margin: '14px 0 0' }}><Link href="/events" className="text-link">The whole calendar</Link></p>
            </div>

            <div className="btn-row">
              <Link href="/admissions/apply" className="btn btn-primary">Apply online</Link>
              <Link href="/contact" className="btn btn-ghost">Ask the office</Link>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}

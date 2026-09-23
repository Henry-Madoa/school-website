import Link from 'next/link';
import type { Metadata } from 'next';
import { getSettings, getUpcomingEvents, getPastEvents, getTerms } from '@/lib/site.ts';
import { formatDate, formatDateShort, formatTime, dateParts, truncate } from '@/lib/format.ts';
import { EVENT_CATEGORIES } from '@/lib/types.ts';
import { FilterList } from '../site-chrome.tsx';

export const metadata: Metadata = {
  title: "What's on",
  description: 'The school calendar: open days, parents’ evenings, fixtures, concerts, term dates and holidays.',
  alternates: { canonical: '/events' },
};

export default async function EventsPage() {
  const [school, upcoming, past, terms] = await Promise.all([
    getSettings(), getUpcomingEvents(60), getPastEvents(9), getTerms(),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const nextTerm = terms.find((term) => term.start_date > today);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': upcoming.slice(0, 15).map((event) => ({
      '@type': 'Event',
      name: event.title,
      description: event.summary ?? undefined,
      startDate: event.starts_at,
      endDate: event.ends_at ?? undefined,
      image: event.image_url ?? undefined,
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      location: { '@type': 'Place', name: event.location ?? school.name, address: school.physical_address ?? undefined },
      organizer: { '@type': 'Organization', name: school.name },
    })),
  };

  return (
    <>
      {upcoming.length ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /> : null}

      <div className="page-head">
        <div className="wrap">
          <div className="crumbs"><Link href="/">Home</Link><span aria-hidden="true">›</span>What&rsquo;s on</div>
          <h1>What&rsquo;s on</h1>
          <p className="lead">
            Open days, parents&rsquo; evenings, fixtures, concerts and the dates the school closes.
            {nextTerm ? ` The next term opens on ${formatDate(nextTerm.start_date)}.` : ''}
          </p>
        </div>
      </div>

      <section className="section">
        <div className="wrap">
          {upcoming.length === 0 ? (
            <div className="callout">
              <h3>The calendar for the coming term is being finalised</h3>
              <p className="small" style={{ margin: 0 }}>
                Term dates are already published on the <Link href="/academics/calendar">calendar page</Link>, and events
                are added here as they are confirmed.
              </p>
            </div>
          ) : (
            <FilterList
              label="Find an event"
              placeholder="'open day', 'football', 'concert'"
              categories={EVENT_CATEGORIES.filter((c) => upcoming.some((e) => e.category === c.value))}
              empty="Nothing coming up matches that."
            >
              <div className="grid g2">
                {upcoming.map((event) => {
                  const when = dateParts(event.starts_at);
                  const icon = EVENT_CATEGORIES.find((c) => c.value === event.category)?.icon ?? '📅';
                  const full = event.capacity !== null && event.rsvp_guests >= event.capacity;
                  return (
                    <Link
                      key={event.id}
                      href={`/events/${event.slug}`}
                      className="event-card"
                      data-filter={`${event.title} ${event.summary ?? ''} ${event.location ?? ''}`}
                      data-category={event.category}
                    >
                      <span className="date-chip">
                        <span className="m">{when.month}</span>
                        <span className="d">{when.day}</span>
                        <span className="w">{when.weekday}</span>
                      </span>
                      <span>
                        <h3>{icon} {event.title}</h3>
                        {event.summary ? <p className="small muted" style={{ margin: '0 0 8px' }}>{truncate(event.summary, 130)}</p> : null}
                        <span className="where">
                          {!event.all_day ? <span>🕑 {formatTime(event.starts_at)}{event.ends_at ? ` – ${formatTime(event.ends_at)}` : ''}</span> : <span>All day</span>}
                          {event.location ? <span>📍 {event.location}</span> : null}
                          {event.rsvp_enabled ? (
                            <span className={`pill ${full ? 'pill-bad' : 'pill-accent'}`}>{full ? 'Full' : 'Booking needed'}</span>
                          ) : null}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </FilterList>
          )}
        </div>
      </section>

      {terms.length ? (
        <section className="section section-soft">
          <div className="wrap">
            <div className="head-row">
              <div className="section-head">
                <div className="eyebrow">The year</div>
                <h2>Term dates</h2>
              </div>
              <Link href="/academics/calendar" className="text-link">Full calendar</Link>
            </div>
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr><th>Term</th><th>Opens</th><th>Closes</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {terms.slice(0, 6).map((term) => (
                    <tr key={term.id} style={term.is_current ? { fontWeight: 600 } : undefined}>
                      <td>{term.name} {term.year_name}</td>
                      <td>{formatDateShort(term.start_date)}</td>
                      <td>{formatDateShort(term.end_date)}</td>
                      <td className="optional">{term.is_current ? 'Current' : term.start_date > today ? 'Upcoming' : 'Completed'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {past.length ? (
        <section className="section">
          <div className="wrap">
            <div className="section-head">
              <div className="eyebrow">Already happened</div>
              <h2>Recently at the school</h2>
            </div>
            <div className="grid g3">
              {past.map((event) => {
                const when = dateParts(event.starts_at);
                return (
                  <Link key={event.id} href={`/events/${event.slug}`} className="event-card past">
                    <span className="date-chip">
                      <span className="m">{when.month}</span>
                      <span className="d">{when.day}</span>
                      <span className="w">{when.year}</span>
                    </span>
                    <span>
                      <h3>{event.title}</h3>
                      {event.location ? <span className="where">📍 {event.location}</span> : null}
                    </span>
                  </Link>
                );
              })}
            </div>
            <p style={{ marginTop: 20 }}><Link href="/gallery" className="text-link">See the photographs</Link></p>
          </div>
        </section>
      ) : null}
    </>
  );
}

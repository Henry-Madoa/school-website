import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getSettings, getEvent, getUpcomingEvents } from '@/lib/site.ts';
import { formatDate, formatDateTime, formatTime, truncate, relativeDays } from '@/lib/format.ts';
import { cdn } from '@/lib/cloudinary.ts';
import { siteUrl } from '@/lib/urls.ts';
import { EVENT_CATEGORIES } from '@/lib/types.ts';
import { RsvpForm } from '../../forms.tsx';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) return { title: 'Event not found' };
  return {
    title: event.title,
    description: event.summary ?? truncate(event.body ?? '', 160),
    alternates: { canonical: `/events/${event.slug}` },
    openGraph: {
      type: 'article',
      title: event.title,
      description: event.summary ?? undefined,
      images: event.image_url ? [{ url: event.image_url }] : undefined,
    },
  };
}

/** A calendar file, built from the event itself — no library, and nothing to keep in step. */
function icsHref(event: { title: string; slug: string; starts_at: string; ends_at: string | null; location: string | null; summary: string | null }, origin: string): string {
  const stamp = (value: string) => value.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const end = event.ends_at ?? new Date(Date.parse(event.starts_at) + 3_600_000).toISOString();
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//school-website//EN', 'BEGIN:VEVENT',
    `UID:${event.slug}@${origin.replace(/^https?:\/\//, '')}`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(event.starts_at)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${event.title.replace(/[,;]/g, '\\$&')}`,
    event.location ? `LOCATION:${event.location.replace(/[,;]/g, '\\$&')}` : '',
    event.summary ? `DESCRIPTION:${event.summary.replace(/[,;]/g, '\\$&').replace(/\n/g, '\\n')}` : '',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean);
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join('\r\n'))}`;
}

export default async function EventPage({ params }: Params) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();

  const [school, others] = await Promise.all([getSettings(), getUpcomingEvents(4)]);
  const category = EVENT_CATEGORIES.find((c) => c.value === event.category);
  const past = Date.parse(event.ends_at ?? event.starts_at) < new Date().getTime();
  const placesLeft = event.capacity === null ? null : Math.max(0, event.capacity - event.rsvp_guests);
  const origin = siteUrl();

  const jsonLd = {
    '@context': 'https://schema.org',
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
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="page-head">
        <div className="wrap">
          <div className="crumbs">
            <Link href="/">Home</Link><span aria-hidden="true">›</span>
            <Link href="/events">What&rsquo;s on</Link><span aria-hidden="true">›</span>
            {truncate(event.title, 40)}
          </div>
          <span className="pill pill-brand">{category?.icon} {category?.label ?? event.category}</span>
          <h1 style={{ marginTop: 14 }}>{event.title}</h1>
          <p className="lead">
            {event.all_day ? formatDate(event.starts_at) : formatDateTime(event.starts_at)}
            {event.ends_at && !event.all_day ? ` – ${formatTime(event.ends_at)}` : ''}
            {event.location ? ` · ${event.location}` : ''}
            {past ? ' · this has already taken place' : ` · ${relativeDays(event.starts_at)}`}
          </p>
        </div>
      </div>

      <section className="section">
        <div className="wrap split">
          <article>
            {event.image_url ? (
              <div style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', marginBottom: 28 }}>
                <img src={cdn(event.image_url, { width: 1200, height: 675 })} alt="" style={{ width: '100%', display: 'block' }} />
              </div>
            ) : null}

            <div className="prose">
              {event.summary ? <p className="lead">{event.summary}</p> : null}
              {(event.body ?? '').split('\n\n').filter(Boolean).map((paragraph, index) => (
                <p key={index} style={{ whiteSpace: 'pre-wrap' }}>{paragraph}</p>
              ))}
            </div>

            <div className="btn-row">
              {!past ? <a className="btn btn-ghost btn-sm" href={icsHref(event, origin)} download={`${event.slug}.ics`}>📅 Add to my calendar</a> : null}
              <Link href="/events" className="btn btn-ghost btn-sm">← The whole calendar</Link>
            </div>
          </article>

          <aside>
            <div className="callout">
              <h3>The details</h3>
              <div className="table-scroll">
                <table className="data">
                  <tbody>
                    <tr><td>Date</td><td>{formatDate(event.starts_at)}</td></tr>
                    {!event.all_day ? (
                      <tr><td>Time</td><td>{formatTime(event.starts_at)}{event.ends_at ? ` – ${formatTime(event.ends_at)}` : ''}</td></tr>
                    ) : <tr><td>Time</td><td>All day</td></tr>}
                    {event.location ? <tr><td>Where</td><td>{event.location}</td></tr> : null}
                    {event.rsvp_enabled ? (
                      <tr><td>Booking</td><td>{placesLeft === null ? 'Please book' : `${placesLeft} place${placesLeft === 1 ? '' : 's'} left`}</td></tr>
                    ) : <tr><td>Booking</td><td>Not needed — just come</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {event.rsvp_enabled && !past ? (
              <div className="callout callout-accent" style={{ marginTop: 18 }}>
                <h3>Book a place</h3>
                <RsvpForm eventId={event.id} eventTitle={event.title} placesLeft={placesLeft} />
              </div>
            ) : null}

            {others.filter((other) => other.id !== event.id).length ? (
              <div className="callout" style={{ marginTop: 18 }}>
                <h3>Also coming up</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
                  {others.filter((other) => other.id !== event.id).slice(0, 3).map((other) => (
                    <li key={other.id} className="tiny">
                      <Link href={`/events/${other.slug}`}><strong>{other.title}</strong></Link><br />
                      <span className="muted">{formatDate(other.starts_at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      </section>
    </>
  );
}

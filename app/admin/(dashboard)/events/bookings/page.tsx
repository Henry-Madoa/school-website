import Link from 'next/link';
import { requirePage } from '@/lib/auth.ts';
import { canAction, canPage } from '@/lib/permissions.ts';
import { adminEvents } from '@/lib/content.ts';
import { listRsvps } from '@/lib/inbox.ts';
import { formatDateShort, formatTime } from '@/lib/format.ts';
import { deleteRsvp } from '@/app/actions/content.ts';
import { ActionForm, ConfirmSubmit, RowFilter } from '../../ui.tsx';

export const metadata = { title: 'Event bookings' };

/**
 * Every booking for every event that is still to happen, in one list — because the question the
 * office actually asks is "who is coming on Saturday", not "who booked for event 14".
 */
export default async function BookingsPage() {
  const user = await requirePage('EVENTS_RSVPS');
  const now = new Date().toISOString();

  const events = (await adminEvents()).filter((event) => event.rsvp_enabled);
  const upcoming = events.filter((event) => (event.ends_at ?? event.starts_at) >= now);
  const withBookings = await Promise.all(
    upcoming.map(async (event) => ({ event, bookings: await listRsvps(event.id) })),
  );
  const totalPeople = withBookings.reduce((sum, row) => sum + row.event.rsvp_guests, 0);
  const mayDelete = canAction(user, 'EVENTS_RSVP_DELETE');

  return (
    <>
      {canPage(user, 'EVENTS') ? (
        <div className="tabs">
          <Link href="/admin/events">Events</Link>
          <Link href="/admin/events/bookings" aria-current="page">Bookings</Link>
        </div>
      ) : null}

      <div className="panel">
        <header>
          <div>
            <h2>Bookings for events still to come</h2>
            <p>{upcoming.length} event{upcoming.length === 1 ? '' : 's'} taking bookings · {totalPeople} people expected</p>
          </div>
        </header>
        {upcoming.length === 0 ? (
          <div className="empty">
            <span className="big" aria-hidden="true">🎟</span>
            <h3>No event is taking bookings</h3>
            <p>Tick &ldquo;People must book a place&rdquo; on an event and a booking form appears on its page.</p>
          </div>
        ) : null}
      </div>

      {withBookings.map(({ event, bookings }) => (
        <div className="panel" key={event.id}>
          <header>
            <div>
              <h2><Link href={`/admin/events/${event.id}`} className="row-link">{event.title}</Link></h2>
              <p>
                {formatDateShort(event.starts_at)}{event.all_day ? '' : `, ${formatTime(event.starts_at)}`}
                {event.location ? ` · ${event.location}` : ''}
                {' · '}{event.rsvp_guests} people{event.capacity ? ` of ${event.capacity}` : ''}
              </p>
            </div>
            <span style={{ flex: 1 }} />
            {event.capacity && event.rsvp_guests >= event.capacity
              ? <span className="badge badge-bad">Full</span>
              : <span className="badge badge-ok">{event.capacity ? `${event.capacity - event.rsvp_guests} left` : 'Open'}</span>}
          </header>

          {bookings.length === 0 ? (
            <div className="empty"><p>Nobody has booked yet.</p></div>
          ) : (
            <div className="body">
              <RowFilter placeholder="Filter by name or number…">
                <div className="table-wrap">
                  <table className="list">
                    <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th className="num">People</th><th>Booked</th><th className="actions">&nbsp;</th></tr></thead>
                    <tbody>
                      {bookings.map((booking) => (
                        <tr key={booking.id} data-filter={`${booking.name} ${booking.phone} ${booking.email ?? ''}`}>
                          <td>
                            {booking.name}
                            {booking.message ? <span className="sub">{booking.message}</span> : null}
                          </td>
                          <td><a href={`tel:${booking.phone.replace(/\s/g, '')}`}>{booking.phone}</a></td>
                          <td>{booking.email ? <a href={`mailto:${booking.email}`}>{booking.email}</a> : '—'}</td>
                          <td className="num">{booking.guests}</td>
                          <td>{formatDateShort(booking.created_at)}</td>
                          <td className="actions">
                            {mayDelete ? (
                              <ActionForm action={deleteRsvp}>
                                <input type="hidden" name="id" value={booking.id} />
                                <ConfirmSubmit message={`Remove ${booking.name}'s booking?`}>Remove</ConfirmSubmit>
                              </ActionForm>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </RowFilter>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

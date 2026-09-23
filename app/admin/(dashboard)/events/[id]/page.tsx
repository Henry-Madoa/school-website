import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth.ts';
import { canAction } from '@/lib/permissions.ts';
import { adminEvent } from '@/lib/content.ts';
import { listRsvps } from '@/lib/inbox.ts';
import { formatDateShort } from '@/lib/format.ts';
import { saveEvent, deleteEvent, deleteRsvp } from '@/app/actions/content.ts';
import { ActionForm, ActionFormRedirect, ConfirmSubmit, RowFilter, Submit } from '../../ui.tsx';
import { EventFields } from '../event-fields.tsx';

export const metadata = { title: 'Event' };

export default async function EventCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePage('EVENTS');
  const event = await adminEvent(Number(id));
  if (!event) notFound();

  const mayEdit = canAction(user, 'EVENTS_UPDATE');
  const mayDelete = canAction(user, 'EVENTS_DELETE');
  const mayBookings = canAction(user, 'EVENTS_RSVP_READ');
  const bookings = mayBookings ? await listRsvps(event.id) : [];

  return (
    <>
      <div className="crumb"><Link href="/admin/events">Events</Link><span aria-hidden="true">›</span>{event.title}</div>

      {!mayEdit ? <div className="note note-info">Your Permission Set lets you read this screen but not change it.</div> : null}

      <ActionForm action={saveEvent} success="Saved. The website has been updated.">
        <input type="hidden" name="id" value={event.id} />
        <fieldset disabled={!mayEdit} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="panel">
            <header>
              <div>
                <h2>{event.title}</h2>
                <p>{formatDateShort(event.starts_at)}{event.location ? ` · ${event.location}` : ''}</p>
              </div>
              <span style={{ flex: 1 }} />
              {event.is_published ? <Link href={`/events/${event.slug}`} target="_blank" className="btn btn-ghost btn-xs">View ↗</Link> : null}
              <Link href="/admin/events" className="btn btn-ghost btn-xs">Back</Link>
              {mayEdit ? <Submit>Save changes</Submit> : null}
            </header>
            <div className="body">
              <EventFields event={event} />
            </div>
          </div>
        </fieldset>
      </ActionForm>

      {mayBookings && event.rsvp_enabled ? (
        <div className="panel">
          <header>
            <div>
              <h2>Who has booked</h2>
              <p>{bookings.length} booking{bookings.length === 1 ? '' : 's'} · {event.rsvp_guests} people{event.capacity ? ` of ${event.capacity}` : ''}</p>
            </div>
            <span style={{ flex: 1 }} />
            <Link href="/admin/events/bookings" className="btn btn-ghost btn-xs">All bookings</Link>
          </header>
          {bookings.length === 0 ? (
            <div className="empty"><p>Nobody has booked yet.</p></div>
          ) : (
            <div className="body">
              <RowFilter placeholder="Search bookings by name, phone or email…">
                <div className="table-wrap">
                  <table className="list">
                    <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th className="num">People</th><th>Booked</th><th className="actions">&nbsp;</th></tr></thead>
                    <tbody>
                      {bookings.map((booking) => (
                        <tr key={booking.id}>
                          <td>
                            {booking.name}
                            {booking.message ? <span className="sub">{booking.message}</span> : null}
                          </td>
                          <td><a href={`tel:${booking.phone.replace(/\s/g, '')}`}>{booking.phone}</a></td>
                          <td>{booking.email ? <a href={`mailto:${booking.email}`}>{booking.email}</a> : '—'}</td>
                          <td className="num">{booking.guests}</td>
                          <td>{formatDateShort(booking.created_at)}</td>
                          <td className="actions">
                            {canAction(user, 'EVENTS_RSVP_DELETE') ? (
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
      ) : null}

      {mayDelete ? (
        <div className="panel">
          <header><h2>Delete this event</h2></header>
          <div className="body" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <p className="help" style={{ margin: 0, flex: '1 1 320px' }}>
              The event, its photograph and every booking against it are removed. Nobody is told — if people have
              booked, tell them first.
            </p>
            <ActionFormRedirect action={deleteEvent} to="/admin/events">
              <input type="hidden" name="id" value={event.id} />
              <ConfirmSubmit
                message={`Delete "${event.title}"?${bookings.length ? ` ${bookings.length} booking(s) will be deleted too.` : ''}`}
                className="btn btn-danger"
              >
                Delete event
              </ConfirmSubmit>
            </ActionFormRedirect>
          </div>
        </div>
      ) : null}
    </>
  );
}

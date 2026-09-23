import Link from 'next/link';
import { requirePage } from '@/lib/auth.ts';
import { canAction, canPage } from '@/lib/permissions.ts';
import { adminEvents } from '@/lib/content.ts';
import { formatDateShort, formatTime, truncate } from '@/lib/format.ts';
import { EVENT_CATEGORIES } from '@/lib/types.ts';
import { toggleEvent, deleteEvent } from '@/app/actions/content.ts';
import { ActionForm, ConfirmSubmit, RowFilter, ToggleButton } from '../ui.tsx';

export const metadata = { title: 'Events' };

export default async function EventsListPage() {
  const user = await requirePage('EVENTS');
  const events = await adminEvents();
  const now = new Date().toISOString();
  const mayEdit = canAction(user, 'EVENTS_UPDATE');
  const mayDelete = canAction(user, 'EVENTS_DELETE');

  const upcoming = events.filter((event) => (event.ends_at ?? event.starts_at) >= now);
  const past = events.filter((event) => (event.ends_at ?? event.starts_at) < now);

  return (
    <>
      {canPage(user, 'EVENTS_RSVPS') ? (
        <div className="tabs">
          <Link href="/admin/events" aria-current="page">Events</Link>
          <Link href="/admin/events/bookings">Bookings</Link>
        </div>
      ) : null}

      <div className="panel">
        <header>
          <div>
            <h2>Events</h2>
            <p>{upcoming.length} coming up · {past.length} already happened</p>
          </div>
          <span style={{ flex: 1 }} />
          {canAction(user, 'EVENTS_CREATE') ? <Link href="/admin/events/new" className="btn btn-primary">Add an event</Link> : null}
        </header>

        <div className="body">
          {events.length === 0 ? (
            <div className="empty">
              <span className="big" aria-hidden="true">📅</span>
              <h3>Nothing in the diary</h3>
              <p>Events appear on the website&rsquo;s calendar, on the home page and — if you ask for bookings — with a form parents can fill in.</p>
              {canAction(user, 'EVENTS_CREATE') ? <Link href="/admin/events/new" className="btn btn-primary">Add the first one</Link> : null}
            </div>
          ) : (
            <RowFilter placeholder="Filter by title, place or summary…">
              <div className="table-wrap">
                <table className="list">
                  <thead>
                    <tr>
                      <th>Event</th><th>When</th><th>Category</th><th>Bookings</th><th>Status</th><th className="actions">&nbsp;</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...upcoming, ...past].map((event) => {
                      const isPast = (event.ends_at ?? event.starts_at) < now;
                      const full = event.capacity !== null && event.rsvp_guests >= event.capacity;
                      const category = EVENT_CATEGORIES.find((c) => c.value === event.category);
                      return (
                        <tr key={event.id} data-filter={`${event.title} ${event.summary ?? ''} ${event.location ?? ''} ${event.category}`}>
                          <td>
                            <Link href={`/admin/events/${event.id}`} className="row-link">{event.title}</Link>
                            <span className="sub">{truncate(event.summary ?? event.location ?? '', 70)}</span>
                          </td>
                          <td>
                            {formatDateShort(event.starts_at)}
                            <span className="sub">{event.all_day ? 'All day' : formatTime(event.starts_at)}</span>
                          </td>
                          <td><span className="badge">{category?.icon} {category?.label ?? event.category}</span></td>
                          <td className="num">
                            {event.rsvp_enabled
                              ? <span className={`badge ${full ? 'badge-bad' : 'badge-info'}`}>{event.rsvp_guests}{event.capacity ? `/${event.capacity}` : ''}</span>
                              : <span className="help">—</span>}
                          </td>
                          <td>
                            {!event.is_published ? <span className="badge badge-warn">Draft</span>
                              : isPast ? <span className="badge">Past</span>
                                : <span className="badge badge-ok">Live</span>}
                          </td>
                          <td className="actions">
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              {mayEdit ? (
                                <ActionForm action={toggleEvent}>
                                  <input type="hidden" name="id" value={event.id} />
                                  <input type="hidden" name="field" value="is_published" />
                                  <ToggleButton on={event.is_published} onLabel="Unpublish" offLabel="Publish" />
                                </ActionForm>
                              ) : null}
                              <Link href={`/admin/events/${event.id}`} className="btn btn-ghost btn-xs">Open</Link>
                              {mayDelete ? (
                                <ActionForm action={deleteEvent}>
                                  <input type="hidden" name="id" value={event.id} />
                                  <ConfirmSubmit message={`Delete "${event.title}"? Any bookings go with it.`}>Delete</ConfirmSubmit>
                                </ActionForm>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </RowFilter>
          )}
        </div>
      </div>
    </>
  );
}

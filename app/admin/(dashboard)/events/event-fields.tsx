import { EVENT_CATEGORIES, type EventView } from '@/lib/types.ts';
import { ImageField } from '../ui.tsx';

/** `datetime-local` wants "YYYY-MM-DDTHH:mm"; the database holds a full ISO stamp. */
const localStamp = (iso: string | null | undefined): string => (iso ? iso.slice(0, 16) : '');

export function EventFields({ event }: { event?: EventView }) {
  return (
    <div className="grid-side">
      <div style={{ display: 'grid', gap: 16 }}>
        <div className="field">
          <label htmlFor="title">Title</label>
          <input id="title" name="title" type="text" required maxLength={200} defaultValue={event?.title} placeholder="Open day for prospective parents" />
        </div>

        <div className="field">
          <label htmlFor="summary">One-line summary</label>
          <input id="summary" name="summary" type="text" maxLength={300} defaultValue={event?.summary ?? ''} placeholder="Walk around the school while it is working." />
          <p className="help">Shown in the calendar list and in the diary on the home page.</p>
        </div>

        <div className="field">
          <label htmlFor="body">Details</label>
          <textarea id="body" name="body" defaultValue={event?.body ?? ''} placeholder={'What happens, who it is for, what to bring.\n\nA blank line starts a new paragraph.'} />
        </div>

        <ImageField name="image" label="Photograph" current={event?.image_url} hint="Optional. Shown at the top of the event page." />

        <div className="grid-2">
          <div className="field">
            <label htmlFor="starts_at">Starts</label>
            <input id="starts_at" name="starts_at" type="datetime-local" required defaultValue={localStamp(event?.starts_at)} />
          </div>
          <div className="field">
            <label htmlFor="ends_at">Ends</label>
            <input id="ends_at" name="ends_at" type="datetime-local" defaultValue={localStamp(event?.ends_at)} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="location">Where</label>
          <input id="location" name="location" type="text" maxLength={200} defaultValue={event?.location ?? ''} placeholder="School hall" />
        </div>
      </div>

      <aside style={{ display: 'grid', gap: 16 }}>
        <div className="panel">
          <header><h2>Listing</h2></header>
          <div className="body">
            <div className="field">
              <label htmlFor="category">Category</label>
              <select id="category" name="category" defaultValue={event?.category ?? 'ACADEMIC'}>
                {EVENT_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>{category.icon} {category.label}</option>
                ))}
              </select>
            </div>

            <div className="check-row">
              <input id="all_day" name="all_day" type="checkbox" value="1" defaultChecked={event?.all_day ?? false} />
              <label htmlFor="all_day">
                All day
                <span className="help">Hides the times and shows the date alone.</span>
              </label>
            </div>

            <div className="check-row">
              <input id="is_published" name="is_published" type="checkbox" value="1" defaultChecked={event?.is_published ?? false} />
              <label htmlFor="is_published">
                Published
                <span className="help">Until this is ticked it is not on the website.</span>
              </label>
            </div>
          </div>
        </div>

        <div className="panel">
          <header><h2>Booking</h2></header>
          <div className="body">
            <div className="check-row">
              <input id="rsvp_enabled" name="rsvp_enabled" type="checkbox" value="1" defaultChecked={event?.rsvp_enabled ?? false} />
              <label htmlFor="rsvp_enabled">
                People must book a place
                <span className="help">Adds a booking form to the event page.</span>
              </label>
            </div>

            <div className="field">
              <label htmlFor="capacity">Capacity</label>
              <input id="capacity" name="capacity" type="number" min={1} max={100000} defaultValue={event?.capacity ?? ''} placeholder="Leave empty for no limit" />
              <p className="help">Counted in people, not bookings — a family of four takes four places.</p>
            </div>

            {event?.rsvp_enabled ? (
              <p className="help">
                <strong>{event.rsvp_count}</strong> booking{event.rsvp_count === 1 ? '' : 's'} so far,{' '}
                <strong>{event.rsvp_guests}</strong> people
                {event.capacity ? ` of ${event.capacity}` : ''}.
              </p>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}

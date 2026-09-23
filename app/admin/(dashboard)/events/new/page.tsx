import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requirePage } from '@/lib/auth.ts';
import { canAction } from '@/lib/permissions.ts';
import { saveEvent } from '@/app/actions/content.ts';
import { ActionFormRedirect, Submit } from '../../ui.tsx';
import { EventFields } from '../event-fields.tsx';

export const metadata = { title: 'Add an event' };

export default async function NewEventPage() {
  const user = await requirePage('EVENTS');
  if (!canAction(user, 'EVENTS_CREATE')) redirect('/admin/events');

  return (
    <>
      <div className="crumb"><Link href="/admin/events">Events</Link><span aria-hidden="true">›</span>New</div>

      <ActionFormRedirect action={saveEvent} to="/admin/events/:id">
        <div className="panel">
          <header>
            <div>
              <h2>Add an event</h2>
              <p>It stays a draft until you tick Published.</p>
            </div>
            <span style={{ flex: 1 }} />
            <Link href="/admin/events" className="btn btn-ghost btn-xs">Cancel</Link>
            <Submit>Save event</Submit>
          </header>
          <div className="body">
            <EventFields />
          </div>
        </div>
      </ActionFormRedirect>
    </>
  );
}

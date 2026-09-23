import Link from 'next/link';
import { requirePage } from '@/lib/auth.ts';
import { adminAudit } from '@/lib/content.ts';
import { formatDateTime } from '@/lib/format.ts';
import { SecurityTabs } from '../tabs.tsx';

export const metadata = { title: 'Audit trail' };

const TONE: Record<string, string> = {
  DELETE: 'badge-bad',
  LOGIN_FAILED: 'badge-bad',
  CREATE: 'badge-ok',
  LOGIN: 'badge-info',
  UPDATE: 'badge-warn',
  PERMISSIONS: 'badge-bad',
  PASSWORD: 'badge-bad',
};

const toneFor = (action: string): string => {
  const match = Object.keys(TONE).find((key) => action.includes(key));
  return match ? TONE[match]! : '';
};

/** Human names for the tables, so the trail reads as English rather than as a schema. */
const ENTITY: Record<string, string> = {
  web_post: 'Notice',
  web_event: 'Event',
  web_rsvp: 'Event booking',
  web_album: 'Photo album',
  web_photo: 'Photograph',
  web_staff: 'Staff profile',
  web_testimonial: 'Testimonial',
  web_faq: 'Question',
  web_level: 'Level',
  web_grade: 'Grade',
  web_subject: 'Learning area',
  web_term: 'Term',
  web_fee: 'Fee line',
  web_route: 'Bus route',
  web_stop: 'Bus stop',
  web_enquiry: 'Enquiry',
  web_application: 'Application',
  web_subscriber: 'Subscriber',
  web_setting: 'School profile',
  web_user: 'Account',
  web_role: 'Permission Set',
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requirePage('SECURITY_AUDIT');
  const { q = '' } = await searchParams;
  const entries = await adminAudit(q, 400);

  return (
    <>
      <SecurityTabs user={user} current="audit" />

      <div className="panel">
        <header>
          <div>
            <h2>Audit trail</h2>
            <p>
              Every change made in this admin, with the name of the person who made it. Content disappearing without
              explanation is the commonest support call, and this is the answer to it.
            </p>
          </div>
        </header>

        <div className="body">
          <form method="get" className="toolbar">
            <div className="grow">
              <label htmlFor="q" className="sr-only">Search the trail</label>
              <input id="q" name="q" type="search" defaultValue={q} placeholder="A person's name, an action, or a table…" />
            </div>
            <button type="submit" className="btn btn-ghost">Search</button>
            {q ? <Link href="/admin/security/audit" className="btn btn-quiet">Clear</Link> : null}
          </form>
        </div>

        {entries.length === 0 ? (
          <div className="empty">
            <span className="big" aria-hidden="true">🗒</span>
            <h3>{q ? 'Nothing matches that' : 'Nothing recorded yet'}</h3>
            <p>{q ? 'Try a single word — a surname, or part of an action name.' : 'The trail fills as soon as anyone signs in or changes something.'}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="list">
              <thead>
                <tr><th>When</th><th>Who</th><th>Did what</th><th>To</th><th>Detail</th></tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const detail = Object.entries(entry.detail ?? {})
                    .filter(([, value]) => value !== null && value !== undefined && value !== '')
                    .map(([key, value]) => `${key}: ${String(value)}`)
                    .join(' · ');
                  return (
                    <tr key={entry.id}>
                      <td className="nowrap">{formatDateTime(entry.created_at)}</td>
                      <td>{entry.actor_name}</td>
                      <td><span className={`badge ${toneFor(entry.action)}`}>{entry.action.replace(/_/g, ' ').toLowerCase()}</span></td>
                      <td>
                        {ENTITY[entry.entity] ?? entry.entity}
                        {entry.entity_id ? <span className="sub">#{entry.entity_id}</span> : null}
                      </td>
                      <td className="help">{detail || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel">
        <header><h2>What is recorded</h2></header>
        <div className="body">
          <p className="help" style={{ margin: 0 }}>
            Every create, change and delete in the admin, every sign-in, and every failed sign-in attempt with the
            address that was tried. Enquiries and applications arriving from the public website are recorded against a
            synthetic <code>website</code> actor, because nobody was signed in when they were sent. The trail is
            append-only from the application&rsquo;s point of view — nothing in this admin edits or deletes a row of it.
          </p>
        </div>
      </div>
    </>
  );
}

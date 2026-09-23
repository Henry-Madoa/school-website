import { requirePage } from '@/lib/auth.ts';
import { canAction } from '@/lib/permissions.ts';
import { listSubscribers } from '@/lib/inbox.ts';
import { formatDateShort } from '@/lib/format.ts';
import { setSubscriberStatus, deleteSubscriber } from '@/app/actions/content.ts';
import { ActionForm, ConfirmSubmit, RowFilter, ToggleButton } from '../ui.tsx';

export const metadata = { title: 'Newsletter list' };

export default async function SubscribersPage() {
  const user = await requirePage('SUBSCRIBERS');
  const subscribers = await listSubscribers();
  const active = subscribers.filter((subscriber) => subscriber.status === 'ACTIVE');
  const mayUpdate = canAction(user, 'SUBSCRIBERS_UPDATE');
  const mayDelete = canAction(user, 'SUBSCRIBERS_DELETE');

  /* A mailto: with everyone on it — enough for a school of this size, and no third party involved. */
  const mailto = active.length && active.length <= 90
    ? `mailto:?bcc=${active.map((subscriber) => subscriber.email).join(',')}`
    : null;

  return (
    <div className="panel">
      <header>
        <div>
          <h2>Newsletter list</h2>
          <p>{active.length} active · {subscribers.length - active.length} unsubscribed</p>
        </div>
        <span style={{ flex: 1 }} />
        {mailto ? <a href={mailto} className="btn btn-ghost btn-xs">Start an email to everyone</a> : null}
      </header>

      <div className="body">
        {subscribers.length === 0 ? (
          <div className="empty">
            <span className="big" aria-hidden="true">✉</span>
            <h3>Nobody has subscribed yet</h3>
            <p>The sign-up form is in the website&rsquo;s footer, on every page.</p>
          </div>
        ) : (
          <>
            {active.length > 90 ? (
              <div className="note note-info" style={{ marginBottom: 16 }}>
                There are more than 90 active addresses. Export them into whatever the school uses to send mail rather
                than putting them all in one BCC field — most mail servers refuse a recipient list that long.
              </div>
            ) : null}

            <RowFilter placeholder="Filter by email or name…">
              <div className="table-wrap">
                <table className="list">
                  <thead>
                    <tr><th>Email</th><th>Name</th><th>Signed up</th><th>From</th><th>Status</th><th className="actions">&nbsp;</th></tr>
                  </thead>
                  <tbody>
                    {subscribers.map((subscriber) => (
                      <tr key={subscriber.id} data-filter={`${subscriber.email} ${subscriber.name ?? ''}`}>
                        <td><a href={`mailto:${subscriber.email}`}>{subscriber.email}</a></td>
                        <td>{subscriber.name ?? <span className="help">—</span>}</td>
                        <td>{formatDateShort(subscriber.created_at)}</td>
                        <td className="help">{subscriber.source_page ?? '—'}</td>
                        <td>
                          {subscriber.status === 'ACTIVE'
                            ? <span className="badge badge-ok">Active</span>
                            : <span className="badge">Unsubscribed</span>}
                        </td>
                        <td className="actions">
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            {mayUpdate ? (
                              <ActionForm action={setSubscriberStatus}>
                                <input type="hidden" name="id" value={subscriber.id} />
                                <input type="hidden" name="status" value={subscriber.status === 'ACTIVE' ? 'UNSUBSCRIBED' : 'ACTIVE'} />
                                <ToggleButton on={subscriber.status === 'ACTIVE'} onLabel="Unsubscribe" offLabel="Re-subscribe" />
                              </ActionForm>
                            ) : null}
                            {mayDelete ? (
                              <ActionForm action={deleteSubscriber}>
                                <input type="hidden" name="id" value={subscriber.id} />
                                <ConfirmSubmit message={`Delete ${subscriber.email} from the list?`}>Delete</ConfirmSubmit>
                              </ActionForm>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </RowFilter>

            <p className="help" style={{ marginTop: 14 }}>
              Somebody who asks to be removed should be unsubscribed rather than deleted — a deleted address can sign
              up again by accident and start receiving mail they asked to stop.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

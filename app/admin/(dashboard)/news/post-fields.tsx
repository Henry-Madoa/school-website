import { POST_CATEGORIES, type Post } from '@/lib/types.ts';
import { ImageField } from '../ui.tsx';

/*
 * The notice form's fields, shared by "write a notice" and the card of an existing one.
 *
 * A server component: it renders ordinary inputs, which are passed as children into the client
 * <ActionForm> that owns the submission. Keeping the fields on the server means the category list
 * and the defaults come straight from the record with no hydration round trip.
 */

/** `datetime-local` wants "YYYY-MM-DDTHH:mm" with no zone; the database holds full ISO. */
const localStamp = (iso: string | null | undefined): string => (iso ? iso.slice(0, 16) : '');

export function PostFields({ post }: { post?: Post }) {
  return (
    <div className="grid-side">
      <div style={{ display: 'grid', gap: 16 }}>
        <div className="field">
          <label htmlFor="title">Title</label>
          <input id="title" name="title" type="text" required maxLength={200} defaultValue={post?.title} placeholder="Term 2 opens on Monday 5 May — reporting times" />
          <p className="help">This is the headline parents see, and it becomes the page&rsquo;s web address.</p>
        </div>

        <div className="field">
          <label htmlFor="excerpt">Summary</label>
          <input id="excerpt" name="excerpt" type="text" maxLength={300} defaultValue={post?.excerpt ?? ''} placeholder="One sentence, shown in the list and on the home page." />
          <p className="help">Leave it empty and the first line of the notice is used instead.</p>
        </div>

        <div className="field">
          <label htmlFor="body">The notice</label>
          <textarea id="body" name="body" required className="tall" defaultValue={post?.body} placeholder={'Write it as you would say it.\n\nLeave a blank line between paragraphs.'} />
          <p className="help">Plain text. A blank line starts a new paragraph.</p>
        </div>

        <ImageField name="image" label="Photograph" current={post?.image_url} hint="Optional. Shown at the top of the notice and in the list." />

        <div className="field">
          <label htmlFor="attachment_url">Attachment link</label>
          <input id="attachment_url" name="attachment_url" type="url" defaultValue={post?.attachment_url ?? ''} placeholder="https://…" />
          <p className="help">Optional — a link to a PDF, a form or a booking page.</p>
        </div>
      </div>

      <aside style={{ display: 'grid', gap: 16 }}>
        <div className="panel">
          <header><h2>Publishing</h2></header>
          <div className="body">
            <div className="field">
              <label htmlFor="category">Category</label>
              <select id="category" name="category" defaultValue={post?.category ?? 'NOTICE'}>
                {POST_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
              </select>
            </div>

            <div className="field">
              <label htmlFor="published_at">Publish from</label>
              <input
                id="published_at"
                name="published_at"
                type="datetime-local"
                defaultValue={localStamp(post?.published_at ?? new Date().toISOString())}
              />
              <p className="help">A date in the future keeps it off the website until then.</p>
            </div>

            <div className="field">
              <label htmlFor="expires_at">Take down on</label>
              <input id="expires_at" name="expires_at" type="datetime-local" defaultValue={localStamp(post?.expires_at)} />
              <p className="help">Optional. Useful for anything with a deadline.</p>
            </div>

            <div className="check-row">
              <input id="is_published" name="is_published" type="checkbox" value="1" defaultChecked={post?.is_published ?? false} />
              <label htmlFor="is_published">
                Published
                <span className="help">Until this is ticked, nobody outside the school can see it.</span>
              </label>
            </div>

            <div className="check-row">
              <input id="is_pinned" name="is_pinned" type="checkbox" value="1" defaultChecked={post?.is_pinned ?? false} />
              <label htmlFor="is_pinned">
                Pin to the top
                <span className="help">Keeps it above the rest of the list until you un-pin it.</span>
              </label>
            </div>
          </div>
        </div>

        {post ? (
          <div className="panel">
            <header><h2>About this notice</h2></header>
            <div className="body">
              <table className="list">
                <tbody>
                  <tr><td>Web address</td><td className="num"><code style={{ fontSize: '0.75rem' }}>/news/{post.slug}</code></td></tr>
                  <tr><td>Written by</td><td className="num">{post.author ?? '—'}</td></tr>
                  <tr><td>Created</td><td className="num">{post.created_at.slice(0, 10)}</td></tr>
                  {post.updated_at ? <tr><td>Last changed</td><td className="num">{post.updated_at.slice(0, 10)}</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

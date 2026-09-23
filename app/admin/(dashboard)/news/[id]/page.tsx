import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth.ts';
import { canAction } from '@/lib/permissions.ts';
import { adminPost } from '@/lib/content.ts';
import { savePost, deletePost } from '@/app/actions/content.ts';
import { ActionForm, ActionFormRedirect, ConfirmSubmit, Submit } from '../../ui.tsx';
import { PostFields } from '../post-fields.tsx';

export const metadata = { title: 'Notice' };

/**
 * A notice's card — edited in place, the way a record is edited in the school's management
 * system, rather than in a pop-up that hides the thing being changed.
 */
export default async function PostCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePage('NEWS');
  const post = await adminPost(Number(id));
  if (!post) notFound();

  const mayEdit = canAction(user, 'NEWS_UPDATE');
  const mayDelete = canAction(user, 'NEWS_DELETE');

  return (
    <>
      <div className="crumb">
        <Link href="/admin/news">News &amp; notices</Link><span aria-hidden="true">›</span>{post.title}
      </div>

      {!mayEdit ? (
        <div className="note note-info">
          Your Permission Set lets you read this screen but not change it. Everything below is shown as it stands.
        </div>
      ) : null}

      <ActionForm action={savePost} success="Saved. The website has been updated.">
        <input type="hidden" name="id" value={post.id} />
        <fieldset disabled={!mayEdit} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="panel">
            <header>
              <div>
                <h2>{post.title}</h2>
                <p>
                  {post.is_published ? 'Published on the website' : 'Draft — not visible to anyone outside the school'}
                </p>
              </div>
              <span style={{ flex: 1 }} />
              {post.is_published ? (
                <Link href={`/news/${post.slug}`} target="_blank" className="btn btn-ghost btn-xs">View ↗</Link>
              ) : null}
              <Link href="/admin/news" className="btn btn-ghost btn-xs">Back</Link>
              {mayEdit ? <Submit>Save changes</Submit> : null}
            </header>
            <div className="body">
              <PostFields post={post} />
            </div>
          </div>
        </fieldset>
      </ActionForm>

      {mayDelete ? (
        <div className="panel">
          <header><h2>Delete this notice</h2></header>
          <div className="body" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <p className="help" style={{ margin: 0, flex: '1 1 320px' }}>
              The notice, its photograph and its web address go for good. A parent holding the old link will get the
              website&rsquo;s &ldquo;not found&rdquo; page.
            </p>
            <ActionFormRedirect action={deletePost} to="/admin/news">
              <input type="hidden" name="id" value={post.id} />
              <ConfirmSubmit message={`Delete "${post.title}"? This cannot be undone.`} className="btn btn-danger">
                Delete notice
              </ConfirmSubmit>
            </ActionFormRedirect>
          </div>
        </div>
      ) : null}
    </>
  );
}

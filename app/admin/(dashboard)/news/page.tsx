import Link from 'next/link';
import { requirePage } from '@/lib/auth.ts';
import { canAction } from '@/lib/permissions.ts';
import { adminPosts } from '@/lib/content.ts';
import { formatDateShort, truncate } from '@/lib/format.ts';
import { POST_CATEGORIES } from '@/lib/types.ts';
import { togglePost, deletePost } from '@/app/actions/content.ts';
import { ActionForm, ConfirmSubmit, RowFilter, ToggleButton } from '../ui.tsx';

export const metadata = { title: 'News & notices' };

export default async function NewsListPage() {
  const user = await requirePage('NEWS');
  const posts = await adminPosts();
  const mayEdit = canAction(user, 'NEWS_UPDATE');
  const mayDelete = canAction(user, 'NEWS_DELETE');
  const now = new Date().toISOString();

  return (
    <div className="panel">
      <header>
        <div>
          <h2>News &amp; notices</h2>
          <p>{posts.length} in total · {posts.filter((post) => post.is_published).length} published on the website</p>
        </div>
        <span style={{ flex: 1 }} />
        {canAction(user, 'NEWS_CREATE') ? <Link href="/admin/news/new" className="btn btn-primary">Write a notice</Link> : null}
      </header>

      <div className="body">
        {posts.length === 0 ? (
          <div className="empty">
            <span className="big" aria-hidden="true">📰</span>
            <h3>Nothing written yet</h3>
            <p>Notices published here appear on the website&rsquo;s News page and on the home page, newest first.</p>
            {canAction(user, 'NEWS_CREATE') ? <Link href="/admin/news/new" className="btn btn-primary">Write the first one</Link> : null}
          </div>
        ) : (
          <RowFilter placeholder="Filter by title or text…">
            <div className="table-wrap">
              <table className="list">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Published</th>
                    <th>Status</th>
                    <th className="actions">&nbsp;</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => {
                    const expired = !!post.expires_at && post.expires_at < now;
                    const scheduled = post.is_published && post.published_at > now;
                    return (
                      <tr key={post.id} data-filter={`${post.title} ${post.excerpt ?? ''} ${post.body} ${post.category}`}>
                        <td>
                          <Link href={`/admin/news/${post.id}`} className="row-link">
                            {post.is_pinned ? '★ ' : ''}{post.title}
                          </Link>
                          <span className="sub">{truncate(post.excerpt ?? post.body, 80)}</span>
                        </td>
                        <td>
                          <span className="badge">{POST_CATEGORIES.find((c) => c.value === post.category)?.label ?? post.category}</span>
                        </td>
                        <td>
                          {formatDateShort(post.published_at)}
                          {post.expires_at ? <span className="sub">until {formatDateShort(post.expires_at)}</span> : null}
                        </td>
                        <td>
                          {!post.is_published ? <span className="badge badge-warn">Draft</span>
                            : expired ? <span className="badge">Expired</span>
                              : scheduled ? <span className="badge badge-info">Scheduled</span>
                                : <span className="badge badge-ok">Live</span>}
                        </td>
                        <td className="actions">
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            {mayEdit ? (
                              <>
                                <ActionForm action={togglePost}>
                                  <input type="hidden" name="id" value={post.id} />
                                  <input type="hidden" name="field" value="is_published" />
                                  <ToggleButton on={post.is_published} onLabel="Unpublish" offLabel="Publish" />
                                </ActionForm>
                                <ActionForm action={togglePost}>
                                  <input type="hidden" name="id" value={post.id} />
                                  <input type="hidden" name="field" value="is_pinned" />
                                  <ToggleButton on={post.is_pinned} onLabel="Unpin" offLabel="Pin" />
                                </ActionForm>
                              </>
                            ) : null}
                            <Link href={`/admin/news/${post.id}`} className="btn btn-ghost btn-xs">Open</Link>
                            {mayDelete ? (
                              <ActionForm action={deletePost}>
                                <input type="hidden" name="id" value={post.id} />
                                <ConfirmSubmit message={`Delete "${post.title}"? This cannot be undone.`}>Delete</ConfirmSubmit>
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
  );
}

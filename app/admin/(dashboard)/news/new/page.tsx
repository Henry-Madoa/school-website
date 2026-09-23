import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requirePage } from '@/lib/auth.ts';
import { canAction } from '@/lib/permissions.ts';
import { savePost } from '@/app/actions/content.ts';
import { ActionFormRedirect, Submit } from '../../ui.tsx';
import { PostFields } from '../post-fields.tsx';

export const metadata = { title: 'Write a notice' };

export default async function NewPostPage() {
  const user = await requirePage('NEWS');
  if (!canAction(user, 'NEWS_CREATE')) redirect('/admin/news');

  return (
    <>
      <div className="crumb">
        <Link href="/admin/news">News &amp; notices</Link><span aria-hidden="true">›</span>New
      </div>

      <ActionFormRedirect action={savePost} to="/admin/news/:id">
        <div className="panel">
          <header>
            <div>
              <h2>Write a notice</h2>
              <p>It is saved as a draft unless you tick Published.</p>
            </div>
            <span style={{ flex: 1 }} />
            <Link href="/admin/news" className="btn btn-ghost btn-xs">Cancel</Link>
            <Submit busy="Saving…">Save notice</Submit>
          </header>
          <div className="body">
            <PostFields />
          </div>
        </div>
      </ActionFormRedirect>
    </>
  );
}

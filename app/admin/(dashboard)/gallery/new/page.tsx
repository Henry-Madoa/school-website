import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requirePage } from '@/lib/auth.ts';
import { canAction } from '@/lib/permissions.ts';
import { saveAlbum } from '@/app/actions/content.ts';
import { ActionFormRedirect, ImageField, Submit } from '../../ui.tsx';

export const metadata = { title: 'New album' };

export default async function NewAlbumPage() {
  const user = await requirePage('GALLERY');
  if (!canAction(user, 'GALLERY_CREATE')) redirect('/admin/gallery');

  return (
    <>
      <div className="crumb"><Link href="/admin/gallery">Photo gallery</Link><span aria-hidden="true">›</span>New album</div>

      <ActionFormRedirect action={saveAlbum} to="/admin/gallery/:id">
        <div className="panel">
          <header>
            <div>
              <h2>New album</h2>
              <p>Create the album first; you add the photographs on its card.</p>
            </div>
            <span style={{ flex: 1 }} />
            <Link href="/admin/gallery" className="btn btn-ghost btn-xs">Cancel</Link>
            <Submit>Create album</Submit>
          </header>
          <div className="body">
            <div className="grid-2">
              <div className="field">
                <label htmlFor="title">Title</label>
                <input id="title" name="title" type="text" required maxLength={160} placeholder="Sports day" />
              </div>
              <div className="field">
                <label htmlFor="taken_on">Date</label>
                <input id="taken_on" name="taken_on" type="date" />
                <p className="help">When the photographs were taken. Albums are ordered by this.</p>
              </div>
            </div>

            <div className="field">
              <label htmlFor="description">Description</label>
              <textarea id="description" name="description" maxLength={600} placeholder="Nine records in one afternoon, and Kilimanjaro House with the shield." />
            </div>

            <ImageField name="cover" label="Cover photograph" hint="Optional — the first photograph you add is used if you leave this empty." />

            <div className="grid-2">
              <div className="field">
                <label htmlFor="sort">Order</label>
                <input id="sort" name="sort" type="number" min={0} max={9999} defaultValue={0} />
                <p className="help">Lower numbers come first on the gallery page.</p>
              </div>
              <div className="check-row" style={{ alignSelf: 'end' }}>
                <input id="is_published" name="is_published" type="checkbox" value="1" defaultChecked />
                <label htmlFor="is_published">
                  Visible on the website
                  <span className="help">Untick to build the album privately first.</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </ActionFormRedirect>
    </>
  );
}

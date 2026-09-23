import Link from 'next/link';
import { requirePage } from '@/lib/auth.ts';
import { canAction } from '@/lib/permissions.ts';
import { adminAlbums } from '@/lib/content.ts';
import { formatDateShort } from '@/lib/format.ts';
import { cdn } from '@/lib/cloudinary.ts';
import { cloudinaryReady } from '@/lib/cloudinary-server.ts';
import { deleteAlbum } from '@/app/actions/content.ts';
import { ActionForm, ConfirmSubmit, RowFilter } from '../ui.tsx';

export const metadata = { title: 'Photo gallery' };

export default async function GalleryListPage() {
  const user = await requirePage('GALLERY');
  const albums = await adminAlbums();
  const total = albums.reduce((count, album) => count + album.photo_count, 0);
  const mayDelete = canAction(user, 'GALLERY_DELETE');

  return (
    <>
      {!cloudinaryReady() ? (
        <div className="note note-warn">
          Cloudinary is not configured, so photographs cannot be uploaded. Set <code>CLOUDINARY_CLOUD_NAME</code>,{' '}
          <code>CLOUDINARY_API_KEY</code> and <code>CLOUDINARY_API_SECRET</code> in <code>.env.local</code> and restart.
        </div>
      ) : null}

      <div className="panel">
        <header>
          <div>
            <h2>Photo gallery</h2>
            <p>{albums.length} album{albums.length === 1 ? '' : 's'} · {total} photograph{total === 1 ? '' : 's'}</p>
          </div>
          <span style={{ flex: 1 }} />
          {canAction(user, 'GALLERY_CREATE') ? <Link href="/admin/gallery/new" className="btn btn-primary">New album</Link> : null}
        </header>

        <div className="body">
          {albums.length === 0 ? (
            <div className="empty">
              <span className="big" aria-hidden="true">🖼</span>
              <h3>No albums yet</h3>
              <p>An album is a set of photographs from one occasion — sports day, the festival, the new library wing.</p>
              {canAction(user, 'GALLERY_CREATE') ? <Link href="/admin/gallery/new" className="btn btn-primary">Create the first album</Link> : null}
            </div>
          ) : (
            <RowFilter placeholder="Search albums…">
              <div className="tiles" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
                {albums.map((album) => (
                  <div key={album.id} className="tile-stat" style={{ padding: 0, overflow: 'hidden' }} data-filter={`${album.title} ${album.taken_on ? formatDateShort(album.taken_on) : ''} ${album.is_published ? 'Live' : 'Hidden'}`}>
                    <Link href={`/admin/gallery/${album.id}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ aspectRatio: '16 / 10', background: 'var(--surface-sunk)', overflow: 'hidden' }}>
                        {album.cover_url ?? album.photos[0]?.url ? (
                          <img
                            src={cdn(album.cover_url ?? album.photos[0]!.url, { width: 560, height: 350 })}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--muted)', fontSize: '1.8rem' }} aria-hidden="true">🖼</div>
                        )}
                      </div>
                      <div style={{ padding: '14px 16px' }}>
                        <strong style={{ display: 'block', fontSize: '0.92rem' }}>{album.title}</strong>
                        <span style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
                          {album.photo_count} photo{album.photo_count === 1 ? '' : 's'}
                          {album.taken_on ? ` · ${formatDateShort(album.taken_on)}` : ''}
                        </span>
                      </div>
                    </Link>
                    <div style={{ padding: '0 16px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
                      {album.is_published ? <span className="badge badge-ok">Live</span> : <span className="badge badge-warn">Hidden</span>}
                      <span style={{ flex: 1 }} />
                      {mayDelete ? (
                        <ActionForm action={deleteAlbum}>
                          <input type="hidden" name="id" value={album.id} />
                          <ConfirmSubmit message={`Delete "${album.title}" and its ${album.photo_count} photograph(s)?`}>Delete</ConfirmSubmit>
                        </ActionForm>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </RowFilter>
          )}
        </div>
      </div>
    </>
  );
}

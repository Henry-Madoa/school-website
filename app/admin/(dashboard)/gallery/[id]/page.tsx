import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth.ts';
import { canAction } from '@/lib/permissions.ts';
import { adminAlbum } from '@/lib/content.ts';
import { cdn } from '@/lib/cloudinary.ts';
import { cloudinaryReady } from '@/lib/cloudinary-server.ts';
import { saveAlbum, deleteAlbum, addPhotos, deletePhoto, setPhotoCaption } from '@/app/actions/content.ts';
import { ActionForm, ActionFormRedirect, ConfirmSubmit, ImageField, Submit } from '../../ui.tsx';

export const metadata = { title: 'Album' };

export default async function AlbumCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePage('GALLERY');
  const album = await adminAlbum(Number(id));
  if (!album) notFound();

  const mayEdit = canAction(user, 'GALLERY_UPDATE');
  const mayAdd = canAction(user, 'GALLERY_PHOTO_ADD') && cloudinaryReady();
  const mayCaption = canAction(user, 'GALLERY_PHOTO_UPDATE');
  const mayRemovePhoto = canAction(user, 'GALLERY_PHOTO_DELETE');

  return (
    <>
      <div className="crumb"><Link href="/admin/gallery">Photo gallery</Link><span aria-hidden="true">›</span>{album.title}</div>

      <ActionForm action={saveAlbum} success="Album saved.">
        <input type="hidden" name="id" value={album.id} />
        <fieldset disabled={!mayEdit} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="panel">
            <header>
              <div>
                <h2>{album.title}</h2>
                <p>{album.photo_count} photograph{album.photo_count === 1 ? '' : 's'}</p>
              </div>
              <span style={{ flex: 1 }} />
              {album.is_published ? <Link href={`/gallery/${album.slug}`} target="_blank" className="btn btn-ghost btn-xs">View ↗</Link> : null}
              <Link href="/admin/gallery" className="btn btn-ghost btn-xs">Back</Link>
              {mayEdit ? <Submit>Save album</Submit> : null}
            </header>
            <div className="body">
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="title">Title</label>
                  <input id="title" name="title" type="text" required maxLength={160} defaultValue={album.title} />
                </div>
                <div className="field">
                  <label htmlFor="taken_on">Date</label>
                  <input id="taken_on" name="taken_on" type="date" defaultValue={album.taken_on ?? ''} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="description">Description</label>
                <textarea id="description" name="description" maxLength={600} defaultValue={album.description ?? ''} />
              </div>
              <ImageField name="cover" label="Cover photograph" current={album.cover_url} />
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="sort">Order</label>
                  <input id="sort" name="sort" type="number" min={0} max={9999} defaultValue={album.sort} />
                </div>
                <div className="check-row" style={{ alignSelf: 'end' }}>
                  <input id="is_published" name="is_published" type="checkbox" value="1" defaultChecked={album.is_published} />
                  <label htmlFor="is_published">Visible on the website</label>
                </div>
              </div>
            </div>
          </div>
        </fieldset>
      </ActionForm>

      {mayAdd ? (
        <ActionForm action={addPhotos} success="Photographs added.">
          <input type="hidden" name="album_id" value={album.id} />
          <div className="panel">
            <header>
              <div>
                <h2>Add photographs</h2>
                <p>Choose several at once. They are uploaded one at a time, so a slow connection still finishes.</p>
              </div>
              <span style={{ flex: 1 }} />
              <Submit busy="Uploading…">Upload</Submit>
            </header>
            <div className="body">
              <ImageField name="photos" label="Photographs" multiple hint="JPEG, PNG or WebP, up to 8 MB each. Select as many as you like." />
              <div className="field">
                <label htmlFor="caption">Caption for all of them</label>
                <input id="caption" name="caption" type="text" maxLength={200} placeholder="Optional — you can edit each one below afterwards" />
              </div>
            </div>
          </div>
        </ActionForm>
      ) : !cloudinaryReady() ? (
        <div className="note note-warn">
          Cloudinary is not configured, so photographs cannot be uploaded yet.
        </div>
      ) : null}

      <div className="panel">
        <header>
          <h2>Photographs in this album</h2>
        </header>
        <div className="body">
          {album.photos.length === 0 ? (
            <div className="empty">
              <span className="big" aria-hidden="true">📷</span>
              <h3>This album is empty</h3>
              <p>Add photographs above. An empty album is hidden from the gallery page whether or not it is published.</p>
            </div>
          ) : (
            <div className="tiles" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {album.photos.map((photo) => (
                <div key={photo.id} className="tile-stat" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ aspectRatio: '4 / 3', background: 'var(--surface-sunk)' }}>
                    <img src={cdn(photo.url, { width: 480, height: 360 })} alt={photo.caption ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ padding: 12, display: 'grid', gap: 8 }}>
                    {mayCaption ? (
                      <ActionForm action={setPhotoCaption}>
                        <input type="hidden" name="id" value={photo.id} />
                        <label htmlFor={`caption-${photo.id}`} className="sr-only">Caption</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input id={`caption-${photo.id}`} name="caption" type="text" maxLength={200} defaultValue={photo.caption ?? ''} placeholder="Caption" style={{ fontSize: '0.78rem' }} />
                          <Submit className="btn btn-ghost btn-xs" busy="…">Save</Submit>
                        </div>
                      </ActionForm>
                    ) : (
                      <p className="help" style={{ margin: 0 }}>{photo.caption ?? 'No caption'}</p>
                    )}

                    {mayRemovePhoto ? (
                      <ActionForm action={deletePhoto}>
                        <input type="hidden" name="id" value={photo.id} />
                        <ConfirmSubmit message="Remove this photograph?" className="btn btn-danger btn-xs">Remove</ConfirmSubmit>
                      </ActionForm>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {canAction(user, 'GALLERY_DELETE') ? (
        <div className="panel">
          <header><h2>Delete this album</h2></header>
          <div className="body" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <p className="help" style={{ margin: 0, flex: '1 1 320px' }}>
              The album and all {album.photo_count} photograph{album.photo_count === 1 ? '' : 's'} are deleted, from the
              database and from Cloudinary.
            </p>
            <ActionFormRedirect action={deleteAlbum} to="/admin/gallery">
              <input type="hidden" name="id" value={album.id} />
              <ConfirmSubmit message={`Delete "${album.title}" and its ${album.photo_count} photograph(s)?`} className="btn btn-danger">
                Delete album
              </ConfirmSubmit>
            </ActionFormRedirect>
          </div>
        </div>
      ) : null}
    </>
  );
}

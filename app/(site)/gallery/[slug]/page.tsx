import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getAlbum, getAlbums } from '@/lib/site.ts';
import { formatDate } from '@/lib/format.ts';
import { cdn } from '@/lib/cloudinary.ts';
import { Lightbox } from '../../site-chrome.tsx';

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const albums = await getAlbums();
  return albums.map((album) => ({ slug: album.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const album = await getAlbum(slug);
  if (!album) return { title: 'Album not found' };
  return {
    title: album.title,
    description: album.description ?? `${album.photo_count} photographs.`,
    alternates: { canonical: `/gallery/${album.slug}` },
    openGraph: { images: album.cover_url ? [{ url: album.cover_url }] : undefined },
  };
}

export default async function AlbumPage({ params }: Params) {
  const { slug } = await params;
  const album = await getAlbum(slug);
  if (!album) notFound();

  const others = (await getAlbums()).filter((other) => other.id !== album.id).slice(0, 3);

  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="crumbs">
            <Link href="/">Home</Link><span aria-hidden="true">›</span>
            <Link href="/gallery">Gallery</Link><span aria-hidden="true">›</span>
            {album.title}
          </div>
          <h1>{album.title}</h1>
          {album.description ? <p className="lead">{album.description}</p> : null}
          <p className="tiny muted">
            {album.photo_count} photograph{album.photo_count === 1 ? '' : 's'}
            {album.taken_on ? ` · ${formatDate(album.taken_on)}` : ''}
          </p>
        </div>
      </div>

      <section className="section">
        <div className="wrap">
          {album.photos.length === 0 ? (
            <div className="callout"><p className="small" style={{ margin: 0 }}>This album is empty for now.</p></div>
          ) : (
            <Lightbox photos={album.photos.map((photo) => ({ url: cdn(photo.url, { width: 1600 }), caption: photo.caption }))} />
          )}

          <div className="btn-row">
            <Link href="/gallery" className="btn btn-ghost btn-sm">← All albums</Link>
          </div>
        </div>
      </section>

      {others.length ? (
        <section className="section section-soft">
          <div className="wrap">
            <div className="section-head"><h2>More albums</h2></div>
            <div className="grid g3">
              {others.map((other) => (
                <Link key={other.id} href={`/gallery/${other.slug}`} className="media-card">
                  <div className="shot">
                    {other.cover_url ? (
                      <img src={cdn(other.cover_url, { width: 720, height: 450 })} alt="" loading="lazy" />
                    ) : null}
                  </div>
                  <div className="body">
                    <h3>{other.title}</h3>
                    <div className="meta">{other.photo_count} photo{other.photo_count === 1 ? '' : 's'}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}

import Link from 'next/link';
import type { Metadata } from 'next';
import { getAlbums, getSettings } from '@/lib/site.ts';
import { formatDate } from '@/lib/format.ts';
import { cdn } from '@/lib/cloudinary.ts';
import { Reveal } from '../site-chrome.tsx';

export async function generateMetadata(): Promise<Metadata> {
  const school = await getSettings();
  return {
    title: 'Photo gallery',
    description: `Life at ${school.name}: the campus, sports day, the music and drama festival, and a term in photographs.`,
    alternates: { canonical: '/gallery' },
  };
}

export default async function GalleryPage() {
  const albums = await getAlbums();
  const total = albums.reduce((count, album) => count + album.photo_count, 0);

  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="crumbs"><Link href="/">Home</Link><span aria-hidden="true">›</span>Gallery</div>
          <h1>Photo gallery</h1>
          <p className="lead">
            {total ? `${total} photographs across ${albums.length} album${albums.length === 1 ? '' : 's'} — ` : ''}
            the campus, the classrooms, the fields and the days that are worth remembering.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="wrap">
          {albums.length === 0 ? (
            <div className="callout">
              <h3>The gallery is being put together</h3>
              <p className="small" style={{ margin: 0 }}>
                Photographs go up after each event. In the meantime, <Link href="/news">the news page</Link> has what has
                been happening.
              </p>
            </div>
          ) : (
            <div className="grid g3">
              {albums.map((album, index) => (
                <Reveal key={album.id} delay={index * 60}>
                  <Link href={`/gallery/${album.slug}`} className="media-card">
                    <div className="shot">
                      {album.cover_url ? (
                        <img src={cdn(album.cover_url, { width: 720, height: 450 })} alt="" loading="lazy" />
                      ) : null}
                      <span className="pill">{album.photo_count} photo{album.photo_count === 1 ? '' : 's'}</span>
                    </div>
                    <div className="body">
                      <h3>{album.title}</h3>
                      {album.description ? <p>{album.description}</p> : null}
                      {album.taken_on ? <div className="meta">{formatDate(album.taken_on)}</div> : null}
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section section-soft">
        <div className="wrap">
          <div className="callout callout-accent" style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: '1 1 320px' }}>
              <h3 style={{ marginBottom: 4 }}>Photographs of children</h3>
              <p className="tiny muted" style={{ margin: 0 }}>
                We publish a photograph only where the parent has given consent, and we take one down the day we are
                asked to. No child is ever named alongside their picture.
              </p>
            </div>
            <Link href="/privacy" className="btn btn-ghost btn-sm">Our privacy notice</Link>
          </div>
        </div>
      </section>
    </>
  );
}

import Link from 'next/link';
import type { Metadata } from 'next';
import { getSettings, getRoutes, getAlbums } from '@/lib/site.ts';
import { cdn } from '@/lib/cloudinary.ts';

export const metadata: Metadata = {
  title: 'Student life',
  description: 'A week at the school: CBC lessons, computer and French classes, clubs and societies, school trips, transport and Christian values.',
  alternates: { canonical: '/student-life' },
};

const WEEK: [title: string, body: string][] = [
  ['Lessons', 'The Competency Based Curriculum, taught in spacious, naturally-lit classrooms with a small teacher-to-pupil ratio.'],
  ['Computer classes', 'A centre of digital literacy: every pupil learns to use a computer as part of the school week.'],
  ['French', 'A foreign language alongside English and Kiswahili.'],
  ['Clubs and societies', 'Scouts, Music, Poetry and Drama, among others.'],
  ['Learning beyond the classroom', 'Academic tours that bring lessons to life — most recently to Amboseli National Park.'],
];

export default async function StudentLifePage() {
  const [school, routes, albums] = await Promise.all([getSettings(), getRoutes(), getAlbums()]);
  const photos = albums.flatMap((album) => album.photos.map((photo) => ({ ...photo, album: album.slug }))).slice(0, 4);

  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="crumbs"><Link href="/">Home</Link><span aria-hidden="true">›</span>Student life</div>
          <h1>Student life</h1>
          <p className="lead">
            A holistic education: what happens between the lessons matters as much as the lessons themselves.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="wrap split">
          <div>
            <div className="eyebrow">The shape of it</div>
            <h2>What a week holds</h2>
            <div className="table-scroll">
              <table className="data">
                <tbody>
                  {WEEK.map(([title, body]) => (
                    <tr key={title}>
                      <td className="nowrap" style={{ width: '32%' }}><strong>{title}</strong></td>
                      <td>{body}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="tiny muted">
              School runs Monday to Friday. {school.office_hours ? `The office is open ${school.office_hours.replace(/^Monday to Friday,\s*/i, '')}.` : ''}
            </p>
          </div>

          <aside>
            <div className="callout">
              <h3>Clubs &amp; societies</h3>
              <p className="small" style={{ margin: 0 }}>
                Scouts, Music, Poetry and Drama, among others{school.stat_clubs ? ` — ${school.stat_clubs} in all` : ''}.
              </p>
            </div>
            <div className="callout callout-accent" style={{ marginTop: 16 }}>
              <h3>Christian values</h3>
              <p className="small" style={{ margin: 0 }}>
                {school.name} is founded on strong Christian principles. We mould children with Christ-like values,
                and we honour God through excellence.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="section section-soft">
        <div className="wrap">
          <div className="grid g3">
            <div className="card icon-tile">
              <span className="icon" aria-hidden="true">💻</span>
              <h3>Digital literacy</h3>
              <p>Computer classes are part of every pupil&rsquo;s week, so children grow up confident with technology.</p>
            </div>
            <div className="card icon-tile">
              <span className="icon" aria-hidden="true">🦁</span>
              <h3>School trips</h3>
              <p>Academic tours take learning outside the classroom — the most recent was to Amboseli National Park.</p>
            </div>
            <div className="card icon-tile">
              <span className="icon" aria-hidden="true">🚐</span>
              <h3>Transport</h3>
              <p>
                Smooth school transport services to and from home.{' '}
                {routes.length
                  ? <Link href="/school-bus">See the routes</Link>
                  : <>Ask the office about the route nearest you.</>}
              </p>
            </div>
          </div>
        </div>
      </section>

      {photos.length ? (
        <section className="section">
          <div className="wrap">
            <div className="head-row">
              <div className="section-head">
                <div className="eyebrow">In pictures</div>
                <h2>What it actually looks like</h2>
              </div>
              <Link href="/gallery" className="text-link">The whole gallery</Link>
            </div>
            <div className="photo-grid">
              {photos.map((photo) => (
                <Link key={photo.id} href={`/gallery/${photo.album}`} className="photo">
                  <img src={cdn(photo.url, { width: 520, height: 390 })} alt={photo.caption ?? ''} loading="lazy" />
                  {photo.caption ? <figcaption>{photo.caption}</figcaption> : null}
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="section section-dark">
        <div className="wrap center">
          <div className="section-head center">
            <div className="eyebrow">Come and look</div>
            <h2>The best way to know is to visit</h2>
            <p className="lead" style={{ marginInline: 'auto' }}>
              Walk around the school on an ordinary working day, with lessons running and the playground full.
            </p>
          </div>
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <Link href="/admissions/tour" className="btn btn-accent">Book a visit</Link>
            <Link href="/admissions/apply" className="btn btn-light">Apply online</Link>
          </div>
        </div>
      </section>
    </>
  );
}

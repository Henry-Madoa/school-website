import Link from 'next/link';
import type { Metadata } from 'next';
import { getSettings, getRoutes, getAlbums } from '@/lib/site.ts';
import { cdn } from '@/lib/cloudinary.ts';

export const metadata: Metadata = {
  title: 'Student life',
  description: 'A day at the school: clubs, sport, music and drama, boarding life, the library, the school bus, and how we look after children’s wellbeing.',
  alternates: { canonical: '/student-life' },
};

const DAY: [time: string, day: string, boarder: string | null][] = [
  ['6.00 – 7.00', 'Bus pick-up along the route', 'Wake-up, dormitory duties, breakfast'],
  ['7.20', 'Assembly — notices, a reading, the day’s business', null],
  ['7.40 – 10.20', 'Lessons', null],
  ['10.20 – 10.50', 'Break and a snack', null],
  ['10.50 – 12.50', 'Lessons', null],
  ['12.50 – 14.00', 'Lunch in the dining hall, then free play', null],
  ['14.00 – 15.40', 'Lessons and practicals', null],
  ['15.40 – 16.40', 'Clubs, games, then the bus home', 'Games and clubs'],
  ['17.00 – 19.30', 'At home', 'Supper, then supervised prep'],
  ['20.00', '—', 'Dormitories, lights out by house'],
];

export default async function StudentLifePage() {
  const [school, routes, albums] = await Promise.all([getSettings(), getRoutes(), getAlbums()]);
  const portal = school.portal_url ?? process.env.NEXT_PUBLIC_PORTAL_URL ?? '/portal';
  const photos = albums.flatMap((album) => album.photos.map((photo) => ({ ...photo, album: album.slug }))).slice(0, 4);

  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="crumbs"><Link href="/">Home</Link><span aria-hidden="true">›</span>Student life</div>
          <h1>Student life</h1>
          <p className="lead">
            School is where children spend most of their waking hours. What happens between the lessons matters as much
            as the lessons.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="wrap split">
          <div>
            <div className="eyebrow">The shape of it</div>
            <h2>A day here</h2>
            <div className="table-scroll">
              <table className="data">
                <thead><tr><th style={{ width: '22%' }}>Time</th><th>Day scholar</th><th>Boarder</th></tr></thead>
                <tbody>
                  {DAY.map(([time, day, boarder]) => (
                    <tr key={time}>
                      <td className="nowrap">{time}</td>
                      {boarder === null
                        ? <td colSpan={2}>{day}</td>
                        : <><td>{day}</td><td>{boarder}</td></>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="tiny muted">Times shift a little for Pre-Primary, whose day ends after lunch.</p>
          </div>

          <aside>
            <div className="callout">
              <h3>Clubs &amp; societies</h3>
              <p className="small" style={{ margin: 0 }}>
                Every pupil joins at least one{school.stat_clubs ? ` of ${school.stat_clubs}` : ''}: debate, drama,
                music, scouts, journalism, coding, chess, environment club and the school choir. Clubs run in the last
                period of the day, so no child is left out because of the bus.
              </p>
            </div>
            <div className="callout" style={{ marginTop: 16 }}>
              <h3>Sport</h3>
              <p className="small" style={{ margin: 0 }}>
                Football, netball, athletics, volleyball and swimming — taught in curriculum time and played
                competitively against other schools each term.
              </p>
            </div>
            <div className="callout callout-accent" style={{ marginTop: 16 }}>
              <h3>Wellbeing</h3>
              <p className="small" style={{ margin: 0 }}>
                A counsellor available to any child who asks, a staffed sick bay, and a clear anti-bullying policy that
                staff are trained to act on. Parents are contacted the same day about anything that matters.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="section section-soft">
        <div className="wrap">
          <div className="grid g3">
            <div className="card icon-tile">
              <span className="icon" aria-hidden="true">🛏</span>
              <h3>Boarding</h3>
              <p>
                Houses with resident wardens, from Grade 4 upwards. Supervised prep every evening, weekend activities,
                and visiting days published at the start of each term. Boarders keep the same teachers and the same
                timetable as everyone else — boarding adds structure, not a different school.
              </p>
            </div>
            <div className="card icon-tile">
              <span className="icon" aria-hidden="true">📚</span>
              <h3>Library</h3>
              <p>
                Catalogued copy by copy, staffed from 7 am for the children who come on the first bus. Pupils borrow two
                books at a time for two weeks, and a parent can see what their child has out from the{' '}
                <a href={portal}>portal</a>.
              </p>
            </div>
            <div className="card icon-tile">
              <span className="icon" aria-hidden="true">🚌</span>
              <h3>The school bus</h3>
              <p>
                {routes.length} route{routes.length === 1 ? '' : 's'} with named stops and published times. A child is
                released only to a parent or a named adult. <Link href="/school-bus">See the routes</Link>.
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

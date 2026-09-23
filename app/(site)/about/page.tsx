import Link from 'next/link';
import type { Metadata } from 'next';
import { getSettings, getLevels, getStaff, getRoutes, getTestimonials, getAlbums } from '@/lib/site.ts';
import { cdn } from '@/lib/cloudinary.ts';
import { initials } from '@/lib/format.ts';
import { Reveal } from '../site-chrome.tsx';

export async function generateMetadata(): Promise<Metadata> {
  const school = await getSettings();
  return {
    title: `About ${school.short_name ?? school.name}`,
    description: school.about_intro ?? 'Who we are, what we believe, how the school is governed and registered, and what is on the campus.',
    alternates: { canonical: '/about' },
  };
}

const FACILITIES: [icon: string, title: string, body: string][] = [
  ['🏫', 'Classrooms', 'Purpose-built classrooms for each level, arranged so the youngest children are furthest from the gate.'],
  ['🔬', 'Laboratories', 'Science and computer laboratories, used from Upper Primary upwards.'],
  ['📚', 'Library', 'Catalogued, staffed from 7 am, and open to every pupil — including the ones who come on the first bus.'],
  ['🛏', 'Boarding', 'Houses with resident wardens, supervised prep and weekend activities.'],
  ['⚽', 'Playing fields', 'Football, netball, athletics and games as part of the timetable, not an afterthought.'],
  ['🍲', 'Dining hall', 'A cooked lunch daily, on a published menu cycle.'],
  ['🩺', 'Sick bay', 'Staffed, with parents contacted the same day about anything beyond a scraped knee.'],
  ['🚌', 'Transport', 'Buses the school owns and drivers the school employs, on published routes.'],
];

export default async function AboutPage() {
  const [school, levels, leadership, routes, testimonials, albums] = await Promise.all([
    getSettings(), getLevels(), getStaff('LEADERSHIP'), getRoutes(), getTestimonials(3), getAlbums(),
  ]);
  const cover = albums[0]?.cover_url ?? school.hero_image_url;

  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="crumbs"><Link href="/">Home</Link><span aria-hidden="true">›</span>About</div>
          <h1>About {school.short_name ?? school.name}</h1>
          {school.motto ? <p className="lead">&ldquo;{school.motto}&rdquo; is not a slogan we print on a wall — it is the order we teach in.</p> : null}
        </div>
      </div>

      <section className="section">
        <div className="wrap split">
          <div className="prose">
            <div className="eyebrow">Our story</div>
            <h2>{school.founded_year ? `Since ${school.founded_year}` : 'Who we are'}</h2>
            {(school.about_story ?? school.about_intro ?? '').split('\n\n').filter(Boolean).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}

            {school.mission ? (
              <>
                <h3 style={{ marginTop: 28 }}>Our mission</h3>
                <p>{school.mission}</p>
              </>
            ) : null}
            {school.vision ? (
              <>
                <h3 style={{ marginTop: 20 }}>Our vision</h3>
                <p>{school.vision}</p>
              </>
            ) : null}

            <h3 style={{ marginTop: 28 }}>What we believe</h3>
            <ul>
              <li><strong>Knowledge</strong> — taught properly, assessed honestly, and reported to parents in full.</li>
              <li><strong>Character</strong> — courtesy, effort and responsibility, expected of every pupil and every adult here.</li>
              <li><strong>Excellence</strong> — the best each child is capable of, which is not the same number for every child.</li>
            </ul>

            <h3 style={{ marginTop: 28 }}>Safeguarding</h3>
            <p className="small">
              Every member of staff is vetted before appointment. Visitors sign in at the gate and are accompanied on the
              campus. Children are released only to a parent or a named adult, and the school bus follows the same rule at
              every stop. Our safeguarding and anti-bullying policies are available from the office, and any concern can be
              raised directly with the Principal.
            </p>
          </div>

          <aside>
            {cover ? (
              <div style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', marginBottom: 20 }}>
                <img src={cdn(cover, { width: 800, height: 600 })} alt={`The ${school.name} campus`} style={{ width: '100%', display: 'block' }} loading="lazy" />
              </div>
            ) : null}

            <div className="callout">
              <h3>The school at a glance</h3>
              <div className="table-scroll">
                <table className="data">
                  <tbody>
                    {school.stat_students ? <tr><td>Pupils</td><td className="num">{school.stat_students}</td></tr> : null}
                    {school.stat_teachers ? <tr><td>Teachers</td><td className="num">{school.stat_teachers}</td></tr> : null}
                    <tr><td>Levels</td><td className="num">{levels.length}</td></tr>
                    <tr><td>Grades</td><td className="num">{levels.reduce((n, l) => n + l.grades.length, 0)}</td></tr>
                    {school.stat_clubs ? <tr><td>Clubs &amp; societies</td><td className="num">{school.stat_clubs}</td></tr> : null}
                    <tr><td>Bus routes</td><td className="num">{routes.length}</td></tr>
                    {school.founded_year ? <tr><td>Founded</td><td className="num">{school.founded_year}</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </div>

            {school.registration_no || school.licence_no ? (
              <div className="callout callout-accent" style={{ marginTop: 16 }}>
                <h3>Registration</h3>
                <p className="tiny" style={{ margin: 0 }}>
                  {school.registration_no ? <>Ministry of Education registration <strong>{school.registration_no}</strong><br /></> : null}
                  {school.licence_no ? <>Licence <strong>{school.licence_no}</strong><br /></> : null}
                  {school.postal_address}{school.city ? `, ${school.city}` : ''}
                </p>
              </div>
            ) : null}
          </aside>
        </div>
      </section>

      {leadership.length ? (
        <section className="section section-soft">
          <div className="wrap">
            <div className="head-row">
              <div className="section-head">
                <div className="eyebrow">Who runs the school</div>
                <h2>School leadership</h2>
              </div>
              <Link href="/staff" className="text-link">Every member of staff</Link>
            </div>
            <div className="grid g4">
              {leadership.slice(0, 4).map((person, index) => (
                <Reveal key={person.id} delay={index * 60}>
                  <article className="person">
                    <div className="avatar">
                      {person.photo_url
                        ? <img src={cdn(person.photo_url, { width: 200, height: 200 })} alt="" loading="lazy" />
                        : <span aria-hidden="true">{initials(person.name)}</span>}
                    </div>
                    <h3>{person.name}</h3>
                    <div className="role">{person.role_title}</div>
                    {person.qualification ? <div className="qual">{person.qualification}</div> : null}
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="section">
        <div className="wrap">
          <div className="section-head center">
            <div className="eyebrow">The campus</div>
            <h2>Everything a school this size needs, and nothing it does not</h2>
          </div>
          <div className="grid g4">
            {FACILITIES.map(([icon, title, body], index) => (
              <Reveal key={title} delay={index * 40}>
                <div className="card icon-tile" style={{ height: '100%' }}>
                  <span className="icon" aria-hidden="true">{icon}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {testimonials.length ? (
        <section className="section section-soft">
          <div className="wrap">
            <div className="section-head center">
              <div className="eyebrow">In their words</div>
              <h2>What families say</h2>
            </div>
            <div className="grid g3">
              {testimonials.map((quote) => (
                <figure className="quote" key={quote.id} style={{ margin: 0 }}>
                  <div className="stars" aria-label={`${quote.rating} out of 5`}>{'★'.repeat(Math.max(1, Math.min(5, quote.rating)))}</div>
                  <blockquote>{quote.quote}</blockquote>
                  <figcaption className="who">
                    <span className="avatar" aria-hidden="true">{initials(quote.name)}</span>
                    <span><b>{quote.name}</b>{quote.role_title ? <span>{quote.role_title}</span> : null}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="section">
        <div className="wrap">
          <div className="section-head center">
            <h2>What we teach</h2>
          </div>
          <div className="grid g4">
            {levels.map((level) => (
              <Link key={level.id} href={`/academics/${level.slug}`} className="card card-link">
                <h3>{level.name}</h3>
                <p>{level.grades.map((g) => g.name).join(' · ')}</p>
              </Link>
            ))}
          </div>
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <Link href="/admissions" className="btn btn-primary">Admissions</Link>
            <Link href="/contact" className="btn btn-ghost">Contact the office</Link>
          </div>
        </div>
      </section>
    </>
  );
}

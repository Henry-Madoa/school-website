import Link from 'next/link';
import type { Metadata } from 'next';
import { getSettings, getLevels, getTerms } from '@/lib/site.ts';
import { formatDateShort } from '@/lib/format.ts';
import { cdn } from '@/lib/cloudinary.ts';
import { Reveal } from '../site-chrome.tsx';

export async function generateMetadata(): Promise<Metadata> {
  const school = await getSettings();
  return {
    title: 'Academics',
    description: `The Competency Based Curriculum at ${school.name}: what is taught at each level, how pupils are assessed, and when the terms run.`,
    alternates: { canonical: '/academics' },
  };
}

export default async function AcademicsPage() {
  const [school, levels, terms] = await Promise.all([getSettings(), getLevels(), getTerms()]);
  const today = new Date().toISOString().slice(0, 10);
  const current = terms.find((term) => term.is_current);
  const portal = school.portal_url ?? process.env.NEXT_PUBLIC_PORTAL_URL ?? '/portal';

  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="crumbs"><Link href="/">Home</Link><span aria-hidden="true">›</span>Academics</div>
          <h1>Academics</h1>
          <p className="lead">
            We teach the Kenyan Competency Based Curriculum across {levels.length} levels, from Pre-Primary through
            Junior Secondary{school.stat_teachers ? `, with ${school.stat_teachers} qualified teachers` : ''} and subject
            specialists from Grade 4 upwards.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <div className="eyebrow">What we teach</div>
            <h2>Our levels</h2>
          </div>
          <div className="grid g2">
            {levels.map((level, index) => (
              <Reveal key={level.id} delay={index * 60}>
                <Link href={`/academics/${level.slug}`} className="media-card">
                  {level.image_url ? (
                    <div className="shot">
                      <img src={cdn(level.image_url, { width: 800, height: 500 })} alt="" loading="lazy" />
                    </div>
                  ) : null}
                  <div className="body">
                    <h3>{level.name}</h3>
                    {level.tagline ? <p>{level.tagline}</p> : null}
                    <p className="tiny muted" style={{ margin: 0 }}>
                      {level.grades.map((g) => g.name).join(' · ')}
                    </p>
                    {level.subjects.length ? (
                      <p className="tiny muted" style={{ margin: 0 }}>
                        {level.subjects.slice(0, 6).map((s) => s.name).join(' · ')}
                        {level.subjects.length > 6 ? ` and ${level.subjects.length - 6} more` : ''}
                      </p>
                    ) : null}
                    <div className="meta"><span className="text-link" style={{ pointerEvents: 'none' }}>What is taught</span></div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-soft">
        <div className="wrap split-even">
          <div className="prose">
            <div className="eyebrow">Assessment</div>
            <h2>How pupils are assessed</h2>
            <p>
              The CBC measures what a child can do, not only what they can recall. Teachers record continuous assessment
              through the term — classwork, projects, practicals and tests — and each learning area is reported as a
              competency level with the teacher&rsquo;s comment.
            </p>
            <p>
              At the end of every term each pupil receives a report card showing every learning area, the mean
              performance, the class position where the school publishes it, and remarks from the class teacher and the
              Principal. Report cards are published to parents through the <a href={portal}>parent portal</a>, where you
              can also see attendance day by day.
            </p>
            <p>
              Because marks, attendance and fees all live in one system, a parent asking &ldquo;how is my child
              doing?&rdquo; gets the same answer from the portal, the report card and the class teacher.
            </p>
          </div>

          <div>
            <div className="eyebrow">The year</div>
            <h2>Term dates</h2>
            {current ? (
              <p className="small">
                <strong>{current.name} {current.year_name}</strong> runs {formatDateShort(current.start_date)} – {formatDateShort(current.end_date)}.
              </p>
            ) : null}
            <div className="table-scroll">
              <table className="data">
                <thead><tr><th>Term</th><th>Opens</th><th>Closes</th></tr></thead>
                <tbody>
                  {terms.slice(0, 6).map((term) => (
                    <tr key={term.id} style={term.is_current ? { fontWeight: 600 } : undefined}>
                      <td>{term.name} {term.year_name}{term.is_current ? ' (current)' : ''}</td>
                      <td>{formatDateShort(term.start_date)}</td>
                      <td>{formatDateShort(term.end_date)}</td>
                    </tr>
                  ))}
                  {terms.length === 0 ? <tr><td colSpan={3} className="optional">The calendar is being finalised.</td></tr> : null}
                </tbody>
              </table>
            </div>
            <div className="btn-row">
              <Link href="/academics/calendar" className="btn btn-ghost btn-sm">Full calendar</Link>
              <Link href="/events" className="btn btn-ghost btn-sm">What&rsquo;s on</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="grid g3">
            <div className="card icon-tile">
              <span className="icon" aria-hidden="true">📝</span>
              <h3>Homework and prep</h3>
              <p>Set to a published timetable so families can plan around it, and supervised every evening for boarders.</p>
            </div>
            <div className="card icon-tile">
              <span className="icon" aria-hidden="true">🤝</span>
              <h3>Extra help</h3>
              <p>A Saturday clinic in mathematics and languages, open to anyone who wants an extra hour, at no charge.</p>
            </div>
            <div className="card icon-tile">
              <span className="icon" aria-hidden="true">🧭</span>
              <h3>Pathways guidance</h3>
              <p>From Grade 7 we talk to pupils and parents about senior school pathways, and we say what we actually think.</p>
            </div>
          </div>

          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <Link href="/admissions" className="btn btn-primary">Admissions</Link>
            <Link href="/admissions/fees" className="btn btn-ghost">School fees</Link>
          </div>
          <p className="tiny muted center" style={{ marginTop: 12 }}>
            Terms ending before {formatDateShort(today)} are archived; the office holds the full historical calendar.
          </p>
        </div>
      </section>
    </>
  );
}

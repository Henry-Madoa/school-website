import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getSettings, getLevels, getLevel, getFees, getGrades } from '@/lib/site.ts';
import { formatMoney } from '@/lib/format.ts';
import { cdn } from '@/lib/cloudinary.ts';
import { EnquiryForm } from '../../forms.tsx';

type Params = { params: Promise<{ level: string }> };

/** Pre-renders the level pages at build time — there are four of them and they change rarely. */
export async function generateStaticParams() {
  const levels = await getLevels();
  return levels.map((level) => ({ level: level.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { level: slug } = await params;
  const level = await getLevel(slug);
  if (!level) return { title: 'Level not found' };
  return {
    title: level.name,
    description: level.tagline
      ?? `${level.name} (${level.grades.map((g) => g.name).join(', ')}) — what is taught, how pupils are assessed, and the fees.`,
    alternates: { canonical: `/academics/${level.slug}` },
  };
}

export default async function LevelPage({ params }: Params) {
  const { level: slug } = await params;
  const level = await getLevel(slug);
  if (!level) notFound();

  const [school, { term, tables }, grades] = await Promise.all([getSettings(), getFees(), getGrades()]);
  const gradeIds = new Set(level.grades.map((grade) => grade.id));
  const levelFees = tables.filter((table) => gradeIds.has(table.grade_id));
  const core = level.subjects.filter((subject) => subject.is_core);
  const electives = level.subjects.filter((subject) => !subject.is_core);

  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="crumbs">
            <Link href="/">Home</Link><span aria-hidden="true">›</span>
            <Link href="/academics">Academics</Link><span aria-hidden="true">›</span>
            {level.name}
          </div>
          <h1>{level.name}</h1>
          <p className="lead">{level.tagline ?? level.grades.map((grade) => grade.name).join(' · ')}</p>
          {level.age_note ? <p className="tiny muted">Entry age: {level.age_note}</p> : null}
        </div>
      </div>

      <section className="section">
        <div className="wrap split">
          <div>
            {level.image_url ? (
              <div style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', marginBottom: 28 }}>
                <img src={cdn(level.image_url, { width: 1100, height: 620 })} alt="" style={{ width: '100%', display: 'block' }} />
              </div>
            ) : null}

            <div className="prose">
              <h2>What it is like</h2>
              {(level.description ?? `${level.name} covers ${level.grades.map((g) => g.name).join(', ')}.`)
                .split('\n\n').filter(Boolean).map((paragraph, index) => <p key={index} className="lead" style={{ fontSize: '1.02rem' }}>{paragraph}</p>)}
            </div>

            {level.grades.length ? (
              <>
                <h3 style={{ marginTop: 28 }}>Grades in this level</h3>
                <div className="grid g4" style={{ gap: 10 }}>
                  {level.grades.map((grade) => (
                    <div className="card" key={grade.id} style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <strong>{grade.name}</strong>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            {core.length ? (
              <>
                <h3 style={{ marginTop: 30 }}>Core learning areas</h3>
                <div className="grid g3" style={{ gap: 10 }}>
                  {core.map((subject) => (
                    <div className="card" key={subject.id} style={{ padding: '12px 16px' }}>
                      <span className="small">{subject.name}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            {electives.length ? (
              <>
                <h3 style={{ marginTop: 30 }}>Electives</h3>
                <p className="tiny muted">
                  Chosen by the pupil with the class teacher&rsquo;s guidance. Marks and the report card follow each
                  pupil&rsquo;s own choices.
                </p>
                <div className="grid g3" style={{ gap: 10 }}>
                  {electives.map((subject) => (
                    <div className="card" key={subject.id} style={{ padding: '12px 16px' }}>
                      <span className="small">{subject.name}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            {levelFees.length ? (
              <>
                <h3 style={{ marginTop: 34 }}>Fees at this level</h3>
                <div className="table-scroll">
                  <table className="data">
                    <caption>{term ? `${term.name} ${term.year_name}` : 'Current term'} — compulsory items only</caption>
                    <thead><tr><th>Grade</th><th className="num">Per term</th></tr></thead>
                    <tbody>
                      {levelFees.map((table) => (
                        <tr key={table.grade_id}>
                          <td>{table.grade}</td>
                          <td className="num">{formatMoney(table.compulsory_total, school.currency_symbol)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="optional">
                  Before optional lunch or transport. <Link href="/admissions/fees">The full fee structure</Link>.
                </p>
              </>
            ) : null}
          </div>

          <aside>
            <div className="callout callout-accent">
              <h3>Interested in {level.name}?</h3>
              <p className="tiny">
                {level.entry_note ?? 'Tell us the grade you have in mind and we will call you back within one working day.'}
              </p>
              <EnquiryForm grades={grades.filter((grade) => gradeIds.has(grade.id))} sourcePage={`/academics/${level.slug}`} />
            </div>

            <div className="btn-row">
              <Link href="/admissions/apply" className="btn btn-primary">Apply online</Link>
              <Link href="/admissions/tour" className="btn btn-ghost">Book a visit</Link>
            </div>

            <div className="callout" style={{ marginTop: 18 }}>
              <h3>Other levels</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
                {(await getLevels()).filter((other) => other.id !== level.id).map((other) => (
                  <li key={other.id} className="tiny">
                    <Link href={`/academics/${other.slug}`}><strong>{other.name}</strong></Link><br />
                    <span className="muted">{other.grades.map((grade) => grade.name).join(' · ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}

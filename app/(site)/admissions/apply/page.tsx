import Link from 'next/link';
import type { Metadata } from 'next';
import { getSettings, getGrades, getRoutes, getTerms } from '@/lib/site.ts';
import { telHref } from '@/lib/format.ts';
import { ApplyForm } from './apply-form.tsx';

export const metadata: Metadata = {
  title: 'Apply online',
  description: 'Apply for a place online in about ten minutes. You will receive an application number immediately.',
  alternates: { canonical: '/admissions/apply' },
  robots: { index: true, follow: true },
};

export default async function ApplyPage() {
  const [school, grades, routes, terms] = await Promise.all([getSettings(), getGrades(), getRoutes(), getTerms()]);
  const today = new Date().toISOString().slice(0, 10);
  const intake = terms.find((term) => term.start_date >= today) ?? terms.find((term) => term.is_current);

  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="crumbs">
            <Link href="/">Home</Link><span aria-hidden="true">›</span>
            <Link href="/admissions">Admissions</Link><span aria-hidden="true">›</span>
            Apply
          </div>
          <h1>Apply for a place</h1>
          <p className="lead">
            About ten minutes, and you can do it on a phone. No documents are needed yet — bring those to the placement
            assessment.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="wrap split">
          <div className="card" style={{ padding: 'clamp(20px, 3vw, 34px)' }}>
            <ApplyForm
              grades={grades}
              routes={routes.map((route) => ({ id: route.id, code: route.code, name: route.name }))}
              intakeTerm={intake ? `${intake.name} ${intake.year_name}` : null}
            />
          </div>

          <aside>
            <div className="callout">
              <h3>What happens next</h3>
              <ol className="small" style={{ paddingLeft: 18, margin: 0, display: 'grid', gap: 8 }}>
                <li>You get an application number the moment you press send.</li>
                <li>The admissions office calls within three working days to book the placement assessment.</li>
                <li>You bring the birth certificate, the latest report card and — for a transfer — a letter from the previous school.</li>
                <li>We send an offer with the fee structure and a reporting date.</li>
                <li>On admission your parent portal login is created and the fee account opens.</li>
              </ol>
            </div>

            <div className="callout callout-accent" style={{ marginTop: 18 }}>
              <h3>Prefer to talk to someone?</h3>
              <p className="small" style={{ margin: 0 }}>
                Call the admissions office on{' '}
                {school.phone_primary
                  ? <a href={telHref(school.phone_primary)}><strong>{school.phone_primary}</strong></a>
                  : 'the school office'}
                {school.office_hours ? `, ${school.office_hours.toLowerCase()}` : ''}, or{' '}
                <Link href="/admissions/tour">book a visit</Link> and apply while you are here.
              </p>
            </div>

            <div className="callout" style={{ marginTop: 18 }}>
              <h3>Before you start</h3>
              <ul className="tiny" style={{ paddingLeft: 18, margin: 0 }}>
                <li>The child&rsquo;s full name and date of birth</li>
                <li>The grade you are applying for — <Link href="/academics">see the levels</Link></li>
                <li>Your phone number, which becomes your portal login</li>
                <li>Whether you would like the school bus — <Link href="/school-bus">routes and stops</Link></li>
              </ul>
            </div>

            <p className="tiny muted" style={{ marginTop: 18 }}>
              Your details are held only to process this application and are never passed on. See the{' '}
              <Link href="/privacy">privacy notice</Link>.
            </p>
          </aside>
        </div>
      </section>
    </>
  );
}

import Link from 'next/link';
import type { Metadata } from 'next';
import { getSettings, getLevels, getTerms, getGrades, getFaqs, getLowestTermFee } from '@/lib/site.ts';
import { formatDate, formatMoney, telHref } from '@/lib/format.ts';
import { FAQ_CATEGORIES } from '@/lib/types.ts';
import { EnquiryForm } from '../forms.tsx';
import { Reveal } from '../site-chrome.tsx';

export async function generateMetadata(): Promise<Metadata> {
  const school = await getSettings();
  return {
    title: 'Admissions — how to apply',
    description: `How to apply for a place at ${school.name}: entry requirements by grade, what to bring, the placement assessment, fees and the online application form.`,
    alternates: { canonical: '/admissions' },
  };
}

export default async function AdmissionsPage() {
  const [school, levels, terms, grades, faqs, lowestFee] = await Promise.all([
    getSettings(), getLevels(), getTerms(), getGrades(), getFaqs(), getLowestTermFee(),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const nextTerm = terms.find((term) => term.start_date >= today);

  const jsonLd = faqs.length
    ? {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    }
    : null;

  const byCategory = FAQ_CATEGORIES
    .map((category) => ({ ...category, items: faqs.filter((faq) => faq.category === category.value) }))
    .filter((category) => category.items.length);

  return (
    <>
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /> : null}

      <div className="page-head">
        <div className="wrap">
          <div className="crumbs"><Link href="/">Home</Link><span aria-hidden="true">›</span>Admissions</div>
          <h1>Admissions</h1>
          <p className="lead">
            We admit pupils from Pre-Primary to Junior Secondary, as day scholars and boarders.
            {nextTerm ? ` The next intake is ${nextTerm.name} ${nextTerm.year_name}, opening ${formatDate(nextTerm.start_date)}.` : ''}
          </p>
          <div className="btn-row">
            <Link href="/admissions/apply" className="btn btn-primary">Apply online</Link>
            <Link href="/admissions/tour" className="btn btn-ghost">Book a visit</Link>
            <Link href="/admissions/fees" className="btn btn-ghost">Fee structure</Link>
          </div>
        </div>
      </div>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <div className="eyebrow">How to apply</div>
            <h2>Four steps, and the first one takes ten minutes</h2>
          </div>
          <div className="grid g2" style={{ gap: 32 }}>
            <div className="steps">
              <div className="step">
                <div>
                  <h3>Enquire, or come and see us</h3>
                  <p>Send the form at the bottom of this page, call the office, or book a tour. Visiting while the school is working tells you more than any brochure.</p>
                </div>
              </div>
              <div className="step">
                <div>
                  <h3>Apply online</h3>
                  <p>The form asks for the child&rsquo;s details and your phone number. You get an application number straight away — no documents needed at this stage.</p>
                </div>
              </div>
            </div>
            <div className="steps" style={{ counterReset: 'step 2' }}>
              <div className="step">
                <div>
                  <h3>Placement assessment and interview</h3>
                  <p>A short assessment in literacy and numeracy for the grade applied for, and a conversation with the parents. Bring the birth certificate, the latest report card and a transfer letter if there is one.</p>
                </div>
              </div>
              <div className="step">
                <div>
                  <h3>Offer, acceptance and reporting</h3>
                  <p>We send an offer with the fee structure and a reporting date. Once the place is accepted, your parent portal login is created and the fee account opens.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-soft">
        <div className="wrap">
          <div className="section-head">
            <div className="eyebrow">Entry</div>
            <h2>Requirements by level</h2>
            <p className="lead">
              Ages are measured on 1 January of the year of entry, as the Ministry requires. If your child sits close to
              a boundary, talk to us — we assess the child, not the birthday.
            </p>
          </div>
          <div className="grid g4">
            {levels.map((level, index) => (
              <Reveal key={level.id} delay={index * 60}>
                <div className="card" style={{ height: '100%' }}>
                  <h3>{level.name}</h3>
                  <p className="tiny muted">{level.grades.map((grade) => grade.name).join(' · ')}</p>
                  {level.age_note ? <p className="small"><strong>{level.age_note}</strong></p> : null}
                  {level.entry_note ? <p className="tiny muted">{level.entry_note}</p> : null}
                  <p style={{ marginTop: 10, marginBottom: 0 }}>
                    <Link href={`/academics/${level.slug}`} className="text-link">What is taught</Link>
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          {lowestFee > 0 ? (
            <div className="callout" style={{ marginTop: 28 }}>
              <strong>Fees start at {formatMoney(lowestFee, school.currency_symbol)} a term</strong> for compulsory items,
              before optional boarding, lunch or transport.{' '}
              <Link href="/admissions/fees" className="text-link">See the full fee structure</Link>
            </div>
          ) : null}
        </div>
      </section>

      {byCategory.length ? (
        <section className="section" id="questions">
          <div className="wrap">
            <div className="section-head">
              <div className="eyebrow">Questions parents ask</div>
              <h2>The answers, in public</h2>
              <p className="lead">These are the questions the admissions office answers on the phone every day.</p>
            </div>

            <div className="grid g2" style={{ gap: 32, alignItems: 'start' }}>
              {byCategory.map((category) => (
                <div key={category.value}>
                  <h3 style={{ marginBottom: 14 }}>{category.label}</h3>
                  {category.items.map((faq) => (
                    <details className="faq" key={faq.id}>
                      <summary>{faq.question}</summary>
                      <div className="answer">{faq.answer}</div>
                    </details>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="section section-dark">
        <div className="wrap split-even">
          <div>
            <div className="eyebrow">Still deciding?</div>
            <h2>Ask the admissions office</h2>
            <p className="lead">
              Tell us the grade you have in mind and we will call you back within one working day — no obligation, and
              no sales pitch.
            </p>
            {school.phone_primary ? (
              <p className="small" style={{ color: 'rgb(255 255 255 / 0.82)' }}>
                Prefer to talk now? Call <a href={telHref(school.phone_primary)} style={{ color: 'var(--accent)' }}><strong>{school.phone_primary}</strong></a>
                {school.admissions_email ? <> or e-mail <a href={`mailto:${school.admissions_email}`} style={{ color: 'var(--accent)' }}>{school.admissions_email}</a></> : null}.
                {school.office_hours ? ` ${school.office_hours}` : ''}
              </p>
            ) : null}
            <div className="btn-row">
              <Link href="/admissions/apply" className="btn btn-accent">Apply online</Link>
              <Link href="/admissions/tour" className="btn btn-light">Book a visit</Link>
            </div>
          </div>

          <div className="hero-card">
            <h3>Make an enquiry</h3>
            <EnquiryForm grades={grades} sourcePage="/admissions" />
          </div>
        </div>
      </section>
    </>
  );
}

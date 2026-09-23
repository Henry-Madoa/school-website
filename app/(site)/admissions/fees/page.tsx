import Link from 'next/link';
import type { Metadata } from 'next';
import { getSettings, getFees, getRoutes, getFaqs } from '@/lib/site.ts';
import { formatMoney, formatDate } from '@/lib/format.ts';

export const metadata: Metadata = {
  title: 'School fees',
  description: 'The full fee structure per grade and per term, what is compulsory and what is optional, how to pay, and the discounts available.',
  alternates: { canonical: '/admissions/fees' },
};

export default async function FeesPage() {
  const [school, { term, tables }, routes, faqs] = await Promise.all([
    getSettings(), getFees(), getRoutes(), getFaqs('FEES'),
  ]);
  const money = (cents: number) => formatMoney(cents, school.currency_symbol);

  const byLevel = new Map<string, typeof tables>();
  for (const table of tables) byLevel.set(table.level, [...(byLevel.get(table.level) ?? []), table]);

  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="crumbs">
            <Link href="/">Home</Link><span aria-hidden="true">›</span>
            <Link href="/admissions">Admissions</Link><span aria-hidden="true">›</span>
            Fees
          </div>
          <h1>School fees</h1>
          <p className="lead">
            Published in full, per grade and per term. These are the exact figures the school invoices — there are no
            hidden charges.
            {term ? ` Shown for ${term.name} ${term.year_name} (${formatDate(term.start_date)} – ${formatDate(term.end_date)}).` : ''}
          </p>
        </div>
      </div>

      <section className="section">
        <div className="wrap">
          {tables.length === 0 ? (
            <div className="callout">
              <h3>The fee structure for the coming term is being finalised</h3>
              <p className="small" style={{ margin: 0 }}>
                Please call the school office for the current figures, or <Link href="/contact">send us an enquiry</Link>{' '}
                and we will e-mail them to you.
              </p>
            </div>
          ) : (
            [...byLevel.entries()].map(([level, levelTables]) => (
              <div key={level} style={{ marginBottom: 40 }}>
                <h2>{level}</h2>
                <div className="grid g2">
                  {levelTables.map((table) => (
                    <div className="card" key={table.grade_id}>
                      <h3>{table.grade}</h3>
                      <div className="table-scroll">
                        <table className="data">
                          <thead>
                            <tr><th>Item</th><th>Applies to</th><th className="num">Per term</th></tr>
                          </thead>
                          <tbody>
                            {table.lines.map((line) => (
                              <tr key={line.id}>
                                <td>{line.item}</td>
                                <td className="optional">{line.label}</td>
                                <td className="num">{money(Number(line.amount_cents))}</td>
                              </tr>
                            ))}
                            <tr className="total">
                              <td colSpan={2}>Compulsory total</td>
                              <td className="num">{money(table.compulsory_total)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <p className="optional">Optional items are charged only if you choose them.</p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="section section-soft">
        <div className="wrap split-even">
          <div>
            <div className="eyebrow">Paying</div>
            <h2>How to pay</h2>

            {school.paybill_no ? (
              <div className="callout callout-accent">
                <h3>M-Pesa</h3>
                <p className="small" style={{ margin: 0 }}>
                  Paybill <strong>{school.paybill_no}</strong> · Account number = your child&rsquo;s{' '}
                  <strong>admission number</strong>.<br />
                  The payment posts to the fee account automatically and you get a receipt by SMS.
                </p>
              </div>
            ) : null}

            {school.bank_details ? (
              <div className="callout" style={{ marginTop: 16 }}>
                <h3>Bank transfer</h3>
                <p className="small" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{school.bank_details}</p>
              </div>
            ) : null}

            <h3 style={{ marginTop: 26 }}>Instalments</h3>
            <p className="small">
              Fees are due at the start of each term. Where a family needs to spread the cost, the school can invoice a
              term in instalments — speak to the bursar before the term begins rather than after.
            </p>
            <h3 style={{ marginTop: 20 }}>Discounts and bursaries</h3>
            <p className="small">
              Sibling discounts apply automatically. A limited number of bursaries are awarded each year on need and
              merit; ask the admissions office when you apply.
            </p>
          </div>

          <div>
            <div className="eyebrow">Budgeting</div>
            <h2>What else to allow for</h2>
            <ul className="small prose">
              <li><strong>Uniform and games kit</strong> — bought once, with replacements as the child grows.</li>
              <li><strong>Books and stationery</strong> — the list for each grade is published before the term starts.</li>
              <li>
                <strong>Transport</strong> — if you use the school bus, the termly fare depends on the route.
                {routes.length ? <> <Link href="/school-bus">See routes and fares</Link>.</> : null}
              </li>
              <li><strong>Trips and activities</strong> — optional, always announced with the cost in advance.</li>
            </ul>

            <div className="callout" style={{ marginTop: 18 }}>
              <h3>Fee policy in one paragraph</h3>
              <p className="small" style={{ margin: 0 }}>
                Fees are payable at the start of the term. A pupil whose fees are unpaid keeps learning while the school
                talks to the family — we would rather agree a plan than send a child home. Refunds on withdrawal are
                pro-rated for the unused part of the term, less any one-off charges already incurred.
              </p>
            </div>
          </div>
        </div>

        {faqs.length ? (
          <div className="wrap" style={{ marginTop: 40 }}>
            <h2>Questions about fees</h2>
            {faqs.map((faq) => (
              <details className="faq" key={faq.id}>
                <summary>{faq.question}</summary>
                <div className="answer">{faq.answer}</div>
              </details>
            ))}
          </div>
        ) : null}

        <div className="wrap">
          <div className="btn-row">
            <Link href="/admissions/apply" className="btn btn-primary">Apply online</Link>
            <Link href="/contact" className="btn btn-ghost">Ask the bursar a question</Link>
          </div>
        </div>
      </section>
    </>
  );
}

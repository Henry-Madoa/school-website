import Link from 'next/link';
import type { Metadata } from 'next';
import { getSettings, getRoutes, getGrades, getFaqs } from '@/lib/site.ts';
import { portalUrl } from '@/lib/urls.ts';
import { formatMoney } from '@/lib/format.ts';
import { EnquiryForm } from '../forms.tsx';

export const metadata: Metadata = {
  title: 'School transport — routes, stops and times',
  description: 'Every school bus route with its stops, pick-up and drop-off times, and the termly fare.',
  alternates: { canonical: '/school-bus' },
};

export default async function TransportPage() {
  const [school, routes, grades, faqs] = await Promise.all([
    getSettings(), getRoutes(), getGrades(), getFaqs('TRANSPORT'),
  ]);
  const stops = routes.reduce((count, route) => count + route.stops.length, 0);
  const portal = portalUrl(school);

  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="crumbs"><Link href="/">Home</Link><span aria-hidden="true">›</span>Transport</div>
          <h1>School transport</h1>
          <p className="lead">
            {routes.length} route{routes.length === 1 ? '' : 's'} and {stops} named stops. The times below are the ones
            the transport office actually works to — not an aspiration.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="wrap">
          {routes.length === 0 ? (
            <div className="callout">
              <h3>Route information for the coming term is being finalised</h3>
              <p className="small" style={{ margin: 0 }}>Please call the school office and tell us where you live.</p>
            </div>
          ) : routes.map((route) => (
            <div key={route.id} style={{ marginBottom: 38 }}>
              <h2>{route.code} — {route.name}</h2>
              {route.description ? <p className="lead" style={{ fontSize: '1rem' }}>{route.description}</p> : null}
              <div className="table-scroll">
                <table className="data">
                  <thead>
                    <tr><th style={{ width: '8%' }}>#</th><th>Stop</th><th>Pick-up</th><th>Drop-off</th></tr>
                  </thead>
                  <tbody>
                    {route.stops.length ? route.stops.map((stop, index) => (
                      <tr key={stop.id}>
                        <td>{index + 1}</td>
                        <td><strong>{stop.name}</strong></td>
                        <td>{stop.pickup_time ?? '—'}</td>
                        <td>{stop.dropoff_time ?? '—'}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4} className="optional">Stops for this route are being confirmed.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="optional">
                {Number(route.fare_cents) > 0
                  ? <>Termly fare: <strong>{formatMoney(Number(route.fare_cents), school.currency_symbol)}</strong>, billed with the term&rsquo;s fees.</>
                  : <>The fare for this route is charged through the fee structure — <Link href="/admissions/fees">see fees</Link>.</>}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="section section-soft">
        <div className="wrap split">
          <div>
            <div className="eyebrow">How it works</div>
            <h2>The rules the bus runs by</h2>
            <ul className="small prose">
              <li>Every journey is authorised by a work ticket and driven by a licensed, PSV-badged driver the school employs directly — not a contractor.</li>
              <li>A child is released only to a parent or a named adult at the stop. Tell us in writing if that changes.</li>
              <li>Buses are insured and inspected, and the office is told before a bus goes out and when it returns.</li>
              <li>Morning-only or evening-only travel is possible where a family needs it.</li>
              <li>To join a route, tell the office — the fare is added to the next term&rsquo;s invoice automatically.</li>
              {portal ? <li>A parent signed in to the <a href={portal}>portal</a> can see their child&rsquo;s route, stop and times at any moment.</li> : null}
            </ul>

            {faqs.length ? (
              <div style={{ marginTop: 24 }}>
                {faqs.map((faq) => (
                  <details className="faq" key={faq.id}>
                    <summary>{faq.question}</summary>
                    <div className="answer">{faq.answer}</div>
                  </details>
                ))}
              </div>
            ) : null}

            <div className="callout callout-accent" style={{ marginTop: 22 }}>
              <h3>Your area not on the list?</h3>
              <p className="small" style={{ margin: 0 }}>
                Tell us where you are. Routes change with demand, and a cluster of families in one area is how a new
                stop gets added.
              </p>
            </div>
          </div>

          <aside>
            <div className="card" style={{ padding: 'clamp(18px, 2.4vw, 28px)' }}>
              <h3>Ask about a route</h3>
              <p className="small muted">Tell us your area and we will say whether a bus reaches you.</p>
              <EnquiryForm grades={grades} sourcePage="/school-bus" />
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}

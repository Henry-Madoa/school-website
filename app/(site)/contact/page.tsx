import Link from 'next/link';
import type { Metadata } from 'next';
import { getSettings, getGrades, getStaff } from '@/lib/site.ts';
import { telHref, whatsappHref } from '@/lib/format.ts';
import { EnquiryForm } from '../forms.tsx';

export async function generateMetadata(): Promise<Metadata> {
  const school = await getSettings();
  return {
    title: 'Contact the school',
    description: `Address, phone numbers, office hours and an enquiry form answered within one working day. ${school.name}${school.city ? `, ${school.city}` : ''}.`,
    alternates: { canonical: '/contact' },
  };
}

export default async function ContactPage() {
  const [school, grades, office] = await Promise.all([getSettings(), getGrades(), getStaff('ADMIN')]);
  const mapQuery = encodeURIComponent(
    [school.physical_address, school.city, school.county, school.country ?? 'Kenya'].filter(Boolean).join(', '),
  );
  const portal = school.portal_url ?? process.env.NEXT_PUBLIC_PORTAL_URL ?? '/portal';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'School',
    name: school.name,
    telephone: school.phone_primary ?? undefined,
    email: school.email ?? undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: school.physical_address ?? undefined,
      postOfficeBoxNumber: school.postal_address ?? undefined,
      addressLocality: school.city ?? undefined,
      addressRegion: school.county ?? undefined,
      addressCountry: school.country ?? 'KE',
    },
    openingHours: 'Mo-Fr 07:00-17:00',
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="page-head">
        <div className="wrap">
          <div className="crumbs"><Link href="/">Home</Link><span aria-hidden="true">›</span>Contact</div>
          <h1>Contact us</h1>
          <p className="lead">
            {school.office_hours ?? 'The office is open 7 am – 5 pm, Monday to Friday.'} We answer every enquiry within
            one working day.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="wrap split">
          <div className="card" style={{ padding: 'clamp(20px, 3vw, 34px)' }}>
            <div className="eyebrow">Write to us</div>
            <h2 style={{ fontSize: '1.6rem' }}>Send us a message</h2>
            <EnquiryForm grades={grades} sourcePage="/contact" />
          </div>

          <aside>
            <div className="callout">
              <h3>Find us</h3>
              <p className="small">
                {school.physical_address}<br />
                {school.postal_address}{school.city ? `, ${school.city}` : ''}<br />
                {school.county ? `${school.county} County, ` : ''}{school.country ?? 'Kenya'}
              </p>
              <p style={{ margin: 0 }}>
                <a className="text-link" href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noreferrer">
                  Open in Google Maps
                </a>
              </p>
            </div>

            <div className="callout" style={{ marginTop: 16 }}>
              <h3>Talk to the right desk</h3>
              <div className="table-scroll">
                <table className="data">
                  <tbody>
                    <tr>
                      <td>Admissions</td>
                      <td>{school.phone_primary ? <a href={telHref(school.phone_primary)}>{school.phone_primary}</a> : '—'}</td>
                    </tr>
                    <tr>
                      <td>School office</td>
                      <td>{school.phone_secondary ? <a href={telHref(school.phone_secondary)}>{school.phone_secondary}</a> : (school.phone_primary ?? '—')}</td>
                    </tr>
                    <tr>
                      <td>Admissions e-mail</td>
                      <td>{school.admissions_email ? <a href={`mailto:${school.admissions_email}`}>{school.admissions_email}</a> : '—'}</td>
                    </tr>
                    <tr>
                      <td>General e-mail</td>
                      <td>{school.email ? <a href={`mailto:${school.email}`}>{school.email}</a> : '—'}</td>
                    </tr>
                    {school.whatsapp_number ? (
                      <tr>
                        <td>WhatsApp</td>
                        <td><a href={whatsappHref(school.whatsapp_number)} target="_blank" rel="noreferrer">{school.whatsapp_number}</a></td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <p className="tiny muted" style={{ margin: 0 }}>
                For anything urgent during the school day, please phone rather than e-mail.
              </p>
            </div>

            {office.length ? (
              <div className="callout" style={{ marginTop: 16 }}>
                <h3>Who you will speak to</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
                  {office.slice(0, 4).map((person) => (
                    <li key={person.id} className="tiny">
                      <strong>{person.name}</strong> — {person.role_title}
                      {person.email ? <><br /><a href={`mailto:${person.email}`}>{person.email}</a></> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="callout callout-accent" style={{ marginTop: 16 }}>
              <h3>Already a parent?</h3>
              <p className="small" style={{ margin: 0 }}>
                Fee statements, results, attendance and your child&rsquo;s bus route are all in the{' '}
                <a href={portal}>parent portal</a> — faster than a phone call, and available at any hour.
              </p>
            </div>

            <div className="btn-row">
              <Link href="/admissions/tour" className="btn btn-primary">Book a visit</Link>
              <Link href="/admissions/apply" className="btn btn-ghost">Apply online</Link>
            </div>
          </aside>
        </div>
      </section>

      {school.map_embed_url ? (
        <section className="section-tight">
          <div className="wrap">
            <div style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '1px solid var(--line)' }}>
              <iframe
                src={school.map_embed_url}
                title={`Map showing ${school.name}`}
                width="100%"
                height="420"
                style={{ border: 0, display: 'block' }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}

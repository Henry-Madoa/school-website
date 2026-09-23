import type { ReactNode } from 'react';
import Link from 'next/link';
import { getSettings, getLevels } from '@/lib/site.ts';
import { telHref, whatsappHref } from '@/lib/format.ts';
import { cdn } from '@/lib/cloudinary.ts';
import { portalUrl } from '@/lib/urls.ts';
import { SiteNav, ScrollWatcher, StaffLink, type NavGroup } from './site-nav.tsx';
import { BackToTop } from './site-chrome.tsx';
import { NewsletterForm } from './forms.tsx';
import './site.css';

/*
 * The public website's shell — contact strip, header, navigation, footer.
 *
 * Deliberately nothing like the admin: no sidebar, no session, no role centre. A visitor here is
 * a stranger, and every page is addressed to somebody who has never met the school.
 *
 * The one thing the two halves share is the brand. Both read the same settings row, so the
 * school's name, motto, contacts and colours can never disagree between them — and a school that
 * changes its colours in the admin has changed them here by the next request, with no deploy.
 */

/** Only ever used where the `href` is a link the school typed into its own settings. */
const external = (href: string | null | undefined): boolean => !!href && /^https?:\/\//i.test(href);

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const [school, levels] = await Promise.all([getSettings(), getLevels()]);
  const year = new Date().getFullYear();
  const short = school.short_name ?? school.name;
  const portal = portalUrl(school);

  const groups: NavGroup[] = [
    {
      label: 'About',
      href: '/about',
      items: [
        { href: '/about', label: 'Our story', hint: 'Who we are and what we believe' },
        { href: '/staff', label: 'Leadership & staff', hint: 'The people who teach your child' },
        { href: '/student-life', label: 'Student life', hint: 'A week here, clubs and trips' },
        { href: '/gallery', label: 'Photo gallery' },
      ],
    },
    {
      label: 'Academics',
      href: '/academics',
      items: [
        ...levels.map((level) => ({ href: `/academics/${level.slug}`, label: level.name, hint: level.grades.map((g) => g.name).join(' · ') })),
        { href: '/academics/calendar', label: 'Term dates' },
      ],
    },
    {
      label: 'Admissions',
      href: '/admissions',
      items: [
        { href: '/admissions', label: 'How to apply', hint: 'Four steps to a place' },
        { href: '/admissions/apply', label: 'Apply online', hint: 'About ten minutes, on a phone' },
        { href: '/admissions/fees', label: 'School fees', hint: 'Published in full, per grade' },
        { href: '/admissions/tour', label: 'Book a visit' },
        { href: '/school-bus', label: 'School transport', hint: 'Routes, stops and times' },
      ],
    },
    {
      label: 'News',
      href: '/news',
      items: [
        { href: '/news', label: 'News & notices' },
        { href: '/events', label: "What's on", hint: 'The school calendar' },
      ],
    },
    { label: 'Contact', href: '/contact', items: [] },
  ];

  /*
   * The school's three colours, applied to the tokens the whole stylesheet is built from. A
   * <style> element rather than an inline style on the wrapper, because the gradients and the
   * focus rings reference these too.
   */
  const theme = `
    .site, .site-theme {
      --brand: ${school.brand_primary};
      --brand-hover: color-mix(in srgb, ${school.brand_primary} 84%, #000);
      --brand-deep: ${school.brand_deep};
      --accent: ${school.brand_accent};
      --accent-hover: color-mix(in srgb, ${school.brand_accent} 86%, #000);
    }`;

  return (
    <div className="site">
      <style dangerouslySetInnerHTML={{ __html: theme }} />
      <a href="#main" className="skip-link">Skip to the content</a>
      <ScrollWatcher target=".masthead" />

      <div className="topbar">
        <div className="wrap">
          {school.physical_address ? (
            <span className="hide-phone">📍 {school.physical_address}{school.city ? `, ${school.city}` : ''}</span>
          ) : null}
          <span className="spacer" />
          {school.phone_primary ? <a href={telHref(school.phone_primary)}>📞 {school.phone_primary}</a> : null}
          {school.email ? <a href={`mailto:${school.email}`} className="hide-phone">✉ {school.email}</a> : null}
          <span className="socials">
            {school.facebook_url ? <a href={school.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook">f</a> : null}
            {school.instagram_url ? <a href={school.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram">◎</a> : null}
            {school.youtube_url ? <a href={school.youtube_url} target="_blank" rel="noreferrer" aria-label="YouTube">▶</a> : null}
            {school.x_url ? <a href={school.x_url} target="_blank" rel="noreferrer" aria-label="X">𝕏</a> : null}
          </span>
          <span className="spacer" />
          <StaffLink signInLabel="Staff sign-in" signedInLabel="Admin dashboard" />
        </div>
      </div>

      <header className="masthead">
        <div className="wrap">
          <Link href="/" className="brand">
            <span className="brand-mark">
              {school.logo_url
                ? <img src={cdn(school.logo_url, { width: 92, height: 92 })} alt="" width={46} height={46} />
                : <span aria-hidden="true">{school.crest_emoji ?? '🎓'}</span>}
            </span>
            <span className="brand-text">
              <strong>{short}</strong>
              {school.motto ? <span>{school.motto}</span> : null}
            </span>
          </Link>

          <SiteNav groups={groups} portalUrl={portal} portalLabel="Parent Portal" />
        </div>
      </header>

      <main id="main">{children}</main>

      <footer className="footer">
        <div className="wrap">
          <div className="footer-cta">
            <div>
              <h3>Come and see the school at work</h3>
              <p>Book a visit on any weekday, or start an application online in about ten minutes.</p>
              <div className="footer-cta-actions">
                <Link href="/admissions/tour" className="btn btn-sm btn-accent">Book a visit</Link>
                <Link href="/admissions/apply" className="btn btn-sm btn-light">Apply online</Link>
              </div>
            </div>
            <div>
              <h3>Monthly round-up</h3>
              <p>One email at the end of each month. Nothing else, ever.</p>
              <NewsletterForm sourcePage="footer" />
            </div>
          </div>

          <div className="footer-grid">
            <div>
              <Link href="/" className="brand" style={{ marginBottom: 18 }}>
                <span className="brand-mark">
                  {school.logo_url
                    ? <img src={cdn(school.logo_url, { width: 92, height: 92 })} alt="" width={46} height={46} />
                    : <span aria-hidden="true">{school.crest_emoji ?? '🎓'}</span>}
                </span>
                <span className="brand-text">
                  <strong>{short}</strong>
                  {school.motto ? <span>{school.motto}</span> : null}
                </span>
              </Link>
              <ul className="footer-contact">
                {school.physical_address ? (
                  <li>
                    <span className="ico" aria-hidden="true">📍</span>
                    <span>
                      {school.physical_address}
                      {school.postal_address || school.city ? <><br />{school.postal_address}{school.city ? `, ${school.city}` : ''}</> : null}
                    </span>
                  </li>
                ) : null}
                {school.phone_primary ? (
                  <li>
                    <span className="ico" aria-hidden="true">📞</span>
                    <span>
                      <a href={telHref(school.phone_primary)}>{school.phone_primary}</a>
                      {school.phone_secondary ? <> · <a href={telHref(school.phone_secondary)}>{school.phone_secondary}</a></> : null}
                    </span>
                  </li>
                ) : null}
                {school.email ? (
                  <li><span className="ico" aria-hidden="true">✉</span><a href={`mailto:${school.email}`}>{school.email}</a></li>
                ) : null}
                {school.office_hours ? (
                  <li><span className="ico" aria-hidden="true">🕒</span><span>{school.office_hours}</span></li>
                ) : null}
              </ul>
              {school.registration_no ? (
                <p className="tiny" style={{ color: 'rgb(255 255 255 / 0.5)' }}>
                  Ministry of Education registration {school.registration_no}
                  {school.licence_no ? ` · Licence ${school.licence_no}` : ''}
                </p>
              ) : null}
              <div className="socials">
                {school.facebook_url ? <a href={school.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook">f</a> : null}
                {school.instagram_url ? <a href={school.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram">◎</a> : null}
                {school.youtube_url ? <a href={school.youtube_url} target="_blank" rel="noreferrer" aria-label="YouTube">▶</a> : null}
                {school.tiktok_url ? <a href={school.tiktok_url} target="_blank" rel="noreferrer" aria-label="TikTok">♪</a> : null}
              </div>
            </div>

            <div>
              <h4>Admissions</h4>
              <ul>
                <li><Link href="/admissions">How to apply</Link></li>
                <li><Link href="/admissions/apply">Apply online</Link></li>
                <li><Link href="/admissions/fees">School fees</Link></li>
                <li><Link href="/admissions/tour">Book a visit</Link></li>
                <li><Link href="/school-bus">School transport</Link></li>
              </ul>
            </div>

            <div>
              <h4>The school</h4>
              <ul>
                <li><Link href="/about">About us</Link></li>
                <li><Link href="/staff">Leadership & staff</Link></li>
                <li><Link href="/academics">Academics</Link></li>
                <li><Link href="/academics/calendar">Term dates</Link></li>
                <li><Link href="/student-life">Student life</Link></li>
                <li><Link href="/gallery">Photo gallery</Link></li>
              </ul>
            </div>

            <div>
              <h4>Keep in touch</h4>
              <ul>
                <li><Link href="/news">News & notices</Link></li>
                <li><Link href="/events">What&rsquo;s on</Link></li>
                <li><Link href="/contact">Contact the office</Link></li>
                {portal ? (
                  <li>
                    <a href={portal} target={external(portal) ? '_blank' : undefined} rel="noreferrer">Parent &amp; student portal</a>
                  </li>
                ) : null}
                <li><StaffLink signInLabel="Website admin sign-in" signedInLabel="Website admin dashboard" /></li>
                <li><Link href="/privacy">Privacy notice</Link></li>
              </ul>
            </div>
          </div>

          <div className="footer-base">
            <span>© {year} {school.name}. All rights reserved.</span>
            <span className="spacer" />
            {school.paybill_no ? <span>Fees: M-Pesa paybill <strong>{school.paybill_no}</strong>, account = admission number.</span> : null}
            <span className="powered-by">Powered by <strong>Calbytes Technologies Limited</strong></span>
          </div>
        </div>
      </footer>

      <div className="float-actions">
        {school.whatsapp_number ? (
          <a
            className="float-btn float-whatsapp"
            href={whatsappHref(school.whatsapp_number, `Hello ${short}, I have a question about admissions.`)}
            target="_blank"
            rel="noreferrer"
            aria-label="Message the school on WhatsApp"
          >
            ✆
          </a>
        ) : null}
        <BackToTop />
      </div>
    </div>
  );
}

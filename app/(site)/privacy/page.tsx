import Link from 'next/link';
import type { Metadata } from 'next';
import { getSettings } from '@/lib/site.ts';

export const metadata: Metadata = {
  title: 'Privacy notice',
  description: 'What personal information the school collects through this website, why, how long it is kept, and how to ask for it to be corrected or deleted.',
  alternates: { canonical: '/privacy' },
};

/*
 * A plain-English notice covering what this website actually collects: an enquiry, a tour booking,
 * an application, an event booking and a newsletter sign-up. Written to satisfy the Kenya Data
 * Protection Act, 2019 without burying a parent in a page of legal text.
 *
 * The school should have it reviewed before launch — it is a template, not legal advice.
 */
export default async function PrivacyPage() {
  const school = await getSettings();
  const portal = school.portal_url ?? process.env.NEXT_PUBLIC_PORTAL_URL ?? '/portal';

  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="crumbs"><Link href="/">Home</Link><span aria-hidden="true">›</span>Privacy</div>
          <h1>Privacy notice</h1>
          <p className="lead">How {school.name} handles the personal information you give us through this website.</p>
        </div>
      </div>

      <section className="section">
        <div className="wrap-narrow prose">
          <h2>Who we are</h2>
          <p className="small">
            {school.name}
            {school.physical_address ? `, ${school.physical_address}` : ''}{school.city ? `, ${school.city}` : ''}
            {school.registration_no ? ` (Ministry of Education registration ${school.registration_no})` : ''}, is the
            data controller for the information described here. Questions about this notice go to the school office
            {school.email ? <> at <a href={`mailto:${school.email}`}>{school.email}</a></> : ''}.
          </p>

          <h2>What we collect, and why</h2>
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th>When you…</th><th>We collect</th><th>Because</th></tr></thead>
              <tbody>
                <tr>
                  <td>Send an enquiry or book a visit</td>
                  <td>Your name, phone number, e-mail if you give one, the grade you asked about and your message</td>
                  <td>To reply to you. Without a phone number we cannot.</td>
                </tr>
                <tr>
                  <td>Apply for a place</td>
                  <td>The child&rsquo;s name, date of birth, gender, previous school and any needs you tell us about; your name, relationship, phone and e-mail</td>
                  <td>To assess the application and, if a place is offered, to admit the child.</td>
                </tr>
                <tr>
                  <td>Book a place at an event</td>
                  <td>Your name, phone number and the number of people coming</td>
                  <td>To manage numbers, and to tell you if the event changes.</td>
                </tr>
                <tr>
                  <td>Subscribe to the newsletter</td>
                  <td>Your e-mail address</td>
                  <td>To send the monthly round-up. Every message has an unsubscribe link.</td>
                </tr>
                <tr>
                  <td>Simply read the site</td>
                  <td>Nothing that identifies you. We use no advertising trackers.</td>
                  <td>—</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2>How long we keep it</h2>
          <ul className="small">
            <li><strong>Enquiries and event bookings</strong> — 12 months from your last contact with us, then deleted.</li>
            <li><strong>Unsuccessful or withdrawn applications</strong> — 12 months, then deleted.</li>
            <li><strong>Admitted pupils</strong> — the application becomes part of the pupil&rsquo;s school record and is kept for as long as the law requires a school to keep it.</li>
            <li><strong>Newsletter subscriptions</strong> — until you unsubscribe.</li>
          </ul>

          <h2>Who sees it</h2>
          <p className="small">
            Only the staff who need it — the admissions office, and the class teacher once a child is admitted. We do
            not sell your details, and we do not pass them to anyone else for marketing.
          </p>
          <p className="small">
            This website is a separate system from the school&rsquo;s management system, with its own database and its
            own logins. Only a small number of named members of staff can sign in to it, each with a Permission Set that
            says exactly which screens they may open, and every change is recorded in an audit trail with the name of
            the person who made it.
          </p>

          <h2>Children&rsquo;s information</h2>
          <p className="small">
            Information about a child is given to us by a parent or guardian and is treated as sensitive. No
            pupil&rsquo;s name, marks or fee balance is ever published on this website. A parent sees their own
            child&rsquo;s records — and no one else&rsquo;s — through the <a href={portal}>parent portal</a>, which is
            part of the management system, not this site.
          </p>

          <h2>Photographs</h2>
          <p className="small">
            We ask for consent before using a photograph of a child in school communications, and we record your answer
            against the child&rsquo;s record. No child is named alongside their photograph. You may withdraw consent at
            any time by telling the office, and we will take the photograph down.
          </p>

          <h2>Your rights</h2>
          <p className="small">
            Under the Data Protection Act, 2019 you may ask to see the information we hold about you or your child, ask
            us to correct it, ask us to delete it where we are not required to keep it, or object to how we use it.
            Write to the school office and we will respond within 30 days. If you are not satisfied you may complain to
            the Office of the Data Protection Commissioner.
          </p>

          <h2>Cookies</h2>
          <p className="small">
            This website sets no advertising or tracking cookies. It sets one cookie only for members of staff who sign
            in to edit the site, which keeps them signed in and is deleted when they sign out.
          </p>

          <h2>Security</h2>
          <p className="small">
            Data is held in an encrypted database, reached over TLS. Passwords are stored only as bcrypt hashes and are
            never recoverable by anyone, including us. Images are stored with our media provider and served over HTTPS.
          </p>

          <p className="tiny muted" style={{ marginTop: 30 }}>
            This notice is reviewed each year. Last reviewed{' '}
            {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}.
          </p>

          <div className="btn-row">
            <Link href="/contact" className="btn btn-ghost btn-sm">Contact the office</Link>
          </div>
        </div>
      </section>
    </>
  );
}

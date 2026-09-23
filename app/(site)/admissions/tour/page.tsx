import Link from 'next/link';
import type { Metadata } from 'next';
import { getSettings, getGrades, getUpcomingEvents } from '@/lib/site.ts';
import { formatDate, telHref } from '@/lib/format.ts';
import { EnquiryForm } from '../../forms.tsx';

export const metadata: Metadata = {
  title: 'Book a school visit',
  description: 'Come and see the school while it is working. Book a visit and walk the campus with a member of the admissions team.',
  alternates: { canonical: '/admissions/tour' },
};

export default async function TourPage() {
  const [school, grades, events] = await Promise.all([getSettings(), getGrades(), getUpcomingEvents(6)]);
  const openDays = events.filter((event) => event.category === 'PARENTS' || /open day/i.test(event.title));

  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="crumbs">
            <Link href="/">Home</Link><span aria-hidden="true">›</span>
            <Link href="/admissions">Admissions</Link><span aria-hidden="true">›</span>
            Visit
          </div>
          <h1>Come and see us</h1>
          <p className="lead">
            Visit on a normal working day, while lessons are running and the playground is full. That tells you more
            about a school than any brochure — and you are welcome to bring your child.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="wrap split">
          <div className="card" style={{ padding: 'clamp(20px, 3vw, 34px)' }}>
            <div className="eyebrow">Book a visit</div>
            <h2 style={{ fontSize: '1.6rem' }}>Pick a day that suits you</h2>
            <p className="small muted">We will confirm the time by phone, usually the same day.</p>
            <EnquiryForm grades={grades} sourcePage="/admissions/tour" kind="TOUR" slots={['09:00', '10:30', '14:00', '15:30']} />
          </div>

          <aside>
            <div className="callout">
              <h3>What you will see</h3>
              <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
                <li>Classrooms in session, at the grade your child would join</li>
                <li>The science and computer laboratories, and the library</li>
                <li>The dining hall, and a normal school lunch</li>
                <li>Boarding houses, if boarding interests you</li>
                <li>The playing fields, and the buses if you would use one</li>
                <li>A conversation with the Principal or the Registrar</li>
              </ul>
            </div>

            <div className="callout callout-accent" style={{ marginTop: 18 }}>
              <h3>Practical things</h3>
              <p className="small" style={{ margin: 0 }}>
                Visits take about an hour. Please arrive a few minutes early and report to the gate with an ID — every
                visitor is signed in, which is part of how we keep the children safe.
                {school.phone_primary ? (
                  <> If your plans change, call <a href={telHref(school.phone_primary)}>{school.phone_primary}</a> and we will re-book you.</>
                ) : null}
              </p>
            </div>

            {openDays.length ? (
              <div className="callout" style={{ marginTop: 18 }}>
                <h3>Or come to an open day</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
                  {openDays.map((event) => (
                    <li key={event.id} className="tiny">
                      <Link href={`/events/${event.slug}`}><strong>{event.title}</strong></Link><br />
                      <span className="muted">{formatDate(event.starts_at)}{event.location ? ` · ${event.location}` : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="tiny muted" style={{ marginTop: 18 }}>
              You can also <Link href="/admissions/apply">apply online</Link> first and visit afterwards — applying does
              not commit you to anything.
            </p>
          </aside>
        </div>
      </section>
    </>
  );
}

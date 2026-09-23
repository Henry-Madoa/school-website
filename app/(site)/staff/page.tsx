import Link from 'next/link';
import type { Metadata } from 'next';
import { getSettings, getStaff } from '@/lib/site.ts';
import { cdn } from '@/lib/cloudinary.ts';
import { initials } from '@/lib/format.ts';
import { STAFF_CATEGORIES } from '@/lib/types.ts';
import { FilterList } from '../site-chrome.tsx';

export async function generateMetadata(): Promise<Metadata> {
  const school = await getSettings();
  return {
    title: 'Leadership & staff',
    description: `The people who teach and look after the children at ${school.name} — the leadership team, the teaching staff, the office and the board.`,
    alternates: { canonical: '/staff' },
  };
}

export default async function StaffPage() {
  const [school, staff] = await Promise.all([getSettings(), getStaff()]);

  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="crumbs"><Link href="/">Home</Link><span aria-hidden="true">›</span><Link href="/about">About</Link><span aria-hidden="true">›</span>Staff</div>
          <h1>Leadership &amp; staff</h1>
          <p className="lead">
            A school is the people in it. These are the adults your child will see every day — and the office you can
            ring when you need to.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="wrap">
          {staff.length === 0 ? (
            <div className="callout">
              <h3>Staff profiles are being prepared</h3>
              <p className="small" style={{ margin: 0 }}>
                In the meantime, the office will put you through to anyone you need —{' '}
                {school.phone_primary ? <a href={`tel:${school.phone_primary.replace(/\s/g, '')}`}>{school.phone_primary}</a> : 'please call the school'}.
              </p>
            </div>
          ) : (
            <FilterList
              label="Find someone"
              placeholder="A name, or a subject"
              categories={STAFF_CATEGORIES.filter((c) => staff.some((s) => s.category === c.value))}
              empty="Nobody matches that. Try a surname, or the name of a department."
            >
              <div className="grid g3">
                {staff.map((person) => (
                  <article
                    key={person.id}
                    className="person"
                    data-filter={`${person.name} ${person.role_title} ${person.qualification ?? ''} ${person.bio ?? ''}`}
                    data-category={person.category}
                  >
                    <div className="avatar">
                      {person.photo_url
                        ? <img src={cdn(person.photo_url, { width: 240, height: 240 })} alt="" loading="lazy" />
                        : <span aria-hidden="true">{initials(person.name)}</span>}
                    </div>
                    <h3>{person.name}</h3>
                    <div className="role">{person.role_title}</div>
                    {person.qualification ? <div className="qual">{person.qualification}</div> : null}
                    {person.bio ? <p className="bio">{person.bio}</p> : null}
                    {person.email ? (
                      <p className="tiny" style={{ marginTop: 10 }}>
                        <a href={`mailto:${person.email}`}>{person.email}</a>
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            </FilterList>
          )}
        </div>
      </section>

      <section className="section section-soft">
        <div className="wrap split-even">
          <div>
            <div className="eyebrow">Joining us</div>
            <h2>We are usually looking for good teachers</h2>
            <p className="lead">
              If you are TSC-registered and would like to teach here, write to the office with a CV and the levels you
              teach. We answer every application, and we interview more often than we advertise.
            </p>
            <div className="btn-row">
              {school.email ? <a href={`mailto:${school.email}?subject=Teaching%20application`} className="btn btn-primary">Write to the office</a> : null}
              <Link href="/contact" className="btn btn-ghost">Contact details</Link>
            </div>
          </div>
          <div className="callout">
            <h3>Safeguarding</h3>
            <p className="small" style={{ margin: 0 }}>
              Every member of staff is vetted before appointment, including a certificate of good conduct, and every
              appointment is confirmed by the board. Visitors are signed in at the gate and accompanied around the school.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

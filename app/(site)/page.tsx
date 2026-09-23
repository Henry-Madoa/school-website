import Link from 'next/link';
import type { Metadata } from 'next';
import {
  getSettings, getLevels, getPosts, getUpcomingEvents, getTerms, getGrades,
  getAlbums, getTestimonials, getLowestTermFee,
} from '@/lib/site.ts';
import { formatDate, formatDateShort, dateParts, formatMoney, truncate, initials, telHref } from '@/lib/format.ts';
import { cdn } from '@/lib/cloudinary.ts';
import { portalUrl, siteUrl } from '@/lib/urls.ts';
import { EnquiryForm } from './forms.tsx';
import { Reveal, CountUp } from './site-chrome.tsx';

export async function generateMetadata(): Promise<Metadata> {
  const school = await getSettings();
  return {
    title: `${school.name}${school.motto ? ` — ${school.motto}` : ''}`,
    description: school.hero_body ?? school.about_intro ?? undefined,
    alternates: { canonical: '/' },
  };
}

export default async function HomePage() {
  const [school, levels, posts, events, terms, grades, albums, testimonials, lowestFee] = await Promise.all([
    getSettings(), getLevels(), getPosts(4), getUpcomingEvents(3), getTerms(), getGrades(),
    getAlbums(), getTestimonials(6), getLowestTermFee(),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const currentTerm = terms.find((t) => t.is_current);
  const nextTerm = terms.find((t) => t.start_date > today);
  const headline = posts[0];
  const photos = albums.flatMap((album) => album.photos.map((photo) => ({ ...photo, album: album.slug }))).slice(0, 6);
  const heroImage = school.hero_image_url;
  const portal = portalUrl(school);
  const firstGrade = levels[0]?.grades[0]?.name;
  const lastGrade = levels[levels.length - 1]?.grades.at(-1)?.name;
  const gradeSpan = firstGrade && lastGrade ? `${firstGrade} to ${lastGrade}` : 'every level';

  /* The structured data search engines and assistants read before anything else on the page. */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'School',
    name: school.name,
    alternateName: school.short_name ?? undefined,
    slogan: school.motto ?? undefined,
    description: school.about_intro ?? undefined,
    email: school.email ?? undefined,
    telephone: school.phone_primary ?? undefined,
    url: siteUrl(),
    image: heroImage ?? undefined,
    foundingDate: school.founded_year ?? undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: school.physical_address ?? undefined,
      addressLocality: school.city ?? undefined,
      addressRegion: school.county ?? undefined,
      addressCountry: school.country ?? 'KE',
    },
    identifier: [
      school.registration_no ? { '@type': 'PropertyValue', name: 'MoE Registration', value: school.registration_no } : null,
      school.licence_no ? { '@type': 'PropertyValue', name: 'Licence', value: school.licence_no } : null,
    ].filter(Boolean),
    educationalCredentialAwarded: 'Kenya Competency Based Curriculum (CBC)',
    numberOfStudents: school.stat_students || undefined,
    openingHours: 'Mo-Fr 07:30-17:30',
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ------------------------------------------------------------------ hero */}
      <section className="hero">
        {heroImage ? (
          <img className="hero-bg" src={cdn(heroImage, { width: 2000, height: 1100 })} alt="" fetchPriority="high" />
        ) : null}
        <div className="wrap hero-grid">
          <div>
            {headline ? (
              <Link href={`/news/${headline.slug}`} className="hero-badge">
                <b>Latest</b>
                <span>{truncate(headline.title, 58)}</span>
              </Link>
            ) : null}

            <h1>{school.hero_headline ?? school.motto ?? `Welcome to ${school.name}`}</h1>
            <p className="lead">
              {school.hero_body
                ?? `${school.name} teaches the Competency Based Curriculum in a Christian setting, with small classes and qualified teachers.`}
            </p>

            <div className="btn-row">
              <Link href="/admissions/apply" className="btn btn-accent">Apply online</Link>
              <Link href="/admissions/tour" className="btn btn-light">Book a visit</Link>
            </div>

            <div className="hero-facts">
              {school.stat_students ? <div className="hero-fact"><b>{school.stat_students}</b><span>pupils on the roll</span></div> : null}
              {school.stat_teachers ? <div className="hero-fact"><b>{school.stat_teachers}</b><span>qualified teachers</span></div> : null}
              <div className="hero-fact"><b>{levels.length}</b><span>levels, {gradeSpan}</span></div>
              <div className="hero-fact"><b>{levels.reduce((n, level) => n + level.grades.length, 0)}</b><span>grades taught</span></div>
              <div className="hero-fact"><b>CBC</b><span>Competency Based Curriculum</span></div>
            </div>
          </div>

          <div className="hero-card">
            {portal ? (
              <>
                <h3>Already a parent here?</h3>
                <p className="small muted">
                  Fee statements, results, attendance and your child&rsquo;s bus route — all in the portal, at any hour.
                </p>
                <a href={portal} className="btn btn-primary btn-block">Open the Parent Portal</a>
              </>
            ) : (
              <>
                <h3>Talk to the school office</h3>
                <p className="small muted">
                  {school.office_hours ?? 'The office is open on weekdays.'} Call us, or pay us a visit and see the school at work.
                </p>
                {school.phone_primary ? <a href={telHref(school.phone_primary)} className="btn btn-primary btn-block">Call {school.phone_primary}</a> : null}
              </>
            )}

            <hr />

            <h3>Term dates</h3>
            {currentTerm ? (
              <p className="small" style={{ margin: 0 }}>
                <strong>{currentTerm.name} {currentTerm.year_name}</strong> runs {formatDate(currentTerm.start_date)} – {formatDate(currentTerm.end_date)}.
              </p>
            ) : null}
            {nextTerm && nextTerm.id !== currentTerm?.id ? (
              <p className="tiny muted" style={{ margin: '6px 0 0' }}>Next: {nextTerm.name} opens {formatDate(nextTerm.start_date)}.</p>
            ) : null}
            <p style={{ marginTop: 12, marginBottom: 0 }}><Link href="/academics/calendar" className="text-link">Full calendar</Link></p>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- stats */}
      <section className="section-tight">
        <div className="wrap">
          <Reveal>
            <div className="stat-strip">
              <div className="stat">{school.stat_students ? <CountUp value={school.stat_students} /> : <b>&mdash;</b>}<span>pupils, {gradeSpan}</span></div>
              <div className="stat">{school.stat_teachers ? <CountUp value={school.stat_teachers} /> : <b>&mdash;</b>}<span>qualified teachers</span></div>
              <div className="stat">{school.stat_clubs ? <CountUp value={school.stat_clubs} /> : <b>&mdash;</b>}<span>clubs and societies</span></div>
              <div className="stat">
                <b>{school.stat_pass_rate ? school.stat_pass_rate.split(',')[0] : `${levels.length} levels`}</b>
                <span>{school.stat_pass_rate ? school.stat_pass_rate.split(',').slice(1).join(',').trim() || 'last year' : 'from Pre-Primary upwards'}</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* --------------------------------------------------------------- why us */}
      <section className="section">
        <div className="wrap">
          <div className="section-head center">
            <div className="eyebrow">Why families choose us</div>
            <h2>Small enough to know your child, organised enough to prove it</h2>
            <p className="lead" style={{ marginInline: 'auto' }}>
              {school.about_intro ?? 'Every mark, every register and every shilling is recorded — which is why we can tell you exactly how your child is doing at any moment.'}
            </p>
          </div>

          <div className="grid g4">
            {[
              ['✝️', 'Christ-like values', 'A Christian-based school that moulds children with Christ-like values, and honours God through excellence.'],
              ['👩🏾‍🏫', 'Small classes', 'A small teacher-to-pupil ratio, with qualified teaching and non-teaching staff.'],
              ['💻', 'Beyond the basics', 'Computer and French classes, and clubs from Scouts to Music, Poetry and Drama.'],
              ['🏫', 'Facilities built for it', 'Spacious, naturally-lit classrooms, and facilities that meet Ministry of Education and Ministry of Health standards.'],
            ].map(([icon, title, body], index) => (
              <Reveal key={title} delay={index * 70}>
                <div className="card icon-tile" style={{ height: '100%' }}>
                  <span className="icon" aria-hidden="true">{icon}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------- levels */}
      <section className="section section-soft">
        <div className="wrap">
          <div className="head-row">
            <div className="section-head">
              <div className="eyebrow">Academics</div>
              <h2>{levels.length ? `From ${levels[0]!.name} to ${levels[levels.length - 1]!.name}` : 'What we teach'}</h2>
              <p className="lead">The Kenyan Competency Based Curriculum, taught across {levels.length} levels.</p>
            </div>
            <Link href="/academics" className="text-link">All academics</Link>
          </div>

          <div className="grid g4">
            {levels.map((level, index) => (
              <Reveal key={level.id} delay={index * 60}>
                <Link href={`/academics/${level.slug}`} className="media-card">
                  <div className="shot">
                    {level.image_url ? (
                      <img src={cdn(level.image_url, { width: 640, height: 400 })} alt="" loading="lazy" />
                    ) : null}
                  </div>
                  <div className="body">
                    <h3>{level.name}</h3>
                    <p>{level.grades.map((g) => g.name).join(' · ') || 'Coming soon'}</p>
                    <div className="meta">{level.subjects.length} learning areas</div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- news and events */}
      <section className="section">
        <div className="wrap split">
          <div>
            <div className="head-row">
              <div className="section-head">
                <div className="eyebrow">Latest from the school</div>
                <h2>News &amp; notices</h2>
              </div>
              <Link href="/news" className="text-link">All news</Link>
            </div>

            {posts.length ? posts.map((post) => {
              const when = dateParts(post.published_at);
              return (
                <Link key={post.id} href={`/news/${post.slug}`} className="notice">
                  <span className="stamp"><b>{when.day}</b><span>{when.month}</span></span>
                  <span>
                    <h3>{post.is_pinned ? <span className="pinned" aria-label="Pinned">★ </span> : null}{post.title}</h3>
                    <p>{truncate(post.excerpt ?? post.body, 150)}</p>
                  </span>
                </Link>
              );
            }) : (
              <div className="callout">
                <h3>Nothing published yet</h3>
                <p className="small" style={{ margin: 0 }}>Notices appear here as soon as the school office publishes them.</p>
              </div>
            )}
          </div>

          <aside>
            <div className="head-row">
              <div className="section-head">
                <div className="eyebrow">What&rsquo;s on</div>
                <h2 style={{ fontSize: '1.6rem' }}>Coming up</h2>
              </div>
            </div>

            <div className="grid" style={{ gap: 12 }}>
              {events.length ? events.map((event) => {
                const when = dateParts(event.starts_at);
                return (
                  <Link key={event.id} href={`/events/${event.slug}`} className="event-card">
                    <span className="date-chip">
                      <span className="m">{when.month}</span>
                      <span className="d">{when.day}</span>
                      <span className="w">{when.weekday}</span>
                    </span>
                    <span>
                      <h3>{event.title}</h3>
                      <span className="where">
                        {event.location ? <span>📍 {event.location}</span> : null}
                        {event.rsvp_enabled ? <span className="pill pill-accent">Booking</span> : null}
                      </span>
                    </span>
                  </Link>
                );
              }) : (
                <div className="callout"><p className="small" style={{ margin: 0 }}>The calendar for the coming term is being finalised.</p></div>
              )}
            </div>
            <p style={{ marginTop: 16 }}><Link href="/events" className="text-link">The whole calendar</Link></p>
          </aside>
        </div>
      </section>

      {/* -------------------------------------------------------------- gallery */}
      {photos.length ? (
        <section className="section section-soft">
          <div className="wrap">
            <div className="head-row">
              <div className="section-head">
                <div className="eyebrow">Life here</div>
                <h2>A term in photographs</h2>
              </div>
              <Link href="/gallery" className="text-link">The whole gallery</Link>
            </div>
            <div className="photo-grid">
              {photos.map((photo) => (
                <Link key={photo.id} href={`/gallery/${photo.album}`} className="photo" style={{ cursor: 'pointer' }}>
                  <img src={cdn(photo.url, { width: 520, height: 390 })} alt={photo.caption ?? ''} loading="lazy" />
                  {photo.caption ? <figcaption>{photo.caption}</figcaption> : null}
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* --------------------------------------------------------- testimonials */}
      {testimonials.length ? (
        <section className="section">
          <div className="wrap">
            <div className="section-head center">
              <div className="eyebrow">In their words</div>
              <h2>What families say</h2>
            </div>
            <div className="quotes">
              {testimonials.map((quote) => (
                <figure className="quote" key={quote.id}>
                  <div className="stars" aria-label={`${quote.rating} out of 5`}>{'★'.repeat(Math.max(1, Math.min(5, quote.rating)))}</div>
                  <blockquote>{quote.quote}</blockquote>
                  <figcaption className="who">
                    <span className="avatar" aria-hidden="true">
                      {quote.photo_url
                        ? <img src={cdn(quote.photo_url, { width: 84, height: 84 })} alt="" loading="lazy" />
                        : initials(quote.name)}
                    </span>
                    <span>
                      <b>{quote.name}</b>
                      {quote.role_title ? <span>{quote.role_title}</span> : null}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------------ admissions */}
      <section className="section section-dark">
        <div className="wrap split">
          <div>
            <div className="eyebrow">Admissions</div>
            <h2>Four steps to a place</h2>
            <p className="lead">
              {lowestFee > 0
                ? <>Fees start at <strong>{formatMoney(lowestFee, school.currency_symbol)}</strong> a term for compulsory items, published in full on this website. There are no hidden charges.</>
                : 'Published fees, a friendly placement assessment, and an office that answers the phone.'}
            </p>

            <div className="steps" style={{ marginTop: 28 }}>
              <div className="step">
                <div>
                  <h3>Enquire, or come and see us</h3>
                  <p>Send the form beside this, call the office, or book a tour and walk around the school while it is working.</p>
                </div>
              </div>
              <div className="step">
                <div>
                  <h3>Apply online</h3>
                  <p>One short form, about ten minutes on a phone. No documents are needed at this stage.</p>
                </div>
              </div>
              <div className="step">
                <div>
                  <h3>Assessment &amp; interview</h3>
                  <p>A friendly placement assessment for the child, and a conversation with the parents.</p>
                </div>
              </div>
              <div className="step">
                <div>
                  <h3>Offer and reporting</h3>
                  <p>An offer letter, the fee structure and a reporting date for your child&rsquo;s first day.</p>
                </div>
              </div>
            </div>

            <div className="btn-row">
              <Link href="/admissions/apply" className="btn btn-accent">Start an application</Link>
              <Link href="/admissions/fees" className="btn btn-light">See the fees</Link>
            </div>
          </div>

          <div className="hero-card">
            <div className="eyebrow">Ask us anything</div>
            <h3 style={{ fontSize: '1.4rem' }}>Make an enquiry</h3>
            <p className="small muted">Tell us the grade you have in mind and we will call you back within one working day.</p>
            <EnquiryForm grades={grades} sourcePage="/" />
          </div>
        </div>
      </section>

      {/* Term dates, once more, for the parents who came only for this. */}
      {terms.length ? (
        <section className="section-tight">
          <div className="wrap">
            <div className="callout callout-accent" style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: '1 1 300px' }}>
                <h3 style={{ marginBottom: 4 }}>Term dates at a glance</h3>
                <p className="tiny muted" style={{ margin: 0 }}>
                  {terms.slice(0, 3).map((term) => `${term.name} ${term.year_name}: ${formatDateShort(term.start_date)} – ${formatDateShort(term.end_date)}`).join(' · ')}
                </p>
              </div>
              <Link href="/academics/calendar" className="btn btn-ghost btn-sm">Full calendar</Link>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}

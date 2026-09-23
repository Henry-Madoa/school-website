import Link from 'next/link';
import type { Metadata } from 'next';
import { getSettings, getPosts, getTerms, getUpcomingEvents } from '@/lib/site.ts';
import { formatDate, formatDateShort, dateParts, truncate } from '@/lib/format.ts';
import { cdn } from '@/lib/cloudinary.ts';
import { portalUrl } from '@/lib/urls.ts';
import { POST_CATEGORIES } from '@/lib/types.ts';
import { FilterList } from '../site-chrome.tsx';

export const metadata: Metadata = {
  title: 'News & notices',
  description: 'Notices to parents, school news and the dates that matter this term.',
  alternates: { canonical: '/news' },
};

export default async function NewsPage() {
  const [school, posts, terms, events] = await Promise.all([getSettings(), getPosts(60), getTerms(), getUpcomingEvents(4)]);
  const portal = portalUrl(school);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = terms.filter((term) => term.end_date >= today).slice(0, 4);
  const [lead, ...rest] = posts;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': posts.slice(0, 10).map((post) => ({
      '@type': 'NewsArticle',
      headline: post.title,
      datePublished: post.published_at,
      articleBody: truncate(post.body, 500),
      image: post.image_url ?? undefined,
      publisher: { '@type': 'Organization', name: school.name },
    })),
  };

  return (
    <>
      {posts.length ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /> : null}

      <div className="page-head">
        <div className="wrap">
          <div className="crumbs"><Link href="/">Home</Link><span aria-hidden="true">›</span>News</div>
          <h1>News &amp; notices</h1>
          <p className="lead">
            What is published here is what the school office sends to parents — written once, so nothing gets lost
            between the gate and the group chat.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="wrap split">
          <div>
            {posts.length === 0 ? (
              <div className="callout">
                <h3>Nothing published yet</h3>
                <p className="small" style={{ margin: 0 }}>
                  Notices appear here as soon as the school publishes them. In the meantime, please call the office.
                </p>
              </div>
            ) : (
              <>
                {lead ? (
                  <Link href={`/news/${lead.slug}`} className="media-card" style={{ marginBottom: 28 }}>
                    {lead.image_url ? (
                      <div className="shot" style={{ aspectRatio: '16 / 8' }}>
                        <img src={cdn(lead.image_url, { width: 1000, height: 500 })} alt="" />
                        <span className="pill pill-brand">{POST_CATEGORIES.find((c) => c.value === lead.category)?.label ?? lead.category}</span>
                      </div>
                    ) : null}
                    <div className="body">
                      <h3 style={{ fontSize: '1.4rem' }}>{lead.is_pinned ? '★ ' : ''}{lead.title}</h3>
                      <p>{truncate(lead.excerpt ?? lead.body, 220)}</p>
                      <div className="meta">
                        <span>{formatDate(lead.published_at)}</span>
                        {lead.author ? <span>· {lead.author}</span> : null}
                      </div>
                    </div>
                  </Link>
                ) : null}

                {rest.length ? (
                  <FilterList
                    label="Search the notices"
                    placeholder="A word from the notice — 'uniform', 'half-term', 'fees'"
                    categories={POST_CATEGORIES.filter((c) => rest.some((p) => p.category === c.value))}
                    empty="No notice matches that. Try a single word."
                  >
                    <div>
                      {rest.map((post) => {
                        const when = dateParts(post.published_at);
                        return (
                          <Link
                            key={post.id}
                            href={`/news/${post.slug}`}
                            className="notice"
                            data-filter={`${post.title} ${post.excerpt ?? ''} ${post.body}`}
                            data-category={post.category}
                          >
                            <span className="stamp"><b>{when.day}</b><span>{when.month}</span></span>
                            <span>
                              <h3>{post.is_pinned ? <span className="pinned">★ </span> : null}{post.title}</h3>
                              <p>{truncate(post.excerpt ?? post.body, 190)}</p>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </FilterList>
                ) : null}
              </>
            )}
          </div>

          <aside>
            <div className="callout">
              <h3>Dates ahead</h3>
              {upcoming.length ? (
                <div className="table-scroll">
                  <table className="data">
                    <tbody>
                      {upcoming.map((term) => (
                        <tr key={term.id}>
                          <td>{term.name} {term.year_name}</td>
                          <td className="num">{formatDateShort(term.start_date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="tiny muted" style={{ margin: 0 }}>The calendar is being finalised.</p>}
              <p style={{ margin: '12px 0 0' }}><Link href="/academics/calendar" className="text-link">Full term dates</Link></p>
            </div>

            {events.length ? (
              <div className="callout" style={{ marginTop: 16 }}>
                <h3>What&rsquo;s on</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
                  {events.map((event) => (
                    <li key={event.id} className="tiny">
                      <Link href={`/events/${event.slug}`}><strong>{event.title}</strong></Link><br />
                      <span className="muted">{formatDate(event.starts_at)}</span>
                    </li>
                  ))}
                </ul>
                <p style={{ margin: '12px 0 0' }}><Link href="/events" className="text-link">The whole calendar</Link></p>
              </div>
            ) : null}

            {portal ? (
              <div className="callout callout-accent" style={{ marginTop: 16 }}>
                <h3>Are you a parent here?</h3>
                <p className="tiny" style={{ margin: 0 }}>
                  Notices addressed to your child&rsquo;s class, results, attendance and the fee statement all sit in the{' '}
                  <a href={portal}>parent portal</a>.
                </p>
              </div>
            ) : null}
          </aside>
        </div>
      </section>
    </>
  );
}

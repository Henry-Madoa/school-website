import Link from 'next/link';
import type { Metadata } from 'next';
import { search } from '@/lib/site.ts';
import { formatDateShort, truncate } from '@/lib/format.ts';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search the notices, events, staff and questions on this website.',
  robots: { index: false, follow: true },
};

/** A plain GET form: the query is in the URL, so a result is a link somebody can send to someone. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const query = q.trim();
  const hits = query.length >= 2 ? await search(query) : [];

  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="crumbs"><Link href="/">Home</Link><span aria-hidden="true">›</span>Search</div>
          <h1>Search</h1>
          <form className="form" method="get" action="/search" style={{ maxWidth: 560, marginTop: 20 }}>
            <label htmlFor="q" className="sr-only">What are you looking for?</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <input id="q" name="q" type="search" defaultValue={query} placeholder="'term dates', 'fees', 'bus to Ruaka'" autoFocus />
              <button type="submit" className="btn btn-primary">Search</button>
            </div>
          </form>
        </div>
      </div>

      <section className="section">
        <div className="wrap-narrow">
          {query.length < 2 ? (
            <div className="callout">
              <h3>What are you looking for?</h3>
              <p className="small" style={{ margin: 0 }}>
                Type two letters or more. This searches the notices, events, staff and questions on this website. No
                pupil records are held here.
              </p>
            </div>
          ) : hits.length === 0 ? (
            <div className="callout">
              <h3>Nothing found for &ldquo;{query}&rdquo;</h3>
              <p className="small" style={{ margin: 0 }}>
                Try a single word. Or go straight to <Link href="/admissions">admissions</Link>,{' '}
                <Link href="/admissions/fees">fees</Link>, <Link href="/academics/calendar">term dates</Link> or{' '}
                <Link href="/contact">the office</Link>.
              </p>
            </div>
          ) : (
            <>
              <p className="tiny muted">{hits.length} result{hits.length === 1 ? '' : 's'} for &ldquo;{query}&rdquo;</p>
              {hits.map((hit) => (
                <Link key={`${hit.kind}-${hit.href}-${hit.title}`} href={hit.href} className="notice">
                  <span className="stamp"><b style={{ fontSize: '0.7rem' }}>{hit.kind}</b></span>
                  <span>
                    <h3>{hit.title}</h3>
                    <p>{truncate(hit.excerpt, 170)}</p>
                    {hit.date ? <span className="tiny muted">{formatDateShort(hit.date)}</span> : null}
                  </span>
                </Link>
              ))}
            </>
          )}
        </div>
      </section>
    </>
  );
}

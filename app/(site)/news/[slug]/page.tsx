import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getSettings, getPost, getRelatedPosts, getGrades } from '@/lib/site.ts';
import { formatDate, truncate } from '@/lib/format.ts';
import { cdn } from '@/lib/cloudinary.ts';
import { POST_CATEGORIES } from '@/lib/types.ts';
import { EnquiryForm } from '../../forms.tsx';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: 'Notice not found' };
  return {
    title: post.title,
    description: post.excerpt ?? truncate(post.body, 160),
    alternates: { canonical: `/news/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt ?? truncate(post.body, 200),
      publishedTime: post.published_at,
      images: post.image_url ? [{ url: post.image_url }] : undefined,
    },
  };
}

export default async function NoticePage({ params }: Params) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const [school, related, grades] = await Promise.all([getSettings(), getRelatedPosts(post, 3), getGrades()]);
  const category = POST_CATEGORIES.find((c) => c.value === post.category)?.label ?? post.category;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: post.title,
    datePublished: post.published_at,
    dateModified: post.updated_at ?? post.published_at,
    articleBody: post.body,
    image: post.image_url ?? undefined,
    author: { '@type': 'Organization', name: post.author ?? school.name },
    publisher: { '@type': 'Organization', name: school.name },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="page-head">
        <div className="wrap">
          <div className="crumbs">
            <Link href="/">Home</Link><span aria-hidden="true">›</span>
            <Link href="/news">News</Link><span aria-hidden="true">›</span>
            {truncate(post.title, 40)}
          </div>
          <span className="pill pill-brand">{category}</span>
          <h1 style={{ marginTop: 14 }}>{post.title}</h1>
          <p className="tiny muted">
            Published {formatDate(post.published_at)}
            {post.author ? ` · ${post.author}` : ''}
            {post.expires_at ? ` · applies until ${formatDate(post.expires_at)}` : ''}
          </p>
        </div>
      </div>

      <section className="section">
        <div className="wrap split">
          <article>
            {post.image_url ? (
              <div style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', marginBottom: 28 }}>
                <img src={cdn(post.image_url, { width: 1200, height: 675 })} alt="" style={{ width: '100%', display: 'block' }} />
              </div>
            ) : null}

            <div className="prose">
              {post.excerpt ? <p className="lead">{post.excerpt}</p> : null}
              {post.body.split('\n\n').filter(Boolean).map((paragraph, index) => (
                <p key={index} style={{ whiteSpace: 'pre-wrap' }}>{paragraph}</p>
              ))}
            </div>

            {post.attachment_url ? (
              <p style={{ marginTop: 24 }}>
                <a className="btn btn-ghost btn-sm" href={post.attachment_url} target="_blank" rel="noreferrer">
                  📎 Open the attachment
                </a>
              </p>
            ) : null}

            <div className="btn-row">
              <Link href="/news" className="btn btn-ghost btn-sm">← All news &amp; notices</Link>
            </div>
          </article>

          <aside>
            <div className="callout callout-accent">
              <h3>Questions about this?</h3>
              <p className="tiny">
                The school office answers every enquiry within one working day
                {school.phone_primary ? <>, or call <a href={`tel:${school.phone_primary.replace(/\s/g, '')}`}>{school.phone_primary}</a></> : ''}.
              </p>
              <EnquiryForm grades={grades} sourcePage={`/news/${post.slug}`} compact />
            </div>

            {related.length ? (
              <div className="callout" style={{ marginTop: 18 }}>
                <h3>Read next</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 14 }}>
                  {related.map((other) => (
                    <li key={other.id} className="tiny">
                      <Link href={`/news/${other.slug}`}><strong>{other.title}</strong></Link><br />
                      <span className="muted">{formatDate(other.published_at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      </section>
    </>
  );
}

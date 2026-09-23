import type { MetadataRoute } from 'next';
import { getLevels, getPosts, getUpcomingEvents, getPastEvents, getAlbums } from '@/lib/site.ts';

/*
 * The sitemap, built from what is actually published rather than a hand-kept list — so a notice
 * published in the admin is in the sitemap on the next crawl, and one taken down is out of it.
 *
 * The admin is not here, and it is disallowed in robots.ts.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const url = (path: string) => `${base}${path}`;

  const [levels, posts, upcoming, past, albums] = await Promise.all([
    getLevels(), getPosts(200), getUpcomingEvents(100), getPastEvents(100), getAlbums(),
  ]);

  const fixed: MetadataRoute.Sitemap = [
    { url: url('/'), changeFrequency: 'weekly', priority: 1 },
    { url: url('/about'), changeFrequency: 'monthly', priority: 0.8 },
    { url: url('/staff'), changeFrequency: 'monthly', priority: 0.6 },
    { url: url('/student-life'), changeFrequency: 'monthly', priority: 0.6 },
    { url: url('/academics'), changeFrequency: 'monthly', priority: 0.8 },
    { url: url('/academics/calendar'), changeFrequency: 'weekly', priority: 0.7 },
    { url: url('/admissions'), changeFrequency: 'monthly', priority: 0.9 },
    { url: url('/admissions/apply'), changeFrequency: 'monthly', priority: 0.9 },
    { url: url('/admissions/fees'), changeFrequency: 'monthly', priority: 0.8 },
    { url: url('/admissions/tour'), changeFrequency: 'monthly', priority: 0.7 },
    { url: url('/school-bus'), changeFrequency: 'monthly', priority: 0.6 },
    { url: url('/news'), changeFrequency: 'daily', priority: 0.8 },
    { url: url('/events'), changeFrequency: 'daily', priority: 0.7 },
    { url: url('/gallery'), changeFrequency: 'weekly', priority: 0.5 },
    { url: url('/contact'), changeFrequency: 'yearly', priority: 0.7 },
    { url: url('/privacy'), changeFrequency: 'yearly', priority: 0.3 },
  ];

  return [
    ...fixed,
    ...levels.map((level) => ({ url: url(`/academics/${level.slug}`), changeFrequency: 'monthly' as const, priority: 0.7 })),
    ...posts.map((post) => ({
      url: url(`/news/${post.slug}`),
      lastModified: new Date(post.updated_at ?? post.published_at),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    ...[...upcoming, ...past].map((event) => ({
      url: url(`/events/${event.slug}`),
      lastModified: new Date(event.updated_at ?? event.created_at),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
    ...albums.map((album) => ({ url: url(`/gallery/${album.slug}`), changeFrequency: 'monthly' as const, priority: 0.4 })),
  ];
}

import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/urls.ts';

/**
 * The admin is disallowed here as a courtesy to well-behaved crawlers. It is not a security
 * measure — every admin route is guarded by a session check and a Permission Set, because
 * robots.txt is a request and not a lock.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/admin/', '/search'] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}

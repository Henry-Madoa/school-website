import type { ReactNode } from 'react';
import { cdn } from '@/lib/cloudinary.ts';
import { findStockSchoolPhoto, homepageHeroImage, schoolHeroImages } from '@/lib/school-photos.ts';
import { getSettings } from '@/lib/site.ts';
import { HeroBackground } from './hero-background.tsx';

export async function Hero({
  children,
  images = [],
  home = false,
}: {
  children: ReactNode;
  images?: (string | null | undefined)[];
  home?: boolean;
}) {
  const school = await getSettings();
  const candidates = [
    ...images.filter((url) => !findStockSchoolPhoto(url)),
    homepageHeroImage(school.hero_image_url),
    ...schoolHeroImages,
  ];
  const backgrounds = new Map<string, string>();
  for (const url of candidates) {
    if (!url) continue;
    const src = cdn(url, { width: 1600, height: home ? 1000 : 700 });
    const key = src.startsWith('https://images.unsplash.com/') ? src.split('?')[0]! : src;
    if (!backgrounds.has(key)) backgrounds.set(key, src);
    if (backgrounds.size === 3) break;
  }
  const sources = Array.from(backgrounds.values());

  return (
    <section className={home ? 'hero' : 'page-head'}>
      <HeroBackground key={JSON.stringify(sources)} images={sources} priority={home}>
        {home ? children : <div className="wrap">{children}</div>}
      </HeroBackground>
    </section>
  );
}

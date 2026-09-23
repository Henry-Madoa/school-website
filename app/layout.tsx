import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Source_Serif_4 } from 'next/font/google';
import { getSettings } from '@/lib/site.ts';
import './globals.css';

/*
 * The root shell. Deliberately thin: it sets the fonts, the document language and the metadata
 * defaults, and nothing else. The public website and the admin each bring their own chrome,
 * because they are addressed to different people — a stranger, and a member of staff who signs in.
 */

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans-stack',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
});

const display = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-display-stack',
  display: 'swap',
  fallback: ['ui-serif', 'Georgia', 'serif'],
});

export const viewport: Viewport = {
  themeColor: '#0f4c81',
  width: 'device-width',
  initialScale: 1,
};

/**
 * Titles, descriptions and the canonical host come from the school's own record, so a school that
 * renames itself in the Admin Centre renames itself in Google too.
 */
export async function generateMetadata(): Promise<Metadata> {
  const school = await getSettings();
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return {
    metadataBase: new URL(base),
    title: { default: `${school.name}${school.motto ? ` — ${school.motto}` : ''}`, template: `%s · ${school.short_name ?? school.name}` },
    description:
      school.hero_body ??
      `${school.name} teaches the Competency Based Curriculum from Pre-Primary to Junior Secondary${school.city ? ` in ${school.city}` : ''}. Apply online.`,
    applicationName: school.name,
    openGraph: {
      type: 'website',
      siteName: school.name,
      title: school.name,
      description: school.about_intro ?? undefined,
      images: school.hero_image_url ? [{ url: school.hero_image_url }] : undefined,
      locale: 'en_KE',
    },
    twitter: { card: 'summary_large_image' },
    robots: { index: true, follow: true },
    alternates: { canonical: '/' },
  };
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}

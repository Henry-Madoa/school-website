import type { ReactNode } from 'react';
import { getSettings } from '@/lib/site.ts';
import '../globals.css';
import './admin.css';

/*
 * The admin's outermost shell.
 *
 * Deliberately thin: it applies the school's brand colours and nothing else, because the sign-in
 * page and the signed-in application need very different chrome and only one of them may touch a
 * session. The sidebar, the guard and the role resolution all live in (dashboard)/layout.tsx.
 */

export const metadata = {
  title: { default: 'Website admin', template: '%s · Website admin' },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const school = await getSettings();

  const theme = `
    .admin, .login-page {
      --brand: ${school.brand_primary};
      --brand-hover: color-mix(in srgb, ${school.brand_primary} 84%, #000);
      --brand-deep: ${school.brand_deep};
      --accent: ${school.brand_accent};
      --accent-hover: color-mix(in srgb, ${school.brand_accent} 86%, #000);
    }`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: theme }} />
      {children}
    </>
  );
}

import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSettings } from '@/lib/site.ts';
import { requireUser } from '@/lib/auth.ts';
import { visiblePages, canNav } from '@/lib/permissions.ts';
import { inboxSummary } from '@/lib/inbox.ts';
import { cdn } from '@/lib/cloudinary.ts';
import { initials } from '@/lib/format.ts';
import { AdminShell, type NavEntry } from './admin-shell.tsx';

/*
 * The guard and the chrome for everything behind the sign-in.
 *
 * The sidebar is built here, on the server, from the Permission Sets the account holds — so a
 * screen somebody may not open is not in the menu, is not in the HTML, and redirects them away if
 * they type its address. Three layers for the same rule, because only the last one is a lock.
 */

/** Which heading each screen sits under. Presentation only — rights are decided by the catalogue. */
const GROUPS: Record<string, string> = {
  DASHBOARD: 'Overview',
  NEWS: 'Publishing',
  EVENTS: 'Publishing',
  GALLERY: 'Publishing',
  PEOPLE: 'Publishing',
  TESTIMONIALS: 'Publishing',
  FAQS: 'Publishing',
  ACADEMICS: 'The school',
  TRANSPORT: 'The school',
  ENQUIRIES: 'Admissions',
  APPLICATIONS: 'Admissions',
  SUBSCRIBERS: 'Admissions',
  SETTINGS: 'Setup',
  SECURITY: 'Setup',
};

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  /*
   * A password somebody else chose should stop working the moment its owner signs in. proxy.ts
   * passes the pathname down so this check can live here — one place, above every admin screen —
   * rather than being repeated at the top of each of them.
   */
  if (user.must_change_password) {
    const pathname = (await headers()).get('x-pathname') ?? '';
    if (!pathname.startsWith('/admin/profile')) redirect('/admin/profile?password=required');
  }
  const [school, summary] = await Promise.all([
    getSettings(),
    // A count beside a menu entry is only worth fetching if the user may open that entry.
    canNav(user, 'ENQUIRIES') || canNav(user, 'APPLICATIONS') ? inboxSummary() : null,
  ]);

  const entries: NavEntry[] = visiblePages(user).map((page) => ({
    code: page.code,
    label: page.label,
    route: page.route,
    icon: page.icon ?? '•',
    group: GROUPS[page.code] ?? 'Other',
    count: page.code === 'ENQUIRIES' ? summary?.enquiries_new
      : page.code === 'APPLICATIONS' ? summary?.applications_open
        : undefined,
  }));

  return (
    <AdminShell
      entries={entries}
      schoolName={school.short_name ?? school.name}
      logoUrl={school.logo_url ? cdn(school.logo_url, { width: 96, height: 96 }) : null}
      crest={school.crest_emoji ?? '🎓'}
      user={{
        name: user.name,
        email: user.email,
        role: user.is_system ? 'System Administrator' : user.role_name ?? 'No Permission Set',
        initials: initials(user.name),
      }}
    >
      {children}
    </AdminShell>
  );
}

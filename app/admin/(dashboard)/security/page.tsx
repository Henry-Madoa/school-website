import { redirect } from 'next/navigation';
import { requirePage } from '@/lib/auth.ts';
import { canPage } from '@/lib/permissions.ts';

/**
 * Security has no screen of its own — it is a module with three tabs. Whoever opens it lands on
 * the first tab their Permission Set actually includes.
 */
export default async function SecurityIndexPage() {
  const user = await requirePage('SECURITY');
  if (canPage(user, 'SECURITY_USERS')) redirect('/admin/security/users');
  if (canPage(user, 'SECURITY_ROLES')) redirect('/admin/security/roles');
  if (canPage(user, 'SECURITY_AUDIT')) redirect('/admin/security/audit');
  redirect('/admin');
}

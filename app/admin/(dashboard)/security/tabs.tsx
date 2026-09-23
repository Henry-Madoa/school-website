import Link from 'next/link';
import { canPage } from '@/lib/permissions.ts';
import type { SessionUser } from '@/lib/types.ts';

/** The Security module's tab strip, showing only the tabs this Permission Set includes. */
export function SecurityTabs({ user, current }: { user: SessionUser; current: 'users' | 'roles' | 'audit' }) {
  return (
    <div className="tabs">
      {canPage(user, 'SECURITY_USERS') ? (
        <Link href="/admin/security/users" aria-current={current === 'users' ? 'page' : undefined}>Users</Link>
      ) : null}
      {canPage(user, 'SECURITY_ROLES') ? (
        <Link href="/admin/security/roles" aria-current={current === 'roles' ? 'page' : undefined}>Permission Sets</Link>
      ) : null}
      {canPage(user, 'SECURITY_AUDIT') ? (
        <Link href="/admin/security/audit" aria-current={current === 'audit' ? 'page' : undefined}>Audit trail</Link>
      ) : null}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOutAction } from '@/app/actions/auth.ts';
import { useCollapsiblePanels } from './collapsible-panels.ts';

/*
 * The signed-in chrome: the sidebar, the drawer it becomes on a phone, and the account menu.
 *
 * Which entries exist is decided on the server from the user's Permission Sets and passed in —
 * this component never sees a right, only a list. That keeps the permission engine off the
 * client entirely, and means a screen somebody cannot open is not merely hidden from them.
 */

export interface NavEntry {
  code: string;
  label: string;
  route: string;
  icon: string;
  /** A number worth chasing — new enquiries, applications waiting. */
  count?: number;
  group: string;
}

export function AdminShell({
  entries,
  user,
  schoolName,
  logoUrl,
  crest,
  children,
}: {
  entries: NavEntry[];
  user: { name: string; email: string; role: string; initials: string };
  schoolName: string;
  logoUrl: string | null;
  crest: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  useCollapsiblePanels(bodyRef, pathname);

  /*
   * Every navigation closes the drawer and the account menu. Adjusted during render rather than
   * in an effect — React's own recipe for resetting state when a prop changes, and it avoids
   * painting the new screen with the old menu still hanging over it.
   */
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setDrawer(false);
    setMenu(false);
  }

  useEffect(() => {
    if (!drawer && !menu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setDrawer(false); setMenu(false); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawer, menu]);

  /* The deepest entry whose route prefixes the current path — so /admin/news/12 lights up News,
   * while /admin alone does not light up everything. */
  const activeCode = entries
    .filter((entry) => pathname === entry.route || pathname.startsWith(`${entry.route}/`))
    .sort((a, b) => b.route.length - a.route.length)[0]?.code;

  const groups = [...new Set(entries.map((entry) => entry.group))];
  const active = entries.find((entry) => entry.code === activeCode);

  return (
    <div className="admin">
      <div className="admin-shell">
        <aside className="admin-side" data-open={drawer}>
          <Link href="/admin" className="admin-brand">
            <span className="mark">
              {logoUrl
                ? <img src={logoUrl} alt="" />
                : <span aria-hidden="true">{crest}</span>}
            </span>
            <span>
              <strong>{schoolName}</strong>
              <span>Website admin</span>
            </span>
          </Link>

          <nav className="admin-nav" aria-label="Admin sections">
            {groups.map((group) => (
              <div key={group}>
                <h6>{group}</h6>
                {entries.filter((entry) => entry.group === group).map((entry) => (
                  <Link key={entry.code} href={entry.route} aria-current={entry.code === activeCode ? 'page' : undefined}>
                    <span className="ico" aria-hidden="true">{entry.icon}</span>
                    <span>{entry.label}</span>
                    {entry.count ? <span className="count">{entry.count > 99 ? '99+' : entry.count}</span> : null}
                  </Link>
                ))}
              </div>
            ))}
          </nav>

          <div className="admin-side-foot">
            <Link href="/" target="_blank">↗ View the website</Link>
          </div>
        </aside>

        {drawer ? <button type="button" className="admin-scrim" aria-label="Close the menu" onClick={() => setDrawer(false)} /> : null}

        <div className="admin-main">
          <header className="admin-top">
            <button type="button" className="admin-burger" onClick={() => setDrawer(true)} aria-label="Open the menu">☰</button>
            <div style={{ minWidth: 0 }}>
              <h1>{active?.label ?? 'Dashboard'}</h1>
            </div>
            <span style={{ flex: 1 }} />

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="admin-who"
                onClick={() => setMenu(!menu)}
                aria-expanded={menu}
                aria-haspopup="menu"
              >
                <span style={{ textAlign: 'right' }}>
                  <b>{user.name}</b>
                  <span>{user.role}</span>
                </span>
                <span className="pip" aria-hidden="true">{user.initials}</span>
              </button>

              {menu ? (
                <div
                  role="menu"
                  style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 8px)', minWidth: 230, zIndex: 40,
                    background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r)',
                    boxShadow: 'var(--shadow-lg)', padding: 8,
                  }}
                >
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--line)', marginBottom: 6 }}>
                    <b style={{ display: 'block', fontSize: '0.85rem' }}>{user.name}</b>
                    <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>{user.email}</span>
                  </div>
                  <Link href="/admin/profile" role="menuitem" style={menuItem}>My account</Link>
                  <Link href="/" target="_blank" role="menuitem" style={menuItem}>View the website ↗</Link>
                  <form action={signOutAction}>
                    <button type="submit" role="menuitem" style={{ ...menuItem, width: '100%', textAlign: 'left', border: 0, background: 'none', cursor: 'pointer', font: 'inherit', color: 'var(--bad)' }}>
                      Sign out
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          </header>

          <div className="admin-body" ref={bodyRef}>{children}</div>
        </div>
      </div>
    </div>
  );
}

const menuItem = {
  display: 'block',
  padding: '9px 10px',
  borderRadius: 8,
  textDecoration: 'none',
  color: 'var(--ink)',
  fontSize: '0.85rem',
} as const;

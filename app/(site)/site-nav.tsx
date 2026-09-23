'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/*
 * The public menu.
 *
 * On a laptop it is a row with two drop-downs; on a phone — where almost every parent will meet
 * it — the same markup becomes a full-width drawer whose groups expand in place. One component
 * rather than two, so the two can never disagree about what the school's menu contains.
 *
 * It closes itself on navigation, on Escape, and on a click outside, because a menu a parent has
 * to dismiss by hand is a menu that ends up covering the page they wanted.
 */

export interface NavItem {
  href: string;
  label: string;
  hint?: string;
}

export interface NavGroup {
  label: string;
  href: string;
  items: NavItem[];
}

export function SiteNav({ groups, portalUrl, portalLabel }: { groups: NavGroup[]; portalUrl: string | null; portalLabel: string }) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  /*
   * Every navigation closes everything. Adjusted during render rather than in an effect, which is
   * React's own recipe for resetting state when a prop changes: doing it in an effect would paint
   * the new page with the old menu still open for one frame.
   */
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setDrawer(false);
    setOpen(null);
  }

  useEffect(() => {
    if (!drawer && !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(null); setDrawer(false); }
    };
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) { setOpen(null); setDrawer(false); }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onClick);
    };
  }, [drawer, open]);

  const isOn = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
  const groupIsOn = (group: NavGroup) => isOn(group.href) || group.items.some((item) => isOn(item.href));

  return (
    <div ref={navRef} style={{ display: 'contents' }}>
      <button
        type="button"
        className="nav-toggle"
        aria-expanded={drawer}
        aria-controls="site-nav"
        aria-label={drawer ? 'Close the menu' : 'Open the menu'}
        onClick={() => setDrawer(!drawer)}
      >
        <span />
      </button>

      <nav id="site-nav" className="nav" data-open={drawer} aria-label="Main">
        {groups.map((group) =>
          group.items.length === 0 ? (
            <Link key={group.href} href={group.href} aria-current={isOn(group.href) ? 'page' : undefined}>
              {group.label}
            </Link>
          ) : (
            <div
              key={group.label}
              className="nav-group"
              data-open={open === group.label}
              data-active={groupIsOn(group)}
              onMouseEnter={() => { if (window.matchMedia('(min-width: 1001px)').matches) setOpen(group.label); }}
              onMouseLeave={() => { if (window.matchMedia('(min-width: 1001px)').matches) setOpen(null); }}
            >
              <button
                type="button"
                aria-expanded={open === group.label}
                onClick={() => setOpen(open === group.label ? null : group.label)}
              >
                {group.label}
              </button>
              <div className="nav-menu">
                <Link href={group.href}>
                  {group.label} overview
                </Link>
                {group.items.map((item) => (
                  <Link key={item.href} href={item.href}>
                    {item.label}
                    {item.hint ? <small>{item.hint}</small> : null}
                  </Link>
                ))}
              </div>
            </div>
          ),
        )}

        <div className="nav-cta">
          <Link href="/admissions/apply" className="btn btn-sm btn-ghost">Apply online</Link>
          {portalUrl ? (
            <a href={portalUrl} className="btn btn-sm btn-primary" target={portalUrl.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
              {portalLabel}
            </a>
          ) : (
            <Link href="/admissions/tour" className="btn btn-sm btn-primary">Book a visit</Link>
          )}
        </div>
      </nav>
    </div>
  );
}

/**
 * The way into the admin: "sign in" for a visitor, "dashboard" for a member of staff who is already
 * signed in. Rendered as the sign-in link, then corrected once the session check answers.
 */
export function StaffLink({ className, signInLabel, signedInLabel }: { className?: string; signInLabel: string; signedInLabel: string }) {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let live = true;
    fetch('/admin/session', { cache: 'no-store', credentials: 'same-origin' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { signedIn?: boolean } | null) => { if (live && data?.signedIn) setSignedIn(true); })
      .catch(() => { /* offline or blocked — the sign-in link still works */ });
    return () => { live = false; };
  }, []);

  return (
    <Link href={signedIn ? '/admin' : '/admin/login'} className={className}>
      {signedIn ? signedInLabel : signInLabel}
    </Link>
  );
}

/**
 * Adds `data-scrolled` to the sticky header once the page has moved, which is what turns on its
 * border and shadow. A class rather than inline style so the stylesheet keeps the whole
 * appearance in one place.
 */
export function ScrollWatcher({ target }: { target: string }) {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(target);
    if (!header) return;
    const onScroll = () => header.setAttribute('data-scrolled', String(window.scrollY > 8));
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [target]);
  return null;
}

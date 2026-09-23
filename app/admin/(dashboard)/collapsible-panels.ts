'use client';

import { useEffect, type RefObject } from 'react';

/*
 * Makes every `.panel` with a header collapsible, on every admin screen, without each page having
 * to opt in. The toggle is a real button appended to the header after hydration; the collapsed
 * state lives in a data attribute React does not manage, and is remembered per screen and heading.
 */

const INTERACTIVE = 'a, button, input, select, textarea, label, summary';

const storageKey = (panel: HTMLElement): string | null => {
  const title = panel.querySelector(':scope > header h2')?.textContent?.trim();
  return title ? `admin-panel:${window.location.pathname}:${title}` : null;
};

const remembered = (key: string | null): boolean => {
  if (!key) return false;
  try { return window.localStorage.getItem(key) === '1'; } catch { return false; }
};

const remember = (key: string | null, collapsed: boolean) => {
  if (!key) return;
  try {
    if (collapsed) window.localStorage.setItem(key, '1');
    else window.localStorage.removeItem(key);
  } catch { /* storage unavailable — the panel still toggles, it just is not remembered */ }
};

function setCollapsed(panel: HTMLElement, collapsed: boolean, persist = true) {
  panel.dataset.collapsed = String(collapsed);
  const toggle = panel.querySelector<HTMLButtonElement>(':scope > header > .panel-toggle');
  if (toggle) {
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Expand section' : 'Collapse section');
  }
  if (persist) remember(storageKey(panel), collapsed);
}

function decorate(root: HTMLElement) {
  for (const header of root.querySelectorAll<HTMLElement>('.panel > header')) {
    const panel = header.parentElement!;
    if (panel.children.length < 2 || header.querySelector(':scope > .panel-toggle')) continue;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'panel-toggle';
    toggle.innerHTML = '<span aria-hidden="true"></span>';
    header.appendChild(toggle);
    panel.dataset.collapsible = 'true';
    setCollapsed(panel, remembered(storageKey(panel)), false);
  }
}

export function useCollapsiblePanels(ref: RefObject<HTMLElement | null>, pathname: string) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    decorate(root);
    let frame = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => decorate(root));
    });
    observer.observe(root, { childList: true, subtree: true });

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const header = target.closest<HTMLElement>('.panel[data-collapsible] > header');
      if (!header || !root.contains(header)) return;
      const toggle = target.closest('.panel-toggle');
      // Clicks on the header's own buttons and links do their own job, not a collapse.
      if (!toggle && target.closest(INTERACTIVE)) return;
      const panel = header.parentElement!;
      setCollapsed(panel, panel.dataset.collapsed !== 'true');
    };

    // A required field hidden inside a collapsed panel would block a submit with no visible reason.
    const onInvalid = (event: Event) => {
      const panel = (event.target as HTMLElement).closest<HTMLElement>('.panel[data-collapsed="true"]');
      if (panel) setCollapsed(panel, false);
    };

    root.addEventListener('click', onClick);
    root.addEventListener('invalid', onInvalid, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      root.removeEventListener('click', onClick);
      root.removeEventListener('invalid', onInvalid, true);
    };
  }, [ref, pathname]);
}

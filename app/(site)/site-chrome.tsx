'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/*
 * The small pieces of behaviour the public pages share. All of them degrade to something sensible
 * with JavaScript switched off, and all of them stand still for a visitor whose system asks for
 * reduced motion.
 */

const prefersStill = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Reveals its children once they scroll into view. Content is in the HTML either way — this only
 * animates it — so a crawler, a reader mode and a browser with no JavaScript all see everything.
 */
export function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  /*
   * The class is added to the DOM node directly rather than held in state. Revealing a section is
   * a change to the page, not to anything React needs to know about, and doing it this way means
   * no re-render and no chance of the whole subtree being thrown away and rebuilt.
   *
   * A visitor who asked for reduced motion never reaches this: site.css shows `.reveal` outright
   * under that media query, so the content is visible whatever happens here.
   */
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const show = () => node.classList.add('shown');
    if (prefersStill() || !('IntersectionObserver' in window)) { show(); return; }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) { show(); observer.disconnect(); }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}

/**
 * Counts up to a number when it first comes into view.
 *
 * The finished number is what the server rendered, so it is in the HTML and in the accessibility
 * tree from the start; the animation replaces it for a second and puts it back. A visitor who
 * asked for reduced motion never sees it move.
 */
export function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(value);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || started) return;
    if (prefersStill() || !('IntersectionObserver' in window) || value <= 0) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      setStarted(true);
      const duration = 1100;
      const from = performance.now();
      const step = (stamp: number) => {
        const t = Math.min(1, (stamp - from) / duration);
        // Ease out: fast at first, so the final figure settles rather than crawls.
        setShown(Math.round(value * (1 - (1 - t) ** 3)));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.4 });

    observer.observe(node);
    return () => observer.disconnect();
  }, [value, started]);

  return <b ref={ref}>{shown.toLocaleString('en-GB')}{suffix}</b>;
}

/** The back-to-top button, which appears only once there is something to go back up from. */
export function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 700);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <button
      type="button"
      className="float-btn float-top"
      hidden={!show}
      aria-label="Back to the top of the page"
      onClick={() => window.scrollTo({ top: 0, behavior: prefersStill() ? 'auto' : 'smooth' })}
    >
      ↑
    </button>
  );
}

/**
 * The gallery lightbox. Arrow keys and Escape work, the arrows wrap, and the page behind it stops
 * scrolling while it is open.
 */
export function Lightbox({ photos }: { photos: { url: string; caption: string | null }[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const open = index !== null;

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIndex(null);
      if (e.key === 'ArrowRight') setIndex((i) => (i === null ? null : (i + 1) % photos.length));
      if (e.key === 'ArrowLeft') setIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, photos.length]);

  const current = index === null ? null : photos[index];

  return (
    <>
      <div className="photo-grid">
        {photos.map((photo, i) => (
          <button type="button" key={photo.url + i} className="photo" onClick={() => setIndex(i)} aria-label={photo.caption ?? `Open photograph ${i + 1}`}>
            <img src={photo.url} alt={photo.caption ?? ''} loading="lazy" decoding="async" />
            {photo.caption ? <figcaption>{photo.caption}</figcaption> : null}
          </button>
        ))}
      </div>

      {current ? (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Photograph" onClick={(e) => { if (e.target === e.currentTarget) setIndex(null); }}>
          <button type="button" className="close" onClick={() => setIndex(null)} aria-label="Close">✕</button>
          {photos.length > 1 ? (
            <>
              <button type="button" className="prev" onClick={() => setIndex((i) => (i! - 1 + photos.length) % photos.length)} aria-label="Previous photograph">‹</button>
              <button type="button" className="next" onClick={() => setIndex((i) => (i! + 1) % photos.length)} aria-label="Next photograph">›</button>
            </>
          ) : null}
          <figure style={{ margin: 0 }}>
            <img src={current.url} alt={current.caption ?? ''} />
            <figcaption>{current.caption ?? ''}{photos.length > 1 ? ` · ${index! + 1} of ${photos.length}` : ''}</figcaption>
          </figure>
        </div>
      ) : null}
    </>
  );
}

/**
 * A list that filters itself as you type, used for the news archive and the staff list.
 *
 * Every row is rendered by the server and passed in as children; this only hides the ones that do
 * not match, so the page is complete before JavaScript arrives and search engines see all of it.
 */
export function FilterList({
  label,
  placeholder,
  categories,
  children,
  empty = 'Nothing matches that.',
}: {
  label: string;
  placeholder: string;
  categories?: { value: string; label: string }[];
  children: ReactNode;
  empty?: string;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState<number | null>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-filter]'));
    const needle = query.trim().toLowerCase();
    let count = 0;
    for (const row of rows) {
      const haystack = (row.dataset.filter ?? '').toLowerCase();
      const rowCategory = row.dataset.category ?? '';
      const hit = (!needle || haystack.includes(needle)) && (!category || rowCategory === category);
      row.hidden = !hit;
      if (hit) count += 1;
    }
    setVisible(count);
  }, [query, category, children]);

  return (
    <>
      <div className="form" style={{ marginBottom: 24 }}>
        <div className="row">
          <div>
            <label htmlFor="filter-q">{label}</label>
            <input id="filter-q" type="text" value={query} placeholder={placeholder} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {categories?.length ? (
            <div>
              <label htmlFor="filter-c">Show</label>
              <select id="filter-c" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Everything</option>
                {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          ) : null}
        </div>
      </div>

      <div ref={ref}>{children}</div>

      {visible === 0 ? <div className="callout"><p className="small" style={{ margin: 0 }}>{empty}</p></div> : null}
    </>
  );
}

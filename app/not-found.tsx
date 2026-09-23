import Link from 'next/link';
import './globals.css';

/**
 * The 404. It sits above the (site) route group, so it renders without the school's header and
 * footer — a missing page should not depend on a database query succeeding.
 */
export default function NotFound() {
  return (
    <div
      className="site-theme"
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: '40px 20px',
        textAlign: 'center',
        background: 'var(--surface-soft)',
      }}
    >
      <div style={{ maxWidth: 520 }}>
        <div style={{ fontSize: '4rem', lineHeight: 1 }} aria-hidden="true">🔍</div>
        <h1 style={{ fontFamily: 'var(--font-display-stack)', fontSize: 'clamp(1.8rem, 5vw, 2.6rem)', margin: '18px 0 10px' }}>
          That page is not here
        </h1>
        <p style={{ color: 'var(--muted)', marginBottom: 26 }}>
          The link may be old, or the page may have been renamed. Nothing is lost — these are the ones people usually
          want.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            ['/', 'Home'],
            ['/admissions', 'Admissions'],
            ['/admissions/fees', 'Fees'],
            ['/academics/calendar', 'Term dates'],
            ['/news', 'News'],
            ['/contact', 'Contact'],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              style={{
                padding: '10px 18px',
                borderRadius: 999,
                border: '1.5px solid var(--line-strong)',
                background: 'var(--surface)',
                color: 'var(--ink)',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

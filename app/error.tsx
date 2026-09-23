'use client';

import { useEffect } from 'react';

/*
 * The last resort. It is reached when a page throws — almost always the database being
 * unreachable — so it says something a member of staff can act on, and offers the phone number of
 * the one thing that still works: the office.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[page]', error);
  }, [error]);

  const configuration = /DATABASE_URL|ECONNREFUSED|ETIMEDOUT|relation .* does not exist/i.test(error.message);

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: '40px 20px',
        textAlign: 'center',
        fontFamily: 'var(--font-sans-stack, system-ui, sans-serif)',
        background: '#f6f9fc',
        color: '#16202b',
      }}
    >
      <div style={{ maxWidth: 560 }}>
        <div style={{ fontSize: '3.4rem', lineHeight: 1 }} aria-hidden="true">⚠️</div>
        <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', margin: '16px 0 10px' }}>Something went wrong</h1>
        <p style={{ color: '#64748b', marginBottom: 20 }}>
          {configuration
            ? 'The website cannot reach its database. If you administer this site, check DATABASE_URL and run `npm run db:setup`.'
            : 'This page could not be loaded. It is usually temporary — please try again.'}
        </p>
        {error.digest ? (
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'ui-monospace, monospace' }}>
            Reference {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 14,
            padding: '12px 24px',
            borderRadius: 999,
            border: 0,
            background: '#0f4c81',
            color: '#fff',
            fontWeight: 650,
            fontSize: '0.95rem',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}

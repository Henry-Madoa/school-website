import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSettings } from '@/lib/site.ts';
import { portalUrl } from '@/lib/urls.ts';
import { currentUser } from '@/lib/auth.ts';
import { cdn } from '@/lib/cloudinary.ts';
import { LoginForm } from './login-form.tsx';

// The school's own main block (from its Facebook page), shown behind the sign-in panel.
const LOGIN_BACKGROUND =
  'https://res.cloudinary.com/not5pvxb/image/upload/v1794495125/school-website/admin/login-background.jpg';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [school, user, { next }] = await Promise.all([getSettings(), currentUser(), searchParams]);

  // Somebody already signed in has no business on the sign-in page.
  if (user) redirect('/admin');

  // Only a path within this site, so the parameter cannot be used to bounce anyone elsewhere.
  const destination = next && /^\/admin(\/|$)/.test(next) && !next.startsWith('//') ? next : '/admin';
  const short = school.short_name ?? school.name;
  const portal = portalUrl(school);

  return (
    <div className="admin login-page">
      <img
        className="login-backdrop"
        src={cdn(LOGIN_BACKGROUND, { width: 1920, height: 1200 })}
        alt=""
        fetchPriority="high"
      />

      <main className="login-main">
        <div className="login-card">
          <Link href="/" className="login-brand">
            <span className="mark">
              {school.logo_url
                ? <img src={cdn(school.logo_url, { width: 112, height: 112 })} alt="" />
                : <span aria-hidden="true">{school.crest_emoji ?? '🎓'}</span>}
            </span>
            <span>
              <strong>{short}</strong>
              <small>Website administration</small>
            </span>
          </Link>

          <div className="login-head">
            <span className="login-kicker">Staff area</span>
            <h1>Welcome back</h1>
            <p>
              Sign in to publish notices, events, photographs and term dates.
              {portal ? <> Parents and pupils should use the <a href={portal}>parent portal</a> instead.</> : null}
            </p>
          </div>

          <LoginForm next={destination} />
        </div>

        <Link href="/" className="login-back">← Back to the website</Link>
        <p className="login-foot">
          © {new Date().getFullYear()} {school.name}
          {school.motto ? <> · <em>{school.motto}</em></> : null}
        </p>
      </main>
    </div>
  );
}

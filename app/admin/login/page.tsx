import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSettings } from '@/lib/site.ts';
import { currentUser } from '@/lib/auth.ts';
import { cdn } from '@/lib/cloudinary.ts';
import { LoginForm } from './login-form.tsx';

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
  const portal = school.portal_url ?? process.env.NEXT_PUBLIC_PORTAL_URL ?? '/portal';

  const brand = (className: string) => (
    <Link href="/" className={className}>
      <span className="mark">
        {school.logo_url
          ? <img src={cdn(school.logo_url, { width: 96, height: 96 })} alt="" />
          : <span aria-hidden="true">{school.crest_emoji ?? '🎓'}</span>}
      </span>
      <span>
        <strong>{short}</strong>
        <small>Website administration</small>
      </span>
    </Link>
  );

  return (
    <div className="admin login-page">
      <aside className="login-aside">
        {brand('login-brand')}

        <div className="login-aside-body">
          <span className="login-kicker">Staff area</span>
          <h2>Welcome back to {short}</h2>
          {school.motto ? <p className="login-motto">&ldquo;{school.motto}&rdquo;</p> : null}
          <p>
            Keep families informed. Publish notices, events, photographs, staff profiles, fees and term dates
            from one place.
          </p>
          <ul>
            <li>Publish a notice and it goes live on the site straight away</li>
            <li>Permission Sets decide which screens each person may open</li>
            <li>Every change is recorded with the name of the person who made it</li>
            <li>No pupil records, marks or fee balances are stored here</li>
          </ul>
        </div>

        <p className="login-aside-foot">
          © {new Date().getFullYear()} {school.name}
          {school.phone_primary ? ` · ${school.phone_primary}` : ''}
        </p>
      </aside>

      <main className="login-main">
        <div className="login-card">
          {brand('login-brand login-brand-mobile')}

          <div className="login-head">
            <h1>Sign in</h1>
            <p>
              For staff who edit the website. Parents and pupils should use the <a href={portal}>parent portal</a> instead.
            </p>
          </div>

          <LoginForm next={destination} />
        </div>

        <Link href="/" className="login-back">← Back to the website</Link>
      </main>
    </div>
  );
}

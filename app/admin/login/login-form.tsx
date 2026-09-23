'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { signInAction } from '@/app/actions/auth.ts';

/**
 * The sign-in form.
 *
 * It says the same thing whether the address is unknown or the password is wrong, because a form
 * that distinguishes the two is a way of finding out which addresses are real. The rate limit in
 * lib/auth.ts is what actually slows an attacker down; this only avoids helping them.
 */
export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await signInAction(new FormData(event.currentTarget));
      if (!result.ok) { setError(result.error); setBusy(false); return; }
      // A refresh as well as a push: the layout above reads the session, and without it the
      // sidebar would render for the previous (signed-out) state.
      router.replace(result.data.mustChangePassword ? '/admin/profile?password=required' : next);
      router.refresh();
    } catch {
      setError('We could not sign you in just now. Please try again.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="login-fields">
      {error ? <div className="note note-bad" role="alert">{error}</div> : null}

      <div className="field">
        <label htmlFor="email">Email address</label>
        <input id="email" name="email" type="email" required autoComplete="username" autoFocus placeholder="you@school.ac.ke" />
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <div className="password-wrap">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            placeholder="Your password"
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="login-help">
        Forgotten your password? An administrator can reset it for you — this site deliberately has no self-service
        reset, because an email inbox is not proof of anything.
      </p>
    </form>
  );
}

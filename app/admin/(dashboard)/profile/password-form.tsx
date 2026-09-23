'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { changePasswordAction } from '@/app/actions/auth.ts';
import type { ActionResult } from '@/lib/types.ts';

/*
 * Changing your own password.
 *
 * It ends every session for this account, including the one doing the changing — which is the
 * point: the commonest reason to change a password is suspecting somebody else has it, and a
 * change that leaves the old sessions alive has changed nothing. So on success the form says so
 * and sends the person back to the sign-in page rather than pretending nothing happened.
 */

const initial: ActionResult<{ ok: true }> | null = null;

export function PasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [state, dispatch] = useActionState(
    async (_prev: ActionResult<{ ok: true }> | null, form: FormData) => changePasswordAction(form),
    initial,
  );

  useEffect(() => {
    if (!state?.ok) return;
    const timer = setTimeout(() => {
      router.replace('/admin/login');
      router.refresh();
    }, 2200);
    return () => clearTimeout(timer);
  }, [state, router]);

  return (
    <form action={dispatch}>
      <div className="panel">
        <header>
          <div>
            <h2>{forced ? 'Choose your own password' : 'Change your password'}</h2>
            <p>At least 10 characters. Changing it signs you out on every device.</p>
          </div>
          <span style={{ flex: 1 }} />
          <SaveButton />
        </header>
        <div className="body">
          {state && !state.ok ? <div className="note note-bad" role="alert">{state.error}</div> : null}
          {state?.ok ? (
            <div className="note note-ok" role="status">
              Password changed. You are being signed out — sign in again with the new one.
            </div>
          ) : null}

          <div className="grid-3">
            <div className="field">
              <label htmlFor="current">Current password</label>
              <input id="current" name="current" type="password" required autoComplete="current-password" />
            </div>
            <div className="field">
              <label htmlFor="password">New password</label>
              <input id="password" name="password" type="password" required minLength={10} maxLength={72} autoComplete="new-password" />
            </div>
            <div className="field">
              <label htmlFor="confirm">New password again</label>
              <input id="confirm" name="confirm" type="password" required minLength={10} maxLength={72} autoComplete="new-password" />
            </div>
          </div>

          <p className="help">
            There is no self-service reset on this site: an email inbox is not proof of anything, and a school admin
            with five accounts does not need one. If you forget it, a System Administrator sets a new one.
          </p>
        </div>
      </div>
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? 'Changing…' : 'Change password'}
    </button>
  );
}

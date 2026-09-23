'use server';

/*
 * Signing in and out, and changing your own password.
 *
 * Kept apart from app/actions/security.ts, which is about other people's accounts: these three
 * are the only actions a signed-out or newly-created user may reach, and the separation makes
 * that obvious at the import.
 */
import { redirect } from 'next/navigation';
import { actionResult } from '@/lib/errors.ts';
import { signIn, signOut, changeOwnPassword, currentUser, hashPassword } from '@/lib/auth.ts';
import * as v from '@/lib/validate.ts';
import { AppError } from '@/lib/errors.ts';
import type { ActionResult } from '@/lib/types.ts';

export async function signInAction(formData: FormData): Promise<ActionResult<{ mustChangePassword: boolean }>> {
  return actionResult(async () => {
    const user = await signIn(String(formData.get('email') ?? ''), String(formData.get('password') ?? ''));
    return { mustChangePassword: user.must_change_password };
  });
}

export async function signOutAction(): Promise<void> {
  await signOut();
  redirect('/admin/login');
}

export async function changePasswordAction(formData: FormData): Promise<ActionResult<{ ok: true }>> {
  return actionResult(async () => {
    const user = await currentUser();
    if (!user) throw new AppError('Your session has expired. Please sign in again.', 'FORBIDDEN');

    const next = v.password(formData.get('password'));
    if (next !== String(formData.get('confirm') ?? '')) {
      throw new AppError('The two new passwords do not match.', 'VALIDATION');
    }
    await changeOwnPassword(user.id, String(formData.get('current') ?? ''), await hashPassword(next));
    // changeOwnPassword ends every session, including this one, so the caller must sign in again.
    return { ok: true as const };
  });
}

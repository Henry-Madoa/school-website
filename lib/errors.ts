/*
 * One error type and one wrapper.
 *
 * A Server Action never throws across the network if it can help it: React would surface a
 * generic "an error occurred" and the parent filling the form would learn nothing. Instead every
 * action returns `{ ok, data } | { ok, error }`, and `actionResult` is what turns a thrown
 * AppError into the second shape while keeping unexpected errors off the wire.
 */
import type { ActionResult } from './types.ts';

export type ErrorKind = 'VALIDATION' | 'NOT_FOUND' | 'FORBIDDEN' | 'RATE_LIMITED' | 'CONFLICT' | 'CONFIG';

export class AppError extends Error {
  readonly kind: ErrorKind;
  constructor(message: string, kind: ErrorKind = 'VALIDATION') {
    super(message);
    this.name = 'AppError';
    this.kind = kind;
  }
}

export async function actionResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, error: error.message };
    // Anything else is a bug or an outage. Log it where the operator can see it; tell the
    // visitor something true and useful instead of a stack trace.
    console.error('[action]', error);
    return { ok: false, error: 'Something went wrong on our side. Please try again, or call the school office.' };
  }
}

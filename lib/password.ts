/*
 * Password hashing, alone in its own module.
 *
 * lib/auth.ts pulls in `next/headers` and `next/navigation`, which only exist inside a request.
 * The seed script has to hash the first administrator's password and runs under plain Node with
 * no request at all — so the hashing lives here, where both can import it.
 */
import bcrypt from 'bcryptjs';
import { AppError } from './errors.ts';

const ROUNDS = 12;

/**
 * A hash bcrypt's `compare` can check later. The 72-byte truncation is bcrypt's, not ours: a
 * longer password would silently have its tail ignored, so it is rejected instead.
 */
export function hashPassword(plain: string): Promise<string> {
  if (Buffer.byteLength(String(plain), 'utf8') > 72) {
    throw new AppError('That password is too long — 72 bytes is bcrypt’s limit', 'VALIDATION');
  }
  return bcrypt.hash(String(plain), ROUNDS);
}

/**
 * A hash of a password nobody has, used when the account does not exist — so a wrong address and
 * a wrong password take the same time to answer and the sign-in form cannot be used to discover
 * which addresses are real.
 */
export const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO1rQjwZ8YgqE0m6uZ1Vh5bZ8ZcZ3OqHy';

export const verifyPassword = (plain: string, hash: string | null): Promise<boolean> =>
  bcrypt.compare(String(plain ?? ''), hash ?? DUMMY_HASH);

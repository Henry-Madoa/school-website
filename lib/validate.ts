/*
 * Input cleaning and the handful of format rules the site actually enforces.
 *
 * Everything a visitor or an editor types passes through `text()` first: it trims, collapses
 * runs of whitespace, strips control characters and caps the length. A field that reaches the
 * database is therefore always a string of known shape, which is most of what SQL injection and
 * layout-breaking paste-bombs need to be stopped.
 */
import { AppError } from './errors.ts';

/** Trim, collapse whitespace, strip control characters, cap length. Empty becomes null. */
export function text(value: unknown, max = 500): string | null {
  const cleaned = String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

/** The same, but keeps paragraph breaks — for a body of prose. */
export function richText(value: unknown, max = 20_000): string | null {
  const cleaned = String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

/** A required field: same cleaning, but a missing value is an error the visitor can read. */
export function required(value: unknown, label: string, max = 500): string {
  const cleaned = text(value, max);
  if (!cleaned) throw new AppError(`${label} is required`, 'VALIDATION');
  return cleaned;
}

export function number(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** An integer inside a range, clamped rather than rejected — a slider, a guest count, a sort order. */
export function integer(value: unknown, min: number, max: number, fallback: number | null = null): number | null {
  const n = number(value);
  if (n === null) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** A "1,500" or "1500.00" money field from a form → cents. */
export function money(value: unknown): number {
  const n = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export const boolean = (value: unknown): boolean =>
  value === true || value === 'true' || value === 'on' || value === '1' || value === 1;

const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
/** Kenyan mobiles (07…, 01…, +2547…) and ordinary landlines, permissively. */
const PHONE = /^\+?\d[\d\s-]{6,19}$/;

export function email(value: unknown, label = 'Email'): string | null {
  const cleaned = text(value, 160);
  if (!cleaned) return null;
  if (!EMAIL.test(cleaned)) throw new AppError(`${label} does not look like an email address`, 'VALIDATION');
  return cleaned.toLowerCase();
}

export function phone(value: unknown, label = 'Phone number'): string | null {
  const cleaned = text(value, 30);
  if (!cleaned) return null;
  if (!PHONE.test(cleaned)) throw new AppError(`${label} does not look like a phone number`, 'VALIDATION');
  return cleaned;
}

export function isoDate(value: unknown, label = 'Date'): string | null {
  const cleaned = text(value, 10);
  if (!cleaned) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned) || Number.isNaN(Date.parse(cleaned))) {
    throw new AppError(`${label} is not a valid date`, 'VALIDATION');
  }
  return cleaned;
}

/** A `datetime-local` value ("2026-01-06T14:30") or a full ISO stamp → ISO with a zone. */
export function isoDateTime(value: unknown, label = 'Date and time'): string | null {
  const cleaned = text(value, 40);
  if (!cleaned) return null;
  const parsed = new Date(cleaned.length === 16 ? `${cleaned}:00Z` : cleaned);
  if (Number.isNaN(parsed.getTime())) throw new AppError(`${label} is not a valid date and time`, 'VALIDATION');
  return parsed.toISOString();
}

/** A value that must be one of a fixed set — a status, a category, a role. */
export function choice<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  const cleaned = String(value ?? '').trim().toUpperCase() as T;
  if (!allowed.includes(cleaned)) throw new AppError(`Choose a valid ${label.toLowerCase()}`, 'VALIDATION');
  return cleaned;
}

/** A URL we are willing to render in an <img> or an <a>. Blocks javascript: and data: payloads. */
export function url(value: unknown, label = 'Link'): string | null {
  const cleaned = text(value, 600);
  if (!cleaned) return null;
  if (!/^https?:\/\//i.test(cleaned)) throw new AppError(`${label} must start with http:// or https://`, 'VALIDATION');
  return cleaned;
}

/** Passwords: long enough to matter, short enough that bcrypt's 72-byte limit is never hit silently. */
export function password(value: unknown): string {
  const raw = String(value ?? '');
  if (raw.length < 10) throw new AppError('Choose a password of at least 10 characters', 'VALIDATION');
  if (Buffer.byteLength(raw, 'utf8') > 72) throw new AppError('That password is too long — 72 bytes is the limit', 'VALIDATION');
  return raw;
}

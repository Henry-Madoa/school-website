/*
 * Client-safe Cloudinary helpers: URL building only, no SDK and no secrets.
 *
 * The cloud name is not needed here — every stored image is already a full Cloudinary URL, and
 * the transformation is spliced into the one it came with. That is what makes these functions
 * safe to run in a browser bundle.
 */

const CLOUDINARY_IMAGE = /^https?:\/\/res\.cloudinary\.com\/([^/]+)\/image\/upload\/(.*)$/;

/**
 * Asks Cloudinary for the size actually needed, in whatever format the visitor's browser prefers.
 * Most of this site is read on a phone over a weak connection, and serving a 3 MB photograph
 * straight off a teacher's camera is the single easiest way to make it feel broken.
 *
 * A URL that is not a Cloudinary upload (a seeded Unsplash photo, say) is returned untouched.
 */
export function cdn(url: string | null | undefined, opts: { width?: number; height?: number; crop?: 'fill' | 'fit' } = {}): string {
  const value = String(url ?? '');
  const match = value.match(CLOUDINARY_IMAGE);
  if (!match) return value;

  const [, cloud, rest] = match;
  // Skip a transformation that is already there, so the function is safe to apply twice.
  const path = rest!.replace(/^[a-z]_[^/]*\//, '');
  const parts = ['f_auto', 'q_auto'];
  if (opts.width) parts.push(`w_${Math.round(opts.width)}`);
  if (opts.height) parts.push(`h_${Math.round(opts.height)}`);
  if (opts.width || opts.height) parts.push(`c_${opts.crop ?? 'fill'}`, 'g_auto');
  return `https://res.cloudinary.com/${cloud}/image/upload/${parts.join(',')}/${path}`;
}

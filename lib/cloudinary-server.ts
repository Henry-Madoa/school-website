import 'server-only';

/*
 * Uploading to Cloudinary. Imported only from Server Actions, so the SDK and the API secret never
 * reach a browser bundle.
 *
 * Every image the school publishes goes through here, which is the one place that decides what is
 * acceptable: a real image, under the size limit, stored in a folder named after what it is for.
 * Cloudinary does the rest — format negotiation, resizing and the CDN — so nothing in this
 * application has to store or serve a binary.
 */
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { AppError } from './errors.ts';

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB — a photograph straight off a phone.
const ROOT_FOLDER = process.env.CLOUDINARY_FOLDER ?? 'school-website';

let configured = false;

function configure(): void {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME ?? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret) {
    throw new AppError(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env.local.',
      'CONFIG',
    );
  }
  if (!configured) {
    cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
    configured = true;
  }
}

/** True when uploads will work — so a form can say so rather than failing at the last step. */
export const cloudinaryReady = (): boolean =>
  !!(process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET &&
    (process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME));

export interface Uploaded {
  url: string;
  publicId: string;
  width: number;
  height: number;
  bytes: number;
}

/**
 * Uploads one image from a Server Action's FormData.
 *
 * Returns undefined when the field was left empty, so a caller can leave an existing photograph
 * alone: `image_url: (await uploadImage(form.get('image'), 'staff'))?.url ?? existing.image_url`.
 */
export async function uploadImage(entry: FormDataEntryValue | null | undefined, folder = 'general'): Promise<Uploaded | undefined> {
  if (!entry || typeof entry === 'string') return undefined;
  const file = entry as File;
  if (file.size === 0) return undefined;
  if (!file.type.startsWith('image/')) throw new AppError('That file is not an image. Upload a JPEG, PNG or WebP.', 'VALIDATION');
  if (file.size > MAX_BYTES) throw new AppError(`That image is ${(file.size / 1_048_576).toFixed(1)} MB. Please upload one under 8 MB.`, 'VALIDATION');

  configure();
  const bytes = Buffer.from(await file.arrayBuffer());

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: `${ROOT_FOLDER}/${folder}`,
          resource_type: 'image',
          // Nothing the school publishes needs to be larger than this, and the originals off a
          // camera are frequently ten times it.
          transformation: [{ width: 2400, height: 2400, crop: 'limit' }, { quality: 'auto', fetch_format: 'auto' }],
        },
        (error, uploaded) => {
          if (error || !uploaded) return reject(new AppError(error?.message ?? 'The upload failed. Please try again.', 'CONFIG'));
          resolve(uploaded);
        },
      )
      .end(bytes);
  });

  return { url: result.secure_url, publicId: result.public_id, width: result.width, height: result.height, bytes: result.bytes };
}

/** Several images at once — the gallery uploader posts a whole album in one go. */
export async function uploadImages(entries: FormDataEntryValue[], folder = 'gallery'): Promise<Uploaded[]> {
  const files = entries.filter((e): e is File => typeof e !== 'string' && !!e && (e as File).size > 0);
  if (!files.length) return [];
  // Sequential on purpose: a teacher adding thirty photographs from a school event on a domestic
  // connection is better served by a queue than by thirty parallel uploads fighting for it.
  const out: Uploaded[] = [];
  for (const file of files) {
    const uploaded = await uploadImage(file, folder);
    if (uploaded) out.push(uploaded);
  }
  return out;
}

/** Removes an image from Cloudinary. A failure here is logged, never surfaced: the row is gone. */
export async function deleteImage(url: string | null | undefined): Promise<void> {
  const publicId = publicIdFromUrl(url);
  if (!publicId) return;
  try {
    configure();
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('[cloudinary] could not delete', publicId, error);
  }
}

/** ".../upload/v1712345678/school-website/staff/abc123.jpg" → "school-website/staff/abc123" */
export function publicIdFromUrl(url: string | null | undefined): string | null {
  const match = String(url ?? '').match(/\/image\/upload\/(?:[^/]+\/)*?v\d+\/(.+)\.[a-z0-9]+$/i);
  return match?.[1] ?? null;
}

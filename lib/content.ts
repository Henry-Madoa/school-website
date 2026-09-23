import 'server-only';

/*
 * The content the admin manages: notices and news, events, gallery albums, staff, testimonials,
 * questions, the academic structure, term dates, fee lines and bus routes.
 *
 * Reads here differ from lib/site.ts in one way that matters: they return drafts too, because an
 * editor has to be able to see the thing they have not published yet. Every write validates its
 * input, stamps an audit row and drops the caches of the public pages it affects — a notice saved
 * in the admin is live on the website by the time the editor's redirect lands.
 */
import { revalidatePath } from 'next/cache';
import { all, one, run, audit, type Actor } from './db.ts';
import { AppError } from './errors.ts';
import { uniqueSlug } from './slugify.ts';
import { deleteImage } from './cloudinary-server.ts';
import * as v from './validate.ts';
import {
  APPLICATION_STATUSES, ENQUIRY_STATUSES, FAQ_CATEGORIES, POST_CATEGORIES, EVENT_CATEGORIES,
  STAFF_CATEGORIES,
  type Album, type AlbumView, type AuditEntry, type EventView, type Faq, type Fee, type Grade,
  type LevelView, type Photo, type Post, type RouteView, type Settings, type Staff, type Stop,
  type Subject, type Term, type Testimonial,
} from './types.ts';

/* ------------------------------------------------------------------ cache reset */

/**
 * Drops the rendered public pages a change affects. Called at the end of every write — the cost
 * of forgetting is an editor who publishes a notice, looks at the website, sees nothing, and
 * publishes it twice.
 */
export function revalidateSite(...paths: string[]): void {
  for (const path of ['/', ...paths]) revalidatePath(path);
}

const now = (): string => new Date().toISOString();

/* ========================================================================= posts */

export const adminPosts = (search = '', category = ''): Promise<Post[]> =>
  all<Post>(
    `SELECT * FROM web_post
     WHERE (title ILIKE @like OR body ILIKE @like)
       ${category ? 'AND category = @category' : ''}
     ORDER BY is_pinned DESC, published_at DESC LIMIT 300`,
    { like: `%${search.trim()}%`, category: category || null },
  );

export const adminPost = (id: number): Promise<Post | undefined> => one<Post>('SELECT * FROM web_post WHERE id = ?', id);

export interface PostInput {
  title: unknown; category: unknown; excerpt: unknown; body: unknown;
  imageUrl?: string | null; attachmentUrl?: unknown;
  isPublished: unknown; isPinned: unknown; publishedAt: unknown; expiresAt: unknown;
}

function readPost(input: PostInput) {
  return {
    title: v.required(input.title, 'A title', 200),
    category: v.choice(input.category, POST_CATEGORIES.map((c) => c.value), 'category'),
    excerpt: v.text(input.excerpt, 300),
    body: v.richText(input.body, 20_000) ?? '',
    attachment_url: v.url(input.attachmentUrl, 'The attachment link'),
    is_published: v.boolean(input.isPublished),
    is_pinned: v.boolean(input.isPinned),
    published_at: v.isoDateTime(input.publishedAt, 'The publish date') ?? now(),
    expires_at: v.isoDateTime(input.expiresAt, 'The expiry date'),
  };
}

export async function createPost(input: PostInput, actor: Actor): Promise<number> {
  const row = readPost(input);
  if (!row.body) throw new AppError('A notice needs some text', 'VALIDATION');
  const slug = await uniqueSlug('web_post', row.title);
  const { id } = await run(
    `INSERT INTO web_post (title, slug, category, excerpt, body, image_url, attachment_url, is_published, is_pinned, published_at, expires_at, author, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    row.title, slug, row.category, row.excerpt, row.body, input.imageUrl ?? null, row.attachment_url,
    row.is_published, row.is_pinned, row.published_at, row.expires_at, actor.name, now(),
  );
  await audit(actor, 'POST_CREATE', 'web_post', id, { title: row.title, published: row.is_published });
  revalidateSite('/news', `/news/${slug}`);
  return id;
}

export async function updatePost(id: number, input: PostInput, actor: Actor): Promise<void> {
  const before = await adminPost(id);
  if (!before) throw new AppError('That notice no longer exists', 'NOT_FOUND');
  const row = readPost(input);
  if (!row.body) throw new AppError('A notice needs some text', 'VALIDATION');
  // The slug is part of a link a parent may already have; it only changes when the title does.
  const slug = row.title === before.title ? before.slug : await uniqueSlug('web_post', row.title, id);
  await run(
    `UPDATE web_post SET title=?, slug=?, category=?, excerpt=?, body=?, image_url=?, attachment_url=?,
            is_published=?, is_pinned=?, published_at=?, expires_at=?, updated_at=? WHERE id=?`,
    row.title, slug, row.category, row.excerpt, row.body, input.imageUrl ?? before.image_url, row.attachment_url,
    row.is_published, row.is_pinned, row.published_at, row.expires_at, now(), id,
  );
  await audit(actor, 'POST_UPDATE', 'web_post', id, { title: row.title, published: row.is_published });
  revalidateSite('/news', `/news/${slug}`, `/news/${before.slug}`);
}

export async function deletePost(id: number, actor: Actor): Promise<void> {
  const before = await adminPost(id);
  if (!before) return;
  await run('DELETE FROM web_post WHERE id = ?', id);
  await deleteImage(before.image_url);
  await audit(actor, 'POST_DELETE', 'web_post', id, { title: before.title });
  revalidateSite('/news', `/news/${before.slug}`);
}

/** The one-click toggle on the list — the commonest edit of all. */
export async function togglePost(id: number, field: 'is_published' | 'is_pinned', actor: Actor): Promise<void> {
  const { rowCount } = await run(`UPDATE web_post SET ${field} = NOT ${field}, updated_at = ? WHERE id = ?`, now(), id);
  if (!rowCount) throw new AppError('That notice no longer exists', 'NOT_FOUND');
  await audit(actor, 'POST_TOGGLE', 'web_post', id, { field });
  revalidateSite('/news');
}

/* ======================================================================== events */

export const adminEvents = (search = ''): Promise<EventView[]> =>
  all<EventView>(
    `SELECT e.*,
            COALESCE((SELECT COUNT(*)::int FROM web_rsvp r WHERE r.event_id = e.id), 0) AS rsvp_count,
            COALESCE((SELECT SUM(r.guests)::int FROM web_rsvp r WHERE r.event_id = e.id), 0) AS rsvp_guests
     FROM web_event e
     WHERE (e.title ILIKE @like OR COALESCE(e.summary,'') ILIKE @like)
     ORDER BY e.starts_at DESC LIMIT 300`,
    { like: `%${search.trim()}%` },
  );

export const adminEvent = (id: number): Promise<EventView | undefined> =>
  one<EventView>(
    `SELECT e.*,
            COALESCE((SELECT COUNT(*)::int FROM web_rsvp r WHERE r.event_id = e.id), 0) AS rsvp_count,
            COALESCE((SELECT SUM(r.guests)::int FROM web_rsvp r WHERE r.event_id = e.id), 0) AS rsvp_guests
     FROM web_event e WHERE e.id = ?`,
    id,
  );

export interface EventInput {
  title: unknown; category: unknown; summary: unknown; body: unknown; location: unknown;
  startsAt: unknown; endsAt: unknown; allDay: unknown;
  imageUrl?: string | null; isPublished: unknown; rsvpEnabled: unknown; capacity: unknown;
}

function readEvent(input: EventInput) {
  const starts = v.isoDateTime(input.startsAt, 'The start');
  if (!starts) throw new AppError('When does it start?', 'VALIDATION');
  const ends = v.isoDateTime(input.endsAt, 'The end');
  if (ends && ends < starts) throw new AppError('The event cannot end before it starts', 'VALIDATION');
  return {
    title: v.required(input.title, 'A title', 200),
    category: v.choice(input.category, EVENT_CATEGORIES.map((c) => c.value), 'category'),
    summary: v.text(input.summary, 300),
    body: v.richText(input.body, 12_000),
    location: v.text(input.location, 200),
    starts_at: starts,
    ends_at: ends,
    all_day: v.boolean(input.allDay),
    is_published: v.boolean(input.isPublished),
    rsvp_enabled: v.boolean(input.rsvpEnabled),
    capacity: v.integer(input.capacity, 1, 100_000),
  };
}

export async function createEvent(input: EventInput, actor: Actor): Promise<number> {
  const row = readEvent(input);
  const slug = await uniqueSlug('web_event', row.title);
  const { id } = await run(
    `INSERT INTO web_event (title, slug, summary, body, image_url, category, location, starts_at, ends_at, all_day, is_published, rsvp_enabled, capacity, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    row.title, slug, row.summary, row.body, input.imageUrl ?? null, row.category, row.location,
    row.starts_at, row.ends_at, row.all_day, row.is_published, row.rsvp_enabled, row.capacity, now(),
  );
  await audit(actor, 'EVENT_CREATE', 'web_event', id, { title: row.title });
  revalidateSite('/events', `/events/${slug}`, '/academics/calendar');
  return id;
}

export async function updateEvent(id: number, input: EventInput, actor: Actor): Promise<void> {
  const before = await adminEvent(id);
  if (!before) throw new AppError('That event no longer exists', 'NOT_FOUND');
  const row = readEvent(input);
  const slug = row.title === before.title ? before.slug : await uniqueSlug('web_event', row.title, id);
  await run(
    `UPDATE web_event SET title=?, slug=?, summary=?, body=?, image_url=?, category=?, location=?,
            starts_at=?, ends_at=?, all_day=?, is_published=?, rsvp_enabled=?, capacity=?, updated_at=? WHERE id=?`,
    row.title, slug, row.summary, row.body, input.imageUrl ?? before.image_url, row.category, row.location,
    row.starts_at, row.ends_at, row.all_day, row.is_published, row.rsvp_enabled, row.capacity, now(), id,
  );
  await audit(actor, 'EVENT_UPDATE', 'web_event', id, { title: row.title });
  revalidateSite('/events', `/events/${slug}`, `/events/${before.slug}`, '/academics/calendar');
}

export async function deleteEvent(id: number, actor: Actor): Promise<void> {
  const before = await adminEvent(id);
  if (!before) return;
  await run('DELETE FROM web_event WHERE id = ?', id);
  await deleteImage(before.image_url);
  await audit(actor, 'EVENT_DELETE', 'web_event', id, { title: before.title });
  revalidateSite('/events', `/events/${before.slug}`);
}

export async function toggleEvent(id: number, field: 'is_published' | 'rsvp_enabled', actor: Actor): Promise<void> {
  const { rowCount } = await run(`UPDATE web_event SET ${field} = NOT ${field}, updated_at = ? WHERE id = ?`, now(), id);
  if (!rowCount) throw new AppError('That event no longer exists', 'NOT_FOUND');
  await audit(actor, 'EVENT_TOGGLE', 'web_event', id, { field });
  revalidateSite('/events');
}

/* ======================================================================= gallery */

export async function adminAlbums(): Promise<AlbumView[]> {
  const [albums, photos] = await Promise.all([
    all<Album>('SELECT * FROM web_album ORDER BY sort, taken_on DESC NULLS LAST, id DESC'),
    all<Photo>('SELECT * FROM web_photo ORDER BY sort, id'),
  ]);
  return albums.map((album) => {
    const own = photos.filter((p) => p.album_id === album.id);
    return { ...album, photos: own, photo_count: own.length };
  });
}

export async function adminAlbum(id: number): Promise<AlbumView | undefined> {
  const album = await one<Album>('SELECT * FROM web_album WHERE id = ?', id);
  if (!album) return undefined;
  const photos = await all<Photo>('SELECT * FROM web_photo WHERE album_id = ? ORDER BY sort, id', id);
  return { ...album, photos, photo_count: photos.length };
}

export interface AlbumInput { title: unknown; description: unknown; takenOn: unknown; isPublished: unknown; sort: unknown; coverUrl?: string | null }

export async function createAlbum(input: AlbumInput, actor: Actor): Promise<number> {
  const title = v.required(input.title, 'A title', 160);
  const slug = await uniqueSlug('web_album', title);
  const { id } = await run(
    'INSERT INTO web_album (title, slug, description, cover_url, taken_on, sort, is_published, created_at) VALUES (?,?,?,?,?,?,?,?)',
    title, slug, v.text(input.description, 600), input.coverUrl ?? null, v.isoDate(input.takenOn, 'The date'),
    v.integer(input.sort, 0, 9999, 0), v.boolean(input.isPublished), now(),
  );
  await audit(actor, 'ALBUM_CREATE', 'web_album', id, { title });
  revalidateSite('/gallery');
  return id;
}

export async function updateAlbum(id: number, input: AlbumInput, actor: Actor): Promise<void> {
  const before = await one<Album>('SELECT * FROM web_album WHERE id = ?', id);
  if (!before) throw new AppError('That album no longer exists', 'NOT_FOUND');
  const title = v.required(input.title, 'A title', 160);
  const slug = title === before.title ? before.slug : await uniqueSlug('web_album', title, id);
  await run(
    'UPDATE web_album SET title=?, slug=?, description=?, cover_url=?, taken_on=?, sort=?, is_published=? WHERE id=?',
    title, slug, v.text(input.description, 600), input.coverUrl ?? before.cover_url, v.isoDate(input.takenOn, 'The date'),
    v.integer(input.sort, 0, 9999, 0), v.boolean(input.isPublished), id,
  );
  await audit(actor, 'ALBUM_UPDATE', 'web_album', id, { title });
  revalidateSite('/gallery', `/gallery/${slug}`, `/gallery/${before.slug}`);
}

export async function deleteAlbum(id: number, actor: Actor): Promise<void> {
  const album = await adminAlbum(id);
  if (!album) return;
  await run('DELETE FROM web_album WHERE id = ?', id);
  // The rows went with the cascade; the images have to be asked for individually.
  for (const photo of album.photos) await deleteImage(photo.url);
  await audit(actor, 'ALBUM_DELETE', 'web_album', id, { title: album.title, photos: album.photos.length });
  revalidateSite('/gallery');
}

export async function addPhotos(albumId: number, photos: { url: string; caption?: string | null }[], actor: Actor): Promise<number> {
  if (!photos.length) return 0;
  const album = await one<Album>('SELECT * FROM web_album WHERE id = ?', albumId);
  if (!album) throw new AppError('That album no longer exists', 'NOT_FOUND');
  const startAt = Number(await one<{ next: number }>('SELECT COALESCE(MAX(sort), 0) + 1 AS next FROM web_photo WHERE album_id = ?', albumId).then((r) => r?.next ?? 1));
  for (const [index, photo] of photos.entries()) {
    await run('INSERT INTO web_photo (album_id, url, caption, sort) VALUES (?,?,?,?)', albumId, photo.url, v.text(photo.caption, 200), startAt + index);
  }
  if (!album.cover_url) await run('UPDATE web_album SET cover_url = ? WHERE id = ?', photos[0]!.url, albumId);
  await audit(actor, 'PHOTOS_ADD', 'web_album', albumId, { count: photos.length });
  revalidateSite('/gallery', `/gallery/${album.slug}`);
  return photos.length;
}

export async function deletePhoto(id: number, actor: Actor): Promise<number> {
  const photo = await one<Photo>('SELECT * FROM web_photo WHERE id = ?', id);
  if (!photo) throw new AppError('That photograph has already been removed', 'NOT_FOUND');
  await run('DELETE FROM web_photo WHERE id = ?', id);
  await run('UPDATE web_album SET cover_url = NULL WHERE id = ? AND cover_url = ?', photo.album_id, photo.url);
  await deleteImage(photo.url);
  await audit(actor, 'PHOTO_DELETE', 'web_photo', id, { album: photo.album_id });
  revalidateSite('/gallery');
  return photo.album_id;
}

export async function setPhotoCaption(id: number, caption: unknown, actor: Actor): Promise<void> {
  await run('UPDATE web_photo SET caption = ? WHERE id = ?', v.text(caption, 200), id);
  await audit(actor, 'PHOTO_CAPTION', 'web_photo', id, {});
  revalidateSite('/gallery');
}

/* ========================================================================= staff */

export const adminStaff = (): Promise<Staff[]> => all<Staff>('SELECT * FROM web_staff ORDER BY sort, name');
export const adminStaffMember = (id: number): Promise<Staff | undefined> => one<Staff>('SELECT * FROM web_staff WHERE id = ?', id);

export interface StaffInput {
  name: unknown; roleTitle: unknown; category: unknown; qualification: unknown; bio: unknown;
  email: unknown; sort: unknown; isPublished: unknown; photoUrl?: string | null;
}

function readStaff(input: StaffInput) {
  return {
    name: v.required(input.name, 'A name', 120),
    role_title: v.required(input.roleTitle, 'A role', 120),
    category: v.choice(input.category, STAFF_CATEGORIES.map((c) => c.value), 'category'),
    qualification: v.text(input.qualification, 200),
    bio: v.richText(input.bio, 3_000),
    email: v.email(input.email),
    sort: v.integer(input.sort, 0, 9999, 0) ?? 0,
    is_published: v.boolean(input.isPublished),
  };
}

export async function createStaff(input: StaffInput, actor: Actor): Promise<number> {
  const row = readStaff(input);
  const { id } = await run(
    'INSERT INTO web_staff (name, role_title, category, qualification, bio, photo_url, email, sort, is_published) VALUES (?,?,?,?,?,?,?,?,?)',
    row.name, row.role_title, row.category, row.qualification, row.bio, input.photoUrl ?? null, row.email, row.sort, row.is_published,
  );
  await audit(actor, 'STAFF_CREATE', 'web_staff', id, { name: row.name });
  revalidateSite('/staff', '/about');
  return id;
}

export async function updateStaff(id: number, input: StaffInput, actor: Actor): Promise<void> {
  const before = await adminStaffMember(id);
  if (!before) throw new AppError('That person is no longer listed', 'NOT_FOUND');
  const row = readStaff(input);
  await run(
    'UPDATE web_staff SET name=?, role_title=?, category=?, qualification=?, bio=?, photo_url=?, email=?, sort=?, is_published=? WHERE id=?',
    row.name, row.role_title, row.category, row.qualification, row.bio, input.photoUrl ?? before.photo_url, row.email, row.sort, row.is_published, id,
  );
  await audit(actor, 'STAFF_UPDATE', 'web_staff', id, { name: row.name });
  revalidateSite('/staff', '/about');
}

export async function deleteStaff(id: number, actor: Actor): Promise<void> {
  const before = await adminStaffMember(id);
  if (!before) return;
  await run('DELETE FROM web_staff WHERE id = ?', id);
  await deleteImage(before.photo_url);
  await audit(actor, 'STAFF_DELETE', 'web_staff', id, { name: before.name });
  revalidateSite('/staff', '/about');
}

/* ================================================================== testimonials */

export const adminTestimonials = (): Promise<Testimonial[]> => all<Testimonial>('SELECT * FROM web_testimonial ORDER BY sort, id');
export const adminTestimonial = (id: number): Promise<Testimonial | undefined> => one<Testimonial>('SELECT * FROM web_testimonial WHERE id = ?', id);

export interface TestimonialInput { name: unknown; roleTitle: unknown; quote: unknown; rating: unknown; sort: unknown; isPublished: unknown; photoUrl?: string | null }

export async function saveTestimonial(id: number | null, input: TestimonialInput, actor: Actor): Promise<number> {
  const row = {
    name: v.required(input.name, 'A name', 120),
    role_title: v.text(input.roleTitle, 120),
    quote: v.required(input.quote, 'The quote', 1_000),
    rating: v.integer(input.rating, 1, 5, 5) ?? 5,
    sort: v.integer(input.sort, 0, 9999, 0) ?? 0,
    is_published: v.boolean(input.isPublished),
  };
  if (id) {
    const before = await adminTestimonial(id);
    if (!before) throw new AppError('That testimonial no longer exists', 'NOT_FOUND');
    await run(
      'UPDATE web_testimonial SET name=?, role_title=?, quote=?, photo_url=?, rating=?, sort=?, is_published=? WHERE id=?',
      row.name, row.role_title, row.quote, input.photoUrl ?? before.photo_url, row.rating, row.sort, row.is_published, id,
    );
    await audit(actor, 'TESTIMONIAL_UPDATE', 'web_testimonial', id, { name: row.name });
    revalidateSite('/about');
    return id;
  }
  const created = await run(
    'INSERT INTO web_testimonial (name, role_title, quote, photo_url, rating, sort, is_published, created_at) VALUES (?,?,?,?,?,?,?,?)',
    row.name, row.role_title, row.quote, input.photoUrl ?? null, row.rating, row.sort, row.is_published, now(),
  );
  await audit(actor, 'TESTIMONIAL_CREATE', 'web_testimonial', created.id, { name: row.name });
  revalidateSite('/about');
  return created.id;
}

export async function deleteTestimonial(id: number, actor: Actor): Promise<void> {
  const before = await adminTestimonial(id);
  if (!before) return;
  await run('DELETE FROM web_testimonial WHERE id = ?', id);
  await deleteImage(before.photo_url);
  await audit(actor, 'TESTIMONIAL_DELETE', 'web_testimonial', id, { name: before.name });
  revalidateSite('/about');
}

/* =========================================================================== FAQ */

export const adminFaqs = (): Promise<Faq[]> => all<Faq>('SELECT * FROM web_faq ORDER BY sort, id');

export interface FaqInput { question: unknown; answer: unknown; category: unknown; sort: unknown; isPublished: unknown }

export async function saveFaq(id: number | null, input: FaqInput, actor: Actor): Promise<number> {
  const row = {
    question: v.required(input.question, 'The question', 300),
    answer: v.richText(input.answer, 4_000) ?? '',
    category: v.choice(input.category, FAQ_CATEGORIES.map((c) => c.value), 'category'),
    sort: v.integer(input.sort, 0, 9999, 0) ?? 0,
    is_published: v.boolean(input.isPublished),
  };
  if (!row.answer) throw new AppError('An answer is required', 'VALIDATION');
  if (id) {
    await run('UPDATE web_faq SET question=?, answer=?, category=?, sort=?, is_published=? WHERE id=?', row.question, row.answer, row.category, row.sort, row.is_published, id);
    await audit(actor, 'FAQ_UPDATE', 'web_faq', id, { question: row.question });
    revalidateSite('/admissions');
    return id;
  }
  const created = await run('INSERT INTO web_faq (question, answer, category, sort, is_published) VALUES (?,?,?,?,?)', row.question, row.answer, row.category, row.sort, row.is_published);
  await audit(actor, 'FAQ_CREATE', 'web_faq', created.id, { question: row.question });
  revalidateSite('/admissions');
  return created.id;
}

export async function deleteFaq(id: number, actor: Actor): Promise<void> {
  await run('DELETE FROM web_faq WHERE id = ?', id);
  await audit(actor, 'FAQ_DELETE', 'web_faq', id, {});
  revalidateSite('/admissions');
}

/* ============================================================ academic structure */

export async function adminLevels(): Promise<LevelView[]> {
  const [levels, grades, subjects] = await Promise.all([
    all<LevelView>('SELECT * FROM web_level ORDER BY sort, name'),
    all<Grade>('SELECT * FROM web_grade ORDER BY sort, name'),
    all<Subject>('SELECT * FROM web_subject ORDER BY is_core DESC, sort, name'),
  ]);
  return levels.map((level) => ({
    ...level,
    grades: grades.filter((g) => g.level_id === level.id),
    subjects: subjects.filter((s) => s.level_id === level.id),
  }));
}


export interface LevelInput {
  name: unknown; tagline: unknown; description: unknown; ageNote: unknown; entryNote: unknown;
  sort: unknown; isPublished: unknown; imageUrl?: string | null;
}

export async function saveLevel(id: number | null, input: LevelInput, actor: Actor): Promise<number> {
  const name = v.required(input.name, 'A name', 120);
  const row = {
    tagline: v.text(input.tagline, 200),
    description: v.richText(input.description, 4_000),
    age_note: v.text(input.ageNote, 200),
    entry_note: v.text(input.entryNote, 400),
    sort: v.integer(input.sort, 0, 9999, 0) ?? 0,
    is_published: v.boolean(input.isPublished),
  };
  if (id) {
    const before = await one<LevelView>('SELECT * FROM web_level WHERE id = ?', id);
    if (!before) throw new AppError('That level no longer exists', 'NOT_FOUND');
    const slug = name === before.name ? before.slug : await uniqueSlug('web_level', name, id);
    await run(
      'UPDATE web_level SET name=?, slug=?, tagline=?, description=?, age_note=?, entry_note=?, image_url=?, sort=?, is_published=? WHERE id=?',
      name, slug, row.tagline, row.description, row.age_note, row.entry_note, input.imageUrl ?? before.image_url, row.sort, row.is_published, id,
    );
    await audit(actor, 'LEVEL_UPDATE', 'web_level', id, { name });
    revalidateSite('/academics', `/academics/${slug}`);
    return id;
  }
  const slug = await uniqueSlug('web_level', name);
  const created = await run(
    'INSERT INTO web_level (name, slug, tagline, description, age_note, entry_note, image_url, sort, is_published) VALUES (?,?,?,?,?,?,?,?,?)',
    name, slug, row.tagline, row.description, row.age_note, row.entry_note, input.imageUrl ?? null, row.sort, row.is_published,
  );
  await audit(actor, 'LEVEL_CREATE', 'web_level', created.id, { name });
  revalidateSite('/academics');
  return created.id;
}

export async function deleteLevel(id: number, actor: Actor): Promise<void> {
  await run('DELETE FROM web_level WHERE id = ?', id);
  await audit(actor, 'LEVEL_DELETE', 'web_level', id, {});
  revalidateSite('/academics');
}

export async function addGrade(levelId: number, name: unknown, sort: unknown, actor: Actor): Promise<void> {
  const { id } = await run('INSERT INTO web_grade (level_id, name, sort) VALUES (?,?,?)', levelId, v.required(name, 'A name', 60), v.integer(sort, 0, 9999, 0) ?? 0);
  await audit(actor, 'GRADE_CREATE', 'web_grade', id, { level: levelId });
  revalidateSite('/academics');
}

export async function deleteGrade(id: number, actor: Actor): Promise<void> {
  await run('DELETE FROM web_grade WHERE id = ?', id);
  await audit(actor, 'GRADE_DELETE', 'web_grade', id, {});
  revalidateSite('/academics');
}

export async function addSubject(levelId: number, name: unknown, isCore: unknown, actor: Actor): Promise<void> {
  const { id } = await run('INSERT INTO web_subject (level_id, name, is_core, sort) VALUES (?,?,?,0)', levelId, v.required(name, 'A name', 80), v.boolean(isCore));
  await audit(actor, 'SUBJECT_CREATE', 'web_subject', id, { level: levelId });
  revalidateSite('/academics');
}

export async function deleteSubject(id: number, actor: Actor): Promise<void> {
  await run('DELETE FROM web_subject WHERE id = ?', id);
  await audit(actor, 'SUBJECT_DELETE', 'web_subject', id, {});
  revalidateSite('/academics');
}

/* ========================================================================= terms */

export const adminTerms = (): Promise<Term[]> => all<Term>('SELECT * FROM web_term ORDER BY start_date DESC');

export interface TermInput { name: unknown; yearName: unknown; startDate: unknown; endDate: unknown; isCurrent: unknown; note: unknown }

export async function saveTerm(id: number | null, input: TermInput, actor: Actor): Promise<number> {
  const start = v.isoDate(input.startDate, 'The opening date');
  const end = v.isoDate(input.endDate, 'The closing date');
  if (!start || !end) throw new AppError('A term needs an opening and a closing date', 'VALIDATION');
  if (end < start) throw new AppError('The term cannot close before it opens', 'VALIDATION');
  const row = {
    name: v.required(input.name, 'A name', 60),
    year_name: v.required(input.yearName, 'The academic year', 40),
    is_current: v.boolean(input.isCurrent),
    note: v.text(input.note, 300),
  };
  const termId = id
    ? (await run('UPDATE web_term SET name=?, year_name=?, start_date=?, end_date=?, is_current=?, note=? WHERE id=?', row.name, row.year_name, start, end, row.is_current, row.note, id), id)
    : (await run('INSERT INTO web_term (name, year_name, start_date, end_date, is_current, note) VALUES (?,?,?,?,?,?)', row.name, row.year_name, start, end, row.is_current, row.note)).id;
  // Exactly one term is current: the calendar, the fee page and the home page all assume it.
  if (row.is_current) await run('UPDATE web_term SET is_current = FALSE WHERE id <> ?', termId);
  await audit(actor, id ? 'TERM_UPDATE' : 'TERM_CREATE', 'web_term', termId, { name: row.name, year: row.year_name });
  revalidateSite('/academics/calendar', '/academics', '/admissions/fees');
  return termId;
}

export async function deleteTerm(id: number, actor: Actor): Promise<void> {
  await run('DELETE FROM web_term WHERE id = ?', id);
  await audit(actor, 'TERM_DELETE', 'web_term', id, {});
  revalidateSite('/academics/calendar', '/admissions/fees');
}

/* ========================================================================== fees */

export const adminFees = (termId: number): Promise<(Fee & { grade: string; level: string })[]> =>
  all(
    `SELECT f.*, g.name AS grade, l.name AS level
     FROM web_fee f JOIN web_grade g ON g.id = f.grade_id JOIN web_level l ON l.id = g.level_id
     WHERE f.term_id = ? ORDER BY l.sort, g.sort, f.sort, f.item`,
    termId,
  );

export interface FeeInput { termId: unknown; gradeId: unknown; item: unknown; amount: unknown; appliesTo: unknown; sort: unknown }

export async function saveFee(id: number | null, input: FeeInput, actor: Actor): Promise<number> {
  const termId = v.integer(input.termId, 1, 1e9);
  const gradeId = v.integer(input.gradeId, 1, 1e9);
  if (!termId || !gradeId) throw new AppError('Pick a term and a grade', 'VALIDATION');
  const row = {
    item: v.required(input.item, 'The fee item', 120),
    amount_cents: v.money(input.amount),
    applies_to: v.choice(input.appliesTo, ['ALL', 'BOARDER', 'DAY', 'OPT_IN'] as const, 'category'),
    sort: v.integer(input.sort, 0, 9999, 0) ?? 0,
  };
  const feeId = id
    ? (await run('UPDATE web_fee SET term_id=?, grade_id=?, item=?, amount_cents=?, applies_to=?, sort=? WHERE id=?', termId, gradeId, row.item, row.amount_cents, row.applies_to, row.sort, id), id)
    : (await run('INSERT INTO web_fee (term_id, grade_id, item, amount_cents, applies_to, sort) VALUES (?,?,?,?,?,?)', termId, gradeId, row.item, row.amount_cents, row.applies_to, row.sort)).id;
  await audit(actor, id ? 'FEE_UPDATE' : 'FEE_CREATE', 'web_fee', feeId, { item: row.item, amount: row.amount_cents });
  revalidateSite('/admissions/fees', '/admissions');
  return feeId;
}

export async function deleteFee(id: number, actor: Actor): Promise<void> {
  await run('DELETE FROM web_fee WHERE id = ?', id);
  await audit(actor, 'FEE_DELETE', 'web_fee', id, {});
  revalidateSite('/admissions/fees');
}

/** Copies a whole term's fee lines onto another term — how next year's structure actually gets made. */
export async function copyFees(fromTermId: number, toTermId: number, actor: Actor): Promise<number> {
  if (fromTermId === toTermId) throw new AppError('Choose a different term to copy into', 'VALIDATION');
  const { rowCount } = await run(
    `INSERT INTO web_fee (term_id, grade_id, item, amount_cents, applies_to, sort)
     SELECT ?, grade_id, item, amount_cents, applies_to, sort FROM web_fee WHERE term_id = ?
     RETURNING id`,
    toTermId, fromTermId,
  );
  await audit(actor, 'FEE_COPY', 'web_term', toTermId, { from: fromTermId, lines: rowCount });
  revalidateSite('/admissions/fees');
  return rowCount;
}

/* ===================================================================== transport */

export async function adminRoutes(): Promise<RouteView[]> {
  const [routes, stops] = await Promise.all([
    all<RouteView>('SELECT * FROM web_route ORDER BY sort, code'),
    all<Stop>('SELECT * FROM web_stop ORDER BY sort, id'),
  ]);
  return routes.map((route) => ({ ...route, stops: stops.filter((s) => s.route_id === route.id) }));
}


export interface RouteInput { code: unknown; name: unknown; description: unknown; fare: unknown; sort: unknown; isPublished: unknown }

export async function saveRoute(id: number | null, input: RouteInput, actor: Actor): Promise<number> {
  const row = {
    code: v.required(input.code, 'A route code', 20),
    name: v.required(input.name, 'A route name', 120),
    description: v.text(input.description, 600),
    fare_cents: v.money(input.fare),
    sort: v.integer(input.sort, 0, 9999, 0) ?? 0,
    is_published: v.boolean(input.isPublished),
  };
  const routeId = id
    ? (await run('UPDATE web_route SET code=?, name=?, description=?, fare_cents=?, sort=?, is_published=? WHERE id=?', row.code, row.name, row.description, row.fare_cents, row.sort, row.is_published, id), id)
    : (await run('INSERT INTO web_route (code, name, description, fare_cents, sort, is_published) VALUES (?,?,?,?,?,?)', row.code, row.name, row.description, row.fare_cents, row.sort, row.is_published)).id;
  await audit(actor, id ? 'ROUTE_UPDATE' : 'ROUTE_CREATE', 'web_route', routeId, { code: row.code });
  revalidateSite('/school-bus');
  return routeId;
}

export async function deleteRoute(id: number, actor: Actor): Promise<void> {
  await run('DELETE FROM web_route WHERE id = ?', id);
  await audit(actor, 'ROUTE_DELETE', 'web_route', id, {});
  revalidateSite('/school-bus');
}

export async function saveStop(id: number | null, routeId: number, input: { name: unknown; pickup: unknown; dropoff: unknown; sort: unknown }, actor: Actor): Promise<void> {
  const row = {
    name: v.required(input.name, 'A stop name', 120),
    pickup_time: v.text(input.pickup, 10),
    dropoff_time: v.text(input.dropoff, 10),
    sort: v.integer(input.sort, 0, 9999, 0) ?? 0,
  };
  if (id) await run('UPDATE web_stop SET name=?, pickup_time=?, dropoff_time=?, sort=? WHERE id=?', row.name, row.pickup_time, row.dropoff_time, row.sort, id);
  else await run('INSERT INTO web_stop (route_id, name, pickup_time, dropoff_time, sort) VALUES (?,?,?,?,?)', routeId, row.name, row.pickup_time, row.dropoff_time, row.sort);
  await audit(actor, id ? 'STOP_UPDATE' : 'STOP_CREATE', 'web_stop', id ?? routeId, { name: row.name });
  revalidateSite('/school-bus');
}

export async function deleteStop(id: number, actor: Actor): Promise<void> {
  await run('DELETE FROM web_stop WHERE id = ?', id);
  await audit(actor, 'STOP_DELETE', 'web_stop', id, {});
  revalidateSite('/school-bus');
}

/* ====================================================================== settings */

export type SettingsInput = Record<string, unknown>;

/** The columns the settings form may write. Anything else in the form is ignored. */
const SETTING_TEXT_FIELDS = [
  'name', 'short_name', 'motto', 'school_type', 'founded_year', 'about_intro', 'about_story', 'mission', 'vision',
  'registration_no', 'licence_no', 'physical_address', 'postal_address', 'city', 'county', 'country',
  'map_embed_url', 'phone_primary', 'phone_secondary', 'email', 'admissions_email', 'office_hours',
  'paybill_no', 'bank_details', 'currency_symbol', 'hero_headline', 'hero_body', 'crest_emoji',
  'brand_primary', 'brand_accent', 'brand_deep', 'portal_url', 'facebook_url', 'instagram_url',
  'x_url', 'youtube_url', 'tiktok_url', 'whatsapp_number', 'stat_pass_rate',
] as const;

const SETTING_NUMBER_FIELDS = ['stat_students', 'stat_teachers', 'stat_clubs'] as const;

export async function saveSettings(input: SettingsInput, actor: Actor, images: { logo_url?: string | null; hero_image_url?: string | null } = {}): Promise<void> {
  const columns: string[] = [];
  const values: (string | number | null)[] = [];

  for (const field of SETTING_TEXT_FIELDS) {
    if (!(field in input)) continue;
    const long = field === 'about_story' || field === 'about_intro' || field === 'mission' || field === 'vision' || field === 'bank_details' || field === 'hero_body';
    columns.push(field);
    values.push(long ? v.richText(input[field], 4_000) : v.text(input[field], 400));
  }
  for (const field of SETTING_NUMBER_FIELDS) {
    if (!(field in input)) continue;
    columns.push(field);
    values.push(v.integer(input[field], 0, 1_000_000, 0) ?? 0);
  }
  for (const [field, url] of Object.entries(images)) {
    if (url === undefined) continue;
    columns.push(field);
    values.push(url);
  }

  if (!columns.length) return;
  // The school's name is the one field that cannot be blanked — it titles every page.
  const nameIndex = columns.indexOf('name');
  if (nameIndex >= 0 && !values[nameIndex]) throw new AppError('The school needs a name', 'VALIDATION');

  await run(
    `UPDATE web_setting SET ${columns.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = 1`,
    ...values, now(),
  );
  await audit(actor, 'SETTINGS_UPDATE', 'web_setting', 1, { fields: columns.length });
  revalidateSite('/about', '/contact', '/admissions', '/news', '/events');
}

/* Accounts and Permission Sets live in lib/roles.ts — they are guarded differently from
 * content, and keeping them apart is what stops "may edit the website" drifting into "may grant
 * themselves anything". */

/* ========================================================================= audit */

export const adminAudit = (search = '', limit = 200): Promise<AuditEntry[]> =>
  all(
    `SELECT * FROM web_audit
     WHERE (actor_name ILIKE @like OR action ILIKE @like OR entity ILIKE @like)
     ORDER BY created_at DESC LIMIT ${Math.max(1, Math.min(limit, 1000))}`,
    { like: `%${search.trim()}%` },
  );

/* Re-exported so an admin page can import statuses from one place alongside its data. */
export { APPLICATION_STATUSES, ENQUIRY_STATUSES };
export type { Settings };

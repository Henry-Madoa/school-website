import 'server-only';

/*
 * The public website's read layer.
 *
 * Every page under app/(site) reads through this module and nowhere else. Three rules are
 * enforced here rather than trusted to each page:
 *
 *   1. Published only. Nothing draft, expired or unpublished escapes these queries, so a page
 *      cannot accidentally render a notice the school has not released.
 *   2. Read only. The site's five writes (enquiry, tour, application, RSVP, newsletter) go
 *      through lib/inbox.ts, which validates and rate-limits them.
 *   3. No personal data, ever. This database holds no pupil, no mark and no fee balance — but
 *      it does hold the enquiries visitors send, and nothing here reads them.
 */
import { cache } from 'react';
import { all, one } from './db.ts';
import type {
  Album, AlbumView, EventView, Faq, Fee, Grade, Level, LevelView, Photo,
  Post, RouteView, Settings, Staff, Stop, Subject, Term, Testimonial,
} from './types.ts';

/* ------------------------------------------------------------------ the school */

/**
 * The school's own record: name, motto, contacts, colours. Read by every single page, so
 * React's `cache` dedupes it to one query per request — the header, the footer and the page body
 * all ask for it, and all three get the same row.
 */
export const getSettings = cache(async (): Promise<Settings> => {
  const row = await one<Settings>('SELECT * FROM web_setting WHERE id = 1');
  if (row) return row;
  // A database that has been created but not set up yet still has to render a page.
  return {
    id: 1, name: 'Our School', currency_symbol: 'KSh',
    brand_primary: '#0f4c81', brand_accent: '#f0a500', brand_deep: '#0a2540',
    stat_students: 0, stat_teachers: 0, stat_clubs: 0,
  } as Settings;
});

/* --------------------------------------------------------------- what is taught */

/** The published levels, each with its grades and the learning areas taught in it. */
export async function getLevels(): Promise<LevelView[]> {
  const [levels, grades, subjects] = await Promise.all([
    all<Level>('SELECT * FROM web_level WHERE is_published ORDER BY sort, name'),
    all<Grade>('SELECT * FROM web_grade ORDER BY sort, name'),
    all<Subject>('SELECT * FROM web_subject ORDER BY is_core DESC, sort, name'),
  ]);
  return levels.map((level) => ({
    ...level,
    grades: grades.filter((g) => g.level_id === level.id),
    subjects: subjects.filter((s) => s.level_id === level.id),
  }));
}

export async function getLevel(slug: string): Promise<LevelView | undefined> {
  return (await getLevels()).find((l) => l.slug === slug);
}

/** Every grade, for the "grade of interest" picker on the enquiry and application forms. */
export const getGrades = (): Promise<(Grade & { level_name: string })[]> =>
  all(
    `SELECT g.*, l.name AS level_name
     FROM web_grade g JOIN web_level l ON l.id = g.level_id
     WHERE l.is_published ORDER BY l.sort, g.sort, g.name`,
  );

/* --------------------------------------------------------------------- calendar */

/** Terms from six months back to whatever is planned — the page parents visit most. */
export const getTerms = (): Promise<Term[]> =>
  all<Term>(
    `SELECT * FROM web_term
     WHERE end_date >= to_char(CURRENT_DATE - INTERVAL '6 months', 'YYYY-MM-DD')
     ORDER BY start_date LIMIT 16`,
  );

export const getCurrentTerm = (): Promise<Term | undefined> =>
  one<Term>('SELECT * FROM web_term WHERE is_current ORDER BY start_date DESC LIMIT 1');

/* ------------------------------------------------------------------------- news */

const LIVE_POST = `is_published AND published_at <= @now AND (expires_at IS NULL OR expires_at >= @now)`;

/** Published notices and news, newest first, pinned items above the rest. */
export const getPosts = (limit = 24, category?: string | null): Promise<Post[]> =>
  all<Post>(
    `SELECT * FROM web_post
     WHERE ${LIVE_POST} ${category ? 'AND category = @category' : ''}
     ORDER BY is_pinned DESC, published_at DESC
     LIMIT ${clampLimit(limit)}`,
    { now: new Date().toISOString(), category: category ?? null },
  );

export const getPost = (slug: string): Promise<Post | undefined> =>
  one<Post>(`SELECT * FROM web_post WHERE slug = @slug AND ${LIVE_POST}`, { slug, now: new Date().toISOString() });

/** The two or three articles to read next, never including the one being read. */
export const getRelatedPosts = (post: Post, limit = 3): Promise<Post[]> =>
  all<Post>(
    `SELECT * FROM web_post
     WHERE ${LIVE_POST} AND id <> @id
     ORDER BY (category = @category) DESC, published_at DESC
     LIMIT ${clampLimit(limit)}`,
    { now: new Date().toISOString(), id: post.id, category: post.category },
  );

/* ----------------------------------------------------------------------- events */

const EVENT_COUNTS = `
  COALESCE((SELECT COUNT(*)::int FROM web_rsvp r WHERE r.event_id = e.id), 0) AS rsvp_count,
  COALESCE((SELECT SUM(r.guests)::int FROM web_rsvp r WHERE r.event_id = e.id), 0) AS rsvp_guests`;

/** Events still to come. */
export const getUpcomingEvents = (limit = 12): Promise<EventView[]> =>
  all<EventView>(
    `SELECT e.*, ${EVENT_COUNTS} FROM web_event e
     WHERE e.is_published AND COALESCE(e.ends_at, e.starts_at) >= @now
     ORDER BY e.starts_at LIMIT ${clampLimit(limit)}`,
    { now: new Date().toISOString() },
  );

/** Events that have happened, newest first — the school's year, after the fact. */
export const getPastEvents = (limit = 12): Promise<EventView[]> =>
  all<EventView>(
    `SELECT e.*, ${EVENT_COUNTS} FROM web_event e
     WHERE e.is_published AND COALESCE(e.ends_at, e.starts_at) < @now
     ORDER BY e.starts_at DESC LIMIT ${clampLimit(limit)}`,
    { now: new Date().toISOString() },
  );

export const getEvent = (slug: string): Promise<EventView | undefined> =>
  one<EventView>(`SELECT e.*, ${EVENT_COUNTS} FROM web_event e WHERE e.slug = ? AND e.is_published`, slug);

/* ---------------------------------------------------------------------- gallery */

export async function getAlbums(): Promise<AlbumView[]> {
  const [albums, photos] = await Promise.all([
    all<Album>('SELECT * FROM web_album WHERE is_published ORDER BY sort, taken_on DESC NULLS LAST, id DESC'),
    all<Photo>('SELECT * FROM web_photo ORDER BY sort, id'),
  ]);
  return albums.map((album) => {
    const own = photos.filter((p) => p.album_id === album.id);
    return { ...album, photos: own, photo_count: own.length, cover_url: album.cover_url ?? own[0]?.url ?? null };
  });
}

export async function getAlbum(slug: string): Promise<AlbumView | undefined> {
  return (await getAlbums()).find((a) => a.slug === slug);
}

/* ----------------------------------------------------------------------- people */

export const getStaff = (category?: string | null): Promise<Staff[]> =>
  all<Staff>(
    `SELECT * FROM web_staff WHERE is_published ${category ? 'AND category = @category' : ''} ORDER BY sort, name`,
    { category: category ?? null },
  );

export const getTestimonials = (limit = 12): Promise<Testimonial[]> =>
  all<Testimonial>(`SELECT * FROM web_testimonial WHERE is_published ORDER BY sort, id LIMIT ${clampLimit(limit)}`);

export const getFaqs = (category?: string | null): Promise<Faq[]> =>
  all<Faq>(
    `SELECT * FROM web_faq WHERE is_published ${category ? 'AND category = @category' : ''} ORDER BY sort, id`,
    { category: category ?? null },
  );

/* -------------------------------------------------------------------- transport */

export async function getRoutes(): Promise<RouteView[]> {
  const [routes, stops] = await Promise.all([
    all<RouteView>('SELECT * FROM web_route WHERE is_published ORDER BY sort, code'),
    all<Stop>('SELECT * FROM web_stop ORDER BY sort, id'),
  ]);
  return routes.map((route) => ({ ...route, stops: stops.filter((s) => s.route_id === route.id) }));
}

/* ------------------------------------------------------------------------- fees */

export interface FeeTable {
  grade_id: number;
  grade: string;
  level: string;
  level_sort: number;
  lines: (Fee & { label: string })[];
  compulsory_total: number;
}

const APPLIES_LABEL: Record<string, string> = {
  ALL: 'Compulsory',
  BOARDER: 'Boarders only',
  DAY: 'Day scholars only',
  OPT_IN: 'Optional',
};

/** The published fee structure for a term, grade by grade. */
export async function getFees(termId?: number | null): Promise<{ term: Term | undefined; tables: FeeTable[] }> {
  const term = termId
    ? await one<Term>('SELECT * FROM web_term WHERE id = ?', termId)
    : (await getCurrentTerm()) ?? (await one<Term>('SELECT * FROM web_term ORDER BY start_date DESC LIMIT 1'));
  if (!term) return { term: undefined, tables: [] };

  const rows = await all<Fee & { grade: string; level: string; level_sort: number; grade_sort: number }>(
    `SELECT f.*, g.name AS grade, l.name AS level, l.sort AS level_sort, g.sort AS grade_sort
     FROM web_fee f
     JOIN web_grade g ON g.id = f.grade_id
     JOIN web_level l ON l.id = g.level_id
     WHERE f.term_id = ? AND f.amount_cents > 0 AND l.is_published
     ORDER BY l.sort, g.sort, f.sort, f.item`,
    term.id,
  );

  const byGrade = new Map<number, FeeTable>();
  for (const row of rows) {
    const table = byGrade.get(row.grade_id) ?? {
      grade_id: row.grade_id, grade: row.grade, level: row.level, level_sort: row.level_sort, lines: [], compulsory_total: 0,
    };
    table.lines.push({ ...row, label: APPLIES_LABEL[row.applies_to] ?? row.applies_to });
    if (row.applies_to === 'ALL') table.compulsory_total += Number(row.amount_cents);
    byGrade.set(row.grade_id, table);
  }
  return { term, tables: [...byGrade.values()] };
}

/** The headline a prospective parent asks for first: "what does it cost?" */
export async function getLowestTermFee(): Promise<number> {
  const { tables } = await getFees();
  const totals = tables.map((t) => t.compulsory_total).filter((n) => n > 0);
  return totals.length ? Math.min(...totals) : 0;
}

/* ----------------------------------------------------------------------- search */

export interface SearchHit { kind: 'Notice' | 'Event' | 'Page' | 'Person' | 'Question'; title: string; excerpt: string; href: string; date?: string }

/**
 * Site search. One query per content type rather than a materialised index: this is a school
 * website with a few hundred rows, and an index would be one more thing to keep in step.
 */
export async function search(term: string): Promise<SearchHit[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const now = new Date().toISOString();

  const [posts, events, staff, faqs] = await Promise.all([
    all<Post>(
      `SELECT * FROM web_post WHERE ${LIVE_POST} AND (title ILIKE @like OR body ILIKE @like) ORDER BY published_at DESC LIMIT 12`,
      { like, now },
    ),
    all<EventView>(
      `SELECT e.*, ${EVENT_COUNTS} FROM web_event e WHERE e.is_published AND (e.title ILIKE @like OR COALESCE(e.summary,'') ILIKE @like OR COALESCE(e.body,'') ILIKE @like) ORDER BY e.starts_at DESC LIMIT 8`,
      { like },
    ),
    all<Staff>('SELECT * FROM web_staff WHERE is_published AND (name ILIKE @like OR role_title ILIKE @like) ORDER BY sort LIMIT 6', { like }),
    all<Faq>('SELECT * FROM web_faq WHERE is_published AND (question ILIKE @like OR answer ILIKE @like) ORDER BY sort LIMIT 8', { like }),
  ]);

  return [
    ...posts.map((p): SearchHit => ({ kind: 'Notice', title: p.title, excerpt: p.excerpt ?? p.body.slice(0, 160), href: `/news/${p.slug}`, date: p.published_at })),
    ...events.map((e): SearchHit => ({ kind: 'Event', title: e.title, excerpt: e.summary ?? e.body?.slice(0, 160) ?? '', href: `/events/${e.slug}`, date: e.starts_at })),
    ...staff.map((s): SearchHit => ({ kind: 'Person', title: s.name, excerpt: s.role_title, href: '/staff' })),
    ...faqs.map((f): SearchHit => ({ kind: 'Question', title: f.question, excerpt: f.answer.slice(0, 160), href: '/admissions#questions' })),
  ];
}

/* ------------------------------------------------------------------------ misc */

/** LIMIT is interpolated, never bound, so it is clamped to a literal integer here. */
function clampLimit(limit: number): number {
  return Math.max(1, Math.min(Math.round(Number(limit) || 10), 200));
}

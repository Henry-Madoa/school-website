import 'server-only';

/*
 * The numbers behind the dashboard's charts.
 *
 * Every figure is bucketed in the school's own time zone, so "this week" on a chart is the week
 * the office lived through rather than a UTC one that starts on Sunday evening. Periods are whole
 * buckets: 30 days, 13 weeks or 12 months, always ending with the current one.
 */
import { all, one } from './db.ts';

const TZ = 'Africa/Nairobi';

export type Range = '30' | '90' | '365';
export const RANGES: { value: Range; label: string }[] = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 13 weeks' },
  { value: '365', label: 'Last 12 months' },
];
export const parseRange = (value: unknown): Range => (value === '30' || value === '365' ? value : '90');

type Unit = 'day' | 'week' | 'month';
const PERIOD: Record<Range, { unit: Unit; steps: number }> = {
  '30': { unit: 'day', steps: 30 },
  '90': { unit: 'week', steps: 13 },
  '365': { unit: 'month', steps: 12 },
};

/* The period's local bounds, as SQL shared by every query below. */
const BOUNDS = `
  bounds AS (
    SELECT date_trunc(@unit::text, now() AT TIME ZONE '${TZ}')
             - (@steps::int - 1) * ('1 ' || @unit::text)::interval AS from_local,
           date_trunc(@unit::text, now() AT TIME ZONE '${TZ}')
             + ('1 ' || @unit::text)::interval AS to_local
  )`;
const LOCAL = (column: string) => `(${column}::timestamptz AT TIME ZONE '${TZ}')`;
const IN_PERIOD = (column: string) => `${LOCAL(column)} >= b.from_local AND ${LOCAL(column)} < b.to_local`;

export interface Activity {
  unit: Unit;
  buckets: { start: string; enquiries: number; applications: number }[];
  totals: { enquiries: number; applications: number };
  previous: { enquiries: number; applications: number };
}

/** Enquiries and applications per bucket, with the period before for comparison. */
export async function admissionsActivity(range: Range): Promise<Activity> {
  const { unit, steps } = PERIOD[range];
  const params = { unit, steps };
  const [buckets, totals] = await Promise.all([
    all<{ start: string; enquiries: number; applications: number }>(
      `WITH ${BOUNDS},
       series AS (
         SELECT generate_series(b.from_local, b.to_local - ('1 ' || @unit::text)::interval, ('1 ' || @unit::text)::interval) AS start
         FROM bounds b
       )
       SELECT to_char(s.start, 'YYYY-MM-DD') AS start,
         (SELECT COUNT(*)::int FROM web_enquiry e
           WHERE ${LOCAL('e.created_at')} >= s.start AND ${LOCAL('e.created_at')} < s.start + ('1 ' || @unit::text)::interval) AS enquiries,
         (SELECT COUNT(*)::int FROM web_application a
           WHERE ${LOCAL('a.created_at')} >= s.start AND ${LOCAL('a.created_at')} < s.start + ('1 ' || @unit::text)::interval) AS applications
       FROM series s ORDER BY s.start`,
      params,
    ),
    one<{ enquiries: number; applications: number; prev_enquiries: number; prev_applications: number }>(
      `WITH ${BOUNDS}
       SELECT
         (SELECT COUNT(*)::int FROM web_enquiry e, bounds b WHERE ${IN_PERIOD('e.created_at')}) AS enquiries,
         (SELECT COUNT(*)::int FROM web_application a, bounds b WHERE ${IN_PERIOD('a.created_at')}) AS applications,
         (SELECT COUNT(*)::int FROM web_enquiry e, bounds b
           WHERE ${LOCAL('e.created_at')} >= b.from_local - (b.to_local - b.from_local) AND ${LOCAL('e.created_at')} < b.from_local) AS prev_enquiries,
         (SELECT COUNT(*)::int FROM web_application a, bounds b
           WHERE ${LOCAL('a.created_at')} >= b.from_local - (b.to_local - b.from_local) AND ${LOCAL('a.created_at')} < b.from_local) AS prev_applications`,
      params,
    ),
  ]);
  return {
    unit,
    buckets,
    totals: { enquiries: totals?.enquiries ?? 0, applications: totals?.applications ?? 0 },
    previous: { enquiries: totals?.prev_enquiries ?? 0, applications: totals?.prev_applications ?? 0 },
  };
}

/** How far the period's enquiries have travelled: each stage counts everyone who reached it. */
export async function admissionsFunnel(range: Range): Promise<{ stage: string; n: number }[]> {
  const row = await one<{ enquiries: number; contacted: number; visited: number; applied: number; enrolled: number }>(
    `WITH ${BOUNDS}
     SELECT COUNT(*)::int AS enquiries,
            COUNT(*) FILTER (WHERE e.status <> 'NEW')::int AS contacted,
            COUNT(*) FILTER (WHERE e.status IN ('TOUR_BOOKED','APPLIED','ENROLLED'))::int AS visited,
            COUNT(*) FILTER (WHERE e.status IN ('APPLIED','ENROLLED'))::int AS applied,
            COUNT(*) FILTER (WHERE e.status = 'ENROLLED')::int AS enrolled
     FROM web_enquiry e, bounds b WHERE ${IN_PERIOD('e.created_at')}`,
    PERIOD[range],
  );
  return [
    { stage: 'Enquired', n: row?.enquiries ?? 0 },
    { stage: 'Contacted', n: row?.contacted ?? 0 },
    { stage: 'Visit booked', n: row?.visited ?? 0 },
    { stage: 'Applied', n: row?.applied ?? 0 },
    { stage: 'Enrolled', n: row?.enrolled ?? 0 },
  ];
}

const SOURCE_LABELS: Record<string, string> = {
  '/': 'Home page',
  '/contact': 'Contact page',
  '/admissions': 'Admissions page',
  '/admissions/tour': 'Book a visit',
  '/admissions/apply': 'Apply online',
  '/admissions/fees': 'Fees page',
  '/school-bus': 'School bus page',
};
const sourceLabel = (path: string | null): string => {
  if (!path) return 'Not recorded';
  if (SOURCE_LABELS[path]) return SOURCE_LABELS[path];
  if (path.startsWith('/academics')) return 'Academics pages';
  if (path.startsWith('/news')) return 'News pages';
  if (path.startsWith('/events')) return 'Events pages';
  return path;
};

/** Which pages the period's enquiries and applications were sent from, top six plus the rest. */
export async function admissionsSources(range: Range): Promise<{ label: string; n: number }[]> {
  const rows = await all<{ source_page: string | null; n: number }>(
    `WITH ${BOUNDS},
     sent AS (
       SELECT e.source_page FROM web_enquiry e, bounds b WHERE ${IN_PERIOD('e.created_at')}
       UNION ALL
       SELECT a.source_page FROM web_application a, bounds b WHERE ${IN_PERIOD('a.created_at')}
     )
     SELECT source_page, COUNT(*)::int AS n FROM sent GROUP BY source_page`,
    PERIOD[range],
  );
  const merged = new Map<string, number>();
  for (const row of rows) merged.set(sourceLabel(row.source_page), (merged.get(sourceLabel(row.source_page)) ?? 0) + row.n);
  const sorted = [...merged.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
  if (sorted.length <= 7) return sorted;
  const rest = sorted.slice(6).reduce((sum, row) => sum + row.n, 0);
  return [...sorted.slice(0, 6), { label: 'Everything else', n: rest }];
}

/** Enquiries and applications per grade over the period, in the school's own grade order. */
export const interestByGrade = (range: Range): Promise<{ grade: string; level: string; enquiries: number; applications: number }[]> =>
  all(
    `WITH ${BOUNDS}
     SELECT g.name AS grade, l.name AS level,
       (SELECT COUNT(*)::int FROM web_enquiry e, bounds b WHERE e.grade_id = g.id AND ${IN_PERIOD('e.created_at')}) AS enquiries,
       (SELECT COUNT(*)::int FROM web_application a, bounds b WHERE a.grade_id = g.id AND ${IN_PERIOD('a.created_at')}) AS applications
     FROM web_grade g JOIN web_level l ON l.id = g.level_id
     ORDER BY l.sort, g.sort`,
    PERIOD[range],
  );

/** Published notices per month, for the last six months including this one. */
export const noticesPerMonth = (): Promise<{ month: string; n: number }[]> =>
  all(
    `WITH series AS (
       SELECT generate_series(date_trunc('month', now() AT TIME ZONE '${TZ}') - interval '5 months',
                              date_trunc('month', now() AT TIME ZONE '${TZ}'), interval '1 month') AS start
     )
     SELECT to_char(s.start, 'YYYY-MM-DD') AS month,
       (SELECT COUNT(*)::int FROM web_post p
         WHERE p.is_published AND ${LOCAL('p.published_at')} >= s.start AND ${LOCAL('p.published_at')} < s.start + interval '1 month') AS n
     FROM series s ORDER BY s.start`,
  );

export interface ContentCounts {
  notices: number;
  events: number;
  albums: number;
  photos: number;
  staff: number;
  testimonials: number;
  faqs: number;
}

/** What a visitor can see on the website right now. */
export async function contentCounts(): Promise<ContentCounts> {
  const row = await one<ContentCounts>(
    `SELECT
       (SELECT COUNT(*)::int FROM web_post WHERE is_published) AS notices,
       (SELECT COUNT(*)::int FROM web_event WHERE is_published AND starts_at >= @now) AS events,
       (SELECT COUNT(*)::int FROM web_album WHERE is_published) AS albums,
       (SELECT COUNT(*)::int FROM web_photo p JOIN web_album a ON a.id = p.album_id WHERE a.is_published) AS photos,
       (SELECT COUNT(*)::int FROM web_staff WHERE is_published) AS staff,
       (SELECT COUNT(*)::int FROM web_testimonial WHERE is_published) AS testimonials,
       (SELECT COUNT(*)::int FROM web_faq WHERE is_published) AS faqs`,
    { now: new Date().toISOString() },
  );
  return row!;
}

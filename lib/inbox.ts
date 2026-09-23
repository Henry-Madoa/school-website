import 'server-only';

/*
 * What visitors send the school: enquiries, tour bookings, online applications, event RSVPs and
 * newsletter sign-ups.
 *
 * These are the only tables an anonymous visitor can insert into, so this module is the site's
 * exposed surface and is written that way — every field validated, every write audited against a
 * synthetic `website` actor rather than a login, nothing read back to the caller except a
 * reference number.
 *
 * An enquiry is worked as a list — NEW → CONTACTED → TOUR_BOOKED → APPLIED → ENROLLED / LOST — so
 * at the end of a term the school can say how many enquiries the website produced and how many
 * became pupils. That is the number the website is actually judged on.
 */
import { all, one, run, audit, value, type Actor } from './db.ts';
import { AppError } from './errors.ts';
import * as v from './validate.ts';
import {
  APPLICATION_STATUSES, ENQUIRY_STATUSES, OPEN_ENQUIRY_STATUSES,
  type Application, type ApplicationStatus, type ApplicationView, type EnquiryKind,
  type EnquiryStatus, type EnquiryView, type Rsvp, type Subscriber,
} from './types.ts';

/** Nobody is signed in when the website writes, so the trail records the form, not a person. */
export const WEBSITE: Actor = { id: 0, name: 'website', email: '' };

const now = (): string => new Date().toISOString();

/* ===================================================================== enquiries */

const ENQUIRY_SELECT = `
  SELECT e.*, g.name AS grade_name,
         GREATEST(0, (CURRENT_DATE - e.created_at::date))::int AS age_days
  FROM web_enquiry e LEFT JOIN web_grade g ON g.id = e.grade_id`;

export const listEnquiries = (status?: EnquiryStatus | 'OPEN' | '' | null, search = ''): Promise<EnquiryView[]> =>
  all<EnquiryView>(
    `${ENQUIRY_SELECT}
     WHERE (e.name ILIKE @like OR e.phone ILIKE @like OR COALESCE(e.email,'') ILIKE @like OR COALESCE(e.message,'') ILIKE @like)
       ${status === 'OPEN' ? 'AND e.status = ANY(@open)' : status ? 'AND e.status = @status' : ''}
     ORDER BY (e.status = 'NEW') DESC, e.created_at DESC LIMIT 500`,
    { like: `%${search.trim()}%`, status: status || null, open: OPEN_ENQUIRY_STATUSES },
  );

export const getEnquiry = (id: number): Promise<EnquiryView | undefined> =>
  one<EnquiryView>(`${ENQUIRY_SELECT} WHERE e.id = ?`, id);

export const enquiryCounts = (): Promise<{ status: EnquiryStatus; n: number }[]> =>
  all<{ status: EnquiryStatus; n: number }>('SELECT status, COUNT(*)::int AS n FROM web_enquiry GROUP BY status');

export interface EnquiryInput {
  kind?: unknown; name: unknown; phone: unknown; email?: unknown; gradeId?: unknown; message?: unknown;
  preferredDate?: unknown; preferredTime?: unknown; visitors?: unknown; sourcePage?: unknown;
}

/** Captures an enquiry or a tour booking from the public site. Returns its reference. */
export async function createEnquiry(input: EnquiryInput): Promise<{ id: number; reference: string }> {
  const kind: EnquiryKind = String(input.kind ?? '').toUpperCase() === 'TOUR' ? 'TOUR' : 'ENQUIRY';
  const name = v.required(input.name, 'Your name', 120);
  const phone = v.phone(input.phone);
  if (!phone) throw new AppError('A phone number is required — it is how the school replies', 'VALIDATION');
  const email = v.email(input.email);
  const gradeId = v.integer(input.gradeId, 1, 1e9);
  if (gradeId && !(await one('SELECT id FROM web_grade WHERE id = ?', gradeId))) {
    throw new AppError('Pick a grade from the list', 'VALIDATION');
  }

  const date = v.isoDate(input.preferredDate, 'The date of your visit');
  if (kind === 'TOUR') {
    if (!date) throw new AppError('Pick the day you would like to visit', 'VALIDATION');
    if (date < new Date().toISOString().slice(0, 10)) throw new AppError('Pick a date in the future', 'VALIDATION');
  }

  const { id } = await run(
    `INSERT INTO web_enquiry (kind, name, phone, email, grade_id, message, preferred_date, preferred_time, visitors, source_page, status, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    kind, name, phone, email, gradeId, v.text(input.message, 2_000), date, v.text(input.preferredTime, 20),
    v.integer(input.visitors, 1, 20), v.text(input.sourcePage, 200),
    kind === 'TOUR' ? 'TOUR_BOOKED' : 'NEW', now(),
  );
  await audit(WEBSITE, kind === 'TOUR' ? 'TOUR_BOOKED' : 'ENQUIRY_RECEIVED', 'web_enquiry', id, { name, phone });
  return { id, reference: `ENQ-${String(id).padStart(4, '0')}` };
}

export async function setEnquiryStatus(id: number, status: unknown, note: unknown, actor: Actor): Promise<void> {
  const next = v.choice(status, ENQUIRY_STATUSES, 'status');
  const { rowCount } = await run(
    'UPDATE web_enquiry SET status = ?, notes = COALESCE(?, notes), handled_by = ?, handled_at = ? WHERE id = ?',
    next, v.richText(note, 2_000), actor.name, now(), id,
  );
  if (!rowCount) throw new AppError('That enquiry no longer exists', 'NOT_FOUND');
  await audit(actor, 'ENQUIRY_STATUS', 'web_enquiry', id, { status: next });
}

export async function deleteEnquiry(id: number, actor: Actor): Promise<void> {
  await run('DELETE FROM web_enquiry WHERE id = ?', id);
  await audit(actor, 'ENQUIRY_DELETE', 'web_enquiry', id, {});
}

/* =================================================================== applications */

const APPLICATION_SELECT = `
  SELECT a.*, g.name AS grade_name, l.name AS level_name
  FROM web_application a
  LEFT JOIN web_grade g ON g.id = a.grade_id
  LEFT JOIN web_level l ON l.id = g.level_id`;

export const listApplications = (status?: ApplicationStatus | '' | null, search = ''): Promise<ApplicationView[]> =>
  all<ApplicationView>(
    `${APPLICATION_SELECT}
     WHERE (a.no ILIKE @like OR a.first_name ILIKE @like OR a.last_name ILIKE @like OR a.guardian_name ILIKE @like OR a.guardian_phone ILIKE @like)
       ${status ? 'AND a.status = @status' : ''}
     ORDER BY a.created_at DESC LIMIT 500`,
    { like: `%${search.trim()}%`, status: status || null },
  );

export const getApplication = (id: number): Promise<ApplicationView | undefined> =>
  one<ApplicationView>(`${APPLICATION_SELECT} WHERE a.id = ?`, id);

export const applicationCounts = (): Promise<{ status: ApplicationStatus; n: number }[]> =>
  all<{ status: ApplicationStatus; n: number }>('SELECT status, COUNT(*)::int AS n FROM web_application GROUP BY status');

export interface ApplicationInput {
  firstName: unknown; middleName?: unknown; lastName: unknown; dateOfBirth: unknown; gender: unknown;
  previousSchool?: unknown; gradeId: unknown; boardingStatus: unknown; transportRoute?: unknown; medical?: unknown;
  guardianName: unknown; guardianRelationship?: unknown; guardianPhone: unknown; guardianEmail?: unknown;
  message?: unknown; photoConsent?: unknown; declaration?: unknown; privacy?: unknown; sourcePage?: unknown;
}

/**
 * The application number: APP-2026-0007. Year-scoped and sequential, because a parent reads it
 * down the phone to the office and "the seventh application this year" is a thing both ends can
 * check. The counter is bumped atomically so two parents submitting at once cannot collide.
 */
async function nextApplicationNo(): Promise<string> {
  const year = new Date().getFullYear();
  const key = `application:${year}`;
  const next = await value<number>(
    `INSERT INTO web_counter (key, value) VALUES (?, 1)
     ON CONFLICT (key) DO UPDATE SET value = web_counter.value + 1
     RETURNING value`,
    key,
  );
  return `APP-${year}-${String(next ?? 1).padStart(4, '0')}`;
}

export async function createApplication(input: ApplicationInput): Promise<{ id: number; no: string }> {
  if (!v.boolean(input.declaration)) throw new AppError('Please confirm that the information you have given is true', 'VALIDATION');
  if (!v.boolean(input.privacy)) throw new AppError('Please accept the privacy notice so the school may hold these details', 'VALIDATION');

  const gradeId = v.integer(input.gradeId, 1, 1e9);
  if (!gradeId) throw new AppError('Choose the grade you are applying for', 'VALIDATION');
  if (!(await one('SELECT id FROM web_grade WHERE id = ?', gradeId))) throw new AppError('Pick a grade from the list', 'VALIDATION');

  const guardianPhone = v.phone(input.guardianPhone);
  if (!guardianPhone) throw new AppError('A phone number is required — it is how the school reaches you', 'VALIDATION');

  const dob = v.isoDate(input.dateOfBirth, 'The date of birth');
  if (dob && dob > new Date().toISOString().slice(0, 10)) throw new AppError('A date of birth cannot be in the future', 'VALIDATION');

  const no = await nextApplicationNo();
  const { id } = await run(
    `INSERT INTO web_application (no, first_name, middle_name, last_name, date_of_birth, gender, previous_school,
       grade_id, boarding_status, transport_route, medical, guardian_name, guardian_relationship, guardian_phone,
       guardian_email, message, photo_consent, status, source_page, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    no,
    v.required(input.firstName, "The child's first name", 60),
    v.text(input.middleName, 60),
    v.required(input.lastName, "The child's last name", 60),
    dob,
    v.text(input.gender, 10),
    v.text(input.previousSchool, 120),
    gradeId,
    String(input.boardingStatus ?? '').toUpperCase() === 'BOARDER' ? 'BOARDER' : 'DAY',
    v.text(input.transportRoute, 120),
    v.richText(input.medical, 1_000),
    v.required(input.guardianName, 'Your name', 120),
    v.text(input.guardianRelationship, 40) ?? 'Parent',
    guardianPhone,
    v.email(input.guardianEmail),
    v.richText(input.message, 1_500),
    v.boolean(input.photoConsent),
    'RECEIVED',
    v.text(input.sourcePage, 200),
    now(),
  );
  await audit(WEBSITE, 'APPLICATION_RECEIVED', 'web_application', id, { no, grade: gradeId });
  return { id, no };
}

export async function setApplicationStatus(id: number, status: unknown, note: unknown, actor: Actor): Promise<void> {
  const next = v.choice(status, APPLICATION_STATUSES, 'status');
  const { rowCount } = await run(
    'UPDATE web_application SET status = ?, notes = COALESCE(?, notes), handled_by = ?, handled_at = ? WHERE id = ?',
    next, v.richText(note, 2_000), actor.name, now(), id,
  );
  if (!rowCount) throw new AppError('That application no longer exists', 'NOT_FOUND');
  await audit(actor, 'APPLICATION_STATUS', 'web_application', id, { status: next });
}

export async function deleteApplication(id: number, actor: Actor): Promise<void> {
  const before = await one<Application>('SELECT no FROM web_application WHERE id = ?', id);
  await run('DELETE FROM web_application WHERE id = ?', id);
  await audit(actor, 'APPLICATION_DELETE', 'web_application', id, { no: before?.no });
}

/* ========================================================================== RSVPs */

export const listRsvps = (eventId: number): Promise<Rsvp[]> =>
  all<Rsvp>('SELECT * FROM web_rsvp WHERE event_id = ? ORDER BY created_at DESC', eventId);

export async function createRsvp(eventId: number, input: { name: unknown; phone: unknown; email?: unknown; guests?: unknown; message?: unknown }): Promise<{ id: number }> {
  const event = await one<{ id: number; title: string; rsvp_enabled: boolean; capacity: number | null; is_published: boolean; starts_at: string }>(
    'SELECT id, title, rsvp_enabled, capacity, is_published, starts_at FROM web_event WHERE id = ?',
    eventId,
  );
  if (!event || !event.is_published) throw new AppError('That event is no longer listed', 'NOT_FOUND');
  if (!event.rsvp_enabled) throw new AppError('This event does not need booking — just come along.', 'VALIDATION');
  if (event.starts_at < now()) throw new AppError('That event has already taken place', 'VALIDATION');

  const guests = v.integer(input.guests, 1, 20, 1) ?? 1;
  if (event.capacity) {
    const taken = Number(await value<number>('SELECT COALESCE(SUM(guests), 0)::int FROM web_rsvp WHERE event_id = ?', eventId) ?? 0);
    if (taken + guests > event.capacity) {
      throw new AppError(`Only ${Math.max(0, event.capacity - taken)} place(s) are left. Please call the school office.`, 'CONFLICT');
    }
  }

  const phone = v.phone(input.phone);
  if (!phone) throw new AppError('A phone number is required so the school can confirm', 'VALIDATION');

  const { id } = await run(
    'INSERT INTO web_rsvp (event_id, name, phone, email, guests, message, created_at) VALUES (?,?,?,?,?,?,?)',
    eventId, v.required(input.name, 'Your name', 120), phone, v.email(input.email), guests, v.text(input.message, 500), now(),
  );
  await audit(WEBSITE, 'RSVP', 'web_event', eventId, { event: event.title, guests });
  return { id };
}

export async function deleteRsvp(id: number, actor: Actor): Promise<void> {
  await run('DELETE FROM web_rsvp WHERE id = ?', id);
  await audit(actor, 'RSVP_DELETE', 'web_rsvp', id, {});
}

/* ==================================================================== subscribers */

export const listSubscribers = (search = ''): Promise<Subscriber[]> =>
  all<Subscriber>(
    `SELECT * FROM web_subscriber WHERE (email ILIKE @like OR COALESCE(name,'') ILIKE @like) ORDER BY created_at DESC LIMIT 1000`,
    { like: `%${search.trim()}%` },
  );

/**
 * Signing up twice is not an error — a parent who cannot remember whether they subscribed should
 * be able to press the button again and be told yes. A previously unsubscribed address is
 * re-activated rather than duplicated.
 */
export async function subscribe(input: { email: unknown; name?: unknown; sourcePage?: unknown }): Promise<{ email: string }> {
  const email = v.email(input.email, 'That email address');
  if (!email) throw new AppError('Please give an email address', 'VALIDATION');
  await run(
    `INSERT INTO web_subscriber (email, name, status, source_page, created_at) VALUES (?,?, 'ACTIVE', ?, ?)
     ON CONFLICT (email) DO UPDATE SET status = 'ACTIVE', name = COALESCE(EXCLUDED.name, web_subscriber.name)
     RETURNING id`,
    email, v.text(input.name, 120), v.text(input.sourcePage, 200), now(),
  );
  await audit(WEBSITE, 'SUBSCRIBE', 'web_subscriber', null, { email });
  return { email };
}

export async function setSubscriberStatus(id: number, status: 'ACTIVE' | 'UNSUBSCRIBED', actor: Actor): Promise<void> {
  await run('UPDATE web_subscriber SET status = ? WHERE id = ?', status, id);
  await audit(actor, 'SUBSCRIBER_STATUS', 'web_subscriber', id, { status });
}

export async function deleteSubscriber(id: number, actor: Actor): Promise<void> {
  await run('DELETE FROM web_subscriber WHERE id = ?', id);
  await audit(actor, 'SUBSCRIBER_DELETE', 'web_subscriber', id, {});
}

/* ====================================================================== dashboard */

export interface InboxSummary {
  enquiries_open: number;
  enquiries_new: number;
  enquiries_week: number;
  tours_upcoming: number;
  applications_open: number;
  applications_week: number;
  subscribers: number;
  rsvps_week: number;
  posts_published: number;
  posts_draft: number;
  events_upcoming: number;
  photos: number;
}

/** The dashboard's twelve numbers, in one round trip. */
export async function inboxSummary(): Promise<InboxSummary> {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const stamp = now();
  const row = await one<InboxSummary>(
    `SELECT
      (SELECT COUNT(*)::int FROM web_enquiry WHERE status = ANY(@open))                       AS enquiries_open,
      (SELECT COUNT(*)::int FROM web_enquiry WHERE status = 'NEW')                            AS enquiries_new,
      (SELECT COUNT(*)::int FROM web_enquiry WHERE created_at >= @week)                       AS enquiries_week,
      (SELECT COUNT(*)::int FROM web_enquiry WHERE kind = 'TOUR' AND preferred_date >= @today) AS tours_upcoming,
      (SELECT COUNT(*)::int FROM web_application WHERE status NOT IN ('ACCEPTED','DECLINED','WITHDRAWN')) AS applications_open,
      (SELECT COUNT(*)::int FROM web_application WHERE created_at >= @week)                    AS applications_week,
      (SELECT COUNT(*)::int FROM web_subscriber WHERE status = 'ACTIVE')                       AS subscribers,
      (SELECT COUNT(*)::int FROM web_rsvp WHERE created_at >= @week)                           AS rsvps_week,
      (SELECT COUNT(*)::int FROM web_post WHERE is_published)                                  AS posts_published,
      (SELECT COUNT(*)::int FROM web_post WHERE NOT is_published)                              AS posts_draft,
      (SELECT COUNT(*)::int FROM web_event WHERE is_published AND starts_at >= @stamp)          AS events_upcoming,
      (SELECT COUNT(*)::int FROM web_photo)                                                     AS photos`,
    { open: OPEN_ENQUIRY_STATUSES, week: weekAgo, today, stamp },
  );
  return row!;
}

/**
 * The admissions funnel over a period: how many enquiries arrived, how many were answered, how
 * many applied and how many enrolled.
 */
export async function funnel(from: string, to: string): Promise<{ enquiries: number; tours: number; contacted: number; applied: number; enrolled: number; lost: number; open: number; stale: number }> {
  const row = await one<{ enquiries: number; tours: number; contacted: number; applied: number; enrolled: number; lost: number; open: number; stale: number }>(
    `SELECT COUNT(*)::int AS enquiries,
            COUNT(*) FILTER (WHERE kind = 'TOUR')::int AS tours,
            COUNT(*) FILTER (WHERE status <> 'NEW')::int AS contacted,
            COUNT(*) FILTER (WHERE status IN ('APPLIED','ENROLLED'))::int AS applied,
            COUNT(*) FILTER (WHERE status = 'ENROLLED')::int AS enrolled,
            COUNT(*) FILTER (WHERE status = 'LOST')::int AS lost,
            COUNT(*) FILTER (WHERE status = ANY(@open))::int AS open,
            COUNT(*) FILTER (WHERE status = 'NEW' AND created_at < @stale)::int AS stale
     FROM web_enquiry WHERE created_at >= @from AND created_at <= @to`,
    { from, to: `${to}T23:59:59.999Z`, open: OPEN_ENQUIRY_STATUSES, stale: new Date(Date.now() - 48 * 3_600_000).toISOString() },
  );
  return row!;
}

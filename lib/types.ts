/*
 * The shapes the website deals in. Rows come out of PostgreSQL exactly as the columns are named
 * (snake_case), because a row that is renamed on the way through is a row you then have to trace
 * back through two vocabularies whenever something looks wrong.
 */

/** "2026-09-22" */
export type IsoDate = string;
/** "2026-09-22T17:04:00.000Z" */
export type IsoDateTime = string;
/** Money in minor units. 150_000 is KSh 1,500.00. */
export type Cents = number;

/* ------------------------------------------------- permission sets and accounts */

/** An object a Permission Set line may grant rights on. */
export type ObjectType = 'TABLE' | 'PAGE';
export type Right = 'read' | 'insert' | 'modify' | 'delete';

/** One stored line: rights on one table, or Execute on one page. */
export interface PermissionLine {
  object_type: ObjectType;
  object_name: string;
  read_perm: boolean;
  insert_perm: boolean;
  modify_perm: boolean;
  delete_perm: boolean;
  execute_perm: boolean;
}

/** Lines folded into the lookup every check uses. See lib/permissions.ts. */
export interface PermissionSet {
  tables: Record<string, { read?: boolean; insert?: boolean; modify?: boolean; delete?: boolean }>;
  pages: Record<string, boolean>;
}

export const EMPTY_PERMISSIONS: PermissionSet = { tables: {}, pages: {} };

/** A Permission Set: a named role whose access is its lines. */
export interface Role {
  id: number;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: IsoDateTime;
  created_by: string | null;
}

export interface RoleView extends Role {
  user_count: number;
  line_count: number;
}

export type UserStatus = 'ACTIVE' | 'DISABLED';

/** An account as the admin lists it. */
export interface User {
  id: number;
  name: string;
  email: string;
  role_id: number | null;
  role_name: string | null;
  /** Comes from the role: an unrestricted account, with no lines at all. */
  is_system: boolean;
  status: UserStatus;
  title: string | null;
  avatar_url: string | null;
  must_change_password: boolean;
  last_login_at: IsoDateTime | null;
  created_at: IsoDateTime;
  created_by: string | null;
}

/** The signed-in user, with their rights already resolved. */
export interface SessionUser extends User {
  permissions: PermissionSet;
  /** Every Permission Set they hold — the primary role plus any extras. */
  roles: { id: number; name: string; is_system: boolean }[];
}

export interface Settings {
  id: number;
  name: string;
  short_name: string | null;
  motto: string | null;
  school_type: string | null;
  founded_year: string | null;
  about_intro: string | null;
  about_story: string | null;
  mission: string | null;
  vision: string | null;
  registration_no: string | null;
  licence_no: string | null;
  physical_address: string | null;
  postal_address: string | null;
  city: string | null;
  county: string | null;
  country: string | null;
  map_embed_url: string | null;
  phone_primary: string | null;
  phone_secondary: string | null;
  email: string | null;
  admissions_email: string | null;
  office_hours: string | null;
  paybill_no: string | null;
  bank_details: string | null;
  currency_symbol: string;
  logo_url: string | null;
  hero_image_url: string | null;
  hero_headline: string | null;
  hero_body: string | null;
  crest_emoji: string | null;
  brand_primary: string;
  brand_accent: string;
  brand_deep: string;
  portal_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  x_url: string | null;
  youtube_url: string | null;
  tiktok_url: string | null;
  whatsapp_number: string | null;
  stat_students: number;
  stat_teachers: number;
  stat_clubs: number;
  stat_pass_rate: string | null;
  updated_at: IsoDateTime | null;
}

export interface Level {
  id: number;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  age_note: string | null;
  entry_note: string | null;
  image_url: string | null;
  sort: number;
  is_published: boolean;
}

export interface Grade { id: number; level_id: number; name: string; sort: number }
export interface Subject { id: number; level_id: number; name: string; is_core: boolean; sort: number }

export interface LevelView extends Level {
  grades: Grade[];
  subjects: Subject[];
}

export interface Term {
  id: number;
  name: string;
  year_name: string;
  start_date: IsoDate;
  end_date: IsoDate;
  is_current: boolean;
  note: string | null;
}

export interface Fee {
  id: number;
  term_id: number;
  grade_id: number;
  item: string;
  amount_cents: Cents;
  applies_to: 'ALL' | 'BOARDER' | 'DAY' | 'OPT_IN';
  sort: number;
}

export type PostCategory = 'NOTICE' | 'NEWS' | 'ACHIEVEMENT' | 'CIRCULAR';
export const POST_CATEGORIES: { value: PostCategory; label: string }[] = [
  { value: 'NOTICE', label: 'Notice to parents' },
  { value: 'NEWS', label: 'School news' },
  { value: 'ACHIEVEMENT', label: 'Achievement' },
  { value: 'CIRCULAR', label: 'Circular' },
];

export interface Post {
  id: number;
  title: string;
  slug: string;
  category: PostCategory;
  excerpt: string | null;
  body: string;
  image_url: string | null;
  attachment_url: string | null;
  audience: string;
  is_published: boolean;
  is_pinned: boolean;
  published_at: IsoDateTime;
  expires_at: IsoDateTime | null;
  views: number;
  author: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime | null;
}

export type EventCategory = 'ACADEMIC' | 'SPORT' | 'ARTS' | 'COMMUNITY' | 'PARENTS' | 'HOLIDAY';
export const EVENT_CATEGORIES: { value: EventCategory; label: string; icon: string }[] = [
  { value: 'ACADEMIC', label: 'Academic', icon: '📘' },
  { value: 'SPORT', label: 'Sport', icon: '⚽' },
  { value: 'ARTS', label: 'Music & drama', icon: '🎭' },
  { value: 'COMMUNITY', label: 'Community', icon: '🤝' },
  { value: 'PARENTS', label: 'For parents', icon: '👨‍👩‍👧' },
  { value: 'HOLIDAY', label: 'Term & holidays', icon: '📅' },
];

export interface SchoolEvent {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  body: string | null;
  image_url: string | null;
  category: EventCategory;
  location: string | null;
  starts_at: IsoDateTime;
  ends_at: IsoDateTime | null;
  all_day: boolean;
  is_published: boolean;
  rsvp_enabled: boolean;
  capacity: number | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime | null;
}

export interface EventView extends SchoolEvent {
  rsvp_count: number;
  rsvp_guests: number;
}

export interface Rsvp {
  id: number;
  event_id: number;
  name: string;
  phone: string;
  email: string | null;
  guests: number;
  message: string | null;
  created_at: IsoDateTime;
}

export interface Album {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  cover_url: string | null;
  taken_on: IsoDate | null;
  sort: number;
  is_published: boolean;
  created_at: IsoDateTime;
}

export interface Photo { id: number; album_id: number; url: string; caption: string | null; sort: number }
export interface AlbumView extends Album { photos: Photo[]; photo_count: number }

export type StaffCategory = 'LEADERSHIP' | 'TEACHING' | 'ADMIN' | 'BOARD';
export const STAFF_CATEGORIES: { value: StaffCategory; label: string }[] = [
  { value: 'LEADERSHIP', label: 'School leadership' },
  { value: 'TEACHING', label: 'Teaching staff' },
  { value: 'ADMIN', label: 'Administration' },
  { value: 'BOARD', label: 'Board of management' },
];

export interface Staff {
  id: number;
  name: string;
  role_title: string;
  category: StaffCategory;
  qualification: string | null;
  bio: string | null;
  photo_url: string | null;
  email: string | null;
  sort: number;
  is_published: boolean;
}

export interface Testimonial {
  id: number;
  name: string;
  role_title: string | null;
  quote: string;
  photo_url: string | null;
  rating: number;
  sort: number;
  is_published: boolean;
  created_at: IsoDateTime;
}

export type FaqCategory = 'ADMISSIONS' | 'FEES' | 'TRANSPORT' | 'ACADEMICS' | 'GENERAL';
export const FAQ_CATEGORIES: { value: FaqCategory; label: string }[] = [
  { value: 'ADMISSIONS', label: 'Admissions' },
  { value: 'FEES', label: 'Fees' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'ACADEMICS', label: 'Academics' },
  { value: 'GENERAL', label: 'General' },
];

export interface Faq {
  id: number;
  question: string;
  answer: string;
  category: FaqCategory;
  sort: number;
  is_published: boolean;
}

export interface Route {
  id: number;
  code: string;
  name: string;
  description: string | null;
  fare_cents: Cents;
  is_published: boolean;
  sort: number;
}

export interface Stop { id: number; route_id: number; name: string; pickup_time: string | null; dropoff_time: string | null; sort: number }
export interface RouteView extends Route { stops: Stop[] }

export type EnquiryKind = 'ENQUIRY' | 'TOUR';
export type EnquiryStatus = 'NEW' | 'CONTACTED' | 'TOUR_BOOKED' | 'APPLIED' | 'ENROLLED' | 'LOST';
export const ENQUIRY_STATUSES: EnquiryStatus[] = ['NEW', 'CONTACTED', 'TOUR_BOOKED', 'APPLIED', 'ENROLLED', 'LOST'];
export const OPEN_ENQUIRY_STATUSES: EnquiryStatus[] = ['NEW', 'CONTACTED', 'TOUR_BOOKED'];

export interface Enquiry {
  id: number;
  kind: EnquiryKind;
  name: string;
  phone: string;
  email: string | null;
  grade_id: number | null;
  message: string | null;
  preferred_date: IsoDate | null;
  preferred_time: string | null;
  visitors: number | null;
  source_page: string | null;
  status: EnquiryStatus;
  notes: string | null;
  created_at: IsoDateTime;
  handled_by: string | null;
  handled_at: IsoDateTime | null;
}

export interface EnquiryView extends Enquiry { grade_name: string | null; age_days: number }

export type ApplicationStatus = 'RECEIVED' | 'REVIEWING' | 'ASSESSMENT' | 'OFFERED' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN';
export const APPLICATION_STATUSES: ApplicationStatus[] = ['RECEIVED', 'REVIEWING', 'ASSESSMENT', 'OFFERED', 'ACCEPTED', 'DECLINED', 'WITHDRAWN'];

export interface Application {
  id: number;
  no: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: IsoDate | null;
  gender: string | null;
  previous_school: string | null;
  grade_id: number | null;
  boarding_status: 'DAY' | 'BOARDER';
  transport_route: string | null;
  medical: string | null;
  guardian_name: string;
  guardian_relationship: string | null;
  guardian_phone: string;
  guardian_email: string | null;
  message: string | null;
  photo_consent: boolean;
  status: ApplicationStatus;
  notes: string | null;
  source_page: string | null;
  created_at: IsoDateTime;
  handled_by: string | null;
  handled_at: IsoDateTime | null;
}

export interface ApplicationView extends Application { grade_name: string | null; level_name: string | null }

export interface Subscriber {
  id: number;
  email: string;
  name: string | null;
  status: 'ACTIVE' | 'UNSUBSCRIBED';
  source_page: string | null;
  created_at: IsoDateTime;
}

export interface AuditEntry {
  id: number;
  actor_id: number | null;
  actor_name: string;
  action: string;
  entity: string;
  entity_id: string | null;
  detail: Record<string, unknown>;
  created_at: IsoDateTime;
}

/** What a Server Action hands back to a form. Never a thrown error across the wire. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** The loose `Object.fromEntries(formData)` bag a client form posts. */
export type FormValues = Record<string, FormDataEntryValue | undefined>;

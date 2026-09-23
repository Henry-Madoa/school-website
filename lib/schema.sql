-- ---------------------------------------------------------------------------
-- The school website's own database.
--
-- Every table is prefixed `web_` so this schema can share a PostgreSQL database
-- with the management system without colliding with it — though a database of
-- its own is the better answer, and the reason this project is separate.
--
-- The file is idempotent: `npm run db:setup` can be run against a live database
-- as often as you like. Dates and timestamps are stored as ISO-8601 TEXT, so a
-- value renders identically on the server and in the browser; money is stored
-- in minor units (cents) as an integer, never a float.
-- ---------------------------------------------------------------------------

-- ------------------------------------------------------------- the school
-- One row, id = 1. Everything the header, footer, contact page and structured
-- data need, plus the three colours the whole site is themed from.
CREATE TABLE IF NOT EXISTS web_setting (
  id                 INTEGER PRIMARY KEY DEFAULT 1,
  name               TEXT NOT NULL DEFAULT 'Our School',
  short_name         TEXT,
  motto              TEXT,
  school_type        TEXT,
  founded_year       TEXT,
  about_intro        TEXT,
  about_story        TEXT,
  mission            TEXT,
  vision             TEXT,
  registration_no    TEXT,
  licence_no         TEXT,
  physical_address   TEXT,
  postal_address     TEXT,
  city               TEXT,
  county             TEXT,
  country            TEXT DEFAULT 'Kenya',
  map_embed_url      TEXT,
  phone_primary      TEXT,
  phone_secondary    TEXT,
  email              TEXT,
  admissions_email   TEXT,
  office_hours       TEXT,
  paybill_no         TEXT,
  bank_details       TEXT,
  currency_symbol    TEXT NOT NULL DEFAULT 'KSh',
  logo_url           TEXT,
  hero_image_url     TEXT,
  hero_headline      TEXT,
  hero_body          TEXT,
  crest_emoji        TEXT DEFAULT '🎓',
  brand_primary      TEXT NOT NULL DEFAULT '#0f4c81',
  brand_accent       TEXT NOT NULL DEFAULT '#f0a500',
  brand_deep         TEXT NOT NULL DEFAULT '#0a2540',
  portal_url         TEXT,
  facebook_url       TEXT,
  instagram_url      TEXT,
  x_url              TEXT,
  youtube_url        TEXT,
  tiktok_url         TEXT,
  whatsapp_number    TEXT,
  stat_students      INTEGER NOT NULL DEFAULT 0,
  stat_teachers      INTEGER NOT NULL DEFAULT 0,
  stat_clubs         INTEGER NOT NULL DEFAULT 0,
  stat_pass_rate     TEXT,
  updated_at         TEXT
);
INSERT INTO web_setting (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------- the admin: users and permission sets
-- A Permission Set, in the Business Central sense the management system uses: a named role
-- whose access is a list of lines, each granting rights on one object. is_system = TRUE is the
-- System Administrator — full access implied by the flag, with no lines at all.
CREATE TABLE IF NOT EXISTS web_role (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  description  TEXT,
  is_system    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TEXT NOT NULL,
  created_by   TEXT
);

-- One line of a Permission Set: rights on one Object, which is either a database TABLE
-- (Read / Insert / Modify / Delete) or an application PAGE (Execute — may this screen be
-- reached at all).
CREATE TABLE IF NOT EXISTS web_permission_line (
  id            SERIAL PRIMARY KEY,
  role_id       INTEGER NOT NULL REFERENCES web_role(id) ON DELETE CASCADE,
  object_type   TEXT NOT NULL,           -- 'TABLE' | 'PAGE'
  object_name   TEXT NOT NULL,           -- 'web_post' | 'NEWS'
  read_perm     BOOLEAN NOT NULL DEFAULT FALSE,
  insert_perm   BOOLEAN NOT NULL DEFAULT FALSE,
  modify_perm   BOOLEAN NOT NULL DEFAULT FALSE,
  delete_perm   BOOLEAN NOT NULL DEFAULT FALSE,
  execute_perm  BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (role_id, object_type, object_name)
);
CREATE INDEX IF NOT EXISTS ix_web_permission_line_role ON web_permission_line(role_id);

CREATE TABLE IF NOT EXISTS web_user (
  id             SERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  -- The primary Permission Set. Further sets may be granted in web_user_role, and single
  -- objects overridden per user in web_user_permission_line.
  role_id        INTEGER REFERENCES web_role(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'ACTIVE',
  title          TEXT,
  avatar_url     TEXT,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at  TEXT,
  created_at     TEXT NOT NULL,
  created_by     TEXT
);

-- Business Central "User Permission Sets": a user may hold more than one. Effective rights are
-- the union of the primary role and every set listed here.
CREATE TABLE IF NOT EXISTS web_user_role (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES web_user(id) ON DELETE CASCADE,
  role_id     INTEGER NOT NULL REFERENCES web_role(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  created_by  TEXT,
  UNIQUE (user_id, role_id)
);
CREATE INDEX IF NOT EXISTS ix_web_user_role_user ON web_user_role(user_id);

-- A per-user override. A row here REPLACES whatever the user's roles say about that one object,
-- so one person can be restricted or enhanced without a Permission Set being edited for everyone.
CREATE TABLE IF NOT EXISTS web_user_permission_line (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES web_user(id) ON DELETE CASCADE,
  object_type   TEXT NOT NULL,
  object_name   TEXT NOT NULL,
  read_perm     BOOLEAN NOT NULL DEFAULT FALSE,
  insert_perm   BOOLEAN NOT NULL DEFAULT FALSE,
  modify_perm   BOOLEAN NOT NULL DEFAULT FALSE,
  delete_perm   BOOLEAN NOT NULL DEFAULT FALSE,
  execute_perm  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TEXT,
  created_by    TEXT,
  UNIQUE (user_id, object_type, object_name)
);
CREATE INDEX IF NOT EXISTS ix_web_user_permission_line_user ON web_user_permission_line(user_id);

CREATE TABLE IF NOT EXISTS web_session (
  token       TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES web_user(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  ip          TEXT,
  user_agent  TEXT
);
CREATE INDEX IF NOT EXISTS ix_web_session_user ON web_session(user_id);

CREATE TABLE IF NOT EXISTS web_audit (
  id          SERIAL PRIMARY KEY,
  actor_id    INTEGER,
  actor_name  TEXT NOT NULL,
  action      TEXT NOT NULL,
  entity      TEXT NOT NULL,
  entity_id   TEXT,
  detail      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_web_audit_created ON web_audit(created_at DESC);

-- -------------------------------------------------------- academic structure
-- What the school teaches. Held here rather than read out of the management
-- system: the website publishes what the school wants published, and nothing
-- on this site can reach a pupil record.
CREATE TABLE IF NOT EXISTS web_level (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  tagline       TEXT,
  description   TEXT,
  age_note      TEXT,
  entry_note    TEXT,
  image_url     TEXT,
  sort          INTEGER NOT NULL DEFAULT 0,
  is_published  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS web_grade (
  id        SERIAL PRIMARY KEY,
  level_id  INTEGER NOT NULL REFERENCES web_level(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  sort      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_web_grade_level ON web_grade(level_id);

CREATE TABLE IF NOT EXISTS web_subject (
  id        SERIAL PRIMARY KEY,
  level_id  INTEGER NOT NULL REFERENCES web_level(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  is_core   BOOLEAN NOT NULL DEFAULT TRUE,
  sort      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_web_subject_level ON web_subject(level_id);

CREATE TABLE IF NOT EXISTS web_term (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  year_name   TEXT NOT NULL,
  start_date  TEXT NOT NULL,
  end_date    TEXT NOT NULL,
  is_current  BOOLEAN NOT NULL DEFAULT FALSE,
  note        TEXT
);
CREATE INDEX IF NOT EXISTS ix_web_term_start ON web_term(start_date);

CREATE TABLE IF NOT EXISTS web_fee (
  id            SERIAL PRIMARY KEY,
  term_id       INTEGER NOT NULL REFERENCES web_term(id) ON DELETE CASCADE,
  grade_id      INTEGER NOT NULL REFERENCES web_grade(id) ON DELETE CASCADE,
  item          TEXT NOT NULL,
  amount_cents  BIGINT NOT NULL DEFAULT 0,
  -- ALL (compulsory) | BOARDER | DAY | OPT_IN
  applies_to    TEXT NOT NULL DEFAULT 'ALL',
  sort          INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_web_fee_term ON web_fee(term_id, grade_id);

-- ------------------------------------------------------------------- news
-- Announcements and news articles — the thing the school posts most often.
CREATE TABLE IF NOT EXISTS web_post (
  id            SERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  -- NOTICE (a short notice to parents) | NEWS | ACHIEVEMENT | CIRCULAR
  category      TEXT NOT NULL DEFAULT 'NOTICE',
  excerpt       TEXT,
  body          TEXT NOT NULL,
  image_url     TEXT,
  attachment_url TEXT,
  audience      TEXT NOT NULL DEFAULT 'ALL',
  is_published  BOOLEAN NOT NULL DEFAULT FALSE,
  is_pinned     BOOLEAN NOT NULL DEFAULT FALSE,
  published_at  TEXT NOT NULL,
  expires_at    TEXT,
  views         INTEGER NOT NULL DEFAULT 0,
  author        TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT
);
CREATE INDEX IF NOT EXISTS ix_web_post_published ON web_post(is_published, published_at DESC);

-- ----------------------------------------------------------------- events
CREATE TABLE IF NOT EXISTS web_event (
  id            SERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  summary       TEXT,
  body          TEXT,
  image_url     TEXT,
  -- ACADEMIC | SPORT | ARTS | COMMUNITY | PARENTS | HOLIDAY
  category      TEXT NOT NULL DEFAULT 'ACADEMIC',
  location      TEXT,
  starts_at     TEXT NOT NULL,
  ends_at       TEXT,
  all_day       BOOLEAN NOT NULL DEFAULT FALSE,
  is_published  BOOLEAN NOT NULL DEFAULT FALSE,
  rsvp_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  capacity      INTEGER,
  created_at    TEXT NOT NULL,
  updated_at    TEXT
);
CREATE INDEX IF NOT EXISTS ix_web_event_starts ON web_event(starts_at);

CREATE TABLE IF NOT EXISTS web_rsvp (
  id          SERIAL PRIMARY KEY,
  event_id    INTEGER NOT NULL REFERENCES web_event(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  email       TEXT,
  guests      INTEGER NOT NULL DEFAULT 1,
  message     TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_web_rsvp_event ON web_rsvp(event_id);

-- ---------------------------------------------------------------- gallery
CREATE TABLE IF NOT EXISTS web_album (
  id            SERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  description   TEXT,
  cover_url     TEXT,
  taken_on      TEXT,
  sort          INTEGER NOT NULL DEFAULT 0,
  is_published  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS web_photo (
  id        SERIAL PRIMARY KEY,
  album_id  INTEGER NOT NULL REFERENCES web_album(id) ON DELETE CASCADE,
  url       TEXT NOT NULL,
  caption   TEXT,
  sort      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_web_photo_album ON web_photo(album_id);

-- ------------------------------------------------------------------ people
CREATE TABLE IF NOT EXISTS web_staff (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  role_title    TEXT NOT NULL,
  -- LEADERSHIP | TEACHING | ADMIN | BOARD
  category      TEXT NOT NULL DEFAULT 'TEACHING',
  qualification TEXT,
  bio           TEXT,
  photo_url     TEXT,
  email         TEXT,
  sort          INTEGER NOT NULL DEFAULT 0,
  is_published  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS web_testimonial (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  role_title    TEXT,
  quote         TEXT NOT NULL,
  photo_url     TEXT,
  rating        INTEGER NOT NULL DEFAULT 5,
  sort          INTEGER NOT NULL DEFAULT 0,
  is_published  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS web_faq (
  id            SERIAL PRIMARY KEY,
  question      TEXT NOT NULL,
  answer        TEXT NOT NULL,
  -- ADMISSIONS | FEES | TRANSPORT | ACADEMICS | GENERAL
  category      TEXT NOT NULL DEFAULT 'ADMISSIONS',
  sort          INTEGER NOT NULL DEFAULT 0,
  is_published  BOOLEAN NOT NULL DEFAULT TRUE
);

-- --------------------------------------------------------------- transport
CREATE TABLE IF NOT EXISTS web_route (
  id            SERIAL PRIMARY KEY,
  code          TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  fare_cents    BIGINT NOT NULL DEFAULT 0,
  is_published  BOOLEAN NOT NULL DEFAULT TRUE,
  sort          INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS web_stop (
  id            SERIAL PRIMARY KEY,
  route_id      INTEGER NOT NULL REFERENCES web_route(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  pickup_time   TEXT,
  dropoff_time  TEXT,
  sort          INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_web_stop_route ON web_stop(route_id);

-- ------------------------------------------------- what visitors send us
-- The only tables an anonymous visitor can insert into. Every write into them
-- goes through a validated, rate-limited Server Action.
CREATE TABLE IF NOT EXISTS web_enquiry (
  id              SERIAL PRIMARY KEY,
  -- ENQUIRY | TOUR
  kind            TEXT NOT NULL DEFAULT 'ENQUIRY',
  name            TEXT NOT NULL,
  phone           TEXT NOT NULL,
  email           TEXT,
  grade_id        INTEGER REFERENCES web_grade(id) ON DELETE SET NULL,
  message         TEXT,
  preferred_date  TEXT,
  preferred_time  TEXT,
  visitors        INTEGER,
  source_page     TEXT,
  -- NEW | CONTACTED | TOUR_BOOKED | APPLIED | ENROLLED | LOST
  status          TEXT NOT NULL DEFAULT 'NEW',
  notes           TEXT,
  created_at      TEXT NOT NULL,
  handled_by      TEXT,
  handled_at      TEXT
);
CREATE INDEX IF NOT EXISTS ix_web_enquiry_status ON web_enquiry(status);
CREATE INDEX IF NOT EXISTS ix_web_enquiry_created ON web_enquiry(created_at DESC);

CREATE TABLE IF NOT EXISTS web_application (
  id                    SERIAL PRIMARY KEY,
  no                    TEXT NOT NULL UNIQUE,
  first_name            TEXT NOT NULL,
  middle_name           TEXT,
  last_name             TEXT NOT NULL,
  date_of_birth         TEXT,
  gender                TEXT,
  previous_school       TEXT,
  grade_id              INTEGER REFERENCES web_grade(id) ON DELETE SET NULL,
  boarding_status       TEXT NOT NULL DEFAULT 'DAY',
  transport_route       TEXT,
  medical               TEXT,
  guardian_name         TEXT NOT NULL,
  guardian_relationship TEXT,
  guardian_phone        TEXT NOT NULL,
  guardian_email        TEXT,
  message               TEXT,
  photo_consent         BOOLEAN NOT NULL DEFAULT FALSE,
  -- RECEIVED | REVIEWING | ASSESSMENT | OFFERED | ACCEPTED | DECLINED | WITHDRAWN
  status                TEXT NOT NULL DEFAULT 'RECEIVED',
  notes                 TEXT,
  source_page           TEXT,
  created_at            TEXT NOT NULL,
  handled_by            TEXT,
  handled_at            TEXT
);
CREATE INDEX IF NOT EXISTS ix_web_application_status ON web_application(status);

CREATE TABLE IF NOT EXISTS web_subscriber (
  id          SERIAL PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT,
  status      TEXT NOT NULL DEFAULT 'ACTIVE',
  source_page TEXT,
  created_at  TEXT NOT NULL
);

-- Sequence used to number applications within a calendar year.
CREATE TABLE IF NOT EXISTS web_counter (
  key    TEXT PRIMARY KEY,
  value  INTEGER NOT NULL DEFAULT 0
);

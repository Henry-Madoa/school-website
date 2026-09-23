# School Website

The school's public website and the admin the school runs it from — deliberately a **separate
application** from the management system, with its own database, its own logins and its own
deployment.

That separation is the whole point. The website is the one thing on the school's network that the
entire internet can reach, and it holds no pupil record, no mark, no register and no fee balance.
The academic structure, term dates and fee structure it publishes are what the school has chosen
to *make public*; the management system remains the record of what any individual owes or scored.
The only link between the two is a hyperlink to the parent portal.

Built with **Next.js 16 (App Router) and TypeScript**. Pages are React Server Components that
query the domain layer directly and every mutation is a Server Action, so there is no REST layer
between the screen and the business logic. **PostgreSQL** holds the content, **Cloudinary** holds
the images.

---

## Running it

```bash
npm install
cp .env.local.example .env.local   # then fill in DATABASE_URL and the Cloudinary keys
npm run db:setup                   # creates the schema and a demonstration school
npm run dev
```

Then open **http://localhost:3000**, and the admin at **/admin/login**.

`db:setup` prints the first administrator's email and password once. It is not stored anywhere and
is not recoverable — if you lose it, run `npm run db:setup` again against an empty `web_user`
table, or reset the password from another administrator's account.

### Every command

```bash
npm run dev         # development server
npm run build       # production build
npm start           # run the production build
npm test            # the integrity suite — 127 checks against the live database
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run db:setup    # apply the schema, then seed whatever is empty
npm run db:check    # is the database reachable, and what is in it?
npm run seed        # seed only (for a schema managed elsewhere)
npm run db:reset    # DESTROYS every web_ table and rebuilds — needs CONFIRM_RESET=yes
```

### Configuration

| Variable | What it is for |
|---|---|
| `DATABASE_URL` | PostgreSQL. **Required.** |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Image uploads. Without them the admin still runs; the upload fields say so. |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | The same cloud name, for building delivery URLs in the browser. |
| `CLOUDINARY_FOLDER` | Where uploads land. Defaults to `school-website`. |
| `NEXT_PUBLIC_SITE_URL` | This site's own address — canonical URLs, the sitemap, Open Graph tags. |
| `NEXT_PUBLIC_PORTAL_URL` | Where "Parent Portal" points. Overridden by the portal address in Admin → School profile. |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | The first administrator, used by `db:setup` on an empty database. |
| `SEED_DEMO_DATA=false` | Seed the Permission Sets and the first account only, with no demonstration content. |

#### Sharing a database with the management system

Every table this project owns is prefixed `web_`, so pointing `DATABASE_URL` at a database the
management system already uses will not collide with it — which is handy for getting started.
**A database of its own is better**, and is the point of running the website separately: create an
empty database, change the name in `DATABASE_URL`, and run `npm run db:setup` against it. Nothing
else changes. `npm run db:reset` only ever touches `web_` tables, so it cannot take a ledger with it.

---

## The public website

| Page | What it is |
|---|---|
| `/` | Hero, the school's figures, why families choose it, levels, latest news, what's on, photographs, testimonials, the admissions steps and an enquiry form |
| `/about` | The school's story, mission, leadership, campus, testimonials |
| `/staff` | Every published profile, filterable by name or section |
| `/academics` · `/academics/[level]` · `/academics/calendar` | What is taught at each level, and term dates |
| `/admissions` · `/apply` · `/fees` · `/tour` | How to apply, the four-step online application, the published fee structure, and visit booking |
| `/news` · `/news/[slug]` | Notices and news, searchable, with structured data |
| `/events` · `/events/[slug]` | The calendar, with booking where the school asks for it, and a downloadable `.ics` |
| `/gallery` · `/gallery/[slug]` | Albums with a keyboard-navigable lightbox |
| `/student-life`, `/school-bus`, `/contact`, `/privacy`, `/search` | A day here; routes, stops and times; how to reach the office; the data-protection notice; site search |

Built phone-first, because that is how almost every parent will meet the school: one-column
layouts, 44px tap targets, and no animation at all for a visitor whose system asks for stillness.
Every page carries `schema.org` structured data — `School`, `NewsArticle`, `Event`, `FAQPage` —
so a search engine or an assistant can answer "when does term start" without the parent visiting.

### What a visitor may write

Five things, and nothing else on the site accepts a POST from somebody who is not signed in: an
enquiry, a visit booking, an online application, an event booking and a newsletter sign-up. Each
one is validated server-side, rate-limited by address (a burst limit and an hourly ceiling),
screened by a honeypot field, and recorded against a synthetic `website` actor rather than a login.

---

## The admin

`/admin`, behind a sign-in. Records are edited **in place on their card** rather than in pop-ups —
the pattern the school's management system uses, so the people who use both do not have to learn
two habits.

| Section | Screens |
|---|---|
| **Publishing** | News & notices · Events and their bookings · Photo gallery · Staff & leadership · Testimonials · Questions parents ask |
| **The school** | Academic structure (levels, grades, learning areas) · Term dates · Fee structure · Bus routes and stops |
| **Admissions** | Enquiries & visits, worked as a pipeline · Applications · Newsletter list |
| **Setup** | School profile, contact details, appearance and the figures on the home page |
| **Security** | Users · Permission Sets · Audit trail |

Publishing a notice makes it live on the website before the redirect lands: every write
revalidates the pages it affects.

### Permission Sets

Access is modelled the way the management system models it — **Business Central-style Permission
Sets**. A role's access is a list of lines, each granting rights on one object:

- a **TABLE** (`web_post`, `web_enquiry`, …) with Read / Insert / Modify / Delete
- a **PAGE** (`NEWS`, `ENQUIRIES`, …) with Execute — may this screen be reached at all

Both are needed. Modify on notices without Execute on the News page grants nobody anything;
Execute on the page without Read on the table opens a screen that cannot load.

Business operations are rarely one table right, so `lib/permissions.ts` carries an **ACTIONS**
registry: one named grant of *(owning page, table rights\[\])* per operation, built from what the
Server Actions actually read and write. A call site asks for one action —
`requireAction('NEWS_CREATE')` — and both halves are checked together. The administrator still
configures tables and pages; ACTIONS is a registry for the code, not a third kind of object.

Six sets are seeded, and every one of them is an ordinary row an administrator can edit line by
line or delete:

| Set | For |
|---|---|
| **System Administrator** | Unrestricted. Carries **no lines at all** — access comes from a flag, so there is no wildcard row anybody can delete by mistake. |
| **Website Editor** | News, events, photographs, staff, questions. Cannot see enquiries. |
| **Admissions Officer** | Enquiries, visits, applications, term dates and the fee structure. |
| **Communications Officer** | Notices, events, bookings and the newsletter list. |
| **Academic Registrar** | The academic structure, terms, fees and bus routes. |
| **Read Only** | Every screen, nothing changed. For a head teacher, a governor or an auditor. |

A person holds one set as their primary role and may hold others as well — rights are the union.
A **per-user exception** replaces what their sets say about one object, for restricting or
extending one person without editing a set everybody else holds.

Three rules are enforced in the domain layer, not in the UI:

1. **Only a System Administrator may change who can do what.** Table rights on `web_role` are not
   enough — an editor granted Modify there could otherwise write themselves every right in the
   catalogue.
2. **The last active System Administrator cannot be demoted, disabled or deleted.** Locking
   everybody out of the admin should not be one mis-click away.
3. **Every Server Action re-checks.** A Server Action is a POST endpoint the whole internet can
   reach; the screen that rendered the form having checked the right proves nothing about the
   request that arrives.

### The audit trail

Every create, change and delete, every sign-in, and every failed sign-in with the address that was
tried. Content disappearing without explanation is the commonest support call a school website
generates, and this is the answer to it.

---

## How it is put together

```
app/
  (site)/              the public website — its own layout, navigation and stylesheet
  admin/
    login/             sign-in, outside the guarded layout
    (dashboard)/       everything behind the sign-in: guard, sidebar, screens
  actions/
    public.ts          the five things a visitor may write
    content.ts         every content write the admin makes
    security.ts        Permission Sets and accounts
    auth.ts            sign in, sign out, change your own password
lib/
  db.ts                a pg pool, three query helpers, the audit trail
  schema.sql           the whole schema, idempotent
  seed.ts              schema application and the demonstration school
  auth.ts              sessions, and the guards every page and action calls
  permissions.ts       the pages catalogue, the ACTIONS registry and the checks
  roles.ts             Permission Sets and accounts
  site.ts              the public read layer — published content only
  content.ts           the admin read/write layer — drafts included
  inbox.ts             enquiries, applications, bookings, subscribers
  cloudinary-server.ts uploads (server only)   cloudinary.ts  delivery URLs (safe anywhere)
proxy.ts               security headers, and the pathname for the layouts
test/verify.ts         the integrity suite
```

### Decisions worth knowing about

**SQL, not an ORM.** `lib/db.ts` is a connection pool and three helpers. `?` and `@named`
placeholders are rewritten to `$1..$n`, and an INSERT gets `RETURNING id` so `run()` hands back the
new row's id. Values are always bound, never interpolated; the two places a string is interpolated
into SQL — a `LIMIT` and a table name — take a clamped integer and a literal from this codebase.

**Sessions in the database, not a JWT.** A random 32-byte token in an httpOnly cookie, its SHA-256
in `web_session`. Nothing about the user travels in the cookie, so revoking a session, disabling an
account or taking a right out of a Permission Set takes effect on the very next request.

**Dates as ISO-8601 text, money as integer cents.** A date renders identically on the server and
in the browser, so hydration stays quiet; money is never a float.

**Images through Cloudinary, not `next/image`.** Cloudinary already resizes, negotiates format and
serves from a CDN, at the edge rather than in the Node process. `cdn()` asks for the exact size
each place needs. Running both would pay for the work twice and lose Cloudinary's cache.

**Runtime theming.** The school's three colours live in the settings row and are applied as CSS
custom properties per request, so a school can change its colours — across the website *and* the
admin, including gradients and focus rings — without a deployment.

**No self-service password reset.** An email inbox is not proof of anything, and an admin with a
handful of accounts does not need one. A System Administrator sets a new password, which ends every
session that account has open and forces a change at the next sign-in.

---

## Deploying

It is an ordinary Next.js application: `npm run build`, then `npm start` behind a reverse proxy, or
push it to any host that runs Next 16. Two things to do first:

1. Point `DATABASE_URL` at the production database and run `npm run db:setup` once against it,
   with `SEED_DEMO_DATA=false` unless you want the demonstration school.
2. Set `NEXT_PUBLIC_SITE_URL` to the real address, or the sitemap, the canonical URLs and every
   Open Graph tag will advertise `localhost`.

`proxy.ts` sets the security headers — a Content-Security-Policy naming Cloudinary and Google
Fonts explicitly, `X-Frame-Options`, `Referrer-Policy`, and `no-store` on everything behind the
sign-in. Sessions are rate-limited in process, which is per-instance: put a CDN or a WAF in front
if the site is likely to be attacked rather than merely visited.

---

## Testing

```bash
npm test
```

127 checks against the live database — the SQL, the placeholder binding, validation, slugs and
numbering, the permission engine, password hashing, rate limiting, every public write path, the
published-content rules and the audit trail. Everything it creates carries a marker and is deleted
again at the end, so it is safe to run against a database with real content in it. It is not a unit
test suite and does not pretend to be one: it answers the question a deployment actually needs
answered, which is whether this build works against this database.

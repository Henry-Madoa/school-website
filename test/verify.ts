/*
 * The integrity suite.
 *
 * It exercises the layers the browser cannot easily be pointed at: the SQL, the validation, the
 * permission engine and the slug and numbering rules. Everything it creates is created with a
 * recognisable marker and deleted again at the end, so it is safe to run against the live
 * database — which is the only way to test SQL that is worth anything.
 *
 *   npm test
 *
 * It is not a unit test suite and does not pretend to be one. It answers the question a
 * deployment actually needs answered: does this build work against this database?
 */
import { pool, all, one, run, value } from '../lib/db.ts';
import * as v from '../lib/validate.ts';
import { slugify, uniqueSlug } from '../lib/slugify.ts';
import { formatMoney, formatDate, truncate, initials, whatsappHref } from '../lib/format.ts';
import { rateLimit } from '../lib/rate-limit.ts';
import {
  ACTIONS, PAGES, canAction, canPage, canTable, expandActionsToLines, linesToPermissions,
  listPermissionTables, visiblePages, type ActionKey,
} from '../lib/permissions.ts';
import { mergeLines, linesFromForm } from '../lib/roles.ts';
import { createEnquiry, createApplication, subscribe, createRsvp, setEnquiryStatus, inboxSummary } from '../lib/inbox.ts';
import { hashPassword, verifyPassword } from '../lib/password.ts';
import { getSettings, getPosts, getLevels, getFees, search } from '../lib/site.ts';
import type { Actor } from '../lib/db.ts';

const MARKER = `verify-${Date.now()}`;
const TESTER: Actor = { id: 0, name: 'verify', email: 'verify@test' };

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: unknown, detail = ''): void {
  if (condition) {
    passed += 1;
    return;
  }
  failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

async function throws(name: string, fn: () => Promise<unknown> | unknown, expect?: string): Promise<void> {
  try {
    await fn();
    failures.push(`${name} — expected it to be rejected, but it was accepted`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (expect && !message.toLowerCase().includes(expect.toLowerCase())) {
      failures.push(`${name} — rejected, but for the wrong reason: ${message}`);
      return;
    }
    passed += 1;
  }
}

async function section(title: string, fn: () => Promise<void>): Promise<void> {
  process.stdout.write(`  ${title.padEnd(34)}`);
  const before = failures.length;
  const started = Date.now();
  try {
    await fn();
  } catch (error) {
    failures.push(`${title} — threw: ${error instanceof Error ? error.message : String(error)}`);
  }
  const broke = failures.length - before;
  console.log(`${broke ? '✗' : '✓'} ${String(Date.now() - started).padStart(5)} ms`);
}

/* ============================================================================ run */

console.log('\n  Website integrity suite\n');

/* ------------------------------------------------------------------ the database */
await section('Connection and schema', async () => {
  const version = await value<string>('SELECT version()');
  check('database reachable', typeof version === 'string' && version.includes('PostgreSQL'));

  const tables = (await all<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename LIKE 'web%'",
  )).map((row) => row.tablename);

  for (const table of ['web_setting', 'web_role', 'web_permission_line', 'web_user', 'web_post', 'web_enquiry', 'web_audit']) {
    check(`${table} exists`, tables.includes(table), 'run `npm run db:setup`');
  }

  // Only this application's tables are in the permission editor — a shared database must not
  // expose the management system's tables to somebody editing a Permission Set.
  const offered = await listPermissionTables();
  check('permission tables are web_ only', offered.every((table) => table.name.startsWith('web_')));
  check('session table is never grantable', !offered.some((table) => table.name === 'web_session'));
  check('permission storage is never grantable', !offered.some((table) => table.name === 'web_permission_line'));
});

/* ------------------------------------------------------- placeholders and binding */
await section('Query binding', async () => {
  const positional = await one<{ a: number; b: string }>('SELECT ?::int AS a, ?::text AS b', 7, 'seven');
  check('positional placeholders', positional?.a === 7 && positional.b === 'seven');

  const named = await one<{ a: number; b: number }>('SELECT @x::int AS a, @y::int AS b', { x: 3, y: 4 });
  check('named placeholders', named?.a === 3 && named.b === 4);

  const repeated = await one<{ a: number; b: number }>('SELECT @n::int AS a, @n::int AS b', { n: 9 });
  check('a named placeholder may repeat', repeated?.a === 9 && repeated.b === 9);

  const array = await all<{ n: number }>('SELECT unnest(@ids::int[]) AS n', { ids: [1, 2, 3] });
  check('array parameters', array.length === 3);

  // The whole point of binding: a quote in a value must never become SQL.
  const nasty = await one<{ t: string }>('SELECT ?::text AS t', "Robert'); DROP TABLE web_post;--");
  check('values cannot become SQL', nasty?.t.includes('DROP TABLE'));
  check('web_post survived', (await value<number>('SELECT COUNT(*)::int FROM web_post')) !== undefined);
});

/* ------------------------------------------------------------------- validation */
await section('Validation', async () => {
  check('text trims and collapses', v.text('  a   b  ') === 'a b');
  check('text caps length', (v.text('x'.repeat(900), 100) ?? '').length === 100);
  check('empty text becomes null', v.text('   ') === null);
  check('richText keeps paragraphs', v.richText('one\n\ntwo') === 'one\n\ntwo');
  check('richText collapses runs of blank lines', v.richText('one\n\n\n\n\ntwo') === 'one\n\ntwo');
  check('money parses to cents', v.money('1,500.50') === 150_050);
  check('money survives rubbish', v.money('KSh 34000') === 3_400_000);
  check('integer clamps', v.integer(999, 1, 20) === 20);
  check('boolean reads a checkbox', v.boolean('on') && v.boolean('1') && !v.boolean(''));
  check('email lowercases', v.email('A@B.CO') === 'a@b.co');
  check('isoDateTime normalises a local stamp', v.isoDateTime('2026-01-06T14:30') === '2026-01-06T14:30:00.000Z');

  await throws('a bad email is rejected', () => v.email('not-an-email'), 'email address');
  await throws('a bad phone is rejected', () => v.phone('abc'), 'phone number');
  await throws('a javascript: URL is rejected', () => v.url('javascript:alert(1)'), 'http');
  await throws('a short password is rejected', () => v.password('short'), '10 characters');
  await throws('an unknown choice is rejected', () => v.choice('NONSENSE', ['A', 'B'] as const, 'status'), 'valid');
  await throws('a required field cannot be blank', () => v.required('   ', 'A title'), 'required');

  // Control characters are stripped: they break layout and hide content in a log.
  check('control characters are stripped', v.text('a\u0000\u0007b') === 'ab');
});

/* ------------------------------------------------------------------------ slugs */
await section('Slugs', async () => {
  check('slugify', slugify('Term 2 opens — reporting times!') === 'term-2-opens-reporting-times');
  check('slugify handles accents', slugify('Café Société') === 'cafe-societe');
  check('slugify never returns empty', slugify('!!!') === 'untitled');

  const first = await uniqueSlug('web_post', `${MARKER} duplicate title`);
  await run(
    `INSERT INTO web_post (title, slug, category, body, is_published, published_at, created_at)
     VALUES (?,?, 'NOTICE', ?, FALSE, ?, ?)`,
    `${MARKER} duplicate title`, first, MARKER, new Date().toISOString(), new Date().toISOString(),
  );
  const second = await uniqueSlug('web_post', `${MARKER} duplicate title`);
  check('a clashing slug gets a suffix', second === `${first}-2`, `${first} then ${second}`);
});

/* ------------------------------------------------------- the permission engine */
await section('Permission engine', async () => {
  // Every action must point at a page that exists, or a right can never be granted.
  const codes = new Set(PAGES.map((page) => page.code));
  const orphans = (Object.keys(ACTIONS) as ActionKey[]).filter((key) => !codes.has(ACTIONS[key].page));
  check('every action owns a real page', orphans.length === 0, orphans.join(', '));

  // Every table an action names must exist, or the action can never be satisfied.
  const tables = new Set((await listPermissionTables()).map((table) => table.name));
  const missing = (Object.keys(ACTIONS) as ActionKey[])
    .flatMap((key) => ACTIONS[key].tables.map(([table]) => table))
    .filter((table) => !tables.has(table));
  check('every action names a real table', missing.length === 0, [...new Set(missing)].join(', '));

  // Every child page's parent must exist, or the sidebar cannot place it.
  const badParents = PAGES.filter((page) => page.parent && !codes.has(page.parent));
  check('every child page has a real parent', badParents.length === 0);

  const nobody = { is_system: false, permissions: { tables: {}, pages: {} } };
  check('an empty set grants nothing', !canAction(nobody, 'NEWS_READ') && !canPage(nobody, 'NEWS'));
  check('an empty set sees no sidebar', visiblePages(nobody).length === 0);

  const root = { is_system: true, permissions: { tables: {}, pages: {} } };
  check('the system flag grants everything', canAction(root, 'ROLES_MANAGE') && canPage(root, 'SECURITY_USERS'));
  check('the system flag fills the sidebar', visiblePages(root).length > 5);

  const editor = { is_system: false, permissions: linesToPermissions(expandActionsToLines(['NEWS_CREATE', 'NEWS_UPDATE'])) };
  check('a granted action is allowed', canAction(editor, 'NEWS_CREATE'));
  check('insert implies read', canTable(editor, 'web_post', 'read'));
  check('insert does not imply delete', !canTable(editor, 'web_post', 'delete'));
  check('an ungranted action is refused', !canAction(editor, 'ENQUIRIES_READ'));
  check('an ungranted page is refused', !canPage(editor, 'SECURITY_USERS'));
  check('news appears in their sidebar', visiblePages(editor).some((page) => page.code === 'NEWS'));
  check('security does not', !visiblePages(editor).some((page) => page.code === 'SECURITY'));

  // A child screen must drag its module in, or it is unreachable in the sidebar.
  const fees = linesToPermissions(expandActionsToLines(['FEES_MANAGE']));
  check('a child screen grants its module', !!fees.pages.ACADEMICS && !!fees.pages.ACADEMICS_FEES);

  // Merging is a union: adding a grant never removes one.
  const merged = mergeLines(
    expandActionsToLines(['NEWS_CREATE']),
    expandActionsToLines(['EVENTS_CREATE']),
  );
  const both = linesToPermissions(merged);
  check('merging keeps both grants', !!both.pages.NEWS && !!both.pages.EVENTS);

  // The editor's grid posts checkboxes; they must come back as the same lines.
  const form = new FormData();
  form.set('perm:PAGE:NEWS:execute', '1');
  form.set('perm:TABLE:web_post:modify', '1');
  form.set('perm:TABLE:web_post:read', '1');
  form.set('ignored-field', 'x');
  const fromForm = linesToPermissions(linesFromForm(form));
  check('the grid round-trips', !!fromForm.pages.NEWS && !!fromForm.tables.web_post?.modify);
  check('unrelated form fields are ignored', Object.keys(fromForm.tables).length === 1);
});

/* ---------------------------------------------------------------- the seeded sets */
await section('Seeded Permission Sets', async () => {
  const roles = await all<{ id: number; name: string; is_system: boolean }>('SELECT id, name, is_system FROM web_role');
  check('sets exist', roles.length > 0, 'run `npm run db:setup`');
  check('exactly one system set', roles.filter((role) => role.is_system).length === 1);

  const system = roles.find((role) => role.is_system)!;
  const systemLines = await value<number>('SELECT COUNT(*)::int FROM web_permission_line WHERE role_id = ?', system.id);
  check('the system set carries no lines', Number(systemLines) === 0, 'its access comes from the flag');

  const editor = roles.find((role) => role.name === 'Website Editor');
  if (editor) {
    const lines = await all<import('../lib/types.ts').PermissionLine>(
      'SELECT object_type, object_name, read_perm, insert_perm, modify_perm, delete_perm, execute_perm FROM web_permission_line WHERE role_id = ?',
      editor.id,
    );
    const holder = { is_system: false, permissions: linesToPermissions(lines) };
    check('Website Editor may publish a notice', canAction(holder, 'NEWS_CREATE'));
    check('Website Editor may not read enquiries', !canAction(holder, 'ENQUIRIES_READ'));
    check('Website Editor may not manage users', !canAction(holder, 'USERS_MANAGE'));
  }

  // At least one live account must be able to reach Security, or the site is locked.
  const admins = await value<number>(
    `SELECT COUNT(DISTINCT u.id)::int FROM web_user u
     LEFT JOIN web_role r ON r.id = u.role_id
     LEFT JOIN web_user_role ur ON ur.user_id = u.id
     LEFT JOIN web_role e ON e.id = ur.role_id
     WHERE u.status = 'ACTIVE' AND (r.is_system OR e.is_system)`,
  );
  check('at least one active System Administrator', Number(admins) >= 1);
});

/* -------------------------------------------------------------------- passwords */
await section('Passwords', async () => {
  const hash = await hashPassword('a-long-enough-password');
  check('bcrypt hash shape', hash.startsWith('$2'));
  check('the right password verifies', await verifyPassword('a-long-enough-password', hash));
  check('the wrong password does not', !(await verifyPassword('something-else', hash)));
  check('a missing account still runs a comparison', (await verifyPassword('anything', null)) === false);
  await throws('an over-long password is rejected', () => hashPassword('x'.repeat(200)), '72');
});

/* ------------------------------------------------------------------ rate limiting */
await section('Rate limiting', async () => {
  const key = `verify:${MARKER}`;
  check('the first is allowed', rateLimit(key, 3, 60_000).ok);
  check('the second is allowed', rateLimit(key, 3, 60_000).ok);
  check('the third is allowed', rateLimit(key, 3, 60_000).ok);
  check('the fourth is refused', !rateLimit(key, 3, 60_000).ok);
  check('a different key is unaffected', rateLimit(`${key}:other`, 3, 60_000).ok);
});

/* -------------------------------------------------------------- what visitors send */
let enquiryId = 0;
await section('Enquiries and applications', async () => {
  const grade = await one<{ id: number }>('SELECT id FROM web_grade ORDER BY id LIMIT 1');

  const enquiry = await createEnquiry({
    name: `${MARKER} Parent`,
    phone: '0722 000 111',
    email: `${MARKER}@example.com`,
    gradeId: grade?.id,
    message: 'Is there a place in Grade 5?',
    sourcePage: '/verify',
  });
  enquiryId = enquiry.id;
  check('an enquiry is captured', enquiry.id > 0);
  check('it gets a readable reference', /^ENQ-\d{4}$/.test(enquiry.reference));

  await throws('an enquiry needs a phone number', () => createEnquiry({ name: 'X', phone: '' }), 'phone');
  await throws('an enquiry needs a name', () => createEnquiry({ name: '', phone: '0722000111' }), 'required');
  await throws('a tour needs a date', () => createEnquiry({ kind: 'TOUR', name: 'X', phone: '0722000111' }), 'day');
  await throws(
    'a tour cannot be in the past',
    () => createEnquiry({ kind: 'TOUR', name: 'X', phone: '0722000111', preferredDate: '2020-01-01' }),
    'future',
  );
  await throws(
    'an unknown grade is refused',
    () => createEnquiry({ name: 'X', phone: '0722000111', gradeId: 999_999 }),
    'grade',
  );

  await setEnquiryStatus(enquiryId, 'CONTACTED', 'Called back the same afternoon.', TESTER);
  const updated = await one<{ status: string; handled_by: string }>('SELECT status, handled_by FROM web_enquiry WHERE id = ?', enquiryId);
  check('the status is recorded', updated?.status === 'CONTACTED');
  check('and who recorded it', updated?.handled_by === 'verify');
  await throws('an unknown status is refused', () => setEnquiryStatus(enquiryId, 'NONSENSE', null, TESTER), 'status');

  if (grade) {
    const application = await createApplication({
      firstName: MARKER, lastName: 'Child', dateOfBirth: '2016-04-02', gender: 'FEMALE',
      gradeId: grade.id, boardingStatus: 'DAY',
      guardianName: `${MARKER} Guardian`, guardianPhone: '0733 000 222',
      declaration: '1', privacy: '1', sourcePage: '/verify',
    });
    check('an application is captured', application.id > 0);
    check('it is numbered by year', new RegExp(`^APP-${new Date().getFullYear()}-\\d{4}$`).test(application.no), application.no);

    const again = await createApplication({
      firstName: MARKER, lastName: 'Sibling', dateOfBirth: '2018-04-02', gender: 'MALE',
      gradeId: grade.id, boardingStatus: 'DAY',
      guardianName: `${MARKER} Guardian`, guardianPhone: '0733 000 222',
      declaration: '1', privacy: '1',
    });
    check('numbers do not collide', again.no !== application.no, `${application.no} and ${again.no}`);

    await throws(
      'the declaration is required',
      () => createApplication({
        firstName: 'A', lastName: 'B', dateOfBirth: '2016-01-01', gender: 'MALE', gradeId: grade.id,
        boardingStatus: 'DAY', guardianName: 'G', guardianPhone: '0722000111', privacy: '1',
      }),
      'true',
    );
    await throws(
      'the privacy notice must be accepted',
      () => createApplication({
        firstName: 'A', lastName: 'B', dateOfBirth: '2016-01-01', gender: 'MALE', gradeId: grade.id,
        boardingStatus: 'DAY', guardianName: 'G', guardianPhone: '0722000111', declaration: '1',
      }),
      'privacy',
    );
    await throws(
      'a future date of birth is refused',
      () => createApplication({
        firstName: 'A', lastName: 'B', dateOfBirth: '2999-01-01', gender: 'MALE', gradeId: grade.id,
        boardingStatus: 'DAY', guardianName: 'G', guardianPhone: '0722000111', declaration: '1', privacy: '1',
      }),
      'future',
    );
  }

  const first = await subscribe({ email: `${MARKER}@example.com`, sourcePage: '/verify' });
  check('a newsletter sign-up is accepted', first.email === `${MARKER}@example.com`);
  const repeat = await subscribe({ email: `${MARKER}@example.com` });
  check('signing up twice is not an error', repeat.email === first.email);
  const rows = await value<number>('SELECT COUNT(*)::int FROM web_subscriber WHERE email = ?', first.email);
  check('and does not duplicate the address', Number(rows) === 1);
});

/* ------------------------------------------------------------------------ RSVPs */
await section('Event bookings', async () => {
  const now = new Date();
  const starts = new Date(now.getTime() + 14 * 86_400_000).toISOString();
  const { id: eventId } = await run(
    `INSERT INTO web_event (title, slug, summary, category, starts_at, all_day, is_published, rsvp_enabled, capacity, created_at)
     VALUES (?,?,?, 'PARENTS', ?, FALSE, TRUE, TRUE, 3, ?)`,
    `${MARKER} capped event`, `${MARKER}-capped`, MARKER, starts, now.toISOString(),
  );

  const booking = await createRsvp(eventId, { name: `${MARKER} A`, phone: '0700 000 001', guests: 2 });
  check('a booking is taken', booking.id > 0);

  await throws(
    'the capacity is enforced',
    () => createRsvp(eventId, { name: `${MARKER} B`, phone: '0700 000 002', guests: 2 }),
    'left',
  );
  check('a booking that fits is still taken', (await createRsvp(eventId, { name: `${MARKER} C`, phone: '0700 000 003', guests: 1 })).id > 0);

  const { id: closedId } = await run(
    `INSERT INTO web_event (title, slug, category, starts_at, all_day, is_published, rsvp_enabled, created_at)
     VALUES (?,?, 'PARENTS', ?, FALSE, TRUE, FALSE, ?)`,
    `${MARKER} no booking`, `${MARKER}-nobooking`, starts, now.toISOString(),
  );
  await throws('booking a non-booking event is refused', () => createRsvp(closedId, { name: 'X', phone: '0700000004' }), 'booking');

  const { id: pastId } = await run(
    `INSERT INTO web_event (title, slug, category, starts_at, all_day, is_published, rsvp_enabled, created_at)
     VALUES (?,?, 'PARENTS', ?, FALSE, TRUE, TRUE, ?)`,
    `${MARKER} past`, `${MARKER}-past`, new Date(now.getTime() - 86_400_000).toISOString(), now.toISOString(),
  );
  await throws('booking a past event is refused', () => createRsvp(pastId, { name: 'X', phone: '0700000005' }), 'already');

  const { id: draftId } = await run(
    `INSERT INTO web_event (title, slug, category, starts_at, all_day, is_published, rsvp_enabled, created_at)
     VALUES (?,?, 'PARENTS', ?, FALSE, FALSE, TRUE, ?)`,
    `${MARKER} draft`, `${MARKER}-draft`, starts, now.toISOString(),
  );
  await throws('booking an unpublished event is refused', () => createRsvp(draftId, { name: 'X', phone: '0700000006' }), 'listed');
});

/* ----------------------------------------------------- what the public site shows */
await section('Public read layer', async () => {
  const school = await getSettings();
  check('settings always resolve', typeof school.name === 'string' && school.name.length > 0);
  check('the brand colours are set', /^#[0-9a-f]{3,8}$/i.test(school.brand_primary));

  const posts = await getPosts(50);
  check('only published notices are returned', posts.every((post) => post.is_published));
  check('nothing published in the future leaks', posts.every((post) => post.published_at <= new Date().toISOString()));
  check('nothing expired leaks', posts.every((post) => !post.expires_at || post.expires_at >= new Date().toISOString()));
  check('the draft this suite created is hidden', !posts.some((post) => post.body === MARKER));
  check('pinned notices come first', posts.length < 2 || !posts.slice(1).some((post, i) => post.is_pinned && !posts[i]!.is_pinned));

  const levels = await getLevels();
  check('levels are published only', levels.every((level) => level.is_published));
  check('levels carry their grades', levels.every((level) => Array.isArray(level.grades)));

  const { term, tables } = await getFees();
  if (term) {
    check('fee totals add up', tables.every((table) => {
      const expected = table.lines
        .filter((line) => line.applies_to === 'ALL')
        .reduce((sum, line) => sum + Number(line.amount_cents), 0);
      return table.compulsory_total === expected;
    }));
    check('no zero or negative fee lines are published', tables.every((table) => table.lines.every((line) => Number(line.amount_cents) > 0)));
  }

  const hits = await search('fees');
  check('search returns hits with links', hits.every((hit) => hit.href.startsWith('/')));
  check('a one-letter search returns nothing', (await search('f')).length === 0);
});

/* --------------------------------------------------------------------- dashboard */
await section('Dashboard figures', async () => {
  const summary = await inboxSummary();
  check('every figure is a number', Object.values(summary).every((n) => typeof n === 'number' && Number.isFinite(n)));
  check('open enquiries include the new ones', summary.enquiries_open >= summary.enquiries_new);
});

/* --------------------------------------------------------------------- formatting */
await section('Formatting', async () => {
  // 3,400,000 cents is KSh 34,000 — money is stored in minor units throughout.
  check('money converts from cents', formatMoney(3_400_000, 'KSh') === 'KSh 34,000', formatMoney(3_400_000, 'KSh'));
  check('money handles null', formatMoney(null) === 'KSh 0');
  check('a date renders', formatDate('2026-01-06') === '6 January 2026');
  check('an empty date renders as a dash', formatDate(null) === '—');
  check('an unparseable date is returned untouched', formatDate('not a date') === 'not a date');
  check('truncate cuts on a word', truncate('the quick brown fox jumps', 12).endsWith('…'));
  check('truncate leaves short text alone', truncate('short', 20) === 'short');
  check('initials', initials('Agnes Wanjiru Kamau') === 'AW');
  check('a Kenyan mobile becomes international', whatsappHref('0722 000 111').includes('254722000111'));
});

/* --------------------------------------------------------------------- audit trail */
await section('Audit trail', async () => {
  const rows = await all<{ action: string; actor_name: string }>(
    "SELECT action, actor_name FROM web_audit WHERE actor_name IN ('website', 'verify') ORDER BY id DESC LIMIT 20",
  );
  check('the website actor is recorded', rows.some((row) => row.actor_name === 'website'));
  check('an enquiry is audited', rows.some((row) => row.action === 'ENQUIRY_RECEIVED'));
  check('a status change is audited', rows.some((row) => row.action === 'ENQUIRY_STATUS'));
});

/* ------------------------------------------------------------------------ cleanup */
await section('Cleanup', async () => {
  const like = `%${MARKER}%`;
  await run('DELETE FROM web_rsvp WHERE name ILIKE ?', like);
  await run('DELETE FROM web_event WHERE title ILIKE ?', like);
  await run('DELETE FROM web_post WHERE title ILIKE ? OR body ILIKE ?', like, like);
  await run('DELETE FROM web_enquiry WHERE name ILIKE ?', like);
  await run('DELETE FROM web_application WHERE first_name ILIKE ? OR guardian_name ILIKE ?', like, like);
  await run('DELETE FROM web_subscriber WHERE email ILIKE ?', like);
  await run("DELETE FROM web_audit WHERE actor_name = 'verify'");

  const leftovers = await value<number>(
    `SELECT (SELECT COUNT(*) FROM web_post WHERE title ILIKE @like)
          + (SELECT COUNT(*) FROM web_enquiry WHERE name ILIKE @like)
          + (SELECT COUNT(*) FROM web_event WHERE title ILIKE @like)
          + (SELECT COUNT(*) FROM web_application WHERE first_name ILIKE @like)`,
    { like },
  );
  check('nothing this suite created is left behind', Number(leftovers) === 0, `${leftovers} rows remain`);
});

/* ---------------------------------------------------------------------- the score */
console.log('');
if (failures.length) {
  console.log(`  ${failures.length} failure(s):\n`);
  for (const failure of failures) console.log(`    ✗ ${failure}`);
  console.log(`\n  ${passed} passed, ${failures.length} failed.\n`);
  await pool.end();
  process.exit(1);
}

console.log(`  ${passed} checks passed.\n`);
await pool.end();

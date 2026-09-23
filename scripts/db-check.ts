/*
 * "Is the website's database reachable, and what is in it?"
 *
 * The first thing to run when a page is empty or a deployment will not start: it proves the
 * connection string works, the schema is there, and says how much content each table holds.
 */
import { pool, all, one, value } from '../lib/db.ts';

const TABLES = [
  'web_setting', 'web_role', 'web_permission_line', 'web_user', 'web_user_role',
  'web_user_permission_line', 'web_session', 'web_level', 'web_grade', 'web_subject', 'web_term',
  'web_fee', 'web_post', 'web_event', 'web_rsvp', 'web_album', 'web_photo', 'web_staff',
  'web_testimonial', 'web_faq', 'web_route', 'web_stop', 'web_enquiry', 'web_application',
  'web_subscriber', 'web_audit',
];

const mask = (url: string): string => url.replace(/\/\/([^:]+):[^@]+@/, '//$1:***@');

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('\n  DATABASE_URL is not set.\n');
    process.exit(1);
  }
  console.log(`\n  Database   ${mask(url)}`);

  const started = Date.now();
  const version = await value<string>('SELECT version()');
  console.log(`  Server     ${String(version).split(',')[0]}`);
  console.log(`  Round trip ${Date.now() - started} ms\n`);

  const present = new Set(
    (await all<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename LIKE 'web\\_%'",
    )).map((r) => r.tablename),
  );

  const missing = TABLES.filter((t) => !present.has(t));
  if (missing.length) {
    console.log(`  ${missing.length} table(s) missing — run \`npm run db:setup\`:`);
    for (const table of missing) console.log(`    - ${table}`);
    console.log('');
    return;
  }

  console.log('  Table                Rows');
  console.log('  ─────────────────────────');
  for (const table of TABLES) {
    const n = await value<number>(`SELECT COUNT(*)::int FROM ${table}`);
    console.log(`  ${table.padEnd(20)} ${String(n ?? 0).padStart(4)}`);
  }

  const sets = await all<{ name: string; is_system: boolean; lines: number; holders: number }>(
    `SELECT r.name, r.is_system,
            (SELECT COUNT(*)::int FROM web_permission_line l WHERE l.role_id = r.id) AS lines,
            (SELECT COUNT(*)::int FROM web_user u WHERE u.role_id = r.id) AS holders
     FROM web_role r ORDER BY r.is_system DESC, r.name`,
  );
  console.log('\n  Permission Set            Lines  Holders');
  console.log('  ─────────────────────────────────────────');
  for (const set of sets) {
    const lines = set.is_system ? 'all' : String(set.lines);
    console.log(`  ${set.name.padEnd(24)} ${lines.padStart(5)} ${String(set.holders).padStart(8)}`);
  }

  const admins = await one<{ n: number }>(
    `SELECT COUNT(DISTINCT u.id)::int AS n
     FROM web_user u
     LEFT JOIN web_role r ON r.id = u.role_id
     LEFT JOIN web_user_role ur ON ur.user_id = u.id
     LEFT JOIN web_role extra ON extra.id = ur.role_id
     WHERE u.status = 'ACTIVE' AND (r.is_system OR extra.is_system)`,
  );
  console.log(`\n  ${admins?.n ?? 0} active System Administrator(s).`);
  console.log(`  Cloudinary ${process.env.CLOUDINARY_API_KEY ? 'configured' : 'NOT configured — image uploads will fail'}\n`);
}

main()
  .catch((error: unknown) => {
    console.error('\n  Could not reach the database:', error instanceof Error ? error.message : error, '\n');
    process.exitCode = 1;
  })
  .finally(() => pool.end());

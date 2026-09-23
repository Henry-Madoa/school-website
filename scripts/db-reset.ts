/*
 * Drops every table this application owns and builds it again from scratch.
 *
 * DESTRUCTIVE, and deliberately awkward: it refuses to run unless CONFIRM_RESET=yes is in the
 * environment, and it only ever touches tables whose names begin `web_` — so pointing it at a
 * database shared with the management system cannot take the school's ledger with it.
 */
import { pool, all, exec } from '../lib/db.ts';
import { applySchema, seedDatabase } from '../lib/seed.ts';

const mask = (url: string): string => url.replace(/\/\/([^:]+):[^@]+@/, '//$1:***@');

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('\n  DATABASE_URL is not set.\n');
    process.exit(1);
  }
  if (process.env.CONFIRM_RESET !== 'yes') {
    console.error('\n  This destroys every `web_` table in the database below and rebuilds it.');
    console.error(`  ${mask(url)}\n`);
    console.error('  If that is what you want, run it again with CONFIRM_RESET=yes:\n');
    console.error('    CONFIRM_RESET=yes npm run db:reset\n');
    process.exit(1);
  }

  const tables = await all<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename LIKE 'web\\_%' ORDER BY tablename",
  );

  console.log(`\n  Database  ${mask(url)}`);
  if (tables.length) {
    const names = tables.map((t) => `"${t.tablename}"`).join(', ');
    process.stdout.write(`  Dropping  ${tables.length} table(s)… `);
    await exec(`DROP TABLE IF EXISTS ${names} CASCADE`);
    console.log('done');
  } else {
    console.log('  Dropping  nothing to drop');
  }

  process.stdout.write('  Schema    applying… ');
  await applySchema();
  console.log('done');

  process.stdout.write('  Content   seeding…  ');
  const { created, adminEmail, adminPassword } = await seedDatabase();
  console.log('done');
  for (const item of created) console.log(`            + ${item}`);

  if (adminEmail && adminPassword) {
    console.log(`\n  Sign in at  /admin/login`);
    console.log(`  Email       ${adminEmail}`);
    console.log(`  Password    ${adminPassword}\n`);
  }
}

main()
  .catch((error: unknown) => {
    console.error('\n  Reset failed:', error instanceof Error ? error.message : error, '\n');
    process.exitCode = 1;
  })
  .finally(() => pool.end());

/*
 * Creates the schema and, unless told otherwise, fills an empty database with the demonstration
 * school. Safe to run repeatedly: the schema is CREATE … IF NOT EXISTS throughout and the seed
 * only ever fills a table that is empty.
 *
 *   npm run db:setup                       schema + demonstration content
 *   SEED_DEMO_DATA=false npm run db:setup  schema and the first administrator only
 */
import { pool } from '../lib/db.ts';
import { applySchema, seedDatabase } from '../lib/seed.ts';

const mask = (url: string): string => url.replace(/\/\/([^:]+):[^@]+@/, '//$1:***@');

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('\n  DATABASE_URL is not set.\n  Copy .env.local.example to .env.local and point it at your PostgreSQL database.\n');
    process.exit(1);
  }

  console.log(`\n  Database  ${mask(url)}`);
  process.stdout.write('  Schema    applying… ');
  await applySchema();
  console.log('done');

  process.stdout.write('  Content   seeding…  ');
  const { created, adminEmail, adminPassword } = await seedDatabase();
  console.log(created.length ? 'done' : 'nothing to do (already populated)');

  for (const item of created) console.log(`            + ${item}`);

  if (adminEmail && adminPassword) {
    console.log('\n  ┌──────────────────────────────────────────────────────────────┐');
    console.log('  │  The first administrator has been created.                   │');
    console.log('  │  This password is shown once and is not stored anywhere.     │');
    console.log('  └──────────────────────────────────────────────────────────────┘');
    console.log(`\n     Sign in at  /admin/login`);
    console.log(`     Email       ${adminEmail}`);
    console.log(`     Password    ${adminPassword}\n`);
  }

  console.log('  Ready. Run `npm run dev` and open http://localhost:3000\n');
}

main()
  .catch((error: unknown) => {
    console.error('\n  Setup failed:', error instanceof Error ? error.message : error, '\n');
    process.exitCode = 1;
  })
  .finally(() => pool.end());

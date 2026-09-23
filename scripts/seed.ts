/*
 * Fills an already-created database. `npm run db:setup` does this too; this script exists for the
 * case where the schema is managed elsewhere (a migration tool, a DBA) and only the content is
 * wanted.
 */
import { pool } from '../lib/db.ts';
import { seedDatabase } from '../lib/seed.ts';

const { created, adminEmail, adminPassword } = await seedDatabase()
  .catch((error: unknown) => {
    console.error('\n  Seed failed:', error instanceof Error ? error.message : error, '\n');
    process.exit(1);
  });

if (!created.length) {
  console.log('\n  Nothing to seed — every table already has content.\n');
} else {
  console.log('\n  Seeded:');
  for (const item of created) console.log(`    + ${item}`);
  if (adminEmail && adminPassword) {
    console.log(`\n  Administrator  ${adminEmail}`);
    console.log(`  Password       ${adminPassword}   (shown once — it is not stored)\n`);
  } else {
    console.log('');
  }
}

await pool.end();

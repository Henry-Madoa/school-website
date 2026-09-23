/*
 * One-off: move the website's web_ tables from one PostgreSQL database to another.
 *
 *   SOURCE_DATABASE_URL=… node --env-file=.env.local scripts/tmp-db-move.ts            copy + verify
 *   SOURCE_DATABASE_URL=… node --env-file=.env.local scripts/tmp-db-move.ts --drop-source
 *
 * The target is DATABASE_URL. Copy refuses to touch a target that already holds data. Dropping
 * refuses unless every source table has been copied with matching row counts, and drops the
 * web_ tables in one statement without CASCADE, so nothing outside them can be removed.
 */
import { readFile } from 'node:fs/promises';
import pg from 'pg';

// Copy JSON as its raw text: a parsed array would otherwise be re-sent as a Postgres array literal.
pg.types.setTypeParser(114, (value) => value);
pg.types.setTypeParser(3802, (value) => value);

const mask = (url: string) => url.replace(/\/\/([^:]+):[^@]+@/, '//$1:***@');

function client(url: string): pg.Client {
  const needsSsl = /[?&]sslmode=(require|verify-ca|verify-full|prefer)/.test(url) || /\.neon\.tech/.test(url);
  const cleaned = url.replace(/([?&])sslmode=[^&]*(&|$)/, (_m, lead, tail) => (tail ? lead : ''));
  return new pg.Client({ connectionString: cleaned, ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}) });
}

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;

async function webTables(db: pg.Client): Promise<string[]> {
  const { rows } = await db.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name LIKE 'web\\_%'`,
  );
  return rows.map((r) => r.table_name);
}

async function counts(db: pg.Client, tables: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  for (const table of tables) {
    const { rows } = await db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM ${quote(table)}`);
    result.set(table, rows[0]!.n);
  }
  return result;
}

async function main() {
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  const targetUrl = process.env.DATABASE_URL;
  if (!sourceUrl || !targetUrl) throw new Error('Set SOURCE_DATABASE_URL and DATABASE_URL.');
  if (sourceUrl === targetUrl) throw new Error('Source and target are the same database.');
  const dropSource = process.argv.includes('--drop-source');

  console.log(`\n  From  ${mask(sourceUrl)}\n  To    ${mask(targetUrl)}\n`);
  const source = client(sourceUrl);
  const target = client(targetUrl);
  await source.connect();
  await target.connect();

  try {
    const schemaSql = await readFile(new URL('../lib/schema.sql', import.meta.url), 'utf8');
    // Parents before children, exactly as the schema declares them.
    const order = [...schemaSql.matchAll(/CREATE TABLE IF NOT EXISTS (web_[a-z_]+)/g)].map((m) => m[1]!);
    const sourceTables = await webTables(source);
    const unknown = sourceTables.filter((t) => !order.includes(t));
    if (unknown.length) throw new Error(`Source has web_ tables the schema does not know: ${unknown.join(', ')}`);
    const tables = order.filter((t) => sourceTables.includes(t));
    const sourceCounts = await counts(source, tables);

    if (!dropSource) {
      await target.query(schemaSql);
      const targetCounts = await counts(target, tables);
      const defaultSetting = await target.query(`SELECT 1 FROM web_setting WHERE id = 1 AND name = 'Our School'`);
      const occupied = tables.filter((t) => (t === 'web_setting'
        ? (targetCounts.get(t) ?? 0) > (defaultSetting.rowCount ? 1 : 0)
        : (targetCounts.get(t) ?? 0) > 0));
      if (occupied.length) throw new Error(`Target already holds data in: ${occupied.join(', ')}. Nothing copied.`);

      await target.query('BEGIN');
      try {
        await target.query('DELETE FROM web_setting');
        for (const table of tables) {
          const { rows } = await source.query(`SELECT * FROM ${quote(table)}`);
          if (rows.length) {
            const columns = Object.keys(rows[0]!);
            for (let start = 0; start < rows.length; start += 200) {
              const batch = rows.slice(start, start + 200);
              const values: unknown[] = [];
              const tuples = batch.map((row) => `(${columns.map((c) => { values.push(row[c]); return `$${values.length}`; }).join(',')})`);
              await target.query(`INSERT INTO ${quote(table)} (${columns.map(quote).join(',')}) VALUES ${tuples.join(',')}`, values);
            }
          }
          const { rows: seq } = await target.query<{ s: string | null }>(`SELECT pg_get_serial_sequence($1, 'id') AS s`, [table]);
          if (seq[0]?.s) {
            await target.query(`SELECT setval($1, COALESCE((SELECT MAX(id) FROM ${quote(table)}), 0) + 1, false)`, [seq[0].s]);
          }
        }
        await target.query('COMMIT');
      } catch (error) {
        await target.query('ROLLBACK');
        throw error;
      }
    }

    const copied = await counts(target, tables);
    let ok = true;
    console.log('  Table                         Source   Target');
    for (const table of tables) {
      const a = sourceCounts.get(table) ?? 0;
      const b = copied.get(table) ?? 0;
      if (a !== b) ok = false;
      console.log(`  ${table.padEnd(28)} ${String(a).padStart(6)}   ${String(b).padStart(6)}${a === b ? '' : '   MISMATCH'}`);
    }
    if (!ok) throw new Error('Row counts differ. Nothing dropped.');
    console.log('\n  All rows copied and verified.');

    if (dropSource) {
      await source.query(`DROP TABLE ${tables.map(quote).join(', ')}`);
      const left = await webTables(source);
      console.log(`  Dropped ${tables.length} web_ tables from the source. web_ tables left there: ${left.length}.`);
    }
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((error: unknown) => {
  console.error('\n  Failed:', error instanceof Error ? error.message : error, '\n');
  process.exitCode = 1;
});

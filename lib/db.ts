/*
 * PostgreSQL access for the website.
 *
 * Deliberately small: a pool, three query helpers and an audit trail. The website is a content
 * site with an admin behind it — there is no ledger to protect and no ORM to keep in step, so the
 * queries stay as plain SQL and the schema lives in one readable file (lib/schema.sql).
 *
 * Two conveniences the rest of the code relies on:
 *   - placeholders: `?` (positional) and `@named` both become `$1..$n`
 *   - identity:     an INSERT gets `RETURNING id` appended, so `run()` hands back the new id
 *
 * Every table this file touches is prefixed `web_`. That is what makes it safe to point
 * DATABASE_URL at a database the management system also uses: the two share no table names.
 * Pointing it at its own database is still the better answer, and the default.
 */
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { setDefaultResultOrder } from 'node:dns';

/*
 * Hosted Postgres (Neon, Supabase) resolves to both IPv4 and IPv6. Where the IPv6 route is dead
 * rather than refused — common on Windows dev machines — every new connection loses tens of
 * seconds to the unreachable candidates before falling back. Skip the race.
 */
setDefaultResultOrder('ipv4first');

const globalForDb = globalThis as typeof globalThis & { __websitePool?: Pool };

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.local.example to .env.local and point it at your PostgreSQL database.',
    );
  }
  /*
   * SSL is configured here rather than left to the connection string: node-postgres is in the
   * middle of changing what `sslmode=require` means, and a hosted database (Neon, Supabase,
   * Render) presents a certificate chain Node does not carry. Stripping the parameter and saying
   * what we mean keeps the behaviour the same across pg versions — and keeps a deprecation
   * warning out of every script's output.
   */
  const needsSsl = /[?&]sslmode=(require|verify-ca|verify-full|prefer)/.test(connectionString)
    || /\.(neon\.tech|supabase\.co|render\.com|azure\.com|amazonaws\.com)/.test(connectionString);
  const cleaned = connectionString.replace(/([?&])sslmode=[^&]*(&|$)/, (_m, lead, tail) => (tail ? lead : ''));

  return new Pool({
    connectionString: cleaned,
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),

    /*
     * Small on purpose.
     *
     * This pool is per *process*, and `next build` prerenders with a worker per core — so a
     * generous `max` is multiplied by seven or eight, and a hosted database's connection limit is
     * reached by a build rather than by any traffic. A page render holds one connection at a
     * time and the queries are milliseconds long, so a handful per process is ample; anything
     * more only buys the right to be throttled.
     */
    max: Number(process.env.DB_POOL_MAX) || 5,

    /*
     * A connection that goes stale without a clean close (a pooler reclaiming it, a laptop
     * sleeping through a network change) would otherwise leave a query hanging forever. The
     * connect timeout is deliberately generous: a serverless database that has scaled to zero
     * takes a few seconds to wake, and a build should wait for it rather than fail.
     */
    query_timeout: Number(process.env.DB_QUERY_TIMEOUT_MS) || 30_000,
    statement_timeout: Number(process.env.DB_QUERY_TIMEOUT_MS) || 30_000,
    connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 20_000,
    keepAlive: true,
  });
}

/** Next reloads server modules on edit, so the pool hangs off globalThis to survive a reload. */
export const pool: Pool = globalForDb.__websitePool ?? (globalForDb.__websitePool = createPool());

/* ------------------------------------------------------------------ parameters */

export type Param = string | number | boolean | Date | null | undefined | string[] | number[];
export type NamedParams = Record<string, Param>;
export type Arg = Param | NamedParams;

/**
 * Rewrites `?` and `@name` placeholders to `$1..$n` and returns the values in order.
 * A named bag may be passed as the single argument; positional values are passed as a list.
 */
function bind(sql: string, args: Arg[]): { text: string; values: unknown[] } {
  const named = args.length === 1 && isNamedBag(args[0]) ? (args[0] as unknown as NamedParams) : null;
  const values: unknown[] = [];
  let positional = 0;

  const text = sql.replace(/@([a-zA-Z_][a-zA-Z0-9_]*)|\?/g, (match, name?: string) => {
    if (name) {
      if (!named || !(name in named)) throw new Error(`Missing bound parameter @${name}`);
      values.push(named[name] ?? null);
    } else {
      values.push(args[positional++] ?? null);
    }
    return `$${values.length}`;
  });

  return { text, values };
}

function isNamedBag(v: unknown): boolean {
  return (
    typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date)
  );
}

/* --------------------------------------------------------------------- queries */

/** Every row the query returns. */
export async function all<T extends QueryResultRow = QueryResultRow>(sql: string, ...args: Arg[]): Promise<T[]> {
  const { text, values } = bind(sql, args);
  const result = await pool.query<T>(text, values);
  return result.rows;
}

/** The first row, or undefined. */
export async function one<T extends QueryResultRow = QueryResultRow>(sql: string, ...args: Arg[]): Promise<T | undefined> {
  const rows = await all<T>(sql, ...args);
  return rows[0];
}

/** A single scalar from the first row — a count, a max, an existence check. */
export async function value<T = unknown>(sql: string, ...args: Arg[]): Promise<T | undefined> {
  const row = await one(sql, ...args);
  return row ? (Object.values(row)[0] as T) : undefined;
}

export interface RunResult {
  /** The id of the row an INSERT created, or 0 for an UPDATE/DELETE. */
  id: number;
  rowCount: number;
}

/** An INSERT, UPDATE or DELETE. An INSERT without its own RETURNING gets `RETURNING id`. */
export async function run(sql: string, ...args: Arg[]): Promise<RunResult> {
  const isInsert = /^\s*insert\s/i.test(sql) && !/\breturning\b/i.test(sql);
  const { text, values } = bind(isInsert ? `${sql.trimEnd().replace(/;$/, '')} RETURNING id` : sql, args);
  const result = await pool.query(text, values);
  const returned = result.rows[0] as { id?: number } | undefined;
  return { id: Number(returned?.id ?? 0), rowCount: result.rowCount ?? 0 };
}

/** Raw SQL with no placeholder rewriting — for the schema file, which contains `$$` and `::`. */
export async function exec(sql: string): Promise<void> {
  await pool.query(sql);
}

/** Runs the callback inside a transaction, rolling back on any throw. */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** True when at least one row matches — `exists('web_user', 'email = ?', email)`. */
export async function exists(table: string, where: string, ...args: Arg[]): Promise<boolean> {
  const row = await one(`SELECT 1 AS hit FROM ${table} WHERE ${where} LIMIT 1`, ...args);
  return !!row;
}

/* ----------------------------------------------------------------- audit trail */

export interface Actor {
  id: number;
  name: string;
  email: string;
}

/**
 * Records who changed what. The website is edited by a handful of people and content disappearing
 * without explanation is the commonest support call, so every write in the admin lands here.
 * An audit row must never be the reason a save fails.
 */
export async function audit(
  actor: Actor | null,
  action: string,
  entity: string,
  entityId: number | string | null,
  detail: Record<string, unknown> = {},
): Promise<void> {
  try {
    await run(
      `INSERT INTO web_audit (actor_id, actor_name, action, entity, entity_id, detail, created_at)
       VALUES (?,?,?,?,?,?,?)`,
      actor?.id ?? null,
      actor?.name ?? 'website',
      action,
      entity,
      entityId === null ? null : String(entityId),
      JSON.stringify(detail),
      new Date().toISOString(),
    );
  } catch {
    // Never let the trail break the write it is describing.
  }
}

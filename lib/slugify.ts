/*
 * URL slugs. A notice posted twice with the same title must still get two working links, so
 * `uniqueSlug` asks the database and appends -2, -3 … until nothing collides.
 */
import { one } from './db.ts';

export function slugify(input: string): string {
  return String(input ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'untitled';
}

/**
 * A slug that is free in `table`. `excludeId` lets a record keep its own slug while being edited.
 * The table name is interpolated, so it is only ever called with a literal from this codebase.
 */
export async function uniqueSlug(table: string, title: string, excludeId?: number | null): Promise<string> {
  const base = slugify(title);
  for (let n = 1; n < 200; n += 1) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const clash = await one(
      `SELECT id FROM ${table} WHERE slug = ? ${excludeId ? 'AND id <> ?' : ''} LIMIT 1`,
      ...(excludeId ? [candidate, excludeId] : [candidate]),
    );
    if (!clash) return candidate;
  }
  return `${base}-${Date.now()}`;
}

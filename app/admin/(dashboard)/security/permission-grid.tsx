'use client';

import { useMemo, useState } from 'react';
import type { PermissionLine } from '@/lib/types.ts';

/*
 * The Permission Set editor's grid.
 *
 * Two tables, because the model has two kinds of object and they are not the same question:
 *
 *   - PAGES ask "may this person open this screen at all?" — one tick each.
 *   - TABLES ask "what may they do to these records?" — Read, Insert, Modify, Delete.
 *
 * A set needs both. Modify on web_post without Execute on the News page grants nobody anything;
 * Execute on the page without Read on the table opens a screen that cannot load. The tick-a-whole
 * -column and tick-a-whole-row shortcuts exist because an administrator building a set for a new
 * job is otherwise clicking sixty boxes.
 *
 * Every checkbox is named `perm:<TYPE>:<object>:<right>`, which lib/roles.ts reads straight back
 * out of the posted form — so the grid posts as an ordinary form and works without JavaScript.
 */

export interface PageRow { code: string; label: string; route: string; parent: string | null }
export interface TableRow { name: string; label: string }

const RIGHTS = ['read', 'insert', 'modify', 'delete'] as const;

export function PermissionGrid({
  pages,
  tables,
  lines,
  disabled = false,
}: {
  pages: PageRow[];
  tables: TableRow[];
  lines: PermissionLine[];
  disabled?: boolean;
}) {
  const initial = useMemo(() => {
    const ticks: Record<string, boolean> = {};
    for (const line of lines) {
      if (line.object_type === 'PAGE') {
        if (line.execute_perm) ticks[`perm:PAGE:${line.object_name}:execute`] = true;
        continue;
      }
      for (const right of RIGHTS) {
        if (line[`${right}_perm` as 'read_perm']) ticks[`perm:TABLE:${line.object_name}:${right}`] = true;
      }
    }
    return ticks;
  }, [lines]);

  const [ticks, setTicks] = useState<Record<string, boolean>>(initial);

  const set = (key: string, value: boolean) => setTicks((current) => ({ ...current, [key]: value }));

  const setMany = (keys: string[], value: boolean) =>
    setTicks((current) => {
      const next = { ...current };
      for (const key of keys) next[key] = value;
      return next;
    });

  const pageKeys = pages.map((page) => `perm:PAGE:${page.code}:execute`);
  const tableKeys = tables.flatMap((table) => RIGHTS.map((right) => `perm:TABLE:${table.name}:${right}`));
  const allPages = pageKeys.every((key) => ticks[key]);
  const allTables = tableKeys.every((key) => ticks[key]);

  const grantedPages = pageKeys.filter((key) => ticks[key]).length;
  const grantedTables = tables.filter((table) => RIGHTS.some((right) => ticks[`perm:TABLE:${table.name}:${right}`])).length;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div className="note note-info">
        <strong>{grantedPages}</strong> of {pages.length} screens and <strong>{grantedTables}</strong> of {tables.length}{' '}
        tables are granted. A screen needs both: Execute on the page, and the rights on the tables it reads and writes.
      </div>

      {/* --------------------------------------------------------------- pages */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '0.92rem' }}>Screens (Execute)</h3>
          <span style={{ flex: 1 }} />
          {!disabled ? (
            <button type="button" className="btn btn-quiet btn-xs" onClick={() => setMany(pageKeys, !allPages)}>
              {allPages ? 'Untick every screen' : 'Tick every screen'}
            </button>
          ) : null}
        </div>

        <div className="table-wrap">
          <table className="perm-grid">
            <thead>
              <tr><th>Screen</th><th style={{ width: 110 }}>May open</th></tr>
            </thead>
            <tbody>
              {pages.map((page) => {
                const key = `perm:PAGE:${page.code}:execute`;
                return (
                  <tr key={page.code} className={page.parent ? 'child' : ''}>
                    <td className="obj">
                      {page.parent ? page.label.split('›').slice(1).join('›').trim() : page.label}
                      <small>{page.route}</small>
                    </td>
                    <td className="tick">
                      <input
                        type="checkbox"
                        name={key}
                        value="1"
                        checked={!!ticks[key]}
                        disabled={disabled}
                        aria-label={`May open ${page.label}`}
                        onChange={(event) => set(key, event.target.checked)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* -------------------------------------------------------------- tables */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '0.92rem' }}>Records (Read, Insert, Modify, Delete)</h3>
          <span style={{ flex: 1 }} />
          {!disabled ? (
            <button type="button" className="btn btn-quiet btn-xs" onClick={() => setMany(tableKeys, !allTables)}>
              {allTables ? 'Untick everything' : 'Tick everything'}
            </button>
          ) : null}
        </div>

        <div className="table-wrap">
          <table className="perm-grid">
            <thead>
              <tr>
                <th>Records</th>
                {RIGHTS.map((right) => (
                  <th key={right} style={{ width: 84 }}>
                    <span style={{ textTransform: 'capitalize' }}>{right}</span>
                    {!disabled ? (
                      <button
                        type="button"
                        className="btn btn-quiet btn-xs"
                        style={{ display: 'block', margin: '2px auto 0', padding: '0 6px', minHeight: 20, fontSize: '0.64rem' }}
                        onClick={() => {
                          const keys = tables.map((table) => `perm:TABLE:${table.name}:${right}`);
                          setMany(keys, !keys.every((key) => ticks[key]));
                        }}
                      >
                        all
                      </button>
                    ) : null}
                  </th>
                ))}
                <th style={{ width: 60 }}>Row</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((table) => {
                const rowKeys = RIGHTS.map((right) => `perm:TABLE:${table.name}:${right}`);
                const wholeRow = rowKeys.every((key) => ticks[key]);
                return (
                  <tr key={table.name}>
                    <td className="obj">
                      {table.label}
                      <small>{table.name}</small>
                    </td>
                    {RIGHTS.map((right) => {
                      const key = `perm:TABLE:${table.name}:${right}`;
                      return (
                        <td className="tick" key={right}>
                          <input
                            type="checkbox"
                            name={key}
                            value="1"
                            checked={!!ticks[key]}
                            disabled={disabled}
                            aria-label={`${right} ${table.label}`}
                            onChange={(event) => {
                              // Anything you may change, you may look at — the same rule the
                              // server applies when it stores the lines.
                              if (event.target.checked && right !== 'read') set(`perm:TABLE:${table.name}:read`, true);
                              set(key, event.target.checked);
                            }}
                          />
                        </td>
                      );
                    })}
                    <td className="tick">
                      {!disabled ? (
                        <button
                          type="button"
                          className="btn btn-quiet btn-xs"
                          style={{ padding: '0 8px', minHeight: 22, fontSize: '0.68rem' }}
                          onClick={() => setMany(rowKeys, !wholeRow)}
                        >
                          {wholeRow ? 'none' : 'all'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

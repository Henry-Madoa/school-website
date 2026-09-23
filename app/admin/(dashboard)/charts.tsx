'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

/*
 * The dashboard's charts, drawn as plain SVG and HTML so the server renders every figure and the
 * browser only adds the hover layer. Colours are roles defined in admin.css (--viz-*), validated
 * against the white panel: two categorical slots for series, a one-hue blue ramp for ordered
 * stages, and the fixed status colours for capacity. Every chart has a table twin.
 */

export interface Series {
  name: string;
  values: number[];
  color: string;
}

const fmt = (n: number): string => n.toLocaleString('en-GB');

/** Round a maximum up to a clean axis top, and give four evenly spaced ticks. */
function niceTicks(max: number): number[] {
  if (max <= 4) return [0, 1, 2, 3, 4];
  const rough = max / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough) ?? rough;
  return [0, 1, 2, 3, 4].map((i) => Math.round(i * step * 100) / 100);
}

/* ================================================================ table twin */

export function TableView({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="viz-table">
      <summary>Show as table</summary>
      <div className="table-wrap">
        <table className="list">
          <caption className="sr-only">{caption}</caption>
          <thead><tr>{head.map((cell, i) => <th key={cell} className={i ? 'num' : undefined}>{cell}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>{row.map((cell, i) => <td key={i} className={i ? 'num' : undefined}>{typeof cell === 'number' ? fmt(cell) : cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function Legend({ items, shape = 'line' }: { items: { name: string; color: string; value?: string }[]; shape?: 'line' | 'rect' }) {
  return (
    <ul className="viz-legend">
      {items.map((item) => (
        <li key={item.name}>
          <span className={`key key-${shape}`} style={{ background: item.color }} aria-hidden="true" />
          <span>{item.name}</span>
          {item.value ? <b>{item.value}</b> : null}
        </li>
      ))}
    </ul>
  );
}

/* ================================================================ line chart */

/**
 * Counts over time on one axis. A crosshair snaps to the nearest bucket and one tooltip lists
 * every series there; arrow keys move it when the plot has focus.
 */
export function LineChart({ labels, tipLabels, series, height = 230 }: { labels: string[]; tipLabels: string[]; series: Series[]; height?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const node = wrap.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setWidth(Math.max(280, Math.round(entry.contentRect.width))); });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const pad = { top: 14, right: 34, bottom: 30, left: 36 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const ticks = niceTicks(Math.max(0, ...series.flatMap((s) => s.values)));
  const top = ticks[ticks.length - 1] || 1;
  const count = labels.length;
  const x = (i: number) => pad.left + (count <= 1 ? plotW / 2 : (i / (count - 1)) * plotW);
  const y = (v: number) => pad.top + plotH - (v / top) * plotH;
  const every = Math.max(1, Math.ceil(count / Math.max(2, Math.floor(plotW / 80))));

  const pick = (clientX: number) => {
    const box = wrap.current?.getBoundingClientRect();
    if (!box || count === 0) return;
    const ratio = (clientX - box.left - pad.left) / plotW;
    setActive(Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1)))));
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); setActive((i) => Math.min(count - 1, (i ?? -1) + 1)); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); setActive((i) => Math.max(0, (i ?? count) - 1)); }
    if (event.key === 'Escape') setActive(null);
  };

  // End labels that would sit on top of one another are dropped; the legend and tooltip carry them.
  const endLabelled = series.reduce<number[]>((kept, s, i) => {
    const endY = y(s.values[count - 1] ?? 0);
    return kept.some((k) => Math.abs(y(series[k]!.values[count - 1] ?? 0) - endY) < 12) ? kept : [...kept, i];
  }, []);

  const tipLeft = active === null ? 0 : x(active);
  const flip = tipLeft > width * 0.62;

  return (
    <div className="viz-plot" ref={wrap}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${series.map((s) => s.name).join(' and ')} over time. Use the arrow keys to read each point.`}
        tabIndex={0}
        onPointerMove={(event) => pick(event.clientX)}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive((i) => i ?? count - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={onKey}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className={tick === 0 ? 'viz-base' : 'viz-grid'} />
            <text x={pad.left - 8} y={y(tick)} className="viz-tick" textAnchor="end" dominantBaseline="middle">{fmt(tick)}</text>
          </g>
        ))}
        {labels.map((label, i) => (i % every === 0 || i === count - 1) && !(i !== count - 1 && count - 1 - i < every) ? (
          <text key={label + i} x={x(i)} y={height - 8} className="viz-tick" textAnchor="middle">{label}</text>
        ) : null)}

        {active !== null ? <line x1={x(active)} x2={x(active)} y1={pad.top} y2={pad.top + plotH} className="viz-cross" /> : null}

        {series.map((s, index) => (
          <g key={s.name}>
            <polyline
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {count ? (
              <>
                <circle cx={x(count - 1)} cy={y(s.values[count - 1] ?? 0)} r={4} fill={s.color} className="viz-dot" />
                {endLabelled.includes(index) ? (
                  <text x={x(count - 1) + 9} y={y(s.values[count - 1] ?? 0)} className="viz-end" dominantBaseline="middle">{fmt(s.values[count - 1] ?? 0)}</text>
                ) : null}
              </>
            ) : null}
            {active !== null && active !== count - 1 ? <circle cx={x(active)} cy={y(s.values[active] ?? 0)} r={4} fill={s.color} className="viz-dot" /> : null}
          </g>
        ))}
      </svg>

      {active !== null ? (
        <div className="viz-tip" style={{ left: tipLeft, top: pad.top, transform: flip ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)' }} role="status">
          <div className="viz-tip-head">{tipLabels[active]}</div>
          {series.map((s) => (
            <div key={s.name} className="viz-tip-row">
              <span className="key key-line" style={{ background: s.color }} aria-hidden="true" />
              <b>{fmt(s.values[active] ?? 0)}</b>
              <span>{s.name}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ============================================================ horizontal bars */

export interface BarRow {
  label: string;
  /** One value per segment; a plain bar has one. */
  values: number[];
  note?: string;
}

/**
 * Horizontal bars, plain or stacked. Values sit at the bar's tip; hovering or focusing a row
 * shows its breakdown. `colors` holds one colour per segment, or one per row when `perRow`.
 */
export function BarRows({ rows, colors, names, perRow = false, max }: {
  rows: BarRow[];
  colors: string[];
  names?: string[];
  perRow?: boolean;
  max?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const top = max ?? Math.max(1, ...rows.map((row) => row.values.reduce((a, b) => a + b, 0)));

  return (
    <div className="viz-bars" onPointerLeave={() => setActive(null)}>
      {rows.map((row, r) => {
        const total = row.values.reduce((a, b) => a + b, 0);
        const segments = row.values.map((value, s) => ({ value, color: perRow ? colors[r] ?? colors[0]! : colors[s] ?? colors[0]!, name: names?.[s] })).filter((seg) => seg.value > 0);
        return (
          <div
            key={row.label}
            className={`viz-bar-row ${active === r ? 'on' : ''}`}
            tabIndex={0}
            onPointerEnter={() => setActive(r)}
            onFocus={() => setActive(r)}
            onBlur={() => setActive(null)}
          >
            <span className="viz-bar-label">{row.label}</span>
            <span className="viz-bar-track">
              <span className="viz-bar-fill" style={{ width: `${(total / top) * 100}%` }}>
                {segments.map((seg, s) => (
                  <span key={s} className="viz-seg" style={{ background: seg.color, flexGrow: seg.value }} />
                ))}
              </span>
              <span className="viz-bar-value">{fmt(total)}{row.note ? <small>{row.note}</small> : null}</span>
            </span>
            {active === r && names && names.length > 1 ? (
              <span className="viz-tip viz-tip-row-anchor" role="status">
                <span className="viz-tip-head">{row.label}</span>
                {row.values.map((value, s) => (
                  <span key={s} className="viz-tip-row">
                    <span className="key key-line" style={{ background: colors[s] }} aria-hidden="true" />
                    <b>{fmt(value)}</b>
                    <span>{names[s]}</span>
                  </span>
                ))}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================== columns */

export function ColumnChart({ labels, tipLabels, values, color, height = 200 }: { labels: string[]; tipLabels: string[]; values: number[]; color: string; height?: number }) {
  const [active, setActive] = useState<number | null>(null);
  const ticks = niceTicks(Math.max(0, ...values));
  const top = ticks[ticks.length - 1] || 1;
  return (
    <div className="viz-cols" style={{ height }} onPointerLeave={() => setActive(null)}>
      <div className="viz-cols-grid" aria-hidden="true">
        {[...ticks].reverse().map((tick) => <span key={tick}><em>{fmt(tick)}</em></span>)}
      </div>
      <div className="viz-cols-plot">
        {values.map((value, i) => (
          <div
            key={labels[i]! + i}
            className={`viz-col ${active === i ? 'on' : ''}`}
            tabIndex={0}
            aria-label={`${tipLabels[i]}: ${fmt(value)}`}
            onPointerEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
          >
            <div className="viz-col-bar-zone">
              <span className="viz-col-bar" style={{ height: `${(value / top) * 100}%`, background: color }}>
                {value ? <span className="viz-col-value">{fmt(value)}</span> : null}
              </span>
            </div>
            <span className="viz-col-label">{labels[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ==================================================================== meters */

export function Meter({ label, value, capacity, href }: { label: string; value: number; capacity: number | null; href?: string }) {
  const share = capacity ? value / capacity : 0;
  const state = !capacity ? null : share >= 1 ? { cls: 'full', text: 'Full' } : share >= 0.8 ? { cls: 'near', text: 'Nearly full' } : null;
  const title: ReactNode = href ? <a href={href}>{label}</a> : label;
  return (
    <div className="viz-meter">
      <div className="viz-meter-head">
        <span className="viz-meter-title">{title}</span>
        <span className="viz-meter-figure">
          {state ? <span className={`viz-state viz-state-${state.cls}`}><span aria-hidden="true">{state.cls === 'full' ? '●' : '▲'}</span> {state.text}</span> : null}
          <b>{fmt(value)}</b>{capacity ? <span> of {fmt(capacity)}</span> : <span> booked</span>}
        </span>
      </div>
      {capacity ? (
        <span className="viz-meter-track" role="meter" aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={value} aria-label={`${label}: ${value} of ${capacity} places booked`}>
          <span className={`viz-meter-fill ${state?.cls ?? ''}`} style={{ width: `${Math.min(1, share) * 100}%` }} />
        </span>
      ) : null}
    </div>
  );
}

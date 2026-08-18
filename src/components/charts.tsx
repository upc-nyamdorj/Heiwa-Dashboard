"use client";

import React, { useMemo, useState } from "react";
import {
  barPath,
  linePath,
  niceScale,
  useTooltip,
  Tooltip,
  TipRow,
} from "./chart-kit";
import { seqColor } from "@/lib/palette";

const AX = {
  grid: "var(--grid)",
  axis: "var(--axis)",
  muted: "var(--text-muted)",
};

/* =========================================================== column chart */

export interface Series {
  key: string;
  label: string;
  color: string;
}

export function ColumnChart({
  rows,
  series,
  xLabel,
  format,
  height = 220,
  stacked = true,
  tickEvery = 1,
}: {
  rows: { x: string; xFull: string; values: Record<string, number> }[];
  series: Series[];
  xLabel?: string;
  format: (v: number) => string;
  height?: number;
  stacked?: boolean;
  tickEvery?: number;
}) {
  const { tip, ref, show, hide } = useTooltip();
  const [hover, setHover] = useState<number | null>(null);
  const W = 760,
    H = height,
    PL = 52,
    PR = 12,
    PT = 10,
    PB = 26;
  const iw = W - PL - PR,
    ih = H - PT - PB;

  const totals = rows.map((r) =>
    stacked
      ? series.reduce((s, m) => s + (r.values[m.key] ?? 0), 0)
      : Math.max(0, ...series.map((m) => r.values[m.key] ?? 0)),
  );
  const { max, ticks } = niceScale(Math.max(...totals, 0));
  const bandW = iw / Math.max(rows.length, 1);
  const barW = Math.min(38, bandW * (stacked ? 0.62 : 0.72));
  const y = (v: number) => PT + ih - (v / max) * ih;

  return (
    <div ref={ref} className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={xLabel ?? "Баганан график"}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PL}
              x2={W - PR}
              y1={y(t)}
              y2={y(t)}
              stroke={t === 0 ? AX.axis : AX.grid}
              strokeWidth={1}
            />
            <text
              x={PL - 8}
              y={y(t) + 4}
              textAnchor="end"
              fontSize={10}
              fill={AX.muted}
              className="tnum"
            >
              {format(t)}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const cx = PL + i * bandW + bandW / 2;
          let acc = 0;
          return (
            <g
              key={r.x}
              onMouseMove={(e) => {
                setHover(i);
                show(
                  e,
                  <div className="space-y-1">
                    <div className="font-medium">{r.xFull}</div>
                    {series.map((m) => (
                      <TipRow
                        key={m.key}
                        label={m.label}
                        color={m.color}
                        value={format(r.values[m.key] ?? 0)}
                      />
                    ))}
                  </div>,
                );
              }}
              onMouseLeave={() => {
                setHover(null);
                hide();
              }}
            >
              <rect
                x={PL + i * bandW}
                y={PT}
                width={bandW}
                height={ih}
                fill={hover === i ? "var(--surface-2)" : "transparent"}
              />
              {series.map((m, si) => {
                const v = r.values[m.key] ?? 0;
                if (v <= 0) return null;
                if (stacked) {
                  const h = (v / max) * ih;
                  const top = y(acc + v);
                  acc += v;
                  // 2px surface gap between stacked segments
                  const gap = si === 0 ? 0 : 2;
                  return (
                    <path
                      key={m.key}
                      d={barPath(
                        cx - barW / 2,
                        top,
                        barW,
                        Math.max(0, h - gap),
                        "up",
                        si === series.length - 1 ? 4 : 0,
                      )}
                      fill={m.color}
                    />
                  );
                }
                const gw = barW / series.length;
                const h = (v / max) * ih;
                return (
                  <path
                    key={m.key}
                    d={barPath(
                      cx - barW / 2 + si * gw + 1,
                      y(v),
                      Math.max(0, gw - 2),
                      h,
                      "up",
                    )}
                    fill={m.color}
                  />
                );
              })}
              {i % tickEvery === 0 && (
                <text
                  x={cx}
                  y={H - 8}
                  textAnchor="middle"
                  fontSize={10}
                  fill={AX.muted}
                >
                  {r.x}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} width={W} />
    </div>
  );
}

/* ====================================================== combo: bars + line */

export function PaymentFlowChart({
  rows,
  height = 260,
}: {
  rows: { x: string; xFull: string; paid: number; cumulative: number }[];
  height?: number;
}) {
  const { tip, ref, show, hide } = useTooltip();
  const [hover, setHover] = useState<number | null>(null);
  const W = 760,
    H = height,
    PL = 56,
    PR = 56,
    PT = 14,
    PB = 26;
  const iw = W - PL - PR,
    ih = H - PT - PB;
  const { max, ticks } = niceScale(Math.max(...rows.map((r) => r.paid), 0));
  const cmax = Math.max(...rows.map((r) => r.cumulative), 1);
  const bandW = iw / Math.max(rows.length, 1);
  const barW = Math.min(34, bandW * 0.6);
  const y = (v: number) => PT + ih - (v / max) * ih;
  const cy = (v: number) => PT + ih - (v / cmax) * ih;
  const fmt = (v: number) =>
    v >= 1e9 ? `${(v / 1e9).toFixed(1)}Т` : `${Math.round(v / 1e6)}С`;
  const pts = rows.map(
    (r, i) =>
      [PL + i * bandW + bandW / 2, cy(r.cumulative)] as [number, number],
  );

  return (
    <div ref={ref} className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label="Сар бүрийн болон хуримтлагдсан санхүүжилт"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PL}
              x2={W - PR}
              y1={y(t)}
              y2={y(t)}
              stroke={t === 0 ? AX.axis : AX.grid}
              strokeWidth={1}
            />
            <text
              x={PL - 8}
              y={y(t) + 4}
              textAnchor="end"
              fontSize={10}
              fill={AX.muted}
              className="tnum"
            >
              {fmt(t)}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const cx = PL + i * bandW + bandW / 2;
          return (
            <g
              key={r.x}
              onMouseMove={(e) => {
                setHover(i);
                show(
                  e,
                  <div className="space-y-1">
                    <div className="font-medium">{r.xFull}</div>
                    <TipRow
                      label="Тухайн сард"
                      color="var(--series-1)"
                      value={`₮${r.paid.toLocaleString("mn-MN")}`}
                    />
                    <TipRow
                      label="Хуримтлагдсан"
                      color="var(--series-2)"
                      value={`₮${r.cumulative.toLocaleString("mn-MN")}`}
                    />
                  </div>,
                );
              }}
              onMouseLeave={() => {
                setHover(null);
                hide();
              }}
            >
              <rect
                x={PL + i * bandW}
                y={PT}
                width={bandW}
                height={ih}
                fill={hover === i ? "var(--surface-2)" : "transparent"}
              />
              <path
                d={barPath(
                  cx - barW / 2,
                  y(r.paid),
                  barW,
                  PT + ih - y(r.paid),
                  "up",
                )}
                fill="var(--series-1)"
              />
              <text
                x={cx}
                y={H - 8}
                textAnchor="middle"
                fontSize={10}
                fill={AX.muted}
              >
                {r.x}
              </text>
            </g>
          );
        })}
        <path
          d={linePath(pts)}
          fill="none"
          stroke="var(--series-2)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p[0]}
            cy={p[1]}
            r={hover === i ? 5 : 4}
            fill="var(--series-2)"
            stroke="var(--surface-1)"
            strokeWidth={2}
          />
        ))}
        {/* the cumulative line is direct-labelled, so the second scale is named
            in words rather than by a competing right-hand axis */}
        <text
          x={W - PR + 6}
          y={cy(rows[rows.length - 1]?.cumulative ?? 0) + 4}
          fontSize={10}
          fill="var(--series-2)"
          className="tnum"
        >
          {fmt(rows[rows.length - 1]?.cumulative ?? 0)}
        </text>
      </svg>
      <Tooltip tip={tip} width={W} />
    </div>
  );
}

/* ============================================================= bar ranking */

export function RankBar({
  rows,
  format,
  height,
  maxOverride,
  valueLabel,
}: {
  rows: {
    label: string;
    value: number;
    color: string;
    sub?: string;
    extra?: React.ReactNode;
  }[];
  format: (v: number) => string;
  height?: number;
  maxOverride?: number;
  valueLabel?: string;
}) {
  const { tip, ref, show, hide } = useTooltip();
  const max = maxOverride ?? Math.max(...rows.map((r) => r.value), 1);
  return (
    <div ref={ref} className="relative">
      <div className="space-y-2.5">
        {rows.map((r, index) => (
          <div
            key={`${r.label}-${index}`}
            onMouseMove={(e) =>
              show(
                e,
                <div className="space-y-1">
                  <div className="font-medium">{r.label}</div>
                  <TipRow
                    label={valueLabel ?? "Дүн"}
                    color={r.color}
                    value={format(r.value)}
                  />
                  {r.sub && (
                    <div style={{ color: "var(--text-muted)" }}>{r.sub}</div>
                  )}
                </div>,
              )
            }
            onMouseLeave={hide}
          >
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span
                className="truncate"
                style={{ color: "var(--text-secondary)" }}
              >
                {r.label}
              </span>
              <span className="tnum shrink-0 font-medium">
                {format(r.value)}
              </span>
            </div>
            <svg
              viewBox="0 0 100 6"
              preserveAspectRatio="none"
              className="mt-1 h-1.5 w-full"
            >
              <rect
                x={0}
                y={0}
                width={100}
                height={6}
                fill="var(--seq-zero)"
                rx={3}
              />
              <path
                d={barPath(
                  0,
                  0,
                  Math.max(0.6, (r.value / max) * 100),
                  6,
                  "right",
                  2,
                )}
                fill={r.color}
              />
            </svg>
          </div>
        ))}
      </div>
      <Tooltip tip={tip} width={600} />
    </div>
  );
}

/* ================================================================= heatmap */

export function Heatmap({
  cols,
  rowsLabels,
  get,
  cellLabel,
  colHeader,
}: {
  cols: string[];
  rowsLabels: string[];
  get: (row: string, col: string) => number;
  cellLabel?: (v: number) => string;
  colHeader?: (c: string) => string;
}) {
  const { tip, ref, show, hide } = useTooltip();
  const max = useMemo(
    () => Math.max(1, ...rowsLabels.flatMap((r) => cols.map((c) => get(r, c)))),
    [cols, rowsLabels, get],
  );
  return (
    <div ref={ref} className="relative overflow-x-auto scroll">
      <table
        className="w-full"
        style={{ borderSpacing: "2px", borderCollapse: "separate" }}
      >
        <thead>
          <tr>
            <th />
            {cols.map((c) => (
              <th
                key={c}
                className="px-0.5 pb-1.5 text-[10px] font-medium align-bottom"
                style={{
                  color: "var(--text-muted)",
                  minWidth: 34,
                  maxWidth: 62,
                }}
              >
                <span className="block leading-tight break-words" title={c}>
                  {colHeader ? colHeader(c) : c}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowsLabels.map((r) => (
            <tr key={r}>
              <td
                className="pr-2 text-right text-[11px] whitespace-nowrap"
                style={{ color: "var(--text-secondary)", maxWidth: 170 }}
              >
                <span className="block truncate" title={r}>
                  {r}
                </span>
              </td>
              {cols.map((c) => {
                const v = get(r, c);
                const t = v / max;
                return (
                  <td key={c} className="p-0">
                    <div
                      className="flex h-8 items-center justify-center rounded-[4px] text-[11px] tnum"
                      style={{
                        background: seqColor(t),
                        color:
                          v === 0
                            ? "var(--text-muted)"
                            : t > 0.55
                              ? "#ffffff"
                              : "var(--text-primary)",
                      }}
                      onMouseMove={(e) =>
                        show(
                          e,
                          <div className="space-y-1">
                            <div className="font-medium">{r}</div>
                            <TipRow
                              label={c}
                              value={cellLabel ? cellLabel(v) : String(v)}
                            />
                          </div>,
                        )
                      }
                      onMouseLeave={hide}
                    >
                      {v === 0 ? "·" : cellLabel ? cellLabel(v) : v}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <Tooltip tip={tip} width={700} />
    </div>
  );
}

/* =================================================================== gantt */

export interface GanttRow {
  label: string;
  sub?: string;
  start: string | null;
  end: string | null;
  color: string;
  progress?: number | null;
  marks?: { date: string; label: string }[];
}

export function Gantt({
  rows,
  min,
  max,
  today,
  height = 420,
}: {
  rows: GanttRow[];
  min: string;
  max: string;
  today: string;
  height?: number;
}) {
  const { tip, ref, show, hide } = useTooltip();
  const t0 = Date.parse(min),
    t1 = Date.parse(max);
  const span = Math.max(1, t1 - t0);
  const x = (iso: string) => ((Date.parse(iso) - t0) / span) * 100;

  const monthTicks = useMemo(() => {
    const out: { iso: string; label: string }[] = [];
    const d = new Date(t0);
    d.setUTCDate(1);
    while (d.getTime() <= t1) {
      const iso = d.toISOString().slice(0, 10);
      if (Date.parse(iso) >= t0)
        out.push({ iso, label: `${d.getUTCMonth() + 1}` });
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
    return out;
  }, [t0, t1]);

  return (
    <div ref={ref} className="relative">
      <div className="sm:hidden">
        <div className="relative mb-1 h-4">
          {monthTicks.map((m) => (
            <span
              key={m.iso}
              className="absolute text-[10px] tnum"
              style={{
                left: `${x(m.iso)}%`,
                color: "var(--text-muted)",
                transform: "translateX(-50%)",
              }}
            >
              {m.label}
            </span>
          ))}
        </div>
        <div className="space-y-2">
          {rows.map((r, index) => {
            const s = r.start ?? r.end;
            const e = r.end ?? r.start;
            const known = Boolean(r.start && r.end);
            return (
              <div
                key={`${r.label}-${r.sub ?? index}`}
                className="rounded-md border px-2 py-1.5"
              >
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate font-medium" title={r.label}>
                    {r.label}
                  </span>
                  {r.sub && (
                    <span className="tnum shrink-0 text-muted-foreground">
                      {r.sub}
                    </span>
                  )}
                </div>
                <div
                  className="relative mt-1.5 h-3"
                  onMouseMove={(event) =>
                    show(
                      event,
                      <div className="space-y-1">
                        <div className="font-medium">{r.label}</div>
                        <TipRow
                          label="Эхлэх"
                          value={r.start?.replaceAll("-", ".") ?? "тодорхойгүй"}
                        />
                        <TipRow
                          label="Дуусах"
                          value={r.end?.replaceAll("-", ".") ?? "тодорхойгүй"}
                        />
                      </div>,
                    )
                  }
                  onMouseLeave={hide}
                >
                  {monthTicks.map((m) => (
                    <div
                      key={m.iso}
                      className="absolute top-0 bottom-0 w-px"
                      style={{
                        left: `${x(m.iso)}%`,
                        background: "var(--grid)",
                      }}
                    />
                  ))}
                  <div
                    className="absolute top-0 bottom-0 w-px"
                    style={{
                      left: `${x(today)}%`,
                      background: "var(--status-critical)",
                    }}
                  />
                  {s && e && (
                    <>
                      <div
                        className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-[3px]"
                        style={{
                          left: `${Math.min(x(s), x(e))}%`,
                          width: `${Math.max(0.8, Math.abs(x(e) - x(s)))}%`,
                          background: known ? "var(--seq-zero)" : "transparent",
                          border: known ? "none" : "1px dashed var(--axis)",
                          minWidth: 3,
                        }}
                      />
                      {r.progress != null && known && (
                        <div
                          className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-[3px]"
                          style={{
                            left: `${Math.min(x(s), x(e))}%`,
                            width: `${Math.max(0.6, Math.abs(x(e) - x(s)) * Math.min(1, r.progress / 100))}%`,
                            background: r.color,
                          }}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="hidden sm:block">
        <div className="mb-1 grid grid-cols-[minmax(180px,28%)_1fr] gap-2">
          <div />
          <div className="relative h-4">
            {monthTicks.map((m) => (
              <span
                key={m.iso}
                className="absolute text-[10px] tnum"
                style={{
                  left: `${x(m.iso)}%`,
                  color: "var(--text-muted)",
                  transform: "translateX(-50%)",
                }}
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>
        <div className="relative">
          <div className="pointer-events-none absolute top-0 right-0 bottom-0 left-[calc(42%+0.375rem)] sm:left-[calc(28%+0.5rem)]">
            {monthTicks.map((m) => (
              <div
                key={m.iso}
                className="absolute top-0 bottom-0 w-px"
                style={{ left: `${x(m.iso)}%`, background: "var(--grid)" }}
              />
            ))}
            <div
              className="absolute top-0 bottom-0 w-px"
              style={{
                left: `${x(today)}%`,
                background: "var(--status-critical)",
              }}
            />
          </div>
          <div className="relative space-y-1.5">
            {rows.map((r, index) => {
              const s = r.start ?? r.end;
              const e = r.end ?? r.start;
              const known = Boolean(r.start && r.end);
              return (
                <div
                  key={`${r.label}-${r.sub ?? index}`}
                  className="grid grid-cols-[minmax(132px,42%)_1fr] items-center gap-1.5 sm:grid-cols-[minmax(180px,28%)_1fr] sm:gap-2"
                >
                  <div
                    className="truncate text-[11px]"
                    title={`${r.label}${r.sub ? ` — ${r.sub}` : ""}`}
                  >
                    <span style={{ color: "var(--text-primary)" }}>
                      {r.label}
                    </span>
                    {r.sub && (
                      <span style={{ color: "var(--text-muted)" }}>
                        {" "}
                        · {r.sub}
                      </span>
                    )}
                  </div>
                  <div
                    className="relative h-5"
                    onMouseMove={(e2) =>
                      show(
                        e2,
                        <div className="space-y-1">
                          <div className="font-medium">{r.label}</div>
                          {r.sub && (
                            <div style={{ color: "var(--text-muted)" }}>
                              {r.sub}
                            </div>
                          )}
                          <TipRow
                            label="Эхлэх"
                            value={
                              r.start?.replaceAll("-", ".") ?? "тодорхойгүй"
                            }
                          />
                          <TipRow
                            label="Дуусах"
                            value={r.end?.replaceAll("-", ".") ?? "тодорхойгүй"}
                          />
                          {r.progress != null && (
                            <TipRow
                              label="Санхүүжилт"
                              value={`${r.progress.toFixed(1)}%`}
                              color={r.color}
                            />
                          )}
                        </div>,
                      )
                    }
                    onMouseLeave={hide}
                  >
                    {s && e && (
                      <>
                        <div
                          className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-[3px]"
                          style={{
                            left: `${Math.min(x(s), x(e))}%`,
                            width: `${Math.max(0.8, Math.abs(x(e) - x(s)))}%`,
                            background: known
                              ? "var(--seq-zero)"
                              : "transparent",
                            border: known ? "none" : "1px dashed var(--axis)",
                            minWidth: 3,
                          }}
                        />
                        {r.progress != null && known && (
                          <div
                            className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-[3px]"
                            style={{
                              left: `${Math.min(x(s), x(e))}%`,
                              width: `${Math.max(0.6, Math.abs(x(e) - x(s)) * Math.min(1, r.progress / 100))}%`,
                              background: r.color,
                            }}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <Tooltip tip={tip} width={760} />
    </div>
  );
}

/* ============================================================ progress bar */

export function ProgressCell({
  value,
  color,
}: {
  value: number | null;
  color: string;
}) {
  if (value == null) {
    return <span style={{ color: "var(--text-muted)" }}>—</span>;
  }
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 w-16 shrink-0 rounded-full"
        style={{ background: "var(--seq-zero)" }}
      >
        <div
          className="h-1.5 rounded-full"
          style={{
            width: `${Math.min(100, Math.max(2, value))}%`,
            background: color,
          }}
        />
      </div>
      <span className="tnum text-xs">{value.toFixed(1)}%</span>
    </div>
  );
}

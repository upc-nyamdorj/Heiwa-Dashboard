"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  Card as ShadcnCard,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/* ------------------------------------------------------------------ shapes */

/**
 * Bar path with the 4px radius applied only at the *data end* — the baseline
 * end stays square so the mark reads as anchored to zero.
 */
export function barPath(
  x: number,
  y: number,
  w: number,
  h: number,
  dir: "up" | "right",
  r = 4,
): string {
  const rad = Math.max(
    0,
    Math.min(r, dir === "up" ? h : w, (dir === "up" ? w : h) / 2),
  );
  if (dir === "up") {
    if (h <= 0) return "";
    return (
      `M${x},${y + h}L${x},${y + rad}Q${x},${y} ${x + rad},${y}` +
      `L${x + w - rad},${y}Q${x + w},${y} ${x + w},${y + rad}L${x + w},${y + h}Z`
    );
  }
  if (w <= 0) return "";
  return (
    `M${x},${y}L${x + w - rad},${y}Q${x + w},${y} ${x + w},${y + rad}` +
    `L${x + w},${y + h - rad}Q${x + w},${y + h} ${x + w - rad},${y + h}L${x},${y + h}Z`
  );
}

export function linePath(pts: [number, number][]): string {
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join("");
}

/** "Nice" axis maximum plus the tick values below it. */
export function niceScale(
  max: number,
  targetTicks = 4,
): { max: number; ticks: number[] } {
  if (!Number.isFinite(max) || max <= 0) return { max: 1, ticks: [0, 1] };
  const raw = max / targetTicks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step)
    ticks.push(Number(v.toFixed(6)));
  return { max: top, ticks };
}

/* ----------------------------------------------------------------- tooltip */

export interface TipState {
  x: number;
  y: number;
  node: React.ReactNode;
}

export function useTooltip() {
  const [tip, setTip] = useState<TipState | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const show = useCallback((e: React.MouseEvent, node: React.ReactNode) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, node });
  }, []);
  const hide = useCallback(() => setTip(null), []);
  return { tip, ref, show, hide };
}

export function Tooltip({
  tip,
  width,
}: {
  tip: TipState | null;
  width: number;
}) {
  if (!tip) return null;
  const flip = tip.x > width - 220;
  return (
    <div
      className="pointer-events-none absolute z-20 rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{
        left: tip.x + (flip ? -12 : 12),
        top: tip.y + 12,
        transform: flip ? "translateX(-100%)" : undefined,
        background: "var(--surface-1)",
        border: "1px solid var(--border-strong)",
        color: "var(--text-primary)",
        maxWidth: 260,
      }}
    >
      {tip.node}
    </div>
  );
}

export function TipRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span
        className="flex items-center gap-1.5"
        style={{ color: "var(--text-secondary)" }}
      >
        {color && (
          <span
            className="inline-block h-2 w-2 rounded-[2px]"
            style={{ background: color }}
          />
        )}
        {label}
      </span>
      <span className="tnum font-medium">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ legend */

export interface LegendItem {
  label: string;
  color: string;
  hint?: string;
}

export function Legend({
  items,
  className = "",
}: {
  items: LegendItem[];
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
      {items.map((it) => (
        <span
          key={it.label}
          className="flex items-center gap-1.5 text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          <span
            className="inline-block h-2.5 w-2.5 rounded-[3px]"
            style={{ background: it.color }}
          />
          {it.label}
          {it.hint && (
            <span style={{ color: "var(--text-muted)" }}>{it.hint}</span>
          )}
        </span>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- containers */

export function Card({
  title,
  subtitle,
  right,
  children,
  className = "",
  bodyClass = "",
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <ShadcnCard className={className}>
      {(title || right) && (
        <CardHeader className="flex-row items-start justify-between gap-3 px-3 pt-3 pb-1.5 sm:px-4 sm:pt-4">
          <div>
            {title && <CardTitle>{title}</CardTitle>}
            {subtitle && (
              <CardDescription className="mt-0.5">{subtitle}</CardDescription>
            )}
          </div>
          {right}
        </CardHeader>
      )}
      <CardContent className={`px-3 pb-3 sm:px-4 sm:pb-4 ${bodyClass}`}>
        {children}
      </CardContent>
    </ShadcnCard>
  );
}

export function StatTile({
  label,
  value,
  sub,
  accent,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  tone?: "good" | "warning" | "critical";
}) {
  const toneColor = tone
    ? {
        good: "var(--success-text)",
        warning: "var(--status-warning)",
        critical: "var(--status-critical)",
      }[tone]
    : undefined;
  return (
    <ShadcnCard className="px-3 py-2.5 sm:px-4 sm:py-3">
      <div
        className="flex items-center gap-2 text-xs"
        style={{ color: "var(--text-muted)" }}
      >
        {accent && (
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: accent }}
          />
        )}
        {label}
      </div>
      <div
        className="mt-1 text-xl leading-tight font-semibold sm:mt-1.5 sm:text-2xl"
        style={{ color: toneColor ?? "var(--text-primary)" }}
      >
        {value}
      </div>
      {sub && (
        <div
          className="mt-1 text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          {sub}
        </div>
      )}
    </ShadcnCard>
  );
}

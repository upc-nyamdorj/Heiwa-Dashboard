"use client";

import React, { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select as ShadcnSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

export interface Column<T> {
  key: string;
  header: string;
  /** Value used for sorting and for the CSV export. */
  value: (row: T) => string | number | null;
  render?: (row: T) => React.ReactNode;
  align?: "left" | "right";
  width?: number;
  strong?: boolean;
}

/**
 * Link out to the row's own PDF in SharePoint. Opening it is a separate
 * authorisation from the dashboard's: the viewer needs their own Microsoft
 * login on the site, which is the point — the dashboard never proxies the file.
 */
function SourceLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Эх файлыг OneDrive-д нээх"
      aria-label="Эх файлыг OneDrive-д нээх"
      className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:size-7"
    >
      <ExternalLink className="size-3.5" aria-hidden="true" />
    </a>
  );
}

export function DataTable<T>({
  rows,
  columns,
  initialSort,
  pageSize = 25,
  dense = false,
  emptyText = "Мөр алга",
  sourceUrl,
}: {
  rows: T[];
  columns: Column<T>[];
  initialSort?: { key: string; dir: "asc" | "desc" };
  pageSize?: number;
  dense?: boolean;
  emptyText?: string;
  /**
   * Where this row's source document lives, when it is known. Rows that
   * return nothing simply get no icon — a disabled control would invite a
   * click and explain nothing — and if no row in the whole set has one, the
   * column is not rendered at all rather than sitting there empty.
   */
  sourceUrl?: (row: T) => string | null | undefined;
}) {
  const [sort, setSort] = useState(
    initialSort ?? { key: columns[0].key, dir: "asc" as const },
  );
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key) ?? columns[0];
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.value(a),
        vb = col.value(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1; // blanks always sink
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number")
        return (va - vb) * dir;
      return String(va).localeCompare(String(vb), "mn") * dir;
    });
  }, [rows, columns, sort]);

  // Decided over every row, not the current page, so the column does not
  // appear and vanish as you page through.
  const hasSourceLinks = useMemo(
    () => (sourceUrl ? rows.some((r) => sourceUrl(r)) : false),
    [rows, sourceUrl],
  );

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages - 1);
  const slice = sorted.slice(current * pageSize, current * pageSize + pageSize);

  const toggle = (key: string) => {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
    setPage(0);
  };

  return (
    <div>
      <div className="overflow-x-auto scroll">
        <table className="grid" style={dense ? { fontSize: 12 } : undefined}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  role="button"
                  tabIndex={0}
                  aria-sort={
                    sort.key === c.key
                      ? sort.dir === "asc" ? "ascending" : "descending"
                      : "none"
                  }
                  onClick={() => toggle(c.key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggle(c.key);
                    }
                  }}
                  style={{ minWidth: c.width, textAlign: c.align ?? "left" }}
                >
                  {c.header}
                  <span style={{ color: "var(--text-muted)" }}>
                    {sort.key === c.key
                      ? sort.dir === "asc"
                        ? " ↑"
                        : " ↓"
                      : ""}
                  </span>
                </th>
              ))}
              {hasSourceLinks && (
                <th style={{ width: 1 }} className="no-print">
                  <span className="sr-only">Эх файл</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={c.strong ? "strong" : undefined}
                    style={{
                      textAlign: c.align ?? "left",
                      fontVariantNumeric:
                        c.align === "right" ? "tabular-nums" : undefined,
                    }}
                  >
                    {c.render ? c.render(r) : (c.value(r) ?? "—")}
                  </td>
                ))}
                {hasSourceLinks && (
                  <td className="no-print" style={{ width: 1 }}>
                    {(() => {
                      const href = sourceUrl?.(r);
                      return href ? <SourceLink href={href} /> : null;
                    })()}
                  </td>
                )}
              </tr>
            ))}
            {slice.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + (hasSourceLinks ? 1 : 0)}
                  className="py-6 text-center"
                  style={{ color: "var(--text-muted)" }}
                >
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div
          className="mt-2 flex items-center justify-between text-xs no-print"
          style={{ color: "var(--text-muted)" }}
        >
          <span className="tnum">
            {current * pageSize + 1}–
            {Math.min(sorted.length, (current + 1) * pageSize)} /{" "}
            {sorted.length}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(0, current - 1))}
              disabled={current === 0}
            >
              ← Өмнөх
            </Button>
            <span className="tnum px-1.5 py-1">
              {current + 1} / {pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(pages - 1, current + 1))}
              disabled={current >= pages - 1}
            >
              Дараах →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- controls */

export function SearchBox({
  value,
  onChange,
  placeholder = "Хайх…",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Input
      className={className}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Select({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label?: string;
}) {
  return (
    <label
      className="flex items-center gap-1.5 text-xs"
      style={{ color: "var(--text-muted)" }}
    >
      {label}
      <ShadcnSelect
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue != null) onChange(nextValue);
        }}
      >
        <SelectTrigger aria-label={label ?? "Шүүлтүүр"}>
          <span className="truncate">
            {options.find((option) => option.value === value)?.label ?? value}
          </span>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </ShadcnSelect>
    </label>
  );
}

export function Toggles({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <Button
          key={o.value}
          size="sm"
          variant={value === o.value ? "default" : "outline"}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}

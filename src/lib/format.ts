const MN = 'mn-MN';

/** 1 234 567 890 — full precision, for tables and tooltips. */
export function num(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return new Intl.NumberFormat(MN, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v);
}

export function mnt(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return `₮${num(v, digits)}`;
}

/** 8.6 тэрбум / 546.0 сая — for axis ticks and stat tiles. */
export function compact(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(a >= 1e10 ? 1 : 2)} тэрбум`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(a >= 1e8 ? 0 : 1)} сая`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(0)} мянга`;
  return num(v);
}

/** Short axis tick: 8.6Т / 546С / 12.3М */
export function tick(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(1)}Т`;
  if (a >= 1e6) return `${Math.round(v / 1e6)}С`;
  if (a >= 1e3) return `${Math.round(v / 1e3)}М`;
  return String(v);
}

export function bytes(v: number): string {
  if (v >= 1 << 30) return `${(v / (1 << 30)).toFixed(1)} GB`;
  if (v >= 1 << 20) return `${(v / (1 << 20)).toFixed(1)} MB`;
  if (v >= 1 << 10) return `${(v / (1 << 10)).toFixed(0)} KB`;
  return `${v} B`;
}

export function pct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return `${v.toFixed(digits)}%`;
}

export function date(v: string | null | undefined): string {
  if (!v) return '—';
  return v.replaceAll('-', '.');
}

const MONTHS_MN = [
  '1-р сар', '2-р сар', '3-р сар', '4-р сар', '5-р сар', '6-р сар',
  '7-р сар', '8-р сар', '9-р сар', '10-р сар', '11-р сар', '12-р сар',
];

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `${MONTHS_MN[Number(m) - 1]} ’${y.slice(2)}`;
}

export function monthShort(key: string): string {
  const [, m] = key.split('-');
  return `${Number(m)}`;
}

/** Inclusive list of YYYY-MM between two ISO dates. */
export function monthRange(minIso: string, maxIso: string): string[] {
  const out: string[] = [];
  let [y, m] = [Number(minIso.slice(0, 4)), Number(minIso.slice(5, 7))];
  const [ey, em] = [Number(maxIso.slice(0, 4)), Number(maxIso.slice(5, 7))];
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

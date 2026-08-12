/**
 * Chart colour roles.
 *
 * These are the validated default categorical slots from the data-viz palette,
 * used in fixed order and never cycled. Both light and dark columns pass the
 * six checks against their own surface (`scripts/validate_palette.js`):
 *   light — worst adjacent CVD ΔE 9.1, normal-vision ΔE 19.6
 *   dark  — worst adjacent CVD ΔE 8.4, normal-vision ΔE 19.3
 * Three light slots sit below 3:1 contrast, so every chart that uses them also
 * ships visible labels or a table view (the relief rule).
 *
 * The CSS variables themselves live in globals.css; this module is the
 * TypeScript-side index so a series can be pinned to an entity, not to its rank.
 */
export const SERIES = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
  'var(--series-6)',
  'var(--series-7)',
] as const;

export const STATUS = {
  good: 'var(--status-good)',
  warning: 'var(--status-warning)',
  serious: 'var(--status-serious)',
  critical: 'var(--status-critical)',
} as const;

/** Sequential blue ramp, light → dark. Index 0 = near zero. */
export const SEQ = [
  '#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef',
  '#6da7ec', '#5598e7', '#3987e5', '#2a78d6',
  '#256abf', '#1c5cab', '#184f95',
];

export function seqColor(t: number): string {
  if (!Number.isFinite(t) || t <= 0) return 'var(--seq-zero)';
  const i = Math.min(SEQ.length - 1, Math.max(0, Math.round(t * (SEQ.length - 1))));
  return SEQ[i];
}

/**
 * Colour follows the entity, never its rank: the same category keeps its hue
 * no matter which subset a filter leaves on screen.
 */
export const CATEGORY_ORDER = [
  'Ажил гүйцэтгэгч',
  'Бараа материал нийлүүлэгч',
  'Бетон зуурмаг нийлүүлэгч',
  'Геодези, хөрсний шинжилгээ',
  'Зураг зохиогч',
  'Машин механизм түрээс',
  'Харуул, хамгаалалт',
];

export function categoryColor(name: string): string {
  const i = CATEGORY_ORDER.indexOf(name);
  return SERIES[i >= 0 ? i % SERIES.length : 0];
}

/** Short labels for the tighter axes. */
export const CATEGORY_SHORT: Record<string, string> = {
  'Ажил гүйцэтгэгч': 'Ажил гүйцэтгэгч',
  'Бараа материал нийлүүлэгч': 'Бараа материал',
  'Бетон зуурмаг нийлүүлэгч': 'Бетон зуурмаг',
  'Геодези, хөрсний шинжилгээ': 'Геодези',
  'Зураг зохиогч': 'Зураг зохиогч',
  'Машин механизм түрээс': 'Машин механизм',
  'Харуул, хамгаалалт': 'Харуул хамгаалалт',
};

export const TYPE_GROUP: Record<string, string> = {
  CWA: 'Гэрээ', CMA: 'Гэрээ', 'CMA+CWA': 'Гэрээ', CONTRACT: 'Гэрээ', WARRANTY: 'Гэрээ',
  IPR: 'Санхүүжилт', LPR: 'Санхүүжилт', EPR: 'Санхүүжилт', EC: 'Санхүүжилт',
  LETTER: 'Захидал', RFI: 'Захидал', SITE_LETTER: 'Захидал', SITE_INSTR: 'Захидал',
  NCR: 'Чанар', PENALTY: 'Чанар',
  LICENSE: 'Бусад', TOR: 'Бусад', OPINION: 'Бусад', ATTACH: 'Бусад', OTHER: 'Бусад',
};

export const TYPE_GROUP_ORDER = ['Гэрээ', 'Санхүүжилт', 'Захидал', 'Чанар', 'Бусад'];

export function typeGroupColor(g: string): string {
  const i = TYPE_GROUP_ORDER.indexOf(g);
  return SERIES[i >= 0 ? i : 0];
}

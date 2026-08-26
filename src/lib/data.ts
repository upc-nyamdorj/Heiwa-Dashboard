import raw from '@/data/heiwa.json';
import type { Dataset, Contract, Payment, DocumentRow, Correspondence } from './types';
import { monthKey, monthRange } from './format';

export const data = raw as unknown as Dataset;

export const {
  meta, documents, contracts, payments, correspondence, quality, drawings,
  audit, coverage, spotCheck,
} = data;

/* ------------------------------------------------------------------ totals */

export const countedPayments = payments.filter((p) => p.counted);

export function computeTotalPaid(counted: Payment[]): number {
  return counted.reduce((s, p) => s + (p.amount ?? 0), 0);
}

export const totalPaid = computeTotalPaid(countedPayments);

export const supersededTotal = payments
  .filter((p) => p.supersededBy)
  .reduce((s, p) => s + (p.amount ?? 0), 0);

export const mntContracts = contracts.filter((c) => c.currency === 'MNT' && c.value);

export function computeTotalContractValue(mntOnly: Contract[]): number {
  return mntOnly.reduce((s, c) => s + (c.value ?? 0), 0);
}

export const totalContractValue = computeTotalContractValue(mntContracts);

export const foreignContracts = contracts.filter((c) => c.currency !== 'MNT' && c.value);

export const parties = Array.from(new Set(documents.map((d) => d.party)))
  .filter((p) => p !== '—')
  .sort((a, b) => a.localeCompare(b, 'mn'));

/* ------------------------------------------------------------- time series */

export const months = monthRange(meta.dateMin, meta.dateMax);

export interface MonthPoint {
  key: string;
  paid: number;
  cumulative: number;
  docs: number;
  contractsSigned: number;
  contractValue: number;
}

export function computeByMonth(
  monthsIn: string[],
  countedPaymentsIn: Payment[],
  documentsIn: DocumentRow[],
  contractsIn: Contract[],
): MonthPoint[] {
  const m = new Map<string, MonthPoint>();
  monthsIn.forEach((k) =>
    m.set(k, { key: k, paid: 0, cumulative: 0, docs: 0, contractsSigned: 0, contractValue: 0 }));
  for (const p of countedPaymentsIn) {
    if (!p.date) continue;
    const row = m.get(monthKey(p.date));
    if (row) row.paid += p.amount ?? 0;
  }
  for (const d of documentsIn) {
    if (!d.date) continue;
    const row = m.get(monthKey(d.date));
    if (row) row.docs += 1;
  }
  for (const c of contractsIn) {
    if (!c.signedDate) continue;
    const row = m.get(monthKey(c.signedDate));
    if (!row) continue;
    row.contractsSigned += 1;
    if (c.currency === 'MNT') row.contractValue += c.value ?? 0;
  }
  let run = 0;
  const out = monthsIn.map((k) => m.get(k)!);
  for (const row of out) { run += row.paid; row.cumulative = run; }
  return out;
}

export const byMonth: MonthPoint[] = computeByMonth(months, countedPayments, documents, contracts);

/* --------------------------------------------------------- party roll-ups */

export interface PartyRoll {
  party: string;
  category: string;
  contractValue: number;
  paid: number;
  paidPercent: number | null;
  contractCount: number;
  paymentCount: number;
  docCount: number;
  rateBased: boolean;
  currencies: string[];
}

export function computeByParty(
  documentsIn: DocumentRow[],
  contractsIn: Contract[],
  countedPaymentsIn: Payment[],
): PartyRoll[] {
  const m = new Map<string, PartyRoll>();
  const touch = (party: string, category: string) => {
    if (!m.has(party)) {
      m.set(party, {
        party, category, contractValue: 0, paid: 0, paidPercent: null,
        contractCount: 0, paymentCount: 0, docCount: 0,
        rateBased: false, currencies: [],
      });
    }
    return m.get(party)!;
  };
  for (const d of documentsIn) {
    if (d.party === '—') continue;
    touch(d.party, d.category).docCount += 1;
  }
  for (const c of contractsIn) {
    const r = touch(c.party, c.category);
    r.contractCount += 1;
    if (c.currency === 'MNT') r.contractValue += c.value ?? 0;
    if (!r.currencies.includes(c.currency)) r.currencies.push(c.currency);
    if (c.rateBased) r.rateBased = true;
  }
  for (const p of countedPaymentsIn) {
    const r = touch(p.party, p.category);
    r.paid += p.amount ?? 0;
    r.paymentCount += 1;
  }
  for (const r of m.values()) {
    r.paidPercent = r.contractValue > 0 ? (r.paid / r.contractValue) * 100 : null;
  }
  return Array.from(m.values()).sort((a, b) => b.contractValue - a.contractValue);
}

export const byParty: PartyRoll[] = computeByParty(documents, contracts, countedPayments);

/* ------------------------------------------------------------- doc matrix */

export function docMatrix(rows: DocumentRow[]) {
  const cats = Array.from(new Set(rows.map((r) => r.category)));
  const types = Array.from(new Set(rows.map((r) => r.typeLabel)));
  const cells = new Map<string, number>();
  for (const r of rows) {
    const k = `${r.category}|${r.typeLabel}`;
    cells.set(k, (cells.get(k) ?? 0) + 1);
  }
  return { cats, types, get: (c: string, t: string) => cells.get(`${c}|${t}`) ?? 0 };
}

/* ------------------------------------------------------- contract helpers */

export function paymentsFor(c: Contract): Payment[] {
  return payments
    .filter((p) => p.contractKey === c.key)
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
}

/** Contracts whose end date has passed but which are not fully paid. */
export const overdueContracts = contracts.filter(
  (c) => c.end && c.end < meta.dateMax && c.value && (c.paidPercent ?? 0) < 95,
);

/** Contracts with no payment report at all in the archive. */
export const unpaidContracts = contracts.filter((c) => c.paymentCount === 0);

/* -------------------------------------------------------- correspondence */

export const rfi = correspondence.filter((c) => c.typeCode === 'RFI');

export interface RfiPair {
  no: string;
  outDate: string | null;
  inDate: string | null;
  turnaround: number | null;
  party: string;
}

/**
 * RFIs are numbered; an outgoing 004 and an incoming 004 are the same thread.
 * Turnaround is the gap between the question leaving and the answer arriving.
 */
export function computeRfiThreads(rfiIn: Correspondence[]): RfiPair[] {
  const m = new Map<string, RfiPair>();
  for (const c of rfiIn) {
    const no = c.docNo ?? c.filename;
    if (!m.has(no)) {
      m.set(no, { no, outDate: null, inDate: null, turnaround: null, party: c.party });
    }
    const t = m.get(no)!;
    if (c.direction === 'out') t.outDate = c.date;
    if (c.direction === 'in') t.inDate = c.date;
  }
  for (const t of m.values()) {
    if (t.outDate && t.inDate) {
      t.turnaround = Math.round((Date.parse(t.inDate) - Date.parse(t.outDate)) / 86_400_000);
    }
  }
  return Array.from(m.values()).sort((a, b) => a.no.localeCompare(b.no));
}

export const rfiThreads: RfiPair[] = computeRfiThreads(rfi);

/* -------------------------------------------------------------- drawings */

export const drawingCompanies = Array.from(new Set(drawings.map((d) => d.company)));
export const drawingDisciplines = Array.from(
  new Set(drawings.map((d) => d.drawing).filter(Boolean) as string[]),
);
export const totalDrawingPages = drawings.reduce((s, d) => s + (d.pages ?? 0), 0);
export const drawingsPending = drawings.filter((d) => d.status !== 'Хүлээн авсан');

/** Blocks referenced anywhere in the register, in building order. */
export const BLOCKS = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'G1', 'G2', 'G3', 'G4', 'C1'];

export function blocksOf(d: { block: string | null }): string[] {
  if (!d.block) return [];
  const hay = d.block.toUpperCase().replace(/А/g, 'A').replace(/С/g, 'C').replace(/Г/g, 'G');
  const found = BLOCKS.filter((b) => hay.includes(b));
  // "А1-А6" style ranges
  const m = hay.match(/A([1-6])\s*[-–]\s*A([1-6])/);
  if (m) {
    for (let i = Number(m[1]); i <= Number(m[2]); i += 1) {
      if (!found.includes(`A${i}`)) found.push(`A${i}`);
    }
  }
  return found;
}

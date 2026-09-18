import { z } from 'zod';
import type { Dataset, Contract, Payment, DocumentRow, Correspondence, QualityRow } from './types';
import { DatasetSchema } from './schema';
import { monthKey, monthRange } from './format';

/**
 * The dataset is no longer imported here.
 *
 * Under `output: 'export'` an import of heiwa.json is compiled into a public
 * JS chunk, which put every contract sum and payment figure a plain fetch of
 * out/_next/static/chunks/*.js away — the login screen gated the UI, not the
 * data. The file now lives in the Worker bundle (worker/data/heiwa.json) and
 * reaches the browser only through GET /api/data, which requires a session.
 *
 * So this module exports a builder over raw JSON instead of constants, and
 * DataProvider calls it once with what the endpoint returned. Everything
 * below the builder is pure: derivations that take their inputs as arguments,
 * unit-testable without a dataset, and shared with src/lib/data.test.ts.
 */

/* ------------------------------------------------------------ derivations */

export function computeTotalPaid(counted: Payment[]): number {
  return counted.reduce((s, p) => s + (p.amount ?? 0), 0);
}

export function computeTotalContractValue(mntOnly: Contract[]): number {
  return mntOnly.reduce((s, c) => s + (c.value ?? 0), 0);
}

/* ------------------------------------------------------------- time series */

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

/* -------------------------------------------------------- correspondence */

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

/* --------------------------------------------------------- risk scorecard */

export interface PartyRisk {
  party: string;
  category: string;
  score: number;
  tier: 'Бага' | 'Дунд' | 'Өндөр';
  qualityCount: number;
  overdueCount: number;
  avgRfiTurnaround: number | null;
  unpaidCount: number;
}

/**
 * Placeholder weighting — signed off by business, not final:
 *   чанарын зөрчил (NCR/акт)         40%
 *   хугацаа хэтэрсэн гэрээ           30%
 *   RFI хариу өгөх удаашрал          20%
 *   санхүүжилтийн тайлан ирээгүй    10%
 * Each input is scaled against the worst value seen in this project (not an
 * absolute benchmark), so a score of 100 in one dimension means "the most
 * exposed party in the archive on this measure", not a fixed threshold.
 */
const RISK_WEIGHTS = { quality: 0.4, overdue: 0.3, rfi: 0.2, unpaid: 0.1 };

/** Ranked risk score (0-100) per contracting party, highest risk first. */
export function computePartyRisk(
  byParty: PartyRoll[],
  quality: QualityRow[],
  overdueContracts: Contract[],
  rfiThreads: RfiPair[],
  unpaidContracts: Contract[],
): PartyRisk[] {

  const raw = byParty
    .filter((p) => p.contractCount > 0)
    .map((p) => {
      const qualityCount = quality.filter((q) => q.party === p.party).length;
      const overdueCount = overdueContracts.filter((c) => c.party === p.party).length;
      const turnarounds = rfiThreads
        .filter((t) => t.party === p.party && t.turnaround != null)
        .map((t) => t.turnaround as number);
      const avgRfiTurnaround = turnarounds.length
        ? turnarounds.reduce((s, v) => s + v, 0) / turnarounds.length
        : null;
      const unpaidCount = unpaidContracts.filter((c) => c.party === p.party).length;
      return { party: p.party, category: p.category, qualityCount, overdueCount, avgRfiTurnaround, unpaidCount };
    });

  const maxOf = (values: number[]) => Math.max(1, ...values);
  const maxQuality = maxOf(raw.map((r) => r.qualityCount));
  const maxOverdue = maxOf(raw.map((r) => r.overdueCount));
  const maxTurnaround = maxOf(raw.map((r) => r.avgRfiTurnaround ?? 0));
  const maxUnpaid = maxOf(raw.map((r) => r.unpaidCount));

  return raw
    .map((r) => {
      const score = Math.round(
        RISK_WEIGHTS.quality * (r.qualityCount / maxQuality) * 100
        + RISK_WEIGHTS.overdue * (r.overdueCount / maxOverdue) * 100
        + RISK_WEIGHTS.rfi * ((r.avgRfiTurnaround ?? 0) / maxTurnaround) * 100
        + RISK_WEIGHTS.unpaid * (r.unpaidCount / maxUnpaid) * 100,
      );
      const tier: PartyRisk['tier'] = score >= 50 ? 'Өндөр' : score >= 20 ? 'Дунд' : 'Бага';
      return { ...r, score, tier };
    })
    .sort((a, b) => b.score - a.score);
}

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

/* ------------------------------------------------------------- the bundle */

/** Everything a view can read, derived once from one payload. */
export interface DashboardData {
  data: Dataset;
  meta: Dataset['meta'];
  documents: DocumentRow[];
  contracts: Contract[];
  payments: Payment[];
  correspondence: Correspondence[];
  quality: Dataset['quality'];
  drawings: Dataset['drawings'];
  audit: Dataset['audit'];
  coverage: Dataset['coverage'];
  spotCheck: Dataset['spotCheck'];
  countedPayments: Payment[];
  totalPaid: number;
  supersededTotal: number;
  mntContracts: Contract[];
  totalContractValue: number;
  foreignContracts: Contract[];
  parties: string[];
  months: string[];
  byMonth: MonthPoint[];
  byParty: PartyRoll[];
  paymentsFor: (c: Contract) => Payment[];
  overdueContracts: Contract[];
  unpaidContracts: Contract[];
  rfi: Correspondence[];
  rfiThreads: RfiPair[];
  drawingCompanies: string[];
  drawingDisciplines: string[];
  totalDrawingPages: number;
  drawingsPending: Dataset['drawings'];
  partyRisk: PartyRisk[];
}

/** Validates the payload, then derives every roll-up the dashboard renders. */
export function buildDataset(raw: unknown): DashboardData {
  const parsed = DatasetSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `/api/data does not match the expected schema (see src/lib/schema.ts):\n\n${z.prettifyError(parsed.error)}`,
    );
  }
  const data = parsed.data;
  const {
    meta, documents, contracts, payments, correspondence, quality, drawings,
    audit, coverage, spotCheck,
  } = data;

  const countedPayments = payments.filter((p) => p.counted);
  const mntContracts = contracts.filter((c) => c.currency === 'MNT' && c.value);
  const months = monthRange(meta.dateMin, meta.dateMax);
  const byParty = computeByParty(documents, contracts, countedPayments);

  /** Contracts whose end date has passed but which are not fully paid. */
  const overdueContracts = contracts.filter(
    (c) => c.end && c.end < meta.dateMax && c.value && (c.paidPercent ?? 0) < 95,
  );
  /** Contracts with no payment report at all in the archive. */
  const unpaidContracts = contracts.filter((c) => c.paymentCount === 0);
  const rfi = correspondence.filter((c) => c.typeCode === 'RFI');
  const rfiThreads = computeRfiThreads(rfi);

  return {
    data, meta, documents, contracts, payments, correspondence, quality, drawings,
    audit, coverage, spotCheck,
    countedPayments,
    totalPaid: computeTotalPaid(countedPayments),
    supersededTotal: payments
      .filter((p) => p.supersededBy)
      .reduce((s, p) => s + (p.amount ?? 0), 0),
    mntContracts,
    totalContractValue: computeTotalContractValue(mntContracts),
    foreignContracts: contracts.filter((c) => c.currency !== 'MNT' && c.value),
    parties: Array.from(new Set(documents.map((d) => d.party)))
      .filter((p) => p !== '—')
      .sort((a, b) => a.localeCompare(b, 'mn')),
    months,
    byMonth: computeByMonth(months, countedPayments, documents, contracts),
    byParty,
    paymentsFor: (c: Contract) => payments
      .filter((p) => p.contractKey === c.key)
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')),
    overdueContracts,
    unpaidContracts,
    rfi,
    rfiThreads,
    drawingCompanies: Array.from(new Set(drawings.map((d) => d.company))),
    drawingDisciplines: Array.from(
      new Set(drawings.map((d) => d.drawing).filter(Boolean) as string[]),
    ),
    totalDrawingPages: drawings.reduce((s, d) => s + (d.pages ?? 0), 0),
    drawingsPending: drawings.filter((d) => d.status !== 'Хүлээн авсан'),
    partyRisk: computePartyRisk(byParty, quality, overdueContracts, rfiThreads, unpaidContracts),
  };
}

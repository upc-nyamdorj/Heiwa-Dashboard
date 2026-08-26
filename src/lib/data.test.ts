import { describe, expect, it } from 'vitest';
import {
  computeTotalPaid, computeTotalContractValue, computeByMonth, computeByParty,
  computeRfiThreads, blocksOf, BLOCKS,
} from './data';
import type { Contract, Payment, DocumentRow, Correspondence } from './types';

function contract(overrides: Partial<Contract>): Contract {
  return {
    key: 'BI/000', system: 'BI', docNo: '000', contractNo: null, party: 'Тал ХХК',
    partyRole: null, category: 'Ажил гүйцэтгэгч', categoryNo: '1', typeCode: 'CWA',
    typeLabel: 'Ажил гүйцэтгэх гэрээ', filename: '', path: '', signedDate: null,
    start: null, end: null, periodSource: 'гэрээ', value: null, valueBasis: 'нийт',
    valueBasisNote: null, baseValue: null, currency: 'MNT', vatIncluded: null,
    advancePercent: null, retentionPercent: null, scope: null, notes: null,
    amendments: [], paid: 0, paymentCount: 0, paidPercent: null, rateBased: false,
    ...overrides,
  };
}

function payment(overrides: Partial<Payment>): Payment {
  return {
    id: 'p000', path: '', filename: '', party: 'Тал ХХК', category: 'Ажил гүйцэтгэгч',
    typeCode: 'IPR', typeLabel: '', seqNo: null, docNo: null, system: null,
    contractKey: null, contractNo: null, workName: null, date: null, fileDate: null,
    workPeriodStart: null, workPeriodEnd: null, amount: null, grossAmount: null,
    advance: null, warranty: null, netToContractor: null, supersededBy: null,
    counted: true, notes: null,
    ...overrides,
  };
}

function doc(overrides: Partial<DocumentRow>): DocumentRow {
  return {
    id: 'd000', path: '', filename: '', ext: 'pdf', sizeBytes: 0,
    category: 'Ажил гүйцэтгэгч', categoryNo: '1', party: 'Тал ХХК', partyRole: null,
    folder: null, docNo: null, system: null, typeCode: 'LETTER', typeLabel: '',
    seqNo: null, direction: null, date: null, isAmendment: false,
    isDuplicateFile: false, supersededBy: null, contractKey: null,
    ...overrides,
  };
}

function corr(overrides: Partial<Correspondence>): Correspondence {
  return {
    id: 'c000', path: '', filename: '', party: 'Тал ХХК', category: 'Ажил гүйцэтгэгч',
    typeCode: 'RFI', typeLabel: 'RFI', docNo: null, system: null, direction: null,
    date: null,
    ...overrides,
  };
}

describe('computeTotalPaid', () => {
  it('sums payment amounts', () => {
    const total = computeTotalPaid([
      payment({ amount: 1000 }),
      payment({ amount: 2500 }),
    ]);
    expect(total).toBe(3500);
  });

  it('treats a null amount as zero', () => {
    const total = computeTotalPaid([payment({ amount: null }), payment({ amount: 500 })]);
    expect(total).toBe(500);
  });

  it('returns 0 for an empty list', () => {
    expect(computeTotalPaid([])).toBe(0);
  });
});

describe('computeTotalContractValue', () => {
  it('sums contract values', () => {
    const total = computeTotalContractValue([
      contract({ value: 100_000_000 }),
      contract({ value: 50_000_000 }),
    ]);
    expect(total).toBe(150_000_000);
  });

  it('treats a null value as zero', () => {
    const total = computeTotalContractValue([contract({ value: null }), contract({ value: 10 })]);
    expect(total).toBe(10);
  });
});

describe('blocksOf', () => {
  it('returns an empty array when block is null', () => {
    expect(blocksOf({ block: null })).toEqual([]);
  });

  it('finds a single Latin block', () => {
    expect(blocksOf({ block: 'A2' })).toEqual(['A2']);
  });

  it('is case-insensitive', () => {
    expect(blocksOf({ block: 'a2' })).toEqual(['A2']);
  });

  it('normalizes Cyrillic look-alike letters (А, С, Г) to Latin', () => {
    expect(blocksOf({ block: 'А2' })).toEqual(['A2']);
    expect(blocksOf({ block: 'С1' })).toEqual(['C1']);
    expect(blocksOf({ block: 'Г3' })).toEqual(['G3']);
  });

  // blocksOf doesn't promise an output order (every call site only checks
  // membership), so range tests compare the resulting *set* rather than the
  // exact array — the range endpoints can otherwise appear before the
  // in-between blocks depending on match order.
  it('expands a Cyrillic "А1-А6" range to every block in between', () => {
    expect(blocksOf({ block: 'А1-А6' }).sort()).toEqual(['A1', 'A2', 'A3', 'A4', 'A5', 'A6']);
  });

  it('expands a mixed Cyrillic/Latin range with an en dash', () => {
    expect(blocksOf({ block: 'А1–A6' }).sort()).toEqual(['A1', 'A2', 'A3', 'A4', 'A5', 'A6']);
  });

  it('expands a partial range', () => {
    expect(blocksOf({ block: 'A3-A5' }).sort()).toEqual(['A3', 'A4', 'A5']);
  });

  it('finds multiple non-contiguous blocks in free text', () => {
    expect(blocksOf({ block: 'G1, G3 блокийн зураг' })).toEqual(['G1', 'G3']);
  });

  it('finds a block embedded in surrounding text', () => {
    expect(blocksOf({ block: '3-р давхар А2 блокийн план' })).toEqual(['A2']);
  });

  it('returns blocks in BLOCKS order, not text order', () => {
    expect(blocksOf({ block: 'G2, A1' })).toEqual(['A1', 'G2']);
  });

  it('never returns a block outside BLOCKS', () => {
    for (const b of blocksOf({ block: 'A1 A2 A9 G1 G5 C1 C2' })) {
      expect(BLOCKS).toContain(b);
    }
  });
});

describe('computeByMonth', () => {
  const months = ['2026-01', '2026-02', '2026-03'];

  it('buckets paid amounts by month and accumulates cumulative total', () => {
    const rows = computeByMonth(
      months,
      [payment({ date: '2026-01-10', amount: 1000 }), payment({ date: '2026-02-05', amount: 500 })],
      [],
      [],
    );
    expect(rows.map((r) => r.paid)).toEqual([1000, 500, 0]);
    expect(rows.map((r) => r.cumulative)).toEqual([1000, 1500, 1500]);
  });

  it('ignores a payment with no date', () => {
    const rows = computeByMonth(months, [payment({ date: null, amount: 999 })], [], []);
    expect(rows.every((r) => r.paid === 0)).toBe(true);
  });

  it('counts documents by month', () => {
    const rows = computeByMonth(
      months, [], [doc({ date: '2026-02-01' }), doc({ date: '2026-02-15' })], [],
    );
    expect(rows.map((r) => r.docs)).toEqual([0, 2, 0]);
  });

  it('counts signed contracts and sums MNT contract value by month, skipping other currencies', () => {
    const rows = computeByMonth(months, [], [], [
      contract({ signedDate: '2026-03-01', currency: 'MNT', value: 100 }),
      contract({ signedDate: '2026-03-02', currency: 'USD', value: 999 }),
    ]);
    expect(rows[2].contractsSigned).toBe(2);
    expect(rows[2].contractValue).toBe(100);
  });

  it('drops a signed date outside the given month range', () => {
    const rows = computeByMonth(months, [], [], [contract({ signedDate: '2025-12-01' })]);
    expect(rows.every((r) => r.contractsSigned === 0)).toBe(true);
  });
});

describe('computeByParty', () => {
  it('rolls up contract value, paid amount and paid percent per party', () => {
    const rows = computeByParty(
      [doc({ party: 'A ХХК', category: 'Ажил гүйцэтгэгч' })],
      [contract({ party: 'A ХХК', category: 'Ажил гүйцэтгэгч', currency: 'MNT', value: 1000 })],
      [payment({ party: 'A ХХК', category: 'Ажил гүйцэтгэгч', amount: 250 })],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      party: 'A ХХК', contractValue: 1000, paid: 250, paidPercent: 25,
      contractCount: 1, paymentCount: 1, docCount: 1,
    });
  });

  it('excludes documents whose party is "—" but still counts contracts/payments', () => {
    const rows = computeByParty(
      [doc({ party: '—' })],
      [contract({ party: 'B ХХК', value: 500, currency: 'MNT' })],
      [],
    );
    expect(rows.find((r) => r.party === '—')).toBeUndefined();
    expect(rows.find((r) => r.party === 'B ХХК')?.contractValue).toBe(500);
  });

  it('leaves paidPercent null when there is no MNT contract value', () => {
    const rows = computeByParty([], [], [payment({ party: 'C ХХК', amount: 10 })]);
    expect(rows[0].paidPercent).toBeNull();
  });

  it('marks a party rate-based if any of its contracts is rate-based', () => {
    const rows = computeByParty([], [contract({ party: 'D ХХК', rateBased: true })], []);
    expect(rows[0].rateBased).toBe(true);
  });

  it('collects distinct currencies per party', () => {
    const rows = computeByParty([], [
      contract({ party: 'E ХХК', currency: 'MNT' }),
      contract({ party: 'E ХХК', currency: 'USD' }),
      contract({ party: 'E ХХК', currency: 'USD' }),
    ], []);
    expect(rows[0].currencies).toEqual(['MNT', 'USD']);
  });

  it('sorts parties by contract value, descending', () => {
    const rows = computeByParty([], [
      contract({ party: 'Low', currency: 'MNT', value: 10 }),
      contract({ party: 'High', currency: 'MNT', value: 100 }),
    ], []);
    expect(rows.map((r) => r.party)).toEqual(['High', 'Low']);
  });
});

describe('computeRfiThreads', () => {
  it('pairs an outgoing and incoming RFI with the same docNo and computes turnaround in days', () => {
    const threads = computeRfiThreads([
      corr({ docNo: '004', direction: 'out', date: '2026-02-01' }),
      corr({ docNo: '004', direction: 'in', date: '2026-02-06' }),
    ]);
    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({ no: '004', turnaround: 5 });
  });

  it('leaves turnaround null when only one side of the thread exists', () => {
    const threads = computeRfiThreads([corr({ docNo: '007', direction: 'out', date: '2026-02-01' })]);
    expect(threads[0].turnaround).toBeNull();
  });

  it('falls back to filename when docNo is missing', () => {
    const threads = computeRfiThreads([corr({ docNo: null, filename: 'rfi-no-number.pdf', direction: 'out' })]);
    expect(threads[0].no).toBe('rfi-no-number.pdf');
  });

  it('sorts threads by thread number', () => {
    const threads = computeRfiThreads([
      corr({ docNo: '010', direction: 'out' }),
      corr({ docNo: '002', direction: 'out' }),
    ]);
    expect(threads.map((t) => t.no)).toEqual(['002', '010']);
  });
});

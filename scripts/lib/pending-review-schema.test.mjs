import { describe, it, expect } from 'vitest';
import { ExtractionResultSchema, PendingReviewRecordSchema } from './pending-review-schema.mjs';

describe('ExtractionResultSchema', () => {
  it('accepts a valid contract extraction', () => {
    const result = ExtractionResultSchema.safeParse({
      targetCollection: 'contracts', party: 'A ХХК', contractNo: '26/001', signedDate: '2026-01-01',
      start: null, end: null, value: 1000000, currency: 'MNT', vatIncluded: true,
      advancePercent: 10, retentionPercent: null, scope: 'test scope', notes: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid payment extraction', () => {
    const result = ExtractionResultSchema.safeParse({
      targetCollection: 'payments', party: 'A ХХК', contractNo: '26/001', workName: null,
      date: '2026-02-01', workPeriodStart: null, workPeriodEnd: null, amount: 500000, notes: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts an unclassifiable result', () => {
    const result = ExtractionResultSchema.safeParse({
      targetCollection: 'unclassifiable', reason: 'blank scan',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a record missing fields required by its target collection', () => {
    const result = ExtractionResultSchema.safeParse({ targetCollection: 'contracts', party: 'A ХХК' });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown targetCollection', () => {
    const result = ExtractionResultSchema.safeParse({ targetCollection: 'not-a-real-collection' });
    expect(result.success).toBe(false);
  });
});

describe('PendingReviewRecordSchema', () => {
  it('accepts a full pending record wrapping a valid extraction', () => {
    const result = PendingReviewRecordSchema.safeParse({
      id: 'pr-1',
      sourceFile: { name: 'x.pdf', webUrl: 'https://example.com/x.pdf', itemId: 'item-1' },
      extracted: { targetCollection: 'unclassifiable', reason: 'test' },
      status: 'pending',
      extractedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid status value', () => {
    const result = PendingReviewRecordSchema.safeParse({
      id: 'pr-1',
      sourceFile: { name: 'x.pdf', webUrl: 'https://example.com/x.pdf', itemId: 'item-1' },
      extracted: { targetCollection: 'unclassifiable', reason: 'test' },
      status: 'not-a-status',
      extractedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });
});

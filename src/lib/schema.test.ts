import { describe, expect, it } from 'vitest';
import { CorrespondenceSchema, SourceFileSchema } from './schema';

/**
 * sourceFile arrived after the first backfill, so every row written before it
 * has no such key. The schema has to accept both shapes or the dashboard stops
 * loading the moment it meets an older record.
 */
const ROW = {
  id: 'c1', path: 'a/b.pdf', filename: 'b.pdf', party: 'Тал ХХК', category: 'Ажил гүйцэтгэгч',
  docNo: '004', typeCode: 'RFI', typeLabel: 'Мэдээлэл хүсэх', direction: 'out' as const,
  date: '2026-04-13', system: 'BI',
};

describe('sourceFile on a dataset row', () => {
  it('accepts a row that predates the field', () => {
    expect(CorrespondenceSchema.safeParse(ROW).success).toBe(true);
  });

  it('accepts a row carrying one, and keeps it', () => {
    const sourceFile = { name: 'b.pdf', webUrl: 'https://example.sharepoint.com/b.pdf', itemId: '01AB' };
    const parsed = CorrespondenceSchema.safeParse({ ...ROW, sourceFile });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.sourceFile).toEqual(sourceFile);
  });

  it('accepts an explicit null, which is what "looked and found nothing" writes', () => {
    expect(CorrespondenceSchema.safeParse({ ...ROW, sourceFile: null }).success).toBe(true);
  });

  it('rejects a half-filled one rather than letting a dead link through', () => {
    expect(SourceFileSchema.safeParse({ name: 'b.pdf' }).success).toBe(false);
    expect(CorrespondenceSchema.safeParse({ ...ROW, sourceFile: { name: 'b.pdf' } }).success).toBe(false);
  });
});

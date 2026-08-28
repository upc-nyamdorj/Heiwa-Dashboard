import { z } from 'zod';

/**
 * What Claude extracts from one source PDF. Mirrors the shape of the
 * matching collection in src/lib/schema.ts, but only the fields that
 * actually come from reading the document body — everything the filename
 * already encodes reliably (doc number, system, category, type code) is not
 * re-derived here; the sync script fills that in from the Graph listing.
 *
 * This file is plain JS (not a src/lib/schema.ts import) because it runs
 * under plain `node`, which can't load a .ts module without a build step.
 */

const isoDate = z.string().nullable()
  .describe('ISO date YYYY-MM-DD as printed in the document, or null if not present/legible');
const money = z.number().nullable()
  .describe('Plain number, no currency symbol or thousands separator, or null if not printed');

export const ContractExtractionSchema = z.object({
  targetCollection: z.literal('contracts'),
  party: z.string().describe('The counterparty company name as printed'),
  contractNo: z.string().nullable(),
  signedDate: isoDate,
  start: isoDate,
  end: isoDate,
  value: money,
  currency: z.string().describe('e.g. MNT, USD'),
  vatIncluded: z.boolean().nullable(),
  advancePercent: z.number().nullable(),
  retentionPercent: z.number().nullable(),
  scope: z.string().nullable().describe('Brief description of the work/scope covered'),
  notes: z.string().nullable().describe('Anything ambiguous or worth a human double-checking'),
});

export const PaymentExtractionSchema = z.object({
  targetCollection: z.literal('payments'),
  party: z.string(),
  contractNo: z.string().nullable(),
  workName: z.string().nullable(),
  date: isoDate,
  workPeriodStart: isoDate,
  workPeriodEnd: isoDate,
  amount: money,
  notes: z.string().nullable(),
});

export const CorrespondenceExtractionSchema = z.object({
  targetCollection: z.literal('correspondence'),
  party: z.string(),
  direction: z.enum(['in', 'out']).nullable(),
  date: isoDate,
  docNo: z.string().nullable(),
});

export const QualityExtractionSchema = z.object({
  targetCollection: z.literal('quality'),
  party: z.string(),
  date: isoDate,
  block: z.string().nullable().describe('Building block(s) referenced, e.g. "A1" or "A1-A6"'),
  amount: money,
  notes: z.string().nullable(),
});

export const DrawingExtractionSchema = z.object({
  targetCollection: z.literal('drawings'),
  company: z.string(),
  drawing: z.string().nullable().describe('Drawing/discipline name'),
  code: z.string().nullable(),
  pages: z.number().nullable(),
  block: z.string().nullable(),
});

export const UnclassifiableExtractionSchema = z.object({
  targetCollection: z.literal('unclassifiable'),
  reason: z.string().describe('Why this document could not be classified or read'),
});

export const ExtractionResultSchema = z.discriminatedUnion('targetCollection', [
  ContractExtractionSchema,
  PaymentExtractionSchema,
  CorrespondenceExtractionSchema,
  QualityExtractionSchema,
  DrawingExtractionSchema,
  UnclassifiableExtractionSchema,
]);

export const PendingReviewRecordSchema = z.object({
  id: z.string(),
  sourceFile: z.object({ name: z.string(), webUrl: z.string(), itemId: z.string() }),
  extracted: ExtractionResultSchema,
  status: z.enum(['pending', 'approved', 'rejected', 'extraction-error']),
  extractedAt: z.string(),
  error: z.string().nullable().optional(),
});

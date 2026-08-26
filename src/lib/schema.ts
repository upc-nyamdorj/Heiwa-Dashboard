import { z } from 'zod';

/**
 * Runtime mirror of types.ts, validated once against src/data/heiwa.json at
 * build/dev time. Keep this in lockstep with the interfaces there — a field
 * added to one and not the other will surface as either a type error or a
 * silent runtime gap.
 */

const DirectionSchema = z.enum(['in', 'out']).nullable();

export const MetaSchema = z.object({
  project: z.string(),
  client: z.string(),
  manager: z.string(),
  sourceFolder: z.string(),
  fileCount: z.number(),
  totalBytes: z.number(),
  dateMin: z.string(),
  dateMax: z.string(),
  extractedDocs: z.number(),
  extractFailed: z.array(z.string()),
  supersededNote: z.record(z.string(), z.string()),
  orphanContractKeys: z.array(z.string()),
  registryGapsBI: z.array(z.number()),
  iprSequenceGaps: z.array(z.object({
    contractKey: z.string(),
    missing: z.array(z.number()),
    max: z.number(),
  })),
});

export const DocumentRowSchema = z.object({
  id: z.string(),
  path: z.string(),
  filename: z.string(),
  ext: z.string(),
  sizeBytes: z.number(),
  category: z.string(),
  categoryNo: z.string(),
  party: z.string(),
  partyRole: z.string().nullable(),
  folder: z.string().nullable(),
  docNo: z.string().nullable(),
  system: z.string().nullable(),
  typeCode: z.string(),
  typeLabel: z.string(),
  seqNo: z.number().nullable(),
  direction: DirectionSchema,
  date: z.string().nullable(),
  isAmendment: z.boolean(),
  isDuplicateFile: z.boolean(),
  supersededBy: z.string().nullable(),
  contractKey: z.string().nullable(),
});

export const AmendmentSchema = z.object({
  docNo: z.string().nullable(),
  date: z.string().nullable(),
  filename: z.string(),
  path: z.string(),
  value: z.number().nullable(),
  mode: z.enum(['add', 'replace', 'none']),
  scope: z.string().nullable(),
  notes: z.string().nullable(),
});

export const ContractSchema = z.object({
  key: z.string(),
  system: z.string(),
  docNo: z.string().nullable(),
  contractNo: z.string().nullable(),
  party: z.string(),
  partyRole: z.string().nullable(),
  category: z.string(),
  categoryNo: z.string(),
  typeCode: z.string(),
  typeLabel: z.string(),
  filename: z.string(),
  path: z.string(),
  signedDate: z.string().nullable(),
  start: z.string().nullable(),
  end: z.string().nullable(),
  periodSource: z.string(),
  value: z.number().nullable(),
  valueBasis: z.string(),
  valueBasisNote: z.string().nullable(),
  baseValue: z.number().nullable(),
  currency: z.string(),
  vatIncluded: z.boolean().nullable(),
  advancePercent: z.number().nullable(),
  retentionPercent: z.number().nullable(),
  scope: z.string().nullable(),
  notes: z.string().nullable(),
  amendments: z.array(AmendmentSchema),
  paid: z.number(),
  paymentCount: z.number(),
  paidPercent: z.number().nullable(),
  rateBased: z.boolean(),
});

export const PaymentSchema = z.object({
  id: z.string(),
  path: z.string(),
  filename: z.string(),
  party: z.string(),
  category: z.string(),
  typeCode: z.string(),
  typeLabel: z.string(),
  seqNo: z.number().nullable(),
  docNo: z.string().nullable(),
  system: z.string().nullable(),
  contractKey: z.string().nullable(),
  contractNo: z.string().nullable(),
  workName: z.string().nullable(),
  date: z.string().nullable(),
  fileDate: z.string().nullable(),
  workPeriodStart: z.string().nullable(),
  workPeriodEnd: z.string().nullable(),
  amount: z.number().nullable(),
  grossAmount: z.number().nullable(),
  advance: z.number().nullable(),
  warranty: z.number().nullable(),
  netToContractor: z.number().nullable(),
  supersededBy: z.string().nullable(),
  counted: z.boolean(),
  notes: z.string().nullable(),
});

export const CorrespondenceSchema = z.object({
  id: z.string(),
  path: z.string(),
  filename: z.string(),
  party: z.string(),
  category: z.string(),
  typeCode: z.string(),
  typeLabel: z.string(),
  docNo: z.string().nullable(),
  system: z.string().nullable(),
  direction: DirectionSchema,
  date: z.string().nullable(),
});

export const QualityRowSchema = z.object({
  path: z.string(),
  filename: z.string(),
  party: z.string(),
  typeCode: z.string(),
  typeLabel: z.string(),
  date: z.string().nullable(),
  block: z.string().nullable(),
  amount: z.number().nullable(),
  notes: z.string().nullable(),
});

export const DrawingSchema = z.object({
  no: z.number(),
  company: z.string(),
  drawing: z.string().nullable(),
  code: z.string().nullable(),
  pages: z.number().nullable(),
  block: z.string().nullable(),
  hasOriginal: z.boolean(),
  hasCopy: z.boolean(),
  hasDigital: z.boolean(),
  status: z.string(),
  note: z.string().nullable(),
});

export const AuditIssueSchema = z.object({
  sev: z.enum(['ӨНДӨР', 'ДУНД', 'БАГА', 'МЭДЭЭЛЭЛ']),
  check: z.string(),
  subject: z.string(),
  detail: z.string(),
});

export const CoverageSchema = z.object({
  contractsTotal: z.number(),
  contractsWithValue: z.number(),
  contractsRateBased: z.number(),
  contractsWithPeriod: z.number(),
  contractsPeriodBackfilled: z.number(),
  paymentsTotal: z.number(),
  paymentsWithAmount: z.number(),
  paymentsWithPeriod: z.number(),
  paymentsSuperseded: z.number(),
  documentsTotal: z.number(),
  documentsFromFilenameOnly: z.number(),
  verifiedByHand: z.number(),
});

export const SpotCheckRowSchema = z.object({
  kind: z.string(),
  label: z.string(),
  value: z.number().nullable(),
  currency: z.string(),
  path: z.string(),
  look: z.string(),
  confirm: z.string(),
  flagged: z.boolean(),
});

export const DatasetSchema = z.object({
  meta: MetaSchema,
  documents: z.array(DocumentRowSchema),
  contracts: z.array(ContractSchema),
  payments: z.array(PaymentSchema),
  correspondence: z.array(CorrespondenceSchema),
  quality: z.array(QualityRowSchema),
  drawings: z.array(DrawingSchema),
  audit: z.array(AuditIssueSchema),
  coverage: CoverageSchema,
  spotCheck: z.array(SpotCheckRowSchema),
});

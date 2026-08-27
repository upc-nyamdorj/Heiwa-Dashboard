/**
 * Blank record shapes for the Review tab's editor, one per collection —
 * mirrors the field lists in schema.ts exactly. Claude's extraction only
 * fills a subset of these (see scripts/lib/pending-review-schema.mjs); the
 * admin fills in the rest (id/key, category, system codes, ...) before
 * approving, since that structural metadata used to come from filename
 * parsing in build_dataset.py, which isn't in this repo (task 1).
 */
export const RECORD_TEMPLATES: Record<string, Record<string, unknown>> = {
  contracts: {
    key: '', system: '', docNo: null, contractNo: null, party: '', partyRole: null,
    category: '', categoryNo: '', typeCode: '', typeLabel: '', filename: '', path: '',
    signedDate: null, start: null, end: null, periodSource: 'гэрээ', value: null,
    valueBasis: 'нийт', valueBasisNote: null, baseValue: null, currency: 'MNT',
    vatIncluded: null, advancePercent: null, retentionPercent: null, scope: null,
    notes: null, amendments: [], paid: 0, paymentCount: 0, paidPercent: null, rateBased: false,
  },
  payments: {
    id: '', path: '', filename: '', party: '', category: '', typeCode: '', typeLabel: '',
    seqNo: null, docNo: null, system: null, contractKey: null, contractNo: null,
    workName: null, date: null, fileDate: null, workPeriodStart: null, workPeriodEnd: null,
    amount: null, grossAmount: null, advance: null, warranty: null, netToContractor: null,
    supersededBy: null, counted: true, notes: null,
  },
  correspondence: {
    id: '', path: '', filename: '', party: '', category: '', typeCode: '', typeLabel: '',
    docNo: null, system: null, direction: null, date: null,
  },
  quality: {
    path: '', filename: '', party: '', typeCode: '', typeLabel: '', date: null,
    block: null, amount: null, notes: null,
  },
  drawings: {
    no: 0, company: '', drawing: null, code: null, pages: null, block: null,
    hasOriginal: false, hasCopy: false, hasDigital: false, status: 'Дуусаагүй', note: null,
  },
};

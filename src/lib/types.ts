export type Direction = 'in' | 'out' | null;

export interface Meta {
  project: string;
  client: string;
  manager: string;
  sourceFolder: string;
  fileCount: number;
  totalBytes: number;
  dateMin: string;
  dateMax: string;
  extractedDocs: number;
  extractFailed: string[];
  supersededNote: Record<string, string>;
  orphanContractKeys: string[];
  registryGapsBI: number[];
  iprSequenceGaps: { contractKey: string; missing: number[]; max: number }[];
}

export interface DocumentRow {
  id: string;
  path: string;
  filename: string;
  ext: string;
  sizeBytes: number;
  category: string;
  categoryNo: string;
  party: string;
  partyRole: string | null;
  folder: string | null;
  docNo: string | null;
  system: string | null;
  typeCode: string;
  typeLabel: string;
  seqNo: number | null;
  direction: Direction;
  date: string | null;
  isAmendment: boolean;
  isDuplicateFile: boolean;
  supersededBy: string | null;
  contractKey: string | null;
}

export interface Amendment {
  docNo: string | null;
  date: string | null;
  filename: string;
  path: string;
  value: number | null;
  mode: 'add' | 'replace' | 'none';
  scope: string | null;
  notes: string | null;
}

export interface Contract {
  key: string;
  system: string;
  docNo: string | null;
  contractNo: string | null;
  party: string;
  partyRole: string | null;
  category: string;
  categoryNo: string;
  typeCode: string;
  typeLabel: string;
  filename: string;
  path: string;
  signedDate: string | null;
  start: string | null;
  end: string | null;
  /** Where the period came from — the contract itself, or its payment reports. */
  periodSource: string;
  value: number | null;
  /** What the printed price measures: нийт | сарын | нэгж | тооцоолсон. */
  valueBasis: string;
  valueBasisNote: string | null;
  baseValue: number | null;
  currency: string;
  vatIncluded: boolean | null;
  advancePercent: number | null;
  retentionPercent: number | null;
  scope: string | null;
  notes: string | null;
  amendments: Amendment[];
  paid: number;
  paymentCount: number;
  paidPercent: number | null;
  rateBased: boolean;
}

export interface Payment {
  id: string;
  path: string;
  filename: string;
  party: string;
  category: string;
  typeCode: string;
  typeLabel: string;
  seqNo: number | null;
  docNo: string | null;
  system: string | null;
  contractKey: string | null;
  contractNo: string | null;
  workName: string | null;
  date: string | null;
  fileDate: string | null;
  workPeriodStart: string | null;
  workPeriodEnd: string | null;
  amount: number | null;
  grossAmount: number | null;
  advance: number | null;
  warranty: number | null;
  netToContractor: number | null;
  supersededBy: string | null;
  counted: boolean;
  notes: string | null;
}

export interface Correspondence {
  id: string;
  path: string;
  filename: string;
  party: string;
  category: string;
  typeCode: string;
  typeLabel: string;
  docNo: string | null;
  system: string | null;
  direction: Direction;
  date: string | null;
}

export interface QualityRow {
  path: string;
  filename: string;
  party: string;
  typeCode: string;
  typeLabel: string;
  date: string | null;
  block: string | null;
  amount: number | null;
  notes: string | null;
}

export interface Drawing {
  no: number;
  company: string;
  drawing: string | null;
  code: string | null;
  pages: number | null;
  block: string | null;
  hasOriginal: boolean;
  hasCopy: boolean;
  hasDigital: boolean;
  status: string;
  note: string | null;
}

export interface AuditIssue {
  sev: 'ӨНДӨР' | 'ДУНД' | 'БАГА' | 'МЭДЭЭЛЭЛ';
  check: string;
  subject: string;
  detail: string;
}

export interface Coverage {
  contractsTotal: number;
  contractsWithValue: number;
  contractsRateBased: number;
  contractsWithPeriod: number;
  contractsPeriodBackfilled: number;
  paymentsTotal: number;
  paymentsWithAmount: number;
  paymentsWithPeriod: number;
  paymentsSuperseded: number;
  documentsTotal: number;
  documentsFromFilenameOnly: number;
  verifiedByHand: number;
}

export interface SpotCheckRow {
  kind: string;
  label: string;
  value: number | null;
  currency: string;
  path: string;
  look: string;
  confirm: string;
  flagged: boolean;
}

export interface Dataset {
  meta: Meta;
  documents: DocumentRow[];
  contracts: Contract[];
  payments: Payment[];
  correspondence: Correspondence[];
  quality: QualityRow[];
  drawings: Drawing[];
  audit: AuditIssue[];
  coverage: Coverage;
  spotCheck: SpotCheckRow[];
}

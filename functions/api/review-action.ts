import { z } from 'zod';
import { getFile, putFile, decodeBase64Json, encodeJsonBase64, GithubConflictError } from '../../cf/lib/github';
import { verifySessionToken, parseCookie, COOKIE_NAME } from '../../cf/lib/session';
import { jsonResponse } from '../../cf/lib/response';
import {
  ContractSchema, PaymentSchema, CorrespondenceSchema, QualityRowSchema, DrawingSchema,
} from '../../src/lib/schema';

interface Env {
  ADMIN_SESSION_SECRET: string;
  GITHUB_PAT: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
}

const PENDING_PATH = 'data-private/pending-review.json';
const DATASET_PATH = 'src/data/heiwa.json';

/**
 * Claude's extraction (scripts/lib/claude-extract.mjs) only produces the
 * fields that come from the document body — it can't reliably reconstruct
 * the rest of a full Contract/Payment/etc. record (id, category, system
 * codes, ...) from a flat sync-folder filename; the original build_dataset.py
 * that used to do that isn't in this repo (see task 1). So "approve" doesn't
 * auto-merge the raw extraction: the admin completes/corrects the full
 * record in the Review UI first, and this endpoint validates THAT against
 * the same zod schema the dashboard itself uses before ever committing it.
 */
const COLLECTION_SCHEMAS: Record<string, z.ZodTypeAny> = {
  contracts: ContractSchema,
  payments: PaymentSchema,
  correspondence: CorrespondenceSchema,
  quality: QualityRowSchema,
  drawings: DrawingSchema,
};

interface PendingRecord {
  id: string;
  extracted: { targetCollection: string };
  status: 'pending' | 'approved' | 'rejected' | 'extraction-error';
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const token = parseCookie(request.headers.get('Cookie'), COOKIE_NAME);
  const session = await verifySessionToken(token, env.ADMIN_SESSION_SECRET);
  if (!session) return jsonResponse({ error: 'unauthorized' }, 401);

  let body: { recordId?: string; decision?: 'approve' | 'reject'; finalRecord?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }
  if (!body.recordId || (body.decision !== 'approve' && body.decision !== 'reject')) {
    return jsonResponse({ error: 'invalid_body' }, 400);
  }

  const gh = { owner: env.GITHUB_OWNER, repo: env.GITHUB_REPO, token: env.GITHUB_PAT };

  const pendingFile = await getFile({ ...gh, path: PENDING_PATH });
  const pending = decodeBase64Json<PendingRecord[]>(pendingFile.contentBase64);
  const idx = pending.findIndex((r) => r.id === body.recordId);
  if (idx === -1) return jsonResponse({ error: 'record_not_found' }, 404);

  const record = pending[idx];
  if (record.status !== 'pending') {
    return jsonResponse({ error: 'already_actioned', status: record.status }, 409);
  }

  if (body.decision === 'reject') {
    pending[idx] = { ...record, status: 'rejected' };
    try {
      await putFile({
        ...gh, path: PENDING_PATH, sha: pendingFile.sha,
        contentBase64: encodeJsonBase64(pending),
        message: `Reject pending review record ${record.id}`,
      });
    } catch (err) {
      if (err instanceof GithubConflictError) return jsonResponse({ error: 'conflict' }, 409);
      throw err;
    }
    return jsonResponse({ ok: true });
  }

  // approve — the admin's completed/corrected record, not the raw extraction
  const schema = COLLECTION_SCHEMAS[record.extracted.targetCollection];
  if (!schema) {
    return jsonResponse({ error: 'unknown_collection', collection: record.extracted.targetCollection }, 500);
  }
  const validation = schema.safeParse(body.finalRecord);
  if (!validation.success) {
    return jsonResponse({ error: 'invalid_record', issues: z.treeifyError(validation.error) }, 400);
  }

  const datasetFile = await getFile({ ...gh, path: DATASET_PATH });
  const dataset = decodeBase64Json<Record<string, unknown[]>>(datasetFile.contentBase64);
  const collection = record.extracted.targetCollection;
  if (!Array.isArray(dataset[collection])) {
    return jsonResponse({ error: 'unknown_collection', collection }, 500);
  }
  dataset[collection].push(validation.data);

  try {
    await putFile({
      ...gh, path: DATASET_PATH, sha: datasetFile.sha,
      contentBase64: encodeJsonBase64(dataset),
      message: `Approve pending review record ${record.id} into ${collection}`,
    });
  } catch (err) {
    if (err instanceof GithubConflictError) return jsonResponse({ error: 'conflict' }, 409);
    throw err;
  }

  // Re-fetch: the dataset write above may have taken a moment, and this is a
  // second, independent file — re-read its sha right before writing it too.
  const freshPending = await getFile({ ...gh, path: PENDING_PATH });
  const freshRecords = decodeBase64Json<PendingRecord[]>(freshPending.contentBase64);
  const freshIdx = freshRecords.findIndex((r) => r.id === body.recordId);
  if (freshIdx !== -1) freshRecords[freshIdx] = { ...freshRecords[freshIdx], status: 'approved' };

  try {
    await putFile({
      ...gh, path: PENDING_PATH, sha: freshPending.sha,
      contentBase64: encodeJsonBase64(freshRecords),
      message: `Mark ${record.id} approved in pending-review.json`,
    });
  } catch (err) {
    if (err instanceof GithubConflictError) {
      // The dataset write already landed — surface this distinctly so the
      // client knows the approval took effect even though the pending-list
      // bookkeeping needs a retry, rather than looking like a full failure.
      return jsonResponse({ ok: true, warning: 'pending_list_update_conflict' });
    }
    throw err;
  }

  return jsonResponse({ ok: true });
};

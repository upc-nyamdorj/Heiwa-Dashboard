#!/usr/bin/env node
/**
 * List the SharePoint "Heiwa Dashboard Sync" folder via app-only Graph auth,
 * diff against the last recorded sync state, and for each new/changed PDF:
 * download it, extract structured data with Claude (native PDF input, no
 * separate OCR step), zod-validate the result, and append it to
 * data-private/pending-review.json for human sign-off (Phase 3/4 add the
 * Cloudflare Functions + UI that read and act on that file).
 *
 * Any single extraction/validation failure aborts the WHOLE run with no
 * partial writes — sync-state.json and pending-review.json are only saved
 * once every changed file in this run succeeded, so a failure just means
 * "try again later," not "some silently-bad data got in."
 *
 * Required env: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET,
 * ONEDRIVE_DRIVE_ID, ONEDRIVE_FOLDER_ID, and (unless --dry-run) ANTHROPIC_API_KEY.
 *
 * Flags: --dry-run (list + diff only, no download/extraction/writes) ·
 * --limit=N (cap how many changed files this run processes — the lever for
 * calibrating real extraction cost on a small batch before an unlimited run).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAppOnlyToken, listFolderChildren, downloadFileContent } from './lib/graph-client.mjs';
import { loadSyncState, saveSyncState, diffAgainstState } from './lib/sync-state.mjs';
import { loadPendingReview, savePendingReview } from './lib/pending-review-store.mjs';
import { extractFromPdf, estimateCostUsd } from './lib/claude-extract.mjs';
import { ExtractionResultSchema } from './lib/pending-review-schema.mjs';
import { writeSyncStatus } from './lib/sync-status.mjs';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
const STATE_PATH = path.join(here, '.sync-state.json');
const PENDING_REVIEW_PATH = path.join(here, '..', 'data-private', 'pending-review.json');
const SYNC_STATUS_PATH = path.join(here, '..', 'src', 'data', 'sync-status.json');

function parseArgs(argv) {
  const args = { dryRun: false, limit: null };
  for (const a of argv) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a.startsWith('--limit=')) args.limit = Number(a.slice('--limit='.length));
  }
  return args;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const tenantId = requireEnv('AZURE_TENANT_ID');
  const clientId = requireEnv('AZURE_CLIENT_ID');
  const clientSecret = requireEnv('AZURE_CLIENT_SECRET');
  const driveId = requireEnv('ONEDRIVE_DRIVE_ID');
  const folderId = requireEnv('ONEDRIVE_FOLDER_ID');

  console.log('Authenticating with Azure AD (app-only)...');
  const accessToken = await getAppOnlyToken({ tenantId, clientId, clientSecret });

  console.log('Listing files in the OneDrive/SharePoint sync folder...');
  const files = await listFolderChildren({ accessToken, driveId, folderId });
  console.log(`Found ${files.length} file(s) in the folder.`);

  const state = loadSyncState(STATE_PATH);
  let changed = diffAgainstState(files, state);
  console.log(`${changed.length} file(s) are new or changed since the last recorded sync.`);

  if (args.limit != null) {
    changed = changed.slice(0, args.limit);
    console.log(`--limit=${args.limit}: processing ${changed.length} file(s) this run.`);
  }

  if (args.dryRun) {
    console.log('--dry-run: listing only, no download/extraction/writes.');
    for (const f of changed) console.log(`  would process: ${f.name} (${f.id})`);
    return;
  }

  if (changed.length === 0) {
    console.log('Nothing to do.');
    writeSyncStatus(SYNC_STATUS_PATH, { status: 'success', message: 'Шинэ файл алга.', newFilesFound: 0 });
    return;
  }

  const apiKey = requireEnv('ANTHROPIC_API_KEY');
  const pending = loadPendingReview(PENDING_REVIEW_PATH);

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const newRecords = [];

  for (const f of changed) {
    console.log(`Downloading ${f.name}...`);
    const buffer = await downloadFileContent({ accessToken, driveId, itemId: f.id });
    const pdfBase64 = buffer.toString('base64');

    console.log(`Extracting ${f.name} via Claude (claude-opus-5)...`);
    const result = await extractFromPdf({ apiKey, filename: f.name, pdfBase64 });
    totalInputTokens += result.usage.input_tokens ?? 0;
    totalOutputTokens += result.usage.output_tokens ?? 0;

    const validation = ExtractionResultSchema.safeParse(result.parsed);
    if (!validation.success) {
      // Abort the whole run — nothing gets written this time, per spec.
      throw new Error(
        `Extraction for "${f.name}" failed schema validation:\n${z.prettifyError(validation.error)}`,
      );
    }

    newRecords.push({
      id: `pr-${f.id}`,
      sourceFile: { name: f.name, webUrl: f.webUrl, itemId: f.id },
      extracted: validation.data,
      status: 'pending',
      extractedAt: new Date().toISOString(),
    });
  }

  for (const f of changed) {
    state[f.id] = { eTag: f.eTag, lastModifiedDateTime: f.lastModifiedDateTime, name: f.name };
  }
  savePendingReview(PENDING_REVIEW_PATH, [...pending, ...newRecords]);
  saveSyncState(STATE_PATH, state);

  const cost = estimateCostUsd({ inputTokens: totalInputTokens, outputTokens: totalOutputTokens });
  console.log(`Token usage: ${totalInputTokens} input, ${totalOutputTokens} output.`);
  console.log(`Estimated cost this run: $${cost.toFixed(4)} (Claude Opus 5 pricing).`);

  writeSyncStatus(SYNC_STATUS_PATH, {
    status: 'success',
    message: `${newRecords.length} шинэ баримт задарч, баталгаажуулах жагсаалтад орлоо.`,
    newFilesFound: newRecords.length,
    pendingReviewCount: pending.length + newRecords.length,
  });
}

main().catch((err) => {
  console.error('Sync failed:', err.message);
  try {
    writeSyncStatus(SYNC_STATUS_PATH, { status: 'error', message: err.message });
  } catch {
    // best-effort — don't mask the original failure with a status-write error
  }
  process.exitCode = 1;
});

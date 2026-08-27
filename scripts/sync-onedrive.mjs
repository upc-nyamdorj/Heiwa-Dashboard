#!/usr/bin/env node
/**
 * Phase 1: list the SharePoint "Heiwa Dashboard Sync" folder via app-only
 * Graph auth, diff against the last recorded sync state, and report what's
 * new/changed. PDF download + Claude extraction (Phase 2) lands in the
 * "Phase 2 will add..." block below — see the project plan.
 *
 * Required env: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET,
 * ONEDRIVE_DRIVE_ID, ONEDRIVE_FOLDER_ID.
 *
 * Flags: --dry-run (list + diff only, no state write) · --limit=N (cap how
 * many changed files this run processes — used to calibrate extraction cost
 * on a small real batch before an unlimited run).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAppOnlyToken, listFolderChildren } from './lib/graph-client.mjs';
import { loadSyncState, saveSyncState, diffAgainstState } from './lib/sync-state.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const STATE_PATH = path.join(here, '.sync-state.json');

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
    console.log('--dry-run: listing only, no download/extraction/state write.');
    for (const f of changed) console.log(`  would process: ${f.name} (${f.id})`);
    return;
  }

  if (changed.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  // Phase 2 will add PDF download + Claude extraction + pending-review.json
  // writes here, and move this state write to run only after each file's
  // extraction is validated (so a failed run retries that file next time).
  console.log('Extraction pipeline not implemented yet (Phase 2).');
  for (const f of changed) console.log(`  pending extraction: ${f.name} (${f.id})`);

  for (const f of changed) {
    state[f.id] = { eTag: f.eTag, lastModifiedDateTime: f.lastModifiedDateTime, name: f.name };
  }
  saveSyncState(STATE_PATH, state);
}

main().catch((err) => {
  console.error('Sync failed:', err.message);
  process.exitCode = 1;
});

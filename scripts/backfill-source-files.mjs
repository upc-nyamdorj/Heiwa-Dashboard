/**
 * One-off backfill: give every dataset row written before `sourceFile` existed
 * a link back to its own PDF in SharePoint.
 *
 * The daily sync records the link for anything it processes from now on
 * (sync-onedrive.mjs → pending-review.json → worker/review-action.ts). This
 * script is for the rows that were already in the dataset by then, which have
 * only a filename and a path to go on.
 *
 * Dry by default. Nothing is written without --write, because a wrong link is
 * worse than a missing one and the matching is heuristic.
 *
 *   node scripts/backfill-source-files.mjs            # report only
 *   node scripts/backfill-source-files.mjs --write    # apply
 *
 * --relink also re-matches rows whose stored link names an item that is no
 * longer in the folder (e.g. the copy it pointed at was deleted as a duplicate).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAppOnlyToken, listFolderTree } from './lib/graph-client.mjs';
import { planBackfill, applyPlan } from './lib/source-file-match.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATASET_PATH = path.join(here, '..', 'worker', 'data', 'heiwa.json');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function report(plan, totalRows) {
  const linked = plan.updates.length;
  console.log('');
  console.log(`  rows linked         ${linked}`);
  console.log(`  of which relinked   ${plan.relinked}  (old link pointed at a missing item)`);
  console.log(`  already linked      ${plan.skipped.alreadyLinked}`);
  console.log(`  no filename to use  ${plan.skipped.noFilename}`);
  console.log(`  not backfillable    ${plan.skipped.notBackfillable}  [${plan.skippedCollections.join(', ')}]`);
  console.log(`  no file found       ${plan.unmatched.length}`);
  console.log(`  too ambiguous       ${plan.ambiguous.length}`);
  console.log(`  ---`);
  console.log(`  rows in dataset     ${totalRows}`);
  console.log(`  distinct files used ${plan.filesUsed.size}`);

  if (plan.unmatched.length) {
    console.log('\n  No file in the folder matched these — check whether they were renamed or removed:');
    for (const u of plan.unmatched.slice(0, 20)) console.log(`    ${u.collection}[${u.index}]  ${u.filename}${u.stale ? '  (keeps its dead link)' : ''}`);
    if (plan.unmatched.length > 20) console.log(`    … and ${plan.unmatched.length - 20} more`);
  }
  if (plan.ambiguous.length) {
    console.log('\n  Several files share these names and the stored path did not separate them:');
    for (const a of plan.ambiguous.slice(0, 20)) {
      console.log(`    ${a.collection}[${a.index}]  ${a.filename}  ->  ${a.candidates.join(' | ')}`);
    }
    if (plan.ambiguous.length > 20) console.log(`    … and ${plan.ambiguous.length - 20} more`);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const write = argv.includes('--write');
  const relink = argv.includes('--relink');

  const accessToken = await getAppOnlyToken({
    tenantId: requireEnv('AZURE_TENANT_ID'),
    clientId: requireEnv('AZURE_CLIENT_ID'),
    clientSecret: requireEnv('AZURE_CLIENT_SECRET'),
  });

  console.log('Walking the SharePoint folder tree…');
  const files = await listFolderTree({
    accessToken,
    driveId: requireEnv('ONEDRIVE_DRIVE_ID'),
    folderId: requireEnv('ONEDRIVE_FOLDER_ID'),
  });
  console.log(`Found ${files.length} file(s).`);

  const dataset = JSON.parse(readFileSync(DATASET_PATH, 'utf8'));
  const totalRows = Object.values(dataset)
    .filter(Array.isArray)
    .reduce((n, rows) => n + rows.length, 0);

  const plan = planBackfill(dataset, files, { relink });
  report(plan, totalRows);

  if (!write) {
    console.log('\nDry run — nothing written. Re-run with --write to apply.');
    return;
  }
  if (plan.updates.length === 0) {
    console.log('\nNothing to write.');
    return;
  }

  writeFileSync(DATASET_PATH, `${JSON.stringify(applyPlan(dataset, plan), null, 2)}\n`);
  console.log(`\nWrote ${plan.updates.length} link(s) into worker/data/heiwa.json.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

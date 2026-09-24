/**
 * Matches dataset rows written before `sourceFile` existed to the files that
 * are actually sitting in SharePoint, so each row can link back to its own PDF.
 *
 * Pure on purpose — it takes the dataset and a plain list of files and returns
 * a plan. Nothing here talks to Graph or touches disk, so the matching rules
 * are unit-testable without credentials (source-file-match.test.mjs).
 */

/**
 * The collections whose rows stand for a document on disk. Everything else in
 * the dataset — drawings (a register of paper packages), audit, spotCheck —
 * describes the archive rather than a file in it, and has no filename to match.
 */
export const BACKFILLABLE = ['documents', 'contracts', 'payments', 'correspondence', 'quality'];

/**
 * NFC, because a name typed on a Mac and a name returned by Graph can differ
 * byte-for-byte while looking identical — Cyrillic composes both ways.
 * Case-folded too: SharePoint treats names case-insensitively.
 */
export function normaliseName(name) {
  return String(name).normalize('NFC').trim().toLowerCase();
}

/** Directory portion of a dataset row's stored path, normalised for comparison. */
export function rowFolder(path) {
  const parts = String(path ?? '').split('/');
  parts.pop();
  return normaliseName(parts.join('/'));
}

function indexByName(files) {
  const byName = new Map();
  for (const f of files) {
    const k = normaliseName(f.name);
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(f);
  }
  return byName;
}

/**
 * Picks the one file a row means, or null when that cannot be decided.
 *
 * Several rows legitimately point at one file — `documents` is the master
 * register and contracts/payments/correspondence are views over the same PDFs —
 * so a name matching many ROWS is normal. A name matching many FILES is not,
 * and is resolved by folder: exact folder first, then a unique folder that ends
 * with the row's. Anything still undecided is reported, never guessed, because
 * a wrong link is worse than a missing one.
 */
export function resolveCandidate(row, candidates) {
  if (candidates.length === 1) return candidates[0];

  const wanted = rowFolder(row.path);
  if (!wanted) return null;

  const exact = candidates.filter((c) => normaliseName(c.folderPath) === wanted);
  if (exact.length === 1) return exact[0];

  const tail = candidates.filter((c) => {
    const f = normaliseName(c.folderPath);
    return f.endsWith(wanted) || wanted.endsWith(f);
  });
  return tail.length === 1 ? tail[0] : null;
}

export function toSourceFile(file) {
  return { name: file.name, webUrl: file.webUrl, itemId: file.id };
}

/**
 * Works out what the backfill would change. Never mutates the dataset — the
 * caller applies `updates`, so a dry run is the same code path as a real one.
 *
 * With `relink`, a row whose link names an item that is no longer in the
 * folder (deleted, or replaced by another copy) is matched again like an
 * unlinked row; links to items still present are left alone.
 */
export function planBackfill(dataset, files, { collections = BACKFILLABLE, relink = false } = {}) {
  const byName = indexByName(files);
  const liveIds = new Set(files.map((f) => f.id));
  const plan = {
    updates: [],
    unmatched: [],
    ambiguous: [],
    skipped: { alreadyLinked: 0, noFilename: 0, notBackfillable: 0 },
    relinked: 0,
    skippedCollections: [],
    filesUsed: new Set(),
  };

  for (const [collection, rows] of Object.entries(dataset)) {
    if (!Array.isArray(rows)) continue;
    if (!collections.includes(collection)) {
      plan.skipped.notBackfillable += rows.length;
      plan.skippedCollections.push(`${collection} (${rows.length})`);
      continue;
    }
    rows.forEach((row, index) => {
      const stale = relink && row?.sourceFile && !liveIds.has(row.sourceFile.itemId);
      if (row?.sourceFile && !stale) { plan.skipped.alreadyLinked += 1; return; }
      if (!row?.filename) { plan.skipped.noFilename += 1; return; }

      const candidates = byName.get(normaliseName(row.filename)) ?? [];
      if (candidates.length === 0) {
        plan.unmatched.push({ collection, index, filename: row.filename, ...(stale && { stale }) });
        return;
      }
      const file = resolveCandidate(row, candidates);
      if (!file) {
        plan.ambiguous.push({
          collection, index, filename: row.filename,
          candidates: candidates.map((c) => c.folderPath), ...(stale && { stale }),
        });
        return;
      }
      plan.filesUsed.add(file.id);
      if (stale) plan.relinked += 1;
      plan.updates.push({ collection, index, sourceFile: toSourceFile(file) });
    });
  }
  return plan;
}

/** Applies a plan to a copy; the original is left alone. */
export function applyPlan(dataset, plan) {
  const next = structuredClone(dataset);
  for (const { collection, index, sourceFile } of plan.updates) {
    next[collection][index] = { ...next[collection][index], sourceFile };
  }
  return next;
}

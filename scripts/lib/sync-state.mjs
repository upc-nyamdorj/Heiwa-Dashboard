import { readFileSync, writeFileSync, existsSync } from 'node:fs';

export function loadSyncState(path) {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function saveSyncState(path, state) {
  writeFileSync(path, JSON.stringify(state, null, 2) + '\n');
}

/** Files that are new or whose eTag differs from the last recorded sync. */
export function diffAgainstState(files, state) {
  return files.filter((f) => state[f.id]?.eTag !== f.eTag);
}

/** The state entry recorded for a file once it counts as synced. */
export function stateEntry(f) {
  return { eTag: f.eTag, lastModifiedDateTime: f.lastModifiedDateTime, name: f.name, path: f.path };
}

/** Every Graph item ID the dataset already links to via sourceFile.itemId. */
export function linkedItemIds(dataset) {
  const ids = new Set();
  for (const rows of Object.values(dataset)) {
    if (!Array.isArray(rows)) continue;
    for (const r of rows) if (r?.sourceFile?.itemId) ids.add(r.sourceFile.itemId);
  }
  return ids;
}

/**
 * Mark files as already synced without extracting them — for adopting a
 * folder whose contents are already in the dataset. mode "all" marks every
 * file; "linked" marks only those the dataset links to by item ID, so
 * anything else still goes through extraction. Existing entries are kept.
 */
export function seedState(state, files, { mode, linkedIds = new Set() }) {
  const next = { ...state };
  const seeded = [];
  for (const f of files) {
    if (next[f.id]) continue;
    if (mode === 'linked' && !linkedIds.has(f.id)) continue;
    next[f.id] = stateEntry(f);
    seeded.push(f);
  }
  return { state: next, seeded };
}

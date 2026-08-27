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

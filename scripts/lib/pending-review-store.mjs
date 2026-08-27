import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * data-private/ is deliberately outside the Next.js static export (src/,
 * out/) — it must never be imported by app code or shipped in the bundle.
 * The Review tab reads it only through an authenticated Cloudflare Function
 * that fetches it from GitHub server-side (Phase 3).
 */
export function loadPendingReview(filePath) {
  if (!existsSync(filePath)) return [];
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

export function savePendingReview(filePath, records) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(records, null, 2) + '\n');
}

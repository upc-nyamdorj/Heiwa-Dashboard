import { writeFileSync } from 'node:fs';

/**
 * src/data/sync-status.json is a normal bundled file, unlike
 * data-private/pending-review.json — it carries no sensitive content, just
 * enough for the dashboard header's "last synced" indicator.
 */
export function writeSyncStatus(filePath, { status, message, newFilesFound = 0, pendingReviewCount = 0 }) {
  const payload = {
    lastRun: new Date().toISOString(),
    status,
    message,
    newFilesFound,
    pendingReviewCount,
  };
  writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n');
}

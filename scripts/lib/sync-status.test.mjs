import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeSyncStatus } from './sync-status.mjs';

describe('writeSyncStatus', () => {
  it('writes status, message, counts, and a fresh timestamp', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'heiwa-test-'));
    try {
      const filePath = path.join(dir, 'sync-status.json');
      writeSyncStatus(filePath, {
        status: 'success', message: 'ok', newFilesFound: 2, pendingReviewCount: 5,
      });
      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      expect(data).toMatchObject({ status: 'success', message: 'ok', newFilesFound: 2, pendingReviewCount: 5 });
      expect(Number.isNaN(new Date(data.lastRun).getTime())).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('defaults newFilesFound/pendingReviewCount to 0 when omitted', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'heiwa-test-'));
    try {
      const filePath = path.join(dir, 'sync-status.json');
      writeSyncStatus(filePath, { status: 'error', message: 'boom' });
      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      expect(data.newFilesFound).toBe(0);
      expect(data.pendingReviewCount).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

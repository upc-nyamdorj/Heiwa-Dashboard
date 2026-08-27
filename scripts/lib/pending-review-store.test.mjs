import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadPendingReview, savePendingReview } from './pending-review-store.mjs';

describe('pending-review-store', () => {
  it('returns an empty array when the file does not exist yet', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'heiwa-test-'));
    try {
      expect(loadPendingReview(path.join(dir, 'nope.json'))).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('round-trips records through save and load, creating missing directories', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'heiwa-test-'));
    try {
      const filePath = path.join(dir, 'nested', 'pending-review.json');
      const records = [{ id: 'pr-1', status: 'pending' }];
      savePendingReview(filePath, records);
      expect(loadPendingReview(filePath)).toEqual(records);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

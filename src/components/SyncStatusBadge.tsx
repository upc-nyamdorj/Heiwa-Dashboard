'use client';

import React from 'react';
import syncStatus from '@/data/sync-status.json';

export function SyncStatusBadge() {
  const never = syncStatus.status === 'never-run';
  const ok = syncStatus.status === 'success';
  const color = never ? 'var(--text-muted)' : ok ? 'var(--status-good)' : 'var(--status-critical)';
  const label = syncStatus.lastRun
    ? new Date(syncStatus.lastRun).toLocaleString('mn-MN')
    : 'Хараахан ажиллаагүй';

  return (
    <span
      className="hidden items-center gap-1.5 text-xs sm:inline-flex"
      style={{ color: 'var(--text-muted)' }}
      title={syncStatus.message}
    >
      <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Status = 'idle' | 'loading' | 'success' | 'error';

/**
 * Only rendered for an editor or admin — the role on the session is the
 * authorisation, so there is no password to type any more.
 *
 * The confirmation step stays. It used to be the password prompt doing double
 * duty; a sync downloads documents and runs a paid extraction over them, which
 * is not something to fire off a stray click.
 */
export function SyncButton() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  async function submit() {
    setStatus('loading');
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({}),
      });
      setStatus(res.ok ? 'success' : 'error');
    } catch {
      setStatus('error');
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => { setOpen(true); setStatus('idle'); }}
        title="Гараар синхрончлол эхлүүлэх"
        aria-label="Синхрончлол эхлүүлэх"
      >
        <RefreshCw className="size-4" />
      </Button>

      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sync-modal-title"
            className="w-full max-w-xs rounded-lg border p-4 shadow-lg"
            style={{ background: 'var(--surface-1)', borderColor: 'var(--border-strong)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="sync-modal-title" className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Гараар синхрончлол эхлүүлэх
            </h3>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              OneDrive-аас шинэ баримт шалгаж, задлах ажлыг эхлүүлнэ. Задлалт
              төлбөртэй тул шаардлагатай үедээ л ажиллуулна уу.
            </p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-xs">
                {status === 'success' && (
                  <span style={{ color: 'var(--status-good)' }}>Sync эхэллээ</span>
                )}
                {status === 'error' && (
                  <span style={{ color: 'var(--status-critical)' }}>Эхлүүлж чадсангүй</span>
                )}
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Хаах</Button>
                <Button size="sm" onClick={submit} disabled={status === 'loading'}>
                  {status === 'loading' ? 'Илгээж байна…' : 'Эхлүүлэх'}
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Status = 'idle' | 'loading' | 'success' | 'error';

export function SyncButton() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const openModal = () => {
    setOpen(true);
    setStatus('idle');
    setPassword('');
  };

  async function submit() {
    if (!password) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
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
        onClick={openModal}
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
              OneDrive-аас шинэ баримт шалгаж, задлах ажлыг эхлүүлнэ.
            </p>
            <Input
              type="password"
              className="mt-3"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder="Нууц үг"
              autoFocus
            />
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-xs">
                {status === 'success' && (
                  <span style={{ color: 'var(--status-good)' }}>Sync эхэллээ</span>
                )}
                {status === 'error' && (
                  <span style={{ color: 'var(--status-critical)' }}>Буруу байна</span>
                )}
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  Хаах
                </Button>
                <Button size="sm" onClick={submit} disabled={status === 'loading' || !password}>
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

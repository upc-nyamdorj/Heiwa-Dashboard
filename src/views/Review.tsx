'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, StatTile } from '@/components/chart-kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RECORD_TEMPLATES } from '@/lib/review-templates';

interface PendingRecord {
  id: string;
  sourceFile: { name: string; webUrl: string; itemId: string };
  extracted: { targetCollection: string; [key: string]: unknown };
  status: string;
  extractedAt: string;
}

export default function Review() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [records, setRecords] = useState<PendingRecord[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch('/api/review-list');
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      if (!res.ok) {
        setLoadError('Жагсаалт татахад алдаа гарлаа — дахин оролдоно уу.');
        setAuthed(true);
        return;
      }
      const data = await res.json();
      setRecords((data.records as PendingRecord[]).filter((r) => r.status === 'pending'));
      setAuthed(true);
    } catch {
      setLoadError('Сүлжээний алдаа гарлаа — интернэт холболтоо шалгаад дахин оролдоно уу.');
      setAuthed((prev) => prev ?? true);
    }
  }, []);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  async function login() {
    setLoginError(false);
    try {
      const res = await fetch('/api/review-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        await loadRecords();
      } else {
        setLoginError(true);
      }
    } catch {
      setLoginError(true);
    }
  }

  if (authed === null) {
    return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Ачааллаж байна…</p>;
  }

  if (!authed) {
    return (
      <Card title="Админ нэвтрэх" subtitle="Зөвхөн шинэ баримт баталгаажуулах эрхтэй хэрэглэгчид зориулав">
        <div className="max-w-xs space-y-3">
          <Input
            placeholder="Хэрэглэгчийн нэр"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Нууц үг"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') login(); }}
          />
          {loginError && (
            <p className="text-xs" style={{ color: 'var(--status-critical)' }}>Буруу байна.</p>
          )}
          <Button onClick={login} disabled={!username || !password}>Нэвтрэх</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Баталгаажуулах хүлээгдэж буй"
          value={String(records?.length ?? 0)}
          tone={records && records.length > 0 ? 'warning' : 'good'}
        />
      </div>

      {loadError && (
        <Card>
          <p className="text-sm" style={{ color: 'var(--status-critical)' }}>{loadError}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={loadRecords}>
            Дахин оролдох
          </Button>
        </Card>
      )}

      {records?.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Хүлээгдэж буй баримт алга.</p>
      )}

      {records?.map((r) => (
        <ReviewRecordCard key={r.id} record={r} onDone={loadRecords} />
      ))}
    </div>
  );
}

function ReviewRecordCard({ record, onDone }: { record: PendingRecord; onDone: () => void }) {
  const collection = record.extracted.targetCollection;
  const template = RECORD_TEMPLATES[collection] ?? {};
  const { targetCollection: _drop, ...extractedFields } = record.extracted;
  void _drop;
  const [json, setJson] = useState(() => JSON.stringify({ ...template, ...extractedFields }, null, 2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(decision: 'approve' | 'reject') {
    setBusy(true);
    setError(null);

    let finalRecord: unknown;
    if (decision === 'approve') {
      try {
        finalRecord = JSON.parse(json);
      } catch {
        setError('JSON буруу форматтай байна.');
        setBusy(false);
        return;
      }
    }

    try {
      const res = await fetch('/api/review-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId: record.id, decision, finalRecord }),
      });

      if (res.ok) {
        onDone();
      } else {
        const data = await res.json().catch(() => ({}) as { error?: string });
        setError(
          data.error === 'invalid_record'
            ? 'Талбарууд буруу байна — доор шалгаад дахин оролдоно уу.'
            : `Алдаа: ${data.error ?? res.status}`,
        );
      }
    } catch {
      setError('Сүлжээний алдаа гарлаа — интернэт холболтоо шалгаад дахин оролдоно уу.');
    }
    setBusy(false);
  }

  return (
    <Card
      title={record.sourceFile.name}
      subtitle={`Ангилал: ${collection} · ${new Date(record.extractedAt).toLocaleString('mn-MN')}`}
      right={
        <a href={record.sourceFile.webUrl} target="_blank" rel="noreferrer" className="text-xs underline"
          style={{ color: 'var(--series-1)' }}>
          Эх файл нээх
        </a>
      }
    >
      <textarea
        className="h-64 w-full rounded-lg border p-2 font-mono text-xs"
        style={{ borderColor: 'var(--border-strong)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}
        value={json}
        onChange={(e) => setJson(e.target.value)}
        spellCheck={false}
      />
      {error && <p className="mt-1.5 text-xs" style={{ color: 'var(--status-critical)' }}>{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" onClick={() => act('reject')} disabled={busy}>Цуцлах</Button>
        <Button size="sm" onClick={() => act('approve')} disabled={busy}>Батлах</Button>
      </div>
    </Card>
  );
}

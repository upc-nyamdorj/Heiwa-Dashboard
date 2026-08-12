'use client';

import React, { useEffect, useState } from 'react';
import Overview from '@/views/Overview';
import Documents from '@/views/Documents';
import Contracts from '@/views/Contracts';
import Payments from '@/views/Payments';
import CorrespondenceView from '@/views/Correspondence';
import Drawings from '@/views/Drawings';
import Audit from '@/views/Audit';
import { meta, documents, contracts, payments, correspondence, drawings } from '@/lib/data';
import { date, num } from '@/lib/format';

const TABS = [
  { id: 'overview', label: 'Тойм', hint: 'Төслийн ерөнхий байдал' },
  { id: 'contracts', label: 'Гэрээ', hint: `${contracts.length} гэрээ` },
  { id: 'payments', label: 'Санхүүжилт', hint: `${payments.length} тайлан` },
  { id: 'documents', label: 'Баримт бичиг', hint: `${documents.length} файл` },
  { id: 'correspondence', label: 'Захидал / RFI', hint: `${correspondence.length} баримт` },
  { id: 'drawings', label: 'Зургийн бүртгэл', hint: `${drawings.length} багц` },
  { id: 'audit', label: 'Шалгалт', hint: 'Өгөгдлийн үнэн зөв байдал' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function Page() {
  const [tab, setTab] = useState<TabId>('overview');
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute('data-theme') === 'dark');
    const fromHash = window.location.hash.replace('#', '');
    if (TABS.some((t) => t.id === fromHash)) setTab(fromHash as TabId);
  }, []);

  const toggleTheme = () => {
    const next = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('heiwa-theme', next); } catch { /* private mode */ }
    setDark(!dark);
  };

  const go = (id: TabId) => {
    setTab(id);
    if (typeof window !== 'undefined') window.location.hash = id;
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b backdrop-blur"
        style={{ background: 'color-mix(in srgb, var(--plane) 88%, transparent)' }}>
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold"
              style={{ background: 'var(--text-primary)', color: 'var(--surface-1)' }}>
              H
            </div>
            <div>
              <h1 className="text-sm leading-tight font-semibold">Хэйва хотхон — төслийн хяналтын самбар</h1>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {meta.client} · {meta.manager} · {date(meta.dateMin)} – {date(meta.dateMax)}
              </p>
            </div>
          </div>
          <nav className="flex flex-wrap gap-1.5 no-print" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} className="btn" data-active={tab === t.id}
                role="tab" aria-selected={tab === t.id} title={t.hint}
                onClick={() => go(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 no-print">
            <span className="chip tnum">{num(meta.fileCount)} баримт</span>
            <button className="btn" onClick={toggleTheme}
              title={dark ? 'Цайвар горим' : 'Бараан горим'} aria-label="Өнгөний горим солих">
              {dark ? '☀' : '☾'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-5 py-5">
        {tab === 'overview' && <Overview />}
        {tab === 'contracts' && <Contracts />}
        {tab === 'payments' && <Payments />}
        {tab === 'documents' && <Documents />}
        {tab === 'correspondence' && <CorrespondenceView />}
        {tab === 'drawings' && <Drawings />}
        {tab === 'audit' && <Audit />}
      </main>

      <footer className="mx-auto max-w-[1500px] px-5 pt-2 pb-10 text-xs"
        style={{ color: 'var(--text-muted)' }}>
        <p>
          Эх сурвалж: «{meta.sourceFolder}» хавтас — {num(meta.fileCount)} файл.
          Гэрээ, санхүүжилтийн дүнг сканнердсан PDF-ийн хураангуй хуудаснаас уншиж авсан
          ({meta.extractedDocs} баримт). Дүн уншигдаагүй {meta.extractFailed.length} баримтыг
          тооцоонд оруулаагүй бөгөөд холбогдох хэсэгт тэмдэглэсэн.
        </p>
      </footer>
    </div>
  );
}

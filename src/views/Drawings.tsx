'use client';

import React, { useMemo, useState } from 'react';
import { Card, StatTile, Legend } from '@/components/chart-kit';
import { Heatmap, RankBar } from '@/components/charts';
import { DataTable, SearchBox, Toggles, type Column } from '@/components/DataTable';
import {
  drawings, drawingCompanies, drawingDisciplines, totalDrawingPages,
  drawingsPending, BLOCKS, blocksOf, documents,
} from '@/lib/data';
import type { Drawing } from '@/lib/types';
import { num } from '@/lib/format';
import { SERIES } from '@/lib/palette';

const ALL = '__all__';

export default function Drawings() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(ALL);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return drawings.filter((d) => {
      if (status !== ALL && d.status !== status) return false;
      if (!needle) return true;
      return `${d.company} ${d.drawing ?? ''} ${d.code ?? ''} ${d.block ?? ''}`
        .toLowerCase().includes(needle);
    });
  }, [q, status]);

  /** Pages per discipline × block — the completeness matrix. */
  const blockMatrix = useMemo(() => {
    const cells = new Map<string, number>();
    for (const d of drawings) {
      if (!d.drawing) continue;
      const blocks = blocksOf(d);
      if (blocks.length === 0) continue;
      const share = (d.pages ?? 0) / blocks.length;
      for (const b of blocks) {
        const k = `${d.drawing}|${b}`;
        cells.set(k, (cells.get(k) ?? 0) + share);
      }
    }
    const rows = drawingDisciplines.filter((disc) =>
      BLOCKS.some((b) => (cells.get(`${disc}|${b}`) ?? 0) > 0));
    return { rows, get: (r: string, c: string) => Math.round(cells.get(`${r}|${c}`) ?? 0) };
  }, []);

  const byCompany = useMemo(() => {
    const m = new Map<string, { pages: number; sets: number; pending: number }>();
    for (const d of drawings) {
      if (!m.has(d.company)) m.set(d.company, { pages: 0, sets: 0, pending: 0 });
      const r = m.get(d.company)!;
      r.pages += d.pages ?? 0;
      r.sets += 1;
      if (d.status !== 'Хүлээн авсан') r.pending += 1;
    }
    return Array.from(m.entries())
      .map(([company, v]) => ({
        label: company,
        value: v.pages,
        color: v.pending > 0 ? 'var(--status-warning)' : SERIES[0],
        sub: `${v.sets} багц${v.pending ? ` · ${v.pending} дуусаагүй` : ''}`,
      }))
      .sort((a, b) => b.value - a.value);
  }, []);

  const original = drawings.filter((d) => d.hasOriginal).length;
  const digital = drawings.filter((d) => d.hasDigital).length;
  // "Original missing" = the set exists in some form (copy or file) but the
  // signed original drawing has not been handed over.
  const noOriginal = drawings.filter((d) => !d.hasOriginal && (d.hasCopy || d.hasDigital));

  const columns: Column<Drawing>[] = [
    { key: 'no', header: '№', width: 40, align: 'right', value: (d) => d.no },
    { key: 'company', header: 'Зохиогч', width: 190, strong: true, value: (d) => d.company },
    { key: 'drawing', header: 'Зургийн нэр', width: 250, value: (d) => d.drawing ?? '' },
    { key: 'code', header: 'Шифр', width: 150, value: (d) => d.code ?? '',
      render: (d) => <span className="tnum">{d.code ?? '—'}</span> },
    { key: 'block', header: 'Блок', width: 150, value: (d) => d.block ?? '' },
    { key: 'pages', header: 'Хуудас', width: 70, align: 'right', value: (d) => d.pages },
    { key: 'copies', header: 'Хувь', width: 150, value: (d) => (d.hasOriginal ? 1 : 0),
      render: (d) => (
        <span className="flex flex-wrap gap-1">
          {d.hasOriginal && <span className="chip">эх</span>}
          {d.hasCopy && <span className="chip">хуулбар</span>}
          {d.hasDigital && <span className="chip">файл</span>}
          {!d.hasOriginal && !d.hasCopy && !d.hasDigital && (
            <span style={{ color: 'var(--text-muted)' }}>—</span>
          )}
        </span>
      ) },
    { key: 'status', header: 'Төлөв', width: 120, value: (d) => d.status,
      render: (d) => (
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{
            background: d.status === 'Хүлээн авсан' ? 'var(--status-good)'
              : d.status === 'Дутуу' ? 'var(--status-serious)' : 'var(--status-warning)',
          }} />
          {d.status}
        </span>
      ) },
    { key: 'note', header: 'Тайлбар', value: (d) => d.note ?? '',
      render: (d) => (
        <span className="block max-w-[260px] truncate" title={d.note ?? undefined}>
          {d.note ?? ''}
        </span>
      ) },
  ];

  const designDocs = documents.filter((d) => d.category === 'Зураг зохиогч');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Нийт хуудас" value={num(totalDrawingPages)}
          sub={`${drawings.length} багц · ${drawingCompanies.length} зохиогч`}
          accent="var(--series-1)" />
        <StatTile label="Эх хувьтай" value={`${original} / ${drawings.length}`}
          sub={`${digital} багц файлтай`} accent="var(--series-3)" />
        <StatTile label="Дуусаагүй / дутуу" value={num(drawingsPending.length)}
          sub={drawingsPending.map((d) => d.drawing).filter(Boolean).join(', ') || '—'}
          tone={drawingsPending.length ? 'warning' : 'good'} />
        <StatTile label="Эх хувь дутуу" value={num(noOriginal.length)}
          sub={Array.from(new Set(noOriginal.map((d) => d.company))).join(', ') || '—'}
          tone={noOriginal.length ? 'warning' : 'good'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <Card title="Зургийн хэсэг × блок"
          subtitle="Блок бүрт ноогдох хуудасны тоо. Хоосон нүд = тухайн блокт зураг бүртгэгдээгүй">
          <Heatmap cols={BLOCKS} rowsLabels={blockMatrix.rows}
            get={(r, c) => blockMatrix.get(r, c)} />
          <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            Хэд хэдэн блокт хамаарах багцын хуудсыг блокуудад тэнцүү хуваарилав.
            Ерөнхий төлөвлөгөө, гадна шугам сүлжээ зэрэг блокт хамаарахгүй багц энд харагдахгүй.
          </p>
        </Card>

        <Card title="Зохиогч тус бүрийн хуудас"
          right={<Legend items={[
            { label: 'Бүрэн хүлээн авсан', color: SERIES[0] },
            { label: 'Дуусаагүй багцтай', color: 'var(--status-warning)' },
          ]} />}>
          <RankBar rows={byCompany} format={(v) => `${v} хуудас`} height={300}
            valueLabel="Хуудас" />
        </Card>
      </div>

      <Card title="Зургийн бүртгэл"
        subtitle="Эх сурвалж: «Зургийн бүртгэл Хэйва.xlsx»"
        right={
          <div className="flex flex-wrap items-center gap-2 no-print">
            <SearchBox value={q} onChange={setQ} placeholder="Зохиогч, шифр, блокоор хайх…" className="w-56" />
            <Toggles value={status} onChange={setStatus} options={[
              { value: ALL, label: 'Бүгд' },
              { value: 'Хүлээн авсан', label: 'Хүлээн авсан' },
              { value: 'Дуусаагүй', label: 'Дуусаагүй' },
              { value: 'Дутуу', label: 'Дутуу' },
            ]} />
          </div>
        }>
        <DataTable rows={filtered} columns={columns}
          initialSort={{ key: 'no', dir: 'asc' }} pageSize={30} dense />
      </Card>

      <Card title="Зураг зохиогчидтой холбоотой баримт"
        subtitle={`${designDocs.length} баримт — гэрээ, RFI, албан бичиг`}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from(new Set(designDocs.map((d) => d.party))).filter((p) => p !== '—').map((party) => {
            const rows = designDocs.filter((d) => d.party === party);
            const hasContract = rows.some((d) =>
              ['CWA', 'CMA', 'CONTRACT', 'CMA+CWA'].includes(d.typeCode));
            return (
              <div key={party} className="rounded-lg border px-3 py-2.5 text-xs"
                style={{ borderColor: 'var(--grid)' }}>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{party}</span>
                  <span className="tnum shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {rows.length}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {Array.from(new Set(rows.map((r) => r.typeLabel))).map((t) => (
                    <span key={t} className="chip">{t}</span>
                  ))}
                </div>
                {!hasContract && (
                  <p className="mt-1.5" style={{ color: 'var(--status-warning)' }}>
                    ⚠ Гэрээний файл энэ хавтсанд алга
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          Зургийн бүртгэлд ЭльктроСеть Проект, Арбэл Алтай, Элекбий, Мип дизайн, Арт трасс,
          Хос ногоолин, Номин трейдинг зэрэг зохиогч бүртгэлтэй ч тэдгээрийн гэрээ, ажил
          хүлээлцсэн акт нь энэ хавтсанд байхгүй байна.
        </p>
      </Card>
    </div>
  );
}

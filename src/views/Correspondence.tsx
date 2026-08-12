'use client';

import React, { useMemo, useState } from 'react';
import { Card, StatTile, Legend } from '@/components/chart-kit';
import { ColumnChart, RankBar } from '@/components/charts';
import { DataTable, SearchBox, Toggles, type Column } from '@/components/DataTable';
import { correspondence, rfiThreads, byMonth, quality, documents } from '@/lib/data';
import type { Correspondence as CorrRow } from '@/lib/types';
import { date, monthLabel, monthShort, num, mnt } from '@/lib/format';
import { SERIES } from '@/lib/palette';

const ALL = '__all__';

const DIR_COLOR = { out: SERIES[0], in: SERIES[1] } as const;
const DIR_LABEL = { out: 'Явсан', in: 'Ирсэн' } as const;

const TYPE_LABEL: Record<string, string> = {
  LETTER: 'Албан бичиг',
  RFI: 'RFI',
  SITE_LETTER: 'Талбайн захиа',
  SITE_INSTR: 'Талбайн даалгавар',
};

export default function CorrespondenceView() {
  const [q, setQ] = useState('');
  const [dir, setDir] = useState(ALL);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return correspondence.filter((c) => {
      if (dir !== ALL && c.direction !== dir) return false;
      if (!needle) return true;
      return `${c.filename} ${c.party} ${c.docNo ?? ''}`.toLowerCase().includes(needle);
    });
  }, [q, dir]);

  const monthRows = useMemo(() => byMonth.map((m) => {
    const values = { out: 0, in: 0 };
    for (const c of filtered) {
      if (!c.date || c.date.slice(0, 7) !== m.key) continue;
      if (c.direction === 'out') values.out += 1;
      else if (c.direction === 'in') values.in += 1;
    }
    return { x: monthShort(m.key), xFull: monthLabel(m.key), values };
  }), [filtered]);

  const partyRank = useMemo(() => {
    const m = new Map<string, { out: number; in: number }>();
    for (const c of correspondence) {
      if (!m.has(c.party)) m.set(c.party, { out: 0, in: 0 });
      const r = m.get(c.party)!;
      if (c.direction === 'out') r.out += 1;
      else if (c.direction === 'in') r.in += 1;
    }
    return Array.from(m.entries())
      .map(([party, v]) => ({
        label: party,
        value: v.out + v.in,
        color: SERIES[0],
        sub: `Явсан ${v.out} · Ирсэн ${v.in}`,
      }))
      .sort((a, b) => b.value - a.value);
  }, []);

  const answered = rfiThreads.filter((t) => t.turnaround != null);
  const openThreads = rfiThreads.filter((t) => t.outDate && !t.inDate);
  const avg = answered.length
    ? answered.reduce((s, t) => s + (t.turnaround ?? 0), 0) / answered.length : null;
  const slowest = [...answered].sort((a, b) => (b.turnaround ?? 0) - (a.turnaround ?? 0))[0];

  const columns: Column<CorrRow>[] = [
    { key: 'date', header: 'Огноо', width: 92, strong: true, value: (c) => c.date,
      render: (c) => <span className="tnum">{date(c.date)}</span> },
    { key: 'direction', header: 'Чиглэл', width: 92, value: (c) => c.direction ?? '',
      render: (c) => (c.direction ? (
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-[2px]"
            style={{ background: DIR_COLOR[c.direction] }} />
          {DIR_LABEL[c.direction]}
        </span>
      ) : '—') },
    { key: 'typeCode', header: 'Төрөл', width: 130, value: (c) => c.typeCode,
      render: (c) => TYPE_LABEL[c.typeCode] ?? c.typeLabel },
    { key: 'docNo', header: 'Дугаар', width: 84, value: (c) => c.docNo,
      render: (c) => <span className="tnum">{c.docNo ?? '—'} <span style={{ color: 'var(--text-muted)' }}>{c.system}</span></span> },
    { key: 'party', header: 'Тал', width: 220, value: (c) => c.party },
    { key: 'filename', header: 'Файл', value: (c) => c.filename,
      render: (c) => <span className="block max-w-[420px] truncate" title={c.path}>{c.filename}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Захидал харилцаа" value={num(correspondence.length)}
          sub={`Явсан ${correspondence.filter((c) => c.direction === 'out').length} · Ирсэн ${correspondence.filter((c) => c.direction === 'in').length}`}
          accent="var(--series-1)" />
        <StatTile label="RFI утас" value={num(rfiThreads.length)}
          sub={`${answered.length} хариулагдсан · ${openThreads.length} нээлттэй`}
          accent="var(--series-2)" />
        <StatTile label="Хариу өгөх дундаж" value={avg != null ? `${avg.toFixed(0)} хоног` : '—'}
          sub={slowest ? `Хамгийн урт: RFI ${slowest.no} — ${slowest.turnaround} хоног` : ''}
          tone={avg != null && avg > 14 ? 'warning' : 'good'} />
        <StatTile label="Нээлттэй RFI" value={num(openThreads.length)}
          sub={openThreads.length ? `Дугаар ${openThreads.map((t) => t.no).join(', ')}` : 'Бүгд хариулагдсан'}
          tone={openThreads.length ? 'warning' : 'good'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <Card title="Захидлын урсгал" subtitle="Сар бүрийн ирсэн/явсан баримт"
          right={<Legend items={[
            { label: 'Явсан', color: DIR_COLOR.out },
            { label: 'Ирсэн', color: DIR_COLOR.in },
          ]} />}>
          <ColumnChart rows={monthRows}
            series={[
              { key: 'out', label: 'Явсан', color: DIR_COLOR.out },
              { key: 'in', label: 'Ирсэн', color: DIR_COLOR.in },
            ]}
            format={(v) => String(Math.round(v))} height={220} stacked={false} />
        </Card>

        <Card title="Талуудын захидлын идэвх" subtitle="Ирсэн + явсан нийт">
          <RankBar rows={partyRank} format={(v) => `${v}`} height={250} valueLabel="Баримт" />
        </Card>
      </div>

      <Card title="RFI хариу өгөх хугацаа"
        subtitle="Нэг дугаартай явсан ба ирсэн RFI-г нэг утас гэж үзэв">
        <div className="overflow-x-auto scroll">
          <table className="grid">
            <thead>
              <tr>
                <th style={{ width: 70 }}>RFI</th>
                <th style={{ width: 100 }}>Явсан</th>
                <th style={{ width: 100 }}>Ирсэн</th>
                <th style={{ width: 90, textAlign: 'right' }}>Хоног</th>
                <th>Хугацааны зураас</th>
              </tr>
            </thead>
            <tbody>
              {rfiThreads.map((t) => {
                const maxTurn = Math.max(...answered.map((a) => a.turnaround ?? 0), 1);
                const tone = t.turnaround == null ? 'var(--status-warning)'
                  : t.turnaround <= 7 ? 'var(--status-good)'
                    : t.turnaround <= 21 ? 'var(--series-1)' : 'var(--status-serious)';
                return (
                  <tr key={t.no}>
                    <td className="strong tnum">{t.no}</td>
                    <td className="tnum">{date(t.outDate)}</td>
                    <td className="tnum">{date(t.inDate)}</td>
                    <td className="tnum" style={{ textAlign: 'right', color: tone }}>
                      {t.turnaround != null ? t.turnaround
                        : t.outDate ? 'нээлттэй' : 'явсан нь бүртгэлгүй'}
                    </td>
                    <td>
                      <div className="h-1.5 w-full rounded-full" style={{ background: 'var(--seq-zero)' }}>
                        <div className="h-1.5 rounded-full" style={{
                          width: `${Math.max(3, ((t.turnaround ?? maxTurn) / maxTurn) * 100)}%`,
                          background: tone,
                          opacity: t.turnaround == null ? 0.45 : 1,
                        }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Legend className="mt-3" items={[
          { label: '7 хоног хүртэл', color: 'var(--status-good)' },
          { label: '8–21 хоног', color: 'var(--series-1)' },
          { label: '21-ээс дээш', color: 'var(--status-serious)' },
          { label: 'Хариу аваагүй / хосгүй', color: 'var(--status-warning)' },
        ]} />
      </Card>

      <Card title="Захидлын бүртгэл"
        right={
          <div className="flex flex-wrap items-center gap-2 no-print">
            <SearchBox value={q} onChange={setQ} placeholder="Тал, дугаараар хайх…" className="w-52" />
            <Toggles value={dir} onChange={setDir} options={[
              { value: ALL, label: 'Бүгд' },
              { value: 'out', label: 'Явсан' },
              { value: 'in', label: 'Ирсэн' },
            ]} />
          </div>
        }>
        <DataTable rows={filtered} columns={columns}
          initialSort={{ key: 'date', dir: 'desc' }} pageSize={20} />
      </Card>

      <Card title="Чанарын баримт"
        subtitle="Үл тохирол, согог засварын акт болон торгуулийн акт">
        <div className="grid gap-2 md:grid-cols-2">
          {quality.map((qq) => (
            <div key={qq.path} className="rounded-lg border px-3 py-2.5 text-xs"
              style={{ borderColor: 'var(--grid)' }}>
              <div className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-1.5 font-medium"
                  style={{ color: 'var(--text-primary)' }}>
                  <span className="inline-block h-2 w-2 rounded-full" style={{
                    background: qq.typeCode === 'PENALTY'
                      ? 'var(--status-critical)' : 'var(--status-serious)',
                  }} />
                  {qq.block ? `${qq.block} блок` : qq.typeLabel}
                </span>
                <span className="tnum shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {qq.amount ? mnt(qq.amount) : date(qq.date)}
                </span>
              </div>
              <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>{qq.party}</p>
              <p className="mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}
                title={qq.filename}>{qq.filename}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          Талбайн даалгавар {documents.filter((d) => d.typeCode === 'SITE_INSTR').length},
          талбайн захиа {documents.filter((d) => d.typeCode === 'SITE_LETTER').length} баримт
          дээрх бүртгэлд орсон.
        </p>
      </Card>
    </div>
  );
}

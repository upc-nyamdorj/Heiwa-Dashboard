'use client';

import React, { useMemo, useState } from 'react';
import { Card, StatTile, Legend } from '@/components/chart-kit';
import { Heatmap, ColumnChart } from '@/components/charts';
import { DataTable, SearchBox, Select, type Column } from '@/components/DataTable';
import { documents, meta, byMonth, docMatrix } from '@/lib/data';
import type { DocumentRow } from '@/lib/types';
import { bytes, date, monthLabel, monthShort, num } from '@/lib/format';
import { CATEGORY_SHORT, typeGroupColor, TYPE_GROUP, TYPE_GROUP_ORDER } from '@/lib/palette';

const ALL = '__all__';

export default function Documents() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [party, setParty] = useState(ALL);

  const categories = useMemo(
    () => Array.from(new Set(documents.map((d) => d.category))).sort(), []);
  const types = useMemo(
    () => Array.from(new Set(documents.map((d) => d.typeLabel))).sort(), []);
  const partyList = useMemo(
    () => Array.from(new Set(documents.map((d) => d.party))).sort((a, b) => a.localeCompare(b, 'mn')), []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return documents.filter((d) => {
      if (cat !== ALL && d.category !== cat) return false;
      if (type !== ALL && d.typeLabel !== type) return false;
      if (party !== ALL && d.party !== party) return false;
      if (!needle) return true;
      return `${d.filename} ${d.party} ${d.docNo ?? ''} ${d.typeLabel} ${d.folder ?? ''}`
        .toLowerCase().includes(needle);
    });
  }, [q, cat, type, party]);

  const matrix = useMemo(() => docMatrix(filtered), [filtered]);

  const monthRows = useMemo(() => byMonth.map((m) => {
    const values: Record<string, number> = {};
    for (const g of TYPE_GROUP_ORDER) values[g] = 0;
    for (const d of filtered) {
      if (!d.date || d.date.slice(0, 7) !== m.key) continue;
      values[TYPE_GROUP[d.typeCode] ?? 'Бусад'] += 1;
    }
    return { x: monthShort(m.key), xFull: monthLabel(m.key), values };
  }), [filtered]);

  const columns: Column<DocumentRow>[] = [
    {
      key: 'docNo', header: 'Дугаар', width: 92, strong: true,
      value: (r) => r.docNo ?? '',
      render: (r) => (
        <span className="tnum">
          {r.docNo ?? '—'}
          {r.system && <span style={{ color: 'var(--text-muted)' }}> {r.system}</span>}
        </span>
      ),
    },
    { key: 'date', header: 'Огноо', width: 92, value: (r) => r.date, render: (r) => <span className="tnum">{date(r.date)}</span> },
    { key: 'typeLabel', header: 'Төрөл', width: 190, value: (r) => r.typeLabel,
      render: (r) => (
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 shrink-0 rounded-[2px]"
            style={{ background: typeGroupColor(TYPE_GROUP[r.typeCode] ?? 'Бусад') }} />
          {r.typeLabel}{r.seqNo ? ` ${r.seqNo}` : ''}
        </span>
      ) },
    { key: 'party', header: 'Тал', width: 210, value: (r) => r.party, strong: true },
    { key: 'category', header: 'Ангилал', width: 150,
      value: (r) => r.category, render: (r) => CATEGORY_SHORT[r.category] ?? r.category },
    { key: 'filename', header: 'Файл', value: (r) => r.filename,
      render: (r) => (
        <span className="block max-w-[430px] truncate" title={r.path}>
          {r.filename}
          {r.isDuplicateFile && <span className="chip ml-1.5">давхардсан</span>}
          {r.supersededBy && <span className="chip ml-1.5">{r.supersededBy}-аар солигдсон</span>}
          {r.isAmendment && <span className="chip ml-1.5">нэмэлт</span>}
        </span>
      ) },
    { key: 'sizeBytes', header: 'Хэмжээ', align: 'right', width: 80,
      value: (r) => r.sizeBytes, render: (r) => bytes(r.sizeBytes) },
  ];

  const noDate = filtered.filter((d) => !d.date).length;
  const dupes = filtered.filter((d) => d.isDuplicateFile).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Шүүлтэд тохирсон" value={num(filtered.length)}
          sub={`нийт ${num(meta.fileCount)} баримтаас`} accent="var(--series-1)" />
        <StatTile label="Огноогүй баримт" value={num(noDate)}
          sub="файлын нэрэнд огноо байхгүй" tone={noDate ? 'warning' : undefined} />
        <StatTile label="Давхардсан файл" value={num(dupes)}
          sub="нэг баримт хоёр хавтсанд" tone={dupes ? 'warning' : undefined} />
        <StatTile label="Хэмжээ" value={bytes(filtered.reduce((s, d) => s + d.sizeBytes, 0))}
          sub={`${new Set(filtered.map((d) => d.party)).size} тал`} />
      </div>

      <Card title="Баримт бичгийн бүртгэл" subtitle="Багана дээр дарж эрэмбэлнэ"
        right={
          <div className="flex flex-wrap items-center gap-2 no-print">
            <SearchBox value={q} onChange={setQ} placeholder="Файл, тал, дугаараар хайх…" className="w-56" />
            <Select value={cat} onChange={setCat} options={[
              { value: ALL, label: 'Бүх ангилал' },
              ...categories.map((c) => ({ value: c, label: CATEGORY_SHORT[c] ?? c })),
            ]} />
            <Select value={type} onChange={setType} options={[
              { value: ALL, label: 'Бүх төрөл' }, ...types.map((t) => ({ value: t, label: t })),
            ]} />
            <Select value={party} onChange={setParty} options={[
              { value: ALL, label: 'Бүх тал' }, ...partyList.map((p) => ({ value: p, label: p })),
            ]} />
          </div>
        }>
        <DataTable rows={filtered} columns={columns}
          initialSort={{ key: 'date', dir: 'desc' }} pageSize={20} />
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Ангилал × баримтын төрөл"
          subtitle="Шүүлтийн дараах тоо. Бүдэг өнгө = цөөн, тод = олон баримт">
          <Heatmap cols={matrix.types} rowsLabels={matrix.cats}
            get={(r, c) => matrix.get(r, c)}
            colHeader={(c) => c.replace('санхүүжилтийн тайлан', 'санх. тайлан')
              .replace('Мэдээлэл тодруулах хүсэлт', 'RFI')
              .replace('Тусгай зөвшөөрөл / гэрчилгээ', 'Тусгай зөвшөөрөл')} />
        </Card>

        <Card title="Сар бүрийн баримтын урсгал"
          right={<Legend items={TYPE_GROUP_ORDER.map((g) => ({ label: g, color: typeGroupColor(g) }))} />}>
          <ColumnChart rows={monthRows}
            series={TYPE_GROUP_ORDER.map((g) => ({ key: g, label: g, color: typeGroupColor(g) }))}
            format={(v) => String(Math.round(v))} height={230} />
        </Card>
      </div>

      <Card title="Дугаарлалтын хяналт"
        subtitle="BI бүртгэлийн дугаарууд болон санхүүжилтийн тайлангийн дараалал">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <h4 className="mb-1.5 text-xs font-semibold">Энэ хавтсанд байхгүй BI дугаар</h4>
            <p className="mb-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              BI бүртгэл нь төслийн нийт бичиг хэрэг тул эдгээр дугаар өөр хавтсанд
              байж болно. Гэхдээ Хэйва төслийн хавтсанд байхгүй нь шалгах жагсаалт болно.
            </p>
            <div className="flex flex-wrap gap-1">
              {meta.registryGapsBI.map((n) => (
                <span key={n} className="chip tnum">{String(n).padStart(3, '0')}</span>
              ))}
            </div>
          </div>
          <div>
            <h4 className="mb-1.5 text-xs font-semibold">Санхүүжилтийн тайлангийн дараалалд байхгүй дугаар</h4>
            <ul className="space-y-1.5 text-xs">
              {meta.iprSequenceGaps.map((g) => (
                <li key={g.contractKey} className="flex items-center justify-between gap-3">
                  <span style={{ color: 'var(--text-secondary)' }}>{g.contractKey}</span>
                  <span className="tnum">
                    IPR-{g.missing.map((n) => String(n).padStart(2, '0')).join(', ')} алга
                    <span style={{ color: 'var(--text-muted)' }}> (IPR-{String(g.max).padStart(2, '0')} хүртэл)</span>
                  </span>
                </li>
              ))}
              {meta.iprSequenceGaps.length === 0 && (
                <li style={{ color: 'var(--text-muted)' }}>Дараалал бүрэн.</li>
              )}
            </ul>
            <h4 className="mt-4 mb-1.5 text-xs font-semibold">Гэрээ нь архивт байхгүй тайлан</h4>
            <div className="flex flex-wrap gap-1">
              {meta.orphanContractKeys.map((k) => <span key={k} className="chip">{k}</span>)}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

'use client';

import React, { useMemo, useState } from 'react';
import { Card, StatTile, Legend } from '@/components/chart-kit';
import { Gantt, RankBar, ProgressCell, type GanttRow } from '@/components/charts';
import { DataTable, SearchBox, Select, type Column } from '@/components/DataTable';
import {
  contracts, meta, mntContracts, totalContractValue, totalPaid, foreignContracts,
  paymentsFor, unpaidContracts,
} from '@/lib/data';
import type { Contract } from '@/lib/types';
import { compact, date, mnt, num, pct } from '@/lib/format';
import { categoryColor, CATEGORY_SHORT, CATEGORY_ORDER } from '@/lib/palette';

const ALL = '__all__';

function paidTone(c: Contract): string {
  if (c.paidPercent == null) return 'var(--series-1)';
  if (c.paidPercent >= 95) return 'var(--status-good)';
  if (c.paidPercent >= 40) return 'var(--series-1)';
  return 'var(--status-warning)';
}

export default function Contracts() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(ALL);
  const [open, setOpen] = useState<string | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(contracts.map((c) => c.category))).sort(), []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return contracts.filter((c) => {
      if (cat !== ALL && c.category !== cat) return false;
      if (!needle) return true;
      return `${c.party} ${c.docNo ?? ''} ${c.contractNo ?? ''} ${c.scope ?? ''} ${c.filename}`
        .toLowerCase().includes(needle);
    });
  }, [q, cat]);

  const columns: Column<Contract>[] = [
    {
      key: 'docNo', header: 'Дугаар', width: 96, strong: true,
      value: (c) => c.docNo ?? '',
      render: (c) => (
        <span className="tnum">
          {c.docNo}<span style={{ color: 'var(--text-muted)' }}> {c.system}</span>
          {c.amendments.length > 0 && (
            <span className="chip ml-1.5">+{c.amendments.length}</span>
          )}
        </span>
      ),
    },
    { key: 'party', header: 'Гүйцэтгэгч / нийлүүлэгч', width: 220, strong: true,
      value: (c) => c.party,
      render: (c) => (
        <span className="flex items-start gap-1.5">
          <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-[2px]"
            style={{ background: categoryColor(c.category) }} />
          <span>
            {c.party}
            {c.partyRole && (
              <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>{c.partyRole}</span>
            )}
          </span>
        </span>
      ) },
    { key: 'scope', header: 'Ажлын хүрээ', value: (c) => c.scope ?? '',
      render: (c) => (
        <span className="block max-w-[300px] truncate" title={c.scope ?? undefined}>
          {c.scope ?? c.typeLabel}
        </span>
      ) },
    { key: 'signedDate', header: 'Байгуулсан', width: 92, value: (c) => c.signedDate,
      render: (c) => <span className="tnum">{date(c.signedDate)}</span> },
    { key: 'end', header: 'Дуусах', width: 92, value: (c) => c.end,
      render: (c) => (
        <span className="tnum" style={{
          color: c.end && c.end < meta.dateMax && (c.paidPercent ?? 0) < 95
            ? 'var(--status-critical)' : undefined,
        }}>{date(c.end)}</span>
      ) },
    { key: 'value', header: 'Гэрээний дүн', align: 'right', width: 140,
      value: (c) => c.value,
      render: (c) => (c.value == null
        ? <span className="chip">нэгж үнэтэй</span>
        : (
          <span>
            {c.currency === 'MNT' ? mnt(c.value) : `${num(c.value)} ${c.currency}`}
            {c.valueBasis !== 'нийт' && (
              <span className="chip ml-1.5" title={c.valueBasisNote ?? undefined}>
                {c.valueBasis}
              </span>
            )}
          </span>
        )) },
    { key: 'paid', header: 'Санхүүжсэн', align: 'right', width: 130,
      value: (c) => c.paid, render: (c) => (c.paid ? mnt(c.paid) : '—') },
    { key: 'paidPercent', header: 'Гүйцэтгэл', width: 130,
      value: (c) => c.paidPercent,
      render: (c) => <ProgressCell value={c.paidPercent} color={paidTone(c)} /> },
    { key: 'x', header: '', width: 40, value: () => '',
      render: (c) => (
        <button className="btn no-print" style={{ padding: '2px 8px' }}
          onClick={() => setOpen(open === c.key ? null : c.key)}>
          {open === c.key ? '−' : '+'}
        </button>
      ) },
  ];

  const ganttRows: GanttRow[] = filtered
    .filter((c) => c.start || c.end || c.signedDate)
    .sort((a, b) => (a.start ?? a.signedDate ?? '').localeCompare(b.start ?? b.signedDate ?? ''))
    .map((c) => ({
      label: c.party.length > 26 ? `${c.party.slice(0, 25)}…` : c.party,
      sub: `${c.docNo}`,
      start: c.start ?? c.signedDate,
      end: c.end,
      color: paidTone(c),
      progress: c.paidPercent,
    }));

  const openContract = contracts.find((c) => c.key === open) ?? null;

  const valueRank = filtered
    .filter((c) => c.currency === 'MNT' && c.value)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .slice(0, 12)
    .map((c) => ({
      label: `${c.docNo} · ${c.party}`,
      value: c.value ?? 0,
      color: categoryColor(c.category),
      sub: `Санхүүжсэн ${mnt(c.paid)}${c.paidPercent != null ? ` (${pct(c.paidPercent)})` : ''}`,
    }));

  const foreignCurrencyTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of foreignContracts) m.set(c.currency, (m.get(c.currency) ?? 0) + (c.value ?? 0));
    return Array.from(m.entries());
  }, []);

  const amendCount = contracts.reduce((s, c) => s + c.amendments.length, 0);
  const expiring = contracts.filter((c) => c.end && c.end >= meta.dateMax && c.end <= '2026-10-31');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Гэрээний тоо" value={num(contracts.length)}
          sub={`${amendCount} нэмэлт өөрчлөлт · ${contracts.filter((c) => c.rateBased).length} нэгж үнэт`}
          accent="var(--series-1)" />
        <StatTile label="Нийт гэрээний дүн" value={`₮${compact(totalContractValue)}`}
          sub={foreignCurrencyTotals.length
            ? `+ ${foreignCurrencyTotals.map(([cur, v]) => `${num(v)} ${cur}`).join(' · ')} (${foreignContracts.length} гэрээ)`
            : 'бүгд төгрөгөөр'} accent="var(--series-2)" />
        <StatTile label="Дундаж гүйцэтгэл" value={pct((totalPaid / totalContractValue) * 100)}
          sub={`${mnt(totalPaid)} / ${mnt(totalContractValue)}`} accent="var(--series-3)" />
        <StatTile label="Хугацаа дуусах гэрээ" value={num(expiring.length)}
          sub="10-р сар хүртэл дуусах хугацаатай"
          tone={expiring.length > 3 ? 'warning' : undefined} />
      </div>

      <Card title="Гэрээний бүртгэл"
        subtitle="Нэмэлт өөрчлөлт бүхий гэрээний дүн нь үндсэн гэрээ + нэмэлт (эсвэл шинэчилсэн дүн)"
        right={
          <div className="flex flex-wrap items-center gap-2 no-print">
            <SearchBox value={q} onChange={setQ} placeholder="Тал, дугаар, ажлаар хайх…" className="w-56" />
            <Select value={cat} onChange={setCat} options={[
              { value: ALL, label: 'Бүх ангилал' },
              ...categories.map((c) => ({ value: c, label: CATEGORY_SHORT[c] ?? c })),
            ]} />
          </div>
        }>
        <DataTable rows={filtered} columns={columns}
          initialSort={{ key: 'value', dir: 'desc' }} pageSize={20} />
        {openContract && <ContractDetail contract={openContract} />}
      </Card>

      <div className="grid gap-4 xl:grid-cols-[2fr_3fr]">
        <Card title="Гэрээний дүнгийн эрэмбэ" subtitle="Эхний 12 гэрээ, төгрөгөөр">
          <RankBar rows={valueRank} format={(v) => `₮${compact(v)}`} height={340}
            valueLabel="Гэрээний дүн" />
          <Legend className="mt-3" items={CATEGORY_ORDER.map((c) => ({
            label: CATEGORY_SHORT[c] ?? c, color: categoryColor(c),
          }))} />
        </Card>

        <Card title="Гэрээний хугацаа ба санхүүжилтийн гүйцэтгэл"
          subtitle="Өнгө нь санхүүжилтийн байдлыг заана"
          right={<Legend items={[
            { label: '95%-аас дээш', color: 'var(--status-good)' },
            { label: '40–95%', color: 'var(--series-1)' },
            { label: '40%-аас доош', color: 'var(--status-warning)' },
          ]} />}>
          <Gantt rows={ganttRows} min={meta.dateMin} max="2027-02-01"
            today={meta.dateMax} height={360} />
        </Card>
      </div>

      {unpaidContracts.length > 0 && (
        <Card title="Санхүүжилтийн тайлан хараахан гараагүй гэрээ"
          subtitle={`${unpaidContracts.length} гэрээ — гэрээ байгуулагдсан ч архивт IPR/LPR/EC баримт алга`}>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {unpaidContracts.map((c) => (
              <div key={c.key} className="rounded-lg border px-3 py-2 text-xs"
                style={{ borderColor: 'var(--grid)' }}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{c.party}</span>
                  <span className="tnum shrink-0" style={{ color: 'var(--text-muted)' }}>{c.docNo}</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span style={{ color: 'var(--text-muted)' }}>{date(c.signedDate)}</span>
                  <span className="tnum">
                    {c.value == null ? 'нэгж үнэт'
                      : c.currency === 'MNT' ? mnt(c.value) : `${num(c.value)} ${c.currency}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function ContractDetail({ contract }: { contract: Contract }) {
  const pays = paymentsFor(contract);
  return (
    <div className="mt-4 rounded-lg border p-4" style={{ borderColor: 'var(--border-strong)' }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold">
          {contract.docNo} {contract.system} · {contract.party}
        </h4>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {contract.contractNo ? `Гэрээний дугаар ${contract.contractNo}` : ''}
        </span>
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <Field k="Ажлын хүрээ" v={contract.scope ?? '—'} span />
        <Field k="Байгуулсан" v={date(contract.signedDate)} />
        <Field k="Хугацаа" v={`${date(contract.start)} – ${date(contract.end)}${contract.periodSource !== 'гэрээ' ? ' *' : ''}`} />
        <Field k="Үндсэн дүн" v={contract.baseValue == null ? '—'
          : contract.currency === 'MNT' ? mnt(contract.baseValue) : `${num(contract.baseValue)} ${contract.currency}`} />
        <Field k="Нийт дүн" v={contract.value == null ? 'нэгж үнэтэй'
          : contract.currency === 'MNT' ? mnt(contract.value) : `${num(contract.value)} ${contract.currency}`} />
        <Field k="НӨАТ" v={contract.vatIncluded == null ? '—' : contract.vatIncluded ? 'багтсан' : 'багтаагүй'} />
        {contract.valueBasis !== 'нийт' && (
          <Field k="Дүнгийн үндэслэл" v={`${contract.valueBasis} — ${contract.valueBasisNote ?? ''}`} span />
        )}
        <Field k="Урьдчилгаа" v={contract.advancePercent != null ? `${contract.advancePercent}%` : '—'} />
        <Field k="Баталгааны суутгал" v={contract.retentionPercent != null ? `${contract.retentionPercent}%` : '—'} />
        <Field k="Санхүүжсэн" v={`${mnt(contract.paid)} (${contract.paidPercent != null ? pct(contract.paidPercent) : '—'})`} />
      </dl>

      {contract.amendments.length > 0 && (
        <div className="mt-4">
          <h5 className="mb-1.5 text-xs font-semibold">Нэмэлт өөрчлөлт</h5>
          <ul className="space-y-1.5 text-xs">
            {contract.amendments.map((a) => (
              <li key={a.docNo} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="tnum font-medium">{a.docNo}</span>
                <span className="tnum" style={{ color: 'var(--text-muted)' }}>{date(a.date)}</span>
                <span className="chip">
                  {a.mode === 'add' ? 'нэмэгдэнэ' : a.mode === 'replace' ? 'дүнг шинэчилсэн' : 'зөвхөн нэгж үнэ'}
                </span>
                <span className="tnum">{a.value != null ? mnt(a.value) : '—'}</span>
                <span className="w-full" style={{ color: 'var(--text-muted)' }}>{a.scope}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pays.length > 0 && (
        <div className="mt-4">
          <h5 className="mb-1.5 text-xs font-semibold">Санхүүжилтийн тайлангууд ({pays.length})</h5>
          <div className="max-h-56 overflow-y-auto scroll">
            <table className="grid" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Төрөл</th><th>Огноо</th><th>Ажлын хугацаа</th>
                  <th style={{ textAlign: 'right' }}>Дүн</th>
                </tr>
              </thead>
              <tbody>
                {pays.map((p) => (
                  <tr key={p.id}>
                    <td className="strong">
                      {p.typeCode}{p.seqNo ? `-${String(p.seqNo).padStart(2, '0')}` : ''}
                      {p.supersededBy && <span className="chip ml-1.5">хассан</span>}
                    </td>
                    <td className="tnum">{date(p.date)}</td>
                    <td className="tnum">
                      {p.workPeriodStart ? `${date(p.workPeriodStart)} – ${date(p.workPeriodEnd)}` : '—'}
                    </td>
                    <td className="tnum" style={{
                      textAlign: 'right',
                      color: p.supersededBy ? 'var(--text-muted)' : 'var(--text-primary)',
                      textDecoration: p.supersededBy ? 'line-through' : undefined,
                    }}>{mnt(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {contract.periodSource !== 'гэрээ' && (
        <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          * Гэрээний хугацааг гэрээнд тодорхой заагаагүй тул санхүүжилтийн тайлангийн
          «Гэрээний хугацаа» мөрнөөс нөхөж авав.
        </p>
      )}
      {contract.notes && (
        <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          <span className="font-medium">Тэмдэглэл: </span>{contract.notes}
        </p>
      )}
    </div>
  );
}

function Field({ k, v, span }: { k: string; v: string; span?: boolean }) {
  return (
    <div className={span ? 'sm:col-span-2 lg:col-span-4' : undefined}>
      <dt style={{ color: 'var(--text-muted)' }}>{k}</dt>
      <dd className="tnum mt-0.5" style={{ color: 'var(--text-primary)' }}>{v}</dd>
    </div>
  );
}

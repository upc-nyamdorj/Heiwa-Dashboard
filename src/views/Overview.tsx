'use client';

import React from 'react';
import { Card, StatTile, Legend } from '@/components/chart-kit';
import { ColumnChart, PaymentFlowChart, RankBar, Gantt, type GanttRow } from '@/components/charts';
import {
  meta, documents, contracts, payments, countedPayments, totalPaid, totalContractValue,
  byMonth, byParty, mntContracts, foreignContracts, supersededTotal, drawings,
  totalDrawingPages, drawingsPending, quality, rfiThreads, unpaidContracts,
  correspondence, partyRisk,
} from '@/lib/data';
import { compact, mnt, monthLabel, monthShort, num, pct, date, bytes } from '@/lib/format';
import { categoryColor, CATEGORY_SHORT, CATEGORY_ORDER, typeGroupColor, TYPE_GROUP, TYPE_GROUP_ORDER } from '@/lib/palette';

export default function Overview() {
  const remaining = totalContractValue - totalPaid;
  const paidPct = (totalPaid / totalContractValue) * 100;

  const flowRows = byMonth.map((m) => ({
    x: monthShort(m.key), xFull: monthLabel(m.key), paid: m.paid, cumulative: m.cumulative,
  }));

  const docRows = byMonth.map((m) => {
    const values: Record<string, number> = {};
    for (const g of TYPE_GROUP_ORDER) values[g] = 0;
    for (const d of documents) {
      if (!d.date || d.date.slice(0, 7) !== m.key) continue;
      values[TYPE_GROUP[d.typeCode] ?? 'Бусад'] += 1;
    }
    return { x: monthShort(m.key), xFull: monthLabel(m.key), values };
  });

  const topParties = byParty
    .filter((p) => p.contractValue > 0)
    .slice(0, 10)
    .map((p) => ({
      label: p.party,
      value: p.contractValue,
      color: categoryColor(p.category),
      sub: `Санхүүжсэн ${mnt(p.paid)} · ${p.paidPercent != null ? pct(p.paidPercent) : '—'}`,
    }));

  const ganttRows: GanttRow[] = contracts
    .filter((c) => c.start || c.end)
    .sort((a, b) => (a.start ?? a.end ?? '').localeCompare(b.start ?? b.end ?? ''))
    .map((c) => ({
      label: c.party,
      sub: `${c.system}/${c.docNo}`,
      start: c.start ?? c.signedDate,
      end: c.end,
      color: categoryColor(c.category),
      progress: c.paidPercent,
    }));

  const catLegend = CATEGORY_ORDER.map((c) => ({
    label: CATEGORY_SHORT[c] ?? c, color: categoryColor(c),
  }));

  const answered = rfiThreads.filter((t) => t.turnaround != null);
  const avgTurn = answered.length
    ? answered.reduce((s, t) => s + (t.turnaround ?? 0), 0) / answered.length
    : null;

  const riskTone = { 'Өндөр': 'var(--status-critical)', 'Дунд': 'var(--status-warning)', 'Бага': 'var(--status-good)' };
  const topRisk = partyRisk.slice(0, 5).map((r) => ({
    label: r.party,
    value: r.score,
    color: riskTone[r.tier],
    sub: `${r.tier} эрсдэл · ${r.qualityCount} зөрчил · ${r.overdueCount} хугацаа хэтэрсэн гэрээ`
      + ` · RFI ${r.avgRfiTurnaround != null ? `${r.avgRfiTurnaround.toFixed(0)} хоног` : '—'}`
      + ` · ${r.unpaidCount} тайлангүй гэрээ`,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Гэрээний нийт дүн" value={`₮${compact(totalContractValue)}`}
          sub={`${mntContracts.length} гэрээ · ₮ ханшаар${foreignContracts.length ? ` + ${foreignContracts.length} валют гэрээ` : ''}`}
          accent="var(--series-1)" />
        <StatTile label="Санхүүжсэн дүн" value={`₮${compact(totalPaid)}`}
          sub={`${countedPayments.length} тайлан · гэрээний ${pct(paidPct)}`}
          accent="var(--series-2)" />
        <StatTile label="Үлдэгдэл санхүүжилт" value={`₮${compact(remaining)}`}
          sub={`${unpaidContracts.length} гэрээнд тайлан хараахан алга`} accent="var(--series-4)" />
        <StatTile label="Баримт бичиг" value={num(meta.fileCount)}
          sub={`${bytes(meta.totalBytes)} · ${date(meta.dateMin)} – ${date(meta.dateMax)}`}
          accent="var(--series-3)" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <Card title="Санхүүжилтийн урсгал"
          subtitle="Багана = тухайн сард батлагдсан төлбөр · шугам = хуримтлагдсан дүн"
          right={<Legend items={[
            { label: 'Сарын санхүүжилт', color: 'var(--series-1)' },
            { label: 'Хуримтлагдсан', color: 'var(--series-2)' },
          ]} />}>
          <PaymentFlowChart rows={flowRows} />
          <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            Дахин дугаарлагдсан {mnt(supersededTotal)}-ийн 4 тайланг давхардлаас
            сэргийлж хассан.
          </p>
        </Card>

        <Card title="Гэрээний дүнгээр эхний 10 тал"
          subtitle="Өнгө нь ангиллыг заана · доорх тоо санхүүжсэн хувь">
          <RankBar rows={topParties} format={(v) => `₮${compact(v)}`} height={300}
            valueLabel="Гэрээний дүн" />
          <Legend className="mt-3" items={catLegend} />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Баримт бичгийн урсгал"
          subtitle="Сар бүр бүртгэгдсэн баримт, төрлөөр"
          right={<Legend items={TYPE_GROUP_ORDER.map((g) => ({ label: g, color: typeGroupColor(g) }))} />}>
          <ColumnChart rows={docRows}
            series={TYPE_GROUP_ORDER.map((g) => ({ key: g, label: g, color: typeGroupColor(g) }))}
            format={(v) => String(Math.round(v))} height={200} />
        </Card>

        <Card title="Төслийн эрсдэлийн товч" subtitle="Анхаарал шаардсан зүйлс">
          <ul className="space-y-2.5 text-sm">
            <RiskRow tone="critical" label="Торгууль тавьсан акт"
              value={`${quality.filter((q) => q.typeCode === 'PENALTY').length} акт · ${mnt(quality.filter((q) => q.typeCode === 'PENALTY').reduce((s, q) => s + (q.amount ?? 0), 0))}`}
              note="Дельта Констракшн — А5 блокийн бетон алдагдал" />
            <RiskRow tone="serious" label="Үл тохирол / согог засварын акт"
              value={`${quality.filter((q) => q.typeCode === 'NCR').length} баримт`}
              note="A1–A6 блок бүрт бетоны согог засварласан хуудас" />
            <RiskRow tone="warning" label="Тайлангүй гэрээ"
              value={`${unpaidContracts.length} гэрээ`}
              note="Гэрээ байгуулагдсан ч санхүүжилтийн тайлан бүртгэгдээгүй" />
            <RiskRow tone="warning" label="Дуусаагүй зураг төсөл"
              value={`${drawingsPending.length} багц`}
              note={drawingsPending.map((d) => d.drawing).filter(Boolean).slice(0, 3).join(', ')} />
            <RiskRow tone="good" label="RFI хариу өгөх дундаж хугацаа"
              value={avgTurn != null ? `${avgTurn.toFixed(0)} хоног` : '—'}
              note={`${answered.length}/${rfiThreads.length} асуулт хариулагдсан`} />
          </ul>
        </Card>
      </div>

      <Card title="Хамгийн эрсдэлтэй 5 тал"
        subtitle="Чанарын зөрчил 40% · хугацаа хэтрэлт 30% · RFI хариу удаашрал 20% · санхүүжилтийн хоцролт 10% (жин нь эцсийн бус, тохируулах боломжтой)">
        {topRisk.length
          ? <RankBar rows={topRisk} format={(v) => `${v}`} maxOverride={100} height={220} valueLabel="Эрсдэлийн оноо" />
          : <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Гэрээт тал алга.</p>}
      </Card>

      <Card title="Гэрээний хугацааны гүйцэтгэл"
        subtitle="Саарал зурвас = гэрээний хугацаа · өнгөт хэсэг = санхүүжсэн хувь · улаан босоо зураас = архивын сүүлийн огноо"
        right={<Legend items={catLegend} />}>
        <Gantt rows={ganttRows} min={meta.dateMin} max="2027-02-01" today={meta.dateMax} height={380} />
        <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          Тасархай хүрээтэй мөр = гэрээнд эхлэх/дуусах огноо тодорхой заагаагүй
          (ихэвчлэн «гэрээ баталгаажсанаас эхлэн» гэсэн заалттай).
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Гэрээт талууд" value={num(byParty.length)}
          sub={`${contracts.length} гэрээ · ${contracts.filter((c) => c.amendments.length).length} нэмэлт өөрчлөлттэй`} />
        <StatTile label="Санхүүжилтийн тайлан" value={num(payments.length)}
          sub={`IPR ${payments.filter((p) => p.typeCode === 'IPR').length} · LPR ${payments.filter((p) => p.typeCode === 'LPR').length} · EPR/EC ${payments.filter((p) => ['EPR', 'EC'].includes(p.typeCode)).length}`} />
        <StatTile label="Зургийн бүртгэл" value={`${num(totalDrawingPages)} хуудас`}
          sub={`${drawings.length} багц · ${new Set(drawings.map((d) => d.company)).size} зохиогч`} />
        <StatTile label="Захидал / RFI" value={num(correspondence.length)}
          sub={`${documents.filter((d) => d.typeCode === 'LETTER').length} албан бичиг · ${rfiThreads.length} RFI утас`} />
      </div>
    </div>
  );
}

function RiskRow({ tone, label, value, note }: {
  tone: 'good' | 'warning' | 'serious' | 'critical'; label: string; value: string; note?: string;
}) {
  const color = {
    good: 'var(--status-good)', warning: 'var(--status-warning)',
    serious: 'var(--status-serious)', critical: 'var(--status-critical)',
  }[tone];
  const icon = { good: '✓', warning: '!', serious: '▲', critical: '✕' }[tone];
  return (
    <li className="flex items-start gap-2.5 border-b pb-2.5 last:border-0"
      style={{ borderColor: 'var(--grid)' }}>
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
        style={{ background: color, color: '#fff' }} aria-hidden>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span style={{ color: 'var(--text-primary)' }}>{label}</span>
          <span className="tnum shrink-0 text-xs font-medium">{value}</span>
        </div>
        {note && <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>{note}</p>}
      </div>
    </li>
  );
}

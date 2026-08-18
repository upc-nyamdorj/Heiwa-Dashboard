"use client";

import React, { useMemo, useState } from "react";
import { Card, StatTile, Legend } from "@/components/chart-kit";
import { PaymentFlowChart, RankBar, ColumnChart } from "@/components/charts";
import {
  DataTable,
  SearchBox,
  Select,
  type Column,
} from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import {
  payments,
  countedPayments,
  totalPaid,
  supersededTotal,
  byMonth,
  byParty,
  meta,
  contracts,
} from "@/lib/data";
import type { Payment } from "@/lib/types";
import {
  compact,
  date,
  mnt,
  monthLabel,
  monthShort,
  num,
  pct,
} from "@/lib/format";
import {
  categoryColor,
  CATEGORY_SHORT,
  CATEGORY_ORDER,
  SERIES,
} from "@/lib/palette";

const ALL = "__all__";

const TYPE_COLOR: Record<string, string> = {
  IPR: SERIES[0],
  LPR: SERIES[1],
  EPR: SERIES[2],
  EC: SERIES[3],
};
const TYPE_ORDER = ["IPR", "LPR", "EPR", "EC"];
const TYPE_NAME: Record<string, string> = {
  IPR: "IPR — явцын",
  LPR: "LPR — эцсийн",
  EPR: "EPR — гүйцэтгэлийн",
  EC: "EC — гүйцэтгэлийн акт",
};

export default function Payments() {
  const [q, setQ] = useState("");
  const [party, setParty] = useState(ALL);
  const [type, setType] = useState(ALL);

  const partyList = useMemo(
    () =>
      Array.from(new Set(payments.map((p) => p.party))).sort((a, b) =>
        a.localeCompare(b, "mn"),
      ),
    [],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return payments.filter((p) => {
      if (party !== ALL && p.party !== party) return false;
      if (type !== ALL && p.typeCode !== type) return false;
      if (!needle) return true;
      return `${p.filename} ${p.party} ${p.contractNo ?? ""} ${p.workName ?? ""}`
        .toLowerCase()
        .includes(needle);
    });
  }, [q, party, type]);

  const filteredTotal = filtered
    .filter((p) => p.counted)
    .reduce((s, p) => s + (p.amount ?? 0), 0);

  const flowRows = useMemo(() => {
    const m = new Map(byMonth.map((r) => [r.key, 0]));
    for (const p of filtered) {
      if (!p.counted || !p.date) continue;
      const k = p.date.slice(0, 7);
      if (m.has(k)) m.set(k, (m.get(k) ?? 0) + (p.amount ?? 0));
    }
    let run = 0;
    return byMonth.map((r) => {
      const paid = m.get(r.key) ?? 0;
      run += paid;
      return {
        x: monthShort(r.key),
        xFull: monthLabel(r.key),
        paid,
        cumulative: run,
      };
    });
  }, [filtered]);

  const typeRows = useMemo(
    () =>
      byMonth.map((r) => {
        const values: Record<string, number> = {
          IPR: 0,
          LPR: 0,
          EPR: 0,
          EC: 0,
        };
        for (const p of filtered) {
          if (!p.counted || !p.date || p.date.slice(0, 7) !== r.key) continue;
          values[p.typeCode] = (values[p.typeCode] ?? 0) + (p.amount ?? 0);
        }
        return { x: monthShort(r.key), xFull: monthLabel(r.key), values };
      }),
    [filtered],
  );

  const partyRank = byParty
    .filter((p) => p.paid > 0)
    .sort((a, b) => b.paid - a.paid)
    .map((p) => ({
      label: p.party,
      value: p.paid,
      color: categoryColor(p.category),
      sub:
        p.contractValue > 0
          ? `Гэрээ ${mnt(p.contractValue)} · ${pct(p.paidPercent)}`
          : "Нэгж үнэт гэрээ",
    }));

  const columns: Column<Payment>[] = [
    {
      key: "date",
      header: "Огноо",
      width: 92,
      strong: true,
      value: (p) => p.date,
      render: (p) => <span className="tnum">{date(p.date)}</span>,
    },
    {
      key: "typeCode",
      header: "Төрөл",
      width: 110,
      value: (p) => `${p.typeCode}${p.seqNo ?? ""}`,
      render: (p) => (
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-[2px]"
            style={{ background: TYPE_COLOR[p.typeCode] ?? SERIES[0] }}
          />
          <span className="tnum">
            {p.typeCode}
            {p.seqNo ? `-${String(p.seqNo).padStart(2, "0")}` : ""}
          </span>
        </span>
      ),
    },
    {
      key: "party",
      header: "Гүйцэтгэгч",
      width: 200,
      strong: true,
      value: (p) => p.party,
    },
    {
      key: "contractNo",
      header: "Гэрээ",
      width: 100,
      value: (p) => p.contractNo ?? p.docNo,
      render: (p) => (
        <span className="tnum">{p.contractNo ?? `${p.docNo} ${p.system}`}</span>
      ),
    },
    {
      key: "workName",
      header: "Ажил",
      value: (p) => p.workName ?? "",
      render: (p) => (
        <span
          className="block max-w-[240px] truncate"
          title={p.workName ?? undefined}
        >
          {p.workName ?? "—"}
        </span>
      ),
    },
    {
      key: "period",
      header: "Ажлын хугацаа",
      width: 160,
      value: (p) => p.workPeriodStart,
      render: (p) => (
        <span className="tnum">
          {p.workPeriodStart
            ? `${date(p.workPeriodStart)} – ${date(p.workPeriodEnd)}`
            : "—"}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Төлбөрийн дүн",
      align: "right",
      width: 140,
      value: (p) => p.amount,
      render: (p) => (
        <span
          style={{
            color: p.supersededBy ? "var(--text-muted)" : undefined,
            textDecoration: p.supersededBy ? "line-through" : undefined,
          }}
        >
          {mnt(p.amount)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Тайлбар",
      width: 150,
      value: (p) => (p.supersededBy ? 1 : 0),
      render: (p) =>
        p.supersededBy ? (
          <Badge>{p.supersededBy}-аар дахин гарсан</Badge>
        ) : p.amount == null ? (
          <Badge>дүн уншигдаагүй</Badge>
        ) : (
          ""
        ),
    },
  ];

  const largest = [...countedPayments].sort(
    (a, b) => (b.amount ?? 0) - (a.amount ?? 0),
  )[0];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Нийт санхүүжилт"
          value={`₮${compact(totalPaid)}`}
          sub={`${countedPayments.length} батлагдсан тайлан`}
          accent="var(--series-1)"
        />
        <StatTile
          label="Шүүлтийн дүн"
          value={`₮${compact(filteredTotal)}`}
          sub={`${filtered.length} тайлан харагдаж байна`}
          accent="var(--series-2)"
        />
        <StatTile
          label="Хамгийн том төлбөр"
          value={largest ? `₮${compact(largest.amount ?? 0)}` : "—"}
          sub={largest ? `${largest.party} · ${date(largest.date)}` : ""}
          accent="var(--series-3)"
        />
        <StatTile
          label="Давхардлаас хассан"
          value={`₮${compact(supersededTotal)}`}
          sub="UPC дугаараар анх гарсан 4 тайлан"
          tone="warning"
        />
      </div>

      <Card
        title="Санхүүжилтийн урсгал"
        subtitle="Шүүлтийн дагуу шинэчлэгдэнэ"
        right={
          <Legend
            items={[
              { label: "Сарын дүн", color: "var(--series-1)" },
              { label: "Хуримтлагдсан", color: "var(--series-2)" },
            ]}
          />
        }
      >
        <PaymentFlowChart rows={flowRows} height={250} />
      </Card>

      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <Card
          title="Тайлангийн төрлөөр"
          subtitle="Явцын (IPR), эцсийн (LPR), гүйцэтгэлийн (EPR/EC) тайлангийн сарын хуваарилалт"
          right={
            <Legend
              items={TYPE_ORDER.map((t) => ({
                label: t,
                color: TYPE_COLOR[t],
              }))}
            />
          }
        >
          <ColumnChart
            rows={typeRows}
            series={TYPE_ORDER.map((t) => ({
              key: t,
              label: TYPE_NAME[t],
              color: TYPE_COLOR[t],
            }))}
            format={(v) =>
              v >= 1e9 ? `${(v / 1e9).toFixed(1)}Т` : `${Math.round(v / 1e6)}С`
            }
            height={230}
          />
        </Card>

        <Card title="Гүйцэтгэгч тус бүрийн санхүүжилт">
          <RankBar
            rows={partyRank}
            format={(v) => `₮${compact(v)}`}
            height={280}
            valueLabel="Санхүүжсэн"
          />
          <Legend
            className="mt-3"
            items={CATEGORY_ORDER.map((c) => ({
              label: CATEGORY_SHORT[c] ?? c,
              color: categoryColor(c),
            }))}
          />
        </Card>
      </div>

      <Card
        title="Санхүүжилтийн тайлангийн дэвтэр"
        subtitle={`${payments.length} тайлан · дүн нь баримтын «Төлбөрийн хэмжээ» мөрөөс уншсан`}
        right={
          <div className="flex flex-wrap items-center gap-2 no-print">
            <SearchBox
              value={q}
              onChange={setQ}
              placeholder="Гүйцэтгэгч, ажлаар хайх…"
              className="w-52"
            />
            <Select
              value={party}
              onChange={setParty}
              options={[
                { value: ALL, label: "Бүх гүйцэтгэгч" },
                ...partyList.map((p) => ({ value: p, label: p })),
              ]}
            />
            <Select
              value={type}
              onChange={setType}
              options={[
                { value: ALL, label: "Бүх төрөл" },
                ...TYPE_ORDER.map((t) => ({ value: t, label: TYPE_NAME[t] })),
              ]}
            />
          </div>
        }
      >
        <DataTable
          rows={filtered}
          columns={columns}
          initialSort={{ key: "date", dir: "desc" }}
          pageSize={25}
        />
      </Card>

      <Card title="Тооцооллын аргачлал" subtitle="Дүн хэрхэн гарсныг шалгах">
        <ul
          className="space-y-2 text-xs leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          <li>
            <span
              className="font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              Эх сурвалж.{" "}
            </span>
            PDF файлууд бүгд сканнердсан зураг тул текст давхарга байхгүй.
            Тайлан бүрийн 2-р хуудасны «ДУНДЫН САНХҮҮЖИЛТИЙН ТАЙЛАН / INTERIM
            PERFORMANCE REPORT» хүснэгтээс «Төлбөрийн хэмжээ, ₮» мөрийг уншиж
            авсан. Гүйцэтгэлийн акт (EC) баримтын хувьд 1-р хуудасны «Нийт дүн
            /НӨАТ-тай/» мөрийг ашигласан.
          </li>
          <li>
            <span
              className="font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              Давхардал.{" "}
            </span>
            {Object.entries(meta.supersededNote)
              .map(([k, v]) => `${k}: ${v}`)
              .join("; ")}
            . Эдгээр {mnt(supersededTotal)}-ийг нийт дүнгээс хассан боловч
            дэвтэрт зураастай харуулсан.
          </li>
          <li>
            <span
              className="font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              Уншигдаагүй.{" "}
            </span>
            {payments.filter((p) => p.amount == null).length} тайланд хэвлэмэл
            дүн байхгүй (зөвхөн гар бичмэл), тиймээс тооцоонд оруулаагүй.
          </li>
          <li>
            <span
              className="font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              Гэрээтэй холбох.{" "}
            </span>
            Тайлан бүрийг файлын нэрэн дэх бүртгэлийн дугаараар (
            {num(contracts.length)} гэрээний) дугаартай тулгасан. Гэрээ нь
            архивт байхгүй {meta.orphanContractKeys.length} тайлан байна:{" "}
            {meta.orphanContractKeys.join(", ")}.
          </li>
        </ul>
      </Card>
    </div>
  );
}

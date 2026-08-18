"use client";

import React, { useMemo, useState } from "react";
import { Card, StatTile, Legend } from "@/components/chart-kit";
import { Toggles } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import {
  audit,
  coverage,
  spotCheck,
  meta,
  contracts,
  payments,
} from "@/lib/data";
import type { AuditIssue } from "@/lib/types";
import { compact, mnt, num, pct } from "@/lib/format";

const ALL = "__all__";

const SEV_COLOR: Record<string, string> = {
  ӨНДӨР: "var(--status-critical)",
  ДУНД: "var(--status-serious)",
  БАГА: "var(--status-warning)",
  МЭДЭЭЛЭЛ: "var(--series-1)",
};
const SEV_ICON: Record<string, string> = {
  ӨНДӨР: "✕",
  ДУНД: "▲",
  БАГА: "!",
  МЭДЭЭЛЭЛ: "i",
};

/** What each automated check actually asserts — so a reader can judge it. */
const CHECK_RULE: Record<string, string> = {
  "Гэрээнээс их санхүүжилт":
    "Хуримтлагдсан санхүүжилт гэрээний дүнгийн 102%-иас хэтэрсэн. Дүн буруу уншсан, эсвэл гэрээний үнэ нь нийт биш (сарын/нэгж) гэсэн шинж.",
  "Задаргаа нийт дүнтэй тохирохгүй":
    "Нийт дүн − урьдчилгаа − баталгаа − бусад суутгал ≠ тайлангийн төлбөрийн дүн.",
  "Дугаар ба огноо зөрчилтэй":
    "IPR-ийн дугаар өсөхөд огноо нь буурсан. Дугаарлалт эсвэл огноо алдаатай.",
  "Ижил дүн давтагдсан":
    "Нэг гэрээнд яг ижил дүн хоёр ба түүнээс олон удаа тохиолдсон. Ажлын хэмжээ давтагдсан байж болох ч давхар бүртгэлийг үгүйсгэх шаардлагатай.",
  "Гэрээ ба тайлангийн хугацаа зөрж байна":
    "Гэрээнд заасан дуусах огноо нь санхүүжилтийн тайланд хэвлэсэн «Гэрээний хугацаа»-наас өөр. Ихэвчлэн хугацаа сунгасны улмаас.",
  "Гэрээний дугаар нэг мөр биш":
    "Нэг гэрээнд өөр өөр бичиглэлтэй дугаар хэрэглэгдсэн (26/007 ба 26-007 гэх мэт).",
  "Гэрээний хугацаанаас хойш гарсан тайлан":
    "Тайлангийн огноо гэрээний дуусах хугацаанаас хойш. Хугацаа сунгасан эсвэл эцсийн тооцоо байж болно.",
  "Гэрээний дүн уншигдаагүй":
    "Баримтад нийт дүн хэвлээгүй (нэгж үнэт, баталгааны гэрээ гэх мэт). Тооцоонд ороогүй.",
  "Тайлангийн дүн уншигдаагүй":
    "Хэвлэмэл дүн байхгүй, зөвхөн гар бичмэл. Гар бичмэлийг тоон утга болгож аваагүй.",
  "Бүтэн тоо — нүдээр шалгах":
    "Дүн нь яг 100 сая-д хуваагдаж байна. Ихэвчлэн зөв боловч цифр орхигдсоны нийтлэг шинж тул нүдээр батлах нь зүйтэй.",
};

export default function Audit() {
  const [sev, setSev] = useState(ALL);

  const filtered = useMemo(
    () => (sev === ALL ? audit : audit.filter((a) => a.sev === sev)),
    [sev],
  );

  const grouped = useMemo(() => {
    const m = new Map<string, AuditIssue[]>();
    for (const a of filtered) {
      if (!m.has(a.check)) m.set(a.check, []);
      m.get(a.check)!.push(a);
    }
    return Array.from(m.entries());
  }, [filtered]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of audit) m[a.sev] = (m[a.sev] ?? 0) + 1;
    return m;
  }, []);

  const valuePct =
    (coverage.contractsWithValue / coverage.contractsTotal) * 100;
  const amountPct =
    (coverage.paymentsWithAmount / coverage.paymentsTotal) * 100;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Ноцтой зөрчил"
          value={num(counts["ӨНДӨР"] ?? 0)}
          sub="Тоо буруу байх магадлалтай"
          tone={(counts["ӨНДӨР"] ?? 0) > 0 ? "critical" : "good"}
        />
        <StatTile
          label="Шалгах шаардлагатай"
          value={num((counts["ДУНД"] ?? 0) + (counts["БАГА"] ?? 0))}
          sub="Ихэвчлэн эх баримтын өөрийнх нь зөрүү"
          tone="warning"
        />
        <StatTile
          label="Гэрээний дүн уншигдсан"
          value={`${coverage.contractsWithValue} / ${coverage.contractsTotal}`}
          sub={`${pct(valuePct, 0)} · үлдсэн нь нэгж үнэт буюу дүнгүй гэрээ`}
          accent="var(--series-1)"
        />
        <StatTile
          label="Тайлангийн дүн уншигдсан"
          value={`${coverage.paymentsWithAmount} / ${coverage.paymentsTotal}`}
          sub={`${pct(amountPct, 0)} · ${coverage.paymentsSuperseded} нь давхардлаас хассан`}
          accent="var(--series-2)"
        />
      </div>

      <Card
        title="Өгөгдөл хэрхэн шалгагдсан бэ"
        subtitle="Гурван түвшний шалгалт — тус бүр өөр төрлийн алдаа барьдаг"
      >
        <ol className="space-y-3 text-sm">
          <Step
            n={1}
            title="Хөндлөнгийн дахин унших (12 баримт)"
            body="Сонгосон 12 баримтын дүнг өөр процесс эх зурагнаас нь тусад нь дахин уншиж, энэ санд байгаа утгатай тулгасан. Бүх 12 дүн таарсан. Гурван зөрүү илэрсэн: Инсталл Наран гэрээний хугацаа (08.01 биш 09.30 — нэмэлт гэрээгээр сунгасан), болон 3 тайлангийн ажил гүйцэтгэсэн хугацаа хураангуй хуудсанд өдрөөр бичигдсэн байсныг нүүр хуудаснаас нөхсөн. Бүгд зассан."
          />
          <Step
            n={2}
            title="Дотоод логикийн шалгалт (доорх жагсаалт)"
            body="Эх баримт нээхгүйгээр 9 төрлийн шалгалт ажиллуулсан: гэрээнээс их санхүүжилт, задаргаа нийлэхгүй, дугаар–огнооны зөрчил, ижил дүн давтагдах, гэрээ ба тайлангийн хугацааны зөрүү, дугаарын бичиглэлийн зөрүү, хугацаанаас хойш гарсан тайлан, уншигдаагүй дүн, сэжигтэй бүтэн тоо."
          />
          <Step
            n={3}
            title="Арифметикийн тулгалт"
            body="Нийт дүн бүрийг эх мөрүүдээс дахин нийлбэрлэж шалгасан. Мөн нэг баримт хоёр хавтсанд байх, нэг ажил хоёр дугаараар тайлагнах давхардлыг тусад нь илрүүлж хассан."
          />
        </ol>
      </Card>

      <Card
        title="Дотоод шалгалтын үр дүн"
        subtitle={`${audit.length} тэмдэглэл. Ихэнх нь програмын алдаа биш — эх баримтууд хоорондоо зөрүүтэй байгааг заана.`}
        right={
          <div className="no-print">
            <Toggles
              value={sev}
              onChange={setSev}
              options={[
                { value: ALL, label: `Бүгд (${audit.length})` },
                ...["ӨНДӨР", "ДУНД", "БАГА", "МЭДЭЭЛЭЛ"]
                  .filter((s) => counts[s])
                  .map((s) => ({ value: s, label: `${s} (${counts[s]})` })),
              ]}
            />
          </div>
        }
      >
        <div className="space-y-4">
          {grouped.map(([check, rows]) => (
            <div key={check}>
              <div className="flex items-baseline gap-2">
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{ background: SEV_COLOR[rows[0].sev], color: "#fff" }}
                  aria-hidden
                >
                  {SEV_ICON[rows[0].sev]}
                </span>
                <h4 className="text-sm font-semibold">{check}</h4>
                <Badge>{rows.length}</Badge>
              </div>
              {CHECK_RULE[check] && (
                <p
                  className="mt-1 mb-1.5 pl-6 text-xs leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  {CHECK_RULE[check]}
                </p>
              )}
              <ul className="pl-6">
                {rows.map((r, i) => (
                  <li
                    key={i}
                    className="flex flex-wrap items-baseline gap-x-3 border-b py-1.5 text-xs last:border-0"
                    style={{ borderColor: "var(--grid)" }}
                  >
                    <span
                      className="min-w-[220px] font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {r.subject}
                    </span>
                    <span
                      className="flex-1"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {r.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {grouped.length === 0 && (
            <p
              className="py-6 text-center text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Энэ түвшинд тэмдэглэл алга.
            </p>
          )}
        </div>
        <Legend
          className="mt-4"
          items={[
            {
              label: "ӨНДӨР — тоо буруу байх магадлалтай",
              color: SEV_COLOR["ӨНДӨР"],
            },
            { label: "ДУНД — тулгах шаардлагатай", color: SEV_COLOR["ДУНД"] },
            { label: "БАГА — тайлбартай зөрүү", color: SEV_COLOR["БАГА"] },
            {
              label: "МЭДЭЭЛЭЛ — мэдэж байх зүйл",
              color: SEV_COLOR["МЭДЭЭЛЭЛ"],
            },
          ]}
        />
      </Card>

      <Card
        title="Гараар шалгах жагсаалт"
        subtitle="Хамгийн их дүнтэй 20 баримт. Эдгээрийг шалгавал нийт мөнгөн дүнгийн дийлэнхийг баталгаажуулна."
      >
        <div className="overflow-x-auto scroll">
          <table className="grid">
            <thead>
              <tr>
                <th style={{ width: 90 }}>Төрөл</th>
                <th style={{ width: 230 }}>Баримт</th>
                <th style={{ width: 130, textAlign: "right" }}>
                  Санд байгаа дүн
                </th>
                <th style={{ width: 250 }}>Хаанаас харах</th>
                <th>Файл</th>
              </tr>
            </thead>
            <tbody>
              {spotCheck.map((s, i) => (
                <tr key={i}>
                  <td>
                    <Badge>{s.kind}</Badge>
                    {s.flagged && (
                      <Badge
                        className="ml-1"
                        style={{
                          borderColor: "var(--status-warning)",
                          color: "var(--status-warning)",
                        }}
                      >
                        шалгалтад орсон
                      </Badge>
                    )}
                  </td>
                  <td className="strong">{s.label}</td>
                  <td className="tnum" style={{ textAlign: "right" }}>
                    {s.currency === "MNT"
                      ? mnt(s.value)
                      : `${num(s.value)} ${s.currency}`}
                  </td>
                  <td style={{ color: "var(--text-muted)" }}>{s.look}</td>
                  <td>
                    <span
                      className="block max-w-[420px] truncate"
                      title={s.path}
                    >
                      {s.path}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p
          className="mt-3 text-xs leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          Зам нь «{meta.sourceFolder}» хавтаснаас эхэлнэ. Дүн зөрвөл дашбоардын
          өгөгдлийг засах хэрэгтэй — доорх «Юуг итгэлтэй хэлж болох вэ» хэсгээс
          алийг нь машин уншсан, алийг нь файлын нэрнээс авсныг харна уу.
        </p>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card
          title="Юуг итгэлтэй хэлж болох вэ"
          subtitle="Талбар бүрийн эх сурвалж, найдвартай байдал"
        >
          <table className="grid">
            <thead>
              <tr>
                <th>Талбар</th>
                <th style={{ width: 150 }}>Эх сурвалж</th>
                <th style={{ width: 90 }}>Хамрах</th>
              </tr>
            </thead>
            <tbody>
              <Row
                f="Баримтын дугаар, төрөл, огноо, тал"
                s="Файлын нэр"
                c={`${coverage.documentsTotal} / ${coverage.documentsTotal}`}
                good
              />
              <Row
                f="Гэрээний дүн, валют, НӨАТ"
                s="PDF-ийн зураг"
                c={`${coverage.contractsWithValue} / ${coverage.contractsTotal}`}
              />
              <Row
                f="Санхүүжилтийн дүн"
                s="PDF-ийн зураг"
                c={`${coverage.paymentsWithAmount} / ${coverage.paymentsTotal}`}
                good
              />
              <Row
                f="Гэрээний хугацаа"
                s="PDF + тайлан"
                c={`${coverage.contractsWithPeriod} / ${coverage.contractsTotal}`}
              />
              <Row
                f="Ажил гүйцэтгэсэн хугацаа"
                s="PDF-ийн зураг"
                c={`${coverage.paymentsWithPeriod} / ${coverage.paymentsTotal}`}
              />
              <Row
                f="Урьдчилгаа %, баталгааны суутгал %"
                s="PDF-ийн зураг"
                c={`${contracts.filter((c) => c.advancePercent != null).length} / ${coverage.contractsTotal}`}
                weak
              />
              <Row f="Ажлын дэлгэрэнгүй задаргаа" s="Уншаагүй" c="0 / —" weak />
            </tbody>
          </table>
          <p
            className="mt-3 text-xs leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            <strong style={{ color: "var(--text-primary)" }}>Файлын нэр</strong>{" "}
            — бүрэн найдвартай, машин уншсан текст.{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              PDF-ийн зураг
            </strong>{" "}
            — сканнердсан хуудсыг дүрсээр уншсан; тоонууд тод хэвлэгдсэн тул
            найдвартай ч гараар шалгах боломжтой.{" "}
            <strong style={{ color: "var(--text-primary)" }}>Гар бичмэл</strong>{" "}
            — тоон утга болгож аваагүй, зөвхөн тайлбарт тэмдэглэсэн.
          </p>
        </Card>

        <Card
          title="Дахин боловсруулах"
          subtitle="Эх файл өөрчлөгдвөл дашбоардыг хэрхэн шинэчлэх вэ"
        >
          <ol
            className="space-y-2.5 text-xs leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            <li>
              <span
                className="font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                1. Гараар засах.
              </span>{" "}
              Ганц нэг тоо буруу бол <code>src/data/heiwa.json</code> дотор шууд
              засаад
              <code> npm run build</code> ажиллуулна. Бүх нийлбэр, хувь
              автоматаар дахин бодогдоно.
            </li>
            <li>
              <span
                className="font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                2. Шинэ баримт нэмэгдвэл.
              </span>{" "}
              Файлын нэрний бүтэц (дугаар · систем · төрөл · тал · огноо)
              хадгалагдсан байвал бүртгэл автоматаар барагдана; дүн нь PDF-ээс
              дахин уншигдах хэрэгтэй.
            </li>
            <li>
              <span
                className="font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                3. Дугаарлалтыг нэг мөр болгох.
              </span>{" "}
              Дээрх «Гэрээний дугаар нэг мөр биш» жагсаалт нь ирээдүйд автомат
              тулгалтыг хялбар болгох цэгүүд. UPC → BI шилжилтийг ч мөн адил.
            </li>
            <li>
              <span
                className="font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                4. Хамгийн үр дүнтэй сайжруулалт.
              </span>{" "}
              Санхүүжилтийн тайланг сканнердахаас өмнө Excel хувилбарыг нь хамт
              хадгалбал дүрс таних алхам бүрэн шаардлагагүй болно.
            </li>
          </ol>
          <div
            className="mt-4 rounded-lg border p-3 text-xs"
            style={{ borderColor: "var(--border-strong)" }}
          >
            <p className="font-medium" style={{ color: "var(--text-primary)" }}>
              Одоогийн байдлаар итгэлтэй хэлж болох зүйл
            </p>
            <p
              className="mt-1 leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              Санхүүжилтийн {coverage.paymentsWithAmount}/
              {coverage.paymentsTotal} тайлангийн дүн уншигдсан, нийт ₮
              {compact(
                payments
                  .filter((p) => p.counted)
                  .reduce((s, p) => s + (p.amount ?? 0), 0),
              )}
              . Ноцтой зөрчил
              {(counts["ӨНДӨР"] ?? 0) === 0
                ? " үлдээгүй"
                : ` ${counts["ӨНДӨР"]} байна`}
              . Үлдсэн тэмдэглэлүүд нь эх баримтын өөрийнх нь зөрүү (хугацаа
              сунгасан, дугаар өөр бичсэн) бөгөөд тус бүрд нь тайлбар
              хавсаргасан.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex gap-3">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
        style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}
      >
        {n}
      </span>
      <div>
        <div className="font-medium">{title}</div>
        <p
          className="mt-0.5 text-xs leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {body}
        </p>
      </div>
    </li>
  );
}

function Row({
  f,
  s,
  c,
  good,
  weak,
}: {
  f: string;
  s: string;
  c: string;
  good?: boolean;
  weak?: boolean;
}) {
  return (
    <tr>
      <td className="strong">{f}</td>
      <td>{s}</td>
      <td
        className="tnum"
        style={{
          color: good
            ? "var(--success-text)"
            : weak
              ? "var(--status-warning)"
              : undefined,
        }}
      >
        {c}
      </td>
    </tr>
  );
}

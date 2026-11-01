import React, { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { moderatorApi } from "../../api/moderatorApi.js";
import { tryApi } from "../../utils/shared/apiToast.js";
import { ModeratorPageHeader } from "./ModeratorPageHeader.jsx";
import { competencyLabel, formatHours, formatRate } from "../../utils/moderator/moderationLabels.js";

/**
 * /moderator/quality — KPI chất lượng AI (GET /api/moderator/quality/stats, cache 5 phút).
 * Màu series: slot 1–2 của bảng categorical đã kiểm định (blue / orange) — cùng thứ tự ở mọi biểu đồ.
 * Mọi tỉ lệ cùng thang 0–100% nên dùng chung 1 trục y.
 */
const SERIES_1 = "#2a78d6";
const SERIES_2 = "#eb6834";
const GRID = "rgba(148,163,184,0.22)";
const TICK = { fill: "#64748b", fontSize: 11, fontWeight: 600 };
const COMPETENCY_CHART_LIMIT = 10;

const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const inputClass = "h-[42px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-[#6E35E8] focus:outline-none";

/** Tỉ lệ 0–1 → % cho trục biểu đồ; null giữ null (Recharts vẽ đứt đoạn thay vì về 0 giả). */
/** Trục % tối thiểu 0–100, nới theo dữ liệu (flagRate có thể > 100% khi 1 phiên bị báo nhiều câu). */
const PCT_DOMAIN = [0, (max) => Math.max(100, Math.ceil(max / 25) * 25)];
const pct = (v) => (v === null || v === undefined ? null : Math.round(v * 1000) / 10);
const pctTooltip = (value) => (value === null || value === undefined ? "—" : `${value}%`);

/** `compact`: giá trị là cụm chữ (vd. "3 mới · 0 đang xử lý") — cỡ nhỏ hơn để không gãy dòng. */
function Tile({ label, value, hint, compact = false }) {
  return (
    <div className={card}>
      <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-2 font-extrabold tabular-nums text-slate-900 ${compact ? "text-lg leading-snug" : "text-2xl"}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function ChartCard({ title, subtitle, children, table }) {
  return (
    <section className={card}>
      <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
      {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      <div className="mt-4 h-72">{children}</div>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-bold text-[#6E35E8]">Xem dạng bảng</summary>
        <div className="mt-2 overflow-x-auto">{table}</div>
      </details>
    </section>
  );
}

function DataTable({ columns, rows }) {
  if (!rows.length) return <p className="text-xs text-slate-500">Chưa có dữ liệu.</p>;
  return (
    <table className="w-full text-left text-xs">
      <thead className="text-slate-500">
        <tr>{columns.map((c) => <th key={c.key} className={`py-1.5 pr-3 font-bold ${c.numeric ? "text-right" : ""}`}>{c.label}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-slate-100 text-slate-700">
            {columns.map((c) => (
              <td key={c.key} className={`py-1.5 pr-3 ${c.numeric ? "text-right tabular-nums" : ""}`}>{c.render ? c.render(r) : r[c.key]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const EmptyChart = () => (
  <div className="flex h-full items-center justify-center text-sm text-slate-500">Chưa có dữ liệu trong kỳ.</div>
);

export function ModeratorQuality() {
  const [range, setRange] = useState({ from: "", to: "" });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = {
      ...(range.from && { from: new Date(`${range.from}T00:00:00`).toISOString() }),
      ...(range.to && { to: new Date(`${range.to}T23:59:59`).toISOString() }),
    };
    const res = await tryApi(() => moderatorApi.getQualityStats(params), { fallback: "Không tải được số liệu chất lượng." });
    setLoading(false);
    if (res.success) setStats(res.stats);
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const weekly = (stats?.weeklyTrend ?? []).map((w) => ({ ...w, flag: pct(w.flagRate), approval: pct(w.approvalRate) }));
  const competencies = stats?.byCompetency ?? [];
  const competencyChart = competencies
    .filter((c) => c.flagCount > 0 || c.deprecated > 0)
    .slice(0, COMPETENCY_CHART_LIMIT)
    .map((c) => ({ ...c, name: competencyLabel(c.competencyId) }));
  const versions = (stats?.byPromptVersion ?? []).map((v) => ({ ...v, flag: pct(v.flagRate), approval: pct(v.approvalRate) }));

  return (
    <div className="space-y-5">
      <ModeratorPageHeader
        title="Chất lượng AI"
        subtitle="Mặc định 30 ngày gần nhất. Số liệu được làm mới mỗi 5 phút."
        actions={<>
          <label className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-widest text-slate-300">
            Từ ngày
            <input type="date" className={inputClass} value={range.from} max={range.to || undefined} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-widest text-slate-300">
            Đến ngày
            <input type="date" className={inputClass} value={range.to} min={range.from || undefined} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
          </label>
          {range.from || range.to ? (
            <button type="button" className="h-[42px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50" onClick={() => setRange({ from: "", to: "" })}>
              30 ngày gần nhất
            </button>
          ) : null}
        </>}
      />

      {loading && !stats ? <p className="text-sm text-slate-300">Đang tải…</p> : null}

      {stats ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Tỉ lệ duyệt" value={formatRate(stats.approvalRate)} hint="Duyệt / (duyệt + khai tử) trong kỳ" />
            <Tile label="Tỉ lệ duyệt sau sửa" value={formatRate(stats.editRate)} hint="Câu duyệt có chỉnh sửa / tổng câu duyệt" />
            <Tile label="Tỉ lệ bị báo" value={formatRate(stats.flagRate, 1)} hint="Báo cáo AI / phiên hoàn thành" />
            <Tile label="Chấm thiếu tiêu chí" value={formatRate(stats.incompleteEvalRate, 1)} hint="Câu chấm thiếu / tổng câu được chấm" />
            <Tile
              label="Đồng thuận AI – moderator"
              value={formatRate(stats.aiModeratorAgreement)}
              hint={`Lệch ≤ 0.5 điểm · ${stats.overrides} lần chấm lại · lệch TB ${stats.meanAbsoluteDiff ?? "—"}`}
            />
            <Tile
              label="Ngân hàng câu hỏi"
              compact
              value={`${stats.bank.byStatus.pending_review} chờ duyệt`}
              hint={`${stats.bank.pendingOver7d} câu chờ quá 7 ngày · ${stats.bank.byStatus.approved} đã duyệt · ${stats.bank.byStatus.deprecated} khai tử`}
            />
            <Tile
              label="Hàng đợi"
              compact
              value={`${stats.queue.open} mới · ${stats.queue.inReview} đang xử lý`}
              hint={`${stats.queue.resolvedInPeriod} mục xử lý xong trong kỳ`}
            />
            <Tile label="Thời gian xử lý (trung vị)" value={formatHours(stats.queue.medianTimeToResolveHours)} hint="Từ lúc tạo tới lúc xử lý xong" />
          </div>

          <ChartCard
            title="Xu hướng theo tuần"
            subtitle="Tỉ lệ bị báo và tỉ lệ duyệt, theo tuần bắt đầu thứ Hai"
            table={
              <DataTable
                rows={weekly}
                columns={[
                  { key: "week", label: "Tuần" },
                  { key: "flag", label: "Tỉ lệ bị báo", numeric: true, render: (r) => formatRate(r.flagRate, 1) },
                  { key: "approval", label: "Tỉ lệ duyệt", numeric: true, render: (r) => formatRate(r.approvalRate) },
                  { key: "reports", label: "Báo cáo", numeric: true },
                  { key: "completedSessions", label: "Phiên hoàn thành", numeric: true },
                ]}
              />
            }
          >
            {weekly.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weekly} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
                  <XAxis dataKey="week" axisLine={false} tickLine={false} tick={TICK} />
                  <YAxis axisLine={false} tickLine={false} tick={TICK} unit="%" domain={PCT_DOMAIN} width={48} />
                  <Tooltip formatter={pctTooltip} labelFormatter={(w) => `Tuần ${w}`} />
                  <Legend />
                  <Line isAnimationActive={false} type="monotone" dataKey="flag" name="Tỉ lệ bị báo" stroke={SERIES_1} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls={false} />
                  <Line isAnimationActive={false} type="monotone" dataKey="approval" name="Tỉ lệ duyệt" stroke={SERIES_2} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </ChartCard>

          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard
              title="Theo năng lực"
              subtitle={`Số lần bị báo và số câu khai tử — ${COMPETENCY_CHART_LIMIT} năng lực có vấn đề nhiều nhất`}
              table={
                <DataTable
                  rows={competencies}
                  columns={[
                    { key: "competencyId", label: "Năng lực", render: (r) => competencyLabel(r.competencyId) },
                    { key: "flagCount", label: "Bị báo", numeric: true },
                    { key: "deprecated", label: "Khai tử", numeric: true },
                    { key: "total", label: "Tổng câu", numeric: true },
                  ]}
                />
              }
            >
              {competencyChart.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={competencyChart} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID} />
                    <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={TICK} />
                    <YAxis type="category" dataKey="name" width={170} axisLine={false} tickLine={false} tick={{ ...TICK, fontSize: 10 }} />
                    <Tooltip cursor={{ fill: "rgba(110,53,232,0.06)" }} />
                    <Legend />
                    <Bar isAnimationActive={false} dataKey="flagCount" name="Bị báo" fill={SERIES_1} radius={[0, 4, 4, 0]} maxBarSize={14} />
                    <Bar isAnimationActive={false} dataKey="deprecated" name="Khai tử" fill={SERIES_2} radius={[0, 4, 4, 0]} maxBarSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            <ChartCard
              title="Theo phiên bản prompt"
              subtitle="Chỉ báo prompt drift: tỉ lệ bị báo / tỉ lệ duyệt theo từng version"
              table={
                <DataTable
                  rows={versions}
                  columns={[
                    { key: "promptVersion", label: "Prompt version" },
                    { key: "flag", label: "Tỉ lệ bị báo", numeric: true, render: (r) => formatRate(r.flagRate, 1) },
                    { key: "approval", label: "Tỉ lệ duyệt", numeric: true, render: (r) => formatRate(r.approvalRate) },
                    { key: "reports", label: "Báo cáo", numeric: true },
                  ]}
                />
              }
            >
              {versions.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={versions} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
                    <XAxis dataKey="promptVersion" axisLine={false} tickLine={false} tick={TICK} />
                    <YAxis axisLine={false} tickLine={false} tick={TICK} unit="%" domain={PCT_DOMAIN} width={48} />
                    <Tooltip formatter={pctTooltip} cursor={{ fill: "rgba(110,53,232,0.06)" }} />
                    <Legend />
                    <Bar isAnimationActive={false} dataKey="flag" name="Tỉ lệ bị báo" fill={SERIES_1} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Bar isAnimationActive={false} dataKey="approval" name="Tỉ lệ duyệt" fill={SERIES_2} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>
          </div>
        </>
      ) : null}
    </div>
  );
}

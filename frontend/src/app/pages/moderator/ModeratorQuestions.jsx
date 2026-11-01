import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Flag, Pencil, Plus, Search, XCircle } from "lucide-react";
import { moderatorApi } from "../../api/moderatorApi.js";
import { tryApi } from "../../utils/shared/apiToast.js";
import { ModeratorPageHeader } from "./ModeratorPageHeader.jsx";
import { AdminFilterSelect, AdminListFilterBar } from "../../components/admin/AdminListFilters.jsx";
import { AppSelect } from "../../components/ui/AppSelect";
import {
  COMPETENCIES,
  QUESTION_SOURCE,
  QUESTION_STATUS,
  SCORE_DIMENSIONS,
  competencyLabel,
  formatDateTime,
} from "../../utils/moderator/moderationLabels.js";

const STATUS_OPTIONS = [
  { id: "all", label: "Tất cả" },
  ...Object.entries(QUESTION_STATUS).map(([id, s]) => ({ id, label: s.label })),
];
const SOURCE_OPTIONS = [{ id: "all", label: "Tất cả" }, ...Object.entries(QUESTION_SOURCE).map(([id, label]) => ({ id, label }))];
const COMPETENCY_OPTIONS = [{ id: "all", label: "Tất cả" }, ...COMPETENCIES];
const SORT_OPTIONS = [
  { id: "flagCount", label: "Bị báo nhiều nhất" },
  { id: "usageCount", label: "Dùng nhiều nhất" },
  { id: "updatedAt", label: "Mới cập nhật" },
];
const DEFAULT_FILTERS = { status: "pending_review", competencyId: "all", source: "all", q: "", sort: "flagCount" };
const PAGE_SIZE = 20;

const card = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const btn = "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors disabled:opacity-50";
const btnPrimary = `${btn} bg-[#6E35E8] text-white hover:bg-[#5b2bc4]`;
const btnGhost = `${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
const btnDanger = `${btn} border border-red-200 bg-red-50 text-red-700 hover:bg-red-100`;
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#6E35E8] focus:outline-none";

function StatusBadge({ status }) {
  const s = QUESTION_STATUS[status] ?? { label: status, className: "bg-slate-100 text-slate-600 border-slate-200" };
  return <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold ${s.className}`}>{s.label}</span>;
}

/** Ô nhập lý do bắt buộc (sửa / khai tử) — xác nhận chỉ bật khi đã có lý do. */
function ReasonForm({ label, confirmLabel, danger, busy, onConfirm, onCancel }) {
  const [reason, setReason] = useState("");
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <label className="block text-xs font-bold text-slate-600">
        {label}
        <textarea className={`${inputClass} mt-1`} rows={2} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
      </label>
      <div className="flex gap-2">
        <button type="button" className={danger ? btnDanger : btnPrimary} disabled={busy || reason.trim().length < 3} onClick={() => onConfirm(reason.trim())}>
          {confirmLabel}
        </button>
        <button type="button" className={btnGhost} onClick={onCancel}>Huỷ</button>
      </div>
    </div>
  );
}

function QuestionDetail({ id, onChanged }) {
  const [data, setData] = useState(null);
  const [mode, setMode] = useState(null); // null | "edit" | "deprecate"
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ text: "", competencyId: "" });

  const load = useCallback(async () => {
    const res = await tryApi(() => moderatorApi.getQuestion(id), { fallback: "Không tải được chi tiết câu hỏi." });
    if (res.success) {
      setData(res);
      setDraft({ text: res.question.text, competencyId: res.question.competencyId || "" });
    }
  }, [id]);

  useEffect(() => {
    setMode(null);
    setData(null);
    load();
  }, [load]);

  const act = async (fn, successMessage) => {
    setBusy(true);
    const res = await tryApi(fn, { successMessage });
    setBusy(false);
    if (res.success) {
      setMode(null);
      await load();
      onChanged?.();
    }
  };

  if (!data) return <div className={`${card} p-6 text-sm text-slate-500`}>Đang tải…</div>;
  const q = data.question;

  return (
    <div className={`${card} space-y-4 p-5`}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={q.status} />
        <span className="text-xs text-slate-500">{QUESTION_SOURCE[q.source] ?? q.source}</span>
        <span className="text-xs text-slate-500">· Dùng {q.usageCount ?? 0} lần</span>
        <span className="inline-flex items-center gap-1 text-xs text-red-600"><Flag className="size-3" />{q.flagCount ?? 0}</span>
      </div>

      {mode === "edit" ? (
        <div className="space-y-2">
          <textarea className={inputClass} rows={4} value={draft.text} maxLength={500} onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))} />
          <AppSelect
            value={draft.competencyId}
            onValueChange={(v) => setDraft((d) => ({ ...d, competencyId: v }))}
            options={COMPETENCIES.map((c) => ({ value: c.id, label: c.label }))}
            aria-label="Năng lực"
          />
          <ReasonForm
            label="Lý do sửa (bắt buộc)"
            confirmLabel="Lưu thay đổi"
            busy={busy}
            onCancel={() => setMode(null)}
            onConfirm={(reason) =>
              act(
                () => moderatorApi.editQuestion(id, {
                  ...(draft.text.trim() !== q.text && { text: draft.text.trim() }),
                  ...(draft.competencyId !== q.competencyId && { competencyId: draft.competencyId }),
                  reason,
                }),
                "Đã sửa câu hỏi.",
              )
            }
          />
        </div>
      ) : (
        <div>
          <p className="text-[15px] font-semibold leading-relaxed text-slate-900">{q.text}</p>
          <p className="mt-1 text-xs text-slate-500">{competencyLabel(q.competencyId)}</p>
          {q.originalText && q.originalText !== q.text ? (
            <p className="mt-2 text-xs text-slate-500">Bản gốc: <span className="italic">{q.originalText}</span></p>
          ) : null}
        </div>
      )}

      {mode === "deprecate" ? (
        <ReasonForm
          label="Lý do khai tử (bắt buộc)"
          confirmLabel="Khai tử"
          danger
          busy={busy}
          onCancel={() => setMode(null)}
          onConfirm={(reason) => act(() => moderatorApi.deprecateQuestion(id, reason), "Đã khai tử câu hỏi.")}
        />
      ) : null}

      {mode === null ? (
        <div className="flex flex-wrap gap-2">
          {q.status !== "approved" ? (
            <button type="button" className={btnPrimary} disabled={busy} onClick={() => act(() => moderatorApi.approveQuestion(id), "Đã duyệt câu hỏi.")}>
              <CheckCircle2 className="size-4" /> Duyệt
            </button>
          ) : null}
          <button type="button" className={btnGhost} onClick={() => setMode("edit")}><Pencil className="size-4" /> Sửa</button>
          {q.status !== "deprecated" ? (
            <button type="button" className={btnDanger} onClick={() => setMode("deprecate")}><XCircle className="size-4" /> Khai tử</button>
          ) : null}
        </div>
      ) : null}

      {q.revisions?.length ? (
        <section>
          <h3 className="mb-2 text-[11px] font-black uppercase tracking-widest text-slate-500">Lịch sử sửa</h3>
          <ol className="space-y-2">
            {q.revisions.map((r, i) => (
              <li key={i} className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                <p className="font-semibold">{r.text}</p>
                <p className="mt-1 text-slate-500">{formatDateTime(r.editedAt)} · Lý do: {r.reason || "—"}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section>
        <h3 className="mb-2 text-[11px] font-black uppercase tracking-widest text-slate-500">Phiên mẫu ({data.samples.length})</h3>
        {data.samples.length === 0 ? <p className="text-xs text-slate-500">Chưa có phiên nào dùng câu này.</p> : null}
        <ul className="space-y-2">
          {data.samples.map((s) => (
            <li key={String(s.sessionId)} className="rounded-xl border border-slate-100 p-3 text-xs">
              <p className="text-slate-500">{formatDateTime(s.createdAt)}</p>
              <p className="mt-1 whitespace-pre-line text-slate-800">{s.transcript || "(Không có câu trả lời)"}</p>
              {s.aiEvaluation ? (
                <p className="mt-2 text-slate-600">
                  AI: <b>{s.aiEvaluation.overall ?? "—"}/5</b>{" "}
                  {SCORE_DIMENSIONS.map((d) => `${d.label} ${s.aiEvaluation.scores?.[d.id] ?? "—"}`).join(" · ")}
                </p>
              ) : null}
              {s.moderatorOverride ? <p className="mt-1 text-[#6E35E8]">Moderator: <b>{s.moderatorOverride.overall}/5</b></p> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function CreateQuestionForm({ onCreated, onCancel }) {
  const [text, setText] = useState("");
  const [competencyId, setCompetencyId] = useState("problem_solving");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const res = await tryApi(() => moderatorApi.createQuestion({ text: text.trim(), competencyId }), { successMessage: "Đã thêm câu hỏi (đã duyệt)." });
    setBusy(false);
    if (res.success) onCreated(res.question);
  };
  return (
    <div className={`${card} space-y-2 p-4`}>
      <textarea className={inputClass} rows={3} placeholder="Nội dung câu hỏi (10–500 ký tự)" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} />
      <AppSelect value={competencyId} onValueChange={setCompetencyId} options={COMPETENCIES.map((c) => ({ value: c.id, label: c.label }))} aria-label="Năng lực" />
      <div className="flex gap-2">
        <button type="button" className={btnPrimary} disabled={busy || text.trim().length < 10} onClick={submit}>Thêm câu hỏi</button>
        <button type="button" className={btnGhost} onClick={onCancel}>Huỷ</button>
      </div>
    </div>
  );
}

export function ModeratorQuestions() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [checked, setChecked] = useState(() => new Set());
  const [bulkDeprecate, setBulkDeprecate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await tryApi(() => moderatorApi.listQuestions({ ...filters, page, limit: PAGE_SIZE }), {
      fallback: "Không tải được ngân hàng câu hỏi.",
    });
    setLoading(false);
    if (res.success) {
      setRows(res.questions ?? []);
      setPagination(res.pagination ?? null);
    }
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Gõ tìm kiếm → đợi 300ms rồi mới lọc, tránh gọi API mỗi phím.
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setFilters((f) => (f.q === search.trim() ? f : { ...f, q: search.trim() }));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const setFilter = (key) => (value) => {
    setPage(1);
    setChecked(new Set());
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const toggle = (id) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allChecked = rows.length > 0 && rows.every((r) => checked.has(r._id));
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(rows.map((r) => r._id)));

  const runBulk = async (action, reason = "") => {
    setBusy(true);
    const res = await tryApi(() => moderatorApi.bulkQuestions([...checked], action, reason), {
      successMessage: action === "approve" ? "Đã duyệt các câu đã chọn." : "Đã khai tử các câu đã chọn.",
    });
    setBusy(false);
    if (res.success) {
      setChecked(new Set());
      setBulkDeprecate(false);
      load();
    }
  };

  const showReset = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <div className="space-y-4">
      <ModeratorPageHeader
        title="Ngân hàng câu hỏi"
        subtitle="Câu follow-up do AI sinh được thu vào đây để kiểm định sau buổi phỏng vấn."
        actions={<button type="button" className={btnPrimary} onClick={() => setCreating((v) => !v)}><Plus className="size-4" /> Thêm câu hỏi</button>}
      />

      {creating ? <CreateQuestionForm onCancel={() => setCreating(false)} onCreated={(q) => { setCreating(false); setSelectedId(q._id); load(); }} /> : null}

      <AdminListFilterBar
        countText={pagination ? `${pagination.total} câu` : ""}
        showReset={showReset}
        onReset={() => { setSearch(""); setPage(1); setFilters(DEFAULT_FILTERS); }}
      >
        <AdminFilterSelect id="mq-status" label="Trạng thái" value={filters.status} options={STATUS_OPTIONS} onChange={setFilter("status")} />
        <AdminFilterSelect id="mq-competency" label="Năng lực" value={filters.competencyId} options={COMPETENCY_OPTIONS} onChange={setFilter("competencyId")} />
        <AdminFilterSelect id="mq-source" label="Nguồn" value={filters.source} options={SOURCE_OPTIONS} onChange={setFilter("source")} />
        <AdminFilterSelect id="mq-sort" label="Sắp xếp" value={filters.sort} options={SORT_OPTIONS} onChange={setFilter("sort")} />
        <div className="flex min-w-[14rem] flex-col gap-1">
          <label htmlFor="mq-search" className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tìm nội dung</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input id="mq-search" className={`${inputClass} h-[42px] pl-9`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nhập từ khoá…" />
          </div>
        </div>
      </AdminListFilterBar>

      {checked.size > 0 ? (
        <div className={`${card} flex flex-wrap items-center gap-2 p-3`}>
          <span className="text-sm font-semibold text-slate-700">Đã chọn {checked.size} câu</span>
          <button type="button" className={btnPrimary} disabled={busy} onClick={() => runBulk("approve")}>Duyệt tất cả</button>
          <button type="button" className={btnDanger} disabled={busy} onClick={() => setBulkDeprecate(true)}>Khai tử tất cả</button>
          <button type="button" className={btnGhost} onClick={() => setChecked(new Set())}>Bỏ chọn</button>
          {bulkDeprecate ? (
            <div className="w-full">
              <ReasonForm label="Lý do khai tử (bắt buộc)" confirmLabel={`Khai tử ${checked.size} câu`} danger busy={busy} onCancel={() => setBulkDeprecate(false)} onConfirm={(reason) => runBulk("deprecate", reason)} />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="w-10 px-3 py-3"><input type="checkbox" aria-label="Chọn tất cả" checked={allChecked} onChange={toggleAll} /></th>
                  <th className="px-3 py-3">Câu hỏi</th>
                  <th className="px-3 py-3">Trạng thái</th>
                  <th className="px-3 py-3 text-right">Cờ</th>
                  <th className="px-3 py-3 text-right">Dùng</th>
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">Đang tải…</td></tr>
                ) : null}
                {!loading && rows.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">Không có câu hỏi nào khớp bộ lọc.</td></tr>
                ) : null}
                {rows.map((r) => (
                  <tr
                    key={r._id}
                    className={`cursor-pointer border-t border-slate-100 hover:bg-violet-50/40 ${selectedId === r._id ? "bg-violet-50/70" : ""}`}
                    onClick={() => setSelectedId(r._id)}
                  >
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label="Chọn câu" checked={checked.has(r._id)} onChange={() => toggle(r._id)} />
                    </td>
                    <td className="px-3 py-3">
                      <p className="line-clamp-2 font-medium text-slate-900">{r.text}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{competencyLabel(r.competencyId)} · {QUESTION_SOURCE[r.source] ?? r.source}</p>
                    </td>
                    <td className="px-3 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-red-600">{r.flagCount ?? 0}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700">{r.usageCount ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination && pagination.totalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
              <span>Trang {pagination.page}/{pagination.totalPages}</span>
              <div className="flex gap-2">
                <button type="button" className={btnGhost} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Trước</button>
                <button type="button" className={btnGhost} disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Sau</button>
              </div>
            </div>
          ) : null}
        </div>

        <div>
          {selectedId ? (
            <QuestionDetail id={selectedId} onChanged={load} />
          ) : (
            <div className={`${card} p-6 text-sm text-slate-500`}>Chọn một câu hỏi để xem chi tiết, sửa, duyệt hoặc khai tử.</div>
          )}
        </div>
      </div>
    </div>
  );
}

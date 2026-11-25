import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { moderatorApi } from "../../api/moderatorApi.js";
import { competenciesApi } from "../../api/competenciesApi.js";
import { toastApiSuccess } from "../../utils/shared/apiToast.js";
import { ModeratorPageHeader } from "./ModeratorPageHeader.jsx";
import {
  AI_IMPROVEMENT_TABS,
  REVIEW_ACTIONS,
  backtestBadge,
  confirmText,
  evidenceText,
  formatDateTime,
  formatExampleOutput,
  groupLabel,
  isAnchorExample,
  isAutoRejected,
  isBacktestRunning,
  kindLabel,
  maeChangeText,
  newExamples,
  reviewNoteError,
  statRows,
  statusBadge,
  targetLabel,
} from "../../utils/moderator/aiImprovements.js";

/**
 * AI-06: Platform Moderator xem, duyệt, từ chối, rollback đề xuất cải tiến AI ("Learning from Reviews").
 * API AI-05 (`/api/moderator/ai-improvements`), backtest AI-04 trên bộ 20 câu chuẩn AI-01 và câu trả lời cũ,
 * đề xuất ví dụ neo từ rubric công ty AI-18.
 */
const PAGE_SIZE = 20;
const POLL_MS = 5000;
const POLL_MAX = 60; // ~5 phút

const TONE = {
  success: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  info: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  warning: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  error: "border-red-400/30 bg-red-500/10 text-red-300",
  neutral: "border-white/15 bg-white/5 text-slate-300",
};
const TREND = { better: "text-emerald-300", worse: "text-amber-300", same: "text-slate-300" };

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#93f72b]";
const BTN = {
  primary: `${BTN_BASE} h-10 px-5 text-sm border border-[#b8ff78] bg-[#93f72b] text-[#131f00] hover:bg-[#a8ff4e]`,
  secondary: `${BTN_BASE} h-10 px-5 text-sm border border-white/15 bg-white/5 text-white hover:border-violet-400/60 hover:bg-white/10`,
  danger: `${BTN_BASE} h-10 px-5 text-sm border border-red-400/40 text-red-300 hover:bg-red-500/10`,
  small: `${BTN_BASE} h-8 px-3 text-xs border border-white/15 bg-white/5 text-white hover:border-violet-400/60 hover:bg-white/10`,
};

function Badge({ tone = "neutral", children }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${TONE[tone] ?? TONE.neutral}`}>
      {children}
    </span>
  );
}

export function ModeratorAiImprovements() {
  const [tab, setTab] = useState("proposed");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ proposals: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [competencyNames, setCompetencyNames] = useState({});
  const [openId, setOpenId] = useState("");

  useEffect(() => {
    competenciesApi.getFramework().then((res) => {
      if (res?.success) setCompetencyNames(Object.fromEntries((res.framework?.competencies || []).map((c) => [c.key, c.nameVi])));
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await moderatorApi.listAiImprovements({ status: tab, page, limit: PAGE_SIZE });
    if (res.success) setData({ proposals: res.proposals || [], total: res.total || 0 });
    else setError(res.error || "Không tải được danh sách đề xuất.");
    setLoading(false);
  }, [tab, page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const firstLoad = loading && !data.proposals.length;

  return (
    <div className="space-y-5">
      <ModeratorPageHeader
        title="Cải tiến AI"
        subtitle="Đề xuất sửa prompt rút ra từ các lượt kiểm duyệt và rubric doanh nghiệp. Xem bằng chứng và kết quả chấm thử trên bộ 20 câu chuẩn trước khi bật."
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Lọc theo trạng thái">
          {AI_IMPROVEMENT_TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-button-surface="none"
                onClick={() => {
                  setTab(t.id);
                  setPage(1);
                }}
                className={`${BTN_BASE} h-8 px-3 text-xs ${
                  active ? "is-active border border-[#b8ff78] bg-[#93f72b] text-[#131f00]" : "border border-white/15 bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <button type="button" data-button-surface="none" onClick={load} className={`${BTN.small} ml-auto`}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} aria-hidden />
          Tải lại
        </button>
      </div>

      <section className="rounded-[20px] border border-white/10 bg-[#18113c]/80 backdrop-blur-xl">
        {error ? (
          <div role="alert" className="m-5 flex flex-col gap-3 rounded-[12px] border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-300 sm:flex-row sm:items-center">
            <span className="inline-flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" aria-hidden />
              {error}
            </span>
            <button type="button" data-button-surface="none" onClick={load} className={`${BTN.small} sm:ml-auto`}>
              Thử lại
            </button>
          </div>
        ) : firstLoad ? (
          <div role="status" className="space-y-3 p-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-[12px] bg-white/10" />
            ))}
            <span className="sr-only">Đang tải…</span>
          </div>
        ) : data.proposals.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-12 text-center">
            <Sparkles size={36} className="text-[#c4b5fd]" aria-hidden />
            <h3 className="mt-3 text-base font-bold text-white">Chưa có đề xuất nào</h3>
            <p className="mt-1 max-w-md text-sm text-slate-400">
              Hệ thống tự tạo đề xuất mỗi ngày khi một nhóm năng lực có đủ 5 lượt chấm lại, hoặc khi ≥ 3 doanh nghiệp có rubric đã duyệt cho cùng năng lực.
            </p>
            {tab !== "all" ? (
              <button type="button" data-button-surface="none" onClick={() => setTab("all")} className={`${BTN.secondary} mt-4`}>
                Xem tất cả đề xuất
              </button>
            ) : null}
          </div>
        ) : (
          <>
            {loading ? <p className="px-5 pt-3 text-xs font-semibold text-slate-400">Đang tải…</p> : null}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-white/10 text-xs font-black uppercase tracking-wider text-slate-500">
                  <tr>
                    <th scope="col" className="px-5 py-3">Nhóm</th>
                    <th scope="col" className="px-3 py-3">Bằng chứng</th>
                    <th scope="col" className="px-3 py-3">Version</th>
                    <th scope="col" className="px-3 py-3">Backtest AI-01</th>
                    <th scope="col" className="px-3 py-3">Trạng thái</th>
                    <th scope="col" className="px-5 py-3 text-right">
                      <span className="sr-only">Thao tác</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {data.proposals.map((p) => {
                    const bt = backtestBadge(p.backtest);
                    const st = statusBadge(p.status);
                    return (
                      <tr key={p._id} className="align-top">
                        <td className="px-5 py-3">
                          <p className="font-bold text-white">{groupLabel(p, competencyNames)}</p>
                          <p className="mt-0.5 text-xs font-semibold text-slate-400">
                            {kindLabel(p.kind)} · {targetLabel(p.target)}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-slate-300">
                          <span className="inline-flex items-center gap-1.5">
                            {p.kind === "rubric_anchor" ? <Building2 size={14} className="shrink-0 text-[#c4b5fd]" aria-hidden /> : null}
                            {evidenceText(p)}
                          </span>
                          <p className="mt-0.5 text-xs font-semibold text-slate-400">{formatDateTime(p.createdAt)}</p>
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums text-slate-300">
                            {p.before?.version || "—"}
                            <ArrowRight size={14} className="shrink-0 text-slate-500" aria-hidden />
                            {p.after?.version || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone={bt.tone}>
                            {bt.running ? <Loader2 size={12} className="animate-spin" aria-hidden /> : null}
                            {bt.label}
                          </Badge>
                          {p.backtest?.status === "done" ? (
                            <p className="mt-1 text-xs font-semibold tabular-nums text-slate-400">Lệch TB {maeChangeText(p.backtest)}</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone={st.tone}>{st.label}</Badge>
                          {isAutoRejected(p) ? <p className="mt-1 text-xs font-semibold text-slate-400">Hệ thống tự loại</p> : null}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button type="button" data-button-surface="none" onClick={() => setOpenId(p._id)} className={BTN.small}>
                            Xem chi tiết
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 ? (
              <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-3 text-xs font-semibold text-slate-400">
                <button
                  type="button"
                  data-button-surface="none"
                  aria-label="Trang trước"
                  disabled={page <= 1}
                  onClick={() => setPage((n) => n - 1)}
                  className={`${BTN_BASE} h-10 w-10 border border-white/15 bg-white/5 text-white`}
                >
                  <ChevronLeft size={16} aria-hidden />
                </button>
                <span className="tabular-nums">
                  Trang {page}/{totalPages}
                </span>
                <button
                  type="button"
                  data-button-surface="none"
                  aria-label="Trang sau"
                  disabled={page >= totalPages}
                  onClick={() => setPage((n) => n + 1)}
                  className={`${BTN_BASE} h-10 w-10 border border-white/15 bg-white/5 text-white`}
                >
                  <ChevronRight size={16} aria-hidden />
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>

      {openId ? (
        <ProposalDialog
          id={openId}
          competencyNames={competencyNames}
          onClose={() => setOpenId("")}
          onChanged={load}
        />
      ) : null}
    </div>
  );
}

// ── Chi tiết + thao tác ───────────────────────────────────────────────────────────────────────

function ProposalDialog({ id, competencyNames, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(""); // action đang chờ xác nhận
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const pollRef = useRef({ timer: null, count: 0 });

  const fetchDetail = useCallback(async () => {
    const res = await moderatorApi.getAiImprovement(id);
    if (res.success) {
      setDetail(res);
      setError("");
    } else setError(res.error || "Không tải được đề xuất.");
    return res;
  }, [id]);

  // Backtest đang chạy → tải lại mỗi 5 giây tới khi xong.
  const schedulePoll = useCallback(() => {
    clearTimeout(pollRef.current.timer);
    pollRef.current.timer = setTimeout(async () => {
      pollRef.current.count += 1;
      const res = await fetchDetail();
      if (res.success && isBacktestRunning(res.proposal?.backtest) && pollRef.current.count < POLL_MAX) schedulePoll();
      else if (res.success) onChanged();
    }, POLL_MS);
  }, [fetchDetail, onChanged]);

  useEffect(() => {
    fetchDetail().then((res) => {
      if (res.success && isBacktestRunning(res.proposal?.backtest)) schedulePoll();
    });
    const poll = pollRef.current;
    return () => clearTimeout(poll.timer);
  }, [fetchDetail, schedulePoll]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape" || busy) return;
      if (pending) setPending("");
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, pending, onClose]);

  const startAction = (action) => {
    setPending(action);
    setNote("");
    setActionError("");
  };

  const submitAction = async () => {
    const noteError = reviewNoteError(pending, note);
    if (noteError) {
      setActionError(noteError);
      return;
    }
    setBusy(true);
    const res = await moderatorApi.reviewAiImprovement(id, { action: pending, note });
    setBusy(false);
    if (!res.success) {
      // Lỗi hiện tại chỗ (giữ ghi chú đã nhập), không toast.
      setActionError(res.error || "Không thực hiện được thao tác.");
      return;
    }
    toastApiSuccess(REVIEW_ACTIONS[pending].done);
    setPending("");
    await fetchDetail();
    onChanged();
  };

  const runBacktest = async () => {
    setBusy(true);
    setActionError("");
    const res = await moderatorApi.backtestAiImprovement(id);
    setBusy(false);
    if (!res.success) {
      setActionError(res.error || "Không chạy được backtest.");
      return;
    }
    setDetail((d) => (d ? { ...d, proposal: { ...d.proposal, backtest: res.backtest } } : d));
    pollRef.current.count = 0;
    schedulePoll();
    onChanged();
  };

  const p = detail?.proposal;
  const actions = detail?.actions ?? {};
  const bt = p?.backtest;
  const running = isBacktestRunning(bt);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-improvement-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-t-[24px] border border-white/10 bg-[#18113c] p-5 sm:rounded-[24px] sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="ai-improvement-title" className="text-lg font-black text-white">
              {p ? `${kindLabel(p.kind)}: ${groupLabel(p, competencyNames)}` : "Đề xuất cải tiến AI"}
            </h2>
            {p ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge tone={statusBadge(p.status).tone}>{statusBadge(p.status).label}</Badge>
                <Badge tone="info">{targetLabel(p.target)}</Badge>
                <span className="text-xs font-semibold text-slate-400">
                  Đang chạy: <span className="tabular-nums text-slate-300">{detail.activeVersion}</span>
                </span>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            data-button-surface="none"
            aria-label="Đóng"
            onClick={onClose}
            disabled={busy}
            className={`${BTN_BASE} h-10 w-10 shrink-0 border border-white/15 bg-white/5 text-white hover:bg-white/10`}
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {error ? (
          <div role="alert" className="mt-4 flex flex-col gap-3 rounded-[12px] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-300 sm:flex-row sm:items-center">
            <span>{error}</span>
            <button type="button" data-button-surface="none" onClick={fetchDetail} className={`${BTN.small} sm:ml-auto`}>
              Thử lại
            </button>
          </div>
        ) : !p ? (
          <div role="status" className="mt-4 space-y-3">
            <div className="h-16 animate-pulse rounded-[12px] bg-white/10" />
            <div className="h-40 animate-pulse rounded-[12px] bg-white/10" />
            <span className="sr-only">Đang tải…</span>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {p.summary ? <p className="text-sm leading-relaxed text-slate-300">{p.summary}</p> : null}

            <EvidenceBlock proposal={p} />

            <BacktestBlock backtest={bt} competencyNames={competencyNames} />

            <ExamplesBlock proposal={p} />

            {p.review?.at ? (
              <div className="rounded-[12px] border border-white/10 bg-white/[0.03] p-3 text-sm">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">Xử lý</p>
                <p className="mt-1 text-slate-300">
                  {isAutoRejected(p) ? "Hệ thống" : p.review.by?.name || "Platform Moderator"} · {formatDateTime(p.review.at)}
                </p>
                {p.review.note ? <p className="mt-1 text-slate-400">{p.review.note}</p> : null}
              </div>
            ) : null}

            {pending ? (
              <div className="rounded-[16px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-bold text-white">{REVIEW_ACTIONS[pending].label}?</p>
                <p className="mt-1 text-sm text-slate-400">{confirmText(pending, p, detail.activeVersion)}</p>
                {REVIEW_ACTIONS[pending].needsNote ? (
                  <div className="mt-3">
                    <label htmlFor="ai-improvement-note" className="text-sm font-bold text-white">
                      Lý do
                    </label>
                    <textarea
                      id="ai-improvement-note"
                      rows={4}
                      value={note}
                      maxLength={1000}
                      onChange={(e) => setNote(e.target.value)}
                      className="mt-1 w-full resize-y rounded-[12px] border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-violet-400/60 focus:outline-none"
                      placeholder={pending === "rollback" ? "Ví dụ: tỉ lệ bị chấm lại tăng sau khi bật" : "Ví dụ: ví dụ mẫu chưa tiêu biểu cho năng lực"}
                    />
                  </div>
                ) : null}
                {actionError ? (
                  <p role="alert" className="mt-2 text-xs text-red-300">
                    {actionError}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button type="button" data-button-surface="none" disabled={busy} onClick={() => setPending("")} className={BTN.secondary}>
                    Hủy
                  </button>
                  <button
                    type="button"
                    data-button-surface="none"
                    disabled={busy}
                    onClick={submitAction}
                    className={pending === "reject" || pending === "rollback" ? BTN.danger : BTN.primary}
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
                    {busy ? "Đang xử lý…" : REVIEW_ACTIONS[pending].label}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {actionError ? (
                  <p role="alert" className="text-xs text-red-300">
                    {actionError}
                  </p>
                ) : null}
                {actions.rebase ? (
                  <p className="rounded-[12px] border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-300">
                    Prompt đang chạy {detail.activeVersion}, khác bản gốc {p.before?.version} của đề xuất (một đề xuất khác đã được bật).
                    Dựng lại đề xuất trên bản đang chạy rồi backtest lại trước khi duyệt.
                  </p>
                ) : null}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                  {p.status === "proposed" ? (
                    <button
                      type="button"
                      data-button-surface="none"
                      disabled={busy || running}
                      onClick={runBacktest}
                      className={BTN.secondary}
                      title={running ? "Backtest đang chạy" : undefined}
                    >
                      {running ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <FlaskConical size={16} aria-hidden />}
                      {running ? "Đang backtest…" : bt ? "Backtest lại" : "Chạy backtest"}
                    </button>
                  ) : null}
                  {actions.rebase ? (
                    <button type="button" data-button-surface="none" disabled={busy || running} onClick={() => startAction("rebase")} className={BTN.secondary}>
                      Dựng lại
                    </button>
                  ) : null}
                  {actions.reject ? (
                    <button type="button" data-button-surface="none" disabled={busy} onClick={() => startAction("reject")} className={BTN.danger}>
                      Từ chối
                    </button>
                  ) : null}
                  {actions.rollback ? (
                    <button type="button" data-button-surface="none" disabled={busy} onClick={() => startAction("rollback")} className={BTN.danger}>
                      Rollback
                    </button>
                  ) : null}
                  {actions.approve ? (
                    <button
                      type="button"
                      data-button-surface="none"
                      disabled={busy || running}
                      onClick={() => startAction("approve")}
                      className={BTN.primary}
                      title={running ? "Đợi backtest xong" : undefined}
                    >
                      Duyệt và bật
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return <h3 className="mb-3 text-base font-bold text-white">{children}</h3>;
}

function EvidenceBlock({ proposal: p }) {
  const e = p.evidence ?? {};
  const items =
    p.kind === "rubric_anchor"
      ? [
          { label: "Doanh nghiệp", value: e.companyCount ?? 0 },
          { label: "Rubric đã duyệt", value: e.rubricIds?.length ?? 0 },
          { label: "Vị trí", value: (e.roleCategories ?? []).join(", ") || "—" },
          { label: "Tên công ty đã ẩn", value: (e.redactedInInput ?? 0) + (e.redactedInOutput ?? 0) },
        ]
      : [
          { label: "Lượt kiểm duyệt", value: e.overrideCount ?? e.moderationItemIds?.length ?? 0 },
          {
            label: "Điểm moderator − AI",
            value: Number.isFinite(e.avgScoreDelta) ? `${e.avgScoreDelta > 0 ? "+" : ""}${e.avgScoreDelta.toLocaleString("vi-VN")}` : "—",
          },
          { label: "Bản trước", value: p.before?.version || "—" },
          { label: "Bản sau", value: p.after?.version || "—" },
        ];
  return (
    <div>
      <SectionTitle>Bằng chứng</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className="rounded-[12px] border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">{it.label}</p>
            <p className="mt-1 break-words text-xl font-black tabular-nums text-white">{it.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatTable({ caption, side }) {
  const rows = statRows(side);
  return (
    <div className="overflow-x-auto rounded-[12px] border border-white/10">
      <table className="w-full text-sm">
        <caption className="px-3 pt-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">{caption}</caption>
        <thead className="text-xs font-semibold text-slate-400">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-semibold">Chỉ số</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">Trước</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Sau</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="px-3 py-2 text-slate-300">{r.label}</td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-300">{r.before}</td>
              <td className={`px-3 py-2 text-right font-bold tabular-nums ${TREND[r.trend] ?? "text-slate-300"}`}>{r.after}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BacktestBlock({ backtest: bt, competencyNames }) {
  const badge = backtestBadge(bt);
  const [showItems, setShowItems] = useState(false);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-base font-bold text-white">Chấm thử trước / sau</h3>
        <Badge tone={badge.tone}>
          {badge.running ? <Loader2 size={12} className="animate-spin" aria-hidden /> : null}
          {badge.label}
        </Badge>
        {bt?.ranAt ? <span className="text-xs font-semibold text-slate-400">{formatDateTime(bt.ranAt)}</span> : null}
      </div>

      {!bt ? (
        <p className="text-sm text-slate-400">Chưa có kết quả. Bấm "Chạy backtest" để chấm bộ 20 câu chuẩn bằng cả hai bản (khoảng 1–2 phút).</p>
      ) : bt.status === "running" ? (
        <p className="text-sm text-slate-400">Đang chấm bộ 20 câu chuẩn bằng cả hai bản, kết quả tự hiện khi xong.</p>
      ) : bt.status === "failed" ? (
        <p role="alert" className="rounded-[12px] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-300">
          {bt.error || "Backtest lỗi."}
        </p>
      ) : bt.status === "not_applicable" ? (
        <p className="text-sm text-slate-400">{bt.reason || "Không backtest được loại đề xuất này."}</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">
            Mức LP-01 (0–4) quy từ điểm AI, so với điểm chuẩn nhóm chấm ({bt.dataset}). Lệch càng nhỏ càng tốt.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <StatTable caption={`Bộ 20 câu chuẩn (${bt.beforeVersion} → ${bt.afterVersion})`} side={bt.gold} />
            {bt.old?.withReference ? (
              <StatTable caption={`Câu trả lời cũ có điểm moderator (${bt.old.withReference})`} side={bt.old} />
            ) : (
              <div className="rounded-[12px] border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-400">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">Câu trả lời cũ</p>
                <p className="mt-2">
                  {bt.old?.count ? `${bt.old.count} câu, chưa câu nào có điểm moderator để so.` : "Không có câu trả lời cũ cùng năng lực."}
                </p>
              </div>
            )}
          </div>
          {bt.old?.count ? (
            <p className="text-xs font-semibold text-slate-400">
              {bt.old.count} câu trả lời cũ: điểm đổi trung bình {Number.isFinite(bt.old.meanAbsChange) ? bt.old.meanAbsChange.toLocaleString("vi-VN") : "—"} mức giữa hai bản.
            </p>
          ) : null}
          {bt.items?.length ? (
            <div>
              <button
                type="button"
                data-button-surface="none"
                aria-expanded={showItems}
                onClick={() => setShowItems((v) => !v)}
                className="text-sm font-bold text-violet-300 hover:underline"
              >
                {showItems ? "Ẩn điểm từng câu" : `Xem điểm từng câu (${bt.items.length})`}
              </button>
              {showItems ? (
                <div className="mt-2 overflow-x-auto rounded-[12px] border border-white/10">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead className="text-xs font-semibold text-slate-400">
                      <tr>
                        <th scope="col" className="px-3 py-2 text-left font-semibold">Câu</th>
                        <th scope="col" className="px-3 py-2 text-left font-semibold">Năng lực</th>
                        <th scope="col" className="px-3 py-2 text-right font-semibold">Chuẩn</th>
                        <th scope="col" className="px-3 py-2 text-right font-semibold">Trước</th>
                        <th scope="col" className="px-3 py-2 text-right font-semibold">Sau</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 tabular-nums">
                      {bt.items.map((it) => {
                        const off = (v) => (Number.isFinite(v) ? Math.abs(v - it.gold) : null);
                        const tone = (v) => (off(v) === null ? "text-slate-500" : off(v) <= 0.5 ? "text-emerald-300" : off(v) <= 1 ? "text-slate-300" : "text-amber-300");
                        const fmt = (v) => (Number.isFinite(v) ? v.toLocaleString("vi-VN") : "—");
                        return (
                          <tr key={it.id}>
                            <td className="px-3 py-2 text-slate-300">{it.id}</td>
                            <td className="px-3 py-2 text-slate-300">{competencyNames[it.competencyId] ?? it.competencyId}</td>
                            <td className="px-3 py-2 text-right font-bold text-white">{it.gold}</td>
                            <td className={`px-3 py-2 text-right ${tone(it.before)}`}>{fmt(it.before)}</td>
                            <td className={`px-3 py-2 text-right font-bold ${tone(it.after)}`}>{fmt(it.after)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ExamplesBlock({ proposal }) {
  const examples = newExamples(proposal);
  if (!examples.length) return null;
  return (
    <div>
      <SectionTitle>Nội dung thêm vào prompt ({examples.length})</SectionTitle>
      <div className="space-y-2">
        {examples.map((e, i) => (
          <div key={i} className="rounded-[12px] border border-white/10 bg-white/[0.03] p-3 text-sm">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">
              {isAnchorExample(e) ? "Ví dụ neo 0–5 (đã ẩn tên doanh nghiệp)" : `Ví dụ ${i + 1}`}
            </p>
            <p className="mt-1 whitespace-pre-line break-words text-slate-300">{e.input}</p>
            <p className="mt-2 text-xs font-bold text-slate-400">{isAnchorExample(e) ? "Mô tả từng mức" : "Kết quả chuẩn"}</p>
            <p className="mt-1 whitespace-pre-line break-words font-medium text-white">{formatExampleOutput(e)}</p>
            {e.note && !isAnchorExample(e) ? <p className="mt-2 text-xs text-slate-400">Ghi chú moderator: {e.note}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

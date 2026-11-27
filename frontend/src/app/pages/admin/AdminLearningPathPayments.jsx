import { useCallback, useEffect, useMemo, useState } from "react";
import { AlarmClock, Ban, CheckCircle2, Clock, RefreshCw, Route, Search, Send, Undo2, User } from "lucide-react";
import { motion } from "motion/react";
import { tryApi } from "../../utils/shared/apiToast.js";
import { adminApi } from "../../api/adminApi.js";
import { AdminSepayOverrideAction } from "../../components/admin/AdminSepayOverrideAction.jsx";
import { StatusPill } from "../../components/admin/AdminStatusPill.jsx";
import { formatVnd } from "../../utils/shared/formatVnd.js";

/**
 * LP-11: đối soát chuyển khoản lộ trình học (trả trọn gói, Payment `learning_path`).
 * API: GET /api/admin/payments/learning-path-transfers?status=pending|expired|paid,
 *      PATCH /api/admin/payments/:id/confirm-learning-path-transfer.
 * - Chờ đối soát: mã còn hạn. Ứng viên đã báo «Đã chuyển» thì admin xác nhận thường; chưa báo thì xác nhận ngoại lệ.
 * - Hết hạn: tiền có thể đến muộn sau cửa sổ CK; chỉ xác nhận ngoại lệ kèm lý do sau khi đối chiếu sao kê.
 * - LP-15: tab «Đã nhận» có nút hủy lộ trình đang học (hoàn T − phần các buổi đã học); tab «Hủy & hoàn tiền»
 *   để xác nhận đã chuyển khoản hoàn (POST /api/admin/learning-paths/:id/cancel,
 *   PATCH /api/admin/payments/:id/confirm-learning-path-refund).
 */

const TABS = [
  { id: "pending", label: "Chờ đối soát" },
  { id: "expired", label: "Hết hạn (tiền đến muộn)" },
  { id: "paid", label: "Đã nhận" },
  { id: "refund", label: "Hủy & hoàn tiền" },
];

const STATUS_PILL = {
  pending: { label: "Chờ chuyển khoản", icon: Clock, tone: "border-amber-200 bg-amber-50 text-amber-800" },
  submitted: { label: "Ứng viên đã báo chuyển", icon: Send, tone: "border-sky-200 bg-sky-50 text-sky-800" },
  expired: { label: "Mã đã hết hạn", icon: AlarmClock, tone: "border-rose-200 bg-rose-50 text-rose-800" },
  paid: { label: "Đã nhận", icon: CheckCircle2, tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  refund_pending: { label: "Chờ hoàn tiền", icon: Undo2, tone: "border-orange-200 bg-orange-50 text-orange-800" },
  partial_refund: { label: "Đã hoàn một phần", icon: Undo2, tone: "border-slate-200 bg-slate-50 text-slate-700" },
  refunded: { label: "Đã hoàn toàn bộ", icon: Undo2, tone: "border-slate-200 bg-slate-50 text-slate-700" },
};

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const thCell = "px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 sm:px-5 sm:py-5 lg:px-6";
const tdCell = "px-4 py-4 sm:px-5 sm:py-5 lg:px-6";

export function AdminLearningPathPayments() {
  const [activeTab, setActiveTab] = useState("pending");
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ paidCount: 0, paidTotalAmount: 0, pendingCount: 0, submittedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  // LP-15: hộp hủy lộ trình / xác nhận đã hoàn tiền đang mở cho dòng nào
  const [cancelRow, setCancelRow] = useState(null);
  const [refundRow, setRefundRow] = useState(null);

  const load = useCallback(async (tab) => {
    setLoading(true);
    const res = await tryApi(() => adminApi.getLearningPathTransfers(tab), {
      fallback: "Không tải được danh sách chuyển khoản lộ trình.",
    });
    if (res.success) {
      setRows(res.payments || []);
      setStats(res.stats || { paidCount: 0, paidTotalAmount: 0, pendingCount: 0, submittedCount: 0 });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(activeTab);
  }, [activeTab, load]);

  const confirmRow = async (row, body) => {
    setBusyId(row.paymentId);
    // Gửi kèm số tiền của giao dịch: backend từ chối nếu lệch giá lộ trình.
    const res = await tryApi(
      () => adminApi.confirmLearningPathTransfer(row.paymentId, { ...body, amount: row.amount }),
      { fallback: "Không xác nhận được thanh toán lộ trình.", successMessage: "Đã xác nhận thanh toán, lộ trình đã kích hoạt." },
    );
    setBusyId("");
    if (res.success) await load(activeTab);
  };

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.candidate?.name, r.candidate?.email, r.mentor?.name, r.orderRef]
        .some((v) => String(v || "").toLowerCase().includes(q)),
    );
  }, [rows, searchTerm]);

  const totalShown = useMemo(() => rows.reduce((s, r) => s + Number(r.amount || 0), 0), [rows]);

  return (
    <div className="min-w-0 max-w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 sm:space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex min-w-0 flex-col justify-between gap-4 lg:flex-row lg:items-start lg:gap-6"
      >
        <div className="min-w-0 flex-1">
          <h2 className="font-headline text-3xl font-black uppercase tracking-tighter text-white [html[data-workspace-theme=light]_&]:text-slate-900">
            <span className="admin-title-accent text-[#93f72b] [html[data-workspace-theme=light]_&]:text-[#6d28d9]">Lộ trình</span> học
          </h2>
          <p className="mt-1 text-sm text-slate-400 [html[data-workspace-theme=light]_&]:text-slate-500">
            Ứng viên trả trọn gói bằng chuyển khoản. SePay tự xác nhận khi đúng mã PI và đúng số tiền; trang này dùng khi
            SePay không khớp.
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
          <button
            type="button"
            onClick={() => void load(activeTab)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </button>
          <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
            <Search className="absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm ứng viên, mentor, mã PI…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-6 text-sm text-slate-900 outline-none transition-all focus:border-violet-400"
            />
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-900">Đang chờ chuyển khoản</p>
          <p className="mt-1 text-2xl font-black text-amber-950">{stats.pendingCount}</p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-sky-900">Ứng viên đã báo chuyển</p>
          <p className="mt-1 text-2xl font-black text-sky-950">{stats.submittedCount}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-900">Đã nhận</p>
          <p className="mt-1 text-2xl font-black text-emerald-950">{stats.paidCount}</p>
          <p className="mt-1 text-sm font-semibold text-emerald-900">{formatVnd(stats.paidTotalAmount)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
                activeTab === tab.id
                  ? "border-violet-300 bg-violet-100 text-violet-700"
                  : "border-slate-300 bg-white text-slate-700 hover:border-violet-300 hover:text-violet-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="text-xs font-semibold text-slate-500">
          {rows.length} giao dịch · {formatVnd(totalShown)}
        </p>
      </div>

      {activeTab === "expired" && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 px-4 py-3 text-sm leading-relaxed text-rose-900">
          Mã chuyển khoản đã hết hạn nhưng lộ trình vẫn chờ thanh toán. Chỉ xác nhận khi sao kê có giao dịch đúng mã PI và
          đúng số tiền, kèm lý do đối soát. Nếu ứng viên đã lấy mã mới thì xác nhận theo dòng ở tab «Chờ đối soát».
        </div>
      )}

      <div className="glass-card min-w-0 max-w-full overflow-hidden border-slate-200/90 [&:hover]:transform-none">
        <div className="max-w-full overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[760px] table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[24%]" />
              <col className="w-[20%]" />
              <col className="w-[22%]" />
              <col className="w-[14%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90">
                <th className={thCell}>Ứng viên</th>
                <th className={thCell}>Mentor</th>
                <th className={thCell}>Chuyển khoản</th>
                <th className={`${thCell} text-right`}>Số tiền</th>
                <th className={`${thCell} text-right`}>
                  {activeTab === "paid" ? "Đã nhận lúc" : activeTab === "refund" ? "Hoàn tiền" : "Thao tác"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className={`${tdCell} py-20 text-center text-[10px] font-black uppercase italic tracking-widest text-slate-500`}>
                    <div className="sticky left-0 w-[min(100%,calc(100vw-4rem))]">
                      Đang tải…
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className={`${tdCell} py-20 text-center`}>
                    <div className="sticky left-0 w-[min(100%,calc(100vw-4rem))]">
                      <Route className="mx-auto mb-3 h-10 w-10 text-slate-400" />
                      <p className="text-[10px] font-black uppercase italic tracking-widest text-slate-500">
                        {rows.length === 0 ? "Không có giao dịch nào" : "Không có dòng phù hợp từ khóa tìm kiếm"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const pill = STATUS_PILL[row.status] || STATUS_PILL.pending;
                  return (
                    <tr key={row.paymentId} className="transition-colors hover:bg-violet-50/40">
                      <td className={`${tdCell} min-w-0`}>
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
                            <User size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-black text-slate-900" title={row.candidate?.name || ""}>
                              {row.candidate?.name || "—"}
                            </p>
                            <p className="truncate text-xs text-slate-500" title={row.candidate?.email || ""}>
                              {row.candidate?.email || ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className={`${tdCell} min-w-0`}>
                        <p className="truncate font-semibold text-slate-800">{row.mentor?.name || "—"}</p>
                        <p className="truncate text-xs text-slate-500">Phiên bản lộ trình v{row.learningPath?.version ?? 1}</p>
                      </td>
                      <td className={`${tdCell} min-w-0`}>
                        <p className="font-mono text-xs font-semibold text-violet-700" title={row.orderRef}>
                          {row.orderRef || "—"}
                        </p>
                        <div className="mt-1.5">
                          <StatusPill icon={pill.icon} label={pill.label} toneClass={pill.tone} />
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {row.status === "submitted"
                            ? `Báo lúc ${formatDateTime(row.submittedAt)}`
                            : row.status === "paid"
                              ? row.confirmedVia === "sepay" ? "SePay tự khớp" : `Admin xác nhận${row.forceConfirm ? " (ngoại lệ)" : ""}`
                              : `Hạn ${formatDateTime(row.paymentExpiresAt)}`}
                        </p>
                      </td>
                      <td className={`${tdCell} whitespace-nowrap text-right font-black text-violet-700`}>
                        {Number(row.amount || 0).toLocaleString("vi-VN")}{" "}
                        <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">đ</span>
                      </td>
                      {activeTab === "paid" ? (
                        <td className={`${tdCell} whitespace-nowrap text-right`}>
                          <div className="ml-auto inline-flex items-center gap-1.5 text-emerald-700">
                            <CheckCircle2 size={14} />
                            <span className="text-xs font-semibold">{formatDateTime(row.paidAt)}</span>
                          </div>
                          {row.forceNote && (
                            <p className="mt-1 truncate text-[11px] text-slate-500" title={row.forceNote}>
                              {row.forceNote}
                            </p>
                          )}
                          {row.learningPath?.status === "active" && (
                            <button
                              type="button"
                              onClick={() => setCancelRow(row)}
                              className="mt-2 inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-rose-700 hover:bg-rose-100"
                            >
                              <Ban size={12} /> Hủy lộ trình
                            </button>
                          )}
                        </td>
                      ) : activeTab === "refund" ? (
                        <td className={`${tdCell} text-right`}>
                          <p className="text-xs font-black text-orange-700">Hoàn {formatVnd(row.refundAmount)}</p>
                          {row.learningPath?.cancelReason && (
                            <p className="mt-1 truncate text-[11px] text-slate-500" title={row.learningPath.cancelReason}>
                              {row.learningPath.cancelReason}
                            </p>
                          )}
                          {row.status === "refund_pending" ? (
                            <button
                              type="button"
                              onClick={() => setRefundRow(row)}
                              className="mt-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-800 hover:bg-emerald-100"
                            >
                              Đã chuyển khoản hoàn
                            </button>
                          ) : (
                            <p className="mt-1 text-[11px] text-slate-500">
                              {formatDateTime(row.refundedAt)}
                              {row.refundTransferRef ? ` · ${row.refundTransferRef}` : ""}
                            </p>
                          )}
                        </td>
                      ) : (
                        <td className={tdCell}>
                          <div className="ml-auto flex items-center justify-end gap-2">
                            {row.status === "submitted" && (
                              <button
                                type="button"
                                disabled={busyId === row.paymentId}
                                onClick={() => void confirmRow(row, {})}
                                className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                              >
                                Xác nhận
                              </button>
                            )}
                            <AdminSepayOverrideAction
                              busy={busyId === row.paymentId}
                              onConfirm={(body) => confirmRow(row, body)}
                            />
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {cancelRow && (
        <CancelLearningPathDialog
          row={cancelRow}
          onClose={() => setCancelRow(null)}
          onDone={async () => {
            setCancelRow(null);
            await load(activeTab);
          }}
        />
      )}
      {refundRow && (
        <ConfirmRefundDialog
          row={refundRow}
          onClose={() => setRefundRow(null)}
          onDone={async () => {
            setRefundRow(null);
            await load(activeTab);
          }}
        />
      )}
    </div>
  );
}

/** LP-15: xem trước số tiền hoàn rồi hủy lộ trình (bắt buộc lý do ≥ 5 ký tự). */
function CancelLearningPathDialog({ row, onClose, onDone }) {
  const [preview, setPreview] = useState(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const pathId = row.learningPathId;
  const reasonOk = reason.trim().length >= 5;

  useEffect(() => {
    let alive = true;
    tryApi(() => adminApi.previewCancelLearningPath(pathId), { fallback: "Không tính được tiền hoàn." }).then((res) => {
      if (alive && res.success) setPreview(res.preview);
    });
    return () => {
      alive = false;
    };
  }, [pathId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!reasonOk) return;
    setSaving(true);
    const res = await tryApi(() => adminApi.cancelLearningPath(pathId, reason.trim()), {
      fallback: "Không hủy được lộ trình.",
      successMessage: "Đã hủy lộ trình. Giao dịch chuyển sang tab «Hủy & hoàn tiền».",
    });
    setSaving(false);
    if (res.success) onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="max-h-[90vh] overflow-y-auto w-full max-w-md space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div>
          <h3 className="text-lg font-black text-slate-900">Hủy lộ trình</h3>
          <p className="mt-1 text-xs text-slate-500">
            {row.candidate?.name || "Ứng viên"} · {row.mentor?.name || "Mentor"} · {formatVnd(row.amount)}
          </p>
        </div>
        {!preview ? (
          <p className="text-xs text-slate-400">Đang tính tiền hoàn…</p>
        ) : (
          <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs">
            <dt className="text-slate-600">Tổng lộ trình</dt>
            <dd className="text-right font-bold">{formatVnd(preview.totalAmount)}</dd>
            <dt className="text-slate-600">Đã học ({preview.learnedSessions} buổi), mentor giữ</dt>
            <dd className="text-right font-bold">− {formatVnd(preview.learnedShare)}</dd>
            <dt className="font-black text-slate-900">Hoàn cho ứng viên</dt>
            <dd className="text-right font-black text-orange-700">{formatVnd(preview.refundAmount)}</dd>
            {preview.openBookings > 0 && (
              <dd className="col-span-2 mt-1 text-[11px] text-rose-700">
                {preview.openBookings} buổi đã đặt lịch chưa học sẽ bị hủy, mentor được thông báo.
              </dd>
            )}
          </dl>
        )}
        <div>
          <label htmlFor="lp-cancel-reason" className="mb-1 block text-xs font-bold text-slate-700">
            Lý do hủy *
          </label>
          <textarea
            id="lp-cancel-reason"
            rows={3}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ví dụ: Ứng viên xin dừng vì chuyển công tác (đã xác nhận qua email hỗ trợ)."
            className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-violet-500 focus:outline-none"
          />
          {reason && !reasonOk && <p className="mt-1 text-[11px] text-rose-600">Lý do ít nhất 5 ký tự.</p>}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            Đóng
          </button>
          <button
            type="submit"
            disabled={saving || !preview || !reasonOk}
            className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {saving ? "Đang hủy…" : "Hủy lộ trình"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** LP-15: admin đã chuyển khoản hoàn cho ứng viên → nhập mã chuyển khoản để đóng giao dịch. */
function ConfirmRefundDialog({ row, onClose, onDone }) {
  const [transferRef, setTransferRef] = useState("");
  const [saving, setSaving] = useState(false);
  const refOk = transferRef.trim().length >= 3;

  const submit = async (e) => {
    e.preventDefault();
    if (!refOk) return;
    setSaving(true);
    const res = await tryApi(() => adminApi.confirmLearningPathRefund(row.paymentId, transferRef.trim()), {
      fallback: "Không xác nhận được hoàn tiền.",
      successMessage: "Đã xác nhận hoàn tiền.",
    });
    setSaving(false);
    if (res.success) onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="max-h-[90vh] overflow-y-auto w-full max-w-sm space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div>
          <h3 className="text-lg font-black text-slate-900">Xác nhận đã hoàn tiền</h3>
          <p className="mt-1 text-xs text-slate-500">
            Hoàn {formatVnd(row.refundAmount)} cho {row.candidate?.name || "ứng viên"}. Chỉ bấm sau khi đã chuyển khoản.
          </p>
        </div>
        <div>
          <label htmlFor="lp-refund-ref" className="mb-1 block text-xs font-bold text-slate-700">
            Mã chuyển khoản hoàn *
          </label>
          <input
            id="lp-refund-ref"
            value={transferRef}
            maxLength={100}
            onChange={(e) => setTransferRef(e.target.value)}
            placeholder="Ví dụ: FT2611240001"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-violet-500 focus:outline-none"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            Đóng
          </button>
          <button
            type="submit"
            disabled={saving || !refOk}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? "Đang lưu…" : "Xác nhận"}
          </button>
        </div>
      </form>
    </div>
  );
}

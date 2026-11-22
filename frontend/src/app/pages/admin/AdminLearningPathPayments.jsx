import { useCallback, useEffect, useMemo, useState } from "react";
import { AlarmClock, CheckCircle2, Clock, RefreshCw, Route, Search, Send, User } from "lucide-react";
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
 */

const TABS = [
  { id: "pending", label: "Chờ đối soát" },
  { id: "expired", label: "Hết hạn (tiền đến muộn)" },
  { id: "paid", label: "Đã nhận" },
];

const STATUS_PILL = {
  pending: { label: "Chờ chuyển khoản", icon: Clock, tone: "border-amber-200 bg-amber-50 text-amber-800" },
  submitted: { label: "Ứng viên đã báo chuyển", icon: Send, tone: "border-sky-200 bg-sky-50 text-sky-800" },
  expired: { label: "Mã đã hết hạn", icon: AlarmClock, tone: "border-rose-200 bg-rose-50 text-rose-800" },
  paid: { label: "Đã nhận", icon: CheckCircle2, tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
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
          <h2 className="font-headline text-3xl font-black uppercase tracking-tighter text-slate-900">
            <span className="text-violet-700">Lộ trình</span> học
          </h2>
          <p className="mt-1 text-sm text-slate-600">
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
                <th className={`${thCell} text-right`}>{activeTab === "paid" ? "Đã nhận lúc" : "Thao tác"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className={`${tdCell} py-20 text-center text-[10px] font-black uppercase italic tracking-widest text-slate-500`}>
                    Đang tải…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className={`${tdCell} py-20 text-center`}>
                    <Route className="mx-auto mb-3 h-10 w-10 text-slate-400" />
                    <p className="text-[10px] font-black uppercase italic tracking-widest text-slate-500">
                      {rows.length === 0 ? "Không có giao dịch nào" : "Không có dòng phù hợp từ khóa tìm kiếm"}
                    </p>
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
    </div>
  );
}

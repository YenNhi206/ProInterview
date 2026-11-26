import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Crown, RefreshCw, Search, User } from "lucide-react";
import { motion } from "motion/react";
import { tryApi } from "../../utils/shared/apiToast.js";
import { adminApi } from "../../api/adminApi.js";
import { AdminSepayOverrideAction } from "../../components/admin/AdminSepayOverrideAction.jsx";
import { StatusPill } from "../../components/admin/AdminStatusPill.jsx";

import { formatVnd } from "../../utils/shared/formatVnd.js";

function vnd(n) {
  return formatVnd(n);
}

function planLabel(plan) {
  if (plan === "elite_pro") return "Elite Pro";
  if (plan === "starter_pro") return "Starter Pro";
  if (plan === "free") return "Miễn phí";
  return plan || "—";
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function ActionSlot({ children, className = "" }) {
  return (
    <div className={`flex size-9 shrink-0 items-center justify-center ${className}`}>
      {children}
    </div>
  );
}

const thCell =
  "px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 sm:px-5 sm:py-5 lg:px-6";
const tdCell = "px-4 py-4 sm:px-5 sm:py-5 lg:px-6";

export function AdminSubscriptionPayments() {
  const [rows, setRows] = useState([]);
  const [historyRows, setHistoryRows] = useState([]);
  const [paidStats, setPaidStats] = useState({ paidCount: 0, paidTotalAmount: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [busyId, setBusyId] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [planFilter, setPlanFilter] = useState("all");

  const confirmSubscriptionOverride = async (row, confirmBody) => {
    const paymentId = row?.id;
    if (!paymentId) return;
    setBusyId(paymentId);
    const res = await tryApi(
      () => adminApi.confirmSubscriptionTransferPayment(String(paymentId), confirmBody || { force: true }),
      {
        fallback: "Không xác nhận được gói cước.",
        successMessage: "Đã xác nhận thanh toán và kích hoạt gói.",
      },
    );
    setBusyId("");
    if (res.success) await loadAll();
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [pendingRes, historyRes] = await Promise.all([
      tryApi(() => adminApi.getPendingSubscriptionPayments(), {
        fallback: "Không tải được danh sách gói cước chờ đối soát.",
      }),
      tryApi(() => adminApi.getSubscriptionFinanceSummary(), {
        fallback: "Không tải được lịch sử mua gói.",
      }),
    ]);
    if (pendingRes.success) {
      setRows(pendingRes.payments || []);
      setPaidStats(pendingRes.stats || { paidCount: 0, paidTotalAmount: 0 });
    }
    if (historyRes.success) {
      setHistoryRows(historyRes.subscriptionFinance?.recentPaidRows || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const totalPending = useMemo(
    () => rows.reduce((s, r) => s + Number(r.amount || 0), 0),
    [rows],
  );

  const sourceRows = activeTab === "history" ? historyRows : rows;

  const planFiltered = useMemo(
    () => (planFilter === "all" ? sourceRows : sourceRows.filter((r) => r.plan === planFilter)),
    [sourceRows, planFilter],
  );

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return planFiltered;
    return planFiltered.filter((r) => {
      const name = String(r.user?.name || "").toLowerCase();
      const email = String(r.user?.email || "").toLowerCase();
      const ref = String(r.providerRef || r.paymentRef || "").toLowerCase();
      const plan = planLabel(r.plan).toLowerCase();
      return name.includes(q) || email.includes(q) || ref.includes(q) || plan.includes(q);
    });
  }, [planFiltered, searchTerm]);

  const planCounts = useMemo(() => {
    const out = { starter_pro: 0, elite_pro: 0 };
    for (const r of sourceRows) {
      if (r.plan === "elite_pro") out.elite_pro += 1;
      else out.starter_pro += 1;
    }
    return out;
  }, [sourceRows]);

  return (
    <div className="min-w-0 max-w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 sm:space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex min-w-0 flex-col justify-between gap-4 lg:flex-row lg:items-start lg:gap-6"
      >
        <div className="min-w-0 flex-1">
          <h2 className="font-headline text-2xl font-black uppercase tracking-tight text-white [html[data-workspace-theme=light]_&]:text-slate-900 sm:text-3xl">
            <span className="admin-title-accent text-[#93f72b] [html[data-workspace-theme=light]_&]:text-[#6d28d9]">Gói</span> Pro / Elite
          </h2>
          <p className="mt-1 text-xs text-slate-400 [html[data-workspace-theme=light]_&]:text-slate-500">Theo dõi kích hoạt và đối soát các giao dịch nâng cấp tài khoản học viên.</p>
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </button>
          <div className="relative min-w-0 flex-1 sm:flex-none sm:w-72">
            <Search className="absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm học viên, gói, mã thanh toán…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-w-0 rounded-2xl border border-white/10 bg-white/[0.05] py-3 pl-12 pr-6 text-sm text-white placeholder:text-slate-500 outline-none transition-all focus:border-violet-500/50 focus:bg-white/[0.08]"
            />
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-4 sm:grid-cols-2"
      >
        <div className="admin-glow-card glass-card flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-xl backdrop-blur-md transition-all hover:border-violet-500/30">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Chờ đối soát</p>
            <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">{rows.length}</h3>
            <p className="mt-2 text-sm font-semibold text-amber-400">{vnd(totalPending)}</p>
          </div>
          <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-amber-400">
            <Clock size={24} strokeWidth={2.2} />
          </div>
        </div>
        <div className="admin-glow-card glass-card flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-xl backdrop-blur-md transition-all hover:border-violet-500/30">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Đã kích hoạt</p>
            <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">{paidStats.paidCount}</h3>
            <p className="mt-2 text-sm font-semibold text-emerald-400">{vnd(paidStats.paidTotalAmount)}</p>
          </div>
          <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-emerald-400">
            <CheckCircle2 size={24} strokeWidth={2.2} />
          </div>
        </div>
      </motion.div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${activeTab === "pending"
                ? "border-violet-500/40 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30"
                : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-violet-400/30 hover:bg-white/[0.08] hover:text-white"
              }`}
          >
            Chờ đối soát
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${activeTab === "history"
                ? "border-violet-500/40 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30"
                : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-violet-400/30 hover:bg-white/[0.08] hover:text-white"
              }`}
          >
            Lịch sử mua
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPlanFilter("all")}
            className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${planFilter === "all"
                ? "border-white/30 bg-white/15 text-white shadow-sm"
                : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/20 hover:text-white"
              }`}
          >
            Tất cả ({sourceRows.length})
          </button>
          <button
            type="button"
            onClick={() => setPlanFilter("starter_pro")}
            className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${planFilter === "starter_pro"
                ? "border-violet-500/40 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30"
                : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-violet-400/30 hover:text-white"
              }`}
          >
            <Crown size={12} className={planFilter === "starter_pro" ? "text-amber-300" : "text-violet-400"} /> Starter Pro ({planCounts.starter_pro})
          </button>
          <button
            type="button"
            onClick={() => setPlanFilter("elite_pro")}
            className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${planFilter === "elite_pro"
                ? "border-amber-500/40 bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-600/30"
                : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-amber-400/30 hover:text-white"
              }`}
          >
            <Crown size={12} className={planFilter === "elite_pro" ? "text-yellow-200" : "text-amber-400"} /> Elite Pro ({planCounts.elite_pro})
          </button>
        </div>
      </div>

      <div className="glass-card min-w-0 max-w-full overflow-hidden border-white/10 shadow-[0_12px_36px_rgba(0,0,0,0.35)] backdrop-blur-xl [&:hover]:transform-none">
        <div className="max-w-full overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-0 table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[26%]" />
              <col className="w-[16%]" />
              <col className="w-[18%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90">
                <th className={thCell}>Học viên</th>
                <th className={thCell}>Gói mua</th>
                <th className={thCell}>Thanh toán</th>
                <th className={`${thCell} text-right`}>Số tiền</th>
                <th className={`${thCell} text-right`}>
                  {activeTab === "history" ? "Ngày kích hoạt" : "Thao tác"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className={`${tdCell} py-20 text-center text-slate-400`}
                  >
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="admin-orbital-loader" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Đang tải gói đăng ký…</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className={`${tdCell} py-20 text-center`}>
                    <Crown className="mx-auto mb-3 h-10 w-10 text-slate-400" />
                    <p className="text-[10px] font-black uppercase italic tracking-widest text-slate-500">
                      {sourceRows.length === 0
                        ? activeTab === "history"
                          ? "Chưa có gói nào được kích hoạt"
                          : "Không có gói chờ đối soát"
                        : planFiltered.length === 0
                          ? "Không có giao dịch nào cho gói này"
                          : "Không có dòng phù hợp từ khóa tìm kiếm"}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const ref = row.providerRef || row.paymentRef || "—";
                  const planTone =
                    row.plan === "elite_pro"
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                      : "border-violet-500/30 bg-violet-500/10 text-violet-300";
                  return (
                    <tr key={row.id} className="group transition-colors hover:bg-white/[0.03]">
                      <td className={`${tdCell} min-w-0`}>
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300">
                            <User size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-black text-slate-900" title={row.user?.name || ""}>
                              {row.user?.name || "—"}
                            </p>
                            <p className="truncate text-xs text-slate-500" title={row.user?.email || ""}>
                              {row.user?.email || ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className={tdCell}>
                        <StatusPill icon={Crown} label={planLabel(row.plan)} toneClass={planTone} />
                      </td>
                      <td className={`${tdCell} whitespace-nowrap`}>
                        <p className="text-sm font-medium text-slate-800">Chuyển khoản</p>
                        <p className="mt-0.5 font-mono text-xs font-semibold text-violet-700" title={ref}>
                          {ref}
                        </p>
                      </td>
                      <td className={`${tdCell} whitespace-nowrap text-right font-black text-violet-700`}>
                        {Number(row.amount || 0).toLocaleString("vi-VN")}{" "}
                        <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">đ</span>
                      </td>
                      {activeTab === "history" ? (
                        <td className={`${tdCell} whitespace-nowrap text-right`}>
                          <div className="ml-auto inline-flex items-center gap-1.5 text-emerald-700">
                            <CheckCircle2 size={14} />
                            <span className="text-xs font-semibold">{formatDateTime(row.paidAt)}</span>
                          </div>
                        </td>
                      ) : (
                        <td className={tdCell}>
                          <div className="relative ml-auto flex w-full max-w-[4.5rem] justify-end gap-1">
                            <ActionSlot>
                              <AdminSepayOverrideAction
                                busy={busyId === row.id}
                                onConfirm={(body) => confirmSubscriptionOverride(row, body)}
                              />
                            </ActionSlot>
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

import { useCallback, useEffect, useMemo, useState } from "react";
import { Crown, RefreshCw, Search, User } from "lucide-react";
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
  const [paidStats, setPaidStats] = useState({ paidCount: 0, paidTotalAmount: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [busyId, setBusyId] = useState("");

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
    const res = await tryApi(() => adminApi.getPendingSubscriptionPayments(), {
      fallback: "Không tải được danh sách gói cước chờ đối soát.",
    });
    if (res.success) {
      setRows(res.payments || []);
      setPaidStats(res.stats || { paidCount: 0, paidTotalAmount: 0 });
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

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = String(r.user?.name || "").toLowerCase();
      const email = String(r.user?.email || "").toLowerCase();
      const ref = String(r.providerRef || r.paymentRef || "").toLowerCase();
      const plan = planLabel(r.plan).toLowerCase();
      return name.includes(q) || email.includes(q) || ref.includes(q) || plan.includes(q);
    });
  }, [rows, searchTerm]);

  return (
    <div className="min-w-0 max-w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 sm:space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex min-w-0 flex-col justify-between gap-4 lg:flex-row lg:items-start lg:gap-6"
      >
        <div className="min-w-0 flex-1">
          <h2 className="font-headline text-3xl font-black uppercase tracking-tighter text-slate-900">
            <span className="text-violet-700">Gói</span> Pro / Elite
          </h2>
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 disabled:opacity-50"
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
              className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-6 text-sm text-slate-900 outline-none transition-all focus:border-violet-400"
            />
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-4 sm:grid-cols-2"
      >
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-900">Chờ đối soát</p>
          <p className="mt-1 text-2xl font-black text-amber-950">{rows.length}</p>
          <p className="mt-1 text-sm font-semibold text-amber-900">{vnd(totalPending)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-900">Đã kích hoạt</p>
          <p className="mt-1 text-2xl font-black text-emerald-950">{paidStats.paidCount}</p>
          <p className="mt-1 text-sm font-semibold text-emerald-900">{vnd(paidStats.paidTotalAmount)}</p>
        </div>
      </motion.div>

      <div className="glass-card min-w-0 max-w-full overflow-hidden border-slate-200/90 [&:hover]:transform-none [&:hover]:shadow-[0_8px_18px_rgba(110,53,232,0.07)]">
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
                <th className={`${thCell} text-right`}>Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className={`${tdCell} py-20 text-center text-[10px] font-black uppercase italic tracking-widest text-slate-500`}
                  >
                    Đang tải…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className={`${tdCell} py-20 text-center`}>
                    <Crown className="mx-auto mb-3 h-10 w-10 text-slate-400" />
                    <p className="text-[10px] font-black uppercase italic tracking-widest text-slate-500">
                      {rows.length === 0
                        ? "Không có gói chờ đối soát"
                        : "Không có dòng phù hợp từ khóa tìm kiếm"}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const ref = row.providerRef || row.paymentRef || "—";
                  const planTone =
                    row.plan === "elite_pro"
                      ? "border-violet-300 bg-violet-100 text-violet-900"
                      : "border-violet-200 bg-violet-50 text-violet-800";
                  return (
                    <tr key={row.id} className="group transition-colors hover:bg-violet-50/40">
                      <td className={`${tdCell} min-w-0`}>
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
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

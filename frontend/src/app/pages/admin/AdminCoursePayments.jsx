import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, User, BookOpen } from "lucide-react";
import { motion } from "motion/react";
import { tryApi } from "../../utils/shared/apiToast.js";
import { adminApi } from "../../api/adminApi.js";
import { formatTransferConfirmedAt } from "../../utils/admin/adminPaymentUi.js";
import { AdminSepayOverrideAction } from "../../components/admin/AdminSepayOverrideAction.jsx";
import { PaymentStatusPill } from "../../components/admin/AdminStatusPill.jsx";
import { AdminFilterSelect, AdminListFilterBar } from "../../components/admin/AdminListFilters.jsx";
import {
  AdminPageToolbar,
  adminGlassTable,
  adminHeaderRow,
  adminPageWrap,
  adminStatGrid2,
  adminTdCell,
  adminThCell,
} from "../../components/admin/AdminPageShell.jsx";

import { formatVnd } from "../../utils/shared/formatVnd.js";

function vnd(n) {
  return formatVnd(n);
}

function amountOf(row) {
  return Number(row?.pricePaid ?? row?.courseId?.price ?? 0);
}

function paymentStatusOf(row) {
  return String(row?.paymentStatus || "").toLowerCase();
}

const FILTER_TABS = [
  { id: "all", label: "Tất cả" },
  { id: "pending", label: "Chờ đối soát" },
  { id: "paid", label: "Đã thanh toán" },
];

export function AdminCoursePayments() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    pendingTransferCount: 0,
    pendingTransferAmount: 0,
    paidCollectedCount: 0,
    paidCollectedAmount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState("");

  const confirmEnrollmentOverride = async (row, confirmBody) => {
    const id = row?._id;
    if (!id) return;
    setBusyId(id);
    const res = await tryApi(
      () => adminApi.confirmEnrollmentTransferPayment(String(id), confirmBody || { force: true }),
      {
      fallback: "Không xác nhận được học phí khóa.",
      successMessage: "Đã ghi nhận xác nhận ngoại lệ (admin).",
    });
    setBusyId("");
    if (res.success) await loadAll();
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [listRes, financeRes] = await Promise.all([
      tryApi(() => adminApi.getCoursePaymentEnrollments(), {
        fallback: "Không tải được danh sách học phí khóa học.",
      }),
      tryApi(() => adminApi.getCourseFinanceSummary(), { silent: true }),
    ]);
    if (listRes.success) setRows(listRes.enrollments || []);
    if (financeRes.success && financeRes.courseFinance) {
      const cf = financeRes.courseFinance;
      setSummary({
        pendingTransferCount: cf.pendingTransferCount ?? 0,
        pendingTransferAmount: cf.pendingTransferAmount ?? 0,
        paidCollectedCount: cf.paidCollectedCount ?? 0,
        paidCollectedAmount: cf.paidCollectedAmount ?? 0,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return rows.filter((r) => {
      const st = paymentStatusOf(r);
      if (filter === "pending" && st !== "pending") return false;
      if (filter === "paid" && st !== "paid") return false;
      if (!q) return true;
      const student = String(r.userId?.name || r.userId?.email || "").toLowerCase();
      const course = String(r.courseId?.title || "").toLowerCase();
      const mentor = String(r.courseId?.mentorId?.name || "").toLowerCase();
      const ref = String(r.paymentRef || "").toLowerCase();
      return student.includes(q) || course.includes(q) || mentor.includes(q) || ref.includes(q);
    });
  }, [rows, searchTerm, filter]);

  return (
    <div className={adminPageWrap}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={adminHeaderRow}>
        <div className="min-w-0 flex-1">
          <h2 className="font-headline text-3xl font-black uppercase tracking-tighter text-slate-900">
            <span className="text-violet-700">Học phí</span> khóa học
          </h2>
        </div>
        <AdminPageToolbar
          loading={loading}
          onRefresh={() => void loadAll()}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Tìm học viên, khóa học, mã thanh toán…"
        />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={adminStatGrid2}>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-900">Chờ đối soát</p>
          <p className="mt-1 text-2xl font-black text-amber-950">{summary.pendingTransferCount}</p>
          <p className="mt-1 text-sm font-semibold text-amber-900">{vnd(summary.pendingTransferAmount)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-900">Đã thu qua SePay</p>
          <p className="mt-1 text-2xl font-black text-emerald-950">{summary.paidCollectedCount}</p>
          <p className="mt-1 text-sm font-semibold text-emerald-900">{vnd(summary.paidCollectedAmount)}</p>
        </div>
      </motion.div>

      <AdminListFilterBar
        countText={`Hiển thị ${filtered.length} / ${rows.length} đơn mua`}
        showReset={filter !== "all"}
        onReset={() => setFilter("all")}
      >
        <AdminFilterSelect
          id="course-payment-status-filter"
          label="Trạng thái thanh toán"
          value={filter}
          options={FILTER_TABS}
          onChange={setFilter}
        />
      </AdminListFilterBar>

      <div className={adminGlassTable}>
        <div className="max-w-full overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-0 table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[18%]" />
              <col className="w-[20%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90">
                <th className={adminThCell}>Học viên</th>
                <th className={adminThCell}>Khóa học</th>
                <th className={adminThCell}>Thời gian</th>
                <th className={`${adminThCell} text-center`}>Trạng thái</th>
                <th className={`${adminThCell} text-right`}>Học phí</th>
                <th className={adminThCell}>Thanh toán</th>
                <th className={`${adminThCell} text-right`}>Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td
                    colSpan="7"
                    className={`${adminTdCell} py-20 text-center text-[10px] font-black uppercase italic tracking-widest text-slate-500`}
                  >
                    Đang tải học phí khóa học…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className={`${adminTdCell} py-20 text-center text-[10px] font-black uppercase italic tracking-widest text-slate-500`}
                  >
                    {rows.length === 0
                      ? "Chưa có đơn mua khóa học có học phí chuyển khoản."
                      : "Không có dòng phù hợp bộ lọc / từ khóa."}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const st = paymentStatusOf(r);
                  const confirmed = formatTransferConfirmedAt(r);
                  return (
                    <tr key={r._id} className="transition-colors hover:bg-violet-50/40">
                      <td className={`${adminTdCell} min-w-0`}>
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
                            <User size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-black text-slate-900">{r.userId?.name || "Học viên"}</p>
                            <p className="truncate text-xs text-slate-500">{r.userId?.email || ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className={`${adminTdCell} min-w-0`}>
                        <div className="flex min-w-0 items-start gap-2">
                          <BookOpen size={14} className="mt-0.5 shrink-0 text-violet-600" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800" title={r.courseId?.title || ""}>
                              {r.courseId?.title || "—"}
                            </p>
                            <p className="truncate text-[11px] text-slate-500">
                              Cố vấn: {r.courseId?.mentorId?.name || "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className={`${adminTdCell} min-w-0 align-top overflow-hidden`}>
                        <p className="font-black text-slate-900">
                          {r.createdAt ? new Date(r.createdAt).toLocaleDateString("vi-VN") : "—"}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
                          <Clock size={10} className="shrink-0" />
                          {r.createdAt
                            ? new Date(r.createdAt).toLocaleTimeString("vi-VN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </p>
                        {r.transferSubmittedAt ? (
                          <p
                            className="mt-1.5 break-words text-[10px] leading-relaxed text-emerald-700"
                            title={`Học viên đã báo chuyển khoản · ${new Date(r.transferSubmittedAt).toLocaleString("vi-VN")}`}
                          >
                            <span className="block font-medium">Học viên đã báo chuyển khoản</span>
                            <span className="mt-0.5 block text-emerald-600">
                              {new Date(r.transferSubmittedAt).toLocaleString("vi-VN")}
                            </span>
                          </p>
                        ) : null}
                      </td>
                      <td className={`${adminTdCell} align-top`}>
                        <div className="mx-auto flex min-w-[10.5rem] flex-col items-center gap-2 py-0.5">
                          <PaymentStatusPill status={st} />
                          {confirmed ? (
                            <p
                              className={`text-center text-[10px] leading-snug ${
                                confirmed.tone === "override" ? "text-rose-700" : "text-emerald-700"
                              }`}
                            >
                              {confirmed.text}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className={`${adminTdCell} whitespace-nowrap text-right font-black text-violet-700`}>
                        {amountOf(r).toLocaleString("vi-VN")}{" "}
                        <span className="text-[10px] font-medium text-slate-500">đ</span>
                      </td>
                      <td className={`${adminTdCell} min-w-0`}>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Chuyển khoản
                        </p>
                        <p
                          className="mt-1.5 truncate font-mono text-sm font-bold text-violet-700"
                          title={r.paymentRef || ""}
                        >
                          {r.paymentRef || "—"}
                        </p>
                      </td>
                      <td className={`${adminTdCell} text-center`}>
                        <div className="inline-flex justify-center">
                          {st === "pending" ? (
                            <AdminSepayOverrideAction
                              busy={busyId === r._id}
                              onConfirm={(body) => confirmEnrollmentOverride(r, body)}
                            />
                          ) : (
                            <span className="inline-block size-9" aria-hidden />
                          )}
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

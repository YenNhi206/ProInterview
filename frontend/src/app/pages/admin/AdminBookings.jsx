import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router";
import {
  Search,
  Clock,
  User,
  CheckCircle,
  XCircle,
  RefreshCw,
  Eye,
  MoreHorizontal,
  Banknote,
  Camera,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { adminApi } from "../../api/adminApi.js";
import { toastApiError, toastApiSuccess, tryApi } from "../../utils/shared/apiToast.js";
import { AdminSepayOverrideAction } from "../../components/admin/AdminSepayOverrideAction.jsx";
import { AdminBookingStatusStack } from "../../components/admin/AdminStatusPill.jsx";
import { AdminFilterSelect, AdminListFilterBar } from "../../components/admin/AdminListFilters.jsx";

import { formatVnd } from "../../utils/shared/formatVnd.js";

function vnd(n) {
  return formatVnd(n);
}

function paymentStatusOf(b) {
  return String(b?.paymentStatus || "").toLowerCase();
}

function bookingAmount(b) {
  return Number(b?.totalAmount ?? b?.price ?? 0);
}

const BOOKING_STATUS_MENU = [
  { value: "confirmed", label: "Đã xác nhận", requiresPaid: true },
  { value: "in_progress", label: "Đang diễn ra", requiresPaid: true },
  { value: "completed", label: "Hoàn thành", requiresPaid: true },
  { value: "no_show", label: "Không tham gia" },
  { value: "cancelled", label: "Hủy đơn" },
];

function canApproveBooking(booking, paymentStatus) {
  const st = String(booking?.status || "pending").toLowerCase();
  if (st !== "pending") return false;
  const pst = String(paymentStatus || "").toLowerCase();
  if (pst === "paid") return true;
  const amt = Number(booking?.totalAmount ?? booking?.price ?? 0);
  return amt <= 0;
}

const FILTER_TABS = [
  { id: "all", label: "Tất cả" },
  { id: "pending", label: "Chờ đối soát" },
  { id: "paid", label: "Đã thanh toán" },
  { id: "refund_pending", label: "Chờ hoàn tiền" },
];

/** Giữ ô thao tác cố định 4 nút, bảng không co khi đổi tab lọc. */
function ActionSlot({ children, className = "" }) {
  return (
    <div className={`flex size-9 shrink-0 items-center justify-center ${className}`}>
      {children}
    </div>
  );
}

export function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState("");
  const [normalizeBusy, setNormalizeBusy] = useState(false);
  const [normalizeModalOpen, setNormalizeModalOpen] = useState(false);
  const [cancelModal, setCancelModal] = useState({
    open: false,
    bookingId: "",
    previousStatus: "pending",
    reason: "",
  });
  const [statusMenuId, setStatusMenuId] = useState("");

  const loadBookings = useCallback(async () => {
    setLoading(true);
    const res = await tryApi(() => adminApi.getBookings(), {
      fallback: "Không thể tải danh sách lịch hẹn.",
    });
    if (res.success) setBookings(res.bookings);
    setLoading(false);
  }, []);

  const confirmBookingTransferOverride = async (booking, confirmBody) => {
    const bookingId = booking?._id;
    if (!bookingId) return;
    setBusyId(bookingId);
    let res;
    try {
      res = await adminApi.confirmBookingTransferPayment(String(bookingId), confirmBody || { force: true });
    } catch {
      toastApiError("Không xác nhận được chuyển khoản.");
      setBusyId("");
      return;
    }
    setBusyId("");
    if (!res?.success) {
      toastApiError(res?.error, "Không xác nhận được chuyển khoản.");
      return;
    }
    const count = Number(res.confirmedCount || 1);
    toastApiSuccess(
      count > 1
        ? `Đã xác nhận ${count} buổi hẹn trong đơn.`
        : "Đã xác nhận thanh toán và duyệt buổi hẹn.",
    );
    const confirmedRef = String(booking.paymentRef || "").trim();
    // Optimistically mark all bookings in the same order (same paymentRef) as paid (G1).
    setBookings((prev) =>
      prev.map((b) => {
        const isTarget = String(b._id) === String(bookingId);
        const isSibling = confirmedRef && String(b.paymentRef || "").trim() === confirmedRef;
        if (isTarget) return { ...b, ...(res.booking || {}), paymentStatus: "paid" };
        if (isSibling) return { ...b, paymentStatus: "paid", status: "confirmed" };
        return b;
      }),
    );
    await loadBookings();
  };

  const confirmBookingRefund = async (booking) => {
    const bookingId = booking?._id;
    if (!bookingId) return;
    const amt = Number(booking.cancelRefundAmountVnd || 0);
    if (
      !window.confirm(
        `Xác nhận đã chuyển khoản hoàn ${formatVnd(amt)} cho học viên?\n\nChỉ bấm sau khi đã chuyển tiền thật vào số tài khoản trên đơn.`,
      )
    ) {
      return;
    }
    setBusyId(bookingId);
    const res = await tryApi(() => adminApi.confirmBookingRefund(String(bookingId)), {
      fallback: "Không xác nhận được hoàn tiền.",
      successMessage: "Đã đánh dấu hoàn tiền xong.",
    });
    setBusyId("");
    if (!res.success) return;
    setBookings((prev) =>
      prev.map((b) =>
        String(b._id) === String(bookingId)
          ? {
              ...b,
              paymentStatus: res.booking?.paymentStatus || b.paymentStatus,
              refundCompletedAt: res.booking?.refundCompletedAt ?? new Date().toISOString(),
            }
          : b,
      ),
    );
  };

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  useEffect(() => {
    if (!statusMenuId) return;
    const close = () => setStatusMenuId("");
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [statusMenuId]);

  const summary = useMemo(() => {
    const ck = bookings.filter((b) => b.paymentMethod === "transfer");
    const pending = ck.filter((b) => paymentStatusOf(b) === "pending");
    const paid = ck.filter((b) => paymentStatusOf(b) === "paid");
    const refundPending = bookings.filter((b) => paymentStatusOf(b) === "refund_pending");
    return {
      pendingTransferCount: pending.length,
      pendingTransferAmount: pending.reduce((s, b) => s + bookingAmount(b), 0),
      paidCollectedCount: paid.length,
      paidCollectedAmount: paid.reduce((s, b) => s + bookingAmount(b), 0),
      refundPendingCount: refundPending.length,
      refundPendingAmount: refundPending.reduce((s, b) => s + Number(b.cancelRefundAmountVnd || 0), 0),
    };
  }, [bookings]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return bookings.filter((b) => {
      const pst = paymentStatusOf(b);
      if (filter === "pending" && pst !== "pending") return false;
      if (filter === "paid" && pst !== "paid") return false;
      if (filter === "refund_pending" && pst !== "refund_pending") return false;
      if (!q) return true;
      const student = String(b.userId?.name || b.userId?.email || "").toLowerCase();
      const mentor = String(b.mentorId?.name || "").toLowerCase();
      const ref = String(b.paymentRef || "").toLowerCase();
      return student.includes(q) || mentor.includes(q) || ref.includes(q);
    });
  }, [bookings, searchTerm, filter]);

  // Map paymentRef → { count, totalVnd } — badge nhóm + cảnh báo tổng tiền khi confirm.
  const paymentRefGroups = useMemo(() => {
    const map = new Map();
    for (const b of filtered) {
      const ref = String(b.paymentRef || "").trim();
      if (!ref) continue;
      const g = map.get(ref) ?? { count: 0, totalVnd: 0 };
      map.set(ref, {
        count: g.count + 1,
        totalVnd: g.totalVnd + Number(b.totalAmount ?? b.price ?? 0),
      });
    }
    return map;
  }, [filtered]);

  const handleNormalizeTransferRefs = async () => {
    setNormalizeModalOpen(false);
    setNormalizeBusy(true);
    const res = await tryApi(() => adminApi.normalizeTransferRefs({ dryRun: false }), {
      fallback: "Không thể chuẩn hóa mã chuyển khoản.",
    });
    setNormalizeBusy(false);
    if (!res.success) return;
    const changed = Number(res.totalChanged || 0);
    const scanned = Number(res.totalScanned || 0);
    toastApiSuccess(`Chuẩn hóa xong: ${changed}/${scanned} bản ghi đã được cập nhật.`);
    await loadBookings();
  };

  const handleStatusChange = async (bookingId, nextStatus, previousStatus = "pending") => {
    if (!bookingId || !nextStatus) return;
    if (nextStatus === "cancelled") {
      setCancelModal({
        open: true,
        bookingId,
        previousStatus,
        reason: "",
      });
      return;
    }
    setBusyId(bookingId);
    const res = await tryApi(() => adminApi.updateBookingStatus(bookingId, nextStatus, ""), {
      fallback: "Không thể cập nhật trạng thái lịch hẹn.",
      successMessage: "Đã cập nhật trạng thái lịch hẹn.",
    });
    setBusyId("");
    if (!res.success) return;
    setBookings((prev) => prev.map((b) => (b._id === bookingId ? { ...b, ...res.booking } : b)));
  };

  const confirmCancelBooking = async () => {
    const bookingId = cancelModal.bookingId;
    if (!bookingId) return;
    setBusyId(bookingId);
    const res = await tryApi(
      () => adminApi.updateBookingStatus(bookingId, "cancelled", cancelModal.reason || ""),
      { fallback: "Không thể hủy lịch hẹn.", successMessage: "Đã hủy lịch hẹn." },
    );
    setBusyId("");
    if (!res.success) return;
    setBookings((prev) => prev.map((b) => (b._id === bookingId ? { ...b, ...res.booking } : b)));
    setCancelModal({ open: false, bookingId: "", previousStatus: "pending", reason: "" });
  };

  const thCell =
    "px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 sm:px-5 sm:py-5 lg:px-6";
  const tdCell = "px-4 py-4 sm:px-5 sm:py-5 lg:px-6";

  return (
    <div className="min-w-0 max-w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 sm:space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex min-w-0 flex-col justify-between gap-4 lg:flex-row lg:items-start lg:gap-6"
      >
        <div className="min-w-0 flex-1">
          <h2 className="font-headline text-3xl font-black uppercase tracking-tighter text-slate-900">
            <span className="text-violet-700">Lịch hẹn</span> &amp; thanh toán
          </h2>
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
          <Link
            to="/admin/bookings/check-ins"
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-emerald-900 hover:bg-emerald-100 sm:px-4 sm:py-3"
          >
            <Camera className="h-4 w-4" />
            Check-in mentor
          </Link>
          <button
            type="button"
            onClick={() => void loadBookings()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </button>
          <button
            type="button"
            onClick={() => setNormalizeModalOpen(true)}
            disabled={normalizeBusy}
            className="shrink-0 rounded-2xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-violet-800 hover:bg-violet-100 disabled:opacity-50 sm:px-4 sm:py-3"
            title="Dọn dữ liệu mã chuyển khoản cũ bị nối dài"
          >
            {normalizeBusy ? "Đang chuẩn hóa..." : "Chuẩn hóa mã thanh toán"}
          </button>
          <div className="relative min-w-0 flex-1 sm:flex-none sm:w-72">
            <Search className="absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm học viên, cố vấn, mã thanh toán…"
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
        className="grid gap-4 sm:grid-cols-3"
      >
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
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4"
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-sky-900">Chờ hoàn cho học viên</p>
          <p className="mt-1 text-2xl font-black text-sky-950">{summary.refundPendingCount}</p>
          <p className="mt-1 text-sm font-semibold text-sky-900">{vnd(summary.refundPendingAmount)}</p>
        </motion.div>
      </motion.div>

      <AdminListFilterBar
        countText={`Hiển thị ${filtered.length} / ${bookings.length} lịch hẹn`}
        showReset={filter !== "all"}
        onReset={() => setFilter("all")}
      >
        <AdminFilterSelect
          id="booking-status-filter"
          label="Trạng thái thanh toán"
          value={filter}
          options={FILTER_TABS}
          onChange={setFilter}
        />
      </AdminListFilterBar>

      <div className="glass-card min-w-0 max-w-full overflow-hidden border-slate-200/90 [&:hover]:transform-none [&:hover]:shadow-[0_8px_18px_rgba(128,55,244,0.07)]">
        <div className="max-w-full overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-0 table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[16%]" />
              <col className="w-[10%]" />
              <col className="w-[14%]" />
              <col className="w-[20%]" />
              <col className="w-[9%]" />
              <col className="w-[11%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90">
                <th className={thCell}>Học viên</th>
                <th className={thCell}>Cố vấn</th>
                <th className={thCell}>Thời gian</th>
                <th className={`${thCell} text-center`}>Trạng thái</th>
                <th className={`${thCell} text-right`}>Chi phí</th>
                <th className={`${thCell}`}>Thanh toán</th>
                <th className={`${thCell} text-right`}>Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="7" className={`${tdCell} py-20 text-center text-[10px] font-black uppercase italic tracking-widest text-slate-500`}>
                    Đang tải lịch sử đặt lịch...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className={`${tdCell} py-20 text-center text-[10px] font-black uppercase italic tracking-widest text-slate-500`}>
                    {bookings.length === 0
                      ? "Chưa có lịch hẹn, dữ liệu sẽ hiện khi có booking."
                      : "Không có dòng phù hợp bộ lọc / từ khóa."}
                  </td>
                </tr>
              ) : (
                filtered.map((b) => {
                  const pst = paymentStatusOf(b);
                  return (
                  <tr key={b._id} className="group transition-colors hover:bg-violet-50/40">
                    <td className={`${tdCell} max-w-[11rem]`}>
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
                          <User size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-black text-slate-900" title={b.userId?.name || ""}>
                            {b.userId?.name || "Người dùng ẩn"}
                          </p>
                          <p className="truncate text-xs text-slate-500" title={b.userId?.email || ""}>
                            {b.userId?.email || ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={`${tdCell} max-w-[10rem]`}>
                      <p className="truncate font-medium text-slate-700" title={b.mentorId?.name || ""}>
                        {b.mentorId?.name || "Cố vấn chưa xác định"}
                      </p>
                    </td>
                    <td className={`${tdCell} min-w-0 align-top overflow-hidden`}>
                      <p className="font-black text-slate-900">{b.date}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
                        <Clock size={10} className="shrink-0" /> {b.timeSlot || b.time}
                      </p>
                      {b.transferSubmittedAt ? (
                        <p
                          className="mt-1.5 break-words text-[10px] leading-relaxed text-emerald-700"
                          title={`Học viên đã báo chuyển khoản · ${new Date(b.transferSubmittedAt).toLocaleString("vi-VN")}`}
                        >
                          <span className="block font-medium">Học viên đã báo chuyển khoản</span>
                          <span className="mt-0.5 block text-emerald-600">
                            {new Date(b.transferSubmittedAt).toLocaleString("vi-VN")}
                          </span>
                        </p>
                      ) : null}
                    </td>
                    <td className={`${tdCell} align-top`}>
                      <AdminBookingStatusStack
                        bookingStatus={b.status}
                        paymentStatus={pst}
                        paymentMethod={b.paymentMethod}
                        mentorCancelResolution={b.mentorCancelResolution}
                      />
                    </td>
                    <td className={`${tdCell} whitespace-nowrap text-right font-black text-violet-700`}>
                      {(b.totalAmount ?? b.price ?? 0).toLocaleString("vi-VN")}{" "}
                      <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">đ</span>
                    </td>
                    <td className={`${tdCell} whitespace-nowrap`}>
                      {b.paymentMethod === "transfer" ? (
                        <div>
                          <p className="text-sm font-medium text-slate-800">Chuyển khoản</p>
                          <p
                            className="mt-0.5 font-mono text-xs font-semibold text-violet-700"
                            title={b.paymentRef || ""}
                          >
                            {b.paymentRef || "—"}
                          </p>
                          {b.paymentRef && (paymentRefGroups.get(b.paymentRef)?.count ?? 0) > 1 ? (
                            <span className="mt-1 inline-block rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                              {paymentRefGroups.get(b.paymentRef)?.count} buổi · xác nhận 1 lần
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">Khác</span>
                      )}
                    </td>
                    <td className={tdCell}>
                      {(() => {
                        const bookingPending = (b.status || "pending") === "pending";
                        const canApprove = canApproveBooking(b, pst);
                        const showShield = b.paymentMethod === "transfer" && pst === "pending";
                        const showRefund =
                          pst === "refund_pending" && Number(b.cancelRefundAmountVnd) > 0;
                        const showMore = !bookingPending;
                        const slot4 = showShield ? (
                          <div className="relative">
                            <AdminSepayOverrideAction
                              iconOnly
                              busy={busyId === b._id}
                              onConfirm={(body) => confirmBookingTransferOverride(b, body)}
                              groupCount={paymentRefGroups.get(b.paymentRef)?.count ?? 1}
                              groupTotalVnd={paymentRefGroups.get(b.paymentRef)?.totalVnd ?? 0}
                            />
                          </div>
                        ) : showRefund ? (
                          <button
                            type="button"
                            title={`Đã hoàn ${vnd(b.cancelRefundAmountVnd)} cho học viên`}
                            disabled={busyId === b._id}
                            onClick={() => void confirmBookingRefund(b)}
                            className="inline-flex size-9 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-700 transition hover:bg-sky-100 disabled:opacity-50"
                          >
                            <Banknote size={16} />
                          </button>
                        ) : showMore ? (
                          <div className="relative">
                            <button
                              type="button"
                              title="Đổi trạng thái"
                              disabled={busyId === b._id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setStatusMenuId((cur) => (cur === b._id ? "" : String(b._id)));
                              }}
                              className="inline-flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                            >
                              <MoreHorizontal size={16} />
                            </button>
                            {statusMenuId === b._id ? (
                              <div
                                className="absolute right-0 top-full z-30 mt-1 min-w-[10.5rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {BOOKING_STATUS_MENU.filter(
                                  (o) =>
                                    o.value !== b.status &&
                                    (!o.requiresPaid || pst === "paid" || bookingAmount(b) <= 0),
                                ).map((o) => (
                                  <button
                                    key={o.value}
                                    type="button"
                                    className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-violet-50"
                                    onClick={() => {
                                      setStatusMenuId("");
                                      void handleStatusChange(b._id, o.value, b.status || "pending");
                                    }}
                                  >
                                    {o.label}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null;

                        return (
                          <div className="relative ml-auto flex w-full max-w-[11.5rem] justify-end gap-1">
                            <ActionSlot>
                              <Link
                                to={`/admin/bookings/${b._id}`}
                                title="Xem chi tiết"
                                className="inline-flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                              >
                                <Eye size={16} />
                              </Link>
                            </ActionSlot>
                            <ActionSlot>
                              {bookingPending && canApprove ? (
                                <button
                                  type="button"
                                  title="Duyệt buổi (đã thanh toán)"
                                  disabled={busyId === b._id}
                                  onClick={() =>
                                    void handleStatusChange(b._id, "confirmed", b.status || "pending")
                                  }
                                  className="inline-flex size-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                                >
                                  <CheckCircle size={18} />
                                </button>
                              ) : bookingPending && pst === "pending" ? (
                                <span
                                  className="inline-flex size-9 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-slate-300"
                                  title="Chờ thanh toán (SePay) trước khi duyệt buổi"
                                >
                                  <CheckCircle size={18} />
                                </span>
                              ) : null}
                            </ActionSlot>
                            <ActionSlot>
                              {bookingPending ? (
                                <button
                                  type="button"
                                  title="Hủy đơn"
                                  disabled={busyId === b._id}
                                  onClick={() =>
                                    void handleStatusChange(b._id, "cancelled", b.status || "pending")
                                  }
                                  className="inline-flex size-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                                >
                                  <XCircle size={18} />
                                </button>
                              ) : null}
                            </ActionSlot>
                            <ActionSlot>{slot4}</ActionSlot>
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {normalizeModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={() => setNormalizeModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 16, opacity: 0 }}
              className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="text-xl font-black text-slate-900">Chuẩn hóa mã chuyển khoản</h4>
              <p className="mt-2 text-sm text-slate-600">
                Hệ thống sẽ dọn dữ liệu <span className="font-semibold">paymentRef / providerRef</span> cũ bị nối nhiều
                đoạn để bảng thanh toán dễ đối soát hơn.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setNormalizeModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-slate-50 py-3 text-xs font-black uppercase tracking-wider text-slate-800"
                >
                  Không chạy
                </button>
                <button
                  type="button"
                  onClick={() => void handleNormalizeTransferRefs()}
                  disabled={normalizeBusy}
                  className="rounded-xl border border-violet-300 bg-violet-50 py-3 text-xs font-black uppercase tracking-wider text-violet-700 disabled:opacity-50"
                >
                  {normalizeBusy ? "Đang xử lý..." : "Xác nhận chạy"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {cancelModal.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={() => setCancelModal((prev) => ({ ...prev, open: false, bookingId: "", reason: "" }))}
          >
            <motion.div
              initial={{ scale: 0.96, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 16, opacity: 0 }}
              className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="text-xl font-black text-slate-900">Xác nhận hủy lịch hẹn</h4>
              <p className="mt-2 text-sm text-slate-600">
                Bạn sắp đổi trạng thái sang <span className="font-semibold text-red-600">Đã hủy</span>. Có thể nhập lý
                do để lưu lại lịch sử xử lý.
              </p>
              <textarea
                value={cancelModal.reason}
                onChange={(e) => setCancelModal((prev) => ({ ...prev, reason: e.target.value }))}
                className="mt-4 min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900 outline-none focus:border-violet-400"
                placeholder="Ví dụ: Học viên xin dời lịch, admin hủy phiên hiện tại."
              />
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setCancelModal((prev) => ({
                      ...prev,
                      open: false,
                      bookingId: "",
                      reason: "",
                    }))
                  }
                  className="rounded-xl border border-slate-200 bg-slate-50 py-3 text-xs font-black uppercase tracking-wider text-slate-800"
                >
                  Không hủy
                </button>
                <button
                  type="button"
                  onClick={confirmCancelBooking}
                  disabled={busyId === cancelModal.bookingId}
                  className="rounded-xl border border-red-300 bg-red-50 py-3 text-xs font-black uppercase tracking-wider text-red-700 disabled:opacity-50"
                >
                  {busyId === cancelModal.bookingId ? "Đang xử lý..." : "Xác nhận hủy"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

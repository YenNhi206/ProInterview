import React from "react";
import { useParams, Link } from "react-router";
import { AdminPanel } from "./AdminPanel.jsx";
import { UserJourneyPanel } from "../../components/admin/UserJourneyPanel.jsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Banknote,
  BookOpen,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  Copy,
  Crown,
  ChevronDown,
  Eye,
  RefreshCw,
  Search,
  User,
  Wallet,
  XCircle,
} from "lucide-react";
import {
  AdminBookingStatusStack,
  PaymentStatusPill,
  StatusPill,
} from "../../components/admin/AdminStatusPill.jsx";
import { AdminFilterSelect, AdminListFilterBar } from "../../components/admin/AdminListFilters.jsx";
import { AppSelect } from "../../components/ui/AppSelect";
import {
  AdminPageToolbar,
  adminGlassTable,
  adminHeaderRow,
  adminPageWrap,
  adminStatGrid4,
  adminTdCell,
  adminThCell,
} from "../../components/admin/AdminPageShell.jsx";
import { adminApi } from "../../api/adminApi.js";
import { ensureMinQuotaUsage } from "../../utils/analytics/mockQuota.js";
import { toastApiError, toastApiSuccess, tryApi } from "../../utils/shared/apiToast.js";
import { AnimatePresence, motion } from "motion/react";

import { formatVnd } from "../../utils/shared/formatVnd.js";

function vnd(amount) {
  return formatVnd(amount);
}

function copyAdminText(text, successMsg = "Đã sao chép.") {
  const t = String(text || "").trim();
  if (!t) {
    toastApiError("Không có nội dung để sao chép.");
    return;
  }
  void navigator.clipboard.writeText(t).then(
    () => toastApiSuccess(successMsg),
    () => toastApiError("Trình duyệt không cho phép sao chép."),
  );
}

function statusLabel(status) {
  const key = String(status || "").toLowerCase();
  if (key === "pending") return "Chờ duyệt";
  if (key === "course_pending_ck") return "Chờ SePay (khóa học)";
  if (key === "confirmed") return "Đã xác nhận";
  if (key === "completed") return "Hoàn thành";
  if (key === "approved") return "Đã duyệt — chờ chi";
  if (key === "paid") return "Đã chuyển khoản";
  if (key === "cancelled") return "Đã hủy";
  if (key === "rejected") return "Đã từ chối";
  if (key === "failed") return "Thất bại";
  return key || "Không xác định";
}

export function AdminUserDetail() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const res = await tryApi(() => adminApi.getUserById(id), {
        fallback: "Không tải được người dùng.",
        silent: true,
      });
      if (cancelled) return;
      if (!res.success) {
        const msg = res.error || "Không tải được";
        setError(msg);
        toastApiError(msg);
      } else {
        setUser(res.user || null);
        if (!res.user) setError("Không tìm thấy người dùng.");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const toggleActive = async () => {
    if (!user) return;
    const res = await tryApi(() => adminApi.updateUserStatus(user._id, user.isActive === false), {
      fallback: "Không cập nhật được trạng thái.",
      successMessage: user.isActive !== false ? "Đã khóa" : "Đã mở khóa",
    });
    if (res.success) setUser({ ...user, isActive: user.isActive === false });
  };

  return (
    <AdminPanel title="Chi tiết người dùng" description="Thông tin tài khoản, quota và hành trình trên nền tảng.">
      {loading && <p className="text-sm text-slate-500">Đang tải…</p>}
      {error && !loading && <p className="text-sm text-red-600">{error}</p>}
      {user && (
        <motion.div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <p className="text-xl font-black text-slate-900">{user.name}</p>
          <p className="text-sm text-slate-600">{user.email}</p>
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <p><span className="font-semibold">Vai trò:</span> {user.role}</p>
            <p><span className="font-semibold">Gói:</span> {user.plan || "free"}</p>
            <p>
              <span className="font-semibold">CV đã dùng:</span>{" "}
              {ensureMinQuotaUsage(
                user._id,
                user.quota?.cvAnalysisUsed ?? 0,
                user.quota?.cvAnalysisLimit ?? 3,
                user.plan,
                "cvAnalysis",
              )}{" "}
              / {user.quota?.cvAnalysisLimit ?? 3}
            </p>
            <p>
              <span className="font-semibold">Phỏng vấn AI:</span>{" "}
              {ensureMinQuotaUsage(
                user._id,
                user.quota?.interviewUsed ?? 0,
                user.quota?.interviewLimit ?? user.quota?.interviewQuestionsAllowed ?? 1,
                user.plan,
                "interview",
              )}{" "}
              / {user.quota?.interviewLimit ?? user.quota?.interviewQuestionsAllowed ?? 1}
            </p>
            <p><span className="font-semibold">Lịch hẹn:</span> {user.stats?.bookingsCount ?? 0}</p>
            <p><span className="font-semibold">Khóa học:</span> {user.stats?.enrollmentsCount ?? 0}</p>
            <p><span className="font-semibold">Trực tuyến:</span>{" "}
              {user.isActive === false
                ? "— (tài khoản khóa)"
                : user.isOnline
                  ? "Đang online"
                  : `Không online · ${user.lastSeenAt ? new Date(user.lastSeenAt).toLocaleString("vi-VN") : "chưa từng"}`}
            </p>
            <p><span className="font-semibold">Tài khoản:</span> {user.isActive === false ? "Đã khóa" : "Đang mở"}</p>
            <p><span className="font-semibold">Đăng ký:</span> {user.createdAt ? new Date(user.createdAt).toLocaleString("vi-VN") : "—"}</p>
          </div>
          <button
            type="button"
            onClick={toggleActive}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white"
          >
            {user.isActive === false ? "Mở khóa" : "Khóa tài khoản"}
          </button>
        </motion.div>
      )}
      {user && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-200 bg-white p-6"
        >
          <h3 className="mb-4 text-lg font-black text-slate-900">Hành trình người dùng</h3>
          <UserJourneyPanel
            userId={user._id}
            plan={user.plan}
            createdAt={user.createdAt}
            planExpiresAt={user.planExpiresAt}
          />
        </motion.div>
      )}
    </AdminPanel>
  );
}

/** @deprecated — dùng `AdminMentorDetail.jsx` */
export { AdminMentorDetail } from "./AdminMentorDetail.jsx";

function bookingAmount(b) {
  return Number(b?.totalAmount ?? b?.price ?? 0);
}

function bookingPaymentStatus(b) {
  return String(b?.paymentStatus || "").toLowerCase();
}

const FINANCE_QUICK_LINKS = [
  { to: "/admin/bookings", label: "Lịch hẹn", icon: Calendar },
  { to: "/admin/course-payments", label: "Học phí khóa", icon: BookOpen },
  { to: "/admin/subscription-payments", label: "Gói Pro/Elite", icon: Crown },
  { to: "/admin/payouts", label: "Rút tiền cố vấn", icon: Banknote },
];

export function AdminFinance() {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [courseFinance, setCourseFinance] = useState(null);
  const [subscriptionFinance, setSubscriptionFinance] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [bookingRes, payoutRes, courseRes, subscriptionRes] = await Promise.all([
      tryApi(() => adminApi.getBookings(), { silent: true }),
      tryApi(() => adminApi.getPayouts(), { silent: true }),
      tryApi(() => adminApi.getCourseFinanceSummary(), { silent: true }),
      tryApi(() => adminApi.getSubscriptionFinanceSummary(), { silent: true }),
    ]);
    if (bookingRes.success) setBookings(bookingRes.bookings || []);
    if (payoutRes.success) setPayouts(payoutRes.payouts || []);
    if (courseRes.success) setCourseFinance(courseRes.courseFinance || null);
    if (subscriptionRes.success) setSubscriptionFinance(subscriptionRes.subscriptionFinance || null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const bookingSummary = useMemo(() => {
    const transfer = bookings.filter((b) => b.paymentMethod === "transfer");
    const pending = transfer.filter((b) => bookingPaymentStatus(b) === "pending");
    const paid = transfer.filter((b) => bookingPaymentStatus(b) === "paid");
    const refundPending = bookings.filter((b) => bookingPaymentStatus(b) === "refund_pending");
    return {
      pendingTransferCount: pending.length,
      pendingTransferAmount: pending.reduce((s, b) => s + bookingAmount(b), 0),
      paidCollectedCount: paid.length,
      paidCollectedAmount: paid.reduce((s, b) => s + bookingAmount(b), 0),
      refundPendingCount: refundPending.length,
      refundPendingAmount: refundPending.reduce((s, b) => s + Number(b.cancelRefundAmountVnd || 0), 0),
    };
  }, [bookings]);

  const payoutSummary = useMemo(() => {
    const pending = payouts.filter((p) => p.status === "pending");
    const approved = payouts.filter((p) => p.status === "approved" || p.status === "paid");
    const rejected = payouts.filter((p) => p.status === "rejected");
    return {
      totalCount: payouts.length,
      totalAmount: payouts.reduce((s, p) => s + Number(p.amount || 0), 0),
      pendingCount: pending.length,
      pendingAmount: pending.reduce((s, p) => s + Number(p.amount || 0), 0),
      approvedCount: approved.length,
      approvedAmount: approved.reduce((s, p) => s + Number(p.amount || 0), 0),
      rejectedCount: rejected.length,
    };
  }, [payouts]);

  const cf = courseFinance;
  const sf = subscriptionFinance;

  return (
    <div className="min-w-0 max-w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 sm:space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex min-w-0 flex-col justify-between gap-4 lg:flex-row lg:items-start lg:gap-6"
      >
        <div className="min-w-0 flex-1">
          <h2 className="font-headline text-3xl font-black uppercase tracking-tighter text-slate-900">
            <span className="text-violet-700">Tài chính</span> — Tổng quan
          </h2>
        </div>
        <button
          type="button"
          onClick={() => void loadAll()}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </button>
      </motion.div>

      <div className="flex flex-wrap gap-2">
        {FINANCE_QUICK_LINKS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="inline-flex min-w-[9.25rem] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-900"
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
            <ArrowRight className="h-3 w-3 shrink-0 opacity-50" />
          </Link>
        ))}
      </div>

      {loading ? (
        <p className="text-xs font-medium text-slate-500">Đang tải dữ liệu tài chính…</p>
      ) : (
        <div className="space-y-10">
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Lịch hẹn</h3>
              <Link
                to="/admin/bookings"
                className="text-xs font-bold text-violet-700 hover:underline"
              >
                Lịch hẹn &amp; thanh toán →
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-900">Chờ đối soát</p>
                <p className="mt-1 text-2xl font-black text-amber-950">{bookingSummary.pendingTransferCount}</p>
                <p className="mt-1 text-sm font-semibold text-amber-900">
                  {vnd(bookingSummary.pendingTransferAmount)}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-900">Đã thu qua SePay</p>
                <p className="mt-1 text-2xl font-black text-emerald-950">{bookingSummary.paidCollectedCount}</p>
                <p className="mt-1 text-sm font-semibold text-emerald-900">
                  {vnd(bookingSummary.paidCollectedAmount)}
                </p>
              </div>
              <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-sky-900">Chờ hoàn cho học viên</p>
                <p className="mt-1 text-2xl font-black text-sky-950">{bookingSummary.refundPendingCount}</p>
                <p className="mt-1 text-sm font-semibold text-sky-900">
                  {vnd(bookingSummary.refundPendingAmount)}
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Rút tiền cố vấn</h3>
              <Link to="/admin/payouts" className="text-xs font-bold text-violet-700 hover:underline">
                Duyệt yêu cầu rút →
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tổng yêu cầu</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{payoutSummary.totalCount}</p>
                <p className="mt-1 text-sm font-semibold text-slate-700">{vnd(payoutSummary.totalAmount)}</p>
              </div>
              <div className="rounded-2xl border border-orange-200 bg-orange-50/80 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-900">Chờ duyệt</p>
                <p className="mt-1 text-2xl font-black text-orange-950">{payoutSummary.pendingCount}</p>
                <p className="mt-1 text-sm font-semibold text-orange-900">{vnd(payoutSummary.pendingAmount)}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-900">Đã duyệt / đã chi</p>
                <p className="mt-1 text-2xl font-black text-emerald-950">{payoutSummary.approvedCount}</p>
                <p className="mt-1 text-sm font-semibold text-emerald-900">{vnd(payoutSummary.approvedAmount)}</p>
              </div>
            </div>
            {payoutSummary.rejectedCount > 0 && (
              <p className="text-xs text-slate-500">
                {payoutSummary.rejectedCount} yêu cầu đã từ chối (không tính vào số tiền chờ chi).
              </p>
            )}
          </section>

          {cf && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Học phí khóa học</h3>
                <Link
                  to="/admin/course-payments"
                  className="text-xs font-bold text-violet-700 hover:underline"
                >
                  Theo dõi học phí khóa →
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-900">Đã thu qua SePay</p>
                  <p className="mt-1 text-2xl font-black text-emerald-950">{cf.paidCollectedCount ?? 0}</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-900">{vnd(cf.paidCollectedAmount)}</p>
                  <p className="mt-2 text-xs text-emerald-800/80">Mua khóa có học phí &gt; 0</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-900">Chờ đối soát</p>
                  <p className="mt-1 text-2xl font-black text-amber-950">{cf.pendingTransferCount ?? 0}</p>
                  <p className="mt-1 text-sm font-semibold text-amber-900">{vnd(cf.pendingTransferAmount)}</p>
                  <p className="mt-2 text-xs text-amber-800/80">Chưa khớp chuyển khoản trên SePay</p>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Khóa miễn phí không hiển thị ở đây. Đối soát thủ công (khi cổng lỗi) tại menu Đối soát SePay.
              </p>
            </section>
          )}

          {sf && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Gói Pro/Elite</h3>
                <Link
                  to="/admin/subscription-payments"
                  className="text-xs font-bold text-violet-700 hover:underline"
                >
                  Theo dõi gói Pro/Elite →
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-900">Đã thu qua SePay</p>
                  <p className="mt-1 text-2xl font-black text-emerald-950">{sf.paidCollectedCount ?? 0}</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-900">{vnd(sf.paidCollectedAmount)}</p>
                  <p className="mt-2 text-xs text-emerald-800/80">Mua gói Starter Pro / Elite Pro</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-900">Chờ đối soát</p>
                  <p className="mt-1 text-2xl font-black text-amber-950">{sf.pendingTransferCount ?? 0}</p>
                  <p className="mt-1 text-sm font-semibold text-amber-900">{vnd(sf.pendingTransferAmount)}</p>
                  <p className="mt-2 text-xs text-amber-800/80">Chưa khớp chuyển khoản trên SePay</p>
                </div>
              </div>
            </section>
          )}

          <section className="glass-card border-slate-200/90 p-5">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                <Wallet className="h-5 w-5" />
              </div>
              <div className="min-w-0 text-sm text-slate-600">
                <p className="font-bold text-slate-900">Đối soát chi tiết</p>
                <p className="mt-1 leading-relaxed">
                  Thu chuyển khoản (lịch hẹn, khóa học, gói Pro) được SePay tự khớp theo mã thanh toán và số tiền.
                  Khi cổng lỗi, admin xác nhận thủ công từ từng màn theo dõi tương ứng.
                </p>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

const TX_TYPE_TABS = [
  { id: "all", label: "Tất cả" },
  { id: "booking", label: "Lịch hẹn" },
  { id: "course_fee", label: "Học phí khóa" },
  { id: "payout", label: "Rút tiền" },
];

const TX_STATUS_TABS = [
  { id: "all", label: "Mọi trạng thái" },
  { id: "pending", label: "Chờ đối soát" },
  { id: "paid", label: "Đã thanh toán" },
  { id: "payout_pending", label: "Rút tiền chờ duyệt" },
  { id: "closed", label: "Đã hủy / từ chối" },
];

const TX_TH =
  "px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 sm:px-5 sm:py-5 lg:px-6";
const TX_TD = "px-4 py-4 sm:px-5 sm:py-5 lg:px-6";

function txTypeMeta(type) {
  if (type === "booking") {
    return { label: "Lịch hẹn", icon: Calendar, tone: "border-violet-200 bg-violet-50 text-violet-800", to: "/admin/bookings" };
  }
  if (type === "course_fee") {
    return { label: "Học phí khóa", icon: BookOpen, tone: "border-teal-200 bg-teal-50 text-teal-900", to: "/admin/course-payments" };
  }
  return { label: "Rút tiền", icon: Banknote, tone: "border-cyan-200 bg-cyan-50 text-cyan-900", to: "/admin/payouts" };
}

const PAYOUT_STATUS_STYLES = {
  pending: {
    Icon: Clock,
    label: "Chờ duyệt",
    tone: "border-orange-300 bg-orange-100 text-orange-950",
  },
  approved: {
    Icon: Banknote,
    label: "Chờ chuyển khoản",
    tone: "border-sky-300 bg-sky-100 text-sky-950",
  },
  paid: {
    Icon: CheckCircle,
    label: "Đã chi",
    tone: "border-emerald-300 bg-emerald-100 text-emerald-950",
  },
  rejected: {
    Icon: XCircle,
    label: "Đã từ chối",
    tone: "border-rose-200 bg-rose-50 text-rose-700",
  },
  cancelled: {
    Icon: XCircle,
    label: "Đã hủy",
    tone: "border-slate-300 bg-slate-200 text-slate-800",
  },
};

function PayoutStatusPill({ status }) {
  const key = String(status || "pending").toLowerCase();
  const cfg = PAYOUT_STATUS_STYLES[key] || {
    Icon: AlertCircle,
    label: statusLabel(key),
    tone: "border-slate-300 bg-slate-100 text-slate-700",
  };
  return <StatusPill icon={cfg.Icon} label={cfg.label} toneClass={cfg.tone} />;
}

function matchesTxStatusFilter(row, statusFilter) {
  if (statusFilter === "all") return true;
  if (statusFilter === "pending") {
    if (row.type === "payout") return false;
    return String(row.paymentStatus || "").toLowerCase() === "pending";
  }
  if (statusFilter === "paid") {
    if (row.type === "payout") {
      const s = String(row.payoutStatus || "").toLowerCase();
      return s === "paid" || s === "approved";
    }
    return String(row.paymentStatus || "").toLowerCase() === "paid";
  }
  if (statusFilter === "payout_pending") {
    return row.type === "payout" && String(row.payoutStatus || "").toLowerCase() === "pending";
  }
  if (statusFilter === "closed") {
    const closed = new Set(["cancelled", "rejected", "failed", "no_show"]);
    if (row.type === "payout") return closed.has(String(row.payoutStatus || "").toLowerCase());
    if (row.type === "booking") {
      return (
        closed.has(String(row.bookingStatus || "").toLowerCase()) ||
        closed.has(String(row.paymentStatus || "").toLowerCase())
      );
    }
    return false;
  }
  return true;
}

function buildTransactionRows(bookingRes, payoutRes, courseRes) {
  const bookingRows = bookingRes.success
    ? (bookingRes.bookings || []).map((b) => ({
        id: b._id,
        type: "booking",
        amount: Number(b.totalAmount ?? b.price ?? 0),
        bookingStatus: b.status || "pending",
        paymentStatus: b.paymentStatus || "",
        paymentMethod: b.paymentMethod || "transfer",
        paymentRef: b.paymentRef || "",
        date: b.updatedAt || b.createdAt || new Date().toISOString(),
        label: `${b.userId?.name || "Học viên"} → ${b.mentorId?.name || "Cố vấn"}`,
        detailTo: "/admin/bookings",
      }))
    : [];
  const payoutRows = payoutRes.success
    ? (payoutRes.payouts || []).map((p) => ({
        id: p._id,
        type: "payout",
        amount: Number(p.amount || 0),
        payoutStatus: p.status || "pending",
        date: p.requestedAt || p.createdAt || new Date().toISOString(),
        label: p.mentorId?.name || p.mentorId?.userId?.name || "Cố vấn",
        detailTo: "/admin/payouts",
      }))
    : [];
  const cf = courseRes.success ? courseRes.courseFinance : null;
  const courseRows = [];
  if (cf) {
    (cf.pendingList || []).forEach((e) => {
      courseRows.push({
        id: `enr-p-${e._id}`,
        type: "course_fee",
        amount: Number(e.pricePaid || 0),
        paymentStatus: "pending",
        paymentRef: e.paymentRef || "",
        date: e.transferSubmittedAt || e.updatedAt || e.createdAt || new Date().toISOString(),
        label: `${e.userId?.name || "Học viên"} · ${e.courseId?.title || "Khóa học"}`,
        detailTo: "/admin/course-payments",
      });
    });
    (cf.recentPaidRows || []).forEach((e) => {
      courseRows.push({
        id: `enr-paid-${e._id}`,
        type: "course_fee",
        amount: Number(e.pricePaid || 0),
        paymentStatus: "paid",
        paymentRef: e.paymentRef || "",
        date: e.paidAt || e.updatedAt || e.createdAt || new Date().toISOString(),
        label: `${e.userId?.name || "Học viên"} · ${e.courseId?.title || "Khóa học"}`,
        detailTo: "/admin/course-payments",
      });
    });
  }
  return [...bookingRows, ...payoutRows, ...courseRows].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

export function AdminTransactions() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [bookingRes, payoutRes, courseRes] = await Promise.all([
      tryApi(() => adminApi.getBookings(), { silent: true }),
      tryApi(() => adminApi.getPayouts(), { silent: true }),
      tryApi(() => adminApi.getCourseFinanceSummary(), { silent: true }),
    ]);
    setRows(buildTransactionRows(bookingRes, payoutRes, courseRes));
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (!matchesTxStatusFilter(r, statusFilter)) return false;
      if (!q) return true;
      const typeLabel = txTypeMeta(r.type).label.toLowerCase();
      const ref = String(r.paymentRef || "").toLowerCase();
      const label = String(r.label || "").toLowerCase();
      return label.includes(q) || ref.includes(q) || typeLabel.includes(q);
    });
  }, [rows, typeFilter, statusFilter, searchTerm]);

  const summary = useMemo(() => {
    const booking = filteredRows.filter((r) => r.type === "booking");
    const course = filteredRows.filter((r) => r.type === "course_fee");
    const payout = filteredRows.filter((r) => r.type === "payout");
    const pendingPay = filteredRows.filter(
      (r) => r.type !== "payout" && String(r.paymentStatus || "").toLowerCase() === "pending",
    );
    return {
      totalAmount: filteredRows.reduce((s, r) => s + Number(r.amount || 0), 0),
      bookingCount: booking.length,
      courseCount: course.length,
      payoutCount: payout.length,
      pendingPayCount: pendingPay.length,
      pendingPayAmount: pendingPay.reduce((s, r) => s + Number(r.amount || 0), 0),
    };
  }, [filteredRows]);

  return (
    <div className="min-w-0 max-w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 sm:space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex min-w-0 flex-col justify-between gap-4 lg:flex-row lg:items-start lg:gap-6"
      >
        <div className="min-w-0 flex-1">
          <h2 className="font-headline text-3xl font-black uppercase tracking-tighter text-slate-900">
            <span className="text-violet-700">Giao dịch</span>
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
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tổng (đang lọc)</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{vnd(summary.totalAmount)}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-900">Chờ đối soát</p>
          <p className="mt-1 text-2xl font-black text-amber-950">{summary.pendingPayCount}</p>
          <p className="mt-1 text-sm font-semibold text-amber-900">{vnd(summary.pendingPayAmount)}</p>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50/80 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-violet-900">Lịch hẹn · Học phí</p>
          <p className="mt-1 text-sm font-semibold text-violet-950">
            {summary.bookingCount} buổi
            <span className="mx-2 text-violet-300">·</span>
            {summary.courseCount} mua khóa
          </p>
        </div>
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-cyan-900">Rút tiền cố vấn</p>
          <p className="mt-1 text-2xl font-black text-cyan-950">{summary.payoutCount}</p>
        </div>
      </motion.div>

      <AdminListFilterBar
        countText={loading ? "Đang tải…" : `Hiển thị ${filteredRows.length} / ${rows.length} giao dịch`}
        showReset={typeFilter !== "all" || statusFilter !== "all"}
        onReset={() => {
          setTypeFilter("all");
          setStatusFilter("all");
        }}
      >
        <AdminFilterSelect
          id="tx-type-filter"
          label="Loại giao dịch"
          value={typeFilter}
          options={TX_TYPE_TABS}
          onChange={setTypeFilter}
        />
        <AdminFilterSelect
          id="tx-status-filter"
          label="Trạng thái"
          value={statusFilter}
          options={TX_STATUS_TABS}
          onChange={setStatusFilter}
        />
      </AdminListFilterBar>

      <div className="glass-card min-w-0 max-w-full overflow-hidden border-slate-200/90 [&:hover]:transform-none [&:hover]:shadow-[0_8px_18px_rgba(110,53,232,0.07)]">
        <div className="max-w-full overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-0 table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[26%]" />
              <col className="w-[22%]" />
              <col className="w-[11%]" />
              <col className="w-[14%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90">
                <th className={TX_TH}>Loại</th>
                <th className={TX_TH}>Nội dung</th>
                <th className={`${TX_TH} text-center`}>Trạng thái</th>
                <th className={`${TX_TH} text-right`}>Số tiền</th>
                <th className={TX_TH}>Thời gian</th>
                <th className={`${TX_TH} text-right`}>Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className={`${TX_TD} py-20 text-center text-[10px] font-black uppercase italic tracking-widest text-slate-500`}>
                    Đang tải giao dịch…
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className={`${TX_TD} py-20 text-center text-[10px] font-black uppercase italic tracking-widest text-slate-500`}>
                    Không có giao dịch phù hợp bộ lọc
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const meta = txTypeMeta(r.type);
                  const when = new Date(r.date);
                  return (
                    <tr key={`${r.type}-${r.id}`} className="group transition-colors hover:bg-violet-50/40">
                      <td className={TX_TD}>
                        <StatusPill icon={meta.icon} label={meta.label} toneClass={meta.tone} />
                      </td>
                      <td className={`${TX_TD} min-w-0`}>
                        <p className="truncate font-semibold text-slate-900" title={r.label}>
                          {r.label}
                        </p>
                        {r.paymentRef ? (
                          <p className="mt-0.5 truncate font-mono text-xs font-semibold text-violet-700" title={r.paymentRef}>
                            {r.paymentRef}
                          </p>
                        ) : null}
                      </td>
                      <td className={`${TX_TD} align-top`}>
                        {r.type === "booking" ? (
                          <AdminBookingStatusStack
                            bookingStatus={r.bookingStatus}
                            paymentStatus={r.paymentStatus}
                            paymentMethod={r.paymentMethod}
                          />
                        ) : r.type === "course_fee" ? (
                          <div className="mx-auto flex min-w-[10.5rem] flex-col items-center gap-2 py-0.5">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Thanh toán</p>
                            <PaymentStatusPill status={r.paymentStatus || "pending"} />
                          </div>
                        ) : (
                          <div className="mx-auto flex justify-center py-0.5">
                            <PayoutStatusPill status={r.payoutStatus} />
                          </div>
                        )}
                      </td>
                      <td className={`${TX_TD} whitespace-nowrap text-right font-black text-violet-700`}>
                        {Number(r.amount || 0).toLocaleString("vi-VN")}{" "}
                        <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">đ</span>
                      </td>
                      <td className={`${TX_TD} whitespace-nowrap text-slate-600`}>
                        <p className="font-mono text-xs">{when.toLocaleTimeString("vi-VN")}</p>
                        <p className="text-xs text-slate-500">{when.toLocaleDateString("vi-VN")}</p>
                      </td>
                      <td className={TX_TD}>
                        <div className="flex justify-end">
                          <Link
                            to={r.detailTo || meta.to}
                            title={`Mở ${meta.label}`}
                            className="flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
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

const PAYOUT_FILTER_OPTIONS = [
  { id: "all", label: "Tất cả" },
  { id: "pending", label: "Chờ duyệt" },
  { id: "approved", label: "Chờ chuyển khoản" },
  { id: "paid", label: "Đã chi" },
  { id: "rejected", label: "Đã từ chối" },
];

const PAYOUT_TH =
  "px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 sm:px-5 sm:py-5 lg:px-6";
const PAYOUT_TD = "px-4 py-4 sm:px-5 sm:py-5 lg:px-6";

function PayoutActionSlot({ children }) {
  return <div className="flex size-9 shrink-0 items-center justify-center">{children}</div>;
}

const copyIconBtn =
  "inline-flex size-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800";

export function AdminPayouts() {
  const REJECT_REASON_OPTIONS = [
    { id: "account_mismatch", label: "Thông tin tài khoản nhận tiền không khớp hồ sơ" },
    { id: "account_invalid", label: "Số tài khoản/ngân hàng không hợp lệ" },
    { id: "risk_check", label: "Yêu cầu cần kiểm tra rủi ro bổ sung" },
    { id: "duplicate_request", label: "Yêu cầu trùng lặp với lệnh trước đó" },
    { id: "policy_violation", label: "Yêu cầu chưa đáp ứng chính sách thanh toán" },
    { id: "other", label: "Lý do khác" },
  ];
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [rejectModal, setRejectModal] = useState({
    open: false,
    payoutId: "",
    reasonKey: "account_invalid",
    note: "",
  });
  const [markPaidModal, setMarkPaidModal] = useState({
    open: false,
    payoutId: "",
    transferRef: "",
    note: "",
  });

  const loadRows = useCallback(async () => {
    setLoading(true);
    const res = await tryApi(() => adminApi.getPayouts(), {
      fallback: "Không tải được danh sách rút tiền.",
    });
    if (res.success) setRows(res.payouts || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const handleApprove = async (id) => {
    setBusyId(id);
    const res = await tryApi(() => adminApi.approvePayout(id), {
      fallback: "Không duyệt được yêu cầu.",
      successMessage: "Đã duyệt. Hãy chuyển khoản cho cố vấn rồi ghi nhận đã chi.",
    });
    setBusyId("");
    if (res.success) await loadRows();
  };

  const confirmMarkPaid = async () => {
    const id = markPaidModal.payoutId;
    if (!id) return;
    setBusyId(id);
    const res = await tryApi(
      () =>
        adminApi.markPayoutPaid(id, {
          transferRef: String(markPaidModal.transferRef || "").trim(),
          note: String(markPaidModal.note || "").trim(),
        }),
      {
        fallback: "Không ghi nhận được đã chi.",
        successMessage: "Đã ghi nhận đã chuyển khoản cho cố vấn.",
      },
    );
    setBusyId("");
    if (!res.success) return;
    setMarkPaidModal({ open: false, payoutId: "", transferRef: "", note: "" });
    await loadRows();
  };

  const handleReject = (id) => {
    setRejectModal({ open: true, payoutId: id, reasonKey: "account_invalid", note: "" });
  };

  const confirmReject = async () => {
    if (!rejectModal.payoutId) return;
    const selected = REJECT_REASON_OPTIONS.find((item) => item.id === rejectModal.reasonKey);
    const standardizedReason = selected?.label || "Lý do khác";
    const note = String(rejectModal.note || "").trim();
    const mergedReason = note ? `${standardizedReason}. Ghi chú: ${note}` : standardizedReason;
    setBusyId(rejectModal.payoutId);
    const res = await tryApi(() => adminApi.rejectPayout(rejectModal.payoutId, mergedReason), {
      fallback: "Không từ chối được yêu cầu.",
      successMessage: "Đã từ chối yêu cầu rút tiền.",
    });
    setBusyId("");
    if (!res.success) return;
    setRejectModal({ open: false, payoutId: "", reasonKey: "account_invalid", note: "" });
    await loadRows();
  };

  const summary = useMemo(() => {
    const sum = (list) => list.reduce((s, r) => s + Number(r.amount || 0), 0);
    const pending = rows.filter((r) => r.status === "pending");
    const approved = rows.filter((r) => r.status === "approved");
    const paid = rows.filter((r) => r.status === "paid");
    const rejected = rows.filter((r) => r.status === "rejected");
    return {
      pendingCount: pending.length,
      pendingAmount: sum(pending),
      approvedCount: approved.length,
      approvedAmount: sum(approved),
      paidCount: paid.length,
      paidAmount: sum(paid),
      rejectedCount: rejected.length,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      const mentor = String(r?.mentorId?.name || r?.mentorId?.userId?.name || "").toLowerCase();
      const bank = String(r.payoutAccount?.bankName || "").toLowerCase();
      const acct = String(r.payoutAccount?.accountNumber || "").toLowerCase();
      const ref = String(r.transferRef || "").toLowerCase();
      return mentor.includes(q) || bank.includes(q) || acct.includes(q) || ref.includes(q);
    });
  }, [rows, filter, searchTerm]);

  return (
    <div className="min-w-0 max-w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 sm:space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex min-w-0 flex-col justify-between gap-4 lg:flex-row lg:items-start lg:gap-6"
      >
        <div className="min-w-0 flex-1">
          <h2 className="font-headline text-3xl font-black uppercase tracking-tighter text-slate-900">
            <span className="text-violet-700">Rút tiền</span> cố vấn
          </h2>
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
          <button
            type="button"
            onClick={() => void loadRows()}
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
              placeholder="Tìm cố vấn, ngân hàng, số tài khoản…"
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
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="rounded-2xl border border-orange-200 bg-orange-50/80 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-orange-900">Chờ duyệt</p>
          <p className="mt-1 text-2xl font-black text-orange-950">{summary.pendingCount}</p>
          <p className="mt-1 text-sm font-semibold text-orange-900">{vnd(summary.pendingAmount)}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-900">Chờ chuyển khoản</p>
          <p className="mt-1 text-2xl font-black text-amber-950">{summary.approvedCount}</p>
          <p className="mt-1 text-sm font-semibold text-amber-900">{vnd(summary.approvedAmount)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-900">Đã chi</p>
          <p className="mt-1 text-2xl font-black text-emerald-950">{summary.paidCount}</p>
          <p className="mt-1 text-sm font-semibold text-emerald-900">{vnd(summary.paidAmount)}</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-rose-800">Đã từ chối</p>
          <p className="mt-1 text-2xl font-black text-rose-700">{summary.rejectedCount}</p>
        </div>
      </motion.div>

      <AdminListFilterBar
        countText={
          loading ? "Đang tải…" : `Hiển thị ${filteredRows.length} / ${rows.length} yêu cầu`
        }
        showReset={filter !== "all"}
        onReset={() => setFilter("all")}
      >
        <AdminFilterSelect
          id="payout-status-filter"
          label="Trạng thái yêu cầu"
          value={filter}
          options={PAYOUT_FILTER_OPTIONS}
          onChange={setFilter}
        />
      </AdminListFilterBar>

      <div className="glass-card min-w-0 max-w-full overflow-hidden border-slate-200/90 [&:hover]:transform-none [&:hover]:shadow-[0_8px_18px_rgba(110,53,232,0.07)]">
        <div className="max-w-full overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-0 table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[14%]" />
              <col className="w-[24%]" />
              <col className="w-[10%]" />
              <col className="w-[18%]" />
              <col className="w-[16%]" />
              <col className="w-[18%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90">
                <th className={PAYOUT_TH}>Cố vấn</th>
                <th className={PAYOUT_TH}>Tài khoản nhận</th>
                <th className={`${PAYOUT_TH} text-right`}>Số tiền</th>
                <th className={`${PAYOUT_TH} text-center`}>Trạng thái</th>
                <th className={PAYOUT_TH}>Thời gian</th>
                <th className={`${PAYOUT_TH} text-right`}>Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className={`${PAYOUT_TD} py-20 text-center text-[10px] font-black uppercase italic tracking-widest text-slate-500`}
                  >
                    Đang tải yêu cầu rút tiền…
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className={`${PAYOUT_TD} py-20 text-center`}>
                    <Banknote className="mx-auto mb-3 h-10 w-10 text-slate-400" />
                    <p className="text-[10px] font-black uppercase italic tracking-widest text-slate-500">
                      Không có yêu cầu phù hợp
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const mentorName = row?.mentorId?.name || row?.mentorId?.userId?.name || "Cố vấn";
                  const isPending = row.status === "pending";
                  const isApproved = row.status === "approved";
                  const busy = busyId === row._id;
                  const acct = String(row.payoutAccount?.accountNumber || "").trim();
                  const bankName = String(row.payoutAccount?.bankName || "").trim();
                  const acctName = String(row.payoutAccount?.accountName || "").trim();
                  const transferLine = [bankName, acct, acctName].filter(Boolean).join(" · ");
                  const requestedAt = new Date(row.requestedAt || row.createdAt);

                  return (
                    <tr key={row._id} className="group transition-colors hover:bg-violet-50/40">
                      <td className={`${PAYOUT_TD} min-w-0`}>
                        <p className="truncate font-black text-slate-900" title={mentorName}>
                          {mentorName}
                        </p>
                        {row.rejectReason ? (
                          <p className="mt-1 line-clamp-2 whitespace-normal text-xs text-red-700" title={row.rejectReason}>
                            {row.rejectReason}
                          </p>
                        ) : null}
                      </td>
                      <td className={`${PAYOUT_TD} min-w-0`}>
                        <p className="font-medium text-slate-800">{bankName || "—"}</p>
                        <p className="mt-0.5 font-mono text-xs font-semibold text-slate-900 break-all">
                          {acct || "—"}
                        </p>
                        {acctName ? <p className="mt-0.5 text-xs text-slate-500">{acctName}</p> : null}
                        {acct ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            <button
                              type="button"
                              title="Sao chép số tài khoản"
                              onClick={() => copyAdminText(acct, "Đã sao chép số tài khoản.")}
                              className={copyIconBtn}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Sao chép cả dòng chuyển khoản"
                              onClick={() => copyAdminText(transferLine, "Đã sao chép.")}
                              className={`${copyIconBtn} border-violet-200 text-violet-700 hover:bg-violet-50`}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : null}
                      </td>
                      <td className={`${PAYOUT_TD} whitespace-nowrap text-right font-black text-violet-700`}>
                        {Number(row.amount || 0).toLocaleString("vi-VN")}{" "}
                        <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">đ</span>
                      </td>
                      <td className={`${PAYOUT_TD} align-top`}>
                        <div className="mx-auto flex justify-center py-0.5">
                          <PayoutStatusPill status={row.status} />
                        </div>
                      </td>
                      <td className={`${PAYOUT_TD} whitespace-nowrap text-slate-600`}>
                        <p className="text-xs font-medium">Yêu cầu</p>
                        <p className="font-mono text-xs">{requestedAt.toLocaleString("vi-VN")}</p>
                        {row.status === "paid" && row.paidAt ? (
                          <>
                            <p className="mt-2 text-xs font-medium text-emerald-800">Đã chi</p>
                            <p className="font-mono text-xs text-emerald-900">
                              {new Date(row.paidAt).toLocaleString("vi-VN")}
                            </p>
                            {row.transferRef ? (
                              <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500" title={row.transferRef}>
                                {row.transferRef}
                              </p>
                            ) : null}
                          </>
                        ) : null}
                      </td>
                      <td className={PAYOUT_TD}>
                        <div className="relative ml-auto flex w-full max-w-[5.5rem] justify-end gap-1">
                          {isPending ? (
                            <>
                              <PayoutActionSlot>
                                <button
                                  type="button"
                                  title="Duyệt yêu cầu rút tiền"
                                  disabled={busy}
                                  onClick={() => void handleApprove(row._id)}
                                  className="inline-flex size-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                                >
                                  <CheckCircle size={18} />
                                </button>
                              </PayoutActionSlot>
                              <PayoutActionSlot>
                                <button
                                  type="button"
                                  title="Từ chối yêu cầu"
                                  disabled={busy}
                                  onClick={() => handleReject(row._id)}
                                  className="inline-flex size-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                                >
                                  <XCircle size={18} />
                                </button>
                              </PayoutActionSlot>
                            </>
                          ) : isApproved ? (
                            <PayoutActionSlot>
                              <button
                                type="button"
                                title="Ghi nhận đã chuyển khoản cho cố vấn"
                                disabled={busy}
                                onClick={() =>
                                  setMarkPaidModal({
                                    open: true,
                                    payoutId: String(row._id),
                                    transferRef: "",
                                    note: "",
                                  })
                                }
                                className="inline-flex size-9 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 text-violet-700 transition hover:border-violet-300 hover:bg-violet-100 disabled:opacity-50"
                              >
                                <Banknote size={16} />
                              </button>
                            </PayoutActionSlot>
                          ) : (
                            <PayoutActionSlot />
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

      <AnimatePresence>
        {rejectModal.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
            onClick={() => setRejectModal({ open: false, payoutId: "", reasonKey: "account_invalid", note: "" })}
          >
            <motion.div
              initial={{ scale: 0.96, y: 12, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 12, opacity: 0 }}
              role="dialog"
              className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="text-lg font-bold text-slate-900">Từ chối yêu cầu rút tiền</h4>
              <p className="mt-2 text-sm text-slate-600">
                Chọn lý do chuẩn hóa và thêm ghi chú (nếu cần) để cố vấn nắm rõ nguyên nhân.
              </p>
              <label className="mt-4 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                Lý do từ chối
              </label>
              <div className="mt-2">
                <AppSelect
                  size="md"
                  value={rejectModal.reasonKey}
                  onValueChange={(v) => setRejectModal((prev) => ({ ...prev, reasonKey: v }))}
                  triggerClassName="rounded-2xl border-slate-200 bg-slate-50"
                  options={REJECT_REASON_OPTIONS.map((item) => ({
                    value: item.id,
                    label: item.label,
                  }))}
                />
              </div>
              <label className="mt-4 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                Ghi chú bổ sung (tùy chọn)
              </label>
              <textarea
                value={rejectModal.note}
                onChange={(e) => setRejectModal((prev) => ({ ...prev, note: e.target.value }))}
                rows={3}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none focus:border-violet-400"
                placeholder="Ví dụ: Vui lòng cập nhật STK khớp hồ sơ đã xác minh."
              />
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRejectModal({ open: false, payoutId: "", reasonKey: "account_invalid", note: "" })}
                  className="rounded-2xl border border-slate-200 bg-white py-3 text-[10px] font-black uppercase tracking-wider text-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => void confirmReject()}
                  disabled={busyId === rejectModal.payoutId}
                  className="rounded-2xl border border-red-200 bg-red-50 py-3 text-[10px] font-black uppercase tracking-wider text-red-800 disabled:opacity-50"
                >
                  {busyId === rejectModal.payoutId ? "Đang xử lý…" : "Xác nhận từ chối"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {markPaidModal.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
            onClick={() => {
              if (busyId === markPaidModal.payoutId) return;
              setMarkPaidModal({ open: false, payoutId: "", transferRef: "", note: "" });
            }}
          >
            <motion.div
              initial={{ scale: 0.96, y: 12, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 12, opacity: 0 }}
              role="dialog"
              className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="text-lg font-bold text-slate-900">Ghi nhận đã chuyển khoản</h4>
              <p className="mt-2 text-sm text-slate-600">Chỉ xác nhận sau khi đã chuyển tiền cho cố vấn.</p>
              <label className="mt-4 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                Mã / nội dung tham chiếu (tùy chọn)
              </label>
              <input
                type="text"
                value={markPaidModal.transferRef}
                onChange={(e) => setMarkPaidModal((prev) => ({ ...prev, transferRef: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none focus:border-violet-400"
                placeholder="Ví dụ: FT… hoặc nội dung sao kê"
              />
              <label className="mt-4 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                Ghi chú nội bộ (tùy chọn)
              </label>
              <textarea
                value={markPaidModal.note}
                onChange={(e) => setMarkPaidModal((prev) => ({ ...prev, note: e.target.value }))}
                rows={2}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none focus:border-violet-400"
                placeholder="Ghi chú cho lịch sử admin…"
              />
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={Boolean(busyId)}
                  onClick={() => setMarkPaidModal({ open: false, payoutId: "", transferRef: "", note: "" })}
                  className="rounded-2xl border border-slate-200 bg-white py-3 text-[10px] font-black uppercase tracking-wider text-slate-700 disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => void confirmMarkPaid()}
                  disabled={busyId === markPaidModal.payoutId}
                  className="rounded-2xl border border-emerald-200 bg-emerald-50 py-3 text-[10px] font-black uppercase tracking-wider text-emerald-800 disabled:opacity-50"
                >
                  {busyId === markPaidModal.payoutId ? "Đang xử lý…" : "Xác nhận đã chi"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** @deprecated — dùng `AdminBookingDetail.jsx` */
export { AdminBookingDetail } from "./AdminBookingDetail.jsx";

const INTERVIEW_STATUS_VI = {
  in_progress: "Đang diễn ra",
  completed: "Hoàn thành",
  abandoned: "Bỏ dở",
};

const SESSION_STATUS_OPTIONS = [
  { id: "all", label: "Tất cả" },
  { id: "completed", label: "Hoàn thành" },
  { id: "in_progress", label: "Đang diễn ra" },
  { id: "abandoned", label: "Bỏ dở" },
];

function formatSessionWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminContentQuestions() {
  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [statsRes, sessionsRes] = await Promise.all([
      tryApi(() => adminApi.getContentStats(), {
        fallback: "Không tải được thống kê nội dung.",
        silent: true,
      }),
      tryApi(() => adminApi.getRecentInterviewSessions(30), {
        fallback: "Không tải được danh sách phiên phỏng vấn.",
      }),
    ]);
    if (statsRes.success) setStats(statsRes.content || null);
    if (sessionsRes.success) setSessions(sessionsRes.sessions || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const totalSessions = Number(stats?.interviewSessions ?? 0);
  const completed = Number(stats?.completedInterviews ?? 0);

  const filteredSessions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return sessions.filter((s) => {
      const statusKey = String(s.status || "").toLowerCase();
      if (statusFilter !== "all" && statusKey !== statusFilter) return false;
      if (!q) return true;
      const name = String(s.user?.name || "").toLowerCase();
      const email = String(s.user?.email || "").toLowerCase();
      const role = String(s.role || "").toLowerCase();
      return name.includes(q) || email.includes(q) || role.includes(q);
    });
  }, [sessions, searchTerm, statusFilter]);

  return (
    <div className={adminPageWrap}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={adminHeaderRow}>
        <div className="min-w-0 flex-1">
          <h2 className="font-headline text-3xl font-black uppercase tracking-tighter text-slate-900">
            <span className="text-violet-700">Câu hỏi</span> phỏng vấn AI
          </h2>
        </div>
        <AdminPageToolbar
          loading={loading}
          onRefresh={() => void loadAll()}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Tìm học viên, email…"
        />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={adminStatGrid4}>
        <div className="rounded-2xl border border-violet-200 bg-violet-50/80 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-violet-900">Phiên phỏng vấn AI</p>
          <p className="mt-1 text-2xl font-black text-violet-950">{totalSessions}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-900">Đã hoàn thành</p>
          <p className="mt-1 text-2xl font-black text-emerald-950">{completed}</p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-sky-900">Phân tích CV</p>
          <p className="mt-1 text-2xl font-black text-sky-950">{stats?.cvAnalyses ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-teal-200 bg-teal-50/80 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-teal-900">Khóa đã xuất bản</p>
          <p className="mt-1 text-2xl font-black text-teal-950">{stats?.publishedCourses ?? 0}</p>
        </div>
      </motion.div>

      <AdminListFilterBar
        countText={`Hiển thị ${filteredSessions.length} / ${sessions.length} phiên`}
        showReset={Boolean(searchTerm.trim()) || statusFilter !== "all"}
        onReset={() => {
          setSearchTerm("");
          setStatusFilter("all");
        }}
      >
        <AdminFilterSelect
          id="interview-session-status"
          label="Trạng thái phiên"
          value={statusFilter}
          options={SESSION_STATUS_OPTIONS}
          onChange={setStatusFilter}
        />
      </AdminListFilterBar>

      <div className={adminGlassTable}>
        <div className="max-w-full overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-0 table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[4%]" />
              <col className="w-[24%]" />
              <col className="w-[18%]" />
              <col className="w-[10%]" />
              <col className="w-[18%]" />
              <col className="w-[26%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90">
                <th className={adminThCell} />
                <th className={adminThCell}>Học viên</th>
                <th className={adminThCell}>Vai trò / cấp</th>
                <th className={`${adminThCell} text-center`}>Số câu</th>
                <th className={adminThCell}>Trạng thái</th>
                <th className={adminThCell}>Thời gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className={`${adminTdCell} py-20 text-center text-[10px] font-black uppercase italic tracking-widest text-slate-500`}
                  >
                    Đang tải…
                  </td>
                </tr>
              ) : filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className={`${adminTdCell} py-16 text-center text-slate-500`}>
                    {sessions.length === 0 ? "Chưa có phiên." : "Không có kết quả."}
                  </td>
                </tr>
              ) : (
                filteredSessions.map((row) => {
                  const open = expandedId === row.id;
                  const statusKey = String(row.status || "").toLowerCase();
                  return (
                    <React.Fragment key={row.id}>
                      <tr className="hover:bg-violet-50/30">
                        <td className={adminTdCell}>
                            <button
                              type="button"
                              onClick={() => setExpandedId(open ? null : row.id)}
                              className="flex size-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-violet-50 hover:text-violet-700"
                              aria-expanded={open}
                              aria-label="Xem câu hỏi"
                            >
                              <ChevronDown
                                className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
                              />
                            </button>
                        </td>
                        <td className={adminTdCell}>
                          <div className="flex items-center gap-3">
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                                <User className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-900">
                                  {row.user?.name || "—"}
                                </p>
                                <p className="truncate text-xs text-slate-500">{row.user?.email || ""}</p>
                              </div>
                          </div>
                        </td>
                        <td className={`${adminTdCell} truncate text-slate-700`}>{row.role}</td>
                        <td className={`${adminTdCell} text-center`}>
                            <span className="font-black text-violet-700">{row.questionCount}</span>
                            {row.questionsAllowed != null ? (
                              <span className="text-xs text-slate-400"> / {row.questionsAllowed}</span>
                            ) : null}
                        </td>
                        <td className={adminTdCell}>
                          <StatusPill
                              label={INTERVIEW_STATUS_VI[statusKey] || row.status || "—"}
                              toneClass={
                                statusKey === "completed"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                  : statusKey === "in_progress"
                                    ? "border-sky-200 bg-sky-50 text-sky-800"
                                    : statusKey === "abandoned"
                                      ? "border-rose-200 bg-rose-50 text-rose-700"
                                      : "border-slate-200 bg-slate-50 text-slate-600"
                              }
                          />
                        </td>
                        <td className={`${adminTdCell} whitespace-nowrap text-slate-600`}>
                          {formatSessionWhen(row.createdAt)}
                        </td>
                      </tr>
                      {open ? (
                        <tr className="bg-violet-50/20">
                          <td colSpan={6} className="px-6 py-4">
                              {row.questions?.length > 0 ? (
                                <ol className="space-y-3">
                                  {row.questions.map((q) => (
                                    <li
                                      key={`${row.id}-${q.index}`}
                                      className="rounded-md border border-violet-100 bg-white px-4 py-3"
                                    >
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                                        Câu {q.index}
                                      </p>
                                      <p className="mt-1 text-sm leading-relaxed text-slate-800">
                                        {q.question || "—"}
                                      </p>
                                    </li>
                                  ))}
                                </ol>
                              ) : (
                                <p className="text-sm text-slate-500">Chưa có câu hỏi lưu trên máy chủ.</p>
                              )}
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
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

export { AdminContentCourses } from "./AdminContentCourses.jsx";

export function AdminSystemSettings() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await tryApi(() => adminApi.getSystemOverview(), {
        fallback: "Không tải được cấu hình hệ thống.",
        silent: true,
      });
      if (res.success) setOverview(res.overview || null);
      setLoading(false);
    })();
  }, []);

  return (
    <AdminPanel title="Cài đặt hệ thống" description="Tổng quan cấu hình auth, gói cước và dịch vụ.">
      {loading ? (
        <p className="text-sm text-slate-500">Đang tải…</p>
      ) : overview ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-bold text-slate-900">Xác thực & phiên</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              <li>Access token TTL: <code>{overview.auth?.accessTokenTtl}</code></li>
              <li>Refresh token: <code>{overview.auth?.refreshTokenDays}</code> ngày</li>
              <li>Blacklist JTI khi logout: {overview.auth?.jtiBlacklistOnLogout ? "Bật" : "Tắt"}</li>
              <li>Blacklist JTI khi refresh: {overview.auth?.jtiBlacklistOnRefresh ? "Bật" : "Tắt"}</li>
              <li>Fingerprint phiên (prod strict): {overview.auth?.sessionFingerprintEnforced ? "Bật" : "Tắt"}</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-bold text-slate-900">Gói cước & quota</p>
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500">
                    <th className="py-2 pr-4">Gói</th>
                    <th className="py-2 pr-4">CV/tháng</th>
                    <th className="py-2">Phỏng vấn AI</th>
                  </tr>
                </thead>
                <tbody>
                  {(overview.plans || []).map((p) => (
                    <tr key={p.key} className="border-t border-slate-100">
                      <td className="py-2 pr-4 font-medium">{p.label || p.key}</td>
                      <td className="py-2 pr-4">{p.cvAnalysisLimit}</td>
                      <td className="py-2">{p.interviewLimit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-bold text-slate-900">Thanh toán</p>
            <p className="mt-1">{overview.payments?.note}</p>
            <p className="mt-2 text-xs">Kênh chính: {overview.payments?.primaryChannel}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="font-bold text-slate-900">Dịch vụ tích hợp</p>
            <p className="mt-1">CV analyzer: {overview.services?.cvAnalyzer}</p>
            <p>LLM phỏng vấn: {overview.services?.llm}</p>
            <p className="mt-2 font-bold text-slate-900">MongoDB</p>
            <pre className="mt-1 overflow-auto text-xs">{JSON.stringify(overview.mongo, null, 2)}</pre>
          </div>
        </div>
      ) : (
        <p className="text-sm text-red-600">Không tải được cấu hình.</p>
      )}
    </AdminPanel>
  );
}

/** @deprecated — dùng `AdminSupport.jsx` */
export { AdminSupport } from "./AdminSupport.jsx";

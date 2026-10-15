import React, { useEffect, useState, useMemo } from "react";
import { AccountReveal } from "../../components/account/AccountMotion";
import {
  Receipt,
  Download,
  CreditCard,
  Video,
  BookOpen,
  Sparkles,
  Filter,
  RefreshCw,
  FileText,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Wallet,
  Copy,
  Check,
  RotateCcw,
  X,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import { motion } from "motion/react";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";
import { financeRequest, downloadInvoice } from "../../api/financeOperationsApi.js";
import { AppSelect } from "../../components/ui/AppSelect";
import { formatVnd } from "../../utils/shared/formatVnd.js";
import {
  BANK_TRANSFER,
  displayBankName,
  inferVietQrBankId,
  buildVietQrImageUrl,
} from "../../utils/shared/bankTransfer.js";

const types = {
  booking: "Buổi mentor 1:1",
  course: "Khóa học video",
  subscription: "Gói nâng cấp Pro/Elite",
};

const typeIcons = {
  booking: {
    icon: Video,
    color: "text-violet-300",
    bg: "bg-violet-500/20 ring-violet-500/30",
    glow: "shadow-[0_0_20px_rgba(139,92,246,0.25)]",
  },
  course: {
    icon: BookOpen,
    color: "text-sky-300",
    bg: "bg-sky-500/20 ring-sky-500/30",
    glow: "shadow-[0_0_20px_rgba(56,189,248,0.25)]",
  },
  subscription: {
    icon: Sparkles,
    color: "text-amber-300",
    bg: "bg-amber-500/20 ring-amber-500/30",
    glow: "shadow-[0_0_20px_rgba(245,158,11,0.25)]",
  },
};

const statuses = {
  pending: { label: "Chờ thanh toán", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", dot: "bg-amber-400" },
  success: { label: "Đã thanh toán", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", dot: "bg-emerald-400" },
  failed: { label: "Thất bại", cls: "bg-rose-500/15 text-rose-300 border-rose-500/30", dot: "bg-rose-400" },
  cancelled: { label: "Đã hủy", cls: "bg-slate-500/20 text-slate-300 border-slate-500/30", dot: "bg-slate-400" },
  refund_pending: { label: "Chờ hoàn tiền", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", dot: "bg-amber-400" },
  refunded: { label: "Đã hoàn tiền", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30", dot: "bg-sky-400" },
  partial_refund: { label: "Hoàn một phần", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30", dot: "bg-sky-400" },
  held_inactive_account: { label: "Đang đối soát", cls: "bg-violet-500/15 text-violet-300 border-violet-500/30", dot: "bg-violet-400" },
};

const STATUS_TABS = [
  { id: "", label: "Tất cả" },
  { id: "success", label: "Đã thanh toán" },
  { id: "pending", label: "Chờ thanh toán" },
  { id: "cancelled", label: "Đã hủy" },
];

/* ─── Animated Number Counter ───────────────────────────────── */
function AnimatedNumber({ value, duration = 1 }) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValueRef = React.useRef(0);

  useEffect(() => {
    const start = prevValueRef.current;
    const end = Math.round(Number(value) || 0);
    prevValueRef.current = end;

    if (start === end) {
      setDisplayValue(end);
      return;
    }

    const startTime = performance.now();
    const durationMs = Math.max(300, duration * 1000);

    let frameId;
    const update = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * ease);
      setDisplayValue(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(update);
      } else {
        setDisplayValue(end);
      }
    };

    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, [value, duration]);

  return <>{displayValue.toLocaleString("vi-VN")}</>;
}

/* ─── Code Copy Button ───────────────────────────────────────── */
function CopyableRef({ code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    if (!code) return;
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Nhấn để sao chép mã giao dịch"
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] hover:bg-white/[0.12] px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
    >
      <span>#{String(code).slice(-8).toUpperCase()}</span>
      {copied ? (
        <Check className="size-3 text-emerald-400" />
      ) : (
        <Copy className="size-3 text-slate-400 hover:text-slate-200" />
      )}
    </button>
  );
}

/* ─── Skeleton Card Component ───────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/10 bg-gradient-to-b from-[#181538]/40 to-[#0e0c22]/50 p-5 shadow-lg space-y-4">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 shrink-0 rounded-2xl bg-white/10" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/3 rounded bg-white/10" />
          <div className="h-3 w-1/2 rounded bg-white/10" />
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="h-6 w-28 rounded-lg bg-white/10" />
          <div className="h-5 w-20 rounded-md bg-white/10" />
        </div>
      </div>
    </div>
  );
}

/* ─── Pending Payment VietQR Modal ──────────────────────────── */
function PendingPaymentModal({ payment, onClose, onRefresh }) {
  const [copiedKey, setCopiedKey] = useState("");

  const copy = (key, text) => {
    if (!text) return;
    navigator.clipboard?.writeText(String(text)).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(""), 2000);
    }).catch(() => {});
  };

  // Live 15-minute countdown calculation
  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    if (!payment.createdAt) return 15 * 60;
    const createdTime = new Date(payment.createdAt).getTime();
    const expiresTime = createdTime + 15 * 60 * 1000;
    return Math.max(0, Math.floor((expiresTime - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!payment.createdAt) return;
    const tick = () => {
      const createdTime = new Date(payment.createdAt).getTime();
      const expiresTime = createdTime + 15 * 60 * 1000;
      const left = Math.max(0, Math.floor((expiresTime - Date.now()) / 1000));
      setRemainingSeconds(left);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [payment.createdAt]);

  const formatCountdown = (totalSec) => {
    if (totalSec <= 0) return "00:00";
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const isExpired = remainingSeconds <= 0;

  const vietQrBankId = inferVietQrBankId();
  const transferOrderNum = payment.providerRef || payment.id;
  const vietQrUrl = buildVietQrImageUrl(
    vietQrBankId,
    BANK_TRANSFER.accountNumber,
    payment.amount,
    transferOrderNum
  );

  return (
    <div
      className="fixed inset-0 z-[200] overflow-y-auto p-3 sm:p-5 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md"
        onClick={onClose}
        aria-label="Đóng"
      />
      <div className="relative z-10 w-full max-w-[660px] my-auto uiverse-payment-card-wrap">
        <div className="cart-payment-main-card p-5 sm:p-7 relative text-slate-200">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white transition-colors"
          aria-label="Đóng"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div className="border-b border-white/10 pb-3.5 pr-8">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                isExpired
                  ? "border-rose-500/40 bg-rose-950/40 text-rose-300"
                  : "border-amber-500/40 bg-amber-500/15 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]"
              }`}
            >
              <Clock className="size-3.5 text-amber-400" />
              {isExpired ? (
                <span>Đơn đã hết hạn thanh toán</span>
              ) : (
                <span>
                  Thời gian thanh toán còn lại:{" "}
                  <strong className="font-mono text-sm font-black text-amber-200">
                    {formatCountdown(remainingSeconds)}
                  </strong>
                </span>
              )}
            </span>
          </div>

          <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
            Thanh toán {types[payment.type] || payment.type}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Mã giao dịch: <span className="font-mono font-bold text-violet-300">#{transferOrderNum}</span>
          </p>
        </div>

        {/* Modal Body: 2 Columns on desktop/laptop */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-[210px_1fr] gap-4 sm:gap-6 items-center">
          {/* Left Column: QR Code with Apple Laser & HUD brackets */}
          <div className="flex flex-col items-center justify-center">
            {vietQrUrl && !isExpired ? (
              <div className="cart-payment-qr-wrap w-[190px] sm:w-[210px]">
                <div className="cart-qr-corner cart-qr-corner--tl" />
                <div className="cart-qr-corner cart-qr-corner--tr" />
                <div className="cart-qr-corner cart-qr-corner--bl" />
                <div className="cart-qr-corner cart-qr-corner--br" />
                <div className="cart-payment-qr-laser" />
                <img
                  src={vietQrUrl}
                  alt="VietQR thanh toán"
                  className="cart-payment-qr-img w-full"
                  loading="eager"
                />
              </div>
            ) : isExpired ? (
              <div className="w-[190px] sm:w-[210px] rounded-2xl border border-rose-500/30 bg-rose-950/30 p-4 text-center text-xs text-rose-300">
                <p className="font-bold">Đã hết hạn</p>
                <p className="mt-1 text-[11px] text-rose-400">Vui lòng đặt lại để lấy mã mới.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-center text-xs text-slate-400">
                Chưa có mã QR. Chuyển khoản theo thông tin bên cạnh.
              </div>
            )}
            <p className="mt-2.5 text-center text-[10.5px] text-slate-400">
              Quét mã bằng app ngân hàng
            </p>
          </div>

          {/* Right Column: Apple Frosted Bank Details */}
          <div className="cart-bank-fields-list">
            <div className="cart-bank-field-card">
              <span className="cart-field-label">Ngân hàng</span>
              <div className="cart-field-val-row">
                <span className="cart-field-val font-semibold text-white">
                  {displayBankName(BANK_TRANSFER.bankName)}
                </span>
              </div>
            </div>

            <div className="cart-bank-field-card">
              <span className="cart-field-label">Số tài khoản</span>
              <div className="cart-field-val-row">
                <span className="cart-field-val font-mono text-base font-bold text-violet-300">
                  {BANK_TRANSFER.accountNumber}
                </span>
                <button
                  type="button"
                  onClick={() => copy("acc", BANK_TRANSFER.accountNumber)}
                  className={`cart-copy-btn ${copiedKey === "acc" ? "copied" : ""}`}
                >
                  {copiedKey === "acc" ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                  <span>{copiedKey === "acc" ? "Đã chép" : "Sao chép"}</span>
                </button>
              </div>
            </div>

            {BANK_TRANSFER.accountOwner ? (
              <div className="cart-bank-field-card">
                <span className="cart-field-label">Chủ tài khoản</span>
                <div className="cart-field-val-row">
                  <span className="cart-field-val font-medium uppercase text-slate-200">
                    {BANK_TRANSFER.accountOwner}
                  </span>
                </div>
              </div>
            ) : null}

            <div className="cart-bank-field-card">
              <span className="cart-field-label">Số tiền</span>
              <div className="cart-field-val-row">
                <span className="cart-field-val font-mono text-lg font-bold text-white">
                  {formatVnd(payment.amount)}
                </span>
                <button
                  type="button"
                  onClick={() => copy("amt", payment.amount)}
                  className={`cart-copy-btn ${copiedKey === "amt" ? "copied" : ""}`}
                >
                  {copiedKey === "amt" ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                  <span>{copiedKey === "amt" ? "Đã chép" : "Sao chép"}</span>
                </button>
              </div>
            </div>

            <div className="cart-bank-field-card cart-bank-field-card--memo">
              <div className="flex items-center justify-between">
                <span className="cart-field-label">Nội dung CK</span>
                <span className="cart-memo-badge">
                  <span className="cart-memo-beacon"></span>
                  Bắt buộc chính xác
                </span>
              </div>
              <div className="cart-field-val-row">
                <span className="cart-field-val font-mono text-base font-bold text-violet-300">
                  {transferOrderNum}
                </span>
                <button
                  type="button"
                  onClick={() => copy("ref", transferOrderNum)}
                  className={`cart-copy-btn cart-copy-btn--memo ${copiedKey === "ref" ? "copied" : ""}`}
                >
                  {copiedKey === "ref" ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                  <span>{copiedKey === "ref" ? "Đã chép" : "Sao chép"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="mt-5 pt-3.5 border-t border-white/10 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onRefresh}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/30 hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            Tôi đã chuyển khoản — Kiểm tra trạng thái
          </button>
          <div className="flex items-center justify-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <p className="text-center text-[10.5px] text-slate-400">
              Hệ thống đang tự động kiểm tra giao dịch chuyển khoản realtime…
            </p>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Payment History Page ─────────────────────────────── */
export function PaymentHistory() {
  const navigate = useNavigate();
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedPendingPayment, setSelectedPendingPayment] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    financeRequest(`/api/payments/history?${new URLSearchParams({ page, limit: 20, type, status })}`)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Không thể tải lịch sử giao dịch.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [type, status, page, revision]);

  const download = async (row, grouped = false) => {
    setBusy(row.id);
    setError("");
    try {
      await downloadInvoice(
        grouped ? `/api/cart/orders/${row.cartOrderId}/invoice` : `/api/payments/${row.id}/invoice`,
        `hoa-don-${grouped ? row.cartOrderId : row.id}.pdf`
      );
    } catch (err) {
      setError(err.message || "Lỗi khi tải hóa đơn PDF.");
    } finally {
      setBusy("");
    }
  };

  const totalCount = data?.pagination?.total || data?.payments?.length || 0;

  // Compute metrics from current data
  const metrics = useMemo(() => {
    const list = data?.payments || [];
    let successAmount = 0;
    let successCount = 0;
    let pendingCount = 0;
    let cancelledCount = 0;

    for (const item of list) {
      if (item.status === "success") {
        successAmount += Number(item.amount) || 0;
        successCount++;
      } else if (item.status === "pending") {
        pendingCount++;
      } else if (item.status === "cancelled") {
        cancelledCount++;
      }
    }

    return {
      successAmount,
      successCount,
      pendingCount,
      cancelledCount,
      rate: list.length > 0 ? Math.round((successCount / list.length) * 100) : 0,
    };
  }, [data]);

  const resetFilters = () => {
    setType("");
    setStatus("");
    setPage(1);
  };

  const hasActiveFilters = Boolean(type || status);

  return (
    <div className="payment-history-page relative min-h-screen w-full bg-transparent text-slate-100 selection:bg-violet-500/30 selection:text-violet-200 overflow-x-hidden">
      <div className={`${CUSTOMER_SHELL_GUTTER} pb-24 pt-8 sm:pt-12 relative`}>
        <div className={`${CUSTOMER_SHELL_MAX} w-full space-y-8`}>

          {/* ── Luxury Header ── */}
          <motion.div
            className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-white/10 pb-6"
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-violet-100 to-indigo-200">
                  Lịch sử thanh toán
                </h1>

                {totalCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-500/20 px-3 py-0.5 text-xs font-bold text-violet-200 shadow-[0_0_12px_rgba(139,92,246,0.3)]">
                    <span className="size-1.5 rounded-full bg-violet-400 animate-pulse" />
                    {totalCount} giao dịch
                  </span>
                )}
              </div>

              <p className="text-xs sm:text-sm font-medium text-slate-300/80">
                Tra cứu toàn bộ lịch sử thanh toán, theo dõi trạng thái và tải hóa đơn PDF của bạn.
              </p>
            </div>
          </motion.div>

          {/* ── Prominent Hero Metrics Scoreboard ── */}
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.1, delayChildren: 0.05 },
              },
            }}
          >
            {/* Card 1: Tổng chi tiêu thành công */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 16 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
              }}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="relative overflow-hidden rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-[#0c2424]/90 via-[#0e1c2b]/85 to-[#0b1324]/90 p-5 shadow-[0_12px_32px_rgba(5,15,25,0.4)] backdrop-blur-xl transition-all duration-300 hover:border-emerald-400/50 hover:shadow-[0_16px_40px_rgba(16,185,129,0.22)]"
            >
              <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-emerald-500/15 blur-2xl" />
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30">
                    <Wallet size={15} />
                  </span>
                  Chi tiêu thành công
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                  <Sparkles size={11} /> Đã thanh toán
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-emerald-100 to-teal-200 tabular-nums">
                  {formatVnd(metrics.successAmount)}
                </span>
              </div>
              <p className="mt-2 text-xs text-emerald-300/70 font-medium">
                {metrics.successCount > 0
                  ? `${metrics.successCount} giao dịch hoàn tất thành công`
                  : "Chưa có giao dịch hoàn tất trên trang"}
              </p>
            </motion.div>

            {/* Card 2: Tỉ lệ hoàn tất giao dịch */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 16 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
              }}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="relative overflow-hidden rounded-2xl border border-violet-400/30 bg-gradient-to-br from-[#23174a]/90 via-[#18133b]/85 to-[#120f2e]/90 p-5 shadow-[0_12px_32px_rgba(10,8,30,0.4)] backdrop-blur-xl transition-all duration-300 hover:border-violet-400/50 hover:shadow-[0_16px_40px_rgba(124,58,237,0.22)]"
            >
              <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-violet-500/15 blur-2xl" />
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-violet-500/20 text-violet-300 ring-1 ring-violet-400/30">
                    <CheckCircle2 size={15} />
                  </span>
                  Giao dịch hoàn tất
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-500/20 px-2.5 py-0.5 text-[10px] font-bold text-violet-300">
                  {metrics.rate}% tỉ lệ
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-violet-200 to-indigo-200 tabular-nums">
                  <AnimatedNumber value={metrics.successCount} />
                </span>
                <span className="text-sm font-bold text-violet-300/70">
                  / {data?.payments?.length || 0} đơn đang xem
                </span>
              </div>
              <div className="mt-3">
                <div className="h-1.5 w-full rounded-full bg-slate-900/80 overflow-hidden border border-white/5">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-400 to-emerald-400 shadow-[0_0_10px_rgba(124,58,237,0.5)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${metrics.rate}%` }}
                    transition={{ duration: 0.85, ease: "easeOut" }}
                  />
                </div>
              </div>
            </motion.div>

            {/* Card 3: Quản lý & Hóa đơn VAT */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 16 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
              }}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#1b193b]/90 via-[#13112c]/85 to-[#0e0c24]/90 p-5 shadow-[0_12px_32px_rgba(10,8,30,0.4)] backdrop-blur-xl transition-all duration-300 hover:border-violet-400/40"
            >
              <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-indigo-500/15 blur-2xl" />
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-400/30">
                    <Receipt size={15} />
                  </span>
                  Hóa đơn & Dịch vụ
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                  PDF hợp lệ
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black text-white tabular-nums">
                  <AnimatedNumber value={totalCount} />
                </span>
                <span className="text-xs text-slate-400 font-medium">toàn bộ lịch sử</span>
              </div>
              <div className="pt-3">
                <Link
                  to="/courses"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-violet-400/40 border-t-white/45 bg-gradient-to-b from-violet-500/80 via-violet-600/70 to-indigo-700/80 px-4 py-2.5 text-xs font-bold text-white shadow-[0_4px_16px_rgba(124,58,237,0.45),inset_0_1px_1px_rgba(255,255,255,0.3)] backdrop-blur-md hover:brightness-110 active:scale-[0.98] transition-all"
                >
                  <Sparkles size={14} />
                  Khám phá thêm khóa học
                </Link>
              </div>
            </motion.div>
          </motion.div>

          {/* ── Floating Glass Segmented Dock Toolbar ── */}
          <motion.div
            className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
          >
            {/* Apple-style Segmented Glass Dock for Status */}
            <div
              className="relative flex items-center p-1 sm:p-1.5 rounded-2xl border border-white/15 bg-gradient-to-b from-[#1c183d]/85 via-[#14122e]/90 to-[#0e0c24]/95 shadow-[0_8px_32px_rgba(5,3,20,0.5),inset_0_1px_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl w-full sm:w-auto overflow-x-auto no-scrollbar"
              role="tablist"
              aria-label="Lọc trạng thái thanh toán"
            >
              {STATUS_TABS.map((tabItem) => {
                const isSelected = status === tabItem.id;
                return (
                  <button
                    key={tabItem.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => {
                      setStatus(tabItem.id);
                      setPage(1);
                    }}
                    className={`relative z-10 flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold tracking-tight transition-all duration-200 cursor-pointer whitespace-nowrap select-none ${
                      isSelected ? "text-white font-bold" : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                    }`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="payment-status-dock-glow"
                        className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/[0.18] via-white/[0.08] to-transparent border border-white/20 border-t-white/35 shadow-[0_4px_16px_rgba(0,0,0,0.45),0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.25)] backdrop-blur-md"
                        transition={{ type: "spring", stiffness: 450, damping: 35 }}
                      />
                    )}
                    <span className="relative z-20">{tabItem.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Right side: Type Filter + Refresh */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Type Select */}
              <div className="w-full sm:w-64">
                <AppSelect
                  aria-label="Loại giao dịch"
                  theme="dark"
                  size="default"
                  icon={Filter}
                  value={type}
                  onValueChange={(val) => {
                    setType(val);
                    setPage(1);
                  }}
                  triggerClassName="min-h-[46px] h-[46px] rounded-2xl border border-white/15 bg-gradient-to-b from-[#1c183d]/85 via-[#14122e]/90 to-[#0e0c22]/95 shadow-[0_8px_32px_rgba(5,3,20,0.5),inset_0_1px_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl text-xs sm:text-sm font-semibold text-slate-100 hover:border-violet-400/40 transition-all px-4"
                  options={[
                    { value: "", label: "Tất cả loại giao dịch" },
                    ...Object.entries(types).map(([val, label]) => ({ value: val, label })),
                  ]}
                />
              </div>

              {/* Refresh button */}
              <button
                type="button"
                className="inline-flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl border border-white/15 border-t-white/30 bg-gradient-to-b from-white/[0.12] via-white/[0.05] to-transparent shadow-[0_8px_32px_rgba(5,3,20,0.5),inset_0_1px_1px_rgba(255,255,255,0.15)] backdrop-blur-2xl text-slate-300 hover:text-white hover:border-white/30 hover:shadow-[0_0_20px_rgba(124,58,237,0.3)] active:scale-95 transition-all cursor-pointer"
                onClick={() => setRevision((n) => n + 1)}
                title="Tải lại danh sách"
                aria-label="Tải lại danh sách"
              >
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </motion.div>

          {/* ── Error Banner ── */}
          {error && (
            <div className="payment-history-error flex items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm font-semibold text-rose-300">
              <AlertCircle className="size-5 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Loading Skeleton ── */}
          {loading && (
            <div className="space-y-3.5">
              {[0, 1, 2, 3].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {/* ── Empty State ── */}
          {!loading && !error && data?.payments?.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35 }}
              className="payment-history-empty rounded-3xl border border-dashed border-violet-500/30 bg-violet-950/20 py-16 px-6 text-center backdrop-blur-xl"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-900/40 text-violet-300 ring-4 ring-violet-500/20 shadow-[0_0_24px_rgba(139,92,246,0.3)]">
                <Receipt className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-black text-white">Chưa có giao dịch phù hợp</h3>
              <p className="mt-1.5 max-w-md mx-auto text-xs sm:text-sm text-slate-400">
                Không tìm thấy giao dịch nào khớp với bộ lọc hiện tại. Các đơn mua khóa học hoặc lịch mentor sẽ hiển thị tại đây.
              </p>
              {hasActiveFilters && (
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs px-4 py-2.5 shadow-lg transition-all cursor-pointer"
                  >
                    <RotateCcw size={14} />
                    Xem tất cả giao dịch
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Double-Bezel Luxury Transactions List ── */}
          {!loading && !error && data?.payments?.length > 0 && (
            <div className="space-y-3.5">
              {data.payments.map((row, index) => {
                const typeInfo = typeIcons[row.type] || {
                  icon: CreditCard,
                  color: "text-violet-300",
                  bg: "bg-violet-500/20 ring-violet-500/30",
                  glow: "shadow-[0_0_20px_rgba(139,92,246,0.25)]",
                };
                const IconComponent = typeInfo.icon || CreditCard;
                const isPaid = row.status === "success";
                const isExpiredPending =
                  row.status === "pending" &&
                  row.createdAt &&
                  new Date(row.createdAt).getTime() + 15 * 60 * 1000 < Date.now();
                const statusInfo = isExpiredPending
                  ? {
                      label: "Đã hết hạn",
                      cls: "bg-rose-500/15 text-rose-300 border-rose-500/30",
                      dot: "bg-rose-400",
                    }
                  : statuses[row.status] || {
                      label: row.status,
                      cls: "bg-slate-500/20 text-slate-300 border-slate-500/30",
                      dot: "bg-slate-400",
                    };

                return (
                  <AccountReveal
                    as="article"
                    key={row.id}
                    index={index}
                    onClick={() => {
                      if (row.status === "pending" && !isExpiredPending) {
                        setSelectedPendingPayment(row);
                      }
                    }}
                    className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#181538]/75 via-[#13112c]/80 to-[#0e0c22]/90 p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-2xl hover:border-violet-400/40 hover:shadow-[0_16px_40px_rgba(124,58,237,0.2)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${
                      row.status === "pending" && !isExpiredPending ? "cursor-pointer" : ""
                    }`}
                  >
                    {/* Ambient subtle glow on hover */}
                    <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-600/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    {/* Left: Glowing Icon + Details */}
                    <div className="flex items-center gap-4 min-w-0 flex-1 relative z-10">
                      <div
                        className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl ${typeInfo.bg} ${typeInfo.glow} ring-1 ring-white/15 transition-transform duration-300 group-hover:scale-105`}
                      >
                        <IconComponent className={`h-6 w-6 ${typeInfo.color}`} strokeWidth={2.2} />
                      </div>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h4 className="font-extrabold text-white text-base sm:text-lg group-hover:text-violet-100 transition-colors">
                            {types[row.type] || row.type}
                          </h4>
                          <CopyableRef code={row.providerRef || row.id} />
                        </div>

                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-slate-400 font-medium">
                          <span className="inline-flex items-center gap-1.5 text-slate-300">
                            <Calendar className="size-3.5 text-violet-400" />
                            {new Date(row.paidAt || row.createdAt).toLocaleString("vi-VN")}
                          </span>

                          {row.cartOrderId && (
                            <Link
                              to={`/cart?order=${row.cartOrderId}`}
                              className="inline-flex items-center gap-1 font-semibold text-violet-300 hover:text-violet-200 hover:underline transition-colors"
                            >
                              Xem đơn nhiều khóa
                              <ArrowUpRight className="size-3" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Price, Status Badge & PDF Actions */}
                    <div className="flex flex-col sm:items-end gap-3 shrink-0 pt-3 border-t border-dashed border-white/10 sm:border-0 sm:pt-0 relative z-10">
                      <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                        <strong className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-violet-100 to-indigo-200 tracking-tight tabular-nums">
                          {formatVnd(row.amount)}
                        </strong>

                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide shadow-sm ${statusInfo.cls}`}
                        >
                          <span className={`size-1.5 rounded-full ${statusInfo.dot} ${row.status === "pending" && !isExpiredPending ? "animate-ping" : ""}`} />
                          {statusInfo.label}
                        </span>
                      </div>

                      {/* Actions: Thanh toán ngay when pending & valid, Đặt lại when expired, PDF Invoice when paid */}
                      {row.status === "pending" && !isExpiredPending && (
                        <div className="flex flex-wrap gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (row.cartOrderId) {
                                navigate(`/cart?order=${row.cartOrderId}`);
                                return;
                              }
                              if (row.type === "course") {
                                if (row.orderId) {
                                  navigate(`/cart?order=${row.orderId}`);
                                  return;
                                }
                                navigate("/cart");
                                return;
                              }
                              setSelectedPendingPayment(row);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/40 border-t-white/50 bg-gradient-to-b from-violet-500/85 via-violet-600/75 to-indigo-700/85 px-4 py-2 text-xs font-bold text-white shadow-[0_4px_16px_rgba(124,58,237,0.45),inset_0_1px_1px_rgba(255,255,255,0.35)] backdrop-blur-md hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
                          >
                            <CreditCard className="size-3.5" />
                            Thanh toán ngay
                          </button>
                        </div>
                      )}

                      {isExpiredPending && (
                        <div className="flex flex-wrap gap-2 pt-0.5">
                          <Link
                            to={row.type === "course" ? "/courses" : "/mentors"}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 border-t-white/35 bg-gradient-to-b from-white/[0.14] via-white/[0.06] to-transparent hover:bg-white/[0.2] px-4 py-2 text-xs font-bold text-slate-200 hover:text-white shadow-[0_2px_10px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] backdrop-blur-md transition-all cursor-pointer"
                          >
                            <RotateCcw className="size-3.5" />
                            {row.type === "course" ? "Mua lại" : "Đặt lại lịch"}
                          </Link>
                        </div>
                      )}

                      {/* PDF Invoice Download Actions */}
                      {isPaid && (
                        <div className="flex flex-wrap gap-2 pt-0.5">
                          <button
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={() => download(row)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 border-t-white/35 bg-gradient-to-b from-white/[0.14] via-white/[0.06] to-transparent px-3.5 py-2 text-xs font-bold text-slate-100 hover:text-white hover:bg-white/[0.2] shadow-[0_2px_10px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] backdrop-blur-md disabled:opacity-50 active:scale-[0.98] transition-all cursor-pointer"
                          >
                            <Download className="size-3.5" />
                            {busy === row.id ? "Đang xuất PDF…" : "Hóa đơn PDF"}
                          </button>

                          {row.cartOrderId && (
                            <button
                              type="button"
                              disabled={Boolean(busy)}
                              onClick={() => download(row, true)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 border-t-white/35 bg-gradient-to-b from-white/[0.14] via-white/[0.06] to-transparent px-3.5 py-2 text-xs font-bold text-slate-100 hover:text-white hover:bg-white/[0.2] shadow-[0_2px_10px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] backdrop-blur-md disabled:opacity-50 active:scale-[0.98] transition-all cursor-pointer"
                            >
                              <FileText className="size-3.5" />
                              PDF toàn đơn
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </AccountReveal>
                );
              })}
            </div>
          )}

          {/* ── Luxury Frosted Pagination ── */}
          {data && data.pagination?.totalPages > 1 && (
            <motion.div
              className="flex items-center justify-between gap-3 pt-4 border-t border-white/10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/18 border-t-white/35 bg-gradient-to-b from-white/[0.14] via-white/[0.06] to-transparent hover:bg-white/[0.2] px-4 py-2 text-xs font-bold text-slate-200 hover:text-white shadow-[0_4px_16px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2)] backdrop-blur-md disabled:opacity-40 transition-all cursor-pointer"
              >
                <ChevronLeft className="size-4" />
                Trang trước
              </button>

              <span className="text-xs font-bold text-violet-200 bg-violet-400/20 px-4 py-2 rounded-xl border border-violet-400/35 shadow-[0_0_12px_rgba(167,139,250,0.25)]">
                Trang {page} / {data.pagination?.totalPages || 1}
              </span>

              <button
                type="button"
                disabled={page >= (data.pagination?.totalPages || 1)}
                onClick={() => setPage(page + 1)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/18 border-t-white/35 bg-gradient-to-b from-white/[0.14] via-white/[0.06] to-transparent hover:bg-white/[0.2] px-4 py-2 text-xs font-bold text-slate-200 hover:text-white shadow-[0_4px_16px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2)] backdrop-blur-md disabled:opacity-40 transition-all cursor-pointer"
              >
                Trang sau
                <ChevronRight className="size-4" />
              </button>
            </motion.div>
          )}

        </div>
      </div>

      {selectedPendingPayment && (
        <PendingPaymentModal
          payment={selectedPendingPayment}
          onClose={() => setSelectedPendingPayment(null)}
          onRefresh={() => {
            setRevision((r) => r + 1);
            setSelectedPendingPayment(null);
          }}
        />
      )}
    </div>
  );
}

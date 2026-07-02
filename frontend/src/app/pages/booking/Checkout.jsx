import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router";
import {
  Check,
  CheckCircle2,
  Lock,
  AlertCircle,
  Tag,
  Copy,
  Calendar,
  Clock,
  Video,
  X,
} from "lucide-react";
import { Navbar } from "../../components/layout/Navbar";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";
import { getUser, isLoggedIn, setLoggedIn } from "../../utils/auth/auth.js";
import { fetchCurrentPlan } from "../../api/plansApi.js";
import { BRAND_LIME, BRAND_PURPLE } from "../../constants/brandColors";
import { landingPrimaryButtonClass } from "../../constants/landingTheme";
import { fetchMentor } from "../../api/mentorApi.js";
import { createBooking, fetchRebookCredit, cancelBooking } from "../../api/bookingsApi.js";
import { isBookingSlotInFuture } from "../../utils/booking/bookingSchedule.js";
import { fetchCourseById } from "../../api/courseApi.js";
import { enrollmentApi } from "../../api/enrollmentApi.js";
import { trackAction } from "../../utils/analytics/analyticsApi.js";
import { usePageAnalytics } from "../../hooks/usePageAnalytics.js";
import { createSubscriptionTransferPending, fetchTransferStatus } from "../../api/paymentsApi.js";
import { toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";
import {
  getSubscriptionChargeAmount,
  resolveCheckoutPlan,
} from "../../constants/planCatalog.js";
import { formatVnd, formatVndParts } from "../../utils/shared/formatVnd.js";
import { sessionTypeLabel } from "../../utils/booking/sessionTypeLabels.js";

/* ─── Plan meta (UI) — giá lấy từ planCatalog ───────────── */

function fmt(n) {
  return formatVnd(n);
}

function formatAmountParts(amount) {
  return formatVndParts(amount);
}

/** Số tiền gom một khối, căn giữa, số và đ cùng kiểu chữ */
function PaymentAmountBlock({ payAmount, className = "" }) {
  const { value, suffix } = formatAmountParts(payAmount);
  const amountClass =
    "mt-1.5 text-[2rem] font-extrabold leading-none tabular-nums tracking-tight text-slate-900 sm:text-[2.25rem]";
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-left ${className}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Số tiền cần thanh toán
      </p>
      <p className={amountClass}>
        {value}
        {suffix}
      </p>
    </div>
  );
}

const checkoutCard =
  "rounded-2xl border border-slate-200 bg-white shadow-sm";
const labelMuted = "text-xs font-medium text-slate-500";
const textMuted = "text-sm text-slate-600";
const pageShell =
  "relative min-h-svh w-full overflow-x-hidden bg-[#f3f0f9] text-slate-900 antialiased selection:bg-violet-100 selection:text-violet-900";
const mainTopPad = "pt-[3.75rem] sm:pt-[4.25rem] md:pt-[4.75rem]";

function mentorIdsMatch(a, b) {
  const na = String(a || "").trim().toLowerCase();
  const nb = String(b || "").trim().toLowerCase();
  if (!na || !nb) return false;
  if (na === nb) return true;
  const core = (x) => (x.startsWith("u") ? x.slice(1) : x);
  return core(na) === core(nb);
}

/** Hiển thị trên checkout CK, Vite: .env / .env.local (dev) hoặc env trên host build (Vercel) + redeploy. */
const BANK_TRANSFER = {
  bankName: import.meta.env.VITE_BANK_TRANSFER_NAME || "",
  accountNumber: import.meta.env.VITE_BANK_TRANSFER_ACCOUNT || "",
  accountOwner: import.meta.env.VITE_BANK_TRANSFER_OWNER || "",
};

/** Tên ngân hàng đầy đủ, ưu tiên `VITE_BANK_TRANSFER_DISPLAY_NAME`, không viết tắt trên UI. */
function displayBankName(raw) {
  const explicit = String(import.meta.env.VITE_BANK_TRANSFER_DISPLAY_NAME || "").trim();
  if (explicit) return explicit;
  return String(raw || "")
    .replace(/\bTMCP\b/gi, "Thương mại Cổ phần")
    .replace(/\s*\(?\s*TPBank\s*\)?\s*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function TransferDetailRow({ label, children, large, labelClass, valueWrapClass, rowClass = "" }) {
  if (large) {
    return (
      <div className={`space-y-0.5 ${rowClass}`}>
        <p className={labelClass}>{label}</p>
        <div className={valueWrapClass}>{children}</div>
      </div>
    );
  }
  return (
    <div className="flex justify-between gap-3">
      <span className={labelClass}>{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}

/** Mã ngân hàng cho VietQR (img.vietqr.io). VD: TPB = TPBank, VCB = Vietcombank. */
function inferVietQrBankId() {
  const explicit = import.meta.env.VITE_VIETQR_BANK_ID;
  if (explicit && String(explicit).trim()) return String(explicit).trim().toUpperCase();
  const name = (BANK_TRANSFER.bankName || "").toLowerCase();
  if (
    name.includes("tiên phong") ||
    name.includes("tien phong") ||
    name.includes("tpbank") ||
    name.includes("tp bank")
  ) {
    return "TPB";
  }
  return "";
}

/** Ảnh QR VietQR: quét trong app NH, thường điền sẵn STK, số tiền, nội dung. */
function buildVietQrImageUrl(bankId, accountDigits, amountVnd, addInfo) {
  const bid = String(bankId || "").trim().toUpperCase();
  const acc = String(accountDigits || "").replace(/\D/g, "");
  const amt = Math.round(Number(amountVnd) || 0);
  if (!bid || !acc || amt <= 0) return null;
  const add = encodeURIComponent(String(addInfo || "").slice(0, 50));
  return `https://img.vietqr.io/image/${bid}-${acc}-compact2.png?amount=${amt}&addInfo=${add}`;
}

function extractOrderPart(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  return s.split("|")[0].trim();
}

function planCheckoutStorageKey(planKey, billing) {
  return `prointerview_plan_ck_${planKey}_${billing}`;
}

function readPlanCheckoutSession(planKey, billing) {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(planCheckoutStorageKey(planKey, billing));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.orderNum) return null;
    return data;
  } catch {
    return null;
  }
}

function writePlanCheckoutSession(planKey, billing, data) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(planCheckoutStorageKey(planKey, billing), JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

function clearPlanCheckoutSession(planKey, billing) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(planCheckoutStorageKey(planKey, billing));
  } catch {
    /* ignore */
  }
}

function readSavedPlanCheckoutFromParams(searchParams) {
  const plan = searchParams.get("plan");
  if (!plan) return null;
  return readPlanCheckoutSession(plan, searchParams.get("billing") ?? "yearly");
}

/* ─── CopyBtn ────────────────────────────────────────────── */
function CopyBtn({ text, variant = "default" }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => { });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (variant === "pane") {
    return (
      <button
        type="button"
        onClick={copy}
        className={`flex w-[4.25rem] shrink-0 flex-col items-center justify-center gap-1 border-l border-[#8037f4]/15 text-[10px] font-semibold transition-colors sm:w-[4.75rem] ${copied
            ? "bg-[#93f72b]/20 text-[#8037f4]"
            : "bg-[#8037f4]/5 text-[#8037f4]/70 hover:bg-[#8037f4]/10 hover:text-[#8037f4]"
          }`}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Đã copy" : "Sao chép"}
      </button>
    );
  }

  if (variant === "ghost-light") {
    return (
      <button
        type="button"
        onClick={copy}
        className={`flex shrink-0 items-center gap-1.5 rounded px-3 py-2 text-xs font-semibold transition-colors ${copied ? "bg-white/25 text-white" : "bg-white/15 text-white hover:bg-white/25"
          }`}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Đã copy" : "Sao chép"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-bold transition-all ${copied
          ? "border-[#8037f4]/40 bg-[#8037f4] text-white"
          : "border-[#93f72b]/40 bg-[#93f72b] text-slate-900 shadow-sm hover:bg-[#7fe015]"
        }`}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Đã copy" : "Sao chép"}
    </button>
  );
}

function formatTransferCountdown(totalMs) {
  const ms = Math.max(0, Number(totalMs) || 0);
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function parseApiExpiresAt(value) {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

function applyPaymentExpiryFromApi(setPaymentExpiresAtMs, setPaymentExpired, raw) {
  const t = parseApiExpiresAt(raw);
  if (!t) return;
  setPaymentExpiresAtMs(t);
  setPaymentExpired(t <= Date.now());
}

function BankTransferPaymentDetails({
  payAmount,
  transferOrderNum,
  expiresInMs,
  paymentExpired,
  timeoutMinutes = 15,
  onRetryOrder,
}) {
  const bankName = displayBankName(BANK_TRANSFER.bankName);
  const { value, suffix } = formatAmountParts(payAmount);

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-[#8037f4]/15 bg-white shadow-[0_8px_32px_rgba(128,55,244,0.08)] ring-1 ring-[#8037f4]/5">
      <div className="bg-gradient-to-r from-[#faf8ff] via-white to-[#f5fce8]/40 px-3.5 py-3 sm:px-4 sm:py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8037f4]/80">
              Số tiền cần thanh toán
            </p>
            <p className="mt-1 text-[1.5rem] font-extrabold leading-none tabular-nums tracking-tight text-[#630ed4] sm:text-[1.75rem]">
              {value}
              {suffix}
            </p>
          </div>
          {!paymentExpired && typeof expiresInMs === "number" ? (
            <div className="flex shrink-0 items-center gap-2 rounded border border-[#93f72b]/35 bg-[#93f72b]/10 px-2.5 py-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0 text-[#630ed4]" aria-hidden />
              <span className="text-xs text-slate-600">Còn</span>
              <span className="font-mono text-sm font-bold tabular-nums text-[#630ed4]">
                {formatTransferCountdown(expiresInMs)}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="px-3.5 pb-3.5 sm:px-4 sm:pb-4">
      {paymentExpired ? (
        <div className="rounded border border-red-200/80 bg-red-50/90 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">Đơn đã hết hạn ({timeoutMinutes} phút)</p>
          <p className="mt-1 text-xs leading-relaxed text-red-700/90">
            Mã PI cũ không còn hiệu lực. Tạo đơn mới để nhận QR và mã chuyển khoản mới.
          </p>
          {onRetryOrder ? (
            <button
              type="button"
              onClick={onRetryOrder}
              className="mt-3 rounded bg-[#a3e635] px-4 py-2 text-xs font-bold text-slate-900 transition-colors hover:bg-[#84cc16]"
            >
              Tạo đơn mới
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="my-3 h-px bg-gradient-to-r from-[#93f72b]/30 via-[#8037f4]/20 to-transparent" />

      <div className="overflow-hidden rounded-md border border-[#8037f4]/20">
        <div className="flex items-center bg-gradient-to-r from-[#630ed4] to-[#8037f4] px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/95">
            Nội dung chuyển khoản
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-[#8037f4]/10 bg-[#faf8ff] px-3.5 py-3 sm:px-4">
          <p className="min-w-0 flex-1 break-all font-mono text-xl font-bold tracking-wide text-[#630ed4]">
            {transferOrderNum}
          </p>
          <CopyBtn text={transferOrderNum} variant="lime" />
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-md border border-[#8037f4]/12 bg-[#faf8ff]/50">
        <dl className="divide-y divide-[#8037f4]/8 text-sm">
          <div className="px-3.5 py-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8037f4]/70">Ngân hàng</dt>
            <dd className="mt-1 font-medium leading-snug text-slate-800">{bankName}</dd>
          </div>
          <div className="relative flex items-start justify-between gap-3 bg-white/60 px-3.5 py-2.5 pl-4">
            <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-[#93f72b]" aria-hidden />
            <div className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8037f4]/70">Số tài khoản</dt>
              <dd className="mt-1 font-mono text-base font-bold text-[#630ed4] sm:text-lg">
                {BANK_TRANSFER.accountNumber}
              </dd>
            </div>
            {BANK_TRANSFER.accountNumber ? <CopyBtn text={BANK_TRANSFER.accountNumber} /> : null}
          </div>
          {BANK_TRANSFER.accountOwner ? (
            <div className="px-3.5 py-2.5">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8037f4]/70">Chủ tài khoản</dt>
              <dd className="mt-1 font-semibold text-slate-900">{BANK_TRANSFER.accountOwner}</dd>
            </div>
          ) : null}
        </dl>
      </div>
      </div>
    </div>
  );
}

/** QR VietQR, căn giữa, khung đồng bộ panel thông tin CK */
function BankTransferQrFocus({ vietQrUrl, vietQrLoadFailed, onQrError, onOpenQrModal }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center lg:py-2">
      {vietQrUrl && !vietQrLoadFailed ? (
        <button
          type="button"
          onClick={onOpenQrModal}
          className="group flex w-full max-w-[15.5rem] flex-col sm:max-w-[17rem]"
        >
          <div className="rounded-2xl border border-[#8037f4]/10 bg-white p-3 shadow-[0_8px_28px_rgba(128,55,244,0.08)] ring-1 ring-[#8037f4]/5 transition-all group-hover:shadow-[0_12px_36px_rgba(128,55,244,0.12)] group-hover:ring-[#8037f4]/20">
            <img
              src={vietQrUrl}
              alt="Mã QR VietQR"
              className="aspect-square w-full rounded-xl object-contain"
              loading="lazy"
              onError={onQrError}
            />
          </div>
          <span className="mt-2.5 text-center text-xs font-medium text-slate-500 transition-colors group-hover:text-[#8037f4]">
            Chạm để phóng to QR
          </span>
        </button>
      ) : vietQrUrl && vietQrLoadFailed ? (
        <p className="max-w-xs text-center text-sm text-slate-600">Không tải được QR, dùng thông tin bên cạnh.</p>
      ) : (
        <p className="max-w-xs text-center text-sm text-slate-600">
          Thêm <span className="font-mono text-xs">VITE_VIETQR_BANK_ID</span> để hiện mã QR.
        </p>
      )}
    </div>
  );
}

/** Màn CK booking/khóa, mobile: QR full + STK dưới thanh chờ; desktop: 2 cột */
function BankTransferFocusLayout({
  payAmount,
  transferOrderNum,
  vietQrUrl,
  vietQrLoadFailed,
  onQrError,
  onOpenQrModal,
  expiresInMs,
  paymentExpired,
  timeoutMinutes,
  onRetryOrder,
}) {
  const paymentDetails = (
    <BankTransferPaymentDetails
      payAmount={payAmount}
      transferOrderNum={transferOrderNum}
      expiresInMs={expiresInMs}
      paymentExpired={paymentExpired}
      timeoutMinutes={timeoutMinutes}
      onRetryOrder={onRetryOrder}
    />
  );

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start lg:gap-6">
      <BankTransferQrFocus
        vietQrUrl={vietQrUrl}
        vietQrLoadFailed={vietQrLoadFailed}
        onQrError={onQrError}
        onOpenQrModal={onOpenQrModal}
      />
      <div className="w-full min-h-0">{paymentDetails}</div>
    </div>
  );
}

/** Mã CK + số tiền, layout checkout thường (plan / sidebar) */
function TransferMemoCard({ transferOrderNum, payAmount, fmt, large }) {
  const codeClass = large
    ? "font-mono text-lg font-bold tracking-wide text-slate-900 sm:text-xl"
    : "font-mono text-sm font-bold tracking-wide text-slate-900";

  return (
    <div
      className={`overflow-hidden rounded-md border border-[#8037f4]/15 shadow-sm ${large ? "w-full max-w-md" : ""
        }`}
    >
      <div className="flex items-center bg-gradient-to-r from-[#630ed4] to-[#8037f4] px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/95">Nội dung chuyển khoản</p>
      </div>
      <div className="bg-[#faf8ff] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className={`min-w-0 flex-1 break-all ${codeClass} text-[#630ed4]`}>{transferOrderNum}</p>
          <CopyBtn text={transferOrderNum} variant="lime" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-[#8037f4]/10 bg-[#93f72b]/8 px-4 py-2.5">
        <span className="text-xs font-medium text-slate-600">Số tiền cần chuyển</span>
        <span
          className={`tabular-nums font-bold text-slate-900 ${large ? "text-base sm:text-lg" : "text-sm"}`}
        >
          {fmt(payAmount)}
        </span>
      </div>
    </div>
  );
}

/* ─── Step indicator ─────────────────────────────────────── */
const STEPS_BOOKING = ["THÔNG TIN", "THANH TOÁN"];
const STEPS_REBOOK = ["TÓM TẮT", "XÁC NHẬN"];

function StepBar({ current, steps = STEPS_BOOKING }) {
  return (
    <div className="mb-5 flex items-center justify-center">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-2">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all ${done || active
                    ? "bg-[#8037f4] text-white shadow-md shadow-violet-500/25"
                    : "border border-slate-200 bg-white text-slate-400"
                  }`}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={`text-[11px] font-semibold uppercase tracking-wide ${done || active ? "text-[#8037f4]" : "text-slate-400"
                  }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`mx-4 mb-6 h-0.5 w-10 rounded-full md:w-16 ${i < current ? "bg-[#8037f4]" : "bg-slate-200"
                  }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

const PAY_MODE = {
  BANK: "bank",
  REBOOK_LOADING: "rebook_loading",
  REBOOK_READY: "rebook_ready",
  REBOOK_SAME: "rebook_same",
  REBOOK_LOW: "rebook_low",
};

function resolvePayMode(ctx) {
  const { isBooking, rebookFrom, rebookCreditLoading, canUseRebookCredit, rebookSameMentor, rebookCreditTooLow } = ctx;
  if (!isBooking || !rebookFrom) return PAY_MODE.BANK;
  if (rebookCreditLoading) return PAY_MODE.REBOOK_LOADING;
  if (rebookSameMentor) return PAY_MODE.REBOOK_SAME;
  if (rebookCreditTooLow) return PAY_MODE.REBOOK_LOW;
  if (canUseRebookCredit) return PAY_MODE.REBOOK_READY;
  return PAY_MODE.BANK;
}

function CheckoutPayPanel({ mode, fmt, rebookCreditVnd, bookingTotalEstimate, bookingMentor, rebookFrom, navigate }) {
  if (mode === PAY_MODE.REBOOK_LOADING) {
    return (
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-[#8037f4]" />
        Đang kiểm tra credit…
      </div>
    );
  }
  if (mode === PAY_MODE.REBOOK_READY) {
    return (
      <div className="mb-6 rounded-xl border border-violet-200 bg-violet-50 px-4 py-4 text-xs leading-relaxed text-violet-900">
        Dùng <strong>{fmt(rebookCreditVnd)}</strong> đã trả cho buổi mới{" "}
        <strong>{fmt(bookingTotalEstimate)}</strong>. Bấm xác nhận, không CK lại.
      </div>
    );
  }
  if (mode === PAY_MODE.REBOOK_SAME) {
    return (
      <div className="mb-6 space-y-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-xs text-amber-900">
        <p>
          Credit chỉ khi đặt <strong>mentor khác</strong>
          {bookingMentor?.name ? ` (không phải ${bookingMentor.name})` : ""}. Giữ mentor này → buổi cũ → «Đổi lịch».
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate(`/mentors?rebookFrom=${encodeURIComponent(rebookFrom)}`)}
            className="rounded-lg bg-[#a3e635] px-3 py-2 text-[10px] font-bold uppercase text-slate-900 hover:bg-[#84cc16]"
          >
            Mentor khác
          </button>
          <button
            type="button"
            onClick={() => navigate(`/session/${encodeURIComponent(rebookFrom)}`)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[10px] font-bold uppercase text-slate-700 hover:border-violet-300 hover:bg-violet-50"
          >
            Đổi lịch (buổi cũ)
          </button>
        </div>
      </div>
    );
  }
  if (mode === PAY_MODE.REBOOK_LOW) {
    return (
      <div className="mb-6 space-y-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-xs text-red-800">
        <p>
          Credit {fmt(rebookCreditVnd)}, buổi {fmt(bookingTotalEstimate)} (thiếu{" "}
          {fmt(bookingTotalEstimate - rebookCreditVnd)}).
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate(`/mentors?rebookFrom=${encodeURIComponent(rebookFrom)}`)}
            className="rounded-lg bg-[#a3e635] px-3 py-2 text-[10px] font-black uppercase text-slate-900"
          >
            Mentor khác
          </button>
          <button
            type="button"
            onClick={() => navigate(`/session/${encodeURIComponent(rebookFrom)}`)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[10px] font-bold uppercase text-slate-700 hover:border-violet-300"
          >
            Buổi cũ
          </button>
        </div>
      </div>
    );
  }
  return null;
}

function OrderLineItem({
  isBooking,
  isCourse,
  bookingMentor,
  courseInfo,
  plan,
  billing,
  bookingDate,
  bookingTime,
  bookingSessionType,
  bookingSlots,
  baseTotal,
  fmt,
}) {
  if (isCourse) {
    return (
      <div className={`${checkoutCard} flex gap-4 p-4 sm:p-5`}>
        <img
          src={courseInfo?.thumbnail || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=200&q=80"}
          alt=""
          className="h-20 w-28 shrink-0 rounded-lg border border-slate-200 object-cover sm:h-24 sm:w-32"
        />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold leading-snug text-slate-900 sm:text-lg">
            {courseInfo?.title || "Đang tải khóa học…"}
          </p>
          {courseInfo?.mentorId?.userId?.name && (
            <p className={`mt-1 ${labelMuted}`}>Giảng viên: {courseInfo.mentorId.userId.name}</p>
          )}
        </div>
        <p className="shrink-0 text-right text-lg font-bold text-[#8037f4]">{fmt(baseTotal)}</p>
      </div>
    );
  }
  if (isBooking) {
    const slots = bookingSlots ?? (bookingDate ? [{ dateKey: bookingDate, dayFull: bookingDate, time: bookingTime }] : []);
    return (
      <div className={`${checkoutCard} p-4 sm:p-5`}>
        <div className="flex gap-4">
          {bookingMentor ? (
            <img
              src={bookingMentor.avatar}
              alt={bookingMentor.name}
              className="h-16 w-16 shrink-0 rounded-xl border border-slate-200 object-cover"
            />
          ) : (
            <div className="h-16 w-16 shrink-0 rounded-xl bg-slate-100" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-slate-900 sm:text-lg">
              {bookingMentor?.name || "Đang tải mentor…"}
            </p>
            <p className={`mt-0.5 ${labelMuted}`}>
              {isBooking && bookingSessionType
                ? sessionTypeLabel(bookingSessionType)
                : bookingMentor?.title || "Buổi phỏng vấn 1:1"}
            </p>
            {slots.length > 1 ? (
              <div className="mt-2 space-y-1">
                {slots.map((s, i) => (
                  <div key={`${s.dateKey}_${s.time}`} className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#8037f4] text-[0.6rem] font-black text-white">
                      {i + 1}
                    </span>
                    <Calendar className="h-3 w-3 text-[#8037f4]" />
                    <span className="font-medium">{s.dayFull || s.dateKey}</span>
                    <Clock className="h-3 w-3 text-[#8037f4]" />
                    <span className="font-bold">{s.time}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`mt-2 flex flex-wrap gap-3 ${textMuted} text-xs`}>
                {bookingDate && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-[#8037f4]" />
                    {bookingDate}
                  </span>
                )}
                {bookingTime && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-[#8037f4]" />
                    {bookingTime}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Video className="h-3.5 w-3.5 text-[#8037f4]" />
                  Jitsi trên ProInterview · 60 phút
                </span>
              </div>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-bold text-[#8037f4]">{fmt(baseTotal)}</p>
            {slots.length > 1 && (
              <p className="text-xs text-slate-500">{slots.length} buổi</p>
            )}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={`${checkoutCard} p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8037f4]">Gói cước</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{plan.name}</p>
          <p className={`mt-1 ${labelMuted}`}>
            {billing === "yearly" ? "Gói năm" : "Gói tháng"}
          </p>
        </div>
        <p className="text-lg font-bold text-[#8037f4]">{fmt(baseTotal)}</p>
      </div>
    </div>
  );
}

function VietQrModalDetailRow({ label, children, valueClassName = "" }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-0.5 text-sm text-slate-900 ${valueClassName}`}>{children}</p>
    </div>
  );
}

/** Modal VietQR giữa màn hình, nền tối mờ + thẻ trắng (giống FES) */
function VietQrModal({
  open,
  onClose,
  payAmount,
  transferOrderNum,
  fmt,
  vietQrUrl,
  vietQrLoadFailed,
  onQrError,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vietqr-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Đóng"
      />
      <div className="relative z-10 w-full max-w-[400px] overflow-hidden rounded-2xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
          aria-label="Đóng cửa sổ QR"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="px-6 pb-6 pt-8">
          <p
            id="vietqr-modal-title"
            className="mb-4 text-center text-lg font-bold tracking-tight text-slate-800"
          >
            VietQR
          </p>

          {vietQrUrl && !vietQrLoadFailed ? (
            <div className="mx-auto max-w-[300px]">
              <img
                src={vietQrUrl}
                alt="Mã QR thanh toán VietQR"
                className="w-full rounded-lg"
                loading="eager"
                onError={onQrError}
              />
            </div>
          ) : (
            <p className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
              {vietQrLoadFailed
                ? "Không tải được mã QR. Vui lòng chuyển khoản thủ công theo thông tin bên dưới."
                : "Chưa có mã QR. Kiểm tra cấu hình VITE_VIETQR_BANK_ID và STK ngân hàng."}
            </p>
          )}

          <div className="mt-5 space-y-3 border-t border-slate-100 pt-5 text-left">
            {BANK_TRANSFER.bankName ? (
              <VietQrModalDetailRow label="Ngân hàng" valueClassName="font-medium leading-snug">
                {displayBankName(BANK_TRANSFER.bankName)}
              </VietQrModalDetailRow>
            ) : null}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <VietQrModalDetailRow
                  label="Số tài khoản"
                  valueClassName="font-mono text-base font-bold text-[#8037f4]"
                >
                  {BANK_TRANSFER.accountNumber || "—"}
                </VietQrModalDetailRow>
              </div>
              {BANK_TRANSFER.accountNumber ? (
                <CopyBtn text={BANK_TRANSFER.accountNumber} />
              ) : null}
            </div>
            <VietQrModalDetailRow label="Số tiền" valueClassName="text-base font-extrabold tabular-nums">
              {fmt(payAmount)}
            </VietQrModalDetailRow>
            {BANK_TRANSFER.accountOwner ? (
              <VietQrModalDetailRow label="Chủ tài khoản" valueClassName="font-semibold">
                {BANK_TRANSFER.accountOwner}
              </VietQrModalDetailRow>
            ) : null}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <VietQrModalDetailRow
                  label="Nội dung chuyển khoản"
                  valueClassName="break-all font-mono text-sm font-bold"
                >
                  {transferOrderNum}
                </VietQrModalDetailRow>
              </div>
              <CopyBtn text={transferOrderNum} />
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-slate-500">Quét mã QR trong app ngân hàng để thanh toán</p>
        </div>
      </div>
    </div>
  );
}

/** CK + QR, `variant="large"` màn booking/khóa chỉ hiện chuyển khoản */
function BankTransferBlock({
  hasBank,
  payAmount,
  transferOrderNum,
  fmt,
  vietQrUrl,
  vietQrLoadFailed,
  onQrError,
  onOpenQrModal,
  variant = "default",
  expiresInMs,
  paymentExpired,
  timeoutMinutes,
  onRetryOrder,
}) {
  const large = variant === "large";
  const labelClass = large ? "text-xs font-medium text-slate-500" : labelMuted;
  const valueClass = large ? "text-sm font-medium text-slate-800" : "text-right font-medium text-slate-800";
  const accountClass = large
    ? "font-mono text-base font-bold text-[#8037f4]"
    : "font-mono font-bold text-blue-600";

  if (!hasBank) {
    return (
      <p
        className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 leading-relaxed text-amber-800 ${large ? "text-sm" : "mt-4 text-xs"
          }`}
      >
        Chưa cấu hình STK ngân hàng (<span className="font-mono">VITE_BANK_TRANSFER_*</span>).
      </p>
    );
  }

  if (large) {
    return (
      <BankTransferFocusLayout
        payAmount={payAmount}
        transferOrderNum={transferOrderNum}
        vietQrUrl={vietQrUrl}
        vietQrLoadFailed={vietQrLoadFailed}
        onQrError={onQrError}
        onOpenQrModal={onOpenQrModal}
        expiresInMs={expiresInMs}
        paymentExpired={paymentExpired}
        timeoutMinutes={timeoutMinutes}
        onRetryOrder={onRetryOrder}
      />
    );
  }

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      {paymentExpired ? (
        <div className="md:col-span-2 rounded-xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">Đơn đã hết hạn ({timeoutMinutes ?? 15} phút)</p>
          {onRetryOrder ? (
            <button
              type="button"
              onClick={onRetryOrder}
              className="mt-2 rounded-lg bg-[#a3e635] px-3 py-1.5 text-xs font-bold text-slate-900"
            >
              Tạo đơn mới
            </button>
          ) : null}
        </div>
      ) : typeof expiresInMs === "number" ? (
        <div className="md:col-span-2 flex items-center justify-center gap-2 rounded-full border border-[#8037f4]/12 bg-[#faf8ff] px-4 py-2 text-sm text-slate-600">
          <Clock className="h-3.5 w-3.5 text-[#8037f4]" aria-hidden />
          Còn{" "}
          <strong className="font-mono font-bold tabular-nums text-[#8037f4]">
            {formatTransferCountdown(expiresInMs)}
          </strong>
        </div>
      ) : null}
      <div className="space-y-3 text-sm">
        <TransferDetailRow label="Ngân hàng" large={false} labelClass={labelClass} valueWrapClass={valueClass}>
          <p className="leading-snug text-slate-800">{displayBankName(BANK_TRANSFER.bankName)}</p>
        </TransferDetailRow>
        <TransferDetailRow label="Số tài khoản" large={false} labelClass={labelClass} valueWrapClass="">
          <span className={accountClass}>{BANK_TRANSFER.accountNumber}</span>
        </TransferDetailRow>
        {BANK_TRANSFER.accountOwner ? (
          <TransferDetailRow label="Chủ tài khoản" large={false} labelClass={labelClass} valueWrapClass={valueClass}>
            <span className={valueClass}>{BANK_TRANSFER.accountOwner}</span>
          </TransferDetailRow>
        ) : null}
        <TransferMemoCard
          transferOrderNum={transferOrderNum}
          payAmount={payAmount}
          fmt={fmt}
          large={false}
        />
      </div>

      <div className="flex flex-col items-center justify-center">
        {vietQrUrl && !vietQrLoadFailed ? (
          <button
            type="button"
            onClick={onOpenQrModal}
            className="w-full max-w-[200px] rounded-xl border border-slate-200 bg-white p-3 text-center shadow-sm transition-colors hover:border-violet-300 hover:shadow-md"
          >
            <img src={vietQrUrl} alt="Mã QR VietQR" className="w-full" loading="lazy" onError={onQrError} />
            <p className="mt-1 text-xs font-medium text-slate-500">Phóng to QR</p>
          </button>
        ) : vietQrUrl && vietQrLoadFailed ? (
          <p className={`text-center text-xs ${labelMuted}`}>Không tải QR, chuyển thủ công theo STK.</p>
        ) : (
          <p className={`text-center text-xs ${labelMuted}`}>
            Thêm <span className="font-mono">VITE_VIETQR_BANK_ID</span> để hiện QR.
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────── */

export function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  usePageAnalytics();

  /* ── Booking / Course / Plan mode ─────────────────────────────── */
  const isBooking = searchParams.get("type") === "booking";
  const isCourse = searchParams.get("type") === "course";
  const courseId = searchParams.get("courseId") ?? "";
  const isPlanCheckout = Boolean(searchParams.get("plan"));
  const isPaidCheckout = isBooking || isCourse || isPlanCheckout;
  const mentorId = searchParams.get("mentorId") ?? "";
  const [bookingMentor, setBookingMentor] = React.useState(null);
  const [courseInfo, setCourseInfo] = React.useState(null);

  React.useEffect(() => {
    trackAction("checkout_open", "/checkout", {
      type: searchParams.get("type") || "plan",
      plan: searchParams.get("plan") || "",
    });
  }, []);

  React.useEffect(() => {
    if (!isBooking || !mentorId) {
      setBookingMentor(null);
      return;
    }
    setBookingMentor(null);
    (async () => {
      try {
        const m = await fetchMentor(mentorId);
        if (m) setBookingMentor(m);
        else toastApiError("Không tải được thông tin mentor.");
      } catch {
        toastApiError("Lỗi kết nối khi tải mentor.");
      }
    })();
  }, [isBooking, mentorId]);

  React.useEffect(() => {
    if (!isCourse || !courseId) {
      setCourseInfo(null);
      return;
    }
    setCourseInfo(null);
    (async () => {
      try {
        const r = await fetchCourseById(courseId);
        if (r.success && r.course) setCourseInfo(r.course);
        else toastApiError(r.error, "Không tải được khóa học.");
      } catch {
        toastApiError("Lỗi kết nối khi tải khóa học.");
      }
    })();
  }, [isCourse, courseId]);

  const bookingPricePerSlot = Number(
    isBooking ? searchParams.get("price") ?? bookingMentor?.price ?? 0 : bookingMentor?.price ?? searchParams.get("price") ?? 0,
  );

  const bookingSlots = useMemo(() => {
    if (!isBooking) return null;
    const raw = searchParams.get("slots") ?? "";
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
    } catch {
      return null;
    }
  }, [isBooking, searchParams]);

  const bookingSlotCount = bookingSlots ? bookingSlots.length : 1;
  const bookingPrice = bookingPricePerSlot * bookingSlotCount;

  // Compat: single slot uses first slot or fallback to old date/time params
  const bookingDate = bookingSlots?.[0]?.dateKey ?? searchParams.get("date") ?? "";
  const bookingTime = bookingSlots?.[0]?.time ?? searchParams.get("time") ?? "";
  const bookingSessionType = searchParams.get("sessionType") || "mock_interview";

  /* ── Plan mode ────────────────────────────────────────── */
  const planKey = searchParams.get("plan") ?? "starterPro";
  const billing = (searchParams.get("billing") ?? "yearly");
  const plan = resolveCheckoutPlan(planKey);
  const price = getSubscriptionChargeAmount(planKey, billing);
  const courseUrlPrice = Number(searchParams.get("price") ?? "0");
  const coursePriceNum = isCourse ? Number((courseInfo?.price ?? courseUrlPrice) || 0) : 0;
  const baseTotal = isBooking ? bookingPrice : isCourse ? coursePriceNum : price;
  const total = isBooking ? bookingPrice : isCourse ? coursePriceNum : price;

  const [transferOrderNum, setTransferOrderNum] = useState(() => {
    const saved = readSavedPlanCheckoutFromParams(searchParams);
    if (saved?.orderNum) return saved.orderNum;
    return `PI${Math.floor(Math.random() * 900000 + 100000)}`;
  });

  /* ── Read all booking params from URL ── */
  const bookingPosition = searchParams.get("position") ?? "";
  const bookingNote = searchParams.get("note") ?? "";
  const bookingCvFile = searchParams.get("cvFile") || null;
  const bookingCvFileUrl = searchParams.get("cvFileUrl") || "";
  const bookingJdFile = searchParams.get("jdFile") || null;
  const bookingJdFileUrl = searchParams.get("jdFileUrl") || "";
  const rebookFrom =
    searchParams.get("rebookFrom") ||
    (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("prointerview_rebook_from") : "") ||
    "";
  const [rebookCredit, setRebookCredit] = React.useState(null);
  const [rebookCreditLoading, setRebookCreditLoading] = React.useState(false);

  React.useEffect(() => {
    if (!isBooking || !rebookFrom) {
      setRebookCredit(null);
      setRebookCreditLoading(false);
      return;
    }
    setRebookCreditLoading(true);
    (async () => {
      try {
        const r = await fetchRebookCredit(rebookFrom);
        if (r.success && r.credit?.available) setRebookCredit(r.credit);
        else setRebookCredit(null);
      } catch {
        setRebookCredit(null);
      } finally {
        setRebookCreditLoading(false);
      }
    })();
  }, [isBooking, rebookFrom]);

  const [appStep, setAppStep] = useState(() => {
    const saved = readSavedPlanCheckoutFromParams(searchParams);
    return saved?.paymentId ? "awaiting_transfer" : "checkout";
  });
  const [bankBookingId, setBankBookingId] = useState(null);
  const [bankEnrollmentId, setBankEnrollmentId] = useState(null);
  const [bankSubscriptionPaymentId, setBankSubscriptionPaymentId] = useState(() => {
    const saved = readSavedPlanCheckoutFromParams(searchParams);
    return saved?.paymentId ?? null;
  });
  const [awaitingAutoConfirm, setAwaitingAutoConfirm] = useState(false);
  const [paymentExpiresAtMs, setPaymentExpiresAtMs] = useState(() => {
    const saved = readSavedPlanCheckoutFromParams(searchParams);
    return saved?.expiresAtMs ?? null;
  });
  const [expiresInMs, setExpiresInMs] = useState(null);
  const [paymentExpired, setPaymentExpired] = useState(() => {
    const saved = readSavedPlanCheckoutFromParams(searchParams);
    if (saved?.expiresAtMs && saved.expiresAtMs <= Date.now()) return true;
    return false;
  });
  const [transferTimeoutMinutes, setTransferTimeoutMinutes] = useState(15);
  const [paymentSuccessOverlay, setPaymentSuccessOverlay] = useState(null);
  const autoOrderStartedRef = useRef(
    Boolean(readSavedPlanCheckoutFromParams(searchParams)?.paymentId),
  );
  const paidRedirectStartedRef = useRef(false);

  const [cardError, setCardError] = useState("");

  /* Coupon */
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  // Coupon chưa được backend hỗ trợ cho plan checkout (server kiểm tra clientAmount === catalogAmount)
  // → disable discount cho tất cả flow cho đến khi backend implement coupon validation
  const discount = 0;
  const payAmount = total - discount;
  const bookingTotalEstimate = Math.round(isBooking ? payAmount : bookingPrice);

  const rebookCreditVnd = Number(rebookCredit?.creditVnd || 0);
  const rebookSameMentor = Boolean(
    rebookCredit?.available &&
    mentorId &&
    (mentorIdsMatch(rebookCredit.excludeMentorId, mentorId) ||
      mentorIdsMatch(rebookCredit.excludeMentorId, bookingMentor?.id)),
  );
  const canUseRebookCredit = Boolean(
    rebookCredit?.available &&
    !rebookSameMentor &&
    bookingTotalEstimate > 0 &&
    bookingTotalEstimate <= rebookCreditVnd &&
    mentorId,
  );
  const rebookCreditTooLow = Boolean(
    rebookFrom &&
    rebookCredit?.available &&
    !rebookSameMentor &&
    bookingTotalEstimate > rebookCreditVnd,
  );
  const payMode = useMemo(
    () =>
      resolvePayMode({
        isBooking,
        rebookFrom,
        rebookCreditLoading,
        canUseRebookCredit,
        rebookSameMentor,
        rebookCreditTooLow,
      }),
    [isBooking, rebookFrom, rebookCreditLoading, canUseRebookCredit, rebookSameMentor, rebookCreditTooLow],
  );
  const payBlocked = payMode === PAY_MODE.REBOOK_SAME || payMode === PAY_MODE.REBOOK_LOW;
  const showStepBar = payMode === PAY_MODE.BANK || payMode === PAY_MODE.REBOOK_READY;
  const stepLabels = payMode === PAY_MODE.REBOOK_READY ? STEPS_REBOOK : STEPS_BOOKING;
  const compactRebook = rebookFrom && payMode !== PAY_MODE.BANK;
  const grandTotal = total - discount;

  const vietQrBankId = useMemo(() => inferVietQrBankId(), []);
  const vietQrUrl = useMemo(
    () => buildVietQrImageUrl(vietQrBankId, BANK_TRANSFER.accountNumber, payAmount, transferOrderNum),
    [vietQrBankId, transferOrderNum, payAmount],
  );
  const [vietQrLoadFailed, setVietQrLoadFailed] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  useEffect(() => {
    setVietQrLoadFailed(false);
  }, [vietQrUrl]);

  const handlePay = async ({ silent = false, orderNumOverride, forceNew = false } = {}) => {
    const orderNum = String(orderNumOverride || transferOrderNum).trim();
    if (!isLoggedIn()) {
      setCardError("");
      const q = searchParams.toString();
      navigate(`/login?redirect=${encodeURIComponent(`/checkout?${q}`)}`);
      return { ok: false };
    }

    if (isPlanCheckout) {
      setCardError("");
      const apiPlanKey = plan.planKey;
      try {
        const apiRes = await createSubscriptionTransferPending({
          amount: payAmount,
          planKey: apiPlanKey,
          orderNum,
          billing,
          forceNew,
        });
        if (apiRes.success && apiRes.paymentId) {
          const resolvedOrder = apiRes.providerRef || orderNum;
          if (apiRes.providerRef) setTransferOrderNum(apiRes.providerRef);
          setBankSubscriptionPaymentId(apiRes.paymentId);
          applyPaymentExpiryFromApi(setPaymentExpiresAtMs, setPaymentExpired, apiRes.paymentExpiresAt);
          if (apiRes.timeoutMinutes) setTransferTimeoutMinutes(apiRes.timeoutMinutes);
          setAppStep("awaiting_transfer");
          writePlanCheckoutSession(planKey, billing, {
            orderNum: resolvedOrder,
            paymentId: apiRes.paymentId,
            expiresAtMs: parseApiExpiresAt(apiRes.paymentExpiresAt),
          });
          if (!silent) {
            toastApiSuccess(
              "Đã tạo đơn gói cước. Quét QR, CK, khi tiền vào sẽ tự kích hoạt gói qua SePay.",
            );
          }
          return { ok: true, subscriptionPaymentId: apiRes.paymentId };
        }
        const msg = apiRes.error || "Không thể tạo giao dịch chờ chuyển khoản.";
        setCardError(msg);
        toastApiError(msg);
        return { ok: false };
      } catch {
        const msg = "Lỗi hệ thống khi tạo giao dịch gói cước.";
        setCardError(msg);
        toastApiError(msg);
        return { ok: false };
      }
    }

    if (isCourse) {
      if (!courseId) {
        setCardError("Thiếu mã khóa học.");
        return { ok: false };
      }
      if (!courseInfo) {
        setCardError("Đang tải thông tin khóa học…");
        return { ok: false };
      }
      const expected = Number(courseInfo.price ?? 0);
      if (!Number.isFinite(expected) || expected <= 0) {
        setCardError("Khóa học miễn phí không cần thanh toán tại đây. Hãy đăng ký trực tiếp trên trang khóa học.");
        return { ok: false };
      }
      // URL ?price= có thể cũ/sai, luôn ghi danh theo giá API, không chặn (tránh webhook SePay không khớp đơn).
      if (courseUrlPrice > 0 && Math.round(expected) !== Math.round(courseUrlPrice)) {
        console.warn(
          "[checkout] URL price",
          courseUrlPrice,
          "≠ server price",
          expected,
          "— dùng giá server cho ghi danh.",
        );
      }
      setCardError("");
      try {
        const apiRes = await enrollmentApi.enroll(courseId, { paymentMethod: "transfer", orderNum });
        const eid = apiRes.enrollment?._id || apiRes.enrollment?.id;
        if (apiRes.success && eid) {
          trackAction("course_enroll", "/checkout", {
            courseId,
            paid: true,
            enrollmentId: String(eid),
          });
          const serverOrder = extractOrderPart(apiRes.orderNum || apiRes.enrollment?.paymentRef);
          if (serverOrder) setTransferOrderNum(serverOrder);
          setBankEnrollmentId(String(eid));
          applyPaymentExpiryFromApi(
            setPaymentExpiresAtMs,
            setPaymentExpired,
            apiRes.paymentExpiresAt || apiRes.enrollment?.paymentExpiresAt,
          );
          setAppStep("awaiting_transfer");
          if (!silent) toastApiSuccess("Đã tạo đơn mua khóa học. Quét QR và chuyển khoản, hệ thống tự xác nhận qua SePay.");
          return { ok: true, enrollmentId: String(eid) };
        }
        const msg = apiRes.error || "Không thể tạo đơn mua khóa học chờ chuyển khoản.";
        setCardError(msg);
        toastApiError(msg);
        return { ok: false };
      } catch {
        const msg = "Lỗi hệ thống khi mua khóa học.";
        setCardError(msg);
        toastApiError(msg);
        return { ok: false };
      }
    }

    if (!bookingMentor) {
      setCardError("Thiếu thông tin đặt lịch. Hãy quay lại bước đặt lịch với mentor.");
      return { ok: false };
    }

    const MAX_SLOTS = 5;
    const slotsToBook = bookingSlots ?? [{ dateKey: bookingDate, time: bookingTime }];
    if (!slotsToBook.length || slotsToBook.some((s) => !s.dateKey || !s.time)) {
      setCardError("Thiếu thông tin ngày/giờ. Hãy quay lại chọn lịch.");
      return { ok: false };
    }
    if (slotsToBook.length > MAX_SLOTS) {
      setCardError(`Tối đa ${MAX_SLOTS} buổi trên một đơn đặt lịch.`);
      return { ok: false };
    }

    for (const slot of slotsToBook) {
      if (!isBookingSlotInFuture(slot.dateKey, slot.time)) {
        const msg = `Slot ${slot.time} ngày ${slot.dateKey} đã qua. Vui lòng chọn lại.`;
        setCardError(msg);
        toastApiError(msg);
        return { ok: false };
      }
    }

    if (rebookCreditTooLow) {
      const msg = `Buổi mới ${fmt(bookingTotalEstimate)} cao hơn credit ${fmt(rebookCreditVnd)}. Chọn mentor rẻ hơn hoặc hoàn tiền ở buổi cũ.`;
      setCardError(msg);
      toastApiError(msg);
      return { ok: false };
    }
    if (rebookSameMentor) {
      const msg = "Chọn mentor khác hoặc quay buổi cũ chọn «Đổi lịch».";
      setCardError(msg);
      toastApiError(msg);
      return { ok: false };
    }

    setCardError("");
    try {
      if (canUseRebookCredit && rebookFrom) {
        const slot = slotsToBook[0];
        const apiRes = await createBooking({
          mentorId: bookingMentor.id,
          date: slot.dateKey,
          timeSlot: slot.time,
          sessionType: bookingSessionType,
          position: bookingPosition,
          note: bookingNote,
          cvFile: bookingCvFile || "",
          cvFileUrl: bookingCvFileUrl || "",
          jdFile: bookingJdFile || "",
          jdFileUrl: bookingJdFileUrl || "",
          price: bookingPricePerSlot,
          durationMinutes: 60,
          applyRebookCreditFromBookingId: rebookFrom,
        });
        if (apiRes.success && apiRes.booking?.id) {
          trackAction("booking_submit", "/checkout", {
            mentorId: bookingMentor.id,
            bookingId: apiRes.booking.id,
            rebookCredit: true,
          });
          try {
            sessionStorage.removeItem("prointerview_rebook_from");
          } catch {
            /* ignore */
          }
          navigate(`/session/${encodeURIComponent(apiRes.booking.id)}`);
          return { ok: false };
        }
        const msg = apiRes.error || "Không thể áp dụng credit đổi mentor.";
        setCardError(msg);
        toastApiError(msg);
        return { ok: false };
      }

      // Create each slot as a separate booking, all sharing the same orderNum.
      // After slot 1, use the server-confirmed paymentRef for subsequent slots (A2).
      let confirmedOrderNum = orderNum;
      const createdIds = [];
      for (const slot of slotsToBook) {
        const apiRes = await createBooking({
          mentorId: bookingMentor.id,
          date: slot.dateKey,
          time: slot.time,
          timeSlot: slot.time,
          sessionType: bookingSessionType,
          position: bookingPosition,
          note: bookingNote,
          cvFile: bookingCvFile || "",
          cvFileUrl: bookingCvFileUrl || "",
          jdFile: bookingJdFile || "",
          jdFileUrl: bookingJdFileUrl || "",
          price: bookingPricePerSlot,
          durationMinutes: 60,
          orderNum: confirmedOrderNum,
          paymentStatus: "pending",
          paymentMethod: "transfer",
        });
        if (!apiRes.success || !apiRes.booking?.id) {
          // Rollback: cancel all bookings already created in this order (A1).
          for (const id of createdIds) {
            cancelBooking(id).catch(() => {});
          }
          const msg = apiRes.error || `Không thể tạo lịch buổi ${slot.time} ngày ${slot.dateKey}.`;
          setCardError(msg);
          toastApiError(msg);
          return { ok: false };
        }
        createdIds.push(apiRes.booking.id);
        if (createdIds.length === 1) {
          const serverOrder = extractOrderPart(apiRes.booking?.paymentRef);
          if (serverOrder) {
            setTransferOrderNum(serverOrder);
            confirmedOrderNum = serverOrder; // use server-confirmed ref for remaining slots (A2)
          }
          setBankBookingId(apiRes.booking.id);
          applyPaymentExpiryFromApi(setPaymentExpiresAtMs, setPaymentExpired, apiRes.booking?.paymentExpiresAt);
        }
      }

      trackAction("booking_submit", "/checkout", {
        mentorId: bookingMentor.id,
        bookingIds: createdIds,
        slotCount: createdIds.length,
        paymentMethod: "transfer",
      });
      setAppStep("awaiting_transfer");
      if (!silent) {
        toastApiSuccess(
          createdIds.length > 1
            ? `Đã tạo ${createdIds.length} buổi hẹn. Chuyển khoản 1 lần, hệ thống tự xác nhận tất cả.`
            : "Đã tạo lịch. Quét QR, chuyển khoản, khi tiền vào sẽ tự xác nhận.",
        );
      }
      return { ok: true, bookingId: createdIds[0], bookingIds: createdIds };
    } catch {
      const msg = "Lỗi hệ thống khi tạo lịch hẹn.";
      setCardError(msg);
      toastApiError(msg);
      return { ok: false };
    }
  };

  const hasBank = Boolean(BANK_TRANSFER.bankName && BANK_TRANSFER.accountNumber);
  const showBankQr = payMode === PAY_MODE.BANK && payAmount > 0;
  /** Booking / khóa / gói cước: màn gọn chỉ còn khối chuyển khoản (QR + STK), không layout 2 cột cũ. */
  const transferFocus = showBankQr && (isBooking || isCourse || isPlanCheckout);
  const orderCreated = appStep === "awaiting_transfer";
  const paymentConfirmed = appStep === "paid";
  const stepCurrent = paymentConfirmed || orderCreated ? 2 : 1;
  const showPriceBreakdown = couponApplied && !isCourse;

  const resolvePaidRedirect = (apiRedirect) => {
    if (apiRedirect) return apiRedirect;
    if (isCourse && courseId) return `/courses/${encodeURIComponent(courseId)}/learn`;
    if (isBooking && bankBookingId) return `/session/${encodeURIComponent(bankBookingId)}`;
    if (isPlanCheckout) return "/dashboard?planUpgraded=1";
    return "/dashboard";
  };

  const handlePaymentSuccess = async (pollResult) => {
    if (paidRedirectStartedRef.current) return;
    paidRedirectStartedRef.current = true;
    const target = resolvePaidRedirect(pollResult?.redirectTo);
    setAwaitingAutoConfirm(false);
    setAppStep("paid");

    if (isPlanCheckout) {
      trackAction("plan_upgrade", "/checkout", {
        plan: plan?.planKey || searchParams.get("plan") || "",
        billing,
        sepayAuto: Boolean(pollResult?.sepayAuto),
      });
      try {
        const pr = await fetchCurrentPlan();
        if (pr.success) {
          setLoggedIn({
            ...getUser(),
            plan: pr.plan,
            planExpiresAt: pr.planExpiresAt,
          });
        }
      } catch {
        /* ignore */
      }
    }

    const toastMsg = pollResult?.sepayAuto
      ? isPlanCheckout
        ? `Chuyển khoản thành công! Gói ${plan.name} đã được kích hoạt.`
        : isCourse
          ? "Chuyển khoản thành công! Đang mở trang học…"
          : "Chuyển khoản thành công!"
      : isPlanCheckout
        ? `Gói ${plan.name} đã được kích hoạt.`
        : "Thanh toán đã được xác nhận.";
    toastApiSuccess(toastMsg);
    if (isPlanCheckout) {
      clearPlanCheckoutSession(planKey, billing);
    }
    const successSubtitle = isPlanCheckout
      ? `Gói ${plan.name} đã được kích hoạt sau chuyển khoản.`
      : isCourse
        ? "Khóa học đã sẵn sàng, bạn có thể vào học ngay."
        : isBooking
          ? "Buổi mentor đã được xác nhận sau chuyển khoản."
          : "Chuyển khoản đã được xác nhận thành công.";
    const primaryCta = isCourse
      ? "Vào học ngay"
      : isBooking
        ? "Xem buổi hẹn"
        : isPlanCheckout
          ? "Về Dashboard"
          : "Tiếp tục";
    navigate("/payment-success", {
      replace: true,
      state: {
        flow: "transfer",
        nextPath: target,
        subtitle: successSubtitle,
        primaryCta,
        details: {
          amount: fmt(payAmount),
          orderId: transferOrderNum,
          date: new Date().toLocaleString("vi-VN"),
        },
      },
    });
  };

  const pollErrorShownRef = useRef(false);

  const handleRetryTransferOrder = async () => {
    const nextOrderNum = `PI${Math.floor(Math.random() * 900000 + 100000)}`;
    autoOrderStartedRef.current = true;
    pollErrorShownRef.current = false;
    setPaymentExpired(false);
    setPaymentExpiresAtMs(null);
    setExpiresInMs(null);
    setAwaitingAutoConfirm(false);
    setAppStep("checkout");
    setTransferOrderNum(nextOrderNum);
    setCardError("");
    if (isPlanCheckout) {
      clearPlanCheckoutSession(planKey, billing);
    }
    const created = await handlePay({
      silent: false,
      orderNumOverride: nextOrderNum,
      forceNew: isPlanCheckout,
    });
    if (created?.ok) {
      // Chỉ xóa ID cũ sau khi đơn mới tạo thành công
      setBankBookingId(null);
      setBankEnrollmentId(null);
      setBankSubscriptionPaymentId(null);
    } else {
      autoOrderStartedRef.current = false;
    }
  };

  useEffect(() => {
    if (!paymentExpiresAtMs || paymentConfirmed || paymentExpired) return undefined;
    const tick = () => {
      const left = paymentExpiresAtMs - Date.now();
      if (left <= 0) {
        setExpiresInMs(0);
        setPaymentExpired(true);
        setAwaitingAutoConfirm(false);
        return;
      }
      setExpiresInMs(left);
    };
    tick();
    const iv = window.setInterval(tick, 1000);
    return () => window.clearInterval(iv);
  }, [paymentExpiresAtMs, paymentConfirmed, paymentExpired]);

  useEffect(() => {
    if (!showBankQr || !isLoggedIn() || payBlocked || orderCreated || autoOrderStartedRef.current || paymentExpired) return;
    if (isCourse && !courseInfo) return;
    if (isBooking && (!bookingMentor || !bookingDate || !bookingTime)) return;
    autoOrderStartedRef.current = true;
    (async () => {
      await handlePay({ silent: true });
      // Do NOT reset autoOrderStartedRef on failure — prevents auto-retry loop after partial
      // creation + rollback. User must explicitly click "Thử lại" (handleRetryTransferOrder).
    })();
  }, [
    showBankQr,
    payBlocked,
    orderCreated,
    paymentExpired,
    isCourse,
    courseInfo,
    isBooking,
    bookingMentor,
    bookingDate,
    bookingTime,
  ]);

  const runTransferPoll = async () => {
    if (paymentExpired) return;
    const r = await fetchTransferStatus(transferOrderNum);
    if (r.success && r.status === "paid") {
      handlePaymentSuccess(r);
      return;
    }
    if (r.success && r.status === "expired") {
      setPaymentExpired(true);
      setAwaitingAutoConfirm(false);
      setExpiresInMs(0);
      if (isPlanCheckout) {
        clearPlanCheckoutSession(planKey, billing);
      }
      toastApiError("Đơn thanh toán đã hết hạn. Tạo mã mới để thử lại.");
      return;
    }
    if (r.success) {
      if (r.paymentExpiresAt) applyPaymentExpiryFromApi(setPaymentExpiresAtMs, setPaymentExpired, r.paymentExpiresAt);
      if (Number.isFinite(r.expiresInMs)) setExpiresInMs(Math.max(0, r.expiresInMs));
      if (r.timeoutMinutes) setTransferTimeoutMinutes(r.timeoutMinutes);
    }
    if (!r.success && !pollErrorShownRef.current) {
      pollErrorShownRef.current = true;
      toastApiError(
        r.error ||
        "Không kiểm tra được trạng thanh toán. Kiểm tra đăng nhập và kết nối API (VITE_API_URL / CORS).",
      );
    }
  };

  useEffect(() => {
    if (!orderCreated || paymentConfirmed || !showBankQr || !transferOrderNum || paymentExpired) {
      setAwaitingAutoConfirm(false);
      return undefined;
    }
    setAwaitingAutoConfirm(true);
    pollErrorShownRef.current = false;
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      await runTransferPoll();
    };
    const t0 = window.setTimeout(poll, 2000);
    const iv = window.setInterval(poll, 3000);
    return () => {
      cancelled = true;
      window.clearTimeout(t0);
      window.clearInterval(iv);
    };
  }, [
    orderCreated,
    paymentConfirmed,
    showBankQr,
    transferOrderNum,
    courseId,
    bankBookingId,
    paymentExpired,
  ]);

  /* ── Checkout UI ── */
  return (
    <div className={`${pageShell} flex min-h-svh flex-col`}>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .fade-in { animation: fadeIn 0.35s ease-out both; }
      `}</style>

      <div className="app-shell-ambient" aria-hidden />
      <Navbar variant="customer" />

      <main
        className={`fade-in relative z-[1] w-full ${mainTopPad} ${CUSTOMER_SHELL_GUTTER} ${transferFocus
            ? `${CUSTOMER_SHELL_MAX} mx-auto flex flex-1 flex-col pb-8`
            : "mx-auto max-w-6xl flex-1 flex-col pb-10"
          }`}
      >
        {transferFocus ? (
          <div className="flex flex-col">
            {!orderCreated ? (
              <div className={`${checkoutCard} flex flex-col items-center justify-center gap-2 p-8 text-center`}>
                <span className="inline-block h-7 w-7 animate-spin rounded-full border-2 border-violet-200 border-t-[#8037f4]" />
                <p className="text-sm font-medium text-slate-600">Đang tạo đơn chờ chuyển khoản…</p>
              </div>
            ) : (
              <div className="rounded-lg bg-white p-4 shadow-[0_16px_48px_rgba(128,55,244,0.1)] ring-1 ring-[#8037f4]/10 sm:p-5">
                <header className="mb-3 shrink-0 border-b border-[#8037f4]/8 pb-3">
                  <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Thanh toán chuyển khoản</h1>
                  <p className="mt-1 text-sm text-slate-600">
                    Quét QR hoặc chuyển thủ công, hệ thống tự xác nhận qua SePay.
                  </p>
                </header>
                <div className="relative z-0">
                  <BankTransferBlock
                    variant="large"
                    hasBank={hasBank}
                    payAmount={payAmount}
                    transferOrderNum={transferOrderNum}
                    fmt={fmt}
                    vietQrUrl={vietQrUrl}
                    vietQrLoadFailed={vietQrLoadFailed}
                    onQrError={() => setVietQrLoadFailed(true)}
                    onOpenQrModal={() => setQrModalOpen(true)}
                    expiresInMs={expiresInMs}
                    paymentExpired={paymentExpired}
                    timeoutMinutes={transferTimeoutMinutes}
                    onRetryOrder={handleRetryTransferOrder}
                  />
                </div>
                {awaitingAutoConfirm && !paymentConfirmed && !paymentExpired ? (
                  <div className="relative z-10 mt-4 shrink-0">
                    <div className="flex items-center justify-center gap-2.5 rounded border border-[#8037f4]/12 bg-[#faf8ff] px-4 py-2.5 text-sm font-medium text-[#630ed4]">
                      <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                        <span
                          className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#93f72b]/70 opacity-75"
                        />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#93f72b]" />
                      </span>
                      Đang chờ xác nhận thanh toán…
                    </div>
                  </div>
                ) : null}
                {cardError ? (
                  <div className="mt-4 flex shrink-0 items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{cardError}</span>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Thanh toán</h1>
                {orderCreated ? (
                  <p className={`mt-1 ${textMuted}`}>
                    Mã CK: <span className="font-mono font-semibold text-slate-800">{transferOrderNum}</span>
                  </p>
                ) : null}
              </div>
              {showStepBar ? <StepBar current={stepCurrent} steps={stepLabels} /> : null}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start">
              <div className="min-w-0 space-y-4">
                {!compactRebook && (
                  <OrderLineItem
                    isBooking={isBooking}
                    isCourse={isCourse}
                    bookingMentor={bookingMentor}
                    courseInfo={courseInfo}
                    plan={plan}
                    billing={billing}
                    bookingDate={bookingDate}
                    bookingTime={bookingTime}
                    bookingSessionType={bookingSessionType}
                    bookingSlots={bookingSlots}
                    baseTotal={baseTotal}
                    fmt={fmt}
                  />
                )}

                <div className={`${checkoutCard} p-5 sm:p-6`}>
                  <CheckoutPayPanel
                    mode={payMode}
                    fmt={fmt}
                    rebookCreditVnd={rebookCreditVnd}
                    bookingTotalEstimate={bookingTotalEstimate}
                    bookingMentor={bookingMentor}
                    rebookFrom={rebookFrom}
                    navigate={navigate}
                  />

                  {showBankQr && (
                    <>
                      <h2 className="mb-4 text-base font-semibold text-slate-900">Chuyển khoản</h2>
                      <BankTransferBlock
                        hasBank={hasBank}
                        payAmount={payAmount}
                        transferOrderNum={transferOrderNum}
                        fmt={fmt}
                        vietQrUrl={vietQrUrl}
                        vietQrLoadFailed={vietQrLoadFailed}
                        onQrError={() => setVietQrLoadFailed(true)}
                        onOpenQrModal={() => setQrModalOpen(true)}
                        expiresInMs={expiresInMs}
                        paymentExpired={paymentExpired}
                        timeoutMinutes={transferTimeoutMinutes}
                        onRetryOrder={handleRetryTransferOrder}
                      />
                    </>
                  )}

                  {isPlanCheckout && !isCourse && !isBooking && (
                    <div className="mt-5 border-t border-slate-200 pt-5">
                      {/* Coupon tạm thời ẩn — chờ backend implement coupon validation */}
                      {false && (
                        <>
                          <p className={`mb-2 ${labelMuted}`}>Mã khuyến mãi</p>
                        </>
                      )}
                      <ul className="mt-4 space-y-2">
                        {plan.features.slice(0, 3).map((f, i) => (
                          <li key={i} className={`flex items-start gap-2 text-xs ${textMuted}`}>
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8037f4]" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {cardError && (
                    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{cardError}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Cột phải ~30%: tóm tắt + xác nhận CK */}
              <aside className="min-w-0">
                <div className={`${checkoutCard} sticky top-20 overflow-hidden`}>
                  <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
                    <p className={labelMuted}>Tổng cộng</p>
                    <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{fmt(grandTotal)}</p>
                  </div>

                  {showPriceBreakdown ? (
                    <div className="space-y-2 px-5 py-4 sm:px-6">
                      {couponApplied && !isCourse && (
                        <div className="flex justify-between text-sm">
                          <span className={labelMuted}>Mã giảm (10%)</span>
                          <span className="font-medium text-emerald-600">−{fmt(discount)}</span>
                        </div>
                      )}
                    </div>
                  ) : null}

                  <div className="border-t border-slate-200 p-5 sm:p-6">
                    {!payBlocked && !orderCreated && !showBankQr ? (
                      <button
                        type="button"
                        onClick={handlePay}
                        disabled={!isPaidCheckout || payMode === PAY_MODE.REBOOK_LOADING}
                        className={`${landingPrimaryButtonClass} h-12 w-full gap-2 rounded-xl text-base font-semibold disabled:pointer-events-none disabled:opacity-40`}
                      >
                        <Lock className="h-4 w-4" />
                        {payMode === PAY_MODE.REBOOK_READY ? "Xác nhận đặt lại" : "Tiếp tục"}
                      </button>
                    ) : null}
                    {showBankQr && orderCreated && !paymentConfirmed && awaitingAutoConfirm && !paymentExpired ? (
                      <div className="flex items-center justify-center gap-2 rounded-xl border border-[#8037f4]/12 bg-[#faf8ff] py-2.5 text-center text-sm font-medium text-[#630ed4]">
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#8037f4]/20 border-t-[#8037f4]" />
                        Đang chờ xác nhận thanh toán…
                      </div>
                    ) : null}
                    {showBankQr && !orderCreated && !payBlocked ? (
                      <p className={`text-center text-xs ${labelMuted}`}>Đang tạo đơn…</p>
                    ) : null}
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
      </main>

      {paymentSuccessOverlay ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          role="alertdialog"
          aria-live="assertive"
          aria-label="Thanh toán thành công"
        >
          <div className="w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-9 w-9 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">{paymentSuccessOverlay.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{paymentSuccessOverlay.subtitle}</p>
          </div>
        </div>
      ) : null}

      {showBankQr && (
        <VietQrModal
          open={qrModalOpen}
          onClose={() => setQrModalOpen(false)}
          payAmount={payAmount}
          transferOrderNum={transferOrderNum}
          fmt={fmt}
          vietQrUrl={vietQrUrl}
          vietQrLoadFailed={vietQrLoadFailed}
          onQrError={() => setVietQrLoadFailed(true)}
        />
      )}
    </div>
  );
}
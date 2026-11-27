import React from "react";
import { Link, useLocation } from "react-router";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { useWorkspaceTheme } from "../../hooks/useWorkspaceTheme.js";

const DEFAULT_SUBTITLE = "Gói dịch vụ ProInterview của bạn đã được kích hoạt.";

/**
 * Trang thanh toán thành công: chuyển khoản (Checkout → state `flow: "transfer"`) hoặc VNPay (`PaymentReturn`).
 * State: { flow, nextPath, subtitle, primaryCta, details: { amount, orderId, transNo, date } }.
 * Giao diện theo docs/UI_STYLE_GUIDE.md; trang toàn màn hình (không có MentorPageShell) nên tự viết màu sáng / tối.
 */
export function SuccessPage() {
  const { state } = useLocation();
  const light = useWorkspaceTheme(true).resolved === "light";
  const details = state?.details || {};
  const nextPath = state?.nextPath;
  const subtitle = state?.subtitle || DEFAULT_SUBTITLE;
  const isTransfer = state?.flow === "transfer";
  const primaryTo = nextPath || "/";
  const primaryLabel = nextPath ? state?.primaryCta || "Tiếp tục" : "Về trang chủ";
  const secondaryTo = nextPath ? "/" : "/pricing";
  const secondaryLabel = nextPath ? "Về trang chủ" : "Xem bảng giá";

  const rows = [
    details.orderId && { label: isTransfer ? "Mã chuyển khoản" : "Mã đơn hàng", value: details.orderId, mono: true },
    details.transNo && { label: "Mã giao dịch", value: details.transNo, mono: true },
    details.date && { label: "Thời gian", value: details.date },
  ].filter(Boolean);

  const c = light
    ? {
        page: "bg-[#efebfa]",
        panel: "border-[#ddd3f5] bg-white shadow-sm",
        title: "text-[#23252f]",
        body: "text-[#5b5772]",
        icon: "border-emerald-200 bg-emerald-50 text-emerald-700",
        badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
        box: "border-[#ddd3f5] bg-[#f6f3fc]",
        divider: "border-[#ddd3f5]",
        label: "text-[#5b5772]",
        value: "text-[#23252f]",
        amount: "text-[#6d28d9]",
        primary: "border-[#7fd925]",
        secondary: "border-[#ddd3f5] bg-white text-[#23252f] hover:bg-[#efe9fc]",
        focus: "focus-visible:outline-[#6d28d9]",
      }
    : {
        page: "bg-[#120b2e]",
        panel: "border-white/10 bg-[#18113c]/80 backdrop-blur-xl",
        title: "text-white",
        body: "text-slate-300",
        icon: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
        badge: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
        box: "border-white/10 bg-white/[0.03]",
        divider: "border-white/10",
        label: "text-slate-400",
        value: "text-white",
        amount: "text-[#93f72b]",
        primary: "border-[#b8ff78]",
        secondary: "border-white/15 bg-white/5 text-white hover:border-violet-400/60 hover:bg-white/10",
        focus: "focus-visible:outline-[#93f72b]",
      };

  const btn = `inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border px-6 text-base font-black transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:w-auto ${c.focus}`;

  return (
    <main className={`flex min-h-screen items-center justify-center px-4 py-10 antialiased ${c.page}`}>
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        aria-labelledby="payment-success-title"
        className={`w-full max-w-md rounded-[24px] border p-6 text-center sm:p-8 ${c.panel}`}
      >
        <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full border ${c.icon}`}>
          <Check size={32} strokeWidth={2.5} aria-hidden />
        </span>

        <span className={`mt-5 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${c.badge}`}>
          <ShieldCheck size={14} aria-hidden />
          {isTransfer ? "Đã nhận chuyển khoản" : "Giao dịch đã xác nhận"}
        </span>

        <h1 id="payment-success-title" className={`font-headline mt-3 text-2xl font-black sm:text-3xl ${c.title}`}>
          Thanh toán thành công
        </h1>
        <p className={`mx-auto mt-2 max-w-sm text-base font-medium leading-relaxed ${c.body}`}>{subtitle}</p>

        {(details.amount || rows.length > 0) && (
          <dl className={`mt-6 rounded-[16px] border p-4 text-left ${c.box}`}>
            {details.amount && (
              <div className={`flex items-baseline justify-between gap-3 ${rows.length ? `border-b pb-3 ${c.divider}` : ""}`}>
                <dt className={`text-xs font-semibold ${c.label}`}>Số tiền</dt>
                <dd className={`text-2xl font-black tabular-nums ${c.amount}`}>{details.amount}</dd>
              </div>
            )}
            {rows.length > 0 && (
              <div className={`space-y-2 ${details.amount ? "pt-3" : ""}`}>
                {rows.map((r) => (
                  <div key={r.label} className="flex items-center justify-between gap-3">
                    <dt className={`text-xs font-semibold ${c.label}`}>{r.label}</dt>
                    <dd className={`min-w-0 break-words text-right text-sm font-bold tabular-nums ${r.mono ? "font-mono" : ""} ${c.value}`}>
                      {r.value}
                    </dd>
                  </div>
                ))}
              </div>
            )}
          </dl>
        )}

        {/* Điện thoại: nút chính ở trên; máy tính: nút phụ trái, nút chính phải (UI_STYLE_GUIDE 7.4). */}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <Link to={secondaryTo} data-button-surface="none" className={`${btn} ${c.secondary}`}>
            {secondaryLabel}
          </Link>
          <Link
            to={primaryTo}
            data-button-surface="none"
            className={`${btn} bg-[#93f72b] text-[#131f00] hover:bg-[#a8ff4e] ${c.primary}`}
          >
            {primaryLabel}
            <ArrowRight size={18} aria-hidden />
          </Link>
        </div>
      </motion.section>
    </main>
  );
}

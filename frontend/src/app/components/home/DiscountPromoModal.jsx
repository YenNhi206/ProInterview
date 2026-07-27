import React, { useState } from "react";
import { X, Copy, Check, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router";

// Phải khớp mã seed ở backend/src/scripts/seedCoupon.js — chưa có API lấy coupon đang active nên hard-code tạm ở đây.
const PROMO_COUPON_CODE = "LAUNCH50";
const PROMO_END = new Date("2026-08-22T23:59:59+07:00");
const DISMISSED_KEY = "pi_discount_modal_dismissed_v1";

export function DiscountPromoModal() {
  const [isOpen, setIsOpen] = useState(
    () => Date.now() <= PROMO_END.getTime() && !localStorage.getItem(DISMISSED_KEY)
  );
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setIsOpen(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(PROMO_COUPON_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden
      />

      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-300">
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow-md transition hover:bg-white hover:text-slate-800"
          aria-label="Đóng"
        >
          <X className="h-4 w-4" />
        </button>

        <div
          className="relative overflow-hidden px-6 pt-10 pb-8 sm:px-8 sm:pt-12"
          style={{ background: "linear-gradient(135deg, #630ed4 0%, #8037f4 100%)" }}
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white ring-1 ring-white/30">
            <Sparkles className="h-3.5 w-3.5 text-[#a3e635]" aria-hidden />
            Ưu đãi có hạn
          </span>
          <h2 className="mt-4 text-2xl font-black leading-tight text-white sm:text-3xl">
            Giảm <span className="text-[#a3e635]">50%</span> khi nâng cấp gói
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/85 sm:text-base">
            Nhập mã dưới đây tại trang thanh toán để nâng cấp Pro/Elite với giá chỉ còn một nửa.
          </p>
        </div>

        <div className="space-y-4 px-6 py-6 sm:px-8">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-violet-300 bg-violet-50 px-4 py-3">
            <span className="text-lg font-bold tracking-wider text-violet-700">
              {PROMO_COUPON_CODE}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-full border border-violet-300 px-3 py-1.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" /> Đã chép
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Chép mã
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-slate-500">
            Áp dụng đến hết ngày 22/08/2026. Mỗi tài khoản chỉ dùng được một lần.
          </p>

          <div className="flex flex-col gap-2.5 pt-1 sm:flex-row">
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex flex-none items-center justify-center whitespace-nowrap rounded-full py-3 px-5 text-sm font-bold text-[#8037f4] transition-all duration-300 hover:bg-violet-50/50 active:scale-[0.98]"
              style={{ border: "1.5px solid rgba(128, 55, 244, 0.45)" }}
            >
              Để sau
            </button>
            <Link
              to="/pricing"
              onClick={handleClose}
              className="group inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full py-3 px-4 sm:px-6 text-sm font-black transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #a3ff3d 0%, #8ae819 100%)",
                color: "#0f172a",
                boxShadow: "0 10px 30px -8px rgba(147,247,43,0.5)",
              }}
            >
              Xem bảng giá
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/10 transition-transform duration-300 group-hover:translate-x-0.5">
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

import React from "react";
import { X, Sparkles } from "lucide-react";

export function PromoBanner({ onClose }) {
  return (
    <div
      className="fixed left-0 right-0 top-0 z-[110] flex h-10 items-center justify-center gap-2 px-4 text-center"
      style={{
        background: "linear-gradient(90deg, #630ed4 0%, #8037f4 55%, #630ed4 100%)",
      }}
      role="banner"
    >
      <Sparkles className="hidden size-4 shrink-0 text-[#a3e635] sm:block" aria-hidden />
      <p className="truncate text-[11px] font-semibold text-white sm:text-sm">
        Đang có mã giảm giá{" "}
        <span className="font-black text-[#a3e635]">50%</span>{" "}
        khi nâng cấp gói — nhập mã ngay tại trang thanh toán!
      </p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Đóng thông báo khuyến mãi"
        className="absolute right-2 flex size-6 shrink-0 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white sm:right-4"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

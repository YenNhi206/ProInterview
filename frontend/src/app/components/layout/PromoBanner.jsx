import React from "react";
import { Sparkles, X } from "lucide-react";

export function PromoBanner({ onClose, onOpenPromoModal }) {
  return (
    <div
      className="fixed left-0 right-0 top-0 z-[110] flex h-10 items-center gap-2 overflow-hidden pl-4 pr-9 text-center sm:justify-center sm:px-4"
      style={{
        background: "linear-gradient(90deg, #630ed4 0%, #8037f4 55%, #630ed4 100%)",
      }}
      role="banner"
    >
      <Sparkles className="hidden size-4 shrink-0 text-[#a3e635] sm:block" aria-hidden />
      <button
        type="button"
        onClick={onOpenPromoModal}
        className="min-w-0 flex-1 truncate text-[11px] font-semibold text-white underline decoration-white/40 decoration-dotted underline-offset-2 sm:flex-initial sm:text-sm"
      >
        <span className="sm:hidden">
          Giảm giá <span className="font-black text-[#a3e635]">50%</span> khi nâng cấp gói!
        </span>
        <span className="hidden sm:inline">
          Đang có mã giảm giá{" "}
          <span className="font-black text-[#a3e635]">50%</span>{" "}
          khi nâng cấp gói — bấm để xem mã!
        </span>
      </button>
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

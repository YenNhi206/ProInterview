import React, { useState } from "react";
import { X, CalendarDays, MapPin, ArrowRight } from "lucide-react";

const REGISTER_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScDqdxgN_Uk48HX_Mh6JcErpT1xtQdWBRedP4KDJx4Y_SGuvg/viewform";

// Sự kiện diễn ra 07:00–12:30, 22/07/2026 — ẩn popup sau khi kết thúc.
const EVENT_END = new Date("2026-07-22T12:30:00+07:00");

export function EventPromoModal() {
  const [isOpen, setIsOpen] = useState(true);

  if (Date.now() > EVENT_END.getTime()) return null;
  if (!isOpen) return null;

  const handleClose = () => setIsOpen(false);

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
          className="relative px-6 pb-6 pt-10 sm:px-8 sm:pt-12"
          style={{ background: "linear-gradient(135deg, #630ed4 0%, #8037f4 100%)" }}
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white ring-1 ring-white/30">
            Sự kiện ProInterview
          </span>
          <h2 className="mt-4 text-2xl font-black leading-tight text-white sm:text-3xl">
            Sắp Có Công Ăn Việc Làm
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/85 sm:text-base">
            Cùng ProInterview tự tin chinh phục buổi phỏng vấn đầu tiên — luyện phỏng vấn AI, mock interview với Mentor và talkshow truyền cảm hứng.
          </p>
        </div>

        <div className="space-y-3 px-6 py-6 sm:px-8">
          <div className="flex items-start gap-3 text-sm text-slate-700">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[#630ed4]" />
            <span>
              <strong className="font-bold text-slate-900">07:00 – 12:30, 22/07/2026</strong>
            </span>
          </div>
          <div className="flex items-start gap-3 text-sm text-slate-700">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#630ed4]" />
            <span>
              Hội trường B, Trường Đại học FPT TP.HCM — Lô E2a-7, Đường D1 Khu Công nghệ cao, TP Thủ Đức, TP.HCM
            </span>
          </div>
          <p className="pt-1 text-xs text-slate-500">
            Dành cho sinh viên mọi trường đại học, cao đẳng — không giới hạn sinh viên FPT. Số lượng chỗ ngồi có hạn.
          </p>

          <div className="flex flex-col gap-3 pt-3 sm:flex-row">
            <a
              href={REGISTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleClose}
              className="group inline-flex flex-1 items-center justify-center gap-2 rounded-full py-3 pl-6 pr-3 text-sm font-black transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #a3ff3d 0%, #8ae819 100%)",
                color: "#0f172a",
                boxShadow: "0 10px 30px -8px rgba(147,247,43,0.5)",
              }}
            >
              Đăng ký tham gia ngay
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/10 transition-transform duration-300 group-hover:translate-x-0.5">
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </a>
            <button
              onClick={handleClose}
              className="rounded-full border border-slate-200 px-5 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50"
            >
              Để sau
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

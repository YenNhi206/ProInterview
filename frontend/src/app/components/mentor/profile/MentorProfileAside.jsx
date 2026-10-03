import {
  Video,
  Calendar,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { MENTOR_BOOKING_COPY } from "../../../constants/brandVoice";
import { formatVnd } from "../../../utils/shared/formatVnd.js";
import { getPlans } from "../../../utils/auth/auth.js";

function formatPriceVnd(amount) {
  return formatVnd(amount);
}

export function MentorProfileAside({
  mentor,
  bookingHref,
  onBook,
  onReport,
  scheduleRows,
}) {
  const mock =
    Array.isArray(mentor.sessionTypes) &&
    mentor.sessionTypes.find((s) => s?.type === "mock_interview");
  const price = mock?.price ?? mentor.price ?? 0;
  const minutes = mock?.durationMinutes ?? 60;
  /* Ưu đãi Pro/Elite (-5%/-10%) — ước tính hiển thị theo plan hiện tại, số tiền thật chốt ở /checkout. */
  const perkPlans = getPlans();
  const perkDiscountRate = perkPlans.elitePro ? 0.1 : perkPlans.starterPro ? 0.05 : 0;
  const perkDiscountAmount = price > 0 && perkDiscountRate > 0 ? Math.round(price * perkDiscountRate) : 0;
  const perkFinalPrice = price - perkDiscountAmount;

  const features = [
    { icon: Video, text: MENTOR_BOOKING_COPY.sessionVia },
    { icon: Calendar, text: MENTOR_BOOKING_COPY.flexibleSchedule },
    { icon: ShieldCheck, text: MENTOR_BOOKING_COPY.feedbackAfter },
  ];

  return (
    <aside className="m-0 space-y-4 lg:mt-0 lg:sticky lg:top-6 lg:self-start">
      <div className="relative overflow-hidden rounded-3xl border border-violet-500/30 bg-gradient-to-b from-[#1d1245]/95 via-[#130c2e]/95 to-[#0b061c]/98 backdrop-blur-2xl p-6 shadow-[0_25px_60px_-15px_rgba(128,55,244,0.35)]">
        {/* Top ambient neon glow orb */}
        <div className="pointer-events-none absolute -top-14 -right-14 size-44 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />

        <div className="border-b border-white/10 pb-4 relative z-10">
          <p className="text-xs font-black uppercase tracking-wider text-slate-400">
            {MENTOR_BOOKING_COPY.sessionTitle}
          </p>
          <div className="mt-2 flex flex-wrap items-baseline gap-2.5">
            <span className="text-3xl sm:text-[34px] font-black tracking-tight text-white drop-shadow-[0_2px_12px_rgba(168,85,247,0.3)]">
              {formatPriceVnd(price)}
            </span>
            {perkDiscountAmount > 0 && (
              <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300 shadow-xs">
                Ưu đãi: {formatPriceVnd(perkFinalPrice)}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs font-medium text-slate-400">/ {minutes} phút</p>
        </div>

        <ul className="my-5 space-y-3 relative z-10">
          {features.map((item) => (
            <li key={item.text} className="flex items-center gap-3 text-sm text-slate-200">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 border border-violet-400/30 text-violet-300 shadow-[0_0_10px_rgba(139,92,246,0.2)]">
                <item.icon className="size-3.5" aria-hidden />
              </span>
              <span className="leading-snug text-[13px]">{item.text}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onBook}
          className="group relative overflow-hidden flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-500 hover:via-indigo-500 hover:to-purple-500 py-3.5 text-sm font-bold text-white shadow-[0_10px_30px_-5px_rgba(139,92,246,0.5)] hover:shadow-[0_15px_40px_-5px_rgba(139,92,246,0.7)] transition-all active:scale-[0.98] cursor-pointer"
        >
          <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
          <span>Đặt lịch ngay</span>
          <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" aria-hidden />
        </button>

        <button
          type="button"
          onClick={onReport}
          className="mt-4 flex w-full items-center justify-center gap-2 border-t border-white/10 pt-4 text-xs font-medium text-slate-400 transition-colors hover:text-rose-400 cursor-pointer"
        >
          <AlertTriangle size={14} aria-hidden />
          Báo cáo mentor
        </button>
      </div>

      {scheduleRows.length > 0 ? (
        <div id="mentor-weekly-schedule" className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-5 shadow-lg">
          <h3 className="mb-3 text-sm font-bold text-white">Lịch tư vấn (theo tuần)</h3>
          <ul className="space-y-2 text-sm">
            {scheduleRows.map((row) => (
              <li
                key={row.day}
                className="flex justify-between gap-3 border-b border-white/5 py-2 last:border-0"
              >
                <span className="font-semibold text-slate-200">{row.day}</span>
                <span className="text-right text-violet-300 font-mono text-xs">{row.slots}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}

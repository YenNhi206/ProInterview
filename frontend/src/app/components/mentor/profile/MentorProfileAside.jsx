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
      <div className="glass-card overflow-hidden border-violet-200/60 p-5 shadow-[0_12px_40px_rgba(128,55,244,0.08)] sm:p-6">
        <div className="border-b border-violet-100 pb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {MENTOR_BOOKING_COPY.sessionTitle}
          </p>
          <p className="mt-2 flex flex-wrap items-baseline gap-2">
            {perkDiscountAmount > 0 && (
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">
                -{Math.round(perkDiscountRate * 100)}% {perkPlans.elitePro ? "Elite" : "Pro"}
              </span>
            )}
            <span className="text-3xl font-bold tracking-tight text-slate-900">
              {formatPriceVnd(perkFinalPrice)}
            </span>
            {perkDiscountAmount > 0 && (
              <span className="text-sm text-slate-400 line-through">{formatPriceVnd(price)}</span>
            )}
          </p>
          <p className="mt-1 text-sm text-slate-600">/ {minutes} phút</p>
        </div>

        <ul className="my-4 space-y-3">
          {features.map((item) => (
            <li key={item.text} className="flex items-start gap-3 text-sm text-slate-700">
              <item.icon className="mt-0.5 size-4 shrink-0 text-violet-600" aria-hidden />
              {item.text}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onBook}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime-400 py-3.5 text-sm font-bold text-violet-950 shadow-md transition hover:bg-lime-500 active:scale-[0.99]"
        >
          Đặt lịch ngay
          <ArrowRight size={18} aria-hidden />
        </button>

        <button
          type="button"
          onClick={onReport}
          className="mt-4 flex w-full items-center justify-center gap-2 border-t border-violet-100 pt-4 text-xs font-medium text-slate-500 transition-colors hover:text-red-600"
        >
          <AlertTriangle size={14} aria-hidden />
          Báo cáo mentor
        </button>
      </div>

      {scheduleRows.length > 0 ? (
        <div id="mentor-weekly-schedule" className="glass-card p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-bold text-slate-900">Lịch tư vấn (theo tuần)</h3>
          <ul className="space-y-2 text-sm">
            {scheduleRows.map((row) => (
              <li
                key={row.day}
                className="flex justify-between gap-3 border-b border-slate-100 py-2 last:border-0"
              >
                <span className="font-medium text-slate-800">{row.day}</span>
                <span className="text-right text-slate-600">{row.slots}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}

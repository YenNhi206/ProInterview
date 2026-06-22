import {
  Video,
  Calendar,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { MENTOR_BOOKING_COPY } from "../../../constants/brandVoice";
import { formatVnd } from "../../../utils/shared/formatVnd.js";

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
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {formatPriceVnd(price)}
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
          className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-lime-400 py-3.5 text-sm font-bold text-violet-950 shadow-md transition hover:bg-lime-500 active:scale-[0.99]"
        >
          Đặt lịch ngay
          <ArrowRight size={18} aria-hidden />
        </button>
        <a
          href={bookingHref}
          onClick={(e) => {
            e.preventDefault();
            onBook();
          }}
          className="flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-700 transition hover:border-violet-200 hover:bg-violet-50/50"
        >
          Xem lịch trống
        </a>

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
        <div className="glass-card p-4 sm:p-5">
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

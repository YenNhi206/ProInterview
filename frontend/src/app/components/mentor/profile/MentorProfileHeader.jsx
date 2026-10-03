import {
  Star,
  BadgeCheck,
  Briefcase,
  Building2,
  MapPin,
  Clock,
} from "lucide-react";
import {
  mentorDisplayTitle,
  mentorFieldTags,
  mentorLocationLabel,
} from "../../../utils/mentor/mentorProfileHelpers.js";

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <li className="flex items-center gap-2.5 rounded-2xl bg-white/[0.03] border border-white/5 px-3.5 py-2.5 text-sm text-slate-300">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 border border-violet-500/25 text-violet-400">
        <Icon className="size-3.5" aria-hidden />
      </div>
      <span className="min-w-0 truncate">
        <span className="text-slate-400 font-medium">{label}: </span>
        <span className="font-semibold text-white">{value}</span>
      </span>
    </li>
  );
}

export function MentorProfileHeader({ mentor, ratingDisplay, reviewCount, experienceYears }) {
  const avatarUrl = mentor.avatar?.trim();
  const initials = (mentor.name || "M")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const fieldTags = mentorFieldTags(mentor);
  const subtitle = mentorDisplayTitle(mentor);
  const location = mentorLocationLabel(mentor.timezone);
  const expLabel =
    experienceYears > 0 ? `${experienceYears} năm` : null;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
      {/* Top subtle highlight line */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-violet-400/50 to-transparent" />

      <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
        <div className="flex shrink-0 flex-col items-center sm:items-start">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="size-28 rounded-full object-cover ring-4 ring-violet-500/30 shadow-[0_0_25px_rgba(139,92,246,0.3)] sm:size-32"
            />
          ) : (
            <div className="flex size-28 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-600 text-2xl font-black text-white shadow-[0_0_25px_rgba(139,92,246,0.3)] ring-4 ring-violet-500/30 sm:size-32">
              {initials}
            </div>
          )}
          {mentor.available ? (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-300">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
              Sẵn sàng nhận lịch
            </span>
          ) : (
            <span className="mt-3 inline-flex rounded-full bg-slate-800 border border-white/10 px-3 py-1 text-xs font-medium text-slate-400">
              Đang bận
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h1 className="flex flex-wrap items-center justify-center gap-2 text-2xl font-black text-white sm:justify-start sm:text-3xl tracking-tight">
            {mentor.name}
            {Boolean(mentor.name && mentor.title && mentor.company && mentor.avatar) ? (
              <BadgeCheck
                className="size-6 shrink-0 fill-amber-400 text-slate-950"
                aria-label="Mentor đầy đủ thông tin"
              />
            ) : null}
          </h1>

          {fieldTags.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap justify-center gap-2 sm:justify-start">
              {fieldTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-block rounded-xl border border-violet-500/25 bg-violet-500/15 px-3 py-1 text-xs font-semibold text-violet-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <p className="mt-2 text-base font-medium text-slate-300">{subtitle}</p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            {Number(mentor.rating) > 0 ? (
              <>
                <span className="text-lg font-bold text-amber-300">{ratingDisplay}</span>
                <span className="inline-flex gap-0.5" aria-hidden>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className={`size-4 ${
                        i <= Math.round(Number(mentor.rating) || 0)
                          ? "fill-amber-400 text-amber-400"
                          : "fill-white/10 text-white/20"
                      }`}
                    />
                  ))}
                </span>
                <span className="text-sm text-slate-400">
                  ({reviewCount} đánh giá)
                </span>
              </>
            ) : (
              <span className="text-sm text-slate-400">Chưa có đánh giá</span>
            )}
          </div>

          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
            <InfoRow icon={Briefcase} label="Chức vụ" value={subtitle} />
            <InfoRow icon={Clock} label="Kinh nghiệm" value={expLabel} />
            <InfoRow
              icon={Building2}
              label="Công ty"
              value={mentor.company && mentor.company !== "—" ? mentor.company : null}
            />
            <InfoRow icon={MapPin} label="Nơi ở" value={location} />
          </ul>
        </div>
      </div>
    </div>
  );
}

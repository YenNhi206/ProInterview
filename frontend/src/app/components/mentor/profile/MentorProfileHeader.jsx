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
    <li className="flex items-start gap-2.5 text-sm text-slate-700">
      <Icon className="mt-0.5 size-4 shrink-0 text-violet-500" aria-hidden />
      <span>
        <span className="font-medium text-slate-500">{label}: </span>
        <span className="font-semibold text-slate-900">{value}</span>
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
    <div className="glass-card overflow-hidden p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
        <div className="flex shrink-0 flex-col items-center sm:items-start">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="size-28 rounded-full object-cover ring-4 ring-violet-100 shadow-md sm:size-32"
            />
          ) : (
            <div className="flex size-28 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-violet-400 text-2xl font-bold text-white shadow-md ring-4 ring-violet-100 sm:size-32">
              {initials}
            </div>
          )}
          {mentor.available ? (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
              Sẵn sàng nhận lịch
            </span>
          ) : (
            <span className="mt-3 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              Đang bận
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h1 className="flex flex-wrap items-center justify-center gap-2 text-2xl font-bold text-slate-900 sm:justify-start sm:text-3xl">
            {mentor.name}
            {Boolean(mentor.name && mentor.title && mentor.company && mentor.avatar) ? (
              <BadgeCheck
                className="size-6 shrink-0 fill-amber-400 text-white"
                aria-label="Mentor đầy đủ thông tin"
              />
            ) : null}
          </h1>

          {fieldTags.length > 0 ? (
            <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
              {fieldTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-block max-w-full rounded-lg border border-violet-200/60 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-800 shadow-sm"
                >
                  <span className="line-clamp-2 text-left">{tag}</span>
                </span>
              ))}
            </div>
          ) : null}

          <p className="mt-2 text-base text-slate-600">{subtitle}</p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <span className="text-lg font-bold text-slate-900">
              {Number(mentor.rating) > 0 ? ratingDisplay : "—"}
            </span>
            <span className="inline-flex gap-0.5" aria-hidden>
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className={`size-4 ${
                    i <= Math.round(Number(mentor.rating) || 0)
                      ? "fill-amber-400 text-amber-400"
                      : "fill-slate-200 text-slate-200"
                  }`}
                />
              ))}
            </span>
            <span className="text-sm text-slate-500">
              ({reviewCount} {reviewCount === 1 ? "đánh giá" : "đánh giá"})
            </span>
          </div>

          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
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

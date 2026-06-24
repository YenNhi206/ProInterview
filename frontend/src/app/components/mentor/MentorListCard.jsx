import { Star, Video, BadgeCheck } from "lucide-react";
import { MENTOR_BOOKING_COPY } from "../../constants/brandVoice";
import { formatVnd } from "../../utils/shared/formatVnd.js";

const TZ_LOCATION = {
  "Asia/Ho_Chi_Minh": "TP. Hồ Chí Minh",
  "Asia/Hanoi": "Hà Nội",
  "Asia/Bangkok": "Bangkok",
};

/** Mobile: giá gọn, tránh tràn sang cột giữa */
function formatVndMobile(amount) {
  const n = Number(amount) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}tr`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

function locationLabel(timezone) {
  const tz = String(timezone || "").trim();
  return TZ_LOCATION[tz] || "Việt Nam";
}

function experienceLabel(years) {
  const n = Number(years) || 0;
  if (n <= 0) return "Kinh nghiệm đang cập nhật";
  return `${n} năm kinh nghiệm`;
}

function displayTitle(mentor) {
  const title = (mentor.title || "").trim();
  const company = (mentor.company || "").trim();
  if (title && title.toLowerCase() !== "mentor") {
    return company && company !== "—" ? `${title} · ${company}` : title;
  }
  if (mentor.field) return mentor.field;
  return "Mentor ProInterview";
}

/** Giá buổi mentor 1:1 (chưa có dịch vụ Review CV). */
function resolveMentorSessionOffer(mentor) {
  const hourly = Number(mentor.price) || 0;
  const fromApi = Array.isArray(mentor.sessionTypes) ? mentor.sessionTypes : [];
  const mock = fromApi.find((s) => s?.type === "mock_interview");

  return {
    label: MENTOR_BOOKING_COPY.sessionTitle,
    price: mock?.price ?? hourly,
    minutes: mock?.durationMinutes ?? 60,
    icon: Video,
  };
}

function StarRating({ rating, reviewCount }) {
  const value = Number(rating) || 0;
  const filled = Math.round(value);
  return (
    <>
      <div className="flex min-w-0 items-center gap-1 overflow-hidden text-[10px] text-slate-500 md:hidden">
        <span className="shrink-0 font-bold text-slate-900">{value > 0 ? value.toFixed(1) : "—"}</span>
        <span className="truncate">({reviewCount} đánh giá)</span>
      </div>
      <div className="hidden min-w-0 items-center gap-2 overflow-hidden text-sm md:flex">
        <span className="shrink-0 font-bold text-slate-900">{value > 0 ? value.toFixed(1) : "—"}</span>
        <span className="inline-flex shrink-0 gap-0.5" aria-hidden>
          {[1, 2, 3, 4, 5].map((i) => (
            <Star
              key={i}
              className={`size-4 ${
                i <= filled ? "fill-lime-400 text-lime-400" : "fill-slate-200 text-slate-200"
              }`}
            />
          ))}
        </span>
        <span className="truncate text-slate-500">
          ({reviewCount} {reviewCount === 1 ? "đánh giá" : "đánh giá"})
        </span>
      </div>
    </>
  );
}

export function MentorListCard({ mentor, onOpenProfile, onBook }) {
  const bio = (mentor.bio || "").trim();
  const offer = resolveMentorSessionOffer(mentor);
  const OfferIcon = offer.icon;
  const avatarSrc =
    mentor.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(mentor.name || "M")}&background=ede9fe&color=6d28d9`;

  return (
    <article className="grid grid-cols-[2.75rem_minmax(0,1fr)_5rem] items-start gap-2 overflow-hidden border-b border-slate-200/90 py-3.5 last:border-b-0 sm:grid-cols-[3.25rem_minmax(0,1fr)_5.75rem] sm:gap-2.5 sm:py-4 md:grid-cols-[88px_minmax(0,1fr)_200px] md:gap-5 md:overflow-visible md:py-7 lg:grid-cols-[88px_minmax(0,1fr)_220px]">
      <button
        type="button"
        onClick={onOpenProfile}
        className="relative shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8037f4]"
      >
        <img
          src={avatarSrc}
          alt=""
          className="size-12 rounded-full border-2 border-violet-100 object-cover sm:size-14 md:size-[88px]"
        />
        {mentor.available ? (
          <span
            className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-white bg-emerald-500 md:bottom-0.5 md:right-0.5 md:size-3.5"
            title="Có lịch trống"
          />
        ) : null}
      </button>

      <div className="min-w-0 overflow-hidden pr-0.5 md:pr-0">
        <button
          type="button"
          onClick={onOpenProfile}
          className="group block w-full min-w-0 max-w-full rounded-sm text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8037f4]"
        >
          <h3 className="flex min-w-0 items-center gap-0.5 text-sm font-bold leading-tight text-slate-900 group-hover:text-[#8037f4] md:flex-wrap md:gap-1.5 md:text-lg">
            <span className="min-w-0 flex-1 truncate">{mentor.name}</span>
            {Boolean(mentor.name && mentor.title && mentor.company && mentor.avatar) ? (
              <BadgeCheck
                className="size-3.5 shrink-0 fill-amber-400 text-white md:size-5"
                aria-label="Mentor đầy đủ thông tin"
              />
            ) : null}
          </h3>
          <p className="mt-0.5 truncate text-[10px] font-medium text-slate-600 sm:text-[11px] md:text-sm">
            {displayTitle(mentor)}
          </p>
        </button>

        <div className="mt-1 md:mt-2">
          <StarRating rating={mentor.rating} reviewCount={mentor.reviews ?? 0} />
        </div>

        {mentor.tags?.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {mentor.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="max-w-full truncate rounded-full bg-violet-50 px-2.5 py-0.5 text-[10px] font-medium text-violet-700 sm:text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex w-[5rem] shrink-0 flex-col items-stretch gap-1 sm:w-[5.75rem] md:w-auto md:min-w-0 md:shrink md:gap-3 md:justify-self-end">
        <div className="text-[9px] leading-tight text-slate-700 sm:text-[10px] md:text-sm">
          <p className="flex items-start justify-end gap-0.5 font-semibold text-slate-800 md:justify-start md:gap-2">
            <OfferIcon className="mt-px size-2.5 shrink-0 text-violet-500 sm:size-3 md:mt-0.5 md:size-4" aria-hidden />
            <span className="line-clamp-2 text-right break-words md:line-clamp-none md:text-left">
              <span className="md:hidden">1:1</span>
              <span className="hidden md:inline">{offer.label}</span>
            </span>
          </p>
          <p className="mt-0.5 text-right text-slate-600 md:text-left">
            <span className="block font-bold leading-tight text-slate-900 md:hidden">
              {formatVndMobile(offer.price)}
              <span className="font-medium text-slate-500">/{offer.minutes}p</span>
            </span>
            <span className="hidden md:block">
              <span className="font-bold text-slate-900">{formatVnd(offer.price)}</span>
              <span className="text-slate-500"> / {offer.minutes} phút</span>
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={onBook}
          className="w-full rounded-md bg-[#8037f4] px-2 py-1.5 text-[11px] font-bold leading-none text-white shadow-sm transition-colors hover:bg-violet-700 sm:py-2 sm:text-xs md:mt-1 md:rounded-lg md:px-4 md:py-2.5 md:text-sm"
        >
          Đặt lịch
        </button>
      </div>
    </article>
  );
}

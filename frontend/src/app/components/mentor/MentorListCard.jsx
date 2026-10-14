import { motion } from "motion/react";
import { Video, BadgeCheck, Star } from "lucide-react";
import { MENTOR_BOOKING_COPY } from "../../constants/brandVoice";
import { formatVnd } from "../../utils/shared/formatVnd.js";
import { getPlans } from "../../utils/auth/auth.js";

function displayTitle(mentor) {
  const title = (mentor.title || "").trim();
  const company = (mentor.company || "").trim();
  if (title && title.toLowerCase() !== "mentor") {
    return company && company !== "—" ? `${title} tại ${company}` : title;
  }
  if (mentor.field) return mentor.field;
  return "Mentor ProInterview";
}

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
  if (value <= 0) {
    return <div className="text-xs text-slate-400">Chưa có đánh giá</div>;
  }
  return (
    <div className="flex items-center justify-center gap-1.5 text-sm">
      <span className="font-bold text-white">{value.toFixed(1)}</span>
      <span className="inline-flex gap-0.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`size-3.5 ${i <= filled ? "fill-amber-400 text-amber-400" : "fill-white/10 text-white/20"}`}
          />
        ))}
      </span>
      <span className="text-xs text-slate-400">({reviewCount} đánh giá)</span>
    </div>
  );
}

export function MentorListCard({ mentor, onOpenProfile, onBook }) {
  const offer = resolveMentorSessionOffer(mentor);
  /* Ưu đãi Pro/Elite (-5%/-10%) — ước tính hiển thị theo plan hiện tại, số tiền thật chốt ở /checkout. */
  const perkPlans = getPlans();
  const perkDiscountRate = perkPlans.elitePro ? 0.1 : perkPlans.starterPro ? 0.05 : 0;
  const perkPlanLabel = perkPlans.elitePro ? "Elite" : perkPlans.starterPro ? "Pro" : "";
  const perkDiscountAmount = offer.price > 0 && perkDiscountRate > 0 ? Math.round(offer.price * perkDiscountRate) : 0;
  const perkFinalPrice = offer.price - perkDiscountAmount;
  const avatarSrc =
    mentor.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(mentor.name || "M")}&background=2e1065&color=c084fc`;
  const isVerified = Boolean(mentor.name && mentor.title && mentor.company && mentor.avatar);

  return (
    <motion.div
      onClick={onOpenProfile}
      className="group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#18113c]/90 via-[#140d33]/95 to-[#100928]/98 p-5 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-all duration-300 cursor-pointer hover:border-violet-500/40 hover:shadow-[0_20px_45px_-10px_rgba(124,58,237,0.25)]"
      whileHover={{
        y: -6,
      }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 340, damping: 28 }}
    >
      {/* Top subtle highlight */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/30 to-transparent pointer-events-none" />

      <div className="flex w-full min-w-0 flex-col items-center text-center">
        {/* Avatar */}
        <div className="relative mb-4 h-24 w-24 shrink-0 sm:h-28 sm:w-28 md:h-32 md:w-32">
          <motion.img
            src={avatarSrc}
            alt={mentor.name}
            className="h-full w-full rounded-full border-3 border-violet-500/30 group-hover:border-[#93f72b]/60 object-cover shadow-lg transition-colors duration-300"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          />
          {/* Online indicator — pulsing ring */}
          {mentor.isOnline && (
            <span className="absolute bottom-1 right-1" title="Đang hoạt động">
              <span className="absolute inline-flex h-3.5 w-3.5 animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-[#18113c] bg-emerald-500" />
            </span>
          )}
        </div>

        {/* Name + verified badge */}
        <h3 className="flex w-full items-center justify-center gap-1.5 text-base font-bold tracking-tight text-white group-hover:text-[#93f72b] sm:text-lg transition-colors duration-200">
          <span className="max-w-[180px] truncate">{mentor.name}</span>
          {isVerified && (
            <motion.span
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.2 }}
              whileHover={{ scale: 1.25, rotate: 10 }}
            >
              <BadgeCheck
                className="size-4 shrink-0 fill-amber-400 text-[#140d33]"
                aria-label="Mentor đầy đủ thông tin"
              />
            </motion.span>
          )}
        </h3>

        <p className="mt-1 line-clamp-2 w-full min-h-[2.5rem] px-2 text-xs font-medium text-slate-300 leading-relaxed">
          {displayTitle(mentor)}
        </p>

        <div className="mt-3">
          <StarRating rating={mentor.rating} reviewCount={mentor.reviews ?? 0} />
        </div>

        {/* Skill tags */}
        {mentor.tags?.length ? (
          <div className="mt-3 flex w-full min-w-0 flex-wrap justify-center gap-1.5 px-2">
            {mentor.tags.slice(0, 3).map((tag, i) => (
              <motion.div
                key={tag}
                className="block w-fit max-w-full truncate rounded-full bg-violet-950/60 border border-violet-800/40 px-2.5 py-0.5 text-[10px] font-medium text-violet-300 cursor-default transition-colors hover:border-violet-500/50 hover:text-white"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05 * i, duration: 0.25 }}
              >
                {tag}
              </motion.div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Price + Buttons */}
      <div className="mt-5 w-full flex flex-col items-center">
        <div className="w-full border-t border-white/10 mb-4" />

        <div className="mb-4 text-center">
          <span className="text-xs text-slate-400 font-medium">Buổi mentor 1:1</span>
          <p className="mt-1 flex items-center justify-center gap-1.5">
            {perkDiscountAmount > 0 && (
              <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                -{Math.round(perkDiscountRate * 100)}% {perkPlanLabel}
              </span>
            )}
            <span className="text-base font-black text-white">
              {formatVnd(perkFinalPrice)}
              <span className="text-xs font-normal text-slate-400"> / {offer.minutes} phút</span>
            </span>
          </p>
          {perkDiscountAmount > 0 && (
            <span className="text-[11px] text-slate-500 line-through">{formatVnd(offer.price)}</span>
          )}
        </div>

        <div className="flex w-full flex-col gap-2">
          {/* Đặt lịch */}
          <motion.button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onBook();
            }}
            className="w-full rounded-2xl bg-[#93f72b] py-2.5 text-xs font-black text-[#0a0518] shadow-[0_4px_16px_rgba(147,247,43,0.25)] cursor-pointer"
            whileHover={{ scale: 1.03, backgroundColor: "#82e221", boxShadow: "0 6px 22px rgba(147,247,43,0.4)" }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
          >
            Đặt lịch
          </motion.button>

          {/* Xem chi tiết */}
          <motion.button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenProfile();
            }}
            className="w-full rounded-2xl border border-white/12 bg-white/5 py-2.5 text-xs font-bold text-white hover:bg-white/10 hover:border-violet-500/40 transition-colors cursor-pointer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
          >
            Xem chi tiết
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

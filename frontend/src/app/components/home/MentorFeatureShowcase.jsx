import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Users, Star, ChevronLeft, ChevronRight, ArrowRight, BadgeCheck, Sparkles } from "lucide-react";
import { SparkleGlyph } from "../decor/SparkleGlyph.jsx";
import { HOME_SECTION_INNER } from "../layout/customerShellLayout";
import { MENTOR_SHOWCASE_COPY } from "../../constants/brandVoice";
import { homeSectionClasses as ty } from "../../constants/homeTypography";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { fetchMentors } from "../../api/mentorApi";
import { HOME_DEMO_MENTORS } from "../../data/homeLandingDemo";


function formatPrice(price) {
  if (!price) return null;
  if (price >= 1000) return `${Math.round(price / 1000)}k/h`;
  return `${price} VND/h`;
}

function MentorAvatar({ src, name, size = "lg" }) {
  const [failed, setFailed] = useState(false);
  const initials = (name || "?")
    .split(" ")
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const dim = size === "xl" ? "h-20 w-20" : size === "lg" ? "h-16 w-16" : "h-10 w-10";
  const textSize = size === "xl" ? "text-xl" : size === "lg" ? "text-lg" : "text-sm";

  return (
    <span
      className={`${dim} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 ring-2 ring-white/60`}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={`${textSize} font-bold text-white`}>{initials}</span>
      )}
    </span>
  );
}

function MentorCard({ mentor }) {
  const mentorId = mentor.publicId || mentor._id || mentor.id;
  const href = mentorId ? `/mentors/${mentorId}` : "/mentors";
  const price = formatPrice(mentor.price ?? mentor.pricePerHour);
  const tags = (mentor.tags ?? mentor.specialties ?? []).slice(0, 2);
  const rating = mentor.rating ? mentor.rating.toFixed(1) : null;
  const reviewCount = mentor.reviews ?? mentor.reviewCount ?? 0;
  
  // Logic: cập nhật all thông tin -> có tick xanh
  const hasAllInfo = Boolean(mentor.name && mentor.title && mentor.company && mentor.avatar);

  return (
    <Link
      to={href}
      className="group relative flex h-[380px] w-[280px] shrink-0 flex-col justify-between gap-3 rounded-2xl border-2 border-violet-400 bg-violet-600 p-6 transition-all duration-200 hover:-translate-y-2 hover:border-violet-300 hover:bg-violet-500 sm:w-[300px] lg:w-[320px]"
    >
      {/* Tag Mentor Đề xuất */}
      <div className="absolute -right-2 -top-2 z-10 flex items-center gap-1 rounded-full bg-lime-400 px-3 py-1.5 text-[11px] font-bold tracking-wide text-violet-950 shadow-lg">
        <SparkleGlyph className="h-4 w-4 shrink-0" tone="brand" />
        ĐỀ XUẤT
      </div>

      {/* Avatar + tên */}
      <div className="flex flex-col items-center gap-2 text-center">
        <MentorAvatar src={mentor.avatar} name={mentor.name} size="xl" />
        <div>
          <p className="flex items-center justify-center gap-1 text-[13px] font-bold leading-snug text-white line-clamp-1">
            {mentor.name}
            {hasAllInfo && (
              <BadgeCheck className="h-4 w-4 shrink-0 fill-amber-400 text-white" />
            )}
          </p>
          {mentor.title && (
            <p className="text-[11px] text-violet-200 line-clamp-1">{mentor.title}</p>
          )}
          {mentor.company && (
            <p className="text-[11px] font-bold text-lime-300 line-clamp-1">{mentor.company}</p>
          )}
        </div>
      </div>

      {/* Rating + price */}
      <div className="flex items-center justify-between border-t border-white/20 pt-2">
        <span className="flex items-center gap-1">
          <Star className={`h-3.5 w-3.5 ${rating ? "fill-lime-400 text-lime-400" : "fill-violet-400 text-violet-400"}`} />
          <span className="text-[12px] font-bold text-white">{rating ?? "—"}</span>
          <span className="text-[11px] text-violet-300">({reviewCount})</span>
        </span>
        {price && (
          <span className="rounded-full bg-lime-400 px-2 py-0.5 text-[11px] font-bold text-violet-950">
            {price}
          </span>
        )}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-hidden">
          {tags.map((tag) => (
            <span
              key={tag}
              className="min-w-0 max-w-full truncate rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Hover CTA */}
      <span className="flex items-center justify-center gap-1 rounded-lg bg-lime-400 py-1.5 text-[11px] font-bold text-violet-950 transition-all group-hover:bg-lime-300">
        Đặt lịch <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  );
}

export function MentorFeatureShowcase() {
  const [mentors, setMentors] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetchMentors().then(({ success, mentors: list }) => {
      if (!success || !list?.length) return;
      const sorted = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      setMentors(sorted.slice(0, 10));
    });
  }, []);

  const displayMentors = mentors.length ? mentors : HOME_DEMO_MENTORS;

  function scroll(dir) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 280, behavior: "smooth" });
  }

  return (
    <section id="find-mentor" className={ty.section}>
      <div className={HOME_SECTION_INNER}>
        <HomeSectionHeader
          icon={Users}
          badge={MENTOR_SHOWCASE_COPY.badge}
          lines={[
            { text: MENTOR_SHOWCASE_COPY.titleLine1, tone: "dark" },
            { text: MENTOR_SHOWCASE_COPY.titleLine2, tone: "lime" },
          ]}
          className="mb-8 sm:mb-10"
        />

        <div className="relative">
          {/* Prev/Next arrows */}
          <button
            onClick={() => scroll(-1)}
            aria-label="Cuộn trái"
            className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-violet-200 bg-white p-2 shadow-md transition hover:bg-violet-50 lg:flex"
          >
            <ChevronLeft className="h-5 w-5 text-violet-600" />
          </button>
          <button
            onClick={() => scroll(1)}
            aria-label="Cuộn phải"
            className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-violet-200 bg-white p-2 shadow-md transition hover:bg-violet-50 lg:flex"
          >
            <ChevronRight className="h-5 w-5 text-violet-600" />
          </button>

          {/* Scrollable list */}
          <div
            ref={scrollRef}
            className="no-scrollbar flex items-start gap-4 overflow-x-auto scroll-smooth pt-6 pb-8 pl-4 pr-4 -mx-4 [scroll-snap-type:x_mandatory]"
          >
            {displayMentors.map((m) => (
              <div key={m.publicId ?? m.id} className="[scroll-snap-align:start]">
                <MentorCard mentor={m} />
              </div>
            ))}
          </div>
        </div>

      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </section>
  );
}

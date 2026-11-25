import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Users, Star, BadgeCheck, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { SparkleGlyph } from "../decor/SparkleGlyph.jsx";
import { HOME_SECTION_INNER } from "../layout/customerShellLayout";
import { MENTOR_SHOWCASE_COPY } from "../../constants/brandVoice";
import { homeSectionClasses as ty } from "../../constants/homeTypography";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { fetchMentors } from "../../api/mentorApi";
import { HOME_DEMO_MENTORS } from "../../data/homeLandingDemo";

function formatPrice(price) {
  if (!price && price !== 0) return null;
  if (typeof price === "number") {
    return `${price.toLocaleString("vi-VN")} đ/h`;
  }
  return `${price}`;
}

function MentorAvatar({ src, name }) {
  const [failed, setFailed] = useState(false);
  const initials = (name || "?")
    .split(" ")
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/20 [html[data-workspace-theme=light]_&]:border-white shadow-md flex items-center justify-center bg-gradient-to-br from-[#8037f4] to-[#4f46e5] text-white font-bold text-lg flex-shrink-0">
      {src && !failed ? (
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

export function MentorFeatureShowcase() {
  const [mentors, setMentors] = useState([]);
  const scrollContainerRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    fetchMentors().then(({ success, mentors: list }) => {
      if (!success || !list?.length) return;
      const sorted = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      setMentors(sorted.slice(0, 10));
    });
  }, []);

  const displayMentors = mentors.length ? mentors : HOME_DEMO_MENTORS;

  const updateScrollState = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
  };

  useEffect(() => {
    updateScrollState();
    window.addEventListener("resize", updateScrollState);
    return () => window.removeEventListener("resize", updateScrollState);
  }, [displayMentors]);

  const handleScroll = (direction) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollAmount = Math.max(300, el.clientWidth * 0.75);
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <section id="find-mentor" className={ty.section}>
      <div className={HOME_SECTION_INNER}>
        {/* Header with Navigation Controls */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <HomeSectionHeader
            icon={Users}
            badge={MENTOR_SHOWCASE_COPY.badge}
            lines={[
              { text: MENTOR_SHOWCASE_COPY.titleLine1, tone: "dark" },
              { text: MENTOR_SHOWCASE_COPY.titleLine2, tone: "accent" },
            ]}
            className="mb-0"
          />

          <div className="flex items-center gap-3 self-start md:self-end">
            <Link
              to="/mentors"
              className="text-sm font-semibold text-[#c4b5fd] [html[data-workspace-theme=light]_&]:text-[#8037f4] hover:underline flex items-center gap-1 mr-2"
            >
              Xem tất cả mentor
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              type="button"
              onClick={() => handleScroll("left")}
              disabled={!canScrollLeft}
              aria-label="Mentor trước"
              className="liquid-glass w-10 h-10 rounded-full flex items-center justify-center text-white/90 [html[data-workspace-theme=light]_&]:text-slate-700 hover:bg-white/15 [html[data-workspace-theme=light]_&]:hover:bg-slate-100 transition-all disabled:opacity-30 disabled:pointer-events-none shadow-sm"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => handleScroll("right")}
              disabled={!canScrollRight}
              aria-label="Mentor tiếp theo"
              className="liquid-glass w-10 h-10 rounded-full flex items-center justify-center text-white/90 [html[data-workspace-theme=light]_&]:text-slate-700 hover:bg-white/15 [html[data-workspace-theme=light]_&]:hover:bg-slate-100 transition-all disabled:opacity-30 disabled:pointer-events-none shadow-sm"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Horizontal Mentor Carousel Track */}
        <div
          ref={scrollContainerRef}
          onScroll={updateScrollState}
          className="flex gap-6 overflow-x-auto snap-x snap-mandatory scrollbar-none py-4 -my-4 px-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {displayMentors.map((mentor, index) => {
            const mentorId = mentor.publicId || mentor._id || mentor.id;
            const price = formatPrice(mentor.price ?? mentor.pricePerHour);
            const tags = (mentor.tags ?? mentor.specialties ?? []).slice(0, 3);
            const rating = mentor.rating ? mentor.rating.toFixed(1) : null;
            const reviewCount = mentor.reviews ?? mentor.reviewCount ?? 0;
            const hasAllInfo = Boolean(mentor.name && mentor.title && mentor.company && mentor.avatar);

            return (
              <div
                key={mentorId ?? index}
                className="w-[280px] sm:w-[320px] md:w-[350px] flex-shrink-0 snap-start group"
              >
                <div className="liquid-glass-strong h-full flex flex-col justify-between rounded-[20px] p-6 border border-white/10 [html[data-workspace-theme=light]_&]:border-[#e4daf4] shadow-[0_8px_24px_-4px_rgba(0,0,0,0.25)] hover:shadow-[0_16px_36px_-6px_rgba(0,0,0,0.5)] hover:border-[#93f72b]/40 [html[data-workspace-theme=light]_&]:hover:border-[#8037f4]/40 hover:-translate-y-1 transition-all duration-300">
                  <div>
                    {/* Top Row: Avatar & Badges */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="relative">
                        <MentorAvatar src={mentor.avatar} name={mentor.name} />
                        {mentor.available !== false && (
                          <span
                            className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#93f72b] border-2 border-slate-900 [html[data-workspace-theme=light]_&]:border-white"
                            title="Sẵn sàng nhận lịch"
                          />
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1.5">
                        <span className="liquid-glass inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full text-[#93f72b] [html[data-workspace-theme=light]_&]:text-[#8037f4] border border-[#93f72b]/30 [html[data-workspace-theme=light]_&]:border-[#8037f4]/30">
                          <SparkleGlyph className="w-2.5 h-2.5" tone="lime" />
                          Đề xuất
                        </span>
                        {rating && (
                          <div className="flex items-center gap-1 text-xs font-bold text-amber-400">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            <span className="text-white [html[data-workspace-theme=light]_&]:text-slate-900">{rating}</span>
                            <span className="text-white/50 [html[data-workspace-theme=light]_&]:text-slate-500 font-normal">
                              ({reviewCount})
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mentor Identity */}
                    <div className="mt-4">
                      <h3 className="text-base sm:text-lg font-bold text-white [html[data-workspace-theme=light]_&]:text-slate-900 line-clamp-1 group-hover:text-[#93f72b] [html[data-workspace-theme=light]_&]:group-hover:text-[#8037f4] transition-colors flex items-center gap-1.5">
                        {mentor.name}
                        {hasAllInfo && (
                          <BadgeCheck className="w-4 h-4 text-[#93f72b] [html[data-workspace-theme=light]_&]:text-[#8037f4] flex-shrink-0" />
                        )}
                      </h3>
                      {mentor.title && (
                        <p className="text-sm font-medium text-white/70 [html[data-workspace-theme=light]_&]:text-slate-600 line-clamp-1 mt-0.5">
                          {mentor.title}
                        </p>
                      )}
                      {mentor.company && (
                        <p className="text-xs font-bold text-[#93f72b] [html[data-workspace-theme=light]_&]:text-[#8037f4] tracking-wider uppercase mt-1">
                          {mentor.company}
                        </p>
                      )}
                    </div>

                    {/* Tags / Skills */}
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-4">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="liquid-glass text-[11px] font-medium px-2.5 py-0.5 rounded-full text-white/80 [html[data-workspace-theme=light]_&]:text-slate-700 border border-white/10 [html[data-workspace-theme=light]_&]:border-slate-200"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer: Price & CTA */}
                  <div className="mt-6 pt-4 border-t border-white/10 [html[data-workspace-theme=light]_&]:border-slate-200 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] text-white/50 [html[data-workspace-theme=light]_&]:text-slate-500 block font-medium">
                        Chi phí mentor
                      </span>
                      <span className="text-base font-bold text-white [html[data-workspace-theme=light]_&]:text-slate-900 tabular-nums">
                        {price || "Miễn phí"}
                      </span>
                    </div>

                    <Link
                      to={mentorId ? `/mentors/${mentorId}` : "/mentors"}
                      className="inline-flex items-center justify-center gap-1 rounded-full px-4 py-2 text-xs font-bold bg-[#93f72b] text-[#131f00] hover:bg-[#80e521] transition-all shadow-sm group-hover:shadow hover:scale-105"
                    >
                      Đặt lịch
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

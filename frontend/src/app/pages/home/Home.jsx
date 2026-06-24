import React, { useEffect, useState } from "react";
import "../../../styles/home.css";
import { useNavigate } from "react-router";
import {
  Star,
  Award as Medal,
  ArrowRight,
} from "lucide-react";
import { CvAnalysisFeatureShowcase } from "../../components/home/CvAnalysisFeatureShowcase";
import { MentorFeatureShowcase } from "../../components/home/MentorFeatureShowcase";

const HOME_MENTOR_MASCOTS = {
  cv: "/mascot-mentor-avatar-cv.png?v=2",
  headset: "/mascot-mentor-avatar-headset.png?v=2",
  pro: "/mascot-mentor-avatar-pro.png?v=2",
  celebrate: "/mascot-home-avatar-celebrate.png?v=1",
  fallback: "/mascot-courses-ready.png?v=8",
};
import { CoursesFeatureShowcase } from "../../components/home/CoursesFeatureShowcase";
import { InterviewFeatureShowcase } from "../../components/home/InterviewFeatureShowcase";
import { HomeSectionHeader } from "../../components/home/HomeSectionHeader";
import { SparkleGlyph } from "../../components/decor/SparkleGlyph.jsx";
import { SectionReveal } from "../../components/home/landing/LandingReveal";
import { HOME_SECTION_INNER } from "../../components/layout/customerShellLayout";
import { HOME_COPY, HOME_SECTION_COPY } from "../../constants/brandVoice";
import {
  HOME_HERO_TITLE_CLAMP,
  HOME_SECTION_TITLE_SIZE,
  homeSectionClasses as homeTy,
} from "../../constants/homeTypography";
import { achievementsApi } from "../../api/achievementsApi.js";

const TESTIMONIAL_MASCOTS = [
  HOME_MENTOR_MASCOTS.pro,
  HOME_MENTOR_MASCOTS.cv,
  HOME_MENTOR_MASCOTS.headset,
];

const TESTIMONIALS = HOME_SECTION_COPY.testimonials.items.map((t, i) => ({
  ...t,
  mascot: TESTIMONIAL_MASCOTS[i],
  stars: 5,
}));

export function Home() {
  const navigate = useNavigate();
  const [achievements, setAchievements] = useState([]);

  useEffect(() => {
    // Fetch achievements
    const fetchAchievements = async () => {
      try {
        const res = await achievementsApi.getAll();
        if (res.data?.success) {
          setAchievements(res.data.achievements || []);
        }
      } catch (err) {
        console.error("Failed to load achievements", err);
      }
    };
    fetchAchievements();
  }, []);

  const renderSectionSticks = (sticks, sparkleTone = "brand") => (
    <div className="pointer-events-none absolute inset-0 z-[1] hidden md:block" aria-hidden>
      {sticks.map((s, idx) => (
        <SparkleGlyph
          key={`section-stick-${idx}`}
          tone={sparkleTone}
          className="absolute"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            opacity: 1,
            filter: "drop-shadow(0 1px 2px rgba(15,23,42,0.12)) drop-shadow(0 0 8px rgba(95,0,240,0.35))",
            transform: `rotate(${typeof s.tilt === "number" ? s.tilt : idx % 4 === 0 ? 0 : idx % 4 === 1 ? -18 : idx % 4 === 2 ? 24 : -30
              }deg)`,
          }}
        />
      ))}
    </div>
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const scrollTarget = params.get("scrollTo");
    if (scrollTarget) {
      setTimeout(() => {
        const el = document.getElementById(scrollTarget);
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }, 500);
    }

  }, []);

  return (
    <div
      className="min-h-screen selection:bg-[rgba(147,247,43,0.42)] selection:text-slate-900 font-sans relative bg-transparent text-slate-900 -mt-[12rem] pt-[12rem]"
    >


      {/* ═══ HERO (chỉ copy + CTA, clip bling ~1 màn; video section riêng bên dưới) ═══ */}
      <section
        id="home-hero-section"
        className="home-hero-section relative z-10 flex min-h-[100svh] flex-col justify-center overflow-x-hidden pb-8 pt-24 max-lg:-mb-6 sm:pt-28 lg:mb-0 lg:pb-10 lg:pt-32"
      >
        <div
          id="home-hero-sparkle-zone"
          className={`home-hero-sparkle-zone relative z-10 mx-auto flex w-full max-lg:-translate-y-16 flex-col items-center py-6 text-center sm:py-10 lg:-translate-y-6 ${HOME_SECTION_INNER}`}
        >
          <div className="hero-intro-badge mb-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#630ed4] bg-white/80 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.03em] text-[#630ed4] shadow-[0_2px_12px_rgba(99,14,212,0.1)] backdrop-blur-sm sm:text-xs">
              <SparkleGlyph className="h-3.5 w-3.5 shrink-0" tone="violet" />
              {HOME_COPY.badge}
            </div>
          </div>

          <div className="hero-intro-copy max-w-5xl">
            <h1
              className="home-hero-title hero-title-stack cute-heading mx-auto mb-5 text-slate-900"
              style={{ fontSize: HOME_HERO_TITLE_CLAMP }}
            >
              {/* Line 1: "Phỏng vấn" + chip */}
              <span className="hero-title-line inline-flex flex-wrap items-center gap-x-[0.28em] gap-y-1 text-slate-900">
                {HOME_COPY.titleLine1}{" "}
                <span
                  className="hero-title-highlight"
                  style={{
                    display: "inline-block",
                    background: "linear-gradient(135deg, #630ed4 0%, #8037f4 100%)",
                    color: "#ffffff",
                    borderRadius: "6px",
                    padding: "0.02em 0.4em 0.1em",
                    fontWeight: 800,
                  }}
                >
                  {HOME_COPY.titleHighlight}
                </span>
              </span>
              <span className="hero-title-line text-slate-900">qua mô phỏng hội thoại</span>
              <span className="hero-title-line text-slate-900">thông minh</span>
            </h1>

            <p className="mx-auto mb-8 max-w-xl text-base leading-relaxed text-slate-500 sm:text-lg">
              Câu hỏi cá nhân hoá theo CV & JD, phản hồi chi tiết sau mỗi buổi.
            </p>

            <div className="hero-intro-cta mb-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
              <button
                type="button"
                onClick={() => navigate("/interview")}
                className="group inline-flex items-center gap-3 rounded-full py-3 pl-6 pr-3 text-sm font-black transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-[1.03] hover:brightness-105 active:scale-[0.98] sm:text-base"
                style={{
                  background: "#a3ff3d",
                  color: "#0f172a",
                  boxShadow: "0 8px 24px -6px rgba(147,247,43,0.45)",
                }}
              >
                {HOME_COPY.cta}
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/10 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-px">
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </button>
            </div>

          </div>
        </div>
      </section>




      {/* ═══ CV ANALYSIS (#features) ═══ */}
      <div className="landing-section-flow">
        <SectionReveal variant="cv">
          <CvAnalysisFeatureShowcase />
        </SectionReveal>
      </div>

      {/* ═══ AI INTERVIEW SHOWCASE ═══ */}
      <div className="landing-section-flow">
        <SectionReveal variant="interview">
          <InterviewFeatureShowcase />
        </SectionReveal>
      </div>

      <div className="landing-section-flow" style={{ perspective: "1400px" }}>
        <SectionReveal variant="mentor">
          <MentorFeatureShowcase />
        </SectionReveal>
      </div>

      <div className="landing-section-flow mt-12 sm:mt-16 lg:mt-24">
        <SectionReveal variant="courses" delay={0.05}>
          <CoursesFeatureShowcase />
        </SectionReveal>
      </div>



      {/* ═══ TESTIMONIALS ═══════════════════════════════════ */}
      <section id="testimonials" className={`${homeTy.section} mt-12 sm:mt-16 lg:mt-24 landing-section-flow`}>
        {renderSectionSticks([
          { x: 78, y: 12, size: 34, opacity: 0.46 },
          { x: 92, y: 52, size: 36, opacity: 0.5 },
          { x: 10, y: 86, size: 30, opacity: 0.38 },
        ])}
        <div className={`${homeTy.sectionShell} ${HOME_SECTION_INNER}`}>
          <div className={`${homeTy.sectionGrid} lg:items-center`}>
            <div className={homeTy.sectionCopy}>
              <span className={homeTy.badge}>
                <SparkleGlyph className="size-3.5" />
                {HOME_SECTION_COPY.testimonials.badge}
              </span>
              <h2
                className={homeTy.sectionTitle}
                style={{ fontSize: HOME_SECTION_TITLE_SIZE }}
              >
                <span className={homeTy.sectionTitleLineDark}>
                  {HOME_SECTION_COPY.testimonials.titleLine}
                </span>
                <span
                  className="mt-2 block h-[1.95rem] w-fit shrink-0 sm:mt-2.5 sm:h-[2.2rem] md:h-[2.45rem] lg:h-[3.2rem]"
                  aria-hidden
                >
                  <img
                    src="/Logo.png"
                    alt="ProInterview"
                    className="block h-full w-auto shrink-0 object-contain object-left contrast-[1.12] brightness-[0.94]"
                    width={537}
                    height={91}
                    decoding="sync"
                  />
                </span>
              </h2>
              <p className={homeTy.sectionBody}>
                {HOME_SECTION_COPY.testimonials.body}
              </p>

              <div className="mt-1 flex items-center gap-3">
                <div className="flex -space-x-3">
                  {TESTIMONIALS.map((t) => (
                    <div
                      key={`avatar-${t.name}`}
                      className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-violet-50 shadow-sm"
                    >
                      <img
                        src={t.mascot}
                        alt=""
                        className="h-[85%] w-[85%] object-contain object-bottom"
                        onError={(e) => {
                          if (e.currentTarget.src !== HOME_MENTOR_MASCOTS.fallback) {
                            e.currentTarget.src = HOME_MENTOR_MASCOTS.fallback;
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
                <p className={homeTy.sectionBody}>
                  <span className="font-bold text-[#8037f4]">500+</span>{" "}
                  {HOME_SECTION_COPY.testimonials.socialProof}
                </p>
              </div>
            </div>

            <div className="relative z-10 flex min-h-0 min-w-0 w-full flex-col overflow-hidden py-2 lg:min-h-[20rem]">
              <div
                className="relative w-full overflow-hidden"
                style={{
                  maskImage:
                    "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
                  WebkitMaskImage:
                    "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
                }}
              >
                <div className="space-y-6">
                  <div className="testimonial-marquee-row">
                    <div className="testimonial-marquee-track">
                      {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
                        <div
                          key={`marq1-${i}-${t.name}`}
                          className="shrink-0 w-[min(100%,17.5rem)] sm:w-[17.5rem] lg:w-[18.5rem] bg-violet-600 border border-violet-400 rounded-2xl p-5 shadow-sm sm:p-6 max-lg:rounded-lg max-lg:p-4"
                        >
                          <div className="flex items-center gap-2.5 mb-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-violet-800 bg-violet-900/50">
                              <img
                                src={t.mascot}
                                alt=""
                                className="h-[88%] w-[88%] object-contain object-bottom"
                                onError={(e) => {
                                  if (e.currentTarget.src !== HOME_MENTOR_MASCOTS.fallback) {
                                    e.currentTarget.src = HOME_MENTOR_MASCOTS.fallback;
                                  }
                                }}
                              />
                            </div>
                            <p className="text-[10px] uppercase tracking-widest text-lime-400 font-black leading-tight sm:text-xs lg:text-[0.8rem]">{t.tag}</p>
                          </div>
                          <p className="text-xs text-white/90 leading-snug line-clamp-2 sm:text-sm lg:text-base">"<em className="not-italic">{t.text}</em>"</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="testimonial-marquee-row">
                    <div className="testimonial-marquee-track testimonial-marquee-track--alt">
                      {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
                        <div
                          key={`marq2-${i}-${t.name}`}
                          className="shrink-0 w-[min(100%,17.5rem)] sm:w-[17.5rem] lg:w-[18.5rem] bg-violet-600 border border-violet-400 rounded-2xl p-5 shadow-sm sm:p-6 max-lg:rounded-lg max-lg:p-4"
                        >
                          <div className="flex gap-1 mb-3">
                            {[...Array(t.stars)].map((_, j) => (
                              <Star key={`${t.name}-s-${i}-${j}`} className="size-4 text-lime-400 fill-lime-400" />
                            ))}
                          </div>
                          <p className="mb-2.5 text-xs leading-snug text-white/90 line-clamp-2 sm:text-sm lg:text-base">"<em className="not-italic">{t.text}</em>"</p>
                          <p className="text-[10px] font-bold text-white sm:text-xs lg:text-sm">{t.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="pointer-events-none absolute inset-y-0 left-0 z-[2] w-14 bg-gradient-to-r from-[#ebe4f6] via-[#ebe4f6]/80 to-transparent sm:w-16 lg:w-20" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-[2] w-14 bg-gradient-to-l from-[#ebe4f6] via-[#ebe4f6]/80 to-transparent sm:w-16 lg:w-20" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ ACHIEVEMENTS / NEWS SECTION ═══ */}
      <section className={`${homeTy.section} mt-20 sm:mt-28 lg:mt-36 ${HOME_SECTION_INNER}`}>

        <HomeSectionHeader
          icon={Medal}
          badge="Tin tức & Hoạt động"
          lines={[
            { text: "Tin tức và hoạt động", tone: "dark" },
            { text: "từ ProInterview", tone: "accent" },
          ]}
          body="Cập nhật những tin tức, sự kiện và cột mốc phát triển mới nhất của chúng tôi."
          align="center"
          className="mb-12"
        />

        {achievements.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6 mx-auto max-w-[24rem] md:max-w-none">
            {achievements.slice(0, 3).map((item) => (
              <article
                key={item._id}
                onClick={() => navigate(`/achievements/${item._id}`)}
                className="group cursor-pointer overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_16px_40px_-8px_rgba(99,14,212,0.15)]"
              >
                {/* Image */}
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-violet-100 to-violet-50" />
                  )}
                </div>

                {/* Content */}
                <div className="flex flex-col gap-3 p-5">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-violet-700">
                      {item.category || "Hoạt động"}
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                      {new Date(item.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  <h3 className="text-base font-bold leading-snug tracking-[-0.02em] text-slate-900 line-clamp-2 transition-colors duration-300 group-hover:text-[#630ed4] sm:text-[1.05rem]">
                    {item.title}
                  </h3>

                  {/* Footer */}
                  <div className="mt-1 flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
                      <img
                        src="/logo-mark-circle.png"
                        alt="ProInterview"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[12px] font-bold leading-none text-slate-800">ProInterview Team</span>
                      <span className="mt-0.5 text-[11px] text-slate-400">prointerview.vn</span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* CTA button with button-in-button pattern */}
        <div className="flex justify-center mt-10">
          <button
            onClick={() => navigate("/achievements")}
            className="group inline-flex items-center gap-3 rounded-full py-3 pl-6 pr-3 text-sm sm:text-base font-black transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-[1.03] active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #a3ff3d 0%, #8ae819 100%)",
              color: "#0f172a",
              boxShadow: "0 10px 30px -8px rgba(147,247,43,0.5), 0 4px 12px -4px rgba(147,247,43,0.3)",
            }}
          >
            Xem tất cả
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/10 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-px">
              <ArrowRight className="h-4 w-4" />
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
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
import { publicApi } from "../../api/publicApi.js";

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

const formatStatNumber = (num) => {
  if (!num || num < 5) return num || "0";
  return Math.floor(num / 5) * 5 + "+";
};

export function Home() {
  const navigate = useNavigate();
  const [achievements, setAchievements] = useState([]);
  
  const [homeData, setHomeData] = useState({ stats: null, reviews: [] });
  const [isLoadingHomeData, setIsLoadingHomeData] = useState(true);

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

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        const res = await publicApi.getHomeData();
        if (res.data?.success) {
          setHomeData(res.data.data);
        }
      } catch (err) {
        console.error("Failed to load home data", err);
      } finally {
        setIsLoadingHomeData(false);
      }
    };
    fetchHomeData();
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 w-full max-w-[78.5rem] mx-auto">
            {/* Left Column: Recent Reviews */}
            <div className="flex flex-col rounded-[2rem] border border-slate-200 bg-white p-6 md:p-8 shadow-sm overflow-hidden h-[36rem] lg:h-[40rem]">
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="font-black text-slate-900 tracking-tight flex items-center flex-wrap gap-x-2 gap-y-1" style={{ fontSize: HOME_SECTION_TITLE_SIZE }}>
                  Phản hồi từ người dùng
                  <img src="/Logo.png" alt="ProInterview" className="h-[1.1em] w-auto object-contain inline-block -translate-y-[2px]" />
                </h3>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-4" style={{ scrollbarWidth: "thin" }}>
                {(homeData.reviews?.length > 0 ? homeData.reviews : [...TESTIMONIALS, ...TESTIMONIALS]).map((t, i) => (
                  <div key={t.id || i} className="flex flex-col p-4 rounded-2xl border border-slate-100 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex gap-3 items-center">
                        <div className="h-11 w-11 rounded-full overflow-hidden border border-slate-200 bg-violet-50 shrink-0 flex items-center justify-center">
                          <img src={t.avatar || t.mascot || HOME_MENTOR_MASCOTS.fallback} alt="" className="h-[90%] w-[90%] object-contain object-bottom" onError={(e) => { e.currentTarget.src = HOME_MENTOR_MASCOTS.fallback; }} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 leading-none mb-1">{t.name}</h4>
                          <p className="text-xs text-slate-500">{t.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="flex gap-0.5">
                          {[...Array(t.stars)].map((_, j) => (
                            <Star key={j} className="size-[14px] text-[#84cc16] fill-[#84cc16]" />
                          ))}
                        </div>
                        <span className="text-xs font-bold ml-1 text-slate-700">{t.stars}/5</span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {t.text}
                    </p>
                    

                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Key Statistics */}
            <div className="flex flex-col rounded-[2rem] border-2 border-[#8037f4] bg-[#8037f4] p-6 md:p-8 shadow-sm relative overflow-hidden h-[36rem] lg:h-[40rem]">
              {/* Background accent */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>

              <div className="flex items-center gap-4 mb-5 relative z-10">
                <div className="text-[#a3e635]">
                  <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4 19h16v2H4zM6 9h3v8H6zM11 4h3v13h-3zM16 12h3v5h-3z" />
                  </svg>
                </div>
                <h3 className="font-black text-[#a3e635] tracking-tight" style={{ fontSize: HOME_SECTION_TITLE_SIZE }}>Thống kê nền tảng</h3>
              </div>
              <p className="text-base text-white/80 mb-10 leading-relaxed relative z-10 font-medium">
                Dữ liệu thực tế về số lượt luyện phỏng vấn, số lượng người dùng và đánh giá chất lượng.
              </p>

              <div className="grid grid-cols-2 gap-4 md:gap-6 flex-1 relative z-10">
                {/* Stat 1 */}
                <div className="rounded-[1.25rem] border border-white/20 bg-white/10 backdrop-blur-sm p-5 md:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-center items-start gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-[#eef2ff] text-[#4f46e5] flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <div>
                    <div className="text-2xl md:text-3xl font-black text-white mb-1">
                      {formatStatNumber(homeData.stats?.totalSessions)}
                    </div>
                    <div className="text-sm text-white/80 font-bold whitespace-nowrap tracking-tight">Lượt luyện tập với AI</div>
                  </div>
                </div>
                
                {/* Stat 2 */}
                <div className="rounded-[1.25rem] border border-white/20 bg-white/10 backdrop-blur-sm p-5 md:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-center items-start gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-[#fdf2f8] text-[#ec4899] flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  </div>
                  <div>
                    <div className="text-2xl md:text-3xl font-black text-white mb-1">
                      {formatStatNumber(homeData.stats?.totalMentors)}
                    </div>
                    <div className="text-sm text-white/80 font-bold">Mentor</div>
                  </div>
                </div>

                {/* Stat 3 */}
                <div className="rounded-[1.25rem] border border-white/20 bg-white/10 backdrop-blur-sm p-5 md:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-center items-start gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-[#fff7ed] text-[#f97316] flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <div className="text-2xl md:text-3xl font-black text-white mb-1">
                      {homeData.stats?.averageRating ? homeData.stats.averageRating + "/5" : "0/5"}
                    </div>
                    <div className="text-sm text-white/80 font-bold">Mức hài lòng</div>
                  </div>
                </div>

                {/* Stat 4 */}
                <div className="rounded-[1.25rem] border border-white/20 bg-white/10 backdrop-blur-sm p-5 md:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-center items-start gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-[#fff1f2] text-[#e11d48] flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-2xl md:text-3xl font-black text-white mb-1">
                      {formatStatNumber(homeData.stats?.totalUsers)}
                    </div>
                    <div className="text-sm text-white/80 font-bold">Người dùng</div>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 text-right w-full relative z-10">
                 <span className="text-sm font-semibold text-white/60 italic">Dữ liệu cập nhật liên tục</span>
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
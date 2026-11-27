import React, { useEffect, useState } from "react";
import "../../../styles/home.css";
import { useNavigate } from "react-router";
import {
  Star,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  FileSearch,
  Mic,
  CalendarCheck,
  BookOpen,
  Video,
  MessageCircle,
} from "lucide-react";
import mentorFeaturePreview from "../../../assets/images/feature-mentor-v1.webp?url";
import coursesFeaturePreview from "../../../assets/images/feature-courses-v1.webp?url";
import interviewFeaturePreview from "../../../assets/images/feature-interview-ai.jpg?url";
import cvFeaturePreview from "../../../assets/images/feature-cv-preview-v1.webp?url";
import { HomeHero } from "../../components/home/HomeHero";
import { FeatureShowcaseStack } from "../../components/home/FeatureShowcaseStack";
import { CvAnalysisFeatureShowcase } from "../../components/home/CvAnalysisFeatureShowcase";
import { InterviewFeatureShowcase } from "../../components/home/InterviewFeatureShowcase";
import { MentorFeatureShowcase } from "../../components/home/MentorFeatureShowcase";
import { CoursesFeatureShowcase } from "../../components/home/CoursesFeatureShowcase";
import { SectionReveal } from "../../components/home/landing/LandingReveal";
import { EventPromoModal } from "../../components/home/EventPromoModal.jsx";

const HOME_MENTOR_MASCOTS = {
  cv: "/mascot-mentor-avatar-cv.png?v=2",
  headset: "/mascot-mentor-avatar-headset.png?v=2",
  pro: "/mascot-mentor-avatar-pro.png?v=2",
  celebrate: "/mascot-home-avatar-celebrate.png?v=1",
  fallback: "/mascot-courses-ready.png?v=8",
};
import { HomeSectionHeader } from "../../components/home/HomeSectionHeader";
import { SparkleGlyph } from "../../components/decor/SparkleGlyph.jsx";
import { HOME_SECTION_INNER } from "../../components/layout/customerShellLayout";
import { HOME_SECTION_COPY } from "../../constants/brandVoice";
import {
  HOME_SECTION_TITLE_SIZE,
  homeSectionClasses as homeTy,
} from "../../constants/homeTypography";
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
  
  const [homeData, setHomeData] = useState({ stats: null, reviews: [] });
  const [isLoadingHomeData, setIsLoadingHomeData] = useState(true);

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
      <EventPromoModal />

      <HomeHero />

      {/* ═══ FEATURE CARDS SECTION — Full Screen ═══ */}
      <section className="feature-summary-section w-full flex flex-col items-center px-6 sm:px-10 py-20">
        <FeatureShowcaseStack heading={
          <HomeSectionHeader
            align="center"
            badge="Lộ trình học tập"
            lines={[
              { text: "Chuẩn bị từng bước,", tone: "dark" },
              { text: "tiến bộ mỗi ngày", tone: "accent" },
            ]}
            className="mb-6 sm:mb-8"
          />
        }>

            {/* Card 1: CV Match */}
            <div className="feature-cv-card relative group h-full">
              <div className="feature-cv-heading">
                <span className="feature-cv-icon"><FileSearch size={20} aria-hidden="true" /></span>
                <div><span className="feature-cv-number">01</span><h3>Phân tích CV / JD</h3></div>
              </div>
              <p>Hiểu rõ mức độ phù hợp, nhận gợi ý cải thiện và tối ưu CV theo từng vị trí IT.</p>
              <div className="feature-cv-visual">
                <img className="feature-cv-preview" src={cvFeaturePreview} alt="CV minh họa với mức độ phù hợp 78% và các kỹ năng React, TypeScript, Next.js." width="1086" height="1448" loading="lazy" />
              </div>
            </div>

            {/* Card 2: Video interview with AI */}
            <div className="feature-interview-card relative group h-full">
              <div className="feature-cv-heading">
                <span className="feature-cv-icon feature-interview-icon"><Mic size={20} aria-hidden="true" /></span>
                <div><span className="feature-cv-number feature-interview-number">02</span><h3>Phỏng vấn AI</h3></div>
              </div>
              <p>Luyện phỏng vấn qua video cùng AI, câu hỏi theo CV và phản hồi chi tiết sau mỗi buổi.</p>
              <div className="feature-interview-preview">
                <div className="feature-interview-picture">
                  <div className="feature-interview-video-bar"><span />Phỏng vấn AI<span>01:24</span></div>
                  <img src={interviewFeaturePreview} alt="Nhân vật AI đóng vai người phỏng vấn trong cuộc gọi video." width="1280" height="720" loading="lazy" />
                  <span>Người phỏng vấn AI</span>
                </div>
                <span className="feature-interview-mic" aria-hidden="true"><Mic size={21} /></span>
                <div className="feature-interview-feedback"><CheckCircle2 size={14} aria-hidden="true" />Phản hồi chi tiết</div>
              </div>
            </div>

            {/* Card 3: Mentor call */}
            <div className="feature-mentor-card relative group h-full">
              <div className="feature-cv-heading">
                <span className="feature-cv-icon feature-interview-icon"><CalendarCheck size={20} aria-hidden="true" /></span>
                <div><span className="feature-cv-number feature-interview-number">03</span><h3>Lịch hẹn Mentor</h3></div>
              </div>
              <p>Trao đổi 1:1 cùng mentor, nhận góp ý CV và luyện phỏng vấn từ kinh nghiệm thực tế.</p>
              <div className="feature-mentor-preview">
                <div className="feature-mentor-picture"><img src={mentorFeaturePreview} alt="Minh họa mentor trao đổi và hướng dẫn trong cuộc gọi video 1:1." width="1448" height="1086" loading="lazy" /></div>
                <div className="feature-mentor-actions" aria-hidden="true"><span><Video size={20} /></span><span><MessageCircle size={16} /></span><span><MessageCircle size={16} /></span></div>
              </div>
            </div>

            {/* Card 4: Video courses */}
            <div className="feature-course-card relative group h-full">
              <div className="feature-cv-heading">
                <span className="feature-cv-icon feature-course-icon"><BookOpen size={20} aria-hidden="true" /></span>
                <div><span className="feature-cv-number feature-interview-number">04</span><h3>Khóa học</h3></div>
              </div>
              <p>Học từ nền tảng đến nâng cao với các khóa học chuyên sâu, bám sát thực tế phỏng vấn.</p>
              <div className="feature-course-preview"><img src={coursesFeaturePreview} alt="Minh họa các bài học React, video và kiến thức lập trình trong thư viện khóa học." width="1448" height="1086" loading="lazy" /></div>
            </div>

        </FeatureShowcaseStack>
      </section>

      <div className="landing-section-flow w-full">
        <SectionReveal variant="cv"><CvAnalysisFeatureShowcase /></SectionReveal>
      </div>
      <div className="landing-section-flow w-full">
        <SectionReveal variant="interview"><InterviewFeatureShowcase /></SectionReveal>
      </div>
      <div className="landing-section-flow w-full" style={{ perspective: "1400px" }}>
        <SectionReveal variant="mentor"><MentorFeatureShowcase /></SectionReveal>
      </div>
      <div className="landing-section-flow w-full mt-12 sm:mt-16 lg:mt-24">
        <SectionReveal variant="courses" delay={0.05}><CoursesFeatureShowcase /></SectionReveal>
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
            <div className="liquid-glass-strong flex flex-col rounded-[2rem] p-6 md:p-8 shadow-sm h-[36rem] lg:h-[40rem]">
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="font-black text-white tracking-tight text-xl sm:text-2xl flex items-center flex-wrap gap-x-2 gap-y-1">
                  Phản hồi từ người dùng
                  <img src="/Logo.png" alt="ProInterview" className="h-[1.1em] w-auto object-contain inline-block -translate-y-[2px]" />
                </h3>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-4" style={{ scrollbarWidth: "thin" }}>
                {(homeData.reviews?.length > 0 ? homeData.reviews : [...TESTIMONIALS, ...TESTIMONIALS]).map((t, i) => (
                  <div key={t.id || i} className="liquid-glass flex flex-col p-4 rounded-2xl hover:scale-[1.01] transition-transform">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex gap-3 items-center">
                        <div className="h-11 w-11 rounded-full overflow-hidden border border-white/10 bg-white/5 shrink-0 flex items-center justify-center">
                          <img src={t.avatar || t.mascot || HOME_MENTOR_MASCOTS.fallback} alt="" className="h-[90%] w-[90%] object-contain object-bottom" onError={(e) => { e.currentTarget.src = HOME_MENTOR_MASCOTS.fallback; }} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white leading-none mb-1">{t.name}</h4>
                          <p className="text-xs text-slate-400">{t.role}</p>
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
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {t.text}
                    </p>
                    

                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Key Statistics */}
            <div className="liquid-glass-strong flex flex-col rounded-[20px] p-6 md:p-8 shadow-sm relative h-[36rem] lg:h-[40rem]">
              {/* Background accent */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>

              <div className="flex items-center gap-4 mb-5 relative z-10">
                <div className="text-[#93f72b]">
                  <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4 19h16v2H4zM6 9h3v8H6zM11 4h3v13h-3zM16 12h3v5h-3z" />
                  </svg>
                </div>
                <h3 className="font-black text-[#93f72b] tracking-tight text-xl sm:text-2xl">Thống kê nền tảng</h3>
              </div>
              <p className="text-base text-white/80 mb-10 leading-relaxed relative z-10 font-medium">
                Dữ liệu thực tế về số lượt luyện phỏng vấn, số lượng người dùng và đánh giá chất lượng.
              </p>

              <div className="grid grid-cols-2 gap-4 md:gap-6 flex-1 relative z-10">
                {/* Stat 1 */}
                <div className="liquid-glass rounded-[16px] p-4 sm:p-5 flex items-center gap-3.5 hover:scale-[1.02] transition-transform">
                  <div className="h-11 w-11 shrink-0 rounded-xl bg-[#8037f4]/15 text-[#c4b5fd] flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-2xl md:text-3xl font-black text-white mb-0.5">
                      {formatStatNumber(homeData.stats?.totalSessions)}
                    </div>
                    <div className="text-xs sm:text-sm text-white/80 font-bold truncate">Lượt luyện tập với AI</div>
                  </div>
                </div>
                
                {/* Stat 2 */}
                <div className="liquid-glass rounded-[16px] p-4 sm:p-5 flex items-center gap-3.5 hover:scale-[1.02] transition-transform">
                  <div className="h-11 w-11 shrink-0 rounded-xl bg-[#fdf2f8] text-[#ec4899] flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-2xl md:text-3xl font-black text-white mb-0.5">
                      {formatStatNumber(homeData.stats?.totalMentors)}
                    </div>
                    <div className="text-xs sm:text-sm text-white/80 font-bold truncate">Mentor</div>
                  </div>
                </div>

                {/* Stat 3 */}
                <div className="liquid-glass rounded-[16px] p-4 sm:p-5 flex items-center gap-3.5 hover:scale-[1.02] transition-transform">
                  <div className="h-11 w-11 shrink-0 rounded-xl bg-[#fff7ed] text-[#f97316] flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-2xl md:text-3xl font-black text-white mb-0.5">
                      {homeData.stats?.averageRating ? homeData.stats.averageRating + "/5" : "0/5"}
                    </div>
                    <div className="text-xs sm:text-sm text-white/80 font-bold truncate">Mức hài lòng</div>
                  </div>
                </div>

                {/* Stat 4 */}
                <div className="liquid-glass rounded-[16px] p-4 sm:p-5 flex items-center gap-3.5 hover:scale-[1.02] transition-transform">
                  <div className="h-11 w-11 shrink-0 rounded-xl bg-[#fff1f2] text-[#e11d48] flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-2xl md:text-3xl font-black text-white mb-0.5">
                      {formatStatNumber(homeData.stats?.totalUsers)}
                    </div>
                    <div className="text-xs sm:text-sm text-white/80 font-bold truncate">Người dùng</div>
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
    </div>
  );
}

import React from "react";
import { FileText } from "lucide-react";
import { HOME_SECTION_INNER } from "../layout/customerShellLayout";
import {
  CvAnalysisScoreBreakdown,
  CV_HUB_DEMO_MATCH,
  CV_HUB_DEMO_SCORE_ROWS,
  CV_HOME_DEMO_JD_KEYWORDS,
} from "../cv/CvAnalysisScoreBreakdown";
import { CV_SHOWCASE_COPY } from "../../constants/brandVoice";
import { homeSectionClasses as ty } from "../../constants/homeTypography";
import { HomeSectionHeader } from "./HomeSectionHeader";

const DEMO_MATCH = CV_HUB_DEMO_MATCH;

function ScoreCard({
  title,
  score,
  scoreClass,
  scoreBg,
  scoreBorder,
  children,
  className = "",
  titleClassName = "",
}) {
  return (
    <div
      className={`cv-analysis-glass-card rounded-3xl border-2 border-[#8037f4] bg-white px-[1.5rem] py-[0.875rem] shadow-xl transition-all duration-300 hover:scale-[1.02] sm:px-[1.75rem] sm:py-[1.15rem] max-lg:rounded-xl max-lg:px-4 max-lg:py-3 max-lg:shadow-md ${className}`}
    >
      <div className={`flex items-center justify-between gap-3 ${children ? "mb-3 sm:mb-3.5" : ""}`}>
        <h3 className={`${ty.cardTitle} ${titleClassName}`}>{title}</h3>
        <span
          className={`${ty.cardScore} ${scoreBg} ${scoreClass} ${scoreBorder}`}
        >
          {score}
        </span>
      </div>
      {children ? <ul className="space-y-2">{children}</ul> : null}
    </div>
  );
}

function CardReveal({ delayMs = 0, className = "", children }) {
  return (
    <div
      className={`cv-score-card-reveal w-full ${className}`}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      {children}
    </div>
  );
}

/** Showcase phân tích CV — anchor #features */
export function CvAnalysisFeatureShowcase({ onCtaClick }) {
  return (
    <section id="features" className={ty.section}>
      <style>{`
        .cv-analysis-glass-card { background-color: #ffffff; }
        @keyframes cv-score-card-grow {
          0% { opacity: 0; transform: scale(0.88); }
          100% { opacity: 1; transform: scale(1); }
        }
        .cv-score-card-reveal {
          transform-origin: center top;
          animation: cv-score-card-grow 0.6s cubic-bezier(0.22, 1.12, 0.36, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .cv-score-card-reveal { animation: none; opacity: 1; }
        }
      `}</style>
      <div className={`${ty.sectionShell} ${HOME_SECTION_INNER}`}>
        <div className={ty.sectionGrid}>
          <HomeSectionHeader
            icon={FileText}
            badge={CV_SHOWCASE_COPY.badge}
            lines={[
              { text: "Làm sao để CV ấn tượng", tone: "accent" },
              { text: "trong mắt nhà tuyển dụng?", tone: "dark" },
            ]}
            body={CV_SHOWCASE_COPY.body}
          >
            {onCtaClick ? (
              <button
                type="button"
                onClick={onCtaClick}
                className={`${ty.cta} text-[#0f172a] hover:brightness-110`}
                style={{
                  background: "#93f72b",
                  boxShadow: "0 8px 20px rgba(15,23,42,0.08)",
                }}
              >
                {CV_SHOWCASE_COPY.cta}
              </button>
            ) : null}
          </HomeSectionHeader>

          <div className="relative z-10 flex min-w-0 flex-col items-center justify-center overflow-hidden">
            <div className="relative mx-auto w-full max-w-[31.6rem]">
              <div className="pointer-events-none absolute left-1/2 top-0 z-[5] w-[14.5rem] -translate-x-1/2 -translate-y-[1.73rem] sm:w-[16.5rem] sm:-translate-y-[2.93rem] lg:w-[18rem] lg:-translate-y-[3.13rem]">
                <img
                  src="/mascot-cv-analysis-pose7.png?v=1"
                  alt=""
                  aria-hidden
                  className="block h-auto w-full object-contain"
                />
              </div>

              <div className="relative z-10 flex w-full flex-col -space-y-3 pt-[8.25rem] sm:pt-[9rem] lg:pt-[9.5rem]">
                <CardReveal delayMs={0} className="relative z-10">
                  <ScoreCard
                    className="scale-95 transform max-lg:px-[1.15rem] max-lg:py-[0.9rem]"
                    title="Độ khớp CV–JD"
                    score={`${DEMO_MATCH.percent}% Khá tốt`}
                    scoreBg="bg-[#e6f7ed]"
                    scoreClass="text-[#2e7d32]"
                    scoreBorder="border-[#c8e6c9]"
                  />
                </CardReveal>

                <CardReveal delayMs={140} className="relative z-20">
                  <div className="cv-analysis-glass-card rounded-3xl border-2 border-[#8037f4] bg-white px-[1.5rem] py-[0.875rem] shadow-xl transition-all duration-300 hover:scale-[1.02] sm:px-[1.75rem] sm:py-[1.15rem]">
                    <div className="mb-3 flex items-center gap-2.5 sm:mb-3.5">
                      <div className="flex h-[1.7rem] w-[1.7rem] shrink-0 items-center justify-center rounded-lg bg-violet-100 sm:h-[1.95rem] sm:w-[1.95rem]">
                        <FileText className="h-[0.7rem] w-[0.7rem] text-[#630ed4] sm:h-[0.825rem] sm:w-[0.825rem]" />
                      </div>
                      <h3 className={ty.cardTitle}>Từ khóa khớp với JD</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {CV_HOME_DEMO_JD_KEYWORDS.map((kw) => (
                        <span
                          key={kw}
                          className="rounded-full border border-lime-400/70 bg-lime-50 px-2.5 py-1 text-sm font-semibold lowercase text-emerald-900 sm:text-base"
                        >
                          {kw} ✓
                        </span>
                      ))}
                    </div>
                  </div>
                </CardReveal>

                <CardReveal delayMs={280} className="relative z-30">
                  <div className="cv-analysis-glass-card relative w-full overflow-hidden rounded-3xl border-2 border-[#8037f4] bg-white shadow-xl transition-all duration-300 hover:scale-[1.02]">
                    <CvAnalysisScoreBreakdown
                      overallScore={DEMO_MATCH.percent}
                      rows={CV_HUB_DEMO_SCORE_ROWS}
                      compact
                      homePreview
                      showHeader={false}
                      className="!rounded-none !border-0 !shadow-none"
                    />
                  </div>
                </CardReveal>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

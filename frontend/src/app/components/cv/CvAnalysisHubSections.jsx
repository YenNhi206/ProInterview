import React from "react";
import { FileText, Briefcase } from "lucide-react";
import {
  CvAnalysisScoreBreakdown,
  CV_HUB_DEMO_SCORE_ROWS,
  CV_HUB_DEMO_MATCH,
} from "./CvAnalysisScoreBreakdown";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../layout/customerShellLayout";
import { CustomerPageBadge } from "../layout/CustomerPageHeader";

const HUB_STYLES = `
  .cv-hub-enter {
    animation: cvHubIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  @keyframes cvHubIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .cv-hub-cta {
    transition: transform 0.28s cubic-bezier(0.34, 1.45, 0.64, 1), box-shadow 0.28s ease, filter 0.2s ease;
  }
  .cv-hub-cta:hover {
    transform: scale(1.045) translateY(-2px);
  }
  .cv-hub-cta:active {
    transform: scale(0.98) translateY(0);
  }
  @media (prefers-reduced-motion: reduce) {
    .cv-hub-enter { animation: none; opacity: 1; transform: none; }
    .cv-hub-cta { transition: none; }
    .cv-hub-cta:hover,
    .cv-hub-cta:active { transform: none; }
  }
`;

function MascotSparkle({ className }) {
  return (
    <span
      className={`pointer-events-none absolute block h-2.5 w-2.5 rotate-45 rounded-[3px] bg-[#FACC15] shadow-sm ${className}`}
      aria-hidden
    />
  );
}

export function CvAnalysisHubHero({ onJd, onField }) {
  const { percent, matched, missing, summary } = CV_HUB_DEMO_MATCH;

  return (
    <div className="cv-hub-page relative min-h-0 bg-transparent">
      <style>{HUB_STYLES}</style>

      <div
        className={`relative flex min-h-0 flex-col bg-transparent pb-4 pt-12 sm:pb-5 ${CUSTOMER_SHELL_GUTTER}`}
      >
        <div
          className={`cv-hub-enter ${CUSTOMER_SHELL_MAX} flex flex-col overflow-visible lg:flex-row lg:items-stretch lg:gap-3 xl:gap-4`}
        >
          {/* Trái — hero + linh vật */}
          <div className="relative flex shrink-0 flex-col justify-center py-3 sm:py-4 lg:min-w-[25rem] lg:max-w-[33rem] lg:flex-[0.92] lg:py-2 xl:max-w-[34rem]">
            <div className="relative z-10 flex flex-col gap-2.5 pr-16 sm:gap-3 sm:pr-20 lg:-translate-y-24 lg:pr-0">
              <CustomerPageBadge className="w-fit">
                Phân tích CV
              </CustomerPageBadge>

              <h1 className="max-w-[min(100%,32rem)] font-headline tracking-tight">
                <span className="block text-[clamp(1.8rem,4.35vw,2.65rem)] font-extrabold leading-[1.15] text-[#1a1b23]">
                  <span className="block whitespace-nowrap">Làm sao để CV ấn tượng</span>
                  <span className="block whitespace-nowrap">trong mắt nhà tuyển dụng?</span>
                </span>
                <span className="mt-1 block text-[clamp(1.72rem,4.2vw,2.5rem)] font-extrabold leading-[1.15] text-[#630ed4]">
                  Để ProInterview gợi ý tin và chỉnh CV nè.
                </span>
              </h1>

              <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
                <button
                  type="button"
                  onClick={onJd}
                  className="cv-hub-cta inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-[#630ed4] to-[#7c3aed] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-500/25 hover:brightness-105 hover:shadow-xl hover:shadow-violet-500/30 sm:text-sm"
                >
                  Phân tích CV + JD có sẵn
                </button>
                <button
                  type="button"
                  onClick={onField}
                  className="cv-hub-cta inline-flex items-center gap-2 rounded-2xl border-2 border-violet-200/80 bg-white/90 px-5 py-2.5 text-xs font-bold text-[#630ed4] shadow-sm backdrop-blur-sm hover:border-violet-300 hover:bg-white hover:shadow-md sm:text-sm"
                >
                  Phân tích CV theo ngành nghề
                </button>
              </div>
            </div>

            <div className="pointer-events-none absolute right-0 top-[1.3rem] z-0 translate-x-[0.7rem] lg:hidden" aria-hidden>
              <img
                src="/mascot-cv-hub-knowledge.png?v=8"
                alt=""
                className="h-[11.5rem] w-[11.5rem] object-contain drop-shadow-[0_12px_28px_rgba(99,14,212,0.12)] sm:h-[11.5rem] sm:w-[11.5rem]"
              />
            </div>
          </div>

          {/* Phải — demo: banner + 2 ô + card cùng full width */}
          <div className="flex min-w-0 w-full flex-1 flex-col gap-2.5 sm:gap-3 lg:ml-auto lg:min-w-0 lg:max-w-[32rem] lg:flex-[1.08] xl:max-w-[33rem]">
            <div className="flex items-center justify-between gap-2 px-0.5">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-violet-800 sm:text-xs">
                Kết quả phân tích
              </span>
            </div>

            <div
              className="w-full overflow-hidden rounded-xl sm:rounded-2xl"
              style={{ background: "linear-gradient(135deg,#6E35E8 0%,#9B6DFF 55%,#B794FF 100%)" }}
            >
              <div className="relative px-4 py-3 text-white sm:px-5 sm:py-3.5">
                <div
                  className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl"
                  aria-hidden
                />
                <p className="relative mb-1 text-[10px] font-medium text-indigo-100/90 sm:text-xs">
                  Mức độ phù hợp CV
                </p>
                <div className="relative flex flex-wrap items-end gap-2">
                  <span className="font-headline text-3xl font-extrabold leading-none tracking-tight sm:text-[2.35rem]">
                    {percent}%
                  </span>
                  <div className="mb-1 flex flex-col gap-1">
                    <span className="text-[10px] text-indigo-200/90 sm:text-xs">keyword match</span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-1 w-3 rounded-full sm:w-3.5"
                          style={{
                            background:
                              i < Math.round(percent / 10)
                                ? "rgba(255,255,255,0.9)"
                                : "rgba(255,255,255,0.22)",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="relative mt-1.5 line-clamp-2 text-[10px] leading-snug text-indigo-50/95 sm:text-xs">
                  {summary}
                </p>
              </div>
            </div>

            <div className="grid w-full grid-cols-10 gap-2">
              <div className="col-span-6 rounded-md border border-emerald-100/90 bg-white/95 p-2.5 shadow-sm backdrop-blur-sm sm:p-3">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100">
                    <FileText className="h-3.5 w-3.5 text-emerald-700" />
                  </div>
                  <h3 className="text-[10px] font-semibold text-slate-900 sm:text-xs">Từ khóa khớp</h3>
                </div>
                <div className="flex flex-wrap gap-1">
                  {matched.map((kw) => (
                    <span
                      key={kw}
                      className="rounded-md border border-emerald-400/60 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800 sm:text-[10px]"
                    >
                      {kw} ✓
                    </span>
                  ))}
                </div>
              </div>
              <div className="col-span-4 rounded-md border border-orange-100/90 bg-white/95 p-2.5 shadow-sm backdrop-blur-sm sm:p-3">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-100">
                    <Briefcase className="h-3.5 w-3.5 text-orange-700" />
                  </div>
                  <h3 className="text-[10px] font-semibold text-slate-900 sm:text-xs">Cần bổ sung</h3>
                </div>
                <div className="flex flex-wrap gap-1">
                  {missing.map((kw) => (
                    <span
                      key={kw}
                      className="rounded-md border border-orange-300/70 bg-orange-50 px-1.5 py-0.5 text-[9px] font-semibold text-orange-900 sm:text-[10px]"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Card đánh giá — hubPreview; gấu căn đáy card (desktop) */}
            <div className="relative hidden w-full overflow-visible lg:block">
              <div
                className="pointer-events-none absolute bottom-0 left-0 z-20 -translate-x-[17.65rem] translate-y-[2.5rem] xl:-translate-x-[18.15rem]"
                aria-hidden
              >
                <MascotSparkle className="left-[27%] top-[8%] h-2.5 w-2.5" />
                <MascotSparkle className="right-[17%] top-[4.5%] h-2 w-2 opacity-80" />
                <img
                  src="/mascot-cv-hub-knowledge.png?v=10"
                  alt=""
                  className="block h-[21rem] w-[21rem] max-w-none object-contain object-bottom drop-shadow-[0_20px_50px_rgba(99,14,212,0.18)] xl:h-[22rem] xl:w-[22rem]"
                />
              </div>
              <CvAnalysisScoreBreakdown
                overallScore={percent}
                rows={CV_HUB_DEMO_SCORE_ROWS}
                compact
                hubPreview
                showHeader={false}
                className="relative z-10 w-full !rounded-md border-violet-100/60 bg-white/95 shadow-sm backdrop-blur-sm [&>div:last-child]:pl-[3.25rem] [&>div:last-child]:xl:pl-[3.75rem]"
              />
            </div>

            <div className="w-full lg:hidden">
              <CvAnalysisScoreBreakdown
                overallScore={percent}
                rows={CV_HUB_DEMO_SCORE_ROWS}
                compact
                hubPreview
                showHeader={false}
                className="w-full !rounded-md border-violet-100/60 bg-white/95 shadow-sm backdrop-blur-sm"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

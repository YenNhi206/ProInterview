import React, { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Briefcase } from "lucide-react";
import {
  CvAnalysisScoreBreakdown,
  CV_HUB_DEMO_SCORE_ROWS,
  CV_HUB_DEMO_MATCH,
} from "./CvAnalysisScoreBreakdown";
import { CV_HUB_HERO_COPY, CV_SHOWCASE_COPY } from "../../constants/brandVoice";
import { HOME_SECTION_TITLE_CLAMP } from "../../constants/homeTypography";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../layout/customerShellLayout";
import {
  CUSTOMER_PAGE_TITLE_CLASS,
  CUSTOMER_PAGE_TITLE_BASE,
  CUSTOMER_PAGE_TITLE_ACCENT,
} from "../layout/CustomerPageHeader";

const HUB_STYLES = `
  .cv-hub-enter {
    animation: cvHubIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  @keyframes cvHubIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .cv-hub-cta {
    transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.28s ease, filter 0.2s ease, color 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
  }
  .cv-hub-cta:hover {
    transform: scale(1.045) translateY(-2px);
  }
  .cv-hub-cta:active {
    transform: scale(0.98) translateY(0);
  }
  @media (min-width: 1024px) {
    .cv-hub-unified-shell {
      display: flex;
      width: 100%;
      min-width: 0;
      justify-content: center;
      overflow: visible;
    }
    .cv-hub-scale-host {
      position: relative;
      overflow: visible;
    }
    .cv-hub-unified-block--scaled {
      transform-origin: top left;
    }
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

const LG_UNIFIED_MQ = "(min-width: 1024px)";

export function CvAnalysisHubHero({ onJd, onField, onBestFit, navShellAligned = false }) {
  const { percent, matched, missing, summary } = CV_HUB_DEMO_MATCH;
  const shellRef = useRef(null);
  const blockRef = useRef(null);
  const [unifiedFit, setUnifiedFit] = useState({
    scale: 1,
    naturalW: 0,
    naturalH: 0,
    layoutW: 0,
    layoutH: 0,
  });

  const measureUnifiedScale = useCallback(() => {
    const shell = shellRef.current;
    const block = blockRef.current;
    if (!shell || !block || !navShellAligned) {
      setUnifiedFit({ scale: 1, naturalW: 0, naturalH: 0, layoutW: 0, layoutH: 0 });
      return;
    }

    if (!window.matchMedia(LG_UNIFIED_MQ).matches) {
      setUnifiedFit({ scale: 1, naturalW: 0, naturalH: 0, layoutW: 0, layoutH: 0 });
      block.style.transform = "";
      return;
    }

    block.style.transform = "none";
    const naturalW = block.offsetWidth;
    const naturalH = block.offsetHeight;
    const viewport = shell.closest(".cv-hub-viewport");
    const pad = 16;
    const availableW = Math.max(0, shell.clientWidth - pad);
    const availableH = Math.max(
      0,
      (viewport?.clientHeight ?? shell.clientHeight) - pad
    );
    if (!naturalW || !naturalH || !availableW || !availableH) return;

    const scale = Math.min(1, availableW / naturalW, availableH / naturalH);
    setUnifiedFit({
      scale,
      naturalW,
      naturalH,
      layoutW: naturalW * scale,
      layoutH: naturalH * scale,
    });
  }, [navShellAligned]);

  useEffect(() => {
    if (!navShellAligned) return undefined;

    requestAnimationFrame(() => {
      requestAnimationFrame(measureUnifiedScale);
    });
    const shell = shellRef.current;
    const block = blockRef.current;
    const mq = window.matchMedia(LG_UNIFIED_MQ);

    const ro =
      shell && block
        ? new ResizeObserver(() => {
            requestAnimationFrame(measureUnifiedScale);
          })
        : null;

    if (ro) {
      ro.observe(shell);
      ro.observe(block);
    }

    const onMqChange = () => requestAnimationFrame(measureUnifiedScale);
    mq.addEventListener("change", onMqChange);
    window.addEventListener("resize", measureUnifiedScale);

    return () => {
      ro?.disconnect();
      mq.removeEventListener("change", onMqChange);
      window.removeEventListener("resize", measureUnifiedScale);
    };
  }, [navShellAligned, measureUnifiedScale]);

  const outerClass = navShellAligned
    ? "relative flex min-h-0 flex-col bg-transparent pb-2 pt-2 sm:pb-3 lg:pb-1 lg:pt-0"
    : `relative flex min-h-0 flex-col bg-transparent pb-4 pt-12 sm:pb-5 ${CUSTOMER_SHELL_GUTTER}`;

  const shellClass = navShellAligned
    ? "cv-hub-unified-shell w-full min-w-0"
    : `cv-hub-unified-shell ${CUSTOMER_SHELL_MAX} w-full min-w-0`;

  const unifiedBlockClass = [
    "cv-hub-unified-block cv-hub-enter flex w-full min-w-0 flex-col gap-6 sm:gap-8",
    navShellAligned ? "" : "mx-auto",
    "lg:w-max lg:max-w-none lg:flex-row lg:flex-nowrap lg:items-start lg:justify-start lg:gap-[2.5rem] xl:gap-[3.5rem]",
    navShellAligned ? "cv-hub-unified-block--scaled" : "",
  ].join(" ");

  const { scale, layoutW, layoutH } = unifiedFit;
  const hostStyle =
    navShellAligned && layoutW > 0 && layoutH > 0
      ? { width: layoutW, height: layoutH }
      : undefined;
  const blockStyle =
    navShellAligned && scale < 1
      ? { transform: `scale(${scale})`, transformOrigin: "top left" }
      : undefined;

  const unifiedInner = (
    <div
      ref={navShellAligned ? blockRef : null}
      className={unifiedBlockClass}
      style={blockStyle}
    >
          <div
            className={`cv-hub-unified-col cv-hub-unified-col--copy relative flex min-w-0 shrink-0 flex-col justify-center py-3 sm:py-4 lg:max-w-[44rem] lg:translate-y-20 ${navShellAligned ? "lg:py-0" : "lg:py-2"
              }`}
          >
            <div className="relative z-10 flex min-w-0 flex-col gap-2.5 sm:gap-3">
              <h1 className={`min-w-0 max-w-full ${CUSTOMER_PAGE_TITLE_CLASS}`}>
                {/* Desktop */}
                <span className="hidden flex-col gap-1 lg:flex">
                  <span className={`block text-pretty ${CUSTOMER_PAGE_TITLE_ACCENT}`}>
                    {CV_HUB_HERO_COPY.titleAccent}
                  </span>
                  <span className={`block ${CUSTOMER_PAGE_TITLE_BASE} lg:whitespace-nowrap`}>
                    {CV_HUB_HERO_COPY.titleRest}
                  </span>
                </span>

                {/* Mobile */}
                <span className="block lg:hidden">
                  <span className={`block ${CUSTOMER_PAGE_TITLE_ACCENT}`}>Làm sao để CV ấn tượng</span>
                  <span className={`mt-0.5 block ${CUSTOMER_PAGE_TITLE_BASE} sm:whitespace-nowrap`}>trong mắt nhà tuyển dụng?</span>
                </span>
              </h1>
              <p className="mt-3 min-w-0 max-w-full text-sm font-medium leading-relaxed text-slate-300 [html[data-workspace-theme=light]_&]:text-[#5b5772] sm:text-base tracking-normal">
                ProInterview giúp bạn kiểm tra, góp ý và cải thiện CV trước khi gửi đến nhà
                <br className="hidden lg:block" />
                tuyển dụng.
              </p>

              <div className="flex flex-col gap-2 pt-0.5 max-sm:items-stretch sm:flex-row sm:flex-nowrap sm:items-center sm:justify-start sm:gap-2.5 lg:gap-3">
                <button
                  type="button"
                  onClick={onJd}
                  className="cv-hub-cta cv-hub-cta--primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c7f36b] inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-2xl bg-[#93f72b] px-5 py-2.5 text-sm font-extrabold text-[#131f00] border border-[#7fd925] shadow-md hover:bg-[#a8ff4e] sm:px-6 sm:py-3 sm:text-base cursor-pointer"
                >
                  {CV_HUB_HERO_COPY.ctaJd}
                </button>
                <button
                  type="button"
                  onClick={onField}
                  className="cv-hub-cta cv-hub-cta--secondary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400 inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-violet-300/40 bg-violet-950/40 text-violet-100 shadow-sm hover:bg-violet-900/40 sm:px-6 sm:py-3 px-5 py-2.5 text-sm font-extrabold sm:text-base cursor-pointer"
                >
                  {CV_HUB_HERO_COPY.ctaField}
                </button>
              </div>
              {onBestFit ? (
                <button
                  type="button"
                  onClick={onBestFit}
                  className="self-start text-sm font-semibold text-violet-200 [html[data-workspace-theme=light]_&]:text-[#8037f4] underline-offset-4 hover:text-[#93f72b] [html[data-workspace-theme=light]_&]:hover:text-[#6d28d9] hover:underline"
                  data-button-surface="none"
                >
                  Có nhiều bản CV? So sánh để chọn CV hợp nhất với JD →
                </button>
              ) : null}
            </div>
          </div>

          {/* Cột phải — demo kết quả */}
          <div className="cv-hub-unified-col cv-hub-unified-col--demo flex w-full min-w-0 shrink-0 flex-col gap-0 lg:w-[33rem] xl:w-[34.5rem]">
            <h2 className="sr-only">Bản xem trước phân tích CV</h2>
            {/* Demo KQ: banner + 2 ô + bảng — căn trái trong cột */}
            <div className="cv-hub-demo-stack -mt-0.5 flex w-full min-w-0 max-w-full flex-col gap-2 sm:gap-2.5 lg:mt-0 lg:gap-2.5 lg:pt-0">
              <div
                className="liquid-glass-strong w-full shrink-0 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#35205e_0%,#452976_55%,#5b3891_100%)] [html[data-workspace-theme=light]_&]:!bg-white [html[data-workspace-theme=light]_&]:border [html[data-workspace-theme=light]_&]:border-[#ddd3f5] [html[data-workspace-theme=light]_&]:shadow-sm"
              >
                <div className="relative px-3.5 py-3 text-white [html[data-workspace-theme=light]_&]:text-[#1a1b23] sm:px-4 sm:py-3.5 lg:px-4 lg:py-3.5">
                  <div
                    className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl [html[data-workspace-theme=light]_&]:hidden"
                    aria-hidden
                  />
                  <p className="relative mb-1 text-[11px] font-medium text-indigo-100/90 [html[data-workspace-theme=light]_&]:text-[#5b5772] sm:text-xs">
                    Mức độ phù hợp CV
                  </p>
                  <div className="relative flex flex-wrap items-end gap-2.5">
                    <span className="font-headline text-[1.65rem] text-[#c7f36b] [html[data-workspace-theme=light]_&]:text-[#8037f4] font-extrabold leading-none tracking-tight sm:text-[1.85rem]">
                      {percent}%
                    </span>
                    <div className="mb-0.5 flex flex-col gap-1">
                      <span className="text-[11px] text-indigo-200/90 [html[data-workspace-theme=light]_&]:text-[#6b6785] sm:text-xs">keyword match</span>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 10 }).map((_, i) => (
                          <div
                            key={i}
                            className={`h-1.5 w-3.5 rounded-full sm:w-4 ${
                              i < Math.round(percent / 10)
                                ? "bg-white/90 [html[data-workspace-theme=light]_&]:bg-[#8037f4]"
                                : "bg-white/22 [html[data-workspace-theme=light]_&]:bg-violet-100"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="relative mt-1.5 line-clamp-2 text-[11px] leading-snug text-indigo-50/95 [html[data-workspace-theme=light]_&]:text-[#23252f] sm:text-xs">
                    {summary}
                  </p>
                </div>
              </div>

              <div className="relative z-10 grid w-full shrink-0 grid-cols-10 gap-1.5 sm:gap-2">
                <div className="liquid-glass-strong col-span-6 rounded-2xl border-0 !bg-[#201938]/95 [html[data-workspace-theme=light]_&]:!bg-white [html[data-workspace-theme=light]_&]:border [html[data-workspace-theme=light]_&]:border-[#ddd3f5] p-2.5 shadow-sm backdrop-blur-sm sm:p-3">
                  <div className="mb-1 flex items-center gap-1.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#93f72b]/15 [html[data-workspace-theme=light]_&]:bg-lime-100 sm:h-7 sm:w-7">
                      <FileText className="h-3.5 w-3.5 text-[#c7f36b] [html[data-workspace-theme=light]_&]:text-lime-700 sm:h-4 sm:w-4" />
                    </div>
                    <h3 className="text-[11px] font-semibold text-white [html[data-workspace-theme=light]_&]:text-[#1a1b23] sm:text-xs">Từ khóa khớp</h3>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {matched.map((kw) => (
                      <span
                        key={kw}
                        className="rounded-md border border-[#93f72b]/30 bg-[#93f72b]/10 [html[data-workspace-theme=light]_&]:bg-lime-50 [html[data-workspace-theme=light]_&]:border-lime-300 [html[data-workspace-theme=light]_&]:text-lime-800 px-2 py-0.5 text-[10px] font-semibold text-[#c7f36b] sm:text-[11px]"
                      >
                        {kw} ✓
                      </span>
                    ))}
                  </div>
                </div>
                <div className="liquid-glass-strong col-span-4 rounded-2xl border-0 !bg-[#201938]/95 [html[data-workspace-theme=light]_&]:!bg-white [html[data-workspace-theme=light]_&]:border [html[data-workspace-theme=light]_&]:border-[#ddd3f5] p-2.5 shadow-sm backdrop-blur-sm sm:p-3">
                  <div className="mb-1 flex items-center gap-1.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-300/15 [html[data-workspace-theme=light]_&]:bg-violet-100 sm:h-7 sm:w-7">
                      <Briefcase className="h-3.5 w-3.5 text-violet-200 [html[data-workspace-theme=light]_&]:text-[#8037f4] sm:h-4 sm:w-4" />
                    </div>
                    <h3 className="text-[11px] font-semibold text-white [html[data-workspace-theme=light]_&]:text-[#1a1b23] sm:text-xs">Cần bổ sung</h3>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {missing.map((kw) => (
                      <span
                        key={kw}
                        className="rounded-md border border-violet-300/30 bg-violet-300/10 [html[data-workspace-theme=light]_&]:bg-violet-50 [html[data-workspace-theme=light]_&]:border-violet-200 [html[data-workspace-theme=light]_&]:text-[#6d28d9] px-2 py-0.5 text-[10px] font-semibold text-violet-200 sm:text-[11px]"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card đánh giá, hubPreview; gấu trong vùng padding trái, không clip */}
              <div className="relative hidden w-full min-w-0 shrink-0 overflow-visible lg:block">
                <div
                  className="pointer-events-none absolute bottom-0 left-0 z-20 max-w-[min(100%,16rem)] -translate-x-[calc(24%+7.6rem)] translate-y-[calc(4%+2.05rem)] 2xl:max-w-[17.5rem] 2xl:-translate-x-[calc(26%+7.6rem)]"
                  aria-hidden
                >
                  <MascotSparkle className="left-[27%] top-[8%] h-2.5 w-2.5" />
                  <MascotSparkle className="right-[17%] top-[4.5%] h-2 w-2 opacity-80" />
                  <img
                    src="/mascot-cv-hub-pose1.png?v=1"
                    alt=""
                    className="block h-auto w-full max-w-full object-contain object-bottom drop-shadow-[0_20px_50px_rgba(99,14,212,0.18)]"
                  />
                </div>
                <CvAnalysisScoreBreakdown
                  overallScore={percent}
                  rows={CV_HUB_DEMO_SCORE_ROWS}
                  compact
                  hubPreview
                  showHeader={false}
                  className="relative z-10 w-full min-w-0 overflow-hidden !rounded-2xl liquid-glass-strong !border-0 !bg-[#201938]/95 [html[data-workspace-theme=light]_&]:!bg-white [html[data-workspace-theme=light]_&]:border [html[data-workspace-theme=light]_&]:border-[#ddd3f5] p-0 shadow-sm backdrop-blur-sm"
                />
              </div>

              <div className="w-full shrink-0 lg:hidden">
                <CvAnalysisScoreBreakdown
                  overallScore={percent}
                  rows={CV_HUB_DEMO_SCORE_ROWS}
                  compact
                  hubPreview
                  showHeader={false}
                  className="w-full !rounded-2xl liquid-glass-strong !border-0 !bg-[#201938]/95 [html[data-workspace-theme=light]_&]:!bg-white [html[data-workspace-theme=light]_&]:border [html[data-workspace-theme=light]_&]:border-[#ddd3f5] shadow-sm backdrop-blur-sm"
                />
              </div>
            </div>
          </div>
    </div>
  );

  return (
    <div className="cv-hub-page relative min-h-0 bg-transparent">
      <style>{HUB_STYLES}</style>

      <div className={outerClass}>
        <div ref={navShellAligned ? shellRef : null} className={shellClass}>
          {navShellAligned ? (
            <div className="cv-hub-scale-host lg:-translate-x-2" style={hostStyle}>
              {unifiedInner}
            </div>
          ) : (
            unifiedInner
          )}
        </div>
      </div>
    </div>
  );
}

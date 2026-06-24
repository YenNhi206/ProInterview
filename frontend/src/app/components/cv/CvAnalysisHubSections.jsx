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

export function CvAnalysisHubHero({ onJd, onField, navShellAligned = false }) {
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
              <h1 className="min-w-0 max-w-full font-headline tracking-tight">
                {/* Desktop, cùng cỡ tiêu đề section Home (Mentor, Khóa học, …) */}
                <span
                  className="hidden flex-col gap-[0.25rem] font-extrabold leading-[1.06] lg:flex"
                  style={{ fontSize: HOME_SECTION_TITLE_CLAMP }}
                >
                  <span className="block text-pretty text-[#630ed4]">
                    {CV_HUB_HERO_COPY.titleAccent}
                  </span>
                  <span className="block text-[#1a1b23] lg:whitespace-nowrap">
                    {CV_HUB_HERO_COPY.titleRest}
                  </span>
                </span>

                {/* Mobile, giữ cỡ hub riêng */}
                <span className="block text-[clamp(1.5rem,3.5vw,3.25rem)] font-extrabold leading-[1.12] lg:hidden">
                  <span className="block text-[#630ed4]">Làm sao để CV ấn tượng</span>
                  <span className="mt-0.5 block text-[#1a1b23] sm:whitespace-nowrap">trong mắt nhà tuyển dụng?</span>
                </span>
                <p className="mt-2 min-w-0 max-w-full text-sm font-medium leading-relaxed text-violet-700/90 sm:text-lg">
                  ProInterview giúp bạn kiểm tra, góp ý và cải thiện CV trước khi gửi đến nhà
                  <br className="hidden lg:block" />
                  tuyển dụng.
                </p>
              </h1>

              <div className="flex flex-col gap-2 pt-0.5 max-sm:items-stretch sm:flex-row sm:flex-nowrap sm:items-center sm:justify-start sm:gap-2.5 lg:gap-3">
                <button
                  type="button"
                  onClick={onJd}
                  className="cv-hub-cta inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-2xl bg-gradient-to-br from-[#630ed4] to-[#7c3aed] px-4 py-2 text-sm font-bold text-white shadow-lg shadow-violet-500/25 hover:brightness-105 hover:shadow-xl hover:shadow-violet-500/30 sm:px-5 sm:py-2.5 sm:text-base"
                >
                  {CV_HUB_HERO_COPY.ctaJd}
                </button>
                <button
                  type="button"
                  onClick={onField}
                  className="cv-hub-cta inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border-2 border-violet-200/80 bg-white/90 px-4 py-2 text-sm font-bold text-[#630ed4] shadow-sm backdrop-blur-sm hover:border-violet-300 hover:bg-white hover:shadow-md sm:px-5 sm:py-2.5 sm:text-base"
                >
                  {CV_HUB_HERO_COPY.ctaField}
                </button>
              </div>
            </div>
          </div>

          {/* Cột phải — demo kết quả */}
          <div className="cv-hub-unified-col cv-hub-unified-col--demo flex w-full min-w-0 shrink-0 flex-col gap-0 lg:w-[33rem] xl:w-[34.5rem]">
            {/* Demo KQ: banner + 2 ô + bảng — căn trái trong cột */}
            <div className="cv-hub-demo-stack -mt-0.5 flex w-full min-w-0 max-w-full flex-col gap-2.5 sm:gap-3 lg:mt-0 lg:gap-4 lg:pt-0">
              <div
                className="w-full shrink-0 overflow-hidden rounded-xl sm:rounded-[1.15rem]"
                style={{ background: "linear-gradient(135deg,#6E35E8 0%,#9B6DFF 55%,#B794FF 100%)" }}
              >
                <div className="relative px-3.5 py-4 text-white sm:px-4 sm:py-5 lg:px-4 lg:py-7">
                  <div
                    className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl"
                    aria-hidden
                  />
                  <p className="relative mb-1.5 text-[11px] font-medium text-indigo-100/90 sm:text-xs">
                    Mức độ phù hợp CV
                  </p>
                  <div className="relative flex flex-wrap items-end gap-2.5">
                    <span className="font-headline text-[1.65rem] font-extrabold leading-none tracking-tight sm:text-[2rem]">
                      {percent}%
                    </span>
                    <div className="mb-1 flex flex-col gap-1">
                      <span className="text-[11px] text-indigo-200/90 sm:text-xs">keyword match</span>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 10 }).map((_, i) => (
                          <div
                            key={i}
                            className="h-1.5 w-3.5 rounded-full sm:w-4"
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
                  <p className="relative mt-2 line-clamp-2 text-[11px] leading-snug text-indigo-50/95 sm:text-xs">
                    {summary}
                  </p>
                </div>
              </div>

              <div className="relative z-10 grid w-full shrink-0 grid-cols-10 gap-1.5 sm:gap-2">
                <div className="col-span-6 rounded-md border border-emerald-100/90 bg-white/95 p-3 shadow-sm backdrop-blur-sm sm:p-4">
                  <div className="mb-1 flex items-center gap-1.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 sm:h-7 sm:w-7">
                      <FileText className="h-3.5 w-3.5 text-emerald-700 sm:h-4 sm:w-4" />
                    </div>
                    <h3 className="text-[11px] font-semibold text-slate-900 sm:text-xs">Từ khóa khớp</h3>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {matched.map((kw) => (
                      <span
                        key={kw}
                        className="rounded-md border border-emerald-400/60 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 sm:text-[11px]"
                      >
                        {kw} ✓
                      </span>
                    ))}
                  </div>
                </div>
                <div className="col-span-4 rounded-md border border-orange-100/90 bg-white/95 p-3 shadow-sm backdrop-blur-sm sm:p-4">
                  <div className="mb-1 flex items-center gap-1.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-100 sm:h-7 sm:w-7">
                      <Briefcase className="h-3.5 w-3.5 text-orange-700 sm:h-4 sm:w-4" />
                    </div>
                    <h3 className="text-[11px] font-semibold text-slate-900 sm:text-xs">Cần bổ sung</h3>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {missing.map((kw) => (
                      <span
                        key={kw}
                        className="rounded-md border border-orange-300/70 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-900 sm:text-[11px]"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card đánh giá, hubPreview; gấu trong vùng padding trái, không clip */}
              <div className="relative hidden w-full min-w-0 shrink-0 overflow-visible pb-2 lg:block lg:pb-4">
                <div
                  className="pointer-events-none absolute bottom-0 left-0 z-20 max-w-[min(100%,18rem)] -translate-x-[calc(24%+7.6rem)] translate-y-[calc(4%+0.85rem)] 2xl:max-w-[19rem] 2xl:-translate-x-[calc(26%+7.6rem)]"
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
                  className="relative z-10 w-full min-w-0 overflow-hidden !rounded-md border-violet-100/60 bg-white/95 p-0 shadow-sm backdrop-blur-sm"
                />
              </div>

              <div className="w-full shrink-0 lg:hidden">
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

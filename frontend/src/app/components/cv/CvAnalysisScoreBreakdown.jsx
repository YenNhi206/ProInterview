import React from "react";
import { BarChart3 } from "lucide-react";

/** Cùng logic badge/thanh tiến độ như CVAnalysis.jsx (kết quả phân tích). */
export function scoreStatusFromValue(score, max = 10) {
  const ratio = score / max;
  if (ratio >= 0.8) return "good";
  if (ratio >= 0.6) return "ok";
  return "warn";
}

function badgeClass(status) {
  if (status === "good") return "bg-[#c7f36b]/20 text-[#c7f36b]";
  if (status === "ok") return "bg-[#8b5cf6]/20 text-[#d8b4fe]";
  return "bg-orange-500/20 text-orange-300";
}

function barColor(status) {
  if (status === "good") return "#84cc16";
  if (status === "ok") return "#a66ff8";
  return "#f97316";
}

/**
 * Khối «Đánh giá chi tiết», vòng Điểm AI + 4 tiêu chí (dùng trên trang kết quả & hub preview).
 */
export function CvAnalysisScoreBreakdown({
  overallScore = 73,
  rows = [],
  compact = false,
  dense = false,
  /** Home showcase, khoảng cách hàng tiêu chí hơi chặt, cỡ chữ giữ như compact */
  homePreview = false,
  /** /cv-analysis hub, cao hơn compact (+0.5rem padding dưới) */
  hubPreview = false,
  /** Trừ kích thước vòng điểm (rem), mặc định 0, không dùng trên Home */
  homePreviewShrinkRem = 0,
  showHeader = true,
  className = "",
}) {
  const shrinkRem = homePreviewShrinkRem > 0 ? homePreviewShrinkRem : 0;
  const ringBase = dense ? 72 : compact ? (hubPreview ? 90 : homePreview ? 93 : 88) : 112;
  const ring = Math.max(64, ringBase - shrinkRem * 16);
  const compactPad =
    shrinkRem > 0 && compact && !hubPreview
      ? `p-[calc(0.75rem-${shrinkRem}rem)] sm:p-[calc(1rem-${shrinkRem}rem)]`
      : compact && hubPreview
        ? "px-3 py-3.5 sm:px-4 sm:py-4.5 lg:px-4 lg:py-[1.375rem]"
        : shrinkRem > 0 && compact
          ? `p-[calc(0.75rem-${shrinkRem}rem)] sm:p-[calc(1rem-${shrinkRem}rem)]`
        : compact && homePreview
          ? "p-[1.05rem] sm:p-[1.3rem]"
          : compact
            ? "p-3 sm:p-4"
            : "";
  const dash = overallScore * 2.51;
  const rowsTight = dense;

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-sm ${className}`}
    >
      {showHeader && (
        <div
          className={`flex items-center gap-2 border-b border-white/10 bg-white/5 ${
            dense ? "px-3 py-1.5" : "px-4 py-2.5 sm:px-5 sm:py-3"
          }`}
        >
          <div
            className={`flex items-center justify-center rounded-lg bg-[#c7f36b]/20 ${
              dense ? "h-6 w-6" : "h-7 w-7 sm:h-8 sm:w-8 sm:rounded-xl"
            }`}
          >
            <BarChart3 className={`text-[#c7f36b] ${dense ? "h-3 w-3" : "h-3.5 w-3.5 sm:h-4 sm:w-4"}`} />
          </div>
          <div>
            <h3 className={`font-semibold text-white ${dense ? "text-[11px]" : "text-xs sm:text-sm"}`}>
              Đánh giá chi tiết
            </h3>
            {!dense && <p className="text-[10px] text-slate-400 sm:text-xs">4 tiêu chí theo chuẩn tuyển dụng</p>}
          </div>
        </div>
      )}

      <div className={dense ? "p-2" : compact ? compactPad || "p-3 sm:p-4" : "p-5 sm:p-6"}>
        <div
          className={`flex flex-wrap items-start ${
            dense
              ? "gap-2"
              : compact
                ? homePreview
                  ? "gap-4"
                  : hubPreview
                    ? "gap-2.5 sm:gap-3"
                    : "gap-3"
                : "gap-6"
          }`}
        >
          <div
            className={`flex shrink-0 flex-col items-center${hubPreview ? " -translate-y-[0.35rem]" : ""}`}
          >
            <div className="relative" style={{ width: ring, height: ring }}>
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="10" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="url(#cv-hub-sg)"
                  strokeWidth="10"
                  strokeDasharray={`${dash} 251`}
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="cv-hub-sg" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#8037f4" />
                    <stop offset="100%" stopColor="#a66ff8" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className="font-bold text-white"
                  style={{
                    fontSize: dense
                      ? shrinkRem
                        ? `calc(1.1rem - ${shrinkRem}rem)`
                        : "1.1rem"
                      : compact
                        ? shrinkRem
                          ? `calc(${hubPreview ? "1.2rem" : "1.25rem"} - ${shrinkRem}rem)`
                          : hubPreview
                            ? "1.2rem"
                            : "1.25rem"
                        : "1.6rem",
                  }}
                >
                  {overallScore}
                </span>
                <span className="text-[11px] text-slate-400 sm:text-xs">/ 100</span>
              </div>
            </div>
            <p
              className={`font-semibold text-white/90 ${
                dense
                  ? "mt-0.5 text-[9px]"
                  : hubPreview
                    ? "mt-0.5 text-[11px] sm:text-xs"
                    : "mt-1 text-xs sm:text-sm"
              }`}
            >
              Điểm AI
            </p>
            {!dense && (
              <p
                className="mt-0.5 text-center text-[11px] leading-snug text-slate-400 sm:text-xs"
              >
                Clarity · Structure
                <br />
                Relevance · Credibility
              </p>
            )}
          </div>

          <div
            className={`min-w-0 flex-1 ${
              homePreview
                ? "min-w-[12.5rem] space-y-1.5 sm:min-w-[14rem]"
                : hubPreview
                  ? "min-w-0 flex-1 space-y-2.5 sm:space-y-3"
                  : dense
                    ? "space-y-1"
                    : "space-y-2 sm:space-y-2.5"
            }`}
          >
            {rows.map((row) => {
              const status = row.status ?? scoreStatusFromValue(row.score, row.max ?? 10);
              const max = row.max ?? 10;
              return (
                <div key={row.criteria}>
                  <div
                    className={`flex items-center justify-between gap-2 ${
                      homePreview ? "mb-0.5" : rowsTight ? "mb-0" : "mb-0.5"
                    }`}
                  >
                    <span
                      className={`min-w-0 font-medium text-white/90 ${
                        rowsTight
                          ? "text-[10px] leading-tight"
                          : hubPreview
                            ? "text-[11px] font-semibold leading-snug sm:text-xs"
                            : "text-xs leading-snug sm:text-sm"
                      }`}
                    >
                      {row.criteria}
                    </span>
                    <span
                      className={`shrink-0 rounded-lg font-bold ${
                        rowsTight
                          ? "px-1 py-0 text-[9px]"
                          : hubPreview
                            ? "rounded-md px-2 py-0.5 text-[10px] sm:text-[11px]"
                            : "px-1.5 py-0.5 text-[11px] sm:px-2 sm:text-xs"
                      } ${badgeClass(status)}`}
                    >
                      {row.score}/{max}
                    </span>
                  </div>
                  <div
                    className={`overflow-hidden rounded-full bg-white/10 ${
                      rowsTight ? "h-1" : hubPreview ? "h-1.5 sm:h-2" : "h-1.5 sm:h-2"
                    }`}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(row.score / max) * 100}%`,
                        background: barColor(status),
                      }}
                    />
                  </div>
                  {row.note ? (
                    <p
                      className={`leading-snug text-slate-400 ${
                        rowsTight
                          ? "mt-0 line-clamp-1 text-[8.5px]"
                          : hubPreview
                            ? "mt-0.5 line-clamp-2 text-[11px] leading-snug sm:text-xs"
                            : "mt-0.5 line-clamp-2 text-xs sm:text-sm"
                      }`}
                    >
                      {row.note}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Dữ liệu minh họa hub, khớp UI trang kết quả */
export const CV_HUB_DEMO_SCORE_ROWS = [
  {
    criteria: "Clarity (Rõ ràng)",
    score: 8,
    max: 10,
    status: "good",
    note: "Rõ ràng, súc tích.",
  },
  {
    criteria: "Structure (STAR)",
    score: 7,
    max: 10,
    status: "ok",
    note: "Cấu trúc ổn, vài bullet thiếu số liệu.",
  },
  {
    criteria: "Relevance (Liên quan JD)",
    score: 6.5,
    max: 10,
    status: "ok",
    note: "Khớp JD một phần, còn thiếu vài kỹ năng.",
  },
  {
    criteria: "Credibility (Thuyết phục)",
    score: 7.5,
    max: 10,
    status: "ok",
    note: "Cần thêm KPI và thành tựu cụ thể.",
  },
];

export const CV_HUB_DEMO_MATCH = {
  percent: 73,
  matched: ["React", "TypeScript", "Node.js", "REST API"],
  missing: ["AWS", "Docker", "Kubernetes"],
  summary: "Khá tốt, bổ sung từ khóa còn thiếu có thể nâng điểm đáng kể.",
};

/** Từ khóa minh họa section Phân tích CV trên Home (khác preview hub). */
export const CV_HOME_DEMO_JD_KEYWORDS = [
  "ci/cd",
  "css",
  "docker",
  "git",
  "html",
  "javascript",
  "postgresql",
];

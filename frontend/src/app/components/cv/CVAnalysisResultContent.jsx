import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Check,
  AlertTriangle as Warning,
  Mic,
  Users,
  Briefcase,
  PlusCircle,
  Wrench,
  Trash2 as Trash,
  BarChart3,
  Lightbulb,
  RotateCcw as History,
  ThumbsUp,
  ThumbsDown,
  ArrowRightLeft,
  Clock,
} from "lucide-react";
import { submitCvFeedback } from "../../api/cvApi.js";
import { CVDocumentPreview } from "./CVDocumentPreview";
import { formatSuggestionDisplayReason } from "../../utils/cv/cvMappers.js";
import {
  CV_FIELD_ANALYSIS_PATH,
  CV_FIELD_HISTORY_PATH,
  CV_JD_ANALYSIS_PATH,
  CV_JD_HISTORY_PATH,
} from "./CvJdAnalysisTabs";

const DEMO_MATCHED = ["React", "TypeScript", "Node.js", "REST API", "Agile", "Git"];
const DEMO_JD_KWS = ["React", "TypeScript", "Node.js", "Docker", "AWS", "CI/CD", "REST API", "PostgreSQL", "Agile", "Git"];
const DEMO_SCORES = [
  { criteria: "Clarity (Rõ ràng)", score: 7, max: 10, status: "good", note: "CV có cấu trúc khá rõ, các mục được trình bày logic." },
  { criteria: "Structure (STAR)", score: 6, max: 10, status: "ok", note: "Phần kinh nghiệm chưa theo format STAR đầy đủ." },
  { criteria: "Relevance (Liên quan JD)", score: 8, max: 10, status: "good", note: "6/10 từ khóa kỹ thuật trong JD có trong CV." },
  { criteria: "Credibility (Thuyết phục)", score: 5, max: 10, status: "warn", note: "Thiếu số liệu KPI cụ thể." },
];
const DEMO_SUGGESTIONS = [
  { type: "fix", priority: "high", title: 'Cải thiện bullet: "Tối ưu hiệu năng React…"', reason: "STAR + KPI", before: "• Tối ưu hiệu năng React", after: "• Phân tích bottleneck…", keywordsAdded: ["lazy loading"], starCheck: { situation: true, action: true, result: true }, confidence: "high" },
];

export function CVAnalysisResultContent({
  routeMode,
  analysisResult,
  historySaveWarning = null,
  cvFile = null,
  jdFile = null,
  cvFileUrl = null,
  jdFileUrl = null,
  cvFileName,
  jdFileName,
  analysisPath,
  historyPath,
  analysisId = null,
}) {
  const navigate = useNavigate();
  const [feedbackState, setFeedbackState] = useState(null); // null | "helpful" | "not_helpful"
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);

  const handleFeedback = async (rating) => {
    setFeedbackState(rating);
    setFeedbackSent(true);
    if (analysisId) await submitCvFeedback(analysisId, rating);
  };
  const R = analysisResult;
  const derivedMode = routeMode === "field" ? "field" : routeMode === "jd" ? "jd" : "cv-only";
  const matchScore = R?.matchScore ?? 72;
  const overallScore = R?.overallScore ?? matchScore;
  const matchedSet = useMemo(() => new Set(R ? R.matchedKeywords : DEMO_MATCHED), [R]);
  const cvDisplayKWs = R ? R.matchedKeywords : DEMO_MATCHED;
  const jdDisplayKWs = R ? [...R.matchedKeywords, ...R.missingKeywords] : DEMO_JD_KWS;
  const relevanceLabel =
    derivedMode === "field" ? "Relevance (Ngành)" : derivedMode === "jd" ? "Relevance (Liên quan JD)" : "Relevance (Vai trò)";
  const scoreTableData = R
    ? [
        { criteria: "Clarity (Rõ ràng)", score: R.scores.clarity, max: 10, status: R.scores.clarity >= 8 ? "good" : R.scores.clarity >= 6 ? "ok" : "warn", note: R.scoreNotes?.clarity ?? "" },
        { criteria: "Structure (STAR)", score: R.scores.structure, max: 10, status: R.scores.structure >= 8 ? "good" : R.scores.structure >= 6 ? "ok" : "warn", note: R.scoreNotes?.structure ?? "" },
        { criteria: relevanceLabel, score: R.scores.relevance, max: 10, status: R.scores.relevance >= 8 ? "good" : R.scores.relevance >= 6 ? "ok" : "warn", note: R.scoreNotes?.relevance ?? "" },
        { criteria: "Credibility (Thuyết phục)", score: R.scores.credibility, max: 10, status: R.scores.credibility >= 8 ? "good" : R.scores.credibility >= 6 ? "ok" : "warn", note: R.scoreNotes?.credibility ?? "" },
      ]
    : DEMO_SCORES;
  const suggestionDisplayMode = derivedMode === "field" ? "field" : "jd";
  const suggestionsData = R?.suggestions ?? DEMO_SUGGESTIONS;
  const strengthsData = R?.strengths ?? ["React & TypeScript, khớp JD", "Node.js + REST API phù hợp"];
  const weaknessesData = R?.weaknesses ?? ["Thiếu Docker, AWS"];
  const highCount = suggestionsData.filter((s) => s.priority === "high").length;
  const mediumCount = suggestionsData.filter((s) => s.priority === "medium").length;
  const lowCount = suggestionsData.filter((s) => s.priority === "low").length;
  const resolvedHistoryPath = historyPath ?? (routeMode === "field" ? CV_FIELD_HISTORY_PATH : CV_JD_HISTORY_PATH);
  const resolvedAnalysisPath = analysisPath ?? (routeMode === "field" ? CV_FIELD_ANALYSIS_PATH : CV_JD_ANALYSIS_PATH);

  return (
            <div className="px-4 py-5 sm:px-6 sm:py-6">

              {historySaveWarning && (
                <div
                  className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200/90 bg-amber-50 px-5 py-4"
                  role="status"
                >
                  <Warning className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-amber-950">Chưa lưu vào lịch sử</p>
                    <p className="mt-1 text-xs leading-relaxed text-amber-900/90">{historySaveWarning}</p>
                  </div>
                </div>
              )}

              {/* Page indicator */}
              <div className="mb-5 flex items-center gap-2">
                <button
                  onClick={() => setActivePage(1)}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${activePage === 1 ? "bg-violet-600 text-white shadow" : "border border-slate-200 bg-white text-slate-500 hover:text-slate-700"}`}
                >
                  1 · Tổng quan
                </button>
                <button
                  onClick={() => { setActivePage(2); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${activePage === 2 ? "bg-violet-600 text-white shadow" : "border border-slate-200 bg-white text-slate-500 hover:text-slate-700"}`}
                >
                  2 · Gợi ý cải thiện
                  {suggestionsData.length > 0 && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${activePage === 2 ? "bg-white/20 text-white" : "bg-violet-100 text-violet-700"}`}>
                      {suggestionsData.length}
                    </span>
                  )}
                </button>
              </div>

              {activePage === 1 && (<>

              {R?.summary && String(R.summary).trim() && (
                <div className="mb-5 rounded-md border border-violet-600 bg-violet-50/70 px-4 py-3.5">
                  <p className="text-sm leading-relaxed text-violet-950">
                    {String(R.summary).replace(/^[✨⭐]\s*/u, "").trim()}
                  </p>
                </div>
              )}

              {/* Match Score Banner */}
              <div id="section-score" className="rounded-2xl p-6 mb-6 text-white" style={{ background: "#8037f4" }}>
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <p className="text-indigo-200 text-sm mb-2">
                      {derivedMode === "jd" ? `Mức độ phù hợp CV${R?.company ? `, ${R.company}` : ""}${R?.position ? ` · ${R.position}` : ""}` : "Điểm chất lượng CV"}
                    </p>
                    <div className="flex items-end gap-3 mb-2">
                      <span style={{ fontSize: "3.5rem", fontWeight: 800, lineHeight: 1 }}>{derivedMode === "jd" ? `${matchScore}%` : matchScore}</span>
                      <div className="mb-1">
                        <span className="text-indigo-200 text-sm">{derivedMode === "jd" ? "keyword match" : "/ 100 điểm"}</span>
                        <div className="flex items-center gap-0.5 mt-1 flex-wrap">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="h-1.5 w-5 rounded-full" style={{ background: i < Math.round(matchScore / 10) ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.22)" }} />
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="text-indigo-100 text-sm">{R?.summary ?? (derivedMode === "jd" ? "Khá tốt Bổ sung từ khóa còn thiếu có thể nâng điểm đáng kể." : "Cải thiện cấu trúc STAR và số liệu để đạt điểm cao hơn.")}</p>
                  </div>
                  <div className="flex flex-col gap-2 text-sm min-w-[160px]">
                    {(derivedMode === "jd" ? [
                      { label: "Từ khóa khớp",      val: `${(R?.matchedKeywords ?? DEMO_MATCHED).length}/${R?.totalKeywords ?? DEMO_JD_KWS.length}`, color: "bg-white/20" },
                      { label: "Từ khóa thiếu",     val: `${(R?.missingKeywords ?? DEMO_JD_KWS.filter(k => !DEMO_MATCHED.includes(k))).length} kỹ năng`, color: "bg-red-400/30" },
                      { label: "Điểm AI tổng hợp",  val: `${overallScore}/100`, color: "bg-violet-400/20" },
                    ] : [
                      { label: "Điểm cấu trúc",     val: `${R?.scores.structure ?? 6}/10`, color: "bg-white/20" },
                      { label: "Độ hoàn thiện",      val: `${matchScore}%`, color: "bg-emerald-400/30" },
                      { label: "Gợi ý cải thiện",    val: `${suggestionsData.length} mục`, color: "bg-amber-400/20" },
                    ]).map(s => (
                      <div key={s.label} className={`flex items-center justify-between gap-4 px-4 py-2 rounded-xl ${s.color}`}>
                        <span className="text-white/70">{s.label}</span>
                        <span className="text-white font-semibold">{s.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* CV Doc preview */}
              {derivedMode === "jd" && (
                <div className="relative mb-6">
                  <CVDocumentPreview
                    cvFile={cvFile}
                    jdFile={jdFile}
                    cvFileUrl={cvFileUrl}
                    jdFileUrl={jdFileUrl}
                    cvFileName={cvFile?.name ?? cvFileName}
                    jdFileName={jdFile?.name ?? jdFileName}
                    matchedKws={R?.matchedKeywords ?? []}
                    missingKws={R?.missingKeywords  ?? []}
                  />
                </div>
              )}

              {/* Keywords gap analysis */}
              <div id="section-keywords" />
              {derivedMode === "jd" && (() => {
                const missingKws = jdDisplayKWs.filter(k => !matchedSet.has(k));
                const matchPct = jdDisplayKWs.length > 0 ? Math.round((cvDisplayKWs.length / jdDisplayKWs.length) * 100) : 0;
                const missTimeMap = {};
                for (const entry of R?.missingKwsWithTime ?? []) {
                  if (entry.time) missTimeMap[entry.kw.toLowerCase()] = entry.time;
                }
                return (
                  <div className="relative mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    {/* Header */}
                    <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100">
                          <Briefcase className="h-4 w-4 text-[#8037f4]" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">Phân tích từ khóa JD</h3>
                          <p className="text-xs text-slate-500">{cvDisplayKWs.length}/{jdDisplayKWs.length} từ khóa đã có trong CV</p>
                        </div>
                      </div>
                      {/* Match meter */}
                      <div className="flex items-center gap-3 sm:min-w-[200px]">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${matchPct}%`,
                              background: matchPct >= 70 ? "#22c55e" : matchPct >= 45 ? "#f97316" : "#ef4444",
                            }}
                          />
                        </div>
                        <span className={`shrink-0 text-sm font-black tabular-nums ${matchPct >= 70 ? "text-emerald-700" : matchPct >= 45 ? "text-orange-600" : "text-red-600"}`}>
                          {matchPct}%
                        </span>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {/* Missing keywords — actionable, shown first */}
                      {missingKws.length > 0 && (
                        <div className="p-5">
                          <div className="mb-3 flex items-center gap-2">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-orange-100">
                              <Warning className="h-3.5 w-3.5 text-orange-600" />
                            </div>
                            <p className="text-xs font-bold uppercase tracking-wide text-orange-800">
                              Còn thiếu — bổ sung để tăng điểm
                            </p>
                            <span className="ml-auto rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-black text-orange-800">
                              {missingKws.length} từ khóa
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {missingKws.map(kw => {
                              const time = missTimeMap[kw.toLowerCase()];
                              return (
                                <span
                                  key={kw}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-900"
                                >
                                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                                  {kw}
                                  {time && (
                                    <span className="ml-0.5 rounded-full bg-orange-200 px-1.5 py-0.5 text-[10px] font-bold text-orange-800">
                                      ⏱ {time}
                                    </span>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Matched keywords */}
                      <div className="p-5">
                        <div className="mb-3 flex items-center gap-2">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-100">
                            <Check className="h-3.5 w-3.5 text-emerald-700" />
                          </div>
                          <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
                            Đã có trong CV
                          </p>
                          <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                            {cvDisplayKWs.length} từ khóa
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {cvDisplayKWs.map(kw => (
                            <span
                              key={kw}
                              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900"
                            >
                              <Check className="h-3 w-3 shrink-0 text-emerald-600" />
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* CTA nổi bật sang trang 2 */}
              <p className="mb-3 text-sm text-slate-500">
                Muốn biết cần chỉnh CV ở đâu để tăng cơ hội trúng tuyển?
              </p>
              <button
                onClick={() => { setActivePage(2); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="mb-2 flex w-full items-center justify-between rounded-2xl px-6 py-5 text-left transition hover:opacity-90"
                style={{ background: "linear-gradient(135deg,#8037f4,#a66ff8)" }}
              >
                <div>
                  <p className="text-base font-bold text-white">Xem gợi ý cải thiện CV</p>
                  <p className="mt-0.5 text-sm text-violet-200">
                    {suggestionsData.length > 0
                      ? `${suggestionsData.length} gợi ý cụ thể — điểm chi tiết, điểm mạnh/yếu, hướng dẫn sửa bullet`
                      : "Đánh giá chi tiết, điểm mạnh và điểm cần cải thiện"}
                  </p>
                </div>
                <span className="ml-4 shrink-0 rounded-xl bg-white/20 px-4 py-2 text-sm font-bold text-white">
                  Xem →
                </span>
              </button>

              </>)}

              {activePage === 2 && (<>

              {/* Detailed scoring, nền card-premium sáng: chữ slate, không dùng text-white */}
              <div id="section-scoring" className="relative mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2.5 border-b border-slate-200 bg-violet-50/80 px-6 py-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-100">
                    <BarChart3 className="h-4 w-4 text-[#8037f4]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Đánh giá chi tiết</h3>
                    <p className="text-xs text-slate-600">4 tiêu chí theo chuẩn tuyển dụng</p>
                  </div>
                </div>
                <div className="p-6">
                  <div className="mb-6 flex flex-wrap items-start gap-6">
                    <div className="flex flex-shrink-0 flex-col items-center">
                      <div className="relative h-28 w-28">
                        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                          <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="10" />
                          <circle cx="50" cy="50" r="40" fill="none" stroke="url(#sg)" strokeWidth="10" strokeDasharray={`${overallScore * 2.51} 251`} strokeLinecap="round" />
                          <defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#8037f4" /><stop offset="100%" stopColor="#a66ff8" /></linearGradient></defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-[1.6rem] font-bold text-slate-900">{overallScore}</span>
                          <span className="text-xs text-slate-500">/ 100</span>
                        </div>
                      </div>
                      <p className="mt-1 text-xs font-medium text-slate-700">Điểm AI</p>
                      <p className="mt-0.5 text-center text-[0.65rem] leading-tight text-slate-500">
                        Clarity · Structure<br />Relevance · Credibility
                      </p>
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      {scoreTableData.map(row => (
                        <div key={row.criteria}>
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-slate-800">{row.criteria}</span>
                            <span
                              className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${
                                row.status === "good"
                                  ? "bg-lime-100 text-lime-900"
                                  : row.status === "ok"
                                    ? "bg-violet-100 text-violet-900"
                                    : "bg-orange-100 text-orange-900"
                              }`}
                            >
                              {row.score}/{row.max}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${(row.score / row.max) * 100}%`,
                                background: row.status === "good" ? "#84cc16" : row.status === "ok" ? "#a66ff8" : "#f97316",
                              }}
                            />
                          </div>
                          {row.note && <p className="mt-0.5 text-[0.72rem] leading-snug text-slate-600">{row.note}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-md border border-lime-200 bg-lime-50 p-4">
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-lime-900">
                        <Check className="h-4 w-4" /> Điểm mạnh
                      </h4>
                      <ul className="space-y-2">
                        {strengthsData.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-800">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-lime-600" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-md border border-orange-200 bg-orange-50 p-4">
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-orange-900">
                        <Warning className="h-4 w-4" /> Cơ hội phát triển
                      </h4>
                      {R?.missingDetails?.length > 0 ? (
                        <ul className="space-y-2">
                          {R.missingDetails.map((d, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-800">
                              {d.importance === "critical"
                                ? <span className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-700">Ưu tiên</span>
                                : <span className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-500">Nên có</span>
                              }
                              <span>{d.requirement}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <ul className="space-y-2">
                          {weaknessesData.map((s, i) => {
                            const isCritical = s.startsWith("[Bắt buộc]");
                            const text = s.replace(/^\[Bắt buộc\]\s*/, "").replace(/^Thiếu\s*"?/, "").replace(/"$/, "");
                            return (
                              <li key={i} className="flex items-start gap-2 text-sm text-slate-800">
                                {isCritical
                                  ? <span className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-700">Ưu tiên</span>
                                  : <span className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-500">Nên có</span>
                                }
                                <span>{text}</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Transferable Skills */}
              {R?.transferableSkills?.length > 0 && (
                <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50/60 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2.5 border-b border-blue-200 bg-blue-100/60 px-6 py-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-200">
                      <ArrowRightLeft className="h-4 w-4 text-blue-700" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Kỹ năng có thể chuyển đổi nhanh</h3>
                      <p className="text-xs text-slate-600">Bạn chưa có nhưng đã có nền tảng — không cần học từ đầu</p>
                    </div>
                    <span className="ml-auto rounded-full bg-blue-200 px-2.5 py-1 text-xs font-bold text-blue-800">
                      {R.transferableSkills.length} kỹ năng
                    </span>
                  </div>
                  <div className="divide-y divide-blue-100">
                    {R.transferableSkills.map((t, i) => (
                      <div key={i} className="flex flex-col gap-1.5 px-6 py-4 sm:flex-row sm:items-start sm:gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{t.requirement}</p>
                          <p className="mt-0.5 text-xs text-slate-600">
                            Nền tảng có sẵn: <span className="font-medium text-blue-700">{t.existingSkill}</span>
                          </p>
                        </div>
                        {t.estimatedTime && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-blue-300 bg-white px-3 py-1 text-xs font-semibold text-blue-700">
                            <Clock className="h-3 w-3" />
                            {t.estimatedTime}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions, theme sáng, tương phản rõ */}
              <div id="section-suggestions" className="relative mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-violet-50/80 px-6 py-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-100">
                      <Lightbulb className="h-4 w-4 text-[#8037f4]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Gợi ý chỉnh sửa cụ thể</h3>
                      <p className="text-xs text-slate-600">
                        {derivedMode === "field"
                          ? "Bullet STAR · Kỹ năng ngành cần bổ sung"
                          : "Bullet STAR + từ khóa JD · Kỹ năng cần bổ sung"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {highCount > 0 && (
                      <span className="rounded-md border border-violet-600 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-950">
                        {highCount} Cao
                      </span>
                    )}
                    {mediumCount > 0 && (
                      <span className="rounded-md border border-violet-500 bg-violet-50/80 px-2.5 py-1 text-xs font-semibold text-violet-900">
                        {mediumCount} TB
                      </span>
                    )}
                    {lowCount > 0 && (
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {lowCount} Thấp
                      </span>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {suggestionsData.map((item, i) => {
                    const COLLAPSE_LIMIT = 3;
                    if (!showAllSuggestions && i >= COLLAPSE_LIMIT) return null;
                    const isAdd = item.type === "add";
                    const borderColor = item.priority === "high" ? "border-l-orange-400" : item.priority === "medium" ? "border-l-violet-400" : "border-l-slate-300";
                    return (
                      <div
                        key={i}
                        className={`border-l-4 px-5 py-4 transition-colors hover:bg-slate-50/60 ${borderColor}`}
                      >
                        {isAdd ? (
                          /* ── Bổ sung kỹ năng ── */
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-md bg-lime-100 px-2 py-0.5 text-[11px] font-bold text-lime-800">
                                <PlusCircle className="h-3 w-3" /> Bổ sung
                              </span>
                              <p className="text-sm font-semibold text-slate-900">
                                {item.title.replace(/^Bổ sung kỹ năng\s*"?/, "").replace(/"$/, "")}
                              </p>
                            </div>
                            <p className="text-[0.82rem] leading-relaxed text-slate-600">
                              {formatSuggestionDisplayReason(item, { mode: suggestionDisplayMode })}
                            </p>
                            {item.after && (
                              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Cách bổ sung</p>
                                <p className="text-[0.82rem] leading-relaxed text-slate-700">{item.after}</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* ── Chỉnh sửa bullet ── */
                          <div className="flex flex-col gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-800">
                                <Wrench className="h-3 w-3" /> Sửa bullet
                              </span>
                              <p className="text-[0.82rem] text-slate-500">
                                {formatSuggestionDisplayReason(item, { mode: suggestionDisplayMode })}
                              </p>
                            </div>
                            {item.before && (
                              <div className="rounded-md border-l-2 border-slate-300 bg-slate-50 px-3 py-2">
                                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Hiện tại</p>
                                <p className="text-[0.82rem] leading-relaxed text-slate-700">{item.before}</p>
                              </div>
                            )}
                            {item.after && (
                              <div className="rounded-md border-l-2 border-lime-400 bg-lime-50 px-3 py-2">
                                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-lime-700">Gợi ý sửa thành</p>
                                <p className="text-[0.82rem] leading-relaxed text-slate-800">{item.after}</p>
                              </div>
                            )}
                            {item.keywordsAdded?.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] font-semibold text-slate-400">Từ khóa thêm vào:</span>
                                {item.keywordsAdded.map((kw, ki) => (
                                  <span key={ki} className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
                                    {kw}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {suggestionsData.length > 3 && (
                  <button
                    onClick={() => setShowAllSuggestions(v => !v)}
                    className="flex w-full items-center justify-center gap-2 border-t border-slate-100 py-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                  >
                    {showAllSuggestions
                      ? "Thu gọn"
                      : `Xem thêm ${suggestionsData.length - 3} gợi ý`}
                  </button>
                )}
              </div>

              {/* Feedback */}
              <div className="mb-4 flex items-center justify-center gap-3 rounded-xl border border-slate-100 bg-slate-50 py-3">
                {feedbackSent ? (
                  <p className="text-sm font-semibold text-violet-700">
                    {feedbackState === "helpful" ? "Cảm ơn bạn!" : "Cảm ơn, chúng tôi sẽ cải thiện."}
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-slate-500">Phân tích này có hữu ích không?</p>
                    <button type="button" onClick={() => handleFeedback("helpful")} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700">
                      <ThumbsUp className="h-3.5 w-3.5" /> Hữu ích
                    </button>
                    <button type="button" onClick={() => handleFeedback("not_helpful")} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 hover:border-slate-300 hover:text-slate-700">
                      <ThumbsDown className="h-3.5 w-3.5" /> Chưa tốt
                    </button>
                  </>
                )}
              </div>

              {/* CTAs */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <button type="button" onClick={() => navigate("/interview")}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#a3e635] px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-[#84cc16]">
                  <Mic className="h-4 w-4 shrink-0" /> Phỏng vấn AI
                </button>
                <button type="button" onClick={() => navigate("/mentors")}
                  className="flex items-center justify-center gap-2 rounded-xl border border-emerald-400 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100">
                  <Users className="h-4 w-4 shrink-0" /> Đặt lịch Mentor
                </button>
                <button type="button" onClick={() => navigate(resolvedAnalysisPath)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  Phân tích mới
                </button>
                <button type="button" onClick={() => navigate(resolvedHistoryPath)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  <History className="h-4 w-4 shrink-0" /> Lịch sử
                </button>
              </div>


              </>)}

            </div>
  );
}

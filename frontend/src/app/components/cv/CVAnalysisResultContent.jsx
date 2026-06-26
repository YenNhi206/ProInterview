import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  FileText,
  Check,
  Zap,
  AlertTriangle as Warning,
  Mic,
  Users,
  Briefcase,
  Lock,
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
  lockResultForFreePlan = false,
  analysisPath,
  historyPath,
  analysisId = null,
}) {
  const navigate = useNavigate();
  const [feedbackState, setFeedbackState] = useState(null); // null | "helpful" | "not_helpful"
  const [feedbackSent, setFeedbackSent] = useState(false);

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

              {/* Free-tier notice */}
              {lockResultForFreePlan && (
                <div className="flex items-center gap-4 rounded-2xl px-5 py-4 mb-6" style={{ background: "linear-gradient(135deg,rgba(128, 55, 244,0.08),rgba(139, 77, 255,0.05))", border: "1.5px solid rgba(128, 55, 244,0.2)" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(128, 55, 244,0.15)" }}><Lock className="w-5 h-5 text-[#8037f4]" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">Đang xem bản xem trước, Gói Free</p>
                    <p className="mt-0.5 text-xs text-slate-600">Phần đánh giá chi tiết & gợi ý bị ẩn. Nâng cấp để xem đầy đủ.</p>
                  </div>
                  <button onClick={() => navigate("/pricing")} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white flex-shrink-0" style={{ background: "#8037f4" }}>
                    <Zap className="w-3.5 h-3.5" /> Mở khoá
                  </button>
                </div>
              )}

              {R?.summary && String(R.summary).trim() && (
                <div className="mb-5 rounded-md border border-violet-600 bg-violet-50/70 px-4 py-3.5">
                  <p className="text-sm leading-relaxed text-violet-950">
                    {String(R.summary).replace(/^[✨⭐]\s*/u, "").trim()}
                  </p>
                </div>
              )}

              {/* Match Score Banner */}
              <div className="rounded-2xl p-6 mb-6 text-white" style={{ background: "#8037f4" }}>
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
                  {lockResultForFreePlan && (
                    <div className="absolute bottom-0 left-0 right-0 flex h-2/3 flex-col items-center justify-end rounded-b-2xl pb-8" style={{ background: "linear-gradient(to bottom,transparent 0%,rgba(10,6,24,0.55) 45%,rgba(7,6,14,0.92) 100%)" }}>
                      <div className="px-6 text-center">
                        <Lock className="mx-auto mb-2 h-8 w-8 text-violet-300" />
                        <p className="mb-3 text-sm font-semibold text-white">Chi tiết bị ẩn</p>
                        <button onClick={() => navigate("/pricing")} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#8037f4" }}>
                          <Zap className="w-3.5 h-3.5" /> Xem đầy đủ
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Keywords, nền sáng trong card trắng: dùng slate + emerald/orange đậm */}
              {derivedMode === "jd" && (
                <div className="mb-6 grid gap-6 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#8037f4]" />
                      <h3 className="text-sm font-semibold text-slate-900">Từ khóa khớp với JD</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {cvDisplayKWs.map(kw => (
                        <span
                          key={kw}
                          className="rounded-full border border-emerald-500 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900"
                        >
                          {kw} ✓
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-slate-600">
                      <span className="font-semibold text-emerald-800">{cvDisplayKWs.length}</span> từ khóa khớp
                    </p>
                  </div>
                  <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-[#8037f4]" />
                      <h3 className="text-sm font-semibold text-slate-900">Toàn bộ từ khóa JD</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {jdDisplayKWs.map(kw => (
                        <span
                          key={kw}
                          className={
                            matchedSet.has(kw)
                              ? "rounded-full border border-emerald-500 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900"
                              : "rounded-full border border-orange-500 bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-950"
                          }
                        >
                          {kw} {!matchedSet.has(kw) && "⚠"}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-slate-600">
                      <span className="font-semibold text-orange-800">{jdDisplayKWs.filter(k => !matchedSet.has(k)).length}</span> từ khóa chưa có trong CV
                    </p>
                    {lockResultForFreePlan && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-2xl" style={{ background: "rgba(7,6,14,0.78)", backdropFilter: "blur(8px)" }}>
                        <div className="px-4 text-center"><Lock className="mx-auto mb-2 h-7 w-7 text-violet-300" /><p className="mb-2 text-xs font-semibold text-white">Từ khóa JD bị ẩn</p><button type="button" onClick={() => navigate("/pricing")} className="rounded-lg px-4 py-1.5 text-xs font-bold text-white" style={{ background: "#8037f4" }}>Mở khoá</button></div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Detailed scoring, nền card-premium sáng: chữ slate, không dùng text-white */}
              <div className="relative mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2.5 border-b border-slate-200 bg-violet-50/80 px-6 py-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-100">
                    <BarChart3 className="h-4 w-4 text-[#8037f4]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Đánh giá chi tiết</h3>
                    <p className="text-xs text-slate-600">4 tiêu chí theo chuẩn tuyển dụng</p>
                  </div>
                  {lockResultForFreePlan && (
                    <div className="ml-auto flex items-center gap-1.5 rounded-md bg-violet-100 px-3 py-1.5">
                      <Lock className="h-3.5 w-3.5 text-[#8037f4]" />
                      <span className="text-xs font-semibold text-[#8037f4]">Khoá</span>
                    </div>
                  )}
                </div>
                <div className="p-6" style={lockResultForFreePlan ? { filter: "blur(5px)", userSelect: "none", pointerEvents: "none" } : {}}>
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
                        <Warning className="h-4 w-4" /> Cần cải thiện
                      </h4>
                      {R?.missingDetails?.length > 0 ? (
                        <div className="space-y-3">
                          {/* Market standard skills */}
                          {R.missingDetails.filter(d => d.skillType === "market_standard").length > 0 && (
                            <div>
                              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-red-700">Kỹ năng chuẩn ngành — hầu hết cty yêu cầu</p>
                              <ul className="space-y-1.5">
                                {R.missingDetails.filter(d => d.skillType === "market_standard").map((d, i) => (
                                  <li key={i} className="flex items-center gap-2 text-sm text-slate-800">
                                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${d.importance === "critical" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                                      {d.importance === "critical" ? "Bắt buộc" : "Quan trọng"}
                                    </span>
                                    {d.requirement}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {/* Company specific skills */}
                          {R.missingDetails.filter(d => d.skillType === "company_specific").length > 0 && (
                            <div>
                              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700">Yêu cầu riêng công ty này</p>
                              <ul className="space-y-1.5">
                                {R.missingDetails.filter(d => d.skillType === "company_specific").map((d, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                                    {d.requirement}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {weaknessesData.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-800">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
                {lockResultForFreePlan && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
                    <div className="rounded-2xl border border-violet-200 bg-white px-8 py-6 text-center shadow-xl">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100">
                        <Lock className="h-6 w-6 text-[#8037f4]" />
                      </div>
                      <p className="mb-1 font-bold text-slate-900">Đánh giá chi tiết bị khoá</p>
                      <p className="mb-4 max-w-[240px] text-xs text-slate-600">
                        Nâng cấp <strong className="text-[#8037f4]">Elite Pro</strong> để xem điểm số và nhận xét chi tiết.
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate("/pricing")}
                        className="mx-auto flex items-center gap-2 rounded-xl bg-[#8037f4] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#5C28D9]"
                      >
                        <Zap className="h-4 w-4" /> Nâng cấp
                      </button>
                    </div>
                  </div>
                )}
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
              <div className="relative mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
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
                <div className="divide-y divide-slate-200">
                  {suggestionsData.map((item, i) => {
                    if (lockResultForFreePlan && i > 1) return null;
                    const isAdd = item.type === "add";
                    const isFix = item.type === "fix";
                    const priorityClass =
                      item.priority === "high"
                        ? "border-violet-600 bg-violet-50 text-violet-950"
                        : item.priority === "medium"
                          ? "border-violet-500 bg-violet-50/80 text-violet-900"
                          : "border-slate-300 bg-slate-50 text-slate-700";
                    const typeClass = isAdd
                      ? "border border-lime-400 bg-lime-50 text-lime-950"
                      : isFix
                        ? "border border-violet-600 bg-violet-50 text-violet-950"
                        : "border border-violet-500 bg-violet-50/80 text-violet-900";
                    const typeLabel = isAdd ? "Bổ sung" : isFix ? "Chỉnh sửa" : "Loại bỏ";
                    const isDimmed = lockResultForFreePlan && i === 1;
                    return (
                      <div
                        key={i}
                        className="p-5 transition-colors hover:bg-slate-50/80"
                        style={isDimmed ? { filter: "blur(4px)", userSelect: "none", pointerEvents: "none", opacity: 0.5 } : {}}
                      >
                        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold ${typeClass}`}>
                              {isAdd && <PlusCircle className="h-3 w-3" />}
                              {isFix && <Wrench className="h-3 w-3" />}
                              {!isAdd && !isFix && <Trash className="h-3 w-3" />}
                              {typeLabel}
                            </span>
                            <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
                          </div>
                          <span className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold ${priorityClass}`}>
                            {item.priority === "high" ? "Ưu tiên cao" : item.priority === "medium" ? "Trung bình" : "Thấp"}
                          </span>
                        </div>
                        <div className="mb-3 rounded-md border border-violet-600 bg-violet-50/70 p-3.5">
                          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#8037f4]">
                            <Lightbulb className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            Lý do
                          </p>
                          <p className="text-[0.82rem] leading-relaxed text-slate-700">
                            {formatSuggestionDisplayReason(item, { mode: suggestionDisplayMode })}
                          </p>
                        </div>
                        {(item.before || item.after) && (
                          <div className="mb-3 grid gap-2 md:grid-cols-2">
                            {item.before && (
                              <div className="rounded-md border border-violet-500 bg-violet-50/50 p-3">
                                <p className="mb-1.5 text-xs font-semibold text-violet-900">
                                  {isAdd ? "Trong CV hiện tại" : "Hiện tại"}
                                </p>
                                {isAdd ? (
                                  <p className="text-sm leading-relaxed text-slate-800">{item.before}</p>
                                ) : (
                                  <code className="block whitespace-pre-wrap font-mono text-[0.76rem] leading-relaxed text-slate-800">
                                    {item.before}
                                  </code>
                                )}
                              </div>
                            )}
                            {item.after && (
                              <div className="rounded-md border border-lime-200 bg-lime-50 p-3">
                                <p className="mb-1.5 text-xs font-semibold text-lime-900">
                                  {isAdd ? "Gợi ý bổ sung" : "Nên sửa thành"}
                                </p>
                                {isAdd ? (
                                  <p className="text-sm leading-relaxed text-slate-800">{item.after}</p>
                                ) : (
                                  <code className="block whitespace-pre-wrap font-mono text-[0.76rem] leading-relaxed text-slate-800">
                                    {item.after}
                                  </code>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {isFix && (item.keywordsAdded?.length > 0 || item.starCheck || item.confidence) && (
                          <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-2">
                            {item.starCheck && Object.keys(item.starCheck).length > 0 && (
                              <div className="flex items-center gap-1.5">
                                <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">STAR:</span>
                                {[["situation", "S"], ["action", "A"], ["result", "R"]].map(([k, label]) => (
                                  <span
                                    key={k}
                                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                                      item.starCheck[k]
                                        ? "border border-lime-400 bg-lime-100 text-lime-900"
                                        : "border border-slate-200 bg-slate-100 text-slate-400"
                                    }`}
                                    title={item.starCheck[k] ? `${k} ✓` : `${k} thiếu`}
                                  >
                                    {label}
                                  </span>
                                ))}
                              </div>
                            )}
                            {item.keywordsAdded?.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Keywords:</span>
                                {item.keywordsAdded.map((kw, ki) => (
                                  <span
                                    key={ki}
                                    className="inline-flex items-center gap-0.5 rounded-md border border-violet-200 bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-900"
                                  >
                                    + {kw}
                                  </span>
                                ))}
                              </div>
                            )}
                            {item.confidence && (
                              <span
                                className={`ml-auto rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                                  item.confidence === "high"
                                    ? "bg-lime-100 text-lime-900"
                                    : item.confidence === "medium"
                                      ? "bg-amber-100 text-amber-900"
                                      : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                Độ tin cậy:{" "}
                                {item.confidence === "high" ? "Cao" : item.confidence === "medium" ? "Trung bình" : "Thấp"}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {lockResultForFreePlan && (
                  <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 bg-violet-50/50 px-6 py-5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900">🔒 Còn {suggestionsData.length - 1} gợi ý đang bị ẩn</p>
                      <p className="mt-0.5 text-xs text-slate-600">Bao gồm gợi ý về từ khóa thiếu, số liệu KPI, format STAR</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate("/pricing")}
                      className="flex shrink-0 items-center gap-2 rounded-xl bg-[#8037f4] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#5C28D9]"
                    >
                      <Zap className="h-4 w-4" /> Mở khoá toàn bộ
                    </button>
                  </div>
                )}
              </div>

              {/* CTAs, nền sáng trong card trắng: chữ tối + viền rõ */}
              <div className="flex gap-3 flex-wrap pt-1">
                {/* Feedback widget */}
                <div className="flex w-full flex-col items-center gap-2 rounded-2xl border border-violet-100 bg-violet-50/60 px-5 py-4">
                  {feedbackSent ? (
                    <p className="text-sm font-semibold text-violet-700">
                      {feedbackState === "helpful" ? "Cảm ơn bạn! 🎉" : "Cảm ơn, chúng tôi sẽ cải thiện."}
                    </p>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-slate-500">Kết quả phân tích này có hữu ích không?</p>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => handleFeedback("helpful")}
                          className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                        >
                          <ThumbsUp className="h-4 w-4" /> Hữu ích
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFeedback("not_helpful")}
                          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-50"
                        >
                          <ThumbsDown className="h-4 w-4" /> Chưa tốt
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => navigate("/interview")}
                  className="flex items-center gap-2 rounded-xl bg-[#8037f4] px-6 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#5C28D9]"
                >
                  <Mic className="h-4 w-4 shrink-0" aria-hidden />
                  Phỏng vấn với AI
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/mentors")}
                  className="flex items-center gap-2 rounded-xl border-2 border-emerald-600 bg-emerald-50 px-6 py-3 text-sm font-semibold text-emerald-950 shadow-sm transition-colors hover:bg-emerald-100"
                >
                  <Users className="h-4 w-4 shrink-0 text-emerald-800" aria-hidden />
                  Đặt lịch Mentor
                </button>
                <button
                  type="button"
                  onClick={() => navigate(resolvedAnalysisPath)}
                  className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50"
                >
                  Phân tích mới
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate(resolvedHistoryPath)
                  }
                  className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50"
                >
                  <History className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
                  Xem lịch sử
                </button>
              </div>
            </div>
  );
}

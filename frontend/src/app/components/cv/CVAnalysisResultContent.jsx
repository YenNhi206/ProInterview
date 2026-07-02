import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Zap,
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
  Trophy,
  Compass,
  LifeBuoy,
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
  const [showAllStrengths, setShowAllStrengths] = useState(false);
  const [showAllWeaknesses, setShowAllWeaknesses] = useState(false);
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
  const strengthsData = R?.strengths ?? [];
  const weaknessesData = R?.weaknesses ?? [];
  const resolvedHistoryPath = historyPath ?? (routeMode === "field" ? CV_FIELD_HISTORY_PATH : CV_JD_HISTORY_PATH);
  const resolvedAnalysisPath = analysisPath ?? (routeMode === "field" ? CV_FIELD_ANALYSIS_PATH : CV_JD_ANALYSIS_PATH);
  
  const missingKws = jdDisplayKWs.filter(k => !matchedSet.has(k));

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 flex flex-col gap-6">
      {historySaveWarning && (
        <div
          className="flex items-start gap-3 rounded-sm border border-amber-200/90 bg-amber-50 px-5 py-4"
          role="status"
        >
          <Warning className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-950">Chưa lưu vào lịch sử</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-900/90">{historySaveWarning}</p>
          </div>
        </div>
      )}

      {/* 2. Status Block (Moved to Top) */}
      <div className="flex flex-col sm:flex-row items-center gap-4 rounded-full border border-slate-200/60 bg-[#faf9ff] p-2 pr-6">
         <div className="flex shrink-0 items-center justify-center rounded-full bg-white px-6 py-3 border border-slate-100 shadow-sm">
            <span className="text-[11px] font-black tracking-widest text-[#3e2b66] uppercase">{matchScore >= 80 ? "ĐẠT YÊU CẦU TỐT" : matchScore >= 50 ? "CẦN CẢI THIỆN THÊM" : "KHÔNG PHÙ HỢP"}</span>
         </div>
         <p className="text-sm font-medium text-[#4a3b70] text-center sm:text-left">
            {matchScore >= 80 ? "CV của bạn rất ấn tượng và bám sát yêu cầu. Chỉ cần vài chỉnh sửa nhỏ để hồ sơ trở nên hoàn hảo." : matchScore >= 50 ? "CV ở mức khá. Hãy xem kỹ các gợi ý bên dưới để bổ sung từ khóa và cấu trúc lại cách viết kinh nghiệm." : "CV hiện tại có vẻ chưa thực sự phù hợp với yêu cầu của JD này. Bạn có thể cân nhắc bổ sung thêm nhiều kinh nghiệm, hoặc thử sức ở một vị trí khác phù hợp hơn với năng lực."}
         </p>
      </div>

      {/* 1. Header Block */}
      <div className="flex flex-col sm:flex-row items-center gap-8 rounded-sm border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
         {/* Circular Gauge */}
         <div className="flex flex-col items-center flex-shrink-0">
            <div className="relative w-36 h-36">
               <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Background Circle */}
                  <path d="M 50,50 m -45,0 a 45,45 0 1,1 90,0 a 45,45 0 1,1 -90,0" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                  {/* Progress Circle */}
                  <path d="M 50,50 m -45,0 a 45,45 0 1,1 90,0 a 45,45 0 1,1 -90,0" fill="none" stroke="#8037f4" strokeWidth="8" strokeDasharray={`${matchScore * 2.827} 282.7`} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
               </svg>
               <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black text-slate-900 leading-none tracking-tight">{matchScore}</span>
                  <span className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-widest">/100</span>
               </div>
            </div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-5">
               ĐỘ KHỚP TỔNG THỂ
            </p>
         </div>

         {/* Summary text */}
         <div className="flex-1 text-center sm:text-left border-t sm:border-t-0 sm:border-l border-slate-100 pt-6 sm:pt-0 sm:pl-8">
            <p className="text-sm leading-relaxed text-slate-600">
               {R?.summary ? String(R.summary).replace(/^[✨⭐]\s*/u, "").trim() : (
                 derivedMode === "jd" 
                   ? `CV của bạn đã khớp ${cvDisplayKWs.length}/${jdDisplayKWs.length} từ khóa quan trọng trong mô tả công việc. Cần tập trung cải thiện cách mô tả kinh nghiệm và bổ sung các từ khóa cốt lõi để gia tăng mức độ phù hợp với vị trí ứng tuyển.`
                   : "CV của bạn đã có cấu trúc cơ bản, tuy nhiên cần cải thiện thêm về cách viết bullet point theo chuẩn STAR và bổ sung số liệu cụ thể để tạo sự thuyết phục."
               )}
            </p>
         </div>
      </div>

      {/* CV Doc Preview for JD mode */}
      {derivedMode === "jd" && (
        <div className="relative rounded-sm overflow-hidden border border-slate-200">
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



      {/* 3. Missing Keywords */}
      {derivedMode === "jd" && (
        <div className="rounded-sm border border-slate-200 bg-white overflow-hidden shadow-sm">
           <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-3.5 flex items-center gap-2">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">TỪ KHÓA THIẾU TRONG CV</h3>
           </div>
           <div className="p-5">
              {missingKws.length === 0 ? (
                <p className="text-sm text-slate-500 font-medium">Không có</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {missingKws.map((kw, i) => (
                    <span key={i} className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                      {kw}
                    </span>
                  ))}
                </div>
              )}
           </div>
        </div>
      )}

      {/* 4. Strengths (Matched Keywords) */}
      <div className="rounded-sm border border-emerald-100 bg-white overflow-hidden shadow-sm">
         <div className="border-b border-emerald-50 bg-emerald-50/30 px-5 py-3.5 flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-emerald-800">ĐIỂM MẠNH ĐÃ THỂ HIỆN</h3>
         </div>
         <div className="p-5">
            {cvDisplayKWs.length === 0 && strengthsData.length === 0 ? (
              <p className="text-sm text-slate-500 font-medium">Không có</p>
            ) : strengthsData.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {strengthsData.slice(0, showAllStrengths ? undefined : 5).map((s, i) => (
                  <div key={`s-${i}`} className="flex items-start gap-2.5 text-sm text-slate-700 bg-emerald-50/50 p-3 rounded-md border border-emerald-100/50">
                    <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span className="leading-relaxed">{s}</span>
                  </div>
                ))}
                {strengthsData.length > 5 && (
                  <button 
                    onClick={() => setShowAllStrengths(!showAllStrengths)}
                    className="self-start mt-1 text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition flex items-center gap-1"
                  >
                    {showAllStrengths ? (
                      <>Thu gọn <ChevronUp className="w-4 h-4" /></>
                    ) : (
                      <>Xem thêm {strengthsData.length - 5} mục <ChevronDown className="w-4 h-4" /></>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  {cvDisplayKWs.slice(0, showAllStrengths ? undefined : 5).map((kw, i) => (
                    <span key={`kw-${i}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-sm border border-emerald-200">
                      <Check className="w-3.5 h-3.5" />
                      {kw}
                    </span>
                  ))}
                </div>
                {cvDisplayKWs.length > 5 && (
                  <button 
                    onClick={() => setShowAllStrengths(!showAllStrengths)}
                    className="self-start mt-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition flex items-center gap-1"
                  >
                    {showAllStrengths ? (
                      <>Thu gọn <ChevronUp className="w-4 h-4" /></>
                    ) : (
                      <>Xem thêm {cvDisplayKWs.length - 5} mục <ChevronDown className="w-4 h-4" /></>
                    )}
                  </button>
                )}
              </div>
            )}
         </div>
      </div>

      {/* 5. Gaps (Weaknesses) */}
      <div className="rounded-sm border border-orange-100 bg-white overflow-hidden shadow-sm">
         <div className="border-b border-orange-50 bg-orange-50/30 px-5 py-3.5 flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-orange-800">KHOẢNG TRỐNG CẦN KHẮC PHỤC</h3>
         </div>
         <div className="p-5">
            {weaknessesData.length === 0 && missingKws.length === 0 ? (
              <p className="text-sm text-slate-500 font-medium">Không có</p>
            ) : weaknessesData.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {weaknessesData.slice(0, showAllWeaknesses ? undefined : 5).map((w, i) => (
                  <div key={`w-${i}`} className="flex items-start gap-2.5 text-sm text-slate-700 bg-orange-50/50 p-3 rounded-md border border-orange-100/50">
                    <Warning className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <span className="leading-relaxed">{w}</span>
                  </div>
                ))}
                {weaknessesData.length > 5 && (
                  <button 
                    onClick={() => setShowAllWeaknesses(!showAllWeaknesses)}
                    className="self-start mt-1 text-sm font-semibold text-orange-600 hover:text-orange-700 transition flex items-center gap-1"
                  >
                    {showAllWeaknesses ? (
                      <>Thu gọn <ChevronUp className="w-4 h-4" /></>
                    ) : (
                      <>Xem thêm {weaknessesData.length - 5} mục <ChevronDown className="w-4 h-4" /></>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  {missingKws.slice(0, showAllWeaknesses ? undefined : 5).map((kw, i) => (
                    <span key={`mw-${i}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 text-orange-700 text-sm border border-orange-200">
                      <Warning className="w-3.5 h-3.5" />
                      {kw}
                    </span>
                  ))}
                </div>
                {missingKws.length > 5 && (
                  <button 
                    onClick={() => setShowAllWeaknesses(!showAllWeaknesses)}
                    className="self-start mt-2 text-sm font-semibold text-orange-600 hover:text-orange-700 transition flex items-center gap-1"
                  >
                    {showAllWeaknesses ? (
                      <>Thu gọn <ChevronUp className="w-4 h-4" /></>
                    ) : (
                      <>Xem thêm {missingKws.length - 5} mục <ChevronDown className="w-4 h-4" /></>
                    )}
                  </button>
                )}
              </div>
            )}
         </div>
      </div>

      {/* 6. Suggestions */}
      <div className="rounded-sm border border-violet-200 bg-white overflow-hidden shadow-sm relative">
         <div className="border-b border-violet-100 bg-violet-50/50 px-5 py-3.5 flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-violet-600 shadow-[0_0_8px_rgba(124,58,237,0.5)]" />
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-violet-900">ĐỀ XUẤT CHỈNH SỬA</h3>
         </div>
         <div className="p-5">
            {suggestionsData.length === 0 ? (
              <p className="text-sm text-slate-500 font-medium">Không có</p>
            ) : (
              <div className="flex flex-col gap-3">
                {suggestionsData.slice(0, showAllSuggestions ? undefined : 5).map((item, i) => {
                  const isAdd = item.type === "add";
                  const title = isAdd ? item.title.replace(/^Bổ sung kỹ năng\s*"?/, "").replace(/"$/, "") : formatSuggestionDisplayReason(item, { mode: suggestionDisplayMode });
                  return (
                    <div key={i} className="flex flex-col gap-1 p-3.5 rounded-md border border-violet-100 bg-violet-50/30">
                      <div className="flex items-start gap-2.5">
                         <Zap className="w-4 h-4 mt-0.5 text-violet-600 flex-shrink-0" />
                         <span className="font-semibold text-slate-900 text-sm">
                           {isAdd ? "Cần bổ sung: " : "Cần tinh chỉnh: "}
                           <span className="text-violet-800">{title}</span>
                         </span>
                      </div>
                      {item.reason && (
                         <div className="text-xs text-slate-600 pl-6 ml-2 border-l-2 border-violet-100 mt-1.5 py-0.5">
                           <span className="font-bold text-slate-700 mr-1">Gợi ý hướng dẫn:</span>
                           {item.reason}
                         </div>
                      )}
                      {item.before && item.after && !isAdd && (
                         <div className="pl-6 ml-2 mt-2 text-xs flex flex-col gap-1.5">
                           <div className="flex items-start gap-2 text-rose-700 bg-rose-50/50 p-2 rounded border border-rose-100/50">
                              <span className="font-bold flex-shrink-0">Trước:</span>
                              <span className="leading-relaxed">{item.before}</span>
                           </div>
                           <div className="flex items-start gap-2 text-emerald-700 bg-emerald-50/50 p-2 rounded border border-emerald-100/50">
                              <span className="font-bold flex-shrink-0">Sau:</span>
                              <span className="leading-relaxed">{item.after}</span>
                           </div>
                         </div>
                      )}
                    </div>
                  );
                })}
                {suggestionsData.length > 5 && (
                  <button 
                    onClick={() => setShowAllSuggestions(!showAllSuggestions)}
                    className="self-start mt-1 text-sm font-semibold text-violet-600 hover:text-violet-700 transition flex items-center gap-1"
                  >
                    {showAllSuggestions ? (
                      <>Thu gọn <ChevronUp className="w-4 h-4" /></>
                    ) : (
                      <>Xem thêm {suggestionsData.length - 5} mục <ChevronDown className="w-4 h-4" /></>
                    )}
                  </button>
                )}
              </div>
            )}
         </div>
      </div>

      {/* Next Steps / CTAs */}
      <div className="mt-8 pt-8 border-t border-slate-200">
         <div className="flex flex-col items-center text-center mb-6">
           <h3 className="text-base font-bold text-slate-900 mb-2">
             {matchScore >= 80 ? 'Hồ sơ đã sẵn sàng!' :
              matchScore >= 50 ? 'Cần hoàn thiện thêm!' :
              'Đừng vội nản lòng!'}
           </h3>
           <p className="text-sm text-slate-500 max-w-md">
             {matchScore >= 80
               ? "CV của bạn đã rất ấn tượng. Bước tiếp theo là rèn luyện phản xạ thực tế trong phòng phỏng vấn AI, hoặc kết nối với Mentor để được góp ý chuyên sâu trước khi ứng tuyển."
               : matchScore >= 50 
               ? "Hãy chỉnh sửa lại CV theo các góp ý trên. Nếu gặp khó khăn, các Mentor luôn sẵn sàng hỗ trợ bạn."
               : "Bạn có thể kết nối với Mentor để định hướng lại lộ trình, hoặc thử phân tích với một JD khác phù hợp hơn."}
           </p>
         </div>

         <div className="flex flex-wrap justify-center gap-4">
           {matchScore >= 80 ? (
              <>
                <button type="button" onClick={() => navigate("/interview")}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#a3e635] px-8 py-3.5 text-base font-bold text-slate-900 transition hover:bg-[#84cc16] shadow-sm">
                  <Mic className="h-5 w-5 shrink-0" /> Phỏng vấn AI
                </button>
                <button type="button" onClick={() => navigate("/mentors")}
                  className="flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-8 py-3.5 text-base font-bold text-violet-700 transition hover:bg-violet-50 shadow-sm">
                  <Users className="h-5 w-5 shrink-0" /> Gặp Mentor
                </button>
              </>
           ) : (
              <button type="button" onClick={() => navigate("/mentors")}
                className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-8 py-3.5 text-base font-bold text-white transition hover:bg-violet-700 shadow-sm">
                <Users className="h-5 w-5 shrink-0" /> Gặp Mentor
              </button>
           )}
           <button type="button" onClick={() => navigate(resolvedAnalysisPath)}
             className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-8 py-3.5 text-base font-bold text-slate-700 transition hover:bg-slate-50 shadow-sm">
             <PlusCircle className="h-5 w-5 shrink-0" /> Phân tích mới
           </button>
           <button type="button" onClick={() => navigate(resolvedHistoryPath)}
             className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-8 py-3.5 text-base font-bold text-slate-700 transition hover:bg-slate-50 shadow-sm">
             <History className="h-5 w-5 shrink-0" /> Lịch sử
           </button>
         </div>
      </div>

      {/* Feedback */}
      <div className="mt-2 flex items-center justify-center gap-3 rounded-sm border border-slate-200 bg-white py-3 shadow-sm">
        {feedbackSent ? (
          <p className="text-sm font-semibold text-violet-700">
            {feedbackState === "helpful" ? "Cảm ơn bạn!" : "Cảm ơn, chúng tôi sẽ cải thiện."}
          </p>
        ) : (
          <>
            <p className="text-xs text-slate-500 font-medium">Kết quả phân tích này có hữu ích không?</p>
            <button type="button" onClick={() => handleFeedback("helpful")} className="flex items-center gap-1.5 rounded-sm border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 transition">
              <ThumbsUp className="h-3.5 w-3.5" /> Hữu ích
            </button>
            <button type="button" onClick={() => handleFeedback("not_helpful")} className="flex items-center gap-1.5 rounded-sm border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 hover:border-slate-300 hover:text-slate-700 transition">
              <ThumbsDown className="h-3.5 w-3.5" /> Chưa tốt
            </button>
          </>
        )}
      </div>
    </div>
  );
}

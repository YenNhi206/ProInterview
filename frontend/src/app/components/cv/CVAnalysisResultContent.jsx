import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Zap,
  AlertTriangle as Warning,
  Mic,
  Users,
  PlusCircle,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  CheckCircle2,
  Copy,
  CheckCheck,
  ArrowLeft,
  FileText,
  Search,
  Target,
  ArrowUpRight,
  Info,
  GraduationCap,
  Wrench,
  BookOpen,
  LayoutList,
} from "lucide-react";
import { submitCvFeedback } from "../../api/cvApi.js";
import { fetchCourses, mapApiCourseToCard } from "../../api/courseApi.js";
import { CVDocumentPreview } from "./CVDocumentPreview";
import { formatSuggestionDisplayReason } from "../../utils/cv/cvMappers.js";
import {
  CV_FIELD_ANALYSIS_PATH,
  CV_FIELD_HISTORY_PATH,
  CV_JD_ANALYSIS_PATH,
  CV_JD_HISTORY_PATH,
} from "./CvJdAnalysisTabs";

/** Tách tiêu đề kỹ năng thành Tên ngắn gọn + Các từ khóa/công nghệ đi kèm */
function parseSkillTitle(rawTitle) {
  if (!rawTitle) return { title: "Kỹ năng cần bổ sung", tags: [] };
  let str = String(rawTitle).replace(/^Bổ sung kỹ năng\s*"?/i, "").replace(/"$/, "").trim();
  if (str.includes(":")) {
    const parts = str.split(":");
    const main = parts[0].trim();
    const tagPart = parts.slice(1).join(":").trim();
    const rawTags = tagPart
      .split(/[,;]/)
      .map((t) => t.trim().replace(/\.$/, ""))
      .filter((t) => t.length > 1 && t.length < 40);
    const cleanedMain = main
      .replace(/\s*đảm nhiệm các chức năng/i, "")
      .replace(/\s*bao gồm/i, "")
      .trim();
    return { title: cleanedMain || main, tags: rawTags.slice(0, 4) };
  }
  let cleaned = str.replace(/\.$/, "").trim();
  return { title: cleaned, tags: [] };
}

/** Tách Định hướng AI thành: Hành động chính (takeaway) và Bối cảnh đối chiếu (context) */
function parseReason(reasonText) {
  if (!reasonText) return { takeaway: "", fullReason: "", context: "" };
  const raw = String(reasonText).trim();
  const sentences = raw.split(/(?<=[.!?])\s+/).filter(Boolean);
  const actionSentence = sentences.find((s) =>
    /^(Hãy|Nên|Cần|Tập trung|Đề xuất|Bổ sung|Nhấn mạnh)/i.test(s.trim())
  );
  let takeaway = actionSentence || (sentences.length > 1 ? sentences[sentences.length - 1] : raw);
  takeaway = takeaway.trim();
  const context = sentences.filter((s) => s !== takeaway).join(" ").trim();
  return { takeaway, fullReason: raw, context };
}

/** Tách Lộ trình tiếp thu thành: Khóa học gợi ý (course) và Dự án thực hành (practice) */
function parseRoadmap(afterText) {
  if (!afterText) return { course: null, practice: null, fullAfter: "" };
  const raw = String(afterText).trim();
  let course = null;
  let practice = null;
  const sentences = raw.split(/(?<=[.!?])\s+/).filter(Boolean);
  for (const s of sentences) {
    if (!course && (/khóa học|course|udemy|coursera|pluralsight|youtube/i.test(s) || /'[^']+'|"[^"]+"/.test(s))) {
      const quoteMatch = s.match(/['"“]([^'"”]+)['"”]/);
      const platformMatch = s.match(/(Udemy|Coursera|Pluralsight|edX|freeCodeCamp|LinkedIn Learning)/i);
      if (quoteMatch) {
        course = (platformMatch ? platformMatch[0] + ": " : "") + quoteMatch[1];
      } else {
        let c = s.replace(/^(Tham gia|Hoàn thành|Tìm hiểu)\s*/i, "").trim();
        if (c.length > 70) c = c.slice(0, 67) + "…";
        course = c;
      }
    } else if (!practice && (/thực hành|xây dựng|triển khai|project|dự án|pipeline/i.test(s))) {
      let p = s.replace(/^(Thực hành|Hãy|Nên)\s*/i, "").trim();
      if (p.length > 95) p = p.slice(0, 92) + "…";
      practice = p;
    }
  }
  return { course, practice, fullAfter: raw };
}

/** Rút gọn văn bản dài thành tóm tắt ngắn gọn súc tích */
function cleanInsightText(text) {
  if (!text) return "";
  const s = String(text).trim();
  if (s.includes(":")) {
    const [title] = s.split(":");
    if (title && title.length < 80) return title.trim();
  }
  let cleaned = s.replace(/^\[Bắt buộc\]\s*/i, "").replace(/^Thiếu\s*"?/i, "").replace(/"$/, "");
  if (cleaned.length > 85) cleaned = cleaned.slice(0, 85).trim() + "…";
  return cleaned;
}

/** Tìm khóa học phù hợp trong kho ProInterview dựa theo kỹ năng */
function findMatchingInternalCourse(item, courseList) {
  if (!courseList || courseList.length === 0) return null;
  const title = (item.title || "").toLowerCase();
  const reason = (item.reason || "").toLowerCase();
  const tags = (item.tags || []).map((t) => String(t).toLowerCase());

  let bestMatch = null;
  let highestScore = 0;

  for (const course of courseList) {
    if (!course.title) continue;
    const cleanTitle = course.title.replace(/^\[[^\]]+\]\s*/, "").toLowerCase();
    const cTags = (course.tags || []).map((t) => String(t).toLowerCase());
    const cCategory = (course.category || "").toLowerCase();

    let score = 0;

    // Kiểm tra tags trùng khớp
    for (const tag of tags) {
      if (cTags.some((ct) => ct.includes(tag) || tag.includes(ct))) score += 4;
      if (cleanTitle.includes(tag)) score += 3;
    }

    // Kiểm tra từ khóa kỹ năng
    const keywords = title
      .split(/[\s,.:;()/-]+/)
      .filter((w) => w.length > 3 && !["thiết", "kế", "và", "xây", "dựng", "các", "cho", "với", "trong"].includes(w));

    for (const kw of keywords) {
      if (cleanTitle.includes(kw)) score += 3;
      if (cTags.some((ct) => ct.includes(kw))) score += 3;
      if (cCategory.includes(kw)) score += 2;
    }

    // Các cặp công nghệ liên quan
    const techPairs = [
      { key: "microservice", match: ["system", "backend", "architecture"] },
      { key: "backend", match: ["backend", "nodejs", "api"] },
      { key: "api", match: ["backend", "nodejs", "api"] },
      { key: "system", match: ["system-design", "architecture"] },
      { key: "interview", match: ["interview", "technical"] },
      { key: "database", match: ["backend", "architecture"] },
    ];

    for (const pair of techPairs) {
      if (title.includes(pair.key) || reason.includes(pair.key)) {
        if (pair.match.some((m) => cleanTitle.includes(m) || cTags.includes(m))) {
          score += 2;
        }
      }
    }

    if (score > highestScore && score >= 3) {
      highestScore = score;
      bestMatch = {
        ...course,
        displayTitle: course.title.replace(/^\[[^\]]+\]\s*/, ""),
      };
    }
  }

  return bestMatch;
}

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
  const [feedbackState, setFeedbackState] = useState(null);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "preview" | "keywords"
  const [copiedId, setCopiedId] = useState(null);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [showDetailedInsights, setShowDetailedInsights] = useState(false);
  const [suggestionFilter, setSuggestionFilter] = useState("all"); // "all" | "fix" | "add"
  const [suggestionViewMode, setSuggestionViewMode] = useState("compact"); // "compact" | "full"
  const [expandedCardIds, setExpandedCardIds] = useState(new Set());
  const [internalCourses, setInternalCourses] = useState([]);
  const [keywordSearch, setKeywordSearch] = useState("");
  const [keywordFilter, setKeywordFilter] = useState("all"); // "all" | "matched" | "missing"

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchCourses();
      if (!cancelled && res.success && Array.isArray(res.courses)) {
        setInternalCourses(res.courses.map(mapApiCourseToCard));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleCardExpansion = (id) => {
    setExpandedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleFeedback = async (rating) => {
    setFeedbackState(rating);
    setFeedbackSent(true);
    if (analysisId) await submitCvFeedback(analysisId, rating);
  };

  const handleCopyText = (text, id) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((prev) => (prev === id ? null : prev));
    }, 2000);
  };

  const R = analysisResult || {};
  const derivedMode = routeMode === "field" ? "field" : routeMode === "jd" ? "jd" : "cv-only";
  const matchScore = Number(R?.matchScore ?? R?.match?.score ?? 0);

  const cvDisplayKWs = useMemo(() => R.matchedKeywords || [], [R.matchedKeywords]);
  const missingKws = useMemo(() => R.missingKeywords || [], [R.missingKeywords]);
  const totalKeywords = cvDisplayKWs.length + missingKws.length;
  const keywordMatchPct = totalKeywords > 0 ? Math.round((cvDisplayKWs.length / totalKeywords) * 100) : 0;

  const suggestionDisplayMode = derivedMode === "field" ? "field" : "jd";
  const suggestionsData = useMemo(() => R.suggestions || [], [R.suggestions]);
  const starCount = useMemo(() => suggestionsData.filter((s) => s.type === "fix").length, [suggestionsData]);
  const addCount = useMemo(() => suggestionsData.filter((s) => s.type === "add").length, [suggestionsData]);
  const strengthsData = useMemo(() => R.strengths || [], [R.strengths]);
  const weaknessesData = useMemo(() => R.weaknesses || [], [R.weaknesses]);

  const resolvedHistoryPath = historyPath ?? (routeMode === "field" ? CV_FIELD_HISTORY_PATH : CV_JD_HISTORY_PATH);
  const resolvedAnalysisPath = analysisPath ?? (routeMode === "field" ? CV_FIELD_ANALYSIS_PATH : CV_JD_ANALYSIS_PATH);

  // Score tier
  const scoreTier = matchScore >= 80 ? "high" : matchScore >= 50 ? "mid" : "low";

  // Filtered suggestions
  const filteredSuggestions = useMemo(() => {
    if (suggestionFilter === "all") return suggestionsData;
    return suggestionsData.filter((s) => s.type === suggestionFilter);
  }, [suggestionsData, suggestionFilter]);

  // Clean raw summary (remove markdown emojis if present)
  const cleanSummary = R?.summary ? String(R.summary).replace(/^[✨⭐]\s*/u, "").trim() : "";

  // Tabs identical to Courses page
  const resultTabs = useMemo(() => [
    {
      id: "overview",
      label: "Cần cải thiện",
      icon: <Sparkles className="w-4 h-4" />,
      badge: suggestionsData.length || undefined,
    },
    ...(derivedMode === "jd"
      ? [
          {
            id: "preview",
            label: "CV & mô tả công việc",
            icon: <FileText className="w-4 h-4" />,
          },
        ]
      : []),
    {
      id: "keywords",
      label: "Đối chiếu yêu cầu",
      icon: <Target className="w-4 h-4" />,
      badge: totalKeywords,
    },
  ], [derivedMode, suggestionsData.length, totalKeywords]);

  // Smooth animated count-up for score and circular gauge
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    let startTimestamp = null;
    const duration = 1100;
    let animationFrameId;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(easeOut * matchScore));
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [matchScore]);

  // Radial progress based on animated displayScore
  const strokeDash = (displayScore / 100) * 263.89;

  return (
    <div className="flex flex-col gap-6 pb-16 w-full animate-in fade-in duration-500">
      {/* ─── Top Bar: Navigation & Action CTAs ─────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10 animate-in fade-in slide-in-from-top-2 duration-500">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-3">
          <nav aria-label="Đường dẫn kết quả phân tích" className="flex min-w-0 max-w-full items-center gap-2 text-xs font-medium text-[#bfb5cf] sm:text-sm">
            <Link to="/cv-analysis" className="shrink-0 rounded-sm no-underline transition-colors hover:text-[#93f72b] hover:underline underline-offset-4 focus-visible:text-[#93f72b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#93f72b]">Phân tích CV</Link>
            <span aria-hidden className="text-white/35">/</span>
            <Link to={resolvedHistoryPath} className="shrink-0 rounded-sm no-underline transition-colors hover:text-[#93f72b] hover:underline underline-offset-4 focus-visible:text-[#93f72b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#93f72b]">Lịch sử</Link>
            <span aria-hidden className="text-white/35">/</span>
            <span aria-current="page" className="min-w-0 max-w-[12rem] truncate font-medium text-[#eee8f7] sm:max-w-[20rem]" title={[R?.position, R?.company].filter(Boolean).join(" · ") || cvFileName || "Kết quả chi tiết"}>
              {[R?.position, R?.company].filter(Boolean).join(" · ") || cvFileName || "Kết quả chi tiết"}
            </span>
          </nav>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-[#cdb8f1]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {derivedMode === "field" ? "Theo ngành nghề" : "Khớp CV & JD"}
          </span>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <button
            data-button-surface="none" type="button"
            onClick={() => navigate(resolvedAnalysisPath)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 hover:text-white text-xs sm:text-sm font-bold transition-all active:scale-95 group"
          >
            <PlusCircle className="w-4 h-4 text-violet-400 transition-transform duration-300 group-hover:rotate-90" />
            <span>Phân tích mới</span>
          </button>

          <button
            data-button-surface="none" type="button"
            onClick={() => navigate("/interview")}
            className="relative overflow-hidden inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-500 text-white shadow-[0_4px_16px_rgba(124,58,237,0.35)] hover:shadow-[0_6px_24px_rgba(124,58,237,0.55)] hover:brightness-110 text-xs sm:text-sm font-bold transition-all active:scale-95 group before:absolute before:inset-0 before:-translate-x-full hover:before:translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:transition-transform before:duration-700"
          >
            <Mic className="w-4 h-4 relative z-10" />
            <span className="relative z-10">Luyện phỏng vấn</span>
          </button>
        </div>
      </div>

      {historySaveWarning && (
        <div
          className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 text-amber-200 shadow-xs animate-in fade-in slide-in-from-top-2 duration-300"
          role="status"
        >
          <Warning className="mt-0.5 h-5 w-5 shrink-0 text-amber-400 animate-bounce" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Chưa lưu vào lịch sử</p>
            <p className="mt-0.5 text-xs text-amber-300/90 leading-relaxed">{historySaveWarning}</p>
          </div>
        </div>
      )}

      <section className="overflow-hidden rounded-3xl border border-white/15 bg-[#1d182d]" aria-labelledby="cv-result-heading">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[14rem_1fr] lg:gap-10">
          <div className="lg:border-r lg:border-white/10 lg:pr-8">
            <p className="text-sm font-medium text-[#c6bbd7]">Mức độ phù hợp với {derivedMode === "field" ? "ngành nghề" : "công việc"}</p>
            <p className="mt-4 flex items-baseline gap-2 tabular-nums">
              <span className={`text-7xl font-bold leading-none tracking-tight sm:text-8xl ${scoreTier === "high" ? "text-[#93f72b]" : scoreTier === "mid" ? "text-[#c8a5ff]" : "text-[#ffb087]"}`}>{displayScore}</span>
              <span className="text-xl font-medium text-[#d1c5e0]">/100</span>
            </p>
            <p className={`mt-4 inline-flex rounded-lg border px-3 py-1.5 text-sm font-semibold ${scoreTier === "high" ? "border-[#93f72b]/25 bg-[#93f72b]/10 text-[#93f72b]" : scoreTier === "mid" ? "border-[#c8a5ff]/25 bg-[#c8a5ff]/10 text-[#d5baff]" : "border-[#ffb087]/25 bg-[#ffb087]/10 text-[#ffbd9c]"}`}>{scoreTier === "high" ? "Phù hợp cao" : scoreTier === "mid" ? "Phù hợp một phần" : "Mức phù hợp còn thấp"}</p>
            <p className="mt-4 text-xs leading-relaxed text-[#b4a7c9]">Điểm thể hiện độ khớp với yêu cầu đã chọn, không đánh giá toàn bộ năng lực của bạn.</p>
          </div>
          <div className="min-w-0">
            <h1 id="cv-result-heading" className="text-xl font-semibold text-white">Kết quả phân tích CV</h1>
            {cleanSummary && <p className="mt-3 max-w-3xl text-sm leading-7 text-[#d1c8df]">{cleanSummary}</p>}
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-4 text-sm">
              <span className="text-emerald-300">{cvDisplayKWs.length} yêu cầu đã khớp</span>
              <span className="text-rose-300">{missingKws.length} yêu cầu chưa thể hiện</span>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 bg-white/[0.03] px-6 py-4 sm:px-8">
          <h2 className="text-sm font-semibold text-white">Bạn nên làm gì tiếp theo?</h2>
          <p className="mt-1 text-sm leading-relaxed text-[#c6bbd7]">
            {matchScore < 30
              ? "Kiểm tra lại CV và mô tả công việc có đúng vị trí muốn ứng tuyển không. Nếu đã đúng, xem từng yêu cầu bên dưới; chỉ bổ sung kinh nghiệm hoặc kỹ năng bạn thực sự có."
              : "Xem các gợi ý bên dưới, ưu tiên kinh nghiệm liên quan và chỉ đưa vào CV những thông tin đúng với bạn. Sau khi chỉnh sửa, tải CV mới lên để kiểm tra lại."}
          </p>
        </div>
      </section>

      {/* ─── Apple-style Floating Glass Segmented Dock (Identical to Course Page) ─── */}
      <div className="flex items-center justify-center sm:justify-start animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
        <div
          className="relative flex items-center p-1 sm:p-1.5 rounded-2xl border border-white/15 bg-gradient-to-b from-[#1c183d]/85 via-[#14122e]/90 to-[#0e0c24]/95 shadow-[0_8px_32px_rgba(5,3,20,0.5),inset_0_1px_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl w-full sm:w-auto"
          role="tablist"
          aria-label="Chuyển mục phân tích"
        >
          {resultTabs.map((item) => {
            const isSelected = activeTab === item.id;
            return (
              <button
                key={item.id}
                data-button-surface="none" type="button"
                role="tab"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setActiveTab(item.id)}
                className={`relative flex-1 sm:flex-initial px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 sm:gap-2.5 select-none outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                  isSelected
                    ? "text-[#93f72b] font-bold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                }`}
              >
                {isSelected && (
                  <motion.div
                    layoutId="cv-analysis-result-segmented-dock"
                    className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/[0.18] via-white/[0.08] to-transparent border border-white/20 border-t-white/35 shadow-[0_4px_16px_rgba(0,0,0,0.45),0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.25)] backdrop-blur-md"
                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                  />
                )}
                <span className="relative z-10 tracking-tight flex items-center gap-2">
                  {item.icon}
                  {item.label}
                </span>
                {item.badge !== undefined && (
                  <span
                    className={`relative z-10 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums transition-colors duration-200 ${
                      isSelected
                        ? "bg-violet-400/25 text-violet-200 border border-violet-400/40 shadow-[0_0_10px_rgba(167,139,250,0.3)]"
                        : "bg-white/5 text-slate-400 border border-white/5"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── TAB 1: SUGGESTIONS & REWRITES (NGAY TRỌNG TÂM) ─────────── */}
      {activeTab === "overview" && (
        <div className="flex flex-col gap-6 animate-in fade-in zoom-in-[0.99] duration-300">
          {/* Actionable STAR Suggestions & Rewrites */}
          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#181538]/70 via-[#13112b]/75 to-[#0d0b21]/80 shadow-[0_12px_40px_rgba(0,0,0,0.4)] backdrop-blur-2xl p-5 sm:p-7">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 mb-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-violet-500 text-white flex items-center justify-center shadow-lg shadow-violet-500/25 shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Những điểm cần cải thiện
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Mở từng gợi ý để xem lý do và cách cải thiện. Không thêm kỹ năng chưa có vào CV.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
                {/* Filter pills (Identical Floating Glass Dock) */}
                {starCount > 0 && addCount > 0 && (
                  <div
                    className="relative flex items-center p-1 rounded-2xl border border-white/15 bg-gradient-to-b from-[#1c183d]/85 via-[#14122e]/90 to-[#0e0c24]/95 shadow-[0_4px_16px_rgba(5,3,20,0.4),inset_0_1px_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl"
                    role="tablist"
                    aria-label="Lọc đề xuất"
                  >
                    {[
                      { id: "all", label: "Tất cả", count: suggestionsData.length },
                      ...(starCount > 0 ? [{ id: "fix", label: "Viết lại kinh nghiệm", count: starCount }] : []),
                      ...(addCount > 0 ? [{ id: "add", label: "Bổ sung kỹ năng", count: addCount }] : []),
                    ].map((item) => {
                      const isSelected = suggestionFilter === item.id;
                      return (
                        <button
                          key={item.id}
                          data-button-surface="none" type="button"
                          onClick={() => setSuggestionFilter(item.id)}
                          className={`relative px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 select-none outline-none ${
                            isSelected
                              ? "text-[#93f72b] font-bold"
                              : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                          }`}
                        >
                          {isSelected && (
                            <motion.div
                              layoutId="cv-suggestion-filter-dock"
                              className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/[0.18] via-white/[0.08] to-transparent border border-white/20 border-t-white/35 shadow-[0_2px_8px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.25)] backdrop-blur-md"
                              transition={{ type: "spring", stiffness: 450, damping: 35 }}
                            />
                          )}
                          <span className="relative z-10 tracking-tight">{item.label}</span>
                          <span
                            className={`relative z-10 inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums transition-colors duration-200 ${
                              isSelected
                                ? "bg-violet-400/25 text-violet-200 border border-violet-400/40 shadow-[0_0_8px_rgba(167,139,250,0.3)]"
                                : "bg-white/5 text-slate-400 border border-white/5"
                            }`}
                          >
                            {item.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {filteredSuggestions.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <Info className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                <p className="text-sm font-semibold text-slate-300">Không có đề xuất chỉnh sửa nào trong mục này.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3.5">
                {filteredSuggestions
                  .slice(0, showAllSuggestions ? undefined : 6)
                  .map((item, idx) => {
                    const isAdd = item.type === "add";
                    const isHigh = item.priority === "high";
                    const uniqueId = `sugg-${idx}`;
                    const isCopied = copiedId === uniqueId;
                    const isExpanded = suggestionViewMode === "full" || expandedCardIds.has(uniqueId);

                    if (isAdd) {
                      const parsedTitle = parseSkillTitle(item.title);
                      const parsedReason = parseReason(item.reason);
                      const parsedRoadmap = parseRoadmap(item.after);
                      const copyContent = parsedReason.takeaway || item.after || item.title;
                      const matchedInternalCourse = findMatchingInternalCourse(
                        { ...item, title: parsedTitle.title, tags: parsedTitle.tags },
                        internalCourses
                      );

                      return (
                        <div
                          key={idx}
                          className={`rounded-2xl border transition-all duration-300 backdrop-blur-xl hover:-translate-y-0.5 ${
                            isExpanded
                              ? "border-sky-500/40 bg-gradient-to-b from-sky-950/20 via-[#14122e]/90 to-[#0e0c24]/95 shadow-[0_8px_30px_rgba(14,165,233,0.12)]"
                              : "border-white/10 bg-white/[0.03] hover:border-sky-400/40 hover:bg-white/[0.05] hover:shadow-[0_8px_25px_rgba(14,165,233,0.1)]"
                          } p-4 sm:p-5`}
                        >
                          {/* Top Header Row */}
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              {/* Number badge */}
                              <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-300 font-mono text-xs font-bold shadow-xs">
                                {String(idx + 1).padStart(2, "0")}
                              </span>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-sky-500/15 text-sky-300 border border-sky-500/25">
                                    Bổ sung kỹ năng
                                  </span>

                                  {parsedTitle.tags.map((tag, tIdx) => (
                                    <span
                                      key={tIdx}
                                      className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/[0.06] text-slate-300 border border-white/10"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>

                                <h4 className="text-sm sm:text-base font-bold text-white tracking-tight leading-snug">
                                  {parsedTitle.title}
                                </h4>
                              </div>
                            </div>

                            {/* Quick action buttons */}
                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-start">
                              <button
                                data-button-surface="none" type="button"
                                onClick={() => handleCopyText(copyContent, uniqueId)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                                  isCopied
                                    ? "bg-emerald-600 text-white shadow-xs"
                                    : "bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white border border-white/15"
                                }`}
                                title="Sao chép câu gợi ý này"
                              >
                                {isCopied ? (
                                  <>
                                    <CheckCheck className="w-3.5 h-3.5 text-white" />
                                    <span>Đã sao chép!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Sao chép</span>
                                  </>
                                )}
                              </button>

                              <button
                                data-button-surface="none" type="button"
                                onClick={() => toggleCardExpansion(uniqueId)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition"
                              >
                                <span>{isExpanded ? "Thu gọn" : "Chi tiết"}</span>
                                <ChevronDown
                                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                                    isExpanded ? "rotate-180 text-sky-400" : ""
                                  }`}
                                />
                              </button>
                            </div>
                          </div>

                          {/* Core Action Callout (Điểm cốt lõi ứng viên cần làm) */}
                          {parsedReason.takeaway && (
                            <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-violet-500/15 via-indigo-500/10 to-transparent border-l-2 border-violet-400 flex items-start gap-2.5">
                              <Sparkles className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-violet-300 block mb-0.5">
                                  Gợi ý đưa vào CV
                                </span>
                                <p className="text-xs text-slate-100 font-medium leading-relaxed">
                                  {parsedReason.takeaway}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Visual Resource Chips (Khóa học & Thực hành) */}
                          {(matchedInternalCourse || parsedRoadmap.course || parsedRoadmap.practice) && (
                            <div className="mt-2.5 flex flex-wrap items-center gap-2">
                              {/* Ưu tiên 1: Khóa học của ProInterview nếu có */}
                              {matchedInternalCourse ? (
                                <button
                                  data-button-surface="none" type="button"
                                  onClick={() => navigate(`/courses/${matchedInternalCourse.id}`)}
                                  className="group/chip inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600/30 via-indigo-600/25 to-violet-600/20 border border-violet-400/50 text-xs text-violet-100 font-medium hover:border-violet-300 hover:shadow-[0_0_16px_rgba(124,58,237,0.35)] transition-all duration-200 cursor-pointer active:scale-95"
                                  title="Khóa học có sẵn trên ProInterview — Bấm để xem chi tiết"
                                >
                                  <div className="w-5 h-5 rounded-lg bg-violet-500/30 flex items-center justify-center text-violet-300 group-hover/chip:scale-110 transition-transform">
                                    <GraduationCap className="w-3.5 h-3.5 text-violet-300" />
                                  </div>
                                  <span>
                                    <strong className="text-violet-300 font-bold">Khóa học ProInterview:</strong>{" "}
                                    <span className="text-slate-100 font-semibold">{matchedInternalCourse.displayTitle}</span>
                                  </span>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-violet-500/25 text-violet-200 border border-violet-400/35 group-hover/chip:bg-violet-600 group-hover/chip:text-white group-hover/chip:border-violet-400 transition-all shadow-xs">
                                    <span>Học ngay</span>
                                    <ArrowUpRight className="w-3 h-3 group-hover/chip:translate-x-0.5 group-hover/chip:-translate-y-0.5 transition-transform" />
                                  </span>
                                </button>
                              ) : parsedRoadmap.course ? (
                                /* Fallback: Khóa học bên ngoài nếu ProInterview chưa có */
                                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-200 font-medium">
                                  <GraduationCap className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                  <span>
                                    <strong className="text-sky-300 font-bold">Khóa học gợi ý:</strong> {parsedRoadmap.course}
                                  </span>
                                  <span className="text-[10px] text-slate-400 ml-1">(Tham khảo ngoài)</span>
                                </div>
                              ) : null}

                              {parsedRoadmap.practice && (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200 font-medium">
                                  <Wrench className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  <span>
                                    <strong className="text-emerald-300 font-bold">Thực hành:</strong> {parsedRoadmap.practice}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Expanded Details Section */}
                          {isExpanded && (
                            <div className="mt-3.5 pt-3.5 border-t border-white/10 flex flex-col gap-3 animate-in fade-in duration-200">
                              {parsedReason.context && (
                                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10">
                                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                                    Bối cảnh đối chiếu từ hồ sơ của bạn
                                  </span>
                                  <p className="text-xs text-slate-300 leading-relaxed font-normal">
                                    {parsedReason.context}
                                  </p>
                                </div>
                              )}

                              {parsedRoadmap.fullAfter && (
                                <div className="p-3.5 rounded-xl bg-sky-950/30 border border-sky-500/25">
                                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-300 block mb-1 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                                    Lộ trình tiếp thu chi tiết
                                  </span>
                                  <p className="text-xs text-sky-200 leading-relaxed font-normal">
                                    {parsedRoadmap.fullAfter}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    }

                    // For "fix" (Viết lại STAR)
                    const title = formatSuggestionDisplayReason(item, { mode: suggestionDisplayMode });
                    const copyContent = item.after || "";

                    return (
                      <div
                        key={idx}
                        className={`rounded-2xl border transition-all duration-300 backdrop-blur-xl hover:-translate-y-0.5 ${
                          isExpanded
                            ? "border-violet-500/40 bg-gradient-to-b from-violet-950/20 via-[#14122e]/90 to-[#0e0c24]/95 shadow-[0_8px_30px_rgba(124,58,237,0.15)]"
                            : "border-white/10 bg-white/[0.03] hover:border-violet-400/40 hover:bg-white/[0.05] hover:shadow-[0_8px_25px_rgba(124,58,237,0.1)]"
                        } p-4 sm:p-5`}
                      >
                        {/* Top Header Row */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2.5">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-300 font-mono text-xs font-bold shadow-xs">
                              {String(idx + 1).padStart(2, "0")}
                            </span>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                                    isHigh
                                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                      : "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                                  }`}
                                >
                                  {isHigh ? "Ưu tiên cao" : "Viết lại STAR"}
                                </span>
                              </div>

                              <h4 className="text-sm sm:text-base font-bold text-white tracking-tight leading-snug">
                                {title}
                              </h4>
                            </div>
                          </div>

                          {/* Quick action buttons */}
                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-start">
                            {item.after && (
                              <button
                                data-button-surface="none" type="button"
                                onClick={() => handleCopyText(copyContent, uniqueId)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                                  isCopied
                                    ? "bg-emerald-600 text-white shadow-xs"
                                    : "bg-gradient-to-r from-violet-600 to-indigo-600 hover:brightness-110 text-white border border-violet-400/30 shadow-xs"
                                }`}
                                title="Sao chép câu chuẩn STAR này"
                              >
                                {isCopied ? (
                                  <>
                                    <CheckCheck className="w-3.5 h-3.5 text-white" />
                                    <span>Đã sao chép!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Sao chép STAR</span>
                                  </>
                                )}
                              </button>
                            )}

                            {item.reason && (
                              <button
                                data-button-surface="none" type="button"
                                onClick={() => toggleCardExpansion(uniqueId)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition"
                              >
                                <span>{isExpanded ? "Thu gọn" : "Chi tiết"}</span>
                                <ChevronDown
                                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                                    isExpanded ? "rotate-180 text-violet-400" : ""
                                  }`}
                                />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Before vs After Diff Grid */}
                        {item.before && item.after && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                            {/* Before Box */}
                            <div className="flex flex-col p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/25">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-300 mb-1 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                Trước (Câu gốc trong CV)
                              </span>
                              <p className="text-xs text-rose-200 font-normal leading-relaxed">
                                {item.before}
                              </p>
                            </div>

                            {/* After Box */}
                            <div className="flex flex-col p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/25">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 mb-1 flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                                Sau (Gợi ý viết lại chuẩn STAR + KPI)
                              </span>
                              <p className="text-xs text-emerald-200 font-medium leading-relaxed">
                                {item.after}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Expanded Reason */}
                        {isExpanded && item.reason && (
                          <div className="mt-3 pt-3 border-t border-white/10 animate-in fade-in duration-200">
                            <p className="text-xs text-slate-300 leading-relaxed font-normal">
                              <span className="font-bold text-violet-300">Định hướng AI:</span> {item.reason}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}

                {filteredSuggestions.length > 6 && (
                  <button
                    data-button-surface="none" type="button"
                    onClick={() => setShowAllSuggestions(!showAllSuggestions)}
                    className="mt-2 self-center inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] text-violet-300 text-xs font-bold transition active:scale-95"
                  >
                    {showAllSuggestions ? (
                      <>Thu gọn danh sách đề xuất <ChevronUp className="w-4 h-4" /></>
                    ) : (
                      <>Xem thêm {filteredSuggestions.length - 6} đề xuất khác <ChevronDown className="w-4 h-4" /></>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Optional Collapsible Detail: Năng lực chi tiết (Nếu ứng viên muốn xem thêm) */}
          {(strengthsData.length > 0 || weaknessesData.length > 0) && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-5 sm:p-6 transition-all duration-300 shadow-sm hover:border-white/20">
              <button
                data-button-surface="none" type="button"
                aria-expanded={showDetailedInsights}
                onClick={() => setShowDetailedInsights(!showDetailedInsights)}
                className="w-full flex items-center justify-between text-xs sm:text-sm font-bold text-slate-200 hover:text-white transition group"
              >
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-white">Chi tiết đối chiếu năng lực hồ sơ</span>
                  <div className="flex items-center gap-1.5">
                    {strengthsData.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        {strengthsData.length} điểm mạnh
                      </span>
                    )}
                    {weaknessesData.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                        {weaknessesData.length} khoảng trống
                      </span>
                    )}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 group-hover:bg-white/[0.1] text-violet-300 text-xs font-semibold transition">
                  <span>{showDetailedInsights ? "Thu gọn" : "Xem phân tích"}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showDetailedInsights ? "rotate-180 text-violet-400" : ""}`} />
                </span>
              </button>

              {showDetailedInsights && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 pt-5 border-t border-white/10 animate-in fade-in duration-200">
                  {/* Left: Strengths */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/[0.05] border border-emerald-500/20 backdrop-blur-md">
                    <h5 className="text-xs font-extrabold text-emerald-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <div className="w-5 h-5 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <span>Điểm mạnh đã có</span>
                    </h5>
                    <ul className="flex flex-col gap-2.5 list-none p-0 m-0 text-xs text-emerald-100">
                      {strengthsData.map((s, i) => (
                        <li key={i} className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-emerald-500/15">
                          <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                          <span className="leading-relaxed font-normal">{cleanInsightText(s)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Right: Weaknesses */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/[0.05] border border-rose-500/20 backdrop-blur-md">
                    <h5 className="text-xs font-extrabold text-rose-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <div className="w-5 h-5 rounded-lg bg-rose-500/20 flex items-center justify-center">
                        <Warning className="w-3.5 h-3.5 text-rose-400" />
                      </div>
                      <span>Khoảng trống cần bù đắp</span>
                    </h5>
                    <ul className="flex flex-col gap-2.5 list-none p-0 m-0 text-xs text-rose-100">
                      {weaknessesData.map((w, i) => (
                        <li key={i} className="flex items-start gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-rose-500/15">
                          <Warning className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                          <span className="leading-relaxed font-normal">{cleanInsightText(w)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: DOCUMENT PREVIEW (SIDE BY SIDE) ─────────────────── */}
      {activeTab === "preview" && derivedMode === "jd" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-violet-400" />
              <div>
                <h4 className="text-sm font-bold text-white">So sánh trực quan CV và Mô tả công việc (JD)</h4>
                <p className="text-xs text-slate-400">Đối chiếu trực tiếp bản PDF để kiểm tra từ khóa</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-emerald-300 bg-emerald-500/15 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                ✓ {cvDisplayKWs.length} từ khóa khớp
              </span>
              <span className="text-xs font-bold text-rose-300 bg-rose-500/15 px-2.5 py-1 rounded-lg border border-rose-500/30">
                ✗ {missingKws.length} từ khóa thiếu
              </span>
            </div>
          </div>

          <CVDocumentPreview
            cvFile={cvFile}
            jdFile={jdFile}
            cvFileUrl={cvFileUrl}
            jdFileUrl={jdFileUrl}
            cvFileName={cvFile?.name ?? cvFileName}
            jdFileName={jdFile?.name ?? jdFileName}
            matchedKws={cvDisplayKWs}
            missingKws={missingKws}
          />
        </div>
      )}

      {/* ─── TAB 3: KEYWORDS MATRIX ─────────────────────────────────── */}
      {activeTab === "keywords" && (
        <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#181538]/70 via-[#13112b]/75 to-[#0d0b21]/80 shadow-[0_12px_40px_rgba(0,0,0,0.4)] backdrop-blur-2xl p-6 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-white/10">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Đối chiếu yêu cầu kỹ thuật & Năng lực
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Toàn bộ từ khóa trong JD đối chiếu với nội dung xuất hiện trong hồ sơ
              </p>
            </div>

            {/* Keyword Search & Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm từ khóa..."
                  value={keywordSearch}
                  onChange={(e) => setKeywordSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 rounded-xl border border-white/15 bg-white/[0.05] text-white text-xs font-medium focus:border-violet-500 focus:outline-none w-44"
                />
              </div>

              <div
                className="relative flex items-center p-1 rounded-2xl border border-white/15 bg-gradient-to-b from-[#1c183d]/85 via-[#14122e]/90 to-[#0e0c24]/95 shadow-[0_4px_16px_rgba(5,3,20,0.4),inset_0_1px_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl"
                role="tablist"
                aria-label="Lọc từ khóa"
              >
                {[
                  { id: "all", label: "Tất cả", count: totalKeywords },
                  { id: "matched", label: "Đã khớp", count: cvDisplayKWs.length },
                  { id: "missing", label: "Còn thiếu", count: missingKws.length },
                ].map((item) => {
                  const isSelected = keywordFilter === item.id;
                  return (
                    <button
                      key={item.id}
                      data-button-surface="none" type="button"
                      onClick={() => setKeywordFilter(item.id)}
                      className={`relative px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 select-none outline-none ${
                        isSelected
                          ? "text-[#93f72b] font-bold"
                          : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                      }`}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="cv-keywords-filter-dock"
                          className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/[0.18] via-white/[0.08] to-transparent border border-white/20 border-t-white/35 shadow-[0_2px_8px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.25)] backdrop-blur-md"
                          transition={{ type: "spring", stiffness: 450, damping: 35 }}
                        />
                      )}
                      <span className="relative z-10 tracking-tight">{item.label}</span>
                      <span
                        className={`relative z-10 inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums transition-colors duration-200 ${
                          isSelected
                            ? "bg-violet-400/25 text-violet-200 border border-violet-400/40 shadow-[0_0_8px_rgba(167,139,250,0.3)]"
                            : "bg-white/5 text-slate-400 border border-white/5"
                        }`}
                      >
                        {item.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Matched Panel */}
            <div className="p-5 rounded-2xl border border-emerald-500/25 bg-emerald-950/20">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Đã có trong CV ({cvDisplayKWs.length})
                </h4>
                <span className="text-[11px] font-bold text-emerald-400">Đạt yêu cầu</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {cvDisplayKWs
                  .filter((k) => !keywordSearch || k.toLowerCase().includes(keywordSearch.toLowerCase()))
                  .map((kw, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/[0.05] border border-emerald-500/30 text-emerald-200 text-xs font-bold"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      {kw}
                    </span>
                  ))}
              </div>
            </div>

            {/* Missing Panel */}
            <div className="p-5 rounded-2xl border border-rose-500/25 bg-rose-950/20">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                  <Warning className="w-4 h-4 text-rose-400" />
                  Còn thiếu trong CV ({missingKws.length})
                </h4>
                <span className="text-[11px] font-bold text-rose-400">Cần bổ sung</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {missingKws
                  .filter((k) => !keywordSearch || k.toLowerCase().includes(keywordSearch.toLowerCase()))
                  .map((kw, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/[0.05] border border-rose-500/30 text-rose-200 text-xs font-bold"
                    >
                      <Warning className="w-3.5 h-3.5 text-rose-400" />
                      {kw}
                    </span>
                  ))}
                {missingKws.length === 0 && (
                  <p className="text-xs text-emerald-300 font-medium italic">Không có từ khóa thiếu nào!</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="grid grid-cols-1 gap-0 overflow-hidden rounded-3xl border border-white/15 bg-[#1d182d] md:grid-cols-2" aria-label="Bước tiếp theo">
        {[
          { icon: Mic, title: "Luyện phỏng vấn với AI", description: "Luyện trả lời câu hỏi dựa trên CV và vị trí bạn ứng tuyển.", label: "Vào phòng phỏng vấn AI", path: "/interview", primary: true },
          { icon: Users, title: "Review CV cùng Mentor", description: "Nhận góp ý trực tiếp để hoàn thiện hồ sơ và cách trình bày kinh nghiệm.", label: "Tìm Mentor phù hợp", path: "/mentors", primary: false },
        ].map(({ icon: Icon, title, description, label, path, primary }) => (
          <div key={path} className="flex flex-col p-6 sm:p-8 [&+div]:border-t [&+div]:border-white/10 md:[&+div]:border-l md:[&+div]:border-t-0">
            <Icon className="mb-5 h-6 w-6 text-[#c5aff0]" strokeWidth={1.6} aria-hidden />
            <h3 className="text-lg font-semibold tracking-tight text-white">{title}</h3>
            <p className="mb-7 mt-2 max-w-md text-sm leading-relaxed text-[#bfb5cf]">{description}</p>
            <button data-button-surface="none" type="button" onClick={() => navigate(path)}
              className={primary
                ? "cv-analyze-cta mt-auto inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all"
                : "mt-auto inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#b799dc] bg-[#2b213b] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#382b4b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b799dc]"}
            >
              {label}<ArrowUpRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
      </section>

      {/* ─── Helpful Feedback Dock (Translucent Glass exactly as in user's image) ─── */}
      <div className="flex flex-wrap items-center justify-center gap-3 px-4 py-5 max-w-xl mx-auto w-full">
        {feedbackSent ? (
          <p className="text-xs sm:text-sm font-bold text-violet-300 flex items-center gap-1.5 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-400" />
            {feedbackState === "helpful"
              ? "Cảm ơn bạn! Phản hồi giúp AI ngày càng chuẩn xác hơn."
              : "Cảm ơn bạn! Đội ngũ sẽ tiếp tục tinh chỉnh thuật toán."}
          </p>
        ) : (
          <>
            <span className="text-xs text-slate-300 font-medium">Báo cáo phân tích này có hữu ích không?</span>
            <div className="flex items-center gap-2">
              <button
                data-button-surface="none" type="button"
                onClick={() => handleFeedback("helpful")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/15 bg-white/[0.05] hover:border-emerald-400/50 hover:bg-emerald-500/15 hover:text-emerald-300 text-xs font-bold text-slate-200 transition active:scale-95"
              >
                <ThumbsUp className="w-3.5 h-3.5" /> Hữu ích
              </button>
              <button
                data-button-surface="none" type="button"
                onClick={() => handleFeedback("not_helpful")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/15 bg-white/[0.05] hover:border-rose-400/50 hover:bg-rose-500/15 hover:text-rose-300 text-xs font-bold text-slate-400 transition active:scale-95"
              >
                <ThumbsDown className="w-3.5 h-3.5" /> Chưa tốt
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

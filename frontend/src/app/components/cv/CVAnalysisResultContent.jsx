import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
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
      label: "Gợi ý sửa CV (STAR)",
      icon: <Sparkles className="w-4 h-4" />,
      badge: suggestionsData.length || undefined,
    },
    ...(derivedMode === "jd"
      ? [
          {
            id: "preview",
            label: "Xem tài liệu PDF",
            icon: <FileText className="w-4 h-4" />,
          },
        ]
      : []),
    {
      id: "keywords",
      label: "Ma trận từ khóa",
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
        <div className="flex items-center gap-3 flex-wrap">
          <nav className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <button
              type="button"
              onClick={() => navigate("/cv-analysis")}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Phân tích CV
            </button>
            <span className="text-slate-500">›</span>
            <button
              type="button"
              onClick={() => navigate(resolvedHistoryPath)}
              className="hover:text-white transition-colors cursor-pointer text-slate-400"
            >
              Lịch sử
            </button>
            <span className="text-slate-500">›</span>
            <span className="text-slate-100 font-semibold truncate max-w-xs">
              {[R?.position, R?.company].filter(Boolean).join(" · ") || cvFileName || "Kết quả chi tiết"}
            </span>
          </nav>

          <div className="h-4 w-px bg-white/15 hidden sm:block" />

          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-300/90">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            {derivedMode === "field" ? "Theo ngành nghề" : "Khớp CV & JD"}
          </span>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => navigate(resolvedAnalysisPath)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 hover:text-white text-xs sm:text-sm font-bold transition-all active:scale-95 group"
          >
            <PlusCircle className="w-4 h-4 text-violet-400 transition-transform duration-300 group-hover:rotate-90" />
            <span>Phân tích mới</span>
          </button>

          <button
            type="button"
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

      {/* ─── Hero Bento Scoreboard (Gọn gàng - Đúng trọng tâm) ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Left Card: Radial Score Gauge (Radiant Cyber-Glass Highlight) */}
        <div className="lg:col-span-4 rounded-3xl border border-violet-500/30 bg-gradient-to-b from-white/[0.08] via-white/[0.03] to-transparent shadow-[0_16px_50px_rgba(124,58,237,0.22)] backdrop-blur-2xl p-6 sm:p-7 flex flex-col items-center justify-between relative overflow-hidden group/score hover:-translate-y-1.5 hover:border-violet-400/70 hover:shadow-[0_22px_60px_rgba(124,58,237,0.38)] transition-all duration-500">
          {/* Top laser beam sweep */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-violet-400 to-transparent opacity-60 group-hover/score:opacity-100 transition-opacity duration-700" />
          
          {/* Ambient luminous glow orbs */}
          <div className="pointer-events-none absolute -right-10 -top-10 w-48 h-48 bg-violet-500/25 rounded-full blur-3xl animate-pulse group-hover/score:scale-125 transition-transform duration-700" />
          <div className="pointer-events-none absolute -left-10 -bottom-10 w-40 h-40 bg-fuchsia-500/15 rounded-full blur-2xl" />

          {/* Header Row: Title with icon */}
          <div className="w-full flex items-center gap-2 mb-3 relative z-10">
            <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-400/30 flex items-center justify-center text-violet-300 shadow-xs">
              <Target className="w-3.5 h-3.5 text-violet-300" />
            </div>
            <span className="text-xs font-black uppercase tracking-wider text-slate-200">
              Độ khớp tổng thể
            </span>
          </div>

          {/* SVG Radial Gauge with Vibrant Glowing Multi-layer Ring */}
          <div className="relative my-4 flex items-center justify-center z-10">
            <div className="relative w-40 h-40 sm:w-44 sm:h-44">
              <svg className="w-full h-full transform -rotate-90 overflow-visible" viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="scoreEmeraldDark" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="50%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#34d399" />
                  </linearGradient>
                  <linearGradient id="scoreVioletDark" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="50%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#c084fc" />
                  </linearGradient>
                  <linearGradient id="scoreAmberDark" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="50%" stopColor="#fb923c" />
                    <stop offset="100%" stopColor="#f43f5e" />
                  </linearGradient>
                </defs>

                {/* Subtle outer track */}
                <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" strokeDasharray="2 3" />

                {/* Main track */}
                <circle cx="50" cy="50" r="41" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="9" />

                {/* Soft ambient glow halo (vector geometry, completely round with zero rectangular clipping) */}
                <circle
                  cx="50"
                  cy="50"
                  r="41"
                  fill="none"
                  stroke={scoreTier === "high" ? "url(#scoreEmeraldDark)" : scoreTier === "mid" ? "url(#scoreVioletDark)" : "url(#scoreAmberDark)"}
                  strokeWidth="13"
                  strokeDasharray={`${strokeDash} 263.89`}
                  strokeLinecap="round"
                  className="opacity-30 transition-all duration-300 ease-out"
                />

                {/* Sharp main progress stroke */}
                <circle
                  cx="50"
                  cy="50"
                  r="41"
                  fill="none"
                  stroke={scoreTier === "high" ? "url(#scoreEmeraldDark)" : scoreTier === "mid" ? "url(#scoreVioletDark)" : "url(#scoreAmberDark)"}
                  strokeWidth="9"
                  strokeDasharray={`${strokeDash} 263.89`}
                  strokeLinecap="round"
                  className="transition-all duration-300 ease-out"
                />
              </svg>

              {/* Center Counter with 3D Gradient Typography */}
              <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
                <span className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-violet-200 leading-none tracking-tight tabular-nums transition-transform duration-300 group-hover/score:scale-105 drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]">
                  {displayScore}
                </span>
                <span className="text-[11px] font-black text-violet-300/80 mt-1 uppercase tracking-widest">
                  / 100 điểm
                </span>
              </div>
            </div>
          </div>

          {/* Micro Keyword Coverage Footer Dock */}
          <div className="w-full mt-2 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md relative z-10 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                Độ phủ từ khóa yêu cầu
              </span>
              <span className="text-violet-300 font-extrabold tabular-nums">
                {cvDisplayKWs.length}/{totalKeywords} ({keywordMatchPct}%)
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-900 border border-white/10 overflow-hidden p-0.5 relative">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-emerald-400 shadow-[0_0_10px_rgba(124,58,237,0.5)] transition-all duration-1000 ease-out relative overflow-hidden"
                style={{ width: `${keywordMatchPct}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_2.5s_infinite]" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: AI Assessment & Key Skill Pills (8 cols on lg) */}
        <div className="lg:col-span-8 rounded-3xl border border-white/10 bg-gradient-to-b from-[#181538]/70 via-[#13112b]/75 to-[#0d0b21]/80 shadow-[0_12px_40px_rgba(0,0,0,0.4)] backdrop-blur-2xl p-6 sm:p-7 flex flex-col justify-between group/ai hover:-translate-y-1 hover:border-violet-500/40 hover:shadow-[0_16px_45px_rgba(124,58,237,0.22)] transition-all duration-500">
          <div>
            {/* AI Summary - Trực diện, tinh gọn */}
            {cleanSummary && (
              <p className="text-sm sm:text-base leading-relaxed text-slate-200 font-normal">
                {cleanSummary}
              </p>
            )}
          </div>

          {/* 2 Clean Skill Tag Rows: Matched vs Missing */}
          <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-white/10">
            {/* Row 1: Matched Skills */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-bold text-emerald-300 shrink-0 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Đã khớp ({cvDisplayKWs.length}):
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {cvDisplayKWs.map((kw, i) => (
                  <span
                    key={`m-${i}`}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-200 text-xs font-medium hover:scale-105 hover:bg-emerald-500/20 hover:border-emerald-500/40 active:scale-95 transition-all duration-200 cursor-default select-none shadow-xs"
                  >
                    {kw}
                  </span>
                ))}
                {cvDisplayKWs.length === 0 && (
                  <span className="text-xs text-slate-400 italic">Chưa khớp từ khóa</span>
                )}
              </div>
            </div>

            {/* Row 2: Missing Skills */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-bold text-rose-300 shrink-0 flex items-center gap-1.5">
                <Warning className="w-4 h-4 text-rose-400" />
                Còn thiếu ({missingKws.length}):
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {missingKws.map((kw, i) => (
                  <span
                    key={`mis-${i}`}
                    className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-200 text-xs font-medium hover:scale-105 hover:bg-rose-500/20 hover:border-rose-500/40 active:scale-95 transition-all duration-200 cursor-default select-none shadow-xs"
                  >
                    {kw}
                  </span>
                ))}
                {missingKws.length === 0 && (
                  <span className="text-xs text-emerald-300 font-medium">Đã phủ kín toàn bộ từ khóa!</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

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
                type="button"
                role="tab"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setActiveTab(item.id)}
                className={`relative flex-1 sm:flex-initial px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 sm:gap-2.5 select-none outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                  isSelected
                    ? "text-white font-bold"
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
                    Đề xuất chỉnh sửa & Bổ sung kỹ năng
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    AI tóm tắt hành động trọng tâm và lộ trình khóa học. Bấm "Chi tiết" để mở rộng giải trình.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
                {/* View mode toggle: Compact vs Full (Identical Floating Glass Dock) */}
                <div
                  className="relative flex items-center p-1 rounded-2xl border border-white/15 bg-gradient-to-b from-[#1c183d]/85 via-[#14122e]/90 to-[#0e0c24]/95 shadow-[0_4px_16px_rgba(5,3,20,0.4),inset_0_1px_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl"
                  role="tablist"
                  aria-label="Chế độ xem"
                >
                  <button
                    type="button"
                    onClick={() => setSuggestionViewMode("compact")}
                    className={`relative px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 select-none outline-none ${
                      suggestionViewMode === "compact"
                        ? "text-white font-bold"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                    }`}
                    title="Hiển thị dạng thẻ tóm lược dễ đọc"
                  >
                    {suggestionViewMode === "compact" && (
                      <motion.div
                        layoutId="cv-view-mode-dock"
                        className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/[0.18] via-white/[0.08] to-transparent border border-white/20 border-t-white/35 shadow-[0_2px_8px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.25)] backdrop-blur-md"
                        transition={{ type: "spring", stiffness: 450, damping: 35 }}
                      />
                    )}
                    <LayoutList className="w-3.5 h-3.5 relative z-10" />
                    <span className="relative z-10">Gọn gàng</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSuggestionViewMode("full")}
                    className={`relative px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 select-none outline-none ${
                      suggestionViewMode === "full"
                        ? "text-white font-bold"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                    }`}
                    title="Mở rộng toàn bộ chi tiết giải trình"
                  >
                    {suggestionViewMode === "full" && (
                      <motion.div
                        layoutId="cv-view-mode-dock"
                        className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/[0.18] via-white/[0.08] to-transparent border border-white/20 border-t-white/35 shadow-[0_2px_8px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.25)] backdrop-blur-md"
                        transition={{ type: "spring", stiffness: 450, damping: 35 }}
                      />
                    )}
                    <BookOpen className="w-3.5 h-3.5 relative z-10" />
                    <span className="relative z-10">Chi tiết</span>
                  </button>
                </div>

                {/* Filter pills (Identical Floating Glass Dock) */}
                {suggestionsData.length > 0 && (
                  <div
                    className="relative flex items-center p-1 rounded-2xl border border-white/15 bg-gradient-to-b from-[#1c183d]/85 via-[#14122e]/90 to-[#0e0c24]/95 shadow-[0_4px_16px_rgba(5,3,20,0.4),inset_0_1px_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl"
                    role="tablist"
                    aria-label="Lọc đề xuất"
                  >
                    {[
                      { id: "all", label: "Tất cả", count: suggestionsData.length },
                      ...(starCount > 0 ? [{ id: "fix", label: "Viết lại STAR", count: starCount }] : []),
                      ...(addCount > 0 ? [{ id: "add", label: "Bổ sung kỹ năng", count: addCount }] : []),
                    ].map((item) => {
                      const isSelected = suggestionFilter === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSuggestionFilter(item.id)}
                          className={`relative px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 select-none outline-none ${
                            isSelected
                              ? "text-white font-bold"
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
                                type="button"
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
                                type="button"
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
                                  type="button"
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
                                type="button"
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
                                type="button"
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
                    type="button"
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
                type="button"
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
                Ma trận từ khóa kỹ thuật & Năng lực
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
                      type="button"
                      onClick={() => setKeywordFilter(item.id)}
                      className={`relative px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 select-none outline-none ${
                        isSelected
                          ? "text-white font-bold"
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

      {/* ─── High-Conversion Next Steps CTAs (Concise, Ultra-Polished & Animated) ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 mt-1">
        {/* Card 1: Mock Interview */}
        <div className="relative overflow-hidden flex flex-col justify-between p-6 sm:p-7 rounded-3xl border border-white/15 bg-gradient-to-b from-white/[0.08] via-white/[0.03] to-transparent backdrop-blur-2xl shadow-[0_10px_35px_rgba(124,58,237,0.15)] hover:border-violet-400/70 hover:shadow-[0_20px_50px_rgba(124,58,237,0.35)] hover:-translate-y-1.5 transition-all duration-500 group">
          {/* Top animated light beam sweep */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-violet-400 to-transparent opacity-40 group-hover:opacity-100 group-hover:scale-x-110 transition-all duration-700" />
          
          {/* Ambient breathing glow orbs */}
          <div className="pointer-events-none absolute -right-12 -top-12 w-48 h-48 bg-violet-500/20 rounded-full blur-3xl animate-pulse group-hover:scale-135 group-hover:bg-violet-500/35 transition-all duration-700" />
          <div className="pointer-events-none absolute -left-12 -bottom-12 w-40 h-40 bg-fuchsia-500/15 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700" />

          <div className="relative z-10">
            <div className="mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 via-indigo-600 to-fuchsia-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/35 ring-1 ring-white/25 group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-all duration-300">
                <Mic className="w-6 h-6 text-white" />
              </div>
            </div>

            <h4 className="text-base sm:text-lg font-bold text-white group-hover:text-violet-200 transition-colors tracking-tight">
              Luyện phỏng vấn AI theo JD này
            </h4>
            <p className="text-xs sm:text-sm text-slate-300/90 mt-1.5 leading-relaxed font-normal">
              Tự động tạo câu hỏi phỏng vấn thử dựa trên CV và JD để bạn luyện phản xạ.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/interview")}
            className="mt-6 relative z-10 overflow-hidden inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-500 text-white text-xs sm:text-sm font-bold shadow-[0_6px_24px_rgba(124,58,237,0.45)] hover:shadow-[0_10px_35px_rgba(124,58,237,0.7)] hover:brightness-110 active:scale-[0.98] transition-all duration-300 cursor-pointer group/btn before:absolute before:inset-0 before:-translate-x-full hover:before:translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/25 before:to-transparent before:transition-transform before:duration-700"
          >
            <span className="relative z-10">Vào phòng phỏng vấn AI</span>
            <ArrowUpRight className="w-4 h-4 relative z-10 group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform duration-300" />
          </button>
        </div>

        {/* Card 2: Mentor 1-on-1 */}
        <div className="relative overflow-hidden flex flex-col justify-between p-6 sm:p-7 rounded-3xl border border-white/15 bg-gradient-to-b from-white/[0.08] via-white/[0.03] to-transparent backdrop-blur-2xl shadow-[0_10px_35px_rgba(99,102,241,0.15)] hover:border-indigo-400/70 hover:shadow-[0_20px_50px_rgba(99,102,241,0.35)] hover:-translate-y-1.5 transition-all duration-500 group">
          {/* Top animated light beam sweep */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-400 to-transparent opacity-40 group-hover:opacity-100 group-hover:scale-x-110 transition-all duration-700" />
          
          {/* Ambient breathing glow orbs */}
          <div className="pointer-events-none absolute -right-12 -top-12 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl animate-pulse group-hover:scale-135 group-hover:bg-indigo-500/35 transition-all duration-700" />
          <div className="pointer-events-none absolute -left-12 -bottom-12 w-40 h-40 bg-sky-500/15 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700" />

          <div className="relative z-10">
            <div className="mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/35 ring-1 ring-white/25 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-[0_0_30px_rgba(99,102,241,0.6)] transition-all duration-300">
                <Users className="w-6 h-6 text-white" />
              </div>
            </div>

            <h4 className="text-base sm:text-lg font-bold text-white group-hover:text-indigo-200 transition-colors tracking-tight">
              Gặp Mentor review CV 1:1
            </h4>
            <p className="text-xs sm:text-sm text-slate-300/90 mt-1.5 leading-relaxed font-normal">
              Nhận góp ý trực tiếp từ các Tech Lead và Hiring Manager để nâng cấp CV.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/mentors")}
            className="mt-6 relative z-10 overflow-hidden inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-500 text-white text-xs sm:text-sm font-bold shadow-[0_6px_24px_rgba(99,102,241,0.45)] hover:shadow-[0_10px_35px_rgba(99,102,241,0.7)] hover:brightness-110 active:scale-[0.98] transition-all duration-300 cursor-pointer group/btn before:absolute before:inset-0 before:-translate-x-full hover:before:translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/25 before:to-transparent before:transition-transform before:duration-700"
          >
            <span className="relative z-10">Tìm Mentor phù hợp</span>
            <ArrowUpRight className="w-4 h-4 relative z-10 group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform duration-300" />
          </button>
        </div>
      </div>

      {/* ─── Helpful Feedback Dock (Translucent Glass exactly as in user's image) ─── */}
      <div className="flex items-center justify-center gap-3 p-3.5 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md shadow-sm max-w-lg mx-auto w-full">
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
                type="button"
                onClick={() => handleFeedback("helpful")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/15 bg-white/[0.05] hover:border-emerald-400/50 hover:bg-emerald-500/15 hover:text-emerald-300 text-xs font-bold text-slate-200 transition active:scale-95"
              >
                <ThumbsUp className="w-3.5 h-3.5" /> Hữu ích
              </button>
              <button
                type="button"
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

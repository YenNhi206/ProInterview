import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router";
import { AlertCircle, ArrowDownWideNarrow, ArrowUpRight, Briefcase, ChevronDown, FileText, Plus, RefreshCw, Search, X, Trophy, Target, Sparkles, FileCheck, CheckCircle2, Lightbulb } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { fetchCvAnalyses, fetchCvAnalysisById } from "../../api/cvApi.js";
import { isLoggedIn, hasAuthCredentials } from "../../utils/auth/auth.js";
import { buildLoginPath } from "../../utils/auth/authGate.js";
import { AccountReveal, AccountTabIndicator } from "../../components/account/AccountMotion";
import { AppSelect } from "../../components/ui/AppSelect";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";
import { CV_JD_ANALYSIS_PATH, CV_FIELD_ANALYSIS_PATH, cvAnalysisResultPath } from "../../components/cv/CvJdAnalysisTabs";
import "../../../styles/cv-history.css";

const MODE_TABS = [
  { value: "all", label: "Tất cả" },
  { value: "jd", label: "CV + JD" },
  { value: "field", label: "Theo ngành" },
];
const SORT_OPTIONS = [
  { value: "date", label: "Mới nhất" },
  { value: "score", label: "Điểm cao" },
];

function AnimatedNumber({ value, duration = 1 }) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValueRef = React.useRef(0);

  useEffect(() => {
    const start = prevValueRef.current;
    const end = Math.round(Number(value) || 0);
    prevValueRef.current = end;

    if (start === end) {
      setDisplayValue(end);
      return;
    }

    const startTime = performance.now();
    const durationMs = Math.max(300, duration * 1000);

    let frameId;
    const update = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // Smooth ease-out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * ease);
      setDisplayValue(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(update);
      } else {
        setDisplayValue(end);
      }
    };

    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, [value, duration]);

  return <>{displayValue}</>;
}

function mapRow(item) {
  const isField = item.mode === "field" || (!item.jdFileName && !item.jdFile && Boolean(item.field));
  return {
    id: item.analysisId || item.id,
    mode: item.mode === "jd" || item.mode === "field" ? item.mode : isField ? "field" : "jd",
    field: item.field || null,
    cvFile: item.cvFileName || item.cvFile || "cv.pdf",
    jdFile: item.jdFileName || item.jdFile || null,
    matchScore: Math.min(100, Math.max(0, Number(item.matchScore) || 0)),
    createdAt: item.createdAt || item.date || "",
    company: item.company || null,
    position: item.position || null,
  };
}

function searchText(value) {
  return String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[đĐ]/g, "d").toLowerCase();
}

function AnalysisPreview({ item }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchCvAnalysisById(item.id).then((res) => {
      if (cancelled) return;
      setDetail(res.success ? res.analysis : null);
      setError(res.success && res.analysis ? "" : "Không tải được bản xem trước.");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [item.id, attempt]);

  const matched = detail?.matchedKeywords || [];
  const missing = detail?.missingKeywords || [];
  const total = matched.length + missing.length;
  const pct = total ? Math.round((matched.length / total) * 100) : 0;

  return (
    <div className="border-t border-white/10 p-5 sm:p-6 bg-gradient-to-b from-[#110f29]/50 to-[#0a081a]/80 space-y-5">
      {loading && (
        <div className="flex items-center gap-3 py-6 justify-center text-slate-300 text-sm font-medium" role="status">
          <RefreshCw size={18} className="animate-spin text-violet-400" />
          <span>Đang tải thông tin chi tiết phân tích…</span>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-200 text-sm" role="alert">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" className="text-xs font-bold text-violet-300 underline hover:text-white" onClick={() => setAttempt((n) => n + 1)}>
            Thử lại
          </button>
        </div>
      )}

      {!loading && detail && (
        <>
          {/* Executive AI Summary Box */}
          {detail.summary && (
            <div className="relative overflow-hidden rounded-xl p-4 sm:p-5 bg-gradient-to-r from-violet-950/30 via-slate-900/60 to-indigo-950/30 border border-violet-400/20 shadow-inner">
              <div className="flex items-center gap-2 mb-2 text-violet-300">
                <Sparkles size={15} />
                <span className="text-xs font-extrabold uppercase tracking-wider text-violet-200">Đánh giá tổng quan từ AI</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal">
                {String(detail.summary).replace(/^[✨⭐]\s*/u, "").trim()}
              </p>
            </div>
          )}

          {/* Keywords Bento Grid */}
          {total > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Match Score */}
              <div className="rounded-xl p-4 bg-white/[0.03] border border-white/10 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-300 font-bold mb-2">
                    <span>Tỷ lệ từ khóa khớp</span>
                    <span className="text-violet-300 tabular-nums">{matched.length}/{total} ({pct}%)</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-900 border border-white/10 overflow-hidden p-0.5">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-emerald-400"
                      initial={{ width: 0 }}
                      animate={{ width: pct + "%" }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-3">
                  {pct >= 70 ? "Hồ sơ đáp ứng rất tốt yêu cầu từ khóa." : "Nên bổ sung thêm các từ khóa còn thiếu bên cạnh."}
                </p>
              </div>

              {/* Card 2: Matched keywords */}
              <div className="rounded-xl p-4 bg-emerald-950/20 border border-emerald-500/20">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 size={14} />
                    Đã có ({matched.length})
                  </span>
                </div>
                <ul className="flex flex-wrap gap-1.5 list-none p-0 m-0">
                  {matched.slice(0, 6).map((word, index) => (
                    <li key={word + "-" + index} className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-200 text-xs font-medium">
                      {word}
                    </li>
                  ))}
                  {matched.length > 6 && (
                    <li className="px-2 py-1 text-xs text-emerald-400/80 font-medium">
                      +{matched.length - 6} khác
                    </li>
                  )}
                  {matched.length === 0 && (
                    <li className="text-xs text-slate-400 italic">Không có từ khóa khớp</li>
                  )}
                </ul>
              </div>

              {/* Card 3: Missing keywords */}
              <div className="rounded-xl p-4 bg-rose-950/20 border border-rose-500/20">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle size={14} />
                    Còn thiếu ({missing.length})
                  </span>
                </div>
                <ul className="flex flex-wrap gap-1.5 list-none p-0 m-0">
                  {missing.slice(0, 6).map((word, index) => (
                    <li key={word + "-" + index} className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-200 text-xs font-medium">
                      {word}
                    </li>
                  ))}
                  {missing.length > 6 && (
                    <li className="px-2 py-1 text-xs text-rose-400/80 font-medium">
                      +{missing.length - 6} khác
                    </li>
                  )}
                  {missing.length === 0 && (
                    <li className="text-xs text-emerald-300 font-medium">Đã phủ kín toàn bộ từ khóa!</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {!detail.summary && total === 0 && (
            <p className="text-xs text-slate-400 italic">Mở kết quả để xem toàn bộ phân tích chi tiết.</p>
          )}
        </>
      )}

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          {detail && !loading && (
            <>
              <Lightbulb size={15} className="text-amber-400" />
              <span>{(detail.suggestions || []).length} gợi ý cải thiện hồ sơ</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2.5 ml-auto">
          <Link
            to={item.mode === "field" ? CV_FIELD_ANALYSIS_PATH : CV_JD_ANALYSIS_PATH}
            state={item.mode === "field" && item.field ? { field: item.field } : undefined}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-bold transition-all active:scale-95"
          >
            <RefreshCw size={14} aria-hidden="true" />
            Phân tích lại
          </Link>
          <Link
            to={cvAnalysisResultPath(item.mode, item.id)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-500 text-white shadow-[0_4px_16px_rgba(124,58,237,0.35)] hover:brightness-110 active:scale-95 text-xs font-bold transition-all group"
          >
            <span>Xem kết quả</span>
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
              <ArrowUpRight size={13} aria-hidden="true" />
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function AnalysisRow({ item, expanded, onToggle, index }) {
  const title = item.position || item.cvFile;
  const date = new Date(item.createdAt);
  const validDate = Boolean(item.createdAt) && !Number.isNaN(date.getTime());

  // Determine score tier for custom medal glowing
  const scoreTier =
    item.matchScore >= 80 ? "high" :
    item.matchScore >= 50 ? "mid" : "low";

  return (
    <AccountReveal as="article" index={index} className={`cv-history-row rounded-2xl border transition-all duration-300 overflow-hidden ${
      expanded
        ? "border-violet-400/40 bg-gradient-to-b from-[#1c183f]/90 via-[#13112c]/90 to-[#0e0c24]/95 shadow-[0_16px_40px_rgba(124,58,237,0.22)] ring-1 ring-violet-400/25"
        : "border-white/10 bg-gradient-to-b from-[#181538]/70 via-[#13112b]/75 to-[#0d0b21]/80 shadow-[0_8px_30px_rgba(0,0,0,0.35)] hover:border-violet-400/35 hover:shadow-[0_12px_36px_rgba(124,58,237,0.18)] hover:-translate-y-0.5"
    }`}>
      <button
        type="button"
        className="w-full flex items-center justify-between p-4 sm:p-5 text-left cursor-pointer group select-none gap-4 sm:gap-6 outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
        aria-expanded={expanded}
        aria-controls={"cv-preview-" + item.id}
        onClick={onToggle}
      >
        <div className="flex items-center gap-4 sm:gap-5 min-w-0 flex-1">
          {/* Glowing Glass Score Medal */}
          <div className={`shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex flex-col items-center justify-center border backdrop-blur-xl shadow-lg transition-transform group-hover:scale-105 duration-200 ${
            scoreTier === "high"
              ? "bg-gradient-to-br from-emerald-500/20 via-emerald-600/10 to-teal-500/10 border-emerald-400/35 text-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.25)]"
              : scoreTier === "mid"
              ? "bg-gradient-to-br from-violet-500/25 via-indigo-600/15 to-violet-500/10 border-violet-400/35 text-violet-200 shadow-[0_0_18px_rgba(124,58,237,0.25)]"
              : "bg-gradient-to-br from-amber-500/20 via-orange-600/10 to-amber-500/10 border-amber-400/35 text-amber-300 shadow-[0_0_18px_rgba(245,158,11,0.2)]"
          }`}>
            <span className="text-xl sm:text-2xl font-black tracking-tight leading-none tabular-nums">
              <AnimatedNumber value={item.matchScore} duration={0.8} />
            </span>
            <span className="text-[9px] sm:text-[10px] font-bold opacity-75 uppercase tracking-wider mt-0.5 sm:mt-1">
              / 100
            </span>
          </div>

          {/* Details Content */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                item.mode === "field"
                  ? "bg-sky-500/20 text-sky-300 border border-sky-400/30"
                  : "bg-violet-500/20 text-violet-300 border border-violet-400/30"
              }`}>
                {item.mode === "field" ? "Theo ngành" : "CV + JD"}
              </span>
              {(item.field || item.company) && (
                <span className="text-xs font-medium text-slate-300 truncate">
                  {[item.mode === "field" ? item.field : null, item.company].filter(Boolean).join(" · ")}
                </span>
              )}
            </div>

            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight truncate group-hover:text-violet-200 transition-colors" title={title}>
              {title}
            </h3>

            {/* Attached Files Chips */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {item.cvFile && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] sm:text-xs text-slate-300 font-medium max-w-[280px]" title={item.cvFile}>
                  <FileText size={12} className="text-violet-400 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.cvFile}</span>
                </span>
              )}
              {item.jdFile && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] sm:text-xs text-slate-300 font-medium max-w-[280px]" title={item.jdFile}>
                  <Briefcase size={12} className="text-indigo-400 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.jdFile}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Info: Date + Chevron */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          {validDate && (
            <time className="hidden sm:flex flex-col items-end text-xs text-slate-400 tabular-nums" dateTime={date.toISOString()}>
              <span className="font-semibold text-slate-200">{date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
              <span className="text-[11px] text-slate-400/80">{date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
            </time>
          )}

          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all duration-300 ${
            expanded
              ? "bg-violet-500/20 border-violet-400/40 text-violet-200 shadow-[0_0_12px_rgba(167,139,250,0.3)]"
              : "bg-white/5 border-white/10 text-slate-400 group-hover:text-white group-hover:border-white/20"
          }`}>
            <ChevronDown
              size={18}
              className={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </div>
        </div>
      </button>

      {/* Accordion Expandable Preview */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={"cv-preview-" + item.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: "hidden" }}
          >
            <AnalysisPreview item={item} />
          </motion.div>
        )}
      </AnimatePresence>
    </AccountReveal>
  );
}

export function CVAnalysisHistoryHub() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialMode = useMemo(() => {
    const qMode = searchParams.get("mode");
    if (qMode === "jd" || qMode === "field" || qMode === "all") return qMode;
    if (location.pathname.includes("/cv-analysis/field")) return "field";
    if (location.pathname.includes("/cv-analysis/jd")) return "jd";
    return "all";
  }, [searchParams, location.pathname]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [modeTab, setModeTab] = useState(initialMode);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    const qMode = searchParams.get("mode");
    if (qMode && (qMode === "jd" || qMode === "field" || qMode === "all")) {
      setModeTab(qMode);
    } else if (location.pathname.includes("/cv-analysis/field")) {
      setModeTab("field");
    } else if (location.pathname.includes("/cv-analysis/jd")) {
      setModeTab("jd");
    }
  }, [searchParams, location.pathname]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const res = await fetchCvAnalyses();
    setLoading(false);
    if (!res.success) {
      setLoadError(res.error || "Không tải được lịch sử.");
      return;
    }
    setRows((res.analyses || []).map(mapRow));
  }, []);

  useEffect(() => {
    if (!isLoggedIn() || !hasAuthCredentials()) {
      navigate(buildLoginPath("/cv-analysis/history"), { replace: true });
      return;
    }
    loadRows();
  }, [loadRows, navigate]);

  useEffect(() => {
    window.addEventListener("cv-analysis-saved", loadRows);
    return () => window.removeEventListener("cv-analysis-saved", loadRows);
  }, [loadRows]);

  const filteredData = useMemo(() => {
    const query = searchText(searchQuery.trim());
    return rows
      .filter((row) => modeTab === "all" || row.mode === modeTab)
      .filter((row) => !query || [row.cvFile, row.jdFile, row.field, row.company, row.position].some((value) => searchText(value).includes(query)))
      .sort((a, b) => sortBy === "score" ? b.matchScore - a.matchScore : new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [rows, modeTab, searchQuery, sortBy]);

  const counts = { all: rows.length, jd: rows.filter((r) => r.mode === "jd").length, field: rows.filter((r) => r.mode === "field").length };
  const avgScore = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.matchScore, 0) / rows.length) : 0;
  const bestScore = rows.length ? Math.max(...rows.map((r) => r.matchScore)) : 0;

  function changeTab(value) {
    setModeTab(value);
    setSelectedId(null);
    setSearchParams(value === "all" ? {} : { mode: value }, { replace: true });
  }

  function onTabKeyDown(event, index) {
    const last = MODE_TABS.length - 1;
    const next = event.key === "ArrowRight" ? (index + 1) % MODE_TABS.length : event.key === "ArrowLeft" ? (index + last) % MODE_TABS.length : event.key === "Home" ? 0 : event.key === "End" ? last : null;
    if (next === null) return;
    event.preventDefault();
    changeTab(MODE_TABS[next].value);
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next].focus();
  }

  return (
    <div className={"cv-history-page " + CUSTOMER_SHELL_GUTTER + " pb-24 pt-8 sm:pt-12"}>
      <div className={CUSTOMER_SHELL_MAX + " cv-history-frame"}>
        <motion.header
          className="cv-history-header"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <h1>Lịch sử phân tích CV</h1>
          <p>Xem lại kết quả và cải thiện hồ sơ của bạn.</p>
        </motion.header>

        {/* Prominent Scoreboard Cards with Rich Motion */}
        <div className="my-7">
          {rows.length > 0 ? (
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { staggerChildren: 0.12, delayChildren: 0.05 },
                },
              }}
            >
              {/* Card 1: Điểm trung bình */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
                }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="relative overflow-hidden rounded-2xl border border-violet-400/30 bg-gradient-to-br from-[#23174a]/90 via-[#18133b]/85 to-[#120f2e]/90 p-5 shadow-[0_12px_32px_rgba(10,8,30,0.4)] backdrop-blur-xl transition-all duration-300 hover:border-violet-400/50 hover:shadow-[0_16px_40px_rgba(124,58,237,0.28)]"
              >
                <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-violet-500/20 blur-2xl" />
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-violet-500/20 text-violet-300 ring-1 ring-violet-400/30">
                      <Target size={15} />
                    </span>
                    Điểm trung bình
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-violet-200 to-indigo-200 tabular-nums">
                    <AnimatedNumber value={avgScore} duration={1.1} />
                  </span>
                  <span className="text-sm font-bold text-violet-300/70">/ 100</span>
                </div>
                <div className="mt-3.5">
                  <div className="h-2 w-full rounded-full bg-slate-900/80 overflow-hidden p-0.5 border border-white/5">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-violet-300 shadow-[0_0_12px_rgba(124,58,237,0.5)]"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(5, avgScore)}%` }}
                      transition={{ duration: 0.85, ease: "easeOut", delay: 0.2 }}
                    />
                  </div>
                </div>
              </motion.div>

              {/* Card 2: Điểm cao nhất */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
                }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="relative overflow-hidden rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-[#0e2927]/90 via-[#0d2027]/85 to-[#0f1729]/90 p-5 shadow-[0_12px_32px_rgba(10,8,30,0.4)] backdrop-blur-xl transition-all duration-300 hover:border-emerald-400/50 hover:shadow-[0_16px_40px_rgba(16,185,129,0.28)]"
              >
                <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-emerald-500/20 blur-2xl" />
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30">
                      <Trophy size={15} />
                    </span>
                    Điểm cao nhất
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-emerald-200 to-teal-200 tabular-nums">
                    <AnimatedNumber value={bestScore} duration={1.1} />
                  </span>
                  <span className="text-sm font-bold text-emerald-300/70">/ 100</span>
                </div>
                <div className="mt-3.5">
                  <div className="h-2 w-full rounded-full bg-slate-900/80 overflow-hidden p-0.5 border border-white/5">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(5, bestScore)}%` }}
                      transition={{ duration: 0.85, ease: "easeOut", delay: 0.3 }}
                    />
                  </div>
                </div>
              </motion.div>

              {/* Card 3: Tổng quan & Phân tích mới */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
                }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-[#19173d]/90 via-[#131230]/85 to-[#0f0e24]/90 p-5 shadow-[0_12px_32px_rgba(10,8,30,0.4)] backdrop-blur-xl sm:col-span-2 lg:col-span-1 flex flex-col justify-between transition-all duration-300 hover:border-white/25 hover:shadow-[0_16px_40px_rgba(99,102,241,0.2)]"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-sky-500/20 text-sky-300 ring-1 ring-sky-400/30">
                        <FileCheck size={15} />
                      </span>
                      Tổng lượt phân tích
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hồ sơ</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl font-black text-white tabular-nums">
                      <AnimatedNumber value={rows.length} duration={0.9} />
                    </span>
                    <span className="text-xs text-slate-400 font-medium">bản ghi đã lưu</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-4">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} className="flex-1">
                    <Link
                      to={CV_JD_ANALYSIS_PATH}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:brightness-110 transition-all"
                    >
                      <Plus size={15} />
                      CV + JD
                    </Link>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} className="flex-1">
                    <Link
                      to={CV_FIELD_ANALYSIS_PATH}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-white/10 hover:border-white/25 transition-all"
                    >
                      <Plus size={15} />
                      Theo ngành
                    </Link>
                  </motion.div>
                </div>
              </motion.div>
            </motion.div>
          ) : (
            <div className="flex justify-end gap-2.5">
              <Link to={CV_JD_ANALYSIS_PATH} className="cv-history-button cv-history-button--primary" aria-label="Phân tích CV + JD">
                <Plus size={16} aria-hidden="true" />
                CV + JD
              </Link>
              <Link to={CV_FIELD_ANALYSIS_PATH} className="cv-history-button" aria-label="Phân tích theo ngành">
                <Plus size={16} aria-hidden="true" />
                Theo ngành
              </Link>
            </div>
          )}
        </div>

        <motion.div
          className="cv-history-toolbar"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
        >
          <div
            className="relative flex items-center p-1 sm:p-1.5 rounded-2xl border border-white/15 bg-gradient-to-b from-[#1c183d]/85 via-[#14122e]/90 to-[#0e0c24]/95 shadow-[0_8px_32px_rgba(5,3,20,0.5),inset_0_1px_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl w-full sm:w-auto"
            role="tablist"
            aria-label="Loại phân tích"
          >
            {MODE_TABS.map((tab, index) => {
              const isSelected = modeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  id={"cv-tab-" + tab.value}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls="cv-history-results"
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => changeTab(tab.value)}
                  onKeyDown={(event) => onTabKeyDown(event, index)}
                  className={`relative flex-1 sm:flex-initial px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 sm:gap-2.5 select-none outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                    isSelected
                      ? "text-white font-bold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="cv-segmented-glass-active"
                      className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/[0.18] via-white/[0.08] to-transparent border border-white/20 border-t-white/35 shadow-[0_4px_16px_rgba(0,0,0,0.45),0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.25)] backdrop-blur-md"
                      transition={{ type: "spring", stiffness: 450, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10 tracking-tight">{tab.label}</span>
                  <span
                    className={`relative z-10 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums transition-colors duration-200 ${
                      isSelected
                        ? "bg-violet-400/25 text-violet-200 border border-violet-400/40 shadow-[0_0_10px_rgba(167,139,250,0.3)]"
                        : "bg-white/5 text-slate-400 border border-white/5"
                    }`}
                  >
                    {counts[tab.value]}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="cv-history-filters">
            <div className="cv-history-search">
              <Search size={16} aria-hidden="true" />
              <input type="search" aria-label="Tìm CV, JD, công ty hoặc ngành" placeholder="Tìm CV, JD, công ty…" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
              {searchQuery && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setSearchQuery("")}><X size={15} aria-hidden="true" /></button>}
            </div>
            <AppSelect value={sortBy} onValueChange={setSortBy} options={SORT_OPTIONS} theme="dark" size="compact" icon={ArrowDownWideNarrow} aria-label="Sắp xếp kết quả" triggerClassName="cv-history-sort" />
            <motion.button
              type="button"
              className="cv-history-refresh"
              disabled={loading}
              onClick={loadRows}
              aria-label="Tải lại lịch sử"
              title="Tải lại"
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
            >
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} aria-hidden="true" />
            </motion.button>
          </div>
        </motion.div>

        {loadError && <div className="cv-history-error" role="alert"><AlertCircle size={18} aria-hidden="true" /><p>{loadError}</p><button className="cv-history-button" type="button" onClick={loadRows}>Thử lại</button></div>}

        <section id="cv-history-results" className="cv-history-results" role="tabpanel" aria-labelledby={"cv-tab-" + modeTab} tabIndex={0} aria-busy={loading}>
          {loading && rows.length === 0 && (
            <div className="cv-history-loading" role="status">
              <span className="sr-only">Đang tải lịch sử phân tích…</span>
              {[0, 1, 2, 3].map((n) => <div key={n} className="cv-history-skeleton" aria-hidden="true"><span /><div><span /><span /><span /></div></div>)}
            </div>
          )}
          {!loading && !loadError && filteredData.length === 0 && (
            <motion.div
              className="cv-history-empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <span className="cv-history-empty-icon"><FileText size={28} strokeWidth={1.5} aria-hidden="true" /></span>
              <h2>{rows.length ? "Không tìm thấy kết quả" : "Chưa có bản phân tích"}</h2>
              <p>{rows.length ? "Thử từ khóa khác hoặc xem tất cả bản phân tích." : "Kết quả phân tích CV của bạn sẽ được lưu tại đây."}</p>
              {rows.length > 0 && <button className="cv-history-button" type="button" onClick={() => { changeTab("all"); setSearchQuery(""); }}>Xóa bộ lọc</button>}
            </motion.div>
          )}
          {filteredData.length > 0 && (
            <div className="cv-history-list" key={modeTab}>
              {filteredData.map((item, index) => <AnalysisRow key={item.id} item={item} index={index} expanded={selectedId === item.id} onToggle={() => setSelectedId(selectedId === item.id ? null : item.id)} />)}
            </div>
          )}
        </section>
        <p className="sr-only" role="status">{!loading && !loadError ? filteredData.length + " bản phân tích" : ""}</p>
      </div>
    </div>
  );
}

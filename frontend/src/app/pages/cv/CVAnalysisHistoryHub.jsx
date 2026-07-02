import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  FileText,
  Search,
  Calendar,
  BarChart3,
  Sparkles,
  Eye,
  Briefcase,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Clock,
  Plus,
} from "lucide-react";
import { fetchCvAnalyses, fetchCvAnalysisById } from "../../api/cvApi.js";
import { isLoggedIn, hasAuthCredentials } from "../../utils/auth/auth.js";
import { buildLoginPath } from "../../utils/auth/authGate.js";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";
import {
  CV_JD_ANALYSIS_PATH,
  CV_FIELD_ANALYSIS_PATH,
  cvAnalysisResultPath,
} from "../../components/cv/CvJdAnalysisTabs";

function mapRow(item) {
  const createdAt = item.createdAt || item.date || "";
  const isField =
    item.mode === "field" || (!item.jdFileName && !item.jdFile && Boolean(item.field));
  const mode = item.mode === "jd" || item.mode === "field" ? item.mode : isField ? "field" : "jd";
  return {
    id: item.analysisId || item.id,
    mode,
    field: item.field || null,
    cvFile: item.cvFileName || item.cvFile || "cv.pdf",
    jdFile: item.jdFileName || item.jdFile || null,
    matchScore: item.matchScore ?? 0,
    createdAt,
    company: item.company || null,
    position: item.position || null,
  };
}

function scoreTone(score) {
  if (score >= 75) return { text: "text-lime-700", bg: "ring-lime-200 bg-lime-50/50", bar: "bg-lime-400", blur: "bg-lime-400" };
  if (score >= 55) return { text: "text-violet-700", bg: "ring-violet-200 bg-violet-50/50", bar: "bg-violet-500", blur: "bg-violet-500" };
  return { text: "text-amber-700", bg: "ring-amber-200 bg-amber-50/50", bar: "bg-amber-400", blur: "bg-amber-400" };
}

const MODE_TABS = [
  { value: "all", label: "Tất cả" },
  { value: "jd", label: "CV + JD" },
  { value: "field", label: "Theo ngành" },
];

export function CVAnalysisHistoryHub() {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [modeTab, setModeTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const res = await fetchCvAnalyses();
    setLoading(false);
    if (!res.success) {
      setRows([]);
      setLoadError(res.error || "Không tải được lịch sử.");
      return;
    }
    setRows((res.analyses || []).map(mapRow));
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate(buildLoginPath("/cv-analysis/history"), { replace: true });
      return;
    }
    if (!hasAuthCredentials()) return;
    loadRows();
  }, [loadRows, navigate]);

  useEffect(() => {
    const onSaved = () => loadRows();
    window.addEventListener("cv-analysis-saved", onSaved);
    return () => window.removeEventListener("cv-analysis-saved", onSaved);
  }, [loadRows]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      const res = await fetchCvAnalysisById(selectedId);
      if (cancelled) return;
      setDetailLoading(false);
      setDetail(res.success && res.analysis ? res.analysis : null);
    })();
    return () => { cancelled = true; };
  }, [selectedId]);

  const filteredData = useMemo(() => {
    return rows
      .filter((r) => modeTab === "all" || r.mode === modeTab)
      .filter((r) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          r.cvFile.toLowerCase().includes(q) ||
          r.jdFile?.toLowerCase().includes(q) ||
          r.field?.toLowerCase().includes(q) ||
          r.company?.toLowerCase().includes(q) ||
          r.position?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) =>
        sortBy === "score"
          ? b.matchScore - a.matchScore
          : new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
  }, [rows, modeTab, searchQuery, sortBy]);

  const totalAll = rows.length;
  const totalJd = rows.filter((r) => r.mode === "jd").length;
  const totalField = rows.filter((r) => r.mode === "field").length;
  const avgScore = totalAll
    ? Math.round(rows.reduce((s, r) => s + r.matchScore, 0) / totalAll)
    : 0;
  const bestScore = totalAll ? Math.max(...rows.map((r) => r.matchScore)) : 0;

  return (
    <div className="flex h-full min-h-screen flex-col">
      <MentorPageShell>
        <div className={`${CUSTOMER_SHELL_GUTTER} pb-24 pt-12 relative`}>
          {/* Premium Top Glow */}
          <div className="absolute left-1/2 top-0 -z-10 h-[300px] w-full max-w-4xl -translate-x-1/2 rounded-full bg-violet-300/20 blur-[100px] pointer-events-none" />
          
          <div className={`${CUSTOMER_SHELL_MAX} w-full`}>
            {/* ── Header ── */}
          <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-4">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="py-2 leading-relaxed text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-violet-700 to-indigo-600 sm:text-5xl"
              >
                Lịch sử phân tích CV
              </motion.h1>
              
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.18 }}
                className="mt-1 max-w-xl text-sm font-medium text-slate-500"
              >
                Bạn đã thực hiện <span className="font-bold text-violet-600">{totalAll}</span> lần tối ưu hồ sơ.
              </motion.p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate(CV_JD_ANALYSIS_PATH)}
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(15,23,42,0.25)] active:scale-95"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 opacity-0 transition group-hover:opacity-100" />
                <Plus className="h-4 w-4 relative z-10" />
                <span className="relative z-10">CV + JD</span>
              </button>
              <button
                type="button"
                onClick={() => navigate(CV_FIELD_ANALYSIS_PATH)}
                className="inline-flex items-center gap-2 rounded-full border-2 border-slate-200/80 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:text-violet-700 hover:shadow-sm active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span>Theo ngành</span>
              </button>
            </div>
          </div>

          {/* ── Stats ── */}
          {totalAll > 0 && (
            <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:gap-6">
              {[
                { icon: BarChart3, label: "Tổng phân tích", value: totalAll, color: "text-violet-600", bgIcon: "bg-violet-100/80", ring: "ring-violet-50", shadowColor: "rgba(124,58,237,0.15)" },
                { icon: Sparkles, label: "Điểm trung bình", value: avgScore, color: "text-lime-600", bgIcon: "bg-lime-100/80", ring: "ring-lime-50", shadowColor: "rgba(101,163,13,0.15)" },
                { icon: FileText, label: "Điểm cao nhất", value: bestScore, color: "text-amber-600", bgIcon: "bg-amber-100/80", ring: "ring-amber-50", shadowColor: "rgba(217,119,6,0.15)" },
              ].map(({ icon: Icon, label, value, color, bgIcon, ring, shadowColor }) => (
                <div key={label} className="group relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/60 p-6 backdrop-blur-3xl transition-all duration-300" style={{ boxShadow: `0 8px 30px ${shadowColor}` }}>
                  <div className={`absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20 blur-3xl transition-transform duration-500 group-hover:scale-150 ${bgIcon}`} />
                  <div className="relative z-10 flex items-center gap-5">
                    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${bgIcon} ring-4 ${ring} shadow-sm`}>
                      <Icon className={`h-7 w-7 ${color}`} />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
                      <p className={`mt-0.5 text-3xl font-black tracking-tight ${color}`}>{value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Filters ── */}
          <div className="mb-8 flex flex-col gap-4 rounded-[2rem] bg-white/60 p-2 shadow-sm ring-1 ring-slate-200/50 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
            {/* Mode tabs */}
            <div className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-slate-100/80 p-1.5">
              {MODE_TABS.map((tab) => {
                const count = tab.value === "all" ? totalAll : tab.value === "jd" ? totalJd : totalField;
                const active = modeTab === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setModeTab(tab.value)}
                    className={`relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-300 ${
                      active ? "text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {active && <span className="absolute inset-0 rounded-xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]" />}
                    <span className="relative z-10">{tab.label}</span>
                    {count > 0 && (
                      <span className={`relative z-10 rounded-full px-2 py-0.5 text-[10px] font-black ${
                        active ? "bg-violet-100 text-violet-700" : "bg-slate-200/80 text-slate-500"
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-1 items-center gap-3 w-full sm:w-auto">
              {/* Search */}
              <div className="relative flex-1 sm:max-w-md ml-auto">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  placeholder="Tìm kiếm CV, JD, công ty, ngành..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-2xl border border-transparent bg-white/80 py-3 pl-10 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-[inset_0_1px_3px_rgba(0,0,0,0.02)] transition-all focus:border-violet-200 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-500/10"
                />
              </div>

              {/* Sort */}
              <div className="flex shrink-0 items-center gap-1 rounded-2xl bg-slate-100/80 p-1.5">
                {[
                  { value: "date", label: "Mới nhất", icon: Calendar },
                  { value: "score", label: "Điểm cao", icon: BarChart3 },
                ].map(({ value, label, icon: Icon }) => {
                  const active = sortBy === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSortBy(value)}
                      className={`relative flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold transition-all duration-300 ${
                        active ? "text-violet-700" : "text-slate-500 hover:text-slate-700"
                      }`}
                      title={`Sắp xếp theo: ${label}`}
                    >
                      {active && <span className="absolute inset-0 rounded-xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]" />}
                      <Icon className="relative z-10 h-4 w-4" />
                      <span className="relative z-10 hidden md:inline">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Error ── */}
          {loadError && (
            <div className="mb-6 flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50/80 p-5 text-sm font-medium text-amber-800 shadow-sm backdrop-blur-sm">
              {loadError}
              <button type="button" onClick={loadRows} className="ml-4 rounded-xl bg-amber-100 px-4 py-2 font-bold text-amber-900 transition hover:bg-amber-200">
                Thử lại
              </button>
            </div>
          )}

          {/* ── List ── */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-violet-600" />
              <p className="text-sm font-bold text-slate-500">Đang tải lịch sử…</p>
            </div>
          )}

          {!loading && filteredData.length === 0 && (
            <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white/50 px-6 py-20 text-center backdrop-blur-sm">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400">
                <Clock className="h-8 w-8" />
              </div>
              <p className="text-lg font-black text-slate-700">
                {totalAll === 0 ? "Chưa có lịch sử phân tích" : "Không tìm thấy kết quả"}
              </p>
              <p className="mt-2 font-medium text-slate-500">
                {totalAll === 0 ? "Bắt đầu phân tích CV để xem kết quả ở đây" : "Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc"}
              </p>
              {totalAll === 0 && (
                <div className="mt-8 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigate(CV_JD_ANALYSIS_PATH)}
                    className="rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    Phân tích CV + JD
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(CV_FIELD_ANALYSIS_PATH)}
                    className="rounded-full border-2 border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:border-violet-300 hover:text-violet-700"
                  >
                    Theo ngành
                  </button>
                </div>
              )}
            </div>
          )}

          {!loading && filteredData.length > 0 && (
            <div className="grid gap-5 lg:grid-cols-2">
              {[filteredData.filter((_, i) => i % 2 === 0), filteredData.filter((_, i) => i % 2 === 1)].map((col, ci) => (
                <ul key={ci} className="flex flex-col gap-5">
                  {col.map((item) => {
                    const tone = scoreTone(item.matchScore);
                    const expanded = selectedId === item.id;
                    const title = item.position || item.cvFile;
                    const when = item.createdAt
                      ? new Date(item.createdAt).toLocaleString("vi-VN", {
                          day: "2-digit", month: "2-digit", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })
                      : "";

                    return (
                      <li
                        key={item.id}
                        className={`group relative overflow-hidden rounded-3xl border transition-all duration-300 ${
                          expanded
                            ? "bg-white border-violet-200 shadow-[0_16px_64px_rgba(128,55,244,0.12)] ring-4 ring-violet-50/50"
                            : "bg-white/60 backdrop-blur-2xl border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 hover:border-violet-200 hover:bg-white/95 hover:shadow-[0_24px_48px_rgba(128,55,244,0.12)]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedId(expanded ? null : item.id)}
                          className="flex w-full items-start gap-4 p-5 text-left sm:gap-5 sm:p-6"
                        >
                          {/* Score badge */}
                          <div className="relative flex shrink-0 items-center justify-center pt-0.5">
                            <div className={`absolute inset-0 blur-xl transition-opacity duration-500 ${expanded ? "opacity-60 scale-125" : "opacity-0 group-hover:opacity-40 group-hover:scale-110"} ${tone.blur}`} />
                            <div className={`relative flex h-[3.5rem] w-[3.5rem] flex-col items-center justify-center rounded-[1.25rem] shadow-sm ring-1 ${tone.bg}`}>
                              <span className={`text-[1.35rem] font-black leading-none tracking-tight ${tone.text}`}>{item.matchScore}</span>
                              <span className={`mt-0.5 text-[9px] font-black uppercase tracking-widest opacity-80 ${tone.text}`}>Điểm</span>
                            </div>
                          </div>

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap items-center gap-2.5">
                              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest shadow-sm ${
                                item.mode === "field"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-violet-100 text-violet-700"
                              }`}>
                                {item.mode === "field" ? (item.field || "Theo ngành") : "CV + JD"}
                              </span>
                              <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                                <Calendar className="h-3.5 w-3.5" />
                                {when}
                              </span>
                            </div>
                            <p className="truncate text-[15px] font-black text-slate-900 group-hover:text-violet-700 transition-colors">{title}</p>
                            {item.company && (
                              <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{item.company}</p>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="inline-flex max-w-[10rem] items-center gap-1.5 truncate rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200/80">
                                <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                <span className="truncate">{item.cvFile}</span>
                              </span>
                              {item.jdFile && (
                                <span className="inline-flex max-w-[10rem] items-center gap-1.5 truncate rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200/80">
                                  <Briefcase className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                  <span className="truncate">{item.jdFile}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Chevron */}
                          <div className="shrink-0 pt-2 text-slate-400 transition-transform duration-300">
                            {expanded ? <ChevronUp className="h-5 w-5 text-violet-600" /> : <ChevronDown className="h-5 w-5" />}
                          </div>
                        </button>

                        {/* Expanded detail */}
                        {expanded && (
                          <div className="border-t border-slate-100/80 bg-slate-50/50 p-5 sm:p-6">
                            {detailLoading && (
                              <div className="flex animate-pulse items-center justify-center gap-2 py-8 text-sm font-bold text-slate-400">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-violet-500" />
                                Đang tải chi tiết…
                              </div>
                            )}
                            {!detailLoading && !detail && (
                              <p className="py-8 text-center text-sm font-medium text-slate-400">Không tải được chi tiết.</p>
                            )}
                            {!detailLoading && detail && (() => {
                              const matched = detail.matchedKeywords || [];
                              const missing = detail.missingKeywords || [];
                              const total = matched.length + missing.length;
                              const pct = total ? Math.round((matched.length / total) * 100) : 0;
                              const LIMIT = 5;
                              return (
                                <div className="space-y-5">
                                  {/* Progress bar */}
                                  {total > 0 && (
                                    <div>
                                      <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                                        <span>Khớp {matched.length}/{total} từ khóa</span>
                                        <span className={`text-sm font-black ${tone.text}`}>{pct}%</span>
                                      </div>
                                      <div className="h-2 overflow-hidden rounded-full bg-slate-200/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
                                        <div className={`h-full rounded-full transition-all duration-1000 ${tone.bar}`} style={{ width: `${pct}%` }} />
                                      </div>
                                    </div>
                                  )}

                                  {/* Keywords */}
                                  {total > 0 && (
                                    <div className="grid gap-4 sm:grid-cols-2">
                                      <div className="rounded-2xl bg-white p-3.5 ring-1 ring-slate-100 shadow-sm">
                                        <p className="mb-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Đã có</p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {matched.slice(0, LIMIT).map((kw) => (
                                            <span key={kw} className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200/60 shadow-[0_1px_2px_rgba(16,185,129,0.05)]">
                                              {kw}
                                            </span>
                                          ))}
                                          {matched.length > LIMIT && (
                                            <span className="rounded-lg bg-slate-100/80 px-2.5 py-1 text-[11px] font-bold text-slate-500">+{matched.length - LIMIT}</span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="rounded-2xl bg-white p-3.5 ring-1 ring-slate-100 shadow-sm">
                                        <p className="mb-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Còn thiếu</p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {missing.slice(0, LIMIT).map((kw) => (
                                            <span key={kw} className="rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200/60 shadow-[0_1px_2px_rgba(245,158,11,0.05)]">
                                              {kw}
                                            </span>
                                          ))}
                                          {missing.length > LIMIT && (
                                            <span className="rounded-lg bg-slate-100/80 px-2.5 py-1 text-[11px] font-bold text-slate-500">+{missing.length - LIMIT}</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Summary */}
                                  {detail.summary && (
                                    <div className="rounded-2xl bg-white/60 p-4 ring-1 ring-slate-100">
                                      <p className="line-clamp-3 text-[13px] leading-relaxed text-slate-600 font-medium">
                                        {String(detail.summary).replace(/^[✨⭐]\s*/u, "").trim()}
                                      </p>
                                    </div>
                                  )}

                                  {/* Actions */}
                                  <div className="flex flex-col-reverse items-stretch gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                                    <span className="text-center text-[11px] font-bold text-slate-400 sm:text-left">
                                      {(detail.suggestions || []).length} gợi ý tối ưu đã lưu
                                    </span>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => navigate(
                                          item.mode === "field" ? CV_FIELD_ANALYSIS_PATH : CV_JD_ANALYSIS_PATH,
                                          item.mode === "field" && item.field ? { state: { field: item.field } } : undefined
                                        )}
                                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-slate-600 shadow-sm ring-1 ring-slate-200 transition-all hover:bg-slate-50 sm:flex-none"
                                      >
                                        <RefreshCw className="h-3.5 w-3.5" />
                                        Thử lại
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => navigate(cvAnalysisResultPath(item.mode, item.id))}
                                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#a3e635] px-4 py-2.5 text-xs font-bold text-slate-900 shadow-[0_4px_12px_rgba(163,230,53,0.3)] transition-all hover:bg-[#84cc16] sm:flex-none"
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                        Xem kết quả
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ))}
            </div>
          )}
        </div>
      </div>
      </MentorPageShell>
    </div>
  );
}

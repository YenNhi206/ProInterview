import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router";
import {
  FileText,
  Search as MagnifyingGlass,
  Calendar,
  BarChart3 as ChartBar,
  Check,
  X,
  Sparkles as Sparkle,
  TrendingUp as TrendUp,
  TrendingDown as TrendDown,
  RefreshCw as ArrowsClockwise,
  Eye,
  Briefcase,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { fetchCvAnalyses, fetchCvAnalysisById } from "../../api/cvApi.js";
import { hasAuthCredentials, isLoggedIn } from "../../utils/auth/auth.js";
import { buildLoginPath } from "../../utils/auth/authGate.js";
import { CvJdAnalysisPage, cvAnalysisPageHeader } from "../../components/cv/CvJdAnalysisFrame";
import {
  CV_JD_ANALYSIS_PATH,
  CV_JD_HISTORY_PATH,
  CV_FIELD_ANALYSIS_PATH,
  CV_FIELD_HISTORY_PATH,
  cvAnalysisResultPath,
} from "../../components/cv/CvJdAnalysisTabs";

const JD_ANALYSIS_PATH = CV_JD_ANALYSIS_PATH;
const FIELD_ANALYSIS_PATH = CV_FIELD_ANALYSIS_PATH;

/** "jd" | "field", cố định theo URL, mỗi tính năng một trang lịch sử riêng */
function historyModeFromPath(pathname) {
  if (pathname.includes("/cv-analysis/field/history")) return "field";
  if (pathname.includes("/cv-analysis/jd/history")) return "jd";
  return "jd";
}

function historyLoginPath(mode) {
  return mode === "field" ? CV_FIELD_HISTORY_PATH : CV_JD_HISTORY_PATH;
}

function isFieldAnalysis(item) {
  return item.mode === "field" || (!item.jdFileName && !item.jdFile && Boolean(item.field));
}

function mapRow(item) {
  const createdAt = item.createdAt || item.date || "";
  const mode =
    item.mode === "field" || item.mode === "jd"
      ? item.mode
      : isFieldAnalysis(item)
        ? "field"
        : "jd";
  return {
    id: item.analysisId || item.id,
    mode,
    field: item.field || null,
    cvFile: item.cvFileName || item.cvFile || "cv.pdf",
    jdFile: item.jdFileName || item.jdFile || null,
    matchScore: item.matchScore ?? 0,
    createdAt,
    date: createdAt ? new Date(createdAt).toLocaleDateString("vi-VN") : "",
    company: item.company || null,
    position: item.position || null,
  };
}

function scoreTone(score) {
  if (score >= 75) return { text: "text-lime-900", bg: "bg-lime-100 ring-lime-200/80" };
  if (score >= 55) return { text: "text-[#630ed4]", bg: "bg-violet-100 ring-violet-200/80" };
  return { text: "text-amber-800", bg: "bg-amber-100 ring-amber-200/80" };
}

export function AnalysisHistory() {
  const navigate = useNavigate();
  const location = useLocation();
  const historyMode = historyModeFromPath(location.pathname);
  const isFieldContext = historyMode === "field";

  const [sortBy, setSortBy] = useState("date");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const res = await fetchCvAnalyses();
    setLoading(false);
    if (!res.success) {
      setRows([]);
      setLoadError(res.error || "Không tải được lịch sử phân tích.");
      return;
    }
    setRows((res.analyses || []).map(mapRow));
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate(buildLoginPath(historyLoginPath(historyMode)), { replace: true });
      return;
    }
    if (!hasAuthCredentials()) return;
    loadRows();
  }, [loadRows, navigate, historyMode]);

  useEffect(() => {
    const onSaved = (ev) => {
      const savedMode = ev.detail?.mode;
      if (!savedMode || savedMode === historyMode) loadRows();
    };
    window.addEventListener("cv-analysis-saved", onSaved);
    return () => window.removeEventListener("cv-analysis-saved", onSaved);
  }, [loadRows, historyMode]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      const res = await fetchCvAnalysisById(selectedId);
      if (cancelled) return;
      setDetailLoading(false);
      if (res.success && res.analysis) setDetail(res.analysis);
      else setDetail(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const modeFilteredRows = useMemo(
    () => rows.filter((r) => r.mode === historyMode),
    [rows, historyMode]
  );

  const filteredData = modeFilteredRows
    .filter((item) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.cvFile.toLowerCase().includes(q) ||
        (item.jdFile?.toLowerCase().includes(q)) ||
        (item.field?.toLowerCase().includes(q)) ||
        (item.company?.toLowerCase().includes(q)) ||
        (item.position?.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (sortBy === "date") {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      return b.matchScore - a.matchScore;
    });

  const totalAnalyses = modeFilteredRows.length;
  const avgScore = totalAnalyses
    ? Math.round(modeFilteredRows.reduce((sum, item) => sum + item.matchScore, 0) / totalAnalyses)
    : 0;
  const bestScore = totalAnalyses ? Math.max(...modeFilteredRows.map((r) => r.matchScore)) : 0;

  const countLabel = isFieldContext ? "phân tích theo ngành" : "phân tích CV + JD";
  const searchPlaceholder = isFieldContext
    ? "Tìm theo tên CV, ngành, vị trí..."
    : "Tìm theo tên CV, JD, công ty, vị trí...";
  const pageHeader = cvAnalysisPageHeader(historyMode);

  return (
    <CvJdAnalysisPage
      activeTab="history"
      {...pageHeader}
      tabAnalysisPath={isFieldContext ? FIELD_ANALYSIS_PATH : JD_ANALYSIS_PATH}
      tabHistoryPath={isFieldContext ? CV_FIELD_HISTORY_PATH : CV_JD_HISTORY_PATH}
      tabTrailing={
        totalAnalyses > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold text-violet-800 ring-1 ring-violet-200/70 sm:text-[11px]">
            {totalAnalyses} bản ghi
          </span>
        ) : null
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-3 divide-x divide-violet-100 border-b border-violet-100">
        {[
          { icon: ChartBar, value: totalAnalyses, label: "Tổng lần phân tích" },
          { icon: Sparkle, value: avgScore, label: "Điểm trung bình" },
          { icon: FileText, value: bestScore, label: "Điểm cao nhất" },
        ].map(({ icon: Icon, value, label }) => (
          <div key={label} className="flex flex-col items-center gap-1.5 px-4 py-6 sm:px-8 sm:py-7">
            <Icon className="h-4 w-4 text-[#630ed4]" strokeWidth={2} />
            <p className="text-xl font-extrabold text-violet-950 sm:text-2xl">{value}</p>
            <p className="text-center text-[10px] font-semibold text-violet-600 sm:text-[11px]">{label}</p>
          </div>
        ))}
      </div>

      {/* Search + sort */}
      <div className="flex flex-col gap-4 border-b border-violet-100 px-6 py-5 sm:flex-row sm:items-center sm:px-8 sm:py-6">
        <div className="relative min-w-0 flex-1">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-400" />
          <input
            type="search"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-violet-200 bg-violet-50/40 py-2.5 pl-10 pr-3 text-sm text-violet-950 placeholder:text-violet-400 focus:border-[#630ed4] focus:outline-none focus:ring-2 focus:ring-violet-200/80"
          />
        </div>
        <div className="inline-flex shrink-0 rounded-xl bg-violet-100/70 p-1">
          {[
            { value: "date", label: "Mới nhất", icon: Calendar },
            { value: "score", label: "Điểm cao", icon: ChartBar },
          ].map((opt) => {
            const active = sortBy === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSortBy(opt.value)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all sm:text-sm ${
                  active
                    ? "bg-white text-[#630ed4] shadow-sm ring-1 ring-violet-200/80"
                    : "text-violet-600 hover:text-violet-900"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {loadError && (
        <div className="mx-4 mt-4 flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 sm:mx-5">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={loadRows}
            className="shrink-0 font-bold text-[#630ed4] hover:underline"
          >
            Thử lại
          </button>
        </div>
      )}

      <p className="px-6 pt-5 text-sm font-semibold text-violet-600 sm:px-8">
        {loading ? "Đang tải…" : `Hiển thị ${filteredData.length} / ${totalAnalyses} ${countLabel}`}
      </p>

      {/* List */}
      <div className="px-6 py-6 sm:px-8 sm:py-8">
        {loading && (
          <div className="flex items-center justify-center py-16 text-sm font-medium text-violet-600">
            Đang tải lịch sử…
          </div>
        )}

        {!loading && filteredData.length === 0 && (
          <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/40 px-4 py-6 text-center sm:px-5 sm:py-7">
            <p className="text-sm font-bold text-violet-950 sm:text-base">
              {isFieldContext ? "Chưa có phân tích theo ngành" : "Chưa có phân tích CV + JD"}
            </p>
            <button
              type="button"
              onClick={() =>
                navigate(isFieldContext ? FIELD_ANALYSIS_PATH : JD_ANALYSIS_PATH)
              }
              className="mt-3 inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#93f72b] via-[#93f72b] to-[#93f72b] px-5 py-2.5 text-sm font-extrabold text-violet-950 shadow-[0_6px_20px_rgba(196,255,71,0.3)] transition hover:brightness-105 sm:px-6 sm:py-3"
            >
              {isFieldContext ? "Phân tích theo ngành" : "Phân tích CV + JD"}
            </button>
          </div>
        )}

        {!loading && filteredData.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            {[filteredData.filter((_, i) => i % 2 === 0), filteredData.filter((_, i) => i % 2 === 1)].map((col, ci) => (
              <ul key={ci} className="flex flex-col gap-4">
            {col.map((item) => {
              const tone = scoreTone(item.matchScore);
              const expanded = selectedId === item.id;
              const title = item.position || item.cvFile;
              const when = item.createdAt
                ? new Date(item.createdAt).toLocaleString("vi-VN", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : item.date;

              return (
                <li
                  key={item.id}
                  className={`overflow-hidden rounded-2xl border transition-all ${
                    expanded
                      ? "border-[#630ed4] shadow-md shadow-violet-500/10"
                      : "border-violet-200/80 hover:border-violet-300"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(expanded ? null : item.id)}
                    className="flex w-full items-start gap-3 px-4 py-4 text-left sm:gap-4 sm:px-5"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 ring-1 ring-violet-200/70">
                      <FileText className="h-5 w-5 text-[#630ed4]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            item.mode === "field"
                              ? "bg-amber-100 text-amber-900"
                              : "bg-violet-100 text-[#630ed4]"
                          }`}
                        >
                          {item.mode === "field" ? item.field || "Theo ngành" : "CV + JD"}
                        </span>
                        <span className="text-[11px] font-medium text-violet-500">{when}</span>
                      </div>
                      <p className="truncate text-sm font-bold text-violet-950 sm:text-base">{title}</p>
                      {item.company && (
                        <p className="truncate text-xs font-medium text-violet-600">{item.company}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="inline-flex max-w-[10rem] items-center gap-1 truncate rounded-lg bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-800 sm:max-w-xs">
                          <FileText className="h-3 w-3 shrink-0" />
                          {item.cvFile}
                        </span>
                        {item.jdFile && (
                          <span className="inline-flex max-w-[10rem] items-center gap-1 truncate rounded-lg bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-800 sm:max-w-xs">
                            <Briefcase className="h-3 w-3 shrink-0" />
                            {item.jdFile}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-center gap-1">
                      <span
                        className={`inline-flex min-w-[3rem] items-center justify-center rounded-xl px-2.5 py-1.5 text-xl font-extrabold ring-1 ${tone.bg} ${tone.text}`}
                      >
                        {item.matchScore}
                      </span>
                      <span className="text-[10px] font-semibold text-violet-500">điểm</span>
                      {expanded ? (
                        <ChevronUp className="h-4 w-4 text-violet-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-violet-400" />
                      )}
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-violet-100 bg-violet-50/50 px-4 py-4 sm:px-5 sm:py-5">
                      {detailLoading && (
                        <p className="py-8 text-center text-sm text-violet-600">Đang tải chi tiết…</p>
                      )}
                      {!detailLoading && !detail && (
                        <p className="py-8 text-center text-sm text-violet-500">
                          Không tải được chi tiết phân tích.
                        </p>
                      )}
                      {!detailLoading && detail && (() => {
                        const matched = detail.matchedKeywords || [];
                        const missing = detail.missingKeywords || [];
                        const LIMIT = 5;
                        return (
                          <div className="space-y-4">
                            {/* Match bar */}
                            {matched.length + missing.length > 0 && (
                              <div>
                                <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
                                  <span>{matched.length} / {matched.length + missing.length} từ khóa khớp</span>
                                  <span className="font-bold text-slate-700">{Math.round(matched.length / (matched.length + missing.length) * 100)}%</span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                                  <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${Math.round(matched.length / (matched.length + missing.length) * 100)}%` }} />
                                </div>
                              </div>
                            )}

                            {/* Keywords — compact, giới hạn */}
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <p className="mb-1.5 text-[11px] font-semibold text-slate-400">Đã có</p>
                                <div className="flex flex-wrap gap-1">
                                  {matched.slice(0, LIMIT).map(kw => (
                                    <span key={kw} className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200">
                                      {kw}
                                    </span>
                                  ))}
                                  {matched.length > LIMIT && (
                                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                                      +{matched.length - LIMIT}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div>
                                <p className="mb-1.5 text-[11px] font-semibold text-slate-400">Còn thiếu</p>
                                <div className="flex flex-wrap gap-1">
                                  {missing.slice(0, LIMIT).map(kw => (
                                    <span key={kw} className="rounded-md bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-800 ring-1 ring-orange-200">
                                      {kw}
                                    </span>
                                  ))}
                                  {missing.length > LIMIT && (
                                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                                      +{missing.length - LIMIT}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Summary ngắn */}
                            {detail.summary && (
                              <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">
                                {String(detail.summary).replace(/^[✨⭐]\s*/u, "").trim()}
                              </p>
                            )}

                            {/* Actions */}
                            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                              <span className="text-[11px] text-slate-400">
                                {(detail.suggestions || []).length} gợi ý đã lưu
                              </span>
                              <div className="flex gap-2">
                                <button type="button" onClick={() => navigate(cvAnalysisResultPath(item.mode, item.id))}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#a3e635] px-3 py-1.5 text-xs font-bold text-slate-900 transition hover:bg-[#84cc16]">
                                  <Eye className="h-3 w-3" /> Xem đầy đủ
                                </button>
                                <button type="button"
                                  onClick={() => navigate(item.mode === "field" ? FIELD_ANALYSIS_PATH : JD_ANALYSIS_PATH, item.mode === "field" && item.field ? { state: { field: item.field } } : undefined)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50">
                                  <ArrowsClockwise className="h-3 w-3" /> Phân tích lại
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
    </CvJdAnalysisPage>
  );
}

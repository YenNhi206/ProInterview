import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
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
  if (score >= 75) return { text: "text-lime-800", bg: "bg-lime-100 ring-lime-300/60", bar: "bg-lime-500" };
  if (score >= 55) return { text: "text-violet-800", bg: "bg-violet-100 ring-violet-300/60", bar: "bg-violet-500" };
  return { text: "text-amber-800", bg: "bg-amber-100 ring-amber-300/60", bar: "bg-amber-500" };
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
    <MentorPageShell bottomPad="pb-20">
      <div className={`${CUSTOMER_SHELL_GUTTER} pt-8 pb-12`}>
        <div className={`${CUSTOMER_SHELL_MAX} w-full`}>

          {/* ── Header ── */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100">
                <Clock className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-900">
                  Lịch sử phân tích CV
                </h1>
                <p className="text-sm text-slate-500">{totalAll} lần phân tích</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate(CV_JD_ANALYSIS_PATH)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-violet-700"
              >
                <Plus className="h-3.5 w-3.5" />
                CV + JD
              </button>
              <button
                type="button"
                onClick={() => navigate(CV_FIELD_ANALYSIS_PATH)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Theo ngành
              </button>
            </div>
          </div>

          {/* ── Stats ── */}
          {totalAll > 0 && (
            <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
              {[
                { icon: BarChart3, label: "Tổng phân tích", value: totalAll, color: "text-violet-600", bg: "bg-violet-50" },
                { icon: Sparkles, label: "Điểm trung bình", value: avgScore, color: "text-lime-700", bg: "bg-lime-50" },
                { icon: FileText, label: "Điểm cao nhất", value: bestScore, color: "text-amber-700", bg: "bg-amber-50" },
              ].map(({ icon: Icon, label, value, color, bg }) => (
                <div key={label} className={`rounded-2xl ${bg} p-4 text-center`}>
                  <Icon className={`mx-auto mb-1 h-4 w-4 ${color}`} />
                  <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── Filters ── */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Mode tabs */}
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
              {MODE_TABS.map((tab) => {
                const count = tab.value === "all" ? totalAll : tab.value === "jd" ? totalJd : totalField;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setModeTab(tab.value)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                      modeTab === tab.value
                        ? "bg-violet-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                    {count > 0 && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        modeTab === tab.value ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Tìm theo tên CV, JD, công ty, ngành..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200/60"
              />
            </div>

            {/* Sort */}
            <div className="inline-flex shrink-0 rounded-xl border border-slate-200 bg-white p-1">
              {[
                { value: "date", label: "Mới nhất", icon: Calendar },
                { value: "score", label: "Điểm cao", icon: BarChart3 },
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSortBy(value)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    sortBy === value
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Error ── */}
          {loadError && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {loadError}
              <button type="button" onClick={loadRows} className="ml-3 font-bold text-violet-600 hover:underline">
                Thử lại
              </button>
            </div>
          )}

          {/* ── List ── */}
          {loading && (
            <div className="flex items-center justify-center py-20 text-sm text-slate-500">
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-violet-600" />
              Đang tải lịch sử…
            </div>
          )}

          {!loading && filteredData.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
              <Clock className="mx-auto mb-3 h-8 w-8 text-slate-300" />
              <p className="font-bold text-slate-700">
                {totalAll === 0 ? "Chưa có lịch sử phân tích" : "Không tìm thấy kết quả"}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {totalAll === 0 ? "Bắt đầu phân tích CV để xem kết quả ở đây" : "Thử thay đổi bộ lọc"}
              </p>
              {totalAll === 0 && (
                <div className="mt-5 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigate(CV_JD_ANALYSIS_PATH)}
                    className="rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-violet-700"
                  >
                    Phân tích CV + JD
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(CV_FIELD_ANALYSIS_PATH)}
                    className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    Theo ngành
                  </button>
                </div>
              )}
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
                          day: "2-digit", month: "2-digit", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })
                      : "";

                    return (
                      <li
                        key={item.id}
                        className={`overflow-hidden rounded-2xl border bg-white transition-all ${
                          expanded
                            ? "border-violet-400 shadow-md shadow-violet-200/40"
                            : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedId(expanded ? null : item.id)}
                          className="flex w-full items-start gap-3 px-4 py-4 text-left sm:gap-4 sm:px-5"
                        >
                          {/* Score badge */}
                          <div className="flex shrink-0 flex-col items-center gap-0.5 pt-0.5">
                            <span className={`inline-flex min-w-[2.75rem] items-center justify-center rounded-xl px-2 py-1.5 text-lg font-extrabold ring-1 ${tone.bg} ${tone.text}`}>
                              {item.matchScore}
                            </span>
                            <span className="text-[9px] font-semibold text-slate-400">điểm</span>
                          </div>

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                item.mode === "field"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-violet-100 text-violet-700"
                              }`}>
                                {item.mode === "field" ? (item.field || "Theo ngành") : "CV + JD"}
                              </span>
                              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                <Calendar className="h-3 w-3" />
                                {when}
                              </span>
                            </div>
                            <p className="truncate text-sm font-bold text-slate-900">{title}</p>
                            {item.company && (
                              <p className="truncate text-xs text-slate-500">{item.company}</p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-1">
                              <span className="inline-flex max-w-[9rem] items-center gap-1 truncate rounded-lg bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-slate-200/80">
                                <FileText className="h-3 w-3 shrink-0" />
                                {item.cvFile}
                              </span>
                              {item.jdFile && (
                                <span className="inline-flex max-w-[9rem] items-center gap-1 truncate rounded-lg bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-slate-200/80">
                                  <Briefcase className="h-3 w-3 shrink-0" />
                                  {item.jdFile}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Chevron */}
                          <div className="shrink-0 pt-1 text-slate-400">
                            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </button>

                        {/* Expanded detail */}
                        {expanded && (
                          <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4 sm:px-5">
                            {detailLoading && (
                              <p className="py-6 text-center text-sm text-slate-500">Đang tải chi tiết…</p>
                            )}
                            {!detailLoading && !detail && (
                              <p className="py-6 text-center text-sm text-slate-400">Không tải được chi tiết.</p>
                            )}
                            {!detailLoading && detail && (() => {
                              const matched = detail.matchedKeywords || [];
                              const missing = detail.missingKeywords || [];
                              const total = matched.length + missing.length;
                              const pct = total ? Math.round((matched.length / total) * 100) : 0;
                              const LIMIT = 5;
                              return (
                                <div className="space-y-3">
                                  {/* Progress bar */}
                                  {total > 0 && (
                                    <div>
                                      <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
                                        <span>{matched.length}/{total} từ khóa khớp</span>
                                        <span className="font-bold text-slate-700">{pct}%</span>
                                      </div>
                                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                                        <div className={`h-full rounded-full transition-all ${tone.bar}`} style={{ width: `${pct}%` }} />
                                      </div>
                                    </div>
                                  )}

                                  {/* Keywords */}
                                  {total > 0 && (
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      <div>
                                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Đã có</p>
                                        <div className="flex flex-wrap gap-1">
                                          {matched.slice(0, LIMIT).map((kw) => (
                                            <span key={kw} className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200">
                                              {kw}
                                            </span>
                                          ))}
                                          {matched.length > LIMIT && (
                                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">+{matched.length - LIMIT}</span>
                                          )}
                                        </div>
                                      </div>
                                      <div>
                                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Còn thiếu</p>
                                        <div className="flex flex-wrap gap-1">
                                          {missing.slice(0, LIMIT).map((kw) => (
                                            <span key={kw} className="rounded-md bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-800 ring-1 ring-orange-200">
                                              {kw}
                                            </span>
                                          ))}
                                          {missing.length > LIMIT && (
                                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">+{missing.length - LIMIT}</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Summary */}
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
                                      <button
                                        type="button"
                                        onClick={() => navigate(cvAnalysisResultPath(item.mode, item.id))}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-violet-700"
                                      >
                                        <Eye className="h-3 w-3" />
                                        Xem đầy đủ
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => navigate(
                                          item.mode === "field" ? CV_FIELD_ANALYSIS_PATH : CV_JD_ANALYSIS_PATH,
                                          item.mode === "field" && item.field ? { state: { field: item.field } } : undefined
                                        )}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                                      >
                                        <RefreshCw className="h-3 w-3" />
                                        Phân tích lại
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
  );
}

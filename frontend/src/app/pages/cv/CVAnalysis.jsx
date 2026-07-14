import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router";
import {
  FileText,
  ChevronRight,
  Check,
  X,
  Zap,
  AlertTriangle as Warning,
  Briefcase,
  Lock,
  Percent as SealPercent,
  Trash2 as Trash,
  Loader2,
  Upload,
  CloudUpload,
  Eye,
  RefreshCw,
  BadgeCheck,
} from "lucide-react";
import { getPlans, isLoggedIn, getUser, hasAuthCredentials, CV_FREE_LIMIT } from "../../utils/auth/auth.js";
import { buildLoginPath } from "../../utils/auth/authGate.js";
import { trackAction } from "../../utils/analytics/analyticsApi.js";
import { apiUrl as expressApiUrl, isExpressBackendConfigured } from "../../api/http.js";
import { CvJdAnalysisPage, cvAnalysisPageHeader } from "../../components/cv/CvJdAnalysisFrame";
import { AppSelect } from "../../components/ui/AppSelect";
import {
  CV_JD_ANALYSIS_PATH,
  CV_FIELD_ANALYSIS_PATH,
  CV_FIELD_HISTORY_PATH,
  CV_JD_HISTORY_PATH,
  cvAnalysisResultPath,
} from "../../components/cv/CvJdAnalysisTabs";
import {
  buildCvAnalysisSavePayload,
  deleteCvAnalysis,
  fetchCvAnalyses,
  fetchCvAnalysisById,
  fetchCvQuota,
  formatCvSaveError,
  saveCvAnalysis,
} from "../../api/cvApi.js";
import { buildFieldAnalysisMockPipeline } from "../../data/cvFieldAnalysisMock.js";
import {
  formatSkillSuggestionReason,
  mapPythonCvPipelineToAnalysis,
  computeCvRemainingFromQuota,
} from "../../utils/cv/cvMappers.js";
import { uploadCvJdFiles } from "../../utils/cv/cvFileUpload.js";

// ─── API base ─────────────────────────────────────────────────────────────────
const USE_EXPRESS_CV = isExpressBackendConfigured();

function getSessionId() {
  const key = "prointerview_session_id";
  let id = localStorage.getItem(key);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id); }
  return id;
}

/**
 * Force-refresh JWT trước khi gửi request để tránh token stale.
 */
async function getForceRefreshedToken() {
  try {
    const { getFreshAccessToken } = await import("../../utils/auth/auth.js");
    return await getFreshAccessToken();
  } catch {
    return "";
  }
}

/** Rebuild FormData for retry requests */
function buildFd(
  cvFile, reuseCV,
  jdFile, reuseJD,
  analyzeModeParam, selectedField
) {
  const fd = new FormData();
  if (cvFile)         fd.append("cv", cvFile);
  else if (reuseCV)   fd.append("cvPath", reuseCV.path);
  if (jdFile && analyzeModeParam === "jd")       fd.append("jd", jdFile);
  else if (reuseJD && analyzeModeParam === "jd") fd.append("jdPath", reuseJD.path);
  fd.append("mode", analyzeModeParam);
  if (selectedField) fd.append("field", selectedField);
  return fd;
}

/** FastAPI trả `detail` (string hoặc mảng validation); Express dùng `error`. */
function formatCvAnalyzerHttpError(status, body) {
  if (status === 429) return "Hệ thống đang bận, vui lòng thử lại sau 1–2 phút.";

  const e = body ?? {};
  // Hết quota gói (server chặn trước khi gọi Python) — không phải lỗi billing LLM, hiện message riêng.
  if (status === 403 && e.error === "quota_exceeded") {
    return e.message || "Bạn đã hết lượt phân tích CV. Vui lòng nâng cấp gói.";
  }
  const raw =
    (typeof e.detail === "string" && e.detail.trim()) ||
    (Array.isArray(e.detail) && e.detail.map((d) => d?.msg ?? d).filter(Boolean).join(" · ")) ||
    (typeof e.error === "string" && e.error.trim()) ||
    "";

  if (status === 503 || status === 502) {
    return raw || "Dịch vụ phân tích tạm thời không khả dụng, thử lại sau ít phút.";
  }
  if (status === 504) return raw || "Phân tích mất quá nhiều thời gian, thử lại sau.";

  const isTechnical = /\.env|LLM_?|API.?KEY|localhost|127\.|uvicorn|cv_jd_matching|ollama|googleapis|generativelanguage|Cloud LLM/i.test(raw);
  // Hide technical errors for normal bad requests, but we already returned raw for 502/503/504
  if (isTechnical || !raw) return "Phân tích thất bại, vui lòng thử lại sau.";

  return raw;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_FIELD = "IT / Công nghệ";

/** Ngành chọn được, các mục khác hiển thị badge «Sắp ra mắt». */
const FIELD_OPTIONS = [
  { label: DEFAULT_FIELD, available: true },
  { label: "Marketing", available: true },
  { label: "Tài chính / Kế toán", available: true },
  { label: "Nhân sự", available: true },
  { label: "Quản lý sản phẩm", available: true },
  { label: "Thiết kế / UX", available: true },
  { label: "Kinh doanh", available: true },
  { label: "Vận hành", available: true },
  { label: "Biên - Phiên dịch / Ngoại ngữ", available: true },
];

const FILE_FORMAT_HINT = "Hỗ trợ .pdf, .doc, .docx, .txt · tối đa 10MB";

const UPLOAD_PICK_BTN =
  "mt-2.5 inline-flex items-center justify-center rounded-lg border border-violet-200 bg-white px-4 py-1.5 text-sm font-semibold text-violet-800 shadow-sm ring-1 ring-violet-100/80 transition hover:border-violet-300 hover:bg-violet-50";

function preventDragDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

/** Chiều cao cố định, CV và JD luôn bằng nhau (chưa chọn / đã chọn) */
const UPLOAD_ZONE_HEIGHT =
  "flex h-[14rem] w-full min-w-0 overflow-hidden flex-col items-center justify-between rounded-2xl border-2 border-dashed border-violet-200/90 bg-violet-50/25 px-5 py-6 text-center transition sm:h-[15.5rem] sm:px-6 sm:py-7";

function CvUploadDropZone({ kind, hasFile, fileName, fileSizeKb, onPick, onClear, onFile }) {
  const isCv = kind === "cv";
  const headline = isCv ? "Tải lên CV từ máy tính" : "Tải lên Job Description";
  const pickLabel = isCv ? "Chọn CV" : "Chọn JD";
  const zoneLabel = isCv ? "CV của bạn" : "Job Description";

  const dropHandlers = {
    onDragEnter: preventDragDefaults,
    onDragOver: preventDragDefaults,
    onDrop: (e) => {
      preventDragDefaults(e);
      const f = e.dataTransfer.files?.[0];
      if (f) onFile(f);
    },
  };

  const shellClass = hasFile
    ? UPLOAD_ZONE_HEIGHT
    : `${UPLOAD_ZONE_HEIGHT} cursor-pointer hover:border-violet-300 hover:bg-violet-50/55`;

  return (
    <div className="flex h-full min-w-0 flex-col px-6 pt-6 sm:px-8 sm:pt-7">
      <p className="mb-1.5 shrink-0 text-xs font-bold uppercase tracking-wide text-violet-600">
        {zoneLabel}
      </p>
      <div
        {...dropHandlers}
        role={hasFile ? undefined : "button"}
        tabIndex={hasFile ? undefined : 0}
        onClick={hasFile ? undefined : onPick}
        onKeyDown={
          hasFile
            ? undefined
            : (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPick();
                }
              }
        }
        className={shellClass}
      >
        <div className="flex w-full min-w-0 max-w-sm items-center justify-center gap-2">
          <CloudUpload className="h-6 w-6 shrink-0 text-violet-400" strokeWidth={1.5} />
          <p className="min-w-0 text-left text-xs font-bold leading-snug text-violet-950 sm:text-sm">{headline}</p>
        </div>

        {/* Khối giữa cố định 2 dòng, tránh lệch chiều cao CV vs JD */}
        <div className="flex min-h-[2.75rem] w-full min-w-0 max-w-sm flex-col items-center justify-center gap-0.5 px-1">
          {hasFile ? (
            <>
              <p
                className="w-full break-all text-sm font-semibold leading-snug text-emerald-700"
                title={fileName}
              >
                {fileName || "—"}
              </p>
              <p className="text-[11px] font-medium leading-none text-emerald-600/90">
                {fileSizeKb != null ? `${fileSizeKb} KB` : "\u00a0"}
              </p>
            </>
          ) : (
            <>
              <p className="text-center text-[11px] font-medium leading-snug text-violet-500">
                {FILE_FORMAT_HINT}
              </p>
              <p className="text-[11px] leading-none text-transparent select-none" aria-hidden>
                placeholder
              </p>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPick();
          }}
          className={
            hasFile
              ? `${UPLOAD_PICK_BTN} mt-0 shrink-0 text-emerald-800 hover:border-emerald-200 hover:bg-emerald-50`
              : `${UPLOAD_PICK_BTN} mt-0 shrink-0`
          }
        >
          {hasFile ? "Chọn tệp khác" : pickLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export function CVAnalysis() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const routeMode = location.pathname.includes("/cv-analysis/field")
    ? "field"
    : location.pathname.includes("/cv-analysis/jd")
      ? "jd"
      : null;
  const loginReturnPath = routeMode === "field" ? "/cv-analysis/field" : "/cv-analysis/jd";
  
  const [plans]            = useState(getPlans());
  const [cvRemaining, setCvRemaining] = useState(0);
  const [cvQuotaLimit, setCvQuotaLimit] = useState(CV_FREE_LIMIT);
  const [cvQuotaResetAt, setCvQuotaResetAt] = useState(null);

  const loadCvQuota = useCallback(async () => {
    if (!hasAuthCredentials()) {
      setCvRemaining(0);
      setCvQuotaLimit(CV_FREE_LIMIT);
      setCvQuotaResetAt(null);
      return;
    }
    const res = await fetchCvQuota();
    if (!res.success || !res.quota) return;
    const planKey = getUser()?.plan ?? "free";
    const remaining = computeCvRemainingFromQuota(res.quota, planKey);
    setCvRemaining(Number.isFinite(remaining) ? remaining : 999);
    setCvQuotaLimit(Number(res.quota.cvAnalysisLimit) || CV_FREE_LIMIT);
    setCvQuotaResetAt(res.quota.resetAt ?? null);
  }, []);

  useEffect(() => {
    loadCvQuota();
  }, [loadCvQuota]);

  // Page-level view
  const [pageView, setPageView] = useState("analysis");

  // Upload / analysis flow
  const [step, setStep]    = useState("upload");
  const [cvUploaded, setCvUploaded] = useState(false);
  const [jdUploaded, setJdUploaded] = useState(false);
  const [selectedField, setSelectedField] = useState(() =>
    routeMode === "field" ? DEFAULT_FIELD : ""
  );

  useEffect(() => {
    if (routeMode === "field") {
      setEnableField(true);
      setEnableJD(false);
      setSelectedField((prev) =>
        prev === DEFAULT_FIELD ? prev : DEFAULT_FIELD
      );
    }
  }, [routeMode]);
  const [progress, setProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState(0);

  // Real file state
  const [cvFile, setCvFile] = useState(null);
  const [jdFile, setJdFile] = useState(null);
  const cvInputRef = useRef(null);
  const jdInputRef = useRef(null);

  const [analyzeError,   setAnalyzeError]   = useState(null);

  // Re-analysis from stored paths
  const [reuseCV, setReuseCV] = useState(null);
  const [reuseJD, setReuseJD] = useState(null);

  // History
  const [historyList,     setHistoryList]     = useState([]);
  const [historyLoading,  setHistoryLoading]  = useState(false);
  const [historyError,    setHistoryError]    = useState(null);
  const [deletingId,      setDeletingId]      = useState(null);
  const [loadingAnalysisId, setLoadingAnalysisId] = useState(null);

  const [enableJD, setEnableJD] = useState(routeMode === "jd" || (routeMode !== "field" && USE_EXPRESS_CV));
  const [enableField, setEnableField] = useState(routeMode === "field");

  useEffect(() => {
    if (!routeMode) {
      navigate("/cv-analysis", { replace: true });
      return;
    }
    if (routeMode === "jd") {
      setEnableJD(true);
      setEnableField(false);
    } else if (routeMode === "field") {
      setEnableJD(false);
      setEnableField(true);
    }
  }, [routeMode, navigate]);

  const canAnalyze  = cvRemaining > 0;
  const hasCvInput = Boolean(cvUploaded || reuseCV || cvFile);
  const hasJdInput = Boolean(jdUploaded || reuseJD || jdFile);
  const needsJdForRoute = routeMode === "jd";
  const readyToAnalyze =
    routeMode === "jd"
      ? hasCvInput && hasJdInput
      : routeMode === "field"
        ? hasCvInput && Boolean(selectedField)
        : hasCvInput;

  const primaryCtaLabel = needsJdForRoute
    ? !hasCvInput
      ? "Tải CV để tiếp tục"
      : !hasJdInput
        ? "Tải JD để phân tích"
        : "Bắt đầu phân tích"
    : !hasCvInput
      ? "Tải CV để tiếp tục"
      : enableField && !selectedField
        ? "Chọn ngành để phân tích"
        : "Bắt đầu phân tích";

  const derivedMode = enableJD ? "jd" : enableField ? "field" : "cv-only";

  const goToResultPage = useCallback(
    (payload, { replay = false } = {}) => {
      const mode = routeMode === "field" ? "field" : "jd";
      if (!replay && payload?.analysis) {
        trackAction("cv_analyze_done", location.pathname, {
          mode,
          analysisId: payload.analysisId ?? null,
          matchScore: payload.analysis?.matchScore ?? null,
        });
      }
      navigate(cvAnalysisResultPath(mode, payload.analysisId), {
        state: {
          analysis: payload.analysis,
          savedFileInfo: {
            analysisId: payload.analysisId ?? null,
            cvFileUrl: payload.cvFileUrl ?? null,
            jdFileUrl: payload.jdFileUrl ?? null,
            cvFileName: payload.cvFileName ?? cvFile?.name ?? reuseCV?.name ?? "cv",
            jdFileName: payload.jdFileName ?? jdFile?.name ?? reuseJD?.name ?? null,
          },
          historySaveWarning: payload.historySaveWarning ?? null,
          isReplayFromHistory: replay,
          cvFile,
          jdFile,
        },
      });
    },
    [navigate, routeMode, cvFile, jdFile, reuseCV, reuseJD, location.pathname],
  );

  const resetForm = () => {
    setStep("upload"); setCvUploaded(false); setJdUploaded(false);
    setCvFile(null); setJdFile(null); setSelectedField(""); setProgress(0);
    setAnalyzeError(null);
    setReuseCV(null); setReuseJD(null);
    setEnableJD(false); setEnableField(false);
  };

  const openHistoryResult = useCallback(
    (res) => {
      if (!res?.success || !res.analysis) return false;
      const mode =
        res.historyItem?.mode === "field" || routeMode === "field" ? "field" : "jd";
      navigate(cvAnalysisResultPath(mode, res.analysisId));
      return true;
    },
    [navigate, routeMode],
  );

  // ── Load history when switching to history tab ──────────────────────────
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetchCvAnalyses();
      if (!res.success) throw new Error(res.error || "Lỗi tải lịch sử");
      setHistoryList(res.analyses ?? []);
    } catch (err) {
      setHistoryError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (pageView === "history") loadHistory();
  }, [pageView, loadHistory]);

  // ── File change handlers ────────────────────────────────────────────────
  const handleCVFile = (file) => {
    setCvFile(file);
    setCvUploaded(true);
    setReuseCV(null);
  };
  const handleJDFile = (file) => {
    setJdFile(file);
    setJdUploaded(true);
    setReuseJD(null);
    setEnableJD(true);
    setEnableField(false);
  };

  // ── Main analyze handler ────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!isLoggedIn()) {
      navigate(buildLoginPath(loginReturnPath));
      return;
    }
    const hasCVInput = Boolean(cvUploaded || reuseCV || cvFile);
    if (!hasCVInput) return;
    if (needsJdForRoute && !Boolean(jdUploaded || reuseJD || jdFile)) return;
    if (!canAnalyze) return;

    trackAction("cv_analyze_start", location.pathname, { mode: routeMode });
    setStep("loading"); setAnalyzeError(null); setProgress(0); setLoadingStage(0);

    const hasJdInput = jdUploaded || !!reuseJD || !!jdFile;
    const analyzeMode =
      routeMode === "field" ? "field" : routeMode === "jd" ? "jd" : derivedMode === "cv-only" ? "field" : derivedMode;

    if (routeMode === "field" && !selectedField) return;

    if (cvFile || reuseCV) {
      // ── Real API path ──────────────────────────────────────────────────
      let pct = 0;
      const timer = setInterval(() => {
        pct = Math.min(pct + Math.random() * 5 + 1.5, 88);
        setProgress(pct);
        if (pct > 15) setLoadingStage(1);
        if (pct > 40) setLoadingStage(2);
        if (pct > 65) setLoadingStage(3);
      }, 700);

      try {
        // Storage paths: set by Supabase flow; null for Python-service path
        let cvStoragePath = null;
        let jdStoragePath = null;

        // ── Helpers ────────────────────────────────────────────────────────
        // Force-refresh the session BEFORE sending so we always have the
        // freshest JWT, avoids the "Invalid JWT" 401 caused by stale tokens.
        // We deliberately do NOT send "apikey" as a header because this server's
        // CORS config blocks it (causes FunctionsFetchError / "Failed to fetch").
        const token = await getForceRefreshedToken();
        
        if (!token) {
          clearInterval(timer);
          setStep("upload");
          setAnalyzeError("Vui lòng đăng nhập để phân tích CV.");
          navigate(buildLoginPath(loginReturnPath));
          return;
        }
        
        console.log("✅ CV Analysis, authenticated, token ready");

        let data;

        if (analyzeMode === "jd") {
          // ── Python CV Matcher (qua Express proxy /api/cv/analyze) ──────
          const form = new FormData();
          if (cvFile)   form.append("resume", cvFile);
          if (jdFile)   form.append("jd", jdFile);

          // Cascade: suggestions (full) → full (scores only) → analyze (basic)
          const ollamaDown = (s) => s === 503 || s === 504;

          let pyRes = await fetch(expressApiUrl("/api/cv/analyze/suggestions"), {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          });

          // Tier-2: Ollama có nhưng suggestions thất bại → thử scoring only
          if (ollamaDown(pyRes.status)) {
            const form2 = new FormData();
            if (cvFile) form2.append("resume", cvFile);
            if (jdFile) form2.append("jd", jdFile);
            pyRes = await fetch(expressApiUrl("/api/cv/analyze/full"), {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
              body: form2,
            });
          }

          // Tier-3: Ollama hoàn toàn không chạy → basic skill-matching (không LLM)
          let usedFallback = false;
          if (ollamaDown(pyRes.status)) {
            const form3 = new FormData();
            if (cvFile) form3.append("resume", cvFile);
            if (jdFile) form3.append("jd", jdFile);
            pyRes = await fetch(expressApiUrl("/api/cv/analyze"), {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
              body: form3,
            });
            usedFallback = true;
          }

          clearInterval(timer); setProgress(95); setLoadingStage(4);

          if (!pyRes.ok) {
            const errBody = await pyRes.json().catch(() => ({}));
            throw new Error(formatCvAnalyzerHttpError(pyRes.status, errBody));
          }

          const raw = await pyRes.json();
          const m    = raw.match       ?? {};
          const s    = raw.scores      ?? null;
          const sugg = raw.suggestions ?? {};

          const hasPySuggestions =
            (sugg.rewritten_bullets?.length ?? 0) > 0 ||
            (sugg.missing_skill_suggestions?.length ?? 0) > 0;
          const analysisTier = usedFallback
            ? "basic"
            : hasPySuggestions
              ? "suggestions"
              : s
                ? "full"
                : "basic";
          const pythonEndpoint = usedFallback
            ? "/analyze"
            : hasPySuggestions
              ? "/analyze/suggestions"
              : s
                ? "/analyze/full"
                : "/analyze";

          const matchedSkills = m.matching ?? [];
          const missingSkills = m.missing  ?? [];
          const isSemantic = Boolean(m._semantic);

          // Semantic: dùng evidence cụ thể; fallback về tên kỹ năng
          const strengths = isSemantic && m._matched_details?.length
            ? m._matched_details.slice(0, 6).map(d =>
                d.match_type === "implicit"
                  ? `${d.requirement}: ${d.evidence ?? "có trong CV (suy luận)"}`
                  : d.match_type === "transferable"
                    ? `${d.requirement}: kỹ năng tương đương (${d.evidence ?? "chuyển đổi"})`
                    : d.evidence ? `${d.requirement}: ${d.evidence}` : `Đáp ứng "${d.requirement}"`
              )
            : matchedSkills.slice(0, 6).map(sk => `Có kỹ năng "${sk}" phù hợp với yêu cầu JD`);

          const weaknesses = isSemantic && m._missing_details?.length
            ? m._missing_details.slice(0, 6).map(d =>
                d.importance === "critical"
                  ? `[Bắt buộc] Thiếu "${d.requirement}"`
                  : `Thiếu "${d.requirement}"`
              )
            : missingSkills.slice(0, 6).map(sk => `Thiếu kỹ năng "${sk}" mà JD yêu cầu`);

          // Map rewritten_bullets → "fix" suggestions (hiển thị trước, high value)
          const bulletSuggestions = (sugg.rewritten_bullets ?? []).map(b => ({
            type:          "fix",
            priority:      b.confidence === "high" ? "high" : b.confidence === "low" ? "low" : "medium",
            title:         `Cải thiện bullet: "${(b.original ?? "").slice(0, 65)}${(b.original ?? "").length > 65 ? "…" : ""}"`,
            reason:        b.changes_made?.length
                             ? b.changes_made.join(" · ")
                             : "Viết lại theo chuẩn STAR + nhúng từ khóa JD.",
            before:        b.original  ?? "",
            after:         b.rewritten ?? "",
            keywordsAdded: b.keywords_added ?? [],
            starCheck:     b.star_check     ?? {},
            confidence:    b.confidence     ?? "medium",
          }));

          // Map missing_skill_suggestions → "add" suggestions
          const missSuggestions = (sugg.missing_skill_suggestions ?? []).map(item => ({
            type:          "add",
            priority:      item.priority,
            title:         `Bổ sung kỹ năng "${item.skill}"`,
            reason:        formatSkillSuggestionReason(item, {
              mode: routeMode === "field" ? "field" : "jd",
            }),
            before:        `Chưa có trong CV, ước tính ${item.estimated_effort ?? "chưa rõ"}`,
            after:
              item.acquisition_path && String(item.acquisition_path).trim() &&
              !/^(n\/a|không áp dụng)$/i.test(String(item.acquisition_path).trim())
                ? item.acquisition_path
                : item.skill
                  ? `Bổ sung «${item.skill}» vào mục Kỹ năng hoặc mô tả kinh nghiệm.`
                  : "",
            keywordsAdded: [],
            starCheck:     {},
            confidence:    null,
          }));

          // Bullet rewrites trước, rồi mới skill gaps
          const suggestions = [...bulletSuggestions, ...missSuggestions];

          const analysisPayload = {
              matchScore:      Math.round(m.match_score    ?? 0),
              overallScore:    Math.round((s?.overall ?? 0) * 10),
              totalKeywords:   m.summary?.jd_total         ?? 0,
              matchedKeywords: matchedSkills,
              missingKeywords: missingSkills,
              scores: {
                clarity:     s?.clarity?.score     ?? 0,
                structure:   s?.structure?.score   ?? 0,
                relevance:   s?.relevance?.score   ?? Math.round((m.match_score ?? 0) / 10),
                credibility: s?.credibility?.score ?? 0,
              },
              scoreNotes: {
                clarity:     s?.clarity?.reason     ?? (usedFallback ? "Chỉ phân tích cơ bản, không có điểm AI chi tiết." : ""),
                structure:   s?.structure?.reason   ?? (usedFallback ? "Chỉ phân tích cơ bản, không có điểm AI chi tiết." : ""),
                relevance:   s?.relevance?.reason   ?? (usedFallback ? `Ước tính từ tỷ lệ khớp từ khóa: ${Math.round(m.match_score ?? 0)}%` : ""),
                credibility: s?.credibility?.reason ?? (usedFallback ? "Chỉ phân tích cơ bản, không có điểm AI chi tiết." : ""),
              },
              strengths,
              weaknesses,
              missingDetails: isSemantic
                ? (m._missing_details ?? []).map(d => ({
                    requirement: d.requirement,
                    importance:  d.importance  ?? "important",
                    skillType:   d.skill_type  ?? "market_standard",
                    gapSize:     d.gap_size    ?? "medium",
                  }))
                : [],
              suggestions,
              summary: m._overall_assessment || sugg.executive_summary || s?.summary || "",
              transferableSkills: (m._transferable ?? []).map(t => ({
                requirement: t.requirement ?? "",
                existingSkill: t.existing_skill ?? "",
                estimatedTime: t.estimated_time ?? "",
              })),
              missingKwsWithTime: (() => {
                const timeMap = {};
                for (const item of sugg.missing_skill_suggestions ?? []) {
                  if (item.skill && item.estimated_effort) {
                    timeMap[item.skill.toLowerCase()] = item.estimated_effort;
                  }
                }
                return missingSkills.map(kw => ({ kw, time: timeMap[kw.toLowerCase()] ?? null }));
              })(),
              isSemantic,
              cvText:   raw.resume_text ?? "",
              jdText:   raw.jd_text     ?? "",
          };

          const planFlags = getPlans();
          const planAtTime = planFlags.elitePro ? "enterprise" : planFlags.starterPro ? "pro" : "free";
          const fileUpload = await uploadCvJdFiles(cvFile, jdFile, { includeJd: true });
          const savePayload = buildCvAnalysisSavePayload({
            analysis: analysisPayload,
            cvFileName: cvFile?.name ?? reuseCV?.name ?? "cv.pdf",
            jdFileName: jdFile?.name ?? reuseJD?.name ?? "",
            cvFileUrl: fileUpload.cvFileUrl,
            jdFileUrl: fileUpload.jdFileUrl,
            cvFileId: fileUpload.cvFileId,
            jdFileId: fileUpload.jdFileId,
            analyzeMode: "jd",
            tier: analysisTier,
            planAtTime,
            meta: { pythonEndpoint, fallbackTriggered: usedFallback },
          });
          const saveRes = await saveCvAnalysis(savePayload);
          let historySaveWarning = formatCvSaveError(saveRes);
          if (fileUpload.warnings.length) {
            historySaveWarning = [historySaveWarning, ...fileUpload.warnings]
              .filter(Boolean)
              .join(" · ");
          }
          if (!saveRes.success) {
            console.warn("[CV] Không lưu được lịch sử MongoDB:", saveRes.error, saveRes.message);
          } else if (saveRes.analysisId) {
            window.dispatchEvent(
              new CustomEvent("cv-analysis-saved", {
                detail: { mode: "jd", analysisId: saveRes.analysisId },
              })
            );
          }

          data = {
            success: true,
            analysisId: saveRes.analysisId || null,
            historySaveWarning,
            cvFileUrl: fileUpload.cvFileUrl,
            jdFileUrl: fileUpload.jdFileUrl,
            cvFileName: cvFile?.name ?? reuseCV?.name ?? "cv.pdf",
            jdFileName: jdFile?.name ?? reuseJD?.name ?? null,
            analysis: {
              ...analysisPayload,
              cvFileUrl: fileUpload.cvFileUrl,
              jdFileUrl: fileUpload.jdFileUrl,
            },
          };
        } else if (analyzeMode === "field") {
          const fieldName = selectedField || "IT / Công nghệ";
          let raw = null;
          let usedFieldFallback = true;

          if (USE_EXPRESS_CV && cvFile) {
            const formField = new FormData();
            formField.append("resume", cvFile);
            formField.append("field", fieldName);
            let quotaBlockedError = null;
            try {
              const pyRes = await fetch(expressApiUrl("/api/cv/analyze/field"), {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formField,
              });
              if (pyRes.ok) {
                raw = await pyRes.json();
                usedFieldFallback = Boolean(raw._fallback ?? raw._mock);
              } else if (pyRes.status === 403) {
                // Hết quota — KHÔNG fallback mock (mock sẽ che mất việc bị chặn thật sự).
                const errBody = await pyRes.json().catch(() => ({}));
                quotaBlockedError = new Error(formatCvAnalyzerHttpError(pyRes.status, errBody));
              }
            } catch (err) {
              console.warn("[CV field] API unavailable, using mock", err);
            }
            if (quotaBlockedError) throw quotaBlockedError;
          }

          if (!raw) {
            raw = buildFieldAnalysisMockPipeline(fieldName);
            usedFieldFallback = true;
          }

          clearInterval(timer);
          setProgress(95);
          setLoadingStage(4);

          const analysisPayload = mapPythonCvPipelineToAnalysis(raw, {
            usedFallback: usedFieldFallback,
            field: fieldName,
          });

          const planFlags = getPlans();
          const planAtTime = planFlags.elitePro ? "enterprise" : planFlags.starterPro ? "pro" : "free";
          const fileUpload = await uploadCvJdFiles(cvFile, null, { includeJd: false });
          const savePayload = buildCvAnalysisSavePayload({
            analysis: analysisPayload,
            cvFileName: cvFile?.name ?? reuseCV?.name ?? "cv.pdf",
            jdFileName: "",
            cvFileUrl: fileUpload.cvFileUrl,
            cvFileId: fileUpload.cvFileId,
            analyzeMode: "field",
            tier: "suggestions",
            planAtTime,
            meta: {
              pythonEndpoint: "/analyze/field",
              fallbackTriggered: usedFieldFallback,
              llmProvider: raw._mock ? "mock" : "unknown",
            },
          });
          const saveRes = await saveCvAnalysis(savePayload);
          let historySaveWarning = formatCvSaveError(saveRes);
          if (fileUpload.warnings.length) {
            historySaveWarning = [historySaveWarning, ...fileUpload.warnings]
              .filter(Boolean)
              .join(" · ");
          }
          if (!saveRes.success) {
            console.warn("[CV] Không lưu được lịch sử field:", saveRes.error, saveRes.message);
          } else if (saveRes.analysisId) {
            window.dispatchEvent(
              new CustomEvent("cv-analysis-saved", {
                detail: { mode: "field", analysisId: saveRes.analysisId },
              })
            );
          }

          data = {
            success: true,
            analysisId: saveRes.analysisId || null,
            historySaveWarning,
            cvFileUrl: fileUpload.cvFileUrl,
            cvFileName: cvFile?.name ?? reuseCV?.name ?? "cv.pdf",
            analysis: {
              ...analysisPayload,
              cvFileUrl: fileUpload.cvFileUrl,
            },
          };
        } else {
          throw new Error("Chọn chế độ phân tích CV + JD hoặc theo ngành nghề từ trang hub.");
        }

        setProgress(100);
        await loadCvQuota();
        await new Promise((r) => setTimeout(r, 350));
        goToResultPage(data);
        setStep("upload");
      } catch (err) {
        clearInterval(timer);
        console.error("CV analysis error:", err);
        setAnalyzeError(err.message ?? "Lỗi phân tích");
        setStep("upload");
        // Đồng bộ lại quota hiển thị — phòng trường hợp server chặn 403 quota_exceeded
        // (đa tab / cache client lệch) để banner "hết lượt, nâng cấp" hiện đúng ngay.
        loadCvQuota();
      }
    } else {
      setStep("upload");
      setAnalyzeError("Không tìm thấy file CV. Vui lòng tải lên lại.");
    }
  };

  // ── Load a history item as the current result ───────────────────────────
  const loadHistoryItem = async (id) => {
    setLoadingAnalysisId(id);
    try {
      const res = await fetchCvAnalysisById(id);
      if (!res.success) throw new Error(res.error || "Lỗi tải phân tích");
      openHistoryResult(res);
    } catch (err) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setLoadingAnalysisId(null);
    }
  };

  // ── Re-analyze from stored paths ────────────────────────────────────────
  const reAnalyze = (item) => {
    const target = item.mode === "field" || item.field ? "/cv-analysis/field" : "/cv-analysis/jd";
    navigate(target);
    if (item.cvStoragePath) setReuseCV({ path: item.cvStoragePath, name: item.cvFileName });
    if (item.jdStoragePath && item.jdFileName) {
      setReuseJD({ path: item.jdStoragePath, name: item.jdFileName });
      setEnableJD(true);
      setEnableField(false);
    }
    if (item.field) {
      setSelectedField(item.field);
      setEnableField(true);
      setEnableJD(false);
    }
    // Pre-mark as uploaded so button activates
    setCvUploaded(true);
    if (item.hasJdFile) setJdUploaded(true);
    setPageView("analysis");
  };

  // ── Delete history item ─────────────────────────────────────────────────
  const deleteAnalysis = async (id) => {
    if (!confirm("Xóa phân tích này và các file đính kèm?")) return;
    setDeletingId(id);
    try {
      const res = await deleteCvAnalysis(id);
      if (!res.success) throw new Error(res.error || "Không xóa được");
      setHistoryList(prev => prev.filter(a => a.analysisId !== id));
    } catch (err) {
      alert(`Lỗi xóa: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const loadingSteps =
    routeMode === "jd"
      ? ["Đọc và xử lý file CV...", "Đọc và xử lý file JD...", "Gemini AI phân tích...", "Tạo gợi ý chi tiết..."]
      : routeMode === "field"
        ? [
            "Đọc và xử lý file CV...",
            "Phân tích khớp kỹ năng theo ngành...",
            "Chấm điểm theo tiêu chí ngành...",
            "Tạo gợi ý cải thiện...",
          ]
        : ["Đọc và xử lý file CV...", "Gemini AI phân tích...", "Chấm điểm tiêu chí...", "Tạo gợi ý chi tiết..."];

  const pageHeader =
    routeMode === "field" || routeMode === "jd"
      ? cvAnalysisPageHeader(routeMode)
      : cvAnalysisPageHeader("jd");

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <CvJdAnalysisPage
      activeTab="analysis"
      cardVariant={routeMode === "field" ? "field" : "default"}
      showTabs={true}
      tabAnalysisPath={routeMode === "field" ? CV_FIELD_ANALYSIS_PATH : CV_JD_ANALYSIS_PATH}
      tabHistoryPath={
        routeMode === "field" ? CV_FIELD_HISTORY_PATH : CV_JD_HISTORY_PATH
      }
      {...pageHeader}
      tabTrailing={
        routeMode === "jd" && step === "upload" ? (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold sm:text-[11px] ${
              cvRemaining === 0
                ? "bg-amber-100 text-amber-800 ring-1 ring-amber-200/80"
                : "bg-violet-100 text-violet-800 ring-1 ring-violet-200/70"
            }`}
          >
            {cvRemaining === 0 ? <Lock className="h-3 w-3" /> : <SealPercent className="h-3 w-3" />}
            {cvRemaining}/{cvQuotaLimit} lượt
          </span>
        ) : null
      }
    >
      <div className="px-0 py-0 sm:px-0">

      {/* ═══════════════════════��═══════════════════════════════════════════
          HISTORY VIEW
      ════════════════════════════════════════════════════════════════════ */}
      {pageView === "history" && (
        <div className="px-4 py-5 sm:px-5 sm:py-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-600">Các phân tích đã lưu trên cloud, file gốc có thể tải lại</p>
            <button onClick={loadHistory} className="flex items-center gap-1.5 text-xs font-medium text-[#8037f4] hover:underline">
              <RefreshCw className="w-3.5 h-3.5" /> Làm mới
            </button>
          </div>

          {historyLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-[#8037f4] animate-spin" />
            </div>
          )}

          {historyError && (
            <div className="rounded-2xl px-5 py-4 text-sm" style={{ background: "rgba(255,140,66,0.08)", border: "1.5px solid rgba(255,140,66,0.3)", color: "#c2550a" }}>
              {historyError}
            </div>
          )}

          {!historyLoading && !historyError && historyList.length === 0 && (
            <div className="text-center py-20">
              <CloudUpload className="mx-auto mb-4 h-14 w-14 text-slate-300" />
              <p className="font-medium text-slate-700">Chưa có phân tích nào được lưu</p>
              <p className="mt-1 text-sm text-slate-500">Tải lên CV và phân tích để kết quả được lưu tại đây</p>
              <button onClick={() => setPageView("analysis")} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: "#8037f4" }}>
                <Upload className="w-4 h-4" /> Phân tích ngay
              </button>
            </div>
          )}

          {!historyLoading && historyList.length > 0 && (
            <div className="grid md:grid-cols-2 gap-4">
              {historyList.map(item => {
                const score = item.matchScore ?? 0;
                const scoreColor = score >= 75 ? "#4A7A00" : score >= 55 ? "#8037f4" : "#CC5C00";
                const scoreBg    = score >= 75 ? "rgba(180,240,0,0.12)" : score >= 55 ? "rgba(128, 55, 244,0.08)" : "rgba(255,140,66,0.1)";
                return (
                  <div key={item.analysisId} className="card-premium p-5 hover:shadow-md transition-shadow">
                    {/* top row */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ background: item.mode === "jd" ? "rgba(128, 55, 244,0.08)" : "rgba(255,214,0,0.15)", color: item.mode === "jd" ? "#8037f4" : "#997F00" }}>
                            {item.mode === "jd" ? "CV+JD" : item.field ?? "Theo ngành"}
                          </span>
                          {item.company && <span className="truncate text-xs text-white/50">{item.company}</span>}
                        </div>
                        <p className="truncate text-sm font-semibold text-white">{item.position ?? item.cvFileName}</p>
                        <p className="mt-0.5 text-xs text-white/50">{new Date(item.createdAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                      <div className="flex-shrink-0 text-center px-3 py-1.5 rounded-xl" style={{ background: scoreBg }}>
                        <span className="font-bold text-lg" style={{ color: scoreColor }}>{score}</span>
                        <p className="text-xs" style={{ color: scoreColor, opacity: 0.7 }}>điểm</p>
                      </div>
                    </div>

                    {/* files row */}
                    <div className="flex gap-2 mb-4 flex-wrap">
                      {item.hasCvFile && (
                        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(128, 55, 244,0.07)", color: "#8037f4" }}>
                          <BadgeCheck className="w-3 h-3" /> {item.cvFileName}
                        </span>
                      )}
                      {item.hasJdFile && item.jdFileName && (
                        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(128, 55, 244,0.07)", color: "#8037f4" }}>
                          <BadgeCheck className="w-3 h-3" /> {item.jdFileName}
                        </span>
                      )}
                    </div>

                    {/* actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => loadHistoryItem(item.analysisId)}
                        disabled={loadingAnalysisId === item.analysisId}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:brightness-105"
                        style={{ background: "#8037f4" }}
                      >
                        {loadingAnalysisId === item.analysisId
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Eye className="w-3.5 h-3.5" />}
                        Xem kết quả
                      </button>
                      <button
                        onClick={() => reAnalyze(item)}
                        title="Phân tích lại với file đã lưu"
                        className="p-2 rounded-xl text-[#8037f4] hover:bg-[#8037f4]/10 transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteAnalysis(item.analysisId)}
                        disabled={deletingId === item.analysisId}
                        className="rounded-xl p-2 text-white/45 transition-colors hover:bg-red-500/15 hover:text-red-300"
                      >
                        {deletingId === item.analysisId
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Trash className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ANALYSIS VIEW
      ════════════════════════════════════════════════════════════════════ */}
      {pageView === "analysis" && (
        <div>

          {/* ── UPLOAD ───────────────────────��──────────────────────────── */}
          {step === "upload" && (
            <div className={routeMode === "field" ? "min-h-[30rem] sm:min-h-[32rem]" : undefined}>
              {/* Error */}
              {analyzeError && (
                <div className="flex items-start gap-3 rounded-2xl px-5 py-4 mb-6" style={{ background: "rgba(255,140,66,0.08)", border: "1.5px solid rgba(255,140,66,0.3)" }}>
                  <Warning className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#FF8C42]" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#c2550a]">Phân tích thất bại</p>
                    <p className="text-xs mt-1 text-[#c2550a] opacity-80 leading-relaxed">{analyzeError}</p>
                    {(analyzeError.includes("billing") || analyzeError.includes("quota") || analyzeError.includes("limit")) && (
                      <div className="flex gap-4 mt-2 flex-wrap">
                        <a href="https://console.cloud.google.com/billing" target="_blank" rel="noopener noreferrer"
                          className="text-xs font-bold underline text-[#c2550a] hover:opacity-70">
                          → Bật billing Google Cloud
                        </a>
                        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"
                          className="text-xs font-bold underline text-[#c2550a] hover:opacity-70">
                          → Lấy API key mới tại AI Studio
                        </a>
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => setAnalyzeError(null)} className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-label="Đóng"><X className="h-4 w-4" /></button>
                </div>
              )}

              {cvRemaining === 0 && (
                <div className="mx-4 mb-0 mt-3 flex items-center justify-between gap-2 rounded-xl border border-amber-200/90 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 sm:mx-5">
                  {plans.elitePro ? (
                    // Elite là gói cao nhất — "nâng cấp" không giúp được gì, chỉ có thể chờ reset hàng tháng.
                    <span>
                      Đã dùng hết lượt tháng này.
                      {cvQuotaResetAt
                        ? ` Quota sẽ làm mới vào ${new Date(cvQuotaResetAt).toLocaleDateString("vi-VN")}.`
                        : " Quota sẽ tự làm mới vào đầu chu kỳ sau."}
                    </span>
                  ) : (
                    <>
                      <span>{!plans.starterPro ? "Đã hết lượt miễn phí, nâng cấp để tiếp tục" : "Đã hết lượt phân tích trong gói, nâng cấp để tiếp tục"}</span>
                      <button type="button" onClick={() => navigate("/pricing")} className="font-bold text-[#630ed4] hover:underline">
                        Xem gói
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Hidden inputs */}
              <input ref={cvInputRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleCVFile(f); }} />
              <input ref={jdInputRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleJDFile(f); }} />

              <div
                className={
                  routeMode === "jd" && enableJD
                    ? "grid items-stretch gap-6 pb-2 lg:grid-cols-2 lg:gap-8"
                    : "pb-2"
                }
              >
                <CvUploadDropZone
                  kind="cv"
                  hasFile={cvUploaded || !!reuseCV}
                  fileName={cvFile?.name ?? reuseCV?.name}
                  fileSizeKb={cvFile ? Math.round(cvFile.size / 1024) : null}
                  onPick={() => cvInputRef.current?.click()}
                  onFile={handleCVFile}
                  onClear={() => {
                    setCvUploaded(false);
                    setCvFile(null);
                    setReuseCV(null);
                    if (cvInputRef.current) cvInputRef.current.value = "";
                  }}
                />
                {routeMode === "jd" && enableJD && (
                  <CvUploadDropZone
                    kind="jd"
                    hasFile={jdUploaded || !!reuseJD}
                    fileName={jdFile?.name ?? reuseJD?.name}
                    fileSizeKb={jdFile ? Math.round(jdFile.size / 1024) : null}
                    onPick={() => jdInputRef.current?.click()}
                    onFile={handleJDFile}
                    onClear={() => {
                      setJdUploaded(false);
                      setJdFile(null);
                      setReuseJD(null);
                      if (jdInputRef.current) jdInputRef.current.value = "";
                    }}
                  />
                )}
              </div>

              {routeMode === "field" && enableField && (
                <div className="border-t border-violet-100 px-4 py-4 pb-6 sm:px-5 sm:pb-8">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-violet-700">Ngành nghề</p>
                  <AppSelect
                    size="md"
                    value={selectedField || undefined}
                    onValueChange={setSelectedField}
                    placeholder="Chọn ngành nghề..."
                    aria-label="Ngành nghề"
                    triggerClassName="rounded-2xl border-violet-200 bg-white focus:border-[#8037f4]"
                    options={FIELD_OPTIONS.map((opt) => ({
                      value: opt.label,
                      label: opt.available ? opt.label : `${opt.label} · Sắp ra mắt`,
                      disabled: !opt.available,
                    }))}
                  />
                </div>
              )}

              <div className="border-t border-violet-100 bg-gradient-to-b from-violet-50/40 to-violet-50/70 px-6 py-6 sm:px-8 sm:py-8">
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={!canAnalyze || !readyToAnalyze}
                  className={`flex w-full max-w-2xl mx-auto items-center justify-center gap-2 rounded-2xl py-4 text-base font-extrabold transition-all sm:py-4 sm:text-lg ${
                    canAnalyze && readyToAnalyze
                      ? "bg-gradient-to-r from-[#93f72b] via-[#93f72b] to-[#93f72b] text-violet-950 shadow-[0_8px_28px_rgba(196,255,71,0.35)] hover:brightness-105 active:scale-[0.99]"
                      : "cursor-not-allowed bg-violet-200/60 text-violet-500"
                  }`}
                >
                  <Zap className="h-5 w-5 shrink-0" strokeWidth={2.25} />
                  {primaryCtaLabel}
                </button>
              </div>

            </div>
          )}

          {/* ── LOADING ─────────────────────────────────────────────────── */}
          {step === "loading" && (
            <div className="flex flex-col items-center justify-center px-4 py-16 sm:px-6 sm:py-20 max-w-md mx-auto text-center">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-8 shadow-xl shadow-[#8037f4]/30" style={{ background: "#8037f4" }}>
                <Loader2 className="w-10 h-10 text-white animate-spin" />
              </div>
              <h2 className="mb-3 text-xl font-semibold text-slate-900">Đang xử lý...</h2>
              <p className="mb-8 text-sm text-slate-600">Hệ thống đang đọc file PDF và phân tích, vui lòng đợi.</p>
              <div className="mb-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, background: "#8037f4" }} />
              </div>
              <p className="text-[#8037f4] text-sm font-medium mb-6">{Math.round(progress)}%</p>
              <div className="space-y-2 text-left w-full">
                {loadingSteps.map((t, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 text-sm transition-all duration-500 ${
                      loadingStage > i ? "text-slate-800" : loadingStage === i ? "text-slate-700" : "text-slate-400"
                    }`}
                  >
                    {loadingStage > i ? <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <Loader2 className={`w-4 h-4 flex-shrink-0 text-[#8037f4] ${loadingStage === i ? "animate-spin" : "opacity-40"}`} />}
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
      </div>
    </CvJdAnalysisPage>
  );
}

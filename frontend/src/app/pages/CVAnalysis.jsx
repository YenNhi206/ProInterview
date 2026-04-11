import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  FileText,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Zap,
  AlertTriangle as Warning,
  Mic,
  Users,
  Briefcase,
  ArrowLeft,
  Lock,
  Percent as SealPercent,
  PlusCircle,
  Wrench,
  Trash2 as Trash,
  BarChart3,
  Lightbulb,
  Loader2,
  Upload,
  CloudUpload,
  Download as DownloadSimple,
  Eye,
  RotateCcw as History,
  Search,
  RefreshCw,
  BadgeCheck,
} from "lucide-react";
import { getPlans, getCVRemaining, incrementCVCount, CV_FREE_LIMIT } from "../utils/auth";
import { CVDocumentPreview } from "../components/CVDocumentPreview";
import { addCVAnalysisRecord } from "../utils/history";
import { projectId, publicAnonKey } from "/utils/supabase/info.js";

// ─── API base ─────────────────────────────────────────────────────────────────
const EDGE_FN = "make-server-64a0c849";
const API_BASE = `https://${projectId}.supabase.co/functions/v1/${EDGE_FN}`;

function getSessionId() {
  const key = "prointerview_session_id";
  let id = localStorage.getItem(key);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id); }
  return id;
}

// This server does NOT list "apikey" in Access-Control-Allow-Headers,
// so sending it as a header causes CORS preflight to fail with
// "Failed to fetch". Only Authorization is safe to include.
function apiHeaders(userToken) {
  const t = userToken ?? "";
  const hasToken = !!(t && t !== "null" && t !== "undefined" && t.length > 20);
  if (!hasToken) return {};
  return { "Authorization": `Bearer ${t}` };
}

function apiUrl(path) {
  return `${API_BASE}/${path}`;
}

/**
 * JWT từ backend (/api/auth). Edge function Supabase có thể không chấp nhận token này —
 * khi đó CV vẫn chạy ở chế độ demo (không gửi Bearer).
 */
async function getForceRefreshedToken() {
  try {
    const { getFreshAccessToken } = await import("../utils/auth");
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

// ─── Constants ────────────────────────────────────────────────────────────────
const FIELDS = [
  "IT / Công nghệ", "Marketing", "Tài chính / Kế toán", "Nhân sự",
  "Quản lý sản phẩm", "Thiết kế / UX", "Kinh doanh", "Vận hành",
];

const DEMO_MATCHED   = ["React", "TypeScript", "Node.js", "REST API", "Agile", "Git"];
const DEMO_JD_KWS    = ["React", "TypeScript", "Node.js", "Docker", "AWS", "CI/CD", "REST API", "PostgreSQL", "Agile", "Git"];
const DEMO_SCORES    = [
  { criteria: "Clarity (Rõ ràng)",      score: 7, max: 10, status: "good", note: "CV có cấu trúc khá rõ, các mục được trình bày logic." },
  { criteria: "Structure (STAR)",        score: 6, max: 10, status: "ok",   note: "Phần kinh nghiệm chưa theo format STAR đầy đủ." },
  { criteria: "Relevance (Liên quan JD)",score: 8, max: 10, status: "good", note: "6/10 từ khóa kỹ thuật trong JD có trong CV." },
  { criteria: "Credibility (Thuyết phục)",score:5, max: 10, status: "warn", note: "Thiếu số liệu KPI cụ thể." },
];
const DEMO_SUGGESTIONS = [
  { type: "add", priority: "high",   title: "Thêm Docker & AWS vào Kỹ năng",      reason: "JD yêu cầu Docker & AWS bắt buộc.",                   before: "Tools: Git, Webpack, Vite", after: "Tools: Git, Webpack, Docker, AWS (EC2, S3)" },
  { type: "add", priority: "high",   title: "Đề cập CI/CD trong Kinh nghiệm",     reason: "JD yêu cầu CI/CD pipeline.",                          before: "• Quản lý source code qua Git", after: "• Quản lý Git, thiết lập CI/CD với GitHub Actions" },
  { type: "add", priority: "medium", title: "Thêm PostgreSQL vào Database",        reason: "JD đề cập PostgreSQL là DB chính.",                    before: "Database: MySQL, MongoDB", after: "Database: MySQL, MongoDB, PostgreSQL" },
  { type: "fix", priority: "high",   title: "Thêm số liệu vào mô tả thành tích",  reason: "Nhà tuyển dụng cần con số cụ thể.",                   before: "• Tối ưu hiệu năng React", after: "• Tối ưu React, giảm 40% load time, Lighthouse 65→92" },
  { type: "fix", priority: "medium", title: "Viết lại Kinh nghiệm theo STAR",      reason: "Thiếu Situation, Action, Result.",                     before: "• Xây dựng REST API với Node.js", after: "• Thiết kế 12 API endpoints, 50k req/day, 99.9% uptime" },
  { type: "remove", priority: "low", title: "Loại bỏ kỹ năng không liên quan JD", reason: "Photoshop/Illustrator làm phân tán khỏi vai trò FE.", before: "Others: Photoshop, Illustrator", after: "Others: Figma, Storybook, Jest" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

// ─── Component ────────────────────────────────────────────────────────────────
export function CVAnalysis() {
  const navigate    = useNavigate();
  const [searchParams] = useSearchParams();

  const [plans]            = useState(getPlans());
  const [cvRemaining, setCvRemaining] = useState(getCVRemaining());

  // Page-level view
  const [pageView, setPageView] = useState("analysis");

  // Upload / analysis flow
  const [step, setStep]    = useState("upload");
  const [cvUploaded, setCvUploaded] = useState(false);
  const [jdUploaded, setJdUploaded] = useState(false);
  const [selectedField, setSelectedField] = useState("");
  const [fieldOpen, setFieldOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState(0);
  const [dragOverCV, setDragOverCV] = useState(false);
  const [dragOverJD, setDragOverJD] = useState(false);

  // Real file state
  const [cvFile, setCvFile] = useState(null);
  const [jdFile, setJdFile] = useState(null);
  const cvInputRef = useRef(null);
  const jdInputRef = useRef(null);

  // Results
  const [analysisResult, setAnalysisResult] = useState(null);
  const [savedFileInfo,  setSavedFileInfo]  = useState(null);
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

  // NEW: Optional JD/Field checkboxes
  const [enableJD, setEnableJD] = useState(false);
  const [enableField, setEnableField] = useState(false);

  const canAnalyze  = plans.starterPro || plans.elitePro || cvRemaining > 0;
  const isFreeTier  = !plans.starterPro && !plans.elitePro;

  // Derived mode based on checkboxes
  const derivedMode = enableJD ? "jd" : enableField ? "field" : "cv-only";

  // ── Derived result data ─────────────────────────────────────────────────
  const R = analysisResult;
  const matchScore   = R?.matchScore ?? 72;
  const matchedSet   = new Set(R ? R.matchedKeywords : DEMO_MATCHED);
  const cvDisplayKWs = R ? R.matchedKeywords     : DEMO_MATCHED;
  const jdDisplayKWs = R ? [...R.matchedKeywords, ...R.missingKeywords] : DEMO_JD_KWS;
  const scoreTableData = R ? [
    { criteria: "Clarity (Rõ ràng)",       score: R.scores.clarity,     max: 10, status: R.scores.clarity     >= 8 ? "good" : R.scores.clarity     >= 6 ? "ok" : "warn", note: R.scoreNotes?.clarity     ?? "" },
    { criteria: "Structure (STAR)",         score: R.scores.structure,   max: 10, status: R.scores.structure   >= 8 ? "good" : R.scores.structure   >= 6 ? "ok" : "warn", note: R.scoreNotes?.structure   ?? "" },
    { criteria: "Relevance (Liên quan JD)", score: R.scores.relevance,   max: 10, status: R.scores.relevance   >= 8 ? "good" : R.scores.relevance   >= 6 ? "ok" : "warn", note: R.scoreNotes?.relevance   ?? "" },
    { criteria: "Credibility (Thuyết phục)",score: R.scores.credibility, max: 10, status: R.scores.credibility >= 8 ? "good" : R.scores.credibility >= 6 ? "ok" : "warn", note: R.scoreNotes?.credibility ?? "" },
  ] : DEMO_SCORES;
  const suggestionsData = R?.suggestions ?? DEMO_SUGGESTIONS;
  const strengthsData   = R?.strengths   ?? ["React & TypeScript — khớp hoàn toàn với JD", "Node.js + REST API phù hợp", "Agile/Scrum đã có trong CV", "Dự án e-commerce liên quan"];
  const weaknessesData  = R?.weaknesses  ?? ["Thiếu Docker, AWS, CI/CD", "Không có PostgreSQL", "Mô tả thiếu số liệu KPI", "Kinh nghiệm chưa theo STAR"];
  const highCount   = suggestionsData.filter(s => s.priority === "high").length;
  const mediumCount = suggestionsData.filter(s => s.priority === "medium").length;
  const lowCount    = suggestionsData.filter(s => s.priority === "low").length;

  // ── Reset handler (currently not triggered) ────────────────────────────
  const resetForm = () => {
    setStep("upload"); setCvUploaded(false); setJdUploaded(false);
    setCvFile(null); setJdFile(null); setSelectedField(""); setProgress(0);
    setAnalysisResult(null); setSavedFileInfo(null); setAnalyzeError(null);
    setReuseCV(null); setReuseJD(null);
    setEnableJD(false); setEnableField(false);
  };

  // ── Load history when switching to history tab ──────────────────────────
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const token = await getForceRefreshedToken();
      const res = await fetch(apiUrl("cv/analyses"), { headers: apiHeaders(token) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi tải lịch sử");
      setHistoryList(data.analyses ?? []);
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
  const handleCVFile = (file) => { setCvFile(file); setCvUploaded(true); setReuseCV(null); };
  const handleJDFile = (file) => { setJdFile(file); setJdUploaded(true); setReuseJD(null); };

  // ── Main analyze handler ────────────────────────────────────────────────
  const handleAnalyze = async () => {
    const hasCVInput = cvUploaded || !!reuseCV;
    if (!hasCVInput) return;
    if (!canAnalyze) return;

    if (!plans.starterPro && !plans.elitePro) {
      setCvRemaining(prev => Math.max(0, prev - 1));
      incrementCVCount();
    }

    setStep("loading"); setAnalyzeError(null); setProgress(0); setLoadingStage(0);

    // Use derivedMode instead of mode
    const analyzeMode = derivedMode === "cv-only" ? "field" : derivedMode;

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
        // ── Helpers ────────────────────────────────────────────────────────
        const applyResult = (d) => {
          setAnalysisResult(d.analysis);
          setSavedFileInfo({
            analysisId:    d.analysisId,
            cvSignedUrl:   d.cvSignedUrl,
            jdSignedUrl:   d.jdSignedUrl,
            cvFileName:    cvFile?.name ?? reuseCV?.name ?? "cv",
            jdFileName:    jdFile?.name ?? reuseJD?.name ?? null,
            cvStoragePath,
            jdStoragePath,
          });
          addCVAnalysisRecord({
            id: `cv-${Date.now()}`, date: new Date().toLocaleDateString("vi-VN"),
            mode: analyzeMode , cvFile: cvFile?.name ?? reuseCV?.name ?? "cv",
            jdFile: jdFile?.name ?? reuseJD?.name ?? null,
            field: analyzeMode === "field" ? (selectedField || "IT / Công nghệ") : null,
            company: d.analysis.company ?? null, position: d.analysis.position ?? null,
            matchScore: d.analysis.matchScore, totalKeywords: d.analysis.totalKeywords,
            matchedKeywords: d.analysis.matchedKeywords, missingKeywords: d.analysis.missingKeywords,
            scores: d.analysis.scores, strengths: d.analysis.strengths,
            weaknesses: d.analysis.weaknesses, suggestions: d.analysis.suggestions,
          } );
        };

        const applyMockResult = () => {
          setAnalysisResult({
            _isMocked: true,
            matchScore: derivedMode === "jd" ? 72 : 68,
            totalKeywords: DEMO_JD_KWS.length,
            matchedKeywords,
            missingKeywords: DEMO_JD_KWS.filter(k => !DEMO_MATCHED.includes(k)),
            scores: { clarity: 7, structure: 6, relevance: 8, credibility: 5 },
            scoreNotes: {
              clarity: DEMO_SCORES[0].note, structure: DEMO_SCORES[1].note,
              relevance: DEMO_SCORES[2].note, credibility: DEMO_SCORES[3].note,
            },
            position: "Frontend Developer", company: derivedMode === "jd" ? "Tech Corp" : null,
            strengths: [
              "CV có cấu trúc rõ ràng, dễ đọc và logic.",
              "Kỹ năng React & TypeScript phù hợp JD.",
              "Đã có kinh nghiệm làm việc thực tế với REST API.",
            ],
            weaknesses: [
              "Thiếu kỹ năng Docker & AWS mà JD yêu cầu bắt buộc.",
              "Không đề cập CI/CD pipeline trong kinh nghiệm.",
              "Thiếu số liệu KPI cụ thể trong các mô tả thành tích.",
            ],
            suggestions,
          });
          setSavedFileInfo(null);
        };

        // Force-refresh the session BEFORE sending so we always have the
        // freshest JWT — avoids the "Invalid JWT" 401 caused by stale tokens.
        // We deliberately do NOT send "apikey" as a header because this server's
        // CORS config blocks it (causes FunctionsFetchError / "Failed to fetch").
        const token = await getForceRefreshedToken();
        
        // If no token (not authenticated), use demo mode immediately
        if (!token) {
          console.info("📋 CV Analysis: No authentication — using demo mode");
          clearInterval(timer);
          applyMockResult();
          setProgress(100);
          await new Promise(r => setTimeout(r, 350));
          setStep("result");
          return;
        }
        
        console.log("✅ CV Analysis — authenticated, token ready");

        const fd = buildFd(cvFile, reuseCV, jdFile, reuseJD, analyzeMode, selectedField);
        const headers = apiHeaders(token);
        const url = apiUrl("cv-analysis");
        
        console.log("📤 CV Analysis API Call:", {
          url,
          hasAuthHeader: !!headers.Authorization,
          tokenLength: token.length
        });
        
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: fd,
        });

        clearInterval(timer); setProgress(95); setLoadingStage(4);

        if (!res.ok) {
          // Check 401 first (expected behavior — fallback to demo)
          if (res.status === 401) {
            console.info("📋 Server authentication issue — using demo result");
            applyMockResult();
            setProgress(100);
            await new Promise(r => setTimeout(r, 350));
            setStep("result");
            return;
          }
          
          // For other errors, log and throw
          const errJson = await res.json().catch(() => ({}));
          console.error("CV analysis error:", res.status, errJson);
          throw new Error(errJson.message || errJson.error || `Server ${res.status}`);
        }

        const data = await res.json();
        if (!data?.success) throw new Error(data?.error || "Phân tích thất bại");

        applyResult(data);

        setProgress(100);
        await new Promise(r => setTimeout(r, 350));
        setStep("result");
      } catch (err) {
        clearInterval(timer);
        console.error("CV analysis error:", err);
        setAnalyzeError(err.message ?? "Lỗi phân tích");
        setStep("upload");
      }
    } else {
      // ── Demo path ──────────────────────────────────────────────────────
      let p = 0;
      const iv = setInterval(() => {
        p += Math.random() * 15;
        if (p >= 100) { p = 100; clearInterval(iv); setTimeout(() => setStep("result"), 400); }
        setProgress(Math.min(p, 100));
        if (p > 20) setLoadingStage(1);
        if (p > 50) setLoadingStage(2);
        if (p > 75) setLoadingStage(3);
      }, 400);
    }
  };

  // ── Load a history item as the current result ───────────────────────────
  const loadHistoryItem = async (id) => {
    setLoadingAnalysisId(id);
    try {
      const token = await getForceRefreshedToken();
      const res = await fetch(apiUrl(`cv/analyses/${id}`), { headers: apiHeaders(token) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Lỗi tải phân tích");

      setAnalysisResult(data.record.analysis);
      setSavedFileInfo({
        analysisId:    data.record.analysisId,
        cvSignedUrl:   data.cvSignedUrl,
        jdSignedUrl:   data.jdSignedUrl,
        cvFileName:    data.record.cvFileName,
        jdFileName:    data.record.jdFileName,
      });
      setPageView("analysis");
      setStep("result");
    } catch (err) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setLoadingAnalysisId(null);
    }
  };

  // ── Re-analyze from stored paths ────────────────────────────────────────
  const reAnalyze = (item) => {
    navigate(`/cv-analysis`);
    if (item.cvStoragePath) setReuseCV({ path: item.cvStoragePath, name: item.cvFileName });
    if (item.jdStoragePath && item.jdFileName) {
      setReuseJD({ path: item.jdStoragePath, name: item.jdFileName });
      setEnableJD(true);
    }
    if (item.field) {
      setSelectedField(item.field);
      setEnableField(true);
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
      const token = await getForceRefreshedToken();
      const res = await fetch(apiUrl(`cv/analyses/${id}`), { method: "DELETE", headers: apiHeaders(token) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      setHistoryList(prev => prev.filter(a => a.analysisId !== id));
    } catch (err) {
      alert(`Lỗi xóa: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const loadingSteps = derivedMode === "jd"
    ? ["Đọc và xử lý file CV...", "Đọc và xử lý file JD...", "Gemini AI phân tích...", "Tạo gợi ý chi tiết..."]
    : ["Đọc và xử lý file CV...", "Gemini AI phân tích...", "Chấm điểm tiêu chí...", "Tạo gợi ý chi tiết..."];

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="pi-page-dashboard-bg min-h-full w-full text-white selection:bg-[rgba(196,255,71,0.28)] selection:text-white">
      {/* ── Hero — cùng họ typography / lưới như Dashboard ── */}
      <header className="relative border-b border-white/[0.07] pb-14 pt-12 sm:pb-16 sm:pt-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.09]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.45) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.45) 1px,transparent 1px)",
            backgroundSize: "32px 32px",
          }}
          aria-hidden
        />
        <div className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8">
          <div className="max-w-3xl">
            <div className="mb-4 flex items-center gap-3">
              <FileText className="size-5 text-[#c4ff47]" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-300/90">Phân tích CV/JD</span>
            </div>
            <h1 className="mb-4 text-3xl font-black leading-[1.05] tracking-tighter text-white md:text-5xl">
              Phân tích CV{" "}
              <span className="bg-gradient-to-r from-[#c4ff47] via-fuchsia-300 to-violet-300 bg-clip-text text-transparent">
                {"& JD"}
              </span>
            </h1>
            <p className="mb-8 max-w-2xl text-sm font-semibold leading-relaxed text-white/65 sm:text-base">
              Hệ thống AI đa năng tự động phân tích CV, trích xuất kỹ năng chuyên môn từ JD và tạo đề xuất cải thiện hồ sơ phù hợp. Lưu trữ sẵn sàng cho Phỏng vấn AI thực tế.
            </p>
          </div>
        </div>
      </header>

      <div className="relative z-[1] mx-auto max-w-6xl px-6 pb-10 pt-10">

      {/* Page tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { val: "analysis", label: "Phân tích mới", icon: <Search className="w-4 h-4" /> },
          { val: "history",  label: "Lịch sử", icon: <History className="w-4 h-4" /> },
        ].map(t => (
          <button
            key={t.val}
            onClick={() => t.val === "history" ? navigate("/cv-analysis/history") : setPageView(t.val)}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${pageView === t.val ? "text-white shadow" : "border border-white/12 bg-white/[0.06] text-white/65 hover:border-[#6E35E8]/35"}`}
            style={pageView === t.val ? { background: "#6E35E8" } : {}}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════��═══════════════════════════════════════════
          HISTORY VIEW
      ════════════════════════════════════════════════════════════════════ */}
      {pageView === "history" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-white/60">Các phân tích đã lưu trên cloud — file gốc có thể tải lại</p>
            <button onClick={loadHistory} className="flex items-center gap-1.5 text-xs font-medium text-[#6E35E8] hover:underline">
              <RefreshCw className="w-3.5 h-3.5" /> Làm mới
            </button>
          </div>

          {historyLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-[#6E35E8] animate-spin" />
            </div>
          )}

          {historyError && (
            <div className="rounded-2xl px-5 py-4 text-sm" style={{ background: "rgba(255,140,66,0.08)", border: "1.5px solid rgba(255,140,66,0.3)", color: "#c2550a" }}>
              {historyError}
            </div>
          )}

          {!historyLoading && !historyError && historyList.length === 0 && (
            <div className="text-center py-20">
              <CloudUpload className="mx-auto mb-4 h-14 w-14 text-white/25" />
              <p className="font-medium text-white/70">Chưa có phân tích nào được lưu</p>
              <p className="mt-1 text-sm text-white/50">Tải lên CV và phân tích để kết quả được lưu tại đây</p>
              <button onClick={() => setPageView("analysis")} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: "#6E35E8" }}>
                <Upload className="w-4 h-4" /> Phân tích ngay
              </button>
            </div>
          )}

          {!historyLoading && historyList.length > 0 && (
            <div className="grid md:grid-cols-2 gap-4">
              {historyList.map(item => {
                const score = item.matchScore ?? 0;
                const scoreColor = score >= 75 ? "#4A7A00" : score >= 55 ? "#6E35E8" : "#CC5C00";
                const scoreBg    = score >= 75 ? "rgba(180,240,0,0.12)" : score >= 55 ? "rgba(110, 53, 232,0.08)" : "rgba(255,140,66,0.1)";
                return (
                  <div key={item.analysisId} className="card-premium p-5 hover:shadow-md transition-shadow">
                    {/* top row */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ background: item.mode === "jd" ? "rgba(110, 53, 232,0.08)" : "rgba(255,214,0,0.15)", color: item.mode === "jd" ? "#6E35E8" : "#997F00" }}>
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
                        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(110, 53, 232,0.07)", color: "#6E35E8" }}>
                          <BadgeCheck className="w-3 h-3" /> {item.cvFileName}
                        </span>
                      )}
                      {item.hasJdFile && item.jdFileName && (
                        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(110, 53, 232,0.07)", color: "#6E35E8" }}>
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
                        style={{ background: "linear-gradient(135deg,#6E35E8,#8B4DFF)" }}
                      >
                        {loadingAnalysisId === item.analysisId
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Eye className="w-3.5 h-3.5" />}
                        Xem kết quả
                      </button>
                      <button
                        onClick={() => reAnalyze(item)}
                        title="Phân tích lại với file đã lưu"
                        className="p-2 rounded-xl text-[#6E35E8] hover:bg-[#6E35E8]/10 transition-colors"
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
            <div>
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
                  <button type="button" onClick={() => setAnalyzeError(null)} className="rounded-lg p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white/80" aria-label="Đóng"><X className="h-4 w-4" /></button>
                </div>
              )}

              {/* Usage */}
              {!plans.starterPro && !plans.elitePro && (
                <div className="flex items-center justify-between rounded-2xl px-5 py-4 mb-6" style={{ background: cvRemaining === 0 ? "rgba(255,140,66,0.08)" : "rgba(110, 53, 232,0.06)", border: `1.5px solid ${cvRemaining === 0 ? "rgba(255,140,66,0.3)" : "rgba(110, 53, 232,0.15)"}` }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: cvRemaining === 0 ? "rgba(255,140,66,0.15)" : "rgba(110, 53, 232,0.12)" }}>
                      {cvRemaining === 0 ? <Lock className="w-4 h-4 text-[#FF8C42]" /> : <SealPercent className="w-4 h-4 text-[#6E35E8]" />}
                    </div>
                    <div>
                      {cvRemaining === 0
                        ? <><p className="text-sm font-semibold text-[#c2550a]">Đã dùng hết {CV_FREE_LIMIT} lượt miễn phí</p><p className="text-xs text-[#c2550a] opacity-70">Nâng cấp để phân tích không giới hạn</p></>
                        : <><p className="text-sm font-semibold text-violet-200">{cvRemaining}/{CV_FREE_LIMIT} lượt miễn phí còn lại</p><p className="text-xs text-white/55">Nâng cấp để dùng không giới hạn</p></>}
                    </div>
                  </div>
                  <button onClick={() => navigate("/pricing")} className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl" style={cvRemaining === 0 ? { background: "#FF8C42", color: "#fff" } : { background: "rgba(110, 53, 232,0.1)", color: "#6E35E8" }}>
                    <Zap className="w-3.5 h-3.5" />{cvRemaining === 0 ? "Nâng cấp ngay" : "Xem gói CV Pro"}
                  </button>
                </div>
              )}

              {/* Hidden inputs */}
              <input ref={cvInputRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleCVFile(f); }} />
              <input ref={jdInputRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleJDFile(f); }} />

              {/* CV Upload Zone - Always visible with modern full-width design */}
              <div className="mb-8">
                <div className="mb-6">
                  <h3 className="mb-2 text-xl font-bold tracking-tight text-white">Upload CV của bạn</h3>
                  <p className="text-sm text-white/65">Bắt đầu bằng việc tải lên CV để phân tích chất lượng</p>
                </div>
                
                <div
                  onDragOver={e => { e.preventDefault(); setDragOverCV(true); }}
                  onDragLeave={() => setDragOverCV(false)}
                  onDrop={e => { e.preventDefault(); setDragOverCV(false); const f = e.dataTransfer.files?.[0]; if (f) handleCVFile(f); }}
                  onClick={() => cvInputRef.current?.click()}
                  className={`group relative cursor-pointer rounded-3xl border-2 border-dashed p-12 text-center backdrop-blur-sm transition-all ${dragOverCV ? "border-[#6E35E8] bg-[#6E35E8]/15" : (cvUploaded || reuseCV) ? "border-[#c4ff47]/60 bg-[#c4ff47]/[0.08]" : "border-white/18 bg-white/[0.04] hover:border-violet-400/45 hover:bg-white/[0.08]"}`}
                  style={(cvUploaded || reuseCV) ? { background: "rgba(180,240,0,0.06)" } : {}}
                >
                  {(cvUploaded || reuseCV) ? (
                    <div className="flex flex-col items-center">
                      <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5" style={{ background: "rgba(180,240,0,0.15)" }}>
                        {reuseCV ? <BadgeCheck className="w-10 h-10" style={{ color: "#6E9900" }} /> : <Check className="w-10 h-10" style={{ color: "#6E9900" }} />}
                      </div>
                      <p className="font-bold text-lg mb-2 text-[#4A7A00]">{reuseCV ? "Dùng lại file đã lưu" : "CV đã được tải lên"}</p>
                      <p className="text-sm text-[#6E9900] mb-1 font-medium">{cvFile?.name ?? reuseCV?.name}</p>
                      {cvFile && <p className="text-sm text-white/55">{(cvFile.size / 1024).toFixed(0)} KB · {cvFile.name.split(".").pop()?.toUpperCase()}</p>}
                      {reuseCV && <p className="text-sm text-white/55">Đã lưu trên cloud</p>}
                      <button onClick={e => { e.stopPropagation(); setCvUploaded(false); setCvFile(null); setReuseCV(null); if (cvInputRef.current) cvInputRef.current.value = ""; }} className="mt-4 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white/80">
                        <X className="w-4 h-4" /> Xóa và tải lại
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="w-20 h-20 rounded-3xl bg-[#6E35E8]/10 flex items-center justify-center mb-5 group-hover:bg-[#6E35E8]/20 transition-colors"><FileText className="w-10 h-10 text-[#6E35E8]" /></div>
                      <p className="mb-2 text-lg font-bold text-white">Kéo & thả CV vào đây</p>
                      <p className="mb-6 max-w-md text-white/60">hoặc click vào vùng này để chọn file từ máy tính của bạn</p>
                      <div className="bg-[#6E35E8] text-white text-sm font-bold px-8 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-[#6E35E8]/20 hover:shadow-xl hover:shadow-[#6E35E8]/30 hover:-translate-y-0.5 transition-all">
                        <Upload className="w-4 h-4" /> Chọn file CV
                      </div>
                      <p className="mt-6 flex items-center gap-2 text-sm text-white/50">
                        <FileText className="w-4 h-4" /> PDF, DOC, DOCX, TXT · tối đa 10MB
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Optional modes as modern button toggles */}
              <div className="mb-8">
                <div className="mb-4">
                  <h3 className="mb-2 text-base font-bold text-white">Tùy chọn phân tích nâng cao</h3>
                  <p className="text-sm text-white/60">Chọn một trong các tùy chọn để phân tích chuyên sâu hơn</p>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Button: Upload JD */}
                  <button
                    onClick={() => {
                      setEnableJD(!enableJD);
                      if (!enableJD) setEnableField(false);
                    }}
                    className={`group relative rounded-2xl border-2 p-6 text-left backdrop-blur-sm transition-all hover:shadow-md ${
                      enableJD
                        ? "border-[#6E35E8] bg-[#6E35E8]/15 shadow-sm"
                        : "border-white/12 bg-white/[0.04] hover:border-violet-400/35"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl transition-all ${
                        enableJD ? "bg-[#6E35E8] shadow-lg shadow-[#6E35E8]/25" : "bg-white/[0.08] group-hover:bg-[#6E35E8]/20"
                      }`}>
                        <Briefcase className={`h-6 w-6 ${enableJD ? "text-white" : "text-white/45 group-hover:text-violet-200"}`} fill={enableJD ? "currentColor" : "none"} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className={`font-bold ${enableJD ? "text-violet-200" : "text-white"}`}>
                            Có Job Description
                          </p>
                          {enableJD && (
                            <div className="w-5 h-5 rounded-full bg-[#B4F000] flex items-center justify-center">
                              <Check className="w-3 h-3 text-[#4A7A00]" />
                            </div>
                          )}
                        </div>
                        <p className={`text-sm leading-relaxed ${enableJD ? "text-violet-100/90" : "text-white/60"}`}>
                          Upload JD để phân tích mức độ phù hợp CV với vị trí tuyển dụng cụ thể
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* Button: Select Field */}
                  <button
                    onClick={() => {
                      setEnableField(!enableField);
                      if (!enableField) setEnableJD(false);
                    }}
                    className={`group relative rounded-2xl border-2 p-6 text-left backdrop-blur-sm transition-all hover:shadow-md ${
                      enableField
                        ? "border-[#8B4DFF] bg-[#8B4DFF]/15 shadow-sm"
                        : "border-white/12 bg-white/[0.04] hover:border-violet-400/35"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl transition-all ${
                        enableField ? "bg-[#8B4DFF] shadow-lg shadow-[#8B4DFF]/25" : "bg-white/[0.08] group-hover:bg-[#8B4DFF]/20"
                      }`}>
                        <Users className={`h-6 w-6 ${enableField ? "text-white" : "text-white/45 group-hover:text-violet-200"}`} fill={enableField ? "currentColor" : "none"} />
                      </div>
                      <div className="flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <p className={`font-bold ${enableField ? "text-violet-200" : "text-white"}`}>
                            Chọn theo ngành nghề
                          </p>
                          {enableField && (
                            <div className="w-5 h-5 rounded-full bg-[#B4F000] flex items-center justify-center">
                              <Check className="w-3 h-3 text-[#4A7A00]" />
                            </div>
                          )}
                        </div>
                        <p className={`text-sm leading-relaxed ${enableField ? "text-violet-100/90" : "text-white/60"}`}>
                          Đánh giá và tinh chỉnh CV đạt chuẩn chuyên nghiệp của từng nhóm ngành.
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* JD Upload zone - conditional */}
              {enableJD && (
                <div className="mb-8">
                  <div className="mb-4">
                    <h3 className="mb-1 text-base font-bold text-white">Upload Job Description</h3>
                    <p className="text-sm text-white/60">Tải lên JD để so sánh với CV của bạn</p>
                  </div>
                  
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOverJD(true); }}
                    onDragLeave={() => setDragOverJD(false)}
                    onDrop={e => { e.preventDefault(); setDragOverJD(false); const f = e.dataTransfer.files?.[0]; if (f) handleJDFile(f); }}
                    onClick={() => jdInputRef.current?.click()}
                    className={`group relative cursor-pointer rounded-3xl border-2 border-dashed p-10 text-center backdrop-blur-sm transition-all ${dragOverJD ? "border-[#8B4DFF] bg-[#6E35E8]/15" : (jdUploaded || reuseJD) ? "border-[#c4ff47]/60 bg-[#c4ff47]/[0.08]" : "border-white/18 bg-white/[0.04] hover:border-violet-400/45 hover:bg-white/[0.08]"}`}
                    style={(jdUploaded || reuseJD) ? { background: "rgba(180,240,0,0.08)" } : {}}
                  >
                    {(jdUploaded || reuseJD) ? (
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(180,240,0,0.15)" }}>
                          {reuseJD ? <BadgeCheck className="w-8 h-8" style={{ color: "#6E9900" }} /> : <Check className="w-8 h-8" style={{ color: "#6E9900" }} />}
                        </div>
                        <p className="font-bold mb-1 text-[#4A7A00]">{reuseJD ? "Dùng lại file đã lưu" : "JD đã được tải lên"}</p>
                        <p className="text-sm text-[#6E9900] mb-1 font-medium">{jdFile?.name ?? reuseJD?.name}</p>
                        {jdFile && <p className="text-sm text-white/55">{(jdFile.size / 1024).toFixed(0)} KB · {jdFile.name.split(".").pop()?.toUpperCase()}</p>}
                        {reuseJD && <p className="text-sm text-white/55">Đã lưu trên cloud</p>}
                        <button onClick={e => { e.stopPropagation(); setJdUploaded(false); setJdFile(null); setReuseJD(null); if (jdInputRef.current) jdInputRef.current.value = ""; }} className="mt-3 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white/80">
                          <X className="w-4 h-4" /> Xóa
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-16 rounded-2xl bg-[#8B4DFF]/10 flex items-center justify-center mb-4 group-hover:bg-[#8B4DFF]/15 transition-colors"><Briefcase className="w-8 h-8 text-[#8B4DFF]" /></div>
                        <p className="mb-1 font-bold text-white">Upload Job Description</p>
                        <p className="mb-4 text-sm text-white/60">Kéo & thả hoặc click để chọn</p>
                        <div className="bg-[#8B4DFF] text-white text-sm font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
                          <Upload className="w-4 h-4" /> Chọn file JD
                        </div>
                        <p className="mt-4 text-sm text-white/50">PDF, DOC, DOCX, TXT</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Field selector - conditional */}
              {enableField && (
                <div className="mb-8">
                  <div className="mb-4">
                    <h3 className="mb-1 text-base font-bold text-white">Chọn ngành nghề</h3>
                    <p className="text-sm text-white/60">CV sẽ được đánh giá theo tiêu chuẩn của ngành này</p>
                  </div>
                  
                  <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-6 backdrop-blur-sm">
                    <div className="relative">
                      <button onClick={() => setFieldOpen(!fieldOpen)} className="group flex w-full items-center justify-between rounded-xl border-2 border-white/15 bg-white/[0.04] px-5 py-4 text-sm transition-all hover:border-violet-400/40 hover:bg-white/[0.07]">
                        <span className={selectedField ? "font-medium text-white" : "text-white/45"}>{selectedField || "Chọn ngành nghề..."}</span>
                        <ChevronDown className={`h-5 w-5 text-white/40 transition-all group-hover:text-violet-200 ${fieldOpen ? "rotate-180" : ""}`} />
                      </button>
                      {fieldOpen && (
                        <div className="absolute left-0 right-0 top-full z-10 mt-2 overflow-hidden rounded-xl border border-white/12 bg-[#120d24] shadow-2xl shadow-black/40">
                          {FIELDS.map(f => (
                            <button key={f} onClick={() => { setSelectedField(f); setFieldOpen(false); }} className="w-full border-b border-white/8 px-5 py-3 text-left text-sm font-medium text-white/85 transition-colors last:border-0 hover:bg-violet-500/15 hover:text-violet-100">{f}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Gemini badge */}
              <div className="mb-6 flex items-center gap-2 border-b border-white/10 pb-6">
                <span className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-violet-200" style={{ background: "rgba(110, 53, 232,0.2)", border: "1px solid rgba(139, 77, 255,0.25)" }}>
                  <CloudUpload className="h-3.5 w-3.5" /> Files được lưu vào Supabase Storage · Phân tích bởi Gemini 1.5 Flash
                </span>
              </div>

              {/* Large CTA Button */}
              <div className="flex justify-center">
                <button
                  onClick={handleAnalyze}
                  disabled={!canAnalyze || !(cvUploaded || !!reuseCV)}
                  className={`flex items-center gap-3 rounded-2xl px-12 py-4 text-base font-bold transition-all ${(canAnalyze && (cvUploaded || reuseCV)) ? "text-white shadow-2xl shadow-[#6E35E8]/30 hover:-translate-y-1 hover:shadow-[#6E35E8]/40" : "cursor-not-allowed bg-white/[0.06] text-white/35"}`}
                  style={(canAnalyze && (cvUploaded || reuseCV)) ? { background: "linear-gradient(135deg,#6E35E8,#9B6DFF)" } : {}}
                >
                  <Zap className="w-5 h-5" />
                  {(cvUploaded || reuseCV) ? "Bắt đầu phân tích với Gemini AI" : "Vui lòng chọn file CV trước"}
                </button>
              </div>
            </div>
          )}

          {/* ── LOADING ─────────────────────────────────────────────────── */}
          {step === "loading" && (
            <div className="flex flex-col items-center justify-center py-24 max-w-md mx-auto text-center">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-8 shadow-xl shadow-[#6E35E8]/30" style={{ background: "linear-gradient(135deg,#6E35E8,#9B6DFF)" }}>
                <Loader2 className="w-10 h-10 text-white animate-spin" />
              </div>
              <h2 className="mb-3 text-xl font-semibold text-white">Đang xử lý...</h2>
              <p className="mb-8 text-sm text-white/60">Gemini AI đang đọc file PDF và phân tích — vui lòng đợi.</p>
              <div className="mb-3 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, background: "linear-gradient(90deg,#6E35E8,#9B6DFF)" }} />
              </div>
              <p className="text-[#6E35E8] text-sm font-medium mb-6">{Math.round(progress)}%</p>
              <div className="space-y-2 text-left w-full">
                {loadingSteps.map((t, i) => (
                  <div key={i} className={`flex items-center gap-2 text-sm transition-all duration-500 ${loadingStage > i ? "opacity-100" : "opacity-25"}`}>
                    {loadingStage > i ? <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : <Loader2 className={`w-4 h-4 flex-shrink-0 text-[#6E35E8] ${loadingStage === i ? "animate-spin" : ""}`} />}
                    <span className="text-white/70">{t}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── RESULT ──────────────────────────────────────────────────── */}
          {step === "result" && (
            <div>
              {/* Mock data notice */}
              {R?._isMocked && (
                <div className="mb-4 flex items-center gap-3 rounded-2xl px-5 py-3" style={{ background: "rgba(255,214,0,0.08)", border: "1.5px solid rgba(250,204,21,0.35)" }}>
                  <span className="text-lg">🔒</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-100">Kết quả Demo — Cần đăng nhập để phân tích thực tế</p>
                    <p className="mt-0.5 text-xs text-amber-100/80">
                      Phiên đăng nhập hết hạn hoặc chưa đăng nhập. Đây là kết quả mẫu — hãy đăng nhập lại để nhận phân tích CV thực từ AI.
                    </p>
                  </div>
                </div>
              )}

              {/* Free-tier notice */}
              {isFreeTier && (
                <div className="flex items-center gap-4 rounded-2xl px-5 py-4 mb-6" style={{ background: "linear-gradient(135deg,rgba(110, 53, 232,0.08),rgba(139, 77, 255,0.05))", border: "1.5px solid rgba(110, 53, 232,0.2)" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(110, 53, 232,0.15)" }}><Lock className="w-5 h-5 text-[#6E35E8]" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">Đang xem bản xem trước — Gói Free</p>
                    <p className="mt-0.5 text-xs text-white/60">Phần đánh giá chi tiết & gợi ý bị ẩn. Nâng cấp để xem đầy đủ.</p>
                  </div>
                  <button onClick={() => navigate("/pricing")} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white flex-shrink-0" style={{ background: "linear-gradient(135deg,#6E35E8,#8B4DFF)" }}>
                    <Zap className="w-3.5 h-3.5" /> Mở khoá
                  </button>
                </div>
              )}

              {/* ── Cloud save status ──────────────────────────────────── */}
              {savedFileInfo && (
                <div className="rounded-2xl px-5 py-4 mb-6 flex items-start gap-4 flex-wrap" style={{ background: "rgba(180,240,0,0.07)", border: "1.5px solid rgba(180,240,0,0.25)" }}>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <BadgeCheck className="w-5 h-5" style={{ color: "#4A7A00" }} />
                    <p className="text-sm font-semibold" style={{ color: "#4A7A00" }}>Files đã lưu lên cloud</p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap ml-auto">
                    {savedFileInfo.cvSignedUrl && (
                      <a href={savedFileInfo.cvSignedUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg hover:brightness-105 transition-all" style={{ background: "rgba(110, 53, 232,0.1)", color: "#6E35E8" }}>
                        <DownloadSimple className="w-3.5 h-3.5" /> Tải CV ({savedFileInfo.cvFileName})
                      </a>
                    )}
                    {savedFileInfo.jdSignedUrl && savedFileInfo.jdFileName && (
                      <a href={savedFileInfo.jdSignedUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg hover:brightness-105 transition-all" style={{ background: "rgba(110, 53, 232,0.1)", color: "#6E35E8" }}>
                        <DownloadSimple className="w-3.5 h-3.5" /> Tải JD ({savedFileInfo.jdFileName})
                      </a>
                    )}
                    <span className="text-xs text-white/50">ID: {savedFileInfo.analysisId?.slice(0, 8)}…</span>
                  </div>
                </div>
              )}

              {/* Gemini badge */}
              {R && (
                <div className="flex items-center gap-2 mb-5">
                  <span className="flex items-center gap-1.5 rounded-lg border border-violet-400/25 px-3 py-1.5 text-xs font-medium text-violet-100" style={{ background: "rgba(110, 53, 232,0.22)" }}>
                    ✨ {R.summary ?? "Phân tích thực từ Gemini AI"}
                  </span>
                </div>
              )}

              {/* Match Score Banner */}
              <div className="rounded-2xl p-6 mb-6 text-white" style={{ background: "linear-gradient(135deg,#6E35E8 0%,#9B6DFF 100%)" }}>
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <p className="text-indigo-200 text-sm mb-2">
                      {derivedMode === "jd" ? `Mức độ phù hợp CV${R?.company ? ` — ${R.company}` : ""}${R?.position ? ` · ${R.position}` : ""}` : "Điểm chất lượng CV"}
                    </p>
                    <div className="flex items-end gap-3 mb-2">
                      <span style={{ fontSize: "3.5rem", fontWeight: 800, lineHeight: 1 }}>{derivedMode === "jd" ? `${matchScore}%` : matchScore}</span>
                      <div className="mb-1">
                        <span className="text-indigo-200 text-sm">{derivedMode === "jd" ? "match score" : "/ 100 điểm"}</span>
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
                      { label: "Gợi ý chỉnh sửa",   val: `${suggestionsData.length} mục`, color: "bg-amber-400/20" },
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
                  <CVDocumentPreview />
                  {isFreeTier && (
                    <div className="absolute bottom-0 left-0 right-0 flex h-2/3 flex-col items-center justify-end rounded-b-2xl pb-8" style={{ background: "linear-gradient(to bottom,transparent 0%,rgba(10,6,24,0.55) 45%,rgba(7,6,14,0.92) 100%)" }}>
                      <div className="px-6 text-center">
                        <Lock className="mx-auto mb-2 h-8 w-8 text-violet-300" />
                        <p className="mb-3 text-sm font-semibold text-white">Chi tiết bị ẩn</p>
                        <button onClick={() => navigate("/pricing")} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "linear-gradient(135deg,#6E35E8,#8B4DFF)" }}>
                          <Zap className="w-3.5 h-3.5" /> Xem đầy đủ
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Keywords */}
              {derivedMode === "jd" && (
                <div className="mb-6 grid gap-6 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-5 shadow-sm backdrop-blur-sm">
                    <div className="mb-4 flex items-center gap-2"><FileText className="h-4 w-4 text-violet-300" /><h3 className="text-sm font-semibold text-white">Từ khóa khớp với JD</h3></div>
                    <div className="flex flex-wrap gap-2">
                      {cvDisplayKWs.map(kw => <span key={kw} className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: "rgba(180,240,0,0.15)", color: "#c4ff47", border: "1px solid rgba(180,240,0,0.35)" }}>{kw} ✓</span>)}
                    </div>
                    <p className="mt-3 text-xs text-white/55"><span className="font-medium text-[#c4ff47]">{cvDisplayKWs.length}</span> từ khóa khớp</p>
                  </div>
                  <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.04] p-5 shadow-sm backdrop-blur-sm">
                    <div className="mb-4 flex items-center gap-2"><Briefcase className="h-4 w-4 text-violet-300" /><h3 className="text-sm font-semibold text-white">Toàn bộ từ khóa JD</h3></div>
                    <div className="flex flex-wrap gap-2">
                      {jdDisplayKWs.map(kw => (
                        <span key={kw} className="rounded-full px-3 py-1 text-xs font-medium" style={matchedSet.has(kw) ? { background: "rgba(180,240,0,0.15)", color: "#c4ff47", border: "1px solid rgba(180,240,0,0.35)" } : { background: "rgba(255,140,66,0.12)", color: "#ffb088", border: "1px solid rgba(255,140,66,0.28)" }}>
                          {kw} {!matchedSet.has(kw) && "⚠"}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-white/55"><span className="font-medium text-orange-200">{jdDisplayKWs.filter(k => !matchedSet.has(k)).length}</span> từ khóa chưa có trong CV</p>
                    {isFreeTier && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-2xl" style={{ background: "rgba(7,6,14,0.78)", backdropFilter: "blur(8px)" }}>
                        <div className="px-4 text-center"><Lock className="mx-auto mb-2 h-7 w-7 text-violet-300" /><p className="mb-2 text-xs font-semibold text-white">Từ khóa JD bị ẩn</p><button type="button" onClick={() => navigate("/pricing")} className="rounded-lg px-4 py-1.5 text-xs font-bold text-white" style={{ background: "#6E35E8" }}>Mở khoá</button></div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Detailed scoring */}
              <div className="relative card-premium mb-6 overflow-hidden">
                <div className="flex items-center gap-2.5 border-b border-white/10 px-6 py-4" style={{ background: "rgba(110, 53, 232,0.08)" }}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "rgba(110, 53, 232,0.2)" }}><BarChart3 className="h-4 w-4 text-violet-200" /></div>
                  <div><h3 className="text-sm font-semibold text-white">Đánh giá chi tiết</h3><p className="text-xs text-white/55">4 tiêu chí theo chuẩn tuyển dụng</p></div>
                  {isFreeTier && <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: "rgba(110, 53, 232,0.08)" }}><Lock className="w-3.5 h-3.5 text-[#6E35E8]" /><span className="text-xs font-semibold text-[#6E35E8]">Khoá</span></div>}
                </div>
                <div className="p-6" style={isFreeTier ? { filter: "blur(5px)", userSelect: "none", pointerEvents: "none" } : {}}>
                  <div className="flex gap-6 items-start mb-6 flex-wrap">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="relative w-28 h-28">
                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="10" />
                          <circle cx="50" cy="50" r="40" fill="none" stroke="url(#sg)" strokeWidth="10" strokeDasharray={`${matchScore * 2.51} 251`} strokeLinecap="round" />
                          <defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#6E35E8" /><stop offset="100%" stopColor="#8B4DFF" /></linearGradient></defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="font-bold text-white" style={{ fontSize: "1.6rem" }}>{matchScore}</span><span className="text-xs text-white/50">/ 100</span></div>
                      </div>
                      <p className="mt-2 text-xs text-white/50">Overall</p>
                    </div>
                    <div className="flex-1 min-w-0 space-y-3">
                      {scoreTableData.map(row => (
                        <div key={row.criteria}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-white/85">{row.criteria}</span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-lg" style={{ background: row.status === "good" ? "rgba(180,240,0,0.15)" : row.status === "ok" ? "rgba(139, 77, 255,0.1)" : "rgba(255,140,66,0.12)", color: row.status === "good" ? "#4A7A00" : row.status === "ok" ? "#6E35E8" : "#CC5C00" }}>{row.score}/{row.max}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(row.score / row.max) * 100}%`, background: row.status === "good" ? "#B4F000" : row.status === "ok" ? "#8B4DFF" : "#FF8C42" }} />
                          </div>
                          {row.note && <p className="mt-0.5 text-[0.7rem] text-white/50">{row.note}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="rounded-xl p-4" style={{ background: "rgba(180,240,0,0.07)", border: "1px solid rgba(180,240,0,0.2)" }}>
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-[#4A7A00]"><Check className="w-4 h-4" /> Điểm mạnh</h4>
                      <ul className="space-y-2">{strengthsData.map((s, i) => <li key={i} className="flex items-start gap-2 text-sm text-white/88"><span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#6E9900]" />{s}</li>)}</ul>
                    </div>
                    <div className="rounded-xl p-4" style={{ background: "rgba(255,140,66,0.07)", border: "1px solid rgba(255,140,66,0.2)" }}>
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-[#CC5C00]"><Warning className="w-4 h-4" /> Cần cải thiện</h4>
                      <ul className="space-y-2">{weaknessesData.map((s, i) => <li key={i} className="flex items-start gap-2 text-sm text-white/88"><span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#FF8C42]" />{s}</li>)}</ul>
                    </div>
                  </div>
                </div>
                {isFreeTier && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(7,6,14,0.72)", backdropFilter: "blur(6px)" }}>
                    <div className="rounded-2xl border border-white/12 bg-[#120d24]/95 px-8 py-6 text-center shadow-2xl shadow-black/40" style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.45)" }}>
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "rgba(110, 53, 232,0.25)" }}><Lock className="h-6 w-6 text-violet-200" /></div>
                      <p className="mb-1 font-bold text-white">Đánh giá chi tiết bị khoá</p>
                      <p className="mb-4 max-w-[240px] text-xs text-white/60">Nâng cấp <strong className="text-violet-300">Elite Pro</strong> để xem điểm số và nhận xét chi tiết.</p>
                      <button onClick={() => navigate("/pricing")} className="flex items-center gap-2 mx-auto px-6 py-2.5 rounded-xl font-bold text-sm text-white" style={{ background: "linear-gradient(135deg,#6E35E8,#8B4DFF)" }}>
                        <Zap className="w-4 h-4" /> Nâng cấp
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Suggestions */}
              <div className="relative card-premium mb-6 overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/10 px-6 py-4" style={{ background: "rgba(110, 53, 232,0.08)" }}>
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "rgba(110, 53, 232,0.2)" }}><Lightbulb className="h-4 w-4 text-violet-200" /></div>
                    <div><h3 className="text-sm font-semibold text-white">Gợi ý chỉnh sửa cụ thể</h3><p className="text-xs text-white/55">Mỗi gợi ý có lý do + ví dụ trước/sau</p></div>
                  </div>
                  <div className="flex items-center gap-2">
                    {highCount   > 0 && <span className="rounded-lg px-2.5 py-1 text-xs font-medium" style={{ background: "rgba(255,140,66,0.18)",  color: "#ffb088" }}>{highCount} Cao</span>}
                    {mediumCount > 0 && <span className="rounded-lg px-2.5 py-1 text-xs font-medium" style={{ background: "rgba(255,214,0,0.14)",   color: "#fde68a" }}>{mediumCount} TB</span>}
                    {lowCount    > 0 && <span className="rounded-lg px-2.5 py-1 text-xs font-medium" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.65)" }}>{lowCount} Thấp</span>}
                  </div>
                </div>
                <div className="divide-y divide-white/10">
                  {suggestionsData.map((item, i) => {
                    if (isFreeTier && i > 1) return null;
                    const isAdd = item.type === "add", isFix = item.type === "fix";
                    const pStyle = item.priority === "high" ? { bg: "rgba(255,140,66,0.1)", border: "rgba(255,140,66,0.25)", color: "#CC5C00", label: "Ưu tiên cao" } : item.priority === "medium" ? { bg: "rgba(255,214,0,0.1)", border: "rgba(255,214,0,0.3)", color: "#997F00", label: "Trung bình" } : { bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", label: "Thấp" };
                    const tStyle = isAdd ? { bg: "rgba(180,240,0,0.12)", color: "#4A7A00", label: "Bổ sung" } : isFix ? { bg: "rgba(110, 53, 232,0.1)", color: "#6E35E8", label: "Chỉnh sửa" } : { bg: "rgba(255,140,66,0.1)", color: "#CC5C00", label: "Loại bỏ" };
                    const isDimmed = isFreeTier && i === 1;
                    return (
                      <div key={i} className="p-5 transition-colors hover:bg-white/[0.04]" style={isDimmed ? { filter: "blur(4px)", userSelect: "none", pointerEvents: "none", opacity: 0.5 } : {}}>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: tStyle.bg, color: tStyle.color }}>
                              {isAdd && <PlusCircle className="w-3 h-3" />}{isFix && <Wrench className="w-3 h-3" />}{!isAdd && !isFix && <Trash className="w-3 h-3" />}
                              {tStyle.label}
                            </span>
                            <h4 className="text-sm font-semibold text-white">{item.title}</h4>
                          </div>
                          <span className="flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-lg" style={{ background: pStyle.bg, color: pStyle.color, border: `1px solid ${pStyle.border}` }}>{pStyle.label}</span>
                        </div>
                        <div className="rounded-xl p-3.5 mb-3" style={{ background: "rgba(110, 53, 232,0.04)", border: "1px solid rgba(110, 53, 232,0.1)" }}>
                          <p className="text-xs font-semibold mb-1 text-[#6E35E8]">💡 Lý do</p>
                          <p className="text-[0.82rem] leading-relaxed text-white/70">{item.reason}</p>
                        </div>
                        {(item.before || item.after) && (
                          <div className="grid md:grid-cols-2 gap-2">
                            {item.before && <div className="rounded-xl p-3" style={{ background: "rgba(255,140,66,0.05)", border: "1px solid rgba(255,140,66,0.18)" }}><p className="mb-1.5 text-xs font-semibold text-[#ffb088]">✗ Hiện tại</p><code className="block whitespace-pre-wrap font-mono text-[0.76rem] leading-relaxed text-white/75">{item.before}</code></div>}
                            {item.after  && <div className="rounded-xl p-3" style={{ background: "rgba(180,240,0,0.06)",  border: "1px solid rgba(180,240,0,0.22)"  }}><p className="mb-1.5 text-xs font-semibold text-[#c4ff47]">✓ Nên sửa thành</p><code className="block whitespace-pre-wrap font-mono text-[0.76rem] leading-relaxed text-white/75">{item.after}</code></div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {isFreeTier && (
                  <div className="flex items-center gap-4 border-t border-white/10 px-6 py-5" style={{ background: "linear-gradient(135deg,rgba(110, 53, 232,0.12),rgba(139, 77, 255,0.06))" }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white">🔒 Còn {suggestionsData.length - 1} gợi ý đang bị ẩn</p>
                      <p className="mt-0.5 text-xs text-white/55">Bao gồm gợi ý về từ khóa thiếu, số liệu KPI, format STAR</p>
                    </div>
                    <button onClick={() => navigate("/pricing")} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white flex-shrink-0" style={{ background: "linear-gradient(135deg,#6E35E8,#8B4DFF)" }}>
                      <Zap className="w-4 h-4" /> Mở khoá toàn bộ
                    </button>
                  </div>
                )}
              </div>

              {/* CTAs */}
              <div className="flex gap-3 flex-wrap">
                <button onClick={() => navigate("/interview")} className="flex items-center gap-2 text-white px-6 py-3 rounded-xl text-sm font-semibold" style={{ background: "#6E35E8" }} onMouseEnter={e => (e.currentTarget.style.background = "#5C28D9")} onMouseLeave={e => (e.currentTarget.style.background = "#6E35E8")}>
                  <Mic className="w-4 h-4" /> Phỏng vấn với AI
                </button>
                <button onClick={() => navigate("/mentors")} className="flex items-center gap-2 rounded-xl border border-[#c4ff47]/45 bg-[#c4ff47]/10 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:border-[#c4ff47]/60 hover:bg-[#c4ff47]/16">
                  <Users className="h-4 w-4 text-[#d4ff6a]" /> Đặt lịch Mentor
                </button>
                <button onClick={() => { setStep("upload"); setAnalysisResult(null); setSavedFileInfo(null); }} className="flex items-center gap-2 rounded-xl border border-white/18 bg-white/[0.08] px-6 py-3 text-sm font-medium text-white/90 shadow-sm transition-all hover:border-white/28 hover:bg-white/[0.12]">
                  Phân tích lại
                </button>
                <button onClick={() => navigate("/cv-analysis/history")} className="flex items-center gap-2 rounded-xl border border-white/18 bg-white/[0.08] px-6 py-3 text-sm font-medium text-white/90 shadow-sm transition-all hover:border-white/28 hover:bg-white/[0.12]">
                  <History className="h-4 w-4" /> Xem lịch sử
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

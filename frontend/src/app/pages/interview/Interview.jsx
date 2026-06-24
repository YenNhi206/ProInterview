import React, { useState, useEffect, useRef } from "react";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { useNavigate } from "react-router";
import {
  BrowserCompatibilityWarning,
  checkSTTSupport,
} from "../../components/interview/BrowserCompatibilityWarning";
import { InterviewLoadingState } from "../../components/interview/InterviewLoadingState";
import { InterviewStepBar } from "../../components/interview/InterviewStepBar";
import {
  Check,
  Upload,
  Mars,
  Venus,
  ArrowRight,
  Mic,
  CloudUpload,
  FileStack,
  AlertCircle,
  ChevronDown,
  FileText,
} from "lucide-react";
import { getLatestCVAnalysisAsync, getUploadedCV, saveUploadedCV } from "../../utils/shared/history.js";
import { hasAuthCredentials, isLoggedIn } from "../../utils/auth/auth.js";
import { buildLoginPath } from "../../utils/auth/authGate.js";
import { trackAction } from "../../utils/analytics/analyticsApi.js";
import { getBaselineQuestions, extractCvTextFromFile, createInterviewSession, pregenerateBaselineVideos } from "../../api/interviewsApi.js";
import { fetchCvAnalysisById } from "../../api/cvApi.js";
import { InterviewHistoryPanel } from "../../components/interview/InterviewHistoryPanel";
import { InterviewPageTabs } from "../../components/interview/InterviewPageTabs";
import { CV_JD_CARD_CLASS } from "../../components/cv/CvJdAnalysisFrame";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";
import { CustomerPageHeader } from "../../components/layout/CustomerPageHeader";

const CTA_LIME =
  "bg-gradient-to-r from-[#93f72b] to-[#93f72b] text-violet-950 shadow-[0_8px_28px_rgba(196,255,71,0.25)] hover:brightness-110";

const INTERVIEW_SETUP_DRAFT_KEY = "prointerview_setup_draft";

function saveInterviewSetupDraft(draft) {
  try {
    sessionStorage.setItem(INTERVIEW_SETUP_DRAFT_KEY, JSON.stringify(draft));
  } catch (_) {}
}

/** Stroke Lucide chuẩn UI, đồng bộ toàn trang */
const IS = { strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" };

/** Chiều cao cố định ô chi tiết bước 1 */
const SOURCE_DETAIL_PANEL_CLASS =
  "flex h-[15rem] flex-col rounded-md border border-violet-200/80 bg-violet-50/50 px-4 py-4 sm:h-[16rem] sm:px-5 sm:py-5";

/** Ô xem trước HR, cao hơn để video lớn hơn */
const HR_PREVIEW_PANEL_CLASS =
  "flex h-[16rem] flex-col rounded-md border border-violet-200/80 bg-violet-50/50 px-4 py-3 sm:h-[18rem] sm:px-5";

function formatCvAnalysisDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

/** Ô chi tiết, thông tin phân tích CV gần nhất */
function AnalyzedCvDetailPanel({ cv }) {
  const title = cv.position || cv.cvFile || cv.cvFileName || "Phân tích gần nhất";
  const cvName = cv.cvFileName || cv.cvFile;
  const jdName = cv.jdFileName || cv.jdFile;
  const when = formatCvAnalysisDate(cv.createdAt || cv.date);

  return (
    <div className="flex h-full min-h-0 flex-col space-y-3 overflow-y-auto text-sm text-violet-800">
      <p className="shrink-0 text-xs font-bold uppercase tracking-wide text-violet-500">Phân tích CV gần nhất</p>
      <div>
        <p className="text-base font-bold text-violet-950">{title}</p>
        {cv.company ? <p className="mt-0.5 text-violet-600">{cv.company}</p> : null}
      </div>
      <dl className="grid gap-2 text-xs sm:grid-cols-2 sm:text-sm">
        {cv.matchScore != null && cv.matchScore > 0 && (
          <div>
            <dt className="font-medium text-violet-500">Độ khớp JD</dt>
            <dd className="font-semibold text-violet-900">{cv.matchScore}%</dd>
          </div>
        )}
        {when && (
          <div>
            <dt className="font-medium text-violet-500">Ngày phân tích</dt>
            <dd className="text-violet-900">{when}</dd>
          </div>
        )}
        {cvName && (
          <div className="sm:col-span-2">
            <dt className="font-medium text-violet-500">File CV</dt>
            <dd className="truncate text-violet-900">{cvName}</dd>
          </div>
        )}
        {jdName && (
          <div className="sm:col-span-2">
            <dt className="font-medium text-violet-500">File JD</dt>
            <dd className="truncate text-violet-900">{jdName}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

/** Ô chi tiết, upload CV mới */
function UploadCvDetailPanel({ cvUploaded, uploadedFile, onPickFile }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="mb-3 shrink-0 text-xs font-bold uppercase tracking-wide text-violet-500">Tải file CV</p>
      {cvUploaded && uploadedFile ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-center">
          <Check className="h-10 w-10 text-[#630ed4]" {...IS} strokeWidth={2} />
          <p className="text-sm font-semibold text-violet-950">{uploadedFile.name}</p>
          <p className="text-xs text-violet-500">
            {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
          </p>
          <button
            type="button"
            onClick={onPickFile}
            className="text-sm font-semibold text-[#630ed4] hover:underline"
          >
            Đổi file khác
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onPickFile}
          className="flex min-h-0 flex-1 w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-violet-200 bg-white text-center transition-colors hover:border-violet-300 hover:bg-violet-50/50"
        >
          <Upload className="h-9 w-9 text-violet-500" {...IS} />
          <p className="text-sm font-semibold text-violet-900">Chọn file CV</p>
          <p className="text-xs text-violet-500">PDF, DOC, DOCX · tối đa 5 MB</p>
        </button>
      )}
    </div>
  );
}

/** Bước 2, video xem trước trong ô riêng (sau khi chọn HR) */
function HrPreviewPanel({ hrGender }) {
  if (!hrGender) return null;
  const preview = HR_PREVIEWS[hrGender];

  return (
    <div className={HR_PREVIEW_PANEL_CLASS}>
      <p className="mb-2 shrink-0 text-xs font-semibold text-violet-600">
        Xem trước, {preview.name}
      </p>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <video
          key={hrGender}
          src={preview.video}
          autoPlay
          loop
          muted
          playsInline
          disablePictureInPicture
          controlsList="nodownload noplaybackrate"
          className="h-full w-auto max-w-full rounded-md object-contain"
        />
      </div>
    </div>
  );
}

/** Một ô dài chung, chỉ hiện sau khi đã chọn A hoặc B */
function SourceDetailPanel({ option, latestCV, cvUploaded, uploadedFile, onPickFile }) {
  if (option !== "A" && option !== "B") return null;

  return (
    <div className={SOURCE_DETAIL_PANEL_CLASS}>
      <div className="min-h-0 flex-1">
        {option === "A" && latestCV && <AnalyzedCvDetailPanel cv={latestCV} />}
        {option === "B" && (
          <UploadCvDetailPanel
            cvUploaded={cvUploaded}
            uploadedFile={uploadedFile}
            onPickFile={onPickFile}
          />
        )}
      </div>
    </div>
  );
}

function SelectOptionRing({ selected }) {
  return (
    <div
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
        selected
          ? "border-[#630ed4] bg-[#630ed4] shadow-[0_2px_10px_rgba(99,14,212,0.35)]"
          : "border-violet-400 bg-white group-hover:border-[#630ed4]/70"
      }`}
      aria-hidden
    >
      {selected ? (
        <Check className="h-4 w-4 text-white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <span className="h-2.5 w-2.5 rounded-full bg-violet-200/90 group-hover:bg-violet-300" />
      )}
    </div>
  );
}

const HR_PREVIEWS = {
  male: {
    name: "HR Nam",
    subtitle: "David · Người phỏng vấn AI",
    video: "https://res.cloudinary.com/dee4bvivu/video/upload/v1774336646/Male_jioqsx.mp4",
  },
  female: {
    name: "HR Nữ",
    subtitle: "Sarah · AI Interviewer",
    video: "https://res.cloudinary.com/dee4bvivu/video/upload/v1774336640/Female_delxmy.mp4",
  },
};

export function Interview() {
  const navigate = useNavigate();

  const [option, setOption] = useState(null);
  const [cvUploaded, setCvUploaded] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [hrGender, setHrGender] = useState(null);
  const [flowStep, setFlowStep] = useState(1);
  const [setupSubTab, setSetupSubTab] = useState("analysis"); // "analysis" | "history"
  const [loadingStep, setLoadingStep] = useState(null); // null | "extracting_cv" | "generating_questions" | "creating_session"
  const [extractWarning, setExtractWarning] = useState("");
  const [showBrowserWarning, setShowBrowserWarning] = useState(false);
  const cvFileInputRef = useRef(null);

  const [latestCV, setLatestCV] = useState(null);

  // JD optional input
  const [jdExpanded, setJdExpanded]   = useState(false);
  const [jdInputText, setJdInputText] = useState("");
  const [jdFile, setJdFile]           = useState(null);
  const jdFileInputRef = useRef(null);

  useEffect(() => {
    if (!checkSTTSupport()) setShowBrowserWarning(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadLatest = async () => {
      const cv = await getLatestCVAnalysisAsync();
      if (!cancelled) setLatestCV(cv);
    };
    loadLatest();
    const onSaved = () => loadLatest();
    window.addEventListener("cv-analysis-saved", onSaved);
    return () => {
      cancelled = true;
      window.removeEventListener("cv-analysis-saved", onSaved);
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) return;
    try {
      const raw = sessionStorage.getItem(INTERVIEW_SETUP_DRAFT_KEY);
      if (!raw) return;
      sessionStorage.removeItem(INTERVIEW_SETUP_DRAFT_KEY);
      const draft = JSON.parse(raw);
      if (draft.option === "A" || draft.option === "B") setOption(draft.option);
      if (draft.option === "B") {
        const saved = getUploadedCV();
        if (saved?.name) setCvUploaded(true);
      }
      if (draft.step === 2) setFlowStep(2);
    } catch (_) {}
  }, []);

  const storedCV = getUploadedCV();

  const openCvFilePicker = () => {
    cvFileInputRef.current?.click();
  };

  const handleJdFileUpload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setJdFile(file);
    setJdInputText("");
  };

  const handleSelectAnalyzedCv = () => {
    if (!latestCV) return;
    if (!isLoggedIn()) {
      saveInterviewSetupDraft({ option: "A", step: 1 });
      navigate(buildLoginPath("/interview"));
      return;
    }
    setOption("A");
  };

  const handleSelectUploadCv = () => {
    if (!isLoggedIn()) {
      saveInterviewSetupDraft({ option: "B", step: 1 });
      navigate(buildLoginPath("/interview"));
      return;
    }
    setOption("B");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      e.target.value = "";
      return;
    }
    if (!isLoggedIn()) {
      saveInterviewSetupDraft({ option: "B", step: 1 });
      navigate(buildLoginPath("/interview"));
      e.target.value = "";
      return;
    }
    setOption("B");
    setUploadedFile(file);
    setCvUploaded(true);
    saveUploadedCV({ name: file.name, size: file.size, type: file.type });
    e.target.value = "";
  };

  const canProceedSetup =
    (option === "A" && Boolean(latestCV)) || (option === "B" && cvUploaded);
  const canStart = canProceedSetup && Boolean(hrGender);

  const handleContinueToHr = () => {
    if (!canProceedSetup) return;
    setFlowStep(2);
  };

  const handleStart = async () => {
    if (!canStart || loadingStep) return;
    if (!isLoggedIn()) {
      navigate(buildLoginPath("/interview"));
      return;
    }
    setExtractWarning("");

    trackAction("interview_start", "/interview");
    // Clear stale session data from previous interview before starting new one
    sessionStorage.removeItem("prointerview_questions");
    sessionStorage.removeItem("prointerview_sessionId");
    sessionStorage.removeItem("prointerview_transcripts");
    sessionStorage.removeItem("prointerview_question_objects");

    let questions = null;
    // Khai báo ngoài try để dùng lại sau (createInterviewSession + forward sang InterviewRoom)
    let cvText = "";
    // JD text: ưu tiên file PDF > textarea paste
    let jdText = jdInputText.trim();
    try {
      if (option === "A" && latestCV) {
        // Fetch raw CV text from stored analysis, the list API strips cvText to save bandwidth,
        // so we need a separate call to get the full document for genuine personalization.
        const analysisId = latestCV.id || latestCV.analysisId;
        if (analysisId) {
          setLoadingStep("extracting_cv");
          try {
            const full = await fetchCvAnalysisById(analysisId);
            if (full.success && full.analysis?.cvText?.trim()) {
              cvText = full.analysis.cvText;
              // Use the JD stored alongside this CV analysis as a fallback when user hasn't provided one
              if (!jdText && full.analysis?.jdText?.trim()) {
                jdText = full.analysis.jdText;
              }
            }
          } catch {
            // ignore, fall back to structured summary below
          }
        }

        // Fallback: build a keyword-based summary if raw text is unavailable
        if (!cvText) {
          const parts = [
            latestCV.position && `Vị trí ứng tuyển: ${latestCV.position}`,
            latestCV.company  && `Công ty: ${latestCV.company}`,
            latestCV.matchedKeywords?.length
              && `Kỹ năng phù hợp với JD: ${latestCV.matchedKeywords.join(", ")}`,
            latestCV.missingKeywords?.length
              && `Kỹ năng còn thiếu: ${latestCV.missingKeywords.join(", ")}`,
          ];
          cvText = parts.filter(Boolean).join("\n\n");
        }

        // JD from a freshly uploaded file takes priority over the stored jdText
        if (jdFile && !jdText) {
          setLoadingStep("extracting_jd");
          const jdExtracted = await extractCvTextFromFile(jdFile);
          if (jdExtracted.success && jdExtracted.text) {
            jdText = jdExtracted.text;
          }
        }
      } else if (option === "B" && uploadedFile) {
        setLoadingStep("extracting_cv");
        const extracted = await extractCvTextFromFile(uploadedFile);
        if (extracted.success && extracted.text) {
          cvText = extracted.text;
        } else {
          setExtractWarning(
            extracted.error ||
              "Không thể đọc CV. AI sẽ tạo câu hỏi dựa trên tên file, chất lượng cá nhân hóa thấp hơn.",
          );
          cvText = `Tên file CV: ${uploadedFile.name}`;
        }

        // Extract JD từ file nếu user upload
        if (jdFile && !jdText) {
          const jdExtracted = await extractCvTextFromFile(jdFile);
          if (jdExtracted.success && jdExtracted.text) {
            jdText = jdExtracted.text;
          }
        }
      }

      // 3 câu hỏi đầu = baseline cố định (text không đổi → video D-ID cache dùng chung toàn hệ
      // thống, không tốn LLM/D-ID nào). 2 câu cá nhân hóa tiếp theo sẽ được sinh GIỮA buổi phỏng
      // vấn (sau khi trả lời xong 3 câu này) dựa trên CV/JD + câu trả lời thật — xem InterviewRoom.
      setLoadingStep("generating_questions");
      const qRes = await getBaselineQuestions();
      if (qRes.success && qRes.questions?.length) {
        questions = qRes.questions;
      } else {
        setExtractWarning(`Không thể tải câu hỏi (${qRes.error || "lỗi không xác định"}). Vui lòng thử lại.`);
        setLoadingStep(null);
        return;
      }
    } catch (err) {
      setExtractWarning(`Không thể kết nối tới máy chủ để tạo câu hỏi. Vui lòng thử lại.`);
      setLoadingStep(null);
      return;
    }

    const position = option === "A" ? (latestCV?.position || "") : "";
    const field = "";
    const level = "";

    // Tạo session ngay sau khi có questions, trước khi vào phòng
    // sessionId được truyền vào InterviewRoom để lưu từng câu trả lời
    setLoadingStep("creating_session");
    let sessionId = null;
    if (hasAuthCredentials()) {
      try {
        const created = await createInterviewSession(hrGender, {
          ...(questions && { questions }),
          // cvText/jdText không lưu vào session (giống generateQuestions cũ) — chỉ dùng để BE
          // tính competencyProfile rẻ (zero LLM cost) cho few-shot accumulation/analytics.
          cvText, jdText, position, field,
        });
        if (created.success) sessionId = created.sessionId;
      } catch {
        // graceful degradation, phỏng vấn vẫn chạy, không lưu MongoDB
      }
    }

    // Bước cuối: pre-generate video HR lipsync cho 3 câu baseline (D-ID Express API, cache dùng
    // chung toàn hệ thống — nhanh ngay từ lần render đầu tiên/gender, gần như instant sau đó).
    // Guards:
    //   1. sessionId phải tồn tại — nếu session creation thất bại thì room sẽ show error page,
    //      không có lý do tiêu D-ID credits cho videos không ai dùng được.
    //   2. Timeout — nếu D-ID render chậm (cold-cache), graceful fallback sang TTS thay vì chặn user.
    let videoUrls = null;
    if (sessionId) {
      try {
        const configRes = await fetch("/api/ai/config");
        const configBody = configRes.ok ? await configRes.json().catch(() => ({})) : {};
        const didEnabled = configBody?.providers?.avatar?.did === true;

        if (didEnabled) {
          setLoadingStep("pregenerating_videos");
          const pregenTimeout = new Promise((resolve) =>
            setTimeout(() => resolve({ success: false, timedOut: true }), 150_000)
          );
          const pregenResult = await Promise.race([
            pregenerateBaselineVideos(hrGender),
            pregenTimeout,
          ]);
          if (pregenResult.success && pregenResult.videoUrls?.some(Boolean)) {
            videoUrls = pregenResult.videoUrls;
          }
        }
      } catch {
        // D-ID chưa set hoặc lỗi mạng — phỏng vấn vẫn chạy với TTS fallback
      }
    }

    setLoadingStep(null);

    const interviewData = {
      option,
      hrGender,
      questions,
      sessionId,
      videoUrls,
      // Cần thiết để InterviewRoom sinh 2 câu cá nhân hóa giữa buổi phỏng vấn (sau câu baseline thứ 3)
      cvText, jdText, position, field, level,
      personalizedPending: Boolean(sessionId),
      ...(option === "A" && { useLatestAnalysis: true, latestCV }),
      ...(option === "B" && { storedCV }),
    };

    sessionStorage.setItem("prointerview_hr_gender", hrGender);
    navigate("/interview/room", { state: interviewData });
  };

  const optBase =
    "group relative w-full rounded-md border-2 p-4 text-left transition-all duration-200 sm:p-5";
  const optIdle =
    "cursor-pointer border-violet-200 bg-white hover:border-violet-300 hover:bg-violet-50/80";
  const optOn = "border-[#630ed4] bg-violet-50 ring-2 ring-violet-200/80";

  return (
    <MentorPageShell bottomPad="pb-24">
      {/* ── Browser STT compatibility warning ─────────────────── */}
      {showBrowserWarning && (
        <BrowserCompatibilityWarning
          onProceed={() => setShowBrowserWarning(false)}
          onCancel={() => navigate("/")}
        />
      )}

      {/* ── Loading step overlay ───────────────────────────────── */}
      {loadingStep && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-violet-950/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-md bg-white p-6 shadow-2xl sm:p-8">
            <p className="mb-5 text-center text-base font-bold text-violet-800">
              Quá trình này có thể diễn ra trong ít phút
            </p>
            <InterviewLoadingState currentStep={loadingStep} />
            <p className="mt-4 text-center text-[11px] text-slate-400">
              Vui lòng không tắt hoặc tải lại trang trong lúc chuẩn bị, để tránh mất lượt sử dụng của bạn.
            </p>
          </div>
        </div>
      )}

      <div className={`relative flex min-h-0 flex-col bg-transparent pb-8 pt-8 sm:pt-10 ${CUSTOMER_SHELL_GUTTER}`}>
        <div className={`${CUSTOMER_SHELL_MAX} mx-auto flex w-full max-w-3xl flex-col`}>
          <CustomerPageHeader
            className="mb-5 w-full"
            title={
              <>
                <span className="font-extrabold text-[#630ed4]">Luyện phỏng vấn với AI</span>{" "}
                <span className="font-extrabold text-[#1a1b23]">từ CV của bạn</span>
              </>
            }
            titleClassName="font-headline text-[clamp(1.45rem,2.8vw,2.65rem)] font-extrabold leading-[1.12] tracking-tight"
            subtitle="Từ CV của bạn, ProInterview tạo buổi phỏng vấn thử với HR AI và góp ý sau từng câu trả lời để bạn tự tin hơn trước buổi thật."
            subtitleClassName="mt-3 max-w-none text-base font-medium leading-relaxed text-violet-700/90 lg:whitespace-nowrap"
          />

        <div className={CV_JD_CARD_CLASS}>
          <InterviewPageTabs activeTab={setupSubTab} onTabChange={setSetupSubTab} />

          {setupSubTab === "history" ? (
            <div className="px-6 py-5 sm:px-8 sm:py-6">
              <InterviewHistoryPanel />
            </div>
          ) : (
            <div className="px-4 py-5 sm:px-6 sm:py-6">
              <InterviewStepBar current={flowStep} />

        {flowStep === 1 && (
        <section className="space-y-5">
          <input
            ref={cvFileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            aria-hidden
            tabIndex={-1}
            onChange={handleFileUpload}
          />
          <input
            ref={jdFileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            aria-hidden
            tabIndex={-1}
            onChange={handleJdFileUpload}
          />
          <div>
            <h2 className="text-sm sm:text-base font-bold text-violet-950">Bước 1: Chọn nguồn CV</h2>
            <p className="mt-0.5 text-xs sm:text-sm text-violet-600">
              AI đọc CV của bạn để tạo bộ câu hỏi phỏng vấn phù hợp.
            </p>
          </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  aria-pressed={option === "A"}
                  onClick={handleSelectAnalyzedCv}
                  disabled={!latestCV}
                  className={`${optBase} ${option === "A" ? optOn : optIdle} ${!latestCV ? "cursor-not-allowed opacity-55" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <SelectOptionRing selected={option === "A"} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <FileStack className="h-5 w-5 shrink-0 text-[#630ed4]" {...IS} />
                        <p className="font-bold text-violet-950">CV đã phân tích</p>
                      </div>
                      <p className="mt-0.5 text-xs text-violet-600">
                        {latestCV ? "Kết quả CV + JD đã lưu trên hệ thống" : "Cần phân tích CV trước"}
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  aria-pressed={option === "B"}
                  onClick={handleSelectUploadCv}
                  className={`${optBase} ${option === "B" ? optOn : optIdle}`}
                >
                  <div className="flex items-start gap-3">
                    <SelectOptionRing selected={option === "B"} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <CloudUpload className="h-5 w-5 shrink-0 text-[#630ed4]" {...IS} />
                        <p className="font-bold text-violet-950">Tải CV mới</p>
                      </div>
                      <p className="mt-0.5 text-xs text-violet-600">Chọn thẻ, rồi upload file trong ô bên dưới</p>
                    </div>
                  </div>
                </button>
              </div>

              {!latestCV && (
                <p className="text-xs text-violet-600">
                  Chưa có phân tích CV.{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/cv-analysis")}
                    className="font-semibold text-[#630ed4] hover:underline"
                  >
                    Phân tích CV trước
                  </button>
                  {" "}hoặc chọn Tải CV mới.
                </p>
              )}

              <SourceDetailPanel
                option={option}
                latestCV={latestCV}
                cvUploaded={cvUploaded}
                uploadedFile={uploadedFile}
                onPickFile={openCvFilePicker}
              />

              {/* JD optional, giúp câu hỏi sát yêu cầu công ty hơn */}
              <div className="rounded-md border border-violet-100 bg-violet-50/40">
                <button
                  type="button"
                  onClick={() => setJdExpanded(v => !v)}
                  className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-violet-300 bg-white text-[10px] font-bold text-violet-600">
                    JD
                  </span>
                  <span className="flex-1 text-sm font-medium text-violet-700">
                    Thêm mô tả công việc
                    {(jdFile || jdInputText.trim()) ? (
                      <span className="ml-1.5 text-xs font-normal text-emerald-600">
                        ✓ {jdFile ? jdFile.name : `${jdInputText.trim().slice(0, 30)}…`}
                      </span>
                    ) : (
                      <span className="ml-1 text-xs font-normal text-violet-400">(tùy chọn)</span>
                    )}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-violet-400 transition-transform ${jdExpanded ? "rotate-180" : ""}`}
                    strokeWidth={1.75}
                  />
                </button>

                {jdExpanded && (
                  <div className="space-y-2.5 border-t border-violet-100 px-4 pb-4 pt-3">
                    <p className="text-xs text-violet-500">
                      Dán nội dung JD hoặc upload file, AI sẽ bám sát yêu cầu tuyển dụng thực tế khi tạo câu hỏi.
                    </p>
                    <textarea
                      value={jdInputText}
                      onChange={e => { setJdInputText(e.target.value); if (e.target.value.trim()) setJdFile(null); }}
                      placeholder="Dán mô tả công việc (Job Description) vào đây..."
                      rows={5}
                      className="w-full resize-none rounded border border-violet-200 bg-white px-3 py-2 text-sm text-violet-900 placeholder:text-violet-300 focus:outline-none focus:ring-1 focus:ring-violet-300"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-violet-400">hoặc</span>
                      <button
                        type="button"
                        onClick={() => jdFileInputRef.current?.click()}
                        className="flex items-center gap-1.5 rounded border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50"
                      >
                        <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
                        {jdFile ? jdFile.name : "Upload file JD (PDF)"}
                      </button>
                      {jdFile && (
                        <button
                          type="button"
                          onClick={() => setJdFile(null)}
                          className="text-xs text-violet-400 hover:text-violet-700"
                        >
                          ✕ Xoá
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleContinueToHr}
                disabled={!canProceedSetup}
                className={`flex w-full items-center justify-center gap-2 rounded-md py-3.5 text-sm font-bold transition-all ${
                  canProceedSetup ? CTA_LIME : "cursor-not-allowed bg-violet-100 text-violet-400"
                }`}
              >
                Tiếp tục
                <ArrowRight className="h-4 w-4" {...IS} />
              </button>
        </section>
        )}

        {flowStep === 2 && (
        <section className="space-y-5">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-violet-950">Bước 2: Chọn HR AI</h2>
            <p className="mt-0.5 text-xs sm:text-sm text-violet-600">Chọn một HR, có thể xem video ngắn bên dưới trước khi bắt đầu.</p>
          </div>

          <div className="grid items-stretch gap-3 sm:grid-cols-2">
            {(["male", "female"]).map((g) => {
              const preview = HR_PREVIEWS[g];
              const Icon = g === "male" ? Mars : Venus;
              return (
                <button
                  key={g}
                  type="button"
                  aria-pressed={hrGender === g}
                  onClick={() => setHrGender(g)}
                  className={`${optBase} h-full ${hrGender === g ? optOn : optIdle}`}
                >
                  <div className="flex items-start gap-3">
                    <SelectOptionRing selected={hrGender === g} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5 shrink-0 text-[#630ed4]" {...IS} />
                        <p className="font-bold text-violet-950">{preview.name}</p>
                      </div>
                      <p className="mt-0.5 text-xs text-violet-600">{preview.subtitle}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <HrPreviewPanel hrGender={hrGender} />

          {extractWarning && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <p className="text-xs leading-relaxed text-amber-900">{extractWarning}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleStart}
            disabled={!canStart || Boolean(loadingStep)}
            className={`flex w-full items-center justify-center gap-2 rounded-md py-3.5 text-sm font-bold transition-all ${
              canStart && !loadingStep ? CTA_LIME : "cursor-not-allowed bg-violet-100 text-violet-400"
            }`}
          >
            {loadingStep ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {loadingStep === "extracting_cv" && "Đang đọc CV..."}
                {loadingStep === "extracting_jd" && "Đang đọc JD..."}
                {loadingStep === "generating_questions" && "AI đang tạo câu hỏi..."}
                {loadingStep === "creating_session" && "Đang chuẩn bị..."}
                {loadingStep === "pregenerating_videos" && "Đang tạo video HR..."}
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" {...IS} />
                {canStart ? "Bắt đầu phỏng vấn" : "Chọn HR để bắt đầu"}
              </>
            )}
          </button>

        </section>
        )}
            </div>
          )}
        </div>
        </div>
      </div>
    </MentorPageShell>
  );
}

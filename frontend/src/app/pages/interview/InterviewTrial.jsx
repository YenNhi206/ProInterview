import React, { useState } from "react";
import { useNavigate } from "react-router";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { CustomerPageHeader } from "../../components/layout/CustomerPageHeader";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";
import { CV_JD_CARD_CLASS } from "../../components/cv/CvJdAnalysisFrame";
import { Check, Mars, Venus, Mic, AlertCircle } from "lucide-react";
import { apiUrl } from "../../api/http";
import { getBaselineQuestions, pregenerateBaselineVideos, saveCameraConsent } from "../../api/interviewsApi";
import { getUser } from "../../utils/auth/auth.js";
import { hasCameraConsent } from "../../utils/interview/cameraConsent.js";
import { CameraConsentDialog } from "../../components/interview/CameraConsentDialog";

const CTA_LIME =
  "bg-gradient-to-r from-[#93f72b] to-[#93f72b] text-violet-950 shadow-[0_8px_28px_rgba(196,255,71,0.25)] hover:brightness-110";

/** Stroke Lucide chuẩn UI, đồng bộ toàn trang */
const IS = { strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" };

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

const HR_PREVIEW_PANEL_CLASS =
  "flex h-[16rem] flex-col rounded-md border border-violet-200/80 bg-violet-50/50 px-4 py-3 sm:h-[18rem]";

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

export function InterviewTrial() {
  const navigate = useNavigate();
  const [hrGender, setHrGender] = useState(null);
  const [loadingStep, setLoadingStep] = useState(null); // null | "loading_questions" | "pregenerating_videos"
  const [error, setError] = useState("");
  /* Bước xác nhận camera trước khi vào room — đã đồng ý (đúng version) thì bỏ qua. */
  const [showCameraConsent, setShowCameraConsent] = useState(false);
  const [savingCameraConsent, setSavingCameraConsent] = useState(false);

  const handleStart = () => {
    if (!hrGender || loadingStep) return;
    if (!hasCameraConsent(getUser())) {
      setShowCameraConsent(true);
      return;
    }
    startTrial();
  };

  const handleCameraConsentChoice = async (accepted) => {
    setSavingCameraConsent(true);
    const res = await saveCameraConsent(accepted);
    setSavingCameraConsent(false);
    setShowCameraConsent(false);
    if (accepted && !res.success) {
      setError("Không lưu được lựa chọn camera — buổi phỏng vấn sẽ chạy không dùng camera.");
    }
    startTrial();
  };

  const startTrial = async () => {
    if (!hrGender || loadingStep) return;
    setError("");

    // Xoá dữ liệu phiên cũ (nếu có) trước khi bắt đầu trial mới
    sessionStorage.removeItem("prointerview_questions");
    sessionStorage.removeItem("prointerview_sessionId");
    sessionStorage.removeItem("prointerview_transcripts");
    sessionStorage.removeItem("prointerview_question_objects");
    sessionStorage.removeItem("prointerview_video_urls");
    sessionStorage.removeItem("prointerview_trial_mode");

    setLoadingStep("loading_questions");
    const qRes = await getBaselineQuestions();
    if (!qRes.success || !qRes.questions?.length) {
      setError(qRes.error || "Không thể tải câu hỏi. Vui lòng thử lại.");
      setLoadingStep(null);
      return;
    }

    // Pre-generate video HR lipsync (D-ID Express, cache toàn hệ thống).
    // Nếu D-ID chưa cấu hình hoặc render quá lâu, vẫn tiếp tục với TTS fallback.
    let videoUrls = null;
    try {
      const configRes = await fetch(apiUrl("/api/ai/config"));
      const configBody = configRes.ok ? await configRes.json().catch(() => ({})) : {};
      const didEnabled = configBody?.providers?.avatar?.did === true;

      if (didEnabled) {
        setLoadingStep("pregenerating_videos");
        const pregenTimeout = new Promise((resolve) =>
          setTimeout(() => resolve({ success: false, timedOut: true }), 120_000)
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

    setLoadingStep(null);

    const interviewData = {
      questions: qRes.questions,
      videoUrls,
      hrGender,
      sessionId: `trial-${Date.now()}`,
      trialMode: true,
    };
    navigate("/interview/room", { state: interviewData });
  };

  const optBase =
    "group relative w-full rounded-md border-2 p-4 text-left transition-all duration-200 sm:p-5";
  const optIdle =
    "cursor-pointer border-violet-200 bg-white hover:border-violet-300 hover:bg-violet-50/80";
  const optOn = "border-[#630ed4] bg-violet-50 ring-2 ring-violet-200/80";

  return (
    <MentorPageShell bottomPad="pb-24">
      {loadingStep && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-violet-950/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-md bg-white p-8 shadow-2xl">
            <div className="mb-4 flex items-center justify-center">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
            </div>
            <p className="text-center text-sm font-semibold text-violet-800">
              {loadingStep === "loading_questions" && "Đang tải câu hỏi..."}
              {loadingStep === "pregenerating_videos" && "Đang chuẩn bị video HR..."}
            </p>
          </div>
        </div>
      )}

      <div className={`relative flex min-h-0 flex-col bg-transparent pb-8 pt-8 sm:pt-10 ${CUSTOMER_SHELL_GUTTER}`}>
        <div className={`${CUSTOMER_SHELL_MAX} mx-auto flex w-full max-w-3xl flex-col`}>
          <CustomerPageHeader
            className="mb-5 w-full"
            badge="Miễn phí · Không cần đăng ký"
            title={
              <>
                <span className="font-extrabold text-[#630ed4]">Thử ngay 3 câu hỏi</span>{" "}
                <span className="font-extrabold text-[#1a1b23]">phỏng vấn AI</span>
              </>
            }
            subtitle="Trải nghiệm nhanh với HR AI — không cần CV, không cần tài khoản. Sau khi xong, đăng ký miễn phí để lưu kết quả và mở khoá câu hỏi cá nhân hoá."
            subtitleClassName="mt-3 max-w-full text-sm font-medium leading-relaxed text-slate-600 sm:text-base"
          />

          <div className={CV_JD_CARD_CLASS}>
            <div className="px-4 py-5 sm:px-6 sm:py-6">
              <section className="space-y-5">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-violet-950">Chọn HR AI</h2>
                  <p className="mt-0.5 text-xs sm:text-sm text-violet-600">
                    Chọn một HR, có thể xem video ngắn bên dưới trước khi bắt đầu.
                  </p>
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

                {error && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <p className="text-xs leading-relaxed text-amber-900">{error}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleStart}
                  disabled={!hrGender || Boolean(loadingStep)}
                  className={`flex w-full items-center justify-center gap-2 rounded-md py-3.5 text-sm font-bold transition-all ${
                    hrGender && !loadingStep ? CTA_LIME : "cursor-not-allowed bg-violet-100 text-violet-400"
                  }`}
                >
                  <Mic className="h-4 w-4" {...IS} />
                  {hrGender ? "Bắt đầu" : "Chọn HR để bắt đầu"}
                </button>
              </section>
            </div>
          </div>
        </div>
      </div>
      <CameraConsentDialog
        open={showCameraConsent}
        saving={savingCameraConsent}
        onAccept={() => handleCameraConsentChoice(true)}
        onDecline={() => handleCameraConsentChoice(false)}
        onOpenChange={(open) => { if (!open && !savingCameraConsent) setShowCameraConsent(false); }}
      />
    </MentorPageShell>
  );
}

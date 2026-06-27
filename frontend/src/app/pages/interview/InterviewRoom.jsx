import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  forwardRef,
} from "react";
import { useNavigate, useLocation } from "react-router";
import {
  Mic as Microphone,
  MicOff as MicrophoneSlash,
  PhoneOff as PhoneDisconnect,
  Clock,
  ChevronRight as CaretRight,
  ChevronDown,
  Lock,
  Zap as Lightning,
  CheckCircle,
  AlertCircle as WarningCircle,
  User,
  MessageCircle as ChatCircle,
  Star,
} from "lucide-react";
import { getPlans, hasAuthCredentials } from "../../utils/auth/auth.js";
import {
  saveAnswer,
  completeInterviewSession,
  analyzeFaceSnapshot,
  generateFollowUpQuestions,
  pregenerateInterviewVideos,
} from "../../api/interviewsApi.js";
import { trackAction } from "../../utils/analytics/analyticsApi.js";
import { useDIDStream } from "../../hooks/useDIDStream";
import { useFaceAnalysis } from "../../hooks/useFaceAnalysis";
// AILipSyncAvatar removed — portrait now renders as full-panel img in Nhánh 1/2
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { InterviewStepBar } from "../../components/interview/InterviewStepBar";
import { MascotVideo, TIPS } from "../../components/interview/InterviewLoadingState";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";
import { CustomerPageHeader } from "../../components/layout/CustomerPageHeader";

/* ── Session storage keys ────────────────────────────────── */
const TRANSCRIPT_KEY = "prointerview_transcripts";

/* ── Free limit ──────────────────────────────────────────── */
const FREE_LIMIT = 3;

/* ── HR assets ───────────────────────────────────────────── */
const HR_IDLE_URLS = {
  male:   "https://res.cloudinary.com/dee4bvivu/video/upload/v1774336646/Male_jioqsx.mp4",
  female: "https://res.cloudinary.com/dee4bvivu/video/upload/v1774336640/Female_delxmy.mp4",
};

const HR_QUESTION_URLS = {
  female: [
    "https://res.cloudinary.com/dee4bvivu/video/upload/v1774340828/FQ1vid_rdw1xo.mp4",
    "https://res.cloudinary.com/dee4bvivu/video/upload/v1774340833/FQ2vid_vmp7ae.mp4",
    "https://res.cloudinary.com/dee4bvivu/video/upload/v1774340829/FQ3vid_glpon5.mp4",
    "https://res.cloudinary.com/dee4bvivu/video/upload/v1775044177/T%E1%BA%A1o_Video_T%C6%B0%C6%A1ng_T%C3%A1c_Theo_Y%C3%AAu_C%E1%BA%A7u_ijplpc.mp4",
    "https://res.cloudinary.com/dee4bvivu/video/upload/v1774340829/FQ3vid_glpon5.mp4",
  ],
  male: [
    "https://res.cloudinary.com/dee4bvivu/video/upload/v1774340828/MQ1vid_hngp8o.mp4",
    "https://res.cloudinary.com/dee4bvivu/video/upload/v1774340832/MQ2vid_xaioj6.mp4",
    "https://res.cloudinary.com/dee4bvivu/video/upload/v1774340829/MQ3vid_h7t02k.mp4",
    "https://res.cloudinary.com/dee4bvivu/video/upload/v1774340832/MQ2vid_xaioj6.mp4",
    "https://res.cloudinary.com/dee4bvivu/video/upload/v1774340829/MQ3vid_h7t02k.mp4",
  ],
};

const HR_NAMES  = { male: "David",                female: "Sarah" };
const HR_TITLES = { male: "HR AI Nam · ProInterview", female: "HR AI Nữ · ProInterview" };

/* ── D-ID config ─────────────────────────────────────────── */
const DID_VOICES = {
  male:   "vi-VN-NamMinhNeural",
  female: "vi-VN-HoaiMyNeural",
};

const DID_AVATAR_URLS = {
  female: "https://res.cloudinary.com/dee4bvivu/image/upload/v1778910708/AI-female_gxbcf1.png",
  male:   "https://res.cloudinary.com/dee4bvivu/image/upload/v1778910708/AI-male_sdrvje.png",
};

/* ── Hedge word patterns (Vietnamese) ───────────────────── */
const HEDGE_PATTERNS = [
  /tôi nghĩ là/gi, /có lẽ/gi, /hình như/gi, /đại khái/gi,
  /ở mức nào đó/gi, /cũng được/gi,
  /không biết có đúng không/gi, /chưa chắc/gi,
  /tạm thời/gi, /thật ra là/gi,
  /không chắc lắm/gi, /có thể là/gi,
];

function detectHedgeWords(text) {
  if (!text) return { hedgeWordCount: 0, hedgeWords: [] };
  const found = [];
  for (const p of HEDGE_PATTERNS) {
    const m = text.match(p);
    if (m) found.push(...m);
  }
  return {
    hedgeWordCount: found.length,
    hedgeWords: [...new Set(found.map((h) => h.toLowerCase()))],
  };
}

function computeVocabularyDiversity(text) {
  if (!text?.trim()) return 0;
  const words = text.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length < 5) return 0;
  return Math.round((new Set(words).size / words.length) * 100) / 100;
}

/** Tính behavioral summary toàn session từ mảng per-question data */
function computeBehavioralSummary(perQ) {
  // Chỉ tính với câu có ít nhất 1 giá trị thực (user thực sự trả lời)
  const valid = perQ.filter(
    (d) => d && typeof d.responseLatencyMs === "number" &&
    (d.responseLatencyMs > 0 || d.wordCount > 0 || d.silenceEvents > 0)
  );
  if (!valid.length) return null;
  const avg = (key) => valid.reduce((s, d) => s + (d[key] ?? 0), 0) / valid.length;

  const avgResponseLatencyMs   = Math.round(avg("responseLatencyMs"));
  const avgSilenceRatio        = Math.round(avg("silenceRatio") * 100) / 100;
  const avgEyeContactScore     = Math.round(avg("eyeContactScore") * 100) / 100;
  const avgHeadStabilityScore  = Math.round(avg("headStabilityScore") * 100) / 100;
  const totalHedgeWords        = valid.reduce((s, d) => s + (d.hedgeWordCount ?? 0), 0);
  const avgVocabularyDiversity = Math.round(avg("vocabularyDiversity") * 100) / 100;
  const avgAmplitudeVariance   = Math.round(avg("amplitudeVariance") * 100) / 100;

  // hedgeRatio: hedge words / tổng số từ thực tế (không phải ước lượng)
  const totalWords = valid.reduce((s, d) => s + (d.wordCount ?? 0), 0);
  const hedgeRatio = totalWords > 0 ? totalHedgeWords / totalWords : 0;

  // Composite confidence (0–5)
  // Nếu thiết bị không hỗ trợ face analysis → bỏ qua dimension eye/head (redistribute weight)
  const hasEyeData  = avgEyeContactScore > 0;
  const hasHeadData = avgHeadStabilityScore > 0;
  const latencyScore = avgResponseLatencyMs < 3000 ? 1 : avgResponseLatencyMs < 7000 ? 0.6 : 0.2;
  const fluencyScore = avgSilenceRatio < 0.10 ? 1 : avgSilenceRatio < 0.25 ? 0.6 : 0.2;
  const exprScore    = avgAmplitudeVariance > 0.07 ? 1 : avgAmplitudeVariance > 0.03 ? 0.6 : 0.2;
  const hedgeScore   = hedgeRatio < 0.02 ? 1 : hedgeRatio < 0.05 ? 0.7 : 0.3;

  // Trọng số điều chỉnh theo data có sẵn
  const w = {
    eye:       hasEyeData  ? 0.20 : 0,
    head:      hasHeadData ? 0.15 : 0,
    fluency:   0.15,
    expr:      0.15,
    hedge:     0.15,
    vocab:     0.10,
    latency:   0.10,
  };
  const missingWeight = (hasEyeData ? 0 : 0.20) + (hasHeadData ? 0 : 0.15);
  // Redistribute missing weight proportionally to remaining dimensions
  const totalW = 1 - missingWeight;
  const composite = totalW > 0 ? (
    (hasEyeData  ? avgEyeContactScore    * w.eye   : 0) +
    (hasHeadData ? avgHeadStabilityScore * w.head  : 0) +
    fluencyScore             * w.fluency +
    exprScore                * w.expr +
    hedgeScore               * w.hedge +
    avgVocabularyDiversity   * w.vocab +
    latencyScore             * w.latency
  ) / totalW : 0;

  const overallConfidenceScore = Math.round(composite * 50) / 10;

  // Dominant emotion từ Google Vision snapshots
  const emotions = valid.map((d) => d.emotion).filter(Boolean);
  let dominantEmotion = "neutral";
  if (emotions.length > 0) {
    const totals = { joy: 0, sorrow: 0, anger: 0, surprise: 0 };
    for (const e of emotions) {
      totals.joy      += e.joy      ?? 0;
      totals.sorrow   += e.sorrow   ?? 0;
      totals.anger    += e.anger    ?? 0;
      totals.surprise += e.surprise ?? 0;
    }
    const max = Math.max(...Object.values(totals));
    if (max > emotions.length * 2) {
      dominantEmotion = Object.entries(totals).sort((a, b) => b[1] - a[1])[0][0];
    }
  }

  return {
    avgResponseLatencyMs,
    avgSilenceRatio,
    avgEyeContactScore,
    avgHeadStabilityScore,
    totalHedgeWords,
    avgVocabularyDiversity,
    avgAmplitudeVariance,
    overallConfidenceScore,
    dominantEmotion,
  };
}

/* ── Helpers ─────────────────────────────────────────────── */
function formatTimer(s) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/* ── Waveform bars ───────────────────────────────────────── */
function Waveform({ active, color = "#9B6DFF" }) {
  const heights = [4, 10, 16, 12, 20, 14, 8, 18, 12, 6, 15, 10, 19, 9, 13];
  return (
    <div className="flex items-end gap-0.5 h-7">
      {heights.map((h, i) => (
        <div
          key={i}
          className="w-1 rounded-full transition-all"
          style={{
            height: active ? `${h}px` : "3px",
            background: color,
            animation: active ? `pulse ${0.5 + (i % 3) * 0.2}s ease-in-out infinite alternate` : "none",
            animationDelay: `${i * 0.07}s`,
            opacity: active ? 0.85 + (i % 2) * 0.15 : 0.25,
            transition: "height 0.25s ease",
          }}
        />
      ))}
    </div>
  );
}

/* ── Full-panel HR Video ─────────────────────────────────── */
function HRVideoPanel({ questionVideoUrl, hrPhase, onAskingDone, isListening, muted = false }) {
  const videoRef  = useRef(null);
  const [videoState, setVideoState] = useState("loading");
  const doneRef = useRef(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    doneRef.current = false;
    setVideoState("loading");
    const onCanPlay = () => { setVideoState("playing"); v.play().catch(() => {}); };
    const onError   = () => setVideoState("error");
    v.addEventListener("canplay", onCanPlay, { once: true });
    v.addEventListener("error",   onError,   { once: true });
    v.load();
    return () => { v.removeEventListener("canplay", onCanPlay); v.removeEventListener("error", onError); v.pause(); };
  }, [questionVideoUrl]);

  // Fallback timer: fires if video never starts or errors out within 8s.
  // Skipped when videoState === "playing" — the video is running, let onEnded handle
  // completion naturally. Without this guard, 12-15s questions get cut at 8s and
  // recording starts before the avatar finishes speaking.
  useEffect(() => {
    if (hrPhase !== "asking" || muted || videoState === "playing") return;
    const t = setTimeout(() => {
      if (!doneRef.current) { doneRef.current = true; setVideoState("done"); onAskingDone?.(); }
    }, 8000);
    return () => clearTimeout(t);
  }, [hrPhase, onAskingDone, muted, videoState]);

  const handleEnded = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setVideoState("done");
    onAskingDone?.();
  };

  const isVisible = videoState === "playing" || videoState === "done";

  return (
    <div className="relative w-full h-full bg-[#0a0a18]">
      <video
        ref={videoRef}
        src={questionVideoUrl}
        playsInline
        preload="auto"
        muted={muted}
        loop={muted}
        onEnded={muted ? undefined : handleEnded}
        className="absolute inset-0 h-full w-full object-cover object-center"
        style={{ display: isVisible ? "block" : "none" }}
      />
      {(videoState === "loading" || videoState === "error") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4"
          style={{ background: "linear-gradient(160deg,#120d2b 0%,#1a1040 100%)" }}>
          {videoState === "error" ? (
            <>
              <div className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: "rgba(110,53,232,0.2)", border: "2px solid rgba(110,53,232,0.3)" }}>
                <User className="w-10 h-10 text-[#9B6DFF]" />
              </div>
              <p className="text-white/40 text-sm">HR đang chuẩn bị câu hỏi...</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
              <p className="text-white/40 text-sm">Đang tải câu hỏi...</p>
            </>
          )}
        </div>
      )}
      {videoState === "done" && isListening && (
        <div className="pointer-events-none absolute inset-0" style={{ background: "rgba(0,0,0,0.2)" }}>
          <div className="absolute right-3 top-3">
            <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
              style={{ background: "rgba(110,53,232,0.92)", backdropFilter: "blur(8px)" }}>
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#b5e636]" />
              Đang ghi âm câu trả lời...
            </div>
          </div>
        </div>
      )}
      {hrPhase === "asking" && videoState === "playing" && (
        <div className="absolute top-3 right-3 z-10">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ background: "rgba(110,53,232,0.85)", backdropFilter: "blur(8px)" }}>
            <div className="w-1.5 h-1.5 rounded-full bg-[#b5e636] animate-pulse" />
            <span className="text-white">HR đang hỏi...</span>
          </div>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
        style={{ background: "linear-gradient(to top, rgba(10,10,24,0.85) 0%, transparent 100%)" }} />
    </div>
  );
}

/* ── User camera tile ─────────────────────────────────────────────────────────
   forwardRef: exposes video element to InterviewRoom for FaceMesh sampling.
   onAudioTrack: passes audio MediaStreamTrack so InterviewRoom can build its
   AudioContext without a second getUserMedia call (avoids double permission).
 */
const UserCameraTile = forwardRef(function UserCameraTile({ isRecording, onAudioTrack }, faceVideoRef) {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const [camState, setCamState] = useState("loading");
  const [camError, setCamError] = useState("Camera không khả dụng");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let stream = null;
      try {
        // Request camera + audio together, single permission dialog
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: true,
        });
      } catch (_) {
        // Fallback: video-only (some devices lack mic or user denied audio)
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
            audio: false,
          });
        } catch (err) {
          if (cancelled) return;
          const msg =
            err?.name === "NotAllowedError" ? "Bạn chưa cấp quyền camera"
            : err?.name === "NotFoundError" ? "Không tìm thấy camera"
            : "Camera không khả dụng";
          setCamError(msg);
          setCamState("error");
          return;
        }
      }
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;

      // Pass audio track to parent for Web Audio analysis (no second getUserMedia needed)
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack && onAudioTrack) onAudioTrack(audioTrack);

      setCamState("active");
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (camState !== "active") return;
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    video.srcObject = streamRef.current;
    video.play().catch(() => {});
    // Expose video element to parent (for FaceMesh sampling)
    if (faceVideoRef) faceVideoRef.current = video;
  }, [camState, faceVideoRef]);

  return (
    <div className="relative h-full min-h-[220px] w-full overflow-hidden rounded-2xl bg-[#0f0f1a]">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover object-center"
        style={{ transform: "scaleX(-1)", display: camState === "active" ? "block" : "none" }}
      />
      {camState !== "active" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: "rgba(110,53,232,0.2)", border: "2px solid rgba(110,53,232,0.3)" }}>
            <User className="w-7 h-7 text-[#9B6DFF]" />
          </div>
          <p className="text-white/40 text-xs text-center px-3">
            {camState === "loading" ? "Đang kết nối camera..." : camError}
          </p>
        </div>
      )}
      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg backdrop-blur-sm"
        style={{ background: "rgba(0,0,0,0.6)" }}>
        <span className="text-white text-xs font-medium">Bạn</span>
        {isRecording && <div className="w-1.5 h-1.5 rounded-full bg-[#b5e636] animate-pulse" />}
      </div>
    </div>
  );
});

/* ── Upgrade Modal ───────────────────────────────────────── */
function UpgradeModal({ completedCount, totalCount, onUpgrade, onFinish }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(8,6,20,0.93)", backdropFilter: "blur(16px)" }}>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(110,53,232,0.25) 0%, transparent 70%)" }} />
      <div className="relative z-10 w-full max-w-md rounded-3xl p-8 text-center"
        style={{ background: "linear-gradient(160deg,#120d2b 0%,#1a1040 100%)", border: "1.5px solid rgba(139,77,255,0.3)", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}>
        <div className="flex justify-center mb-5">
          <div className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,rgba(110,53,232,0.2),rgba(139,77,255,0.1))", border: "2px solid rgba(139,77,255,0.4)" }}>
            <Lock className="w-9 h-9 text-[#8B4DFF]" />
          </div>
        </div>
        <div className="flex justify-center gap-1 mb-5">
          {[...Array(completedCount)].map((_, i) => <Star key={i} className="w-5 h-5 text-[#8B4DFF]" />)}
          {[...Array(totalCount - completedCount)].map((_, i) => <Star key={i} className="w-5 h-5 text-white/15" />)}
        </div>
        <h2 className="text-white text-xl font-bold mb-2">Bạn đã hoàn thành {completedCount} câu hỏi miễn phí!</h2>
        <p className="text-white/50 text-sm leading-relaxed mb-6">
          Còn <span className="text-[#8B4DFF] font-semibold">{totalCount - completedCount} câu hỏi</span> nữa.
          Nâng cấp <span className="text-[#8B4DFF] font-semibold">Pro</span> để trả lời đầy đủ và nhận phân tích hành vi toàn diện.
        </p>
        <div className="rounded-2xl p-4 mb-6 text-left"
          style={{ background: "rgba(110,53,232,0.1)", border: "1px solid rgba(139,77,255,0.2)" }}>
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-3">Gói Pro bao gồm</p>
          {[
            "Phỏng vấn đầy đủ 5 câu hỏi mỗi buổi",
            "Phân tích eye contact & cảm xúc qua AI",
            "Phản hồi chi tiết từng câu với điểm số SHRM/DDI",
            "Không giới hạn số buổi phỏng vấn AI",
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(110,53,232,0.2)" }}>
                <div className="w-1.5 h-1.5 rounded-full bg-[#b5e636]" />
              </div>
              <p className="text-white/70 text-xs">{item}</p>
            </div>
          ))}
        </div>
        <button onClick={onUpgrade}
          className="w-full py-3.5 rounded-2xl font-bold text-sm mb-3 transition-all hover:scale-[1.02]"
          style={{ background: "linear-gradient(135deg,#6E35E8,#8B4DFF)", color: "#fff", boxShadow: "0 8px 32px rgba(110,53,232,0.45)" }}>
          <Lightning className="inline w-4 h-4 mr-2 mb-0.5" />
          Nâng cấp Pro, tiếp tục phỏng vấn
        </button>
        <button onClick={onFinish}
          className="w-full py-3 rounded-2xl text-sm transition-all hover:bg-white/8"
          style={{ color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}>
          Kết thúc và xem kết quả {completedCount} câu
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════ */
export default function InterviewRoom() {
  const navigate = useNavigate();
  const location = useLocation();
  const plans = getPlans();
  const isPro = plans.starterPro || plans.elitePro;

  const hrGender =
    location.state?.hrGender ||
    sessionStorage.getItem("prointerview_hr_gender") ||
    "male";

  /* ── D-ID lipsync ─────────────────────────────────────── */
  const { status: didStatus, error: didError, connect: didConnect, disconnect: didDisconnect,
          speakWithText, attachVideo } = useDIDStream({
    sourceImageUrl: DID_AVATAR_URLS[hrGender],
  });

  // Track whether the WebRTC stream was forcibly closed after the max-duration guard.
  // When true, isDIDActive becomes false → TTS fallback takes over (free, no per-minute charge).
  const [didSessionExpired, setDidSessionExpired] = useState(false);
  const isDIDActive = !didSessionExpired && Boolean(DID_API_KEY) && didStatus !== "error";

  // True only when the D-ID WebRTC video element has actually started playing frames.
  // Controls opacity of the video overlay on top of the portrait background.
  const [didVideoReady, setDidVideoReady] = useState(false);

  /* ── Web Speech TTS fallback (khi D-ID không khả dụng) ── */
  const ttsAvailable = typeof window !== "undefined" && Boolean(window.speechSynthesis);
  const [ttsSpeaking, setTtsSpeaking] = useState(false);

  /* ── Resolve questions & session ID ──────────────────── */
  const apiQuestions = location.state?.questions ?? (() => {
    try { return JSON.parse(sessionStorage.getItem("prointerview_questions") ?? "null"); }
    catch { return null; }
  })();

  const resolvedSessionId = location.state?.sessionId
    ?? sessionStorage.getItem("prointerview_sessionId")
    ?? null;

  // Pre-generated video URLs từ D-ID Express API (truyền từ Interview.jsx)
  // Fallback về sessionStorage để giữ URLs khi user refresh trang trong phòng phỏng vấn.
  const baseVideoUrls = location.state?.videoUrls ?? (() => {
    try { return JSON.parse(sessionStorage.getItem("prointerview_video_urls") ?? "null"); }
    catch { return null; }
  })();

  // Free trial (anonymous, không CV/login) — 3 câu baseline, không lưu DB, kết thúc ở /interview/trial/done
  const trialMode = location.state?.trialMode === true
    || sessionStorage.getItem("prointerview_trial_mode") === "true";

  /* ── Câu hỏi/video "lớn lên" giữa buổi: baseline (biết trước, ≤3 câu) + follow-up cá nhân hóa
     (sinh sau khi trả lời xong baseline, dựa trên CV/JD + câu trả lời thật — xem
     triggerFollowUpGeneration). trialMode và free user không bao giờ append gì. ── */
  const [baseQuestionObjects]              = useState(apiQuestions?.length ? apiQuestions : []);
  const [followUpQuestionObjects, setFollowUpQuestionObjects] = useState([]);
  const [followUpVideoUrls,       setFollowUpVideoUrls]       = useState([]);

  const QUESTION_OBJECTS = useMemo(
    () => (baseQuestionObjects.length ? [...baseQuestionObjects, ...followUpQuestionObjects] : null),
    [baseQuestionObjects, followUpQuestionObjects],
  );
  const QUESTIONS = useMemo(
    () => (QUESTION_OBJECTS ?? []).map((q) => (typeof q === "string" ? q : q.question)),
    [QUESTION_OBJECTS],
  );
  const videoUrls = useMemo(
    () => [...(baseVideoUrls ?? []), ...followUpVideoUrls],
    [followUpVideoUrls], // eslint-disable-line react-hooks/exhaustive-deps -- baseVideoUrls cố định sau mount
  );
  const hasPregenVideos = Array.isArray(videoUrls) && videoUrls.some(Boolean);

  // Pro user, session mới có baseline (≤3 câu) lúc mount → còn 2 câu cá nhân hóa cần sinh giữa
  // buổi. Free user/trial/session cũ đã có sẵn ≥4 câu (trước khi refactor này) đều bỏ qua.
  const [personalizedPending, setPersonalizedPending] = useState(
    () => isPro && !trialMode && Boolean(resolvedSessionId) && (apiQuestions?.length ?? 0) <= 3,
  );
  const followUpInFlightRef = useRef(false);
  const [generatingFollowUp, setGeneratingFollowUp] = useState(false);
  // Progress "creep" + tip xoay vòng — cùng pattern với InterviewLoadingState (setup flow),
  // vì bước này cũng có thể chờ tới ~150s (sinh câu hỏi LLM + pregen video D-ID/Cloudinary).
  const [followUpProgress, setFollowUpProgress] = useState(0);
  const [followUpTipIdx, setFollowUpTipIdx] = useState(0);
  useEffect(() => {
    if (!generatingFollowUp) { setFollowUpProgress(0); return; }
    const interval = setInterval(() => {
      setFollowUpProgress((prev) => Math.min(prev + 1, 92));
    }, 1200);
    return () => clearInterval(interval);
  }, [generatingFollowUp]);
  useEffect(() => {
    if (!generatingFollowUp) return;
    const interval = setInterval(() => {
      setFollowUpTipIdx((i) => (i + 1) % TIPS.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [generatingFollowUp]);

  // Lobby/ready screen: trial luôn hiện đúng số câu thật (3, cố định). Flow chính luôn hiện "5"
  // ngay cả khi 2 câu follow-up chưa sinh xong — tránh hiểu nhầm "chỉ có 3 câu" cho Pro user.
  const displayQuestionCount = trialMode ? QUESTIONS.length : 5;

  /* ── UI state ─────────────────────────────────────────── */
  const [phase,             setPhase]             = useState("ready");
  const [currentQ,          setCurrentQ]          = useState(0);
  // URL video D-ID pre-generated của câu hỏi hiện tại, null khi không có
  const currentVideoUrl = hasPregenVideos ? (videoUrls[currentQ] ?? null) : null;
  const [isListening,       setIsListening]       = useState(false);
  const [transcript,        setTranscript]        = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [timerSeconds,      setTimerSeconds]      = useState(0);
  const [sttSupported,      setSttSupported]      = useState(true);
  const [sttError,          setSttError]          = useState("");
  const [allTranscripts,    setAllTranscripts]    = useState(Array(QUESTIONS.length).fill(""));
  const [hrPhase,           setHrPhase]           = useState("asking");
  const [showUpgradeModal,  setShowUpgradeModal]  = useState(false);
  const [showStarHints,     setShowStarHints]     = useState(false);

  /* ── Core refs ────────────────────────────────────────── */
  const recognitionRef     = useRef(null);
  const isListeningRef     = useRef(false);
  const transcriptRef      = useRef("");
  const timerRef           = useRef(null);
  const isNavigatingRef    = useRef(false);
  const questionStartTimeRef = useRef(Date.now());
  const lastSpokenQRef     = useRef(-1);
  const lastTTSSpokenQRef  = useRef(-1); // guard riêng cho TTS, tách khỏi D-ID
  const ttsUtteranceRef    = useRef(null);
  const noopAttachVideo    = useCallback(() => {}, []); // stable no-op cho Nhánh 3 (pure video fallback)

  /* ── Camera video ref (shared with FaceMesh hook) ─────── */
  const cameraVideoRef = useRef(null);

  /* ── Web Audio refs ───────────────────────────────────── */
  const audioCtxRef        = useRef(null);
  const analyserRef        = useRef(null);
  // audioStreamRef removed, audio track is now managed by UserCameraTile
  const audioSampleRef     = useRef([]);   // amplitude samples (0–1) current question
  const silenceStartRef    = useRef(null); // timestamp when silence started
  const silenceEventsRef   = useRef(0);    // count of >2 s silences
  const lastSilentRef      = useRef(false);
  const audioIntervalRef   = useRef(null);
  // Auto-calibration: session-level threshold derived from env noise floor
  const calibSamplesRef    = useRef([]);   // first 30 samples → set threshold
  const silenceThreshRef   = useRef(0.10); // updated after calibration

  /* ── Response latency refs ────────────────────────────── */
  const latencyStartRef    = useRef(null); // set when HR finishes asking
  const latencyMsRef       = useRef(0);    // ms until first speech
  const firstSpeechRef     = useRef(false);

  /* ── Per-question behavioral storage ─────────────────── */
  const behavioralPerQRef  = useRef(Array(QUESTIONS.length).fill(null));
  const durationPerQRef    = useRef(Array(QUESTIONS.length).fill(0));

  /* ── Google Vision emotion results per question ───────── */
  const emotionsRef        = useRef(Array(QUESTIONS.length).fill(null));

  /* ── Face analysis hook ───────────────────────────────── */
  const { resetMetrics: resetFace, getMetrics: getFaceMetrics } = useFaceAnalysis({
    videoRef: cameraVideoRef,
    isActive: isListening && phase === "question",
  });

  /* ── Guards: sessionStorage recovery ──────────────────── */
  useEffect(() => {
    if (!apiQuestions?.length || !resolvedSessionId) {
      navigate("/interview", { replace: true });
      return;
    }
    sessionStorage.setItem("prointerview_questions", JSON.stringify(apiQuestions));
    sessionStorage.setItem("prointerview_sessionId", resolvedSessionId);
    if (location.state?.hrGender) {
      sessionStorage.setItem("prointerview_hr_gender", location.state.hrGender);
    }
    // Persist pre-gen video URLs so they survive a page refresh inside the room.
    // Without this, refresh clears location.state → videoUrls = null → D-ID WebRTC
    // stream is attempted instead of the already-rendered videos (wasting credits).
    if (location.state?.videoUrls) {
      sessionStorage.setItem("prointerview_video_urls", JSON.stringify(location.state.videoUrls));
    }
    if (location.state?.trialMode) {
      sessionStorage.setItem("prointerview_trial_mode", "true");
    }
    // Cần cho triggerFollowUpGeneration giữa buổi — sống sót qua refresh trang trong phòng.
    if (location.state?.cvText)   sessionStorage.setItem("prointerview_cv_text", location.state.cvText);
    if (location.state?.jdText)   sessionStorage.setItem("prointerview_jd_text", location.state.jdText);
    if (location.state?.position) sessionStorage.setItem("prointerview_position", location.state.position);
    if (location.state?.field)    sessionStorage.setItem("prointerview_field", location.state.field);
    if (location.state?.level)    sessionStorage.setItem("prointerview_level", location.state.level);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── startListening, dùng chung cho TTS callback và HRVideoPanel fallback ── */
  const startListening = useCallback(() => {
    setHrPhase("listening");
    latencyStartRef.current = Date.now();
    isListeningRef.current  = true;
    setIsListening(true);
    try { recognitionRef.current?.start(); } catch (_) {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── speakQuestionTTS, Web Speech API đọc câu hỏi AI ── */
  const speakQuestionTTS = useCallback((text, onEnd) => {
    const synth = window.speechSynthesis;
    if (!synth) { onEnd?.(); return; }
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang  = "vi-VN";
    utterance.rate  = 0.88;
    utterance.pitch = hrGender === "female" ? 1.1 : 0.88;

    // Try to select a gender-appropriate Vietnamese voice.
    // getVoices() may return [] on first call (async load) — pick from whatever is available.
    const voices   = synth.getVoices();
    const viVoices = voices.filter(v => v.lang === "vi-VN" || v.lang.startsWith("vi"));
    if (viVoices.length > 0) {
      const genderHints = hrGender === "male"
        ? ["male", "nam", "minh", "quoc"]
        : ["female", "nu", "nữ", "hoai", "my"];
      const matched = viVoices.find(v =>
        genderHints.some(kw => v.name.toLowerCase().includes(kw))
      );
      // Use matched gender voice; fall back to first available vi voice
      utterance.voice = matched ?? viVoices[0];
    }

    utterance.onstart = () => setTtsSpeaking(true);
    utterance.onend   = () => { setTtsSpeaking(false); onEnd?.(); };
    // "interrupted" = bị cancel chủ động (D-ID retry), không gọi onEnd
    utterance.onerror = (e) => {
      setTtsSpeaking(false);
      if (e?.error !== "interrupted") onEnd?.();
    };
    ttsUtteranceRef.current = utterance;
    synth.speak(utterance);
  }, [hrGender]);

  /* ── Web Audio setup, nhận audio track từ UserCameraTile (không mở getUserMedia riêng) */
  const handleAudioTrack = useCallback((track) => {
    try {
      const ctx      = new (window.AudioContext || window.webkitAudioContext)();
      const source   = ctx.createMediaStreamSource(new MediaStream([track]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      audioCtxRef.current  = ctx;
      analyserRef.current  = analyser;
    } catch (_) { /* browser không hỗ trợ Web Audio, bỏ qua, không crash */ }
  }, []);

  /* ── Audio sampling interval (100 ms, while isListening) ─ */
  useEffect(() => {
    clearInterval(audioIntervalRef.current);
    if (!isListening || !analyserRef.current) return;
    const data = new Float32Array(analyserRef.current.fftSize);
    audioIntervalRef.current = setInterval(() => {
      const analyser = analyserRef.current;
      if (!analyser) return;
      analyser.getFloatTimeDomainData(data);
      const rms       = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length);
      const amplitude = Math.min(1, rms * 4);
      audioSampleRef.current.push(amplitude);

      // Auto-calibrate silence threshold from first 30 samples (~3 s of actual recording)
      // Runs once per session, calibSamplesRef is NOT reset between questions
      if (calibSamplesRef.current.length < 30) {
        calibSamplesRef.current.push(amplitude);
        if (calibSamplesRef.current.length === 30) {
          const avgNoise = calibSamplesRef.current.reduce((s, v) => s + v, 0) / 30;
          // threshold = 3× noise floor, bounded [0.05, 0.30]
          silenceThreshRef.current = Math.max(0.05, Math.min(0.30, avgNoise * 3));
        }
      }

      const isSilent = amplitude < silenceThreshRef.current;
      if (isSilent && !lastSilentRef.current) {
        silenceStartRef.current = Date.now();
      } else if (!isSilent && lastSilentRef.current && silenceStartRef.current) {
        if (Date.now() - silenceStartRef.current > 2000) silenceEventsRef.current += 1;
        silenceStartRef.current = null;
      }
      lastSilentRef.current = isSilent;
    }, 100);
    return () => clearInterval(audioIntervalRef.current);
  }, [isListening]);

  /* ── Timer ────────────────────────────────────────────── */
  useEffect(() => {
    if (phase !== "question") return;
    timerRef.current = setInterval(() => setTimerSeconds((p) => p + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  /* ── Reset per-question state ─────────────────────────── */
  useEffect(() => {
    setHrPhase("asking");
    setTranscript("");
    setInterimTranscript("");
    transcriptRef.current = "";
    setShowStarHints(false);
    questionStartTimeRef.current = Date.now();
    // Reset behavioral accumulators
    audioSampleRef.current   = [];
    silenceEventsRef.current = 0;
    silenceStartRef.current  = null;
    lastSilentRef.current    = false;
    latencyStartRef.current  = null;
    latencyMsRef.current     = 0;
    firstSpeechRef.current   = false;
    resetFace();
  }, [currentQ, resetFace]);

  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  /* ── Cleanup on unmount ───────────────────────────────── */
  useEffect(() => {
    return () => {
      isNavigatingRef.current = true;
      isListeningRef.current = false;
      recognitionRef.current?.abort();
      clearInterval(timerRef.current);
      clearInterval(audioIntervalRef.current);
      audioCtxRef.current?.close().catch(() => {});
      window.speechSynthesis?.cancel();
      didDisconnect();
      // Remove pre-gen URLs after leaving the room so the next fresh session
      // does not accidentally load videos from a previous interview.
      sessionStorage.removeItem("prointerview_video_urls");
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── D-ID connect — lazy: chỉ kết nối khi user bắt đầu phỏng vấn ───────────
     Không preconnect trên màn "ready" vì D-ID sessions có idle timeout ~60s.
     Kết nối ngay khi phase = "question": stream mới, không bao giờ bị expire
     trước lần speak đầu tiên.
     Attempt counter resets per question so D-ID can recover if it comes back.  */
  const didConnectAttemptsRef = useRef(0);

  // Reset attempt counter each time user moves to a new question.
  // This allows D-ID to recover after a transient failure on a previous question
  // instead of permanently giving up after 3 lifetime attempts.
  useEffect(() => {
    didConnectAttemptsRef.current = 0;
  }, [currentQ]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (hasPregenVideos || phase !== "question" || !DID_API_KEY) return;
    if (didStatus === "connected" || didStatus === "connecting") return;
    if (didConnectAttemptsRef.current >= 3) return;
    // 401/403 = auth/plan failure — retrying with the same key will never succeed.
    // Bail out immediately so TTS fallback kicks in without waiting for 3 retry cycles.
    if (didError && /40[13]|Forbidden|Unauthorized/i.test(didError)) return;
    didConnectAttemptsRef.current += 1;
    didConnect();
  }, [phase, didStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Reset speak guard khi D-ID reconnect thành công ───────────────────────
     Sau khi session expired → status="error" → reconnect → status="connected".
     Guard: chỉ reset khi hrPhase="asking" — tránh double-speak nếu reconnect
     xảy ra sau khi user đã trả lời (hrPhase="listening").                     */
  useEffect(() => {
    if (didStatus === "connected" && hrPhase === "asking") {
      lastSpokenQRef.current = -1;
    }
  }, [didStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── D-ID max stream duration guard ─────────────────────────
     D-ID Streaming API charges per minute. Disconnect after 15 minutes
     to stop the meter — TTS fallback (free) takes over automatically
     because setDidSessionExpired(true) makes isDIDActive = false.      */
  useEffect(() => {
    if (!DID_API_KEY || hasPregenVideos) return;
    const t = setTimeout(() => {
      setDidSessionExpired(true);
      didDisconnect();
    }, 15 * 60 * 1000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── D-ID speak — skip khi đang dùng pregen video ────────── */
  useEffect(() => {
    // HRVideoPanel tự phát audio từ pre-generated video, không cần D-ID TTS
    if (hasPregenVideos) return;
    if (phase !== "question" || didStatus !== "connected") return;
    if (lastSpokenQRef.current === currentQ) return;
    if (hrPhase !== "asking") return;
    lastSpokenQRef.current = currentQ;
    speakWithText(QUESTIONS[currentQ], startListening, DID_VOICES[hrGender]);
  }, [phase, didStatus, currentQ, hrPhase]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── TTS fallback: khi không có pregen video VÀ D-ID không khả dụng ── */
  useEffect(() => {
    // Có video pre-gen cho câu này → HRVideoPanel tự xử lý
    if (currentVideoUrl) return;
    if (isDIDActive || !ttsAvailable) return;
    if (phase !== "question" || hrPhase !== "asking") return;
    if (lastTTSSpokenQRef.current === currentQ) return;
    lastTTSSpokenQRef.current = currentQ;
    speakQuestionTTS(QUESTIONS[currentQ], startListening);
    return () => {
      lastTTSSpokenQRef.current = -1;
      window.speechSynthesis?.cancel();
      setTtsSpeaking(false);
    };
  }, [phase, currentQ, hrPhase, isDIDActive, currentVideoUrl, speakQuestionTTS, startListening]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── STT setup ────────────────────────────────────────── */
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSttSupported(false); return; }
    const recognition = new SR();
    recognition.lang = "vi-VN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
        else interimText += event.results[i][0].transcript;
      }
      if (finalText) {
        // Track response latency on first speech of this question
        if (!firstSpeechRef.current && latencyStartRef.current) {
          latencyMsRef.current = Date.now() - latencyStartRef.current;
          firstSpeechRef.current = true;
        }
        setTranscript((prev) => {
          const j = prev ? prev + " " + finalText.trim() : finalText.trim();
          transcriptRef.current = j;
          return j;
        });
      }
      setInterimTranscript(interimText);
    };
    recognition.onend = () => {
      if (isListeningRef.current) { try { recognition.start(); } catch (_) {} }
      else setInterimTranscript("");
    };
    recognition.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setSttSupported(false);
        setSttError("Trình duyệt chưa cấp quyền microphone.");
        isListeningRef.current = false;
        setIsListening(false);
      }
    };
    recognitionRef.current = recognition;
    return () => { isListeningRef.current = false; recognitionRef.current?.abort(); };
  }, []);

  /* ── Toggle mic ───────────────────────────────────────── */
  const toggleListening = () => {
    if (isListeningRef.current) {
      isListeningRef.current = false;
      setIsListening(false);
      recognitionRef.current?.stop();
    } else {
      setSttError("");
      if (!firstSpeechRef.current && !latencyStartRef.current) {
        latencyStartRef.current = Date.now();
      }
      isListeningRef.current = true;
      setIsListening(true);
      try { recognitionRef.current?.start(); } catch (_) {}
    }
  };

  /* ── Compute audio + text behavioral data for current Q ─ */
  const buildBehavioralData = (qIndex) => {
    // Audio
    const samples = audioSampleRef.current;
    const thresh  = silenceThreshRef.current;
    let avgAmplitude = 0, amplitudeVariance = 0, silenceRatio = 0;
    if (samples.length > 0) {
      avgAmplitude = samples.reduce((s, v) => s + v, 0) / samples.length;
      amplitudeVariance = Math.sqrt(
        samples.reduce((s, v) => s + (v - avgAmplitude) ** 2, 0) / samples.length
      );
      const silentCount = samples.filter((v) => v < thresh).length;
      silenceRatio = silentCount / samples.length;
    }
    // Text
    const text = (
      transcriptRef.current +
      (interimTranscript ? " " + interimTranscript : "")
    ).trim();
    const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const { hedgeWordCount, hedgeWords } = detectHedgeWords(text);
    const vocabularyDiversity = computeVocabularyDiversity(text);
    // Face (MediaPipe)
    const faceMetrics = getFaceMetrics();
    // Emotion will be filled in by Google Vision callback
    const emotion = emotionsRef.current[qIndex] ?? null;

    return {
      responseLatencyMs:   latencyMsRef.current,
      silenceRatio:        Math.round(silenceRatio * 100) / 100,
      silenceEvents:       silenceEventsRef.current,
      avgAmplitude:        Math.round(avgAmplitude * 1000) / 1000,
      amplitudeVariance:   Math.round(amplitudeVariance * 1000) / 1000,
      wordCount,
      hedgeWordCount,
      hedgeWords,
      vocabularyDiversity,
      ...faceMetrics,
      ...(emotion ? { emotion } : {}),
    };
  };

  /* ── Capture frame & call Google Vision (fire-and-forget) ─ */
  const captureAndAnalyzeFace = (qIndex) => {
    const sessionId = resolvedSessionId;
    if (!sessionId || !hasAuthCredentials()) return;
    const video = cameraVideoRef.current;
    if (!video || video.videoWidth === 0) return;

    const canvas = document.createElement("canvas");
    const W = Math.min(video.videoWidth, 640);
    const H = Math.min(video.videoHeight, 480);
    canvas.width  = W;
    canvas.height = H;
    canvas.getContext("2d")?.drawImage(video, 0, 0, W, H);
    const base64 = canvas.toDataURL("image/jpeg", 0.75).split(",")[1];
    if (!base64) return;

    analyzeFaceSnapshot(sessionId, base64, qIndex)
      .then((res) => {
        if (res?.emotion) {
          emotionsRef.current[qIndex] = res.emotion;
        }
      })
      .catch(() => {});
  };

  /* ── Save transcript state ────────────────────────────── */
  const saveCurrentTranscript = () => {
    const full = (
      transcriptRef.current + (interimTranscript ? " " + interimTranscript : "")
    ).trim();
    const updated = [...allTranscripts];
    updated[currentQ] = full;
    setAllTranscripts(updated);
    return updated;
  };

  /* ── Persist answer to backend ────────────────────────── */
  const persistAnswer = (qIndex, updatedTranscripts) => {
    const sessionId = resolvedSessionId;
    if (!sessionId || !hasAuthCredentials()) return;
    const durationSeconds = Math.max(0, Math.round((Date.now() - questionStartTimeRef.current) / 1000));
    durationPerQRef.current[qIndex] = durationSeconds;
    const behavioralData  = buildBehavioralData(qIndex);
    behavioralPerQRef.current[qIndex] = behavioralData;
    saveAnswer(sessionId, {
      questionIndex: qIndex,
      questionText:  QUESTIONS[qIndex] ?? "",
      transcript:    updatedTranscripts[qIndex] ?? "",
      durationSeconds,
      behavioralData,
    }).catch(() => {});
  };

  /* ── Navigate to feedback ─────────────────────────────── */
  const goToFeedback = async (transcripts) => {
    isNavigatingRef.current = true;
    isListeningRef.current  = false;
    recognitionRef.current?.abort();
    clearInterval(timerRef.current);
    clearInterval(audioIntervalRef.current);
    sessionStorage.setItem(TRANSCRIPT_KEY, JSON.stringify(transcripts));
    if (QUESTION_OBJECTS) {
      sessionStorage.setItem("prointerview_question_objects", JSON.stringify(QUESTION_OBJECTS));
    }

    // Merge any still-pending emotions into behavioralPerQ
    const finalBehavioral = behavioralPerQRef.current.map((bd, i) => {
      if (!bd) return bd;
      const emotion = emotionsRef.current[i];
      return emotion ? { ...bd, emotion } : bd;
    });

    // Backup answers payload, uses actual per-question durations recorded when each PATCH fired
    const backupAnswers = transcripts
      .map((t, i) => ({
        questionIndex:   i,
        questionText:    QUESTIONS[i] ?? "",
        transcript:      t ?? "",
        durationSeconds: durationPerQRef.current[i] ?? 0,
        behavioralData:  finalBehavioral[i] ?? undefined,
      }))
      .filter((a) => a.transcript.trim().length > 0);

    // Compute session-level behavioral summary
    const behavioralSummary = computeBehavioralSummary(finalBehavioral.filter(Boolean));

    const sessionId = resolvedSessionId;
    if (hasAuthCredentials() && sessionId) {
      try {
        await completeInterviewSession(sessionId, {
          answers:              backupAnswers,
          totalDurationSeconds: timerSeconds,
          behavioralSummary:    behavioralSummary ?? undefined,
        });
        trackAction("interview_complete", "/interview/room", {
          sessionId,
          questionCount: backupAnswers.length,
          durationSeconds: timerSeconds,
        });
      } catch { /* still navigate on fail */ }
    }

    // Free trial: không lưu lịch sử local, dẫn sang trang "đăng ký để mở khoá" thay vì feedback thật
    if (trialMode) {
      navigate("/interview/trial/done", { state: { transcripts: backupAnswers } });
      return;
    }

    navigate("/interview/feedback", { state: { sessionId } });
  };

  /* ── Sinh 2 câu hỏi cá nhân hóa giữa buổi (Pro user, sau khi trả lời xong baseline) ──
     Dùng CV/JD + câu trả lời thật của ứng viên cho 3 câu baseline làm context. Thất bại/timeout
     → graceful degradation: kết thúc phỏng vấn ở baseline, không để user bị treo. ── */
  const triggerFollowUpGeneration = async (latestTranscripts) => {
    if (followUpInFlightRef.current) return;
    followUpInFlightRef.current = true;
    setGeneratingFollowUp(true);

    try {
      const cvText   = location.state?.cvText   ?? sessionStorage.getItem("prointerview_cv_text")   ?? "";
      const jdText   = location.state?.jdText   ?? sessionStorage.getItem("prointerview_jd_text")   ?? "";
      const position = location.state?.position ?? sessionStorage.getItem("prointerview_position") ?? "";
      const field    = location.state?.field    ?? sessionStorage.getItem("prointerview_field")    ?? "";
      const level    = location.state?.level    ?? sessionStorage.getItem("prointerview_level")    ?? "";

      const baselineAnswers = latestTranscripts.slice(0, baseQuestionObjects.length).map((t, i) => ({
        questionIndex: i,
        transcript:    t ?? "",
      }));

      const qRes = await generateFollowUpQuestions(resolvedSessionId, {
        cvText, jdText, position, field, level, baselineAnswers,
      });
      if (!qRes.success || !qRes.questions?.length) {
        throw new Error(qRes.error || "no_questions");
      }

      let newVideoUrls = qRes.questions.map(() => null);
      // 150s (giống Interview.jsx baseline pregen) — D-ID render (≤120s) + mirror Cloudinary (≤30s)
      // nay đã bật persistVideo cho follow-up, cần budget tương đương baseline thay vì 60s cũ
      // (quá ngắn, hay timeout sớm khiến follow-up rơi về no-video trước khi mirror xong).
      const pregenTimeout = new Promise((resolve) => setTimeout(() => resolve({ success: false }), 150_000));
      const pregenResult = await Promise.race([
        pregenerateInterviewVideos(qRes.questions.map((q) => q.question), { gender: hrGender }),
        pregenTimeout,
      ]);
      if (pregenResult.success && pregenResult.videoUrls?.some(Boolean)) {
        newVideoUrls = pregenResult.videoUrls;
      }

      const addCount = qRes.questions.length;
      setFollowUpQuestionObjects(qRes.questions);
      setFollowUpVideoUrls(newVideoUrls);
      setAllTranscripts((prev) => [...prev, ...Array(addCount).fill("")]);
      behavioralPerQRef.current.push(...Array(addCount).fill(null));
      durationPerQRef.current.push(...Array(addCount).fill(0));
      emotionsRef.current.push(...Array(addCount).fill(null));
      setPersonalizedPending(false);
      setCurrentQ((prev) => prev + 1);
    } catch {
      setPersonalizedPending(false);
      goToFeedback(latestTranscripts);
    } finally {
      setGeneratingFollowUp(false);
      followUpInFlightRef.current = false;
    }
  };

  /* ── Next / end handlers ──────────────────────────────── */
  const handleNextQuestion = () => {
    isListeningRef.current = false;
    recognitionRef.current?.abort();
    setIsListening(false);
    const updated = saveCurrentTranscript();
    persistAnswer(currentQ, updated);
    // Fire-and-forget Vision snapshot BEFORE moving question
    captureAndAnalyzeFace(currentQ);

    // Free user vừa xong câu baseline cuối — chặn ở đây, KHÔNG bao giờ tốn LLM/D-ID cho 2 câu sau
    if (!isPro && currentQ >= FREE_LIMIT - 1) {
      setShowUpgradeModal(true);
      return;
    }

    // Pro user vừa xong câu cuối đang biết (baseline) — sinh 2 câu cá nhân hóa từ câu trả lời thật
    if (personalizedPending && currentQ === QUESTIONS.length - 1) {
      triggerFollowUpGeneration(updated);
      return;
    }

    if (currentQ >= QUESTIONS.length - 1) {
      goToFeedback(updated);
      return;
    }
    setCurrentQ((prev) => prev + 1);
  };

  const handleEndSession = () => {
    const updated = saveCurrentTranscript();
    persistAnswer(currentQ, updated);
    captureAndAnalyzeFace(currentQ);
    goToFeedback(updated);
  };

  const hasTranscript = transcript.trim().length > 0;
  const wordCount     = transcript.trim().split(/\s+/).filter(Boolean).length;

  const hrName     = HR_NAMES[hrGender];
  const hrTitle    = HR_TITLES[hrGender];
  const hrVideoUrl = HR_IDLE_URLS[hrGender];

  /* ══ RENDER, Ready lobby ════════════════════════════════ */
  if (phase === "ready") {
    return (
      <MentorPageShell bottomPad="pb-16">
        <div className={`relative z-10 pb-8 pt-8 sm:pt-10 ${CUSTOMER_SHELL_GUTTER}`}>
          <div className={`${CUSTOMER_SHELL_MAX} mx-auto w-full max-w-3xl`}>
            <CustomerPageHeader
              className="mb-5 w-full"
              title={
                <>
                  <span className="font-extrabold text-[#630ed4]">Luyện phỏng vấn với AI</span>{" "}
                  <span className="font-extrabold text-[#1a1b23]">từ CV của bạn</span>
                </>
              }
              subtitle="Từ CV của bạn, ProInterview tạo buổi phỏng vấn thử với HR AI (~30 phút), phân tích hành vi và góp ý sau từng câu trả lời để bạn tự tin hơn trước buổi thật."
              subtitleClassName="mt-3 max-w-full text-sm font-medium leading-relaxed text-slate-600 sm:text-base"
            />

            <div className="w-full rounded-md border border-violet-200/80 bg-white px-4 py-5 shadow-sm sm:px-6 sm:py-6">
              <InterviewStepBar current={3} />
              <div className="mb-6">
                <h2 className="text-sm sm:text-base font-bold text-violet-950">Bước 3: Phỏng vấn</h2>
                <p className="mt-0.5 text-xs sm:text-sm text-violet-600">
                  Xác nhận HR và danh sách câu hỏi trước khi bắt đầu với {hrName}.
                </p>
              </div>

              <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-x-10">
                <div className="relative mx-auto w-[300px] shrink-0 lg:mx-0">
                  <div className="h-[420px] overflow-hidden rounded-2xl border-2 border-violet-200/80 shadow-[0_12px_32px_rgba(110,53,232,0.12)]">
                    <video src={hrVideoUrl} autoPlay loop muted playsInline className="h-full w-full object-cover" />
                  </div>
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-[#630ed4]/90 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#b5e636]" />
                    LIVE
                  </div>
                  <div className="absolute right-3 bottom-3 left-3 rounded-lg border border-white/10 bg-black/70 px-3 py-2 backdrop-blur-md">
                    <p className="text-sm font-semibold text-white">{hrName}</p>
                    <p className="text-xs text-white/65">{hrTitle}</p>
                  </div>
                </div>

                <div className="flex min-w-0 flex-col gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-500">Sẵn sàng</p>
                    <h3 className="mt-1 text-xl font-bold leading-tight text-violet-950 sm:text-2xl">
                      Phỏng vấn với <span className="text-[#630ed4]">{hrName}</span>
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-violet-600">
                      Buổi phỏng vấn gồm{" "}
                      <span className="font-semibold text-violet-900">{displayQuestionCount} câu hỏi</span>
                      {!isPro && !trialMode && <span className="text-violet-700"> · 3 câu miễn phí, 2 câu sau cần Pro</span>}.
                      AI sẽ phân tích giọng nói, ánh mắt và ngôn ngữ cơ thể.
                    </p>
                  </div>

                  <ul className="flex flex-col gap-2">
                    {Array.from({ length: displayQuestionCount }).map((_, i) => {
                      const q = QUESTIONS[i];
                      const isLocked  = !isPro && i >= FREE_LIMIT;
                      const isPending = isPro && i >= FREE_LIMIT && !q;
                      const dimmed = isLocked || isPending;
                      return (
                        <li key={i}
                          className={`flex min-h-[2.5rem] items-center gap-3 rounded-md border px-3 py-2 ${
                            dimmed ? "border-violet-100 bg-violet-50/40 opacity-65" : "border-violet-200/70 bg-violet-50/30"
                          }`}>
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            dimmed ? "bg-violet-100 text-violet-300" : "bg-violet-200/80 text-[#630ed4]"
                          }`}>
                            {isLocked ? <Lock className="h-3 w-3" /> : i + 1}
                          </span>
                          <p className={`min-w-0 flex-1 text-xs leading-snug ${dimmed ? "text-violet-400" : "text-violet-800"}`}>
                            {isLocked ? "Yêu cầu gói Pro" : isPending ? "Sẽ được tạo từ câu trả lời của bạn" : q}
                          </p>
                          {isLocked && (
                            <span className="shrink-0 rounded-full border border-violet-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#630ed4]">Pro</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  <div className="mt-1 flex flex-col gap-2.5 pt-1">
                    <button type="button" onClick={() => setPhase("question")}
                      className="w-full rounded-md bg-gradient-to-r from-[#c4ff47] to-[#d4ff00] py-3.5 text-sm font-bold text-violet-950 shadow-[0_8px_24px_rgba(196,255,71,0.22)] transition-all hover:brightness-105">
                      Bắt đầu phỏng vấn →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </MentorPageShell>
    );
  }

  if (!apiQuestions?.length) return null;

  if (!resolvedSessionId) {
    return (
      <MentorPageShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4 text-center">
          <AlertCircle className="h-12 w-12 text-violet-400" />
          <div>
            <h2 className="text-lg font-semibold text-violet-900 mb-2">Không thể tạo phiên phỏng vấn</h2>
            <p className="text-sm text-violet-600 max-w-sm">
              Đã xảy ra lỗi khi kết nối với máy chủ. Vui lòng quay lại và thử lại.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/interview")}
            className="rounded-md bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Quay lại thiết lập
          </button>
        </div>
      </MentorPageShell>
    );
  }

  /* ══ RENDER, Interview room ═════════════════════════════ */
  return (
    <MentorPageShell bottomPad="pb-0" fillHeight className="!min-h-0 !pb-0">
      <div className="relative flex h-svh max-h-svh flex-col overflow-hidden antialiased">

        {showUpgradeModal && (
          <UpgradeModal
            completedCount={FREE_LIMIT}
            totalCount={QUESTIONS.length}
            onUpgrade={() => navigate("/pricing")}
            onFinish={() => { setShowUpgradeModal(false); goToFeedback(allTranscripts); }}
          />
        )}

        {generatingFollowUp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-violet-950/40 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-sm rounded-md bg-white p-6 shadow-2xl sm:p-8">
              <MascotVideo className="mb-4 mx-auto h-28 aspect-[766/720] overflow-hidden rounded-md sm:h-36" />
              <p className="text-center text-sm font-semibold text-violet-800">
                AI đang phân tích câu trả lời của bạn để tạo câu hỏi nâng cao...
              </p>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-violet-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#630ed4] to-[#93f72b] transition-all duration-700 ease-out"
                  style={{ width: `${followUpProgress}%` }}
                />
              </div>
              <div className="mt-4 w-full rounded-md bg-violet-50 px-3 py-2.5 text-center text-xs text-violet-700">
                {TIPS[followUpTipIdx]}
              </div>
            </div>
          </div>
        )}

        {/* Top bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-violet-200/80 bg-white/85 px-4 py-2 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50 px-2.5 py-1">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#b5e636]" />
              <span className="text-xs font-semibold text-violet-800">REC</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50 px-2.5 py-1">
              <Clock className="h-3 w-3 text-violet-500" />
              <span className="text-xs tabular-nums text-violet-800">{formatTimer(timerSeconds)}</span>
            </div>
            {isListening && (
              <div className="flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50 px-2.5 py-1">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#b5e636]" />
                <span className="text-xs font-medium text-violet-800">Ghi âm</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full border-2 border-violet-300/80">
              <video src={hrVideoUrl} autoPlay loop muted playsInline className="h-full w-full object-cover" />
            </div>
            <span className="hidden text-sm font-medium text-violet-900 sm:block">{hrName}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              {QUESTIONS.map((_, i) => {
                const locked = !isPro && i >= FREE_LIMIT;
                return (
                  <div key={i} className={`h-1.5 w-7 rounded-full transition-all duration-500 ${
                    locked ? "bg-violet-200"
                    : i < currentQ ? "bg-[#b5e636]/55"
                    : i === currentQ ? "bg-[#b5e636]"
                    : "bg-violet-100"
                  }`} />
                );
              })}
            </div>
            <span className="text-xs font-medium text-violet-600">{currentQ + 1}/{QUESTIONS.length}</span>
          </div>
        </div>

        {/* Question banner */}
        <div className="shrink-0 border-b border-violet-100 bg-white/70 px-4 py-2">
          <div className="flex items-start gap-2.5 rounded-md border border-violet-200/80 bg-violet-50/50 px-3 py-2">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6E35E8] to-[#8B4DFF] text-xs font-bold text-white">
              {currentQ + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm leading-snug text-violet-950">{QUESTIONS[currentQ]}</p>
              {QUESTION_OBJECTS && (() => {
                const layer = QUESTION_OBJECTS[currentQ]?.layer;
                const layerMap = {
                  theory:   { label: "Lý thuyết",     color: "#630ed4", bg: "rgba(110,53,232,0.12)", border: "rgba(110,53,232,0.28)" },
                  project:  { label: "Dự án",          color: "#8B4DFF", bg: "rgba(139,77,255,0.12)", border: "rgba(139,77,255,0.28)" },
                  behavior: { label: "Hành vi · STAR", color: "#630ed4", bg: "rgba(110,53,232,0.1)",  border: "rgba(110,53,232,0.22)" },
                };
                const lm = layerMap[layer];
                if (!lm) return null;
                return (
                  <span className="mt-1.5 inline-block rounded-md px-2 py-0.5 text-xs font-semibold"
                    style={{ background: lm.bg, border: `1px solid ${lm.border}`, color: lm.color }}>
                    {lm.label}
                  </span>
                );
              })()}
            </div>
          </div>
        </div>

        {/* STAR guidance */}
        {QUESTION_OBJECTS && QUESTION_OBJECTS[currentQ]?.layer === "behavior" && (() => {
          const sg = QUESTION_OBJECTS[currentQ]?.starGuidance;
          const hasContent = sg && (sg.situation?.length || sg.task?.length || sg.action?.length || sg.result?.length);
          if (!hasContent) return null;
          return (
            <div className="shrink-0 border-b border-violet-100 bg-white/60 px-4 py-1.5">
              <div className="overflow-hidden rounded-md border border-violet-200/70 bg-violet-50/40">
                <button type="button"
                  onClick={() => setShowStarHints((p) => !p)}
                  className="flex w-full items-center justify-between px-4 py-2 text-left transition-colors hover:bg-violet-100/50">
                  <div className="flex items-center gap-2">
                    <Star className="h-3.5 w-3.5 text-[#630ed4]" />
                    <span className="text-xs font-semibold text-violet-950">Gợi ý STAR</span>
                    <span className="text-xs text-violet-600/70">— nhấn để {showStarHints ? "ẩn" : "xem"}</span>
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 text-violet-500/60 transition-transform duration-200 ${showStarHints ? "rotate-180" : ""}`} />
                </button>
                {showStarHints && (
                  <div className="grid max-h-24 grid-cols-2 gap-2 overflow-y-auto px-4 pb-2 sm:grid-cols-4">
                    {[
                      { key: "situation", label: "S · Tình huống", color: "#630ed4", border: "border-violet-200" },
                      { key: "task",      label: "T · Nhiệm vụ",   color: "#8B4DFF", border: "border-violet-200" },
                      { key: "action",    label: "A · Hành động",  color: "#8B4DFF", border: "border-violet-200" },
                      { key: "result",    label: "R · Kết quả",    color: "#630ed4", border: "border-violet-300" },
                    ].map(({ key, label, color, border }) => {
                      const hints = sg[key] ?? [];
                      if (!hints.length) return null;
                      return (
                        <div key={key} className={`rounded border bg-white p-2.5 ${border}`}>
                          <p className="mb-1 text-xs font-semibold" style={{ color }}>{label}</p>
                          {hints.slice(0, 2).map((h, i) => (
                            <p key={i} className="text-xs leading-relaxed text-violet-700">· {h}</p>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Main video panels */}
        <div className="grid min-h-0 flex-1 gap-2 px-3 pb-2 max-lg:grid-rows-[minmax(0,1fr)_minmax(0,1fr)_4.5rem] lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)_4.5rem]">
          {/* HR panel */}
          <div className={`relative min-h-0 h-full overflow-hidden rounded-xl border-2 bg-[#0a0a18] ${
            (isDIDActive || ttsAvailable) ? "border-violet-300/80 shadow-[0_8px_32px_rgba(110,53,232,0.12)]" : "border-violet-200/70"
          }`}>

            {/* ── Nhánh 0: D-ID Express pre-generated video (ưu tiên cao nhất) ── */}
            {currentVideoUrl && (
              <HRVideoPanel
                questionVideoUrl={currentVideoUrl}
                hrPhase={hrPhase}
                onAskingDone={startListening}
                muted={false}
                isListening={isListening}
              />
            )}
            {/* ── Nhánh 1: D-ID WebRTC — portrait full panel + video overlay khi stream sẵn sàng ── */}
            {!currentVideoUrl && isDIDActive && (
              <>
                {/* Portrait fills the entire panel — visible while D-ID connects or when idle */}
                <img
                  src={DID_AVATAR_URLS[hrGender]}
                  alt={HR_NAMES[hrGender]}
                  style={{
                    position: "absolute", inset: 0,
                    width: "100%", height: "100%",
                    objectFit: "cover", objectPosition: "center top",
                  }}
                />
                {/* D-ID WebRTC video — overlays portrait when stream is actually playing */}
                <video
                  ref={(el) => attachVideo(el)}
                  autoPlay
                  playsInline
                  onPlay={() => setDidVideoReady(true)}
                  onEnded={() => setDidVideoReady(false)}
                  onEmptied={() => setDidVideoReady(false)}
                  style={{
                    position: "absolute", inset: 0,
                    width: "100%", height: "100%",
                    objectFit: "cover",
                    opacity: didVideoReady ? 1 : 0,
                    transition: "opacity 0.5s ease",
                  }}
                />
                {/* Subtle connecting indicator (no full overlay — portrait stays visible) */}
                {didStatus === "connecting" && (
                  <div style={{
                    position: "absolute", bottom: 48, left: "50%", transform: "translateX(-50%)",
                    background: "rgba(13,8,32,0.75)", backdropFilter: "blur(8px)",
                    borderRadius: 20, padding: "4px 14px",
                  }}>
                    <span style={{ color: "rgba(180,155,255,0.9)", fontSize: 12, fontWeight: 600 }}>Kết nối...</span>
                  </div>
                )}
                {/* Subtle inset glow when speaking — replaces the old ring/bung effects */}
                {didStatus === "speaking" && (
                  <div className="absolute inset-0 pointer-events-none rounded-xl"
                    style={{ boxShadow: "inset 0 0 60px rgba(139,77,255,0.35)" }} />
                )}
                {hrPhase === "asking" && (didStatus === "speaking" || didStatus === "connected") && (
                  <div className="absolute top-3 right-3 z-10">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ background: "rgba(110,53,232,0.85)", backdropFilter: "blur(8px)" }}>
                      <div className="w-1.5 h-1.5 rounded-full bg-[#b5e636] animate-pulse" />
                      <span className="text-white">HR đang hỏi...</span>
                    </div>
                  </div>
                )}
                {hrPhase === "listening" && isListening && (
                  <div className="absolute top-3 right-3 z-10">
                    <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                      style={{ background: "rgba(110,53,232,0.92)", backdropFilter: "blur(8px)" }}>
                      <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#b5e636]" />
                      Đang ghi âm câu trả lời...
                    </div>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
                  style={{ background: "linear-gradient(to top, rgba(10,10,24,0.75) 0%, transparent 100%)" }} />
              </>
            )}

            {/* ── Nhánh 2: TTS fallback — portrait full panel, subtle glow khi nói ── */}

            {!currentVideoUrl && !isDIDActive && ttsAvailable && (
              <>
                {/* Portrait fills the entire panel */}
                <img
                  src={DID_AVATAR_URLS[hrGender]}
                  alt={HR_NAMES[hrGender]}
                  style={{
                    position: "absolute", inset: 0,
                    width: "100%", height: "100%",
                    objectFit: "cover", objectPosition: "center top",
                  }}
                />
                {/* Inset glow when TTS is speaking — no rings, no expanding effects */}
                {ttsSpeaking && (
                  <div className="absolute inset-0 pointer-events-none rounded-xl"
                    style={{ boxShadow: "inset 0 0 60px rgba(139,77,255,0.35)" }} />
                )}
                {hrPhase === "asking" && ttsSpeaking && (
                  <div className="absolute top-3 right-3 z-10">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ background: "rgba(110,53,232,0.85)", backdropFilter: "blur(8px)" }}>
                      <div className="w-1.5 h-1.5 rounded-full bg-[#b5e636] animate-pulse" />
                      <span className="text-white">HR đang hỏi...</span>
                    </div>
                  </div>
                )}
                {hrPhase === "listening" && isListening && (
                  <div className="absolute top-3 right-3 z-10">
                    <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                      style={{ background: "rgba(110,53,232,0.92)", backdropFilter: "blur(8px)" }}>
                      <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#b5e636]" />
                      Đang ghi âm câu trả lời...
                    </div>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
                  style={{ background: "linear-gradient(to top, rgba(10,10,24,0.75) 0%, transparent 100%)" }} />
              </>
            )}

            {/* ── Nhánh 3: Thuần video fallback (browser không hỗ trợ TTS) ── */}
            {!currentVideoUrl && !isDIDActive && !ttsAvailable && (
              <HRVideoPanel
                questionVideoUrl={HR_QUESTION_URLS[hrGender][Math.min(currentQ, HR_QUESTION_URLS[hrGender].length - 1)]}
                hrPhase={hrPhase}
                onAskingDone={startListening}
                muted={false}
                isListening={isListening}
              />
            )}
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
              style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
              <span className="text-white text-xs font-medium">{hrName}</span>
              <span className="text-white/40 text-xs">· HR AI</span>
            </div>
          </div>

          {/* User camera panel, UserCameraTile exposes video to cameraVideoRef */}
          <div className={`relative min-h-0 h-full overflow-hidden rounded-xl border-2 ${
            isListening ? "border-violet-400 shadow-[0_0_20px_rgba(110,53,232,0.15)]" : "border-violet-200/80 shadow-[0_8px_24px_rgba(110,53,232,0.1)]"
          }`}>
            <UserCameraTile ref={cameraVideoRef} isRecording={isListening} onAudioTrack={handleAudioTrack} />
            {isListening && (
              <div className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-inset ring-violet-400/50" />
            )}
          </div>

          {/* Transcript panel */}
          <div className={`flex h-[4.5rem] max-h-[4.5rem] shrink-0 flex-col overflow-hidden rounded-md border bg-white transition-all lg:col-span-2 ${
            isListening ? "border-violet-300" : hasTranscript ? "border-violet-300/80" : "border-violet-200/80"
          }`}>
            <div className="flex shrink-0 items-center justify-between border-b border-violet-100 bg-violet-50/60 px-2.5 py-1.5">
              <div className="flex items-center gap-2">
                {isListening ? (
                  <>
                    <div className="h-2 w-2 animate-pulse rounded-full bg-[#b5e636]" />
                    <span className="text-xs font-semibold text-violet-800">Đang ghi âm...</span>
                    <Waveform active={true} color="#9B6DFF" />
                  </>
                ) : hasTranscript ? (
                  <>
                    <CheckCircle className="h-3.5 w-3.5 text-violet-600" />
                    <span className="text-xs font-semibold text-violet-900">Đã ghi nhận</span>
                  </>
                ) : (
                  <>
                    <ChatCircle className="h-3.5 w-3.5 text-violet-400" />
                    <span className="text-xs text-violet-600">Câu trả lời của bạn</span>
                  </>
                )}
              </div>
              {(hasTranscript || isListening) && (
                <span className="text-xs tabular-nums text-violet-500">{wordCount} từ</span>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-1.5">
              {!sttSupported ? (
                <div className="flex h-full flex-col gap-2">
                  <p className="text-xs text-violet-700">
                    Trình duyệt không nhận diện được giọng nói, hãy gõ câu trả lời bên dưới.
                  </p>
                  <textarea
                    value={transcript}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTranscript(val);
                      transcriptRef.current = val;
                      setAllTranscripts((prev) => {
                        const next = [...prev];
                        next[currentQ] = val;
                        return next;
                      });
                    }}
                    placeholder="Gõ câu trả lời của bạn vào đây..."
                    rows={2}
                    className="w-full flex-1 resize-none rounded-xl border border-violet-200 bg-white p-3 text-sm text-black placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
                  />
                </div>
              ) : !hasTranscript && !interimTranscript && !isListening ? null : (
                <div>
                  {hasTranscript && <p className="line-clamp-2 text-xs leading-snug text-black">{transcript}</p>}
                  {interimTranscript && (
                    <p className="line-clamp-2 text-xs leading-snug text-black italic">
                      {interimTranscript}
                      {isListening && <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-[#b5e636] align-middle" />}
                    </p>
                  )}
                  {isListening && !hasTranscript && !interimTranscript && (
                    <span className="inline-block h-5 w-0.5 animate-pulse bg-[#b5e636]" />
                  )}
                </div>
              )}
              {sttError && (
                <div className="mt-2 flex items-start gap-1.5 rounded-xl border border-violet-200 bg-violet-50 p-2.5">
                  <WarningCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600" />
                  <p className="text-xs text-violet-800">{sttError}</p>
                </div>
              )}
            </div>

            {hasTranscript && !isListening && sttSupported && (
              <div className="hidden shrink-0 border-t border-violet-100 px-2 py-1 sm:block">
                <button type="button"
                  onClick={() => {
                    isListeningRef.current = false;
                    recognitionRef.current?.abort();
                    setTranscript("");
                    setInterimTranscript("");
                    transcriptRef.current = "";
                    setTimeout(() => {
                      isListeningRef.current = true;
                      setIsListening(true);
                      try { recognitionRef.current?.start(); } catch (_) {}
                    }, 150);
                  }}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-violet-700 transition-all hover:bg-violet-50">
                  <Microphone className="w-3.5 h-3.5" />
                  Ghi lại
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Control bar */}
        <div className="flex shrink-0 items-center justify-center gap-3 border-t border-violet-200/80 bg-white/90 px-4 py-2 backdrop-blur-sm">
          <button type="button" onClick={handleEndSession} title="Kết thúc phỏng vấn"
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-violet-200 bg-violet-50 transition-all hover:bg-violet-100">
            <PhoneDisconnect className="h-5 w-5 text-violet-700" />
          </button>

          <div className="relative">
            {isListening && <div className="absolute inset-0 rounded-full bg-[#b5e636]/32 animate-ping" />}
            <button onClick={toggleListening} disabled={!sttSupported}
              title={isListening ? "Dừng ghi âm" : "Bắt đầu trả lời"}
              className="relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: "linear-gradient(135deg,#6E35E8,#8B4DFF)",
                boxShadow: isListening ? "0 0 24px rgba(110,53,232,0.55)" : "0 0 24px rgba(110,53,232,0.5)",
              }}>
              {isListening
                ? <Microphone className="h-7 w-7 text-white" />
                : <MicrophoneSlash className="h-7 w-7 text-white" />}
            </button>
          </div>

          {currentQ < QUESTIONS.length - 1 || personalizedPending ? (
            <button type="button" onClick={handleNextQuestion}
              className="flex items-center gap-2 rounded-md bg-gradient-to-r from-[#c4ff47] to-[#d4ff00] px-4 py-2 text-sm font-bold text-violet-950 shadow-[0_6px_20px_rgba(196,255,71,0.2)] transition-all hover:brightness-105">
              {!isPro && currentQ === FREE_LIMIT - 1 ? <><Lock className="h-4 w-4" /> Câu tiếp theo</> : <>Câu tiếp theo <CaretRight className="h-4 w-4" /></>}
            </button>
          ) : (
            <button type="button" onClick={handleNextQuestion}
              className="flex items-center gap-2 rounded-md bg-gradient-to-r from-[#c4ff47] to-[#d4ff00] px-4 py-2 text-sm font-bold text-violet-950 shadow-[0_6px_20px_rgba(196,255,71,0.2)] transition-all hover:brightness-105">
              Hoàn thành <CheckCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </MentorPageShell>
  );
}

import React, {
  useState,
  useEffect,
  useRef,
} from "react";
import { useNavigate, useLocation } from "react-router";
import {
  Mic as Microphone,
  MicOff as MicrophoneSlash,
  PhoneOff as PhoneDisconnect,
  Clock,
  ChevronRight as CaretRight,
  Lock,
  Zap as Lightning,
  CheckCircle,
  AlertCircle as WarningCircle,
  User,
  MessageCircle as ChatCircle,
  Star,
} from "lucide-react";
import { MOCK_INTERVIEW_QUESTIONS } from "../../data/mockData";
import { getPlans } from "../../utils/auth";

/* ── Session storage key ─────────────────────────────────── */
const TRANSCRIPT_KEY = "prointerview_transcripts";

/* ── Free limit for non-Pro users ───────────────────────── */
const FREE_LIMIT = 3;

/* ── HR AI Video URLs (Cloudinary) ──────────────────────── */
const HR_IDLE_URLS = {
  male: "https://res.cloudinary.com/dee4bvivu/video/upload/v1774336646/Male_jioqsx.mp4",
  female:
    "https://res.cloudinary.com/dee4bvivu/video/upload/v1774336640/Female_delxmy.mp4",
};

/* ── Per-question HR videos (5 total, Q4/Q5 reuse existing) */
const HR_QUESTION_URLS = {
  female: [
    "https://res.cloudinary.com/dee4bvivu/video/upload/v1774340828/FQ1vid_rdw1xo.mp4",
    "https://res.cloudinary.com/dee4bvivu/video/upload/v1774340833/FQ2vid_vmp7ae.mp4",
    "https://res.cloudinary.com/dee4bvivu/video/upload/v1774340829/FQ3vid_glpon5.mp4",
    // Câu 4: video mới
    "https://res.cloudinary.com/dee4bvivu/video/upload/v1775044177/T%E1%BA%A1o_Video_T%C6%B0%C6%A1ng_T%C3%A1c_Theo_Y%C3%AAu_C%E1%BA%A7u_ijplpc.mp4",
    "https://res.cloudinary.com/dee4bvivu/video/upload/v1774340829/FQ3vid_glpon5.mp4",
  ],
  male: [
    "https://res.cloudinary.com/dee4bvivu/video/upload/v1774340828/MQ1vid_hngp8o.mp4",
    "https://res.cloudinary.com/dee4bvivu/video/upload/v1774340832/MQ2vid_xaioj6.mp4",
    "https://res.cloudinary.com/dee4bvivu/video/upload/v1774340829/MQ3vid_h7t02k.mp4",
    // Câu 4 & 5: dùng lại video có sẵn
    "https://res.cloudinary.com/dee4bvivu/video/upload/v1774340832/MQ2vid_xaioj6.mp4",
    "https://res.cloudinary.com/dee4bvivu/video/upload/v1774340829/MQ3vid_h7t02k.mp4",
  ],
};

const HR_NAMES = {
  male: "David",
  female: "Sarah",
};

const HR_TITLES = {
  male: "HR AI Nam · ProInterview",
  female: "HR AI Nữ · ProInterview",
};

/* ── Tất cả 5 câu hỏi ───────────────────────────────────── */
const QUESTIONS = MOCK_INTERVIEW_QUESTIONS;

/* ── Helpers ─────────────────────────────────────────────── */
function formatTimer(s) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/* ── Waveform bars ───────────────────────────────────────── */
function Waveform({
  active,
  color = "#9B6DFF",
}) {
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
            animation: active
              ? `pulse ${0.5 + (i % 3) * 0.2}s ease-in-out infinite alternate`
              : "none",
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
function HRVideoPanel({
  questionVideoUrl,
  hrPhase,
  onAskingDone,
  isListening,
}) {
  const videoRef = useRef(null);
  const [videoState, setVideoState] = useState("loading");

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    setVideoState("loading");
    const onCanPlay = () => {
      setVideoState("playing");
      v.play().catch(() => {});
    };
    const onError = () => setVideoState("error");
    v.addEventListener("canplay", onCanPlay, { once: true });
    v.addEventListener("error", onError, { once: true });
    v.load();
    return () => {
      v.removeEventListener("canplay", onCanPlay);
      v.removeEventListener("error", onError);
      v.pause();
    };
  }, [questionVideoUrl]);

  const handleEnded = () => {
    setVideoState("done");
    onAskingDone();
  };

  const isVisible = videoState === "playing" || videoState === "done";

  return (
    <div className="relative w-full h-full bg-[#0a0a18]">
      <video
        ref={videoRef}
        src={questionVideoUrl}
        playsInline
        onEnded={handleEnded}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ display: isVisible ? "block" : "none" }}
      />
      {(videoState === "loading" || videoState === "error") && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-4"
          style={{ background: "linear-gradient(160deg,#120d2b 0%,#1a1040 100%)" }}
        >
          {videoState === "error" ? (
            <>
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: "rgba(110, 53, 232,0.2)", border: "2px solid rgba(110, 53, 232,0.3)" }}
              >
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
      {videoState === "done" && (
        <div className="absolute inset-0 pointer-events-none" style={{ background: "rgba(0,0,0,0.35)" }}>
          <div className="absolute inset-0 flex flex-col items-end justify-start p-4 gap-2">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{
                background: isListening ? "rgba(239,68,68,0.9)" : "rgba(180,240,0,0.15)",
                border: isListening ? "none" : "1px solid rgba(180,240,0,0.4)",
                backdropFilter: "blur(8px)",
              }}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${isListening ? "bg-white animate-pulse" : "bg-[#c4ff47]"}`} />
              <span className={isListening ? "text-white" : "text-[#B4F000]"}>
                {isListening ? "Đang ghi âm câu trả lời..." : "Lượt của bạn — Nhấn 🎤 để trả lời"}
              </span>
            </div>
          </div>
        </div>
      )}
      {hrPhase === "asking" && videoState === "playing" && (
        <div className="absolute top-3 right-3 z-10">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ background: "rgba(110, 53, 232,0.85)", backdropFilter: "blur(8px)" }}
          >
            <div className="w-1.5 h-1.5 bg-[#c4ff47] rounded-full animate-pulse" />
            <span className="text-white">HR đang hỏi...</span>
          </div>
        </div>
      )}
      <div
        className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
        style={{ background: "linear-gradient(to top, rgba(10,10,24,0.85) 0%, transparent 100%)" }}
      />
    </div>
  );
}

/* ── User camera tile ────────────────────────────────────── */
function UserCameraTile({ isRecording }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [camState, setCamState] = useState("loading");
  const [camError, setCamError] = useState("Camera không khả dụng");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        setCamState("active");
      } catch (err) {
        if (cancelled) return;
        const msg =
          err?.name === "NotAllowedError" ? "Bạn chưa cấp quyền camera"
          : err?.name === "NotFoundError" ? "Không tìm thấy camera"
          : "Camera không khả dụng";
        setCamError(msg);
        setCamState("error");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (camState !== "active") return;
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    video.srcObject = streamRef.current;
    video.play().catch(() => {});
  }, [camState]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden" style={{ background: "#0f0f1a" }}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover"
        style={{ transform: "scaleX(-1)", display: camState === "active" ? "block" : "none" }}
      />
      {camState !== "active" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: "rgba(110, 53, 232,0.2)", border: "2px solid rgba(110, 53, 232,0.3)" }}
          >
            <User className="w-7 h-7 text-[#9B6DFF]" />
          </div>
          <p className="text-white/40 text-xs text-center px-3">
            {camState === "loading" ? "Đang kết nối camera..." : camError}
          </p>
        </div>
      )}
      <div
        className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg backdrop-blur-sm"
        style={{ background: "rgba(0,0,0,0.6)" }}
      >
        <span className="text-white text-xs font-medium">Bạn</span>
        {isRecording && <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />}
      </div>
    </div>
  );
}

/* ── Upgrade Modal Overlay ───────────────────────────────── */
function UpgradeModal({
  completedCount,
  onUpgrade,
  onFinish,
}) {
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(8,6,20,0.93)", backdropFilter: "blur(16px)" }}
    >
      {/* Glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(110, 53, 232,0.25) 0%, transparent 70%)" }}
      />

      <div
        className="relative z-10 w-full max-w-md rounded-3xl p-8 text-center"
        style={{
          background: "linear-gradient(160deg, #120d2b 0%, #1a1040 100%)",
          border: "1.5px solid rgba(139, 77, 255,0.3)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 60px rgba(110, 53, 232,0.2)",
        }}
      >
        {/* Icon */}
        <div className="flex justify-center mb-5">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(110, 53, 232,0.2), rgba(180,240,0,0.1))",
              border: "2px solid rgba(139, 77, 255,0.4)",
            }}
          >
            <Lock className="w-9 h-9 text-[#8B4DFF]" />
          </div>
        </div>

        {/* Stars */}
        <div className="flex justify-center gap-1 mb-5">
          {[...Array(completedCount)].map((_, i) => (
            <Star key={i} className="w-5 h-5 text-[#FFD600]" />
          ))}
          {[...Array(QUESTIONS.length - completedCount)].map((_, i) => (
            <Star key={i} className="w-5 h-5 text-white/15" />
          ))}
        </div>

        {/* Text */}
        <h2 className="text-white text-xl font-bold mb-2 leading-tight">
          Bạn đã hoàn thành {completedCount} câu hỏi miễn phí!
        </h2>
        <p className="text-white/50 text-sm leading-relaxed mb-6">
          Còn{" "}
          <span className="text-[#8B4DFF] font-semibold">
            {QUESTIONS.length - completedCount} câu hỏi
          </span>{" "}
          nữa trong buổi phỏng vấn. Nâng cấp gói{" "}
          <span className="text-[#B4F000] font-semibold">Pro</span> để trả lời
          đầy đủ và nhận phân tích toàn diện hơn.
        </p>

        {/* Benefits */}
        <div
          className="rounded-2xl p-4 mb-6 text-left"
          style={{ background: "rgba(110, 53, 232,0.1)", border: "1px solid rgba(139, 77, 255,0.2)" }}
        >
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-3">
            Gói Pro bao gồm
          </p>
          {[
            "Phỏng vấn đầy đủ 5 câu hỏi mỗi buổi",
            "Phân tích hành vi & ngôn ngữ cơ thể nâng cao",
            "Phản hồi chi tiết từng câu với điểm số",
            "Không giới hạn số buổi phỏng vấn AI",
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(180,240,0,0.15)" }}>
                <div className="w-1.5 h-1.5 rounded-full bg-[#c4ff47]" />
              </div>
              <p className="text-white/70 text-xs">{item}</p>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <button
          onClick={onUpgrade}
          className="w-full py-3.5 rounded-2xl font-bold text-sm mb-3 transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, #6E35E8, #8B4DFF)",
            color: "#fff",
            boxShadow: "0 8px 32px rgba(110, 53, 232,0.45)",
          }}
        >
          <Lightning className="inline w-4 h-4 mr-2 mb-0.5" />
          Nâng cấp Pro — tiếp tục phỏng vấn
        </button>

        <button
          onClick={onFinish}
          className="w-full py-3 rounded-2xl text-sm transition-all hover:bg-white/8"
          style={{ color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
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
    (location.state?.hrGender) ||
    (sessionStorage.getItem("prointerview_hr_gender")) ||
    "male";
  const hrName = HR_NAMES[hrGender];
  const hrTitle = HR_TITLES[hrGender];
  const hrVideoUrl = HR_IDLE_URLS[hrGender];

  const [phase, setPhase] = useState("ready");
  const [currentQ, setCurrentQ] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [sttSupported, setSttSupported] = useState(true);
  const [sttError, setSttError] = useState("");
  const [allTranscripts, setAllTranscripts] = useState(
    Array(QUESTIONS.length).fill("")
  );
  const [hrPhase, setHrPhase] = useState("asking");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const transcriptRef = useRef("");
  const timerRef = useRef(null);
  const isNavigatingRef = useRef(false);

  /* ── Timer ───────────────────────────────────────────────── */
  useEffect(() => {
    if (phase !== "question") return;
    timerRef.current = setInterval(() => setTimerSeconds((p) => p + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  /* ── Reset on new question ───────────────────────────────── */
  useEffect(() => {
    setHrPhase("asking");
    setTranscript("");
    setInterimTranscript("");
    transcriptRef.current = "";
  }, [currentQ]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    return () => {
      isNavigatingRef.current = true;
      isListeningRef.current = false;
      recognitionRef.current?.abort();
      clearInterval(timerRef.current);
    };
  }, []);

  /* ── STT ─────────────────────────────────────────────────── */
  useEffect(() => {
    const SR = (window ).SpeechRecognition || (window ).webkitSpeechRecognition;
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
      if (finalText)
        setTranscript((prev) => {
          const j = prev ? prev + " " + finalText.trim() : finalText.trim();
          transcriptRef.current = j;
          return j;
        });
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

  /* ── Toggle mic ──────────────────────────────────────────── */
  const toggleListening = () => {
    if (isListeningRef.current) {
      isListeningRef.current = false;
      setIsListening(false);
      recognitionRef.current?.stop();
    } else {
      setSttError("");
      isListeningRef.current = true;
      setIsListening(true);
      try { recognitionRef.current?.start(); } catch (_) {}
    }
  };

  /* ── Save + navigate ─────────────────────────────────────── */
  const saveCurrentTranscript = () => {
    const full = (
      transcriptRef.current + (interimTranscript ? " " + interimTranscript : "")
    ).trim();
    const updated = [...allTranscripts];
    updated[currentQ] = full;
    setAllTranscripts(updated);
    return updated;
  };

  const goToFeedback = (transcripts) => {
    isNavigatingRef.current = true;
    isListeningRef.current = false;
    recognitionRef.current?.abort();
    clearInterval(timerRef.current);
    sessionStorage.setItem(TRANSCRIPT_KEY, JSON.stringify(transcripts));
    navigate("/interview/feedback");
  };

  const handleNextQuestion = () => {
    isListeningRef.current = false;
    recognitionRef.current?.abort();
    setIsListening(false);
    const updated = saveCurrentTranscript();

    if (currentQ >= QUESTIONS.length - 1) {
      goToFeedback(updated);
      return;
    }

    // Kiểm tra giới hạn miễn phí cho người dùng chưa nâng cấp
    if (!isPro && currentQ >= FREE_LIMIT - 1) {
      setShowUpgradeModal(true);
      return;
    }

    setCurrentQ((prev) => prev + 1);
  };

  const handleEndSession = () => {
    const updated = saveCurrentTranscript();
    goToFeedback(updated);
  };

  const hasTranscript = transcript.trim().length > 0;
  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;

  /* ══ RENDER — Ready lobby ══════════════════════════════════ */
  if (phase === "ready") {
    return (
      <div
        className="pi-page-dashboard-bg relative flex flex-col items-center justify-center overflow-hidden"
        style={{ height: "calc(100vh - 56px)" }}
      >
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(110, 53, 232,0.12) 0%, transparent 70%)" }}
        />

        <div className="relative z-10 flex flex-col lg:flex-row items-center gap-10 max-w-4xl w-full px-6 overflow-y-auto max-h-full py-6">
          {/* HR Video Preview */}
          <div className="relative flex-shrink-0">
            <div
              className="rounded-3xl overflow-hidden"
              style={{
                width: "260px",
                height: "350px",
                border: "2px solid rgba(139, 77, 255,0.3)",
                boxShadow: "0 0 60px rgba(110, 53, 232,0.3), 0 20px 60px rgba(0,0,0,0.5)",
              }}
            >
              <video src={hrVideoUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
            </div>
            <div
              className="absolute top-4 left-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ background: "rgba(239,68,68,0.9)", backdropFilter: "blur(8px)" }}
            >
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              <span className="text-white">LIVE</span>
            </div>
            <div
              className="absolute bottom-4 left-4 right-4 px-3 py-2 rounded-xl"
              style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <p className="text-white text-sm font-semibold">{hrName}</p>
              <p className="text-white/50 text-xs">{hrTitle}</p>
            </div>
          </div>

          {/* Info */}
          <div className="flex flex-col items-start gap-5 text-left max-w-sm w-full">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: "rgba(110, 53, 232,0.15)", border: "1px solid rgba(139, 77, 255,0.3)", color: "#c4b5fd" }}
            >
              <div className="w-2 h-2 rounded-full bg-[#c4ff47] animate-pulse" />
              AI Interview đã sẵn sàng
            </div>

            <div>
              <h2 className="text-white text-2xl font-bold mb-2 leading-tight">
                Phỏng vấn với <span style={{ color: "#B4F000" }}>{hrName}</span>
              </h2>
              <p className="text-white/50 text-sm leading-relaxed">
                Buổi phỏng vấn gồm{" "}
                <span className="text-white/80 font-semibold">{QUESTIONS.length} câu hỏi</span>.
                {!isPro && (
                  <span className="text-[#FFD600]">
                    {" "}3 câu hỏi đầu miễn phí, 2 câu còn lại yêu cầu gói Pro.
                  </span>
                )}
              </p>
            </div>

            {/* Question preview pills */}
            <div className="flex flex-col gap-2 w-full">
              {QUESTIONS.map((q, i) => {
                const isLocked = !isPro && i >= FREE_LIMIT;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{
                      background: isLocked ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)",
                      border: isLocked ? "1px solid rgba(255,255,255,0.04)" : "1px solid rgba(255,255,255,0.08)",
                      opacity: isLocked ? 0.6 : 1,
                    }}
                  >
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={
                        isLocked
                          ? { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.25)" }
                          : { background: "rgba(110, 53, 232,0.3)", color: "#c4b5fd" }
                      }
                    >
                      {isLocked ? <Lock className="w-2.5 h-2.5" /> : i + 1}
                    </span>
                    <p className="text-xs line-clamp-1" style={{ color: isLocked ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.6)" }}>
                      {isLocked ? "Yêu cầu gói Pro" : q}
                    </p>
                    {isLocked && (
                      <span
                        className="ml-auto text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: "rgba(139, 77, 255,0.15)", color: "#8B4DFF", border: "1px solid rgba(139, 77, 255,0.2)" }}
                      >
                        Pro
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Start CTA */}
            <button
              onClick={() => setPhase("question")}
              className="w-full py-3.5 rounded-2xl font-bold text-base transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #6E35E8, #8B4DFF)",
                color: "#fff",
                boxShadow: "0 8px 32px rgba(110, 53, 232,0.5)",
              }}
            >
              Bắt đầu phỏng vấn →
            </button>

            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-full text-center text-sm text-white/35 transition-colors hover:text-white/60"
            >
              ← Quay lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ══ RENDER — Main interview room ═════════════════════════ */
  return (
    <div
      className="pi-page-dashboard-bg relative flex flex-col overflow-hidden"
      style={{ height: "calc(100vh - 56px)" }}
    >
      {/* ── Upgrade modal overlay (non-Pro, after FREE_LIMIT) ── */}
      {showUpgradeModal && (
        <UpgradeModal
          completedCount={FREE_LIMIT}
          onUpgrade={() => navigate("/pricing")}
          onFinish={() => {
            setShowUpgradeModal(false);
            goToFeedback(allTranscripts);
          }}
        />
      )}

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-5 py-2.5 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Left: REC + Timer */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}
          >
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-300 text-xs font-semibold">REC</span>
          </div>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <Clock className="w-3 h-3 text-white/50" />
            <span className="text-white/70 text-xs tabular-nums">{formatTimer(timerSeconds)}</span>
          </div>
          {isListening && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}
            >
              <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
              <span className="text-red-300 text-xs font-medium">Ghi âm</span>
            </div>
          )}
        </div>

        {/* Center: HR name */}
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0"
            style={{ border: "1.5px solid rgba(139, 77, 255,0.5)" }}
          >
            <video src={hrVideoUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
          </div>
          <span className="text-white/70 text-sm font-medium hidden sm:block">{hrName}</span>
        </div>

        {/* Right: Progress */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {QUESTIONS.map((_, i) => {
              const isLockedDot = !isPro && i >= FREE_LIMIT;
              return (
                <div
                  key={i}
                  className="h-1.5 w-7 rounded-full transition-all duration-500"
                  style={{
                    background:
                      isLockedDot
                        ? "rgba(139, 77, 255,0.25)"
                        : i < currentQ
                        ? "#6E35E8"
                        : i === currentQ
                        ? "#B4F000"
                        : "rgba(255,255,255,0.1)",
                  }}
                />
              );
            })}
          </div>
          <span className="text-white/50 text-xs">
            {currentQ + 1}/{QUESTIONS.length}
          </span>
        </div>
      </div>

      {/* ── Question banner ──────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-5 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div
          className="flex items-start gap-3 rounded-xl px-4 py-3"
          style={{ background: "rgba(110, 53, 232,0.12)", border: "1px solid rgba(139, 77, 255,0.25)" }}
        >
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
            style={{ background: "linear-gradient(135deg, #6E35E8, #8B4DFF)", color: "#fff" }}
          >
            {currentQ + 1}
          </span>
          <p className="text-white/90 text-sm leading-relaxed">{QUESTIONS[currentQ]}</p>
        </div>
      </div>

      {/* ── Meeting panels ───────────────────────────────────── */}
      <div className="flex-1 flex gap-3 p-3 min-h-0">
        {/* AI Panel */}
        <div
          className="flex-[3] relative rounded-2xl overflow-hidden"
          style={{ border: "1.5px solid rgba(255,255,255,0.08)" }}
        >
          <HRVideoPanel
            questionVideoUrl={HR_QUESTION_URLS[hrGender][currentQ]}
            hrPhase={hrPhase}
            onAskingDone={() => {
              setHrPhase("listening");
              isListeningRef.current = true;
              setIsListening(true);
              try { recognitionRef.current?.start(); } catch (_) {}
            }}
            isListening={isListening}
          />
          <div
            className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
          >
            <span className="text-white text-xs font-medium">{hrName}</span>
            <span className="text-white/40 text-xs">· HR AI</span>
          </div>
        </div>

        {/* Right column */}
        <div className="flex-[2] flex flex-col gap-3 min-h-0">
          {/* User camera */}
          <div
            className="flex-[2] min-h-0 rounded-2xl overflow-hidden relative"
            style={{
              border: `1.5px solid ${isListening ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.08)"}`,
              transition: "border-color 0.3s",
              boxShadow: isListening ? "0 0 24px rgba(239,68,68,0.15)" : "none",
            }}
          >
            <UserCameraTile isRecording={isListening} />
            {isListening && (
              <div className="absolute inset-0 rounded-2xl border-2 border-red-400/40 animate-pulse pointer-events-none" />
            )}
          </div>

          {/* Transcript panel */}
          <div
            className="flex-[3] min-h-0 rounded-2xl flex flex-col overflow-hidden"
            style={{
              background: isListening ? "rgba(239,68,68,0.05)" : hasTranscript ? "rgba(16,185,129,0.05)" : "rgba(255,255,255,0.03)",
              border: isListening ? "1.5px solid rgba(239,68,68,0.2)" : hasTranscript ? "1.5px solid rgba(16,185,129,0.15)" : "1px solid rgba(255,255,255,0.07)",
              transition: "all 0.3s ease",
            }}
          >
            <div
              className="px-3 py-2 flex items-center justify-between flex-shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.2)" }}
            >
              <div className="flex items-center gap-2">
                {isListening ? (
                  <>
                    <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                    <span className="text-red-300 text-xs font-semibold">Đang ghi âm...</span>
                    <Waveform active={true} color="#f87171" />
                  </>
                ) : hasTranscript ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300 text-xs font-semibold">Đã ghi nhận</span>
                  </>
                ) : (
                  <>
                    <ChatCircle className="w-3.5 h-3.5 text-white/30" />
                    <span className="text-white/35 text-xs">Câu trả lời của bạn</span>
                  </>
                )}
              </div>
              {(hasTranscript || isListening) && (
                <span className="text-white/25 text-xs tabular-nums">{wordCount} từ</span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {!hasTranscript && !interimTranscript && !isListening ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                  <Microphone className="w-7 h-7 text-white/15" />
                  <p className="text-white/25 text-xs">Nhấn 🎤 mic để bắt đầu trả lời</p>
                  {!sttSupported && (
                    <div className="mt-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 max-w-[200px] text-left">
                      <p className="text-amber-300 text-xs leading-relaxed">
                        Dùng Chrome/Edge và cấp quyền microphone.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {hasTranscript && (
                    <p className="text-white/85 leading-relaxed text-sm">{transcript}</p>
                  )}
                  {interimTranscript && (
                    <p className="text-white/40 leading-relaxed italic text-sm">
                      {interimTranscript}
                      {isListening && (
                        <span className="inline-block w-0.5 h-4 bg-red-400 ml-0.5 animate-pulse align-middle" />
                      )}
                    </p>
                  )}
                  {isListening && !hasTranscript && !interimTranscript && (
                    <span className="inline-block w-0.5 h-5 bg-red-400 animate-pulse" />
                  )}
                </div>
              )}
              {sttError && (
                <div className="mt-2 flex items-start gap-1.5 bg-red-500/10 border border-red-500/20 rounded-xl p-2.5">
                  <WarningCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-300 text-xs">{sttError}</p>
                </div>
              )}
            </div>

            {hasTranscript && !isListening && (
              <div className="px-3 py-2 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <button
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
                  className="flex items-center gap-1.5 text-xs font-medium transition-all px-2.5 py-1.5 rounded-lg hover:bg-white/10"
                  style={{ color: "#ef4444" }}
                >
                  <Microphone className="w-3.5 h-3.5" />
                  Ghi lại
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Control bar ─────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center justify-center gap-4 py-3 px-6"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(12px)" }}
      >
        {/* End session */}
        <button
          onClick={handleEndSession}
          title="Kết thúc phỏng vấn"
          className="w-11 h-11 rounded-full flex items-center justify-center transition-all hover:bg-white/15"
          style={{ background: "rgba(239,68,68,0.1)", border: "1.5px solid rgba(239,68,68,0.3)" }}
        >
          <PhoneDisconnect className="w-5 h-5 text-red-400" />
        </button>

        {/* Mic */}
        <div className="relative">
          {isListening && <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />}
          <button
            onClick={toggleListening}
            disabled={!sttSupported}
            title={isListening ? "Dừng ghi âm" : "Bắt đầu trả lời"}
            className="relative w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
            style={{
              background: isListening ? "linear-gradient(135deg, #ef4444, #dc2626)" : "linear-gradient(135deg, #6E35E8, #8B4DFF)",
              boxShadow: isListening ? "0 0 24px rgba(239,68,68,0.5)" : "0 0 24px rgba(110, 53, 232,0.5)",
            }}
          >
            {isListening ? (
              <MicrophoneSlash className="w-7 h-7 text-white" />
            ) : (
              <Microphone className="w-7 h-7 text-white" />
            )}
          </button>
        </div>

        {/* Next / Finish */}
        {currentQ < QUESTIONS.length - 1 ? (
          <button
            onClick={handleNextQuestion}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all hover:scale-105 active:scale-95"
            style={{ background: "rgba(180,240,0,0.15)", border: "1.5px solid rgba(180,240,0,0.35)", color: "#B4F000" }}
          >
            {!isPro && currentQ === FREE_LIMIT - 1 ? (
              <>
                <Lock className="w-4 h-4" />
                Câu tiếp theo
              </>
            ) : (
              <>
                Câu tiếp theo
                <CaretRight className="w-4 h-4" />
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleNextQuestion}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all hover:scale-105 active:scale-95"
            style={{ background: "linear-gradient(135deg, #B4F000, #8EBF00)", color: "#000", boxShadow: "0 4px 20px rgba(180,240,0,0.3)" }}
          >
            Hoàn thành
            <CheckCircle className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
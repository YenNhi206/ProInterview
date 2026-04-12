import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import {
  ArrowLeft,
  User,
  Venus as GenderFemale,
  Mars as GenderMale,
  Play,
  Pause,
  Volume2 as SpeakerHigh,
  VolumeX as SpeakerX,
  ArrowRight,
  Sparkles as Sparkle,
  Video as VideoCamera,
  Check,
  Lightbulb,
  PanelLeft,
} from "lucide-react";

const IS = { strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" };

function IconFrame({ size = "md", tone = "neutral", className = "", children }) {
  const sz = size === "sm" ? "h-9 w-9" : size === "lg" ? "h-14 w-14" : "h-11 w-11";
  const tones = {
    neutral:
      "border-white/12 bg-gradient-to-br from-white/[0.11] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]",
    lime: "border-[#c4ff47]/28 bg-gradient-to-br from-[#c4ff47]/14 to-[#c4ff47]/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
    violet:
      "border-violet-400/25 bg-gradient-to-br from-violet-500/18 to-violet-900/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
    fuchsia:
      "border-fuchsia-400/22 bg-gradient-to-br from-fuchsia-500/14 to-violet-900/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
  };
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl border ${sz} ${tones[tone]} ${className}`}
      aria-hidden
    >
      {children}
    </div>
  );
}

/* ── Palette ─────────────────────────────────────────────── */
const P = {
  purple: "#6E35E8",
  purpleAlt: "#8B4DFF",
  lime: "#c4ff47",
  gold: "#FFD600",
  orange: "#FF8C42",
  bg: "transparent",
  card: "rgba(22,15,50,0.9)",
  text: "#ffffff",
  muted: "rgba(255,255,255,0.55)",
  border: "rgba(255,255,255,0.1)",
};

/* ── Video URLs ──────────────────────────────────────────── */
const VIDEO_URLS = {
  male: "https://res.cloudinary.com/dee4bvivu/video/upload/v1774336646/Male_jioqsx.mp4",
  female:
    "https://res.cloudinary.com/dee4bvivu/video/upload/v1774336640/Female_delxmy.mp4",
};

/* ── Video Player Component ──────────────────────────────── */
function VideoPlayer({
  src,
  isPlaying,
  onEnded,
}) {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current
          .play()
          .catch((e) => console.warn("Video play error:", e));
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: "#000",
        aspectRatio: "16/9",
        boxShadow: "0 12px 40px rgba(0,0,0,0.3)",
      }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-cover"
        onEnded={onEnded}
        playsInline
        preload="metadata"
      />

      {showControls && (
        <div
          className="absolute bottom-0 left-0 right-0 p-4"
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
          }}
        >
          <button
            onClick={toggleMute}
            className="p-2 rounded-lg transition-all"
            style={{
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(8px)",
            }}
          >
            {isMuted ? (
              <SpeakerX className="h-5 w-5 text-white" {...IS} />
            ) : (
              <SpeakerHigh className="h-5 w-5 text-white" {...IS} />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────── */
export function AIGenderSelection() {
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedGender, setSelectedGender] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoWatched, setVideoWatched] = useState(false);

  const interviewData = location.state || {};

  const handleGenderSelect = (gender) => {
    setSelectedGender(gender);
    setIsPlaying(true);
    setVideoWatched(false);
  };

  const handleVideoEnd = () => {
    setIsPlaying(false);
    setVideoWatched(true);
  };

  const handleContinue = () => {
    if (!selectedGender) return;
    // Persist gender to sessionStorage as reliable backup
    sessionStorage.setItem("prointerview_hr_gender", selectedGender);
    navigate("/interview/room", {
      state: { ...interviewData, hrGender: selectedGender },
    });
  };

  const handleSkip = () => {
    const gender = selectedGender || "female";
    // Persist gender to sessionStorage as reliable backup
    sessionStorage.setItem("prointerview_hr_gender", gender);
    navigate("/interview/room", {
      state: {
        ...interviewData,
        hrGender: gender,
      },
    });
  };

  return (
    <div className="pi-page-dashboard-bg min-h-full w-full px-6 pb-6 pt-3 sm:pt-4">
      <div className="mx-auto w-full max-w-6xl">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="group mb-2 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white shadow-[0_1px_0_rgba(255,255,255,0.06)_inset] transition-all hover:border-white/35 hover:bg-white/[0.18] active:scale-[0.97]"
          aria-label="Quay lại"
        >
          <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </button>

        <div
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full mb-4"
          style={{
            background: "rgba(110, 53, 232,0.08)",
            color: P.purple,
            border: `1px solid rgba(110, 53, 232,0.15)`,
          }}
        >
          <Sparkle className="h-3.5 w-3.5" {...IS} />
          Thiết lập phỏng vấn AI
        </div>

        <h1
          className="mb-2"
          style={{
            fontSize: "2rem",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: P.text,
            lineHeight: 1.2,
          }}
        >
          Chọn HR AI của bạn
        </h1>
        <p className="text-base" style={{ color: P.muted, maxWidth: "600px" }}>
          Chọn giới tính HR AI và xem video giới thiệu trước khi bắt đầu phỏng vấn. 
          Mỗi HR đều thân thiện và chuyên nghiệp
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr,1.2fr] gap-8 items-start">
        {/* ── Left: Gender Selection ──────────────────────── */}
        <div>
          <div
            className="rounded-2xl p-8"
            style={{
              background: P.card,
              border: `1px solid ${P.border}`,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <div className="flex items-center gap-3 mb-6">
              <IconFrame tone="violet">
                <User className="h-5 w-5 text-violet-200" {...IS} />
              </IconFrame>
              <div>
                <h2 className="font-semibold" style={{ color: P.text, fontSize: "1.125rem" }}>
                  Chọn giới tính HR AI
                </h2>
                <p className="text-xs mt-0.5" style={{ color: P.muted }}>
                  Chọn 1 trong 2 tùy chọn bên dưới
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:gap-5">
              {/* Male Option */}
              <button
                type="button"
                onClick={() => handleGenderSelect("male")}
                className={`group relative rounded-2xl border-2 p-6 text-center backdrop-blur-sm transition-all ${
                  selectedGender === "male"
                    ? "scale-[1.02] border-[#6E35E8] bg-[#6E35E8]/18 shadow-[0_0_0_1px_rgba(110,53,232,0.35),inset_0_1px_0_rgba(255,255,255,0.06)]"
                    : "border-white/12 bg-white/[0.05] hover:border-white/20 hover:bg-white/[0.08]"
                }`}
              >
                {selectedGender === "male" && (
                  <div
                    className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full"
                    style={{
                      background: P.purple,
                      boxShadow: "0 2px 8px rgba(110, 53, 232,0.4)",
                    }}
                  >
                    <Check className="h-3.5 w-3.5 text-white" {...IS} strokeWidth={2.25} />
                  </div>
                )}
                <div className="mx-auto mb-4 flex justify-center transition-transform group-hover:scale-105">
                  <IconFrame size="lg" tone="violet">
                    <GenderMale className="h-10 w-10 text-violet-300" {...IS} />
                  </IconFrame>
                </div>
                <p className="mb-1 text-base font-bold text-white">HR Nam</p>
                <p className="text-xs font-medium text-white/55">David · Người phỏng vấn AI</p>
              </button>

              {/* Female Option */}
              <button
                type="button"
                onClick={() => handleGenderSelect("female")}
                className={`group relative rounded-2xl border-2 p-6 text-center backdrop-blur-sm transition-all ${
                  selectedGender === "female"
                    ? "scale-[1.02] border-[#6E35E8] bg-[#6E35E8]/18 shadow-[0_0_0_1px_rgba(110,53,232,0.35),inset_0_1px_0_rgba(255,255,255,0.06)]"
                    : "border-white/12 bg-white/[0.05] hover:border-white/20 hover:bg-white/[0.08]"
                }`}
              >
                {selectedGender === "female" && (
                  <div
                    className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full"
                    style={{
                      background: P.purple,
                      boxShadow: "0 2px 8px rgba(110, 53, 232,0.4)",
                    }}
                  >
                    <Check className="h-3.5 w-3.5 text-white" {...IS} strokeWidth={2.25} />
                  </div>
                )}
                <div className="mx-auto mb-4 flex justify-center transition-transform group-hover:scale-105">
                  <IconFrame size="lg" tone="fuchsia">
                    <GenderFemale className="h-10 w-10 text-fuchsia-300" {...IS} />
                  </IconFrame>
                </div>
                <p className="mb-1 text-base font-bold text-white">HR Nữ</p>
                <p className="text-xs font-medium text-white/55">Sarah — AI Interviewer</p>
              </button>
            </div>
          </div>

          {/* Info box */}
          <div className="mt-5 rounded-xl border border-violet-400/20 bg-violet-500/[0.08] p-5 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <IconFrame tone="violet" className="flex-shrink-0">
                <VideoCamera className="h-5 w-5 text-violet-200" {...IS} />
              </IconFrame>
              <div>
                <p className="mb-1.5 text-sm font-bold text-violet-100">Xem video giới thiệu</p>
                <p className="text-sm leading-relaxed text-white/65">
                  Mỗi HR AI có video giới thiệu ngắn giúp bạn làm quen trước khi phỏng vấn. Bạn cũng có thể bỏ qua
                  và vào phòng ngay.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Video Preview ────────────────────────── */}
        <div>
          <div
            className="rounded-2xl p-8"
            style={{
              background: P.card,
              border: `1px solid ${P.border}`,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <div className="mb-5 flex items-center gap-3">
              <IconFrame tone="violet">
                <VideoCamera className="h-5 w-5 text-violet-200" {...IS} />
              </IconFrame>
              <div className="flex-1">
                <h2 className="font-semibold" style={{ color: P.text, fontSize: "1.125rem" }}>
                  Video giới thiệu HR AI
                </h2>
                <p className="text-xs mt-0.5" style={{ color: P.muted }}>
                  {selectedGender ? "Video đang sẵn sàng" : "Chọn HR để xem video"}
                </p>
              </div>
              {videoWatched && (
                <span className="rounded-full border border-[#c4ff47]/30 bg-[#c4ff47]/12 px-3 py-1.5 text-xs font-bold text-[#c4ff47]">
                  ✓ Đã xem
                </span>
              )}
            </div>

            {selectedGender ? (
              <div>
                <VideoPlayer
                  src={VIDEO_URLS[selectedGender]}
                  isPlaying={isPlaying}
                  onEnded={handleVideoEnd}
                />

                {!isPlaying && (
                  <button
                    onClick={() => setIsPlaying(true)}
                    className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-semibold transition-all"
                    style={{
                      background: `linear-gradient(135deg, ${P.purple}, ${P.purpleAlt})`,
                      color: "#fff",
                      boxShadow: "0 4px 16px rgba(110, 53, 232,0.3)",
                      marginTop: "1.25rem",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget).style.transform = "translateY(-1px)";
                      (e.currentTarget).style.boxShadow = "0 6px 20px rgba(110, 53, 232,0.4)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget).style.transform = "translateY(0)";
                      (e.currentTarget).style.boxShadow = "0 4px 16px rgba(110, 53, 232,0.3)";
                    }}
                  >
                    <Play className="h-5 w-5" {...IS} />
                    {videoWatched ? "Xem lại video" : "Phát video"}
                  </button>
                )}

                {isPlaying && (
                  <button
                    onClick={() => setIsPlaying(false)}
                    className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-semibold transition-all"
                    style={{
                      background: "rgba(110, 53, 232,0.1)",
                      border: `2px solid ${P.purple}`,
                      color: P.purple,
                      marginTop: "1.25rem",
                    }}
                  >
                    <Pause className="h-5 w-5" {...IS} />
                    Tạm dừng
                  </button>
                )}
              </div>
            ) : (
              <div
                className="flex aspect-video items-center justify-center rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.03] p-8 text-center backdrop-blur-sm"
              >
                <div>
                  <div className="mx-auto mb-5 flex justify-center">
                    <IconFrame size="lg" tone="neutral">
                      <VideoCamera className="h-10 w-10 text-white/40" {...IS} />
                    </IconFrame>
                  </div>
                  <p className="mb-2 flex items-center justify-center gap-2 text-lg font-bold text-white">
                    <PanelLeft className="h-5 w-5 text-white/50" {...IS} />
                    Chọn HR AI
                  </p>
                  <p className="mx-auto max-w-[280px] text-sm leading-relaxed text-white/55">
                    Chọn giới tính HR AI bên trái để xem video giới thiệu và bắt đầu
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Buttons ─────────────────────────────────────────── */}
      <div className="mt-8 flex flex-col gap-4 max-w-2xl mx-auto">
        {/* Continue (requires watching video) */}
        <button
          onClick={handleContinue}
          disabled={!videoWatched}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold transition-all"
          style={
            videoWatched
              ? {
                  background: `linear-gradient(135deg, ${P.purple} 0%, ${P.purpleAlt} 100%)`,
                  color: "#fff",
                  boxShadow: "0 6px 24px rgba(110, 53, 232,0.35)",
                  fontSize: "1rem",
                }
              : {
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.35)",
                  cursor: "not-allowed",
                  border: "2px solid rgba(255,255,255,0.1)",
                  fontSize: "1rem",
                }
          }
          onMouseEnter={(e) => {
            if (videoWatched) {
              (e.currentTarget).style.transform = "translateY(-2px)";
              (e.currentTarget).style.boxShadow = "0 8px 28px rgba(110, 53, 232,0.4)";
            }
          }}
          onMouseLeave={(e) => {
            if (videoWatched) {
              (e.currentTarget).style.transform = "translateY(0)";
              (e.currentTarget).style.boxShadow = "0 6px 24px rgba(110, 53, 232,0.35)";
            }
          }}
        >
          {videoWatched ? (
            <>
              Tiếp tục vào phòng phỏng vấn
              <ArrowRight className="h-5 w-5" {...IS} />
            </>
          ) : (
            <span className="inline-flex items-center gap-2">
              <VideoCamera className="h-5 w-5 opacity-70" {...IS} />
              Xem video giới thiệu để tiếp tục
            </span>
          )}
        </button>

        {/* Skip button — only show when video not watched */}
        {!videoWatched && (
          <button
            onClick={handleSkip}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold transition-all"
            style={{
              background: "transparent",
              color: P.muted,
              border: "2px solid rgba(255,255,255,0.14)",
              fontSize: "0.95rem",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget).style.borderColor = P.purple;
              (e.currentTarget).style.color = P.purple;
              (e.currentTarget).style.background = "rgba(110, 53, 232,0.08)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget).style.borderColor = "rgba(255,255,255,0.14)";
              (e.currentTarget).style.color = P.muted;
              (e.currentTarget).style.background = "transparent";
            }}
          >
            <span className="inline-flex items-center gap-2">
              Bỏ qua, vào phòng phỏng vấn ngay
              <ArrowRight className="h-4 w-4" {...IS} />
            </span>
          </button>
        )}

        {!videoWatched && selectedGender && (
          <div
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm text-white/55 backdrop-blur-sm"
          >
            <span className="inline-flex items-start justify-center gap-2">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-violet-300/90" {...IS} />
              <span>
                <strong className="text-white/75">Mẹo:</strong> Xem hết video để mở khóa nút tiếp tục, hoặc nhấn
                &quot;Bỏ qua&quot; để vào ngay.
              </span>
            </span>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
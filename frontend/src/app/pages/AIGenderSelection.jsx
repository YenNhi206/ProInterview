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
} from "lucide-react";

/* ── Palette ─────────────────────────────────────────────── */
const P = {
  purple: "#6E35E8",
  purpleAlt: "#8B4DFF",
  lime: "#B4F000",
  gold: "#FFD600",
  orange: "#FF8C42",
  bg: "#F4F5F7",
  card: "#FFFFFF",
  text: "#1F1F1F",
  muted: "#6B7280",
  border: "rgba(0,0,0,0.08)",
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
              <SpeakerX className="w-5 h-5 text-white" />
            ) : (
              <SpeakerHigh className="w-5 h-5 text-white" />
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
    <div className="p-6 max-w-6xl mx-auto">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-medium mb-4 transition-colors"
          style={{ color: P.muted }}
          onMouseEnter={(e) => {
            (e.currentTarget).style.color = P.purple;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget).style.color = P.muted;
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại
        </button>

        <div
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full mb-4"
          style={{
            background: "rgba(110, 53, 232,0.08)",
            color: P.purple,
            border: `1px solid rgba(110, 53, 232,0.15)`,
          }}
        >
          <Sparkle className="w-3.5 h-3.5" />
          AI Interview Setup
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
          Chọn HR AI của bạn 👋
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
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${P.purple}, ${P.purpleAlt})`,
                }}
              >
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold" style={{ color: P.text, fontSize: "1.125rem" }}>
                  Chọn giới tính HR AI
                </h2>
                <p className="text-xs mt-0.5" style={{ color: P.muted }}>
                  Chọn 1 trong 2 tùy chọn bên dưới
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              {/* Male Option */}
              <button
                onClick={() => handleGenderSelect("male")}
                className="relative p-6 rounded-2xl text-center transition-all group"
                style={{
                  border:
                    selectedGender === "male"
                      ? `3px solid ${P.purple}`
                      : "3px solid #E9EAEC",
                  background:
                    selectedGender === "male"
                      ? "rgba(110, 53, 232,0.06)"
                      : "#FAFAFA",
                  transform: selectedGender === "male" ? "scale(1.02)" : "scale(1)",
                }}
                onMouseEnter={(e) => {
                  if (selectedGender !== "male") {
                    (e.currentTarget).style.borderColor = "#D1D5DB";
                    (e.currentTarget).style.transform = "scale(1.02)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedGender !== "male") {
                    (e.currentTarget).style.borderColor = "#E9EAEC";
                    (e.currentTarget).style.transform = "scale(1)";
                  }
                }}
              >
                {selectedGender === "male" && (
                  <div
                    className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ 
                      background: P.purple,
                      boxShadow: "0 2px 8px rgba(110, 53, 232,0.4)",
                    }}
                  >
                    <Check className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-transform group-hover:scale-110"
                  style={{
                    background: "rgba(110, 53, 232,0.12)",
                    border: `2px solid rgba(110, 53, 232,0.25)`,
                  }}
                >
                  <GenderMale
                    className="w-10 h-10"
                    style={{ color: P.purple }}
                   
                  />
                </div>
                <p className="font-bold mb-1" style={{ color: P.text, fontSize: "1rem" }}>
                  HR Nam 👨‍💼
                </p>
                <p className="text-xs font-medium" style={{ color: P.muted }}>
                  David - AI Interviewer
                </p>
              </button>

              {/* Female Option */}
              <button
                onClick={() => handleGenderSelect("female")}
                className="relative p-6 rounded-2xl text-center transition-all group"
                style={{
                  border:
                    selectedGender === "female"
                      ? `3px solid ${P.purple}`
                      : "3px solid #E9EAEC",
                  background:
                    selectedGender === "female"
                      ? "rgba(110, 53, 232,0.06)"
                      : "#FAFABA",
                  transform: selectedGender === "female" ? "scale(1.02)" : "scale(1)",
                }}
                onMouseEnter={(e) => {
                  if (selectedGender !== "female") {
                    (e.currentTarget).style.borderColor = "#D1D5DB";
                    (e.currentTarget).style.transform = "scale(1.02)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedGender !== "female") {
                    (e.currentTarget).style.borderColor = "#E9EAEC";
                    (e.currentTarget).style.transform = "scale(1)";
                  }
                }}
              >
                {selectedGender === "female" && (
                  <div
                    className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ 
                      background: P.purple,
                      boxShadow: "0 2px 8px rgba(110, 53, 232,0.4)",
                    }}
                  >
                    <Check className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-transform group-hover:scale-110"
                  style={{
                    background: "rgba(255,141,66,0.12)",
                    border: `2px solid rgba(255,141,66,0.25)`,
                  }}
                >
                  <GenderFemale
                    className="w-10 h-10"
                    style={{ color: P.orange }}
                   
                  />
                </div>
                <p className="font-bold mb-1" style={{ color: P.text, fontSize: "1rem" }}>
                  HR Nữ 👩‍💼
                </p>
                <p className="text-xs font-medium" style={{ color: P.muted }}>
                  Sarah - AI Interviewer
                </p>
              </button>
            </div>
          </div>

          {/* Info box */}
          <div
            className="rounded-xl p-5 mt-5"
            style={{
              background: "rgba(180,240,0,0.06)",
              border: "1.5px solid rgba(180,240,0,0.2)",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(180,240,0,0.15)" }}
              >
                <VideoCamera
                  className="w-5 h-5"
                  style={{ color: "#65A300" }}
                 
                />
              </div>
              <div>
                <p
                  className="text-sm font-bold mb-1.5"
                  style={{ color: "#4A7A00" }}
                >
                  💡 Xem video giới thiệu
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "#5A8A00" }}
                >
                  Mỗi HR AI có video giới thiệu ngắn giúp bạn làm quen trước khi phỏng vấn. 
                  Bạn cũng có thể bỏ qua và vào phòng ngay
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
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: "rgba(110, 53, 232,0.1)",
                  border: `1px solid rgba(110, 53, 232,0.2)`,
                }}
              >
                <VideoCamera className="w-5 h-5" style={{ color: P.purple }} />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold" style={{ color: P.text, fontSize: "1.125rem" }}>
                  Video giới thiệu HR AI
                </h2>
                <p className="text-xs mt-0.5" style={{ color: P.muted }}>
                  {selectedGender ? "Video đang sẵn sàng" : "Chọn HR để xem video"}
                </p>
              </div>
              {videoWatched && (
                <span
                  className="text-xs font-bold px-3 py-1.5 rounded-full"
                  style={{
                    background: "rgba(180,240,0,0.15)",
                    color: "#4A7A00",
                  }}
                >
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
                    <Play className="w-5 h-5" />
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
                    <Pause className="w-5 h-5" />
                    Tạm dừng
                  </button>
                )}
              </div>
            ) : (
              <div
                className="rounded-2xl text-center"
                style={{
                  background: "linear-gradient(135deg, #FAFAFA 0%, #F0F1F3 100%)",
                  border: "2px dashed #D1D5DB",
                  aspectRatio: "16/9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "2rem",
                }}
              >
                <div>
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
                    style={{ 
                      background: "#FFFFFF",
                      border: "2px solid #E5E7EB",
                    }}
                  >
                    <VideoCamera className="w-10 h-10 text-gray-400" />
                  </div>
                  <p
                    className="font-bold mb-2"
                    style={{ color: P.text, fontSize: "1.125rem" }}
                  >
                    Chọn HR AI 👈
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: P.muted, maxWidth: "280px", margin: "0 auto" }}>
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
                  background: "#F0F1F3",
                  color: "#9CA3AF",
                  cursor: "not-allowed",
                  border: "2px solid #E5E7EB",
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
              <ArrowRight className="w-5 h-5" />
            </>
          ) : (
            <>📹 Xem video giới thiệu để tiếp tục</>
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
              border: "2px solid #E5E7EB",
              fontSize: "0.95rem",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget).style.borderColor = P.purple;
              (e.currentTarget).style.color = P.purple;
              (e.currentTarget).style.background = "rgba(110, 53, 232,0.04)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget).style.borderColor = "#E5E7EB";
              (e.currentTarget).style.color = P.muted;
              (e.currentTarget).style.background = "transparent";
            }}
          >
            Bỏ qua → Vào phòng phỏng vấn ngay
          </button>
        )}

        {!videoWatched && selectedGender && (
          <div
            className="text-center text-sm px-4 py-3 rounded-xl"
            style={{ 
              color: P.muted,
              background: "rgba(0,0,0,0.02)",
              border: "1px solid rgba(0,0,0,0.05)",
            }}
          >
            💡 <strong>Mẹo:</strong> Xem hết video để mở khóa nút tiếp tục, hoặc nhấn "Bỏ qua" để vào ngay
          </div>
        )}
      </div>
    </div>
  );
}
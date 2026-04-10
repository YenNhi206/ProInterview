import React, { useRef, useEffect, useState } from "react";
import { User } from "lucide-react";

/* ── Cloudinary HR Video URLs ────────────────────────────── */
export const HR_VIDEO_URLS = {
  male: "https://res.cloudinary.com/dee4bvivu/video/upload/v1774336646/Male_jioqsx.mp4",
  female:
    "https://res.cloudinary.com/dee4bvivu/video/upload/v1774336640/Female_delxmy.mp4",
};

export function HRVideoPlayer({
  gender,
  isSpeaking = false,
  videoUrl,
  size = 180,
  fullPanel = false,
}) {
  const resolvedUrl = videoUrl || HR_VIDEO_URLS[gender];
  const videoRef = useRef(null);
  const [videoState, setVideoState] = useState(
    "loading"
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onCanPlay = () => {
      setVideoState("ready");
      video.play().catch(() => {});
    };
    const onError = () => setVideoState("error");

    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("error", onError);
    video.load();

    return () => {
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("error", onError);
    };
  }, [resolvedUrl]);

  const containerStyle = fullPanel
    ? { width: "100%", height: "100%" }
    : {
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "1rem",
        overflow: "hidden",
        boxShadow: isSpeaking
          ? "0 0 40px rgba(110, 53, 232,0.5), 0 0 80px rgba(110, 53, 232,0.3)"
          : "0 8px 32px rgba(0,0,0,0.4)",
        transition: "box-shadow 0.3s ease",
      };

  return (
    <div className="relative" style={containerStyle}>
      {/* Video */}
      <video
        ref={videoRef}
        src={resolvedUrl}
        loop
        muted
        playsInline
        className="w-full h-full object-cover"
        style={{ display: videoState === "ready" ? "block" : "none" }}
      />

      {/* Loading state */}
      {videoState === "loading" && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3"
          style={{
            background: "linear-gradient(160deg, #120d2b 0%, #1a1040 100%)",
          }}
        >
          <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
          <p className="text-white/40 text-xs">Đang tải...</p>
        </div>
      )}

      {/* Error state */}
      {videoState === "error" && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2"
          style={{
            background: "linear-gradient(160deg, #120d2b 0%, #1a1040 100%)",
          }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{
              background: "rgba(110, 53, 232,0.2)",
              border: "2px solid rgba(110, 53, 232,0.3)",
            }}
          >
            <User className="w-6 h-6 text-[#9B6DFF]" />
          </div>
          <p className="text-white/40 text-xs text-center px-2">
            {gender === "male" ? "HR Nam" : "HR Nữ"}
          </p>
        </div>
      )}

      {/* Speaking ring (only when not fullPanel) */}
      {!fullPanel && isSpeaking && videoState === "ready" && (
        <>
          <div
            className="absolute inset-0 rounded-2xl border-2 border-[#9B6DFF]/60 animate-ping pointer-events-none"
            style={{ animationDuration: "1.2s" }}
          />
          <div
            className="absolute -inset-1 rounded-2xl border border-[#6E35E8]/40 animate-ping pointer-events-none"
            style={{ animationDuration: "1.8s", animationDelay: "0.3s" }}
          />
        </>
      )}
    </div>
  );
}

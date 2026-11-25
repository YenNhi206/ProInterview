/**
 * AvatarVideoPlayer, trình phát video avatar pre-generated.
 *
 * Phát video MP4 đã pre-render (full khung, lipsync với ElevenLabs voice).
 * Thay thế WebRTC streaming, đơn giản hơn, chất lượng cao hơn, không có session limit.
 *
 * Props:
 *   videoUrl       , URL video MP4 cần phát (pre-generated)
 *   onEnded        , callback khi video phát xong
 *   onError        , callback khi không load được video
 *   isLoading      , hiện skeleton/spinner (khi đang pre-gen)
 *   gender         , "female" | "male" (dùng cho fallback avatar image)
 *   autoPlay       , true by default
 *   className      , CSS class bổ sung cho container
 *
 * Fallback:
 *   - Nếu videoUrl = null + isLoading = false → hiện poster image HR tĩnh
 *   - Nếu video load lỗi → hiện fallback HR image + gọi onError
 */

import { useRef, useEffect, useCallback, useState } from "react";

const FALLBACK_FEMALE = "https://res.cloudinary.com/dee4bvivu/image/upload/v1778910708/AI-female_gxbcf1.png";
const FALLBACK_MALE   = "https://res.cloudinary.com/dee4bvivu/image/upload/v1778910708/AI-female_gxbcf1.png";

export function AvatarVideoPlayer({
  videoUrl    = null,
  onEnded     = null,
  onError     = null,
  isLoading   = false,
  gender      = "female",
  autoPlay    = true,
  className   = "",
}) {
  const videoRef        = useRef(null);
  const [hasError, setHasError] = useState(false);
  const fallbackImg     = gender === "male" ? FALLBACK_MALE : FALLBACK_FEMALE;

  // Reset error state khi videoUrl thay đổi
  useEffect(() => {
    setHasError(false);
  }, [videoUrl]);

  // Auto-play khi videoUrl thay đổi
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl || !autoPlay) return;

    setHasError(false);
    video.load();
    video.play().catch(() => {
      // Autoplay blocked by browser, user cần click trước. Không throw.
    });
  }, [videoUrl, autoPlay]);

  const handleEnded = useCallback(() => {
    onEnded?.();
  }, [onEnded]);

  const handleError = useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gray-900 ${className}`}
      style={{ aspectRatio: "16/9" }}
    >
      {/* ── Loading skeleton ─────────────────────────────────────────────── */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10">
          <img
            src={fallbackImg}
            alt="HR Avatar"
            className="w-full h-full object-cover opacity-30 blur-sm"
          />
          {/* Pulse overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
            <p className="text-white text-sm font-medium opacity-80">
              Đang chuẩn bị buổi phỏng vấn...
            </p>
          </div>
        </div>
      )}

      {/* ── Error fallback ────────────────────────────────────────────────── */}
      {hasError && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <img
            src={fallbackImg}
            alt="HR Avatar"
            className="w-full h-full object-cover opacity-80"
          />
        </div>
      )}

      {/* ── No video yet (idle) ───────────────────────────────────────────── */}
      {!videoUrl && !isLoading && !hasError && (
        <div className="absolute inset-0 z-10">
          <img
            src={fallbackImg}
            alt="HR Avatar"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* ── Video player ─────────────────────────────────────────────────── */}
      {videoUrl && !hasError && (
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-cover"
          playsInline
          muted={false}
          onEnded={handleEnded}
          onError={handleError}
          // Poster: hiện ảnh tĩnh khi video đang buffer
          poster={fallbackImg}
        />
      )}
    </div>
  );
}

export default AvatarVideoPlayer;

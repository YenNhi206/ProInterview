import React, { useEffect, useRef, useState } from "react";
const HOME_AI_DEMO_VIDEO = "https://res.cloudinary.com/dee4bvivu/video/upload/v1774336640/Female_delxmy.mp4";

export function HeroInterviewVideoCard({ overlap = false, center = false, compact = false }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraState, setCameraState] = useState("loading"); // 'loading', 'active', 'inactive'

  const startWebcam = async () => {
    setCameraState("loading");
    if (!streamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraState("active");
        }
      } catch (err) {
        console.error("Error accessing webcam:", err);
        setCameraState("inactive");
      }
    } else {
      setCameraState("active");
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
    setCameraState("loading");
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            startWebcam();
          } else {
            stopWebcam();
          }
        });
      },
      { threshold: 0.5 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      stopWebcam();
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <style>{`
        .hero-video-wave {
          animation: heroVideoWave 1.35s ease-in-out infinite;
        }
        .hero-video-wave:nth-child(odd) {
          animation-delay: 0.12s;
        }
        .hero-video-wave:nth-child(4n) {
          animation-delay: 0.28s;
        }
        @keyframes heroVideoWave {
          0%, 100% { transform: scaleY(0.7); opacity: 0.8; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-video-wave { animation: none !important; }
        }
      `}</style>
      <div
        id="home-hero-video-card"
        ref={containerRef}
        className={`relative w-full overflow-visible ${center ? "mx-auto max-w-[min(95vw,68rem)] lg:max-w-[min(95vw,69rem)]" : ""} ${overlap ? "-mt-2" : "mt-[3.8rem]"}`}
      >
        <div className="relative overflow-hidden rounded-[1rem] bg-white border-2 border-[#8037f4] shadow-[0_20px_50px_rgba(99,14,212,0.14)] sm:rounded-[1.25rem]">

          {/* Mac Window Header */}
          <div className="relative flex items-center justify-between bg-white px-3 py-2.5 border-b border-slate-200/60 sm:px-4 sm:py-3">
            <div className="flex items-center gap-1.5 z-10 w-12 sm:w-16">
              <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f56] sm:h-3 sm:w-3" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e] sm:h-3 sm:w-3" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#27c93f] sm:h-3 sm:w-3" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center gap-1.5 pointer-events-none">
              <div className="h-1.5 w-1.5 rounded-full bg-[#8037f4] sm:h-2 sm:w-2" />
              <span className="text-[10px] font-bold text-slate-500 sm:text-xs">ProInterview - Phòng Phỏng Vấn</span>
            </div>
            <div className="w-12 sm:w-16" />
          </div>

          {/* Interview Room Mockup */}
          <div className={`flex flex-col bg-[#f3f0f9] ${compact ? "h-[380px] sm:h-[420px] lg:h-[480px]" : "h-[460px] sm:h-[516px] lg:h-[616px]"}`}>

            {/* Top bar */}
            <div className="flex shrink-0 items-center justify-between border-b border-violet-200/80 bg-white/85 px-3 py-2 sm:px-4 sm:py-2.5 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50 px-2 py-1 sm:px-2.5">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#b5e636]" />
                  <span className="text-[10px] sm:text-xs font-semibold text-violet-800">REC</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50 px-2 py-1 sm:px-2.5">
                  <span className="text-[10px] sm:text-xs tabular-nums text-violet-800">12:45</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] sm:text-xs font-medium text-violet-600">Câu 2/5</span>
              </div>
            </div>

            {/* Question banner */}
            <div className="shrink-0 border-b border-violet-100 bg-white/70 px-3 py-2 sm:px-4 sm:py-3">
              <div className="flex items-start gap-2.5 rounded-md border border-violet-200/80 bg-violet-50/50 px-2.5 py-2 sm:px-3">
                <span className="mt-0.5 flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6E35E8] to-[#8B4DFF] text-[10px] sm:text-xs font-bold text-white">
                  2
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] sm:text-sm font-medium leading-snug text-violet-950">
                    Bạn hãy kể về một dự án phức tạp nhất mà bạn từng tham gia. Vai trò của bạn là gì và bạn đã giải quyết khó khăn như thế nào?
                  </p>
                </div>
              </div>
            </div>

            {/* Main video panels */}
            <div className={`grid min-h-0 flex-1 gap-2 px-3 pb-2 grid-cols-2 ${compact ? "grid-rows-[minmax(0,1fr)_3.5rem]" : "grid-rows-[minmax(0,1fr)_4.5rem]"}`}>

              {/* HR panel */}
              <div className="relative overflow-hidden rounded-lg sm:rounded-xl border-2 border-violet-300/80 bg-[#0a0a18] shadow-[0_8px_32px_rgba(110,53,232,0.12)]">
                <video autoPlay loop muted playsInline className="h-full w-full object-cover">
                  <source src={HOME_AI_DEMO_VIDEO} type="video/mp4" />
                </video>
                <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 flex items-center gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
                  <span className="text-white text-[10px] sm:text-xs font-medium">Hoàng Yến</span>
                  <span className="text-white/40 text-[10px] sm:text-xs">· HR AI</span>
                </div>
              </div>

              {/* User panel */}
              <div className="relative overflow-hidden rounded-lg sm:rounded-xl border-2 border-violet-400 bg-slate-900 shadow-[0_0_20px_rgba(110,53,232,0.15)]">
                {/* Real User Video */}
                <video
                  ref={videoRef}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                  style={{ transform: "scaleX(-1)" }}
                />

                {cameraState !== "active" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm z-10 rounded-lg sm:rounded-xl">
                    <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                    <span className="text-violet-200 text-[10px] sm:text-xs font-medium animate-pulse">
                      Đang kết nối camera...
                    </span>
                  </div>
                )}

                <div className="pointer-events-none absolute inset-0 rounded-lg sm:rounded-xl ring-2 ring-inset ring-violet-400/50" />
                <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 flex items-center gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.6)" }}>
                  <span className="text-white text-[10px] sm:text-xs font-medium">Bạn</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#b5e636] animate-pulse" />
                </div>
              </div>

              {/* Transcript panel (Inside Grid) */}
              <div className={`flex shrink-0 flex-col overflow-hidden rounded-md border bg-white transition-all col-span-2 border-violet-300 ${compact ? "h-[3.5rem] max-h-[3.5rem]" : "h-[4.5rem] max-h-[4.5rem]"}`}>
                <div className="flex shrink-0 items-center justify-between border-b border-violet-100 bg-violet-50/60 px-2.5 py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-[#b5e636]" />
                    <span className="text-xs font-semibold text-violet-800">Đang ghi âm...</span>

                    {/* Waveform */}
                    <div className="flex items-center gap-[2px] ml-2 h-3 sm:h-4">
                      {[40, 80, 50, 100, 60, 90, 40].map((h, i) => (
                        <span
                          key={i}
                          className="hero-video-wave w-[2px] sm:w-[3px] rounded-full bg-gradient-to-t from-[#8037f4] to-[#b794f6]"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                  </div>
                  <span className="text-xs tabular-nums text-violet-500">14 từ</span>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-1.5">
                  <p className="text-xs leading-snug text-slate-700">
                    Dạ, trong dự án gần nhất, em phụ trách thiết kế lại toàn bộ hệ thống để...
                  </p>
                </div>
              </div>

            </div>

            {/* Bottom Control Bar */}
            <div className={`flex shrink-0 items-center justify-center gap-3 border-t border-violet-200/80 bg-white/90 px-4 backdrop-blur-sm select-none ${compact ? "py-2" : "gap-4 py-2.5"}`}>
              {/* Hang Up Button (Static) */}
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full border border-violet-200 bg-[#f3f0ff]"
              >
                <svg className="h-5 w-5 text-violet-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m3 3 18 18M9.778 9.778A9 9 0 0 0 2 12c.5 1.5 1.5 3 3 4l2.5-2.5m3.5-3.5 3.5 3.5 2.5 2.5c1.5-1 2.5-2.5 3-4a9 9 0 0 0-7.778-2.222" />
                </svg>
              </div>

              {/* Microphone Button (Static double ring) */}
              <div className="relative flex h-[3.5rem] w-[3.5rem] items-center justify-center rounded-full border border-violet-300 bg-white p-[3px] shadow-[0_0_15px_rgba(110,53,232,0.25)]">
                <div
                  className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[#6E35E8] to-[#8B4DFF]"
                >
                  <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                  </svg>
                </div>
              </div>

              {/* Next Question Button (Static) */}
              <div
                className={`flex items-center gap-1.5 rounded-full bg-[#caff1a] text-[#2e0066] shadow-[0_6px_20px_rgba(196,255,71,0.15)] ${compact ? "px-4 py-2 text-xs font-bold" : "px-6 py-2.5 text-sm font-black"}`}
              >
                <span>Câu tiếp theo</span>
                <svg className="w-3.5 h-3.5 stroke-[3.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

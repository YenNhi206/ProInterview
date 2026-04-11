import React from "react";
import { useNavigate } from "react-router";
import { Zap as Lightning } from "lucide-react";

/**
 * Nền đồng bộ Dashboard: gradient + blob/shimmer + lưới 32px toàn viewport.
 */
const PI = {
  pageGradient: "linear-gradient(165deg, #0a0618 0%, #07060e 45%, #12081f 100%)",
  purple: "#6E35E8",
  lilac: "#9B6DFF",
  lime: "#c4ff47",
  limeDark: "#8fbc24",
  limeSoft: "rgba(196,255,71,0.16)",
  /** Khối form — glass mềm, ít “gắt” hơn */
  glass: {
    background: "linear-gradient(165deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.025) 50%, rgba(110,53,232,0.04) 100%)",
    border: "1px solid rgba(255,255,255,0.1)",
    backdropFilter: "blur(20px) saturate(1.08)",
    WebkitBackdropFilter: "blur(20px) saturate(1.08)",
    boxShadow:
      "0 20px 50px rgba(0,0,0,0.32), 0 0 0 1px rgba(196, 255, 71, 0.07) inset, 0 0 48px -16px rgba(110, 53, 232, 0.12)",
  },
};

/** Ô input dark — cùng vibe form trên Home */
export const AUTH_INPUT_CLASS =
  "w-full px-5 py-3.5 rounded-2xl font-medium text-white placeholder:text-white/40 outline-none transition-all border border-white/12 bg-white/[0.05] hover:bg-white/[0.07] focus:border-[#c4ff47]/45 focus:ring-2 focus:ring-[#c4ff47]/18";

/** Nút chính & Google: cùng full width, cùng bo góc, chiều dọc py-4 (không kéo cao). */
export const AUTH_CTA_FRAME_CLASS =
  "flex w-full items-center justify-center rounded-2xl py-4";

export function AuthShell({ children, aside, footerNote }) {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-x-hidden text-white font-sans selection:bg-[rgba(196,255,71,0.28)] selection:text-white"
      style={{
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        background: PI.pageGradient,
        color: "#fff",
      }}
    >
      <style>{`
        @keyframes auth-shimmer-bg {
          0% { opacity: 0.4; transform: translate(0,0) scale(1); }
          50% { opacity: 0.7; transform: translate(2%, -2%) scale(1.05); }
          100% { opacity: 0.4; transform: translate(0,0) scale(1); }
        }
      `}</style>
      {/* Blob + shimmer — cùng stack như Dashboard / Home */}
      <div
        className="fixed inset-0 pointer-events-none -z-10 opacity-90"
        style={{ animation: "auth-shimmer-bg 14s ease-in-out infinite" }}
        aria-hidden
      >
        <div className="absolute top-[-20%] right-[-10%] h-[70vh] w-[70vh] rounded-full bg-gradient-to-bl from-fuchsia-600/35 via-violet-600/20 to-transparent blur-[100px]" />
        <div className="absolute bottom-[-25%] left-[-15%] h-[85vh] w-[85vh] rounded-full bg-gradient-to-tr from-[#c4ff47]/18 via-cyan-500/10 to-fuchsia-500/20 blur-[110px]" />
        <div className="absolute top-1/2 left-1/2 h-[50vh] w-[50vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#6E35E8]/12 blur-[90px]" />
        <div className="absolute top-[30%] right-[5%] h-[40vh] w-[40vh] rounded-full bg-[#c4ff47]/10 blur-[80px]" />
      </div>

      {/* Lưới ô vuông — full viewport, xuyên qua header kính mờ */}
      <div
        className="pointer-events-none fixed inset-0 z-[1] opacity-[0.09]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.45) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
        aria-hidden
      />

      {/* Cùng chiều cao / logo / padding với nav Home.jsx (h-16, w-8 icon, px-5) */}
      <header
        className="relative z-10 w-full border-b border-white/[0.08]"
        style={{
          background: "rgba(7, 6, 14, 0.72)",
          backdropFilter: "blur(16px) saturate(1.1)",
          WebkitBackdropFilter: "blur(16px) saturate(1.1)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.05), 0 8px 32px -8px rgba(0,0,0,0.4)",
        }}
      >
        <div className="mx-auto flex h-16 w-full max-w-[min(100%,calc(64rem+2.5cm))] items-center justify-between gap-6 px-5">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="group flex shrink-0 items-center gap-2.5"
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl shadow-lg transition-transform group-hover:scale-105"
              style={{
                background: "linear-gradient(135deg, #6E35E8, #9B6DFF)",
              }}
            >
              <Lightning className="h-4 w-4 text-white" />
            </div>
            <span
              className="font-bold leading-none text-white"
              style={{ fontSize: "1.05rem", letterSpacing: "-0.02em" }}
            >
              ProInterview
            </span>
          </button>
          <div className="ml-auto flex shrink-0 items-center justify-end">{footerNote}</div>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-5 pb-14 pt-6 sm:pt-8">
        <div className="grid w-full max-w-[min(100%,calc(64rem+2.5cm))] grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="flex flex-col justify-start lg:col-span-5">
            <div className="rounded-[2rem] p-8 sm:p-10" style={PI.glass}>
              {children}
            </div>
          </div>

          {aside && (
            <div className="relative z-10 hidden flex-col justify-start lg:col-span-7 lg:flex">
              {aside}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export { PI as PRO_INTERVIEW_BRAND };

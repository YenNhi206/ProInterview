import React from "react";

/** Glass + typography — đồng bộ với `Dashboard.jsx` (customer). */
const DASHBOARD_ALIGNED_STYLES = `
        .glass-card {
           background: linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%);
           backdrop-filter: blur(48px);
           border-radius: 28px;
           border: 1px solid rgba(255, 255, 255, 0.1);
           transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.35s ease, box-shadow 0.45s ease;
           position: relative;
           overflow: hidden;
        }
        .glass-card::before {
           content: '';
           position: absolute;
           inset: 0;
           background: linear-gradient(125deg, rgba(236,72,153,0.08) 0%, transparent 42%, rgba(196, 255, 71,0.06) 100%);
           pointer-events: none;
           opacity: 0.85;
        }
        .glass-card:hover {
           border-color: rgba(196, 255, 71, 0.42);
           transform: translateY(-6px) rotate(-0.3deg);
           box-shadow:
             0 24px 48px rgba(0,0,0,0.45),
             0 0 0 1px rgba(196, 255, 71, 0.12) inset,
             0 0 48px -6px rgba(196, 255, 71, 0.28),
             0 0 36px -10px rgba(167, 139, 250, 0.22);
        }
        .glow-halo {
           position: relative;
           display: flex;
           align-items: center;
           justify-content: center;
        }
        .glow-halo::after {
           content: '';
           position: absolute;
           width: 150%;
           height: 150%;
           background: radial-gradient(circle, rgba(232,121,249,0.35) 0%, rgba(110,53,232,0.15) 40%, transparent 70%);
           border-radius: 50%;
           z-index: -1;
           animation: pulse-halo 3.2s ease-in-out infinite;
        }
        @keyframes pulse-halo {
           0%, 100% { transform: scale(1); opacity: 0.55; }
           50% { transform: scale(1.15); opacity: 0.95; }
        }
        @keyframes shimmer-bg {
           0% { opacity: 0.4; transform: translate(0,0) scale(1); }
           50% { opacity: 0.7; transform: translate(2%, -2%) scale(1.05); }
           100% { opacity: 0.4; transform: translate(0,0) scale(1); }
        }
        .font-headline {
          letter-spacing: -0.045em;
          text-shadow: 0 2px 24px rgba(0,0,0,0.35);
        }
`;

/**
 * Vỏ trang mentor: nền `pi-page-dashboard-bg`, shimmer, glass-card giống customer Dashboard.
 * @param {string} [extraStyles] — CSS bổ sung (vd. tab-btn trên MentorCourseEdit).
 * @param {string} [bottomPad] — lớp padding đáy, mặc định `pb-20`.
 */
export function MentorPageShell({ children, className = "", extraStyles = "", bottomPad = "pb-20" }) {
  return (
    <div
      className={`pi-page-dashboard-bg relative min-h-screen overflow-x-hidden font-sans text-white selection:bg-[rgba(196,255,71,0.28)] selection:text-white ${bottomPad} ${className}`.trim()}
    >
      <style>{`${DASHBOARD_ALIGNED_STYLES}${extraStyles || ""}`}</style>
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-90"
        style={{ animation: "shimmer-bg 14s ease-in-out infinite" }}
        aria-hidden
      >
        <div className="absolute top-[-20%] right-[-10%] h-[70vh] w-[70vh] rounded-full bg-gradient-to-bl from-fuchsia-600/35 via-violet-600/20 to-transparent blur-[100px]" />
        <div className="absolute bottom-[-25%] left-[-15%] h-[85vh] w-[85vh] rounded-full bg-gradient-to-tr from-[#c4ff47]/18 via-cyan-500/10 to-fuchsia-500/20 blur-[110px]" />
        <div className="absolute left-1/2 top-1/2 h-[50vh] w-[50vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#6E35E8]/12 blur-[90px]" />
        <div className="absolute top-[30%] right-[5%] h-[40vh] w-[40vh] rounded-full bg-[#c4ff47]/10 blur-[80px]" />
      </div>
      {children}
    </div>
  );
}

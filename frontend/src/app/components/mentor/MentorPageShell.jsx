import React from "react";

/**
 * Vỏ trang trong app user, nền trong suốt để lớp `app-shell-ambient` (Home) hiện ra;
 * lưới + blur tím nhạt giống họ Home.
 */
const MENTOR_LIGHT_STYLES = `
        .glass-card {
           background: #ffffff;
           backdrop-filter: none;
           border-radius: 20px;
           border: 1px solid rgba(186, 165, 255, 0.38);
           transition: transform 0.3s ease, border-color 0.25s ease, box-shadow 0.3s ease;
           position: relative;
           overflow: hidden;
           box-shadow: 0 8px 18px rgba(128, 55, 244, 0.07);
        }
        .glass-card::before {
           content: none;
        }
        @media (hover: hover) {
        .glass-card:hover {
           border-color: rgba(128, 55, 244, 0.35);
           transform: translateY(-2px);
           box-shadow: 0 12px 28px rgba(128, 55, 244, 0.12);
        }
        }
        .glow-halo {
           position: relative;
           display: flex;
           align-items: center;
           justify-content: center;
        }
        .glow-halo::after {
           content: none;
        }
        @keyframes shimmer-bg {
           0%, 100% { opacity: 0.35; transform: translate(0,0) scale(1); }
           50% { opacity: 0.55; transform: translate(2%, -2%) scale(1.04); }
        }
        .font-headline {
          letter-spacing: -0.045em;
          text-shadow: none;
        }
        /* Nhãn section mentor — TỔNG BUỔI MENTOR style */
        .mentor-label {
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          color: #9494c1;
          line-height: 1.35;
        }
        .mentor-label--on-dark {
          color: #b8b8dc;
        }
        .mentor-label svg {
          color: #9494c1;
          flex-shrink: 0;
        }
        .mentor-label--on-dark svg {
          color: #b8b8dc;
        }
        /* Eyebrow trang — HỆ THỐNG ĐÀO TẠO */
        .mentor-eyebrow {
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: #7c3aed;
          line-height: 1.35;
        }
        .mentor-eyebrow svg {
          color: #7c3aed;
          flex-shrink: 0;
        }
        .mentor-eyebrow--on-dark {
          color: #ddd6fe;
        }
        .mentor-eyebrow--on-dark svg {
          color: #ddd6fe;
        }
        /* Số thống kê — cực đậm (Lexend Black) */
        .mentor-stat-num {
          font-family: var(--font-headline), "Lexend", "Plus Jakarta Sans", system-ui, sans-serif;
          font-weight: 900;
          font-variation-settings: "wght" 900;
          line-height: 1;
          letter-spacing: -0.06em;
          font-variant-numeric: tabular-nums;
          font-feature-settings: "tnum" 1;
          color: #0f172a;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          paint-order: stroke fill;
          -webkit-text-stroke: 0.4px currentColor;
        }
        .mentor-stat-num--hero {
          font-size: 1.75rem;
        }
        .mentor-stat-num--card {
          font-size: 1.375rem;
        }
        .mentor-stat-num--on-dark {
          color: #ffffff;
          -webkit-text-stroke: 0;
        }
        /* Số tiền lớn — không siết letter-spacing / stroke để dấu chấm nghìn vẫn thấy */
        .mentor-stat-num--money {
          letter-spacing: -0.015em;
          -webkit-text-stroke: 0;
          line-height: 1.12;
        }
        .mentor-stat-num--money .money-thousands-sep {
          display: inline-block;
          margin-inline: 0.06em;
          opacity: 0.95;
        }
        @media (min-width: 640px) {
          .mentor-stat-num--hero {
            font-size: 2rem;
          }
        }
        /* Số tiền trong bảng / danh sách — đậm vừa, không phóng to */
        .mentor-money-num {
          font-family: var(--font-headline), "Lexend", "Plus Jakarta Sans", system-ui, sans-serif;
          font-weight: 900;
          font-variation-settings: "wght" 900;
          letter-spacing: -0.015em;
          font-variant-numeric: tabular-nums;
          font-feature-settings: "tnum" 1;
          -webkit-text-stroke: 0;
        }
        .mentor-money-num .money-thousands-sep {
          display: inline-block;
          margin-inline: 0.05em;
          opacity: 0.95;
        }
        /* Nhãn uppercase tiếng Việt, tracking utility mặc định thường quá rộng */
        .mentor-surface .tracking-widest,
        .mentor-surface .tracking-wider,
        .mentor-surface [class*="tracking-[0"] {
          letter-spacing: 0.02em;
        }
        /* primary-fixed = lime CTA (#93f72b); giữ màu token Tailwind */
`;

export function MentorPageShell({
  children,
  className = "",
  extraStyles = "",
  bottomPad = "pb-20",
  fillHeight = false,
  /** false = chỉ dùng app-shell-ambient, không thêm blob/shimmer (tránh nền chia mảng) */
  showAmbient = true,
  /** true = áp typography mentor (phòng họp, feedback ngoài MentorArea) */
  mentorRole = false,
}) {
  const heightBlock = fillHeight
    ? "min-h-0 flex-1 h-full overflow-y-auto overflow-x-clip"
    : "min-h-screen overflow-x-clip";
  return (
    <div
      className={`mentor-surface relative antialiased ${heightBlock} font-sans text-slate-900 selection:bg-violet-100 selection:text-violet-900 bg-transparent ${bottomPad} ${mentorRole ? "mentor-role-shell " : ""}${className}`.trim()}
    >
      <style>{`${MENTOR_LIGHT_STYLES}${extraStyles || ""}`}</style>
      {showAmbient && (
        <>
          <div
            className="pointer-events-none fixed top-0 right-0 h-[min(560px,70vw)] w-[min(560px,70vw)] -translate-y-[12%] translate-x-[6%] rounded-full bg-[#a66ff8]/28 blur-[120px] -z-[1]"
            aria-hidden
          />
          <div
            className="pointer-events-none fixed bottom-0 left-0 h-[min(520px,65vw)] w-[min(520px,65vw)] translate-y-[14%] -translate-x-[8%] rounded-full bg-[#8037f4]/16 blur-[110px] -z-[1]"
            aria-hidden
          />
          <div
            className="pointer-events-none fixed inset-0 -z-[1] opacity-80"
            style={{ animation: "shimmer-bg 14s ease-in-out infinite" }}
            aria-hidden
          />
        </>
      )}
      {children}
    </div>
  );
}

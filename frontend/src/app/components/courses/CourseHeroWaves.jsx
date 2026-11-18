import React, { useMemo } from "react";
import "../../../styles/hero-waves.css";

/**
 * CourseHeroWaves
 * Uiverse-style fluid animated undulating wave ribbons.
 * Replaces the static courses_hero_bg.png with dynamic, silky-smooth
 * glowing SVG wave ribbons matching ProInterview's dark violet + neon lime brand colors.
 */
export function CourseHeroWaves() {
  // Generate stable random particle positions
  const particles = useMemo(
    () => [
      { top: "22%", left: "12%", size: 3, delay: "0s", duration: "4.2s", color: "rgba(168, 85, 247, 0.7)" },
      { top: "35%", left: "28%", size: 2, delay: "1.2s", duration: "5.5s", color: "rgba(147, 247, 43, 0.6)" },
      { top: "68%", left: "20%", size: 3.5, delay: "2.1s", duration: "4.8s", color: "rgba(192, 132, 252, 0.8)" },
      { top: "18%", left: "75%", size: 2.5, delay: "0.7s", duration: "6.0s", color: "rgba(147, 247, 43, 0.5)" },
      { top: "45%", left: "82%", size: 4, delay: "1.8s", duration: "5.2s", color: "rgba(168, 85, 247, 0.7)" },
      { top: "75%", left: "68%", size: 2, delay: "2.6s", duration: "4.5s", color: "rgba(255, 255, 255, 0.6)" },
      { top: "28%", left: "52%", size: 3, delay: "0.4s", duration: "5.8s", color: "rgba(147, 247, 43, 0.7)" },
      { top: "60%", left: "42%", size: 2, delay: "1.5s", duration: "4.9s", color: "rgba(168, 85, 247, 0.5)" },
      { top: "82%", left: "88%", size: 3, delay: "2.2s", duration: "6.2s", color: "rgba(192, 132, 252, 0.6)" },
      { top: "15%", left: "38%", size: 2, delay: "3.1s", duration: "5.0s", color: "rgba(255, 255, 255, 0.5)" },
    ],
    []
  );

  return (
    <div className="hero-waves-wrapper" aria-hidden="true">
      {/* Central ambient glow pulse */}
      <div className="hero-waves-ambient-center" />

      {/* Floating particles */}
      {particles.map((p, idx) => (
        <span
          key={idx}
          className="hero-particle"
          style={{
            top: p.top,
            left: p.left,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            boxShadow: `0 0 8px ${p.color}`,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}

      {/* ── TRACK 1: Main Neon Violet & Magenta Glowing Wave Ribbon ── */}
      <div className="hero-wave-track hero-wave-track-1 hero-wave-float-1">
        <svg
          className="w-full h-full block"
          viewBox="0 0 2880 260"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <defs>
            {/* Linear gradient for purple glowing ribbon stroke */}
            <linearGradient id="wave-stroke-purple" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8037f4" />
              <stop offset="25%" stopColor="#c084fc" />
              <stop offset="50%" stopColor="#e879f9" />
              <stop offset="75%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#8037f4" />
            </linearGradient>

            {/* Translucent fill ribbon gradient */}
            <linearGradient id="wave-fill-purple" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(147, 51, 234, 0.22)" />
              <stop offset="50%" stopColor="rgba(192, 132, 252, 0.12)" />
              <stop offset="100%" stopColor="rgba(128, 55, 244, 0)" />
            </linearGradient>

            {/* Neon Subtle Glow Filter */}
            <filter id="wave-glow-purple" x="-10%" y="-30%" width="120%" height="160%">
              <feGaussianBlur stdDeviation="1.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Delicate purple neon glowing wireframe wave */}
          <path
            d="M 0 115 
               C 240 50, 480 180, 720 115 
               C 960 50, 1200 180, 1440 115 
               C 1680 50, 1920 180, 2160 115 
               C 2400 50, 2640 180, 2880 115"
            stroke="url(#wave-stroke-purple)"
            strokeWidth="1.3"
            filter="url(#wave-glow-purple)"
            strokeLinecap="round"
          />

          {/* Secondary subtle lower dashed harmonic line */}
          <path
            d="M 0 160 
               C 240 95, 480 225, 720 160 
               C 960 95, 1200 225, 1440 160 
               C 1680 95, 1920 225, 2160 160 
               C 2400 95, 2640 225, 2880 160"
            stroke="rgba(192, 132, 252, 0.35)"
            strokeWidth="1"
            strokeDasharray="6 6"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* ── TRACK 2: Counter Lime-Green & Emerald Shimmer Wave ── */}
      <div className="hero-wave-track hero-wave-track-2 hero-wave-float-2">
        <svg
          className="w-full h-full block"
          viewBox="0 0 2880 260"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="wave-stroke-lime" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#93f72b" />
              <stop offset="30%" stopColor="#4ade80" />
              <stop offset="70%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#93f72b" />
            </linearGradient>

            <filter id="wave-glow-lime" x="-10%" y="-30%" width="120%" height="160%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Delicate lime glowing wireframe line */}
          <path
            d="M 0 155 
               C 280 215, 520 85, 720 145 
               C 920 205, 1160 85, 1440 155 
               C 1720 215, 1960 85, 2160 145 
               C 2360 205, 2600 85, 2880 155"
            stroke="url(#wave-stroke-lime)"
            strokeWidth="1.2"
            filter="url(#wave-glow-lime)"
            strokeLinecap="round"
          />

          {/* Secondary subtle lime dashed line */}
          <path
            d="M 0 180 
               C 280 120, 520 240, 720 180 
               C 920 120, 1160 240, 1440 180 
               C 1720 120, 1960 240, 2160 180 
               C 2360 120, 2600 240, 2880 180"
            stroke="rgba(147, 247, 43, 0.3)"
            strokeWidth="0.9"
            strokeDasharray="5 5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* ── TRACK 3: High-frequency Electric Cyan & Violet Accent Wave ── */}
      <div className="hero-wave-track hero-wave-track-3 hero-wave-float-3">
        <svg
          className="w-full h-full block"
          viewBox="0 0 2880 260"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="wave-stroke-cyan" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(56, 189, 248, 0.7)" />
              <stop offset="35%" stopColor="rgba(168, 85, 247, 0.85)" />
              <stop offset="70%" stopColor="rgba(236, 72, 153, 0.7)" />
              <stop offset="100%" stopColor="rgba(56, 189, 248, 0.7)" />
            </linearGradient>
          </defs>

          <path
            d="M 0 135 
               C 360 195, 720 65, 1080 145 
               C 1260 185, 1350 85, 1440 135 
               C 1800 195, 2160 65, 2520 145 
               C 2700 185, 2790 85, 2880 135"
            stroke="url(#wave-stroke-cyan)"
            strokeWidth="1"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}

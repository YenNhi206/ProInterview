import React, { useMemo } from "react";
import "../../../styles/hero-aurora.css";

/**
 * CourseHeroAurora
 * Uiverse-style Aurora Borealis (quầng sáng mờ ảo) + Starfield (hạt sao lấp lánh).
 * Designed for ProInterview dark violet + neon lime brand aesthetics.
 */
export function CourseHeroAurora() {
  // Stable random starfield
  const stars = useMemo(
    () => [
      { top: "12%", left: "8%", size: 2.5, delay: "0.2s", duration: "3.8s", color: "#c084fc", glow: "rgba(192, 132, 252, 0.8)" },
      { top: "24%", left: "18%", size: 3, delay: "1.1s", duration: "4.5s", color: "#93f72b", glow: "rgba(147, 247, 43, 0.9)" },
      { top: "15%", left: "32%", size: 2, delay: "2.4s", duration: "5.1s", color: "#ffffff", glow: "rgba(255, 255, 255, 0.7)" },
      { top: "42%", left: "10%", size: 3.5, delay: "0.8s", duration: "4.2s", color: "#38bdf8", glow: "rgba(56, 189, 248, 0.8)" },
      { top: "68%", left: "15%", size: 2, delay: "1.7s", duration: "3.9s", color: "#c084fc", glow: "rgba(192, 132, 252, 0.7)" },
      { top: "82%", left: "26%", size: 2.5, delay: "2.9s", duration: "4.8s", color: "#93f72b", glow: "rgba(147, 247, 43, 0.7)" },
      { top: "18%", left: "68%", size: 3, delay: "0.5s", duration: "4.6s", color: "#ffffff", glow: "rgba(255, 255, 255, 0.8)" },
      { top: "32%", left: "85%", size: 2, delay: "1.9s", duration: "5.3s", color: "#c084fc", glow: "rgba(192, 132, 252, 0.7)" },
      { top: "55%", left: "78%", size: 3.5, delay: "0.3s", duration: "4.0s", color: "#93f72b", glow: "rgba(147, 247, 43, 0.9)" },
      { top: "75%", left: "88%", size: 2, delay: "2.1s", duration: "4.7s", color: "#38bdf8", glow: "rgba(56, 189, 248, 0.7)" },
      { top: "86%", left: "70%", size: 2.5, delay: "1.4s", duration: "3.6s", color: "#ffffff", glow: "rgba(255, 255, 255, 0.7)" },
      { top: "20%", left: "50%", size: 2, delay: "2.8s", duration: "5.0s", color: "#c084fc", glow: "rgba(192, 132, 252, 0.6)" },
      { top: "72%", left: "48%", size: 3, delay: "0.9s", duration: "4.4s", color: "#93f72b", glow: "rgba(147, 247, 43, 0.8)" },
    ],
    []
  );

  // 4-point Sparkle stars
  const sparkles = useMemo(
    () => [
      { top: "18%", left: "22%", size: 20, delay: "0s", color: "#93f72b" },
      { top: "28%", left: "76%", size: 24, delay: "2s", color: "#c084fc" },
      { top: "78%", left: "34%", size: 18, delay: "1.2s", color: "#38bdf8" },
      { top: "65%", left: "82%", size: 22, delay: "3.2s", color: "#93f72b" },
    ],
    []
  );

  return (
    <div className="hero-aurora-wrapper" aria-hidden="true">
      {/* Background star-matrix dots */}
      <div className="hero-aurora-dots" />

      {/* Floating Aurora Mesh Orbs */}
      <div className="aurora-orb aurora-orb-1" />
      <div className="aurora-orb aurora-orb-2" />
      <div className="aurora-orb aurora-orb-3" />
      <div className="aurora-orb aurora-orb-4" />

      {/* Horizontal Aurora Light Beam */}
      <div className="aurora-curtain" />

      {/* Starfield Particles */}
      {stars.map((s, idx) => (
        <span
          key={`star-${idx}`}
          className="aurora-star"
          style={{
            top: s.top,
            left: s.left,
            width: `${s.size}px`,
            height: `${s.size}px`,
            backgroundColor: s.color,
            boxShadow: `0 0 10px ${s.glow}`,
            animationDelay: s.delay,
            animationDuration: s.duration,
          }}
        />
      ))}

      {/* 4-point Sparkle Stars */}
      {sparkles.map((sp, idx) => (
        <svg
          key={`sparkle-${idx}`}
          className="aurora-sparkle"
          viewBox="0 0 24 24"
          fill="none"
          style={{
            top: sp.top,
            left: sp.left,
            width: `${sp.size}px`,
            height: `${sp.size}px`,
            animationDelay: sp.delay,
            filter: `drop-shadow(0 0 6px ${sp.color})`,
          }}
        >
          <path
            d="M12 0 C12 7, 17 12, 24 12 C17 12, 12 17, 12 24 C12 17, 7 12, 0 12 C7 12, 12 7, 12 0 Z"
            fill={sp.color}
          />
        </svg>
      ))}
    </div>
  );
}

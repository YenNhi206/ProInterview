import React, { useMemo } from "react";
import "../../../styles/hero-mentor-atmosphere.css";

/**
 * MentorHeroAtmosphere
 * Unique Celestial & Orbital Atmosphere for /mentors
 * Replaces horizontal waves with rotating perspective orbital rings,
 * vertical aurora beams, and twinkling constellation stars.
 * 100% transparent background so it seamlessly unites with the app shell.
 */
export function MentorHeroAtmosphere() {
  const stars = useMemo(
    () => [
      { top: "18%", left: "14%", size: 3, delay: "0.2s", duration: "4.2s", color: "#8037f4" },
      { top: "28%", left: "22%", size: 2, delay: "1.4s", duration: "3.6s", color: "#c084fc" },
      { top: "68%", left: "12%", size: 3.5, delay: "0.8s", duration: "4.8s", color: "#93f72b" },
      { top: "82%", left: "24%", size: 2.5, delay: "2.1s", duration: "3.9s", color: "#8037f4" },
      { top: "22%", left: "78%", size: 3, delay: "0.5s", duration: "4.4s", color: "#93f72b" },
      { top: "32%", left: "86%", size: 2.5, delay: "1.8s", duration: "3.7s", color: "#a855f7" },
      { top: "72%", left: "82%", size: 3.5, delay: "1.1s", duration: "5.1s", color: "#8037f4" },
      { top: "84%", left: "74%", size: 2, delay: "2.5s", duration: "4.0s", color: "#c084fc" },
      { top: "15%", left: "48%", size: 2.5, delay: "0.9s", duration: "3.5s", color: "#ffffff" },
    ],
    []
  );

  return (
    <div className="mentor-atmo-wrapper" aria-hidden="true">
      {/* 1. Lưới chân trời tạo chiều sâu không gian (Horizon Depth Grid) */}
      <div className="mentor-atmo-horizon" />

      {/* 2. Cột ánh sáng cực quang 2 bên cánh (Vertical Aurora Beams) */}
      <div className="mentor-atmo-beam-left" />
      <div className="mentor-atmo-beam-right" />

      {/* 3. Vòng quỹ đạo đồng tâm nghiêng 3D (3D Perspective Career Orbits) */}
      <div className="mentor-atmo-orbit-container">
        <div className="mentor-atmo-ring-1" />
        <div className="mentor-atmo-ring-2" />
        <div className="mentor-atmo-ring-3" />
      </div>

      {/* 4. Quầng sáng tụ trung tâm (Focal Ambient Glow) */}
      <div className="mentor-atmo-halo" />

      {/* 5. Chòm sao lấp lánh (Twinkling Constellation Stars) */}
      {stars.map((s, i) => (
        <span
          key={`atmo-star-${i}`}
          className="mentor-atmo-star"
          style={{
            top: s.top,
            left: s.left,
            width: `${s.size}px`,
            height: `${s.size}px`,
            backgroundColor: s.color,
            boxShadow: `0 0 8px ${s.color}`,
            animationDelay: s.delay,
            animationDuration: s.duration,
          }}
        />
      ))}

      {/* 6. Điểm sáng chữ thập định vị (Celestial Guidance Flares) */}
      <svg
        className="mentor-atmo-flare"
        style={{ top: "24%", left: "18%", width: "24px", height: "24px" }}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path d="M12 0L12 24M0 12L24 12" stroke="rgba(192, 132, 252, 0.45)" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="3" fill="#c084fc" />
      </svg>

      <svg
        className="mentor-atmo-flare"
        style={{ top: "26%", right: "18%", width: "24px", height: "24px", animationDelay: "2.5s" }}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path d="M12 0L12 24M0 12L24 12" stroke="rgba(147, 247, 43, 0.45)" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="3" fill="#93f72b" />
      </svg>
    </div>
  );
}

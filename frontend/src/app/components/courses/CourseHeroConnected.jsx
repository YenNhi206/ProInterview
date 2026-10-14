import React, { useMemo } from "react";
import "../../../styles/hero-connected.css";

/**
 * CourseHeroConnected
 * Smooth flowing Skill Waves + Subtle Knowledge Tech Grid + Seamless Bottom Blend.
 * Perfectly connects the top hero banner with the course catalog & cards below.
 */
export function CourseHeroConnected() {
  // Micro data/knowledge nodes (ở hai bên cánh và phía dưới, không đè lên chữ)
  const nodes = useMemo(
    () => [
      { top: "68%", left: "8%", size: 3, delay: "0s", duration: "4.2s", color: "#8037f4" },
      { top: "78%", left: "18%", size: 2.5, delay: "1.4s", duration: "5.0s", color: "#93f72b" },
      { top: "82%", left: "12%", size: 3, delay: "2.1s", duration: "4.6s", color: "#c084fc" },
      { top: "66%", left: "84%", size: 3, delay: "0.6s", duration: "5.3s", color: "#93f72b" },
      { top: "76%", left: "90%", size: 2.5, delay: "1.8s", duration: "4.1s", color: "#8037f4" },
      { top: "84%", left: "82%", size: 3, delay: "2.5s", duration: "4.9s", color: "#a855f7" },
    ],
    []
  );

  return (
    <div className="hero-connected-wrapper" aria-hidden="true">
      {/* 1. Lưới tri thức công nghệ chìm (Skill & Curriculum Grid) */}
      <div className="hero-connected-grid" />

      {/* 2. Quầng sáng ambient tụ vào tiêu đề & ô tìm kiếm */}
      <div className="hero-connected-ambient" />

      {/* 3. Các điểm nút kết nối tri thức (Micro Tech Nodes) */}
      {nodes.map((n, i) => (
        <span
          key={`node-${i}`}
          className="hero-knode"
          style={{
            top: n.top,
            left: n.left,
            width: `${n.size}px`,
            height: `${n.size}px`,
            backgroundColor: n.color,
            boxShadow: `0 0 10px ${n.color}`,
            animationDelay: n.delay,
            animationDuration: n.duration,
          }}
        />
      ))}

      {/* 4. TRACK 1: Dải sóng tri thức tím neon (Knowledge & Mentorship Wave) */}
      <div className="hero-cwave-track hero-cwave-track-1 hero-cwave-bob-1">
        <svg
          className="w-full h-full block"
          viewBox="0 0 2880 260"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="cwave-grad-purple" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8037f4" />
              <stop offset="25%" stopColor="#a855f7" />
              <stop offset="50%" stopColor="#c084fc" />
              <stop offset="75%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#8037f4" />
            </linearGradient>

            <linearGradient id="cwave-ribbon-purple" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(128, 55, 244, 0.22)" />
              <stop offset="60%" stopColor="rgba(168, 85, 247, 0.08)" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>

            <filter id="cwave-glow-purple" x="-10%" y="-30%" width="120%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Dải ribbon chuyển sắc mờ ảo */}
          <path
            d="M 0 120 
               C 240 55, 480 185, 720 120 
               C 960 55, 1200 185, 1440 120 
               C 1680 55, 1920 185, 2160 120 
               C 2400 55, 2640 185, 2880 120 
               L 2880 165 
               C 2640 230, 2400 100, 2160 165 
               C 1920 230, 1680 100, 1440 165 
               C 1200 230, 960 100, 720 165 
               C 480 230, 240 100, 0 165 Z"
            fill="url(#cwave-ribbon-purple)"
          />

          {/* Đường sóng neon tím sắc nét */}
          <path
            d="M 0 120 
               C 240 55, 480 185, 720 120 
               C 960 55, 1200 185, 1440 120 
               C 1680 55, 1920 185, 2160 120 
               C 2400 55, 2640 185, 2880 120"
            stroke="url(#cwave-grad-purple)"
            strokeWidth="2.5"
            filter="url(#cwave-glow-purple)"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* 5. TRACK 2: Dải sóng xanh lime (Đồng bộ với nút Tìm kiếm & Badge Intermediate các khóa học) */}
      <div className="hero-cwave-track hero-cwave-track-2 hero-cwave-bob-2">
        <svg
          className="w-full h-full block"
          viewBox="0 0 2880 260"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="cwave-grad-lime" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#93f72b" />
              <stop offset="35%" stopColor="#4ade80" />
              <stop offset="70%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#93f72b" />
            </linearGradient>

            <filter id="cwave-glow-lime" x="-10%" y="-30%" width="120%" height="160%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Đường sóng xanh neon giao thoa với sóng tím */}
          <path
            d="M 0 150 
               C 280 210, 520 80, 720 140 
               C 920 200, 1160 80, 1440 150 
               C 1720 210, 1960 80, 2160 140 
               C 2360 200, 2600 80, 2880 150"
            stroke="url(#cwave-grad-lime)"
            strokeWidth="2"
            filter="url(#cwave-glow-lime)"
            strokeLinecap="round"
            opacity="0.85"
          />
        </svg>
      </div>

      {/* 6. TRACK 3: Sóng chiều sâu bổ trợ (Subtle Depth Wave) */}
      <div className="hero-cwave-track hero-cwave-track-3">
        <svg
          className="w-full h-full block"
          viewBox="0 0 2880 260"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <path
            d="M 0 135 
               C 360 195, 720 65, 1080 145 
               C 1260 185, 1350 85, 1440 135 
               C 1800 195, 2160 65, 2520 145 
               C 2700 185, 2790 85, 2880 135"
            stroke="rgba(168, 85, 247, 0.4)"
            strokeWidth="1.2"
            strokeDasharray="6 8"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* 7. Dải chuyển tiếp đáy (Bottom Blend Overlay) - Hòa tan liền mạch vào nền danh sách khóa học */}
      <div className="hero-bottom-blend" />
    </div>
  );
}

import React, { useMemo } from "react";

/**
 * InterviewHeroAtmosphere
 * Specialized voice-wave, neural audio equalizer and ambient cosmic aura for /interview.
 * Connects the top hero with the studio workspace seamlessly.
 */
export function InterviewHeroAtmosphere() {
  const nodes = useMemo(
    () => [
      { top: "18%", left: "10%", size: 3, delay: "0.2s", duration: "4.2s", color: "#8037f4" },
      { top: "25%", left: "20%", size: 2.5, delay: "1.4s", duration: "3.6s", color: "#93f72b" },
      { top: "65%", left: "8%", size: 3.5, delay: "0.8s", duration: "4.8s", color: "#c084fc" },
      { top: "78%", left: "18%", size: 2.5, delay: "2.1s", duration: "3.9s", color: "#8037f4" },
      { top: "20%", left: "82%", size: 3, delay: "0.5s", duration: "4.4s", color: "#93f72b" },
      { top: "30%", left: "90%", size: 2.5, delay: "1.8s", duration: "3.7s", color: "#a855f7" },
      { top: "70%", left: "85%", size: 3.5, delay: "1.1s", duration: "5.1s", color: "#8037f4" },
      { top: "82%", left: "78%", size: 2, delay: "2.5s", duration: "4.0s", color: "#c084fc" },
      { top: "14%", left: "52%", size: 2.5, delay: "0.9s", duration: "3.5s", color: "#ffffff" },
    ],
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      {/* 1. Deep grid overlay */}
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(128, 55, 244, 0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(128, 55, 244, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black 20%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black 20%, transparent 80%)",
        }}
      />

      {/* 2. Top-left violet aurora beam */}
      <div className="absolute -top-24 left-[5%] h-[480px] w-[380px] rounded-full bg-gradient-to-br from-violet-600/20 via-indigo-600/10 to-transparent blur-3xl" />

      {/* 3. Top-right neon lime glow */}
      <div className="absolute -top-28 right-[5%] h-[420px] w-[360px] rounded-full bg-gradient-to-bl from-[#93f72b]/15 via-purple-600/10 to-transparent blur-3xl" />

      {/* 4. Center soundwave pulse halo */}
      <div className="absolute left-1/2 top-32 h-[300px] w-[620px] -translate-x-1/2 rounded-full bg-radial from-violet-500/15 via-[#93f72b]/5 to-transparent blur-2xl" />

      {/* 5. Floating interactive tech nodes */}
      {nodes.map((n, i) => (
        <span
          key={`node-${i}`}
          className="absolute rounded-full transition-transform"
          style={{
            top: n.top,
            left: n.left,
            width: `${n.size}px`,
            height: `${n.size}px`,
            backgroundColor: n.color,
            boxShadow: `0 0 10px ${n.color}`,
            opacity: 0.75,
          }}
        />
      ))}

      {/* 6. Subtle horizontal sound frequency line */}
      <div className="absolute top-[220px] inset-x-0 h-px bg-gradient-to-r from-transparent via-[#93f72b]/20 to-transparent opacity-60" />
    </div>
  );
}

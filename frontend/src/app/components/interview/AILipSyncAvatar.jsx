/**
 * AILipSyncAvatar — SVG Cartoon Face + Lip Sync
 * ──────────────────────────────────────────────────────────────
 * Dùng đúng cách demo (AvatarInterviewerSimple): vẽ face bằng SVG
 * elements, animate mouthRy theo openness → 100% smooth, không cần
 * canvas, không cần CORS, không cần Web Audio API.
 *
 * Pipeline:
 *   isSpeaking=true → useSpeechWave() sinh sin-wave multifreq
 *                   → openness 0..1 → mouthRy = base + openness*amp
 *   isSpeaking=false → openness fade về 0 → mouth đóng lại
 *
 * Ưu tiên render:
 *   1. D-ID WebRTC video  (opacity=1 khi connected/speaking)
 *   2. SVG Cartoon face   (luôn có, dưới video layer)
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import { type DIDStatus } from "../hooks/useDIDStream";

/* ── Props ────────────────────────────────────────────────── */

/* ══════════════════════════════════════════════════════════
   useSpeechWave — multi-freq sin-wave, pure, always works
   Frequency ratios irrational → pattern never repeats exactly
   Mimics natural speech: syllable burst + phrase rhythm
══════════════════════════════════════════════════════════ */
function useSpeechWave(isSpeaking) {
  const opRef    = useRef(0);
  const phaseRef = useRef(0);
  const rafRef   = useRef(0);

  const getOpenness = useCallback(() => opRef.current, []);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);

    if (!isSpeaking) {
      const fade = () => {
        opRef.current *= 0.87;
        if (opRef.current > 0.003) rafRef.current = requestAnimationFrame(fade);
        else opRef.current = 0;
      };
      rafRef.current = requestAnimationFrame(fade);
      return () => cancelAnimationFrame(rafRef.current);
    }

    const tick = () => {
      phaseRef.current += 0.27;
      const p = phaseRef.current;
      const raw =
        Math.sin(p)        * 0.42 +
        Math.sin(p * 2.37) * 0.27 +
        Math.sin(p * 0.47) * 0.17 +
        Math.sin(p * 5.41) * 0.10 +
        Math.sin(p * 0.19) * 0.07;
      const target = Math.max(0, raw) * 0.93;
      const t = target > opRef.current ? 0.42 : 0.22;
      opRef.current += (target - opRef.current) * t;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isSpeaking]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);
  return getOpenness;
}

/* ══════════════════════════════════════════════════════════
   useAnimFrame — poll openness ref → React state at ~30fps
   Simple: luôn chạy, useSpeechWave tự fade về 0 khi !isSpeaking
══════════════════════════════════════════════════════════ */
function useAnimFrame(getOpenness: () => number) {
  const [openness, setOpenness] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setOpenness(getOpenness()), 33);
    return () => clearInterval(id);
  }, [getOpenness]);
  return openness;
}

/* ══════════════════════════════════════════════════════════
   useBlink — natural eye blink every 2.5-5s
══════════════════════════════════════════════════════════ */
function useBlink() {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const schedule = () => {
      t = setTimeout(() => {
        setBlink(true);
        setTimeout(() => { setBlink(false); schedule(); }, 120);
      }, 2500 + Math.random() * 2500);
    };
    schedule();
    return () => clearTimeout(t);
  }, []);
  return blink;
}

/* ══════════════════════════════════════════════════════════
   useScanLine — holographic overlay phase (0→1 loop)
══════════════════════════════════════════════════════════ */
function useScanLine() {
  const [t, setT] = useState(0);
  useEffect(() => {
    let v = 0;
    const id = setInterval(() => { v = (v + 0.0055) % 1; setT(v); }, 16);
    return () => clearInterval(id);
  }, []);
  return t;
}

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════ */
export function AILipSyncAvatar({
  isSpeaking,
  didStatus,
  attachVideo,
  size = 200,
}) {
  const getOpenness  = useSpeechWave(isSpeaking);
  const openness     = useAnimFrame(getOpenness);
  const blink        = useBlink();
  const scanLine     = useScanLine();

  const isVideoMode  = didStatus === "connected" || didStatus === "speaking";
  const isConnecting = didStatus === "connecting";

  /* ── Geometry ─────────────────────────────────────────── */
  const R  = size / 2;
  const fR = R * 0.84;          // face circle radius
  const cx = R, cy = R;         // canvas center

  /* Face center sits slightly above canvas center */
  const fH = cy - fR * 0.04;

  /* Head oval */
  const hRx = fR * 0.78;
  const hRy = fR * 0.86;

  /* Eyes */
  const eyeY  = fH - fR * 0.17;
  const eyeLX = cx - fR * 0.285;
  const eyeRX = cx + fR * 0.285;
  const eyeRxV = fR * 0.152;
  const eyeRyV = blink ? fR * 0.022 : fR * 0.132;
  const pupR   = fR * 0.072;

  /* Brows */
  const browY  = eyeY - fR * 0.152;
  const browLift = isSpeaking ? fR * 0.028 : 0;

  /* Nose */
  const noseY = fH + fR * 0.08;

  /* Mouth — key animation */
  const mouthY  = fH + fR * 0.345;
  const mouthRx = fR * 0.262;
  /* ry = base(closed) + openness * amplitude */
  const mouthRy = fR * (0.052 + openness * 0.235);

  /* Scan line */
  const scanY = cy - fR + scanLine * fR * 2;

  /* Ring pulse driven by openness */
  const ringPulse = isSpeaking ? openness : 0;

  /* Colors */
  const rimStroke = isSpeaking
    ? `rgba(139, 77, 255,${(0.50 + ringPulse * 0.42).toFixed(3)})`
    : "rgba(110, 53, 232,0.28)";
  const ctaStroke = isSpeaking
    ? `rgba(180,240,0,${(0.48 + ringPulse * 0.44).toFixed(3)})`
    : "rgba(139, 77, 255,0.18)";
  const dotBg = isVideoMode
    ? (isSpeaking ? "#c4ff47" : "#22c55e")
    : isConnecting ? "#f59e0b" : "#6E35E8";

  /* Unique IDs per size instance */
  const uid = `av${size}`;

  return (
    <div style={{ position: "relative", width: size, height: size }}>

      {/* ── D-ID WebRTC video (primary when key configured) ── */}
      <video
        ref={attachVideo}
        autoPlay
        playsInline
        style={{
          position: "absolute", inset: 0,
          width: size, height: size,
          borderRadius: "50%",
          objectFit: "cover", objectPosition: "center top",
          opacity: isVideoMode ? 1 : 0,
          transition: "opacity 0.5s ease",
          zIndex: 2,
          background: "#0d0820",
        }}
      />

      {/* ════════════════════════════════════════════════════
          MAIN SVG — cartoon face + rings + effects
          Everything in one SVG, face clipped to circle
      ════════════════════════════════════════════════════ */}
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size} height={size}
        style={{
          position: "absolute", inset: 0,
          zIndex: isVideoMode ? 0 : 3,
          overflow: "visible",
          pointerEvents: "none",
          opacity: isVideoMode ? 0 : 1,
          transition: "opacity 0.5s ease",
        }}
      >
        <defs>
          {/* Circle clip for face */}
          <clipPath id={`${uid}clip`}>
            <circle cx={cx} cy={cy} r={fR} />
          </clipPath>

          {/* Glow filter for rings */}
          <filter id={`${uid}glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={size * 0.023} result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          {/* Ambient aura gradient */}
          <radialGradient id={`${uid}aura`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#8B4DFF"
              stopOpacity={isSpeaking ? (0.22 + ringPulse * 0.28).toFixed(3) : "0.07"} />
            <stop offset="100%" stopColor="#6E35E8" stopOpacity="0" />
          </radialGradient>

          {/* Lip gradient */}
          <linearGradient id={`${uid}lip`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#d47878" />
            <stop offset="50%"  stopColor="#b05050" />
            <stop offset="100%" stopColor="#8b3535" />
          </linearGradient>

          {/* Skin highlight */}
          <radialGradient id={`${uid}skin`} cx="40%" cy="30%" r="60%">
            <stop offset="0%"   stopColor="#fde8cc" />
            <stop offset="100%" stopColor="#e8c5a0" />
          </radialGradient>

          {/* Hair gradient */}
          <linearGradient id={`${uid}hair`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#2a1008" />
            <stop offset="100%" stopColor="#1a0808" />
          </linearGradient>

          {/* Clothes gradient */}
          <linearGradient id={`${uid}blazer`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#6E35E8" />
            <stop offset="100%" stopColor="#8B4DFF" />
          </linearGradient>

          {/* Eye iris gradient */}
          <radialGradient id={`${uid}iris`} cx="35%" cy="30%" r="65%">
            <stop offset="0%"   stopColor="#4a3090" />
            <stop offset="60%"  stopColor="#1a1a3e" />
            <stop offset="100%" stopColor="#0a0a1a" />
          </radialGradient>
        </defs>

        {/* ── Ambient aura (outside face circle) ─────────── */}
        <circle cx={cx} cy={cy} r={fR + size * 0.22}
          fill={`url(#${uid}aura)`} />

        {/* ══════════════════════════════════════════════════
            FACE — all elements clipped to circle
        ══════════════════════════════════════════════════ */}
        <g clipPath={`url(#${uid}clip)`}>

          {/* Background: dark studio */}
          <rect x={0} y={0} width={size} height={size} fill="#0d0820" />

          {/* Subtle top-down studio light */}
          <ellipse cx={cx} cy={cy - fR * 0.55} rx={fR * 0.85} ry={fR * 0.45}
            fill="rgba(180,160,255,0.06)" />

          {/* ── Clothes / blazer (behind neck) ──────────── */}
          <ellipse
            cx={cx} cy={cy + fR * 0.88}
            rx={fR * 1.05} ry={fR * 0.52}
            fill={`url(#${uid}blazer)`}
          />
          {/* Collar detail */}
          <path
            d={`M ${cx - fR*0.18} ${fH + hRy*0.76}
                L ${cx - fR*0.08} ${fH + hRy*0.92}
                L ${cx} ${fH + hRy*0.82}
                L ${cx + fR*0.08} ${fH + hRy*0.92}
                L ${cx + fR*0.18} ${fH + hRy*0.76}`}
            fill="rgba(255,255,255,0.12)"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="0.5"
          />

          {/* ── Neck ────────────────────────────────────── */}
          <rect
            x={cx - fR * 0.17} y={fH + hRy * 0.74}
            width={fR * 0.34} height={fR * 0.42}
            fill="#e8c5a0" rx={fR * 0.04}
          />
          {/* Neck shadow */}
          <ellipse cx={cx} cy={fH + hRy * 0.80}
            rx={fR * 0.13} ry={fR * 0.055}
            fill="rgba(0,0,0,0.12)" />

          {/* ── Hair back ───────────────────────────────── */}
          <ellipse
            cx={cx} cy={fH - hRy * 0.08}
            rx={hRx + fR * 0.055} ry={hRy * 0.94}
            fill={`url(#${uid}hair)`}
          />

          {/* ── Head / face oval ────────────────────────── */}
          <ellipse cx={cx} cy={fH} rx={hRx} ry={hRy}
            fill={`url(#${uid}skin)`} />

          {/* ── Hair front (overlaps forehead top) ──────── */}
          <path
            d={`M ${cx - hRx - fR*0.02} ${fH - hRy*0.22}
                Q ${cx - hRx*0.7} ${fH - hRy*1.02}
                  ${cx - fR*0.1}  ${fH - hRy*1.04}
                Q ${cx + fR*0.1}  ${fH - hRy*1.04}
                  ${cx + hRx*0.7} ${fH - hRy*1.02}
                Q ${cx + hRx + fR*0.02} ${fH - hRy*0.22}
                  ${cx + hRx + fR*0.02} ${fH - hRy*0.22}`}
            fill={`url(#${uid}hair)`}
          />
          {/* Hairline curve */}
          <path
            d={`M ${cx - hRx*0.65} ${fH - hRy*0.62}
                Q ${cx} ${fH - hRy*0.78}
                  ${cx + hRx*0.65} ${fH - hRy*0.62}`}
            fill={`url(#${uid}hair)`}
          />

          {/* ── Cheek blush ─────────────────────────────── */}
          <ellipse cx={cx - hRx * 0.60} cy={fH + fR * 0.14}
            rx={fR * 0.155} ry={fR * 0.085}
            fill="rgba(235,120,100,0.10)" />
          <ellipse cx={cx + hRx * 0.60} cy={fH + fR * 0.14}
            rx={fR * 0.155} ry={fR * 0.085}
            fill="rgba(235,120,100,0.10)" />

          {/* ── Left eyebrow ─────────────────────────────── */}
          <path
            d={`M ${eyeLX - fR*0.20} ${browY - browLift + fR*0.022}
                Q ${eyeLX}           ${browY - browLift - fR*0.008}
                  ${eyeLX + fR*0.20} ${browY - browLift + fR*0.018}`}
            stroke={`url(#${uid}hair)`}
            strokeWidth={fR * 0.055}
            strokeLinecap="round"
            fill="none"
            style={{ transition: "d 0.15s" }}
          />

          {/* ── Right eyebrow ────────────────────────────── */}
          <path
            d={`M ${eyeRX - fR*0.20} ${browY - browLift + fR*0.018}
                Q ${eyeRX}           ${browY - browLift - fR*0.008}
                  ${eyeRX + fR*0.20} ${browY - browLift + fR*0.022}`}
            stroke={`url(#${uid}hair)`}
            strokeWidth={fR * 0.055}
            strokeLinecap="round"
            fill="none"
            style={{ transition: "d 0.15s" }}
          />

          {/* ── Left eye ─────────────────────────────────── */}
          {/* Eye white */}
          <ellipse cx={eyeLX} cy={eyeY} rx={eyeRxV} ry={eyeRyV}
            fill="#fff"
            style={{ transition: "ry 0.09s ease" }}
          />
          {/* Iris + pupil */}
          {!blink && (
            <>
              <ellipse cx={eyeLX + fR*0.012} cy={eyeY + fR*0.008}
                rx={pupR * 1.15} ry={pupR * 1.15}
                fill={`url(#${uid}iris)`} />
              {/* Pupil */}
              <circle cx={eyeLX + fR*0.012} cy={eyeY + fR*0.008}
                r={pupR * 0.62} fill="#05050f" />
              {/* Catchlight */}
              <circle cx={eyeLX + fR*0.048} cy={eyeY - fR*0.028}
                r={pupR * 0.35} fill="#fff" opacity="0.90" />
              <circle cx={eyeLX - fR*0.018} cy={eyeY + fR*0.025}
                r={pupR * 0.15} fill="#fff" opacity="0.50" />
            </>
          )}
          {/* Eyelid shadow */}
          <ellipse cx={eyeLX} cy={eyeY - eyeRyV * 0.55}
            rx={eyeRxV * 0.92} ry={eyeRyV * 0.28}
            fill="rgba(0,0,0,0.12)" />

          {/* ── Right eye ────────────────────────────────── */}
          <ellipse cx={eyeRX} cy={eyeY} rx={eyeRxV} ry={eyeRyV}
            fill="#fff"
            style={{ transition: "ry 0.09s ease" }}
          />
          {!blink && (
            <>
              <ellipse cx={eyeRX + fR*0.012} cy={eyeY + fR*0.008}
                rx={pupR * 1.15} ry={pupR * 1.15}
                fill={`url(#${uid}iris)`} />
              <circle cx={eyeRX + fR*0.012} cy={eyeY + fR*0.008}
                r={pupR * 0.62} fill="#05050f" />
              <circle cx={eyeRX + fR*0.048} cy={eyeY - fR*0.028}
                r={pupR * 0.35} fill="#fff" opacity="0.90" />
              <circle cx={eyeRX - fR*0.018} cy={eyeY + fR*0.025}
                r={pupR * 0.15} fill="#fff" opacity="0.50" />
            </>
          )}
          <ellipse cx={eyeRX} cy={eyeY - eyeRyV * 0.55}
            rx={eyeRxV * 0.92} ry={eyeRyV * 0.28}
            fill="rgba(0,0,0,0.12)" />

          {/* ── Nose ─────────────────────────────────────── */}
          {/* Bridge */}
          <path
            d={`M ${cx - fR*0.03} ${noseY - fR*0.12}
                Q ${cx - fR*0.055} ${noseY + fR*0.04}
                  ${cx - fR*0.072} ${noseY + fR*0.10}
                Q ${cx - fR*0.042} ${noseY + fR*0.115}
                  ${cx}            ${noseY + fR*0.10}
                Q ${cx + fR*0.042} ${noseY + fR*0.115}
                  ${cx + fR*0.072} ${noseY + fR*0.10}
                Q ${cx + fR*0.055} ${noseY + fR*0.04}
                  ${cx + fR*0.03}  ${noseY - fR*0.12}`}
            fill="#e0b898"
            stroke="rgba(0,0,0,0.05)"
            strokeWidth="0.5"
          />
          {/* Nostril shadows */}
          <ellipse cx={cx - fR*0.065} cy={noseY + fR*0.105}
            rx={fR*0.038} ry={fR*0.030}
            fill="#c9a080" />
          <ellipse cx={cx + fR*0.065} cy={noseY + fR*0.105}
            rx={fR*0.038} ry={fR*0.030}
            fill="#c9a080" />

          {/* ── MOUTH — THE KEY LIP SYNC ELEMENT ────────── */}
          {/* Same approach: animate ry */}

          {/* Outer lips */}
          <ellipse
            cx={cx} cy={mouthY}
            rx={mouthRx} ry={mouthRy}
            fill={`url(#${uid}lip)`}
            style={{ transition: "ry 0.04s ease" }}
          />

          {/* Mouth cavity (dark interior) */}
          {openness > 0.04 && (
            <ellipse
              cx={cx} cy={mouthY + mouthRy * 0.08}
              rx={mouthRx * 0.80}
              ry={Math.max(mouthRy * 0.58, 0.5)}
              fill="#2a0808"
              style={{ transition: "ry 0.04s ease" }}
            />
          )}

          {/* Upper teeth */}
          {openness > 0.08 && (
            <ellipse
              cx={cx} cy={mouthY - mouthRy * 0.22}
              rx={mouthRx * 0.64}
              ry={Math.min(mouthRy * 0.36, fR * 0.062)}
              fill="#f5f0ea"
              style={{ transition: "all 0.04s ease" }}
            />
          )}

          {/* Lower teeth (shows more when wide open) */}
          {openness > 0.22 && (
            <ellipse
              cx={cx} cy={mouthY + mouthRy * 0.62}
              rx={mouthRx * 0.50}
              ry={Math.min(mouthRy * 0.22, fR * 0.04)}
              fill="#ede8e0"
              opacity="0.75"
              style={{ transition: "all 0.04s ease" }}
            />
          )}

          {/* Upper lip line (darker stripe above mouth ellipse) */}
          <path
            d={`M ${cx - mouthRx * 0.95} ${mouthY}
                Q ${cx - mouthRx * 0.45} ${mouthY - mouthRy * 0.62}
                  ${cx}                  ${mouthY - mouthRy * 0.70}
                Q ${cx + mouthRx * 0.45} ${mouthY - mouthRy * 0.62}
                  ${cx + mouthRx * 0.95} ${mouthY}`}
            stroke="#8b3535"
            strokeWidth={fR * 0.028}
            strokeLinecap="round"
            fill="none"
            opacity="0.60"
          />

          {/* Mouth corners */}
          <circle cx={cx - mouthRx * 0.90} cy={mouthY}
            r={fR * 0.022} fill="#a04040" opacity="0.65" />
          <circle cx={cx + mouthRx * 0.90} cy={mouthY}
            r={fR * 0.022} fill="#a04040" opacity="0.65" />

          {/* ── Holographic scan line ─────────────────────── */}
          <rect
            x={cx - fR} y={scanY - size * 0.013}
            width={fR * 2} height={size * 0.013}
            fill="rgba(180,240,0,0.038)"
          />

          {/* Face vignette (subtle dark rim inside circle) */}
          <circle cx={cx} cy={cy} r={fR}
            fill="none"
            stroke="rgba(0,0,0,0.18)"
            strokeWidth={fR * 0.06}
          />
        </g>
        {/* end face clip group */}

        {/* ════════════════════════════════════════════════
            RING EFFECTS (outside clip, always visible)
        ════════════════════════════════════════════════ */}

        {/* Face border */}
        <circle cx={cx} cy={cy} r={fR} fill="none"
          stroke={rimStroke}
          strokeWidth={isSpeaking ? 2.5 : 1.5}
          style={{ transition: "stroke 0.2s, stroke-width 0.2s" }}
        />

        {/* Ring 3 — slow ambient */}
        <circle cx={cx} cy={cy} r={fR + size * 0.054} fill="none"
          stroke={`rgba(110, 53, 232,${isSpeaking ? (0.16 + ringPulse * 0.13).toFixed(3) : "0.07"})`}
          strokeWidth="1"
        />

        {/* Ring 2 — dashed rotating */}
        <circle cx={cx} cy={cy} r={fR + size * 0.096} fill="none"
          stroke={`rgba(139, 77, 255,${isSpeaking ? (0.36 + ringPulse * 0.20).toFixed(3) : "0.11"})`}
          strokeWidth="1.5"
          strokeDasharray={`${size * 0.048} ${size * 0.024}`}
          style={{
            transform: `rotate(${scanLine * 360}deg)`,
            transformOrigin: `${cx}px ${cy}px`,
          }}
        />

        {/* Ring 1 — CTA glow */}
        <circle cx={cx} cy={cy} r={fR + size * 0.040} fill="none"
          stroke={ctaStroke}
          strokeWidth={isSpeaking ? 2.2 : 1.4}
          filter={isSpeaking ? `url(#${uid}glow)` }
          style={{ transition: "stroke 0.25s, stroke-width 0.2s" }}
        />

        {/* Corner marker dots */}
        {[0, 90, 180, 270].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <circle key={deg}
              cx={cx + Math.cos(rad) * (fR + size * 0.043)}
              cy={cy + Math.sin(rad) * (fR + size * 0.043)}
              r={size * 0.015}
              fill={isSpeaking ? "#c4ff47" : "#6E35E8"}
              opacity={isSpeaking ? (0.85 + ringPulse * 0.15).toFixed(3) : "0.32"}
              style={{ transition: "fill 0.3s, opacity 0.15s" }}
            />
          );
        })}

        {/* AI badge */}
        <g transform={`translate(${cx + fR * 0.57}, ${cy - fR * 0.83})`}>
          <rect x="-19" y="-12" width="38" height="24" rx="8" fill="#6E35E8" opacity="0.95" />
          <rect x="-18" y="-11" width="36" height="22" rx="7" fill="none"
            stroke={isSpeaking
              ? `rgba(180,240,0,${(0.50 + ringPulse * 0.42).toFixed(3)})`
              : "rgba(139, 77, 255,0.40)"}
            strokeWidth="1"
          />
          <text x="0" y="6" textAnchor="middle"
            fontSize={size * 0.056} fontWeight="700"
            fill="white" fontFamily="monospace" letterSpacing="1.5">
            AI
          </text>
        </g>

        {/* Speaking waveform bars */}
        {isSpeaking && (
          <g transform={`translate(${cx}, ${cy + fR + size * 0.068})`}>
            {Array.from({ length: 9 }, (_, i) => {
              const ph  = i * 0.74 + scanLine * Math.PI * 2.6;
              const amp = isVideoMode ? 0.88 : 0.45 + openness * 0.55;
              const h   = 2.5 + Math.abs(Math.sin(ph)) * 15 * amp;
              return (
                <rect key={i}
                  x={(i - 4) * size * 0.038 - size * 0.011}
                  y={-h / 2}
                  width={size * 0.022} height={h}
                  rx={size * 0.011}
                  fill={i === 4 ? "#c4ff47" : "#8B4DFF"}
                  opacity={(0.55 + amp * 0.45).toFixed(3)}
                />
              );
            })}
          </g>
        )}
      </svg>

      {/* ── SVG overlay for D-ID mode (rings only) ─────────── */}
      {isVideoMode && (
        <svg
          viewBox={`0 0 ${size} ${size}`} width={size} height={size}
          style={{ position: "absolute", inset: 0, zIndex: 4, overflow: "visible", pointerEvents: "none" }}
        >
          <defs>
            <filter id={`${uid}glow2`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={size * 0.023} result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <circle cx={cx} cy={cy} r={fR} fill="none" stroke={rimStroke} strokeWidth="2.5" />
          <circle cx={cx} cy={cy} r={fR + size * 0.040} fill="none"
            stroke={ctaStroke} strokeWidth="2.2"
            filter={`url(#${uid}glow2)`} />
          {/* Waveform for D-ID */}
          {isSpeaking && (
            <g transform={`translate(${cx}, ${cy + fR + size * 0.068})`}>
              {Array.from({ length: 9 }, (_, i) => {
                const ph = i * 0.74 + scanLine * Math.PI * 2.6;
                const h  = 2.5 + Math.abs(Math.sin(ph)) * 15 * 0.88;
                return (
                  <rect key={i}
                    x={(i - 4) * size * 0.038 - size * 0.011}
                    y={-h / 2}
                    width={size * 0.022} height={h}
                    rx={size * 0.011}
                    fill={i === 4 ? "#c4ff47" : "#8B4DFF"}
                    opacity="0.85"
                  />
                );
              })}
            </g>
          )}
        </svg>
      )}

      {/* ── Connecting overlay ─────────────────────────────── */}
      {isConnecting && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "rgba(13,8,32,0.82)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 8, zIndex: 5,
        }}>
          <div style={{
            width: size * 0.21, height: size * 0.21, borderRadius: "50%",
            border: `${size * 0.021}px solid rgba(139, 77, 255,0.18)`,
            borderTopColor: "#8B4DFF",
            animation: "avSpin 0.85s linear infinite",
          }} />
          <span style={{ color: "rgba(180,155,255,0.85)", fontSize: size * 0.076, fontWeight: 600, fontFamily: "monospace" }}>
            Kết nối…
          </span>
        </div>
      )}

      {/* ── Status dot ────────────────────────────────────── */}
      <div style={{
        position: "absolute",
        bottom: fR * 0.09, right: fR * 0.09,
        zIndex: 6,
        width: size * 0.076, height: size * 0.076,
        borderRadius: "50%",
        background: dotBg,
        border: `${size * 0.013}px solid #0d0820`,
        boxShadow: isSpeaking
          ? `0 0 ${size * 0.05}px ${isVideoMode ? "rgba(180,240,0,0.9)" : "rgba(139, 77, 255,0.75)"}`
          : "none",
        transition: "background 0.3s, box-shadow 0.3s",
        animation: isSpeaking ? "avDot 0.9s ease-in-out infinite" : "none",
      }} />

      <style>{`
        @keyframes avSpin { to { transform: rotate(360deg); } }
        @keyframes avDot  {
          0%,100% { transform: scale(1);    opacity: 1;    }
          50%      { transform: scale(1.35); opacity: 0.62; }
        }
      `}</style>
    </div>
  );
}
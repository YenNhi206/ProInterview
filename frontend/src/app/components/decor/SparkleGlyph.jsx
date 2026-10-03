import React, { useId } from "react";

/**
 * Ngôi sao 4 cánh, cùng visual trang Home (section sticks).
 */
export function SparkleGlyph({ className = "", style, tone = "brand" }) {
  const uid = useId().replace(/:/g, "");
  const isLime = tone === "lime";
  const isWhite = tone === "white";
  const mainStart = isWhite ? "#ffffff" : (isLime ? "#bef264" : "#630ed4");
  const mainEnd = isWhite ? "#f8fafc" : (isLime ? "#84cc16" : "#4B18CC");
  const coreStart = isWhite ? "#e2e8f0" : (isLime ? "#ffffff" : "#99FF00");
  const coreEnd = isWhite ? "#cbd5e1" : (isLime ? "#f1f5f9" : "#63D800");
  const accentColor = isWhite ? "#ffffff" : (isLime ? "#bef264" : "#C7ADFF");
  const gid = `${tone}-${uid}`;

  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      style={style}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`sparkle-main-${gid}`} x1="7" y1="8" x2="55" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={mainStart} />
          <stop offset="1" stopColor={mainEnd} />
        </linearGradient>
        <linearGradient id={`sparkle-core-${gid}`} x1="24" y1="23" x2="40" y2="39" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={coreStart} />
          <stop offset="1" stopColor={coreEnd} />
        </linearGradient>
      </defs>
      <path
        d="M32 1.5C31.4 12.9 30 21.4 26.7 26.7C21.4 30 12.9 31.4 1.5 32C12.9 32.6 21.4 34 26.7 37.3C30 42.6 31.4 51.1 32 62.5C32.6 51.1 34 42.6 37.3 37.3C42.6 34 51.1 32.6 62.5 32C51.1 31.4 42.6 30 37.3 26.7C34 21.4 32.6 12.9 32 1.5Z"
        fill={`url(#sparkle-main-${gid})`}
      />
      <path
        d="M32 9.3C31 17.2 29.5 23.8 26.2 26.2C23.8 29.5 17.2 31 9.3 32C17.2 33 23.8 34.5 26.2 37.8C29.5 40.2 31 46.8 32 54.7C33 46.8 34.5 40.2 37.8 37.8C40.2 34.5 46.8 33 54.7 32C46.8 31 40.2 29.5 37.8 26.2C34.5 23.8 33 17.2 32 9.3Z"
        fill="rgba(255,255,255,0.18)"
      />
      <path
        d="M32 21.6C31.55 26.55 30.74 28.97 29.46 30.12C28.31 31.4 25.89 32.21 22.54 32.66C25.89 33.11 28.31 33.92 29.46 35.2C30.74 36.35 31.55 38.77 32 42.12C32.45 38.77 33.26 36.35 34.54 35.2C35.69 33.92 38.11 33.11 41.46 32.66C38.11 32.21 35.69 31.4 34.54 30.12C33.26 28.97 32.45 26.55 32 21.6Z"
        fill={`url(#sparkle-core-${gid})`}
      />
      <path
        d="M52.2 12.8V19.2M49 16H55.4"
        stroke={accentColor}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M8.6 38.4H13.4"
        stroke={accentColor}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

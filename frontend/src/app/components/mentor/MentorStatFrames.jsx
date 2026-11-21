import { motion } from "motion/react";
import { MentorMoneyText } from "../../utils/shared/moneyDisplay.jsx";

const ACCENT = {
  purple: {
    frame: "border border-white/10 bg-gradient-to-b from-[#181128]/95 to-[#120a20]/95 hover:border-violet-500/40 hover:shadow-[0_0_24px_rgba(130,60,240,0.18)] transition-all duration-300",
    value: "text-white font-black tracking-tight",
    title: "text-violet-200/90 font-bold uppercase tracking-wider text-[11px]",
    subtitle: "text-slate-400 font-medium text-xs",
    icon: "text-violet-300",
    iconBg: "bg-violet-500/15 border border-violet-500/30 shadow-[0_0_12px_rgba(130,60,240,0.2)]",
  },
  lime: {
    frame: "border border-white/10 bg-gradient-to-b from-[#181128]/95 to-[#120a20]/95 hover:border-[#93f72b]/40 hover:shadow-[0_0_24px_rgba(147,247,43,0.18)] transition-all duration-300",
    value: "text-white font-black tracking-tight",
    title: "text-[#93f72b] font-bold uppercase tracking-wider text-[11px]",
    subtitle: "text-slate-400 font-medium text-xs",
    icon: "text-[#93f72b]",
    iconBg: "bg-[#93f72b]/15 border border-[#93f72b]/30 shadow-[0_0_12px_rgba(147,247,43,0.25)]",
  },
};

/** Khối 3 cột thống kê mentor — 3 cards bento sang trọng */
export function MentorStatPanel({ children, className = "" }) {
  return (
    <div
      className={`mb-8 grid gap-5 sm:grid-cols-3 ${className}`.trim()}
    >
      {children}
    </div>
  );
}

/** Lưới 4 ô thống kê (đánh giá chéo, v.v.) */
export function MentorStatMiniGrid({ children, className = "" }) {
  return (
    <div className={`mb-6 grid grid-cols-2 gap-3.5 lg:grid-cols-4 ${className}`.trim()}>
      {children}
    </div>
  );
}

export function MentorStatFrame({
  index,
  value,
  moneyAmount,
  title,
  subtitle,
  footer,
  cornerIcon: CornerIcon,
  cornerLabel,
  accent = "purple",
  animate = true,
  compact = false,
}) {
  const theme = ACCENT[accent] || ACCENT.purple;
  const Wrapper = animate ? motion.div : "div";
  const motionProps = animate
    ? {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
        transition: {
          delay: 0.06 + (index - 1) * 0.08,
          duration: 0.45,
          ease: [0.22, 1, 0.36, 1],
        },
        whileHover: { y: -2 },
        whileTap: { scale: 0.985, y: 0 },
      }
    : {};

  const valStr = String(value ?? "");
  const isLong = valStr.length > 5;
  const isMedium = valStr.length > 3;

  const valueCls = compact
    ? isLong
      ? "text-sm sm:text-base font-bold"
      : isMedium
        ? "text-base sm:text-lg font-extrabold"
        : "text-2xl sm:text-[1.75rem] font-black"
    : moneyAmount != null
      ? "text-[clamp(1.75rem,3.2vw,2.5rem)]"
      : isLong
        ? "text-base sm:text-lg font-bold"
        : isMedium
          ? "text-xl sm:text-2xl font-extrabold"
          : "text-[clamp(2rem,3.5vw,2.75rem)]";

  const shellCls = compact
    ? `rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.3)] backdrop-blur-xl ${theme.frame} flex min-h-[5.25rem] flex-col justify-center px-4 py-3.5 sm:px-5 sm:py-4`
    : `rounded-2xl shadow-[0_16px_44px_rgba(0,0,0,0.4)] backdrop-blur-xl ${theme.frame} px-6 py-6`;

  return (
    <Wrapper
      {...motionProps}
      className={`relative overflow-hidden transition-all duration-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] ${shellCls}`}
    >
      {/* Top Hairline Glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

      {CornerIcon ? (
        <span
          className={`absolute ${compact ? "right-3.5 top-3.5 h-7 w-7 rounded-lg" : "right-5 top-5 h-8 w-8 rounded-xl"} inline-flex items-center justify-center ${theme.iconBg}`}
          aria-hidden
        >
          <CornerIcon size={compact ? 14 : 16} className={theme.icon} strokeWidth={2.2} />
        </span>
      ) : cornerLabel ? (
        <span
          className={`absolute ${compact ? "right-3.5 top-3.5" : "right-5 top-5"} text-[10px] font-bold tabular-nums tracking-wide text-slate-400`}
          aria-hidden
        >
          {cornerLabel}
        </span>
      ) : null}

      <div className={compact || CornerIcon ? (compact ? "pr-6" : "pr-8") : undefined}>
        <p
          className={`mentor-stat-num font-headline ${moneyAmount != null ? "mentor-stat-num--money leading-[1.05] whitespace-nowrap" : "leading-none tracking-tight"} ${valueCls} ${theme.value}`}
        >
          {moneyAmount != null ? <MentorMoneyText amount={moneyAmount} /> : value}
        </p>
        <p className={`${compact ? "mt-1.5 text-[10px]" : "mt-2.5 text-[11px]"} ${theme.title}`}>{title}</p>
        {subtitle ? (
          <p className={`${compact ? "mt-1 text-[11px]" : "mt-1.5 text-xs"} leading-snug ${theme.subtitle}`}>{subtitle}</p>
        ) : null}
        {footer}
      </div>
    </Wrapper>
  );
}

export function MentorSessionActivityBlocks({ activeCount = 0, total = 5 }) {
  const filled = Math.max(0, Math.min(total - 1, activeCount));
  return (
    <div className="mt-4 flex items-center gap-2" aria-hidden>
      {Array.from({ length: total }, (_, i) => {
        const isAccent = i === total - 1;
        const isFilled = !isAccent && i < filled;
        const active = isAccent || isFilled;
        return (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              active
                ? "w-5 bg-[#93f72b] shadow-[0_0_10px_rgba(147,247,43,0.8)]"
                : "w-2 bg-white/15"
            }`}
          />
        );
      })}
    </div>
  );
}

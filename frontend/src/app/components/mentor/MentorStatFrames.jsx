import { motion } from "motion/react";
import { MentorMoneyText } from "../../utils/shared/moneyDisplay.jsx";

const ACCENT = {
  purple: {
    frame: "bg-[#0d0f15] border border-white/[0.08] hover:border-white/20 transition-all duration-200",
    value: "text-white font-bold tracking-tight",
    title: "text-slate-300 font-medium",
    subtitle: "text-slate-500 font-normal",
    icon: "text-slate-300",
    iconBg: "bg-white/5 border border-white/10",
  },
  lime: {
    frame: "bg-[#0d0f15] border border-white/[0.08] hover:border-white/20 transition-all duration-200",
    value: "text-white font-bold tracking-tight",
    title: "text-slate-300 font-medium",
    subtitle: "text-slate-500 font-normal",
    icon: "text-slate-300",
    iconBg: "bg-white/5 border border-white/10",
  },
};

/** Khối 3 cột thống kê mentor — 3 cards bento sang trọng */
export function MentorStatPanel({ children, className = "" }) {
  return (
    <div
      className={`mb-6 grid gap-4 sm:grid-cols-3 ${className}`.trim()}
    >
      {children}
    </div>
  );
}

/** Lưới 4 ô thống kê (đánh giá chéo, v.v.) */
export function MentorStatMiniGrid({ children, className = "" }) {
  return (
    <div className={`mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4 ${className}`.trim()}>
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
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: {
          delay: 0.06 + (index - 1) * 0.08,
          duration: 0.4,
          ease: [0.22, 1, 0.36, 1],
        },
        whileHover: { y: -2 },
        whileTap: { scale: 0.98, y: 0 },
      }
    : {};

  const valueCls = compact
    ? "text-[clamp(1.75rem,3.5vw,2.5rem)]"
    : moneyAmount != null
      ? "text-[clamp(2rem,4vw,3.25rem)]"
      : "text-[clamp(2.5rem,5vw,4rem)]";

  const shellCls = compact
    ? `rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.2)] backdrop-blur-xl ${theme.frame} flex min-h-[6.75rem] flex-col justify-center`
    : `rounded-3xl shadow-[0_12px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl ${theme.frame}`;

  return (
    <Wrapper
      {...motionProps}
      className={`relative overflow-hidden px-5 py-5 transition-all duration-200 sm:px-6 sm:py-6 ${shellCls}`}
    >
      {CornerIcon ? (
        <span
          className={`absolute right-4 top-4 inline-flex h-7 w-7 items-center justify-center rounded-lg ${theme.iconBg}`}
          aria-hidden
        >
          <CornerIcon size={14} className={theme.icon} strokeWidth={2.1} />
        </span>
      ) : cornerLabel ? (
        <span
          className="absolute right-4 top-4 text-[11px] font-bold tabular-nums tracking-wide text-slate-400"
          aria-hidden
        >
          {cornerLabel}
        </span>
      ) : null}
      <div className={compact || CornerIcon ? "pr-8" : undefined}>
      <p
        className={`mentor-stat-num font-headline ${moneyAmount != null ? "mentor-stat-num--money leading-[1.05] whitespace-nowrap" : "leading-none tracking-tight"} ${valueCls} ${theme.value}`}
      >
        {moneyAmount != null ? <MentorMoneyText amount={moneyAmount} /> : value}
      </p>
      <p className={`${compact ? "mt-1.5" : "mt-2"} text-sm font-bold ${theme.title}`}>{title}</p>
      {subtitle ? (
        <p className={`mt-1 text-xs leading-relaxed ${theme.subtitle}`}>{subtitle}</p>
      ) : null}
      {footer}
      </div>
    </Wrapper>
  );
}

export function MentorSessionActivityBlocks({ activeCount = 0, total = 5 }) {
  const filled = Math.max(0, Math.min(total - 1, activeCount));
  return (
    <div className="mt-4 flex items-center gap-1.5" aria-hidden>
      {Array.from({ length: total }, (_, i) => {
        const isAccent = i === total - 1;
        const isFilled = !isAccent && i < filled;
        const active = isAccent || isFilled;
        return (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              active
                ? "w-4 bg-[#c7f36b] shadow-[0_0_8px_rgba(199,243,107,0.7)]"
                : "w-1.5 bg-white/20"
            }`}
          />
        );
      })}
    </div>
  );
}

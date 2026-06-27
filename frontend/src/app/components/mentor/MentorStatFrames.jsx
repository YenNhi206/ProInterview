import { motion } from "motion/react";
import { MentorMoneyText } from "../../utils/shared/moneyDisplay.jsx";

const ACCENT = {
  purple: {
    frame: "bg-gradient-to-br from-[#8037f4]/[0.07] via-white to-white",
    bar: "bg-[#8037f4]",
    value: "text-[#8037f4]",
    title: "text-slate-900",
    subtitle: "text-violet-500/80",
    icon: "text-[#8037f4]",
    iconBg: "bg-[#8037f4]/12 ring-1 ring-[#8037f4]/15",
    hover: "hover:shadow-[0_8px_24px_rgba(128,55,244,0.1)]",
  },
  lime: {
    frame: "bg-gradient-to-br from-[#93f72b]/[0.12] via-white to-white",
    bar: "bg-[#93f72b]",
    value: "text-slate-900",
    title: "text-slate-900",
    subtitle: "text-slate-500",
    icon: "text-slate-900",
    iconBg: "bg-[#93f72b]/30 ring-1 ring-[#93f72b]/35",
    hover: "hover:shadow-[0_8px_24px_rgba(147,247,43,0.14)]",
  },
};

/** Khối 3 cột thống kê mentor — tím + lime brand */
export function MentorStatPanel({ children, className = "" }) {
  return (
    <div
      className={`mb-6 overflow-hidden rounded-2xl border border-[#8037f4]/15 bg-white shadow-[0_4px_20px_rgba(128,55,244,0.07)] ${className}`.trim()}
    >
      <div className="grid divide-y divide-violet-100/80 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {children}
      </div>
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
    ? `rounded-2xl border border-[#8037f4]/12 shadow-[0_2px_12px_rgba(128,55,244,0.06)] ${theme.frame} ${theme.hover} flex min-h-[6.75rem] flex-col justify-center`
    : `${theme.frame} ${theme.hover}`;

  return (
    <Wrapper
      {...motionProps}
      className={`relative px-4 py-4 transition-shadow duration-200 sm:px-5 sm:py-5 ${shellCls}`}
    >
      <div
        className={`absolute bottom-4 left-0 top-4 w-1 rounded-full ${theme.bar}`}
        aria-hidden
      />
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

/** Thanh hoạt động tím — ô 1 dashboard */
export function MentorSessionActivityBlocks({ activeCount = 0, total = 5 }) {
  const filled = Math.max(0, Math.min(total - 1, activeCount));
  return (
    <div className="mt-6 flex items-center gap-1.5" aria-hidden>
      {Array.from({ length: total }, (_, i) => {
        const isAccent = i === total - 1;
        const isFilled = !isAccent && i < filled;
        return (
          <div
            key={i}
            className={`h-2 w-2 rounded-[3px] transition-colors ${
              isAccent || isFilled ? "bg-[#8037f4]" : "bg-[#8037f4]/18"
            }`}
          />
        );
      })}
    </div>
  );
}

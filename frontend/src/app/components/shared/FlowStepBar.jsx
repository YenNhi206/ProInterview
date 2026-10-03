import { Check } from "lucide-react";

/**
 * Thanh bước ngang, đồng bộ luồng phỏng vấn AI & tạo khóa học mentor.
 * @param {{ steps: { n: number, label: string }[], current: number, className?: string, ariaLabel?: string }} props
 */
export function FlowStepBar({
  steps,
  current = 1,
  className = "",
  ariaLabel = "Tiến trình",
  onStepClick,
}) {
  const items = [];

  steps.forEach((s, index) => {
    if (index > 0) {
      const lineDone = s.n <= current;
      items.push(
        <li
          key={`line-${s.n}`}
          aria-hidden
          className={`mx-1 mt-[1.125rem] h-0.5 w-10 shrink-0 rounded-full sm:mx-2 sm:w-16 transition-all ${
            lineDone
              ? "bg-gradient-to-r from-violet-500 to-indigo-500 shadow-[0_0_10px_rgba(139,92,246,0.6)]"
              : "bg-white/15"
          }`}
        />,
      );
    }

    const done = s.n < current;
    const active = s.n === current;
    const isClickable = done && typeof onStepClick === "function";

    items.push(
      <li key={s.n} className="flex shrink-0 flex-col items-center gap-2">
        <button
          type="button"
          disabled={!isClickable}
          onClick={() => isClickable && onStepClick(s.n)}
          className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-black transition-all ${
            active
              ? "bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-600 text-white shadow-[0_0_20px_rgba(139,92,246,0.6)] border border-violet-400/50 scale-105"
              : done
                ? "bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)] hover:brightness-110 cursor-pointer active:scale-95"
                : "border border-white/20 bg-white/[0.05] text-slate-400 cursor-default"
          }`}
        >
          {done ? <Check className="h-4 w-4" strokeWidth={3} /> : s.n}
        </button>
        <button
          type="button"
          disabled={!isClickable}
          onClick={() => isClickable && onStepClick(s.n)}
          className={`max-w-[8rem] text-center text-xs font-bold uppercase leading-tight tracking-wider transition-colors sm:max-w-none ${
            active
              ? "text-white"
              : done
                ? "text-emerald-400 hover:text-emerald-300 cursor-pointer"
                : "text-slate-400 cursor-default"
          }`}
        >
          {s.label}
        </button>
      </li>,
    );
  });

  return (
    <ol
      className={`mb-8 flex w-full list-none items-start justify-center ${className}`.trim()}
      aria-label={ariaLabel}
    >
      {items}
    </ol>
  );
}

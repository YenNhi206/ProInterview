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
              ? "bg-[#93f72b]/70"
              : "bg-white/15"
          }`}
        />,
      );
    }

    const done = s.n < current;
    const active = s.n === current;
    const isClickable = done && typeof onStepClick === "function";

    items.push(
      <li key={s.n} aria-current={active ? "step" : undefined} className="flex min-w-0 flex-col items-center gap-2.5">
        <button
          data-button-surface="none"
          type="button"
          disabled={!isClickable}
          onClick={() => isClickable && onStepClick(s.n)}
          className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#93f72b] ${
            active
              ? "bg-[#93f72b] text-[#1b2410] border border-[#d9ff97]"
              : done
                ? "bg-[#263324] text-[#93f72b] border border-[#93f72b]/40 hover:brightness-110 cursor-pointer active:scale-95"
                : "border border-white/20 bg-white/[0.05] text-slate-400 cursor-default"
          }`}
        >
          {done ? <Check className="h-4 w-4" strokeWidth={3} /> : s.n}
        </button>
        <span
          className={`max-w-[6rem] text-center text-xs font-medium leading-snug sm:max-w-none sm:text-sm ${
            active
              ? "text-[#93f72b]"
              : done
                ? "text-[#93f72b]"
                : "text-slate-400 cursor-default"
          }`}
        >
          {s.label}
        </span>
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

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
}) {
  const items = [];

  steps.forEach((s, index) => {
    if (index > 0) {
      const lineDone = s.n <= current;
      items.push(
        <li
          key={`line-${s.n}`}
          aria-hidden
          className={`mx-1 mt-[1.125rem] h-0.5 w-10 shrink-0 rounded-full sm:mx-2 sm:w-14 ${
            lineDone ? "bg-violet-500" : "bg-violet-200"
          }`}
        />,
      );
    }

    const done = s.n < current;
    const active = s.n === current;

    items.push(
      <li key={s.n} className="flex shrink-0 flex-col items-center gap-2">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-full text-base font-bold transition-colors sm:text-sm ${
            active || done
              ? "bg-[#630ed4] text-white shadow-[0_4px_14px_rgba(128,55,244,0.28)]"
              : "border-2 border-violet-200 bg-white text-violet-400"
          }`}
        >
          {done ? <Check className="h-4 w-4" strokeWidth={2.5} /> : s.n}
        </span>
        <span
          className={`max-w-[7.5rem] text-center text-sm font-bold uppercase leading-tight tracking-wide sm:max-w-none sm:text-xs ${
            active ? "text-[#630ed4]" : done ? "text-violet-800" : "text-violet-400"
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

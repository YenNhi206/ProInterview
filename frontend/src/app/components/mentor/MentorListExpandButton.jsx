import { ChevronDown } from "lucide-react";

export const MENTOR_LIST_PAGE_SIZE = 8;

export function MentorListExpandButton({ expanded, onToggle, className = "" }) {
  return (
    <div className={`relative flex justify-center px-4 pb-5 pt-1 sm:px-6 ${className}`.trim()}>
      {!expanded ? (
        <div
          className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-white to-transparent"
          aria-hidden
        />
      ) : null}
      <button
        type="button"
        onClick={onToggle}
        className="group flex min-h-[44px] w-fit max-w-full items-center justify-center gap-2 rounded-full border border-[#8037f4]/15 bg-white px-5 py-2.5 text-sm font-semibold text-[#8037f4] shadow-[0_2px_8px_rgba(128,55,244,0.08)] transition hover:border-[#8037f4]/30 hover:bg-[#8037f4]/[0.04] hover:shadow-[0_4px_14px_rgba(128,55,244,0.12)] active:scale-[0.98]"
      >
        {expanded ? (
          <>
            Thu gọn
            <ChevronDown
              size={15}
              strokeWidth={2.5}
              className="shrink-0 rotate-180 transition-transform duration-200"
            />
          </>
        ) : (
          <>
            Xem tất cả
            <ChevronDown
              size={15}
              strokeWidth={2.5}
              className="shrink-0 transition-transform duration-200 group-hover:translate-y-0.5"
            />
          </>
        )}
      </button>
    </div>
  );
}

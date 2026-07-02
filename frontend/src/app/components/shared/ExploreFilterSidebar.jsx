import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

export function FilterRadio({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg py-1.5 text-left text-sm text-slate-700 transition-colors hover:bg-violet-50/80"
    >
      <span
        className={`flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          active ? "border-[#8037f4] bg-[#8037f4]" : "border-slate-300 bg-white"
        }`}
        aria-hidden
      >
        {active ? <span className="size-1.5 rounded-full bg-white" /> : null}
      </span>
      <span className={active ? "font-semibold text-violet-950" : ""}>{children}</span>
    </button>
  );
}

export function FilterSection({ title, open, onToggle, children }) {
  return (
    <div className="border-b border-slate-200/80 py-3 last:border-0 max-lg:py-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left text-sm font-bold text-slate-800"
      >
        {title}
        <ChevronDown className={`size-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div className="mt-2 space-y-0.5 max-lg:mt-1.5">{children}</div> : null}
    </div>
  );
}

export function ExploreFilterSidebar({
  title = "Bộ lọc",
  onClear,
  hasFilter,
  children,
  /** Chỉ mobile (&lt; lg): thu gọn cả khối lọc. Desktop không đổi. */
  mobileCollapsible = false,
  /** Gọi khi mở panel lọc trên mobile, để đóng các nhóm con. */
  onMobilePanelOpen,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleMobilePanel = () => {
    setMobileOpen((wasOpen) => {
      const next = !wasOpen;
      if (next) onMobilePanelOpen?.();
      return next;
    });
  };

  return (
    <aside className="w-full shrink-0 rounded-2xl border border-slate-200/90 bg-slate-50/90 p-4 lg:w-[15.5rem] xl:w-[17rem] max-lg:p-3">
      {mobileCollapsible ? (
        <button
          type="button"
          className="mb-3 flex w-full items-center justify-between gap-2 rounded-xl border border-violet-200/60 bg-white px-3 py-2.5 text-left shadow-sm transition-colors hover:bg-violet-50/40 lg:hidden"
          onClick={toggleMobilePanel}
          aria-expanded={mobileOpen}
        >
          <span className="flex min-w-0 items-center gap-2">
            <SlidersHorizontal className="size-4 shrink-0 text-[#8037f4]" aria-hidden />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{title}</span>
            {hasFilter ? (
              <span className="shrink-0 rounded-full bg-[#8037f4] px-2 py-0.5 text-[10px] font-bold text-white">
                Đang lọc
              </span>
            ) : null}
          </span>
          <ChevronDown
            className={`size-4 shrink-0 text-slate-400 transition-transform ${mobileOpen ? "rotate-180" : ""}`}
          />
        </button>
      ) : null}

      <p
        className={`mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 ${
          mobileCollapsible ? "hidden lg:block" : ""
        }`}
      >
        {title}
      </p>

      <div
        className={
          mobileCollapsible
            ? `${mobileOpen ? "block" : "hidden"} lg:contents max-lg:mb-0`
            : undefined
        }
      >
        {children}
        <button
          type="button"
          onClick={onClear}
          disabled={!hasFilter}
          className="mt-4 w-full rounded-lg bg-[#a3e635] py-2.5 text-sm font-bold text-slate-900 transition-colors hover:bg-[#84cc16] disabled:cursor-not-allowed disabled:opacity-40 max-lg:mt-3"
        >
          Xóa bộ lọc
        </button>
      </div>
    </aside>
  );
}

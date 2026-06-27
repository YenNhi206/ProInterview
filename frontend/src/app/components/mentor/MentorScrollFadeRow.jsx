import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";

const SCROLL_END_EPS = 6;

/**
 * Horizontal scroll row — fade + chevron hint on mobile when content overflows.
 */
export function MentorScrollFadeRow({
  children,
  className = "",
  innerClassName = "flex gap-2",
  fadeFrom = "from-slate-50",
  showHintsOnDesktop = false,
}) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollHints = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > SCROLL_END_EPS);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - SCROLL_END_EPS);
  }, []);

  useEffect(() => {
    updateScrollHints();
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener("scroll", updateScrollHints, { passive: true });
    const observer = new ResizeObserver(updateScrollHints);
    observer.observe(el);

    return () => {
      el.removeEventListener("scroll", updateScrollHints);
      observer.disconnect();
    };
  }, [updateScrollHints, children]);

  const hintVisibility = showHintsOnDesktop ? "" : "md:hidden";

  return (
    <div className={`relative overflow-hidden ${className}`.trim()}>
      {canScrollLeft ? (
        <div
          className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r ${fadeFrom} to-transparent ${hintVisibility}`}
          aria-hidden
        />
      ) : null}
      {canScrollRight ? (
        <>
          <div
            className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l ${fadeFrom} to-transparent ${hintVisibility}`}
            aria-hidden
          />
          <div
            className={`pointer-events-none absolute right-1.5 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-violet-500 shadow-sm ring-1 ring-slate-200/80 ${hintVisibility}`}
            aria-hidden
          >
            <ChevronRight size={14} strokeWidth={2.5} />
          </div>
        </>
      ) : null}

      <div
        ref={scrollRef}
        className={`${innerClassName} overflow-x-auto scroll-smooth pb-0.5 pr-7 [-ms-overflow-style:none] [scrollbar-width:none] [scroll-snap-type:x_proximity] [&::-webkit-scrollbar]:hidden md:pr-0`.trim()}
      >
        {children}
      </div>
    </div>
  );
}

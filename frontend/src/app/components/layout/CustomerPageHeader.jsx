import React from "react";

/** Shared H1 title class: fluid clamp, bold, tight tracking */
export const CUSTOMER_PAGE_TITLE_CLASS =
  "font-headline text-[clamp(1.75rem,3.2vw,2.75rem)] font-black leading-[1.15] tracking-tight";

/** Base text: pure white in dark mode, dark slate in light mode */
export const CUSTOMER_PAGE_TITLE_BASE =
  "text-white [html[data-workspace-theme=light]_&]:text-[#1a1b23]";

/** Accent text: brand lime in dark mode, brand purple in light mode */
export const CUSTOMER_PAGE_TITLE_ACCENT =
  "text-[#93f72b] [html[data-workspace-theme=light]_&]:text-[#8037f4]";

/** Legacy aliases */
export const CUSTOMER_TITLE_ACCENT = CUSTOMER_PAGE_TITLE_ACCENT;
export const CUSTOMER_TITLE_REST = CUSTOMER_PAGE_TITLE_BASE;

/** Subtitle standard: text-sm sm:text-base, muted slate adapting to theme */
export const CUSTOMER_PAGE_SUBTITLE_CLASS =
  "mt-3 max-w-2xl text-center text-sm sm:text-base font-medium leading-relaxed text-slate-300 [html[data-workspace-theme=light]_&]:text-[#5b5772] mx-auto";

/**
 * Reusable two-tone page title component
 */
export function CustomerPageTitle({ base, accent, accentFirst = false, className = "" }) {
  return (
    <span className={`${CUSTOMER_PAGE_TITLE_CLASS} ${className}`}>
      {accentFirst ? (
        <>
          <span className={CUSTOMER_PAGE_TITLE_ACCENT}>{accent}</span>{" "}
          <span className={CUSTOMER_PAGE_TITLE_BASE}>{base}</span>
        </>
      ) : (
        <>
          <span className={CUSTOMER_PAGE_TITLE_BASE}>{base}</span>{" "}
          <span className={CUSTOMER_PAGE_TITLE_ACCENT}>{accent}</span>
        </>
      )}
    </span>
  );
}

/** Tiêu đề 2 tông: tím/lime ↔ đen/trắng (đồng bộ Mentors, Courses, Pricing, …) */
export function CustomerPageSplitTitle({ accent, rest }) {
  return (
    <>
      <span className={CUSTOMER_PAGE_TITLE_ACCENT}>{accent}</span>{" "}
      <span className={CUSTOMER_PAGE_TITLE_BASE}>{rest}</span>
    </>
  );
}

/** Pill badge + tiêu đề — đồng bộ CV hub / Pricing / các trang customer */
export function CustomerPageBadge({ children, pulse = true, className = "" }) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-[#1e153b]/90 [html[data-workspace-theme=light]_&]:border-violet-200/80 [html[data-workspace-theme=light]_&]:bg-white/90 px-3 py-1 shadow-sm backdrop-blur-sm ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full bg-[#93f72b] [html[data-workspace-theme=light]_&]:bg-[#8037f4] ${pulse ? "animate-pulse" : ""}`}
        aria-hidden
      />
      <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-violet-200 [html[data-workspace-theme=light]_&]:text-[#5b598c] sm:text-[11px]">
        {children}
      </span>
    </div>
  );
}

/**
 * Header trang customer: badge trắng + chấm tím, H1 đậm, subtitle tím nhạt.
 * `title` có thể là ReactNode (vd. <>Text <span className="text-[#8037f4]">highlight</span></>).
 */
export function CustomerPageHeader({
  badge,
  title,
  subtitle,
  subtitleClassName = CUSTOMER_PAGE_SUBTITLE_CLASS,
  titleClassName,
  centered = false,
  badgePulse = true,
  className = "mb-6 w-full",
  actions,
}) {
  return (
    <header className={`${className} ${centered ? "text-center" : ""}`}>
      {(badge || actions) && (
        <div
          className={`mb-2 flex flex-wrap items-center gap-3 ${centered ? "justify-center" : "justify-between"}`}
        >
          {badge ? (
            <CustomerPageBadge pulse={badgePulse}>
              {badge}
            </CustomerPageBadge>
          ) : null}
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      )}
      <h1
        className={
          titleClassName ??
          `${CUSTOMER_PAGE_TITLE_CLASS} ${CUSTOMER_PAGE_TITLE_BASE} ${centered ? "text-center" : ""}`
        }
      >
        {title}
      </h1>
      {subtitle ? (
        <p className={`${subtitleClassName} ${centered ? "mx-auto" : ""}`}>{subtitle}</p>
      ) : null}
    </header>
  );
}

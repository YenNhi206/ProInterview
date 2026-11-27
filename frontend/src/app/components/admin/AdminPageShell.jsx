import { RefreshCw, Search } from "lucide-react";

/** Layout & typography thống nhất admin (Lexend, dark luxury glassmorphism). */
export const adminPageKicker =
  "admin-kicker text-[11px] font-bold uppercase tracking-[0.16em] text-[#93f72b] [html[data-workspace-theme=light]_&]:text-[#6d28d9]";

export const adminTitleAccent =
  "admin-title-accent text-[#93f72b] [html[data-workspace-theme=light]_&]:text-[#6d28d9]";

export const adminPageTitle =
  "font-headline text-2xl sm:text-3xl font-extrabold tracking-tight text-white [html[data-workspace-theme=light]_&]:text-slate-900";

export const adminPageTitleAccent =
  "font-headline text-2xl sm:text-3xl font-extrabold tracking-tight text-white [html[data-workspace-theme=light]_&]:text-slate-900";

export const adminPageSubtitle =
  "mt-1 max-w-2xl text-sm font-medium leading-relaxed text-slate-400 [html[data-workspace-theme=light]_&]:text-slate-500";

export const adminThCell =
  "px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 [html[data-workspace-theme=light]_&]:text-slate-500";

export const adminTdCell =
  "px-6 py-4 text-sm font-medium text-slate-200 [html[data-workspace-theme=light]_&]:text-slate-700";

export const adminPageWrap =
  "min-w-0 max-w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 sm:space-y-8";

export const adminHeaderRow =
  "flex min-w-0 flex-col justify-between gap-4 lg:flex-row lg:items-start lg:gap-6";

export const adminToolbar =
  "flex w-full min-w-0 flex-wrap items-center gap-3 sm:w-auto sm:justify-end";

export const adminRefreshBtn =
  "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] [html[data-workspace-theme=light]_&]:border-slate-200 [html[data-workspace-theme=light]_&]:bg-white [html[data-workspace-theme=light]_&]:text-slate-700 [html[data-workspace-theme=light]_&]:hover:bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-200 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50";

export const adminSearchWrap = "relative min-w-0 flex-1 sm:flex-none sm:w-72";

export const adminSearchInput =
  "w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.05] [html[data-workspace-theme=light]_&]:border-slate-200 [html[data-workspace-theme=light]_&]:bg-white [html[data-workspace-theme=light]_&]:text-slate-900 [html[data-workspace-theme=light]_&]:placeholder:text-slate-400 py-2.5 pl-10 pr-4 text-sm font-medium text-white placeholder:text-slate-400 outline-none backdrop-blur-sm transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20";

export const adminStatGrid2 = "grid gap-4 sm:grid-cols-2";
export const adminStatGrid3 = "grid gap-4 sm:grid-cols-3";
export const adminStatGrid4 = "grid gap-4 sm:grid-cols-2 lg:grid-cols-4";

export const adminStatLabel =
  "text-[10px] font-bold uppercase tracking-wider text-slate-400";

export const adminStatValue = "mt-1 text-2xl font-black tabular-nums text-white";

export const adminGlassTable =
  "glass-card min-w-0 max-w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] shadow-2xl backdrop-blur-md";

/** Header trang admin — kicker + tiêu đề + mô tả (tùy chọn). */
export function AdminPageHeader({ kicker, title, subtitle, children, className = "" }) {
  return (
    <div className={`min-w-0 flex-1 ${className}`.trim()}>
      {kicker ? <p className={adminPageKicker}>{kicker}</p> : null}
      {typeof title === "string" ? (
        <h2 className={kicker ? "mt-1 " + adminPageTitleAccent : adminPageTitleAccent}>{title}</h2>
      ) : (
        title
      )}
      {subtitle ? <p className={adminPageSubtitle}>{subtitle}</p> : null}
      {children}
    </div>
  );
}

export function AdminPageToolbar({ loading, onRefresh, searchTerm, onSearchChange, searchPlaceholder }) {
  return (
    <div className={adminToolbar}>
      <button type="button" onClick={onRefresh} disabled={loading} className={adminRefreshBtn}>
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        Làm mới
      </button>
      <div className={adminSearchWrap}>
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className={adminSearchInput}
        />
      </div>
    </div>
  );
}

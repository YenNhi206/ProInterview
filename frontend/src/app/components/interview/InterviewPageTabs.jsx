import { Search, RotateCcw as History } from "lucide-react";

const TABS = [
  { id: "analysis", label: "Phỏng vấn", icon: Search },
  { id: "history", label: "Lịch sử", icon: History },
];


/**
 * Tab Phỏng vấn / Lịch sử, chuẩn dark luxury glassmorphism.
 * @param {"analysis"|"history"} activeTab
 */
export function InterviewPageTabs({ activeTab, onTabChange }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-3.5 sm:px-7 sm:py-4">
      <div
        className="inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-1 backdrop-blur-md"
        role="tablist"
        aria-label="Phỏng vấn AI"
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                if (!active) onTabChange(tab.id);
              }}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all sm:text-sm ${
                active
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-900/40"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}


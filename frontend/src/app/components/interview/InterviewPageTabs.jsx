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
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5 sm:px-6 sm:py-3">
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
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all sm:px-3.5 sm:py-1.5 ${
                active
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_0_15px_rgba(139,92,246,0.4)]"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}


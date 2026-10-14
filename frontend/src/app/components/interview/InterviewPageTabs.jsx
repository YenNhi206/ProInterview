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
    <div
      className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.04] p-1 shadow-lg backdrop-blur-xl"
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
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold transition-all sm:text-sm ${
              active
                ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_0_15px_rgba(139,92,246,0.5)]"
                : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}


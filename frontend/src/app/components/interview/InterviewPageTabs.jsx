import { Mic, RotateCcw as History } from "lucide-react";

const TABS = [
  { id: "analysis", label: "Phỏng vấn", icon: Mic },
  { id: "history", label: "Lịch sử", icon: History },
];


/**
 * Tab đang chọn dùng lime để phân biệt rõ với tab còn lại.
 * @param {"analysis"|"history"} activeTab
 */
export function InterviewPageTabs({ activeTab, onTabChange }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-3.5 sm:px-7 sm:py-4">
      <div
        className="inline-flex rounded-xl border border-white/10 bg-[#171122] p-1"
        role="tablist"
        aria-label="Phỏng vấn AI"
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              data-button-surface="none"
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                if (!active) onTabChange(tab.id);
              }}
              className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#93f72b] sm:text-sm ${
                active
                  ? "border-[#bcff79] bg-[#93f72b] text-[#17210b] shadow-none"
                  : "border-transparent bg-transparent text-slate-400 shadow-none hover:bg-white/5 hover:text-white"
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


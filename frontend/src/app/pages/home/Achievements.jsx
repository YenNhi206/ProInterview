import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { achievementsApi } from "../../api/achievementsApi.js";
import { Medal } from "lucide-react";

export function Achievements() {
  const [achievements, setAchievements] = useState([]);
  const [activeTab, setActiveTab] = useState("Tất cả");
  const navigate = useNavigate();

  const TABS = ["Tất cả", "Tin tức", "Hoạt động", "Sự kiện"];

  useEffect(() => {
    const fetchAchievements = async () => {
      try {
        const res = await achievementsApi.getAll();
        if (res.data?.success) {
          setAchievements(res.data.achievements || []);
        }
      } catch (err) {
        console.error("Failed to load achievements", err);
      }
    };
    fetchAchievements();
  }, []);

  return (
    <div className="min-h-screen bg-transparent">
      {/* Header */}
      <section className="relative pb-10 pt-12 sm:pt-16 sm:pb-14">
        <div
          className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[#8037f4]/15 blur-[130px]"
          aria-hidden
        />
        <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/15 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-violet-200 shadow-[0_0_15px_rgba(147,51,234,0.25)]">
            <Medal className="h-3.5 w-3.5 text-[#93f72b] shrink-0" />
            Tin tức & Hoạt động
          </span>
          <h1 className="font-headline text-balance text-3xl sm:text-4xl lg:text-5xl font-black leading-[1.1] tracking-tight text-white">
            Tin tức và hoạt động{" "}
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-300 to-lime-300 bg-clip-text text-transparent">
              từ ProInterview
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm sm:text-base font-medium leading-relaxed text-slate-300/80">
            Cập nhật những tin tức, sự kiện và cột mốc phát triển mới nhất của chúng tôi.
          </p>
        </div>
      </section>

      {/* Tabs */}
      <section className="mx-auto max-w-3xl px-6 pb-12 flex flex-wrap justify-center gap-2 sm:gap-3">
        {TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              data-button-surface="none"
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-full px-5 py-2 text-sm font-bold transition-all duration-300 cursor-pointer ${
                isActive
                  ? "bg-[#93f72b] text-[#0a0a0c] shadow-[0_0_20px_rgba(147,247,43,0.4)] scale-105"
                  : "bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white border border-white/10 hover:border-violet-400/40"
              }`}
            >
              {tab}
            </button>
          );
        })}
      </section>

      {/* Grid */}
      <section className="mx-auto max-w-[84rem] px-6 pb-24 sm:px-8">
        {achievements.filter(item => activeTab === "Tất cả" || item.category === activeTab).length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-16 sm:p-20 text-center backdrop-blur-xl shadow-2xl relative overflow-hidden">
            <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 h-44 w-44 rounded-full bg-violet-600/20 blur-3xl" aria-hidden="true" />
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-[#93f72b] shadow-[0_0_20px_rgba(147,247,43,0.25)]">
              <Medal className="h-7 w-7" />
            </div>
            <h3 className="font-headline text-lg sm:text-xl font-bold text-white mb-2">
              Chưa có bài viết nào được đăng tải
            </h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Các thông báo, tin tức và sự kiện mới nhất sẽ sớm được cập nhật tại đây. Hãy quay lại sau nhé!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {achievements.filter(item => activeTab === "Tất cả" || item.category === activeTab).map((item) => (
              <article
                key={item._id}
                onClick={() => navigate(`/achievements/${item._id}`)}
                className="group cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#181538]/70 via-[#13112c]/75 to-[#0e0c22]/80 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all duration-400 hover:-translate-y-1.5 hover:border-violet-500/40 hover:shadow-[0_20px_40px_-10px_rgba(124,58,237,0.35)] flex flex-col"
              >
                {/* Image */}
                <div className="relative aspect-[3/2] w-full overflow-hidden bg-white/5">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="relative h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-violet-900/30 to-violet-950/40 flex items-center justify-center text-violet-400/50">
                      <Medal size={40} />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex flex-col gap-3 p-5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-violet-400/30 bg-violet-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-300">
                      {item.category || "Hoạt động"}
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      {new Date(item.date).toLocaleDateString("vi-VN", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  <h3 className="font-headline text-base font-bold leading-snug tracking-tight text-white line-clamp-2 transition-colors duration-300 group-hover:text-[#93f72b] sm:text-[1.05rem]">
                    {item.title}
                  </h3>

                  {/* Footer */}
                  <div className="mt-auto pt-3 border-t border-white/5 flex items-center gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 ring-1 ring-white/15">
                      <img
                        src="/logo-mark-circle.png"
                        alt="ProInterview"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold leading-none text-slate-200">ProInterview Team</span>
                      <span className="mt-0.5 text-[10px] text-slate-400">prointerview.vn</span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

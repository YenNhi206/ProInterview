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
          className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[#8037f4]/10 blur-[120px]"
          aria-hidden
        />
        <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-violet-700">
            <Medal className="h-3.5 w-3.5 shrink-0" />
            Tin tức & Hoạt động
          </span>
          <h1 className="text-balance text-4xl font-black leading-[1.05] tracking-[-0.03em] text-slate-900 sm:text-5xl lg:text-[3.5rem]">
            Tin tức và hoạt động{" "}
            <span className="text-[#630ed4]">từ ProInterview</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-500 sm:text-lg">
            Cập nhật những tin tức, sự kiện và cột mốc phát triển mới nhất của chúng tôi.
          </p>
        </div>
      </section>

      {/* Tabs */}
      <section className="mx-auto max-w-3xl px-6 pb-12 flex flex-wrap justify-center gap-2 sm:gap-3">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-5 py-2 text-sm font-bold transition-all duration-300 ${
              activeTab === tab
                ? "bg-[#630ed4] text-white shadow-md shadow-violet-500/20"
                : "bg-white text-slate-600 border border-slate-200 hover:border-[#630ed4] hover:text-[#630ed4]"
            }`}
          >
            {tab}
          </button>
        ))}
      </section>

      {/* Grid */}
      <section className="mx-auto max-w-[84rem] px-6 pb-24 sm:px-8">
        {achievements.filter(item => activeTab === "Tất cả" || item.category === activeTab).length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-24 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">
              Chưa có bài viết nào được đăng tải
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {achievements.filter(item => activeTab === "Tất cả" || item.category === activeTab).map((item) => (
              <article
                key={item._id}
                onClick={() => navigate(`/achievements/${item._id}`)}
                className="group cursor-pointer overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_16px_40px_-8px_rgba(99,14,212,0.15)]"
              >
                {/* Image */}
                <div className="relative aspect-[3/2] w-full overflow-hidden rounded-t-2xl bg-gradient-to-br from-violet-100 to-violet-50">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="relative h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-violet-100 to-violet-50" />
                  )}
                </div>

                {/* Content */}
                <div className="flex flex-col gap-3 p-5">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-violet-700">
                      {item.category || "Hoạt động"}
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                      {new Date(item.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  <h3 className="text-base font-bold leading-snug tracking-[-0.02em] text-slate-900 line-clamp-2 transition-colors duration-300 group-hover:text-[#630ed4] sm:text-[1.05rem]">
                    {item.title}
                  </h3>

                  {/* Footer */}
                  <div className="mt-1 flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
                      <img
                        src="/logo-mark-circle.png"
                        alt="ProInterview"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[12px] font-bold leading-none text-slate-800">ProInterview Team</span>
                      <span className="mt-0.5 text-[11px] text-slate-400">prointerview.vn</span>
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

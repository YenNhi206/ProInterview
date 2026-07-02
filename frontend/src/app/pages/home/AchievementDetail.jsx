import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { achievementsApi } from "../../api/achievementsApi.js";
import { CalendarDays, ArrowLeft, Award } from "lucide-react";

export function AchievementDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Scroll to top on load
    window.scrollTo(0, 0);

    const fetchDetail = async () => {
      try {
        const res = await achievementsApi.getById(id);
        if (res.data?.success) {
          setItem(res.data.achievement);
        }
      } catch (err) {
        console.error("Failed to load achievement", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDetail();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-[#8037f4]" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h2 className="text-2xl font-black text-slate-900 mb-4">Không tìm thấy bài viết</h2>
        <p className="text-slate-600 mb-8">Nội dung này có thể đã bị xóa hoặc không tồn tại.</p>
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 rounded-full bg-[#a3e635] px-6 py-3 text-sm font-bold text-slate-900 shadow-lg shadow-[#a3e635]/30 transition-all hover:bg-[#84cc16] active:scale-[0.98]"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại Trang chủ
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent pb-24">
      {/* Decorative Blur */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 z-0 h-[min(60vw,600px)] w-[min(60vw,600px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#8037f4]/10 blur-[100px] sm:h-[800px] sm:w-[800px] sm:blur-[140px]"
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-3xl px-6 pt-8 sm:pt-12">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="group mb-8 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-[#8037f4]"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Quay lại
        </button>

        <article>
          {/* Header Info */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100/80 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#8037f4] border border-violet-200">
              <Award className="h-3 w-3" />
              Câu chuyện thành công
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
              <CalendarDays className="h-3.5 w-3.5" />
              {new Date(item.date).toLocaleDateString("vi-VN", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </span>
          </div>

          {/* Title */}
          <h1 className="mb-8 text-3xl font-black leading-tight tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            {item.title}
          </h1>

          {/* Featured Image */}
          {item.imageUrl && (
            <div className="mb-10 overflow-hidden rounded-3xl border border-slate-200/40 shadow-xl shadow-slate-200/30">
              <img
                src={item.imageUrl}
                alt={item.title}
                className="w-full h-auto object-contain"
              />
            </div>
          )}

          {/* Content Body */}
          <div className="prose prose-slate max-w-none">
            <p className="text-base leading-relaxed text-slate-700 sm:text-lg whitespace-pre-wrap">
              {item.content}
            </p>
          </div>

          {/* Gallery Images */}
          {item.images && item.images.length > 0 && (
            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
              {item.images.map((img, idx) => (
                <div key={idx} className="overflow-hidden rounded-2xl border border-slate-200/40 shadow-lg shadow-slate-200/30 transition-transform duration-500 hover:-translate-y-1 hover:shadow-violet-200/50 group">
                  <img src={img} alt={`Hình ảnh ${idx + 1}`} className="w-full h-56 sm:h-72 object-cover transition-transform duration-700 group-hover:scale-105" />
                </div>
              ))}
            </div>
          )}

          {/* Author/Sign-off Card */}
          <div className="mt-12 flex items-center gap-3 border-t border-slate-100 pt-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white p-2 shadow-sm border border-slate-100 shrink-0">
              <img
                src="/logo-mark.png?v=9"
                alt="ProInterview"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 leading-tight">ProInterview Team</p>
              <p className="text-[10px] text-slate-400 leading-tight">contact@prointerview.vn</p>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}

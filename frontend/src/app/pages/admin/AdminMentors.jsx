import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Users, Search, Filter, CheckCircle, XCircle, Eye, ShieldCheck, Star, TrendingUp } from "lucide-react";
import { adminApi } from "../../api/adminApi.js";
import { tryApi } from "../../utils/shared/apiToast.js";
import { UserOnlineStatus } from "../../components/admin/UserOnlineStatus.jsx";
import { getInitials } from "../../utils/auth/auth.js";

export function AdminMentors() {
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const loadMentors = async (silent = false) => {
    if (!silent) setLoading(true);
    const res = await tryApi(() => adminApi.getMentors(), {
      fallback: "Không thể tải danh sách cố vấn.",
      silent: true,
    });
    if (res.success) {
      const active = res.mentors.filter(
        (m) => m.isActive && m.isVerified && m.userId?.role === "mentor",
      );
      setMentors(active);
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    void loadMentors();
    const timer = window.setInterval(() => void loadMentors(true), 45_000);
    return () => window.clearInterval(timer);
  }, []);

  const handleToggleActive = async (mentor) => {
    const nextStatus = !mentor.isActive;
    const res = await tryApi(() => adminApi.updateMentorStatus(mentor._id, nextStatus), {
      fallback: "Không thể cập nhật trạng thái cố vấn.",
      successMessage: nextStatus ? "Đã duyệt cố vấn" : "Đã khóa cố vấn",
    });
    if (!res.success) return;
    setMentors((prev) =>
      prev.map((m) =>
        m._id === mentor._id
          ? {
              ...m,
              isActive: nextStatus,
              isVerified: nextStatus ? true : m.isVerified,
            }
          : m,
      ),
    );
  };

  const filtered = mentors
    .filter(
      (m) =>
        m.userId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.userId?.email?.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .sort((a, b) => {
      if (a.isOnline === b.isOnline) return 0;
      return a.isOnline ? -1 : 1;
    });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-400 mb-1">
            Hệ thống Cố vấn
          </p>
          <h2 className="font-headline text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Quản lý <span className="text-violet-400">Cố vấn</span>
          </h2>
          <p className="text-sm font-medium text-slate-400 mt-1">Danh sách toàn bộ cố vấn trên hệ thống ProInterview.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative min-w-[240px] sm:w-72">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm tên, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-400 outline-none backdrop-blur-sm transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
          <button
            type="button"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-slate-300 transition-all hover:bg-white/10 hover:text-white"
            title="Bộ lọc"
          >
            <Filter size={18} />
          </button>
        </div>
      </div>

      <div className="glass-card overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] shadow-2xl backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.04]">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Cố vấn</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Chuyên môn</th>
                <th className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Hồ sơ
                </th>
                <th className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Trực tuyến
                </th>
                <th className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Đánh giá
                </th>
                <th className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  No-show
                </th>
                <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06] text-sm">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center text-sm text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="admin-orbital-loader" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Đang tải danh sách cố vấn...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center text-sm italic text-slate-400">
                    Không tìm thấy cố vấn nào.
                  </td>
                </tr>
              ) : (
                filtered.map((mentor) => (
                  <tr key={mentor._id} className="group transition-colors hover:bg-white/[0.03]">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3.5">
                        <div className="relative size-10 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-violet-950/40">
                          {mentor.userId?.avatar ? (
                            <img
                              src={mentor.userId.avatar}
                              alt={mentor.userId?.name || ""}
                              className="size-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                                const next = e.currentTarget.nextElementSibling;
                                if (next) next.classList.remove("hidden");
                              }}
                            />
                          ) : null}
                          <div
                            className={`flex size-full items-center justify-center font-bold text-xs text-violet-200 bg-gradient-to-br from-violet-600/30 to-indigo-600/30 ${
                              mentor.userId?.avatar ? "hidden" : ""
                            }`}
                          >
                            {mentor.userId?.name ? getInitials(mentor.userId.name) : "M"}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">{mentor.userId?.name || "Chưa đặt tên"}</p>
                          <p className="truncate text-xs text-slate-400">{mentor.userId?.email || ""}</p>
                          {mentor.pendingPricePerHour ? (
                            <Link
                              to={`/admin/mentors/${mentor._id}`}
                              className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-500/20"
                              title={`Đề xuất giá mới: ${Number(mentor.pendingPricePerHour).toLocaleString("vi-VN")} Đ/giờ`}
                            >
                              <TrendingUp size={10} /> Đổi giá
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-200">{mentor.title || "—"}</p>
                      <p className="text-[11px] uppercase tracking-wider text-slate-400">{mentor.company || "—"}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        {mentor.isActive ? (
                          <span className="admin-shimmer-badge inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
                            <CheckCircle size={12} /> Hoạt động
                          </span>
                        ) : mentor.isVerified ? (
                          <span className="admin-shimmer-badge inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-400">
                            <XCircle size={12} /> Đã khóa
                          </span>
                        ) : (
                          <span className="admin-shimmer-badge inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-400">
                            <XCircle size={12} /> Chờ duyệt
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <UserOnlineStatus
                        isOnline={Boolean(mentor.isOnline)}
                        lastSeenAt={mentor.lastSeenAt}
                        isActive={mentor.isActive !== false && mentor.userId?.isActive !== false}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1.5 text-amber-400">
                        <Star size={13} className="fill-current" />
                        <span className="font-bold text-white text-sm">{mentor.rating || "0.0"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {Number(mentor.stats?.noShowCount || 0) > 0 ? (
                        <span
                          className="inline-flex rounded-full border border-rose-500/30 bg-rose-500/15 px-2.5 py-0.5 text-xs font-bold text-rose-400"
                          title="Số lần no-show đã ghi nhận"
                        >
                          {mentor.stats.noShowCount}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-slate-500">0</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(mentor)}
                          className={`size-8 inline-flex items-center justify-center rounded-xl border transition-all ${
                            mentor.isActive
                              ? "border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white"
                              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white"
                          }`}
                          title={mentor.isActive ? "Khóa cố vấn" : "Kích hoạt cố vấn"}
                        >
                          <ShieldCheck size={16} />
                        </button>
                        <Link
                          to={`/admin/mentors/${mentor._id}`}
                          title="Xem chi tiết"
                          className="size-8 inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-all hover:bg-white/15 hover:text-white"
                        >
                          <Eye size={16} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

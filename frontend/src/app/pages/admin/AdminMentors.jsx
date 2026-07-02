import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Users, Search, Filter, CheckCircle, XCircle, Eye, ShieldCheck, Star, TrendingUp } from "lucide-react";
import { adminApi } from "../../api/adminApi.js";
import { tryApi } from "../../utils/shared/apiToast.js";
import { UserOnlineStatus } from "../../components/admin/UserOnlineStatus.jsx";

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
          <h2 className="font-headline mb-2 text-3xl font-black uppercase tracking-tighter text-slate-900">
            Quản lý <span className="text-violet-700">Cố vấn</span>
          </h2>
          <p className="text-sm font-medium text-slate-600">Danh sách toàn bộ cố vấn trên hệ thống ProInterview.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm tên, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-6 text-sm text-slate-900 outline-none transition-all focus:border-violet-400 md:w-64"
            />
          </div>
          <button
            type="button"
            className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900"
          >
            <Filter size={20} />
          </button>
        </div>
      </div>

      <div className="glass-card overflow-hidden border-slate-200/90">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90">
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Cố vấn</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Chuyên môn</th>
                <th className="px-8 py-6 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Hồ sơ
                </th>
                <th className="px-8 py-6 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Trực tuyến
                </th>
                <th className="px-8 py-6 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Đánh giá
                </th>
                <th className="px-8 py-6 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                  No-show
                </th>
                <th className="px-8 py-6 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-8 py-20 text-center italic text-slate-500">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-8 py-20 text-center italic text-slate-500">
                    Không tìm thấy cố vấn nào.
                  </td>
                </tr>
              ) : (
                filtered.map((mentor) => (
                  <tr key={mentor._id} className="group transition-colors hover:bg-violet-50/40">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <img
                          src={mentor.userId?.avatar}
                          alt=""
                          className="size-10 rounded-xl bg-slate-100 object-cover"
                        />
                        <div>
                          <p className="font-black text-slate-900">{mentor.userId?.name}</p>
                          <p className="text-[10px] text-slate-500">{mentor.userId?.email}</p>
                          {mentor.pendingPricePerHour ? (
                            <Link
                              to={`/admin/mentors/${mentor._id}`}
                              className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-800 hover:bg-amber-100"
                              title={`Đề xuất giá mới: ${Number(mentor.pendingPricePerHour).toLocaleString("vi-VN")} Đ/giờ`}
                            >
                              <TrendingUp size={10} /> Yêu cầu đổi giá
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <p className="font-medium text-slate-700">{mentor.title}</p>
                      <p className="text-[10px] uppercase tracking-widest text-slate-500">{mentor.company}</p>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex justify-center">
                        {mentor.isActive ? (
                          <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase text-emerald-700">
                            <CheckCircle size={10} /> Hoạt động
                          </span>
                        ) : mentor.isVerified ? (
                          <span className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[10px] font-black uppercase text-red-700">
                            <XCircle size={10} /> Đã khóa
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[10px] font-black uppercase text-orange-800">
                            <XCircle size={10} /> Chờ duyệt
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <UserOnlineStatus
                        isOnline={Boolean(mentor.isOnline)}
                        lastSeenAt={mentor.lastSeenAt}
                        isActive={mentor.isActive !== false && mentor.userId?.isActive !== false}
                      />
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-center gap-1 text-amber-500">
                        <Star size={12} className="fill-current" />
                        <span className="font-black text-slate-900">{mentor.rating || "0.0"}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      {Number(mentor.stats?.noShowCount || 0) > 0 ? (
                        <span
                          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[10px] font-black uppercase text-rose-800"
                          title="Số lần no-show đã ghi nhận"
                        >
                          {mentor.stats.noShowCount}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(mentor)}
                          className={`rounded-xl border p-2 transition-all ${
                            mentor.isActive
                              ? "border-red-200 bg-red-50 text-red-700 hover:border-red-400 hover:bg-red-600 hover:text-white"
                              : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-400 hover:bg-emerald-600 hover:text-white"
                          }`}
                          title={mentor.isActive ? "Khóa" : "Duyệt"}
                        >
                          <ShieldCheck size={16} />
                        </button>
                        <Link
                          to={`/admin/mentors/${mentor._id}`}
                          title="Chi tiết"
                          className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900"
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

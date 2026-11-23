import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Users, Search, Mail, Tag, Eye } from "lucide-react";
import { adminApi } from "../../api/adminApi.js";
import { tryApi } from "../../utils/shared/apiToast.js";
import { UserOnlineStatus } from "../../components/admin/UserOnlineStatus.jsx";
import { getInitials } from "../../utils/auth/auth.js";

export function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const loadUsers = async (silent = false) => {
    if (!silent) setLoading(true);
    const res = await tryApi(() => adminApi.getUsers(), {
      fallback: "Không thể tải danh sách người dùng.",
      silent: true,
    });
    if (res.success) setUsers(res.users);
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    void loadUsers();
    const timer = window.setInterval(() => void loadUsers(true), 45_000);
    return () => window.clearInterval(timer);
  }, []);

  const handleToggleActive = async (id, currentStatus) => {
    const res = await tryApi(() => adminApi.updateUserStatus(id, !currentStatus), {
      fallback: "Không thể cập nhật trạng thái người dùng.",
      successMessage: currentStatus ? "Đã khóa người dùng" : "Đã mở khóa người dùng",
    });
    if (res.success) {
      setUsers((prev) => prev.map((u) => (u._id === id ? { ...u, isActive: !currentStatus } : u)));
    }
  };

  const filtered = useMemo(
    () =>
      users
        .filter(
          (u) =>
            u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email?.toLowerCase().includes(searchTerm.toLowerCase()),
        )
        .sort((a, b) => {
          if (a.isOnline === b.isOnline) return 0;
          return a.isOnline ? -1 : 1;
        }),
    [users, searchTerm],
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-400 mb-1">
            Hệ thống Người dùng
          </p>
          <h2 className="font-headline text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Quản lý <span className="text-violet-400">Người dùng</span>
          </h2>
          <p className="text-sm font-medium text-slate-400 mt-1">Toàn bộ tài khoản đã đăng ký trên hệ thống ProInterview.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative min-w-[240px] sm:w-72">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm email, tên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-400 outline-none backdrop-blur-sm transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] shadow-2xl backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.04]">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Người dùng / Email
                </th>
                <th className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Vai trò
                </th>
                <th className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Gói cước
                </th>
                <th className="px-6 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Trực tuyến
                </th>
                <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06] text-sm">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-16 text-center text-sm text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="admin-orbital-loader" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Đang tải người dùng...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-16 text-center text-sm italic text-slate-400">
                    Không có dữ liệu người dùng.
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user._id} className="group transition-colors hover:bg-white/[0.03]">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3.5">
                        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-violet-950/40 text-violet-300">
                          {user.avatar ? (
                            <img src={user.avatar} alt="" className="size-full object-cover" />
                          ) : (
                            <span className="font-bold text-xs">{getInitials(user.name || "U")}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <Link to={`/admin/users/${user._id}`} className="truncate font-semibold text-white hover:text-violet-400 transition-colors block">
                            {user.name || "Người dùng"}
                          </Link>
                          <p className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Mail size={12} className="opacity-70" /> {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            user.role === "admin"
                              ? "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-400"
                              : user.role === "mentor"
                                ? "border-lime-500/30 bg-lime-500/10 text-lime-400"
                                : "border-white/10 bg-white/5 text-slate-300"
                          }`}
                        >
                          {user.role}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-300">
                        <Tag size={12} className="text-violet-400" /> {user.plan || "free"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <UserOnlineStatus
                        isOnline={Boolean(user.isOnline)}
                        lastSeenAt={user.lastSeenAt}
                        isActive={user.isActive !== false}
                      />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(user._id, user.isActive !== false)}
                          className={`inline-flex items-center justify-center rounded-xl border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
                            user.isActive !== false
                              ? "border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white"
                              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white"
                          }`}
                        >
                          {user.isActive !== false ? "Khóa" : "Mở khóa"}
                        </button>
                        <Link
                          to={`/admin/users/${user._id}`}
                          title="Chi tiết người dùng"
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

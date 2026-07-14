import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Users, Search, Mail, Tag, Upload } from "lucide-react";
import { adminApi } from "../../api/adminApi.js";
import { tryApi } from "../../utils/shared/apiToast.js";
import { UserOnlineStatus } from "../../components/admin/UserOnlineStatus.jsx";

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

  const filtered = users
    .filter(
      (u) =>
        u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()),
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
            Quản lý <span className="text-violet-700">Người dùng</span>
          </h2>
          <p className="text-sm font-medium text-slate-600">Toàn bộ tài khoản đã đăng ký trên hệ thống.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm email, tên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-6 text-sm text-slate-900 outline-none transition-all focus:border-violet-400 md:w-64"
            />
          </div>
          <Link
            to="/admin/users/import"
            className="flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white shadow-md shadow-violet-500/25 hover:bg-violet-700 transition-colors whitespace-nowrap"
          >
            <Upload size={16} /> Nhập từ Google Form
          </Link>
        </div>
      </div>


      <div className="glass-card overflow-hidden border-slate-200/90">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90">
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Người dùng / Email
                </th>
                <th className="px-8 py-6 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Vai trò
                </th>
                <th className="px-8 py-6 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Gói cước
                </th>
                <th className="px-8 py-6 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Trực tuyến
                </th>
                <th className="px-8 py-6 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-8 py-20 text-center text-[10px] font-black uppercase italic tracking-widest text-slate-500">
                    Đang tải dữ liệu người dùng...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-8 py-20 text-center text-[10px] font-black uppercase italic tracking-widest text-slate-500">
                    Không có dữ liệu người dùng.
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user._id} className="group transition-colors hover:bg-violet-50/40">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="flex size-10 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-slate-400 transition-colors group-hover:border-violet-200 group-hover:text-violet-700">
                          {user.avatar ? (
                            <img src={user.avatar} alt="" className="size-full object-cover" />
                          ) : (
                            <Users size={20} />
                          )}
                        </div>
                        <div>
                          <Link to={`/admin/users/${user._id}`} className="font-black text-slate-900 hover:text-violet-700">
                            {user.name}
                          </Link>
                          <p className="flex items-center gap-1 text-[10px] text-slate-500">
                            <Mail size={10} /> {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex justify-center">
                        <span
                          className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-widest ${
                            user.role === "admin"
                              ? "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700"
                              : user.role === "mentor"
                                ? "border-lime-200 bg-lime-50 text-lime-900"
                                : "border-slate-200 bg-slate-100 text-slate-600"
                          }`}
                        >
                          {user.role}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className="flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600">
                        <Tag size={12} className="text-violet-600" /> {user.plan || "free"}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <UserOnlineStatus
                        isOnline={Boolean(user.isOnline)}
                        lastSeenAt={user.lastSeenAt}
                        isActive={user.isActive !== false}
                      />
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(user._id, user.isActive !== false)}
                        className={`rounded-xl border px-4 py-2 text-[9px] font-black uppercase tracking-widest transition-all ${
                          user.isActive !== false
                            ? "border-red-200 bg-red-50 text-red-700 hover:border-red-400 hover:bg-red-600 hover:text-white"
                            : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-400 hover:bg-emerald-600 hover:text-white"
                        }`}
                      >
                        {user.isActive !== false ? "Khóa" : "Mở khóa"}
                      </button>
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

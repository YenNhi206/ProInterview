import { useState, useEffect } from "react";
import { 
  Users, 
  Search, 
  Filter, 
  ShieldAlert, 
  ShieldCheck, 
  Mail, 
  Calendar,
  Tag
} from "lucide-react";
import { adminApi } from "../../utils/adminApi";
import { toast } from "sonner";

export function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const loadUsers = async () => {
    setLoading(true);
    const res = await adminApi.getUsers();
    if (res.success) {
      setUsers(res.users);
    } else {
      toast.error(res.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleToggleActive = async (id, currentStatus) => {
    const res = await adminApi.updateUserStatus(id, !currentStatus);
    if (res.success) {
      toast.success(currentStatus ? "Đã khóa người dùng" : "Đã mở khóa người dùng");
      setUsers(prev => prev.map(u => u._id === id ? { ...u, isActive: !currentStatus } : u));
    } else {
      toast.error(res.error);
    }
  };

  const filtered = users.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase mb-2">Quản lý <span className="text-primary-fixed">Người dùng</span></h2>
          <p className="text-zinc-500 text-sm font-medium">Toàn bộ tài khoản đã đăng ký trên hệ thống.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input 
              type="text" 
              placeholder="Tìm email, tên..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-6 text-sm text-white focus:border-primary-fixed outline-none transition-all w-full md:w-64"
            />
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Người dùng / Email</th>
                <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">Vai trò</th>
                <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">Gói cước</th>
                <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">Trạng thái</th>
                <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-8 py-20 text-center text-zinc-500 italic uppercase text-[10px] tracking-widest">Đang tải dữ liệu người dùng...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-8 py-20 text-center text-zinc-500 italic uppercase text-[10px] tracking-widest">Không có dữ liệu người dùng.</td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user._id} className="group hover:bg-white/[0.01] transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 group-hover:text-primary-fixed transition-colors overflow-hidden">
                          {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : <Users size={20} />}
                        </div>
                        <div>
                          <p className="font-black text-white">{user.name}</p>
                          <p className="text-[10px] text-zinc-500 flex items-center gap-1"><Mail size={10} /> {user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex justify-center">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                          user.role === 'admin' ? 'bg-fuchsia-500/10 text-fuchsia-500 border-fuchsia-500/20' :
                          user.role === 'mentor' ? 'bg-primary-fixed/10 text-primary-fixed border-primary-fixed/20' :
                          'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                        }`}>
                          {user.role}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                       <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest flex items-center justify-center gap-1.5">
                          <Tag size={12} className="text-secondary" /> {user.plan || 'free'}
                       </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex justify-center">
                        {user.isActive !== false ? (
                          <span className="flex items-center gap-1.5 text-emerald-500 text-[10px] font-black uppercase tracking-widest">
                            <ShieldCheck size={12} /> Hoạt động
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-red-500 text-[10px] font-black uppercase tracking-widest">
                            <ShieldAlert size={12} /> Đã khóa
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button 
                        onClick={() => handleToggleActive(user._id, user.isActive !== false)}
                        className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                          user.isActive !== false 
                          ? "bg-red-500/5 text-red-500/60 hover:bg-red-500 hover:text-white border border-red-500/10" 
                          : "bg-emerald-500/5 text-emerald-500/60 hover:bg-emerald-500 hover:text-white border border-emerald-500/10"
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

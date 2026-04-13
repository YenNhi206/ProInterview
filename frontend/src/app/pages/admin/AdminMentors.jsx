import { useState, useEffect } from "react";
import { 
  Users, 
  Search, 
  Filter, 
  MoreHorizontal, 
  CheckCircle, 
  XCircle, 
  Eye, 
  ShieldCheck,
  Star,
  DollarSign
} from "lucide-react";
import { adminApi } from "../../utils/adminApi";
import { toast } from "sonner";

export function AdminMentors() {
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const loadMentors = async () => {
    setLoading(true);
    const res = await adminApi.getMentors();
    if (res.success) {
      setMentors(res.mentors);
    } else {
      toast.error(res.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadMentors();
  }, []);

  const handleToggleActive = async (id, currentStatus) => {
    const res = await adminApi.updateMentorStatus(id, !currentStatus);
    if (res.success) {
      toast.success(currentStatus ? "Đã khóa mentor" : "Đã duyệt mentor");
      setMentors(prev => prev.map(m => m._id === id ? { ...m, isActive: !currentStatus } : m));
    } else {
      toast.error(res.error);
    }
  };

  const filtered = mentors.filter(m => 
    m.userId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.userId?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase mb-2">Quản lý <span className="text-primary-fixed">Mentor</span></h2>
          <p className="text-zinc-500 text-sm font-medium">Danh sách toàn bộ mentor trên hệ thống ProInterview.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input 
              type="text" 
              placeholder="Tìm tên, email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-6 text-sm text-white focus:border-primary-fixed outline-none transition-all w-full md:w-64"
            />
          </div>
          <button className="p-3 rounded-2xl bg-white/5 border border-white/10 text-zinc-400 hover:text-white transition-all">
            <Filter size={20} />
          </button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Mentor</th>
                <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Chuyên môn</th>
                <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">Trạng thái</th>
                <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">Đánh giá</th>
                <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-8 py-20 text-center text-zinc-500 italic">Đang tải dữ liệu...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-8 py-20 text-center text-zinc-500 italic">Không tìm thấy mentor nào.</td>
                </tr>
              ) : (
                filtered.map((mentor) => (
                  <tr key={mentor._id} className="group hover:bg-white/[0.01] transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <img src={mentor.userId?.avatar} className="w-10 h-10 rounded-xl object-cover bg-white/10" />
                        <div>
                          <p className="font-black text-white">{mentor.userId?.name}</p>
                          <p className="text-[10px] text-zinc-500">{mentor.userId?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-zinc-300 font-medium">{mentor.title}</p>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{mentor.company}</p>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex justify-center">
                        {mentor.isActive ? (
                          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase border border-emerald-500/20">
                            <CheckCircle size={10} /> Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 text-orange-500 text-[10px] font-black uppercase border border-orange-500/20">
                            <XCircle size={10} /> Pending
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-center gap-1 text-[#FFD600]">
                        <Star size={12} className="fill-current" />
                        <span className="font-black">{mentor.rating || "0.0"}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleToggleActive(mentor._id, mentor.isActive)}
                          className={`p-2 rounded-xl border transition-all ${
                            mentor.isActive 
                            ? "bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white" 
                            : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white"
                          }`}
                          title={mentor.isActive ? "Khóa" : "Duyệt"}
                        >
                          <ShieldCheck size={16} />
                        </button>
                        <button className="p-2 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-white transition-all">
                          <Eye size={16} />
                        </button>
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

import { useState, useEffect } from "react";
import { 
  Users, 
  Search, 
  CheckCircle, 
  XCircle, 
  Eye, 
  ShieldCheck,
  FileText,
  Briefcase
} from "lucide-react";
import { adminApi } from "../../utils/adminApi";
import { toast } from "sonner";

export function AdminMentorsPending() {
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadPendingMentors = async () => {
    setLoading(true);
    const res = await adminApi.getMentors();
    if (res.success) {
      // Chỉ lấy những mentor chưa được active
      const pending = res.mentors.filter(m => !m.isActive);
      setMentors(pending);
    } else {
      toast.error(res.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPendingMentors();
  }, []);

  const handleApprove = async (id) => {
    const res = await adminApi.updateMentorStatus(id, true);
    if (res.success) {
      toast.success("Đã duyệt hồ sơ mentor thành công!");
      setMentors(prev => prev.filter(m => m._id !== id));
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h2 className="text-3xl font-black text-white tracking-tighter uppercase mb-2">Duyệt đăng ký <span className="text-primary-fixed">Mentor</span></h2>
        <p className="text-zinc-500 text-sm font-medium">Danh sách các chuyên gia đang chờ hệ thống phê duyệt hồ sơ.</p>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Ứng viên</th>
                <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Chức danh / Công ty</th>
                <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">Hồ sơ</th>
                <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-8 py-20 text-center text-zinc-500 italic uppercase text-[10px] tracking-widest">Đang tải danh sách chờ...</td>
                </tr>
              ) : mentors.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-8 py-20 text-center text-zinc-500 italic uppercase text-[10px] tracking-widest">Hiện không có hồ sơ nào đang chờ duyệt.</td>
                </tr>
              ) : (
                mentors.map((mentor) => (
                  <tr key={mentor._id} className="group hover:bg-white/[0.01] transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <img src={mentor.userId?.avatar} className="w-10 h-10 rounded-xl object-cover bg-white/10" />
                        <div>
                          <p className="font-black text-white">{mentor.userId?.name}</p>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{mentor.userId?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-zinc-300 font-medium lowercase first-letter:uppercase">
                        <Briefcase size={14} className="text-primary-fixed" /> {mentor.title}
                      </div>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">{mentor.company || 'Freelancer'}</p>
                    </td>
                    <td className="px-8 py-6 text-center">
                       <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white transition-all text-[10px] font-black uppercase">
                          <FileText size={12} /> Xem CV/Cert
                       </button>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button className="p-2 rounded-xl bg-red-500/5 text-red-500/40 hover:bg-red-500 hover:text-white transition-all border border-red-500/10">
                          <XCircle size={18} />
                        </button>
                        <button 
                          onClick={() => handleApprove(mentor._id)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest"
                        >
                          <CheckCircle size={14} /> Phê duyệt
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

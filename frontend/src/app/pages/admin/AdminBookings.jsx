import { useState, useEffect } from "react";
import { 
  Calendar, 
  Search, 
  Clock, 
  User, 
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertCircle,
  DollarSign
} from "lucide-react";
import { adminApi } from "../../utils/adminApi";
import { toast } from "sonner";

export function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const loadBookings = async () => {
    setLoading(true);
    const res = await adminApi.getBookings();
    if (res.success) {
      setBookings(res.bookings);
    } else {
      toast.error(res.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const filtered = bookings.filter(b => 
    b.userId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.mentorId?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid':
      case 'confirmed':
        return <span className="flex items-center gap-1.5 text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-500/20"><CheckCircle size={10} /> Đã xác nhận</span>;
      case 'pending':
        return <span className="flex items-center gap-1.5 text-orange-500 bg-orange-500/10 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-orange-500/20"><Clock size={10} /> Chờ duyệt</span>;
      case 'cancelled':
        return <span className="flex items-center gap-1.5 text-red-500 bg-red-500/10 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-red-500/20"><XCircle size={10} /> Đã hủy</span>;
      default:
        return <span className="flex items-center gap-1.5 text-zinc-500 bg-zinc-500/10 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-zinc-500/20">{status}</span>;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase mb-2">Quản lý <span className="text-primary-fixed">Bookings</span></h2>
          <p className="text-zinc-500 text-sm font-medium">Theo dõi toàn bộ các phiên mentor & phỏng vấn trên hệ thống.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input 
              type="text" 
              placeholder="Tìm user, mentor..." 
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
                <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Học viên</th>
                <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Mentor</th>
                <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Thời gian</th>
                <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">Trạng thái</th>
                <th className="px-8 py-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Chi phí</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-8 py-20 text-center text-zinc-500 italic uppercase text-[10px] tracking-widest">Đang tải lịch sử đặt lịch...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-8 py-20 text-center text-zinc-500 italic uppercase text-[10px] tracking-widest">Không có lịch hẹn nào.</td>
                </tr>
              ) : (
                filtered.map((b) => (
                  <tr key={b._id} className="group hover:bg-white/[0.01] transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-zinc-500">
                          <User size={14} />
                        </div>
                        <p className="font-black text-white">{b.userId?.name || 'User ẩn'}</p>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-zinc-400 font-medium">
                      {b.mentorId?.name || 'Mentor ẩn'}
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-white font-black">{b.date}</p>
                      <p className="text-[10px] text-zinc-500 flex items-center gap-1 uppercase tracking-widest"><Clock size={10} /> {b.timeSlot || b.time}</p>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex justify-center">
                        {getStatusBadge(b.status || b.paymentStatus)}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right font-black text-primary-fixed">
                      {(b.price || 0).toLocaleString()} <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">đ</span>
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

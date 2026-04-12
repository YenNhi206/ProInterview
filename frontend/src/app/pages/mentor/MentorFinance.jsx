import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  CircleDollarSign as CurrencyCircleDollar,
  ArrowUpRight,
  ArrowDownRight,
  History,
  ArrowRight,
  Wallet,
  PieChart as ChartPie,
  Calendar,
  CheckCircle2 as CheckCircle,
  Clock,
  Download,
  Filter,
  ArrowLeft,
  BadgeCheck,
  CreditCard,
  X,
  Plus
} from "lucide-react";
import { getUser } from "../../utils/auth";
import { MENTOR_FINANCIALS, MENTOR_DASHBOARD_STATS } from "../../data/mentorMockData";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";

const MENTOR_FINANCE_EXTRA_CSS = `
        .glass-tag {
           padding: 6px 12px;
           border-radius: 10px;
           font-size: 10px;
           font-weight: 900;
           text-transform: uppercase;
           letter-spacing: 0.1em;
        }
`;

/* ── Withdrawal Modal ────────────────────────────────────────────────── */
function WithdrawalModal({
  balance,
  onClose,
}) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleWithdraw = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
    }, 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-2xl bg-black/60"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        className="glass-card w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-10 text-center">
          {success ? (
            <div className="space-y-6 animate-in fade-in zoom-in duration-500">
              <div className="w-24 h-24 rounded-full bg-primary-fixed/20 border border-primary-fixed/40 flex items-center justify-center mx-auto text-primary-fixed">
                <CheckCircle size={48} />
              </div>
              <h2 className="text-3xl font-black text-white tracking-tighter">Yêu cầu thành công!</h2>
              <p className="text-sm text-zinc-500 font-medium px-4">Số tiền của bạn đang được hệ thống xử lý và sẽ chuyển khoản trong vòng 1-2 ngày làm việc.</p>
              <button onClick={onClose} className="w-full py-4 rounded-2xl bg-white text-black text-[10px] font-black uppercase tracking-widest shadow-xl">Đóng cửa sổ</button>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex items-center justify-between mb-2">
                 <h2 className="text-2xl font-black text-white tracking-tighter">Rút tiền mặt</h2>
                 <button onClick={onClose} className="text-zinc-600 hover:text-white transition-colors"><X size={20} /></button>
              </div>
              <div className="p-6 rounded-[32px] bg-white/5 border border-white/10 text-left">
                 <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Số dư khả dụng</p>
                 <h3 className="text-2xl font-black text-primary-fixed tracking-tight">{balance.toLocaleString()} ₫</h3>
              </div>
              <div className="space-y-4 text-left">
                 <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Số tiền muốn rút</label>
                 <div className="relative">
                    <input 
                       type="number" 
                       placeholder="Nhập số tiền..." 
                       value={amount}
                       onChange={(e) => setAmount(e.target.value)}
                       className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-lg font-black text-white outline-none focus:border-primary-fixed transition-all"
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-zinc-600">₫</span>
                 </div>
              </div>
              <button 
                onClick={handleWithdraw}
                disabled={!amount || parseInt(amount) < 100000 || loading}
                className="w-full py-5 rounded-3xl bg-primary-fixed text-black text-[10px] font-black uppercase tracking-widest shadow-[0_15px_40px_rgba(196, 255, 71,0.32)] hover:scale-[1.02] disabled:opacity-30 disabled:hover:scale-100 transition-all">
                {loading ? "Đang xử lý..." : "Xác nhận gửi yêu cầu"}
              </button>
              <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-[0.2em]">Hạn mức rút tối thiểu 100.000 ₫</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Main Finance Component ────────────────────────────────────────── */
export function MentorFinance() {
  const navigate = useNavigate();
  const user = getUser();
  const [activeTab, setActiveTab] = useState("all");
  const [showWithdraw, setShowWithdraw] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "mentor") {
      navigate("/");
    }
  }, []);

  if (!user || user.role !== "mentor") return null;

  const stats = MENTOR_DASHBOARD_STATS;
  const transactions = MENTOR_FINANCIALS.history;

  return (
    <MentorPageShell bottomPad="pb-32" extraStyles={MENTOR_FINANCE_EXTRA_CSS}>
      <div className="relative z-10 p-10 max-w-7xl mx-auto pt-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-16">
          <div>
            <h1 className="text-6xl font-black text-white font-headline tracking-tighter mb-4 uppercase">
               Quản lý <span className="text-secondary tracking-tighter">Tài chính</span>
            </h1>
            <p className="text-white/55 text-lg font-medium">Theo dõi thu nhập, giao dịch và quản lý dòng tiền của bạn</p>
          </div>
        </div>

        {/* Main Wallet Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-16">
           {/* Primary Balance */}
           <div className="lg:col-span-7 glass-card p-12 bg-gradient-to-br from-[#6E35E8]/20 to-transparent overflow-hidden group">
              <div className="absolute top-0 right-0 p-12 rotate-12 opacity-10 group-hover:rotate-0 transition-all duration-700">
                 <Wallet size={160} className="text-[#6E35E8]" />
              </div>
              <div className="relative z-10">
                 <p className="text-[10px] font-black text-primary-fixed uppercase tracking-[0.4em] mb-6">Số dư khả dụng</p>
                 <div className="flex items-baseline gap-4 mb-10">
                    <h2 className="text-7xl font-black text-white tracking-tighter">{(2240000).toLocaleString()}</h2>
                    <p className="text-2xl font-black text-zinc-500 uppercase tracking-widest mb-1">vnđ</p>
                 </div>
                 <div className="flex flex-wrap gap-4">
                    <button 
                       onClick={() => setShowWithdraw(true)}
                       className="px-10 py-5 rounded-3xl bg-primary-fixed text-black text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-[0_15px_40px_rgba(196, 255, 71,0.32)]">
                       Rút tiền ngay
                    </button>
                    <button className="px-10 py-5 rounded-3xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all">
                       Xem lịch sử rút
                    </button>
                 </div>
              </div>
           </div>

           {/* Secondary Stats Group */}
           <div className="lg:col-span-5 grid grid-cols-1 gap-8">
              <div className="glass-card p-10 flex items-center justify-between border-t border-t-secondary/20">
                 <div>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Chờ giải ngân</p>
                    <h3 className="text-4xl font-black text-white tracking-tighter">400.000 ₫</h3>
                    <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mt-2">Dự kiến sau 7 ngày</p>
                 </div>
                 <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary">
                    <Clock size={28} />
                 </div>
              </div>

              <div className="glass-card p-10 flex items-center justify-between">
                 <div>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Tổng thu nhập</p>
                    <h3 className="text-4xl font-black text-white tracking-tighter">3.760.000 ₫</h3>
                    <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mt-2 flex items-center gap-2">
                       <ArrowUpRight size={14} className="text-primary-fixed" /> +12% so với tháng trước
                    </p>
                 </div>
                 <div className="w-14 h-14 rounded-2xl bg-primary-fixed/10 flex items-center justify-center text-primary-fixed">
                    <ChartPie size={28} />
                 </div>
              </div>
           </div>
        </div>

        {/* Transaction History */}
        <div className="glass-card overflow-hidden">
           <div className="p-10 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-8 bg-white/[0.01]">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-secondary">
                    <History size={22} />
                 </div>
                 <div>
                    <h4 className="text-xl font-black text-white tracking-tight">Lịch sử giao dịch</h4>
                    <p className="text-xs font-medium text-zinc-600 uppercase tracking-widest">Danh sách các khoản thu và lệnh rút tiền</p>
                 </div>
              </div>
              <div className="flex gap-2">
                 {["all", "income", "withdraw"].map(t => (
                    <button key={t} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-white text-black' : 'bg-white/5 text-zinc-500 hover:text-white'}`} onClick={() => setActiveTab(t)}>
                       {t === 'all' ? 'Tất cả' : t === 'income' ? 'Thu nhập' : 'Rút tiền'}
                    </button>
                 ))}
              </div>
           </div>

           <div className="overflow-x-auto">
              <table className="w-full">
                 <thead>
                    <tr className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] border-b border-white/5">
                       <th className="px-10 py-6 text-left">Giao dịch</th>
                       <th className="px-10 py-6 text-left">Ngày tháng</th>
                       <th className="px-10 py-6 text-left">Số tiền</th>
                       <th className="px-10 py-6 text-left">Trạng thái</th>
                       <th className="px-10 py-6 text-right">Chi tiết</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-white/5">
                    {transactions.map((tx, i) => (
                      <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                         <td className="px-10 py-8">
                            <div className="flex items-center gap-4">
                               <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.type === 'income' ? 'bg-primary-fixed/10 text-primary-fixed' : 'bg-orange-500/10 text-orange-400'}`}>
                                  {tx.type === 'income' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                               </div>
                               <div>
                                  <p className="text-sm font-black text-white tracking-tight">{tx.description}</p>
                                  <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">ID: {tx.id}</p>
                               </div>
                            </div>
                         </td>
                         <td className="px-10 py-8">
                            <p className="text-xs font-black text-white">{new Date(tx.date).toLocaleDateString("vi-VN")}</p>
                         </td>
                         <td className="px-10 py-8">
                            <p className={`text-sm font-black tracking-tight ${tx.type === 'income' ? 'text-primary-fixed' : 'text-white'}`}>
                               {tx.type === 'income' ? '+' : '-'}{tx.amount.toLocaleString()} ₫
                            </p>
                         </td>
                         <td className="px-10 py-8">
                            <div className="flex">
                               <span className={`glass-tag ${tx.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-orange-400/10 text-orange-400 border border-orange-400/20'}`}>
                                  {tx.status === 'completed' ? 'Thành công' : 'Đang xử lý'}
                               </span>
                            </div>
                         </td>
                         <td className="px-10 py-8 text-right">
                            <button className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-600 hover:text-white transition-all ml-auto">
                               <ArrowRight size={16} />
                            </button>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      </div>

      <AnimatePresence>
        {showWithdraw && <WithdrawalModal balance={2240000} onClose={() => setShowWithdraw(false)} />}
      </AnimatePresence>
    </MentorPageShell>
  );
}

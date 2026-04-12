import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  Video,
  Users,
  X,
  PlusCircle,
  Trash2,
  Save,
  Clock3,
  Globe
} from "lucide-react";
import { getUser } from "../../utils/auth";
import { UPCOMING_MENTOR_MEETINGS } from "../../data/mentorMockData";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";

const MENTOR_SCHEDULE_EXTRA_CSS = `
        .calendar-cell {
           aspect-ratio: 1;
           display: flex;
           flex-direction: column;
           align-items: center;
           justify-content: center;
           border-radius: 18px;
           transition: all 0.3s;
           cursor: pointer;
           position: relative;
        }
        .calendar-cell:hover { background: rgba(255, 255, 255, 0.05); }
        .calendar-cell.active {
           background: #c4ff47;
           color: black;
           box-shadow: 0 10px 30px rgba(180, 245, 0, 0.3);
           font-weight: 900;
        }
        .calendar-cell.dot::after {
           content: '';
           position: absolute;
           bottom: 6px;
           width: 4px;
           height: 4px;
           border-radius: 50%;
           background: #6E35E8;
        }
`;

/* ── Manage Availability Modal ────────────────────────────────────────── */
function AvailabilityModal({ onClose }) {
  const [workingHours, setWorkingHours] = useState([
    { day: "Thứ 2", slots: ["09:00 - 11:00", "14:00 - 17:00"] },
    { day: "Thứ 3", slots: ["09:00 - 11:00"] },
    { day: "Thứ 4", slots: ["14:00 - 17:00", "19:00 - 21:00"] },
  ]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-3xl bg-black/60"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 30 }}
        className="glass-card w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
           <div>
              <h2 className="text-2xl font-black text-white tracking-tighter">Cài đặt Thời gian rảnh</h2>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1 text-primary-fixed">Quản lý lịch làm việc định kỳ hàng tuần</p>
           </div>
           <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500 hover:text-white transition-all">
              <X size={18} />
           </button>
        </div>

        <div className="p-8 overflow-y-auto space-y-8 custom-scrollbar">
           <div className="p-6 rounded-3xl bg-primary-fixed/5 border border-primary-fixed/10 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary-fixed/20 flex items-center justify-center text-primary-fixed">
                 <Globe size={20} />
              </div>
              <div>
                 <p className="text-xs font-black text-white uppercase tracking-widest">Múi giờ hệ thống</p>
                 <p className="text-xs font-medium text-zinc-500">(GMT+07:00) Asia/Ho_Chi_Minh</p>
              </div>
           </div>

           <div className="space-y-4">
              {workingHours.map((row, idx) => (
                <div key={idx} className="p-6 rounded-[32px] bg-white/[0.02] border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 group">
                   <div className="w-24 shrink-0">
                      <p className="text-sm font-black text-white group-hover:text-primary-fixed transition-colors">{row.day}</p>
                   </div>
                   <div className="flex-1 flex flex-wrap gap-2">
                      {row.slots.map((s, i) => (
                        <div key={i} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2 group/slot">
                           {s} <X size={12} className="cursor-pointer hover:text-red-500" />
                        </div>
                      ))}
                      <button className="px-4 py-2 rounded-xl bg-primary-fixed/10 border border-primary-fixed/20 text-primary-fixed text-[10px] font-black uppercase tracking-widest hover:bg-primary-fixed/20 transition-all flex items-center gap-2">
                         <Plus size={12} /> Thêm slot
                      </button>
                   </div>
                </div>
              ))}
           </div>
        </div>

        <div className="p-6 border-t border-white/5 bg-black/20 flex items-center justify-between">
           <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-4">Lưu ý: Thay đổi sẽ áp dụng từ tuần kế tiếp</p>
           <div className="flex gap-4">
              <button onClick={onClose} className="px-8 py-3 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-all">Hủy</button>
              <button onClick={onClose} className="px-8 py-3 rounded-2xl bg-primary-fixed text-black text-[10px] font-black uppercase tracking-widest shadow-xl">Lưu cấu hình</button>
           </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Main Schedule Component ────────────────────────────────────────── */
export function MentorSchedule() {
  const navigate = useNavigate();
  const user = getUser();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAvailability, setShowAvailability] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "mentor") {
      navigate("/");
    }
  }, []);

  if (!user || user.role !== "mentor") return null;

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDayOfMonth = (getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth()) + 6) % 7; // ISO week start

  const prevMonthDays = Array.from({ length: firstDayOfMonth }, (_, i) => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), -firstDayOfMonth + i + 1);
    return { date: d, currentMonth: false };
  });

  const currentMonthDays = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1);
    return { date: d, currentMonth: true };
  });

  const calendarDays = [...prevMonthDays, ...currentMonthDays];
  const totalCells = Math.ceil(calendarDays.length / 7) * 7;
  const paddingDays = Array.from({ length: totalCells - calendarDays.length }, (_, i) => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i + 1);
    return { date: d, currentMonth: false };
  });

  const finalDays = [...calendarDays, ...paddingDays];

  return (
    <MentorPageShell bottomPad="pb-32" extraStyles={MENTOR_SCHEDULE_EXTRA_CSS}>
      <div className="relative z-10 p-10 max-w-7xl mx-auto pt-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-16">
          <div>
            <h1 className="text-6xl font-black text-white font-headline tracking-tighter mb-4 uppercase">
               Lịch trình <span className="text-primary-fixed tracking-tighter">Hệ thống</span>
            </h1>
            <p className="text-zinc-500 text-lg font-medium">Bố trí thời gian rảnh và quản lý các buổi hẹn mentor</p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setShowAvailability(true)} className="px-8 py-4 rounded-3xl bg-secondary text-black text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl flex items-center gap-2">
              <Clock size={16} /> Cài đặt làm việc
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-10 items-start">
           {/* Calendar Glass UI */}
           <div className="lg:col-span-12 xl:col-span-7 glass-card p-10">
              <div className="flex items-center justify-between mb-10">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-primary-fixed">
                       <CalendarIcon size={22} />
                    </div>
                    <div>
                       <h3 className="text-2xl font-black text-white tracking-tighter italic">
                          {currentDate.toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}
                       </h3>
                       <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Lịch trình khả dụng</p>
                    </div>
                 </div>
                 <div className="flex gap-2">
                    <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500 hover:text-white transition-all"><ChevronLeft size={18} /></button>
                    <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500 hover:text-white transition-all"><ChevronRight size={18} /></button>
                 </div>
              </div>

              <div className="grid grid-cols-7 gap-4 mb-4">
                 {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map(d => (
                   <div key={d} className="text-center text-[10px] font-black text-zinc-600 uppercase tracking-widest py-4">{d}</div>
                 ))}
                 {finalDays.map((cell, i) => {
                   const isSelected = selectedDate.toDateString() === cell.date.toDateString();
                   const isToday = new Date().toDateString() === cell.date.toDateString();
                   const hasMeetings = Math.random() > 0.7; // Mock for dots
                   return (
                     <div 
                        key={i} 
                        onClick={() => setSelectedDate(cell.date)}
                        className={`calendar-cell ${isSelected ? 'active' : ''} ${cell.currentMonth ? 'text-white' : 'text-zinc-700 opacity-30'} ${hasMeetings ? 'dot' : ''}`}
                     >
                        <span className="text-xs">{cell.date.getDate()}</span>
                        {isToday && !isSelected && <div className="absolute top-2 right-2 w-1 h-1 rounded-full bg-primary-fixed" />}
                     </div>
                   );
                 })}
              </div>
              <div className="mt-10 pt-10 border-t border-white/5 flex items-center gap-8 justify-center sm:justify-start">
                 <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    <div className="w-3 h-3 rounded-full bg-primary-fixed" /> Hôm nay
                 </div>
                 <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    <div className="w-3 h-3 rounded-full bg-[#6E35E8]" /> Có lịch hẹn
                 </div>
              </div>
           </div>

           {/* Daily Schedule Stack */}
           <div className="lg:col-span-12 xl:col-span-5 space-y-8">
              <div className="glass-card p-10 h-full">
                 <div className="flex items-center justify-between mb-8">
                    <h4 className="text-lg font-black text-white uppercase tracking-tighter">Ngày {selectedDate.getDate()} thg {selectedDate.getMonth() + 1}</h4>
                    <button className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-primary-fixed hover:bg-white/10 transition-all"><Plus size={18} /></button>
                 </div>

                 <div className="space-y-4">
                    {UPCOMING_MENTOR_MEETINGS.slice(0, 4).map((meeting, i) => (
                      <div key={i} className="group relative p-6 rounded-[32px] bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all cursor-pointer overflow-hidden">
                         <div className="absolute top-0 left-0 w-1.5 h-full bg-primary-fixed scale-y-0 group-hover:scale-y-100 transition-transform origin-top" />
                         <div className="flex items-center gap-4 mb-4">
                            <img src={meeting.mentee.avatar} className="w-10 h-10 rounded-2xl object-cover ring-2 ring-white/5" />
                            <div>
                               <p className="text-sm font-black text-white">{meeting.mentee.name}</p>
                               <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{meeting.position}</p>
                            </div>
                         </div>
                         <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 text-xs font-black text-primary-fixed uppercase tracking-widest">
                               <Clock3 size={14} /> {meeting.scheduledTime}
                            </div>
                            <span className="text-[9px] font-black px-2 py-1 rounded-md bg-white/5 text-zinc-500 uppercase tracking-widest">Online</span>
                         </div>
                      </div>
                    ))}
                    <div className="p-6 rounded-[32px] border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-zinc-700 hover:border-white/10 hover:text-zinc-500 transition-all cursor-pointer min-h-[140px]">
                       <PlusCircle size={32} className="mb-2 opacity-20" />
                       <p className="text-[10px] font-black uppercase tracking-widest">Thêm slot trống mới</p>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>

      <AnimatePresence>
        {showAvailability && <AvailabilityModal onClose={() => setShowAvailability(false)} />}
      </AnimatePresence>
    </MentorPageShell>
  );
}
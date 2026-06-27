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
import { getUser } from "../../utils/auth/auth.js";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { listMentorBookings } from "../../api/bookingsApi.js";
import { fetchMentorAvailability, updateMyMentorAvailability } from "../../api/mentorApi.js";
import { toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";
import { AppSelect } from "../../components/ui/AppSelect";

import { avatarSrc, DEFAULT_AVATAR } from "../../utils/shared/mediaUrl.js";
import { sessionTypeLabel } from "../../utils/booking/sessionTypeLabels.js";

const BOOKING_STATUS_LABELS = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  in_progress: "Đang diễn ra",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
  rescheduled: "Đổi lịch",
  no_show: "Không tham gia",
};

function formatSessionType(value) {
  return sessionTypeLabel(value);
}

function formatBookingStatus(value) {
  const key = String(value || "").toLowerCase();
  return BOOKING_STATUS_LABELS[key] || "Chưa rõ";
}

function toMeetingItem(booking) {
  const status = booking.status || "";
  return {
    id: booking.id || booking._id || "",
    status,
    statusLabel: formatBookingStatus(status),
    date: booking.date || "",
    scheduledTime: booking.timeSlot || "--:--",
    position: formatSessionType(booking.sessionType),
    mentee: {
      name: booking.customerName || "Học viên",
      avatar: avatarSrc(booking.customerAvatar) || DEFAULT_AVATAR,
    },
  };
}

function bookingOnDate(bookingDate, selectedDate) {
  const normalized = String(bookingDate || "").trim();
  if (!normalized) return false;
  const parts = normalized.split("/");
  if (parts.length < 2) return false;
  const d = Number(parts[0]);
  const m = Number(parts[1]);
  const y = parts.length >= 3 ? Number(parts[2]) : null;
  if (!Number.isFinite(d) || !Number.isFinite(m)) return false;
  if (y && y !== selectedDate.getFullYear()) return false;
  return d === selectedDate.getDate() && m === selectedDate.getMonth() + 1;
}

function formatMonthYear(date) {
  return `Tháng ${date.getMonth() + 1} năm ${date.getFullYear()}`;
}

function formatSelectedDayLabel(date) {
  return `Ngày ${date.getDate()} · Tháng ${date.getMonth() + 1}`;
}

function isSameCalendarDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const MENTOR_SCHEDULE_EXTRA_CSS = `
        .schedule-panel.glass-card:hover {
           transform: none;
           box-shadow: 0 8px 18px rgba(128, 55, 244, 0.07);
        }
        .calendar-cell {
           aspect-ratio: 1;
           min-height: 2.25rem;
           display: flex;
           flex-direction: column;
           align-items: center;
           justify-content: center;
           border-radius: 12px;
           transition: background 0.2s, color 0.2s, box-shadow 0.2s;
           cursor: pointer;
           position: relative;
        }
        .calendar-cell:hover { background: rgba(15, 23, 42, 0.04); }
        .calendar-cell.active {
           background: #93f72b;
           color: #0a0814;
           box-shadow: 0 6px 18px rgba(180, 245, 0, 0.28);
           font-weight: 700;
        }
        .calendar-cell.today:not(.active) {
           box-shadow: inset 0 0 0 2px rgba(147, 247, 43, 0.85);
        }
        .calendar-cell.dot::after {
           content: '';
           position: absolute;
           bottom: 5px;
           width: 5px;
           height: 5px;
           border-radius: 50%;
           background: #8037f4;
        }
        .calendar-cell.active.dot::after {
           background: #630ed4;
        }
`;

/* ── Manage Availability Modal ────────────────────────────────────────── */
const DAY_ROWS = [
  { key: 0, label: "Thứ 2" },
  { key: 1, label: "Thứ 3" },
  { key: 2, label: "Thứ 4" },
  { key: 3, label: "Thứ 5" },
  { key: 4, label: "Thứ 6" },
  { key: 5, label: "Thứ 7" },
  { key: 6, label: "Chủ nhật" },
];

const SLOT_OPTIONS = Array.from({ length: 16 }, (_, i) => {
  const hour = i + 7; // 07:00 -> 22:00
  return `${String(hour).padStart(2, "0")}:00`;
});

function toOneHourRange(start) {
  const [h, m] = String(start || "09:00").split(":").map(Number);
  const safeH = Number.isFinite(h) ? h : 9;
  const safeM = Number.isFinite(m) ? m : 0;
  const end = `${String(Math.min(safeH + 1, 23)).padStart(2, "0")}:${String(safeM).padStart(2, "0")}`;
  return `${String(safeH).padStart(2, "0")}:${String(safeM).padStart(2, "0")} - ${end}`;
}

function toRowSlots(slots = []) {
  return slots
    .filter(Boolean)
    .map((s) => {
      const [h, m] = String(s).split(":").map(Number);
      const endHour = Math.min((Number.isFinite(h) ? h : 0) + 1, 23);
      const end = `${String(endHour).padStart(2, "0")}:${String(Number.isFinite(m) ? m : 0).padStart(2, "0")}`;
      return `${s} - ${end}`;
    });
}

function toStartSlots(rangeSlots = []) {
  return rangeSlots
    .map((s) => String(s).split("-")[0]?.trim())
    .filter((v) => /^\d{2}:\d{2}$/.test(v));
}

function AvailabilityModal({ onClose, availability, onSaved }) {
  const [workingHours, setWorkingHours] = useState(() => {
    const hasData = availability && Array.isArray(availability.recurringSchedule);
    const recurring = hasData ? availability.recurringSchedule : [];
    
    const rows = recurring
      .filter((r) => Number.isFinite(Number(r?.dayOfWeek)))
      .map((r) => ({
        dayOfWeek: Number(r.dayOfWeek),
        day: DAY_ROWS.find((d) => d.key === Number(r.dayOfWeek))?.label || `Thứ ${Number(r.dayOfWeek) + 2}`,
        slots: toRowSlots(Array.isArray(r.slots) ? r.slots : []),
      }));

    if (rows.length > 0) return rows.sort((a, b) => a.dayOfWeek - b.dayOfWeek);

    return [];
  });
  const [saving, setSaving] = useState(false);
  const [newSlotDay, setNewSlotDay] = useState(0);
  const [newSlotRange, setNewSlotRange] = useState(toOneHourRange("09:00"));

  const addSlot = (dayOfWeek, value) => {
    const [h, m] = value.split(":").map(Number);
    const end = `${String(Math.min(h + 1, 23)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const range = `${value} - ${end}`;
    setWorkingHours((prev) =>
      (prev.some((row) => row.dayOfWeek === dayOfWeek)
        ? prev.map((row) => {
            if (row.dayOfWeek !== dayOfWeek) return row;
            if (row.slots.includes(range)) return row;
            const nextSlots = [...row.slots, range].sort((a, b) => a.localeCompare(b));
            return { ...row, slots: nextSlots };
          })
        : [
            ...prev,
            {
              dayOfWeek,
              day: DAY_ROWS.find((d) => d.key === dayOfWeek)?.label || "Thứ 2",
              slots: [range],
            },
          ])
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek),
    );
  };

  const removeSlot = (dayOfWeek, slot) => {
    setWorkingHours((prev) =>
      prev
        .map((row) => (row.dayOfWeek === dayOfWeek ? { ...row, slots: row.slots.filter((s) => s !== slot) } : row))
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    const recurringSchedule = workingHours
      .map((row) => ({ dayOfWeek: row.dayOfWeek, slots: toStartSlots(row.slots) }))
      .filter((row) => row.slots.length > 0)
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    try {
      const result = await updateMyMentorAvailability({ recurringSchedule });
      if (!result.success) {
        toastApiError(result.error, "Không lưu được lịch rảnh.");
        return;
      }
      toastApiSuccess("Đã lưu lịch rảnh.");
      onSaved?.(result.availability);
      onClose();
    } catch {
      toastApiError("Lỗi kết nối khi lưu lịch rảnh.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-6 backdrop-blur-sm bg-slate-900/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 30 }}
        className="glass-card w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 border-b border-slate-200 flex items-center justify-between bg-slate-50">
           <div>
              <h2 className="text-2xl font-bold text-slate-900">Cài đặt thời gian rảnh</h2>
              <p className="mt-1 text-sm text-violet-700">Quản lý lịch làm việc định kỳ hàng tuần</p>
           </div>
           <button onClick={onClose} className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-zinc-500 hover:text-slate-900 transition-all">
              <X size={18} />
           </button>
        </div>

        <div className="p-8 overflow-y-auto space-y-8 custom-scrollbar">
           <div className="p-6 rounded-3xl bg-primary-fixed/5 border border-primary-fixed/10 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary-fixed/20 flex items-center justify-center text-violet-700">
                 <Globe size={20} />
              </div>
              <div>
                 <p className="text-sm font-normal text-slate-900">Múi giờ hệ thống</p>
                 <p className="text-xs font-normal text-zinc-500">(GMT+07:00) Asia/Ho_Chi_Minh</p>
              </div>
           </div>

           <div className="space-y-4">
              {workingHours.map((row, idx) => (
                <div key={idx} className="p-6 rounded-[32px] bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-6 group">
                   <div className="w-24 shrink-0">
                      <p className="text-sm font-semibold text-slate-900 group-hover:text-violet-700 transition-colors">{row.day}</p>
                   </div>
                    <div className="flex-1 flex flex-wrap gap-2">
                       {row.slots.map((s, i) => (
                         <div key={i} className="group/item relative flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-normal text-zinc-600 transition-all hover:border-red-200 hover:bg-red-50/30">
                            <span className="group-hover/item:text-slate-900 transition-colors">{s}</span>
                            <button 
                               onClick={() => removeSlot(row.dayOfWeek, s)}
                               className="p-1 rounded-md hover:bg-red-500/10 text-zinc-400 hover:text-red-600 transition-all flex items-center justify-center"
                               title="Xóa khung giờ này"
                            >
                               <X size={14} />
                            </button>
                         </div>
                       ))}
                       {row.slots.length === 0 && (
                          <p className="text-[10px] italic text-zinc-400 font-normal py-2">Chưa có khung giờ nào cho ngày này.</p>
                       )}
                    </div>
                </div>
              ))}

               <div className="mt-8 p-6 rounded-[32px] bg-slate-50/50 border-2 border-dashed border-slate-200">
                  <p className="mb-4 text-center text-sm font-normal text-slate-500">Thêm khung giờ mới</p>
                  <div className="flex flex-col md:flex-row items-center gap-4">
                     <div className="flex-1 w-full grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                           <p className="ml-3 text-xs font-normal text-violet-700">Ngày trong tuần</p>
                           <AppSelect
                              size="default"
                              value={newSlotDay}
                              onValueChange={(v) => setNewSlotDay(Number(v))}
                              options={DAY_ROWS.map((d) => ({ value: d.key, label: d.label }))}
                           />
                        </div>
                        <div className="space-y-1.5">
                           <p className="ml-3 text-xs font-normal text-violet-700">Bắt đầu từ</p>
                           <AppSelect
                              size="default"
                              value={newSlotRange}
                              onValueChange={setNewSlotRange}
                              options={SLOT_OPTIONS.map((start) => {
                                 const range = toOneHourRange(start);
                                 return { value: range, label: range };
                              })}
                           />
                        </div>
                     </div>
                     <div className="md:pt-5 w-full md:w-auto">
                        <button
                           onClick={() => addSlot(newSlotDay, String(newSlotRange).split("-")[0].trim())}
                           className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#8037f4] px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#8037f4]/25 transition-all hover:scale-[1.02] hover:bg-[#6d2fd6] active:scale-[0.98] md:w-auto"
                        >
                           <Plus size={14} /> Thêm vào lịch
                        </button>
                     </div>
                  </div>
               </div>
           </div>
        </div>

        <div className="p-6 border-t border-slate-200 bg-slate-100 flex items-center justify-between">
           <p className="px-4 text-xs text-zinc-600">Lưu ý: Thay đổi sẽ áp dụng từ tuần kế tiếp</p>
           <div className="flex gap-4">
              <button onClick={onClose} className="rounded-2xl border border-slate-200 bg-slate-50 px-8 py-3 text-sm font-normal text-zinc-600 transition-all hover:text-slate-900">Hủy</button>
              <button disabled={saving} onClick={handleSave} className="rounded-2xl bg-[#93f72b] px-8 py-3 text-sm font-semibold text-[#120B2E] shadow-xl shadow-[#93f72b]/25 disabled:opacity-60">
                {saving ? "Đang lưu..." : "Lưu cấu hình"}
              </button>
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
  const [mentorMeetings, setMentorMeetings] = useState([]);
  const [availability, setAvailability] = useState(null);

  useEffect(() => {
    if (!user || user.role !== "mentor") {
      navigate("/");
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const result = await listMentorBookings();
      if (!active) return;
      if (!result.success) {
        toastApiError(result.error, "Không tải được lịch hẹn mentor.");
        return;
      }
      const rows = Array.isArray(result.bookings) ? result.bookings : [];
      setMentorMeetings(rows.map(toMeetingItem));
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const mentorLookupId = user?.id || user?._id;
      if (!mentorLookupId) return;
      try {
        const data = await fetchMentorAvailability(mentorLookupId);
        if (!active) return;
        if (data) setAvailability(data);
      } catch {
        if (active) toastApiError("Lỗi kết nối khi tải lịch trống.");
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id, user?._id]);

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  };

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
  const activeStatuses = new Set(["pending", "confirmed", "in_progress"]);
  const sourceMeetings = mentorMeetings;
  const selectedDayMeetings = sourceMeetings.filter((m) => bookingOnDate(m.date, selectedDate) || bookingOnDate(m.scheduledDate, selectedDate));

  return (
    <MentorPageShell
      bottomPad="pb-4"
      fillHeight
      className="!min-h-0 !pb-4"
      extraStyles={MENTOR_SCHEDULE_EXTRA_CSS}
    >
      <div className="relative z-10 mx-auto flex max-lg:min-h-0 max-lg:h-auto max-lg:max-h-none min-h-0 max-w-7xl flex-col overflow-visible px-4 pt-2 sm:px-6 lg:h-[calc(100svh-7.5rem)] lg:max-h-[calc(100svh-7.5rem)] lg:px-8">
        {/* Header — compact */}
        <div className="mb-4 flex shrink-0 flex-col gap-3 overflow-visible pt-1 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 overflow-visible">
            <h1 className="font-headline text-[clamp(1.75rem,4vw,2.75rem)] font-black leading-tight tracking-tight text-slate-900">
              Lịch trình <span className="text-[#8037f4]">hệ thống</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-500">
              Lịch rảnh và quản lý các buổi hẹn mentor.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAvailability(true)}
            className="flex shrink-0 items-center gap-2 self-start rounded-xl bg-[#93f72b] px-5 py-2.5 text-xs font-bold text-[#120B2E] shadow-[0_6px_18px_rgba(147,247,43,0.32)] transition-all hover:brightness-105 sm:px-6 sm:py-3"
          >
            <Clock size={15} /> Cài đặt làm việc
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
           {/* Calendar */}
           <div className="schedule-panel glass-card flex min-h-0 flex-col p-4 sm:p-5 lg:col-span-7">
              <div className="mb-3 flex shrink-0 items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-violet-700">
                       <CalendarIcon size={18} />
                    </div>
                    <div>
                       <h3 className="text-lg font-bold text-slate-900 sm:text-xl">
                          {formatMonthYear(currentDate)}
                       </h3>
                       <p className="text-sm text-slate-500">Lịch rảnh trong tháng</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={goToToday}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-normal text-violet-700 transition-colors hover:bg-violet-50"
                    >
                      Hôm nay
                    </button>
                    <button type="button" onClick={() => setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-zinc-500 transition-all hover:text-slate-900" aria-label="Tháng trước"><ChevronLeft size={16} /></button>
                    <button type="button" onClick={() => setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-zinc-500 transition-all hover:text-slate-900" aria-label="Tháng sau"><ChevronRight size={16} /></button>
                 </div>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-[auto_repeat(6,minmax(0,1fr))] gap-1 sm:gap-1.5">
                 {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map(d => (
                   <div key={d} className="py-1 text-center text-xs font-normal text-zinc-600">{d}</div>
                 ))}
                 {finalDays.map((cell, i) => {
                   const isSelected = isSameCalendarDay(selectedDate, cell.date);
                   const isToday = isSameCalendarDay(new Date(), cell.date);
                   const hasMeetings = sourceMeetings.some((m) => bookingOnDate(m.date, cell.date) || bookingOnDate(m.scheduledDate, cell.date));
                   return (
                     <div 
                        key={i} 
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedDate(cell.date)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedDate(cell.date);
                          }
                        }}
                        className={`calendar-cell ${isSelected ? "active" : ""} ${isToday ? "today" : ""} ${cell.currentMonth ? "text-slate-900" : "text-zinc-500 opacity-40"} ${hasMeetings ? "dot" : ""}`}
                     >
                        <span className="text-[11px] font-semibold sm:text-xs">{cell.date.getDate()}</span>
                     </div>
                   );
                 })}
              </div>
              <div className="mt-3 flex shrink-0 items-center gap-5 border-t border-slate-200 pt-3">
                 <div className="flex items-center gap-1.5 text-xs font-normal text-zinc-500">
                    <div className="h-2.5 w-2.5 rounded-sm bg-white ring-2 ring-[#93f72b]" /> Hôm nay
                 </div>
                 <div className="flex items-center gap-1.5 text-xs font-normal text-zinc-500">
                    <div className="h-2.5 w-2.5 rounded-full bg-[#8037f4]" /> Có lịch hẹn
                 </div>
              </div>
           </div>

           {/* Daily schedule */}
           <div className="flex min-h-0 flex-col lg:col-span-5">
              <div className="schedule-panel glass-card flex h-full min-h-0 flex-col p-4 sm:p-5">
                 <div className="mb-3 flex shrink-0 items-center justify-between">
                    <h4 className="text-base font-bold text-slate-900 sm:text-lg">
                      {formatSelectedDayLabel(selectedDate)}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAvailability(true)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-violet-700 transition-all hover:bg-slate-100"
                    >
                      <Plus size={16} />
                    </button>
                 </div>

                 <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-0.5 custom-scrollbar">
                    {selectedDayMeetings.map((meeting, i) => (
                      <div
                         key={meeting.id || i}
                         onClick={() => meeting.id && navigate(`/mentor/meeting-detail/${meeting.id}`)}
                         className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-all hover:bg-slate-100"
                      >
                         <div className="absolute left-0 top-0 h-full w-1 scale-y-0 bg-primary-fixed transition-transform origin-top group-hover:scale-y-100" />
                         <div className="mb-2.5 flex items-center gap-3">
                            <img src={meeting.mentee.avatar} alt="" className="h-9 w-9 rounded-xl object-cover ring-2 ring-white/5" />
                            <div className="min-w-0">
                               <p className="truncate text-sm font-black text-slate-900">{meeting.mentee.name}</p>
                               <p className="truncate text-xs font-normal text-zinc-600">{meeting.position}</p>
                            </div>
                         </div>
                         <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-sm font-semibold text-violet-700">
                               <Clock3 size={13} /> {meeting.scheduledTime}
                            </div>
                            <span
                              className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold ${
                                String(meeting.status || "").toLowerCase() === "confirmed"
                                  ? "border-[#93f72b] bg-[#93f72b]/15 text-[#5a9a12]"
                                  : String(meeting.status || "").toLowerCase() === "pending"
                                    ? "border-[#8037f4]/35 bg-[#8037f4]/10 text-[#8037f4]"
                                    : String(meeting.status || "").toLowerCase() === "completed"
                                      ? "border-[#93f72b] bg-[#93f72b]/12 text-[#93f72b]"
                                      : String(meeting.status || "").toLowerCase() === "cancelled"
                                        ? "border-red-300 bg-red-100 text-red-900"
                                        : "border-slate-200 bg-slate-100 text-slate-700"
                              }`}
                            >
                              {meeting.statusLabel}
                            </span>
                         </div>
                      </div>
                    ))}
                    {selectedDayMeetings.length === 0 && (
                      <div className="flex min-h-[72px] flex-col items-center justify-center rounded-2xl border border-slate-200 p-4 text-zinc-500">
                        <p className="text-sm text-zinc-500">Không có lịch hẹn trong ngày này</p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowAvailability(true)}
                      className="flex min-h-[72px] w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 text-zinc-700 transition-all hover:border-violet-200 hover:text-violet-700"
                    >
                       <PlusCircle size={24} className="mb-1 opacity-25" />
                       <p className="text-sm font-normal text-zinc-600">Thêm khung giờ trống mới</p>
                    </button>
                 </div>
              </div>
           </div>
        </div>
      </div>

      <AnimatePresence>
        {showAvailability && (
          <AvailabilityModal
            availability={availability}
            onSaved={setAvailability}
            onClose={() => setShowAvailability(false)}
          />
        )}
      </AnimatePresence>
    </MentorPageShell>
  );
}
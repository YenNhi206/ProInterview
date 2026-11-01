import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar as CalendarIcon,
  Calendar as CalendarBlank,
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
  /* Linear / Vercel style schedule */
  .schedule-container {
    color: #ededed;
  }
  .linear-card {
    background: #0d0f15;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  }
  .linear-btn-primary {
    background: #ffffff;
    color: #090a0f;
    font-weight: 600;
    transition: all 0.15s ease;
  }
  .linear-btn-primary:hover {
    background: #e2e8f0;
  }
  .linear-btn-secondary {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #d1d5db;
    transition: all 0.15s ease;
  }
  .linear-btn-secondary:hover {
    background: rgba(255, 255, 255, 0.09);
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.18);
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 backdrop-blur-md bg-black/70"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.98, opacity: 0, y: 14 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.98, opacity: 0, y: 14 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] rounded-2xl border border-white/10 bg-[#0d0f15] text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.08] flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Cài đặt lịch rảnh cố định</h2>
            <p className="mt-0.5 text-xs text-slate-400">Khung giờ bạn có thể nhận hẹn định kỳ mỗi tuần</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar">
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/[0.06] p-3 text-xs text-slate-400">
            <Globe size={15} className="text-slate-300" />
            <span>Múi giờ hệ thống: <strong className="text-slate-200">GMT+07:00 (Asia/Ho_Chi_Minh)</strong></span>
          </div>

          <div className="space-y-2.5">
            {workingHours.map((row, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.015]"
              >
                <div className="w-20 shrink-0">
                  <span className="text-xs font-semibold text-slate-200">{row.day}</span>
                </div>
                <div className="flex-1 flex flex-wrap gap-1.5">
                  {row.slots.map((s, i) => (
                    <div
                      key={i}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300"
                    >
                      <span>{s}</span>
                      <button
                        onClick={() => removeSlot(row.dayOfWeek, s)}
                        className="text-slate-400 hover:text-rose-400 p-0.5"
                        title="Xóa"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {row.slots.length === 0 && (
                    <span className="text-xs text-slate-500 italic">Chưa có giờ</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add slot section */}
          <div className="pt-2">
            <p className="text-xs font-medium text-slate-400 mb-2">Thêm khung giờ mới</p>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-5">
                <AppSelect
                  size="default"
                  value={newSlotDay}
                  onValueChange={(v) => setNewSlotDay(Number(v))}
                  options={DAY_ROWS.map((d) => ({ value: d.key, label: d.label }))}
                />
              </div>
              <div className="sm:col-span-4">
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
              <div className="sm:col-span-3">
                <button
                  onClick={() => addSlot(newSlotDay, String(newSlotRange).split("-")[0].trim())}
                  className="w-full h-full min-h-[38px] linear-btn-secondary rounded-xl text-xs font-medium flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} /> Thêm
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.08] bg-white/[0.01] flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500">Áp dụng từ tuần tiếp theo</p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="linear-btn-secondary px-4 py-2 rounded-xl text-xs font-medium"
            >
              Hủy
            </button>
            <button
              disabled={saving}
              onClick={handleSave}
              className="linear-btn-primary px-5 py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
            >
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
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
  const sourceMeetings = mentorMeetings;
  const selectedDayMeetings = sourceMeetings.filter((m) => bookingOnDate(m.date, selectedDate) || bookingOnDate(m.scheduledDate, selectedDate));

  return (
    <MentorPageShell
      bottomPad="pb-8"
      fillHeight={false}
      className="schedule-container bg-transparent"
      extraStyles={MENTOR_SCHEDULE_EXTRA_CSS}
    >
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6">
        {/* Clean Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/[0.08] pb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Lịch làm việc
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              Quản lý ca tư vấn trực tiếp và cấu hình khung giờ rảnh hàng tuần.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowAvailability(true)}
              className="linear-btn-secondary flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold"
            >
              <Clock size={14} />
              <span>Cài đặt giờ rảnh</span>
            </button>
          </div>
        </div>

        {/* 2-Column Clean Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Calendar (Col 7) */}
          <div className="linear-card p-6 lg:col-span-7">
            {/* Calendar Controls */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-semibold text-white">
                  {formatMonthYear(currentDate)}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {mentorMeetings.length} lịch hẹn trong tháng
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goToToday}
                  className="linear-btn-secondary px-3 py-1.5 rounded-lg text-xs font-medium"
                >
                  Hôm nay
                </button>
                <div className="flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5">
                  <button
                    type="button"
                    onClick={() => setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                    className="p-1.5 text-slate-400 hover:text-white rounded transition"
                    aria-label="Tháng trước"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                    className="p-1.5 text-slate-400 hover:text-white rounded transition"
                    aria-label="Tháng sau"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </div>

            {/* Days of Week */}
            <div className="grid grid-cols-7 mb-2 text-center text-xs font-medium text-slate-400">
              {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
                <div key={day} className="py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Dates Grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {finalDays.map((cell, idx) => {
                const isSelected = isSameCalendarDay(selectedDate, cell.date);
                const isToday = isSameCalendarDay(new Date(), cell.date);
                const hasMeetings = sourceMeetings.some(
                  (m) => bookingOnDate(m.date, cell.date) || bookingOnDate(m.scheduledDate, cell.date)
                );

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedDate(cell.date)}
                    className={`relative flex flex-col items-center justify-center h-11 sm:h-12 rounded-xl text-xs transition-all ${
                      isSelected
                        ? "bg-white text-slate-950 font-bold shadow-md"
                        : isToday
                          ? "border border-white/30 text-white font-semibold bg-white/5"
                          : cell.currentMonth
                            ? "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                            : "text-slate-600 opacity-40 hover:opacity-80"
                    }`}
                  >
                    <span>{cell.date.getDate()}</span>
                    {hasMeetings && (
                      <span
                        className={`mt-1 h-1 w-1 rounded-full ${
                          isSelected ? "bg-slate-950" : "bg-indigo-400"
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-5 pt-4 border-t border-white/[0.08] flex items-center gap-5 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded border border-white/40" />
                <span>Hôm nay</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded bg-white" />
                <span>Đang xem</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                <span>Có cuộc hẹn</span>
              </div>
            </div>
          </div>

          {/* Right Column: Daily Agenda (Col 5) */}
          <div className="linear-card p-6 lg:col-span-5">
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/[0.08]">
              <div>
                <h3 className="text-base font-semibold text-white">
                  {formatSelectedDayLabel(selectedDate)}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedDayMeetings.length} lịch hẹn được xếp
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAvailability(true)}
                className="linear-btn-secondary p-2 rounded-lg text-slate-300 hover:text-white"
                title="Thêm khung giờ rảnh"
              >
                <Plus size={15} />
              </button>
            </div>

            {/* List */}
            <div className="space-y-3">
              {selectedDayMeetings.map((meeting, i) => (
                <div
                  key={meeting.id || i}
                  onClick={() => meeting.id && navigate(`/mentor/meeting-detail/${meeting.id}`)}
                  className="group cursor-pointer rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 transition-all hover:bg-white/[0.05] hover:border-white/20"
                >
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={meeting.mentee.avatar}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover border border-white/10"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">
                          {meeting.mentee.name}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {meeting.position || "Học viên"}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                        String(meeting.status || "").toLowerCase() === "confirmed"
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                          : String(meeting.status || "").toLowerCase() === "pending"
                            ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                            : String(meeting.status || "").toLowerCase() === "completed"
                              ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                              : "bg-white/5 border-white/10 text-slate-400"
                      }`}
                    >
                      {meeting.statusLabel}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.04] text-xs text-slate-400">
                    <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                      <Clock3 size={13} className="text-slate-400" />
                      <span>{meeting.scheduledTime}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 group-hover:text-slate-200 transition">
                      Chi tiết →
                    </span>
                  </div>
                </div>
              ))}

              {selectedDayMeetings.length === 0 && (
                <div className="py-12 px-4 rounded-xl border border-dashed border-white/[0.08] text-center">
                  <p className="text-xs font-medium text-slate-300">Không có lịch hẹn</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                    Chưa có học viên nào đặt lịch trong ngày này.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowAvailability(true)}
                className="w-full py-3 rounded-xl border border-dashed border-white/15 bg-white/[0.01] hover:bg-white/[0.04] text-xs font-medium text-slate-400 hover:text-white transition flex items-center justify-center gap-1.5 mt-2"
              >
                <Plus size={14} /> Thêm ca làm việc
              </button>
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
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Video,
  Users,
  X,
  Trash2,
  Save,
  Clock3,
  Globe,
  Sparkles,
  CalendarDays,
  ArrowRight,
  Send,
  Zap,
} from "lucide-react";
import { getUser } from "../../utils/auth/auth.js";
import { MentorPageShell } from "../../components/mentor/MentorPageShell.jsx";
import { MentorStatMiniGrid, MentorStatFrame } from "../../components/mentor/MentorStatFrames.jsx";
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
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    );
  };

  const removeSlot = (dayOfWeek, slot) => {
    setWorkingHours((prev) =>
      prev
        .map((row) =>
          row.dayOfWeek === dayOfWeek ? { ...row, slots: row.slots.filter((s) => s !== slot) } : row
        )
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
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
      toastApiSuccess("Đã lưu lịch rảnh thành công.");
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
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 backdrop-blur-md bg-black/75"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 16 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="relative w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] rounded-2xl border border-white/10 bg-[#140c24] text-white shadow-[0_25px_60px_rgba(0,0,0,0.7)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Hairline Glow */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#93f72b]/50 to-transparent" />

        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.08] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#93f72b] shadow-[0_0_8px_rgba(147,247,43,0.8)]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#93f72b]">
                CẤU HÌNH KHUNG GIỜ CỐ ĐỊNH
              </span>
            </div>
            <h2 className="mt-1 text-lg font-bold text-white">Cài đặt lịch rảnh hàng tuần</h2>
            <p className="text-xs text-slate-400">Khung giờ mở để mentee có thể chủ động đặt lịch 1:1</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar">
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.08] p-3 text-xs text-slate-300">
            <Globe size={15} className="text-[#93f72b]" />
            <span>
              Múi giờ hệ thống: <strong className="text-white">GMT+07:00 (Asia/Ho_Chi_Minh)</strong>
            </span>
          </div>

          <div className="space-y-2.5">
            {workingHours.map((row, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-white/[0.08] bg-[#18102a]/80"
              >
                <div className="w-20 shrink-0">
                  <span className="text-xs font-bold text-white">{row.day}</span>
                </div>
                <div className="flex-1 flex flex-wrap gap-1.5">
                  {row.slots.map((s, i) => (
                    <div
                      key={i}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#93f72b]/30 bg-[#93f72b]/10 px-2.5 py-1 text-xs font-semibold text-[#b8ff78]"
                    >
                      <span>{s}</span>
                      <button
                        type="button"
                        onClick={() => removeSlot(row.dayOfWeek, s)}
                        className="text-[#93f72b]/60 hover:text-rose-400 p-0.5 transition"
                        title="Xóa ca này"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {row.slots.length === 0 && (
                    <span className="text-xs text-slate-500 italic">Chưa mở khung giờ</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add slot section */}
          <div className="pt-2">
            <p className="text-xs font-bold text-slate-300 mb-2">Thêm khung giờ mới</p>
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
                  type="button"
                  onClick={() => addSlot(newSlotDay, String(newSlotRange).split("-")[0].trim())}
                  className="w-full h-full min-h-[38px] rounded-xl border border-white/10 bg-white/5 hover:bg-[#93f72b]/15 hover:border-[#93f72b]/40 hover:text-[#93f72b] text-xs font-bold flex items-center justify-center gap-1.5 transition text-white"
                >
                  <Plus size={14} /> Thêm ca
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.08] bg-[#10081d] flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400">Lịch cập nhật sẽ tự động áp dụng ngay</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-[#93f72b] text-slate-950 shadow-[0_0_20px_rgba(147,247,43,0.35)] transition hover:bg-[#a8ff4e] disabled:opacity-50"
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

  // Selected Day Meetings
  const selectedDayMeetings = useMemo(() => {
    return sourceMeetings.filter(
      (m) => bookingOnDate(m.date, selectedDate) || bookingOnDate(m.scheduledDate, selectedDate)
    );
  }, [sourceMeetings, selectedDate]);

  // Today Meetings
  const todayMeetings = useMemo(() => {
    const today = new Date();
    return sourceMeetings.filter(
      (m) => bookingOnDate(m.date, today) || bookingOnDate(m.scheduledDate, today)
    );
  }, [sourceMeetings]);

  // Total weekly configured availability slots
  const totalWeeklySlots = useMemo(() => {
    if (!availability?.recurringSchedule || !Array.isArray(availability.recurringSchedule)) return 0;
    return availability.recurringSchedule.reduce((sum, item) => sum + (item.slots?.length || 0), 0);
  }, [availability]);

  // Month meetings count
  const monthMeetingsCount = useMemo(() => {
    const curMonth = currentDate.getMonth() + 1;
    const curYear = currentDate.getFullYear();
    return sourceMeetings.filter((m) => {
      const raw = String(m.date || m.scheduledDate || "").trim();
      if (!raw) return false;
      const parts = raw.split("/");
      if (parts.length < 2) return false;
      const mNum = Number(parts[1]);
      const yNum = parts.length >= 3 ? Number(parts[2]) : curYear;
      return mNum === curMonth && yNum === curYear;
    }).length;
  }, [sourceMeetings, currentDate]);

  // Pending bookings count
  const pendingCount = useMemo(() => {
    return sourceMeetings.filter((m) => String(m.status || "").toLowerCase() === "pending").length;
  }, [sourceMeetings]);

  if (!user || user.role !== "mentor") return null;

  return (
    <MentorPageShell mentorRole bottomPad="pb-16" fillHeight={false} className="bg-transparent">
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#93f72b] shadow-[0_0_8px_rgba(147,247,43,0.8)]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#93f72b]">
                ĐIỀU PHỐI LỊCH & THỜI GIAN BIỂU
              </span>
            </div>
            <h1 className="font-headline mt-1.5 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Lịch <span className="text-[#93f72b]">làm việc & tư vấn</span>
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Quản lý ca tư vấn trực tiếp 1:1, kiểm soát thời gian rảnh và chuẩn bị trước buổi hẹn cùng mentee.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={goToToday}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#160f26]/80 px-3.5 py-2 text-xs font-semibold text-slate-300 backdrop-blur-xl transition hover:border-[#93f72b]/50 hover:bg-[#1a1230] hover:text-[#93f72b]"
            >
              <CalendarDays size={13} />
              Về hôm nay
            </button>
            <button
              type="button"
              onClick={() => setShowAvailability(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#93f72b] px-4 py-2 text-xs font-bold text-slate-950 shadow-[0_0_20px_rgba(147,247,43,0.35)] transition hover:bg-[#a8ff4e]"
            >
              <Clock size={14} />
              Cài đặt giờ rảnh
            </button>
          </div>
        </header>

        {/* Compact Bento KPI Summary Frames */}
        <MentorStatMiniGrid className="mb-5">
          <MentorStatFrame
            index={1}
            value={monthMeetingsCount}
            title="Lịch tháng này"
            subtitle="Buổi 1:1 đã xếp"
            cornerIcon={CalendarIcon}
            accent="lime"
            compact
          />
          <MentorStatFrame
            index={2}
            value={todayMeetings.length}
            title="Lịch hôm nay"
            subtitle="Ca cần thực hiện"
            cornerIcon={Clock}
            accent="purple"
            compact
          />
          <MentorStatFrame
            index={3}
            value={totalWeeklySlots}
            title="Giờ rảnh / tuần"
            subtitle="Số ca rảnh đã mở"
            cornerIcon={Clock3}
            accent="purple"
            compact
          />
          <MentorStatFrame
            index={4}
            value={pendingCount}
            title="Chờ xác nhận"
            subtitle="Yêu cầu đặt lịch mới"
            cornerIcon={CheckCircle2}
            accent="purple"
            compact
          />
        </MentorStatMiniGrid>

        {/* 2-Column Schedule Studio */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Calendar (Col 7) */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#181128]/95 to-[#120a20]/95 p-6 sm:p-7 shadow-[0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:col-span-7">
            {/* Top Hairline Glow */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            {/* Calendar Controls */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-black text-white">
                  {formatMonthYear(currentDate)}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {monthMeetingsCount} lịch hẹn trong tháng
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goToToday}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-[#93f72b]/40 hover:text-[#93f72b] transition"
                >
                  Hôm nay
                </button>
                <div className="flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                    }
                    className="p-1.5 text-slate-400 hover:text-white rounded transition"
                    aria-label="Tháng trước"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                    }
                    className="p-1.5 text-slate-400 hover:text-white rounded transition"
                    aria-label="Tháng sau"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Days of Week */}
            <div className="grid grid-cols-7 mb-2.5 text-center text-xs font-bold uppercase tracking-wider text-slate-400">
              {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
                <div key={day} className="py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Dates Grid */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {finalDays.map((cell, idx) => {
                const isSelected = isSameCalendarDay(selectedDate, cell.date);
                const isToday = isSameCalendarDay(new Date(), cell.date);
                const hasMeetings = sourceMeetings.some(
                  (m) =>
                    bookingOnDate(m.date, cell.date) || bookingOnDate(m.scheduledDate, cell.date)
                );

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedDate(cell.date)}
                    className={`relative flex flex-col items-center justify-center h-12 sm:h-13 rounded-xl text-xs transition-all duration-200 ${
                      isSelected
                        ? "bg-[#93f72b] text-slate-950 font-black shadow-[0_0_18px_rgba(147,247,43,0.4)] scale-105 z-10"
                        : isToday
                        ? "border border-[#93f72b]/60 text-[#93f72b] font-bold bg-[#93f72b]/10"
                        : cell.currentMonth
                        ? "text-slate-300 hover:bg-white/[0.08] hover:text-white"
                        : "text-slate-600 opacity-30 hover:opacity-70"
                    }`}
                  >
                    <span className="text-sm">{cell.date.getDate()}</span>
                    {hasMeetings && (
                      <span
                        className={`mt-1 h-1.5 w-1.5 rounded-full ${
                          isSelected
                            ? "bg-slate-950"
                            : "bg-[#93f72b] shadow-[0_0_6px_rgba(147,247,43,0.8)]"
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-6 pt-5 border-t border-white/[0.08] flex flex-wrap items-center gap-6 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md border border-[#93f72b]/60 bg-[#93f72b]/15" />
                <span>Hôm nay</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-[#93f72b]" />
                <span className="text-white font-medium">Đang chọn</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#93f72b] shadow-[0_0_6px_rgba(147,247,43,0.8)]" />
                <span>Có ca tư vấn</span>
              </div>
            </div>
          </div>

          {/* Right Column: Daily Agenda (Col 5) */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#181128]/95 to-[#120a20]/95 p-6 sm:p-7 shadow-[0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:col-span-5">
            {/* Top Hairline Glow */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/[0.08]">
              <div>
                <h3 className="text-lg font-black text-white">
                  {formatSelectedDayLabel(selectedDate)}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedDayMeetings.length} lịch hẹn được xếp trong ngày
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAvailability(true)}
                className="inline-flex items-center justify-center h-8 w-8 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:border-[#93f72b]/40 hover:bg-[#93f72b]/10 hover:text-[#93f72b] transition"
                title="Cài đặt khung giờ rảnh"
              >
                <Plus size={16} />
              </button>
            </div>

            {/* List */}
            <div className="space-y-3.5">
              {selectedDayMeetings.map((meeting, i) => (
                <div
                  key={meeting.id || i}
                  onClick={() => meeting.id && navigate(`/mentor/meeting-detail/${meeting.id}`)}
                  className="group cursor-pointer rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 transition-all duration-200 hover:bg-[#1c1232] hover:border-[#93f72b]/40 hover:shadow-[0_0_20px_rgba(147,247,43,0.1)]"
                >
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={meeting.mentee.avatar}
                        alt=""
                        className="w-9 h-9 rounded-full object-cover border border-[#93f72b]/30 shadow-sm"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white group-hover:text-[#93f72b] transition truncate">
                          {meeting.mentee.name}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {meeting.position || "Học viên"}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                        String(meeting.status || "").toLowerCase() === "confirmed"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                          : String(meeting.status || "").toLowerCase() === "pending"
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                          : String(meeting.status || "").toLowerCase() === "completed"
                          ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
                          : "bg-white/5 border-white/10 text-slate-400"
                      }`}
                    >
                      {meeting.statusLabel}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] text-xs">
                    <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
                      <Clock3 size={13} className="text-[#93f72b]" />
                      <span>{meeting.scheduledTime}</span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#93f72b] opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition">
                      Chi tiết <ArrowRight size={12} />
                    </span>
                  </div>
                </div>
              ))}

              {selectedDayMeetings.length === 0 && (
                <div className="relative overflow-hidden py-12 px-6 rounded-2xl border border-dashed border-white/15 bg-white/[0.015] text-center">
                  <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(147,247,43,0.06)_0%,transparent_70%)]" />

                  <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-[#93f72b]/25 bg-[#93f72b]/10 text-[#93f72b]">
                    <Clock size={22} />
                  </div>
                  <p className="text-sm font-bold text-white">Không có lịch hẹn ngày này</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                    Chưa có học viên nào đặt lịch trong ngày này. Bạn có thể mở thêm ca rảnh để đón học viên mới.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowAvailability(true)}
                className="w-full py-3 rounded-xl border border-dashed border-white/20 bg-white/[0.02] hover:bg-[#93f72b]/10 hover:border-[#93f72b]/40 text-xs font-bold text-slate-300 hover:text-[#93f72b] transition flex items-center justify-center gap-2 mt-3"
              >
                <Plus size={15} /> Thêm ca làm việc / Mở lịch rảnh
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

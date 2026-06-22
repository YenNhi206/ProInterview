import React, { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  Calendar as CalendarBlank,
  Clock,
  Upload as UploadSimple,
  FileText,
  Check,
  ChevronRight as CaretRight,
  Video as VideoCamera,
  Bell,
  ShieldCheck,
  Info,
  Timer,
  Sun,
  Coffee,
  Moon,
  RotateCcw as ArrowsClockwise,
  Sparkles as Sparkle,
  X,
  Briefcase,
  Target,
} from "lucide-react";
import { fetchMentor, fetchMentorAvailability } from "../../api/mentorApi.js";
import { isBookingSlotInFuture } from "../../utils/booking/bookingSchedule.js";
import { fetchBookedSlots, fetchRebookCredit } from "../../api/bookingsApi.js";
import { toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";
import { uploadFile } from "../../api/uploadApi.js";
import { getSuggestedBookingDataAsync, saveUploadedCV, saveUploadedJD } from "../../utils/shared/history.js";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { BookingStepBar } from "../../components/booking/BookingStepBar";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";
import { BookingPolicySummary } from "../../components/booking/BookingPolicySummary";
import { BRAND_CTA_LIME_STYLE } from "../../constants/brandColors";
import { avatarSrc } from "../../utils/shared/mediaUrl.js";
import {
  resolveMentorSessionTypeOptions,
  resolveSessionTypePrice,
  sessionTypeLabel,
} from "../../utils/booking/sessionTypeLabels.js";
import { formatVnd } from "../../utils/shared/formatVnd.js";

const SESSION_TYPE_ICONS = {
  mock_interview: VideoCamera,
  cv_review: FileText,
  career_consulting: Briefcase,
  custom: Target,
};

const VI_DAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const VI_DAY_FULL = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toDateOnly(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatDDMM(d) {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

function formatDDMMYYYY(d) {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function startOfIsoWeek(d) {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function buildWeek(start, title, now) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const dateObj = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const dateOnly = toDateOnly(dateObj);
    const nowOnly = toDateOnly(now);
    const isPast = dateOnly < nowOnly;
    const dateDDMM = formatDDMM(dateObj);
    const dateKey = formatDDMMYYYY(dateObj);
    return {
      day: VI_DAY_SHORT[dateObj.getDay()],
      dateObj,
      date: dateDDMM,
      dateKey,
      full: `${VI_DAY_FULL[dateObj.getDay()]}, ${dateKey}`,
      available: !isPast,
      isPast,
    };
  });
  const from = formatDDMM(days[0].dateObj);
  const to = formatDDMM(days[6].dateObj);
  return { label: `${title} · ${from} – ${to}`, days };
}

const TIME_GROUPS = [
  { label: "Buổi sáng", icon: Sun, slots: ["08:00", "09:00", "10:00", "11:00"] },
  { label: "Buổi chiều", icon: Coffee, slots: ["14:00", "15:00", "16:00", "17:00"] },
  { label: "Buổi tối", icon: Moon, slots: ["19:00", "20:00", "21:00"] },
];



export function Booking() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const rebookFrom =
    searchParams.get("rebookFrom") ||
    (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("prointerview_rebook_from") : "") ||
    "";
  const [rebookCredit, setRebookCredit] = useState(null);
  const [mentor, setMentor] = useState(null);
  const [mentorLoading, setMentorLoading] = useState(true);
  const [bookedSlots, setBookedSlots] = useState({});
  const [mentorAvailability, setMentorAvailability] = useState(null);

  useEffect(() => {
    if (!id) {
      setMentor(null);
      setMentorLoading(false);
      return;
    }
    setMentorLoading(true);

    (async () => {
      try {
        const [m, slotsRes, availability] = await Promise.all([
          fetchMentor(id),
          fetchBookedSlots(id),
          fetchMentorAvailability(id),
        ]);
        if (!m) {
          toastApiError("Không tải được thông tin mentor. Thử lại sau.");
        }
        setMentor(m);
        setMentorAvailability(availability);
        if (slotsRes.success) {
          setBookedSlots(slotsRes.booked);
        } else if (slotsRes.error) {
          toastApiError(slotsRes.error, "Không tải được lịch đã đặt của mentor.");
        }
      } catch {
        toastApiError("Lỗi kết nối khi tải trang đặt lịch.");
        setMentor(null);
      } finally {
        setMentorLoading(false);
      }
    })();
  }, [id]);

  const [step, setStep] = useState(1);
  const [selectedDay, setSelectedDay]     = useState(null);
  const [selectedDayFull, setSelectedDayFull] = useState(null);
  const [selectedTime, setSelectedTime]   = useState(null);
  const [form, setForm] = useState({ position: "", note: "", jd: false, cv: false });
  const [sessionType, setSessionType] = useState("mock_interview");

  const sessionTypeOptions = useMemo(
    () => (mentor ? resolveMentorSessionTypeOptions(mentor) : []),
    [mentor],
  );

  const sessionPrice = useMemo(() => {
    if (!mentor) return 0;
    return resolveSessionTypePrice(mentor, sessionType);
  }, [mentor, sessionType]);

  useEffect(() => {
    if (!sessionTypeOptions.length) return;
    if (!sessionTypeOptions.some((o) => o.value === sessionType)) {
      setSessionType(sessionTypeOptions[0].value);
    }
  }, [sessionTypeOptions, sessionType]);

  const [suggestedData, setSuggestedData] = useState(null);
  const [showSmartBanner, setShowSmartBanner] = useState(false);
  const [selectedCvFile, setSelectedCvFile] = useState("");
  const [selectedCvUrl, setSelectedCvUrl] = useState("");
  const [cvUploading, setCvUploading] = useState(false);
  const [selectedJdFile, setSelectedJdFile] = useState("");
  const [selectedJdUrl, setSelectedJdUrl] = useState("");
  const [jdUploading, setJdUploading] = useState(false);
  const cvInputRef = useRef(null);
  const jdInputRef = useRef(null);
  const calendarWeeks = useMemo(() => {
    const now = new Date();
    const thisWeekStart = startOfIsoWeek(now);
    const nextWeekStart = new Date(thisWeekStart.getFullYear(), thisWeekStart.getMonth(), thisWeekStart.getDate() + 7);
    return [buildWeek(thisWeekStart, "Tuần này", now), buildWeek(nextWeekStart, "Tuần sau", now)];
  }, []);

  useEffect(() => {
    void getSuggestedBookingDataAsync().then((suggested) => {
      setSuggestedData(suggested);
      if (suggested?.position) setShowSmartBanner(true);
    });
  }, []);

  useEffect(() => {
    if (!rebookFrom) {
      setRebookCredit(null);
      return;
    }
    (async () => {
      try {
        const r = await fetchRebookCredit(rebookFrom);
        if (r.success && r.credit?.available) setRebookCredit(r.credit);
        else setRebookCredit(null);
      } catch {
        setRebookCredit(null);
      }
    })();
  }, [rebookFrom]);

  const handleUseSmartFill = () => {
    if (!suggestedData) return;
    setForm({ ...form, position: suggestedData.position || "", cv: !!suggestedData.cvFile, jd: !!suggestedData.jdFile });
    if (suggestedData.cvFile) setSelectedCvFile(suggestedData.cvFile);
    if (suggestedData.jdFile) setSelectedJdFile(suggestedData.jdFile);
    setShowSmartBanner(false);
  };

  const handleCvFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCvUploading(true);
    setSelectedCvFile(file.name);
    setSelectedCvUrl("");
    const res = await uploadFile(file, "cv");
    setCvUploading(false);
    e.target.value = "";
    if (!res.success || !res.url) {
      setSelectedCvFile("");
      toastApiError(res.error, "Không tải CV lên được.");
      return;
    }
    setSelectedCvFile(res.fileName || file.name);
    setSelectedCvUrl(res.url);
    setForm((prev) => ({ ...prev, cv: true }));
    saveUploadedCV({ name: file.name, size: file.size, type: file.type });
    toastApiSuccess("Đã tải CV lên, mentor có thể mở khi xem buổi hẹn.");
  };

  const handleJdFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setJdUploading(true);
    setSelectedJdFile(file.name);
    setSelectedJdUrl("");
    const res = await uploadFile(file, "jd");
    setJdUploading(false);
    e.target.value = "";
    if (!res.success || !res.url) {
      setSelectedJdFile("");
      toastApiError(res.error, "Không tải JD lên được.");
      return;
    }
    setSelectedJdFile(res.fileName || file.name);
    setSelectedJdUrl(res.url);
    setForm((prev) => ({ ...prev, jd: true }));
    saveUploadedJD({ name: file.name, size: file.size, type: file.type });
    toastApiSuccess("Đã tải JD lên.");
  };

  const handleProceed = () => {
    if (!selectedCvFile || !selectedCvUrl) {
      toastApiError("Vui lòng tải CV lên server (chọn file và đợi tải xong).");
      return;
    }
    if (form.jd && selectedJdFile && !selectedJdUrl) {
      toastApiError("JD chưa tải xong, chọn lại file hoặc bỏ JD.");
      return;
    }
    const params = new URLSearchParams({
      type: "booking",
      mentorId: mentor.id,
      price: String(sessionPrice),
      sessionType,
      date: selectedDay ?? "",
      time: selectedTime ?? "",
      position: form.position,
      note: form.note,
      cvFile: selectedCvFile,
      cvFileUrl: selectedCvUrl,
      jdFile: form.jd && selectedJdFile ? selectedJdFile : "",
      jdFileUrl: form.jd && selectedJdUrl ? selectedJdUrl : "",
    });
    if (rebookFrom) params.set("rebookFrom", rebookFrom);
    navigate(`/checkout?${params.toString()}`);
  };

  const getBookedOfDay = (dayKey) => {
    if (!dayKey) return [];
    const noYear = dayKey.split("/").slice(0, 2).join("/");
    return bookedSlots[dayKey] ?? bookedSlots[noYear] ?? [];
  };

  const normalizeDateKey = (raw, fallbackYear) => {
    const s = String(raw || "").trim();
    if (!s) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const parts = s.split("/").map((p) => Number(p));
    if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      const year = parts.length >= 3 && Number.isFinite(parts[2]) ? parts[2] : fallbackYear;
      return `${String(year).padStart(4, "0")}-${String(parts[1]).padStart(2, "0")}-${String(parts[0]).padStart(2, "0")}`;
    }
    return "";
  };

  const getMentorSlotsForDay = (day) => {
    if (!day) return TIME_GROUPS.flatMap((g) => g.slots);
    const av = mentorAvailability;
    const hasConfig = Boolean(
      av &&
        ((av.availableSlots && Object.keys(av.availableSlots).length) ||
          (Array.isArray(av.recurringSchedule) && av.recurringSchedule.length) ||
          (Array.isArray(av.blockedDates) && av.blockedDates.length)),
    );
    if (!hasConfig) return TIME_GROUPS.flatMap((g) => g.slots);

    const year = day.dateObj.getFullYear();
    const iso = `${year}-${pad2(day.dateObj.getMonth() + 1)}-${pad2(day.dateObj.getDate())}`;
    const blockedSet = new Set((av.blockedDates || []).map((d) => normalizeDateKey(d, year)).filter(Boolean));
    if (blockedSet.has(iso)) return [];

    const entries = Object.entries(av.availableSlots || {});
    const explicit = entries.find(([k]) => normalizeDateKey(k, year) === iso);
    if (explicit) {
      const slots = Array.isArray(explicit[1]) ? explicit[1].map((x) => String(x).trim()).filter(Boolean) : [];
      return slots;
    }

    const recurring = Array.isArray(av.recurringSchedule) ? av.recurringSchedule : [];
    const slotMapKeys = Object.keys(av.availableSlots || {}).length;
    // Chỉ chặn ngày (blockedDates), không có lịch cụ thể → mở khung giờ mặc định (khớp backend).
    if (!recurring.length && slotMapKeys === 0) {
      return TIME_GROUPS.flatMap((g) => g.slots);
    }
    if (!recurring.length) return [];
    const mentorDay = (day.dateObj.getDay() + 6) % 7; // Mon=0
    const row = recurring.find((r) => Number(r?.dayOfWeek) === mentorDay);
    return row && Array.isArray(row.slots) ? row.slots.map((x) => String(x).trim()).filter(Boolean) : [];
  };

  const isSlotBooked = (time) => (selectedDay ? getBookedOfDay(selectedDay).includes(time) : false);
  const isSlotPast = (time) => (selectedDay ? !isBookingSlotInFuture(selectedDay, time) : false);

  const availableSlotCount = selectedDay
    ? (() => {
        const selectedObj = calendarWeeks.flatMap((w) => w.days).find((d) => d.dateKey === selectedDay);
        const allowed = getMentorSlotsForDay(selectedObj);
        return allowed.filter((t) => !isSlotBooked(t) && !isSlotPast(t)).length;
      })()
    : 0;

  const endTime = selectedTime
    ? String(parseInt(selectedTime.split(":")[0]) + 1).padStart(2, "0") + ":00"
    : "";

  const fieldClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-[#8037f4]/45 focus:outline-none focus:ring-2 focus:ring-[#8037f4]/15";

  if (mentorLoading) {
    return (
      <MentorPageShell bottomPad="pb-32">
        <div className={`relative z-10 flex min-h-[50vh] items-center justify-center pb-8 pt-8 sm:pt-10 ${CUSTOMER_SHELL_GUTTER}`}>
          <div className={`${CUSTOMER_SHELL_MAX} w-full text-center text-sm font-medium text-slate-600`}>
            Đang tải thông tin mentor…
          </div>
        </div>
      </MentorPageShell>
    );
  }

  if (!mentor) {
    return (
      <MentorPageShell bottomPad="pb-32">
        <div className={`relative z-10 flex min-h-[50vh] flex-col items-center justify-center gap-4 pb-8 pt-8 text-center text-slate-600 sm:pt-10 ${CUSTOMER_SHELL_GUTTER}`}>
          <div className={`${CUSTOMER_SHELL_MAX} flex w-full flex-col items-center gap-4`}>
          <p>Không tìm thấy mentor hoặc mentor chưa mở nhận booking.</p>
          <button
            type="button"
            onClick={() => navigate("/mentors")}
            className="rounded-full bg-[#93f72b] px-6 py-2 text-sm font-bold text-slate-900 shadow-sm transition hover:brightness-95"
          >
            Về danh sách mentor
          </button>
          </div>
        </div>
      </MentorPageShell>
    );
  }

  return (
    <MentorPageShell bottomPad="pb-32">
      <div className={`relative z-10 pb-8 pt-8 sm:pt-10 ${CUSTOMER_SHELL_GUTTER}`}>
        <div
          className={`${CUSTOMER_SHELL_MAX} w-full font-sans text-slate-900 antialiased selection:bg-[rgba(122,35,229,0.18)] selection:text-slate-900`}
        >
        <BookingStepBar current={step} />

        {step === 1 ? (
        <div className="mb-6 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <img
            src={avatarSrc(mentor.avatar)}
            alt={mentor.name}
            className="h-12 w-12 flex-shrink-0 rounded-xl object-cover ring-1 ring-slate-200"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = avatarSrc("");
            }}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">{mentor.name}</p>
            <p className="truncate text-xs text-slate-600">
              {mentor.title} · {mentor.company}
            </p>
          </div>
          <div className="ml-auto flex-shrink-0 text-right">
            <p className="text-lg font-black text-[#3d5200]">{formatVnd(mentor.price)}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">/ 60 phút</p>
          </div>
        </div>
        ) : null}

        {step === 1 && (
          <div className="space-y-4">
            <div className="glass-card overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/90 px-5 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100">
                  <CalendarBlank className="h-4 w-4 text-[#8037f4]" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Chọn ngày phỏng vấn</p>
                  <p className="text-xs text-slate-500">Lịch trống của {mentor.name}, theo thời gian hiện tại</p>
                </div>
              </div>
              <div className="space-y-5 p-5">
                {calendarWeeks.map((week) => (
                  <div key={week.label}>
                    <p className="mb-3 text-[10px] font-black uppercase tracking-wide text-slate-500">{week.label}</p>
                    <div className="grid grid-cols-7 gap-2">
                      {week.days.map((d) => {
                        const isSelected = selectedDay === d.dateKey;
                        const mentorSlots = getMentorSlotsForDay(d);
                        const freeSlots = mentorSlots.filter((t) => !getBookedOfDay(d.dateKey).includes(t)).length;
                        const canBookDay = d.available && freeSlots > 0;
                        return (
                          <button
                            key={d.dateKey}
                            type="button"
                            disabled={!canBookDay}
                            onClick={() => {
                              setSelectedDay(d.dateKey);
                              setSelectedDayFull(d.full);
                              setSelectedTime(null);
                            }}
                            className={`flex flex-col items-center rounded-xl py-3 transition-all ${
                              isSelected
                                ? "bg-gradient-to-br from-[#8037f4] to-[#a66ff8] text-white shadow-[0_8px_24px_rgba(128,55,244,0.35)]"
                                : canBookDay
                                  ? "border border-slate-200 bg-white text-slate-900 shadow-sm hover:border-violet-300 hover:shadow-md"
                                  : "cursor-not-allowed border border-slate-100 bg-slate-50 opacity-45"
                            }`}
                          >
                            <span
                              className={`mb-1 text-xs font-semibold ${
                                isSelected ? "text-white/80" : canBookDay ? "text-slate-500" : "text-slate-400"
                              }`}
                            >
                              {d.day}
                            </span>
                            <span className={`text-[0.95rem] font-black ${isSelected ? "text-white" : canBookDay ? "text-slate-900" : "text-slate-400"}`}>
                              {d.date.split("/")[0]}
                            </span>
                            {canBookDay && (
                              <span
                                className={`mt-1 rounded-full px-1.5 text-[0.6rem] font-bold ${
                                  isSelected
                                    ? "bg-white/20 text-white"
                                    : freeSlots <= 3
                                      ? "bg-orange-100 text-orange-800"
                                      : "bg-lime-100 text-[#2f4200]"
                                }`}
                              >
                                {freeSlots} chỗ
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 pt-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-[#8037f4] to-[#a66ff8]" />
                    Đã chọn
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full border border-slate-300 bg-white" />
                    Còn chỗ
                  </span>
                  <span className="flex items-center gap-1.5 text-orange-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
                    Còn ít chỗ
                  </span>
                </div>
              </div>
            </div>

            {selectedDay ? (
              <div className="glass-card overflow-hidden">
                <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/90 px-5 py-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100">
                    <Clock className="h-4 w-4 text-[#8037f4]" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">Chọn khung giờ</p>
                    <p className="truncate text-xs text-slate-500">
                      {selectedDayFull} · {availableSlotCount} khung giờ trống
                    </p>
                  </div>
                  <div className="ml-auto flex flex-shrink-0 items-center gap-1.5 rounded-full border border-lime-300 bg-lime-50 px-3 py-1.5 text-[11px] font-bold text-[#2f4200]">
                    <Timer className="h-3.5 w-3.5" />
                    60 phút / buổi
                  </div>
                </div>
                <div className="space-y-5 p-5">
                  {TIME_GROUPS.map((group) => (
                    <div key={group.label}>
                      <div className="mb-3 flex items-center gap-2">
                        <group.icon className="h-3.5 w-3.5 text-slate-500" />
                        <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{group.label}</p>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {group.slots
                          .filter((time) => {
                            const selectedObj = calendarWeeks.flatMap((w) => w.days).find((d) => d.dateKey === selectedDay);
                            const allowed = getMentorSlotsForDay(selectedObj);
                            return allowed.includes(time);
                          })
                          .map((time) => {
                          const booked = isSlotBooked(time);
                          const inPast = isSlotPast(time);
                          const disabled = booked || inPast;
                          const selected = selectedTime === time;
                          return (
                            <button
                              key={time}
                              type="button"
                              disabled={disabled}
                              onClick={() => setSelectedTime(time)}
                              className={`relative rounded-xl py-3 text-sm font-bold transition-all ${
                                selected
                                  ? "bg-gradient-to-br from-[#8037f4] to-[#a66ff8] text-white shadow-[0_6px_20px_rgba(128,55,244,0.35)]"
                                  : disabled
                                    ? "cursor-not-allowed border border-slate-100 bg-slate-50 text-slate-400"
                                    : "border border-slate-200 bg-white text-slate-900 shadow-sm hover:border-violet-300 hover:text-[#8037f4]"
                              }`}
                            >
                              {time}
                              {booked && (
                                <span className="absolute -right-1 -top-1 rounded-full bg-slate-200 px-1 text-[0.55rem] font-bold text-slate-600">
                                  Hết
                                </span>
                              )}
                              {inPast && !booked && (
                                <span className="absolute -right-1 -top-1 rounded-full bg-slate-200 px-1 text-[0.55rem] font-bold text-slate-600">
                                  Qua giờ
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {selectedTime && (
                    <div className="mt-2 flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4">
                      <Check className="h-5 w-5 flex-shrink-0 text-[#8037f4]" strokeWidth={2.5} />
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          Lịch đã chọn: {selectedDayFull} lúc {selectedTime}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600">
                          Buổi kết thúc lúc {endTime} · Google Meet gửi qua email
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                    <span>
                      Múi giờ: <strong className="text-slate-700">Việt Nam (UTC+7)</strong> · Khung giờ được giữ trong 15 phút sau khi tiếp tục.
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                <Clock className="h-5 w-5 flex-shrink-0 text-slate-400" />
                <p>Chọn ngày để xem các khung giờ trống khả dụng</p>
              </div>
            )}

            <button
              type="button"
              disabled={!selectedDay || !selectedTime}
              onClick={() => setStep(2)}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black uppercase tracking-wide transition-all active:scale-[0.98] ${
                selectedDay && selectedTime
                  ? "bg-gradient-to-br from-[#8037f4] to-[#a66ff8] text-white shadow-[0_8px_28px_rgba(128,55,244,0.35)] hover:shadow-[0_12px_36px_rgba(128,55,244,0.45)]"
                  : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
              }`}
            >
              {selectedDay && selectedTime ? (
                <>
                  Tiếp tục, Thông tin và xác nhận <CaretRight className="h-4 w-4" />
                </>
              ) : (
                "Vui lòng chọn ngày và giờ"
              )}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            {showSmartBanner && suggestedData && (
              <div className="flex items-start gap-3 rounded-2xl border border-lime-200 bg-gradient-to-br from-lime-50 to-violet-50 p-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-lime-100">
                  <Sparkle className="h-5 w-5 text-[#4d6600]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-sm font-bold text-[#2f4200]">Tự động điền từ phân tích CV/JD gần nhất</p>
                  <p className="mb-2 text-xs text-slate-600">
                    Đã phân tích <span className="font-bold text-slate-900">{suggestedData.position}</span>. Điền nhanh để tiết kiệm thời gian?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleUseSmartFill}
                      className="rounded-lg bg-gradient-to-br from-[#8037f4] to-[#a66ff8] px-4 py-1.5 text-xs font-black text-white shadow-lg"
                    >
                      Dùng ngay
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSmartBanner(false)}
                      className="rounded-lg px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white hover:text-slate-900"
                    >
                      Bỏ qua
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSmartBanner(false)}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  aria-label="Đóng"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div className="glass-card space-y-5 p-5 lg:col-span-7 xl:col-span-8">
                <div>
                  <label className="mb-3 block text-[10px] font-black uppercase tracking-wide text-slate-500">
                    Loại buổi <span className="text-[#4d6600]">*</span>
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {sessionTypeOptions.map((opt) => {
                      const Icon = SESSION_TYPE_ICONS[opt.value] || VideoCamera;
                      const selected = sessionType === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setSessionType(opt.value)}
                          className={`rounded-xl border p-4 text-left transition-all ${
                            selected
                              ? "border-[#8037f4] bg-violet-50 shadow-[0_4px_16px_rgba(128,55,244,0.12)]"
                              : "border-slate-200 bg-white hover:border-violet-200 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                                selected ? "bg-[#8037f4] text-white" : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              <Icon className="h-4 w-4" strokeWidth={2} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900">{opt.label}</p>
                              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{opt.hint}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-500">
                    Vị trí đang ứng tuyển <span className="text-[#4d6600]">*</span>
                  </label>
                  <input
                    className={fieldClass}
                    placeholder="Ví dụ: Frontend Developer tại Shopee"
                    value={form.position}
                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-500">
                    Tải lên CV <span className="font-normal normal-case text-slate-600">(bắt buộc)</span>
                  </label>
                  <input
                    ref={cvInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword"
                    className="hidden"
                    onChange={handleCvFileChange}
                  />
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => cvInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") cvInputRef.current?.click();
                    }}
                    className={`cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition-all ${
                      form.cv && selectedCvFile
                        ? "border-lime-400 bg-lime-50"
                        : "border-slate-300 hover:border-violet-300 hover:bg-violet-50/40"
                    }`}
                  >
                    {cvUploading ? (
                      <p className="text-sm font-medium text-violet-700">Đang tải CV lên server…</p>
                    ) : form.cv && selectedCvFile ? (
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center justify-center gap-2 text-sm font-bold text-[#2f4200]">
                          <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                          <span className="truncate max-w-[280px]" title={selectedCvFile}>
                            {selectedCvFile}
                          </span>
                        </div>
                        {selectedCvUrl ? (
                          <p className="text-xs text-slate-500">Mentor sẽ mở được file sau khi đặt lịch</p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-3">
                        <FileText className="h-6 w-6 text-slate-400" />
                        <div className="text-left">
                          <p className="text-sm font-semibold text-slate-800">Nhấn để tải lên CV</p>
                          <p className="text-xs text-slate-500">PDF, DOC (tối đa 5MB)</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-500">
                    Tải lên JD <span className="font-normal normal-case text-slate-600">(khuyến khích)</span>
                  </label>
                  <input
                    ref={jdInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword"
                    className="hidden"
                    onChange={handleJdFileChange}
                  />
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => jdInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") jdInputRef.current?.click();
                    }}
                    className={`cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition-all ${
                      form.jd && selectedJdFile
                        ? "border-lime-400 bg-lime-50"
                        : "border-slate-300 hover:border-violet-300 hover:bg-violet-50/40"
                    }`}
                  >
                    {jdUploading ? (
                      <p className="text-sm font-medium text-violet-700">Đang tải JD lên server…</p>
                    ) : form.jd && selectedJdFile ? (
                      <div className="flex items-center justify-center gap-2 text-sm font-bold text-[#2f4200]">
                        <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                        <span className="truncate max-w-[280px]" title={selectedJdFile}>
                          {selectedJdFile}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-3">
                        <UploadSimple className="h-6 w-6 text-slate-400" />
                        <div className="text-left">
                          <p className="text-sm font-semibold text-slate-800">Nhấn để tải lên JD</p>
                          <p className="text-xs text-slate-500">Giúp mentor chuẩn bị câu hỏi phù hợp hơn</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-500">Ghi chú (nếu có)</label>
                  <textarea
                    className={`${fieldClass} resize-none`}
                    rows={2}
                    placeholder="Yêu cầu đặc biệt, tập trung kỹ năng nào, ngôn ngữ phỏng vấn..."
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-4 lg:col-span-5 xl:col-span-4">
                <div className="glass-card p-5">
                  <h2 className="mb-4 text-[10px] font-black uppercase tracking-wide text-slate-500">Tóm tắt đặt lịch</h2>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between gap-2 border-b border-slate-100 pb-3">
                      <span className="text-slate-500">Mentor</span>
                      <span className="max-w-[60%] text-right font-semibold text-slate-900">{mentor.name}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="flex items-center gap-2 text-slate-500">
                        <CalendarBlank className="h-3.5 w-3.5 text-slate-400" />
                        Ngày
                      </span>
                      <span className="max-w-[55%] text-right font-semibold text-slate-900">{selectedDayFull}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="flex items-center gap-2 text-slate-500">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        Giờ
                      </span>
                      <span className="font-semibold text-slate-900">
                        {selectedTime} – {endTime}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="flex items-center gap-2 text-slate-500">
                        <VideoCamera className="h-3.5 w-3.5 text-slate-400" />
                        Loại buổi
                      </span>
                      <span className="max-w-[55%] text-right font-semibold text-slate-900">
                        {sessionTypeLabel(sessionType)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="flex items-center gap-2 text-slate-500">
                        <VideoCamera className="h-3.5 w-3.5 text-slate-400" />
                        Hình thức
                      </span>
                      <span className="font-semibold text-slate-900">Google Meet</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-3">
                      <span className="font-bold text-slate-900">Tổng tiền</span>
                      <span className="text-lg font-black text-[#3d5200]">{formatVnd(sessionPrice)}</span>
                    </div>
                  </div>
                </div>

                <div className="glass-card p-4">
                  <BookingPolicySummary variant="compact" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50/90 px-4 py-3">
              <Bell className="h-4 w-4 flex-shrink-0 text-[#8037f4]" />
              <p className="text-xs font-medium leading-relaxed text-violet-900/90">
                Email nhắc lịch sẽ được gửi trước buổi phỏng vấn 01 giờ
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <ShieldCheck className="h-4 w-4 flex-shrink-0 text-[#8037f4]" />
                Thanh toán bảo mật và mã hóa
              </div>
              <button
                type="button"
                disabled={!form.position || !form.cv || !selectedCvFile || !selectedCvUrl || cvUploading || jdUploading}
                onClick={handleProceed}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl px-8 py-4 text-sm font-black uppercase tracking-wide transition-all active:scale-[0.98] sm:w-auto ${
                  form.position && form.cv && selectedCvFile && selectedCvUrl && !cvUploading && !jdUploading
                    ? "shadow-[0_8px_28px_rgba(147,247,43,0.35)] hover:brightness-95"
                    : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                }`}
                style={
                  form.position && form.cv && selectedCvFile && selectedCvUrl && !cvUploading && !jdUploading
                    ? BRAND_CTA_LIME_STYLE
                    : undefined
                }
              >
                Tiếp tục thanh toán, {formatVnd(sessionPrice)}
                <CaretRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </MentorPageShell>
  );
}
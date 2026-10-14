import React, { useMemo, useState, useEffect, useRef } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
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
  ArrowLeft,
  Star,
} from "lucide-react";
import { fetchMentor, fetchMentorAvailability } from "../../api/mentorApi.js";
import { isBookingSlotInFuture } from "../../utils/booking/bookingSchedule.js";
import { fetchBookedSlots, fetchRebookCredit } from "../../api/bookingsApi.js";
import { toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";
import { uploadFile } from "../../api/uploadApi.js";
import { getSuggestedBookingDataAsync, saveUploadedCV, saveUploadedJD } from "../../utils/shared/history.js";
import { BookingStepBar } from "../../components/booking/BookingStepBar";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";
import { BookingPolicySummary } from "../../components/booking/BookingPolicySummary";
import { avatarSrc } from "../../utils/shared/mediaUrl.js";
import {
  resolveMentorSessionTypeOptions,
  resolveSessionTypePrice,
  sessionTypeLabel,
} from "../../utils/booking/sessionTypeLabels.js";
import { formatVnd } from "../../utils/shared/formatVnd.js";
import { getPlans } from "../../utils/auth/auth.js";

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

  const MAX_SLOTS = 5;

  const [step, setStep] = useState(1);
  const [selectedDay, setSelectedDay]     = useState(null);
  const [selectedDayFull, setSelectedDayFull] = useState(null);
  const [selectedSlots, setSelectedSlots] = useState([]); // [{dateKey, dayFull, time}]
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
      slots: JSON.stringify(selectedSlots),
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
    if (!hasConfig) return [];

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
    if (!recurring.length && slotMapKeys === 0) {
      return [];
    }
    if (!recurring.length) return [];
    const mentorDay = (day.dateObj.getDay() + 6) % 7; // Mon=0
    const row = recurring.find((r) => Number(r?.dayOfWeek) === mentorDay);
    return row && Array.isArray(row.slots) ? row.slots.map((x) => String(x).trim()).filter(Boolean) : [];
  };

  const isSlotBooked = (time) => (selectedDay ? getBookedOfDay(selectedDay).includes(time) : false);
  const isSlotPast = (time) => (selectedDay ? !isBookingSlotInFuture(selectedDay, time) : false);

  const isSlotSelected = (time) =>
    selectedDay ? selectedSlots.some((s) => s.dateKey === selectedDay && s.time === time) : false;

  const toggleSlot = (time) => {
    if (!selectedDay || !selectedDayFull) return;
    const alreadySelected = selectedSlots.some((s) => s.dateKey === selectedDay && s.time === time);
    if (alreadySelected) {
      setSelectedSlots((prev) => prev.filter((s) => !(s.dateKey === selectedDay && s.time === time)));
    } else {
      if (selectedSlots.length >= MAX_SLOTS) {
        toastApiError(`Tối đa ${MAX_SLOTS} buổi mỗi lần đặt lịch.`);
        return;
      }
      setSelectedSlots((prev) => [...prev, { dateKey: selectedDay, dayFull: selectedDayFull, time }]);
    }
  };

  const removeSlot = (dateKey, time) => {
    setSelectedSlots((prev) => prev.filter((s) => !(s.dateKey === dateKey && s.time === time)));
  };

  const availableSlotCount = selectedDay
    ? (() => {
        const selectedObj = calendarWeeks.flatMap((w) => w.days).find((d) => d.dateKey === selectedDay);
        const allowed = getMentorSlotsForDay(selectedObj);
        return allowed.filter((t) => !isSlotBooked(t) && !isSlotPast(t)).length;
      })()
    : 0;

  const totalSlotCount = selectedSlots.length;
  const totalPrice = sessionPrice * Math.max(0, totalSlotCount);
  /* Ưu đãi Pro/Elite (-5%/-10%) — chỉ preview, số tiền thật tính lại ở /checkout khi tạo booking. */
  const perkPlans = getPlans();
  const perkDiscountRate = perkPlans.elitePro ? 0.1 : perkPlans.starterPro ? 0.05 : 0;
  const perkDiscountAmount = perkDiscountRate > 0 ? Math.round(totalPrice * perkDiscountRate) : 0;
  /* Giá 1 buổi (header trên cùng, trước khi chọn slot) — cùng % nhưng tính trên đơn giá, không phải tổng. */
  const headerPerkDiscountAmount = perkDiscountRate > 0 ? Math.round(sessionPrice * perkDiscountRate) : 0;

  const fieldClass =
    "w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 text-sm text-white placeholder:text-slate-500 transition-all focus:border-violet-400 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-violet-500/25";

  if (mentorLoading) {
    return (
      <div className={`relative min-h-screen text-slate-100 ${CUSTOMER_SHELL_GUTTER} pb-28 pt-12`}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-violet-600/15 blur-[120px]" />
        </div>
        <div className={`relative z-10 flex min-h-[50vh] flex-col items-center justify-center ${CUSTOMER_SHELL_MAX} mx-auto text-center`}>
          <div className="size-12 rounded-2xl border border-violet-400/30 bg-violet-500/15 flex items-center justify-center animate-spin mb-4 shadow-[0_0_24px_rgba(124,58,237,0.35)]">
            <div className="size-5 rounded-full border-2 border-violet-400 border-t-transparent" />
          </div>
          <p className="text-sm font-semibold text-slate-300">Đang tải thông tin chuyên gia…</p>
        </div>
      </div>
    );
  }

  if (!mentor) {
    return (
      <div className={`relative min-h-screen text-slate-100 ${CUSTOMER_SHELL_GUTTER} pb-28 pt-12`}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-violet-600/15 blur-[120px]" />
        </div>
        <div className={`relative z-10 flex min-h-[50vh] flex-col items-center justify-center ${CUSTOMER_SHELL_MAX} mx-auto text-center`}>
          <div className="rounded-3xl border border-white/12 bg-gradient-to-b from-[#18133d]/85 via-[#130f32]/90 to-[#0e0c24]/95 p-8 max-w-md w-full shadow-[0_20px_50px_rgba(5,3,20,0.5)] backdrop-blur-2xl">
            <Info className="mx-auto mb-4 size-12 text-rose-400/80" />
            <p className="text-sm font-medium text-slate-300">Không tìm thấy chuyên gia hoặc mentor chưa mở nhận booking.</p>
            <button
              type="button"
              onClick={() => navigate("/mentors")}
              className="mt-6 w-full rounded-xl border border-violet-400/40 border-t-white/50 bg-gradient-to-b from-violet-500/85 via-violet-600/75 to-indigo-700/85 py-3 text-sm font-bold text-white shadow-[0_4px_20px_rgba(124,58,237,0.45)] backdrop-blur-xl hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              Về danh sách chuyên gia
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative min-h-screen text-slate-100 ${CUSTOMER_SHELL_GUTTER} pb-28 pt-6 sm:pt-10 overflow-hidden`}>
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[550px] w-[550px] rounded-full bg-violet-600/15 blur-[130px]" />
        <div className="absolute top-1/3 -right-20 h-[450px] w-[450px] rounded-full bg-indigo-600/12 blur-[110px]" />
        <div className="absolute bottom-10 left-10 h-[400px] w-[400px] rounded-full bg-fuchsia-600/10 blur-[120px]" />
      </div>

      <div className={`relative z-10 ${CUSTOMER_SHELL_MAX} mx-auto w-full antialiased`}>
        {/* Breadcrumbs & Navigation */}
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-xs sm:text-sm font-medium text-slate-400">
          <Link to="/mentors" className="hover:text-white transition-colors flex items-center gap-1.5">
            <ArrowLeft className="size-3.5 text-violet-400" />
            <span>Chuyên gia</span>
          </Link>
          <span className="text-slate-600">/</span>
          <Link to={`/mentors/${mentor.id || mentor._id || id}`} className="hover:text-white transition-colors truncate max-w-xs text-slate-300">
            {mentor.name}
          </Link>
          <span className="text-slate-600">/</span>
          {step === 2 ? (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Bấm để quay lại bước chọn lịch"
              >
                Đặt lịch
              </button>
              <span className="text-slate-600">/</span>
              <span className="text-white font-bold px-2 py-0.5 rounded-lg bg-violet-500/15 border border-violet-400/25">Thông tin & xác nhận</span>
            </>
          ) : (
            <span className="text-white font-bold px-2 py-0.5 rounded-lg bg-violet-500/15 border border-violet-400/25">Đặt lịch</span>
          )}
        </nav>

        <div className="mb-8">
          <BookingStepBar current={step} onStepClick={setStep} />
        </div>

        {step === 1 ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mb-8 relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-r from-[#1c1745]/90 via-[#141035]/92 to-[#0c0824]/96 p-5 sm:p-7 shadow-[0_20px_50px_rgba(5,3,20,0.5)] backdrop-blur-2xl"
          >
            <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-violet-600/15 blur-3xl" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative z-10">
              <div className="flex items-center gap-4 sm:gap-5 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src={avatarSrc(mentor.avatar)}
                    alt={mentor.name}
                    className="size-16 sm:size-20 rounded-2xl sm:rounded-3xl object-cover ring-2 ring-violet-400/40 shadow-[0_0_25px_rgba(124,58,237,0.4)]"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = avatarSrc("");
                    }}
                  />
                  <div className="absolute -bottom-1 -right-1 size-5 rounded-full border-2 border-[#120e2e] bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)]" title="Sẵn sàng nhận lịch" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight truncate">{mentor.name}</h1>
                    <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-500/15 px-2.5 py-0.5 text-[11px] font-bold text-violet-300">
                      <Sparkle className="size-3 text-amber-300" />
                      Cố vấn cao cấp
                    </span>
                  </div>
                  <p className="truncate text-xs sm:text-sm text-slate-300 mt-1 font-medium">
                    {mentor.title} {mentor.company ? `· ${mentor.company}` : ""}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {mentor.experienceYears ? `${mentor.experienceYears} năm kinh nghiệm` : "Chuyên gia phỏng vấn"}
                  </p>
                </div>
              </div>
              
              <div className="flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-white/10 pt-3 sm:pt-0 shrink-0">
                <div className="flex items-center gap-2">
                  {headerPerkDiscountAmount > 0 && (
                    <span className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-0.5 text-xs font-bold text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                      -{Math.round(perkDiscountRate * 100)}%
                    </span>
                  )}
                  <span className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 drop-shadow">
                    {formatVnd(sessionPrice - headerPerkDiscountAmount)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {headerPerkDiscountAmount > 0 && (
                    <span className="text-xs text-slate-500 line-through">{formatVnd(sessionPrice)}</span>
                  )}
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">/ buổi (60 phút)</span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}

        {step === 1 && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/12 bg-gradient-to-b from-[#18133d]/85 via-[#130f32]/90 to-[#0e0c24]/95 p-6 sm:p-7 shadow-[0_20px_50px_rgba(5,3,20,0.45)] backdrop-blur-2xl overflow-hidden">
              <div className="flex items-center gap-3.5 border-b border-white/10 pb-5 mb-6">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-violet-500/20 border border-violet-400/30 text-violet-300 shadow-[0_0_20px_rgba(124,58,237,0.3)]">
                  <CalendarBlank className="size-5.5" strokeWidth={2.2} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">Chọn ngày phỏng vấn</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Lịch trống thực tế của {mentor.name}, theo giờ Việt Nam (UTC+7)</p>
                </div>
              </div>
              <div className="space-y-6">
                {calendarWeeks.map((week) => (
                  <div key={week.label}>
                    <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-violet-300/80">{week.label}</p>
                    <div className="grid grid-cols-7 gap-2 sm:gap-3">
                      {week.days.map((d) => {
                        const isSelected = selectedDay === d.dateKey;
                        const mentorSlots = getMentorSlotsForDay(d);
                        const freeSlots = mentorSlots.filter(
                          (t) => !getBookedOfDay(d.dateKey).includes(t) && isBookingSlotInFuture(d.dateKey, t),
                        ).length;
                        const canBookDay = d.available && freeSlots > 0;
                        return (
                          <button
                            key={d.dateKey}
                            type="button"
                            disabled={!canBookDay}
                            onClick={() => {
                              setSelectedDay(d.dateKey);
                              setSelectedDayFull(d.full);
                            }}
                            className={`group relative flex flex-col items-center rounded-2xl py-3.5 sm:py-4 px-1 transition-all ${
                              isSelected
                                ? "border border-violet-400/50 border-t-white/60 bg-gradient-to-b from-violet-500/90 via-violet-600/85 to-indigo-700/90 text-white shadow-[0_8px_24px_rgba(124,58,237,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)] scale-[1.03] z-10"
                                : canBookDay
                                  ? "border border-white/10 bg-white/[0.03] text-white hover:border-violet-400/40 hover:bg-violet-500/[0.08] hover:scale-[1.01] hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)] cursor-pointer"
                                  : "cursor-not-allowed border border-white/5 bg-white/[0.01] opacity-25 text-slate-600"
                            }`}
                          >
                            <span
                              className={`mb-1 text-xs font-bold uppercase tracking-wider ${
                                isSelected ? "text-white/90" : canBookDay ? "text-slate-400 group-hover:text-violet-200" : "text-slate-600"
                              }`}
                            >
                              {d.day}
                            </span>
                            <span className={`text-base sm:text-xl font-black ${isSelected ? "text-white" : canBookDay ? "text-white" : "text-slate-600"}`}>
                              {d.date.split("/")[0]}
                            </span>
                            {canBookDay && (
                              <span
                                className={`mt-2 rounded-full px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold transition-colors ${
                                  isSelected
                                    ? "bg-white/25 text-white"
                                    : freeSlots <= 3
                                      ? "bg-amber-500/20 border border-amber-400/30 text-amber-300"
                                      : "bg-emerald-500/20 border border-emerald-400/30 text-emerald-300"
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
                <div className="flex flex-wrap items-center gap-5 border-t border-white/10 pt-4 text-xs text-slate-400">
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.8)]" />
                    <span className="text-slate-200 font-semibold">Đã chọn</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full border border-white/40 bg-white/20" />
                    <span>Còn chỗ</span>
                  </span>
                  <span className="flex items-center gap-2 text-amber-300">
                    <span className="size-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                    <span className="font-medium">Còn ít chỗ</span>
                  </span>
                </div>
              </div>
            </div>

            {selectedDay ? (
              <div className="rounded-3xl border border-white/12 bg-gradient-to-b from-[#18133d]/85 via-[#130f32]/90 to-[#0e0c24]/95 p-6 sm:p-7 shadow-[0_20px_50px_rgba(5,3,20,0.45)] backdrop-blur-2xl overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5 mb-6">
                  <div className="flex items-center gap-3.5">
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-violet-500/20 border border-violet-400/30 text-violet-300 shadow-[0_0_20px_rgba(124,58,237,0.3)]">
                      <Clock className="size-5.5" strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base sm:text-lg font-bold text-white">Chọn khung giờ</h2>
                      <p className="truncate text-xs text-slate-400 mt-0.5">
                        {selectedDayFull} · <span className="text-emerald-400 font-bold">{availableSlotCount} khung giờ còn trống</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
                    <Timer className="size-3.5" />
                    60 phút / buổi
                  </div>
                </div>
                <div className="space-y-6">
                  {TIME_GROUPS.map((group) => (
                    <div key={group.label}>
                      <div className="mb-3 flex items-center gap-2">
                        <group.icon className="size-4 text-violet-400" />
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{group.label}</p>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
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
                          const selected = isSlotSelected(time);
                          const slotOrder = selected
                            ? selectedSlots.findIndex((s) => s.dateKey === selectedDay && s.time === time) + 1
                            : null;
                          return (
                            <button
                              key={time}
                              type="button"
                              disabled={disabled}
                              onClick={() => toggleSlot(time)}
                              className={`relative rounded-2xl py-3.5 text-sm font-black transition-all ${
                                selected
                                  ? "border border-violet-400/50 border-t-white/60 bg-gradient-to-b from-violet-500 via-violet-600 to-indigo-700 text-white shadow-[0_8px_24px_rgba(124,58,237,0.45),inset_0_1px_1px_rgba(255,255,255,0.4)] scale-[1.02]"
                                  : disabled
                                    ? "cursor-not-allowed border border-white/5 bg-white/[0.01] text-slate-600 opacity-30"
                                    : "border border-white/12 bg-white/[0.04] text-slate-200 hover:border-violet-400/50 hover:bg-violet-500/[0.1] hover:text-white cursor-pointer"
                              }`}
                            >
                              {time}
                              {selected && slotOrder && (
                                <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-emerald-400 text-[10px] font-black text-slate-950 shadow-[0_0_8px_rgba(16,185,129,0.8)] border border-white/50">
                                  {slotOrder}
                                </span>
                              )}
                              {booked && (
                                <span className="absolute -right-1 -top-1 rounded-full bg-white/10 border border-white/10 px-1.5 py-0.5 text-[9px] font-bold text-slate-400">
                                  Hết
                                </span>
                              )}
                              {inPast && !booked && (
                                <span className="absolute -right-1 -top-1 rounded-full bg-white/10 border border-white/10 px-1.5 py-0.5 text-[9px] font-bold text-slate-400">
                                  Qua giờ
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {selectedSlots.length > 0 && (
                    <div className="mt-5 rounded-2xl border border-violet-400/30 bg-gradient-to-b from-violet-950/60 via-purple-950/40 to-[#0e0924]/80 p-5 shadow-[0_12px_36px_rgba(124,58,237,0.25)] backdrop-blur-xl">
                      <div className="mb-3.5 flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-white flex items-center gap-2">
                          <Check className="size-4 text-emerald-400" />
                          Đã chọn {selectedSlots.length}/{MAX_SLOTS} buổi
                        </p>
                        <div className="flex flex-col items-end gap-0.5">
                          {perkDiscountAmount > 0 && (
                            <span className="text-[11px] font-medium text-slate-400 line-through">
                              {formatVnd(totalPrice)}
                            </span>
                          )}
                          <span className="flex items-center gap-1.5 rounded-full bg-violet-600/40 border border-violet-400/30 px-3 py-1 text-xs font-black text-white shadow">
                            {perkDiscountAmount > 0 && (
                              <span className="rounded-full bg-emerald-500/30 border border-emerald-400/40 px-1.5 text-[10px] font-bold text-emerald-300">
                                -{Math.round(perkDiscountRate * 100)}%
                              </span>
                            )}
                            {formatVnd(totalPrice - perkDiscountAmount)}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedSlots.map((s, i) => (
                          <div
                            key={`${s.dateKey}_${s.time}`}
                            className="flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/20 px-3.5 py-1.5 text-xs font-semibold text-violet-100 shadow-sm"
                          >
                            <span className="flex size-4 items-center justify-center rounded-full bg-violet-500 text-[10px] font-black text-white">
                              {i + 1}
                            </span>
                            <span>{s.dayFull} · {s.time}</span>
                            <button
                              type="button"
                              onClick={() => removeSlot(s.dateKey, s.time)}
                              className="text-violet-300 hover:text-white transition-colors ml-0.5 cursor-pointer"
                              aria-label="Bỏ slot này"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      {selectedSlots.length < MAX_SLOTS && (
                        <p className="mt-3 text-xs text-violet-300/80">
                          Bạn có thể chọn thêm các khung giờ khác trong tuần (tối đa {MAX_SLOTS} buổi)
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-start gap-2.5 border-t border-white/10 pt-4 text-xs text-slate-400">
                    <Info className="mt-0.5 size-4 shrink-0 text-violet-400" />
                    <span className="leading-relaxed">
                      Múi giờ: <strong className="text-white">Việt Nam (UTC+7)</strong> · Khung giờ được giữ trong 15 phút sau khi tiếp tục.
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3.5 rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-sm text-slate-400 backdrop-blur-sm">
                <Clock className="size-6 shrink-0 text-violet-400" />
                <p className="font-medium">Vui lòng chọn ngày phía trên để xem các khung giờ trống khả dụng của chuyên gia.</p>
              </div>
            )}

            <motion.button
              whileHover={selectedSlots.length > 0 ? { scale: 1.01 } : {}}
              whileTap={selectedSlots.length > 0 ? { scale: 0.98 } : {}}
              type="button"
              disabled={selectedSlots.length === 0}
              onClick={() => setStep(2)}
              className={`group relative overflow-hidden flex w-full items-center justify-center gap-3 rounded-2xl py-4 sm:py-4.5 text-sm sm:text-base font-extrabold uppercase tracking-wider transition-all ${
                selectedSlots.length > 0
                  ? "border border-violet-400/40 border-t-white/50 bg-gradient-to-b from-violet-500/90 via-violet-600/80 to-indigo-700/90 text-white shadow-[0_8px_32px_rgba(124,58,237,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-xl hover:brightness-110 active:scale-[0.98] cursor-pointer"
                  : "cursor-not-allowed border border-white/10 bg-white/[0.02] text-slate-500"
              }`}
            >
              {selectedSlots.length > 0 ? (
                <>
                  <span>Tiếp tục · {selectedSlots.length} buổi · {formatVnd(totalPrice - perkDiscountAmount)}</span>
                  <div className="size-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0 border border-white/30 group-hover:translate-x-0.5 transition-transform">
                    <CaretRight className="size-4" />
                  </div>
                </>
              ) : (
                "Vui lòng chọn ít nhất 1 khung giờ"
              )}
            </motion.button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            {showSmartBanner && suggestedData && (
              <div className="flex items-start gap-4 rounded-3xl border border-violet-400/30 bg-gradient-to-r from-violet-950/70 via-purple-950/50 to-black/70 p-5 backdrop-blur-2xl shadow-[0_16px_40px_rgba(124,58,237,0.2)]">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600/30 border border-violet-500/40 text-violet-300 shadow-[0_0_16px_rgba(124,58,237,0.4)]">
                  <Sparkle className="size-5 text-amber-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-sm font-bold text-white">Tự động điền từ phân tích CV/JD gần nhất</p>
                  <p className="mb-3 text-xs text-slate-300 leading-relaxed">
                    Đã nhận diện vị trí <span className="font-bold text-violet-300">{suggestedData.position}</span>. Điền nhanh để tiết kiệm thời gian?
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={handleUseSmartFill}
                      className="rounded-xl border border-violet-400/40 border-t-white/40 bg-gradient-to-b from-violet-500/90 via-violet-600/80 to-indigo-700/90 px-4 py-2 text-xs font-bold text-white shadow-[0_4px_16px_rgba(124,58,237,0.4)] backdrop-blur-xl hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                    >
                      Dùng ngay
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSmartBanner(false)}
                      className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                    >
                      Bỏ qua
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSmartBanner(false)}
                  className="flex size-8 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                  aria-label="Đóng"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="rounded-3xl border border-white/12 bg-gradient-to-b from-[#18133d]/85 via-[#130f32]/90 to-[#0e0c24]/95 p-6 sm:p-7 space-y-6 lg:col-span-7 xl:col-span-8 shadow-[0_20px_50px_rgba(5,3,20,0.45)] backdrop-blur-2xl">
                <div>
                  <label className="mb-3 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Loại buổi <span className="text-violet-400">*</span>
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {sessionTypeOptions.map((opt) => {
                      const Icon = SESSION_TYPE_ICONS[opt.value] || VideoCamera;
                      const selected = sessionType === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setSessionType(opt.value)}
                          className={`rounded-2xl border p-4.5 text-left transition-all ${
                            selected
                              ? "border-violet-400/60 bg-violet-600/20 shadow-[0_8px_24px_rgba(124,58,237,0.3)] ring-1 ring-violet-400/40 text-white scale-[1.01]"
                              : "border-white/10 bg-white/[0.03] hover:border-violet-400/30 hover:bg-white/[0.06] text-slate-300 cursor-pointer"
                          }`}
                        >
                          <div className="flex items-start gap-3.5">
                            <div
                              className={`flex size-11 shrink-0 items-center justify-center rounded-2xl transition-all ${
                                selected
                                  ? "bg-gradient-to-b from-violet-500 to-indigo-600 text-white shadow-[0_0_16px_rgba(124,58,237,0.5)] border border-white/30"
                                  : "bg-white/5 border border-white/10 text-slate-400"
                              }`}
                            >
                              <Icon className="size-5" strokeWidth={2.2} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-white">{opt.label}</p>
                              <p className="mt-1 text-xs leading-relaxed text-slate-400">{opt.hint}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Vị trí đang ứng tuyển <span className="text-violet-400">*</span>
                  </label>
                  <input
                    className={fieldClass}
                    placeholder="Ví dụ: Frontend Developer tại Shopee"
                    value={form.position}
                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Tải lên CV <span className="font-normal normal-case text-slate-400">(bắt buộc)</span>
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
                    className={`cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center transition-all ${
                      form.cv && selectedCvFile
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                        : "border-white/15 bg-white/[0.03] hover:border-violet-400/40 hover:bg-violet-500/[0.06] text-slate-300"
                    }`}
                  >
                    {cvUploading ? (
                      <p className="text-sm font-medium text-violet-300">Đang tải CV lên server…</p>
                    ) : form.cv && selectedCvFile ? (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-1">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="size-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                            <Check className="size-5" strokeWidth={2.5} />
                          </div>
                          <div className="text-left min-w-0">
                            <p className="text-sm font-bold text-emerald-300 truncate max-w-[260px] sm:max-w-xs">{selectedCvFile}</p>
                            <p className="text-[11px] text-slate-400">File đã sẵn sàng để gửi mentor</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); cvInputRef.current?.click(); }}
                          className="text-xs font-semibold text-violet-300 hover:text-white px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 shrink-0 transition cursor-pointer"
                        >
                          Thay file
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-3 py-2">
                        <FileText className="size-7 text-violet-300/80" />
                        <div className="text-left">
                          <p className="text-sm font-bold text-white">Nhấn để tải lên CV</p>
                          <p className="text-xs text-slate-400">PDF, DOC (tối đa 5MB)</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Tải lên JD <span className="font-normal normal-case text-slate-400">(khuyến khích)</span>
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
                    className={`cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center transition-all ${
                      form.jd && selectedJdFile
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                        : "border-white/15 bg-white/[0.03] hover:border-violet-400/40 hover:bg-violet-500/[0.06] text-slate-300"
                    }`}
                  >
                    {jdUploading ? (
                      <p className="text-sm font-medium text-violet-300">Đang tải JD lên server…</p>
                    ) : form.jd && selectedJdFile ? (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-1">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="size-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                            <Check className="size-5" strokeWidth={2.5} />
                          </div>
                          <div className="text-left min-w-0">
                            <p className="text-sm font-bold text-emerald-300 truncate max-w-[260px] sm:max-w-xs">{selectedJdFile}</p>
                            <p className="text-[11px] text-slate-400">File đã sẵn sàng để gửi mentor</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); jdInputRef.current?.click(); }}
                          className="text-xs font-semibold text-violet-300 hover:text-white px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 shrink-0 transition cursor-pointer"
                        >
                          Thay file
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-3 py-2">
                        <UploadSimple className="size-7 text-amber-300/80" />
                        <div className="text-left">
                          <p className="text-sm font-bold text-white">Nhấn để tải lên JD</p>
                          <p className="text-xs text-slate-400">Giúp mentor chuẩn bị câu hỏi phù hợp nhất</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-400">Ghi chú (nếu có)</label>
                  <textarea
                    className={`${fieldClass} resize-none`}
                    rows={2}
                    placeholder="Yêu cầu đặc biệt, tập trung kỹ năng nào, ngôn ngữ phỏng vấn..."
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-5 lg:col-span-5 xl:col-span-4">
                <div className="rounded-3xl border border-white/12 bg-gradient-to-b from-[#1d1245]/90 via-[#130c2e]/90 to-[#0b061c]/95 backdrop-blur-2xl p-6 shadow-2xl space-y-4">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-violet-300/90 flex items-center gap-2">
                    <Sparkle className="size-3.5 text-amber-300" />
                    Tóm tắt đặt lịch
                  </h2>
                  <div className="space-y-3.5 text-sm">
                    <div className="flex justify-between gap-2 border-b border-white/10 pb-3">
                      <span className="text-slate-400">Mentor</span>
                      <span className="max-w-[60%] text-right font-bold text-white">{mentor.name}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="flex items-center gap-2 text-slate-400">
                        <VideoCamera className="size-3.5 text-violet-400" />
                        Loại buổi
                      </span>
                      <span className="max-w-[55%] text-right font-semibold text-white">
                        {sessionTypeLabel(sessionType)}
                      </span>
                    </div>
                    <div className="space-y-2 border-t border-white/10 pt-3">
                      <span className="flex items-center gap-2 text-slate-400">
                        <CalendarBlank className="size-3.5 text-violet-400" />
                        {selectedSlots.length} buổi đã chọn
                      </span>
                      {selectedSlots.map((s, i) => (
                        <div key={`${s.dateKey}_${s.time}`} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[10px] font-black text-white">
                              {i + 1}
                            </span>
                            <span className="truncate text-xs font-medium text-slate-300">{s.dayFull}</span>
                          </div>
                          <span className="shrink-0 text-xs font-bold text-white font-mono">{s.time}</span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2 border-t border-white/10 pt-3.5">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>{formatVnd(sessionPrice)} × {selectedSlots.length} buổi</span>
                        <span>{formatVnd(totalPrice)}</span>
                      </div>
                      {perkDiscountAmount > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-emerald-400">Ưu đãi {perkPlans.elitePro ? "Elite" : "Pro"} (-{Math.round(perkDiscountRate * 100)}%)</span>
                          <span className="font-bold text-emerald-400">−{formatVnd(perkDiscountAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2 border-t border-white/10">
                        <span className="font-bold text-white">Tổng tiền</span>
                        <span className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 drop-shadow">
                          {formatVnd(totalPrice - perkDiscountAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/12 bg-gradient-to-b from-[#18133d]/85 via-[#130f32]/90 to-[#0e0c24]/95 backdrop-blur-2xl p-5 shadow-xl">
                  <BookingPolicySummary variant="compact" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-violet-400/30 bg-violet-950/40 px-5 py-4 backdrop-blur-md">
              <Bell className="size-4 shrink-0 text-violet-300" />
              <p className="text-xs font-medium leading-relaxed text-slate-300">
                Email nhắc lịch sẽ được gửi trước buổi phỏng vấn 01 giờ kèm đường dẫn phòng họp trực tuyến.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="size-4 shrink-0 text-emerald-400" />
                Thanh toán bảo mật và mã hóa SSL 256-bit
              </div>
              <motion.button
                whileHover={form.position && form.cv && selectedCvFile && selectedCvUrl && !cvUploading && !jdUploading ? { scale: 1.01 } : {}}
                whileTap={form.position && form.cv && selectedCvFile && selectedCvUrl && !cvUploading && !jdUploading ? { scale: 0.98 } : {}}
                type="button"
                disabled={!form.position || !form.cv || !selectedCvFile || !selectedCvUrl || cvUploading || jdUploading}
                onClick={handleProceed}
                className={`group relative overflow-hidden flex w-full items-center justify-center gap-3 rounded-2xl px-8 py-4 sm:py-4.5 text-sm sm:text-base font-extrabold uppercase tracking-wider transition-all sm:w-auto ${
                  form.position && form.cv && selectedCvFile && selectedCvUrl && !cvUploading && !jdUploading
                    ? "border border-violet-400/40 border-t-white/50 bg-gradient-to-b from-violet-500/90 via-violet-600/80 to-indigo-700/90 text-white shadow-[0_8px_32px_rgba(124,58,237,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-xl hover:brightness-110 active:scale-[0.98] cursor-pointer"
                    : "cursor-not-allowed border border-white/10 bg-white/[0.02] text-slate-500"
                }`}
              >
                <span>Tiếp tục thanh toán · {selectedSlots.length} buổi · {formatVnd(totalPrice - perkDiscountAmount)}</span>
                <div className="size-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0 border border-white/30 group-hover:translate-x-0.5 transition-transform">
                  <CaretRight className="size-4" />
                </div>
              </motion.button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
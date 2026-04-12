import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Calendar as CalendarBlank,
  Clock,
  Upload as UploadSimple,
  FileText,
  Check,
  ArrowLeft,
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
  CircleDollarSign as CurrencyCircleDollar,
  Sparkles as Sparkle,
  X,
} from "lucide-react";
import { fetchMentor } from "../../utils/mentorApi";
import { getSuggestedBookingData, getCVAnalysisHistory } from "../../utils/history";

/* ── Calendar data ─────────────────────────────────── */
const WEEKS = [
  {
    label: "Tuần này · 27/02 – 05/03",
    days: [
      { day: "T2", date: "27/02", full: "Thứ 2, 27/02", available: true },
      { day: "T3", date: "28/02", full: "Thứ 3, 28/02", available: false },
      { day: "T4", date: "01/03", full: "Thứ 4, 01/03", available: true },
      { day: "T5", date: "02/03", full: "Thứ 5, 02/03", available: true },
      { day: "T6", date: "03/03", full: "Thứ 6, 03/03", available: true },
      { day: "T7", date: "04/03", full: "Thứ 7, 04/03", available: false },
      { day: "CN", date: "05/03", full: "Chủ nhật, 05/03", available: true },
    ],
  },
  {
    label: "Tuần sau · 06/03 – 12/03",
    days: [
      { day: "T2", date: "06/03", full: "Thứ 2, 06/03", available: true },
      { day: "T3", date: "07/03", full: "Thứ 3, 07/03", available: true },
      { day: "T4", date: "08/03", full: "Thứ 4, 08/03", available: false },
      { day: "T5", date: "09/03", full: "Thứ 5, 09/03", available: true },
      { day: "T6", date: "10/03", full: "Thứ 6, 10/03", available: true },
      { day: "T7", date: "11/03", full: "Thứ 7, 11/03", available: false },
      { day: "CN", date: "12/03", full: "Chủ nhật, 12/03", available: true },
    ],
  },
];

const TIME_GROUPS = [
  { label: "Buổi sáng", icon: Sun, slots: ["08:00", "09:00", "10:00", "11:00"] },
  { label: "Buổi chiều", icon: Coffee, slots: ["14:00", "15:00", "16:00", "17:00"] },
  { label: "Buổi tối", icon: Moon, slots: ["19:00", "20:00", "21:00"] },
];

const BOOKED = {
  "01/03": ["09:00", "15:00"],
  "02/03": ["10:00", "14:00", "19:00"],
  "03/03": ["08:00", "16:00"],
  "06/03": ["09:00", "10:00", "20:00"],
  "07/03": ["14:00"],
  "09/03": ["11:00", "15:00", "21:00"],
  "10/03": ["08:00", "09:00", "17:00"],
  "12/03": ["10:00", "20:00"],
};

export function Booking() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [mentor, setMentor] = useState(null);
  const [mentorLoading, setMentorLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setMentor(null);
      setMentorLoading(false);
      return;
    }
    setMentorLoading(true);
    fetchMentor(id)
      .then((m) => setMentor(m))
      .finally(() => setMentorLoading(false));
  }, [id]);

  const [step, setStep] = useState(1);
  const [selectedDay, setSelectedDay]     = useState(null);
  const [selectedDayFull, setSelectedDayFull] = useState(null);
  const [selectedTime, setSelectedTime]   = useState(null);
  const [form, setForm] = useState({ position: "", note: "", jd: false, cv: false });

  const [suggestedData, setSuggestedData] = useState(null);
  const [showSmartBanner, setShowSmartBanner] = useState(false);
  const [selectedCvFile, setSelectedCvFile] = useState("");
  const [selectedJdFile, setSelectedJdFile] = useState("");

  useEffect(() => {
    getCVAnalysisHistory();
    const suggested = getSuggestedBookingData();
    setSuggestedData(suggested);
    if (suggested?.position) setShowSmartBanner(true);
  }, []);

  const handleUseSmartFill = () => {
    if (!suggestedData) return;
    setForm({ ...form, position: suggestedData.position || "", cv: !!suggestedData.cvFile, jd: !!suggestedData.jdFile });
    if (suggestedData.cvFile) setSelectedCvFile(suggestedData.cvFile);
    if (suggestedData.jdFile) setSelectedJdFile(suggestedData.jdFile);
    setShowSmartBanner(false);
  };

  const handleProceed = () => {
    const params = new URLSearchParams({
      type: "booking",
      mentorId: mentor.id,
      price: String(mentor.price),
      date: selectedDayFull ?? selectedDay ?? "",
      time: selectedTime ?? "",
      position: form.position,
      note: form.note,
      cvFile: form.cv ? "Nguyen_Tuan_CV.pdf" : "",
      jdFile: form.jd ? "JD_Target.pdf" : "",
    });
    navigate(`/checkout?${params.toString()}`);
  };

  const isSlotBooked = (time) =>
    selectedDay ? (BOOKED[selectedDay] ?? []).includes(time) : false;

  const availableSlotCount = selectedDay
    ? TIME_GROUPS.flatMap((g) => g.slots).filter((t) => !isSlotBooked(t)).length
    : 0;

  const endTime = selectedTime
    ? String(parseInt(selectedTime.split(":")[0]) + 1).padStart(2, "0") + ":00"
    : "";

  const fieldClass =
    "w-full rounded-xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder:text-zinc-500 transition-colors focus:border-primary-fixed/45 focus:outline-none focus:ring-1 focus:ring-primary-fixed/25";

  if (mentorLoading) {
    return (
      <div className="pi-page-dashboard-bg relative flex min-h-screen items-center justify-center text-zinc-400">
        Đang tải thông tin mentor…
      </div>
    );
  }

  if (!mentor) {
    return (
      <div className="pi-page-dashboard-bg relative flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center text-zinc-400">
        <p>Không tìm thấy mentor hoặc mentor chưa mở nhận booking.</p>
        <button
          type="button"
          onClick={() => navigate("/mentors")}
          className="rounded-full bg-primary-fixed px-6 py-2 text-sm font-bold text-black"
        >
          Về danh sách mentor
        </button>
      </div>
    );
  }

  return (
    <div className="pi-page-dashboard-bg relative min-h-screen w-full overflow-x-hidden pb-20 font-sans text-white selection:bg-[rgba(196,255,71,0.28)] selection:text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-90">
        <div className="absolute top-[-18%] right-[-8%] h-[65vh] w-[65vh] rounded-full bg-gradient-to-bl from-fuchsia-600/30 via-violet-600/18 to-transparent blur-[100px]" />
        <div className="absolute bottom-[-22%] left-[-12%] h-[80vh] w-[80vh] rounded-full bg-gradient-to-tr from-[#c4ff47]/14 via-cyan-500/8 to-fuchsia-500/16 blur-[110px]" />
        <div className="absolute top-1/2 left-1/2 h-[45vh] w-[45vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#6E35E8]/10 blur-[90px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-5 pt-8 sm:px-6 sm:pt-10">
        <button
          type="button"
          onClick={() => (step === 1 ? navigate(-1) : setStep(1))}
          className="group -ml-1 mb-6 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          {step === 1 ? "Quay lại" : "Quay lại chọn lịch"}
        </button>

        <div className="mb-8 flex select-none items-center gap-0">
          {[
            { n: 1, label: "Chọn lịch" },
            { n: 2, label: "Thông tin & Xác nhận" },
          ].map((s, i) => (
            <span key={s.n} className="contents">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black transition-all ${
                    step > s.n
                      ? "bg-primary-fixed text-black shadow-[0_0_20px_rgba(196,255,71,0.35)]"
                      : step === s.n
                        ? "bg-gradient-to-br from-[#6E35E8] to-[#8B4DFF] text-white shadow-[0_0_0_3px_rgba(110,53,232,0.25)]"
                        : "bg-white/10 text-zinc-500"
                  }`}
                >
                  {step > s.n ? <Check className="h-4 w-4" strokeWidth={2.5} /> : s.n}
                </div>
                <span
                  className={`hidden text-sm font-bold sm:block ${
                    step === s.n ? "text-primary-fixed" : step > s.n ? "text-zinc-400" : "text-zinc-600"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < 1 && (
                <div
                  className={`mx-3 h-0.5 flex-1 rounded-full transition-colors ${
                    step > s.n ? "bg-primary-fixed/90" : "bg-white/10"
                  }`}
                />
              )}
            </span>
          ))}
        </div>

        <div className="mb-6 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
          <img src={mentor.avatar} alt={mentor.name} className="h-12 w-12 flex-shrink-0 rounded-xl object-cover ring-1 ring-white/10" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{mentor.name}</p>
            <p className="truncate text-xs text-zinc-400">
              {mentor.title} · {mentor.company}
            </p>
          </div>
          <div className="ml-auto flex-shrink-0 text-right">
            <p className="text-lg font-black text-primary-fixed">{mentor.price.toLocaleString("vi")}đ</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">/ 60 phút</p>
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="card-premium overflow-hidden">
              <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.03] px-5 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/20">
                  <CalendarBlank className="h-4 w-4 text-primary-fixed" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Chọn ngày phỏng vấn</p>
                  <p className="text-xs text-zinc-500">Lịch trống của {mentor.name} — Tháng 2 & 3/2026</p>
                </div>
              </div>
              <div className="space-y-5 p-5">
                {WEEKS.map((week) => (
                  <div key={week.label}>
                    <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{week.label}</p>
                    <div className="grid grid-cols-7 gap-2">
                      {week.days.map((d) => {
                        const isSelected = selectedDay === d.date;
                        const bookedCount = (BOOKED[d.date] ?? []).length;
                        const freeSlots = TIME_GROUPS.flatMap((g) => g.slots).length - bookedCount;
                        return (
                          <button
                            key={d.date}
                            type="button"
                            disabled={!d.available}
                            onClick={() => {
                              setSelectedDay(d.date);
                              setSelectedDayFull(d.full);
                              setSelectedTime(null);
                            }}
                            className={`flex flex-col items-center rounded-xl py-3 transition-all ${
                              isSelected
                                ? "bg-gradient-to-br from-[#6E35E8] to-[#8B4DFF] text-white shadow-[0_8px_24px_rgba(110,53,232,0.35)]"
                                : d.available
                                  ? "border border-white/12 bg-white/[0.06] text-white hover:border-primary-fixed/35"
                                  : "cursor-not-allowed bg-white/[0.03] opacity-40"
                            }`}
                          >
                            <span
                              className={`mb-1 text-xs font-semibold ${
                                isSelected ? "text-white/75" : d.available ? "text-zinc-500" : "text-zinc-600"
                              }`}
                            >
                              {d.day}
                            </span>
                            <span className={`text-[0.95rem] font-black ${isSelected ? "text-white" : d.available ? "text-white" : "text-zinc-600"}`}>
                              {d.date.split("/")[0]}
                            </span>
                            {d.available && (
                              <span
                                className={`mt-1 rounded-full px-1.5 text-[0.6rem] font-bold ${
                                  isSelected
                                    ? "bg-white/15 text-white/90"
                                    : freeSlots <= 3
                                      ? "bg-[#FF8C42]/20 text-[#ffb38a]"
                                      : "bg-primary-fixed/15 text-primary-fixed"
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
                <div className="flex flex-wrap items-center gap-4 border-t border-white/10 pt-3 text-xs text-zinc-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-[#6E35E8] to-[#8B4DFF]" />
                    Đã chọn
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full border border-white/25 bg-white/10" />
                    Còn chỗ
                  </span>
                  <span className="flex items-center gap-1.5 text-[#ffb38a]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#FF8C42]/50" />
                    Còn ít chỗ
                  </span>
                </div>
              </div>
            </div>

            {selectedDay ? (
              <div className="card-premium overflow-hidden">
                <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.03] px-5 py-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/20">
                    <Clock className="h-4 w-4 text-primary-fixed" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white">Chọn khung giờ</p>
                    <p className="truncate text-xs text-zinc-500">
                      {selectedDayFull} · {availableSlotCount} khung giờ trống
                    </p>
                  </div>
                  <div className="ml-auto flex flex-shrink-0 items-center gap-1.5 rounded-full border border-primary-fixed/25 bg-primary-fixed/10 px-3 py-1.5 text-[11px] font-bold text-primary-fixed">
                    <Timer className="h-3.5 w-3.5" />
                    60 phút / buổi
                  </div>
                </div>
                <div className="space-y-5 p-5">
                  {TIME_GROUPS.map((group) => (
                    <div key={group.label}>
                      <div className="mb-3 flex items-center gap-2">
                        <group.icon className="h-3.5 w-3.5 text-zinc-500" />
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{group.label}</p>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {group.slots.map((time) => {
                          const booked = isSlotBooked(time);
                          const selected = selectedTime === time;
                          return (
                            <button
                              key={time}
                              type="button"
                              disabled={booked}
                              onClick={() => setSelectedTime(time)}
                              className={`relative rounded-xl py-3 text-sm font-bold transition-all ${
                                selected
                                  ? "bg-gradient-to-br from-[#6E35E8] to-[#8B4DFF] text-white shadow-[0_6px_20px_rgba(110,53,232,0.35)]"
                                  : booked
                                    ? "cursor-not-allowed border border-white/[0.06] bg-white/[0.03] text-zinc-600"
                                    : "border border-white/12 bg-white/[0.06] text-white hover:border-primary-fixed/40 hover:text-primary-fixed"
                              }`}
                            >
                              {time}
                              {booked && (
                                <span className="absolute -right-1 -top-1 rounded-full bg-white/10 px-1 text-[0.55rem] font-bold text-zinc-500">
                                  Hết
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {selectedTime && (
                    <div className="mt-2 flex items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/[0.08] p-4">
                      <Check className="h-5 w-5 flex-shrink-0 text-primary-fixed" strokeWidth={2.5} />
                      <div>
                        <p className="text-sm font-bold text-white">
                          Lịch đã chọn: {selectedDayFull} lúc {selectedTime}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          Buổi kết thúc lúc {endTime} · Google Meet gửi qua email
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-2 border-t border-white/5 pt-3 text-xs text-zinc-500">
                    <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-zinc-600" />
                    <span>
                      Múi giờ: <strong className="text-zinc-400">Việt Nam (UTC+7)</strong> · Khung giờ được giữ trong 15 phút sau khi tiếp tục.
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-5 text-sm text-zinc-500">
                <Clock className="h-5 w-5 flex-shrink-0 text-zinc-600" />
                <p>Chọn ngày để xem các khung giờ trống khả dụng</p>
              </div>
            )}

            <button
              type="button"
              disabled={!selectedDay || !selectedTime}
              onClick={() => setStep(2)}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black uppercase tracking-wide transition-all active:scale-[0.98] ${
                selectedDay && selectedTime
                  ? "bg-gradient-to-br from-[#6E35E8] to-[#8B4DFF] text-white shadow-[0_8px_28px_rgba(110,53,232,0.35)] hover:shadow-[0_12px_36px_rgba(110,53,232,0.45)]"
                  : "cursor-not-allowed bg-white/[0.06] text-zinc-600"
              }`}
            >
              {selectedDay && selectedTime ? (
                <>
                  Tiếp tục — Thông tin và xác nhận <CaretRight className="h-4 w-4" />
                </>
              ) : (
                "Vui lòng chọn ngày và giờ"
              )}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-sm">
              <CalendarBlank className="h-4 w-4 flex-shrink-0 text-primary-fixed" />
              <p className="min-w-0 flex-1 truncate text-sm font-bold text-white">
                {selectedDayFull} · {selectedTime} – {endTime}
              </p>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-shrink-0 rounded-lg px-3 py-1 text-xs font-bold text-primary-fixed transition-colors hover:bg-primary-fixed/10"
              >
                Đổi lịch
              </button>
            </div>

            {showSmartBanner && suggestedData && (
              <div className="flex items-start gap-3 rounded-2xl border border-primary-fixed/25 bg-gradient-to-br from-primary-fixed/[0.08] to-violet-500/[0.06] p-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-fixed/15">
                  <Sparkle className="h-5 w-5 text-primary-fixed" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-sm font-bold text-primary-fixed">Tự động điền từ phân tích CV/JD gần nhất</p>
                  <p className="mb-2 text-xs text-zinc-400">
                    Đã phân tích <span className="font-bold text-white">{suggestedData.position}</span>. Điền nhanh để tiết kiệm thời gian?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleUseSmartFill}
                      className="rounded-lg bg-gradient-to-br from-[#6E35E8] to-[#8B4DFF] px-4 py-1.5 text-xs font-black text-white shadow-lg"
                    >
                      Dùng ngay
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSmartBanner(false)}
                      className="rounded-lg px-4 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-white/5 hover:text-white"
                    >
                      Bỏ qua
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSmartBanner(false)}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/10 hover:text-white"
                  aria-label="Đóng"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
              <div className="card-premium space-y-5 p-5 lg:col-span-3">
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-zinc-500">
                    Vị trí đang ứng tuyển <span className="text-primary-fixed">*</span>
                  </label>
                  <input
                    className={fieldClass}
                    placeholder="Ví dụ: Frontend Developer tại Shopee"
                    value={form.position}
                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-zinc-500">
                    Tải lên CV <span className="font-normal normal-case text-zinc-600">(bắt buộc)</span>
                  </label>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setForm({ ...form, cv: true })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setForm({ ...form, cv: true });
                    }}
                    className={`cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition-all ${
                      form.cv
                        ? "border-primary-fixed/60 bg-primary-fixed/10"
                        : "border-white/15 hover:border-primary-fixed/35 hover:bg-white/[0.04]"
                    }`}
                  >
                    {form.cv ? (
                      <div className="flex items-center justify-center gap-2 text-sm font-bold text-primary-fixed">
                        <Check className="h-4 w-4" strokeWidth={2.5} />
                        Nguyen_Tuan_CV.pdf
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-3">
                        <FileText className="h-6 w-6 text-zinc-600" />
                        <div className="text-left">
                          <p className="text-sm font-semibold text-zinc-300">Nhấn để tải lên CV</p>
                          <p className="text-xs text-zinc-500">PDF, DOC (tối đa 5MB)</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-zinc-500">
                    Tải lên JD <span className="font-normal normal-case text-zinc-600">(khuyến khích)</span>
                  </label>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setForm({ ...form, jd: true })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setForm({ ...form, jd: true });
                    }}
                    className={`cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition-all ${
                      form.jd
                        ? "border-primary-fixed/60 bg-primary-fixed/10"
                        : "border-white/15 hover:border-violet-400/35 hover:bg-white/[0.04]"
                    }`}
                  >
                    {form.jd ? (
                      <div className="flex items-center justify-center gap-2 text-sm font-bold text-primary-fixed">
                        <Check className="h-4 w-4" strokeWidth={2.5} />
                        Shopee_JD.pdf
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-3">
                        <UploadSimple className="h-6 w-6 text-zinc-600" />
                        <div className="text-left">
                          <p className="text-sm font-semibold text-zinc-300">Nhấn để tải lên JD</p>
                          <p className="text-xs text-zinc-500">Giúp mentor chuẩn bị câu hỏi phù hợp hơn</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-zinc-500">Ghi chú (nếu có)</label>
                  <textarea
                    className={`${fieldClass} resize-none`}
                    rows={2}
                    placeholder="Yêu cầu đặc biệt, tập trung kỹ năng nào, ngôn ngữ phỏng vấn..."
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-4 lg:col-span-2">
                <div className="card-premium p-5">
                  <h2 className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Tóm tắt đặt lịch</h2>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="flex items-center gap-2 text-zinc-500">
                        <CalendarBlank className="h-3.5 w-3.5 text-zinc-600" />
                        Ngày
                      </span>
                      <span className="max-w-[55%] text-right font-semibold text-white">{selectedDayFull}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="flex items-center gap-2 text-zinc-500">
                        <Clock className="h-3.5 w-3.5 text-zinc-600" />
                        Giờ
                      </span>
                      <span className="font-semibold text-white">
                        {selectedTime} – {endTime}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="flex items-center gap-2 text-zinc-500">
                        <VideoCamera className="h-3.5 w-3.5 text-zinc-600" />
                        Hình thức
                      </span>
                      <span className="font-semibold text-white">Google Meet</span>
                    </div>
                    {form.cv && (
                      <div className="flex justify-between">
                        <span className="text-zinc-500">CV</span>
                        <span className="flex items-center gap-1 font-semibold text-primary-fixed">
                          <Check className="h-3 w-3" strokeWidth={3} />
                          Đã tải lên
                        </span>
                      </div>
                    )}
                    {form.jd && (
                      <div className="flex justify-between">
                        <span className="text-zinc-500">JD</span>
                        <span className="flex items-center gap-1 font-semibold text-primary-fixed">
                          <Check className="h-3 w-3" strokeWidth={3} />
                          Đã tải lên
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-white/10 pt-3">
                      <span className="font-bold text-white">Tổng tiền</span>
                      <span className="text-lg font-black text-primary-fixed">{mentor.price.toLocaleString("vi")}đ</span>
                    </div>
                  </div>
                </div>

                <div className="card-premium space-y-3 p-4">
                  <div className="flex gap-2.5">
                    <CurrencyCircleDollar className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                    <div>
                      <p className="mb-0.5 text-xs font-bold text-white">Hoàn tiền 100%</p>
                      <p className="text-xs text-zinc-500">Nếu mentor hủy hoặc bạn hủy trước 48h</p>
                    </div>
                  </div>
                  <div className="flex gap-2.5">
                    <ArrowsClockwise className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-fixed" />
                    <div>
                      <p className="mb-0.5 text-xs font-bold text-white">Đổi lịch miễn phí</p>
                      <p className="text-xs text-zinc-500">Thông báo trước 24h · 1 lần mỗi lần đặt lịch</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] px-4 py-3">
              <Bell className="h-4 w-4 flex-shrink-0 text-amber-300/90" />
              <p className="text-xs font-medium leading-relaxed text-amber-100/90">
                Bạn sẽ nhận email nhắc nhở trước 24 giờ và 1 giờ trước buổi phỏng vấn.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <ShieldCheck className="h-4 w-4 flex-shrink-0 text-primary-fixed" />
                Thanh toán bảo mật và mã hóa
              </div>
              <button
                type="button"
                disabled={!form.position || !form.cv}
                onClick={handleProceed}
                className={`ml-auto flex items-center gap-2 rounded-2xl px-8 py-4 text-sm font-black uppercase tracking-wide transition-all active:scale-[0.98] ${
                  form.position && form.cv
                    ? "bg-gradient-to-br from-[#6E35E8] to-[#8B4DFF] text-white shadow-[0_8px_28px_rgba(110,53,232,0.35)] hover:shadow-[0_12px_36px_rgba(110,53,232,0.45)]"
                    : "cursor-not-allowed bg-white/[0.06] text-zinc-600"
                }`}
              >
                Tiếp tục thanh toán — {mentor.price.toLocaleString("vi")}đ
                <CaretRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
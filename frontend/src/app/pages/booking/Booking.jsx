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
import { fetchMentor } from "../utils/mentorApi";
import { MENTORS } from "../data/mockData";
import { getSuggestedBookingData, getCVAnalysisHistory } from "../utils/history";

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
  const [mentor, setMentor] = useState(
    (MENTORS.find((m) => m.id === id) ?? MENTORS[0])
  );

  useEffect(() => {
    if (!id) return;
    fetchMentor(id).then((m) => { if (m) setMentor(m); });
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

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => (step === 1 ? navigate(-1) : setStep(1))}
        className="group flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm mb-6 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100 -ml-3"
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
        {step === 1 ? "Quay lại" : "Quay lại chọn lịch"}
      </button>

      {/* ── Step bar (2 steps) ──────────────────────────── */}
      <div className="flex items-center gap-0 mb-8 select-none">
        {[
          { n: 1, label: "Chọn lịch" },
          { n: 2, label: "Thông tin & Xác nhận" },
        ].map((s, i) => (
          <span key={s.n} style={{ display: "contents" }}>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                style={
                  step > s.n
                    ? { background: "#B4F000", color: "#1F1F1F" }
                    : step === s.n
                    ? { background: "linear-gradient(135deg, #6E35E8, #8B4DFF)", color: "#fff", boxShadow: "0 0 0 3px rgba(110, 53, 232,0.15)" }
                    : { background: "#E9EAEC", color: "#9CA3AF" }
                }
              >
                {step > s.n ? <Check className="w-4 h-4" /> : s.n}
              </div>
              <span
                className="text-sm font-medium hidden sm:block"
                style={{ color: step === s.n ? "#6E35E8" : step > s.n ? "#6B7280" : "#CBD5E1" }}
              >
                {s.label}
              </span>
            </div>
            {i < 1 && (
              <div
                className="flex-1 h-0.5 mx-3 rounded-full transition-all"
                style={{ background: step > s.n ? "#B4F000" : "#E9EAEC" }}
              />
            )}
          </span>
        ))}
      </div>

      {/* ── Mentor summary bar ─────────────────────────── */}
      <div
        className="rounded-2xl p-4 mb-6 flex items-center gap-4"
        style={{ background: "rgba(110, 53, 232,0.05)", border: "1px solid rgba(110, 53, 232,0.12)" }}
      >
        <img src={mentor.avatar} alt={mentor.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-gray-900 font-semibold text-sm">{mentor.name}</p>
          <p className="text-gray-500 text-xs">{mentor.title} · {mentor.company}</p>
        </div>
        <div className="ml-auto text-right flex-shrink-0">
          <p className="font-bold" style={{ color: "#6E35E8", fontSize: "1.1rem" }}>
            {mentor.price.toLocaleString("vi")}đ
          </p>
          <p className="text-gray-400 text-xs">/ 60 phút</p>
        </div>
      </div>

      {/* ══ STEP 1: Date & Time ══════════════════════════ */}
      {step === 1 && (
        <div className="space-y-4">

          {/* Calendar */}
          <div className="card-premium overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-3 border-b border-gray-100" style={{ background: "rgba(110, 53, 232,0.03)" }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(110, 53, 232,0.1)" }}>
                <CalendarBlank className="w-4 h-4" style={{ color: "#6E35E8" }} />
              </div>
              <div>
                <p className="font-semibold text-gray-900" style={{ fontSize: "0.9rem" }}>Chọn ngày phỏng vấn</p>
                <p className="text-gray-400" style={{ fontSize: "0.75rem" }}>Lịch trống của {mentor.name} — Tháng 2 & 3/2026</p>
              </div>
            </div>
            <div className="p-5 space-y-5">
              {WEEKS.map((week) => (
                <div key={week.label}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{week.label}</p>
                  <div className="grid grid-cols-7 gap-2">
                    {week.days.map((d) => {
                      const isSelected = selectedDay === d.date;
                      const bookedCount = (BOOKED[d.date] ?? []).length;
                      const freeSlots = TIME_GROUPS.flatMap((g) => g.slots).length - bookedCount;
                      return (
                        <button
                          key={d.date}
                          disabled={!d.available}
                          onClick={() => { setSelectedDay(d.date); setSelectedDayFull(d.full); setSelectedTime(null); }}
                          className="flex flex-col items-center py-3 rounded-xl transition-all"
                          style={
                            isSelected
                              ? { background: "linear-gradient(135deg, #6E35E8, #8B4DFF)", boxShadow: "0 4px 14px rgba(110, 53, 232,0.3)" }
                              : d.available
                              ? { background: "#F8F9FA", border: "1px solid #EDEEF0", cursor: "pointer" }
                              : { background: "rgba(255,255,255,0.06)", opacity: 0.45, cursor: "not-allowed" }
                          }
                          onMouseEnter={(e) => { if (!isSelected && d.available) (e.currentTarget).style.borderColor = "rgba(110, 53, 232,0.35)"; }}
                          onMouseLeave={(e) => { if (!isSelected && d.available) (e.currentTarget).style.borderColor = "#EDEEF0"; }}
                        >
                          <span className="text-xs mb-1" style={{ color: isSelected ? "rgba(255,255,255,0.7)" : "#9CA3AF" }}>{d.day}</span>
                          <span className="font-bold" style={{ fontSize: "0.95rem", color: isSelected ? "#fff" : d.available ? "#1F1F1F" : "#9CA3AF" }}>
                            {d.date.split("/")[0]}
                          </span>
                          {d.available && (
                            <span
                              className="mt-1 text-xs rounded-full px-1.5"
                              style={{
                                fontSize: "0.6rem",
                                color: isSelected ? "rgba(255,255,255,0.75)" : freeSlots <= 3 ? "#CC5C00" : "#4A7A00",
                                background: isSelected ? "rgba(255,255,255,0.15)" : freeSlots <= 3 ? "rgba(255,140,66,0.12)" : "rgba(180,240,0,0.15)",
                              }}
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
              <div className="flex items-center gap-5 pt-2 border-t border-gray-50">
                <div className="flex items-center gap-1.5 text-xs text-gray-400"><div className="w-3 h-3 rounded-full" style={{ background: "linear-gradient(135deg, #6E35E8, #8B4DFF)" }} />Đã chọn</div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400"><div className="w-3 h-3 rounded-full bg-gray-200" />Không khả dụng</div>
                <div className="flex items-center gap-1.5 text-xs" style={{ color: "#CC5C00" }}><div className="w-3 h-3 rounded-full" style={{ background: "rgba(255,140,66,0.3)" }} />Còn ít chỗ</div>
              </div>
            </div>
          </div>

          {/* Time slots */}
          {selectedDay ? (
            <div className="card-premium overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-3 border-b border-gray-100" style={{ background: "rgba(110, 53, 232,0.03)" }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(110, 53, 232,0.1)" }}>
                  <Clock className="w-4 h-4" style={{ color: "#6E35E8" }} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900" style={{ fontSize: "0.9rem" }}>Chọn khung giờ</p>
                  <p className="text-gray-400" style={{ fontSize: "0.75rem" }}>{selectedDayFull} · {availableSlotCount} khung giờ trống</p>
                </div>
                <div className="ml-auto flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full" style={{ background: "rgba(180,240,0,0.12)", color: "#4A7A00" }}>
                  <Timer className="w-3.5 h-3.5" />60 phút / buổi
                </div>
              </div>
              <div className="p-5 space-y-5">
                {TIME_GROUPS.map((group) => (
                  <div key={group.label}>
                    <div className="flex items-center gap-2 mb-3">
                      <group.icon className="w-3.5 h-3.5 text-gray-400" />
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{group.label}</p>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {group.slots.map((time) => {
                        const booked = isSlotBooked(time);
                        const selected = selectedTime === time;
                        return (
                          <button
                            key={time}
                            disabled={booked}
                            onClick={() => setSelectedTime(time)}
                            className="py-3 rounded-xl transition-all text-sm font-medium relative"
                            style={
                              selected
                                ? { background: "linear-gradient(135deg, #6E35E8, #8B4DFF)", color: "#fff", boxShadow: "0 4px 12px rgba(110, 53, 232,0.3)", border: "none" }
                                : booked
                                ? { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)", cursor: "not-allowed", border: "1px solid rgba(255,255,255,0.08)" }
                                : { background: "#fff", color: "#1F1F1F", border: "1.5px solid #E5E7EB" }
                            }
                            onMouseEnter={(e) => { if (!selected && !booked) { (e.currentTarget).style.borderColor = "rgba(110, 53, 232,0.4)"; (e.currentTarget).style.color = "#6E35E8"; } }}
                            onMouseLeave={(e) => { if (!selected && !booked) { (e.currentTarget).style.borderColor = "#E5E7EB"; (e.currentTarget).style.color = "#1F1F1F"; } }}
                          >
                            {time}
                            {booked && <span className="absolute -top-1.5 -right-1.5 text-xs bg-gray-200 text-gray-400 px-1 rounded-full" style={{ fontSize: "0.55rem" }}>Hết</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {selectedTime && (
                  <div className="rounded-xl p-4 flex items-center gap-3 mt-2" style={{ background: "rgba(110, 53, 232,0.05)", border: "1px solid rgba(110, 53, 232,0.12)" }}>
                    <Check className="w-5 h-5 flex-shrink-0" style={{ color: "#6E35E8" }} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#6E35E8" }}>Lịch đã chọn: {selectedDayFull} lúc {selectedTime}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Buổi phỏng vấn kết thúc lúc {endTime} · Google Meet link gửi qua email</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2 text-xs text-gray-400 pt-1">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>Múi giờ: <strong className="text-gray-500">Việt Nam (UTC+7)</strong> · Khung giờ được giữ trong 15 phút sau khi tiếp tục.</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-5 flex items-center gap-3 text-sm" style={{ background: "#F8F9FA", border: "1.5px dashed #DDDFE3" }}>
              <Clock className="w-5 h-5 text-gray-300 flex-shrink-0" />
              <p className="text-gray-400">Chọn ngày để xem các khung giờ trống khả dụng</p>
            </div>
          )}

          {/* CTA */}
          <button
            disabled={!selectedDay || !selectedTime}
            onClick={() => setStep(2)}
            className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={
              selectedDay && selectedTime
                ? { background: "linear-gradient(135deg, #6E35E8, #8B4DFF)", color: "#fff", boxShadow: "0 6px 20px rgba(110, 53, 232,0.3)" }
                : { background: "#F0F1F3", color: "#9CA3AF", cursor: "not-allowed" }
            }
            onMouseEnter={(e) => { if (selectedDay && selectedTime) (e.currentTarget).style.boxShadow = "0 10px 28px rgba(110, 53, 232,0.4)"; }}
            onMouseLeave={(e) => { if (selectedDay && selectedTime) (e.currentTarget).style.boxShadow = "0 6px 20px rgba(110, 53, 232,0.3)"; }}
          >
            {selectedDay && selectedTime
              ? <>Tiếp tục — Thông tin & Xác nhận <CaretRight className="w-4 h-4" /></>
              : "Vui lòng chọn ngày và giờ"}
          </button>
        </div>
      )}

      {/* ══ STEP 2: Info + Confirm (merged) ══════════════ */}
      {step === 2 && (
        <div className="space-y-5">

          {/* Schedule reminder chip */}
          <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: "rgba(110, 53, 232,0.05)", border: "1px solid rgba(110, 53, 232,0.12)" }}>
            <CalendarBlank className="w-4 h-4 flex-shrink-0" style={{ color: "#6E35E8" }} />
            <p className="text-sm font-medium" style={{ color: "#6E35E8" }}>
              {selectedDayFull} · {selectedTime} – {endTime}
            </p>
            <button
              onClick={() => setStep(1)}
              className="ml-auto text-xs font-medium px-3 py-1 rounded-lg hover:bg-[#6E35E8]/10 transition-colors"
              style={{ color: "#6E35E8" }}
            >
              Đổi lịch
            </button>
          </div>

          {/* Smart auto-fill banner */}
          {showSmartBanner && suggestedData && (
            <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: "linear-gradient(135deg, rgba(180,240,0,0.08), rgba(110, 53, 232,0.04))", border: "1.5px solid rgba(180,240,0,0.3)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(180,240,0,0.15)" }}>
                <Sparkle className="w-5 h-5" style={{ color: "#6E9900" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm mb-1" style={{ color: "#4A7A00" }}>💡 Tự động điền từ phân tích CV/JD gần nhất</p>
                <p className="text-xs mb-2" style={{ color: "#6E9900" }}>
                  Đã phân tích <strong>{suggestedData.position}</strong>. Điền nhanh để tiết kiệm thời gian?
                </p>
                <div className="flex gap-2">
                  <button onClick={handleUseSmartFill} className="px-4 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: "linear-gradient(135deg, #6E35E8, #8B4DFF)" }}>✨ Dùng ngay</button>
                  <button onClick={() => setShowSmartBanner(false)} className="px-4 py-1.5 rounded-lg text-xs font-medium text-gray-500">Bỏ qua</button>
                </div>
              </div>
              <button onClick={() => setShowSmartBanner(false)} className="flex-shrink-0 w-6 h-6 rounded-lg hover:bg-black/5 flex items-center justify-center"><X className="w-4 h-4 text-gray-400" /></button>
            </div>
          )}

          {/* Info form + Order summary side by side on large screens */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

            {/* Left: form */}
            <div className="lg:col-span-3 card-premium p-5 space-y-5">
              <div>
                <label className="block text-gray-700 text-xs font-semibold mb-2">Vị trí đang ứng tuyển *</label>
                <input
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#6E35E8]/50 bg-gray-50 focus:bg-white transition-all"
                  placeholder="Ví dụ: Frontend Developer tại Shopee"
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-gray-700 text-xs font-semibold mb-2">Tải lên CV <span className="text-gray-400 font-normal">(bắt buộc)</span></label>
                <div
                  onClick={() => setForm({ ...form, cv: true })}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${form.cv ? "" : "border-gray-200 hover:border-[#6E35E8]/40 hover:bg-[#6E35E8]/5"}`}
                  style={form.cv ? { borderColor: "#B4F000", background: "rgba(180,240,0,0.06)" } : {}}
                >
                  {form.cv ? (
                    <div className="flex items-center justify-center gap-2" style={{ color: "#4A7A00" }}>
                      <Check className="w-4 h-4" />
                      <span className="text-sm font-medium">Nguyen_Tuan_CV.pdf</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="w-6 h-6 text-gray-300" />
                      <div className="text-left">
                        <p className="text-gray-500 text-sm">Nhấn để tải lên CV</p>
                        <p className="text-gray-400 text-xs">PDF, DOC (tối đa 5MB)</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-gray-700 text-xs font-semibold mb-2">Tải lên JD <span className="text-gray-400 font-normal">(khuyến khích)</span></label>
                <div
                  onClick={() => setForm({ ...form, jd: true })}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${form.jd ? "" : "border-gray-200 hover:border-[#8B4DFF]/40 hover:bg-[#6E35E8]/5"}`}
                  style={form.jd ? { borderColor: "#B4F000", background: "rgba(180,240,0,0.06)" } : {}}
                >
                  {form.jd ? (
                    <div className="flex items-center justify-center gap-2" style={{ color: "#4A7A00" }}>
                      <Check className="w-4 h-4" />
                      <span className="text-sm font-medium">Shopee_JD.pdf</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <UploadSimple className="w-6 h-6 text-gray-300" />
                      <div className="text-left">
                        <p className="text-gray-500 text-sm">Nhấn để tải lên JD</p>
                        <p className="text-gray-400 text-xs">Giúp mentor chuẩn bị câu hỏi phù hợp hơn</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-gray-700 text-xs font-semibold mb-2">Ghi chú (nếu có)</label>
                <textarea
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#6E35E8]/50 bg-gray-50 focus:bg-white transition-all resize-none"
                  rows={2}
                  placeholder="Yêu cầu đặc biệt, tập trung kỹ năng nào, ngôn ngữ phỏng vấn..."
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </div>
            </div>

            {/* Right: order summary */}
            <div className="lg:col-span-2 space-y-4">
              <div className="card-premium p-5">
                <h2 className="text-gray-800 font-semibold mb-4 text-sm">Tóm tắt đặt lịch</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 flex items-center gap-2"><CalendarBlank className="w-3.5 h-3.5" />Ngày</span>
                    <span className="text-gray-800 font-medium text-right">{selectedDayFull}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 flex items-center gap-2"><Clock className="w-3.5 h-3.5" />Giờ</span>
                    <span className="text-gray-800 font-medium">{selectedTime} – {endTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 flex items-center gap-2"><VideoCamera className="w-3.5 h-3.5" />Hình thức</span>
                    <span className="text-gray-800 font-medium">Google Meet</span>
                  </div>
                  {form.cv && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">CV</span>
                      <span className="text-gray-800 font-medium flex items-center gap-1"><Check className="w-3 h-3" style={{ color: "#4A7A00" }} />Đã tải lên</span>
                    </div>
                  )}
                  {form.jd && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">JD</span>
                      <span className="text-gray-800 font-medium flex items-center gap-1"><Check className="w-3 h-3" style={{ color: "#4A7A00" }} />Đã tải lên</span>
                    </div>
                  )}
                  <div className="border-t border-gray-100 pt-3 flex justify-between">
                    <span className="text-gray-800 font-semibold">Tổng tiền</span>
                    <span className="font-bold" style={{ color: "#6E35E8" }}>{mentor.price.toLocaleString("vi")}đ</span>
                  </div>
                </div>
              </div>

              {/* Policies — compact */}
              <div className="card-premium p-4 space-y-3">
                <div className="flex gap-2.5">
                  <CurrencyCircleDollar className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#10b981" }} />
                  <div>
                    <p className="text-gray-700 font-medium text-xs mb-0.5">Hoàn tiền 100%</p>
                    <p className="text-xs text-gray-400">Nếu mentor hủy hoặc bạn hủy trước 48h</p>
                  </div>
                </div>
                <div className="flex gap-2.5">
                  <ArrowsClockwise className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#6E35E8" }} />
                  <div>
                    <p className="text-gray-700 font-medium text-xs mb-0.5">Đổi lịch miễn phí</p>
                    <p className="text-xs text-gray-400">Thông báo trước 24h · 1 lần mỗi lần đặt lịch</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notification note */}
          <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: "rgba(255,214,0,0.08)", border: "1px solid rgba(255,214,0,0.25)" }}>
            <Bell className="w-4 h-4 flex-shrink-0" style={{ color: "#997F00" }} />
            <p className="text-xs" style={{ color: "#997F00" }}>Bạn sẽ nhận email nhắc nhở trước 24 giờ và 1 giờ trước buổi phỏng vấn.</p>
          </div>

          {/* CTA */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 flex-shrink-0" style={{ color: "#6E35E8" }} />
              <p className="text-gray-400 text-xs">Thanh toán bảo mật & mã hóa</p>
            </div>
            <button
              disabled={!form.position || !form.cv}
              onClick={handleProceed}
              className="ml-auto flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-sm transition-all active:scale-[0.98]"
              style={
                form.position && form.cv
                  ? { background: "linear-gradient(135deg, #6E35E8, #8B4DFF)", color: "#fff", boxShadow: "0 6px 20px rgba(110, 53, 232,0.3)" }
                  : { background: "#F0F1F3", color: "#9CA3AF", cursor: "not-allowed" }
              }
              onMouseEnter={(e) => { if (form.position && form.cv) (e.currentTarget).style.boxShadow = "0 10px 28px rgba(110, 53, 232,0.4)"; }}
              onMouseLeave={(e) => { if (form.position && form.cv) (e.currentTarget).style.boxShadow = "0 6px 20px rgba(110, 53, 232,0.3)"; }}
            >
              Tiếp tục thanh toán — {mentor.price.toLocaleString("vi")}đ
              <CaretRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
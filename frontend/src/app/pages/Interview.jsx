import React, { useState } from "react";
import { useNavigate } from "react-router";
import {
  Upload,
  FileText,
  ChevronDown,
  ChevronRight,
  Check,
  Building2,
  BriefcaseBusiness,
  LayoutGrid,
  Layers,
  Users,
  Brain,
  Timer,
  BarChart3,
  Sparkles,
  ArrowRight,
  BadgeCheck,
  Video,
  Mic,
  FileText as FilePdf,
  X,
  MessageSquare,
  TrendingUp,
  Lightbulb,
} from "lucide-react";
import { getLatestCVAnalysis, getUploadedCV, saveUploadedCV } from "../utils/history";

const LEVELS = ["Thực tập sinh", "Mới ra trường", "Junior", "Trung cấp", "Senior"];
const FIELDS_LIST = [
  "IT / Công nghệ", "Marketing", "Finance", "HR",
  "Product", "Design", "Sales", "Operations",
];

/* ── Palette ─────────────────────────────────────────────── */
const P = {
  purple: "#6E35E8",
  purpleAlt: "#8B4DFF",
  lime: "#B4F000",
  gold: "#FFD600",
  orange: "#FF8C42",
  bg: "#F4F5F7",
  card: "#FFFFFF",
  text: "#1F1F1F",
  muted: "#6B7280",
  border: "rgba(0,0,0,0.08)",
};

/* ── Step bar ────────────────────────────────────────────── */
const STEPS = [
  { n: 1, label: "Thiết lập" },
  { n: 2, label: "Phỏng vấn" },
  { n: 3, label: "Kết quả" },
];

function StepBar({ current = 1 }) {
  return (
    <div className="flex items-center gap-0 mb-8 select-none">
      {STEPS.map((s, i) => (
        <span key={s.n} style={{ display: "contents" }}>
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
              style={
                s.n === current
                  ? {
                    background: `linear-gradient(135deg, ${P.purple}, ${P.purpleAlt})`,
                    color: "#fff",
                    boxShadow: `0 0 0 3px rgba(110, 53, 232,0.15)`,
                  }
                  : s.n < current
                    ? { background: P.lime, color: P.text }
                    : { background: "#E9EAEC", color: "#9CA3AF" }
              }
            >
              {s.n < current ? <Check strokeWidth={3} className="w-3.5 h-3.5" /> : s.n}
            </div>
            <span
              className="text-sm font-medium"
              style={{
                color:
                  s.n === current ? P.purple : s.n < current ? P.muted : "#CBD5E1",
              }}
            >
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className="flex-1 h-0.5 mx-3 rounded-full"
              style={{ background: s.n < current ? P.lime : "#E9EAEC" }}
            />
          )}
        </span>
      ))}
    </div>
  );
}

/* ── Preview items ──────────────────────────────────────── */
const PREVIEW_ITEMS = [
  { icon: Brain, color: P.purple, title: "5 câu hỏi cá nhân hóa", desc: "AI tạo câu hỏi dựa trên JD & CV của bạn" },
  { icon: Video, color: P.purpleAlt, title: "Phân tích hành vi theo thời gian thực", desc: "AI đánh giá ánh mắt, biểu cảm, ngôn ngữ cơ thể" },
  { icon: BarChart3, color: P.orange, title: "Phân tích lời nói & diễn đạt", desc: "Nội dung STAR, tốc độ nói, từ đệm" },
  { icon: BadgeCheck, color: P.gold, title: "Phản hồi chi tiết từng câu", desc: "Điểm số + gợi ý câu trả lời mẫu tốt hơn" },
];

/* ── Shared input style ──────────────────────────────────── */
const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1.5px solid #E5E7EB",
  background: "#FAFAFA",
  color: P.text,
  fontSize: "0.875rem",
  outline: "none",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

function FInput({
  placeholder,
  value,
  onChange,
}) {
  const [focus, setFocus] = useState(false);
  return (
    <input
      style={{
        ...inputStyle,
        borderColor: focus ? P.purple : "#E5E7EB",
        boxShadow: focus ? `0 0 0 3px rgba(110, 53, 232,0.1)` : "none",
        background: focus ? "#fff" : "#FAFAFA",
      }}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
    />
  );
}

/* ── Interview page ──────────────────────────────────────── */
export function Interview() {
  const navigate = useNavigate();

  const [option, setOption] = useState(null);
  const [inputMethod, setInputMethod] = useState(null);
  const [cvUploaded, setCvUploaded] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [form, setForm] = useState({ company: "", position: "", field: "", level: "" });
  const [fieldOpen, setFieldOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);

  // Check if user has previous CV analysis
  const latestCV = getLatestCVAnalysis();
  const storedCV = getUploadedCV();

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setCvUploaded(true);
      saveUploadedCV({ name: file.name, size: file.size, type: file.type });
    }
  };

  const canStart =
    option === "A" ||
    (option === "B" &&
      ((inputMethod === "cv" && cvUploaded) ||
        (inputMethod === "form" &&
          form.company && form.position && form.field && form.level)));

  const handleStart = () => {
    if (!canStart) return;

    // Prepare interview data
    const interviewData = {
      option,
      inputMethod,
      ...(option === "A" && { useLatestAnalysis: true, latestCV }),
      ...(option === "B" && inputMethod === "cv" && { uploadedFile, storedCV }),
      ...(option === "B" && inputMethod === "form" && { form }),
    };

    // Navigate to gender selection
    navigate("/interview/gender", { state: interviewData });
  };

  return (
    <div className="min-h-screen" style={{ background: "#F4F5F7" }}>
      {/* ── Hero Banner ─────────────────────────────────── */}
      <div
        className="relative overflow-hidden border-b border-white/5 bg-background"
        style={{
          background:
            "linear-gradient(145deg, #0E0922 0%, #1a0d35 100%)",
        }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-20 -left-20 w-80 h-80 bg-white rounded-full blur-3xl" />
          <div className="absolute top-20 right-10 w-96 h-96 bg-[#B4F000] rounded-full blur-3xl" />
        </div>

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.05]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)",
          backgroundSize: "40px 40px"
        }} />
        <div className="relative max-w-7xl mx-auto px-6 py-16 text-left">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="text-primary-fixed size-5" />
              <span className="text-secondary font-bold uppercase tracking-[0.2em] text-xs">AI INTERVIEW CHAMBER</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter leading-none text-white mb-4 whitespace-nowrap">
              Thiết lập <span className="text-primary-fixed">Phỏng vấn AI.</span>
            </h1>
            <p className="text-lg text-zinc-400 leading-relaxed mb-4 max-w-2xl">
              Khởi động không gian phỏng vấn mô phỏng. Cung cấp thông tin để AI tối ưu hóa bộ câu hỏi cá nhân hoá dành riêng cho bạn.
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-3xl mx-auto relative z-10">

        <StepBar current={1} />

        {/* ── Step 1: Source ─────────────────────────────────── */}
        <div
          className="rounded-2xl p-6 mb-4"
          style={{ background: P.card, border: `1px solid ${P.border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
        >
          {/* Section title */}
          <div className="flex items-center gap-2.5 mb-5">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: `linear-gradient(135deg, ${P.purple}, ${P.purpleAlt})`, color: "#fff" }}
            >
              1
            </div>
            <h2 className="font-semibold text-sm" style={{ color: P.text }}>
              Chọn nguồn thông tin
            </h2>
          </div>

          {/* Option cards */}
          <div className="grid sm:grid-cols-2 gap-4 mb-5">
            {/* Option A */}
            <button
              onClick={() => { setOption("A"); setInputMethod(null); }}
              className="relative p-4 rounded-2xl text-left transition-all"
              style={{
                border: option === "A" ? `2px solid ${P.purple}` : "2px solid #E9EAEC",
                background: option === "A" ? "rgba(110, 53, 232,0.04)" : "#FAFAFA",
              }}
            >
              {option === "A" && (
                <div
                  className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: P.purple }}
                >
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: "rgba(180,240,0,0.1)", border: "1px solid rgba(180,240,0,0.2)" }}
              >
                <Check className="w-5 h-5" style={{ color: "#6E9900" }} />
              </div>
              <p className="font-semibold text-sm mb-1" style={{ color: P.text }}>
                Dùng CV/JD đã phân tích
              </p>
              <p className="text-xs leading-relaxed" style={{ color: P.muted }}>
                Sử dụng từ phiên phân tích CV/JD trước — AI hiểu rõ bạn nhất
              </p>
            </button>

            {/* Option B */}
            <button
              onClick={() => { setOption("B"); setInputMethod(null); }}
              className="relative p-4 rounded-2xl text-left transition-all"
              style={{
                border: option === "B" ? `2px solid ${P.purple}` : "2px solid #E9EAEC",
                background: option === "B" ? "rgba(110, 53, 232,0.04)" : "#FAFAFA",
              }}
            >
              {option === "B" && (
                <div
                  className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: P.purple }}
                >
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: "rgba(110, 53, 232,0.08)", border: `1px solid rgba(110, 53, 232,0.18)` }}
              >
                <Upload className="w-5 h-5" style={{ color: P.purple }} />
              </div>
              <p className="font-semibold text-sm mb-1" style={{ color: P.text }}>
                Upload mới / Nhập thông tin
              </p>
              <p className="text-xs leading-relaxed" style={{ color: P.muted }}>
                Upload CV hoặc điền thông tin công ty và vị trí ứng tuyển
              </p>
            </button>
          </div>

          {/* Option B: sub-options */}
          {option === "B" && (
            <div>
              {/* Tabs */}
              <div className="flex gap-2 mb-4">
                {([
                  { id: "cv", icon: Upload, label: "Tải lên CV" },
                  { id: "form", icon: Upload, label: "Điền thông tin" },
                ]).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setInputMethod(t.id)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                    style={
                      inputMethod === t.id
                        ? {
                          border: `1.5px solid ${P.purple}`,
                          background: "rgba(110, 53, 232,0.06)",
                          color: P.purple,
                        }
                        : {
                          border: "1.5px solid #E9EAEC",
                          background: "#FAFAFA",
                          color: P.muted,
                        }
                    }
                  >
                    <t.icon className="w-4 h-4" />
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Upload CV */}
              {inputMethod === "cv" && (
                <div
                  onClick={() => setCvUploaded(true)}
                  className="rounded-2xl p-8 text-center cursor-pointer transition-all"
                  style={{
                    border: cvUploaded
                      ? `2px dashed ${P.lime}`
                      : "2px dashed #D1D5DB",
                    background: cvUploaded ? "rgba(180,240,0,0.04)" : "#FAFAFA",
                  }}
                >
                  {cvUploaded ? (
                    <div className="flex flex-col items-center">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                        style={{ background: "rgba(180,240,0,0.12)" }}
                      >
                        <Check className="w-6 h-6" style={{ color: "#65A300" }} />
                      </div>
                      <p className="font-semibold text-sm" style={{ color: "#4A7A00" }}>
                        CV đã được tải lên thành công
                      </p>
                      <p className="text-xs mt-1" style={{ color: "#7AAA00" }}>
                        {uploadedFile?.name} · {uploadedFile?.size} MB
                      </p>
                      <button
                        onClick={(e) => { e.stopPropagation(); setCvUploaded(false); }}
                        className="mt-3 text-xs underline"
                        style={{ color: P.muted }}
                      >
                        Tải lại
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                        style={{ background: "#F0F1F3" }}
                      >
                        <Layers className="w-6 h-6 text-[#6E35E8]" strokeWidth={2} />
                      </div>
                      <p className="font-semibold text-sm" style={{ color: P.text }}>
                        Kéo & thả CV hoặc click để chọn
                      </p>
                      <p className="text-xs mt-1" style={{ color: P.muted }}>
                        PDF, DOC, DOCX · Tối đa 5 MB
                      </p>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        className="absolute top-0 left-0 right-0 bottom-0 opacity-0 cursor-pointer"
                        onChange={handleFileUpload}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Fill form */}
              {inputMethod === "form" && (
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Company */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: P.muted }}>
                      <Building2 className="w-3.5 h-3.5" /> Tên công ty
                    </label>
                    <FInput
                      placeholder="Shopee, Vingroup, FPT..."
                      value={form.company}
                      onChange={(v) => setForm({ ...form, company: v })}
                    />
                  </div>

                  {/* Position */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: P.muted }}>
                      <BriefcaseBusiness className="w-3.5 h-3.5" /> Vị trí ứng tuyển
                    </label>
                    <FInput
                      placeholder="Frontend Developer..."
                      value={form.position}
                      onChange={(v) => setForm({ ...form, position: v })}
                    />
                  </div>

                  {/* Field dropdown */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: P.muted }}>
                      <LayoutGrid className="w-3.5 h-3.5" /> Lĩnh vực / Ngành nghề
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => { setFieldOpen(!fieldOpen); setLevelOpen(false); }}
                        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all focus:outline-none"
                        style={{
                          border: fieldOpen ? `1.5px solid ${P.purple}` : "1.5px solid #E5E7EB",
                          background: "#FAFAFA",
                          color: form.field ? P.text : "#9CA3AF",
                          boxShadow: fieldOpen ? `0 0 0 3px rgba(110, 53, 232,0.1)` : "none",
                        }}
                      >
                        <span>{form.field || "Chọn ngành..."}</span>
                        <ChevronDown
                          className="w-4 h-4 text-gray-400 transition-transform"
                          style={{ transform: fieldOpen ? "rotate(180deg)" : "none" }}
                        />
                      </button>
                      {fieldOpen && (
                        <div
                          className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-20 card-premium animate-fade-in" style={{ border: "1px solid #E9EAEC" }}
                        >
                          {FIELDS_LIST.map((f) => (
                            <button
                              key={f}
                              onClick={() => { setForm({ ...form, field: f }); setFieldOpen(false); }}
                              className="w-full text-left px-4 py-2.5 text-sm transition-colors"
                              style={{ color: P.text }}
                              onMouseEnter={(e) => {
                                (e.currentTarget).style.background = "rgba(110, 53, 232,0.05)";
                                (e.currentTarget).style.color = P.purple;
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget).style.background = "transparent";
                                (e.currentTarget).style.color = P.text;
                              }}
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Level dropdown */}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: P.muted }}>
                      <Users className="w-3.5 h-3.5" /> Level kinh nghiệm
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => { setLevelOpen(!levelOpen); setFieldOpen(false); }}
                        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all focus:outline-none"
                        style={{
                          border: levelOpen ? `1.5px solid ${P.purple}` : "1.5px solid #E5E7EB",
                          background: "#FAFAFA",
                          color: form.level ? P.text : "#9CA3AF",
                          boxShadow: levelOpen ? `0 0 0 3px rgba(110, 53, 232,0.1)` : "none",
                        }}
                      >
                        <span>{form.level || "Chọn level..."}</span>
                        <ChevronDown
                          className="w-4 h-4 text-gray-400 transition-transform"
                          style={{ transform: levelOpen ? "rotate(180deg)" : "none" }}
                        />
                      </button>
                      {levelOpen && (
                        <div
                          className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-20 card-premium animate-fade-in" style={{ border: "1px solid #E9EAEC" }}
                        >
                          {LEVELS.map((l) => (
                            <button
                              key={l}
                              onClick={() => { setForm({ ...form, level: l }); setLevelOpen(false); }}
                              className="w-full text-left px-4 py-2.5 text-sm transition-colors"
                              style={{ color: P.text }}
                              onMouseEnter={(e) => {
                                (e.currentTarget).style.background = "rgba(110, 53, 232,0.05)";
                                (e.currentTarget).style.color = P.purple;
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget).style.background = "transparent";
                                (e.currentTarget).style.color = P.text;
                              }}
                            >
                              {l}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Preview: what will happen ───────────────────────── */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{ background: P.card, border: `1px solid ${P.border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
        >
          <div className="flex items-center gap-2.5 mb-4">
            <Timer className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-sm" style={{ color: P.text }}>
              Những gì sẽ xảy ra trong buổi phỏng vấn
            </h2>
            <span className="ml-auto text-xs" style={{ color: P.muted }}>~30–45 phút</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {PREVIEW_ITEMS.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3.5 rounded-xl transition-all"
                style={{ background: "#F8F9FA", border: "1px solid #EDEEF0" }}
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${item.color}15`, border: `1px solid ${item.color}25` }}
                >
                  <item.icon className="w-4 h-4" style={{ color: item.color }} strokeWidth={2} />
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: P.text }}>{item.title}</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: P.muted }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Process flow */}
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid #EDEEF0" }}>
            <p className="text-xs font-semibold mb-2.5" style={{ color: "#9CA3AF" }}>
              Quy trình buổi phỏng vấn
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {["AI giới thiệu", "→", "AI đặt câu hỏi", "→", "Bạn trả lời", "→", "AI hỏi thêm", "→", "Nhận kết quả"].map(
                (step, i) =>
                  step === "→" ? (
                    <ArrowRight key={i} className="w-3 h-3 text-gray-300" strokeWidth={3} />
                  ) : (
                    <span
                      key={i}
                      className="text-xs font-medium px-2.5 py-1 rounded-lg"
                      style={{ color: "#4B5563", background: "#F0F1F3", border: "1px solid #E5E7EB" }}
                    >
                      {step}
                    </span>
                  )
              )}
            </div>
          </div>
        </div>

        {/* ── CTA button ─────────────────────────────────────── */}
        <button
          onClick={handleStart}
          disabled={!canStart}
          className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-semibold text-sm transition-all"
          style={
            canStart
              ? {
                background: `linear-gradient(135deg, ${P.purple} 0%, ${P.purpleAlt} 100%)`,
                color: "#fff",
                boxShadow: "0 6px 20px rgba(110, 53, 232,0.35)",
              }
              : {
                background: "#F0F1F3",
                color: "#9CA3AF",
                cursor: "not-allowed",
                border: "1px solid #E5E7EB",
              }
          }
        >
          <Mic className="w-5 h-5" strokeWidth={2.5} />
          {canStart ? "Bắt đầu Phỏng vấn AI →" : "Hoàn tất các bước trên để bắt đầu"}
        </button>

        {!canStart && (
          <p className="text-center text-xs mt-3" style={{ color: P.muted }}>
            Vui lòng chọn nguồn thông tin để tiếp tục
          </p>
        )}
      </div>
    </div>
  );
}
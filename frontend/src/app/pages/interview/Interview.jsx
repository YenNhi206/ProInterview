import React, { useState } from "react";
import { useNavigate } from "react-router";
import {
  Upload,
  ChevronDown,
  Check,
  Building2,
  BriefcaseBusiness,
  LayoutGrid,
  Users,
  Brain,
  Timer,
  BarChart3,
  Sparkles,
  ArrowRight,
  BadgeCheck,
  Video,
  Mic,
  FileCheck,
  CloudUpload,
  FileStack,
} from "lucide-react";
import { getLatestCVAnalysis, getUploadedCV, saveUploadedCV } from "../../utils/history";

const LEVELS = ["Thực tập sinh", "Mới ra trường", "Junior", "Trung cấp", "Senior"];
const FIELDS_LIST = [
  "IT / Công nghệ", "Marketing", "Finance", "HR",
  "Product", "Design", "Sales", "Operations",
];

/** Stroke Lucide chuẩn UI — đồng bộ toàn trang */
const IS = { strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" };

const PREVIEW_ITEMS = [
  { icon: Brain, color: "#a78bfa", title: "5 câu hỏi cá nhân hóa", desc: "AI tạo câu hỏi dựa trên JD & CV của bạn" },
  { icon: Video, color: "#c4b5fd", title: "Phân tích hành vi theo thời gian thực", desc: "AI đánh giá ánh mắt, biểu cảm, ngôn ngữ cơ thể" },
  { icon: BarChart3, color: "#fb923c", title: "Phân tích lời nói & diễn đạt", desc: "Nội dung STAR, tốc độ nói, từ đệm" },
  { icon: BadgeCheck, color: "#fbbf24", title: "Phản hồi chi tiết từng câu", desc: "Điểm số + gợi ý câu trả lời mẫu tốt hơn" },
];

/** Khung icon — cùng họ glass như Dashboard metric */
function IconFrame({ size = "md", tone = "neutral", className = "", children }) {
  const sz = size === "sm" ? "h-9 w-9" : size === "lg" ? "h-14 w-14" : "h-11 w-11";
  const tones = {
    neutral:
      "border-white/12 bg-gradient-to-br from-white/[0.11] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]",
    lime: "border-[#c4ff47]/28 bg-gradient-to-br from-[#c4ff47]/14 to-[#c4ff47]/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
    violet:
      "border-violet-400/25 bg-gradient-to-br from-violet-500/18 to-violet-900/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
    fuchsia:
      "border-fuchsia-400/22 bg-gradient-to-br from-fuchsia-500/14 to-violet-900/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
  };
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl border ${sz} ${tones[tone]} ${className}`}
      aria-hidden
    >
      {children}
    </div>
  );
}

function StepBar({ current = 1 }) {
  const steps = [
    { n: 1, label: "Thiết lập" },
    { n: 2, label: "Phỏng vấn" },
    { n: 3, label: "Kết quả" },
  ];
  return (
    <div className="mb-10 flex select-none flex-wrap items-center gap-0">
      {steps.map((s, i) => (
        <span key={s.n} className="contents">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                s.n === current
                  ? "bg-gradient-to-br from-[#6E35E8] to-[#8B4DFF] text-white shadow-[0_0_0_3px_rgba(110,53,232,0.2)]"
                  : s.n < current
                    ? "bg-[#c4ff47] text-[#0a0814]"
                    : "border border-white/15 bg-white/[0.06] text-zinc-500"
              }`}
            >
              {s.n < current ? <Check className="h-3.5 w-3.5" {...IS} strokeWidth={2.25} /> : s.n}
            </div>
            <span
              className={`text-sm font-semibold ${
                s.n === current
                  ? "text-[#c4ff47]"
                  : s.n < current
                    ? "text-white/55"
                    : "text-zinc-500"
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`mx-3 h-0.5 min-w-[2rem] flex-1 rounded-full ${
                s.n < current ? "bg-[#c4ff47]/70" : "bg-white/10"
              }`}
            />
          )}
        </span>
      ))}
    </div>
  );
}

function FInput({ placeholder, value, onChange }) {
  const [focus, setFocus] = useState(false);
  return (
    <input
      className={`w-full rounded-xl border px-4 py-2.5 text-sm text-white outline-none transition-all placeholder:text-white/35 ${
        focus
          ? "border-[#c4ff47]/45 bg-white/[0.08] ring-2 ring-[#c4ff47]/15"
          : "border-white/12 bg-white/[0.05]"
      }`}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
    />
  );
}

export function Interview() {
  const navigate = useNavigate();

  const [option, setOption] = useState(null);
  const [inputMethod, setInputMethod] = useState(null);
  const [cvUploaded, setCvUploaded] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [form, setForm] = useState({ company: "", position: "", field: "", level: "" });
  const [fieldOpen, setFieldOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);

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

    const interviewData = {
      option,
      inputMethod,
      ...(option === "A" && { useLatestAnalysis: true, latestCV }),
      ...(option === "B" && inputMethod === "cv" && { uploadedFile, storedCV }),
      ...(option === "B" && inputMethod === "form" && { form }),
    };

    navigate("/interview/gender", { state: interviewData });
  };

  const optBase =
    "relative rounded-2xl border p-5 text-left transition-all duration-300 sm:p-6";
  const optIdle = "border-white/10 bg-white/[0.04] hover:border-[#c4ff47]/25 hover:bg-white/[0.07]";
  const optOn = "border-[#c4ff47]/45 bg-[#c4ff47]/[0.08] shadow-[0_0_28px_rgba(196,255,71,0.12)]";

  return (
    <div className="pi-page-dashboard-bg relative min-h-screen overflow-x-hidden pb-24 font-sans text-white selection:bg-[rgba(196,255,71,0.28)] selection:text-white">
      <style>{`
        .interview-glass {
          background: linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%);
          backdrop-filter: blur(40px);
          -webkit-backdrop-filter: blur(40px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1.5rem;
          box-shadow: 0 20px 50px rgba(0,0,0,0.35), 0 0 0 1px rgba(196, 255, 71, 0.06) inset;
        }
        @keyframes interview-shimmer {
          0% { opacity: 0.4; transform: translate(0,0) scale(1); }
          50% { opacity: 0.7; transform: translate(2%, -2%) scale(1.05); }
          100% { opacity: 0.4; transform: translate(0,0) scale(1); }
        }
      `}</style>

      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-90"
        style={{ animation: "interview-shimmer 14s ease-in-out infinite" }}
        aria-hidden
      >
        <div className="absolute top-[-20%] right-[-10%] h-[70vh] w-[70vh] rounded-full bg-gradient-to-bl from-fuchsia-600/35 via-violet-600/20 to-transparent blur-[100px]" />
        <div className="absolute bottom-[-25%] left-[-15%] h-[85vh] w-[85vh] rounded-full bg-gradient-to-tr from-[#c4ff47]/18 via-cyan-500/10 to-fuchsia-500/20 blur-[110px]" />
        <div className="absolute top-1/2 left-1/2 h-[50vh] w-[50vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#6E35E8]/12 blur-[90px]" />
        <div className="absolute top-[30%] right-[5%] h-[40vh] w-[40vh] rounded-full bg-[#c4ff47]/10 blur-[80px]" />
      </div>

      <header className="relative border-b border-white/[0.07] pt-12 pb-12 sm:pt-14 sm:pb-14">
        <div
          className="absolute inset-0 opacity-[0.11]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.55) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.45) 1px,transparent 1px)",
            backgroundSize: "32px 32px",
          }}
          aria-hidden
        />
        <div className="relative z-10 mx-auto max-w-4xl px-6 text-left sm:px-8">
          <div className="mb-4 flex items-center gap-3">
            <IconFrame size="sm" tone="lime" className="rounded-lg">
              <Sparkles className="h-4 w-4 text-[#c4ff47]" {...IS} />
            </IconFrame>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
              ProInterview <span className="text-[#c4ff47]/95">· Phỏng vấn AI</span>
            </span>
          </div>
          <h1 className="mb-4 text-3xl font-black leading-[1.08] tracking-tighter text-white sm:text-4xl md:text-5xl">
            <span className="bg-gradient-to-r from-white via-fuchsia-100 to-zinc-300 bg-clip-text text-transparent">
              Thiết lập{" "}
            </span>
            <span className="bg-gradient-to-r from-[#c4ff47] via-fuchsia-300 to-violet-300 bg-clip-text text-transparent">
              Phỏng vấn AI
            </span>
          </h1>
          <p className="max-w-2xl text-base font-medium leading-relaxed text-white/50 sm:text-lg">
            Khởi động không gian phỏng vấn mô phỏng. Cung cấp thông tin để AI tối ưu hóa bộ câu hỏi cá nhân hoá dành riêng cho bạn.
          </p>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-6 pb-16 pt-8 sm:px-8">
        <StepBar current={1} />

        <section className="interview-glass mb-6 p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#6E35E8] to-[#8B4DFF] text-xs font-bold text-white shadow-lg">
              1
            </div>
            <h2 className="text-sm font-bold text-white">Chọn nguồn thông tin</h2>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => { setOption("A"); setInputMethod(null); }}
              className={`${optBase} ${option === "A" ? optOn : optIdle}`}
            >
              {option === "A" && (
                <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-[#c4ff47]/40 bg-[#c4ff47] shadow-[0_2px_12px_rgba(196,255,71,0.35)]">
                  <Check className="h-3.5 w-3.5 text-[#0a0814]" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
                </div>
              )}
              <IconFrame tone="lime" className="mb-3">
                <FileCheck className="h-5 w-5 text-[#c4ff47]" {...IS} />
              </IconFrame>
              <p className="mb-1 text-sm font-bold text-white">Dùng CV/JD đã phân tích</p>
              <p className="text-xs leading-relaxed text-zinc-400">
                Sử dụng từ phiên phân tích CV/JD trước — AI hiểu rõ bạn nhất
              </p>
            </button>

            <button
              type="button"
              onClick={() => { setOption("B"); setInputMethod(null); }}
              className={`${optBase} ${option === "B" ? optOn : optIdle}`}
            >
              {option === "B" && (
                <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-[#c4ff47]/40 bg-[#c4ff47] shadow-[0_2px_12px_rgba(196,255,71,0.35)]">
                  <Check className="h-3.5 w-3.5 text-[#0a0814]" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
                </div>
              )}
              <IconFrame tone="fuchsia" className="mb-3">
                <CloudUpload className="h-5 w-5 text-fuchsia-200" {...IS} />
              </IconFrame>
              <p className="mb-1 text-sm font-bold text-white">Upload mới / Nhập thông tin</p>
              <p className="text-xs leading-relaxed text-zinc-400">
                Upload CV hoặc điền thông tin công ty và vị trí ứng tuyển
              </p>
            </button>
          </div>

          {option === "B" && (
            <div className="border-t border-white/10 pt-6">
              <div className="mb-5 flex flex-wrap gap-2">
                {([
                  { id: "cv", icon: Upload, label: "Tải lên CV" },
                  { id: "form", icon: LayoutGrid, label: "Điền thông tin" },
                ]).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setInputMethod(t.id)}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                      inputMethod === t.id
                        ? "border border-[#c4ff47]/40 bg-[#c4ff47]/10 text-[#c4ff47]"
                        : "border border-white/10 bg-white/[0.04] text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                    }`}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06]">
                      <t.icon className="h-4 w-4 text-zinc-300" {...IS} />
                    </span>
                    {t.label}
                  </button>
                ))}
              </div>

              {inputMethod === "cv" && (
                <div
                  className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
                    cvUploaded
                      ? "border-[#c4ff47]/45 bg-[#c4ff47]/[0.06]"
                      : "border-white/15 bg-white/[0.03] hover:border-white/25"
                  }`}
                >
                  {cvUploaded ? (
                    <div className="flex flex-col items-center">
                      <IconFrame size="lg" tone="lime" className="mb-3 rounded-2xl">
                        <Check className="h-6 w-6 text-[#c4ff47]" {...IS} strokeWidth={2} />
                      </IconFrame>
                      <p className="text-sm font-bold text-white">CV đã được tải lên thành công</p>
                      <p className="mt-1 text-xs text-zinc-400">
                        {uploadedFile?.name} · {(uploadedFile?.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setCvUploaded(false); }}
                        className="mt-3 text-xs font-semibold text-[#c4ff47] underline underline-offset-2 hover:text-[#e8ffc4]"
                      >
                        Tải lại
                      </button>
                    </div>
                  ) : (
                    <div className="relative flex flex-col items-center">
                      <IconFrame size="lg" tone="violet" className="mb-3 rounded-2xl">
                        <FileStack className="h-6 w-6 text-violet-200" {...IS} strokeWidth={2} />
                      </IconFrame>
                      <p className="text-sm font-bold text-white">Kéo & thả CV hoặc click để chọn</p>
                      <p className="mt-1 text-xs text-zinc-500">PDF, DOC, DOCX · Tối đa 5 MB</p>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        className="absolute inset-0 cursor-pointer opacity-0"
                        onChange={handleFileUpload}
                      />
                    </div>
                  )}
                </div>
              )}

              {inputMethod === "form" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-zinc-400">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/[0.05]">
                        <Building2 className="h-3.5 w-3.5 text-zinc-300" {...IS} />
                      </span>
                      Tên công ty
                    </label>
                    <FInput
                      placeholder="Shopee, Vingroup, FPT..."
                      value={form.company}
                      onChange={(v) => setForm({ ...form, company: v })}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-zinc-400">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/[0.05]">
                        <BriefcaseBusiness className="h-3.5 w-3.5 text-zinc-300" {...IS} />
                      </span>
                      Vị trí ứng tuyển
                    </label>
                    <FInput
                      placeholder="Frontend Developer..."
                      value={form.position}
                      onChange={(v) => setForm({ ...form, position: v })}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-zinc-400">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/[0.05]">
                        <LayoutGrid className="h-3.5 w-3.5 text-zinc-300" {...IS} />
                      </span>
                      Lĩnh vực / Ngành nghề
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => { setFieldOpen(!fieldOpen); setLevelOpen(false); }}
                        className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm transition-all ${
                          fieldOpen
                            ? "border-[#c4ff47]/45 bg-white/[0.08] ring-2 ring-[#c4ff47]/12"
                            : "border-white/12 bg-white/[0.05]"
                        } ${form.field ? "text-white" : "text-zinc-500"}`}
                      >
                        <span>{form.field || "Chọn ngành..."}</span>
                        <ChevronDown
                          className={`h-4 w-4 text-zinc-500 transition-transform ${fieldOpen ? "rotate-180" : ""}`}
                          {...IS}
                        />
                      </button>
                      {fieldOpen && (
                        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-white/12 bg-[#1a0d35]/98 py-1 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                          {FIELDS_LIST.map((f) => (
                            <button
                              key={f}
                              type="button"
                              onClick={() => { setForm({ ...form, field: f }); setFieldOpen(false); }}
                              className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-white/[0.08] hover:text-white"
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-zinc-400">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/[0.05]">
                        <Users className="h-3.5 w-3.5 text-zinc-300" {...IS} />
                      </span>
                      Level kinh nghiệm
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => { setLevelOpen(!levelOpen); setFieldOpen(false); }}
                        className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm transition-all ${
                          levelOpen
                            ? "border-[#c4ff47]/45 bg-white/[0.08] ring-2 ring-[#c4ff47]/12"
                            : "border-white/12 bg-white/[0.05]"
                        } ${form.level ? "text-white" : "text-zinc-500"}`}
                      >
                        <span>{form.level || "Chọn level..."}</span>
                        <ChevronDown
                          className={`h-4 w-4 text-zinc-500 transition-transform ${levelOpen ? "rotate-180" : ""}`}
                          {...IS}
                        />
                      </button>
                      {levelOpen && (
                        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-white/12 bg-[#1a0d35]/98 py-1 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                          {LEVELS.map((l) => (
                            <button
                              key={l}
                              type="button"
                              onClick={() => { setForm({ ...form, level: l }); setLevelOpen(false); }}
                              className="w-full px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-white/[0.08] hover:text-white"
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
        </section>

        <section className="interview-glass mb-8 p-6 sm:p-8">
          <div className="mb-5 flex flex-wrap items-center gap-2.5">
            <IconFrame size="sm" tone="neutral" className="rounded-lg border-[#c4ff47]/25">
              <Timer className="h-4 w-4 text-[#c4ff47]" {...IS} />
            </IconFrame>
            <h2 className="text-sm font-bold text-white">Những gì sẽ xảy ra trong buổi phỏng vấn</h2>
            <span className="ml-auto text-xs font-semibold text-zinc-500">~30–45 phút</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {PREVIEW_ITEMS.map((item, i) => (
              <div
                key={i}
                className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3.5 transition-colors hover:border-[#c4ff47]/20"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  style={{
                    background: `linear-gradient(145deg, ${item.color}22, ${item.color}08)`,
                    borderColor: `${item.color}40`,
                  }}
                >
                  <item.icon className="h-[18px] w-[18px]" style={{ color: item.color }} {...IS} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="mb-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Quy trình buổi phỏng vấn
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {["AI giới thiệu", "→", "AI đặt câu hỏi", "→", "Bạn trả lời", "→", "AI hỏi thêm", "→", "Nhận kết quả"].map(
                (step, i) =>
                  step === "→" ? (
                    <ArrowRight key={i} className="h-3.5 w-3.5 text-zinc-500" {...IS} />
                  ) : (
                    <span
                      key={i}
                      className="rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-zinc-300"
                    >
                      {step}
                    </span>
                  ),
              )}
            </div>
          </div>
        </section>

        <button
          type="button"
          onClick={handleStart}
          disabled={!canStart}
          className={`flex w-full items-center justify-center gap-2.5 rounded-2xl py-4 text-sm font-black transition-all active:scale-[0.99] ${
            canStart
              ? "bg-gradient-to-r from-[#c4ff47] to-[#8fbc24] text-[#0a0814] shadow-[0_8px_28px_rgba(196,255,71,0.25)] hover:brightness-110"
              : "cursor-not-allowed border border-white/10 bg-white/[0.04] text-zinc-500"
          }`}
        >
          <Mic className="h-5 w-5" {...IS} strokeWidth={2} />
          {canStart ? "Bắt đầu Phỏng vấn AI →" : "Hoàn tất các bước trên để bắt đầu"}
        </button>

        {!canStart && (
          <p className="mt-3 text-center text-xs font-medium text-zinc-500">
            Vui lòng chọn nguồn thông tin để tiếp tục
          </p>
        )}
      </main>
    </div>
  );
}

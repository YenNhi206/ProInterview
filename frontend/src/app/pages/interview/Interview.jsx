import React, { useState } from "react";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { useNavigate } from "react-router";
import { requireLoginNavigate } from "../../utils/authGate";
import {
  Upload,
  ChevronDown,
  Check,
  Mars,
  Venus,
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
  AlertCircle,
  CalendarDays,
  Award,
} from "lucide-react";
import { getLatestCVAnalysis, getUploadedCV, saveUploadedCV } from "../../utils/history";
import { hasAuthCredentials, isLoggedIn } from "../../utils/auth";
import { generateInterviewQuestions, extractCvTextFromFile, createInterviewSession } from "../../utils/interviewsApi";

const LEVELS = ["Thực tập sinh", "Mới ra trường", "Junior", "Trung cấp", "Senior"];
const FIELDS_LIST = [
  "IT / Công nghệ", "Marketing", "Finance", "HR",
  "Product", "Design", "Sales", "Operations",
];

/** Stroke Lucide chuẩn UI — đồng bộ toàn trang */
const IS = { strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" };

const PREVIEW_ITEMS = [
  { icon: Brain, title: "5 câu hỏi cá nhân hóa", desc: "AI tạo câu hỏi dựa trên JD & CV của bạn" },
  { icon: Video, title: "Phân tích hành vi theo thời gian thực", desc: "AI đánh giá ánh mắt, biểu cảm, ngôn ngữ cơ thể" },
  { icon: BarChart3, title: "Phân tích lời nói & diễn đạt", desc: "Nội dung STAR, tốc độ nói, từ đệm" },
  { icon: BadgeCheck, title: "Phản hồi chi tiết từng câu", desc: "Điểm số + gợi ý câu trả lời mẫu tốt hơn" },
];

/** Thẻ pastel + chữ đậm (cùng tông) — giống mock coaching cho user */
const PREVIEW_PASTEL = [
  {
    shell: "border-emerald-200/95 bg-emerald-50 shadow-[0_4px_16px_rgba(15,23,42,0.06)]",
    iconWell: "border-emerald-300/90 bg-emerald-100",
    iconClass: "text-emerald-800",
    title: "text-emerald-950",
    body: "text-emerald-900/90",
  },
  {
    shell: "border-amber-200/95 bg-amber-50 shadow-[0_4px_16px_rgba(15,23,42,0.06)]",
    iconWell: "border-amber-300/90 bg-amber-100",
    iconClass: "text-amber-900",
    title: "text-amber-950",
    body: "text-amber-900/88",
  },
  {
    shell: "border-sky-200/95 bg-sky-50 shadow-[0_4px_16px_rgba(15,23,42,0.06)]",
    iconWell: "border-sky-300/90 bg-sky-100",
    iconClass: "text-sky-900",
    title: "text-sky-950",
    body: "text-sky-900/88",
  },
  {
    shell: "border-violet-200/95 bg-violet-50 shadow-[0_4px_16px_rgba(15,23,42,0.06)]",
    iconWell: "border-violet-300/90 bg-violet-100",
    iconClass: "text-violet-800",
    title: "text-violet-950",
    body: "text-violet-900/88",
  },
];

const HR_PREVIEWS = {
  male: {
    name: "HR Nam",
    subtitle: "David · Người phỏng vấn AI",
    video: "https://res.cloudinary.com/dee4bvivu/video/upload/v1774336646/Male_jioqsx.mp4",
  },
  female: {
    name: "HR Nữ",
    subtitle: "Sarah · AI Interviewer",
    video: "https://res.cloudinary.com/dee4bvivu/video/upload/v1774336640/Female_delxmy.mp4",
  },
};

/** Khung icon — cùng họ glass như Dashboard metric */
function IconFrame({ size = "md", tone = "neutral", className = "", children }) {
  const sz = size === "sm" ? "h-9 w-9" : size === "lg" ? "h-14 w-14" : "h-11 w-11";
  const tones = {
    neutral:
      "border-slate-300 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]",
    lime: "border-[#b6d84a]/55 bg-gradient-to-br from-[#dfff8a]/45 to-[#d4ff00]/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]",
    violet:
      "border-violet-300/60 bg-gradient-to-br from-violet-200/70 to-violet-100/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]",
    fuchsia:
      "border-fuchsia-300/60 bg-gradient-to-br from-fuchsia-200/70 to-violet-100/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]",
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
    { n: 2, label: "Chọn HR" },
    { n: 3, label: "Phỏng vấn" },
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
                  ? "text-lime-800"
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
  const [hrGender, setHrGender] = useState(null);
  const [flowStep, setFlowStep] = useState(1);
  const [form, setForm] = useState({ company: "", position: "", field: "", level: "" });
  const [fieldOpen, setFieldOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [extractWarning, setExtractWarning] = useState("");

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

  const canProceedSetup =
    (option === "A" && Boolean(latestCV)) ||
    (option === "B" &&
      ((inputMethod === "cv" && cvUploaded) ||
        (inputMethod === "form" &&
          form.company && form.position && form.field && form.level)));
  const canStart = canProceedSetup && Boolean(hrGender);

  const handleContinueToHr = () => {
    if (!canProceedSetup) return;
    setFlowStep(2);
  };

  const handleStart = async () => {
<<<<<<< Updated upstream
    if (!canStart || generating) return;
    setGenerating(true);
=======
    if (!canStart || loadingStep) return;
    if (!isLoggedIn()) {
      requireLoginNavigate(navigate, "/interview");
      return;
    }
>>>>>>> Stashed changes
    setExtractWarning("");

    let questions = null;
    let result = null;
    try {
      let cvText = "";
      let jdText = "";

      if (option === "A" && latestCV) {
        // Xây context có cấu trúc từ kết quả phân tích CV — chất lượng tốt hơn JSON dump
        const parts = [
          latestCV.position && `Vị trí ứng tuyển: ${latestCV.position}`,
          latestCV.company  && `Công ty: ${latestCV.company}`,
          latestCV.matchedKeywords?.length
            && `Kỹ năng phù hợp với JD: ${latestCV.matchedKeywords.join(", ")}`,
          latestCV.missingKeywords?.length
            && `Kỹ năng còn thiếu: ${latestCV.missingKeywords.join(", ")}`,
          latestCV.strengths?.length
            && `Điểm mạnh:\n${latestCV.strengths.slice(0, 3).map(s => `- ${s}`).join("\n")}`,
          latestCV.weaknesses?.length
            && `Cần cải thiện:\n${latestCV.weaknesses.slice(0, 2).map(w => `- ${w}`).join("\n")}`,
        ];
        cvText = parts.filter(Boolean).join("\n\n");
      } else if (option === "B" && inputMethod === "cv" && uploadedFile) {
        const extracted = await extractCvTextFromFile(uploadedFile);
        if (extracted.success && extracted.text) {
          cvText = extracted.text;
        } else {
          // Báo lỗi nhưng vẫn tiếp tục với context tối thiểu từ tên file
          setExtractWarning(
            extracted.error ||
            "Không thể trích xuất text từ CV (cần Python service đang chạy). " +
            "AI sẽ tạo câu hỏi dựa trên tên file — chất lượng cá nhân hoá thấp hơn."
          );
          cvText = `Tên file CV: ${uploadedFile.name}`;
        }
      } else if (option === "B" && inputMethod === "form") {
        jdText = [
          form.position && `Vị trí: ${form.position}.`,
          form.company  && `Công ty: ${form.company}.`,
          form.field    && `Lĩnh vực: ${form.field}.`,
          form.level    && `Level kinh nghiệm: ${form.level}.`,
        ].filter(Boolean).join(" ");
      }

      result = await generateInterviewQuestions({
        cvText,
        jdText,
        // Option A lấy position/field từ latestCV thay vì form
        position: option === "A" ? (latestCV?.position || "") : form.position,
        field:    option === "A" ? ""                          : form.field,
        level:    option === "A" ? ""                          : form.level,
      });

      if (result?.success && result.questions?.length) {
        questions = result.questions;
      } else if (result && !result.success) {
        setExtractWarning(`AI không thể tạo câu hỏi cá nhân hóa (${result.error || "lỗi không xác định"}). Đang dùng câu hỏi mẫu.`);
      }
    } catch (err) {
      setExtractWarning(`Không thể kết nối tới máy chủ để tạo câu hỏi. Đang dùng câu hỏi mẫu.`);
    }

    // Tạo session ngay sau khi có questions — trước khi vào phòng
    // sessionId được truyền vào InterviewRoom để lưu từng câu trả lời
    let sessionId = null;
    if (hasAuthCredentials()) {
      try {
        const created = await createInterviewSession(hrGender, {
          ...(questions                  && { questions }),
          ...(result?.inferredRole       && { inferredRole: result.inferredRole }),
          ...(result?.inferredSeniority  && { inferredSeniority: result.inferredSeniority }),
          ...(result?.competencyProfile  && { competencyProfile: result.competencyProfile }),
          ...(result?.coverageScore      && { coverageScore: result.coverageScore }),
        });
        if (created.success) sessionId = created.sessionId;
      } catch {
        // graceful degradation — phỏng vấn vẫn chạy, không lưu MongoDB
      }
    }

    setGenerating(false);

    const interviewData = {
      option,
      inputMethod,
      hrGender,
      questions,
      sessionId,
      ...(option === "A" && { useLatestAnalysis: true, latestCV }),
      ...(option === "B" && inputMethod === "cv" && { storedCV }),
      ...(option === "B" && inputMethod === "form" && { form }),
    };

    sessionStorage.setItem("prointerview_hr_gender", hrGender);
    navigate("/interview/room", { state: interviewData });
  };

  const optBase =
    "relative rounded-2xl border p-5 text-left transition-all duration-300 sm:p-6";
  const optIdle = "border-slate-400 bg-white/95 hover:border-violet-400/45 hover:bg-violet-50/45";
  const optOn = "border-violet-500/65 bg-violet-100 shadow-[0_0_24px_rgba(122,35,229,0.18)]";

  return (
    <MentorPageShell className="interview-light" bottomPad="pb-24">
      <style>{`
        .interview-glass {
          background: linear-gradient(145deg, rgba(255,255,255,0.92) 0%, rgba(246,248,255,0.95) 100%);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(40px);
          border: 1px solid rgba(148, 71, 255, 0.16);
          border-radius: 1.5rem;
          box-shadow: 0 16px 36px rgba(15,23,42,0.12), 0 0 0 1px rgba(148,71,255,0.07) inset;
        }
        .interview-light .text-white { color: #0f172a !important; }
        .interview-light .text-zinc-300,
        .interview-light .text-zinc-200 { color: #334155 !important; }
        .interview-light .text-white\\/65,
        .interview-light .text-white\\/60,
        .interview-light .text-white\\/55,
        .interview-light .text-white\\/50,
        .interview-light .text-white\\/45,
        .interview-light .text-zinc-500,
        .interview-light .text-zinc-400 { color: #64748b !important; }
        .interview-light .text-zinc-700 { color: #475569 !important; }
        .interview-light .border-white\\/12,
        .interview-light .border-white\\/10,
        .interview-light .border-white\\/15 { border-color: rgba(148,71,255,0.18) !important; }
        .interview-light .bg-white\\/\\[0\\.06\\],
        .interview-light .bg-white\\/\\[0\\.05\\],
        .interview-light .bg-white\\/\\[0\\.04\\],
        .interview-light .bg-white\\/\\[0\\.03\\] { background-color: rgba(255,255,255,0.85) !important; }
        .interview-light header { border-bottom-color: rgba(148,71,255,0.16) !important; }
        .interview-light header .absolute.inset-0 {
          opacity: .05 !important;
          background-image: linear-gradient(rgba(148,71,255,0.16) 1px,transparent 1px),linear-gradient(90deg,rgba(148,71,255,0.16) 1px,transparent 1px) !important;
        }
        @keyframes interview-shimmer {
          0% { opacity: 0.4; transform: translate(0,0) scale(1); }
          50% { opacity: 0.7; transform: translate(2%, -2%) scale(1.05); }
          100% { opacity: 0.4; transform: translate(0,0) scale(1); }
        }
      `}</style>

      <header className="relative pt-8 pb-2 sm:pt-10 sm:pb-4">
        <div
          className="absolute inset-0 opacity-[0.11]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.55) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.45) 1px,transparent 1px)",
            backgroundSize: "32px 32px",
          }}
          aria-hidden
        />
        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 sm:px-8">
            <div className="mb-4 flex items-center gap-3">
              <Sparkles
                className="size-6 shrink-0 text-lime-900"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800 sm:text-[11px]">
                ProInterview · Phỏng vấn AI
              </span>
            </div>
            <h1 className="app-page-title mb-3">
              <span className="text-slate-900">
                Thiết lập{" "}
              </span>
              <span className="text-[#6E35E8]">
                Phỏng vấn AI
              </span>
            </h1>
            <p className="app-page-subtitle">
              Khởi động không gian phỏng vấn mô phỏng. Cung cấp thông tin để AI tối ưu hóa bộ câu hỏi cá nhân hoá dành riêng cho bạn.
            </p>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-16 pt-8">
        <div className="w-full rounded-[28px] border border-slate-200 bg-white/85 px-6 pb-10 pt-8 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:px-8">
        <StepBar current={flowStep} />

        {flowStep === 1 && (
        <section className="interview-glass mb-6 p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#6E35E8] to-[#8B4DFF] text-xs font-bold text-white shadow-lg">
              1
            </div>
            <h2 className="text-sm font-black uppercase tracking-[0.14em] text-slate-900">Chọn nguồn thông tin</h2>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => { if (latestCV) { setOption("A"); setInputMethod(null); } }}
              disabled={!latestCV}
              className={`${optBase} ${option === "A" ? optOn : optIdle} ${!latestCV ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              {option === "A" && (
                <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-[#c4ff47]/40 bg-[#c4ff47] shadow-[0_2px_12px_rgba(196,255,71,0.35)]">
                  <Check className="h-3.5 w-3.5 text-[#0a0814]" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
                </div>
              )}
              <IconFrame tone="lime" className="mb-3">
                <FileCheck className="h-5 w-5 text-lime-950" {...IS} strokeWidth={2.25} />
              </IconFrame>
              <p className="mb-1 text-sm font-black text-slate-900">Dùng CV/JD đã phân tích</p>
              <p className="text-xs leading-relaxed text-slate-600">
                Sử dụng từ phiên phân tích CV/JD trước — AI hiểu rõ bạn nhất
              </p>
              {latestCV ? (
                <div
                  className="mt-3 w-full rounded-xl border p-3 text-left"
                  style={{ background: "rgba(220,252,231,0.7)", borderColor: "rgba(74,222,128,0.35)" }}
                >
                  <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                    Phân tích gần nhất
                  </p>
                  <p className="truncate text-xs font-bold text-slate-800">{latestCV.position || "—"}</p>
                  {latestCV.company && (
                    <p className="text-[11px] text-slate-500">{latestCV.company}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {latestCV.matchScore != null && (
                      <span className="flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                        <Award className="h-2.5 w-2.5" />
                        {latestCV.matchScore}% phù hợp
                      </span>
                    )}
                    {latestCV.date && (
                      <span className="flex items-center gap-1 text-[10px] text-slate-400">
                        <CalendarDays className="h-2.5 w-2.5" />
                        {latestCV.date}
                      </span>
                    )}
                  </div>
                  {latestCV.matchedKeywords?.length > 0 && (
                    <p className="mt-2 text-[10px] text-slate-500 leading-relaxed">
                      <span className="font-semibold text-slate-600">Skills: </span>
                      {latestCV.matchedKeywords.slice(0, 5).join(", ")}
                      {latestCV.matchedKeywords.length > 5 && ` +${latestCV.matchedKeywords.length - 5}`}
                    </p>
                  )}
                </div>
              ) : (
                <div
                  className="mt-3 w-full rounded-xl border border-amber-200/60 bg-amber-50/70 p-3 text-left"
                >
                  <p className="text-[11px] text-amber-700">
                    Chưa có phân tích CV nào. Hãy dùng tính năng{" "}
                    <span className="font-bold">CV Analysis</span> trước.
                  </p>
                </div>
              )}
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
                <CloudUpload className="h-5 w-5 text-violet-700" {...IS} />
              </IconFrame>
              <p className="mb-1 text-sm font-black text-slate-900">Upload mới / Nhập thông tin</p>
              <p className="text-xs leading-relaxed text-slate-600">
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
                        ? "border border-lime-600/45 bg-lime-500/10 text-lime-950"
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
                        <Check className="h-6 w-6 text-lime-950" {...IS} strokeWidth={2.25} />
                      </IconFrame>
                      <p className="text-sm font-black text-slate-900">CV đã được tải lên thành công</p>
                      <p className="mt-1 text-xs text-zinc-400">
                        {uploadedFile?.name} · {(uploadedFile?.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setCvUploaded(false); }}
                        className="mt-3 text-xs font-semibold text-lime-800 underline underline-offset-2 hover:text-lime-950"
                      >
                        Tải lại
                      </button>
                    </div>
                  ) : (
                    <div className="relative flex flex-col items-center">
                      <IconFrame size="lg" tone="violet" className="mb-3 rounded-2xl">
                        <FileStack className="h-6 w-6 text-violet-900" {...IS} strokeWidth={2.25} />
                      </IconFrame>
                      <p className="text-sm font-black text-slate-900">Kéo & thả CV hoặc click để chọn</p>
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
        )}

        {flowStep === 2 && (
        <>
        <section className="interview-glass mb-5 p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <IconFrame tone="violet">
              <Users className="h-5 w-5 text-violet-700" {...IS} />
            </IconFrame>
            <div>
              <h2 className="font-semibold text-slate-900" style={{ fontSize: "1.125rem" }}>
                Chọn giới tính HR AI
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">Chọn 1 trong 2 tùy chọn bên dưới</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setHrGender("male")}
              className={`${optBase} ${hrGender === "male" ? optOn : optIdle}`}
            >
              {hrGender === "male" && (
                <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-[#c4ff47]/40 bg-[#c4ff47] shadow-[0_2px_12px_rgba(196,255,71,0.35)]">
                  <Check className="h-3.5 w-3.5 text-[#0a0814]" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
                </div>
              )}
              <div className="mb-3 flex justify-center">
                <IconFrame tone="violet" size="lg">
                  <Mars className="h-10 w-10 text-violet-700" {...IS} />
                </IconFrame>
              </div>
              <p className="mb-1 text-sm font-black text-slate-900">{HR_PREVIEWS.male.name}</p>
              <p className="text-xs leading-relaxed text-slate-600">{HR_PREVIEWS.male.subtitle}</p>
            </button>

            <button
              type="button"
              onClick={() => setHrGender("female")}
              className={`${optBase} ${hrGender === "female" ? optOn : optIdle}`}
            >
              {hrGender === "female" && (
                <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-[#c4ff47]/40 bg-[#c4ff47] shadow-[0_2px_12px_rgba(196,255,71,0.35)]">
                  <Check className="h-3.5 w-3.5 text-[#0a0814]" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
                </div>
              )}
              <div className="mb-3 flex justify-center">
                <IconFrame tone="fuchsia" size="lg">
                  <Venus className="h-10 w-10 text-fuchsia-700" {...IS} />
                </IconFrame>
              </div>
              <p className="mb-1 text-sm font-black text-slate-900">{HR_PREVIEWS.female.name}</p>
              <p className="text-xs leading-relaxed text-slate-600">{HR_PREVIEWS.female.subtitle}</p>
            </button>
          </div>
        </section>

        <section className="mb-8 rounded-xl border border-violet-300/35 bg-violet-100/70 p-5 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <IconFrame tone="violet" className="flex-shrink-0">
              <Video className="h-5 w-5 text-violet-700" {...IS} />
            </IconFrame>
            <div>
              <p className="mb-1.5 text-sm font-bold text-violet-700">Xem video giới thiệu</p>
              <p className="text-sm leading-relaxed text-slate-600">
                Mỗi HR AI có video giới thiệu ngắn giúp bạn làm quen trước khi phỏng vấn. Bạn cũng có thể bỏ qua và vào phòng ngay.
              </p>
            </div>
          </div>
          {hrGender && (
            <div className="mt-4 mx-auto w-full max-w-[560px] overflow-hidden rounded-2xl border border-violet-200/65 bg-black aspect-[5/4]">
              <video
                src={HR_PREVIEWS[hrGender].video}
                autoPlay
                loop
                controls
                playsInline
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </section>
        </>
        )}

        {flowStep === 1 && (
        <section className="interview-glass mb-8 p-6 sm:p-8">
          <div className="mb-5 flex flex-wrap items-center gap-2.5">
            <IconFrame size="sm" tone="lime" className="rounded-lg">
              <Timer className="h-4 w-4 text-lime-950" {...IS} strokeWidth={2.25} />
            </IconFrame>
            <h2 className="text-sm font-black uppercase tracking-[0.14em] text-slate-900">Những gì sẽ xảy ra trong buổi phỏng vấn</h2>
            <span className="ml-auto text-xs font-semibold text-zinc-500">~30–45 phút</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            {PREVIEW_ITEMS.map((item, i) => {
              const p = PREVIEW_PASTEL[i] ?? PREVIEW_PASTEL[0];
              return (
                <div
                  key={i}
                  className={`flex gap-3.5 rounded-[1.35rem] border-2 p-4 transition-shadow hover:shadow-lg sm:p-5 ${p.shell}`}
                >
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 shadow-sm ${p.iconWell}`}
                  >
                    <item.icon className={`h-5 w-5 ${p.iconClass}`} {...IS} strokeWidth={2.25} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-black leading-snug ${p.title}`}>{item.title}</p>
                    <p className={`mt-2 text-xs leading-relaxed sm:text-sm ${p.body}`}>{item.desc}</p>
                  </div>
                </div>
              );
            })}
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
        )}

        {flowStep === 1 && (
          <>
            <button
              type="button"
              onClick={handleContinueToHr}
              disabled={!canProceedSetup}
              className={`flex w-full items-center justify-center gap-2.5 rounded-2xl py-4 text-sm font-black transition-all active:scale-[0.99] ${
                canProceedSetup
                  ? "bg-gradient-to-r from-[#c4ff47] to-[#8fbc24] text-[#0a0814] shadow-[0_8px_28px_rgba(196,255,71,0.25)] hover:brightness-110"
                  : "cursor-not-allowed border border-white/10 bg-white/[0.04] text-zinc-500"
              }`}
            >
              Tiếp tục: Chọn HR AI
              <ArrowRight className="h-5 w-5" {...IS} strokeWidth={2} />
            </button>

            {!canProceedSetup && (
              <p className="mt-3 text-center text-xs font-medium text-zinc-500">
                Vui lòng chọn nguồn thông tin để tiếp tục
              </p>
            )}
          </>
        )}

        {flowStep === 2 && (
          <>
            {extractWarning && (
              <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-300/60 bg-amber-50/90 p-4">
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-500 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">{extractWarning}</p>
              </div>
            )}
            <button
              type="button"
              onClick={handleStart}
              disabled={!canStart || generating}
              className={`flex w-full items-center justify-center gap-2.5 rounded-2xl py-4 text-sm font-black transition-all active:scale-[0.99] ${
                canStart && !generating
                  ? "bg-gradient-to-r from-[#c4ff47] to-[#8fbc24] text-[#0a0814] shadow-[0_8px_28px_rgba(196,255,71,0.25)] hover:brightness-110"
                  : "cursor-not-allowed border border-white/10 bg-white/[0.04] text-zinc-500"
              }`}
            >
              {generating ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  AI đang tạo câu hỏi cá nhân hóa...
                </>
              ) : (
                <>
                  <Mic className="h-5 w-5" {...IS} strokeWidth={2} />
                  {canStart ? "Bắt đầu Phỏng vấn AI →" : "Chọn HR AI để bắt đầu"}
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setFlowStep(1)}
              className="mt-3 w-full rounded-2xl border border-violet-200/70 bg-white/80 py-3 text-sm font-semibold text-slate-700 transition hover:bg-violet-50"
            >
              Quay lại bước thiết lập
            </button>
          </>
        )}
        </div>
      </main>
    </MentorPageShell>
  );
}

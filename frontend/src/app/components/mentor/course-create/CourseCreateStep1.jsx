import { memo, useCallback, useMemo, useState } from "react";
import { BookOpen, GraduationCap, ListChecks, Plus, Sparkles } from "lucide-react";
import {
  mentorGhostBtnClass,
  mentorInputClass,
  mentorLabelClass,
  mentorPrimaryBtnClass,
  mentorSectionCardClass,
  mentorValidationShakeClass,
} from "./mentorCourseCreateTheme";
import { AppSelect } from "../../ui/AppSelect";

const CATEGORY_OPTIONS = [
  { value: "", label: "Chọn danh mục" },
  { value: "behavioral-interview", label: "Behavioral Interview" },
  { value: "technical-interview", label: "Technical Interview" },
  { value: "career-development", label: "Career Development" },
];

const LEVEL_OPTIONS = [
  { value: "basic", label: "Cơ bản" },
  { value: "intermediate", label: "Trung cấp" },
  { value: "advanced", label: "Nâng cao" },
];

export const EMPTY_STEP1_FORM = {
  title: "",
  description: "",
  category: "",
  level: "basic",
  price: 0,
  outcomes: ["", "", ""],
  tags: "",
};

/** Tắt Grammarly — extension hay gây giật trên textarea controlled (React). */
const GRAMMARLY_OFF = {
  "data-gramm": "false",
  "data-gramm_editor": "false",
  "data-enable-grammarly": "false",
};

function buildStep1Validation(form) {
  const messages = [];
  if (form.title.trim().length <= 2) {
    messages.push("Nhập tiêu đề khóa học (ít nhất 3 ký tự).");
  }
  if (form.description.trim().length <= 20) {
    messages.push("Nhập mô tả khóa học (ít nhất 21 ký tự).");
  }
  if (!form.category.trim()) {
    messages.push("Chọn danh mục khóa học.");
  }
  const filledOutcomes = form.outcomes.filter((o) => o.trim().length > 0).length;
  if (filledOutcomes < 3) {
    messages.push("Điền ít nhất 3 mục 'Học viên sẽ học được gì'.");
  }
  return messages;
}

function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#93f72b]/15 text-[#93f72b]">
        <Icon className="h-4 w-4" />
      </span>
      <h2 className="text-base font-bold text-white tracking-tight">{title}</h2>
    </div>
  );
}

/**
 * State form bước 1 giữ trong component này — tránh re-render CreateCourseForm (nặng) mỗi keystroke.
 */
export const CourseCreateStep1 = memo(function CourseCreateStep1({
  initialForm,
  onCancel,
  onNext,
}) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_STEP1_FORM,
    ...initialForm,
    outcomes: initialForm?.outcomes?.length
      ? [...initialForm.outcomes]
      : [...EMPTY_STEP1_FORM.outcomes],
  }));
  const [validationTouched, setValidationTouched] = useState(false);
  const [shakeValidation, setShakeValidation] = useState(false);

  const updateField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateOutcome = useCallback((index, value) => {
    setForm((prev) => {
      const next = [...prev.outcomes];
      next[index] = value;
      return { ...prev, outcomes: next };
    });
  }, []);

  const addOutcome = useCallback(() => {
    setForm((prev) => ({ ...prev, outcomes: [...prev.outcomes, ""] }));
  }, []);

  const validationMessages = useMemo(() => buildStep1Validation(form), [form]);
  const canContinue = validationMessages.length === 0;
  const isPaid = Number(form.price) > 0;
  const showValidationPanel = validationTouched && !canContinue && validationMessages.length > 0;

  const handleNextClick = () => {
    if (!canContinue) {
      setValidationTouched(true);
      setShakeValidation(true);
      window.setTimeout(() => setShakeValidation(false), 520);
      return;
    }
    onNext(form);
  };

  return (
    <div className="space-y-6">
      <section className={mentorSectionCardClass}>
        <SectionHeader icon={BookOpen} title="Thông tin chung" />
        <div className="space-y-4">
          <div>
            <label htmlFor="course-title" className={mentorLabelClass}>
              Tiêu đề khóa học <span className="text-rose-400">*</span>
            </label>
            <input
              id="course-title"
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="VD: Làm chủ STAR Method trong phỏng vấn hành vi chuyên sâu"
              className={mentorInputClass}
              autoComplete="off"
              {...GRAMMARLY_OFF}
            />
          </div>
          <div>
            <label htmlFor="course-desc" className={mentorLabelClass}>
              Mô tả khóa học <span className="text-rose-400">*</span>
            </label>
            <textarea
              id="course-desc"
              rows={4}
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Mô tả chi tiết nội dung, giá trị thực tiễn và những gì học viên sẽ đạt được sau khóa học..."
              className={`${mentorInputClass} min-h-[96px] max-h-[480px] resize-y overflow-y-auto [transition:none!important]`}
              autoComplete="off"
              spellCheck={false}
              {...GRAMMARLY_OFF}
            />
          </div>
        </div>
      </section>

      <section className={mentorSectionCardClass}>
        <SectionHeader icon={GraduationCap} title="Phân loại & Giá bán" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="course-category" className={mentorLabelClass}>
              Danh mục <span className="text-rose-400">*</span>
            </label>
            <AppSelect
              id="course-category"
              size="md"
              value={form.category || undefined}
              onValueChange={(v) => updateField("category", v)}
              placeholder="Chọn danh mục"
              triggerClassName={mentorInputClass}
              options={CATEGORY_OPTIONS.filter((o) => o.value).map((o) => ({
                value: o.value,
                label: o.label,
              }))}
            />
          </div>
          <div>
            <label htmlFor="course-level" className={mentorLabelClass}>
              Cấp độ
            </label>
            <AppSelect
              id="course-level"
              size="md"
              value={form.level}
              onValueChange={(v) => updateField("level", v)}
              triggerClassName={mentorInputClass}
              options={LEVEL_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
          </div>
        </div>
        <div className="mt-4">
          <label htmlFor="course-price" className={mentorLabelClass}>
            Giá khóa học
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex max-w-xs flex-1 items-stretch overflow-hidden rounded-xl border border-white/15 bg-[#10091e] focus-within:border-[#93f72b] focus-within:ring-2 focus-within:ring-[#93f72b]/20">
              <input
                id="course-price"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                value={form.price > 0 ? Number(form.price).toLocaleString("vi-VN") : ""}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  updateField("price", digits === "" ? 0 : Number(digits));
                }}
                className="min-w-0 flex-1 border-0 bg-transparent px-4 py-3 text-base font-semibold text-white outline-none placeholder:text-slate-500 sm:text-sm"
              />
              <span className="flex items-center border-l border-white/10 bg-white/[0.04] px-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                VND
              </span>
            </div>
            <span
              className={`inline-flex items-center rounded-xl px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider ${
                isPaid
                  ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border border-[#93f72b]/30 bg-[#93f72b]/10 text-[#93f72b]"
              }`}
            >
              {isPaid ? "Có phí" : "Miễn phí"}
            </span>
          </div>
        </div>
      </section>

      <section className={mentorSectionCardClass}>
        <SectionHeader icon={ListChecks} title="Kết quả đạt được" />
        <div className="space-y-3">
          {form.outcomes.map((outcome, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs font-bold text-[#93f72b]">
                {idx + 1}
              </span>
              <input
                value={outcome}
                onChange={(e) => updateOutcome(idx, e.target.value)}
                placeholder={`Kết quả học tập ${idx + 1}...`}
                className={mentorInputClass}
                autoComplete="off"
              />
              {idx === form.outcomes.length - 1 ? (
                <button
                  type="button"
                  onClick={addOutcome}
                  title="Thêm mục"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-dashed border-white/20 text-[#93f72b] transition hover:border-[#93f72b] hover:bg-[#93f72b]/10"
                >
                  <Plus className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {showValidationPanel ? (
        <div
          className={`rounded-xl border px-5 py-4 text-sm transition-colors ${
            shakeValidation
              ? mentorValidationShakeClass
              : "border-amber-500/30 bg-amber-950/40 text-amber-200"
          }`}
          role="alert"
          aria-live="polite"
        >
          <p className="mb-2 flex items-center gap-2 font-bold text-amber-300">
            <Sparkles className="h-4 w-4 shrink-0 text-amber-400" />
            Cần hoàn thiện trước khi tiếp tục
          </p>
          <ul className="list-inside list-disc space-y-1 text-xs opacity-90">
            {validationMessages.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <CourseCreateFooter onCancel={onCancel} onPrimary={handleNextClick} primaryLabel="Tiếp theo: Nội dung & Video" />
    </div>
  );
});

export function CourseCreateFooter({
  onCancel,
  onPrimary,
  primaryLabel = "Tiếp theo",
  extra,
}) {
  return (
    <div className="mt-8 border-t border-white/10 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          {onCancel ? (
            <button type="button" onClick={onCancel} className={mentorGhostBtnClass}>
              Hủy
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {extra}
          {onPrimary ? (
            <button type="button" onClick={onPrimary} className={mentorPrimaryBtnClass}>
              {primaryLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

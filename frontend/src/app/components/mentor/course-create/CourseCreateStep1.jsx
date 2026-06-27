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
    <div className="mb-3 flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-violet-100 text-violet-700">
        <Icon className="h-4 w-4" />
      </span>
      <h2 className="text-lg font-bold text-slate-900 sm:text-base">{title}</h2>
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
    <div className="space-y-5">
      <section className={mentorSectionCardClass}>
        <SectionHeader icon={BookOpen} title="Thông tin chung" />
        <div className="space-y-3">
          <div>
            <label htmlFor="course-title" className={mentorLabelClass}>
              Tiêu đề khóa học <span className="text-red-500">*</span>
            </label>
            <input
              id="course-title"
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="VD: Làm chủ STAR Method trong phỏng vấn hành vi"
              className={mentorInputClass}
              autoComplete="off"
              {...GRAMMARLY_OFF}
            />
          </div>
          <div>
            <label htmlFor="course-desc" className={mentorLabelClass}>
              Mô tả khóa học <span className="text-red-500">*</span>
            </label>
            <textarea
              id="course-desc"
              rows={4}
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Mô tả chi tiết nội dung, giá trị và những gì học viên sẽ đạt được..."
              className={`${mentorInputClass} min-h-[88px] max-h-[480px] resize-y overflow-y-auto [transition:none!important]`}
              autoComplete="off"
              spellCheck={false}
              {...GRAMMARLY_OFF}
            />
          </div>
        </div>
      </section>

      <section className={mentorSectionCardClass}>
        <SectionHeader icon={GraduationCap} title="Phân loại & giá" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="course-category" className={mentorLabelClass}>
              Danh mục <span className="text-red-500">*</span>
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
            <div className="flex max-w-xs flex-1 items-stretch overflow-hidden rounded-[10px] border border-slate-300 bg-white focus-within:border-[#8037f4] focus-within:ring-1 focus-within:ring-[#8037f4]/25">
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
                className="min-w-0 flex-1 border-0 bg-transparent px-4 py-3 text-base text-slate-900 outline-none placeholder:text-slate-400 sm:text-sm"
              />
              <span className="flex items-center border-l border-slate-200 bg-slate-50 px-3 text-base font-semibold text-slate-500 sm:text-sm">
                VND
              </span>
            </div>
            <span
              className={`inline-flex items-center rounded-[8px] px-3 py-1 text-sm font-bold uppercase tracking-wide sm:text-xs ${
                isPaid
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                  : "bg-violet-50 text-violet-700 ring-1 ring-violet-200"
              }`}
            >
              {isPaid ? "Trả phí" : "Miễn phí"}
            </span>
          </div>
        </div>
      </section>

      <section className={mentorSectionCardClass}>
        <SectionHeader icon={ListChecks} title="Kết quả học tập" />
        <div className="space-y-2.5">
          {form.outcomes.map((outcome, idx) => (
            <div key={idx} className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-violet-50 text-sm font-bold text-violet-700 sm:text-xs">
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
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-dashed border-violet-300 text-violet-600 transition hover:bg-violet-50"
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
          className={`rounded-[10px] border px-4 py-3 text-base transition-colors sm:text-sm ${
            shakeValidation
              ? mentorValidationShakeClass
              : "border-amber-200 bg-amber-50/80 text-amber-900"
          }`}
          role="alert"
          aria-live="polite"
        >
          <p className="mb-1 flex items-center gap-2 font-semibold">
            <Sparkles className="h-4 w-4 shrink-0 text-red-500" />
            Cần hoàn thiện trước khi tiếp tục
          </p>
          <ul className="list-inside list-disc space-y-0.5">
            {validationMessages.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <CourseCreateFooter onCancel={onCancel} onPrimary={handleNextClick} primaryLabel="Tiếp theo" />
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
    <div className="mt-6 border-t border-slate-200/80 pt-4 sm:-mx-2 sm:px-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
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

/**
 * Render và kiểm tra template prompt (AI-02).
 *
 * Template chỉ chứa phần chữ, biến dạng `{{tên}}`. Nhánh logic (chọn nhánh, ngẫu nhiên, nối chuỗi)
 * nằm trong code builder của từng key (`questionGenPrompt.js`, `evaluationPrompt.js`).
 * Một version gồm nhiều template con: `template` là object { tênPhần: chuỗi | mảng chuỗi }.
 */

const VAR_RE = /\{\{(\w+)\}\}/g;

export class PromptRenderError extends Error {
  constructor(message) {
    super(message);
    this.name = "PromptRenderError";
  }
}

/** Tên các biến `{{x}}` xuất hiện trong chuỗi (không trùng). */
export function templateVariables(text) {
  return [...new Set([...String(text).matchAll(VAR_RE)].map((m) => m[1]))];
}

/**
 * Thay `{{tên}}` trong một lượt duy nhất: giá trị chèn vào không bị render tiếp, nên nội dung
 * người dùng (CV, câu trả lời) chứa `{{x}}` vẫn giữ nguyên. Thiếu biến thì ném lỗi, không để trống.
 */
export function renderTemplate(text, vars = {}, label = "template") {
  if (typeof text !== "string") throw new PromptRenderError(`${label}: template không phải chuỗi`);
  return text.replace(VAR_RE, (_, name) => {
    const value = vars[name];
    if (value === undefined || value === null) {
      throw new PromptRenderError(`${label}: thiếu biến {{${name}}}`);
    }
    return String(value);
  });
}

/** Lấy một phần của template; không có thì ném lỗi rõ ràng. */
export function part(template, name) {
  const value = template?.[name];
  if (value === undefined || value === null) throw new PromptRenderError(`Template thiếu phần "${name}"`);
  return value;
}

/** Render một phần (chuỗi) của template. */
export function renderPart(template, name, vars = {}) {
  return renderTemplate(part(template, name), vars, name);
}

/**
 * Kiểm tra template đủ phần và đủ biến theo spec của key, rồi render thử với bộ biến mẫu.
 * Spec: { parts: { tênPhần: { vars: [...] } | { array: true } } }.
 * @returns {string[]} danh sách lỗi tiếng Việt; rỗng = hợp lệ
 */
export function validateTemplate(spec, template) {
  const errors = [];
  if (!template || typeof template !== "object" || Array.isArray(template)) {
    return ["Template phải là object gồm các phần"];
  }
  for (const [name, rule] of Object.entries(spec.parts)) {
    const value = template[name];
    if (value === undefined || value === null) {
      errors.push(`Thiếu phần "${name}"`);
      continue;
    }
    if (rule.array) {
      if (!Array.isArray(value) || value.length === 0 || !value.every((v) => typeof v === "string" && v.trim())) {
        errors.push(`Phần "${name}" phải là mảng chuỗi không rỗng`);
      } else if (value.some((v) => templateVariables(v).length)) {
        errors.push(`Phần "${name}" không được chứa biến`);
      }
      continue;
    }
    if (typeof value !== "string") {
      errors.push(`Phần "${name}" phải là chuỗi`);
      continue;
    }
    const used = templateVariables(value);
    const expected = rule.vars ?? [];
    const missing = expected.filter((v) => !used.includes(v));
    const unknown = used.filter((v) => !expected.includes(v));
    if (missing.length) errors.push(`Phần "${name}" thiếu biến ${missing.map((v) => `{{${v}}}`).join(", ")}`);
    if (unknown.length) errors.push(`Phần "${name}" có biến lạ ${unknown.map((v) => `{{${v}}}`).join(", ")}`);
    if (!missing.length && !unknown.length) {
      try {
        renderTemplate(value, Object.fromEntries(expected.map((v) => [v, "x"])), name);
      } catch (e) {
        errors.push(e.message);
      }
    }
  }
  return errors;
}

/**
 * Khối few-shot của PromptVersion, chèn vào vị trí `{{versionFewShot}}` cố định trong system prompt.
 * Mảng rỗng → chuỗi rỗng, nên prompt giữ nguyên như trước khi có few-shot.
 * @param {{input: string, output: string}[]} examples
 */
export function renderVersionFewShot(template, examples = []) {
  if (!Array.isArray(examples) || examples.length === 0) return "";
  const items = examples
    .map((e, i) => renderPart(template, "version_few_shot_item", { n: i + 1, input: e.input ?? "", output: e.output ?? "" }))
    .join("\n\n");
  return renderPart(template, "version_few_shot_block", { examples: items });
}

/** Spec dùng chung cho 2 phần few-shot của PromptVersion. */
export const VERSION_FEW_SHOT_PARTS = {
  version_few_shot_block: { vars: ["examples"] },
  version_few_shot_item: { vars: ["n", "input", "output"] },
};

export const VERSION_FEW_SHOT_TEMPLATE = {
  version_few_shot_block: "## VÍ DỤ ĐÃ ĐƯỢC KIỂM DUYỆT\nCác ví dụ dưới đây do kiểm duyệt viên xác nhận. Dùng làm chuẩn tham chiếu.\n\n{{examples}}\n\n",
  version_few_shot_item: "### Ví dụ {{n}}\nĐầu vào:\n{{input}}\nKết quả chuẩn:\n{{output}}",
};

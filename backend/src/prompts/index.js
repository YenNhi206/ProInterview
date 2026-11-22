/**
 * Danh sách prompt có phiên bản (AI-02). Prompt mới (CO-04, JB-07, AI-08…) tự đăng ký ở đây khi làm
 * task của mình: thêm key, tiền tố version riêng, spec và bản mặc định.
 *
 * Quy ước version: `<tiền tố>-vN`, chuỗi duy nhất trên toàn bảng (Quality Dashboard nhóm theo chuỗi).
 */
import deepFreezeModule from "./deepFreeze.js";
import {
  QUESTION_GEN_KEY, QUESTION_GEN_DEFAULT_VERSION, QUESTION_GEN_SPEC, QUESTION_GEN_DEFAULT_TEMPLATE,
} from "./questionGenPrompt.js";
import {
  EVALUATION_KEY, EVALUATION_DEFAULT_VERSION, EVALUATION_SPEC, EVALUATION_DEFAULT_TEMPLATE,
} from "./evaluationPrompt.js";
import {
  COMPANY_QUESTION_GEN_KEY, COMPANY_QUESTION_GEN_DEFAULT_VERSION, COMPANY_QUESTION_GEN_SPEC,
  COMPANY_QUESTION_GEN_DEFAULT_TEMPLATE,
} from "./companyQuestionGenPrompt.js";

export const PROMPT_REGISTRY = deepFreezeModule({
  [QUESTION_GEN_KEY]: {
    versionPrefix: "followup",
    spec: QUESTION_GEN_SPEC,
    default: { version: QUESTION_GEN_DEFAULT_VERSION, template: QUESTION_GEN_DEFAULT_TEMPLATE, fewShotExamples: [] },
  },
  [EVALUATION_KEY]: {
    versionPrefix: "eval",
    spec: EVALUATION_SPEC,
    default: { version: EVALUATION_DEFAULT_VERSION, template: EVALUATION_DEFAULT_TEMPLATE, fewShotExamples: [] },
  },
  // CO-04: bộ câu nháp cho công ty theo roleCategory (không có CV/JD ứng viên).
  [COMPANY_QUESTION_GEN_KEY]: {
    versionPrefix: "companyq",
    spec: COMPANY_QUESTION_GEN_SPEC,
    default: {
      version: COMPANY_QUESTION_GEN_DEFAULT_VERSION, template: COMPANY_QUESTION_GEN_DEFAULT_TEMPLATE, fewShotExamples: [],
    },
  },
});

export const PROMPT_KEYS = Object.keys(PROMPT_REGISTRY);

/** Định dạng chung `<tiền tố>-vN`. */
export const VERSION_NAME_RE = /^[a-z][a-z0-9_]*-v\d+$/;

/** Kiểm tra tên version theo quy ước; trả thông báo lỗi tiếng Việt hoặc null. */
export function versionNameError(key, version) {
  if (typeof version !== "string" || !VERSION_NAME_RE.test(version)) {
    return `Tên version "${version}" phải có dạng <tiền tố>-vN (ví dụ eval-v2)`;
  }
  const prefix = PROMPT_REGISTRY[key]?.versionPrefix;
  if (prefix && !version.startsWith(`${prefix}-v`)) {
    return `Version của key "${key}" phải bắt đầu bằng "${prefix}-v"`;
  }
  return null;
}

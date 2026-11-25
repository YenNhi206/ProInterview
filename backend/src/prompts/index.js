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
import {
  COURSE_PRESCREEN_KEY, COURSE_PRESCREEN_DEFAULT_VERSION, COURSE_PRESCREEN_SPEC, COURSE_PRESCREEN_DEFAULT_TEMPLATE,
} from "./coursePrescreenPrompt.js";
import {
  RUBRIC_SCORING_KEY, RUBRIC_SCORING_DEFAULT_VERSION, RUBRIC_SCORING_SPEC, RUBRIC_SCORING_DEFAULT_TEMPLATE,
} from "./rubricScoringPrompt.js";
import {
  RUBRIC_REVIEW_KEY, RUBRIC_REVIEW_DEFAULT_VERSION, RUBRIC_REVIEW_SPEC, RUBRIC_REVIEW_DEFAULT_TEMPLATE,
} from "./rubricReviewPrompt.js";
import {
  RUBRIC_ANCHOR_KEY, RUBRIC_ANCHOR_DEFAULT_VERSION, RUBRIC_ANCHOR_SPEC, RUBRIC_ANCHOR_DEFAULT_TEMPLATE,
} from "./rubricAnchorPrompt.js";

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
  // AI-08: sàng lọc khóa học khi mentor gửi duyệt.
  [COURSE_PRESCREEN_KEY]: {
    versionPrefix: "prescreen",
    spec: COURSE_PRESCREEN_SPEC,
    default: {
      version: COURSE_PRESCREEN_DEFAULT_VERSION, template: COURSE_PRESCREEN_DEFAULT_TEMPLATE, fewShotExamples: [],
    },
  },
  // JB-07: chấm câu doanh nghiệp theo rubric công ty (thang 0–5 + trích dẫn bằng chứng).
  [RUBRIC_SCORING_KEY]: {
    versionPrefix: "rubric",
    spec: RUBRIC_SCORING_SPEC,
    default: {
      version: RUBRIC_SCORING_DEFAULT_VERSION, template: RUBRIC_SCORING_DEFAULT_TEMPLATE, fewShotExamples: [],
    },
  },
  // CO-09: AI gợi ý cho Platform Moderator khi duyệt rubric công ty (map SHRM, thang mơ hồ / trùng lặp).
  [RUBRIC_REVIEW_KEY]: {
    versionPrefix: "rubricreview",
    spec: RUBRIC_REVIEW_SPEC,
    default: {
      version: RUBRIC_REVIEW_DEFAULT_VERSION, template: RUBRIC_REVIEW_DEFAULT_TEMPLATE, fewShotExamples: [],
    },
  },
  // AI-18: tóm tắt ví dụ neo 0–5 từ rubric công ty đã duyệt (ẩn danh) để thêm vào prompt chấm.
  [RUBRIC_ANCHOR_KEY]: {
    versionPrefix: "anchor",
    spec: RUBRIC_ANCHOR_SPEC,
    default: {
      version: RUBRIC_ANCHOR_DEFAULT_VERSION, template: RUBRIC_ANCHOR_DEFAULT_TEMPLATE, fewShotExamples: [],
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

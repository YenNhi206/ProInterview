import Joi from "joi";
import { QUEUE_ITEM_TYPES, MODERATION_ITEM_STATUSES } from "../models/ModerationItem.js";
import { QUESTION_SOURCES } from "../models/QuestionBank.js";
import { AI_IMPROVEMENT_STATUSES, AI_IMPROVEMENT_TARGETS } from "../models/AIImprovementProposal.js";
import { COMPETENCY_LIBRARY } from "../services/competencyFramework.js";

/** Validate cho /api/moderator/* (spec S1 §3). */
const objectId = Joi.string().hex().length(24);
const competencyId = Joi.string().valid(...Object.keys(COMPETENCY_LIBRARY));
const questionText = Joi.string().trim().min(10).max(500);
const reason = Joi.string().trim().min(3).max(500);
const page = Joi.number().integer().min(1).default(1);
const limit = Joi.number().integer().min(1).max(100).default(20);
const score = Joi.number().min(0).max(5);

export const listQuestionsQuery = Joi.object({
  status: Joi.string().valid("pending_review", "approved", "deprecated"),
  competencyId: Joi.string().trim().max(64),
  source: Joi.string().valid(...QUESTION_SOURCES),
  q: Joi.string().trim().max(200).allow(""),
  sort: Joi.string().valid("flagCount", "usageCount", "updatedAt").default("updatedAt"),
  page,
  limit,
});

export const createQuestionBody = Joi.object({
  text: questionText.required(),
  competencyId: competencyId.required(),
  layer: Joi.string().valid("theory", "project", "behavior").default("behavior"),
  language: Joi.string().valid("vi", "en").default("vi"),
});

export const editQuestionBody = Joi.object({
  text: questionText,
  competencyId,
  reason: reason.required(),
}).or("text", "competencyId");

export const approveQuestionBody = Joi.object({ note: Joi.string().trim().max(500).allow("").default("") });
export const deprecateQuestionBody = Joi.object({ reason: reason.required() });

export const bulkQuestionsBody = Joi.object({
  ids: Joi.array().items(objectId).min(1).max(100).unique().required(),
  action: Joi.string().valid("approve", "deprecate").required(),
  reason: Joi.when("action", { is: "deprecate", then: reason.required(), otherwise: Joi.string().trim().max(500).allow("") }),
});

export const listQueueQuery = Joi.object({
  // Lọc được 3 loại phỏng vấn và báo cáo tin tuyển dụng (JB-04); không gồm course_prescreen (AI-08).
  type: Joi.string().valid(...QUEUE_ITEM_TYPES),
  status: Joi.string().valid(...MODERATION_ITEM_STATUSES),
  priority: Joi.string().valid("low", "normal", "high"),
  assignee: Joi.string().valid("me", "unassigned"),
  page,
  limit,
});

export const resolveQueueBody = Joi.object({
  action: Joi.string().valid("dismiss", "deprecate_question", "edit_question", "override_score", "hide_job").required(),
  note: Joi.string().trim().max(1000).allow("").default(""),
  payload: Joi.alternatives().conditional("action", [
    {
      is: "override_score",
      then: Joi.object({
        scores: Joi.object({
          clarity: score.required(),
          structure: score.required(),
          relevance: score.required(),
          credibility: score.required(),
        }).required(),
        overall: score,
        shrmLevel: Joi.string().valid("excellent", "proficient", "developing").required(),
      }).required(),
    },
    {
      is: "edit_question",
      then: Joi.object({ text: questionText, competencyId }).or("text", "competencyId").required(),
    },
    { is: "deprecate_question", then: Joi.object({ reason }).default({}) },
    { is: "dismiss", then: Joi.object().max(0).default({}) },
    // JB-04: lý do ẩn tin lấy từ `note` (≥ 5 ký tự, kiểm ở service).
    { is: "hide_job", then: Joi.object().max(0).default({}) },
  ]),
});

export const qualityStatsQuery = Joi.object({
  from: Joi.date().iso(),
  to: Joi.date().iso(),
});

/** Validate → { value } hoặc { error: "message" } (gộp mọi lỗi). */
export function validate(schema, input) {
  const { error, value } = schema.validate(input ?? {}, { abortEarly: false, stripUnknown: true });
  if (error) return { error: error.details.map((d) => d.message).join("; ") };
  return { value };
}

/** JB-04 / JB-17: danh sách tin cho Platform Moderator. */
export const listModeratorJobsQuery = Joi.object({
  status: Joi.string().valid("published", "hidden"),
  reported: Joi.boolean(),
  q: Joi.string().trim().max(150).allow(""),
  page,
  limit,
});

/** JB-04: ẩn / bỏ ẩn tin. Ẩn bắt buộc lý do (≥ 5 ký tự). */
export const jobVisibilityBody = Joi.object({
  hidden: Joi.boolean().required(),
  reason: Joi.when("hidden", { is: true, then: Joi.string().trim().min(5).max(1000).required(), otherwise: Joi.string().trim().max(1000).allow("").default("") }),
});

/** AI-05: danh sách đề xuất cải tiến AI. */
export const listAiImprovementsQuery = Joi.object({
  status: Joi.string().valid(...AI_IMPROVEMENT_STATUSES),
  target: Joi.string().valid(...AI_IMPROVEMENT_TARGETS),
  page,
  limit,
});

/** AI-05: duyệt / từ chối / rollback / dựng lại. Từ chối và rollback bắt buộc lý do. */
export const reviewAiImprovementBody = Joi.object({
  action: Joi.string().valid("approve", "reject", "rollback", "rebase").required(),
  note: Joi.when("action", {
    is: Joi.valid("reject", "rollback"),
    then: Joi.string().trim().min(3).max(1000).required(),
    otherwise: Joi.string().trim().max(1000).allow("").default(""),
  }),
});

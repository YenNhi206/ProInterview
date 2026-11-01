import Joi from "joi";
import { AI_REPORT_TARGET_TYPES, AI_REPORT_REASON_CODES } from "../models/Report.js";

/** POST /api/reports với targetType interview_question | interview_evaluation (trang Feedback). */
const aiReportSchema = Joi.object({
  targetType: Joi.string().valid(...AI_REPORT_TARGET_TYPES).required(),
  /** sessionId */
  targetId: Joi.string().hex().length(24).required(),
  questionIndex: Joi.number().integer().min(0).max(50).required(),
  reasonCode: Joi.string().valid(...AI_REPORT_REASON_CODES).required(),
  note: Joi.string().allow("").trim().max(500).default(""),
}).unknown(false);

export function validateAiReport(body) {
  return aiReportSchema.validate(body ?? {}, { abortEarly: false });
}

export function formatJoiError(error) {
  return error.details.map((d) => d.message).join("; ");
}

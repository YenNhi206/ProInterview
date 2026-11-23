import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * ModerationItem — hàng đợi kiểm định của moderator (/api/moderator/queue).
 *
 * Sinh từ 2 nguồn:
 *   - Người dùng báo sai ở trang Feedback → Report (interview_question | interview_evaluation)
 *     → item `question_report` / `evaluation_report`.
 *   - LLM chấm thiếu tiêu chí sau khi retry → item `evaluation_incomplete` (tự động, priority high).
 *
 * `snapshot` chụp câu hỏi / transcript / điểm AI tại thời điểm tạo để moderator review đúng
 * thứ người dùng đã thấy, kể cả khi câu hỏi trong bank bị sửa sau đó.
 */
/** 3 loại của hàng đợi HITL phỏng vấn (`/moderator/queue` mặc định chỉ lấy các loại này). */
export const INTERVIEW_MODERATION_ITEM_TYPES = ["question_report", "evaluation_report", "evaluation_incomplete"];
/** JB-04: báo cáo tin tuyển dụng — màn riêng (JB-17), không lẫn vào hàng đợi phỏng vấn. */
export const JOB_POST_REPORT_ITEM_TYPE = "job_post_report";
export const MODERATION_ITEM_TYPES = [...INTERVIEW_MODERATION_ITEM_TYPES, JOB_POST_REPORT_ITEM_TYPE];
export const MODERATION_ITEM_STATUSES = ["open", "in_review", "resolved", "dismissed"];
export const MODERATION_RESOLUTION_ACTIONS = ["dismiss", "deprecate_question", "edit_question", "override_score", "hide_job"];
/** Sort theo chuỗi "priority" ra normal > low > high (alphabet) — sắp xếp hàng đợi bằng rank số. */
export const PRIORITY_RANK = { low: 1, normal: 2, high: 3 };

const moderationItemSchema = new Schema(
  {
    type: { type: String, enum: MODERATION_ITEM_TYPES, required: true },
    status: { type: String, enum: MODERATION_ITEM_STATUSES, default: "open" },
    priority: { type: String, enum: ["low", "normal", "high"], default: "normal" },
    /** Suy ra từ `priority` (pre-validate) — chỉ dùng để sort. */
    priorityRank: { type: Number, default: PRIORITY_RANK.normal },

    refs: {
      sessionId: { type: Schema.Types.ObjectId, ref: "InterviewSession", default: null },
      questionIndex: { type: Number, default: null },
      questionBankId: { type: Schema.Types.ObjectId, ref: "QuestionBank", default: null },
      reportId: { type: Schema.Types.ObjectId, ref: "Report", default: null },
      /** User liên quan: người báo (report) hoặc chủ session (evaluation_incomplete). */
      userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
      /** JB-04: tin tuyển dụng bị báo cáo (`job_post_report`). */
      jobPostId: { type: Schema.Types.ObjectId, ref: "JobPost", default: null },
      companyId: { type: Schema.Types.ObjectId, ref: "Company", default: null },
    },

    snapshot: {
      questionText: { type: String, default: "" },
      transcript: { type: String, default: "" },
      /** perQuestion evaluation tại thời điểm tạo: { scores, overall, shrmLevel, incompleteFields, … } */
      aiEvaluation: { type: Schema.Types.Mixed, default: null },
      /** JB-04: tiêu đề tin và tên công ty lúc bị báo cáo. */
      jobTitle: { type: String, default: "" },
      companyName: { type: String, default: "" },
    },

    assignee: { type: Schema.Types.ObjectId, ref: "User", default: null },

    resolution: {
      action: { type: String, enum: [...MODERATION_RESOLUTION_ACTIONS, null], default: null },
      note: { type: String, default: "" },
      by: { type: Schema.Types.ObjectId, ref: "User", default: null },
      at: { type: Date, default: null },
    },
  },
  { collection: "moderation_items", timestamps: true },
);

moderationItemSchema.pre("validate", function syncPriorityRank() {
  this.priorityRank = PRIORITY_RANK[this.priority] ?? PRIORITY_RANK.normal;
});

// Hàng đợi: item mở, cũ nhất trước (DECISIONS.md #16 — không còn xếp theo ưu tiên).
moderationItemSchema.index({ status: 1, createdAt: 1 });
// Index cũ (ưu tiên trước) giữ lại cho lọc theo priority; bỏ khi chắc không còn dùng.
moderationItemSchema.index({ status: 1, priorityRank: -1, createdAt: 1 });
// Mỗi report chỉ sinh đúng 1 item. Spec ghi "unique sparse"; dùng partial index vì refs.reportId
// mặc định null (sparse vẫn index giá trị null → item không có report sẽ đụng nhau).
moderationItemSchema.index(
  { "refs.reportId": 1 },
  { unique: true, partialFilterExpression: { "refs.reportId": { $type: "objectId" } } },
);
// evaluation_incomplete idempotent: gọi evaluate nhiều lần vẫn chỉ 1 item / (session, câu).
// JB-04: các báo cáo đang mở của một tin (đóng hàng loạt khi tin bị ẩn).
moderationItemSchema.index(
  { "refs.jobPostId": 1, status: 1 },
  { partialFilterExpression: { type: "job_post_report" } },
);
moderationItemSchema.index(
  { type: 1, "refs.sessionId": 1, "refs.questionIndex": 1 },
  { unique: true, partialFilterExpression: { type: "evaluation_incomplete" } },
);

export const ModerationItem =
  mongoose.models.ModerationItem ?? mongoose.model("ModerationItem", moderationItemSchema);

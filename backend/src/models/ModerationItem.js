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
export const MODERATION_ITEM_TYPES = ["question_report", "evaluation_report", "evaluation_incomplete"];
export const MODERATION_ITEM_STATUSES = ["open", "in_review", "resolved", "dismissed"];
export const MODERATION_RESOLUTION_ACTIONS = ["dismiss", "deprecate_question", "edit_question", "override_score"];
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
    },

    snapshot: {
      questionText: { type: String, default: "" },
      transcript: { type: String, default: "" },
      /** perQuestion evaluation tại thời điểm tạo: { scores, overall, shrmLevel, incompleteFields, … } */
      aiEvaluation: { type: Schema.Types.Mixed, default: null },
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

// Hàng đợi: item mở, ưu tiên cao trước, cũ nhất trước.
moderationItemSchema.index({ status: 1, priorityRank: -1, createdAt: 1 });
// Mỗi report chỉ sinh đúng 1 item. Spec ghi "unique sparse"; dùng partial index vì refs.reportId
// mặc định null (sparse vẫn index giá trị null → item không có report sẽ đụng nhau).
moderationItemSchema.index(
  { "refs.reportId": 1 },
  { unique: true, partialFilterExpression: { "refs.reportId": { $type: "objectId" } } },
);
// evaluation_incomplete idempotent: gọi evaluate nhiều lần vẫn chỉ 1 item / (session, câu).
moderationItemSchema.index(
  { type: 1, "refs.sessionId": 1, "refs.questionIndex": 1 },
  { unique: true, partialFilterExpression: { type: "evaluation_incomplete" } },
);

export const ModerationItem =
  mongoose.models.ModerationItem ?? mongoose.model("ModerationItem", moderationItemSchema);

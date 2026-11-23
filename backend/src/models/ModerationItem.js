import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * ModerationItem — hàng đợi kiểm định của moderator (/api/moderator/queue).
 *
 * Sinh từ 3 nguồn:
 *   - Người dùng báo sai ở trang Feedback → Report (interview_question | interview_evaluation)
 *     → item `question_report` / `evaluation_report`.
 *   - LLM chấm thiếu tiêu chí sau khi retry → item `evaluation_incomplete` (tự động, priority high).
 *   - AI sàng lọc khóa học khi mentor gửi duyệt → item `course_prescreen` (AI-08, không vào hàng đợi HITL).
 *
 * `snapshot` chụp câu hỏi / transcript / điểm AI tại thời điểm tạo để moderator review đúng
 * thứ người dùng đã thấy, kể cả khi câu hỏi trong bank bị sửa sau đó.
 */
/**
 * Loại hiện trong hàng đợi HITL phỏng vấn (/api/moderator/queue mặc định, KPI hàng đợi). `course_prescreen`
 * (AI-08) chỉ ghi lại kết quả AI sàng lọc khóa học và đóng khi moderator duyệt / từ chối khóa,
 * moderator xem ở /moderator/courses, không xử lý qua hàng đợi này.
 */
export const HITL_QUEUE_TYPES = ["question_report", "evaluation_report", "evaluation_incomplete"];
/** JB-04: báo cáo tin tuyển dụng — màn riêng (JB-17, `?type=job_post_report`), không lẫn vào hàng đợi phỏng vấn. */
export const JOB_POST_REPORT_ITEM_TYPE = "job_post_report";
/** Loại xem / nhận / xử lý được qua /api/moderator/queue/* (lọc `type` rõ ràng). Không gồm `course_prescreen`. */
export const QUEUE_ITEM_TYPES = [...HITL_QUEUE_TYPES, JOB_POST_REPORT_ITEM_TYPE];
export const MODERATION_ITEM_TYPES = [...HITL_QUEUE_TYPES, "course_prescreen", JOB_POST_REPORT_ITEM_TYPE];
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
      /** AI-08: khóa học được AI sàng lọc (type `course_prescreen`). */
      courseId: { type: Schema.Types.ObjectId, ref: "Course", default: null },
      /** User liên quan: người báo (report) hoặc chủ session (evaluation_incomplete). */
      userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
      /** JB-04: tin tuyển dụng bị báo cáo (`job_post_report`). */
      jobPostId: { type: Schema.Types.ObjectId, ref: "JobPost", default: null },
      companyId: { type: Schema.Types.ObjectId, ref: "Company", default: null },
    },

    snapshot: {
      /** course_prescreen: tiêu đề khóa. */
      courseTitle: { type: String, default: "" },
      /** course_prescreen: kết quả sàng lọc tại thời điểm ghi { score, flags, summary, model, promptVersion }. */
      aiPrescreen: { type: Schema.Types.Mixed, default: null },
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

// course_prescreen: 1 item / khóa, mỗi lần gửi duyệt cập nhật lại (upsert).
moderationItemSchema.index(
  { type: 1, "refs.courseId": 1 },
  { unique: true, partialFilterExpression: { type: "course_prescreen" }, name: "course_prescreen_per_course" },
);

export const ModerationItem =
  mongoose.models.ModerationItem ?? mongoose.model("ModerationItem", moderationItemSchema);

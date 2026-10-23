import mongoose from "mongoose";
import { createHash } from "node:crypto";

const { Schema } = mongoose;

/**
 * QuestionBank — kho câu hỏi phỏng vấn được kiểm duyệt.
 *
 * Đây là substrate DÙNG CHUNG cho hai luồng:
 *   1. Moderator (human-in-the-loop): câu hỏi do LLM sinh ra được thu hoạch vào đây ở
 *      trạng thái `pending_review`; moderator sửa/duyệt/khai tử trước khi vào pool production.
 *   2. Enterprise: interview template của tổ chức là các câu hỏi cùng schema nhưng gắn
 *      `orgId` — chỉ dùng trong phạm vi tổ chức đó, không lẫn vào pool chung.
 *
 * Shape câu hỏi giữ KHỚP với subdoc `questions[]` trong InterviewSession để câu hỏi
 * chảy hai chiều mà không cần mapper: session → bank (thu hoạch) và bank → session (phục vụ).
 */

const StarGuidanceSchema = new Schema(
  {
    situation: [{ type: String }],
    task: [{ type: String }],
    action: [{ type: String }],
    result: [{ type: String }],
  },
  { _id: false },
);

/** Lần duyệt gần nhất — lịch sử đầy đủ nằm ở `history[]`. */
const ModerationSchema = new Schema(
  {
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    /** Lý do từ chối / khai tử, hoặc ghi chú khi duyệt. */
    reason: { type: String, default: "" },
    lastAction: {
      type: String,
      enum: ["", "approve", "reject", "edit", "deprecate", "restore"],
      default: "",
    },
  },
  { _id: false },
);

const HistoryEntrySchema = new Schema(
  {
    action: {
      type: String,
      enum: ["create", "approve", "reject", "edit", "deprecate", "restore"],
      required: true,
    },
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reason: { type: String, default: "" },
    /** Nội dung câu hỏi TRƯỚC khi sửa — để truy vết moderator đã đổi gì. */
    previousQuestion: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

/** Nguồn gốc — cần cho audit prompt drift và lọc training data. */
const ProvenanceSchema = new Schema(
  {
    /** Session đã sinh ra câu hỏi này (khi source = ai_generated). */
    originSessionId: { type: Schema.Types.ObjectId, ref: "InterviewSession", default: null },
    llmModel: { type: String, default: "" },
    llmProvider: { type: String, default: "" },
    /** Phiên bản prompt lúc sinh — đổi prompt thì câu cũ vẫn truy được về bản prompt gốc. */
    promptVersion: { type: String, default: "" },
    generatedAt: { type: Date, default: null },
  },
  { _id: false },
);

/**
 * Thống kê sử dụng — nuôi few-shot examples (xem getFewShotExamples trong
 * interviewQuestionService.js) và quality dashboard của moderator.
 */
const StatsSchema = new Schema(
  {
    timesServed: { type: Number, default: 0 },
    /** Điểm trung bình (0–5) ứng viên đạt được khi trả lời câu này. */
    avgAnswerScore: { type: Number, default: null },
    answersScored: { type: Number, default: 0 },
    /** Số lần bị ứng viên/hệ thống gắn cờ (lạc đề, sai sự thật, hallucination). */
    flagCount: { type: Number, default: 0 },
    lastServedAt: { type: Date, default: null },
  },
  { _id: false },
);

const questionBankSchema = new Schema(
  {
    // ----- Nội dung câu hỏi (khớp InterviewSession.questions[]) -----
    question: { type: String, required: true, trim: true },
    layer: { type: String, enum: ["theory", "project", "behavior"] },
    seniority: { type: String, enum: ["intern", "junior", "middle", "senior"] },

    // ----- SHRM/DDI metadata -----
    competencyId: { type: String, default: "", index: true },
    competencyName: { type: String, default: "" },
    ddiKeyActionTargeted: { type: String, default: "" },
    shrmRubricExcellent: { type: String, default: "" },

    starGuidance: { type: StarGuidanceSchema, default: () => ({}) },
    expectedKeywords: [{ type: String }],
    deepDive: [{ type: String }],

    /** Nhóm vai trò (frontend, backend, product, …) — xem detectRoleCategory(). */
    roleCategory: { type: String, default: "", index: true },

    // ----- Phân loại & phạm vi -----
    source: {
      type: String,
      enum: ["ai_generated", "baseline", "moderator_authored", "enterprise_template"],
      required: true,
      index: true,
    },
    /**
     * null = pool dùng chung toàn hệ thống.
     * Có giá trị = câu hỏi riêng của tổ chức (Enterprise template), không phục vụ user ngoài tổ chức.
     * `ref` trỏ tới model `Organization` sẽ được thêm ở package Enterprise — tới lúc đó
     * đừng gọi .populate("orgId") vì model chưa đăng ký.
     */
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", default: null, index: true },

    // ----- Vòng đời kiểm duyệt -----
    status: {
      type: String,
      enum: ["draft", "pending_review", "approved", "rejected", "deprecated"],
      default: "pending_review",
      required: true,
      index: true,
    },
    moderation: { type: ModerationSchema, default: () => ({}) },
    history: { type: [HistoryEntrySchema], default: [] },

    provenance: { type: ProvenanceSchema, default: () => ({}) },
    stats: { type: StatsSchema, default: () => ({}) },

    /** Chặn trùng lặp khi thu hoạch cùng một câu từ nhiều session — SHA-1 của text đã chuẩn hóa. */
    textHash: { type: String, required: true, index: true },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { collection: "question_bank", timestamps: true },
);

// Hàng đợi duyệt của moderator: lọc theo trạng thái, cũ nhất trước.
questionBankSchema.index({ status: 1, createdAt: 1 });
// Phục vụ câu hỏi: pool chung đã duyệt, theo vai trò + năng lực.
questionBankSchema.index({ status: 1, orgId: 1, roleCategory: 1, competencyId: 1 });
// Chống trùng: cùng text trong cùng phạm vi (global hoặc 1 tổ chức) chỉ tồn tại một bản.
questionBankSchema.index({ textHash: 1, orgId: 1 }, { unique: true });
// Quality dashboard: câu bị gắn cờ nhiều nhất.
questionBankSchema.index({ "stats.flagCount": -1 });

export const QuestionBank =
  mongoose.models.QuestionBank ?? mongoose.model("QuestionBank", questionBankSchema);

/**
 * Hash dùng cho `textHash` — chuẩn hóa trước khi băm để hai câu chỉ khác hoa/thường,
 * khoảng trắng hay dấu câu cuối không bị coi là hai câu khác nhau.
 */
export function hashQuestionText(text) {
  const normalized = String(text ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    // Cắt dấu câu SAU khi trim — nếu làm trước, "… ?  " còn khoảng trắng đuôi nên
    // neo $ không khớp và dấu "?" sót lại, hai câu giống nhau ra hai hash khác nhau.
    .replace(/[.?!,;:]+$/g, "")
    .trim();
  return createHash("sha1").update(normalized).digest("hex");
}

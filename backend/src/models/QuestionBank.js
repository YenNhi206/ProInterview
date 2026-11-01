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
 * Thống kê điểm — nuôi few-shot examples và quality dashboard.
 * `timesServed` / `flagCount` / `lastServedAt` là field cũ, giữ để tương thích nhưng KHÔNG còn
 * được ghi: dùng `usageCount` / `flagCount` / `lastUsedAt` ở cấp gốc (spec S1 §1.1).
 */
const StatsSchema = new Schema(
  {
    timesServed: { type: Number, default: 0 },
    /** Điểm trung bình (0–5) ứng viên đạt được khi trả lời câu này. */
    avgAnswerScore: { type: Number, default: null },
    answersScored: { type: Number, default: 0 },
    flagCount: { type: Number, default: 0 },
    lastServedAt: { type: Date, default: null },
  },
  { _id: false },
);

/** Mỗi lần moderator sửa câu — bản trước giữ ở `originalText` + chuỗi revisions. */
const RevisionSchema = new Schema(
  {
    text: { type: String, required: true },
    competencyId: { type: String, default: "" },
    editedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    editedAt: { type: Date, default: Date.now },
    reason: { type: String, default: "" },
  },
  { _id: false },
);

const ReviewSchema = new Schema(
  {
    by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    at: { type: Date, default: null },
    note: { type: String, default: "" },
  },
  { _id: false },
);

const DeprecationSchema = new Schema(
  {
    by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    at: { type: Date, default: null },
    reason: { type: String, default: "" },
  },
  { _id: false },
);

/** Nguồn spec S1. Giá trị cũ (ai_generated, …) vẫn được nhận để không vỡ dữ liệu/ code cũ. */
export const QUESTION_SOURCES = ["baseline", "llm_followup", "moderator", "org_template"];
const LEGACY_QUESTION_SOURCES = ["ai_generated", "moderator_authored", "enterprise_template"];

const questionBankSchema = new Schema(
  {
    // ----- Nội dung câu hỏi (khớp InterviewSession.questions[]) -----
    /** Bản đang phục vụ. `question` là alias để code cũ / shape session vẫn dùng được. */
    text: { type: String, required: true, trim: true, alias: "question" },
    /** Bản LLM (hoặc người tạo) sinh ra ban đầu — không bao giờ đổi, kể cả khi moderator sửa. */
    originalText: { type: String, default: "" },
    language: { type: String, enum: ["vi", "en"], default: "vi" },
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
      enum: [...QUESTION_SOURCES, ...LEGACY_QUESTION_SOURCES],
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
    revisions: { type: [RevisionSchema], default: [] },
    review: { type: ReviewSchema, default: () => ({}) },
    deprecation: { type: DeprecationSchema, default: () => ({}) },

    provenance: { type: ProvenanceSchema, default: () => ({}) },
    /** Model + phiên bản prompt đã sinh câu — dùng để đo prompt drift (byPromptVersion). */
    generatedBy: {
      model: { type: String, default: "" },
      promptVersion: { type: String, default: "" },
    },
    stats: { type: StatsSchema, default: () => ({}) },

    // ----- Sử dụng & gắn cờ -----
    usageCount: { type: Number, default: 0 },
    /** Số report AI (interview_question) trỏ tới câu này. */
    flagCount: { type: Number, default: 0 },
    lastUsedAt: { type: Date, default: null },
    /** Tối đa 20 session gần nhất đã phục vụ câu này — moderator xem câu trả lời mẫu. */
    sampleSessionIds: [{ type: Schema.Types.ObjectId, ref: "InterviewSession" }],

    /** Chặn trùng lặp khi thu hoạch cùng một câu từ nhiều session — SHA-256 của text đã chuẩn hóa. */
    textHash: { type: String, required: true, index: true },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { collection: "question_bank", timestamps: true },
);

// Hàng đợi duyệt của moderator: lọc theo trạng thái, cũ nhất trước.
questionBankSchema.index({ status: 1, createdAt: 1 });
// Danh sách /moderator/questions lọc theo status + competency, mới cập nhật trước.
questionBankSchema.index({ status: 1, competencyId: 1, updatedAt: -1 });
// Phục vụ câu hỏi: pool chung đã duyệt, theo vai trò + năng lực.
questionBankSchema.index({ status: 1, orgId: 1, roleCategory: 1, competencyId: 1 });
// Chống trùng: cùng text trong cùng phạm vi (global hoặc 1 tổ chức) chỉ tồn tại một bản.
questionBankSchema.index({ textHash: 1, orgId: 1 }, { unique: true });
// Quality dashboard: câu bị gắn cờ nhiều nhất.
questionBankSchema.index({ flagCount: -1 });

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
  return createHash("sha256").update(normalized).digest("hex");
}

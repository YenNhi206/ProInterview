import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Đề xuất cải tiến AI (AI-03, "Learning from Reviews", REQ AIS-06).
 *
 * `aiImprovementMinerJob` gom ModerationItem đã xử lý theo nhóm (`groupKey`); nhóm đủ ngưỡng thì
 * tạo 1 đề xuất và 1 PromptVersion mới (chưa bật) chứa few-shot rút từ quyết định của moderator.
 * Platform Mod duyệt thì bật version đó (AI-05); backtest ghi vào đề xuất ở AI-04.
 *
 * - `target`: prompt bị ảnh hưởng: `evaluation` (chấm điểm) hoặc `question_gen` (sinh câu follow-up).
 * - `groupKey`: nhóm bằng chứng. `evaluation` → key năng lực của câu (`competencyId`, câu baseline
 *   chưa có key thì `_general`); `question_gen` → `roleCategory` của câu trong bank (`_general` nếu trống).
 * - Mỗi ModerationItem chỉ làm bằng chứng cho 1 đề xuất (`evidence.moderationItemIds`, unique).
 * - Mỗi (target, kind, groupKey) tối đa 1 đề xuất `proposed` (partial unique index).
 *
 * - `rubric_anchor` (AI-18): ví dụ neo từ rubric ≥ 3 công ty cùng `shrmKey`; `groupKey` = shrmKey,
 *   không có ModerationItem. Backtest làm tăng độ lệch → tự `rejected` (`review.by` null).
 *
 * State machine: `proposed` → `approved` | `rejected`; `approved` → `rolled_back`.
 */
export const AI_IMPROVEMENT_TARGETS = ["question_gen", "evaluation"];
export const AI_IMPROVEMENT_KINDS = ["few_shot", "prompt_change", "calibration", "rubric_anchor"];
export const AI_IMPROVEMENT_STATUSES = ["proposed", "approved", "rejected", "rolled_back"];

const fewShotSchema = new Schema(
  {
    input: { type: String, default: "" },
    output: { type: String, default: "" },
    note: { type: String, default: "" },
  },
  { _id: false },
);

const promptSideSchema = new Schema(
  {
    promptKey: { type: String, default: "" },
    version: { type: String, default: "" },
    fewShotExamples: { type: [fewShotSchema], default: [] },
  },
  { _id: false },
);

const aiImprovementProposalSchema = new Schema(
  {
    target: { type: String, enum: AI_IMPROVEMENT_TARGETS, required: true },
    kind: { type: String, enum: AI_IMPROVEMENT_KINDS, required: true },
    groupKey: { type: String, required: true, trim: true },
    status: { type: String, enum: AI_IMPROVEMENT_STATUSES, default: "proposed" },
    summary: { type: String, default: "" },

    evidence: {
      moderationItemIds: [{ type: Schema.Types.ObjectId, ref: "ModerationItem" }],
      /** Số lượt chấm lại (`override_score`) hoặc sửa / khai tử câu trong nhóm. */
      overrideCount: { type: Number, default: 0 },
      /** Trung bình (điểm moderator − điểm AI) trên thang 0–5; chỉ có với `evaluation`. */
      avgScoreDelta: { type: Number, default: null },
      // rubric_anchor (AI-18)
      shrmKey: { type: String, default: "" },
      companyCount: { type: Number, default: 0 },
      rubricIds: [{ type: Schema.Types.ObjectId, ref: "CompanyRubric" }],
      roleCategories: { type: [String], default: undefined },
      /** Version prompt `rubric_anchor` đã tóm tắt ví dụ neo. */
      anchorPromptVersion: { type: String, default: "" },
      /** Số chỗ tên / slug / tên miền công ty bị thay khi gửi LLM và khi nhận kết quả (kiểm ẩn danh). */
      redactedInInput: { type: Number, default: 0 },
      redactedInOutput: { type: Number, default: 0 },
    },

    /** Bản đang active lúc tạo đề xuất. */
    before: { type: promptSideSchema, default: () => ({}) },
    /** PromptVersion mới (chưa bật) tạo kèm đề xuất. */
    after: { type: promptSideSchema, default: () => ({}) },

    /** AI-04 ghi kết quả backtest. */
    backtest: { type: Schema.Types.Mixed, default: null },

    review: {
      by: { type: Schema.Types.ObjectId, ref: "User", default: null },
      at: { type: Date, default: null },
      note: { type: String, default: "" },
    },
  },
  { collection: "ai_improvement_proposals", timestamps: true },
);

aiImprovementProposalSchema.index({ status: 1, createdAt: -1 });
// Một ModerationItem chỉ làm bằng chứng cho đúng 1 đề xuất (multikey unique: mỗi phần tử mảng).
// Lọc `$type: objectId` để đề xuất không có item (rubric_anchor, mảng rỗng) không đụng nhau.
aiImprovementProposalSchema.index(
  { "evidence.moderationItemIds": 1 },
  {
    unique: true,
    partialFilterExpression: { "evidence.moderationItemIds": { $type: "objectId" } },
    name: "evidence_item_unique",
  },
);
// Mỗi nhóm tối đa 1 đề xuất đang chờ duyệt.
aiImprovementProposalSchema.index(
  { target: 1, kind: 1, groupKey: 1 },
  { unique: true, partialFilterExpression: { status: "proposed" }, name: "group_single_proposed" },
);

export const AIImprovementProposal =
  mongoose.models.AIImprovementProposal ?? mongoose.model("AIImprovementProposal", aiImprovementProposalSchema);

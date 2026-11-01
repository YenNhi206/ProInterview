import mongoose from "mongoose";

const { Schema } = mongoose;

/** Report về câu hỏi / kết quả chấm AI — không hiện ở trang support admin, sinh ModerationItem. */
export const AI_REPORT_TARGET_TYPES = ["interview_question", "interview_evaluation"];
export const REPORT_TARGET_TYPES = ["mentor", "booking", "review", "course", ...AI_REPORT_TARGET_TYPES];
export const AI_REPORT_REASON_CODES = ["irrelevant", "inaccurate_scoring", "hallucination", "offensive", "other"];

function isAiReport() {
  return AI_REPORT_TARGET_TYPES.includes(this.targetType);
}

const reportSchema = new Schema(
  {
    reportedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },

    targetType: { type: String, enum: REPORT_TARGET_TYPES, required: true },
    /** interview_* → sessionId. */
    targetId: { type: Schema.Types.ObjectId, required: true },
    /** Chỉ cho interview_*: câu nào trong session. */
    questionIndex: { type: Number, default: null },

    /** Lý do cho report mentor/booking/review/course. Report AI dùng `reasonCode`. */
    reason: {
      type: String,
      enum: ["late", "unprofessional", "inappropriate", "no_show", "fraud", "other"],
      required: function requiredForNonAiReport() {
        return !isAiReport.call(this);
      },
    },
    reasonCode: {
      type: String,
      enum: [...AI_REPORT_REASON_CODES, null],
      default: null,
      required: isAiReport,
    },
    /** Report AI: ghi chú tùy chọn (≤ 500 ký tự, validate ở service). */
    description: {
      type: String,
      default: "",
      required: function requiredForNonAiReport() {
        return !isAiReport.call(this);
      },
    },
    evidenceUrls: [{ type: String }],

    status: { type: String, enum: ["pending", "reviewing", "resolved", "dismissed"], default: "pending" },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolution: { type: String, default: "" },
    resolvedAt: { type: Date },
  },
  { collection: "reports", timestamps: true }
);

// Mỗi user chỉ 1 report AI / (session, câu, targetType) — chống spam + trả 409.
reportSchema.index(
  { reportedBy: 1, targetType: 1, targetId: 1, questionIndex: 1 },
  // Partial filter theo questionIndex số (chỉ report AI có) — $in trong partial index cần MongoDB mới.
  { unique: true, partialFilterExpression: { questionIndex: { $type: "number" } } },
);

export const Report = mongoose.models.Report ?? mongoose.model("Report", reportSchema);

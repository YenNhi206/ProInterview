import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Một buổi trong lộ trình (LP-03). Buổi học lại là document riêng cùng `order`,
 * `attempt` + 1 và `retakeOf` trỏ về lần trước (LP-13).
 *
 * State machine (docs/STATE_MACHINES.md):
 *   planned → scheduled (tạo Booking, LP-12) → done (ghi outcome, LP-13)
 *   planned | scheduled → cancelled (lộ trình bị hủy, LP-15)
 * outcome: passed → mở buổi kế · not_passed → tạo buổi retakeOf (lần đầu 0đ, quyết định 2)
 */
export const LEARNING_PATH_SESSION_STATUSES = ["planned", "scheduled", "done", "cancelled"];
export const LEARNING_PATH_SESSION_OUTCOMES = ["passed", "not_passed"];

const feedbackSchema = new Schema(
  {
    summary: { type: String, trim: true, default: "", maxlength: 4000 },
    strengths: [{ type: String, trim: true, maxlength: 1000 }],
    improvements: [{ type: String, trim: true, maxlength: 1000 }],
  },
  { _id: false },
);

const learningPathSessionSchema = new Schema(
  {
    pathId: { type: Schema.Types.ObjectId, ref: "LearningPath", required: true },
    /** Thứ tự buổi trong lộ trình, bắt đầu từ 1. Buổi học lại giữ nguyên `order`. */
    order: { type: Number, required: true, min: 1, validate: { validator: Number.isInteger, message: "order phải là số nguyên" } },
    title: { type: String, trim: true, required: true, maxlength: 200 },
    objectives: [{ type: String, trim: true, maxlength: 500 }],
    /** Key năng lực SHRM/DDI theo bộ tiêu chí LP-01. */
    shrmKeys: { type: [String], default: [] },

    /** Phần tiền của buổi (VND, số nguyên) theo LP-09; buổi học lại miễn phí = 0. */
    shareAmount: { type: Number, default: 0, min: 0, validate: { validator: Number.isInteger, message: "shareAmount phải là số nguyên (VND)" } },

    status: { type: String, enum: LEARNING_PATH_SESSION_STATUSES, default: "planned" },
    /** Booking của buổi (gắn `learningPathId`, KHÔNG gắn `mentorshipRequestId`, xem LP-02). */
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", default: null },

    /** Lần học thứ mấy của buổi `order` này: 1 = lần đầu, 2 = học lại miễn phí, ≥ 3 = buổi bổ sung có phí. */
    attempt: { type: Number, default: 1, min: 1 },
    retakeOf: { type: Schema.Types.ObjectId, ref: "LearningPathSession", default: null },

    outcome: { type: String, enum: [...LEARNING_PATH_SESSION_OUTCOMES, null], default: null },
    feedback: { type: feedbackSchema, default: () => ({}) },
    doneAt: { type: Date },
  },
  { collection: "learning_path_sessions", timestamps: true },
);

learningPathSessionSchema.path("shrmKeys").validate(
  (keys) => keys.every((k) => typeof k === "string" && k.trim().length > 0),
  "shrmKeys không được chứa giá trị rỗng",
);

// Mỗi (lộ trình, buổi, lần học) là duy nhất; cũng là index chính để liệt kê buổi theo thứ tự.
learningPathSessionSchema.index({ pathId: 1, order: 1, attempt: 1 }, { unique: true });
// Một booking chỉ thuộc một buổi.
learningPathSessionSchema.index(
  { bookingId: 1 },
  { unique: true, partialFilterExpression: { bookingId: { $type: "objectId" } } },
);
learningPathSessionSchema.index({ retakeOf: 1 }, { partialFilterExpression: { retakeOf: { $type: "objectId" } } });

export const LearningPathSession =
  mongoose.models.LearningPathSession ?? mongoose.model("LearningPathSession", learningPathSessionSchema);

import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Lộ trình học (Learning Path) mentor soạn cho ứng viên sau buổi đánh giá 0đ (LP-03).
 * Trả trọn gói `totalAmount` qua một `paymentRef` (quyết định 1); tiền chia cho từng buổi
 * nằm ở `LearningPathSession.shareAmount` (LP-09).
 *
 * State machine (docs/STATE_MACHINES.md):
 *   draft → proposed → revision_requested → proposed (version + 1)
 *   proposed → pending_payment (ứng viên chấp nhận) → active (SePay/admin xác nhận)
 *   active → completed (buổi cuối đạt) · active → cancelled (hoàn phần buổi chưa học)
 */
export const LEARNING_PATH_STATUSES = [
  "draft",
  "proposed",
  "revision_requested",
  "pending_payment",
  "active",
  "completed",
  "cancelled",
];

/** Lộ trình chưa bị hủy: mỗi yêu cầu mentor chỉ có tối đa 1 lộ trình như vậy. */
export const LEARNING_PATH_OPEN_STATUSES = LEARNING_PATH_STATUSES.filter((s) => s !== "cancelled");

const learningPathSchema = new Schema(
  {
    candidateId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    mentorId: { type: Schema.Types.ObjectId, ref: "Mentor", required: true },
    mentorshipRequestId: { type: Schema.Types.ObjectId, ref: "MentorshipRequest", required: true },
    /** Tùy chọn (quyết định 5): có job thì lấy requiredCompetencies làm khung. Model JobPost thêm ở JB-01. */
    jobPostId: { type: Schema.Types.ObjectId, ref: "JobPost", default: null },
    /** Booking buổi đánh giá 0đ (`sessionType: "assessment"`) dẫn tới lộ trình này. */
    assessmentBookingId: { type: Schema.Types.ObjectId, ref: "Booking", default: null },

    goal: { type: String, trim: true, default: "", maxlength: 2000 },
    status: { type: String, enum: LEARNING_PATH_STATUSES, default: "draft" },
    /** Tăng mỗi lần mentor gửi lại sau `revision_requested` (LP-08). */
    version: { type: Number, default: 1, min: 1 },
    /** Ghi chú ứng viên gửi kèm yêu cầu sửa gần nhất. */
    revisionNote: { type: String, trim: true, default: "", maxlength: 2000 },

    /** Giá trọn gói T (VND, số nguyên). */
    totalAmount: { type: Number, default: 0, min: 0, validate: { validator: Number.isInteger, message: "totalAmount phải là số nguyên (VND)" } },
    /** Chụp lại `Mentor.pricing.platformFeeRate` lúc gửi đề xuất (quyết định 4). */
    platformFeeRate: { type: Number, default: 0, min: 0, max: 1 },
    /** Mã chuyển khoản sinh bằng `utils/orderRef.js` (mã PI…) ở LP-10. */
    paymentRef: { type: String, trim: true, default: "" },

    proposedAt: { type: Date },
    acceptedAt: { type: Date },
    paidAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    cancelReason: { type: String, trim: true, default: "", maxlength: 1000 },
  },
  { collection: "learning_paths", timestamps: true },
);

learningPathSchema.index({ candidateId: 1, createdAt: -1 });
learningPathSchema.index({ mentorId: 1, status: 1, createdAt: -1 });
// Mỗi yêu cầu mentor chỉ có 1 lộ trình chưa hủy (mentor không tạo trùng bản nháp).
learningPathSchema.index(
  { mentorshipRequestId: 1 },
  {
    name: "mentorshipRequestId_open_unique",
    unique: true,
    partialFilterExpression: { status: { $in: LEARNING_PATH_OPEN_STATUSES } },
  },
);
// Giống Booking: chặn 2 lộ trình đang chờ CK trùng mã, tránh webhook SePay khớp nhầm.
learningPathSchema.index(
  { paymentRef: 1 },
  { unique: true, partialFilterExpression: { paymentRef: { $gt: "" }, status: "pending_payment" } },
);

export const LearningPath = mongoose.models.LearningPath ?? mongoose.model("LearningPath", learningPathSchema);

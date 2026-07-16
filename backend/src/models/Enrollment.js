import mongoose from "mongoose";

const { Schema } = mongoose;

const enrollmentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },

    completedLessons: [{ type: Schema.Types.ObjectId }],
    lastLessonId: { type: Schema.Types.ObjectId },
    progressPercent: { type: Number, default: 0, min: 0, max: 100 },
    lastAccessedAt: { type: Date },

    /** Ghi chú học viên theo bài (CourseLearning). */
    lessonNotes: [
      {
        lessonId: { type: Schema.Types.ObjectId, required: true },
        content: { type: String, default: "" },
        updatedAt: { type: Date, default: Date.now },
      },
    ],

    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date },
    certificateUrl: { type: String, default: "" },
    certificateIssuedAt: { type: Date },

    pricePaid: { type: Number, default: 0 },
    platformFeeRate: { type: Number, default: null },
    platformFee: { type: Number, default: 0 },
    /** Ưu đãi plan Pro/Elite (5%/10%) — platform tự gánh, đã trừ vào platformFee & pricePaid. */
    discountRate: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    /** Mã giảm giá (coupon) khách nhập ở checkout — đã trừ vào pricePaid. */
    couponCode: { type: String, default: "" },
    couponDiscountAmount: { type: Number, default: 0 },
    paymentRef: { type: String, default: "" },
    /** Hết hạn cửa sổ CK SePay (mặc định 15 phút từ lúc tạo ghi danh). */
    paymentExpiresAt: { type: Date },
    /** pending = chờ CK; paid = đã học được (hoặc khóa miễn phí). Bản ghi cũ không có field → coi như paid. */
    paymentStatus: { type: String, enum: ["pending", "paid"], required: false },
    paymentMethod: { type: String, default: "" },
    transferSubmittedAt: { type: Date },
    /** Audit admin xác nhận CK */
    transferConfirmedAt: { type: Date },
    transferConfirmedBy: { type: Schema.Types.ObjectId, ref: "User" },
    transferForceConfirm: { type: Boolean, default: false },
    transferForceNote: { type: String, default: "" },
    paidAt: { type: Date },
    /** Đã ghi có thu nhập mentor + stats khóa (tránh cộng trùng). */
    mentorEarningsCreditedAt: { type: Date },
  },
  { collection: "enrollments", timestamps: true }
);

enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });

export const Enrollment = mongoose.models.Enrollment ?? mongoose.model("Enrollment", enrollmentSchema);

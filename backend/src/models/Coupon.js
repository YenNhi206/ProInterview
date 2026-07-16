import mongoose from "mongoose";

const { Schema } = mongoose;

const couponUsageSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    usedAt: { type: Date, default: Date.now },
    referenceModel: { type: String, enum: ["Booking", "Enrollment", "Subscription"] },
    referenceId: { type: Schema.Types.ObjectId },
  },
  { _id: false },
);

const couponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    discountType: { type: String, enum: ["percent", "fixed"], default: "percent" },
    discountValue: { type: Number, required: true, min: 0 },
    /** "all" hoặc danh sách loại đơn được áp dụng. */
    applicableTo: {
      type: [String],
      enum: ["all", "booking", "enrollment", "subscription"],
      default: ["all"],
    },
    expiresAt: { type: Date },
    isActive: { type: Boolean, default: true },
    /** Mỗi user chỉ dùng được 1 lần — kiểm tra theo userId trong mảng này. */
    usedBy: [couponUsageSchema],
  },
  { collection: "coupons", timestamps: true },
);

export const Coupon = mongoose.models.Coupon ?? mongoose.model("Coupon", couponSchema);

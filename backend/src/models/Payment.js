import mongoose from "mongoose";

const { Schema } = mongoose;

export const PAYMENT_TYPES = ["booking", "subscription", "course", "learning_path"];

const paymentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    /** `learning_path`: trả trọn gói lộ trình (LP-10), `referenceId` = LearningPath._id. */
    type: { type: String, enum: PAYMENT_TYPES, required: true },
    referenceId: { type: Schema.Types.ObjectId, required: true },
    referenceModel: { type: String, enum: ["Booking", "Subscription", "Enrollment", "LearningPath"] },

    amount: { type: Number, required: true },
    currency: { type: String, default: "VND" },

    provider: { type: String, enum: ["momo", "zalopay", "vnpay", "card", "transfer"], required: true },
    providerRef: { type: String, default: "" },
    providerResponse: { type: Schema.Types.Mixed },

    status: {
      type: String,
      enum: ["pending", "success", "failed", "refund_pending", "refunded", "partial_refund", "cancelled", "held_inactive_account"],
      default: "pending",
    },
    /** Hết hạn cửa sổ CK SePay (subscription / ledger transfer). */
    paymentExpiresAt: { type: Date },
    paidAt: { type: Date },
    heldAt: Date,
    heldReason: String,
    refundedAt: { type: Date },
    refundAmount: { type: Number, default: 0 },
    failureReason: { type: String, default: "" },

    invoiceEmail: { type: String, default: "" },
    invoiceSnapshot: { type: Schema.Types.Mixed },
    invoiceName: { type: String, default: "" },
    invoiceAddress: { type: String, default: "" },
  },
  { collection: "payments", timestamps: true }
);

paymentSchema.index({ userId: 1 });
paymentSchema.index({ referenceId: 1 });
paymentSchema.index({ providerRef: 1 }, { unique: true, sparse: true });
// 1 booking/enrollment chỉ có tối đa 1 giao dịch CK (transfer) trong ledger
paymentSchema.index({ provider: 1, type: 1, referenceId: 1 }, { unique: true, sparse: true });

export const Payment = mongoose.models.Payment ?? mongoose.model("Payment", paymentSchema);

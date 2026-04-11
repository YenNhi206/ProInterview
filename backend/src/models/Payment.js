import mongoose from "mongoose";

const { Schema } = mongoose;

const paymentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    type: { type: String, enum: ["booking", "subscription", "course"], required: true },
    referenceId: { type: Schema.Types.ObjectId, required: true },
    referenceModel: { type: String, enum: ["Booking", "Subscription", "Enrollment"] },

    amount: { type: Number, required: true },
    currency: { type: String, default: "VND" },

    provider: { type: String, enum: ["momo", "zalopay", "vnpay", "card", "transfer"], required: true },
    providerRef: { type: String, default: "" },
    providerResponse: { type: Schema.Types.Mixed },

    status: {
      type: String,
      enum: ["pending", "success", "failed", "refunded", "cancelled"],
      default: "pending",
    },
    paidAt: { type: Date },
    refundedAt: { type: Date },
    refundAmount: { type: Number, default: 0 },
    failureReason: { type: String, default: "" },

    invoiceEmail: { type: String, default: "" },
    invoiceName: { type: String, default: "" },
    invoiceAddress: { type: String, default: "" },
  },
  { collection: "payments", timestamps: true }
);

paymentSchema.index({ userId: 1 });
paymentSchema.index({ referenceId: 1 });
paymentSchema.index({ providerRef: 1 }, { unique: true, sparse: true });

export const Payment = mongoose.models.Payment ?? mongoose.model("Payment", paymentSchema);

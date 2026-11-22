import mongoose from "mongoose";

export const SEPAY_ENTITY_TYPES = ["", "cart", "booking", "booking_group", "course", "subscription", "learning_path"];

const sepayWebhookEventSchema = new mongoose.Schema(
  {
    sepayId: { type: String, required: true, unique: true, index: true },
    transferType: { type: String, default: "" },
    transferAmount: { type: Number, default: 0 },
    orderRef: { type: String, default: "" },
    status: {
      type: String,
      enum: ["received", "processed", "ignored", "unmatched", "failed", "held_inactive_account"],
      default: "received",
    },
    /** Loại đơn khớp được (`findPendingTargets`); rỗng khi chưa khớp. `learning_path` từ LP-10. */
    entityType: { type: String, enum: SEPAY_ENTITY_TYPES, default: "" },
    entityId: { type: String, default: "" },
    resultMessage: { type: String, default: "" },
    rawPayload: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

export const SepayWebhookEvent = mongoose.model("SepayWebhookEvent", sepayWebhookEventSchema);

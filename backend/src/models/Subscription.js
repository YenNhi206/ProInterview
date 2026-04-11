import mongoose from "mongoose";

const { Schema } = mongoose;

const subscriptionHistorySchema = new Schema(
  {
    plan: { type: String },
    billingCycle: { type: String },
    startedAt: { type: Date },
    expiresAt: { type: Date },
    paymentRef: { type: String },
    amount: { type: Number },
  },
  { _id: false }
);

const subscriptionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },

    plan: { type: String, enum: ["free", "starter_pro", "elite_pro"], default: "free" },
    billingCycle: { type: String, enum: ["monthly", "yearly", ""], default: "" },

    startedAt: { type: Date },
    expiresAt: { type: Date },
    cancelledAt: { type: Date },

    history: [subscriptionHistorySchema],

    discountCode: { type: String, default: "" },
    discountPercent: { type: Number, default: 0 },

    isAutoRenew: { type: Boolean, default: false },
  },
  { collection: "subscriptions", timestamps: true }
);

export const Subscription =
  mongoose.models.Subscription ?? mongoose.model("Subscription", subscriptionSchema);

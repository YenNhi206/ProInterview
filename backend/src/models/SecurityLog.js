import mongoose from "mongoose";

const SecurityLogSchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    sessionId: { type: String, index: true },
    type: {
      type: String,
      enum: ["prompt_injection_attempt", "rate_limit_hit", "suspicious_output", "admin_action", "moderator_action", "company_moderator_action", "mentor_action"],
      required: true,
    },
    details:   { type: Object, default: {} },
    ipAddress: String,
    userAgent: String,
  },
  { timestamps: true }
);

SecurityLogSchema.index({ createdAt: -1 });
SecurityLogSchema.index({ userId: 1, type: 1, createdAt: -1 });

export const SecurityLog = mongoose.model("SecurityLog", SecurityLogSchema);

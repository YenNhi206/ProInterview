import mongoose from "mongoose";

const { Schema } = mongoose;

const reportSchema = new Schema(
  {
    reportedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },

    targetType: { type: String, enum: ["mentor", "booking", "review", "course"], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },

    reason: {
      type: String,
      enum: ["late", "unprofessional", "inappropriate", "no_show", "fraud", "other"],
      required: true,
    },
    description: { type: String, required: true },
    evidenceUrls: [{ type: String }],

    status: { type: String, enum: ["pending", "reviewing", "resolved", "dismissed"], default: "pending" },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolution: { type: String, default: "" },
    resolvedAt: { type: Date },
  },
  { collection: "reports", timestamps: true }
);

export const Report = mongoose.models.Report ?? mongoose.model("Report", reportSchema);

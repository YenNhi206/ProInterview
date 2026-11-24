import mongoose from "mongoose";

const { Schema } = mongoose;

const companyInviteSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "revoked", "expired"],
      default: "pending",
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    /** CO-02: thời điểm người nhận lời mời đồng ý điều khoản dùng rubric ẩn danh (quyết định AI-18). */
    rubricTermsAcceptedAt: {
      type: Date,
      default: null,
    },
    /** Version điều khoản đã đồng ý (`RUBRIC_SHARING_TERMS.version`). */
    rubricTermsVersion: {
      type: String,
      default: "",
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

companyInviteSchema.index({ email: 1, status: 1 });

export const CompanyInvite = mongoose.models.CompanyInvite ?? mongoose.model("CompanyInvite", companyInviteSchema);

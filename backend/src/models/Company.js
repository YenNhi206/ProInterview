import mongoose from "mongoose";

const { Schema } = mongoose;

const companySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    logo: { type: String, default: "" },
    website: { type: String, default: "", trim: true },
    industry: { type: String, default: "", trim: true },
    size: { type: String, default: "" },
    description: { type: String, default: "" },
    address: { type: String, default: "" },
    taxCode: { type: String, default: "" },
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
      index: true,
    },
    /**
     * CO-02: công ty đã đồng ý điều khoản dùng rubric ẩn danh (lần đồng ý đầu tiên, qua lời mời).
     * Miner AI-18 chỉ lấy rubric của công ty có `acceptedAt`. Chi tiết từng lần đồng ý: `CompanyInvite`.
     */
    rubricSharingConsent: {
      acceptedAt: { type: Date, default: null },
      acceptedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
      termsVersion: { type: String, default: "" },
    },
  },
  {
    timestamps: true,
  }
);

companySchema.index({ name: 1 });

export const Company = mongoose.models.Company ?? mongoose.model("Company", companySchema);

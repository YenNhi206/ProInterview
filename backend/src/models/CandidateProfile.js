import mongoose from "mongoose";

const { Schema } = mongoose;

const competencySourceSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["ai_interview", "mentor_session", "course"],
      required: true,
    },
    refId: { type: Schema.Types.ObjectId, default: null },
    title: { type: String, default: "" },
    /** PR-06: mức 0–5 (thang LP-01) của bằng chứng này; `null` với nguồn không cho mức (khóa học). */
    level: { type: Number, min: 0, max: 5, default: null },
    /** = level × 20, giữ cho FE cũ. */
    score: { type: Number, min: 0, max: 100, default: null },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const competencyItemSchema = new Schema(
  {
    key: { type: String, required: true }, // key trong config/competencies.json (LP-01)
    name: { type: String, default: "" },
    category: { type: String, default: "" },
    /**
     * PR-06: mức 0–5 (thập phân) gộp từ bằng chứng có mức; `null` = "Chưa đủ dữ liệu" (chỉ có nguồn
     * khóa học). Công thức: `competencyProfileService.computeCompetencyLevel`.
     */
    level: { type: Number, min: 0, max: 5, default: null },
    score: { type: Number, min: 0, max: 100, default: 0 },
    /** Số bằng chứng có mức (phỏng vấn AI + buổi mentor); khóa học không tính. */
    evidenceCount: { type: Number, default: 0 },
    sources: { type: [competencySourceSchema], default: [] },
  },
  { _id: false }
);

const candidateProfileSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    headline: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    targetRole: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    targetRoles: {
      type: [String],
      default: [],
    },
    summary: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: "",
    },
    yearsOfExperience: {
      type: Number,
      min: 0,
      default: 0,
    },
    defaultCvId: {
      type: Schema.Types.ObjectId,
      ref: "CVDocument",
      default: null,
    },
    competencies: {
      type: [competencyItemSchema],
      default: [],
    },
    /** PR-06: phiên bản cách gộp và lúc gộp gần nhất; khác `COMPETENCY_PROFILE_VERSION` thì gộp lại. */
    competenciesVersion: { type: String, default: "" },
    competenciesComputedAt: { type: Date, default: null },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    /**
     * JB-20: tối đa 5 job ứng viên xem gần nhất (mới nhất trước), ghi khi gọi `GET /api/jobs/:id`.
     * Dùng cho thẻ "Luyện theo job bạn quan tâm gần đây" trước phòng phỏng vấn AI (JB-21).
     */
    recentJobViews: {
      type: [
        new Schema(
          {
            jobPostId: { type: Schema.Types.ObjectId, ref: "JobPost", required: true },
            viewedAt: { type: Date, default: Date.now },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export const CandidateProfile =
  mongoose.models.CandidateProfile ||
  mongoose.model("CandidateProfile", candidateProfileSchema);

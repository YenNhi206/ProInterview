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
    score: { type: Number, min: 0, max: 100, default: null },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const competencyItemSchema = new Schema(
  {
    key: { type: String, required: true }, // e.g. "technical_mastery", "problem_solving", "communication"
    name: { type: String, default: "" },
    category: { type: String, default: "" },
    level: { type: Number, min: 1, max: 5, default: 1 },
    score: { type: Number, min: 0, max: 100, default: 0 },
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

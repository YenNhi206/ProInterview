import mongoose from "mongoose";

// ============================================================
// SUB-SCHEMAS (_id: false để tránh nested ObjectId noise)
// ============================================================

const SkillSchema = new mongoose.Schema(
  {
    name:       { type: String, required: true, trim: true },
    category:   { type: String, trim: true },
    aliases:    { type: [String], default: [] },
    confidence: { type: Number, min: 0, max: 1, default: 1 },
  },
  { _id: false }
);

const RewrittenBulletSchema = new mongoose.Schema(
  {
    original:  { type: String, required: true },
    rewritten: { type: String, required: true },
    reasoning: { type: String, default: "" },
    starElements: {
      situation: { type: Boolean, default: false },
      task:      { type: Boolean, default: false },
      action:    { type: Boolean, default: false },
      result:    { type: Boolean, default: false },
    },
  },
  { _id: false }
);

const SkillSuggestionSchema = new mongoose.Schema(
  {
    skill:                { type: String, required: true },
    priority:             { type: String, enum: ["high", "medium", "low"], default: "medium" },
    reason:               { type: String, default: "" },
    resources:            { type: [String], default: [] },
    estimatedTimeWeeks:   { type: Number, min: 0 },
  },
  { _id: false }
);

const DimensionScoresSchema = new mongoose.Schema(
  {
    clarity:     { type: Number, min: 0, max: 5, required: true },
    structure:   { type: Number, min: 0, max: 5, required: true },
    relevance:   { type: Number, min: 0, max: 5, required: true },
    credibility: { type: Number, min: 0, max: 5, required: true },
  },
  { _id: false }
);

const MatchSchema = new mongoose.Schema(
  {
    score:           { type: Number, min: 0, max: 100, required: true },
    matchedKeywords: { type: [String], default: [] },
    missingKeywords: { type: [String], default: [] },
  },
  { _id: false }
);

const SkillsContainerSchema = new mongoose.Schema(
  {
    cv:      { type: [SkillSchema], default: [] },
    jd:      { type: [SkillSchema], default: [] },
    matched: { type: [String], default: [] },
    missing: { type: [String], default: [] },
  },
  { _id: false }
);

const SuggestionsSchema = new mongoose.Schema(
  {
    rewrittenBullets:        { type: [RewrittenBulletSchema], default: [] },
    missingSkillSuggestions: { type: [SkillSuggestionSchema], default: [] },
    executiveSummary:        { type: String, default: "" },
  },
  { _id: false }
);

const CVAnalysisResultSchema = new mongoose.Schema(
  {
    skills:      { type: SkillsContainerSchema, default: () => ({}) },
    match:       { type: MatchSchema, required: true },
    scores:      { type: DimensionScoresSchema },   // chỉ có khi tier='full' hoặc 'suggestions'
    suggestions: { type: SuggestionsSchema },       // chỉ có khi tier='suggestions'
    _ui:         { type: mongoose.Schema.Types.Mixed }, // snapshot FE — đọc lại lịch sử
  },
  { _id: false }
);

const MetaSchema = new mongoose.Schema(
  {
    pythonServiceVersion: { type: String },
    llmModel:             { type: String },           // thay thế geminiModel cũ
    llmProvider:          {
      type: String,
      enum: ["groq", "gemini", "openai", "ollama", "deepseek", "glm", "unknown", "mock"],
      default: "unknown",
    },
    processingTimeMs:     { type: Number },           // thay thế processingMs cũ
    fallbackTriggered:    { type: Boolean, default: false },
    fallbackReason:       { type: String },           // 'python_timeout', 'llm_unavailable', etc.
    pythonEndpoint:       {
      type: String,
      enum: ["/analyze", "/analyze/full", "/analyze/suggestions", "/analyze/field"],
    },
  },
  { _id: false }
);

/**
 * N-11: trạng thái của một lần phân tích chưa xong (đang gọi Python hoặc lỗi). Không hiện trong lịch sử
 * ứng viên, không tính vào thống kê số lần phân tích; chỉ dùng để đo thời gian và tỉ lệ lỗi.
 */
export const CV_ANALYSIS_RUN_STATUSES = ["processing", "failed"];
/** Điều kiện Mongo: bản phân tích đã xong (gồm cả `legacy_mock` cũ). Trải vào query: `{ userId, ...CV_ANALYSIS_DONE_FILTER }`. */
export const CV_ANALYSIS_DONE_FILTER = Object.freeze({ status: { $nin: ["processing", "failed"] } });

// ============================================================
// MAIN SCHEMA
// ============================================================

const CVAnalysisSchema = new mongoose.Schema(
  {
    // ----- Ownership -----
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ----- Source data -----
    cvText:     { type: String },                     // raw text (có thể null nếu chỉ lưu file)
    cvFileName: { type: String, required: true },
    cvFileId:   { type: String },                     // tên file trên disk (uploads/)
    cvFileUrl:  { type: String },                     // URL tải lại PDF CV

    jdText:     { type: String },
    jdFileName: { type: String },
    jdFileId:   { type: String },
    jdFileUrl:  { type: String },

    field:    { type: String },
    position: { type: String },

    // ----- Analysis configuration -----
    mode: {
      type: String,
      enum: ["jd", "field"],
      required: true,
      index: true,
    },
    tier: {
      type: String,
      enum: ["suggestions", "full", "basic"],
      required: true,
    },

    // ----- Result (single-document: skills + match + scores + suggestions) -----
    result: { type: CVAnalysisResultSchema },         // absent khi status='failed'

    // ----- Lifecycle -----
    status: {
      type: String,
      enum: ["processing", "completed", "failed", "legacy_mock"],
      default: "processing",
      required: true,
      index: true,
    },
    error: { type: String },                          // populated khi status='failed'
    /** N-11: đã trừ 1 lượt `quota.cvAnalysisUsed` cho bản ghi này (lúc Python trả kết quả) — FE lưu lại không trừ lần nữa. */
    quotaCharged: { type: Boolean, default: false },

    // ----- Plan & metadata -----
    planAtTime: {
      type: String,
      enum: ["free", "pro", "enterprise"],
      default: "free",
    },
    meta: { type: MetaSchema, default: () => ({}) },

    // ----- User feedback (dùng để lọc training data sau này) -----
    feedback: {
      rating:      { type: String, enum: ["helpful", "not_helpful"], default: null },
      submittedAt: { type: Date },
    },

    // ----- Timestamps -----
    completedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: "cv_analyses",                        // giữ tên collection hiện tại để backward-compatible
  }
);

// ============================================================
// INDEXES
// ============================================================

CVAnalysisSchema.index({ userId: 1, createdAt: -1 });
CVAnalysisSchema.index({ userId: 1, status: 1 });
CVAnalysisSchema.index({ userId: 1, mode: 1, createdAt: -1 });
CVAnalysisSchema.index({ status: 1, createdAt: 1 });   // tìm processing records bị stuck

// ============================================================
// VIRTUALS & METHODS
// ============================================================

CVAnalysisSchema.virtual("matchLevel").get(function () {
  const score = this.result?.match?.score;
  if (score === undefined || score === null) return null;
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "fair";
  return "poor";
});

CVAnalysisSchema.methods.looksLikeMock = function () {
  const score = this.result?.match?.score;
  const suspiciousScores = [75, 80, 85, 50, 100];
  return suspiciousScores.includes(score) && (this.meta?.processingTimeMs ?? Infinity) < 1000;
};

CVAnalysisSchema.statics.getStatsForUser = async function (userId, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.aggregate([
    { $match: { userId, createdAt: { $gte: since } } },
    { $group: {
      _id: "$status",
      count: { $sum: 1 },
      avgMatchScore: { $avg: "$result.match.score" },
    }},
  ]);
};

export const CVAnalysis =
  mongoose.models.CVAnalysis ?? mongoose.model("CVAnalysis", CVAnalysisSchema);

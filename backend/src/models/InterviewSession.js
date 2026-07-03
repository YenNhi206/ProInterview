import mongoose from "mongoose";

const { Schema } = mongoose;

const interviewSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    hrGender: { type: String, enum: ["male", "female"], required: true },
    planAtTime: { type: String },
    questionsAllowed: { type: Number, default: 3 },

    // Câu hỏi sinh bởi LLM — grounded in SHRM/DDI framework
    questions: [
      {
        id: { type: String },
        layer: { type: String, enum: ["theory", "project", "behavior"] },
        seniority: { type: String, enum: ["intern", "junior", "middle", "senior"] },
        // SHRM/DDI competency metadata
        competencyId:           { type: String, default: "" },
        competencyName:         { type: String, default: "" },
        ddiKeyActionTargeted:   { type: String, default: "" },
        shrmRubricExcellent:    { type: String, default: "" },
        question: { type: String },
        starGuidance: {
          situation: [{ type: String }],
          task:      [{ type: String }],
          action:    [{ type: String }],
          result:    [{ type: String }],
        },
        expectedKeywords: [{ type: String }],
        deepDive:         [{ type: String }],
      },
    ],
    inferredRole:      { type: String, default: "" },
    inferredSeniority: { type: String, default: "" },
    coverageScore: {
      keywordScore: { type: Number, default: 0 },
      skillScore:   { type: Number, default: 0 },
    },

    // Competency Profile — SHRM/DDI detection result (dùng cho accumulation & analytics)
    competencyProfile: {
      roleCategory:       { type: String, default: "" },
      competencyIds:      [{ type: String }],
      competencyCoverage: [{ type: String }],
      detectedFromText:   [{ type: String }],
      generatedAt:        { type: String, default: "" },
    },

    answers: [
      {
        questionIndex: { type: Number },
        questionText: { type: String },
        transcript: { type: String, default: "" },
        wordCount: { type: Number, default: 0 },
        durationSeconds: { type: Number, default: 0 },
        recordedAt: { type: Date },
        // Red flag phát hiện real-time trên client (redFlagDetector.js) — nói xấu công ty cũ,
        // đổ lỗi/thiếu trách nhiệm, ngôn từ không chuyên nghiệp/phân biệt đối xử. Lưu lại để
        // hiện cho ứng viên xem lại ở InterviewFeedback.jsx.
        redFlags: [
          {
            categoryId:     { type: String },
            label:          { type: String },
            severity:       { type: String, enum: ["medium", "high"] },
            matchedKeyword: { type: String },
          },
        ],
        behavioralData: {
          // Audio (Web Audio API)
          responseLatencyMs:   { type: Number, default: 0 },
          silenceRatio:        { type: Number, default: 0 },
          silenceEvents:       { type: Number, default: 0 },
          avgAmplitude:        { type: Number, default: 0 },
          amplitudeVariance:   { type: Number, default: 0 },
          // Text analysis
          hedgeWordCount:      { type: Number, default: 0 },
          hedgeWords:          [{ type: String }],
          vocabularyDiversity: { type: Number, default: 0 },
          // Face — MediaPipe FaceMesh (realtime, in-browser)
          eyeContactScore:     { type: Number, default: 0 },
          headStabilityScore:  { type: Number, default: 0 },
          facePresenceRatio:   { type: Number, default: 0 },
          distractionEvents:   { type: Number, default: 0 },
          // Emotion — Google Cloud Vision (1 snapshot/question)
          emotion: {
            joy:           { type: Number, default: 0 }, // 1=VERY_UNLIKELY … 5=VERY_LIKELY
            sorrow:        { type: Number, default: 0 },
            anger:         { type: Number, default: 0 },
            surprise:      { type: Number, default: 0 },
            headPanAngle:  { type: Number, default: 0 },
            headTiltAngle: { type: Number, default: 0 },
            lightingOk:    { type: Boolean, default: true },
          },
        },
      },
    ],

    // Session-level behavioral summary (computed on client, saved on complete)
    behavioralSummary: {
      avgResponseLatencyMs:   { type: Number, default: 0 },
      avgSilenceRatio:        { type: Number, default: 0 },
      avgEyeContactScore:     { type: Number, default: 0 },
      avgHeadStabilityScore:  { type: Number, default: 0 },
      totalHedgeWords:        { type: Number, default: 0 },
      avgVocabularyDiversity: { type: Number, default: 0 },
      avgAmplitudeVariance:   { type: Number, default: 0 },
      overallConfidenceScore: { type: Number, default: 0 }, // 0–5 composite
      dominantEmotion:        { type: String, default: "" },
    },

    feedback: {
      overallScore: { type: Number, min: 0, max: 100 },
      communication: { type: Number, min: 0, max: 100 },
      confidence: { type: Number, min: 0, max: 100 },
      structure: { type: Number, min: 0, max: 100 },
      content: { type: Number, min: 0, max: 100 },
      timing: { type: Number, min: 0, max: 100 },
      generalComment: { type: String },
      perQuestion: [
        {
          questionIndex: { type: Number },
          score:    { type: Number },   // 0–100, bằng overall5 * 20
          badge:    { type: String, enum: ["Xuất sắc", "Tốt", "Cần cải thiện"] },
          strengths:    [{ type: String }],
          improvements: [{ type: String }],
          // Fields từ LLM evaluation (SHRM/DDI grounded)
          scores: {
            clarity:     { type: Number, default: 0 },
            structure:   { type: Number, default: 0 },
            relevance:   { type: Number, default: 0 },
            credibility: { type: Number, default: 0 },
          },
          shrmLevel:  { type: String, default: "" },
          suggestion: { type: String, default: "" },
          overall5:   { type: Number, default: 0 },
        },
      ],
      isLockedForFree: { type: Boolean, default: false },
    },

    status: {
      type: String,
      enum: ["in_progress", "completed", "abandoned"],
      default: "in_progress",
    },
    totalDurationSeconds: { type: Number, default: 0 },
    completedAt: { type: Date },
    feedbackGeneratedAt: { type: Date },

    reportPdfUrl: { type: String, default: "" },
    shareToken: { type: String, default: "", index: true },
    shareTokenExpiresAt: { type: Date },
  },
  { collection: "interview_sessions", timestamps: true }
);

interviewSessionSchema.index({ userId: 1, createdAt: -1 });
interviewSessionSchema.index({ status: 1 });
// Accumulation queries: tìm sessions cùng role/competency để lấy few-shot examples
interviewSessionSchema.index({ "competencyProfile.roleCategory": 1, status: 1, createdAt: -1 });
interviewSessionSchema.index({ "competencyProfile.competencyIds": 1, status: 1 });

export const InterviewSession =
  mongoose.models.InterviewSession ?? mongoose.model("InterviewSession", interviewSessionSchema);

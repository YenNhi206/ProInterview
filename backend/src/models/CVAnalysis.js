import mongoose from "mongoose";

const { Schema } = mongoose;

const cvAnalysisSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    cvText: { type: String, required: true },
    cvFileName: { type: String, default: "" },
    cvFileUrl: { type: String, default: "" },
    jdText: { type: String, default: "" },
    jdFileName: { type: String, default: "" },

    analysisType: {
      type: String,
      enum: ["basic", "match", "improve", "questions", "star"],
      required: true,
    },
    jdSource: { type: String, enum: ["text", "file", ""], default: "" },

    result: {
      overallSummary: { type: String },
      experienceLevel: { type: String },
      topStrengths: [{ type: String }],
      areasToImprove: [{ type: String }],

      matchScore: { type: Number, min: 0, max: 100 },
      matchStrengths: [{ type: String }],
      matchWeaknesses: [{ type: String }],
      missingKeywords: [{ type: String }],

      recommendations: [{ type: String }],

      questions: [
        {
          question: { type: String },
          category: { type: String },
        },
      ],

      starAnswers: [
        {
          question: { type: String },
          situation: { type: String },
          task: { type: String },
          action: { type: String },
          result: { type: String },
        },
      ],
    },

    planAtTime: { type: String },
    geminiModel: { type: String, default: "gemini-1.5-flash" },
    processingMs: { type: Number },
  },
  { collection: "cv_analyses", timestamps: true }
);

cvAnalysisSchema.index({ userId: 1, createdAt: -1 });

export const CVAnalysis = mongoose.models.CVAnalysis ?? mongoose.model("CVAnalysis", cvAnalysisSchema);

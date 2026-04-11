import mongoose from "mongoose";

const { Schema } = mongoose;

const interviewSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    hrGender: { type: String, enum: ["male", "female"], required: true },
    planAtTime: { type: String },
    questionsAllowed: { type: Number, default: 3 },

    answers: [
      {
        questionIndex: { type: Number },
        questionText: { type: String },
        transcript: { type: String, default: "" },
        wordCount: { type: Number, default: 0 },
        durationSeconds: { type: Number, default: 0 },
        recordedAt: { type: Date },
      },
    ],

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
          score: { type: Number },
          badge: { type: String, enum: ["Xuất sắc", "Tốt", "Cần cải thiện"] },
          strengths: [{ type: String }],
          improvements: [{ type: String }],
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

export const InterviewSession =
  mongoose.models.InterviewSession ?? mongoose.model("InterviewSession", interviewSessionSchema);

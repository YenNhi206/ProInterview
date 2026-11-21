import mongoose from "mongoose";

const { Schema } = mongoose;

const cvContentSchema = new Schema(
  {
    personalInfo: {
      fullName: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      location: { type: String, default: "" },
      website: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      github: { type: String, default: "" },
    },
    summary: { type: String, default: "" },
    experiences: [
      {
        company: { type: String, default: "" },
        position: { type: String, default: "" },
        startDate: { type: String, default: "" },
        endDate: { type: String, default: "" },
        isCurrent: { type: Boolean, default: false },
        description: { type: String, default: "" },
        bullets: { type: [String], default: [] },
      },
    ],
    educations: [
      {
        institution: { type: String, default: "" },
        degree: { type: String, default: "" },
        fieldOfStudy: { type: String, default: "" },
        startDate: { type: String, default: "" },
        endDate: { type: String, default: "" },
        gpa: { type: String, default: "" },
      },
    ],
    skills: { type: [String], default: [] },
    projects: [
      {
        name: { type: String, default: "" },
        role: { type: String, default: "" },
        link: { type: String, default: "" },
        description: { type: String, default: "" },
        technologies: { type: [String], default: [] },
      },
    ],
    certifications: [
      {
        name: { type: String, default: "" },
        issuer: { type: String, default: "" },
        issueDate: { type: String, default: "" },
      },
    ],
  },
  { _id: false }
);

const cvDocumentSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      default: "CV mặc định",
    },
    targetRole: {
      type: String,
      trim: true,
      default: "",
    },
    fileName: {
      type: String,
      trim: true,
      default: "cv.pdf",
    },
    fileUrl: {
      type: String,
      trim: true,
      default: "",
    },
    fileKey: {
      type: String,
      trim: true,
      default: "",
    },
    fileSize: {
      type: Number,
      min: 0,
      default: 0,
    },
    mimeType: {
      type: String,
      trim: true,
      default: "application/pdf",
    },
    content: {
      type: cvContentSchema,
      default: () => ({}),
    },
    skills: {
      type: [String],
      default: [],
    },
    version: {
      type: Number,
      min: 1,
      default: 1,
    },
    parentCvId: {
      type: Schema.Types.ObjectId,
      ref: "CVDocument",
      default: null,
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
    isValidCv: {
      type: Boolean,
      default: true,
    },
    validationNotes: {
      type: String,
      default: "",
    },
    lastAnalysisId: {
      type: Schema.Types.ObjectId,
      ref: "CVAnalysis",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
cvDocumentSchema.index({ userId: 1, isDefault: 1 });
cvDocumentSchema.index({ userId: 1, updatedAt: -1 });

export const CVDocument =
  mongoose.models.CVDocument || mongoose.model("CVDocument", cvDocumentSchema);

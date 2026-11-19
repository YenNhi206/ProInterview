import mongoose from "mongoose";

const { Schema } = mongoose;

const criterionSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    shrmKey: { type: String, required: true, trim: true },
    weight: { type: Number, required: true, min: 1, max: 100 },
    description: { type: String, default: "" },
    levels: {
      type: Map,
      of: String,
      default: () => ({}),
    },
    questionIds: [{ type: Schema.Types.ObjectId, ref: "QuestionBank" }],
  },
  { _id: true }
);

const moderationNoteSchema = new Schema(
  {
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    comment: { type: String, default: "" },
  },
  { _id: false }
);

const companyRubricSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    roleCategory: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    version: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ["draft", "pending_review", "approved", "rejected", "archived"],
      default: "draft",
      index: true,
    },
    criteria: {
      type: [criterionSchema],
      default: [],
    },
    moderationNote: {
      type: moderationNoteSchema,
      default: () => ({}),
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

companyRubricSchema.index({ companyId: 1, roleCategory: 1, status: 1 });

export const CompanyRubric = mongoose.models.CompanyRubric ?? mongoose.model("CompanyRubric", companyRubricSchema);

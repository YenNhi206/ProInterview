import mongoose from "mongoose";

const { Schema } = mongoose;

const courseSchema = new Schema(
  {
    mentorId: { type: Schema.Types.ObjectId, ref: "Mentor", required: true },

    title: { type: String, required: true },
    description: { type: String, default: "" },
    shortDescription: { type: String, default: "", maxlength: 500 },
    thumbnail: { type: String, default: "" },
    level: { type: String, enum: ["basic", "intermediate", "advanced"], required: true },
    tags: [{ type: String }],
    topics: [{ type: String, enum: ["Technical", "Behavioral", "Resume", "Negotiation", "Other"] }],
    language: { type: String, default: "vi" },

    whatYoullLearn: [{ type: String }],
    requirements: [{ type: String }],

    modules: [
      {
        title: { type: String },
        order: { type: Number },
        lessons: [
          {
            title: { type: String },
            type: { type: String, enum: ["video", "document", "quiz"] },
            videoUrl: { type: String, default: "" },
            documentUrl: { type: String, default: "" },
            durationMinutes: { type: Number, default: 0 },
            description: { type: String, default: "" },
            transcript: { type: String, default: "" },
            resources: [{ name: String, url: String }],
            order: { type: Number },
            isFree: { type: Boolean, default: false },
          },
        ],
      },
    ],

    settings: {
      autoEnroll: { type: Boolean, default: true },
      certificateEnabled: { type: Boolean, default: true },
      qaEnabled: { type: Boolean, default: true },
    },

    isFree: { type: Boolean, default: false },
    price: { type: Number, default: 0 },
    discountPrice: { type: Number, default: 0 },
    discountEndsAt: { type: Date },

    stats: {
      enrollmentCount: { type: Number, default: 0 },
      rating: { type: Number, default: 0 },
      reviewCount: { type: Number, default: 0 },
      completionRate: { type: Number, default: 0 },
      totalRevenue: { type: Number, default: 0 },
    },

    status: { type: String, enum: ["draft", "published", "archived"], default: "draft" },
    publishedAt: { type: Date },
    totalLessons: { type: Number, default: 0 },
    totalDurationMinutes: { type: Number, default: 0 },
  },
  { collection: "courses", timestamps: true }
);

courseSchema.index({ mentorId: 1 });
courseSchema.index({ status: 1, level: 1 });
courseSchema.index({ tags: 1 });

export const Course = mongoose.models.Course ?? mongoose.model("Course", courseSchema);

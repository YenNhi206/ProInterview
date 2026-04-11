import mongoose from "mongoose";

const { Schema } = mongoose;

const answerSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    isMentor: { type: Boolean, default: false },
    content: { type: String, required: true },
    upvotes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const courseQASchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    lessonId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    question: { type: String, required: true },
    isAnswered: { type: Boolean, default: false },

    answers: [answerSchema],

    upvotes: { type: Number, default: 0 },
    isPinned: { type: Boolean, default: false },
  },
  { collection: "courseqas", timestamps: true }
);

courseQASchema.index({ courseId: 1, lessonId: 1, createdAt: -1 });
courseQASchema.index({ userId: 1 });

export const CourseQA = mongoose.models.CourseQA ?? mongoose.model("CourseQA", courseQASchema);

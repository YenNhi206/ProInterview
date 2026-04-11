import mongoose from "mongoose";

const { Schema } = mongoose;

const enrollmentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },

    completedLessons: [{ type: Schema.Types.ObjectId }],
    lastLessonId: { type: Schema.Types.ObjectId },
    progressPercent: { type: Number, default: 0, min: 0, max: 100 },
    lastAccessedAt: { type: Date },

    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date },
    certificateUrl: { type: String, default: "" },
    certificateIssuedAt: { type: Date },

    pricePaid: { type: Number, default: 0 },
    paymentRef: { type: String, default: "" },
  },
  { collection: "enrollments", timestamps: true }
);

enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });

export const Enrollment = mongoose.models.Enrollment ?? mongoose.model("Enrollment", enrollmentSchema);

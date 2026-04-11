import mongoose from "mongoose";

const { Schema } = mongoose;

const activitySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    type: {
      type: String,
      enum: [
        "interview_completed",
        "cv_analyzed",
        "booking_created",
        "booking_completed",
        "course_enrolled",
        "course_completed",
        "plan_upgraded",
        "review_submitted",
      ],
      required: true,
    },

    description: { type: String, required: true },

    metadata: {
      score: { type: Number },
      matchScore: { type: Number },
      mentorName: { type: String },
      courseName: { type: String },
      refId: { type: Schema.Types.ObjectId },
      refModel: { type: String },
    },
  },
  { collection: "activities", timestamps: true }
);

activitySchema.index({ userId: 1, createdAt: -1 });

export const Activity = mongoose.models.Activity ?? mongoose.model("Activity", activitySchema);

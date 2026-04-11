import mongoose from "mongoose";

const { Schema } = mongoose;

const mentorPeerReviewSchema = new Schema(
  {
    reviewerId: { type: Schema.Types.ObjectId, ref: "Mentor", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },

    contentRating: { type: Number, required: true, min: 1, max: 5 },
    qualityRating: { type: Number, required: true, min: 1, max: 5 },
    priceValueRating: { type: Number, required: true, min: 1, max: 5 },

    feedback: { type: String, default: "" },
    isCompleted: { type: Boolean, default: true },

    isVisibleToOwner: { type: Boolean, default: true },
  },
  { collection: "mentorpeerreviews", timestamps: true }
);

mentorPeerReviewSchema.index({ reviewerId: 1 });
mentorPeerReviewSchema.index({ courseId: 1 });
mentorPeerReviewSchema.index({ reviewerId: 1, courseId: 1 }, { unique: true });

export const MentorPeerReview =
  mongoose.models.MentorPeerReview ?? mongoose.model("MentorPeerReview", mentorPeerReviewSchema);

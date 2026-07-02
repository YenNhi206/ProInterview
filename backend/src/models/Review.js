import mongoose from "mongoose";

const { Schema } = mongoose;

const reviewSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    targetType: { type: String, enum: ["mentor", "course"], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking" },

    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "" },
    tags: [{ type: String }],
    attachments: [{ name: String, url: String }],

    reply: {
      content: { type: String, default: "" },
      repliedAt: { type: Date },
    },

    isVerified: { type: Boolean, default: false },
    isVisible: { type: Boolean, default: true },
  },
  { collection: "reviews", timestamps: true }
);

reviewSchema.index({ targetType: 1, targetId: 1 });
reviewSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });

reviewSchema.statics.calculateStats = async function (targetType, targetId) {
  const stats = await this.aggregate([
    { $match: { targetType, targetId, isVisible: true } },
    {
      $group: {
        _id: "$targetId",
        rating: { $avg: "$rating" },
        reviewCount: { $sum: 1 },
      },
    },
  ]);
  
  const rating = stats[0]?.rating ? Number(stats[0].rating.toFixed(1)) : 0;
  const reviewCount = stats[0]?.reviewCount || 0;

  if (targetType === "mentor") {
    await mongoose.model("Mentor").findByIdAndUpdate(targetId, {
      $set: { "stats.rating": rating, "stats.reviewCount": reviewCount },
    });
  } else if (targetType === "course") {
    await mongoose.model("Course").findByIdAndUpdate(targetId, {
      $set: { "stats.rating": rating, "stats.reviewCount": reviewCount },
    });
  }
};

reviewSchema.post("save", function () {
  this.constructor.calculateStats(this.targetType, this.targetId);
});
reviewSchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    await doc.constructor.calculateStats(doc.targetType, doc.targetId);
  }
});
reviewSchema.post("findOneAndUpdate", async function (doc) {
  if (doc) {
    await doc.constructor.calculateStats(doc.targetType, doc.targetId);
  }
});

export const Review = mongoose.models.Review ?? mongoose.model("Review", reviewSchema);

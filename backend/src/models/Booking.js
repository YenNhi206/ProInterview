import mongoose from "mongoose";

const { Schema } = mongoose;

const rescheduleEntrySchema = new Schema(
  {
    oldDate: { type: String },
    oldTimeSlot: { type: String },
    newDate: { type: String },
    newTimeSlot: { type: String },
    reason: { type: String },
    changedBy: { type: String, enum: ["user", "mentor"] },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const bookingSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    mentorId: { type: Schema.Types.ObjectId, ref: "Mentor", required: true },

    date: { type: String, required: true },
    timeSlot: { type: String, required: true },
    durationMinutes: { type: Number, required: true },
    timezone: { type: String, default: "Asia/Ho_Chi_Minh" },

    sessionType: {
      type: String,
      enum: ["mock_interview", "cv_review", "career_consulting", "custom"],
      required: true,
    },
    notes: { type: String, default: "" },
    meetingLink: { type: String, default: "" },

    status: {
      type: String,
      enum: ["pending", "confirmed", "in_progress", "completed", "cancelled", "rescheduled", "no_show"],
      default: "pending",
    },

    price: { type: Number, required: true },
    platformFee: { type: Number, required: true },
    vat: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "refunded", "partial_refund", "failed"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["momo", "zalopay", "card", "transfer", ""],
      default: "",
    },
    paymentRef: { type: String, default: "" },
    paidAt: { type: Date },

    rescheduleHistory: [rescheduleEntrySchema],

    cancelledBy: { type: String, enum: ["user", "mentor", "system", ""], default: "" },
    cancelReason: { type: String, default: "" },
    cancelledAt: { type: Date },

    mentorNotes: { type: String, default: "" },
    reviewId: { type: Schema.Types.ObjectId, ref: "Review" },
    completedAt: { type: Date },
  },
  { collection: "bookings", timestamps: true }
);

bookingSchema.index({ userId: 1, status: 1 });
bookingSchema.index({ mentorId: 1, date: 1 });
bookingSchema.index({ status: 1 });

export const Booking = mongoose.models.Booking ?? mongoose.model("Booking", bookingSchema);

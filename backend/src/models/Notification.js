import mongoose from "mongoose";

const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    type: {
      type: String,
      enum: [
        "booking_confirmed",
        "booking_cancelled",
        "booking_reminder",
        "booking_completed",
        "new_review",
        "new_booking_request",
        "payment_success",
        "payment_failed",
        "plan_upgraded",
        "plan_expiring",
        "course_enrolled",
        "course_completed",
        "certificate_ready",
        "system",
      ],
      required: true,
    },

    title: { type: String, required: true },
    body: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },

    metadata: {
      bookingId: { type: Schema.Types.ObjectId, ref: "Booking" },
      mentorId: { type: Schema.Types.ObjectId, ref: "Mentor" },
      courseId: { type: Schema.Types.ObjectId, ref: "Course" },
      actionUrl: { type: String },
    },
  },
  { collection: "notifications", timestamps: true }
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export const Notification =
  mongoose.models.Notification ?? mongoose.model("Notification", notificationSchema);

import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Loại thông báo theo nhóm. Thêm loại mới thì thêm vào đây TRƯỚC khi gọi `Notification.create`:
 * Mongoose từ chối giá trị ngoài enum và `deliverNotification` chỉ log lỗi, thông báo mất im lặng.
 * FE chọn icon theo tiền tố (`learning_path_`, `application_`, `job_post_`, `company_`, `rubric_`,
 * `ai_improvement_`) trong `components/layout/NotificationCenter.jsx`.
 */
export const NOTIFICATION_TYPE_GROUPS = {
  booking: ["booking_confirmed", "booking_cancelled", "booking_reminder", "booking_completed", "new_booking_request"],
  payment: ["payment_success", "payment_failed"],
  plan: ["plan_upgraded", "plan_expiring"],
  course: ["course_enrolled", "course_completed", "certificate_ready"],
  feedback: ["new_review", "feedback"],
  system: ["system"],
  // N-06 — capstone FA26
  /** Lộ trình học: mentor đề xuất, ứng viên chấp nhận / yêu cầu sửa, đã thanh toán, kết quả buổi, hủy. */
  learningPath: [
    "learning_path_proposed",
    "learning_path_accepted",
    "learning_path_revision_requested",
    "learning_path_paid",
    "learning_path_session_result",
    "learning_path_cancelled",
  ],
  /** Ứng tuyển: công ty nhận đơn mới; ứng viên nhận đổi trạng thái (viewed / shortlisted / rejected). */
  application: ["application_submitted", "application_status_changed"],
  /** Lời mời làm Company Moderator. */
  company: ["company_invite"],
  /** Platform Mod duyệt / từ chối rubric công ty. */
  rubric: ["rubric_approved", "rubric_rejected"],
  /** Platform Mod ẩn job bị báo cáo. */
  jobPost: ["job_post_hidden"],
  /** Job đào đề xuất cải tiến AI cho Platform Mod. */
  aiImprovement: ["ai_improvement_proposed"],
  /** Admin nhận khi có người gửi (hoặc gửi lại) hồ sơ đăng ký mentor. */
  mentorApplication: ["mentor_application_submitted"],
  /** Admin nhận khi mentor gửi yêu cầu rút tiền. */
  payout: ["payout_requested"],
};

export const NOTIFICATION_TYPES = Object.values(NOTIFICATION_TYPE_GROUPS).flat();

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },

    title: { type: String, required: true },
    body: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },

    /** Field ngoài danh sách này bị Mongoose bỏ im lặng (strict), nên khai báo đủ ref cho các luồng mới. */
    metadata: {
      bookingId: { type: Schema.Types.ObjectId, ref: "Booking" },
      mentorId: { type: Schema.Types.ObjectId, ref: "Mentor" },
      courseId: { type: Schema.Types.ObjectId, ref: "Course" },
      learningPathId: { type: Schema.Types.ObjectId, ref: "LearningPath" },
      learningPathSessionId: { type: Schema.Types.ObjectId, ref: "LearningPathSession" },
      jobPostId: { type: Schema.Types.ObjectId, ref: "JobPost" },
      applicationId: { type: Schema.Types.ObjectId, ref: "Application" },
      companyId: { type: Schema.Types.ObjectId, ref: "Company" },
      rubricId: { type: Schema.Types.ObjectId, ref: "CompanyRubric" },
      proposalId: { type: Schema.Types.ObjectId, ref: "AIImprovementProposal" },
      payoutRequestId: { type: Schema.Types.ObjectId, ref: "PayoutRequest" },
      actionUrl: { type: String },
    },
  },
  { collection: "notifications", timestamps: true }
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export const Notification =
  mongoose.models.Notification ?? mongoose.model("Notification", notificationSchema);

import mongoose from "mongoose";
const { Schema } = mongoose;
export const REQUEST_STATUSES = ["open", "selected", "assessing", "path_proposed", "closed"];
/** Đã chọn mentor: được đặt booking thường và tạo buổi đánh giá 0đ. */
export const REQUEST_MENTOR_CHOSEN_STATUSES = ["selected", "assessing", "path_proposed"];
const offerSchema = new Schema({
  mentorId: { type: Schema.Types.ObjectId, ref: "Mentor", required: true },
  message: { type: String, required: true, maxlength: 3000 },
  availability: { type: String, required: true, maxlength: 500 },
  priceEstimate: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ["pending", "withdrawn"], default: "pending" },
}, { timestamps: true });
const requestSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true, maxlength: 160 },
  position: { type: String, required: true, maxlength: 160 },
  description: { type: String, required: true, maxlength: 4000 },
  sessionType: { type: String, enum: ["mock_interview", "cv_review", "career_consulting"], required: true },
  availability: { type: String, default: "", maxlength: 500 },
  budget: { type: Number, min: 0, max: 100000000, default: null },
  /**
   * open → selected (chọn mentor) → assessing (mentor tạo buổi đánh giá 0đ, LP-05)
   * → path_proposed (mentor gửi lộ trình, LP-07). closed: ứng viên ngừng nhận đề nghị.
   * Các status sau "selected" vẫn cho đặt booking thường (resolveRequestBooking).
   */
  status: { type: String, enum: REQUEST_STATUSES, default: "open" },
  /** LP-05 (quyết định 5): job tùy chọn để lộ trình lấy requiredCompetencies làm khung. Model JobPost thêm ở JB-01. */
  jobPostId: { type: Schema.Types.ObjectId, ref: "JobPost", default: null },
  /** Booking buổi đánh giá 0đ đang dùng của yêu cầu (sessionType "assessment"). */
  assessmentBookingId: { type: Schema.Types.ObjectId, ref: "Booking", default: null },
  selectedOfferId: { type: Schema.Types.ObjectId },
  selectedMentorId: { type: Schema.Types.ObjectId, ref: "Mentor" },
  cvName: { type: String, required: true }, jdName: { type: String, required: true },
  cvData: { type: Buffer, required: true, select: false }, jdData: { type: Buffer, required: true, select: false },
  offers: { type: [offerSchema], default: [] },
}, { timestamps: true, collection: "mentorship_requests" });
requestSchema.index({ userId: 1, createdAt: -1 });
requestSchema.index({ status: 1, createdAt: -1 });
requestSchema.index({ "offers.mentorId": 1, createdAt: -1 });
export const MentorshipRequest = mongoose.models.MentorshipRequest ?? mongoose.model("MentorshipRequest", requestSchema);

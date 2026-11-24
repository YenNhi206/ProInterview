import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * JB-08 (C-05, NFR-06): đơn ứng tuyển của ứng viên vào một tin tuyển dụng.
 *
 * - Mỗi job mỗi người 1 đơn (unique {jobPostId, candidateId}); rút rồi không nộp lại.
 * - Nộp phải đồng ý chia sẻ (`consent`); `snapshot` chụp hồ sơ năng lực (PR-07), CV đã chọn và chỉ số của
 *   ứng viên với doanh nghiệp (JB-19) lúc nộp. Doanh nghiệp chỉ đọc dữ liệu ứng viên qua `snapshot`.
 * - Rút đơn (quyết định 14): xóa `snapshot`, doanh nghiệp chỉ còn thấy `candidateName` và "Đã rút".
 *
 * Trạng thái: submitted → viewed → shortlisted | rejected (Company Moderator, JB-09);
 * submitted | viewed → withdrawn (ứng viên). shortlisted / rejected / withdrawn là trạng thái cuối.
 */
export const APPLICATION_STATUSES = ["submitted", "viewed", "shortlisted", "rejected", "withdrawn"];
export const APPLICATION_COMPANY_STATUSES = ["viewed", "shortlisted", "rejected"];
export const APPLICATION_WITHDRAWABLE_STATUSES = ["submitted", "viewed"];
export const APPLICATION_FINAL_STATUSES = ["shortlisted", "rejected", "withdrawn"];
/** Phạm vi dữ liệu ứng viên đồng ý chia sẻ cho doanh nghiệp khi nộp. Đổi nội dung thì tăng version. */
export const APPLICATION_CONSENT_SCOPE = ["profile", "cv", "company_metrics"];
export const APPLICATION_CONSENT_VERSION = "jb08-v1";

const historySchema = new Schema(
  {
    status: { type: String, enum: APPLICATION_STATUSES, required: true },
    at: { type: Date, required: true },
    by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    note: { type: String, default: "" },
  },
  { _id: false },
);

const applicationSchema = new Schema(
  {
    jobPostId: { type: Schema.Types.ObjectId, ref: "JobPost", required: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    candidateId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    cvId: { type: Schema.Types.ObjectId, ref: "CVDocument", default: null },
    /** Tên ứng viên lúc nộp — giữ lại sau khi rút (doanh nghiệp chỉ còn thấy tên và "Đã rút"). */
    candidateName: { type: String, default: "" },
    /** Tiêu đề job lúc nộp (job có thể đổi tên / đóng sau đó). */
    jobTitle: { type: String, default: "" },
    consent: {
      type: new Schema(
        {
          given: { type: Boolean, required: true },
          at: { type: Date, required: true },
          scope: { type: [String], default: () => [...APPLICATION_CONSENT_SCOPE] },
          version: { type: String, default: APPLICATION_CONSENT_VERSION },
        },
        { _id: false },
      ),
      required: true,
    },
    /**
     * Bản chụp lúc nộp: { candidate {name, email}, profile (PR-07 toApplicationCompetencySnapshot),
     * cv {id, title, targetRole, fileName, fileUrl, mimeType, skills, content}, companyMetrics (JB-19
     * companyMetricsSnapshot), capturedAt }. Bị xóa khi ứng viên rút đơn.
     */
    snapshot: { type: Schema.Types.Mixed, default: null },
    status: { type: String, enum: APPLICATION_STATUSES, default: "submitted" },
    history: { type: [historySchema], default: [] },
    submittedAt: { type: Date, required: true },
    viewedAt: { type: Date, default: null },
    decidedAt: { type: Date, default: null },
    withdrawnAt: { type: Date, default: null },
  },
  { collection: "applications", timestamps: true },
);

applicationSchema.index({ jobPostId: 1, candidateId: 1 }, { unique: true, name: "application_per_job_candidate" });
applicationSchema.index({ candidateId: 1, submittedAt: -1 });
applicationSchema.index({ companyId: 1, status: 1, submittedAt: -1 });
applicationSchema.index({ companyId: 1, jobPostId: 1, submittedAt: -1 });

export const Application = mongoose.models.Application ?? mongoose.model("Application", applicationSchema);

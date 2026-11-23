import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Tin tuyển dụng do Company Moderator đăng (JB-01). Không cần duyệt trước khi đăng (quyết định 8);
 * Platform Moderator hậu kiểm bằng cách ẩn tin bị báo cáo (JB-04).
 *
 * State machine (docs/STATE_MACHINES.md mục 15):
 *   draft → published (Company Mod) → closed (Company Mod hoặc hết hạn `closesAt`, JB-02)
 *   published → hidden → published (Platform Mod, JB-04) · hidden → closed (Company Mod)
 */
export const JOB_POST_STATUSES = ["draft", "published", "closed", "hidden"];
/** Cấp độ vị trí, cùng thang `QuestionBank.seniority` thêm `fresher` và `lead`. */
export const JOB_POST_LEVELS = ["intern", "fresher", "junior", "middle", "senior", "lead"];
export const JOB_POST_EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "internship"];
export const JOB_POST_WORK_MODES = ["onsite", "hybrid", "remote"];

const requiredCompetencySchema = new Schema(
  {
    /** Key năng lực trong bộ tiêu chí LP-01 (`config/competencies.json`), kiểm bằng `isValidCompetencyKey`. */
    shrmKey: { type: String, required: true, trim: true },
    /** Mức tối thiểu trên thang 0–5 của LP-01 (mức đạt = 3). */
    minLevel: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: { validator: Number.isInteger, message: "minLevel phải là số nguyên 1–5" },
    },
  },
  { _id: false },
);

const jobPostSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    /** Nhóm vị trí, key trong `config/roleCategories.json` (dùng chung với QuestionBank / CompanyRubric). */
    roleCategory: { type: String, required: true, trim: true, lowercase: true, maxlength: 60 },
    level: { type: String, enum: JOB_POST_LEVELS, required: true },
    employmentType: { type: String, enum: JOB_POST_EMPLOYMENT_TYPES, default: "full_time" },
    workMode: { type: String, enum: JOB_POST_WORK_MODES, default: "onsite" },
    location: { type: String, trim: true, default: "", maxlength: 200 },
    /** Mức lương hiển thị, nhập tự do (ví dụ "25–35 triệu", "Thỏa thuận"). */
    salaryRange: { type: String, trim: true, default: "", maxlength: 100 },
    description: { type: String, trim: true, default: "", maxlength: 10000 },
    requiredCompetencies: { type: [requiredCompetencySchema], default: [] },
    requiredSkills: { type: [{ type: String, trim: true, maxlength: 60 }], default: [] },
    /** Rubric `approved` cùng công ty, cùng `roleCategory` (tùy chọn). Buổi luyện theo job chấm thêm theo rubric này (JB-07). */
    rubricId: { type: Schema.Types.ObjectId, ref: "CompanyRubric", default: null },
    status: { type: String, enum: JOB_POST_STATUSES, default: "draft" },
    /** Hạn nhận hồ sơ; quá hạn thì job tự `closed` (JB-02). `null` = không hạn. */
    closesAt: { type: Date, default: null },

    publishedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    /** `company` (Company Mod bấm đóng) hoặc `expired` (JB-02). */
    closedReason: { type: String, enum: ["", "company", "expired"], default: "" },
    /** JB-04: Platform Moderator ẩn tin (`published → hidden`); bỏ ẩn thì xóa 3 field này. */
    hiddenAt: { type: Date, default: null },
    hiddenBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    hiddenReason: { type: String, trim: true, default: "", maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { collection: "job_posts", timestamps: true },
);

jobPostSchema.path("requiredCompetencies").validate(
  (rows) => new Set(rows.map((r) => r.shrmKey)).size === rows.length,
  "requiredCompetencies không được trùng key năng lực",
);

// Danh sách của công ty theo trạng thái (trang /company/jobs).
jobPostSchema.index({ companyId: 1, status: 1, updatedAt: -1 });
// Danh sách công khai (JB-03): lọc job đang đăng theo vị trí / cấp độ, mới nhất trước.
jobPostSchema.index({ status: 1, roleCategory: 1, level: 1, publishedAt: -1 });
// Job tự đóng khi quá hạn (JB-02).
jobPostSchema.index({ status: 1, closesAt: 1 }, { partialFilterExpression: { closesAt: { $type: "date" } } });

export const JobPost = mongoose.models.JobPost ?? mongoose.model("JobPost", jobPostSchema);

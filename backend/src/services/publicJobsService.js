/**
 * JB-03: tin tuyển dụng công khai — `GET /api/jobs`, `GET /api/jobs/:id` (không cần đăng nhập).
 *
 * Một job "đang mở" khi: `status: published`, chưa quá `closesAt` (lọc ngay lúc truy vấn, không chờ JB-02)
 * và công ty không bị `suspended`. Không bao giờ trả `draft`, `closed`, `hidden`.
 * `findPublicJob` dùng chung cho các luồng của ứng viên cần một job đang mở: yêu cầu mentor gắn job (LP-05),
 * khoảng thiếu (JB-05), luyện theo job (JB-06), ứng tuyển (JB-08).
 */
import mongoose from "mongoose";
import Joi from "joi";
import { JobPost, JOB_POST_EMPLOYMENT_TYPES, JOB_POST_LEVELS, JOB_POST_WORK_MODES } from "../models/JobPost.js";
import { Company } from "../models/Company.js";
import { httpError } from "../utils/apiErrors.js";
import { resolveStoredUploadUrl } from "../utils/resolveStoredUploadUrl.js";
import { isValidRoleCategory, roleCategoryName } from "./roleCategories.js";
import { requiredCompetencyRows } from "./jobPostsService.js";

/** Độ dài đoạn tóm tắt mô tả trong danh sách (trang chi tiết trả mô tả đầy đủ). */
export const PUBLIC_JOB_SUMMARY_LENGTH = 280;
const COMPANY_PUBLIC_FIELDS = "name slug logo industry website size address status";

const listInput = Joi.object({
  q: Joi.string().trim().max(100).allow(""),
  roleCategory: Joi.string().trim().lowercase().custom((v, h) => (isValidRoleCategory(v, { allowDeprecated: true }) ? v : h.error("any.invalid"))),
  level: Joi.string().valid(...JOB_POST_LEVELS),
  employmentType: Joi.string().valid(...JOB_POST_EMPLOYMENT_TYPES),
  workMode: Joi.string().valid(...JOB_POST_WORK_MODES),
  company: Joi.string().trim().lowercase().max(120),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(12),
});

const FILTER_LABELS = {
  q: "từ khóa (tối đa 100 ký tự)",
  roleCategory: "nhóm vị trí",
  level: "cấp độ",
  employmentType: "hình thức làm việc",
  workMode: "nơi làm việc",
  company: "công ty",
};

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Điều kiện "đang mở" ở mức JobPost (công ty bị khóa lọc riêng vì nằm ở collection khác). */
export function openJobFilter(now = new Date()) {
  return {
    status: "published",
    $or: [{ closesAt: null }, { closesAt: { $gt: now } }],
  };
}

async function suspendedCompanyIds() {
  return Company.find({ status: "suspended" }).distinct("_id");
}

function summarize(description) {
  const text = String(description || "").replace(/\s+/g, " ").trim();
  return text.length > PUBLIC_JOB_SUMMARY_LENGTH ? `${text.slice(0, PUBLIC_JOB_SUMMARY_LENGTH - 1).trimEnd()}…` : text;
}

function publicCompanyDTO(company) {
  if (!company) return null;
  return {
    id: String(company._id),
    name: company.name,
    slug: company.slug,
    logo: resolveStoredUploadUrl(company.logo ?? ""),
    industry: company.industry || "",
    website: company.website || "",
    size: company.size || "",
    address: company.address || "",
  };
}

/**
 * DTO công khai: không lộ người tạo, nội dung rubric hay mốc nội bộ.
 * `hasRubric` cho FE biết buổi luyện theo job có chấm thêm theo rubric công ty (JB-07).
 */
export function publicJobDTO(job, company, { full = false } = {}) {
  return {
    id: String(job._id),
    title: job.title,
    roleCategory: job.roleCategory,
    roleCategoryName: roleCategoryName(job.roleCategory),
    level: job.level,
    employmentType: job.employmentType,
    workMode: job.workMode,
    location: job.location || "",
    salaryRange: job.salaryRange || "",
    summary: summarize(job.description),
    ...(full ? { description: job.description || "" } : {}),
    requiredCompetencies: requiredCompetencyRows(job),
    requiredSkills: job.requiredSkills || [],
    hasRubric: Boolean(job.rubricId),
    closesAt: job.closesAt ?? null,
    publishedAt: job.publishedAt ?? null,
    company: publicCompanyDTO(company),
  };
}

/** Danh sách job đang mở, mới đăng trước. Công ty không tồn tại / bị khóa trong bộ lọc `company` → danh sách rỗng. */
export async function listPublicJobs(query, now = new Date()) {
  const result = listInput.validate(query ?? {}, { abortEarly: true, stripUnknown: true, convert: true });
  if (result.error) {
    const field = String(result.error.details[0]?.path?.[0] ?? "");
    throw httpError(400, FILTER_LABELS[field] ? `Bộ lọc không hợp lệ: ${FILTER_LABELS[field]}.` : "Bộ lọc không hợp lệ.");
  }
  const input = result.value;
  const empty = { jobs: [], pagination: { page: input.page, limit: input.limit, total: 0, totalPages: 1 } };

  const filter = openJobFilter(now);
  if (input.company) {
    const company = await Company.findOne({ slug: input.company, status: { $ne: "suspended" } }).select("_id").lean();
    if (!company) return empty;
    filter.companyId = company._id;
  } else {
    const suspended = await suspendedCompanyIds();
    if (suspended.length) filter.companyId = { $nin: suspended };
  }
  for (const key of ["roleCategory", "level", "employmentType", "workMode"]) {
    if (input[key]) filter[key] = input[key];
  }
  if (input.q) {
    const re = new RegExp(escapeRegex(input.q), "i");
    // `$or` của điều kiện hạn đã dùng → gộp bằng `$and`.
    filter.$and = [{ $or: [{ title: re }, { requiredSkills: re }, { location: re }] }];
  }

  const [rows, total] = await Promise.all([
    JobPost.find(filter).sort({ publishedAt: -1, _id: -1 }).skip((input.page - 1) * input.limit).limit(input.limit).lean(),
    JobPost.countDocuments(filter),
  ]);
  const companies = await Company.find({ _id: { $in: [...new Set(rows.map((r) => String(r.companyId)))] } })
    .select(COMPANY_PUBLIC_FIELDS)
    .lean();
  const companyById = new Map(companies.map((c) => [String(c._id), c]));
  return {
    jobs: rows.map((row) => publicJobDTO(row, companyById.get(String(row.companyId)))),
    pagination: { page: input.page, limit: input.limit, total, totalPages: Math.max(1, Math.ceil(total / input.limit)) },
  };
}

/**
 * Job đang mở theo id, kèm công ty; không có / không mở thì `null`.
 * Dùng cho mọi luồng ứng viên cần job hợp lệ (LP-05, JB-05, JB-06, JB-08).
 */
export async function findPublicJob(jobId, now = new Date()) {
  if (!mongoose.isValidObjectId(jobId)) return null;
  const job = await JobPost.findOne({ _id: jobId, ...openJobFilter(now) }).lean();
  if (!job) return null;
  const company = await Company.findById(job.companyId).select(COMPANY_PUBLIC_FIELDS).lean();
  if (!company || company.status === "suspended") return null;
  return { job, company };
}

export async function getPublicJob(jobId, now = new Date()) {
  if (!mongoose.isValidObjectId(jobId)) throw httpError(400, "Mã tin tuyển dụng không hợp lệ.");
  const found = await findPublicJob(jobId, now);
  if (!found) throw httpError(404, "Tin tuyển dụng không tồn tại hoặc đã đóng.");
  return publicJobDTO(found.job, found.company, { full: true });
}

/**
 * Tóm tắt job đã gắn vào yêu cầu mentor / lộ trình (quyết định 5: có job thì lấy `requiredCompetencies`
 * làm khung). Đọc mọi trạng thái vì job có thể đã đóng sau khi ứng viên gửi yêu cầu; `isOpen` cho FE biết
 * job còn nhận hồ sơ không. Job đã bị xóa khỏi DB → `null`.
 */
export async function jobPostSummary(jobPostId, now = new Date()) {
  if (!jobPostId || !mongoose.isValidObjectId(jobPostId)) return null;
  const job = await JobPost.findById(jobPostId)
    .select("companyId title roleCategory level status closesAt requiredCompetencies requiredSkills")
    .lean();
  if (!job) return null;
  const company = await Company.findById(job.companyId).select("name slug status").lean();
  const notExpired = !job.closesAt || new Date(job.closesAt).getTime() > now.getTime();
  return {
    id: String(job._id),
    title: job.title,
    roleCategory: job.roleCategory,
    roleCategoryName: roleCategoryName(job.roleCategory),
    level: job.level,
    isOpen: job.status === "published" && notExpired && company?.status !== "suspended",
    company: company ? { name: company.name, slug: company.slug } : null,
    requiredCompetencies: requiredCompetencyRows(job),
    requiredSkills: job.requiredSkills || [],
  };
}

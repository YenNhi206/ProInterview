/**
 * Job Post — phía Company Moderator (JB-01): tạo / sửa bản nháp, đăng, đóng.
 * API công khai (JB-03), tự đóng khi hết hạn (JB-02) và ẩn/hiện của Platform Mod (JB-04) làm ở task riêng.
 *
 * Quyền: route `/api/company/jobs*` đã qua `authJwt` + `requireCompanyModerator` (CO-03), nên
 * `companyId` lấy từ `req.companyId`; mọi truy vấn lọc theo `companyId` → job công ty khác trả 404.
 * State machine: docs/STATE_MACHINES.md mục 15. Quyết định 8 (không duyệt trước khi đăng).
 */
import mongoose from "mongoose";
import Joi from "joi";
import { JobPost, JOB_POST_EMPLOYMENT_TYPES, JOB_POST_LEVELS, JOB_POST_STATUSES, JOB_POST_WORK_MODES } from "../models/JobPost.js";
import { CompanyRubric } from "../models/CompanyRubric.js";
import { httpError } from "../utils/apiErrors.js";
import { getCompetency, isValidCompetencyKey } from "./competencyFramework.js";

export const JOB_POST_MAX_COMPETENCIES = 10;
export const JOB_POST_MAX_SKILLS = 30;
/** Mô tả tối thiểu khi đăng, để trang /jobs/:id và khoảng thiếu (JB-05) có nội dung. */
export const JOB_POST_MIN_DESCRIPTION = 50;
/** Company Mod chỉ sửa nội dung khi bản nháp hoặc đang đăng; job bị ẩn / đã đóng thì khóa. */
const EDITABLE_STATUSES = ["draft", "published"];

// roleCategory dùng chung slug với QuestionBank / CompanyRubric (chuỗi tự do ở CO-05, CO-07).
const roleCategory = Joi.string().trim().lowercase().pattern(/^[a-z0-9_]{2,60}$/);
const shrmKey = Joi.string().trim().lowercase().custom((value, helpers) =>
  isValidCompetencyKey(value) ? value : helpers.error("any.invalid"));
const competencyInput = Joi.object({
  shrmKey: shrmKey.required(),
  minLevel: Joi.number().integer().min(1).max(5).required(),
});
const fields = {
  title: Joi.string().trim().min(3).max(150),
  roleCategory,
  level: Joi.string().valid(...JOB_POST_LEVELS),
  employmentType: Joi.string().valid(...JOB_POST_EMPLOYMENT_TYPES),
  workMode: Joi.string().valid(...JOB_POST_WORK_MODES),
  location: Joi.string().trim().max(200).allow(""),
  description: Joi.string().trim().max(10000).allow(""),
  requiredCompetencies: Joi.array().items(competencyInput).max(JOB_POST_MAX_COMPETENCIES).unique("shrmKey"),
  requiredSkills: Joi.array().items(Joi.string().trim().min(1).max(60)).max(JOB_POST_MAX_SKILLS),
  rubricId: Joi.alternatives().try(Joi.string().hex().length(24), Joi.valid(null, "")),
  closesAt: Joi.alternatives().try(Joi.date().iso(), Joi.valid(null, "")),
};
const createInput = Joi.object({
  ...fields,
  title: fields.title.required(),
  roleCategory: fields.roleCategory.required(),
  level: fields.level.required(),
});
const updateInput = Joi.object(fields).min(1);
const statusInput = Joi.object({ status: Joi.string().valid("published", "closed").required() });
const listInput = Joi.object({
  status: Joi.string().valid(...JOB_POST_STATUSES),
  roleCategory,
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const FIELD_LABELS = {
  title: "tiêu đề (3–150 ký tự)",
  roleCategory: "nhóm vị trí (chữ thường, số, dấu gạch dưới)",
  level: "cấp độ",
  employmentType: "hình thức làm việc",
  workMode: "nơi làm việc",
  location: "địa điểm (tối đa 200 ký tự)",
  description: "mô tả (tối đa 10.000 ký tự)",
  requiredCompetencies: `năng lực yêu cầu (tối đa ${JOB_POST_MAX_COMPETENCIES}, key trong bộ tiêu chí, không trùng, mức 1–5)`,
  requiredSkills: `kỹ năng (tối đa ${JOB_POST_MAX_SKILLS}, mỗi kỹ năng 1–60 ký tự)`,
  rubricId: "rubric",
  closesAt: "hạn nhận hồ sơ",
  status: "trạng thái (published hoặc closed)",
};

function validate(schema, value) {
  const result = schema.validate(value ?? {}, { abortEarly: true, stripUnknown: true, convert: true });
  if (result.error) {
    const field = String(result.error.details[0]?.path?.[0] ?? "");
    throw httpError(400, FIELD_LABELS[field] ? `Tin tuyển dụng chưa hợp lệ: ${FIELD_LABELS[field]}.` : "Tin tuyển dụng chưa hợp lệ.");
  }
  return result.value;
}

/** Bỏ khoảng trắng, bỏ trùng không phân biệt hoa thường, giữ thứ tự nhập. */
function normalizeSkills(skills) {
  const seen = new Set();
  const out = [];
  for (const raw of skills) {
    const skill = raw.replace(/\s+/g, " ").trim();
    const key = skill.toLowerCase();
    if (!skill || seen.has(key)) continue;
    seen.add(key);
    out.push(skill);
  }
  return out;
}

function normalizeInput(input) {
  const out = { ...input };
  if (out.requiredSkills) out.requiredSkills = normalizeSkills(out.requiredSkills);
  if ("rubricId" in out) out.rubricId = out.rubricId || null;
  if ("closesAt" in out) out.closesAt = out.closesAt ? new Date(out.closesAt) : null;
  return out;
}

function assertJobId(value) {
  if (!mongoose.isValidObjectId(value)) throw httpError(400, "Mã tin tuyển dụng không hợp lệ.");
}

async function loadJob(companyId, jobId) {
  assertJobId(jobId);
  // Lọc theo companyId ngay trong truy vấn: job công ty khác coi như không tồn tại (không lộ id).
  const job = await JobPost.findOne({ _id: jobId, companyId }).lean();
  if (!job) throw httpError(404, "Không tìm thấy tin tuyển dụng.");
  return job;
}

/**
 * Chỉ gắn rubric `approved` của **cùng công ty** và **cùng `roleCategory`** với job (quyết định 9:
 * rubric công ty áp dụng cho buổi luyện theo job của công ty đó). Rubric công ty khác báo như không tồn tại.
 */
async function assertRubricAttachable(companyId, rubricId, jobRoleCategory) {
  if (!rubricId) return null;
  const rubric = await CompanyRubric.findOne({ _id: rubricId, companyId }).select("status roleCategory title version").lean();
  if (!rubric) throw httpError(400, "Không tìm thấy rubric của công ty bạn.");
  if (rubric.status !== "approved") {
    throw httpError(400, "Chỉ gắn được rubric đã được Platform Moderator duyệt.");
  }
  if (rubric.roleCategory !== jobRoleCategory) {
    throw httpError(400, "Rubric phải cùng nhóm vị trí (roleCategory) với tin tuyển dụng.");
  }
  return rubric;
}

function assertFutureClosesAt(closesAt, now = new Date()) {
  if (closesAt && closesAt.getTime() <= now.getTime()) {
    throw httpError(400, "Hạn nhận hồ sơ phải ở tương lai.");
  }
}

/** Điều kiện để job ở trạng thái `published` (khi đăng và khi sửa job đang đăng). */
function assertPublishable(job) {
  if (!job.description || job.description.length < JOB_POST_MIN_DESCRIPTION) {
    throw httpError(400, `Nhập mô tả công việc ít nhất ${JOB_POST_MIN_DESCRIPTION} ký tự trước khi đăng.`);
  }
  if (!job.requiredCompetencies?.length) {
    throw httpError(400, "Chọn ít nhất 1 năng lực yêu cầu trước khi đăng.");
  }
  assertFutureClosesAt(job.closesAt);
}

export async function jobPostDTO(job) {
  const rubric = job.rubricId
    ? await CompanyRubric.findById(job.rubricId).select("title version status roleCategory").lean()
    : null;
  return {
    id: String(job._id),
    companyId: String(job.companyId),
    title: job.title,
    roleCategory: job.roleCategory,
    level: job.level,
    employmentType: job.employmentType,
    workMode: job.workMode,
    location: job.location,
    description: job.description,
    requiredCompetencies: (job.requiredCompetencies || []).map((c) => {
      const meta = getCompetency(c.shrmKey);
      return { shrmKey: c.shrmKey, minLevel: c.minLevel, name: meta?.nameVi || c.shrmKey };
    }),
    requiredSkills: job.requiredSkills || [],
    rubricId: job.rubricId ? String(job.rubricId) : "",
    rubric: rubric ? { id: String(rubric._id), title: rubric.title, version: rubric.version, status: rubric.status, roleCategory: rubric.roleCategory } : null,
    status: job.status,
    closesAt: job.closesAt ?? null,
    publishedAt: job.publishedAt ?? null,
    closedAt: job.closedAt ?? null,
    closedReason: job.closedReason || "",
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

/** Danh sách job của công ty, lọc theo trạng thái / nhóm vị trí; kèm số lượng từng trạng thái cho các tab. */
export async function listCompanyJobs(companyId, query) {
  const input = validate(listInput, query);
  const filter = { companyId };
  if (input.status) filter.status = input.status;
  if (input.roleCategory) filter.roleCategory = input.roleCategory;
  const [rows, total, grouped] = await Promise.all([
    JobPost.find(filter).sort({ updatedAt: -1, _id: -1 }).skip((input.page - 1) * input.limit).limit(input.limit).lean(),
    JobPost.countDocuments(filter),
    JobPost.aggregate([{ $match: { companyId: new mongoose.Types.ObjectId(String(companyId)) } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  const counts = Object.fromEntries(JOB_POST_STATUSES.map((s) => [s, 0]));
  for (const g of grouped) counts[g._id] = g.n;
  return {
    jobs: await Promise.all(rows.map((row) => jobPostDTO(row))),
    pagination: { page: input.page, limit: input.limit, total, totalPages: Math.max(1, Math.ceil(total / input.limit)) },
    counts,
  };
}

export async function getCompanyJob(companyId, jobId) {
  return jobPostDTO(await loadJob(companyId, jobId));
}

/** Tạo bản nháp. Rubric (nếu có) kiểm ngay để Company Mod biết sớm. */
export async function createCompanyJob(companyId, userId, body) {
  const input = normalizeInput(validate(createInput, body));
  assertFutureClosesAt(input.closesAt);
  await assertRubricAttachable(companyId, input.rubricId, input.roleCategory);
  const job = await JobPost.create({ ...input, companyId, status: "draft", createdBy: userId, updatedBy: userId });
  return jobPostDTO(job.toObject());
}

/**
 * Sửa job ở `draft` hoặc `published`. Job đang đăng phải vẫn đủ điều kiện đăng sau khi sửa.
 * Cập nhật có điều kiện theo `status` + `updatedAt` để hai người sửa cùng lúc không đè nhau âm thầm.
 */
export async function updateCompanyJob(companyId, userId, jobId, body) {
  const job = await loadJob(companyId, jobId);
  if (!EDITABLE_STATUSES.includes(job.status)) {
    throw httpError(409, job.status === "hidden" ? "Tin đang bị Platform Moderator ẩn, không sửa được." : "Tin đã đóng, không sửa được.");
  }
  const input = normalizeInput(validate(updateInput, body));
  const merged = { ...job, ...input };
  if ("closesAt" in input) assertFutureClosesAt(merged.closesAt);
  // Đổi rubric hoặc đổi nhóm vị trí đều phải kiểm lại rubric đang gắn.
  if ("rubricId" in input || "roleCategory" in input) {
    await assertRubricAttachable(companyId, merged.rubricId, merged.roleCategory);
  }
  if (job.status === "published") assertPublishable(merged);

  const updated = await JobPost.findOneAndUpdate(
    { _id: job._id, companyId, status: job.status, updatedAt: job.updatedAt },
    { $set: { ...input, updatedBy: userId } },
    { returnDocument: "after", runValidators: true },
  ).lean();
  if (!updated) throw httpError(409, "Tin tuyển dụng vừa được thay đổi. Vui lòng tải lại trang.");
  return jobPostDTO(updated);
}

/**
 * Đổi trạng thái do Company Mod: `draft → published` (đăng) và `published | hidden → closed` (đóng).
 * Mở lại job đã đóng hoặc bỏ ẩn không thuộc quyền Company Mod.
 */
export async function changeCompanyJobStatus(companyId, userId, jobId, body) {
  const job = await loadJob(companyId, jobId);
  const { status } = validate(statusInput, body);
  const now = new Date();
  let from;
  let set;
  if (status === "published") {
    if (job.status === "published") throw httpError(409, "Tin đã được đăng.");
    if (job.status !== "draft") throw httpError(409, "Chỉ đăng được tin ở trạng thái bản nháp.");
    assertPublishable(job);
    // Rubric có thể đã bị lưu trữ (có version mới được duyệt) sau khi gắn vào bản nháp.
    await assertRubricAttachable(companyId, job.rubricId, job.roleCategory);
    from = ["draft"];
    set = { status: "published", publishedAt: now, closedAt: null, closedReason: "" };
  } else {
    if (job.status === "closed") throw httpError(409, "Tin đã đóng.");
    if (job.status === "draft") throw httpError(409, "Bản nháp chưa đăng nên không cần đóng.");
    from = ["published", "hidden"];
    set = { status: "closed", closedAt: now, closedReason: "company" };
  }
  const updated = await JobPost.findOneAndUpdate(
    { _id: job._id, companyId, status: { $in: from } },
    { $set: { ...set, updatedBy: userId } },
    { returnDocument: "after" },
  ).lean();
  if (!updated) throw httpError(409, "Tin tuyển dụng vừa đổi trạng thái. Vui lòng tải lại trang.");
  return jobPostDTO(updated);
}

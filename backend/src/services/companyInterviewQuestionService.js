/**
 * Câu doanh nghiệp hợp lệ để chèn vào phỏng vấn AI (quyết định JB-06, JB-07 ngày 23/11/2026).
 * Dùng chung cho JB-20 (`GET /api/jobs/recent` chỉ trả job có câu hợp lệ) và JB-06 (chọn câu cho buổi).
 *
 * Một câu hợp lệ cho job J khi:
 * - `QuestionBank.status === "approved"` (đã qua Platform Moderator, CO-16) và `orgId` = công ty của J;
 * - nằm trong "câu áp dụng" (`criteria[].questionIds`) của rubric `approved` gắn với J (`J.rubricId`), cùng công ty;
 * - `jobPostId` của câu là J, hoặc rỗng (câu dùng chung theo vị trí). Câu tải lên cho job khác thì không dùng.
 * Job phải đang mở (người gọi tự lọc bằng `openJobFilter` / `findPublicJob`).
 */
import { QuestionBank } from "../models/QuestionBank.js";
import { CompanyRubric } from "../models/CompanyRubric.js";
import { JobPost } from "../models/JobPost.js";
import { Company } from "../models/Company.js";
import { openJobFilter, findPublicJob } from "./publicJobsService.js";

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

/**
 * @param {Array<{ _id: any, companyId: any, rubricId?: any }>} jobs job (lean) đã biết là đang mở
 * @param {{ select?: string }} [opts] field của câu cần lấy
 * @returns {Promise<Map<string, object[]>>} id job → danh sách câu hợp lệ (job không có câu thì không có key)
 */
export async function eligibleCompanyQuestionsByJob(jobs, { select = "text orgId jobPostId competencyId roleCategory layer" } = {}) {
  const result = new Map();
  const withRubric = (jobs ?? []).filter((j) => j?.rubricId);
  if (withRubric.length === 0) return result;

  const rubrics = await CompanyRubric.find({ _id: { $in: withRubric.map((j) => j.rubricId) }, status: "approved" })
    .select("companyId criteria.questionIds")
    .lean();
  const rubricById = new Map(rubrics.map((r) => [String(r._id), r]));

  const appliedByJob = new Map();
  const allApplied = new Set();
  for (const job of withRubric) {
    const rubric = rubricById.get(String(job.rubricId));
    if (!rubric || !sameId(rubric.companyId, job.companyId)) continue;
    const ids = new Set((rubric.criteria ?? []).flatMap((c) => (c.questionIds ?? []).map(String)));
    if (ids.size === 0) continue;
    appliedByJob.set(String(job._id), ids);
    ids.forEach((id) => allApplied.add(id));
  }
  if (allApplied.size === 0) return result;

  const questions = await QuestionBank.find({ _id: { $in: [...allApplied] }, status: "approved", orgId: { $ne: null } })
    .select(select.includes("orgId") ? select : `${select} orgId jobPostId`)
    .lean();

  for (const job of withRubric) {
    const applied = appliedByJob.get(String(job._id));
    if (!applied) continue;
    const list = questions.filter(
      (q) =>
        applied.has(String(q._id)) &&
        sameId(q.orgId, job.companyId) &&
        (q.jobPostId == null || sameId(q.jobPostId, job._id)),
    );
    if (list.length) result.set(String(job._id), list);
  }
  return result;
}

/** Số câu doanh nghiệp tối đa mỗi buổi phỏng vấn AI (quyết định JB-06). */
export const COMPANY_QUESTIONS_PER_SESSION = 2;

function shuffle(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * JB-06: chọn câu doanh nghiệp cho một buổi phỏng vấn AI.
 * - Có `jobPostId` (job đang mở): tối đa 2 câu hợp lệ của job đó.
 * - Không có: chọn ngẫu nhiên **một** doanh nghiệp có câu hợp lệ ở job đang mở cùng `roleCategory`
 *   (một trong `roleCategoryKeys`), rồi lấy tối đa 2 câu của doanh nghiệp đó.
 * Không có câu hợp lệ → `[]` (buổi chạy như cũ).
 * @returns {Promise<Array<{ question: object, companyId: any, jobPostId: any, rubricId: any }>>}
 */
export async function selectCompanyQuestionsForSession({ jobPostId = null, roleCategoryKeys = [], rng = Math.random, now = new Date() } = {}) {
  const select = "text originalText orgId jobPostId competencyId competencyName layer seniority starGuidance expectedKeywords deepDive ddiKeyActionTargeted shrmRubricExcellent generatedBy";
  const pick = (job, questions) =>
    shuffle(questions, rng)
      .slice(0, COMPANY_QUESTIONS_PER_SESSION)
      .map((question) => ({ question, companyId: job.companyId, jobPostId: job._id, rubricId: job.rubricId }));

  if (jobPostId) {
    const found = await findPublicJob(jobPostId, now);
    if (!found) return [];
    const eligible = await eligibleCompanyQuestionsByJob([found.job], { select });
    return pick(found.job, eligible.get(String(found.job._id)) ?? []);
  }

  const keys = [...new Set((roleCategoryKeys ?? []).filter(Boolean))];
  if (keys.length === 0) return [];
  const jobs = await JobPost.find({ ...openJobFilter(now), roleCategory: { $in: keys }, rubricId: { $ne: null } }).lean();
  if (jobs.length === 0) return [];
  const activeCompanies = new Set(
    (await Company.find({ _id: { $in: jobs.map((j) => j.companyId) }, status: { $ne: "suspended" } }).distinct("_id")).map(String),
  );
  const openJobs = jobs.filter((j) => activeCompanies.has(String(j.companyId)));
  const eligible = await eligibleCompanyQuestionsByJob(openJobs, { select });

  // Gom theo doanh nghiệp: mỗi câu nhớ job đầu tiên chứa nó (để lưu jobPostId, rubricId vào session).
  const byCompany = new Map();
  for (const job of shuffle(openJobs, rng)) {
    const list = eligible.get(String(job._id));
    if (!list) continue;
    const key = String(job.companyId);
    if (!byCompany.has(key)) byCompany.set(key, new Map());
    const bucket = byCompany.get(key);
    for (const q of list) if (!bucket.has(String(q._id))) bucket.set(String(q._id), { question: q, job });
  }
  if (byCompany.size === 0) return [];
  const companyKeys = [...byCompany.keys()];
  const chosen = [...byCompany.get(companyKeys[Math.floor(rng() * companyKeys.length)]).values()];
  return shuffle(chosen, rng)
    .slice(0, COMPANY_QUESTIONS_PER_SESSION)
    .map(({ question, job }) => ({ question, companyId: job.companyId, jobPostId: job._id, rubricId: job.rubricId }));
}

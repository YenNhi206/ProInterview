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

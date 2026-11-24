/**
 * JB-20: job ứng viên xem gần đây.
 * - `recordJobView`: gọi sau khi `GET /api/jobs/:id` trả job thành công; chỉ ghi cho ứng viên (role `customer`).
 *   Xem lại job cũ thì đưa job đó lên đầu; giữ tối đa `RECENT_JOB_VIEWS_MAX` job.
 * - `listRecentJobs`: job đã xem, mới nhất trước, chỉ trả job **đang mở** và **có câu doanh nghiệp hợp lệ**
 *   (`eligibleCompanyQuestionsByJob`), vì thẻ JB-21 dùng để luyện câu của doanh nghiệp đó.
 */
import mongoose from "mongoose";
import { CandidateProfile } from "../models/CandidateProfile.js";
import { User } from "../models/User.js";
import { JobPost } from "../models/JobPost.js";
import { Company } from "../models/Company.js";
import { openJobFilter, publicJobDTO } from "./publicJobsService.js";
import { eligibleCompanyQuestionsByJob } from "./companyInterviewQuestionService.js";

export const RECENT_JOB_VIEWS_MAX = 5;
const COMPANY_PUBLIC_FIELDS = "name slug logo industry website size address status";

/** Ghi một lượt xem job của ứng viên. Không phải ứng viên / id sai thì bỏ qua (không ném lỗi). */
export async function recordJobView(userId, jobPostId, now = new Date()) {
  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(jobPostId)) return false;
  const user = await User.findById(userId).select("role").lean();
  if (user?.role !== "customer") return false;

  const jobId = new mongoose.Types.ObjectId(String(jobPostId));
  // Hai bước vì MongoDB không cho $pull và $push cùng một field trong một lệnh.
  await CandidateProfile.updateOne({ userId }, { $pull: { recentJobViews: { jobPostId: jobId } } }, { upsert: true });
  await CandidateProfile.updateOne(
    { userId },
    {
      $push: {
        recentJobViews: { $each: [{ jobPostId: jobId, viewedAt: now }], $position: 0, $slice: RECENT_JOB_VIEWS_MAX },
      },
    },
  );
  return true;
}

/**
 * Job xem gần đây còn dùng được để luyện phỏng vấn.
 * @returns {Promise<object[]>} DTO công khai của job + `viewedAt`, `companyQuestionCount`
 */
export async function listRecentJobs(userId, now = new Date()) {
  const profile = await CandidateProfile.findOne({ userId }).select("recentJobViews").lean();
  const views = profile?.recentJobViews ?? [];
  if (views.length === 0) return [];

  const jobs = await JobPost.find({ _id: { $in: views.map((v) => v.jobPostId) }, ...openJobFilter(now) }).lean();
  const companies = await Company.find({ _id: { $in: jobs.map((j) => j.companyId) }, status: { $ne: "suspended" } })
    .select(COMPANY_PUBLIC_FIELDS)
    .lean();
  const companyById = new Map(companies.map((c) => [String(c._id), c]));
  const openJobs = jobs.filter((j) => companyById.has(String(j.companyId)));
  const eligible = await eligibleCompanyQuestionsByJob(openJobs, { select: "_id orgId jobPostId" });
  const jobById = new Map(openJobs.map((j) => [String(j._id), j]));

  return views
    .filter((v) => eligible.has(String(v.jobPostId)))
    .map((v) => {
      const job = jobById.get(String(v.jobPostId));
      return {
        ...publicJobDTO(job, companyById.get(String(job.companyId))),
        viewedAt: v.viewedAt,
        companyQuestionCount: eligible.get(String(job._id)).length,
      };
    });
}

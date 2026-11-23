/**
 * JB-05: khoảng thiếu của ứng viên so với một job đang mở — `GET /api/jobs/:id/gap`.
 *
 * - Năng lực: `CandidateProfile.competencies` (bản đã gộp, PR-06/PR-07) so với `job.requiredCompetencies`
 *   {shrmKey, minLevel 1–5}. Năng lực chưa có bằng chứng (`evidenceCount = 0`) KHÔNG tính là level 1
 *   (giá trị mặc định của hồ sơ) mà là `no_evidence`: chưa đo được, gợi ý đi đo.
 * - Kỹ năng: CV mặc định (`CandidateProfile.defaultCvId`, hoặc `CVDocument.isDefault`) so với
 *   `job.requiredSkills`; so theo chuỗi đã chuẩn hóa (bỏ dấu, hoa/thường, ký tự đặc biệt, đuôi "js").
 * - Chỉ đọc: không tạo hồ sơ, không ghi gì vào DB.
 */
import { CandidateProfile } from "../models/CandidateProfile.js";
import { CVDocument } from "../models/CVDocument.js";
import { httpError } from "../utils/apiErrors.js";
import mongoose from "mongoose";
import { findPublicJob } from "./publicJobsService.js";
import { requiredCompetencyRows } from "./jobPostsService.js";

/** Mức độ thiếu năng lực: thiếu ≥ 2 bậc là `high`, 1 bậc là `medium`; chưa có bằng chứng là `unknown`. */
export function competencySeverity(gap) {
  if (gap === null) return "unknown";
  if (gap >= 2) return "high";
  if (gap >= 1) return "medium";
  return null;
}

/** Chuẩn hóa tên kỹ năng để so: "ReactJS", "React.js", "react" → "react"; "Tiếng Anh" → "tienganh". */
export function normalizeSkill(skill) {
  const base = String(skill ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\+/g, "plus")
    .replace(/#/g, "sharp")
    .replace(/[^a-z0-9]/g, "");
  return base.length > 2 && base.endsWith("js") ? base.slice(0, -2) : base;
}

/** Mọi kỹ năng CV khai báo: `skills`, `content.skills`, công nghệ trong dự án. */
function cvSkillSet(cv) {
  const raw = [
    ...(cv?.skills ?? []),
    ...(cv?.content?.skills ?? []),
    ...(cv?.content?.projects ?? []).flatMap((p) => p?.technologies ?? []),
  ];
  return new Set(raw.map(normalizeSkill).filter(Boolean));
}

function competencyNextStep(status, jobId, name) {
  if (status === "no_evidence") {
    return {
      type: "ai_interview",
      label: `Luyện phỏng vấn AI để hệ thống đo năng lực "${name}"`,
      actionUrl: "/interview",
    };
  }
  return {
    type: "mentor_request",
    label: `Gửi yêu cầu mentor kèm job này để có lộ trình nâng "${name}"`,
    actionUrl: `/mentor-requests?jobPostId=${jobId}`,
  };
}

function skillNextStep(skill, hasCv) {
  return hasCv
    ? { type: "course", label: `Tìm khóa học về "${skill}", rồi bổ sung vào CV nếu bạn đã có kỹ năng này`, actionUrl: `/courses?q=${encodeURIComponent(skill)}` }
    : { type: "update_cv", label: "Chọn CV mặc định trong hồ sơ để so kỹ năng với job", actionUrl: "/profile" };
}

async function loadDefaultCv(userId, profile) {
  if (profile?.defaultCvId) {
    const cv = await CVDocument.findOne({ _id: profile.defaultCvId, userId }).lean();
    if (cv) return cv;
  }
  return CVDocument.findOne({ userId, isDefault: true }).sort({ updatedAt: -1 }).lean();
}

/**
 * @returns {Promise<object>} `{ job, competencies[], skills, summary }`
 */
export async function getJobGap(jobId, userId, now = new Date()) {
  if (!mongoose.isValidObjectId(jobId)) throw httpError(400, "Mã tin tuyển dụng không hợp lệ.");
  const found = await findPublicJob(jobId, now);
  if (!found) throw httpError(404, "Tin tuyển dụng không tồn tại hoặc đã đóng.");
  const { job, company } = found;
  const id = String(job._id);

  const profile = await CandidateProfile.findOne({ userId }).select("competencies defaultCvId").lean();
  const byKey = new Map((profile?.competencies ?? []).map((c) => [c.key, c]));

  const competencies = requiredCompetencyRows(job).map((row) => {
    const own = byKey.get(row.shrmKey);
    const hasEvidence = Number(own?.evidenceCount) > 0;
    const currentLevel = hasEvidence ? Number(own.level) || 0 : null;
    const gap = hasEvidence ? Math.max(0, row.minLevel - currentLevel) : null;
    const status = !hasEvidence ? "no_evidence" : gap > 0 ? "below" : "met";
    return {
      shrmKey: row.shrmKey,
      name: row.name,
      requiredLevel: row.minLevel,
      currentLevel,
      evidenceCount: hasEvidence ? own.evidenceCount : 0,
      gap,
      status,
      severity: status === "met" ? null : competencySeverity(gap),
      nextStep: status === "met" ? null : competencyNextStep(status, id, row.name),
    };
  });

  const cv = await loadDefaultCv(userId, profile);
  const owned = cvSkillSet(cv);
  const required = job.requiredSkills ?? [];
  const matched = [];
  const missing = [];
  for (const skill of required) {
    if (cv && owned.has(normalizeSkill(skill))) matched.push(skill);
    else missing.push({ skill, nextStep: skillNextStep(skill, Boolean(cv)) });
  }

  const metCount = competencies.filter((c) => c.status === "met").length;
  return {
    job: { id, title: job.title, company: company ? { name: company.name, slug: company.slug } : null },
    competencies,
    skills: {
      cv: cv ? { id: String(cv._id), title: cv.title || "" } : null,
      matched,
      missing,
    },
    summary: {
      competenciesMet: metCount,
      competenciesTotal: competencies.length,
      competenciesNoEvidence: competencies.filter((c) => c.status === "no_evidence").length,
      skillsMatched: matched.length,
      skillsTotal: required.length,
    },
  };
}

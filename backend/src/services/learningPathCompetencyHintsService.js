/**
 * LP-23: gợi ý năng lực cho trình soạn lộ trình (quyết định 5: job làm khung, mentor vẫn sửa tự do).
 *
 * Nguồn:
 * - `requiredCompetencies` của job gắn với lộ trình (JB-01), mỗi năng lực có `minLevel` 1–5.
 * - Hồ sơ năng lực ứng viên (PR-07, `getProfileCompetencies`). Năng lực không có bằng chứng
 *   (`evidenceCount = 0`) coi là "chưa có dữ liệu", không coi là mức thấp.
 *
 * Chỉ nhận key hợp lệ trong bộ tiêu chí LP-01; key ngoài bộ (vd. `technical_mastery` của bản PR-07 tạm)
 * bị bỏ để mentor không chọn được key mà chấm điểm và hồ sơ không tra được.
 */
import mongoose from "mongoose";
import { LearningPath } from "../models/LearningPath.js";
import { JobPost } from "../models/JobPost.js";
import { httpError } from "../utils/apiErrors.js";
import { getCompetency, getFramework, isValidCompetencyKey } from "./competencyFramework.js";
import { getProfileCompetencies } from "./candidateProfileService.js";

/**
 * Hàm thuần (dễ test): ghép yêu cầu của job với mức hiện tại của ứng viên.
 *
 * @param {object} input
 * @param {Array<{shrmKey: string, minLevel: number}>} input.jobRequired
 * @param {Array<{key: string, level: number, evidenceCount: number}>} input.candidate
 * @param {number} input.passThreshold  mức đạt của bộ tiêu chí (LP-01)
 * @returns {{ items: Array<object>, hasJob: boolean, hasEvidence: boolean }}
 *   item.status: `gap` (thấp hơn yêu cầu job / dưới mức đạt), `unknown` (job yêu cầu, chưa có dữ liệu), `met`
 */
export function buildCompetencyHints({ jobRequired = [], candidate = [], passThreshold = 3 } = {}) {
  const evidence = new Map();
  for (const c of candidate) {
    if (!isValidCompetencyKey(c?.key) || !(Number(c.evidenceCount) > 0)) continue;
    evidence.set(c.key, Number(c.level) || 0);
  }
  const items = [];
  const seen = new Set();
  for (const req of jobRequired) {
    if (!isValidCompetencyKey(req?.shrmKey, { allowDeprecated: true }) || seen.has(req.shrmKey)) continue;
    seen.add(req.shrmKey);
    const required = Number(req.minLevel) || passThreshold;
    const current = evidence.has(req.shrmKey) ? evidence.get(req.shrmKey) : null;
    const status = current === null ? "unknown" : current < required ? "gap" : "met";
    items.push({ shrmKey: req.shrmKey, fromJob: true, requiredLevel: required, currentLevel: current, gap: current === null ? null : Math.max(0, required - current), status });
  }
  // Không có job (hoặc ngoài yêu cầu job): năng lực ứng viên đã có bằng chứng nhưng dưới mức đạt.
  for (const [key, level] of evidence) {
    if (seen.has(key) || level >= passThreshold) continue;
    items.push({ shrmKey: key, fromJob: false, requiredLevel: passThreshold, currentLevel: level, gap: passThreshold - level, status: "gap" });
  }
  const rank = { gap: 0, unknown: 1, met: 2 };
  items.sort((a, b) => rank[a.status] - rank[b.status] || (b.gap ?? 0) - (a.gap ?? 0) || Number(b.fromJob) - Number(a.fromJob));
  return {
    items: items.map((it) => ({ ...it, name: getCompetency(it.shrmKey)?.nameVi || it.shrmKey })),
    hasJob: jobRequired.length > 0,
    hasEvidence: evidence.size > 0,
  };
}

/** GET /api/learning-paths/:id/competency-hints — chỉ mentor của lộ trình. */
export async function getPathCompetencyHints(actor, pathId) {
  if (!mongoose.isValidObjectId(pathId)) throw httpError(400, "Mã lộ trình không hợp lệ.");
  const path = await LearningPath.findById(pathId).select("mentorId candidateId jobPostId").lean();
  if (!actor?.mentor || !path || String(path.mentorId) !== String(actor.mentor._id)) {
    throw httpError(404, "Không tìm thấy lộ trình.");
  }
  // Job đã đóng vẫn dùng được làm khung: lộ trình soạn cho job ứng viên đã chọn lúc gửi yêu cầu.
  const job = path.jobPostId ? await JobPost.findById(path.jobPostId).select("title requiredCompetencies").lean() : null;
  const { competencies } = await getProfileCompetencies(path.candidateId);
  const hints = buildCompetencyHints({
    jobRequired: job?.requiredCompetencies || [],
    candidate: competencies || [],
    passThreshold: getFramework().passThreshold,
  });
  return { ...hints, jobTitle: job?.title || "", passThreshold: getFramework().passThreshold };
}

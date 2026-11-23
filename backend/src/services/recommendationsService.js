/**
 * AI-10 (REQ AIS-07, C-09): gợi ý mentor, khóa học, job cho ứng viên — `GET /api/recommendations/me`.
 *
 * Chấm theo luật có trọng số (không gọi LLM, không ghi DB). Mỗi gợi ý kèm đúng một dòng lý do.
 *
 * Nền gợi ý:
 *   - "Năng lực còn thiếu": năng lực trong `CandidateProfile.competencies` có bằng chứng
 *     (`evidenceCount > 0`), key có trong bộ tiêu chí LP-01 và level < `passThreshold`. Năng lực
 *     chưa có bằng chứng không tính là thiếu (chưa đo được).
 *   - Mentor: chuyên môn khớp năng lực còn thiếu = đã dạy buổi lộ trình có `shrmKeys` đó (mạnh) hoặc
 *     từ khóa của năng lực xuất hiện trong chức danh / lĩnh vực / chuyên môn / giới thiệu (vừa);
 *     cộng đánh giá (sao, số lượt).
 *   - Khóa học: từ khóa năng lực còn thiếu trong tiêu đề / thẻ / mô tả / "bạn sẽ học được"; cộng
 *     đánh giá; bỏ khóa đã ghi danh.
 *   - Job (đang mở): tỉ lệ năng lực yêu cầu ứng viên đã đạt (`level ≥ minLevel`, có bằng chứng);
 *     cộng điểm khi job đúng vị trí mục tiêu của hồ sơ.
 */
import { CandidateProfile } from "../models/CandidateProfile.js";
import { Mentor } from "../models/Mentor.js";
import { Course } from "../models/Course.js";
import { Enrollment } from "../models/Enrollment.js";
import { JobPost } from "../models/JobPost.js";
import { Company } from "../models/Company.js";
import { LearningPath } from "../models/LearningPath.js";
import { LearningPathSession } from "../models/LearningPathSession.js";
import { getCompetency, getFramework, isValidCompetencyKey, scoreCompetenciesInText } from "./competencyFramework.js";
import { openJobFilter } from "./publicJobsService.js";
import { requiredCompetencyRows } from "./jobPostsService.js";
import { getRoleCategory, roleCategoryName } from "./roleCategories.js";
import { resolveStoredUploadUrl } from "../utils/resolveStoredUploadUrl.js";

export const RECOMMENDATION_WEIGHTS = Object.freeze({
  mentor: { gap: 0.6, rating: 0.3, reviews: 0.1 },
  course: { gap: 0.6, rating: 0.3, reviews: 0.1 },
  job: { competencies: 0.7, role: 0.3 },
  /** Độ mạnh khớp chuyên môn: đã dạy buổi lộ trình về năng lực đó / chỉ khớp từ khóa. */
  taughtMatch: 1,
  textMatch: 0.7,
});
/** Điểm từ khóa tối thiểu để coi là khớp (1 từ khóa chính = 3). */
export const TEXT_MATCH_MIN = 3;
export const DEFAULT_LIMIT = 5;
const CANDIDATE_POOL = 300;

function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Điểm khớp chữ của một năng lực: từ khóa / từ đồng nghĩa (bộ tiêu chí) + tên năng lực. */
function competencyTextScore(scores, normText, key) {
  const meta = getCompetency(key);
  let score = scores[key] ?? 0;
  const names = [meta?.nameVi, meta?.nameEn]
    .flatMap((n) => String(n ?? "").split("&"))
    .map(normalize)
    .filter((n) => n.length > 3);
  if (names.some((n) => ` ${normText} `.includes(` ${n} `))) score += 3;
  return score;
}

const ratingPart = (rating) => Math.max(0, Math.min(1, (Number(rating) || 0) / 5));
const reviewsPart = (count) => Math.min(1, Math.log10(1 + (Number(count) || 0)) / 2);
const round3 = (n) => Math.round(n * 1000) / 1000;
const ratingText = (rating, count) =>
  count > 0 ? `${(Number(rating) || 0).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}★ (${count} đánh giá)` : "";

function gapWeight(gap) {
  return Math.max(1, getFramework().passThreshold - gap.level);
}

/**
 * Chấm độ khớp một đối tượng với danh sách năng lực còn thiếu.
 * @param {{ key: string, strength: number }[]} matches
 * @returns {{ score: number, best: object|null }}  score 0–1
 */
function gapScore(gaps, matches) {
  if (!gaps.length || !matches.length) return { score: 0, best: null };
  const byKey = new Map(matches.map((m) => [m.key, m]));
  const total = gaps.reduce((s, g) => s + gapWeight(g), 0);
  let sum = 0;
  let best = null;
  for (const g of gaps) {
    const m = byKey.get(g.key);
    if (!m) continue;
    const value = gapWeight(g) * m.strength;
    sum += value;
    if (!best || value > best.value) best = { ...g, ...m, value };
  }
  return { score: sum / total, best };
}

// ── Nền: hồ sơ năng lực ──────────────────────────────────────────────────────────────────────

async function loadBasis(userId) {
  const profile = await CandidateProfile.findOne({ userId }).select("competencies targetRole targetRoles").lean();
  const pass = getFramework().passThreshold;
  const levels = new Map();
  const gaps = [];
  for (const c of profile?.competencies ?? []) {
    if (!(Number(c.evidenceCount) > 0) || !isValidCompetencyKey(c.key)) continue;
    const level = Number(c.level) || 0;
    levels.set(c.key, level);
    if (level < pass) gaps.push({ key: c.key, name: getCompetency(c.key)?.nameVi || c.key, level });
  }
  gaps.sort((a, b) => a.level - b.level);
  const targetRoles = [profile?.targetRole, ...(profile?.targetRoles ?? [])].map((r) => String(r ?? "").trim()).filter(Boolean);
  return { gaps, levels, targetRoles };
}

// ── Mentor ───────────────────────────────────────────────────────────────────────────────────

async function taughtKeysByMentor(gapKeys) {
  if (!gapKeys.length) return new Map();
  const sessions = await LearningPathSession.find({ status: "done", shrmKeys: { $in: gapKeys } })
    .select("pathId shrmKeys")
    .lean();
  if (!sessions.length) return new Map();
  const paths = await LearningPath.find({ _id: { $in: [...new Set(sessions.map((s) => String(s.pathId)))] } })
    .select("mentorId")
    .lean();
  const mentorByPath = new Map(paths.map((p) => [String(p._id), String(p.mentorId)]));
  const out = new Map(); // mentorId → Map(key → số buổi)
  for (const s of sessions) {
    const mentorId = mentorByPath.get(String(s.pathId));
    if (!mentorId) continue;
    if (!out.has(mentorId)) out.set(mentorId, new Map());
    const counts = out.get(mentorId);
    for (const k of s.shrmKeys) if (gapKeys.includes(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return out;
}

async function recommendMentors(basis, limit) {
  const rows = await Mentor.find({ isActive: true, isVerified: true, userId: { $ne: null } })
    .populate({ path: "userId", select: "role isActive" })
    .sort({ "stats.rating": -1, "stats.reviewCount": -1 })
    .limit(CANDIDATE_POOL)
    .lean();
  const mentors = rows.filter((m) => m.userId?.role === "mentor" && m.userId?.isActive !== false);
  const gapKeys = basis.gaps.map((g) => g.key);
  const taught = await taughtKeysByMentor(gapKeys);
  const w = RECOMMENDATION_WEIGHTS.mentor;

  const scored = mentors.map((m) => {
    const text = [m.title, ...(m.fields ?? []), ...(m.specialties ?? []), m.bio].join(" ");
    const scores = scoreCompetenciesInText(text);
    const norm = normalize(text);
    const taughtCounts = taught.get(String(m._id)) ?? new Map();
    const matches = gapKeys
      .map((key) => {
        if (taughtCounts.get(key)) return { key, strength: RECOMMENDATION_WEIGHTS.taughtMatch, sessions: taughtCounts.get(key) };
        if (competencyTextScore(scores, norm, key) >= TEXT_MATCH_MIN) return { key, strength: RECOMMENDATION_WEIGHTS.textMatch };
        return null;
      })
      .filter(Boolean);
    const gap = gapScore(basis.gaps, matches);
    const rating = m.stats?.rating ?? 0;
    const reviewCount = m.stats?.reviewCount ?? 0;
    const score = basis.gaps.length
      ? w.gap * gap.score + w.rating * ratingPart(rating) + w.reviews * reviewsPart(reviewCount)
      : (w.rating * ratingPart(rating) + w.reviews * reviewsPart(reviewCount)) / (w.rating + w.reviews);
    const stars = ratingText(rating, reviewCount);
    let reason;
    if (gap.best?.sessions) {
      reason = `Đã dạy ${gap.best.sessions} buổi lộ trình về "${gap.best.name}", năng lực bạn đang ở mức ${gap.best.level}/5`;
    } else if (gap.best) {
      reason = `Có chuyên môn về "${gap.best.name}", năng lực bạn đang ở mức ${gap.best.level}/5${stars ? ` · ${stars}` : ""}`;
    } else {
      reason = stars ? `Mentor được đánh giá ${stars}` : "Mentor đã được xác minh trên ProInterview";
    }
    return { m, score, matched: Boolean(gap.best), reason };
  });

  return pickTop(scored, limit).map(({ m, score, reason }) => {
    const id = m.publicId ?? String(m._id);
    return {
      id,
      name: m.name,
      title: m.title,
      company: m.company,
      avatar: resolveStoredUploadUrl(m.avatar ?? ""),
      rating: m.stats?.rating ?? 0,
      reviewCount: m.stats?.reviewCount ?? 0,
      score: round3(score),
      reason,
      actionUrl: `/mentors/${id}`,
    };
  });
}

// ── Khóa học ─────────────────────────────────────────────────────────────────────────────────

async function recommendCourses(basis, limit, userId) {
  const enrolled = await Enrollment.find({ userId }).distinct("courseId");
  const courses = await Course.find({ status: { $in: ["published", "pending_update"] }, _id: { $nin: enrolled } })
    .select("title shortDescription description tags topics whatYoullLearn thumbnail level price isFree discountPrice stats")
    .sort({ "stats.rating": -1, "stats.enrollmentCount": -1 })
    .limit(CANDIDATE_POOL)
    .lean();
  const gapKeys = basis.gaps.map((g) => g.key);
  const w = RECOMMENDATION_WEIGHTS.course;

  const scored = courses.map((c) => {
    const text = [c.title, c.shortDescription, c.description, ...(c.tags ?? []), ...(c.whatYoullLearn ?? [])].join(" ");
    const scores = scoreCompetenciesInText(text);
    const norm = normalize(text);
    const matches = gapKeys
      .filter((key) => competencyTextScore(scores, norm, key) >= TEXT_MATCH_MIN)
      .map((key) => ({ key, strength: RECOMMENDATION_WEIGHTS.textMatch }));
    const gap = gapScore(basis.gaps, matches);
    const rating = c.stats?.rating ?? 0;
    const reviewCount = c.stats?.reviewCount ?? 0;
    const score = basis.gaps.length
      ? w.gap * gap.score + w.rating * ratingPart(rating) + w.reviews * reviewsPart(reviewCount)
      : (w.rating * ratingPart(rating) + w.reviews * reviewsPart(reviewCount)) / (w.rating + w.reviews);
    const stars = ratingText(rating, reviewCount);
    const reason = gap.best
      ? `Bổ trợ năng lực "${gap.best.name}", bạn đang ở mức ${gap.best.level}/5`
      : stars
        ? `Khóa học được đánh giá ${stars}`
        : "Khóa học mới trên ProInterview";
    return { c, score, matched: Boolean(gap.best), reason };
  });

  return pickTop(scored, limit).map(({ c, score, reason }) => ({
    id: String(c._id),
    title: c.title,
    thumbnail: resolveStoredUploadUrl(c.thumbnail ?? ""),
    level: c.level,
    price: c.price ?? 0,
    isFree: Boolean(c.isFree),
    rating: c.stats?.rating ?? 0,
    reviewCount: c.stats?.reviewCount ?? 0,
    score: round3(score),
    reason,
    actionUrl: `/courses/${c._id}`,
  }));
}

// ── Job ──────────────────────────────────────────────────────────────────────────────────────

function roleMatches(job, targetRoles) {
  if (!targetRoles.length) return false;
  const role = getRoleCategory(job.roleCategory);
  const labels = [job.roleCategory, role?.nameVi, role?.nameEn, job.title].map(normalize).filter(Boolean);
  return targetRoles.map(normalize).some((t) => t && labels.some((l) => l === t || l.includes(t) || t.includes(l)));
}

async function recommendJobs(basis, limit, now) {
  const suspended = await Company.find({ status: "suspended" }).distinct("_id");
  const jobs = await JobPost.find({ ...openJobFilter(now), ...(suspended.length ? { companyId: { $nin: suspended } } : {}) })
    .sort({ publishedAt: -1, _id: -1 })
    .limit(CANDIDATE_POOL)
    .lean();
  const w = RECOMMENDATION_WEIGHTS.job;

  const scored = jobs.map((j) => {
    const rows = requiredCompetencyRows(j);
    const met = rows.filter((r) => (basis.levels.get(r.shrmKey) ?? -1) >= r.minLevel);
    const fraction = rows.length ? met.length / rows.length : 0;
    const role = roleMatches(j, basis.targetRoles);
    const score = w.competencies * fraction + w.role * (role ? 1 : 0);
    let reason;
    if (met.length && rows.length) {
      reason = `Bạn đã đạt ${met.length}/${rows.length} năng lực job yêu cầu${role ? `, đúng vị trí mục tiêu "${roleCategoryName(j.roleCategory)}"` : ""}`;
    } else if (role) {
      reason = `Đúng vị trí mục tiêu "${roleCategoryName(j.roleCategory)}" trong hồ sơ của bạn`;
    } else {
      reason = `Tin mới đăng cho vị trí "${roleCategoryName(j.roleCategory)}"`;
    }
    return { j, score, matched: met.length > 0 || role, reason };
  });

  const top = pickTop(scored, limit);
  const companies = await Company.find({ _id: { $in: [...new Set(top.map((t) => String(t.j.companyId)))] } })
    .select("name slug logo")
    .lean();
  const companyById = new Map(companies.map((c) => [String(c._id), c]));
  return top.map(({ j, score, reason }) => {
    const company = companyById.get(String(j.companyId));
    return {
      id: String(j._id),
      title: j.title,
      roleCategory: j.roleCategory,
      roleCategoryName: roleCategoryName(j.roleCategory),
      level: j.level,
      location: j.location || "",
      company: company ? { name: company.name, slug: company.slug, logo: resolveStoredUploadUrl(company.logo ?? "") } : null,
      score: round3(score),
      reason,
      actionUrl: `/jobs/${j._id}`,
    };
  });
}

/** Mục khớp trước (điểm giảm dần); thiếu thì lấp bằng mục còn lại theo điểm. Thứ tự ổn định. */
function pickTop(scored, limit) {
  return scored
    .map((x, i) => ({ ...x, i }))
    .sort((a, b) => Number(b.matched) - Number(a.matched) || b.score - a.score || a.i - b.i)
    .slice(0, limit);
}

/**
 * @param {string|import("mongoose").Types.ObjectId} userId
 * @param {{ limit?: number, now?: Date }} [opts]
 */
export async function getRecommendations(userId, { limit = DEFAULT_LIMIT, now = new Date() } = {}) {
  const basis = await loadBasis(userId);
  const [mentors, courses, jobs] = await Promise.all([
    recommendMentors(basis, limit),
    recommendCourses(basis, limit, userId),
    recommendJobs(basis, limit, now),
  ]);
  return {
    basis: {
      gaps: basis.gaps.map((g) => ({ key: g.key, name: g.name, level: g.level })),
      targetRoles: basis.targetRoles,
      passThreshold: getFramework().passThreshold,
    },
    mentors,
    courses,
    jobs,
  };
}

/**
 * PR-06 (REQ AIS-07, C-02): gộp hồ sơ năng lực của ứng viên vào `CandidateProfile.competencies`.
 *
 * Nguồn (gộp lại toàn bộ mỗi lần, chạy lại cho cùng kết quả):
 *   1. Phỏng vấn AI — buổi `completed` (bỏ `in_progress`, `abandoned`): mỗi câu có key năng lực hợp lệ
 *      (`questions[i].competencyId`; câu baseline cũ chưa có key thì tra theo nội dung trong
 *      `config/baselineQuestions.js`). Mức = `aiAnswerToLevel` (điểm moderator chấm lại nếu có; chấm
 *      thiếu tiêu chí → bỏ qua).
 *   2. Buổi lộ trình đã `done` mentor chấm (`feedback.scores[]`, số nguyên 0–5, LP-13).
 *   3. Khóa học hoàn thành (`completedAt` hoặc tiến độ 100%): chỉ ghi vào danh sách nguồn của năng lực
 *      khớp theo từ khóa, KHÔNG đổi mức và KHÔNG tính vào `evidenceCount` (quyết định PR-06 ngày 24/11/2026).
 *
 * Mức (quyết định PR-06 ngày 24/11/2026): trung bình có trọng số của 5 điểm AI và 3 điểm mentor gần nhất,
 * điểm mentor hệ số 2. Chỉ có nguồn khóa học → `level: null` ("Chưa đủ dữ liệu").
 *
 * Cập nhật theo sự kiện: `scheduleCompetencyRecompute(userId)` sau khi chấm buổi phỏng vấn, moderator
 * chấm lại, mentor ghi kết quả buổi lộ trình, khóa học hoàn thành. Hồ sơ gộp bằng cách cũ (khác
 * `COMPETENCY_PROFILE_VERSION`) được gộp lại khi đọc, hoặc bằng `npm run db:recompute-competency-profiles`.
 */
import mongoose from "mongoose";
import { CandidateProfile } from "../models/CandidateProfile.js";
import { InterviewSession } from "../models/InterviewSession.js";
import { LearningPath } from "../models/LearningPath.js";
import { LearningPathSession } from "../models/LearningPathSession.js";
import { Enrollment } from "../models/Enrollment.js";
import { baselineQuestionByText } from "../config/baselineQuestions.js";
import {
  aiAnswerToLevel, getCompetency, isValidCompetencyKey, matchCompetencyKeysInText,
} from "./competencyFramework.js";
import { logger } from "../config/logger.js";

export const COMPETENCY_PROFILE_VERSION = "pr06-v1";
export const LEVEL_WEIGHTS = Object.freeze({
  ai_interview: { weight: 1, recent: 5 },
  mentor_session: { weight: 2, recent: 3 },
});
/** Số nguồn tối đa lưu cho mỗi năng lực (mới nhất trước). */
export const MAX_SOURCES_PER_COMPETENCY = 20;

const round2 = (n) => Math.round(n * 100) / 100;
const atOf = (...dates) => dates.find((d) => d && !Number.isNaN(new Date(d).getTime())) ?? new Date(0);

/** Key của câu trong buổi phỏng vấn: key đã lưu nếu hợp lệ, không thì tra câu baseline theo nội dung. */
export function questionCompetencyKey(question) {
  const stored = question?.competencyId;
  if (isValidCompetencyKey(stored, { allowDeprecated: true })) return stored;
  const baseline = baselineQuestionByText(question?.question);
  return baseline?.competencyId && isValidCompetencyKey(baseline.competencyId) ? baseline.competencyId : null;
}

// ── Gom bằng chứng ───────────────────────────────────────────────────────────────────────────

async function interviewEvidence(userId) {
  const sessions = await InterviewSession.find({ userId, status: "completed", "feedback.perQuestion.0": { $exists: true } })
    .select("questions.question questions.competencyId answers feedback.perQuestion inferredRole competencyProfile.roleCategory completedAt createdAt")
    .lean();
  const out = [];
  for (const s of sessions) {
    const at = atOf(s.completedAt, s.createdAt);
    const role = s.inferredRole || s.competencyProfile?.roleCategory || "";
    (s.questions ?? []).forEach((q, i) => {
      const key = questionCompetencyKey(q);
      if (!key) return;
      const item = (s.feedback?.perQuestion ?? []).find((p) => p.questionIndex === i);
      const answer = (s.answers ?? []).find((a) => a.questionIndex === i) ?? null;
      if (!item && !answer?.moderatorOverride) return;
      const level = aiAnswerToLevel(item ?? {}, { answer });
      if (level === null) return;
      out.push({
        key,
        type: "ai_interview",
        refId: s._id,
        title: `Phỏng vấn AI${role ? ` (${role})` : ""}, câu ${i + 1}${answer?.moderatorOverride ? " · moderator đã chấm lại" : ""}`,
        level,
        at,
      });
    });
  }
  return out;
}

async function mentorEvidence(userId) {
  const pathIds = await LearningPath.find({ candidateId: userId }).distinct("_id");
  if (!pathIds.length) return [];
  const sessions = await LearningPathSession.find({ pathId: { $in: pathIds }, status: "done", "feedback.scores.0": { $exists: true } })
    .select("title order feedback.scores doneAt updatedAt")
    .lean();
  const out = [];
  for (const s of sessions) {
    for (const sc of s.feedback?.scores ?? []) {
      if (!isValidCompetencyKey(sc.shrmKey, { allowDeprecated: true }) || typeof sc.score !== "number") continue;
      out.push({
        key: sc.shrmKey,
        type: "mentor_session",
        refId: s._id,
        title: `Buổi lộ trình ${s.order}: ${s.title}`,
        level: sc.score,
        at: atOf(s.doneAt, s.updatedAt),
      });
    }
  }
  return out;
}

async function courseEvidence(userId) {
  const enrollments = await Enrollment.find({ userId, $or: [{ completedAt: { $ne: null } }, { progressPercent: { $gte: 100 } }] })
    .populate({ path: "courseId", select: "title shortDescription description tags whatYoullLearn" })
    .select("courseId completedAt updatedAt")
    .lean();
  const out = [];
  for (const e of enrollments) {
    const c = e.courseId;
    if (!c || typeof c !== "object") continue;
    const text = [c.title, c.shortDescription, c.description, ...(c.tags ?? []), ...(c.whatYoullLearn ?? [])].join(" ");
    for (const key of matchCompetencyKeysInText(text)) {
      out.push({ key, type: "course", refId: c._id, title: `Khóa học: ${c.title}`, level: null, at: atOf(e.completedAt, e.updatedAt) });
    }
  }
  return out;
}

// ── Tính mức ─────────────────────────────────────────────────────────────────────────────────

/**
 * Mức của một năng lực từ các bằng chứng có mức: trung bình có trọng số của N điểm gần nhất mỗi loại.
 * @param {{ type: string, level: number|null, at: Date }[]} evidence
 * @returns {number|null}
 */
export function computeCompetencyLevel(evidence) {
  let sum = 0;
  let weight = 0;
  for (const [type, rule] of Object.entries(LEVEL_WEIGHTS)) {
    const recent = evidence
      .filter((e) => e.type === type && typeof e.level === "number")
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, rule.recent);
    for (const e of recent) {
      sum += e.level * rule.weight;
      weight += rule.weight;
    }
  }
  return weight ? round2(sum / weight) : null;
}

/** Danh sách năng lực từ toàn bộ bằng chứng; năng lực có mức trước, mức cao trước. */
export function buildCompetencies(evidence) {
  const byKey = new Map();
  for (const e of evidence) {
    if (!byKey.has(e.key)) byKey.set(e.key, []);
    byKey.get(e.key).push(e);
  }
  const rows = [];
  for (const [key, list] of byKey) {
    const level = computeCompetencyLevel(list);
    const meta = getCompetency(key);
    rows.push({
      key,
      name: meta?.nameVi || key,
      category: meta?.shrm || "",
      level,
      score: level === null ? 0 : Math.round(level * 20),
      evidenceCount: list.filter((e) => typeof e.level === "number").length,
      sources: [...list]
        .sort((a, b) => new Date(b.at) - new Date(a.at))
        .slice(0, MAX_SOURCES_PER_COMPETENCY)
        .map((e) => ({
          type: e.type,
          refId: e.refId,
          title: e.title,
          level: typeof e.level === "number" ? round2(e.level) : null,
          score: typeof e.level === "number" ? Math.round(e.level * 20) : null,
          at: e.at,
        })),
    });
  }
  return rows.sort((a, b) => (b.level === null) - (a.level === null) || (b.level ?? 0) - (a.level ?? 0) || a.key.localeCompare(b.key));
}

export async function collectCompetencyEvidence(userId) {
  const [ai, mentor, course] = await Promise.all([interviewEvidence(userId), mentorEvidence(userId), courseEvidence(userId)]);
  return [...ai, ...mentor, ...course];
}

/**
 * Gộp lại và lưu hồ sơ năng lực. Chưa có `CandidateProfile`: không có bằng chứng thì không tạo; có thì
 * tạo bằng `getOrCreateCandidateProfile` (điền headline, vị trí mục tiêu từ tài khoản) rồi mới ghi.
 * @returns {Promise<object[]>} competencies đã lưu
 */
export async function recomputeCompetencyProfile(userId) {
  const competencies = buildCompetencies(await collectCompetencyEvidence(userId));
  if (!(await CandidateProfile.exists({ userId }))) {
    if (!competencies.length) return [];
    // import động: candidateProfileService cũng import file này.
    const { getOrCreateCandidateProfile } = await import("./candidateProfileService.js");
    await getOrCreateCandidateProfile(userId);
  }
  const verified = competencies.some((c) => c.evidenceCount > 0);
  const now = new Date();
  const profile = await CandidateProfile.findOneAndUpdate(
    { userId },
    {
      $set: {
        competencies,
        competenciesVersion: COMPETENCY_PROFILE_VERSION,
        competenciesComputedAt: now,
        isVerified: verified,
      },
    },
    { returnDocument: "after" },
  );
  if (verified && !profile.verifiedAt) {
    await CandidateProfile.updateOne({ _id: profile._id, verifiedAt: null }, { $set: { verifiedAt: now } });
  }
  return profile.competencies.map((c) => (c.toObject ? c.toObject() : c));
}

const inflight = new Set();

/** Gộp lại ở nền sau một sự kiện (không chặn response; lỗi chỉ ghi log). */
export function scheduleCompetencyRecompute(userId) {
  if (!userId || !mongoose.isValidObjectId(String(userId))) return null;
  const p = recomputeCompetencyProfile(userId)
    .catch((err) => logger.error("competency_profile_recompute_failed", { userId: String(userId), error: err?.message }))
    .finally(() => inflight.delete(p));
  inflight.add(p);
  return p;
}

/** Chỉ dùng trong test: chờ các lượt gộp nền xong. */
export async function waitForCompetencyRecomputes() {
  while (inflight.size) await Promise.all([...inflight]);
}

/**
 * moderationQualityService.js — KPI chất lượng AI cho /moderator/quality (spec S1 §4).
 * Aggregation MongoDB, cache 5 phút (Redis ở production qua cacheService).
 *
 * Quy ước kỳ [from, to]:
 *  - approvalRate / editRate: câu được duyệt (review.at) hoặc khai tử (deprecation.at) trong kỳ.
 *  - flagRate: report AI tạo trong kỳ / session hoàn thành (completedAt) trong kỳ.
 *  - incompleteEvalRate: câu evaluationIncomplete / tổng câu được chấm, session chấm trong kỳ.
 *  - aiModeratorAgreement: override (moderatorOverride.at) trong kỳ.
 *  - bank, byCompetency: trạng thái hiện tại toàn kho (flagCount là bộ đếm cộng dồn).
 */
import { QuestionBank } from "../models/QuestionBank.js";
import { ModerationItem } from "../models/ModerationItem.js";
import { Report, AI_REPORT_TARGET_TYPES } from "../models/Report.js";
import { InterviewSession } from "../models/InterviewSession.js";
import { cacheGetOrSet } from "./cacheService.js";

const CACHE_TTL_SECONDS = 5 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;
const AGREEMENT_THRESHOLD = 0.5;

export function resolveRange({ from, to } = {}, now = new Date()) {
  const end = to ? new Date(to) : now;
  const start = from ? new Date(from) : new Date(end.getTime() - 30 * DAY_MS);
  return { from: start, to: end };
}

const ratio = (num, den) => (den > 0 ? Math.round((num / den) * 10000) / 10000 : null);

export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Thứ Hai đầu tuần (UTC) dạng YYYY-MM-DD — khoá weeklyTrend. */
export function weekKey(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

async function bankStats(now) {
  const [byStatus, pendingOver7d] = await Promise.all([
    QuestionBank.aggregate([{ $match: { orgId: null } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    QuestionBank.countDocuments({ orgId: null, status: "pending_review", createdAt: { $lt: new Date(now.getTime() - 7 * DAY_MS) } }),
  ]);
  const counts = { pending_review: 0, approved: 0, deprecated: 0 };
  for (const r of byStatus) counts[r._id] = r.count;
  return { byStatus: counts, pendingOver7d };
}

async function queueStats(range) {
  const [open, inReview, resolvedRows] = await Promise.all([
    ModerationItem.countDocuments({ status: "open" }),
    ModerationItem.countDocuments({ status: "in_review" }),
    ModerationItem.find(
      { status: { $in: ["resolved", "dismissed"] }, "resolution.at": { $gte: range.from, $lte: range.to } },
      { createdAt: 1, "resolution.at": 1 },
    ).lean(),
  ]);
  // Kẹp ≥ 0: lệch đồng hồ / dữ liệu nhập tay không được ra thời gian xử lý âm.
  const hours = resolvedRows.map((r) => Math.max(0, (new Date(r.resolution.at) - new Date(r.createdAt)) / 3_600_000));
  const med = median(hours);
  return { open, inReview, resolvedInPeriod: resolvedRows.length, medianTimeToResolveHours: med === null ? null : Math.round(med * 100) / 100 };
}

/**
 * Chỉ tính quyết định trên câu do AI sinh: câu moderator tự tạo / bộ dự phòng tĩnh được duyệt sẵn,
 * tính vào sẽ đẩy approvalRate lên giả (vd. sync 40 câu fallback → ~98%).
 */
const AI_GENERATED_SOURCES = ["llm_followup", "ai_generated"];

/** approved / deprecated trong kỳ, nhóm theo khoá (promptVersion hoặc tuần). */
async function decisionsInRange(range) {
  const [approved, deprecated] = await Promise.all([
    QuestionBank.find(
      { orgId: null, source: { $in: AI_GENERATED_SOURCES }, status: "approved", "review.at": { $gte: range.from, $lte: range.to } },
      { "review.at": 1, revisions: { $slice: 1 }, "generatedBy.promptVersion": 1 },
    ).lean(),
    QuestionBank.find(
      { orgId: null, source: { $in: AI_GENERATED_SOURCES }, status: "deprecated", "deprecation.at": { $gte: range.from, $lte: range.to } },
      { "deprecation.at": 1, "generatedBy.promptVersion": 1 },
    ).lean(),
  ]);
  return { approved, deprecated };
}

async function flagCounts(range) {
  const [aiReports, completedSessions] = await Promise.all([
    Report.find(
      { targetType: { $in: AI_REPORT_TARGET_TYPES }, createdAt: { $gte: range.from, $lte: range.to } },
      { targetType: 1, targetId: 1, questionIndex: 1, createdAt: 1 },
    ).lean(),
    InterviewSession.find({ status: "completed", completedAt: { $gte: range.from, $lte: range.to } }, { completedAt: 1 }).lean(),
  ]);
  return { aiReports, completedSessions };
}

/** Session có câu được chấm trong kỳ: tổng câu chấm + câu thiếu tiêu chí + override. */
async function evaluatedSessions(range) {
  return InterviewSession.find(
    { feedbackGeneratedAt: { $gte: range.from, $lte: range.to } },
    { "feedback.perQuestion.questionIndex": 1, "feedback.perQuestion.overall5": 1, "feedback.promptVersion": 1, "answers.questionIndex": 1, "answers.evaluationIncomplete": 1 },
  ).lean();
}

async function overridesInRange(range) {
  return InterviewSession.aggregate([
    { $match: { "answers.moderatorOverride.at": { $gte: range.from, $lte: range.to } } },
    { $unwind: "$answers" },
    { $match: { "answers.moderatorOverride.at": { $gte: range.from, $lte: range.to } } },
    {
      $project: {
        questionIndex: "$answers.questionIndex",
        overallMod: "$answers.moderatorOverride.overall",
        perQuestion: "$feedback.perQuestion",
      },
    },
  ]);
}

function agreementStats(rows) {
  const diffs = rows
    .map((r) => {
      const ai = (r.perQuestion ?? []).find((p) => p.questionIndex === r.questionIndex)?.overall5;
      return typeof ai === "number" && typeof r.overallMod === "number" ? Math.abs(r.overallMod - ai) : null;
    })
    .filter((d) => d !== null);
  return {
    overrides: diffs.length,
    aiModeratorAgreement: ratio(diffs.filter((d) => d <= AGREEMENT_THRESHOLD).length, diffs.length),
    meanAbsoluteDiff: diffs.length ? Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 1000) / 1000 : null,
  };
}

async function byCompetency() {
  const rows = await QuestionBank.aggregate([
    { $match: { orgId: null } },
    {
      $group: {
        _id: "$competencyId",
        flagCount: { $sum: "$flagCount" },
        deprecated: { $sum: { $cond: [{ $eq: ["$status", "deprecated"] }, 1, 0] } },
        total: { $sum: 1 },
      },
    },
    { $sort: { flagCount: -1, deprecated: -1 } },
  ]);
  return rows.map((r) => ({ competencyId: r._id || "", flagCount: r.flagCount, deprecated: r.deprecated, total: r.total }));
}

/** promptVersion của câu hỏi (session.questions[i]) / của lần chấm (session.feedback) cho từng report. */
async function reportPromptVersions(aiReports) {
  const sessionIds = [...new Set(aiReports.map((r) => String(r.targetId)))];
  const sessions = sessionIds.length
    ? await InterviewSession.find({ _id: { $in: sessionIds } }, { "questions.promptVersion": 1, "feedback.promptVersion": 1 }).lean()
    : [];
  const byId = new Map(sessions.map((s) => [String(s._id), s]));
  return aiReports.map((r) => {
    const s = byId.get(String(r.targetId));
    return r.targetType === "interview_question"
      ? s?.questions?.[r.questionIndex]?.promptVersion || "unknown"
      : s?.feedback?.promptVersion || "unknown";
  });
}

async function computeStats(range, now) {
  const [bank, queue, decisions, flags, evaluated, overrides, competencies] = await Promise.all([
    bankStats(now),
    queueStats(range),
    decisionsInRange(range),
    flagCounts(range),
    evaluatedSessions(range),
    overridesInRange(range),
    byCompetency(),
  ]);

  const approvedCount = decisions.approved.length;
  const editedApproved = decisions.approved.filter((q) => (q.revisions ?? []).length > 0).length;

  let gradedQuestions = 0;
  let incompleteQuestions = 0;
  const gradedByVersion = new Map();
  for (const s of evaluated) {
    const n = (s.feedback?.perQuestion ?? []).length;
    gradedQuestions += n;
    incompleteQuestions += (s.answers ?? []).filter((a) => a.evaluationIncomplete).length;
    const v = s.feedback?.promptVersion || "unknown";
    gradedByVersion.set(v, (gradedByVersion.get(v) ?? 0) + n);
  }

  // byPromptVersion: câu follow-up (approvalRate + flagRate theo số câu đã phục vụ trong kỳ) và
  // lần chấm (flagRate theo số câu đã chấm trong kỳ). Đây là chỉ báo prompt drift.
  const versions = await reportPromptVersions(flags.aiReports);
  const servedByVersion = new Map();
  const servedRows = await InterviewSession.aggregate([
    { $match: { status: "completed", completedAt: { $gte: range.from, $lte: range.to } } },
    { $unwind: "$questions" },
    { $match: { "questions.promptVersion": { $nin: [null, ""] } } },
    { $group: { _id: "$questions.promptVersion", count: { $sum: 1 } } },
  ]);
  for (const r of servedRows) servedByVersion.set(r._id, r.count);

  const versionMap = new Map();
  const bucket = (v) => {
    if (!versionMap.has(v)) versionMap.set(v, { promptVersion: v, reports: 0, approved: 0, deprecated: 0 });
    return versionMap.get(v);
  };
  versions.forEach((v) => bucket(v).reports++);
  decisions.approved.forEach((q) => bucket(q.generatedBy?.promptVersion || "unknown").approved++);
  decisions.deprecated.forEach((q) => bucket(q.generatedBy?.promptVersion || "unknown").deprecated++);
  for (const v of [...servedByVersion.keys(), ...gradedByVersion.keys()]) bucket(v);
  const byPromptVersion = [...versionMap.values()].map((b) => {
    const denominator = (servedByVersion.get(b.promptVersion) ?? 0) + (gradedByVersion.get(b.promptVersion) ?? 0);
    return {
      promptVersion: b.promptVersion,
      reports: b.reports,
      flagRate: ratio(b.reports, denominator),
      approvalRate: ratio(b.approved, b.approved + b.deprecated),
    };
  });

  const weeks = new Map();
  const week = (d) => {
    const k = weekKey(new Date(d));
    if (!weeks.has(k)) weeks.set(k, { week: k, reports: 0, completedSessions: 0, approved: 0, deprecated: 0 });
    return weeks.get(k);
  };
  flags.aiReports.forEach((r) => week(r.createdAt).reports++);
  flags.completedSessions.forEach((s) => week(s.completedAt).completedSessions++);
  decisions.approved.forEach((q) => week(q.review.at).approved++);
  decisions.deprecated.forEach((q) => week(q.deprecation.at).deprecated++);
  const weeklyTrend = [...weeks.values()]
    .sort((a, b) => a.week.localeCompare(b.week))
    .map((w) => ({
      week: w.week,
      flagRate: ratio(w.reports, w.completedSessions),
      approvalRate: ratio(w.approved, w.approved + w.deprecated),
      reports: w.reports,
      completedSessions: w.completedSessions,
    }));

  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    bank,
    queue,
    approvalRate: ratio(approvedCount, approvedCount + decisions.deprecated.length),
    editRate: ratio(editedApproved, approvedCount),
    flagRate: ratio(flags.aiReports.length, flags.completedSessions.length),
    incompleteEvalRate: ratio(incompleteQuestions, gradedQuestions),
    ...agreementStats(overrides),
    byCompetency: competencies,
    byPromptVersion,
    weeklyTrend,
  };
}

/**
 * Cache 5 phút theo kỳ. Kỳ mặc định (không truyền to) làm tròn "to" LÊN mốc 5 phút kế tiếp để key
 * ổn định mà vẫn gồm dữ liệu mới nhất (làm tròn xuống sẽ bỏ sót tối đa 5 phút gần nhất).
 */
export async function getQualityStats(query = {}, { now = new Date(), useCache = true } = {}) {
  const bucketMs = CACHE_TTL_SECONDS * 1000;
  const roundedNow = new Date(Math.ceil(now.getTime() / bucketMs) * bucketMs);
  const range = resolveRange(query, query.to ? now : roundedNow);
  if (!useCache) return { ok: true, stats: await computeStats(range, now) };
  const key = `moderator:quality:${range.from.toISOString()}:${range.to.toISOString()}`;
  const { value, fromCache } = await cacheGetOrSet(key, async () => JSON.stringify(await computeStats(range, now)), CACHE_TTL_SECONDS);
  return { ok: true, stats: JSON.parse(value), cached: fromCache };
}

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
 *  - rubrics (AI-07): `pendingReview` là hiện tại; số đã duyệt / từ chối và thời gian duyệt tính theo
 *    `moderationNote.reviewedAt` trong kỳ, thời gian duyệt = reviewedAt − `submittedAt` (rubric gửi trước
 *    AI-07 không có `submittedAt` thì không tính thời gian, đếm ở `withoutSubmitTime`).
 *  - promptVersionChanges (AI-07): mỗi lần đổi version của prompt chấm điểm / sinh câu (theo
 *    `PromptVersion.activations`) có `at` ≤ cuối kỳ, mới nhất trước, tối đa 10. Tỉ lệ bị sửa tính theo
 *    version ghi trên dữ liệu (không theo khoảng thời gian), toàn bộ dữ liệu của version đó:
 *      evaluation  : câu được moderator chấm lại / câu đã chấm, session có `feedback.promptVersion` = version;
 *      question_gen: câu bị sửa (approved có `revisions`) hoặc khai tử / câu đã có quyết định, câu AI sinh
 *                    (`generatedBy.promptVersion` = version, pool chung).
 */
import { QuestionBank } from "../models/QuestionBank.js";
import { ModerationItem, HITL_QUEUE_TYPES } from "../models/ModerationItem.js";
import { Report, AI_REPORT_TARGET_TYPES } from "../models/Report.js";
import { InterviewSession } from "../models/InterviewSession.js";
import { CompanyRubric } from "../models/CompanyRubric.js";
import { PromptVersion } from "../models/PromptVersion.js";
import { AIImprovementProposal } from "../models/AIImprovementProposal.js";
import { cacheGet, cacheSet } from "./cacheService.js";
import { logger } from "../config/logger.js";

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
    ModerationItem.countDocuments({ status: "open", type: { $in: HITL_QUEUE_TYPES } }),
    ModerationItem.countDocuments({ status: "in_review", type: { $in: HITL_QUEUE_TYPES } }),
    ModerationItem.find(
      {
        type: { $in: HITL_QUEUE_TYPES },
        status: { $in: ["resolved", "dismissed"] },
        "resolution.at": { $gte: range.from, $lte: range.to },
      },
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

// ── AI-07: rubric doanh nghiệp ─────────────────────────────────────────────────────────────────

const round2 = (n) => (n === null ? null : Math.round(n * 100) / 100);

async function rubricStats(range, now) {
  const [pending, reviewed] = await Promise.all([
    CompanyRubric.find({ status: "pending_review" }, { submittedAt: 1, updatedAt: 1 }).lean(),
    // Đã duyệt rồi bị thay bản (`archived`) vẫn là một lượt duyệt trong kỳ.
    CompanyRubric.find(
      { status: { $in: ["approved", "rejected", "archived"] }, "moderationNote.reviewedAt": { $gte: range.from, $lte: range.to } },
      { status: 1, submittedAt: 1, "moderationNote.reviewedAt": 1 },
    ).lean(),
  ]);
  // Chờ từ lúc gửi; rubric cũ không có `submittedAt` thì từ lần sửa cuối (lúc chuyển sang pending).
  const waitingHours = pending.map((r) => Math.max(0, (now - new Date(r.submittedAt ?? r.updatedAt)) / 3_600_000));
  const reviewHours = reviewed
    .filter((r) => r.submittedAt)
    .map((r) => Math.max(0, (new Date(r.moderationNote.reviewedAt) - new Date(r.submittedAt)) / 3_600_000));
  return {
    pendingReview: pending.length,
    pendingOver7d: waitingHours.filter((h) => h > 7 * 24).length,
    oldestPendingHours: waitingHours.length ? round2(Math.max(...waitingHours)) : null,
    reviewedInPeriod: reviewed.length,
    approvedInPeriod: reviewed.filter((r) => r.status !== "rejected").length,
    rejectedInPeriod: reviewed.filter((r) => r.status === "rejected").length,
    medianReviewHours: round2(median(reviewHours)),
    withoutSubmitTime: reviewed.length - reviewHours.length,
  };
}

// ── AI-07: tỉ lệ bị sửa trước / sau mỗi lần đổi version ───────────────────────────────────────

const VERSION_CHANGE_KEYS = ["evaluation", "question_gen"];
const MAX_VERSION_CHANGES = 10;

/** { sample, corrected, rate } của một version prompt chấm điểm. */
async function evaluationCorrection(version) {
  const [row] = await InterviewSession.aggregate([
    { $match: { "feedback.promptVersion": version } },
    {
      $project: {
        graded: { $size: { $ifNull: ["$feedback.perQuestion", []] } },
        corrected: {
          $size: {
            $filter: { input: { $ifNull: ["$answers", []] }, as: "a", cond: { $gt: ["$$a.moderatorOverride.at", null] } },
          },
        },
      },
    },
    { $group: { _id: null, sample: { $sum: "$graded" }, corrected: { $sum: "$corrected" } } },
  ]);
  const sample = row?.sample ?? 0;
  const corrected = row?.corrected ?? 0;
  return { sample, corrected, rate: ratio(corrected, sample) };
}

/** { sample, corrected, rate } của một version prompt sinh câu (câu AI sinh, pool chung). */
async function questionGenCorrection(version) {
  const base = { orgId: null, source: { $in: AI_GENERATED_SOURCES }, "generatedBy.promptVersion": version };
  const [approved, edited, deprecated] = await Promise.all([
    QuestionBank.countDocuments({ ...base, status: "approved" }),
    QuestionBank.countDocuments({ ...base, status: "approved", "revisions.0": { $exists: true } }),
    QuestionBank.countDocuments({ ...base, status: "deprecated" }),
  ]);
  const sample = approved + deprecated;
  const corrected = edited + deprecated;
  return { sample, corrected, rate: ratio(corrected, sample) };
}

const correctionOf = (key, version) =>
  (key === "evaluation" ? evaluationCorrection(version) : questionGenCorrection(version));

async function promptVersionChanges(range) {
  const docs = await PromptVersion.find(
    { key: { $in: VERSION_CHANGE_KEYS }, $or: [{ "activations.0": { $exists: true } }, { activatedAt: { $ne: null } }] },
    { key: 1, version: 1, activatedAt: 1, activations: 1 },
  ).lean();

  const events = [];
  for (const d of docs) {
    const log = d.activations?.length
      ? d.activations
      // Bật trước AI-07 (chưa có lịch sử): chỉ biết lần bật gần nhất, không biết bản trước.
      : [{ at: d.activatedAt, previousVersion: "" }];
    for (const a of log) {
      if (a.at && new Date(a.at) <= range.to) {
        events.push({ promptKey: d.key, fromVersion: a.previousVersion || null, toVersion: d.version, activatedAt: new Date(a.at) });
      }
    }
  }
  events.sort((a, b) => b.activatedAt - a.activatedAt);
  const recent = events.slice(0, MAX_VERSION_CHANGES);

  // Đề xuất cải tiến AI gắn với lần đổi (duyệt: before → after; rollback: after → before).
  const versions = [...new Set(recent.flatMap((e) => [e.toVersion, e.fromVersion]).filter(Boolean))];
  const proposals = versions.length
    ? await AIImprovementProposal.find(
        { status: { $in: ["approved", "rolled_back"] }, "after.version": { $in: versions } },
        { status: 1, kind: 1, groupKey: 1, "before.version": 1, "after.version": 1 },
      ).lean()
    : [];

  const cache = new Map();
  const correction = (key, version) => {
    if (!version) return null;
    const k = `${key}:${version}`;
    if (!cache.has(k)) cache.set(k, correctionOf(key, version));
    return cache.get(k);
  };

  return Promise.all(
    recent.map(async (e) => {
      const [before, after] = await Promise.all([correction(e.promptKey, e.fromVersion), correction(e.promptKey, e.toVersion)]);
      const approvedBy = proposals.find((p) => p.after?.version === e.toVersion && p.before?.version === e.fromVersion);
      const rolledBack = proposals.find(
        (p) => p.status === "rolled_back" && p.after?.version === e.fromVersion && p.before?.version === e.toVersion,
      );
      const proposal = approvedBy ?? rolledBack;
      return {
        promptKey: e.promptKey,
        fromVersion: e.fromVersion,
        toVersion: e.toVersion,
        activatedAt: e.activatedAt.toISOString(),
        change: rolledBack && !approvedBy ? "rollback" : "activate",
        proposal: proposal ? { _id: String(proposal._id), kind: proposal.kind, groupKey: proposal.groupKey } : null,
        before,
        after,
        rateDelta: before?.rate != null && after?.rate != null ? Math.round((after.rate - before.rate) * 10000) / 10000 : null,
      };
    }),
  );
}

async function computeStats(range, now) {
  const [bank, queue, decisions, flags, evaluated, overrides, competencies, rubrics, versionChanges] = await Promise.all([
    bankStats(now),
    queueStats(range),
    decisionsInRange(range),
    flagCounts(range),
    evaluatedSessions(range),
    overridesInRange(range),
    byCompetency(),
    rubricStats(range, now),
    promptVersionChanges(range),
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
    rubrics,
    promptVersionChanges: versionChanges,
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

  // Dashboard chỉ đọc số liệu: Redis lỗi (production fail-fast ném lỗi) thì bỏ qua cache và tính trực
  // tiếp, không trả 500. Lỗi khi tính số liệu (MongoDB, code) vẫn ném lên như cũ.
  let cached = null;
  try {
    cached = await cacheGet(key);
  } catch (err) {
    logger.warn("moderator_quality_cache_bypass", { op: "GET", key, error: err?.message });
  }
  if (cached !== null) return { ok: true, stats: JSON.parse(cached), cached: true };

  const stats = await computeStats(range, now);
  try {
    await cacheSet(key, JSON.stringify(stats), CACHE_TTL_SECONDS);
  } catch (err) {
    logger.warn("moderator_quality_cache_bypass", { op: "SET", key, error: err?.message });
  }
  return { ok: true, stats, cached: false };
}

/**
 * Đào đề xuất cải tiến AI từ quyết định của moderator (AI-03, REQ AIS-06, DESIGN.md mục 6).
 *
 * Nguồn: ModerationItem đã `resolved`.
 *   - `override_score` → target `evaluation` (prompt chấm điểm), nhóm theo năng lực của câu
 *     (`questions[i].competencyId`; câu baseline chưa có key thì `_general`).
 *   - `edit_question` / `deprecate_question` → target `question_gen` (prompt sinh câu follow-up),
 *     nhóm theo `roleCategory` của câu trong bank. Bỏ qua câu của công ty (`orgId`): nội dung công ty
 *     không được vào prompt chung (quyết định AI-18 chỉ cho dùng rubric ẩn danh, qua đường riêng).
 *
 * Nhóm có ≥ ngưỡng item chưa dùng (mặc định 5, `AI_IMPROVEMENT_MIN_EVIDENCE`) và chưa có đề xuất
 * `proposed` → tạo PromptVersion mới chưa bật (bản active + few-shot từ các ca lệch nhiều nhất) và
 * 1 `AIImprovementProposal` kind `few_shot`, rồi báo cho Platform Moderator.
 * Mỗi item chỉ làm bằng chứng một lần (unique index trên `evidence.moderationItemIds`).
 */
import { AIImprovementProposal } from "../models/AIImprovementProposal.js";
import { ModerationItem } from "../models/ModerationItem.js";
import { InterviewSession } from "../models/InterviewSession.js";
import { QuestionBank } from "../models/QuestionBank.js";
import { PromptVersion } from "../models/PromptVersion.js";
import { User } from "../models/User.js";
import { EVALUATION_KEY } from "../prompts/evaluationPrompt.js";
import { QUESTION_GEN_KEY } from "../prompts/questionGenPrompt.js";
import { createVersion, getActivePrompt } from "./promptVersionService.js";
import { deliverNotification } from "./notificationDeliveryService.js";
import { logger } from "../config/logger.js";

export const DEFAULT_MIN_EVIDENCE = 5;
/** Số few-shot mới thêm vào mỗi đề xuất. */
export const NEW_EXAMPLES_PER_PROPOSAL = 3;
/** Trần tổng few-shot của một version (giữ các ví dụ mới nhất) để prompt không phình. */
export const MAX_VERSION_EXAMPLES = 9;
export const GENERAL_GROUP = "_general";
const TEXT_LIMIT = 1200;

export function minEvidenceThreshold() {
  const n = Number.parseInt(process.env.AI_IMPROVEMENT_MIN_EVIDENCE ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MIN_EVIDENCE;
}

const clip = (s) => {
  const text = String(s ?? "").trim();
  return text.length > TEXT_LIMIT ? `${text.slice(0, TEXT_LIMIT)}…` : text;
};
const round2 = (n) => Math.round(n * 100) / 100;

const consumedItemIds = () => AIImprovementProposal.distinct("evidence.moderationItemIds");

// ── Gom bằng chứng ────────────────────────────────────────────────────────────────────────────

/** override_score → [{ itemId, groupKey, example, delta }] */
async function collectEvaluationEvidence(consumed) {
  const items = await ModerationItem.find({
    status: "resolved",
    "resolution.action": "override_score",
    "refs.sessionId": { $ne: null },
    _id: { $nin: consumed },
  })
    .sort({ "resolution.at": 1, _id: 1 })
    .lean();
  if (!items.length) return [];

  const sessionIds = [...new Set(items.map((i) => String(i.refs.sessionId)))];
  const sessions = await InterviewSession.find({ _id: { $in: sessionIds } })
    .select("questions.competencyId questions.question answers.questionIndex answers.transcript answers.moderatorOverride")
    .lean();
  const byId = new Map(sessions.map((s) => [String(s._id), s]));

  const rows = [];
  for (const item of items) {
    const session = byId.get(String(item.refs.sessionId));
    const qi = item.refs.questionIndex;
    const answer = (session?.answers ?? []).find((a) => a.questionIndex === qi);
    const override = answer?.moderatorOverride;
    if (!override?.scores) continue; // chưa ghi được điểm chấm lại → không học được gì
    const question = session?.questions?.[qi];
    const aiOverall = Number(item.snapshot?.aiEvaluation?.overall);
    const delta = Number.isFinite(aiOverall) && Number.isFinite(override.overall) ? override.overall - aiOverall : null;
    const questionText = item.snapshot?.questionText || question?.question || "";
    const transcript = item.snapshot?.transcript || answer?.transcript || "";
    rows.push({
      itemId: item._id,
      groupKey: question?.competencyId || GENERAL_GROUP,
      delta,
      example: {
        input: `Câu hỏi: ${clip(questionText)}\nCâu trả lời: "${clip(transcript)}"`,
        output: JSON.stringify({
          scores: override.scores,
          overall: override.overall,
          shrm_level: override.shrmLevel ?? "",
        }),
        note: clip(override.note || item.resolution?.note || ""),
      },
    });
  }
  return rows;
}

/** edit_question / deprecate_question → [{ itemId, groupKey, example }] */
async function collectQuestionEvidence(consumed) {
  const items = await ModerationItem.find({
    status: "resolved",
    "resolution.action": { $in: ["edit_question", "deprecate_question"] },
    "refs.questionBankId": { $ne: null },
    _id: { $nin: consumed },
  })
    .sort({ "resolution.at": 1, _id: 1 })
    .lean();
  if (!items.length) return [];

  const bankIds = [...new Set(items.map((i) => String(i.refs.questionBankId)))];
  const questions = await QuestionBank.find({ _id: { $in: bankIds } })
    .select("text originalText roleCategory orgId deprecation")
    .lean();
  const byId = new Map(questions.map((q) => [String(q._id), q]));

  const rows = [];
  for (const item of items) {
    const q = byId.get(String(item.refs.questionBankId));
    if (!q || q.orgId) continue;
    const shown = item.snapshot?.questionText || q.originalText || q.text;
    const edited = item.resolution.action === "edit_question";
    rows.push({
      itemId: item._id,
      groupKey: q.roleCategory || GENERAL_GROUP,
      delta: null,
      example: {
        input: `Câu hỏi đã sinh: ${clip(shown)}`,
        output: edited
          ? `Câu đã được kiểm duyệt viên sửa thành: ${clip(q.text)}`
          : "Câu bị loại khỏi ngân hàng câu hỏi: không sinh câu theo kiểu này.",
        note: clip(item.resolution?.note || q.deprecation?.reason || ""),
      },
    });
  }
  return rows;
}

function groupRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.groupKey)) groups.set(row.groupKey, []);
    groups.get(row.groupKey).push(row);
  }
  return groups;
}

/** Ca lệch nhiều nhất trước (evaluation); question_gen giữ thứ tự xử lý, mới nhất trước. */
function pickExamples(rows) {
  const sorted = [...rows].sort((a, b) => {
    if (a.delta !== null && b.delta !== null) return Math.abs(b.delta) - Math.abs(a.delta);
    return 0;
  });
  if (sorted.every((r) => r.delta === null)) sorted.reverse();
  return sorted.slice(0, NEW_EXAMPLES_PER_PROPOSAL).map((r) => r.example);
}

// ── Tạo đề xuất ───────────────────────────────────────────────────────────────────────────────

const TARGET_LABEL = { evaluation: "chấm điểm", question_gen: "sinh câu follow-up" };

async function createProposal({ target, promptKey, groupKey, rows }) {
  const base = await getActivePrompt(promptKey);
  const newExamples = pickExamples(rows);
  const merged = [...(base.fewShotExamples ?? []), ...newExamples].slice(-MAX_VERSION_EXAMPLES);
  const deltas = rows.map((r) => r.delta).filter((d) => d !== null);
  const avgScoreDelta = deltas.length ? round2(deltas.reduce((s, d) => s + d, 0) / deltas.length) : null;
  const summary =
    `${rows.length} lượt kiểm duyệt cho nhóm "${groupKey}" (${TARGET_LABEL[target]})` +
    (avgScoreDelta !== null ? `, điểm moderator lệch điểm AI trung bình ${avgScoreDelta > 0 ? "+" : ""}${avgScoreDelta}` : "") +
    `. Đề xuất thêm ${newExamples.length} ví dụ đã kiểm duyệt vào prompt.`;

  const version = await createVersion(promptKey, {
    baseVersion: base.source === "db" ? base.version : null,
    fewShotExamples: merged,
    note: `AI-03: đề xuất few-shot nhóm ${groupKey}`,
  });

  try {
    const proposal = await AIImprovementProposal.create({
      target,
      kind: "few_shot",
      groupKey,
      summary,
      evidence: { moderationItemIds: rows.map((r) => r.itemId), overrideCount: rows.length, avgScoreDelta },
      before: { promptKey, version: base.version, fewShotExamples: base.fewShotExamples ?? [] },
      after: { promptKey, version: version.version, fewShotExamples: merged },
    });
    return proposal.toObject();
  } catch (err) {
    // Lượt chạy song song đã tạo đề xuất cho nhóm này / đã dùng item → bỏ version thừa.
    await PromptVersion.deleteOne({ _id: version._id, active: false }).catch(() => {});
    if (err?.code === 11000) return null;
    throw err;
  }
}

async function notifyModerators(proposals) {
  if (!proposals.length) return;
  const moderators = await User.find({ role: "moderator", isActive: { $ne: false } }).select("_id").lean();
  for (const p of proposals) {
    for (const m of moderators) {
      await deliverNotification(m._id, {
        type: "ai_improvement_proposed",
        title: "Có đề xuất cải tiến AI mới",
        body: p.summary,
        metadata: { proposalId: p._id, actionUrl: "/moderator/ai-improvements" },
      }).catch((err) => logger.warn("ai_improvement_notify_failed", { proposalId: String(p._id), error: err?.message }));
    }
  }
}

/**
 * Một lượt đào. Gọi từ `aiImprovementMinerJob` (mỗi ngày) hoặc test.
 * @param {{ threshold?: number, notify?: boolean }} [opts]
 * @returns {Promise<{ created: object[], skipped: { target: string, groupKey: string, reason: string }[] }>}
 */
export async function mineImprovementProposals({ threshold = minEvidenceThreshold(), notify = true } = {}) {
  const consumed = await consumedItemIds();
  const sources = [
    { target: "evaluation", promptKey: EVALUATION_KEY, rows: await collectEvaluationEvidence(consumed) },
    { target: "question_gen", promptKey: QUESTION_GEN_KEY, rows: await collectQuestionEvidence(consumed) },
  ];

  const created = [];
  const skipped = [];
  for (const { target, promptKey, rows } of sources) {
    for (const [groupKey, groupRowsList] of groupRows(rows)) {
      if (groupRowsList.length < threshold) continue;
      const open = await AIImprovementProposal.exists({ target, kind: "few_shot", groupKey, status: "proposed" });
      if (open) {
        // Item để lại, dùng cho đề xuất sau khi đề xuất đang chờ được xử lý.
        skipped.push({ target, groupKey, reason: "open_proposal" });
        continue;
      }
      try {
        const proposal = await createProposal({ target, promptKey, groupKey, rows: groupRowsList });
        if (proposal) created.push(proposal);
        else skipped.push({ target, groupKey, reason: "concurrent" });
      } catch (err) {
        // Một nhóm lỗi (vd. bản active có template hỏng) không chặn các nhóm khác.
        logger.error("ai_improvement_group_failed", { target, groupKey, error: err?.message });
        skipped.push({ target, groupKey, reason: "error" });
      }
    }
  }

  if (created.length) {
    logger.info("ai_improvement_mined", {
      created: created.map((p) => ({ id: String(p._id), target: p.target, groupKey: p.groupKey, version: p.after.version })),
    });
  }
  if (notify) await notifyModerators(created);
  return { created, skipped };
}

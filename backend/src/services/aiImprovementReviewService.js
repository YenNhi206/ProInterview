/**
 * Platform Moderator duyệt đề xuất cải tiến AI (AI-05, REQ PM-04, DESIGN.md mục 6 bước 3–4).
 *
 * - `approve`: `proposed` → `approved`, bật `after.version` (PromptVersion chưa bật do miner tạo).
 *   Chỉ duyệt được khi bản đang chạy vẫn là `before.version`: nếu một đề xuất khác cùng key đã được
 *   duyệt trước, bản sau của đề xuất này dựng trên bản cũ và sẽ làm mất ví dụ của đề xuất kia → 409,
 *   dùng `rebase` để dựng lại trên bản đang chạy rồi backtest lại.
 * - `reject`: `proposed` → `rejected`. Bằng chứng vẫn tính là đã dùng (miner không lấy lại).
 * - `rollback`: `approved` → `rolled_back`, bật lại `before.version`. Chỉ khi bản đang chạy vẫn là
 *   `after.version` (đã có version khác bật sau thì rollback sẽ gỡ nhầm thay đổi khác) → 409.
 * - `rebase`: đề xuất `proposed` có `before.version` khác bản đang chạy → tạo version mới = bản đang
 *   chạy + ví dụ mới của đề xuất, cập nhật `before`/`after`, xóa kết quả backtest cũ.
 * - `startBacktest`: chạy lại backtest AI-04 ở nền (gọi LLM khoảng 12 lần), trả ngay.
 *
 * Đổi trạng thái bằng `findOneAndUpdate` có điều kiện trạng thái cũ để hai moderator bấm cùng lúc
 * không cùng thành công; bật version lỗi thì trả trạng thái cũ.
 */
import mongoose from "mongoose";
import { AIImprovementProposal, AI_IMPROVEMENT_STATUSES, AI_IMPROVEMENT_TARGETS } from "../models/AIImprovementProposal.js";
import { PromptVersion } from "../models/PromptVersion.js";
import { PROMPT_REGISTRY } from "../prompts/index.js";
import { activate, createVersion } from "./promptVersionService.js";
import { MAX_VERSION_EXAMPLES } from "./aiImprovementMinerService.js";
import { runBacktest } from "./aiImprovementBacktestService.js";
import { httpError } from "../utils/apiErrors.js";
import { logger } from "../config/logger.js";

/** Backtest `running` lâu hơn mức này coi như đã chết (instance restart) và cho chạy lại. */
export const BACKTEST_STALE_MS = 15 * 60 * 1000;

const ACTION_FROM = { approve: "proposed", reject: "proposed", rollback: "approved", rebase: "proposed" };

function assertId(id) {
  if (!mongoose.isValidObjectId(id)) throw httpError(400, "id không hợp lệ.");
}

async function loadProposal(id) {
  assertId(id);
  const proposal = await AIImprovementProposal.findById(id).lean();
  if (!proposal) throw httpError(404, "Không tìm thấy đề xuất cải tiến AI.");
  return proposal;
}

function promptKeyOf(proposal) {
  const key = proposal.after?.promptKey || proposal.before?.promptKey;
  if (!PROMPT_REGISTRY[key]) throw httpError(400, `Đề xuất có key prompt "${key}" chưa đăng ký.`);
  return key;
}

/** Version đang chạy của key theo DB; chưa có bản active thì là bản mặc định trong code. */
export async function runningVersion(key) {
  const doc = await PromptVersion.findOne({ key, active: true }).select("version").lean();
  return doc?.version ?? PROMPT_REGISTRY[key].default.version;
}

/** Bản mặc định trong code chưa có trong DB (DB chưa sync) → tạo để `activate()` bật được. */
async function ensureVersionInDb(key, version) {
  if (await PromptVersion.exists({ key, version })) return;
  const d = PROMPT_REGISTRY[key].default;
  if (version !== d.version) throw httpError(404, `Không tìm thấy phiên bản "${version}" của prompt "${key}".`);
  await createVersion(key, { version, template: d.template, fewShotExamples: d.fewShotExamples, note: "Bản mặc định trong code (AI-05 rollback)" });
}

/** Chuyển trạng thái có điều kiện; không khớp thì 409 nêu trạng thái hiện tại. */
async function transition(proposal, action, set) {
  const from = ACTION_FROM[action];
  const updated = await AIImprovementProposal.findOneAndUpdate(
    { _id: proposal._id, status: from },
    { $set: set },
    { new: true },
  ).lean();
  if (!updated) {
    const current = await AIImprovementProposal.findById(proposal._id).select("status").lean();
    throw httpError(409, `Đề xuất đang ở trạng thái "${current?.status ?? "?"}", không ${ACTION_LABEL[action]} được.`);
  }
  return updated;
}

const ACTION_LABEL = { approve: "duyệt", reject: "từ chối", rollback: "rollback", rebase: "dựng lại" };

// ── Đọc ───────────────────────────────────────────────────────────────────────────────────────

/**
 * @param {{ status?: string, target?: string, page?: number, limit?: number }} q
 */
export async function listProposals({ status, target, page = 1, limit = 20 } = {}) {
  if (status && !AI_IMPROVEMENT_STATUSES.includes(status)) throw httpError(400, "status không hợp lệ.");
  if (target && !AI_IMPROVEMENT_TARGETS.includes(target)) throw httpError(400, "target không hợp lệ.");
  const filter = { ...(status && { status }), ...(target && { target }) };
  const [proposals, total] = await Promise.all([
    AIImprovementProposal.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      // Danh sách không cần điểm từng câu của backtest.
      .select("-backtest.items -backtest.oldAnswers")
      .populate("review.by", "name email")
      .lean(),
    AIImprovementProposal.countDocuments(filter),
  ]);
  return { proposals, total, page, limit };
}

/** Chi tiết + version đang chạy của key, để FE biết nút nào bấm được. */
export async function getProposal(id) {
  assertId(id);
  const proposal = await AIImprovementProposal.findById(id)
    .populate("review.by", "name email")
    .lean();
  if (!proposal) throw httpError(404, "Không tìm thấy đề xuất cải tiến AI.");
  const key = promptKeyOf(proposal);
  const activeVersion = await runningVersion(key);
  return {
    proposal,
    activeVersion,
    actions: {
      approve: proposal.status === "proposed" && activeVersion === proposal.before?.version,
      reject: proposal.status === "proposed",
      rebase: proposal.status === "proposed" && activeVersion !== proposal.before?.version,
      rollback: proposal.status === "approved" && activeVersion === proposal.after?.version,
    },
  };
}

// ── Thao tác ──────────────────────────────────────────────────────────────────────────────────

async function approve(proposal, { by, note }) {
  const key = promptKeyOf(proposal);
  const active = await runningVersion(key);
  if (active !== proposal.before?.version) {
    throw httpError(409, `Prompt "${key}" đang chạy ${active}, khác bản gốc ${proposal.before?.version} của đề xuất. Dựng lại đề xuất (rebase) và backtest lại trước khi duyệt.`);
  }
  const updated = await transition(proposal, "approve", { status: "approved", review: { by, at: new Date(), note } });
  try {
    await activate(key, proposal.after.version, { by, note: `AI-05: duyệt đề xuất ${proposal._id}${note ? ` — ${note}` : ""}` });
  } catch (err) {
    await AIImprovementProposal.updateOne({ _id: proposal._id, status: "approved" }, { $set: { status: "proposed", review: proposal.review ?? {} } });
    throw err;
  }
  logger.info("ai_improvement_approved", { proposalId: String(proposal._id), key, version: proposal.after.version });
  return updated;
}

async function reject(proposal, { by, note }) {
  const updated = await transition(proposal, "reject", { status: "rejected", review: { by, at: new Date(), note } });
  logger.info("ai_improvement_rejected", { proposalId: String(proposal._id) });
  return updated;
}

async function rollback(proposal, { by, note }) {
  const key = promptKeyOf(proposal);
  const active = await runningVersion(key);
  if (active !== proposal.after?.version) {
    throw httpError(409, `Prompt "${key}" đang chạy ${active}, không phải bản ${proposal.after?.version} của đề xuất này; rollback sẽ gỡ nhầm thay đổi khác.`);
  }
  await ensureVersionInDb(key, proposal.before.version);
  const updated = await transition(proposal, "rollback", {
    status: "rolled_back",
    // Giữ người duyệt ban đầu trong `review`; ghi người rollback vào note để xem lại.
    "review.note": [proposal.review?.note, `Rollback${note ? `: ${note}` : ""}`].filter(Boolean).join(" · "),
    "review.at": new Date(),
    "review.by": by,
  });
  try {
    await activate(key, proposal.before.version, { by, note: `AI-05: rollback đề xuất ${proposal._id}${note ? ` — ${note}` : ""}` });
  } catch (err) {
    await AIImprovementProposal.updateOne({ _id: proposal._id, status: "rolled_back" }, { $set: { status: "approved", review: proposal.review ?? {} } });
    throw err;
  }
  logger.info("ai_improvement_rolled_back", { proposalId: String(proposal._id), key, version: proposal.before.version });
  return updated;
}

const exampleId = (e) => `${e?.input ?? ""}\u0000${e?.output ?? ""}`;

async function rebase(proposal, { by }) {
  if (proposal.status !== "proposed") {
    throw httpError(409, `Đề xuất đang ở trạng thái "${proposal.status}", không dựng lại được.`);
  }
  const key = promptKeyOf(proposal);
  const active = await runningVersion(key);
  if (active === proposal.before?.version) throw httpError(409, "Đề xuất đã dựng trên bản đang chạy, không cần dựng lại.");

  const activeDoc = await PromptVersion.findOne({ key, active: true }).lean();
  const baseExamples = activeDoc?.fewShotExamples ?? [];
  const oldBase = new Set((proposal.before?.fewShotExamples ?? []).map(exampleId));
  const have = new Set(baseExamples.map(exampleId));
  const added = (proposal.after?.fewShotExamples ?? []).filter((e) => !oldBase.has(exampleId(e)) && !have.has(exampleId(e)));
  const merged = [...baseExamples, ...added].slice(-MAX_VERSION_EXAMPLES);

  const version = await createVersion(key, {
    baseVersion: activeDoc?.version ?? null,
    fewShotExamples: merged,
    note: `AI-05: dựng lại đề xuất ${proposal._id} trên ${active}`,
  });
  const updated = await AIImprovementProposal.findOneAndUpdate(
    { _id: proposal._id, status: "proposed", "before.version": proposal.before?.version },
    {
      $set: {
        before: { promptKey: key, version: active, fewShotExamples: baseExamples },
        after: { promptKey: key, version: version.version, fewShotExamples: merged },
        backtest: null,
      },
    },
    { new: true },
  ).lean();
  if (!updated) {
    await PromptVersion.deleteOne({ _id: version._id, active: false }).catch(() => {});
    throw httpError(409, "Đề xuất vừa được người khác thay đổi, tải lại rồi thử lại.");
  }
  logger.info("ai_improvement_rebased", { proposalId: String(proposal._id), by: String(by ?? ""), base: active, version: version.version });
  return updated;
}

const ACTIONS = { approve, reject, rollback, rebase };

/**
 * PATCH /api/moderator/ai-improvements/:id
 * @param {{ action: "approve"|"reject"|"rollback"|"rebase", note?: string }} body
 */
export async function reviewProposal(id, { action, note = "" } = {}, by = null) {
  const fn = ACTIONS[action];
  if (!fn) throw httpError(400, "action phải là approve, reject, rollback hoặc rebase.");
  const proposal = await loadProposal(id);
  const updated = await fn(proposal, { by, note: String(note ?? "").trim() });
  const key = promptKeyOf(updated);
  return { proposal: updated, activeVersion: await runningVersion(key) };
}

/**
 * POST /api/moderator/ai-improvements/:id/backtest — chạy lại backtest ở nền.
 * @param {{ run?: Function }} [opts]  `run`: thay `runBacktest` (test)
 */
export async function startBacktest(id, { run = runBacktest } = {}) {
  const proposal = await loadProposal(id);
  if (proposal.status !== "proposed") {
    throw httpError(409, "Chỉ backtest lại được đề xuất đang chờ duyệt.");
  }
  const startedAt = new Date();
  const staleBefore = new Date(startedAt.getTime() - BACKTEST_STALE_MS);
  // Giữ chỗ: không cho 2 lượt chạy cùng lúc (trừ lượt cũ đã quá hạn).
  const claimed = await AIImprovementProposal.findOneAndUpdate(
    {
      _id: proposal._id,
      status: "proposed",
      $or: [{ "backtest.status": { $ne: "running" } }, { "backtest.ranAt": { $lt: staleBefore } }],
    },
    { $set: { backtest: { status: "running", ranAt: startedAt } } },
    { new: true },
  ).lean();
  if (!claimed) throw httpError(409, "Backtest đang chạy, đợi kết quả rồi thử lại.");

  const done = Promise.resolve()
    .then(() => run(proposal._id))
    .catch((err) => logger.error("ai_backtest_background_failed", { proposalId: String(proposal._id), error: err?.message }));
  return { backtest: claimed.backtest, done };
}

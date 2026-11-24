/**
 * Integration AI-04: backtest đề xuất cải tiến AI trên bộ AI-01 + câu trả lời cũ.
 * "Xong khi": hiện được độ lệch so với điểm chuẩn (lưu trong `proposal.backtest`).
 * LLM được thay bằng hàm chấm giả: bản trước chấm cao hơn chuẩn 1 mức, bản sau chấm đúng chuẩn.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { applyTestEnv, startMongoHarness, stopMongoHarness } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();

let harness;
let User;
let InterviewSession;
let PromptVersion;
let AIImprovementProposal;
let pv;
let bt;
let dataset;
let customer;
let seq = 0;

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ InterviewSession } = await import("../models/InterviewSession.js"));
  ({ PromptVersion } = await import("../models/PromptVersion.js"));
  ({ AIImprovementProposal } = await import("../models/AIImprovementProposal.js"));
  pv = await import("../services/promptVersionService.js");
  bt = await import("../services/aiImprovementBacktestService.js");
  dataset = bt.loadAi01Dataset();
  await Promise.all([PromptVersion.syncIndexes(), AIImprovementProposal.syncIndexes()]);
});

after(async () => {
  await stopMongoHarness(harness);
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), InterviewSession.deleteMany({}), PromptVersion.deleteMany({}), AIImprovementProposal.deleteMany({})]);
  pv.clearPromptCache();
  seq += 1;
  customer = await User.create({ name: "Cand", email: `ai04-cand-${seq}@test.local`, role: "customer" });
});

const goldByTranscript = () => new Map(dataset.items.map((it) => [it.transcript, it.gold]));

/**
 * Chấm giả theo version: mức LP-01 = overall − 1 (aiCalibration offset −1).
 * eval-v1 → chuẩn + 1 mức; bản khác → đúng chuẩn; câu không thuộc AI-01 → overall 3.
 */
function fakeEvaluate({ calls } = {}) {
  const gold = goldByTranscript();
  return async ({ questions, answers, prompt }) => {
    calls?.push({ version: prompt.version, n: questions.length });
    return {
      perQuestion: answers.map((a) => {
        const g = gold.get(a.transcript);
        const overall = g === undefined ? 3 : prompt.version === "eval-v1" ? g + 2 : g + 1;
        return { questionIndex: a.questionIndex, overall, scores: {}, evaluationIncomplete: false };
      }),
      promptVersion: prompt.version,
    };
  };
}

async function oldSession({ competencyId = "problem_solving", transcript, overrideOverall } = {}) {
  return InterviewSession.create({
    userId: customer._id,
    hrGender: "female",
    status: "completed",
    completedAt: new Date(),
    questions: [{ id: "q1", question: "Kể về một vấn đề bạn từng giải quyết", competencyId }],
    answers: [{
      questionIndex: 0,
      transcript,
      ...(overrideOverall !== undefined && {
        moderatorOverride: {
          scores: { clarity: overrideOverall, structure: overrideOverall, relevance: overrideOverall, credibility: overrideOverall },
          overall: overrideOverall,
        },
      }),
    }],
  });
}

async function evaluationProposal({ fewShotInputs = [] } = {}) {
  const fewShotExamples = fewShotInputs.map((t) => ({ input: `Câu hỏi: x\nCâu trả lời: "${t}"`, output: "{}" }));
  const v2 = await pv.createVersion("evaluation", { fewShotExamples });
  return AIImprovementProposal.create({
    target: "evaluation",
    kind: "few_shot",
    groupKey: "problem_solving",
    before: { promptKey: "evaluation", version: "eval-v1" },
    after: { promptKey: "evaluation", version: v2.version, fewShotExamples },
  });
}

function expectedBeforeMae() {
  // Bản trước: mức = min(4, chuẩn + 1) → lệch 1, trừ câu chuẩn 4 (bị chặn ở 4).
  const diffs = dataset.items.map((it) => Math.min(4, it.gold + 1) - it.gold);
  return Math.round((diffs.reduce((s, d) => s + d, 0) / diffs.length) * 1000) / 1000;
}

describe("aiImprovementBacktestService (AI-04)", () => {
  it("bộ AI-01 có đủ 20 câu đã có điểm chuẩn", () => {
    assert.equal(dataset.items.length, 20);
    assert.ok(dataset.items.every((it) => Number.isInteger(it.gold)));
  });

  it("đề xuất evaluation: lưu độ lệch so với điểm chuẩn của bản trước và bản sau", async () => {
    await oldSession({ transcript: "Em dùng log để tìm nguyên nhân rồi sửa.", overrideOverall: 3 });
    await oldSession({ transcript: "Câu đã thành ví dụ mẫu.", overrideOverall: 1 });
    await oldSession({ transcript: "Em hỏi anh lead rồi làm theo." });
    await oldSession({ competencyId: "communication", transcript: "Câu năng lực khác, không lấy." });
    const proposal = await evaluationProposal({ fewShotInputs: ["Câu đã thành ví dụ mẫu."] });

    const calls = [];
    const result = await bt.runBacktest(proposal._id, { evaluate: fakeEvaluate({ calls }) });

    assert.equal(result.status, "done");
    assert.equal(result.dataset, dataset.version);
    assert.equal(result.beforeVersion, "eval-v1");
    assert.equal(result.afterVersion, "eval-v2");
    assert.equal(result.gold.before.n, 20);
    assert.equal(result.gold.before.mae, expectedBeforeMae());
    assert.ok(result.gold.before.bias > 0);
    assert.equal(result.gold.after.mae, 0);
    assert.equal(result.gold.after.exact, 1);
    assert.equal(result.verdict, "better");
    assert.equal(result.maeDelta, -expectedBeforeMae());
    assert.equal(result.items.length, 20);

    // Câu cũ: cùng năng lực, bỏ câu đã làm few-shot; câu có điểm moderator đứng trước.
    assert.equal(result.old.count, 2);
    assert.equal(result.old.withReference, 1);
    assert.equal(result.oldAnswers[0].reference, 2); // overall 3 → mức 2
    assert.equal(result.oldAnswers[0].before, 2);
    assert.equal(result.old.meanAbsChange, 0);

    // 22 câu, lô 5 → 5 lượt mỗi bản.
    assert.equal(calls.filter((c) => c.version === "eval-v1").length, 5);
    assert.equal(calls.filter((c) => c.version === "eval-v2").length, 5);

    const saved = await AIImprovementProposal.findById(proposal._id).lean();
    assert.equal(saved.backtest.gold.after.mae, 0);
    assert.equal(saved.status, "proposed"); // backtest không đổi trạng thái
    assert.equal((await pv.getActivePrompt("evaluation")).version, "eval-v1"); // không bật version
  });

  it("bản sau lệch nhiều hơn: kết luận worse", async () => {
    const proposal = await evaluationProposal();
    const gold = goldByTranscript();
    const evaluate = async ({ answers, prompt }) => ({
      perQuestion: answers.map((a) => ({
        questionIndex: a.questionIndex,
        overall: prompt.version === "eval-v1" ? (gold.get(a.transcript) ?? 2) + 1 : 0.5,
      })),
    });
    const result = await bt.runBacktest(proposal._id, { evaluate });
    assert.equal(result.gold.before.mae, 0);
    assert.ok(result.gold.after.mae > 0);
    assert.equal(result.verdict, "worse");
  });

  it("LLM lỗi toàn bộ: status failed, có thông báo lỗi", async () => {
    const proposal = await evaluationProposal();
    const result = await bt.runBacktest(proposal._id, { evaluate: async () => { throw new Error("LLM down"); } });
    assert.equal(result.status, "failed");
    assert.match(result.error, /không chấm được/);
  });

  it("version bản sau không tồn tại: status failed", async () => {
    const proposal = await AIImprovementProposal.create({
      target: "evaluation", kind: "few_shot", groupKey: "_general",
      before: { promptKey: "evaluation", version: "eval-v1" },
      after: { promptKey: "evaluation", version: "eval-v42" },
    });
    const result = await bt.runBacktest(proposal._id, { evaluate: fakeEvaluate() });
    assert.equal(result.status, "failed");
    assert.match(result.error, /eval-v42/);
  });

  it("đề xuất question_gen: not_applicable, không gọi LLM", async () => {
    const proposal = await AIImprovementProposal.create({
      target: "question_gen", kind: "few_shot", groupKey: "software_engineering",
      before: { promptKey: "question_gen", version: "followup-v1" },
      after: { promptKey: "question_gen", version: "followup-v2" },
    });
    let called = false;
    const result = await bt.runBacktest(proposal._id, { evaluate: async () => { called = true; } });
    assert.equal(result.status, "not_applicable");
    assert.equal(called, false);
  });

  it("đề xuất không tồn tại: 404", async () => {
    await assert.rejects(bt.runBacktest("6560f0f0f0f0f0f0f0f0f0f0", { evaluate: fakeEvaluate() }), (e) => e.status === 404);
  });

  it("backtestPendingProposals: chỉ chạy đề xuất proposed chưa có backtest", async () => {
    const pending = await evaluationProposal();
    await AIImprovementProposal.create({
      target: "evaluation", kind: "few_shot", groupKey: "communication", status: "rejected",
      before: { promptKey: "evaluation", version: "eval-v1" }, after: { promptKey: "evaluation", version: "eval-v2" },
    });
    const first = await bt.backtestPendingProposals({ evaluate: fakeEvaluate() });
    assert.deepEqual(first.map((r) => String(r.proposalId)), [String(pending._id)]);
    const second = await bt.backtestPendingProposals({ evaluate: fakeEvaluate() });
    assert.equal(second.length, 0);
  });
});

describe("getPromptByVersion (AI-04)", () => {
  it("bản mặc định chưa có trong DB, bản trong DB, version lạ", async () => {
    assert.equal((await pv.getPromptByVersion("evaluation", "eval-v1")).source, "default");
    const v2 = await pv.createVersion("evaluation", { fewShotExamples: [{ input: "a", output: "b" }] });
    const loaded = await pv.getPromptByVersion("evaluation", v2.version);
    assert.equal(loaded.source, "db");
    assert.equal(loaded.fewShotExamples.length, 1);
    await assert.rejects(pv.getPromptByVersion("evaluation", "eval-v99"), (e) => e.status === 404);
    await assert.rejects(pv.getPromptByVersion("khong_co", "x-v1"), (e) => e.status === 400);
  });
});

describe("thống kê backtest", () => {
  it("deviationStats bỏ câu không có mốc, đếm câu không chấm được", () => {
    const s = bt.deviationStats([
      { level: 3, reference: 2 },
      { level: 2, reference: 2 },
      { level: null, reference: 1 },
      { level: 4, reference: null },
    ]);
    assert.deepEqual(s, { n: 2, unscored: 1, mae: 0.5, bias: 0.5, exact: 0.5, within1: 1 });
  });

  it("verdictOf", () => {
    assert.equal(bt.verdictOf(1, 0.5), "better");
    assert.equal(bt.verdictOf(0.5, 1), "worse");
    assert.equal(bt.verdictOf(0.5, 0.52), "same");
    assert.equal(bt.verdictOf(null, 1), null);
  });
});

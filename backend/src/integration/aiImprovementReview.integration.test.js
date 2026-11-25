/**
 * Integration AI-05: Platform Mod duyệt / từ chối / rollback đề xuất cải tiến AI.
 * "Xong khi": rollback trả về version trước; test.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  applyTestEnv,
  startMongoHarness,
  stopMongoHarness,
  mintAccessToken,
  startHttpServer,
  stopHttpServer,
} from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";

let harness;
let http;
let User;
let PromptVersion;
let AIImprovementProposal;
let pv;
let review;
let moderator;
let admin;
let seq = 0;

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ PromptVersion } = await import("../models/PromptVersion.js"));
  ({ AIImprovementProposal } = await import("../models/AIImprovementProposal.js"));
  pv = await import("../services/promptVersionService.js");
  review = await import("../services/aiImprovementReviewService.js");
  await Promise.all([PromptVersion.syncIndexes(), AIImprovementProposal.syncIndexes()]);
  const { createApp } = await import("../app.js");
  http = await startHttpServer(createApp());
});

after(async () => {
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), PromptVersion.deleteMany({}), AIImprovementProposal.deleteMany({})]);
  pv.clearPromptCache();
  seq += 1;
  moderator = await User.create({ name: "Mod", email: `ai05-mod-${seq}@test.local`, role: "moderator" });
  admin = await User.create({ name: "Admin", email: `ai05-admin-${seq}@test.local`, role: "admin" });
});

function api(user, method, path, body) {
  return fetch(`${http.baseUrl}/api/moderator/ai-improvements${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${mintAccessToken(user._id)}` },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

const example = (n) => ({ input: `Câu trả lời ${n}`, output: `{"overall":${n}}`, note: "" });

/** Đề xuất evaluation dựng trên `baseVersion` (null = bản mặc định eval-v1). */
async function proposal({ groupKey = "problem_solving", baseVersion = null, examples = [example(1)] } = {}) {
  const base = baseVersion ? await PromptVersion.findOne({ version: baseVersion }).lean() : null;
  const baseExamples = base?.fewShotExamples ?? [];
  const merged = [...baseExamples, ...examples];
  const v = await pv.createVersion("evaluation", { baseVersion, fewShotExamples: merged });
  return AIImprovementProposal.create({
    target: "evaluation",
    kind: "few_shot",
    groupKey,
    summary: `Đề xuất ${groupKey}`,
    before: { promptKey: "evaluation", version: base?.version ?? "eval-v1", fewShotExamples: baseExamples },
    after: { promptKey: "evaluation", version: v.version, fewShotExamples: merged },
    backtest: { status: "done", verdict: "better", items: [{ id: "ai01-01" }], oldAnswers: [] },
  });
}

describe("RBAC /api/moderator/ai-improvements (AI-05)", () => {
  it("admin và customer bị chặn", async () => {
    const customer = await User.create({ name: "C", email: `ai05-c-${seq}@test.local`, role: "customer" });
    assert.equal((await api(admin, "GET", "")).status, 403);
    assert.equal((await api(customer, "GET", "")).status, 403);
  });
});

describe("đọc đề xuất (AI-05)", () => {
  it("danh sách lọc theo status, bỏ điểm từng câu; chi tiết có activeVersion và nút bấm được", async () => {
    const p = await proposal();
    await AIImprovementProposal.create({
      target: "question_gen", kind: "few_shot", groupKey: "x", status: "rejected",
      before: { promptKey: "question_gen", version: "followup-v1" }, after: { promptKey: "question_gen", version: "followup-v2" },
    });
    const list = await (await api(moderator, "GET", "?status=proposed")).json();
    assert.equal(list.success, true);
    assert.equal(list.total, 1);
    assert.equal(list.proposals[0].backtest.items, undefined);
    assert.equal(list.proposals[0].backtest.verdict, "better");

    const detail = await (await api(moderator, "GET", `/${p._id}`)).json();
    assert.equal(detail.activeVersion, "eval-v1");
    assert.deepEqual(detail.actions, { approve: true, reject: true, rebase: false, rollback: false });
    assert.equal(detail.proposal.backtest.items.length, 1);

    assert.equal((await api(moderator, "GET", "/khong-phai-id")).status, 400);
    assert.equal((await api(moderator, "GET", "/6560f0f0f0f0f0f0f0f0f0f0")).status, 404);
  });
});

describe("duyệt / từ chối / rollback (AI-05)", () => {
  it("duyệt bật bản sau; rollback trả về version trước", async () => {
    const p = await proposal();

    const approved = await api(moderator, "PATCH", `/${p._id}`, { action: "approve", note: "giảm lệch" });
    assert.equal(approved.status, 200);
    const body = await approved.json();
    assert.equal(body.proposal.status, "approved");
    assert.equal(body.activeVersion, "eval-v2");
    assert.equal(String(body.proposal.review.by), String(moderator._id));
    assert.equal((await pv.getActivePrompt("evaluation")).version, "eval-v2");

    // Duyệt lại → 409.
    assert.equal((await api(moderator, "PATCH", `/${p._id}`, { action: "approve" })).status, 409);
    // Rollback thiếu lý do → 400.
    assert.equal((await api(moderator, "PATCH", `/${p._id}`, { action: "rollback" })).status, 400);

    const rolled = await api(moderator, "PATCH", `/${p._id}`, { action: "rollback", note: "tỉ lệ bị sửa tăng" });
    assert.equal(rolled.status, 200);
    const rb = await rolled.json();
    assert.equal(rb.proposal.status, "rolled_back");
    assert.equal(rb.activeVersion, "eval-v1");
    assert.match(rb.proposal.review.note, /giảm lệch · Rollback: tỉ lệ bị sửa tăng/);
    // eval-v1 chưa có trong DB → được tạo từ bản mặc định rồi bật.
    const active = await PromptVersion.findOne({ key: "evaluation", active: true }).lean();
    assert.equal(active.version, "eval-v1");
    assert.equal((await pv.getActivePrompt("evaluation")).version, "eval-v1");
  });

  it("rollback về bản trước có trong DB (không phải bản mặc định)", async () => {
    const base = await pv.createVersion("evaluation", { fewShotExamples: [example(0)] });
    await pv.activate("evaluation", base.version);
    const p = await proposal({ baseVersion: base.version });
    await review.reviewProposal(p._id, { action: "approve" }, moderator._id);
    assert.equal((await pv.getActivePrompt("evaluation")).version, p.after.version);
    await review.reviewProposal(p._id, { action: "rollback", note: "quay lại" }, moderator._id);
    assert.equal((await pv.getActivePrompt("evaluation")).version, base.version);
  });

  it("từ chối: không bật version, bắt buộc lý do", async () => {
    const p = await proposal();
    assert.equal((await api(moderator, "PATCH", `/${p._id}`, { action: "reject" })).status, 400);
    const res = await api(moderator, "PATCH", `/${p._id}`, { action: "reject", note: "ví dụ chưa tiêu biểu" });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).proposal.status, "rejected");
    assert.equal(await PromptVersion.countDocuments({ active: true }), 0);
    assert.equal((await api(moderator, "PATCH", `/${p._id}`, { action: "rollback", note: "abc" })).status, 409);
  });

  it("hai đề xuất cùng dựng trên eval-v1: duyệt cái đầu thì cái sau phải rebase rồi mới duyệt được", async () => {
    const a = await proposal({ groupKey: "problem_solving", examples: [example(1)] });
    const b = await proposal({ groupKey: "communication", examples: [example(2)] });
    await review.reviewProposal(a._id, { action: "approve" }, moderator._id);

    const blocked = await api(moderator, "PATCH", `/${b._id}`, { action: "approve" });
    assert.equal(blocked.status, 409);
    assert.match((await blocked.json()).error, /rebase/);
    const detail = await review.getProposal(String(b._id));
    assert.deepEqual(detail.actions, { approve: false, reject: true, rebase: true, rollback: false });

    const rebased = await (await api(moderator, "PATCH", `/${b._id}`, { action: "rebase" })).json();
    assert.equal(rebased.proposal.before.version, a.after.version);
    assert.equal(rebased.proposal.backtest, null);
    // Bản mới giữ ví dụ của đề xuất a và thêm ví dụ của b.
    assert.deepEqual(rebased.proposal.after.fewShotExamples.map((e) => e.input), ["Câu trả lời 1", "Câu trả lời 2"]);
    const newVersion = rebased.proposal.after.version;
    assert.notEqual(newVersion, b.after.version);

    await review.reviewProposal(b._id, { action: "approve" }, moderator._id);
    assert.equal((await pv.getActivePrompt("evaluation")).version, newVersion);

    // Rollback a sau khi b đã bật → 409 (sẽ gỡ nhầm b).
    await assert.rejects(review.reviewProposal(a._id, { action: "rollback", note: "x x x" }, moderator._id), (e) => e.status === 409);
  });

  it("rebase khi đã dựng trên bản đang chạy → 409", async () => {
    const p = await proposal();
    assert.equal((await api(moderator, "PATCH", `/${p._id}`, { action: "rebase" })).status, 409);
  });

  it("action lạ → 400", async () => {
    const p = await proposal();
    assert.equal((await api(moderator, "PATCH", `/${p._id}`, { action: "delete" })).status, 400);
  });
});

describe("backtest lại (AI-05)", () => {
  it("chạy nền, không cho chạy chồng; xong thì có kết quả mới", async () => {
    const p = await proposal();
    let release;
    const gate = new Promise((r) => { release = r; });
    const run = async (id) => {
      await gate;
      await AIImprovementProposal.updateOne({ _id: id }, { $set: { backtest: { status: "done", verdict: "same" } } });
    };
    const started = await review.startBacktest(String(p._id), { run });
    assert.equal(started.backtest.status, "running");
    await assert.rejects(review.startBacktest(String(p._id), { run }), (e) => e.status === 409);
    release();
    await started.done;
    const saved = await AIImprovementProposal.findById(p._id).lean();
    assert.equal(saved.backtest.verdict, "same");
  });

  it("đề xuất đã duyệt → 409", async () => {
    const p = await proposal();
    await review.reviewProposal(p._id, { action: "approve" }, moderator._id);
    await assert.rejects(review.startBacktest(String(p._id), { run: async () => {} }), (e) => e.status === 409);
  });
});

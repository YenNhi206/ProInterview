/**
 * JB-06 (quyết định JB-06 ngày 23/11/2026): chèn câu doanh nghiệp vào phỏng vấn AI chung.
 * - `POST /api/interviews/sessions` nhận `jobPostId` tùy chọn; có thì ≤ 2 câu của job đó, không có thì ≤ 2 câu
 *   của **một** doanh nghiệp ngẫu nhiên cùng `roleCategory`; câu doanh nghiệp đi sau 3 câu baseline.
 * - Không có câu hợp lệ → buổi như cũ. Câu chưa qua Platform Mod / không trong rubric thì không dùng.
 * - Sửa (1) `alreadyGenerated` theo câu follow-up thực tế; (2) `questionsAllowed` 5 (free) / 7 (Pro).
 * LLM stub qua globalThis.fetch như questionBankHarvest.integration.test.js.
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
process.env.LLM_API_KEY = "test-key";
process.env.LLM_BASE_URL = "http://llm.stub.local/v1";
process.env.LLM_MODEL = "stub-model";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.LLM_PROVIDER;

let harness;
let http;
let User;
let Company;
let JobPost;
let QuestionBank;
let CompanyRubric;
let InterviewSession;
let hashQuestionText;
let BASELINE_QUESTIONS;
let selectCompanyQuestionsForSession;

const realFetch = globalThis.fetch;
let llmQueue = [];
let llmCalls = 0;
let seq = 0;

before(async () => {
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith("http://llm.stub.local")) {
      llmCalls += 1;
      const questions = llmQueue.shift() ?? [];
      const content = JSON.stringify({ questions, inferred_role: "Frontend", inferred_seniority: "junior" });
      return new Response(
        JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 10 } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return realFetch(url, init);
  };
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ Company } = await import("../models/Company.js"));
  ({ JobPost } = await import("../models/JobPost.js"));
  ({ QuestionBank, hashQuestionText } = await import("../models/QuestionBank.js"));
  ({ CompanyRubric } = await import("../models/CompanyRubric.js"));
  ({ InterviewSession } = await import("../models/InterviewSession.js"));
  ({ BASELINE_QUESTIONS } = await import("../config/baselineQuestions.js"));
  ({ selectCompanyQuestionsForSession } = await import("../services/companyInterviewQuestionService.js"));
  await QuestionBank.init();
  const { createApp } = await import("../app.js");
  http = await startHttpServer(createApp());
});

after(async () => {
  globalThis.fetch = realFetch;
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

beforeEach(async () => {
  llmQueue = [];
  llmCalls = 0;
  await Promise.all([JobPost.deleteMany({}), QuestionBank.deleteMany({}), CompanyRubric.deleteMany({}), InterviewSession.deleteMany({})]);
});

async function makeUser({ pro = false } = {}) {
  seq += 1;
  const expires = new Date();
  expires.setMonth(expires.getMonth() + 1);
  return User.create({
    name: pro ? "Ứng viên Pro" : "Ứng viên free",
    email: `jb06-${seq}-${Date.now()}@test.local`,
    role: "customer",
    plan: pro ? "elite_pro" : "free",
    ...(pro && { planExpiresAt: expires }),
    quota: { cvAnalysisLimit: 3, interviewLimit: 5, interviewQuestionsAllowed: 3 },
  });
}

async function makeCompany(name) {
  seq += 1;
  return Company.create({ name, slug: `jb06-co-${seq}-${Date.now()}`, status: "active" });
}

function question(text, company, { status = "approved", jobPostId = null } = {}) {
  return QuestionBank.create({
    text,
    originalText: text,
    textHash: hashQuestionText(text),
    orgId: company._id,
    jobPostId,
    source: "org_template",
    roleCategory: "frontend",
    competencyId: "teamwork",
    status,
  });
}

/** Job đang mở của công ty, rubric đã duyệt áp dụng các câu cho trước. */
async function jobWithQuestions(company, questionTexts, { roleCategory = "frontend", status = "approved" } = {}) {
  seq += 1;
  const job = await JobPost.create({ companyId: company._id, title: `Job ${seq}`, roleCategory, level: "junior", status: "published", publishedAt: new Date() });
  const qs = [];
  for (const t of questionTexts) qs.push(await question(t, company, { status, jobPostId: job._id }));
  const rubric = await CompanyRubric.create({
    companyId: company._id,
    title: `Rubric ${seq}`,
    roleCategory,
    status: "approved",
    version: seq,
    criteria: [{ name: "Làm việc nhóm", weight: 100, shrmKey: "teamwork", questionIds: qs.map((q) => q._id) }],
  });
  await JobPost.updateOne({ _id: job._id }, { rubricId: rubric._id });
  return { job: await JobPost.findById(job._id).lean(), questions: qs, rubric };
}

async function createSession(user, extra = {}) {
  const res = await fetch(`${http.baseUrl}/api/interviews/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${mintAccessToken(user._id)}` },
    body: JSON.stringify({ hrGender: "female", questions: BASELINE_QUESTIONS, ...extra }),
  });
  return { status: res.status, body: await res.json() };
}

describe("JB-06 — chèn câu doanh nghiệp khi tạo buổi", () => {
  it("có jobPostId: tối đa 2 câu của job đó, đi sau 3 câu baseline, lưu companyQuestions; free được 5 câu", async () => {
    const co = await makeCompany("Công ty A");
    const { job, rubric } = await jobWithQuestions(co, ["Câu A1?", "Câu A2?", "Câu A3?"]);
    const user = await makeUser();

    const res = await createSession(user, { jobPostId: String(job._id) });
    assert.equal(res.status, 201);
    const s = res.body.session;
    assert.equal(s.questions.length, 5);
    assert.deepEqual(s.questions.slice(0, 3).map((q) => q.source), ["baseline", "baseline", "baseline"]);
    assert.deepEqual(s.questions.slice(3).map((q) => q.source), ["company", "company"]);
    assert.ok(s.questions.slice(3).every((q) => ["Câu A1?", "Câu A2?", "Câu A3?"].includes(q.question)));
    assert.equal(s.companyQuestions.length, 2);
    assert.ok(s.companyQuestions.every((c) => String(c.jobPostId) === String(job._id) && String(c.rubricId) === String(rubric._id) && String(c.companyId) === String(co._id)));
    assert.equal(s.questionsAllowed, 5);

    const saved = await User.findById(user._id).lean();
    assert.equal(saved.quota.interviewUsed, 1, "trừ 1 lượt như buổi thường");
  });

  it("Pro có câu doanh nghiệp: questionsAllowed = 7", async () => {
    const co = await makeCompany("Công ty Pro");
    const { job } = await jobWithQuestions(co, ["Câu P1?"]);
    const res = await createSession(await makeUser({ pro: true }), { jobPostId: String(job._id) });
    assert.equal(res.body.session.questions.length, 4, "job chỉ có 1 câu hợp lệ");
    assert.equal(res.body.session.questionsAllowed, 7);
  });

  it("không có jobPostId: chọn một doanh nghiệp cùng vị trí, 2 câu cùng doanh nghiệp", async () => {
    const coA = await makeCompany("Công ty A");
    const coB = await makeCompany("Công ty B");
    await jobWithQuestions(coA, ["Câu của A 1?", "Câu của A 2?"]);
    await jobWithQuestions(coB, ["Câu của B 1?", "Câu của B 2?"]);
    await jobWithQuestions(await makeCompany("Công ty backend"), ["Câu backend?"], { roleCategory: "backend" });

    for (let i = 0; i < 4; i += 1) {
      const res = await createSession(await makeUser(), { position: "Frontend Developer" });
      const cq = res.body.session.companyQuestions;
      assert.equal(cq.length, 2);
      assert.equal(new Set(cq.map((c) => String(c.companyId))).size, 1, "cùng một doanh nghiệp");
      assert.ok(!res.body.session.questions.some((q) => q.question === "Câu backend?"), "không lấy vị trí khác");
    }
  });

  it("không có câu hợp lệ thì buổi chạy như cũ (3 câu, questionsAllowed theo quota)", async () => {
    const co = await makeCompany("Công ty chờ duyệt");
    const { job } = await jobWithQuestions(co, ["Câu chưa qua Platform Mod?"], { status: "pending_platform_review" });
    const res = await createSession(await makeUser(), { jobPostId: String(job._id), position: "Frontend Developer" });
    assert.equal(res.status, 201);
    assert.equal(res.body.session.questions.length, 3);
    assert.deepEqual(res.body.session.companyQuestions, []);
    assert.equal(res.body.session.questionsAllowed, 3);

    const plain = await createSession(await makeUser());
    assert.equal(plain.body.session.questions.length, 3);
  });

  it("job đóng hoặc câu bị từ chối không được dùng; jobPostId sai định dạng → 400, không trừ lượt", async () => {
    const co = await makeCompany("Công ty đóng job");
    const { job } = await jobWithQuestions(co, ["Câu job đóng?"]);
    await JobPost.updateOne({ _id: job._id }, { status: "closed" });
    const closed = await createSession(await makeUser(), { jobPostId: String(job._id) });
    assert.equal(closed.body.session.questions.length, 3);

    const { job: job2, questions } = await jobWithQuestions(co, ["Câu bị từ chối?"]);
    await QuestionBank.updateOne({ _id: questions[0]._id }, { status: "rejected" });
    const rejected = await createSession(await makeUser(), { jobPostId: String(job2._id) });
    assert.equal(rejected.body.session.questions.length, 3);

    const user = await makeUser();
    assert.equal((await createSession(user, { jobPostId: "abc" })).status, 400);
    assert.equal((await User.findById(user._id).lean()).quota?.interviewUsed ?? 0, 0);
  });

  it("selectCompanyQuestionsForSession: rng cố định chọn đúng doanh nghiệp, không trùng câu giữa các job", async () => {
    const co = await makeCompany("Công ty nhiều job");
    const shared = await question("Câu dùng chung?", co);
    for (let i = 0; i < 2; i += 1) {
      seq += 1;
      const job = await JobPost.create({ companyId: co._id, title: `Job chung ${i}`, roleCategory: "frontend", level: "junior", status: "published" });
      const r = await CompanyRubric.create({ companyId: co._id, title: `R chung ${seq}`, roleCategory: "frontend", status: "approved", version: seq, criteria: [{ name: "X", weight: 100, shrmKey: "teamwork", questionIds: [shared._id] }] });
      await JobPost.updateOne({ _id: job._id }, { rubricId: r._id });
    }
    const picked = await selectCompanyQuestionsForSession({ roleCategoryKeys: ["frontend"], rng: () => 0 });
    assert.equal(picked.length, 1, "câu dùng chung ở 2 job chỉ tính 1 lần");
    assert.equal(picked[0].question.text, "Câu dùng chung?");
  });
});

describe("JB-06 — câu follow-up ở buổi có câu doanh nghiệp (Pro)", () => {
  const llmQ = (text) => ({ id: "q1", question: text, competency_id: "problem_solving", layer: "behavior", seniority: "junior" });

  function generateFollowUp(user, sessionId) {
    return fetch(`${http.baseUrl}/api/interviews/sessions/${sessionId}/generate-followup-questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${mintAccessToken(user._id)}` },
      body: JSON.stringify({ cvText: "Frontend React", baselineAnswers: [] }),
    });
  }

  it("buổi đã có 5 câu (3 baseline + 2 doanh nghiệp) vẫn sinh follow-up; chỉ trả câu follow-up; gọi lại không gọi LLM", async () => {
    const co = await makeCompany("Công ty follow-up");
    const { job } = await jobWithQuestions(co, ["Câu F1?", "Câu F2?"]);
    const user = await makeUser({ pro: true });
    const created = await createSession(user, { jobPostId: String(job._id) });
    const sessionId = created.body.session._id;

    llmQueue.push([llmQ("Kể về lần bạn tối ưu render React khi danh sách rất dài"), llmQ("Bạn xử lý xung đột merge lớn trong nhóm như thế nào")]);
    const res = await generateFollowUp(user, sessionId);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(!body.alreadyGenerated);
    assert.equal(body.questions.length, 2);
    assert.ok(body.questions.every((q) => q.source === "llm_followup"), "không trả lại câu doanh nghiệp");

    const saved = await InterviewSession.findById(sessionId).lean();
    assert.deepEqual(saved.questions.map((q) => q.source), ["baseline", "baseline", "baseline", "company", "company", "llm_followup", "llm_followup"]);

    const callsBefore = llmCalls;
    const again = await (await generateFollowUp(user, sessionId)).json();
    assert.equal(again.alreadyGenerated, true);
    assert.equal(again.questions.length, 2);
    assert.equal(llmCalls, callsBefore, "không gọi LLM lần 2");
  });

  it("session cũ (không có source, đủ 5 câu) vẫn coi là đã sinh follow-up", async () => {
    const user = await makeUser({ pro: true });
    const legacy = await InterviewSession.create({
      userId: user._id,
      hrGender: "female",
      status: "in_progress",
      questions: [1, 2, 3, 4, 5].map((n) => ({ id: `q${n}`, question: `Câu cũ số ${n}?` })),
    });
    const body = await (await generateFollowUp(user, legacy._id)).json();
    assert.equal(body.alreadyGenerated, true);
    assert.deepEqual(body.questions.map((q) => q.question), ["Câu cũ số 4?", "Câu cũ số 5?"]);
    assert.equal(llmCalls, 0);
  });
});

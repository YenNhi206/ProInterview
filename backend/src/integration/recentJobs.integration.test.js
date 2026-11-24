/**
 * JB-20: job ứng viên xem gần đây (`GET /api/jobs/:id` ghi lượt xem, `GET /api/jobs/recent`), và điều kiện
 * "câu doanh nghiệp hợp lệ" dùng chung với JB-06 (`eligibleCompanyQuestionsByJob`).
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

let harness;
let http;
let User;
let Company;
let JobPost;
let QuestionBank;
let CompanyRubric;
let CandidateProfile;
let hashQuestionText;
let eligibleCompanyQuestionsByJob;

let companyA;
let suspendedCo;
let candidate;
let mentor;
let seq = 0;

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ Company } = await import("../models/Company.js"));
  ({ JobPost } = await import("../models/JobPost.js"));
  ({ QuestionBank, hashQuestionText } = await import("../models/QuestionBank.js"));
  ({ CompanyRubric } = await import("../models/CompanyRubric.js"));
  ({ CandidateProfile } = await import("../models/CandidateProfile.js"));
  ({ eligibleCompanyQuestionsByJob } = await import("../services/companyInterviewQuestionService.js"));
  await QuestionBank.init();
  const { createApp } = await import("../app.js");
  http = await startHttpServer(createApp());

  const stamp = Date.now();
  companyA = await Company.create({ name: "Công ty A", slug: `recent-a-${stamp}`, status: "active" });
  suspendedCo = await Company.create({ name: "Công ty khóa", slug: `recent-s-${stamp}`, status: "suspended" });
  candidate = await User.create({ name: "Ứng viên", email: `recent-cand-${stamp}@test.local`, role: "customer" });
  mentor = await User.create({ name: "Mentor", email: `recent-mentor-${stamp}@test.local`, role: "mentor" });
});

after(async () => {
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

beforeEach(async () => {
  await Promise.all([JobPost.deleteMany({}), QuestionBank.deleteMany({}), CompanyRubric.deleteMany({}), CandidateProfile.deleteMany({})]);
});

function question(text, { orgId = companyA._id, status = "approved", jobPostId = null } = {}) {
  return QuestionBank.create({
    text,
    originalText: text,
    textHash: hashQuestionText(text),
    orgId,
    jobPostId,
    source: "org_template",
    roleCategory: "frontend",
    competencyId: "teamwork",
    status,
  });
}

function rubric(questionIds, { companyId = companyA._id, status = "approved" } = {}) {
  seq += 1;
  return CompanyRubric.create({
    companyId,
    title: `Rubric ${seq}`,
    roleCategory: "frontend",
    status,
    version: seq,
    criteria: [{ name: "Làm việc nhóm", weight: 100, shrmKey: "teamwork", questionIds }],
  });
}

/** Job đang mở; `withQuestions` thì gắn rubric đã duyệt có 1 câu hợp lệ. */
async function job(title, { companyId = companyA._id, status = "published", closesAt = null, withQuestions = true } = {}) {
  const j = await JobPost.create({ companyId, title, roleCategory: "frontend", level: "junior", status, closesAt, publishedAt: new Date() });
  if (withQuestions) {
    const q = await question(`Câu cho ${title}?`, { orgId: companyId, jobPostId: j._id });
    const r = await rubric([q._id], { companyId });
    await JobPost.updateOne({ _id: j._id }, { rubricId: r._id });
  }
  return JobPost.findById(j._id).lean();
}

async function call(path, user) {
  const headers = { Accept: "application/json" };
  if (user) headers.Authorization = `Bearer ${mintAccessToken(user._id)}`;
  const res = await fetch(`${http.baseUrl}/api${path}`, { headers });
  return { status: res.status, body: await res.json() };
}

const viewedIds = async () =>
  ((await CandidateProfile.findOne({ userId: candidate._id }).lean())?.recentJobViews ?? []).map((v) => String(v.jobPostId));

describe("JB-20 — ghi job xem gần đây", () => {
  it("xem job thứ 6 thì job cũ nhất bị bỏ; mới nhất đứng đầu; xem lại thì đưa lên đầu", async () => {
    const jobs = [];
    for (let i = 1; i <= 6; i += 1) jobs.push(await job(`Job ${i}`));
    for (const j of jobs) assert.equal((await call(`/jobs/${j._id}`, candidate)).status, 200);

    const expected = jobs.slice(1).reverse().map((j) => String(j._id));
    assert.deepEqual(await viewedIds(), expected, "giữ 5 job, job 1 bị bỏ");

    await call(`/jobs/${jobs[2]._id}`, candidate);
    const ids = await viewedIds();
    assert.equal(ids[0], String(jobs[2]._id));
    assert.equal(ids.length, 5);
    assert.equal(new Set(ids).size, 5, "không trùng job");
  });

  it("khách vãng lai và mentor xem job không ghi; job không tồn tại không ghi", async () => {
    const j = await job("Job công khai");
    assert.equal((await call(`/jobs/${j._id}`)).status, 200);
    assert.equal((await call(`/jobs/${j._id}`, mentor)).status, 200);
    assert.equal((await call("/jobs/507f1f77bcf86cd799439011", candidate)).status, 404);
    assert.equal(await CandidateProfile.countDocuments({}), 0);
  });
});

describe("JB-20 — GET /api/jobs/recent", () => {
  it("chỉ trả job đang mở có câu doanh nghiệp hợp lệ, mới xem trước, kèm viewedAt và số câu", async () => {
    const ok1 = await job("Job hợp lệ 1");
    const noQuestions = await job("Job không có câu", { withQuestions: false });
    const ok2 = await job("Job hợp lệ 2");
    for (const j of [ok1, noQuestions, ok2]) await call(`/jobs/${j._id}`, candidate);

    // Job đóng sau khi xem, công ty bị khóa: không trả
    await JobPost.updateOne({ _id: ok1._id }, { status: "closed" });
    const res = await call("/jobs/recent", candidate);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.jobs.map((j) => j.title), ["Job hợp lệ 2"]);
    assert.ok(res.body.jobs[0].viewedAt);
    assert.equal(res.body.jobs[0].companyQuestionCount, 1);
    assert.equal(res.body.jobs[0].company.name, "Công ty A");
  });

  it("job quá hạn hoặc công ty bị khóa không được trả", async () => {
    const expired = await job("Job quá hạn");
    const locked = await job("Job công ty khóa", { companyId: suspendedCo._id });
    // Ghi thẳng vì GET /jobs/:id của job công ty khóa trả 404
    await CandidateProfile.create({
      userId: candidate._id,
      recentJobViews: [{ jobPostId: locked._id }, { jobPostId: expired._id }],
    });
    await JobPost.updateOne({ _id: expired._id }, { closesAt: new Date(Date.now() - 1000) });
    assert.deepEqual((await call("/jobs/recent", candidate)).body.jobs, []);
  });

  it("chưa xem job nào → mảng rỗng; chưa đăng nhập 401; mentor 403", async () => {
    assert.deepEqual((await call("/jobs/recent", candidate)).body.jobs, []);
    assert.equal((await call("/jobs/recent")).status, 401);
    assert.equal((await call("/jobs/recent", mentor)).status, 403);
  });
});

describe("Câu doanh nghiệp hợp lệ (dùng chung JB-06)", () => {
  it("chỉ câu approved, trong câu áp dụng của rubric approved cùng công ty, thuộc job đó hoặc dùng chung", async () => {
    const j = await JobPost.create({ companyId: companyA._id, title: "Job kiểm", roleCategory: "frontend", level: "junior", status: "published" });
    const other = await JobPost.create({ companyId: companyA._id, title: "Job khác", roleCategory: "frontend", level: "junior", status: "published" });

    const good = await question("Câu của job?", { jobPostId: j._id });
    const shared = await question("Câu dùng chung?");
    const pending = await question("Câu chờ Platform Mod?", { status: "pending_platform_review", jobPostId: j._id });
    const otherJob = await question("Câu của job khác?", { jobPostId: other._id });
    const notApplied = await question("Câu không nằm trong rubric?", { jobPostId: j._id });

    const r = await rubric([good._id, shared._id, pending._id, otherJob._id]);
    await JobPost.updateOne({ _id: j._id }, { rubricId: r._id });
    const fresh = await JobPost.findById(j._id).lean();

    const map = await eligibleCompanyQuestionsByJob([fresh]);
    assert.deepEqual(map.get(String(j._id)).map((q) => q.text).sort(), ["Câu của job?", "Câu dùng chung?"].sort());
    assert.ok(!map.get(String(j._id)).some((q) => String(q._id) === String(notApplied._id)));
  });

  it("rubric chưa duyệt, rubric công ty khác, job không có rubric → không có câu", async () => {
    const q = await question("Câu hợp lệ?");
    const draftRubric = await rubric([q._id], { status: "pending_review" });
    const otherCompany = await Company.create({ name: "Công ty C", slug: `recent-c-${Date.now()}`, status: "active" });
    const foreignRubric = await rubric([q._id], { companyId: otherCompany._id });

    const jobs = await Promise.all([
      JobPost.create({ companyId: companyA._id, title: "J1", roleCategory: "frontend", level: "junior", status: "published", rubricId: draftRubric._id }),
      JobPost.create({ companyId: companyA._id, title: "J2", roleCategory: "frontend", level: "junior", status: "published", rubricId: foreignRubric._id }),
      JobPost.create({ companyId: companyA._id, title: "J3", roleCategory: "frontend", level: "junior", status: "published" }),
    ]);
    const map = await eligibleCompanyQuestionsByJob(jobs.map((x) => x.toObject()));
    assert.equal(map.size, 0);
  });
});

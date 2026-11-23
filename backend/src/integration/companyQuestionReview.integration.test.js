/**
 * CO-16: Platform Moderator duyệt tầng hai câu doanh nghiệp (quyết định CO-16 ngày 23/11/2026).
 * - pending_platform_review → approved | rejected, chỉ ở `/api/moderator/company-questions`;
 * - trang ngân hàng câu chung (`/api/moderator/questions`) không lẫn và không duyệt được câu doanh nghiệp;
 * - video avatar (CO-06) chỉ render cho câu Platform Mod đã duyệt.
 */
import { describe, it, before, after, beforeEach, afterEach } from "node:test";
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
let hashQuestionText;
let videoSvc;

let companyA;
let companyB;
let modA;
let platformMod;
let candidate;
let jobA;
let pregenCalls;

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ Company } = await import("../models/Company.js"));
  ({ JobPost } = await import("../models/JobPost.js"));
  ({ QuestionBank, hashQuestionText } = await import("../models/QuestionBank.js"));
  videoSvc = await import("../services/companyQuestionVideoService.js");
  await QuestionBank.init();
  const { createApp } = await import("../app.js");
  http = await startHttpServer(createApp());

  const stamp = Date.now();
  companyA = await Company.create({ name: "Công ty A", slug: `review-a-${stamp}`, status: "active" });
  companyB = await Company.create({ name: "Công ty B", slug: `review-b-${stamp}`, status: "active" });
  modA = await User.create({ name: "HR A", email: `review-hr-a-${stamp}@test.local`, role: "company_moderator", companyId: companyA._id });
  platformMod = await User.create({ name: "Platform Mod", email: `review-pmod-${stamp}@test.local`, role: "moderator" });
  candidate = await User.create({ name: "Ứng viên", email: `review-cand-${stamp}@test.local`, role: "customer" });
  jobA = await JobPost.create({ companyId: companyA._id, title: "Frontend Developer", roleCategory: "frontend", level: "junior" });
});

after(async () => {
  videoSvc?.__setCompanyVideoPregenForTest(null);
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

beforeEach(async () => {
  await QuestionBank.deleteMany({});
  pregenCalls = [];
  videoSvc.__setCompanyVideoPregenForTest(async (questions, opts) => {
    pregenCalls.push({ questions: [...questions], gender: opts.gender });
    return { videoUrls: questions.map(() => "https://cdn.test/v.mp4"), errors: [], cacheHits: 0, durationMs: 1 };
  });
});

afterEach(() => {
  videoSvc.__setCompanyVideoPregenForTest(null);
});

async function call(user, method, path, body) {
  const res = await fetch(`${http.baseUrl}/api${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${mintAccessToken(user._id)}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

const mod = (method, path, body) => call(platformMod, method, `/moderator${path}`, body);

function seedQuestion(text, { orgId = companyA._id, status = "pending_platform_review", jobPostId = null } = {}) {
  return QuestionBank.create({
    text,
    originalText: text,
    textHash: hashQuestionText(text),
    orgId,
    jobPostId,
    source: orgId ? "org_template" : "moderator",
    roleCategory: "frontend",
    competencyId: "teamwork",
    status,
  });
}

const warmedTexts = () => pregenCalls.filter((c) => c.gender === "male").flatMap((c) => c.questions);

describe("CO-16 — danh sách câu doanh nghiệp chờ Platform Mod", () => {
  it("mặc định trả câu chờ duyệt kèm công ty, job, số đếm theo tab; không có câu pool chung", async () => {
    await seedQuestion("Câu A chờ duyệt?", { jobPostId: jobA._id });
    await seedQuestion("Câu B chờ duyệt?", { orgId: companyB._id });
    await seedQuestion("Câu A đã duyệt?", { status: "approved" });
    await seedQuestion("Câu A nháp?", { status: "draft" });
    await seedQuestion("Câu pool chung chờ duyệt?", { orgId: null, status: "pending_review" });

    const res = await mod("GET", "/company-questions");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.questions.map((q) => q.text).sort(), ["Câu A chờ duyệt?", "Câu B chờ duyệt?"]);
    assert.deepEqual(res.body.counts, { pending_platform_review: 2, approved: 1, rejected: 0 });

    const withJob = res.body.questions.find((q) => q.text === "Câu A chờ duyệt?");
    assert.equal(withJob.company.name, "Công ty A");
    assert.equal(withJob.jobPost.title, "Frontend Developer");
  });

  it("lọc theo công ty, job, từ khóa, tab; tham số sai → 400", async () => {
    await seedQuestion("Câu A về React?", { jobPostId: jobA._id });
    await seedQuestion("Câu B về React?", { orgId: companyB._id });
    await seedQuestion("Câu A đã duyệt?", { status: "approved" });

    const byCompany = await mod("GET", `/company-questions?companyId=${companyB._id}`);
    assert.deepEqual(byCompany.body.questions.map((q) => q.text), ["Câu B về React?"]);
    assert.equal(byCompany.body.counts.pending_platform_review, 1);

    const byJob = await mod("GET", `/company-questions?jobPostId=${jobA._id}`);
    assert.deepEqual(byJob.body.questions.map((q) => q.text), ["Câu A về React?"]);

    const byText = await mod("GET", "/company-questions?q=a%20v%E1%BB%81");
    assert.deepEqual(byText.body.questions.map((q) => q.text), ["Câu A về React?"]);

    const approved = await mod("GET", "/company-questions?status=approved");
    assert.deepEqual(approved.body.questions.map((q) => q.text), ["Câu A đã duyệt?"]);

    assert.equal((await mod("GET", "/company-questions?status=draft")).status, 400);
    assert.equal((await mod("GET", "/company-questions?companyId=abc")).status, 400);
  });

  it("chỉ Platform Moderator vào được; Company Mod và ứng viên → 403", async () => {
    assert.equal((await call(modA, "GET", "/moderator/company-questions")).status, 403);
    assert.equal((await call(candidate, "GET", "/moderator/company-questions")).status, 403);
  });
});

describe("CO-16 — Platform Mod duyệt / từ chối", () => {
  it("duyệt → approved, ghi history + review, render video cả 2 giới tính", async () => {
    const q = await seedQuestion("Câu sẽ được duyệt?");
    const res = await mod("POST", `/company-questions/${q._id}/approve`, { note: "Rõ ràng" });
    assert.equal(res.status, 200);
    assert.equal(res.body.question.status, "approved");
    assert.equal(res.body.question.history.at(-1).action, "approve");
    assert.equal(String(res.body.question.review.by), String(platformMod._id));
    assert.equal(res.body.question.moderation.lastAction, "approve");

    await videoSvc.whenCompanyVideoWarmIdle();
    assert.deepEqual(warmedTexts(), ["Câu sẽ được duyệt?"]);
    assert.equal(pregenCalls.length, 2);
  });

  it("từ chối bắt buộc lý do; lý do lưu ở moderation.reason cho công ty xem; không render video", async () => {
    const q = await seedQuestion("Câu sẽ bị từ chối?");
    assert.equal((await mod("POST", `/company-questions/${q._id}/reject`, {})).status, 400);

    const res = await mod("POST", `/company-questions/${q._id}/reject`, { reason: "Câu hỏi phân biệt tuổi tác" });
    assert.equal(res.status, 200);
    assert.equal(res.body.question.status, "rejected");
    assert.equal(res.body.question.moderation.reason, "Câu hỏi phân biệt tuổi tác");

    const companyView = await call(modA, "GET", "/company/questions?status=rejected");
    assert.equal(companyView.body.questions[0].moderation.reason, "Câu hỏi phân biệt tuổi tác");

    await videoSvc.whenCompanyVideoWarmIdle();
    assert.equal(pregenCalls.length, 0);
  });

  it("câu không ở pending_platform_review → 409; câu pool chung hoặc không tồn tại → 404; id sai → 400", async () => {
    const draft = await seedQuestion("Câu còn nháp?", { status: "draft" });
    const approved = await seedQuestion("Câu đã duyệt rồi?", { status: "approved" });
    const shared = await seedQuestion("Câu pool chung?", { orgId: null, status: "pending_review" });

    assert.equal((await mod("POST", `/company-questions/${draft._id}/approve`, {})).status, 409);
    assert.equal((await mod("POST", `/company-questions/${approved._id}/reject`, { reason: "x" })).status, 409);
    assert.equal((await mod("POST", `/company-questions/${shared._id}/approve`, {})).status, 404);
    assert.equal((await mod("POST", "/company-questions/507f1f77bcf86cd799439011/approve", {})).status, 404);
    assert.equal((await mod("POST", "/company-questions/abc/approve", {})).status, 400);
    assert.equal((await QuestionBank.findById(draft._id).lean()).status, "draft");
  });

  it("duyệt hàng loạt chỉ đổi câu đang chờ (nhiều công ty), render video đúng các câu đó", async () => {
    const a = await seedQuestion("Lô câu A?");
    const b = await seedQuestion("Lô câu B?", { orgId: companyB._id });
    const draft = await seedQuestion("Lô câu nháp?", { status: "draft" });
    const shared = await seedQuestion("Lô câu pool chung?", { orgId: null, status: "pending_review" });

    const res = await mod("POST", "/company-questions/bulk", { action: "approve", ids: [a._id, b._id, draft._id, shared._id] });
    assert.equal(res.status, 200);
    assert.equal(res.body.updated, 2);
    assert.equal(res.body.skipped, 2);

    const byText = Object.fromEntries((await QuestionBank.find({}).lean()).map((q) => [q.text, q.status]));
    assert.equal(byText["Lô câu A?"], "approved");
    assert.equal(byText["Lô câu B?"], "approved");
    assert.equal(byText["Lô câu nháp?"], "draft");
    assert.equal(byText["Lô câu pool chung?"], "pending_review");

    await videoSvc.whenCompanyVideoWarmIdle();
    assert.deepEqual(warmedTexts().sort(), ["Lô câu A?", "Lô câu B?"]);
  });

  it("từ chối hàng loạt cần lý do; thao tác / id sai → 400", async () => {
    const a = await seedQuestion("Lô từ chối A?");
    assert.equal((await mod("POST", "/company-questions/bulk", { action: "reject", ids: [a._id] })).status, 400);
    assert.equal((await mod("POST", "/company-questions/bulk", { action: "delete", ids: [a._id] })).status, 400);
    assert.equal((await mod("POST", "/company-questions/bulk", { action: "approve", ids: ["abc"] })).status, 400);
    assert.equal((await mod("POST", "/company-questions/bulk", { action: "approve", ids: [] })).status, 400);

    const res = await mod("POST", "/company-questions/bulk", { action: "reject", ids: [a._id], reason: "Trùng ý" });
    assert.equal(res.status, 200);
    assert.equal(res.body.updated, 1);
    assert.equal((await QuestionBank.findById(a._id).lean()).moderation.reason, "Trùng ý");
  });
});

describe("CO-16 — tách khỏi ngân hàng câu chung", () => {
  it("GET /moderator/questions không lẫn câu doanh nghiệp", async () => {
    await seedQuestion("Câu doanh nghiệp chờ?");
    await seedQuestion("Câu doanh nghiệp đã duyệt?", { status: "approved" });
    await seedQuestion("Câu pool chung?", { orgId: null, status: "approved" });
    const res = await mod("GET", "/questions?limit=50");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.questions.map((q) => q.text), ["Câu pool chung?"]);
  });

  it("route duyệt của ngân hàng câu chung không duyệt được câu doanh nghiệp (không đi vòng CO-16)", async () => {
    const q = await seedQuestion("Câu doanh nghiệp muốn đi vòng?");
    assert.equal((await mod("PATCH", `/questions/${q._id}/approve`, {})).status, 404);

    const bulk = await mod("POST", "/questions/bulk", { action: "approve", ids: [String(q._id)] });
    assert.equal(bulk.status, 200);
    assert.equal(bulk.body.updated, 0);
    assert.equal((await QuestionBank.findById(q._id).lean()).status, "pending_platform_review");
  });

  it("luồng đầy đủ: Company Mod tải lên → chờ Platform Mod → Platform Mod duyệt → approved + video", async () => {
    const up = await call(modA, "POST", "/company/questions/upload", {
      jobPostId: String(jobA._id),
      questions: ["Câu luồng đầy đủ?"],
    });
    assert.equal(up.status, 201);
    const id = up.body.questions[0]._id;
    assert.equal(up.body.questions[0].status, "pending_platform_review");
    await videoSvc.whenCompanyVideoWarmIdle();
    assert.equal(pregenCalls.length, 0, "Company Mod duyệt chưa render video");

    const res = await mod("POST", `/company-questions/${id}/approve`, {});
    assert.equal(res.status, 200);
    await videoSvc.whenCompanyVideoWarmIdle();
    assert.deepEqual(warmedTexts(), ["Câu luồng đầy đủ?"]);

    const dash = await call(modA, "GET", "/company/dashboard");
    assert.equal(dash.body.stats.questions.approved, 1);
    assert.equal(dash.body.stats.questions.pendingPlatformReview, 0);
  });
});

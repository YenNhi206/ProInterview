/**
 * CO-05 (bổ sung 23/11/2026, đề xuất z, quyết định CO-16):
 * - câu doanh nghiệp có `jobPostId`, tải lên hàng loạt theo job, bỏ câu trùng `textHash`;
 * - Company Moderator duyệt xong thì câu ở `pending_platform_review`, chưa `approved`;
 * - sửa câu ghi vào `history`.
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
let hashQuestionText;

let companyA;
let companyB;
let modA;
let jobA;
let jobA2;
let jobB;

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ Company } = await import("../models/Company.js"));
  ({ JobPost } = await import("../models/JobPost.js"));
  ({ QuestionBank, hashQuestionText } = await import("../models/QuestionBank.js"));
  await QuestionBank.init();
  const { createApp } = await import("../app.js");
  http = await startHttpServer(createApp());

  const stamp = Date.now();
  companyA = await Company.create({ name: "Công ty A", slug: `upload-a-${stamp}`, status: "active" });
  companyB = await Company.create({ name: "Công ty B", slug: `upload-b-${stamp}`, status: "active" });
  modA = await User.create({ name: "HR A", email: `upload-hr-a-${stamp}@test.local`, role: "company_moderator", companyId: companyA._id });
  jobA = await JobPost.create({ companyId: companyA._id, title: "Frontend Developer", roleCategory: "frontend", level: "junior" });
  jobA2 = await JobPost.create({ companyId: companyA._id, title: "Backend Developer", roleCategory: "backend", level: "fresher" });
  jobB = await JobPost.create({ companyId: companyB._id, title: "Job của B", roleCategory: "frontend", level: "middle" });
});

after(async () => {
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

beforeEach(async () => {
  await QuestionBank.deleteMany({});
});

async function call(method, path, body) {
  const res = await fetch(`${http.baseUrl}/api/company${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${mintAccessToken(modA._id)}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

function seedQuestion(text, { orgId = companyA._id, status = "draft", jobPostId = null } = {}) {
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

describe("CO-05 — tải câu lên hàng loạt theo job", () => {
  it("lưu câu gắn jobPostId, lấy roleCategory từ job, trạng thái chờ Platform Mod; bỏ câu trùng textHash", async () => {
    await seedQuestion("Câu đã có của công ty?", { status: "rejected" });

    const res = await call("POST", "/questions/upload", {
      jobPostId: String(jobA._id),
      questions: [
        "Kể về lần bạn tối ưu hiệu năng trang web?",
        { text: "Bạn quản lý state thế nào?", competencyId: "problem_solving", layer: "theory" },
        "  kể về lần bạn tối ưu hiệu năng trang web  ", // trùng trong lượt (khác hoa/thường, khoảng trắng)
        "Câu đã có của công ty", // trùng câu đã có (mọi trạng thái), khác dấu câu cuối
      ],
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.count, 2);
    assert.equal(res.body.skippedDuplicates, 2);

    const saved = await QuestionBank.find({ orgId: companyA._id, jobPostId: jobA._id }).sort({ createdAt: 1 }).lean();
    assert.equal(saved.length, 2);
    for (const q of saved) {
      assert.equal(q.status, "pending_platform_review");
      assert.equal(q.source, "org_template");
      assert.equal(q.roleCategory, "frontend");
      assert.equal(q.seniority, "junior", "lấy cấp độ của job khi hợp lệ");
      assert.equal(q.history[0].action, "create");
      assert.equal(String(q.createdBy), String(modA._id));
    }
    const state = saved.find((q) => q.text === "Bạn quản lý state thế nào?");
    assert.equal(state.competencyId, "problem_solving");
    assert.equal(state.layer, "theory");
  });

  it("status: draft → lưu nháp; job cấp độ ngoài thang QuestionBank → seniority mặc định", async () => {
    const res = await call("POST", "/questions/upload", {
      jobPostId: String(jobA2._id),
      status: "draft",
      questions: ["Thiết kế API idempotent thế nào?"],
    });
    assert.equal(res.status, 201);
    const q = await QuestionBank.findOne({ jobPostId: jobA2._id }).lean();
    assert.equal(q.status, "draft");
    assert.equal(q.roleCategory, "backend");
    assert.equal(q.seniority, "middle");
  });

  it("một dòng sai → 400 kèm lỗi theo dòng, không lưu câu nào", async () => {
    const res = await call("POST", "/questions/upload", {
      jobPostId: String(jobA._id),
      questions: ["Câu hợp lệ?", "", { text: "Câu sai năng lực?", competencyId: "khong_co" }],
    });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.errors.map((e) => e.line), [2, 3]);
    assert.equal(await QuestionBank.countDocuments({}), 0);
  });

  it("thiếu job, job sai id, job công ty khác, danh sách rỗng hoặc quá giới hạn → lỗi", async () => {
    assert.equal((await call("POST", "/questions/upload", { questions: ["Câu?"] })).status, 400);
    assert.equal((await call("POST", "/questions/upload", { jobPostId: "abc", questions: ["Câu?"] })).status, 400);
    assert.equal(
      (await call("POST", "/questions/upload", { jobPostId: "507f1f77bcf86cd799439011", questions: ["Câu?"] })).status,
      404,
    );
    assert.equal((await call("POST", "/questions/upload", { jobPostId: String(jobB._id), questions: ["Câu?"] })).status, 403);
    assert.equal((await call("POST", "/questions/upload", { jobPostId: String(jobA._id), questions: [] })).status, 400);
    const tooMany = Array.from({ length: 51 }, (_, i) => `Câu số ${i}?`);
    assert.equal((await call("POST", "/questions/upload", { jobPostId: String(jobA._id), questions: tooMany })).status, 400);
    assert.equal(await QuestionBank.countDocuments({}), 0);
  });

  it("GET /questions lọc theo jobPostId; jobPostId=none lấy câu không gắn job", async () => {
    await seedQuestion("Câu job A?", { jobPostId: jobA._id });
    await seedQuestion("Câu job A2?", { jobPostId: jobA2._id });
    await seedQuestion("Câu không gắn job?");

    const byJob = await call("GET", `/questions?jobPostId=${jobA._id}`);
    assert.equal(byJob.status, 200);
    assert.deepEqual(byJob.body.questions.map((q) => q.text), ["Câu job A?"]);

    const none = await call("GET", "/questions?jobPostId=none");
    assert.deepEqual(none.body.questions.map((q) => q.text), ["Câu không gắn job?"]);

    assert.equal((await call("GET", "/questions?jobPostId=abc")).status, 400);
    assert.equal((await call("GET", "/questions?status=khong_co")).status, 400);
    const pending = await call("GET", "/questions?status=pending_platform_review");
    assert.equal(pending.status, 200);
  });

  it("tự thêm câu kèm jobPostId → gắn job, lấy roleCategory của job, chờ Platform Mod", async () => {
    const res = await call("POST", "/questions", { text: "Câu tự thêm cho job?", jobPostId: String(jobA2._id), competencyId: "teamwork" });
    assert.equal(res.status, 201);
    assert.equal(String(res.body.question.jobPostId), String(jobA2._id));
    assert.equal(res.body.question.roleCategory, "backend");
    assert.equal(res.body.question.status, "pending_platform_review");

    assert.equal((await call("POST", "/questions", { text: "Câu job B?", jobPostId: String(jobB._id) })).status, 403);
  });
});

describe("CO-05 — Company Mod duyệt xong thì chờ Platform Mod (quyết định CO-16)", () => {
  it("duyệt một câu nháp → pending_platform_review, ghi history; duyệt lại → 409", async () => {
    const q = await seedQuestion("Câu nháp cần duyệt?");
    const res = await call("POST", `/questions/${q._id}/approve`, { reason: "ok" });
    assert.equal(res.status, 200);
    assert.equal(res.body.question.status, "pending_platform_review");
    assert.equal(res.body.question.history.at(-1).action, "approve");

    assert.equal((await call("POST", `/questions/${q._id}/approve`, {})).status, 409);

    const approved = await seedQuestion("Câu Platform Mod đã duyệt?", { status: "approved" });
    assert.equal((await call("POST", `/questions/${approved._id}/approve`, {})).status, 409);
    assert.equal((await QuestionBank.findById(approved._id).lean()).status, "approved", "không bị hạ trạng thái");
  });

  it("câu đã từ chối duyệt lại được → pending_platform_review", async () => {
    const q = await seedQuestion("Câu từng bị từ chối?", { status: "rejected" });
    const res = await call("POST", `/questions/${q._id}/approve`, {});
    assert.equal(res.status, 200);
    assert.equal(res.body.question.status, "pending_platform_review");
  });

  it("duyệt hàng loạt chỉ chuyển câu nháp / từ chối của chính công ty, không đụng câu đã approved", async () => {
    const draft = await seedQuestion("Nháp 1?");
    const rejected = await seedQuestion("Từ chối 1?", { status: "rejected" });
    const approved = await seedQuestion("Đã duyệt 1?", { status: "approved" });
    const other = await seedQuestion("Câu công ty B?", { orgId: companyB._id });

    const res = await call("POST", "/questions/batch-approve", { ids: [draft._id, rejected._id, approved._id, other._id] });
    assert.equal(res.status, 200);
    assert.equal(res.body.modifiedCount, 2);

    const byText = Object.fromEntries((await QuestionBank.find({}).lean()).map((q) => [q.text, q.status]));
    assert.equal(byText["Nháp 1?"], "pending_platform_review");
    assert.equal(byText["Từ chối 1?"], "pending_platform_review");
    assert.equal(byText["Đã duyệt 1?"], "approved");
    assert.equal(byText["Câu công ty B?"], "draft");

    assert.equal((await call("POST", "/questions/batch-approve", { ids: ["abc"] })).status, 400);
    assert.equal((await call("POST", "/questions/batch-reject", { ids: ["abc"] })).status, 400);
  });

  it("dashboard đếm câu chờ Platform Mod", async () => {
    await seedQuestion("Chờ 1?", { status: "pending_platform_review" });
    await seedQuestion("Chờ 2?", { status: "pending_platform_review" });
    await seedQuestion("Đã duyệt?", { status: "approved" });
    const res = await call("GET", "/dashboard");
    assert.equal(res.status, 200);
    assert.equal(res.body.stats.questions.pendingPlatformReview, 2);
    assert.equal(res.body.stats.questions.approved, 1);
  });
});

describe("CO-05 — sửa câu", () => {
  it("sửa chữ ghi history kèm previousQuestion; câu đã approved đổi chữ thì quay về chờ Platform Mod", async () => {
    const q = await seedQuestion("Câu gốc đã duyệt?", { status: "approved" });
    const res = await call("PATCH", `/questions/${q._id}`, { text: "Câu đã sửa?", reason: "rõ nghĩa hơn" });
    assert.equal(res.status, 200);
    assert.equal(res.body.question.status, "pending_platform_review");
    const last = res.body.question.history.at(-1);
    assert.equal(last.action, "edit");
    assert.equal(last.previousQuestion, "Câu gốc đã duyệt?");
    assert.equal(last.reason, "rõ nghĩa hơn");
    assert.equal(res.body.question.textHash, hashQuestionText("Câu đã sửa?"));
  });

  it("sửa không đổi chữ thì giữ trạng thái approved", async () => {
    const q = await seedQuestion("Câu giữ nguyên?", { status: "approved" });
    const res = await call("PATCH", `/questions/${q._id}`, { competencyId: "communication" });
    assert.equal(res.status, 200);
    assert.equal(res.body.question.status, "approved");
    assert.equal(res.body.question.competencyId, "communication");
  });

  it("đổi chữ trùng câu khác của công ty → 409, không lưu", async () => {
    await seedQuestion("Câu đã tồn tại?");
    const q = await seedQuestion("Câu sẽ bị sửa?");
    const res = await call("PATCH", `/questions/${q._id}`, { text: "câu đã tồn tại" });
    assert.equal(res.status, 409);
    assert.equal((await QuestionBank.findById(q._id).lean()).text, "Câu sẽ bị sửa?");
  });

  it("gắn / bỏ gắn job; job công ty khác → 403", async () => {
    const q = await seedQuestion("Câu đổi job?");
    const set = await call("PATCH", `/questions/${q._id}`, { jobPostId: String(jobA._id) });
    assert.equal(set.status, 200);
    assert.equal(String(set.body.question.jobPostId), String(jobA._id));

    const unset = await call("PATCH", `/questions/${q._id}`, { jobPostId: null });
    assert.equal(unset.status, 200);
    assert.equal(unset.body.question.jobPostId, null);

    assert.equal((await call("PATCH", `/questions/${q._id}`, { jobPostId: String(jobB._id) })).status, 403);
  });
});

describe("CO-05 — rubric gắn câu công ty đã duyệt", () => {
  it("câu đang chờ Platform Mod gắn được vào rubric; câu nháp thì không", async () => {
    const levels = { 0: "a", 1: "b", 2: "c", 3: "d", 4: "e", 5: "f" };
    const pending = await seedQuestion("Câu chờ Platform Mod cho rubric?", { status: "pending_platform_review" });
    const draft = await seedQuestion("Câu nháp cho rubric?");
    const body = (q) => ({
      title: "Rubric FE",
      roleCategory: "frontend",
      criteria: [{ name: "Giao tiếp", shrmKey: "communication", weight: 100, levels, questionIds: [String(q._id)] }],
    });
    assert.equal((await call("POST", "/rubrics", body(pending))).status, 201);
    assert.equal((await call("POST", "/rubrics", body(draft))).status, 400);
  });
});

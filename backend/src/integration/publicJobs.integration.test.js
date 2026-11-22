/**
 * JB-03: API công khai GET /api/jobs, GET /api/jobs/:id — không trả job draft, closed, hidden.
 * JB-02: tự đóng job quá `closesAt` (test với đồng hồ giả).
 * Đề xuất (l): danh sách roleCategory chung (`GET /api/role-categories`), áp cho job, rubric, câu hỏi công ty.
 * Quyết định 5: yêu cầu mentor / lộ trình gắn job thì DTO có `jobPost` (năng lực yêu cầu làm khung).
 */
import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";

let harness, http, models, jobPosts, mrService, lpService;
let companyA, companyB, suspendedCo, modA, rubricA;

const DAY = 86_400_000;
const DESCRIPTION = "Xây dựng dịch vụ backend cho nền tảng thanh toán, tối ưu hiệu năng và độ tin cậy của hệ thống.";

async function call(user, path, method = "GET", body, headers = {}) {
  const res = await fetch(`${http.baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${mintAccessToken(user._id)}` } : {}), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (res.status === 304) return { status: 304 };
  return { status: res.status, etag: res.headers.get("etag"), ...(await res.json()) };
}

let seq = 0;
/** Tạo job trực tiếp bằng model (đủ trạng thái cần test). */
function job(overrides = {}) {
  seq += 1;
  return models.JobPost.create({
    companyId: companyA._id,
    title: `Backend Engineer ${seq}`,
    roleCategory: "backend",
    level: "middle",
    description: DESCRIPTION,
    requiredCompetencies: [{ shrmKey: "technical_learning", minLevel: 3 }],
    requiredSkills: ["Node.js"],
    status: "published",
    publishedAt: new Date(Date.now() - seq * 1000),
    ...overrides,
  });
}

before(async () => {
  harness = await startMongoHarness();
  models = { ...(await import("../models/index.js")), ...(await import("../models/MentorshipRequest.js")) };
  jobPosts = await import("../services/jobPostsService.js");
  mrService = await import("../services/mentorshipRequestsService.js");
  lpService = await import("../services/learningPathsService.js");
  await Promise.all(Object.values(models).filter((m) => m?.modelName).map((m) => m.init()));
  companyA = await models.Company.create({ name: "Công ty Alpha", slug: "jb03-alpha", industry: "Fintech", logo: "" });
  companyB = await models.Company.create({ name: "Công ty Beta", slug: "jb03-beta" });
  suspendedCo = await models.Company.create({ name: "Công ty bị khóa", slug: "jb03-suspended", status: "suspended" });
  modA = await models.User.create({ name: "HR Alpha", email: "jb03-mod-a@test.local", role: "company_moderator", companyId: companyA._id });
  rubricA = await models.CompanyRubric.create({ companyId: companyA._id, roleCategory: "backend", title: "Rubric Backend", status: "approved", criteria: [{ name: "Kỹ thuật", shrmKey: "technical_learning", weight: 100 }] });
  http = await startHttpServer((await import("../app.js")).createApp());
});

after(async () => {
  if (http) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

describe("GET /api/jobs (JB-03)", () => {
  it("không cần đăng nhập; chỉ trả job đang mở, không trả draft / closed / hidden / quá hạn / công ty bị khóa", async () => {
    const open = await job({ title: "Job đang mở JB03", rubricId: rubricA._id, closesAt: new Date(Date.now() + 5 * DAY), salaryRange: "25-35 triệu" });
    const noDeadline = await job({ title: "Job không hạn JB03" });
    const hidden = [
      await job({ status: "draft", publishedAt: null }),
      await job({ status: "closed", closedAt: new Date() }),
      await job({ status: "hidden" }),
      await job({ closesAt: new Date(Date.now() - 60_000) }),
      await job({ companyId: suspendedCo._id }),
    ].map((j) => String(j._id));

    const res = await call(null, "/api/jobs?limit=50");
    assert.equal(res.status, 200, res.error);
    const ids = res.jobs.map((j) => j.id);
    assert.ok(ids.includes(String(open._id)));
    assert.ok(ids.includes(String(noDeadline._id)));
    for (const id of hidden) assert.equal(ids.includes(id), false, `job ${id} không được hiện`);

    const row = res.jobs.find((j) => j.id === String(open._id));
    assert.equal(row.hasRubric, true);
    assert.equal(row.salaryRange, "25-35 triệu");
    assert.equal(row.roleCategoryName, "Lập trình viên Backend");
    assert.equal(row.company.name, "Công ty Alpha");
    assert.equal(row.company.slug, "jb03-alpha");
    assert.equal(row.requiredCompetencies[0].shrmKey, "technical_learning");
    assert.ok(row.requiredCompetencies[0].name);
    assert.equal(row.description, undefined, "danh sách chỉ có summary");
    assert.ok(row.summary);
    for (const key of ["createdBy", "updatedBy", "rubricId", "rubric", "status", "companyId"]) {
      assert.equal(key in row, false, `không lộ ${key}`);
    }
  });

  it("lọc theo nhóm vị trí, cấp độ, nơi làm việc, công ty, từ khóa; phân trang mới đăng trước", async () => {
    const tag = `Kotlin${Date.now()}`;
    const a = await job({ title: `Mobile ${tag}`, roleCategory: "mobile", level: "senior", workMode: "remote", requiredSkills: ["Kotlin"] });
    const b = await job({ title: `Mobile B ${tag}`, roleCategory: "mobile", level: "junior", companyId: companyB._id });

    const mobile = await call(null, `/api/jobs?roleCategory=mobile&q=${encodeURIComponent(tag)}`);
    assert.deepEqual(mobile.jobs.map((j) => j.id).sort(), [String(a._id), String(b._id)].sort());
    assert.deepEqual((await call(null, `/api/jobs?q=${tag}&level=senior`)).jobs.map((j) => j.id), [String(a._id)]);
    assert.deepEqual((await call(null, `/api/jobs?q=${tag}&workMode=remote`)).jobs.map((j) => j.id), [String(a._id)]);
    assert.deepEqual((await call(null, `/api/jobs?q=${tag}&company=jb03-beta`)).jobs.map((j) => j.id), [String(b._id)]);
    assert.equal((await call(null, "/api/jobs?company=jb03-suspended")).jobs.length, 0);
    assert.equal((await call(null, "/api/jobs?company=khong-co")).jobs.length, 0);
    // Tìm theo kỹ năng; ký tự đặc biệt của regex không làm lỗi truy vấn.
    assert.ok((await call(null, `/api/jobs?q=kotlin`)).jobs.some((j) => j.id === String(a._id)));
    assert.equal((await call(null, `/api/jobs?q=${encodeURIComponent("c++ (senior")}`)).status, 200);

    const page1 = await call(null, `/api/jobs?q=${tag}&limit=1&page=1`);
    const page2 = await call(null, `/api/jobs?q=${tag}&limit=1&page=2`);
    assert.equal(page1.pagination.total, 2);
    assert.equal(page1.pagination.totalPages, 2);
    assert.equal(page1.jobs[0].id, String(a._id), "publishedAt mới hơn đứng trước");
    assert.equal(page2.jobs[0].id, String(b._id));
  });

  it("bộ lọc sai trả 400", async () => {
    for (const qs of ["roleCategory=khong_co", "level=ceo", "workMode=moon", "limit=500", "page=0", `q=${"x".repeat(101)}`]) {
      const res = await call(null, `/api/jobs?${qs}`);
      assert.equal(res.status, 400, qs);
      assert.equal(res.success, false);
    }
  });
});

describe("GET /api/jobs/:id (JB-03)", () => {
  it("job đang mở: mô tả đầy đủ và thông tin công ty", async () => {
    const open = await job({ description: `${DESCRIPTION} `.repeat(6).trim() });
    const res = await call(null, `/api/jobs/${open._id}`);
    assert.equal(res.status, 200, res.error);
    assert.equal(res.job.description, open.description);
    assert.ok(res.job.summary.length <= 280);
    assert.equal(res.job.company.industry, "Fintech");
    assert.equal(res.job.hasRubric, false);
  });

  it("draft, closed, hidden, quá hạn, công ty bị khóa → 404; id sai → 400", async () => {
    const rows = [
      await job({ status: "draft", publishedAt: null }),
      await job({ status: "closed" }),
      await job({ status: "hidden" }),
      await job({ closesAt: new Date(Date.now() - 1000) }),
      await job({ companyId: suspendedCo._id }),
    ];
    for (const row of rows) assert.equal((await call(null, `/api/jobs/${row._id}`)).status, 404, row.status);
    assert.equal((await call(null, "/api/jobs/khong-phai-id")).status, 400);
    assert.equal((await call(null, "/api/jobs/0123456789abcdef01234567")).status, 404);
  });
});

describe("Tự đóng job quá hạn (JB-02)", () => {
  it("đồng hồ giả: đóng published và hidden quá hạn với closedReason expired; không đụng job khác; chạy lại không đổi gì", async () => {
    await models.JobPost.updateMany({}, { $set: { closesAt: null } });
    const now = new Date(Date.now() + 10 * DAY);
    const expired = await job({ closesAt: new Date(now.getTime() - 1000) });
    const exactly = await job({ closesAt: now });
    const hiddenExpired = await job({ status: "hidden", closesAt: new Date(now.getTime() - DAY) });
    const future = await job({ closesAt: new Date(now.getTime() + DAY) });
    const draftPast = await job({ status: "draft", publishedAt: null, closesAt: new Date(now.getTime() - DAY) });
    const noDeadline = await job();

    const first = await jobPosts.closeExpiredJobPosts(now);
    assert.equal(first.closed, 3);
    for (const row of [expired, exactly, hiddenExpired]) {
      const doc = await models.JobPost.findById(row._id).lean();
      assert.equal(doc.status, "closed");
      assert.equal(doc.closedReason, "expired");
      assert.equal(doc.closedAt.getTime(), now.getTime());
    }
    assert.equal((await models.JobPost.findById(future._id).lean()).status, "published");
    assert.equal((await models.JobPost.findById(draftPast._id).lean()).status, "draft", "bản nháp không bị đóng");
    assert.equal((await models.JobPost.findById(noDeadline._id).lean()).status, "published");

    assert.equal((await jobPosts.closeExpiredJobPosts(now)).closed, 0);
  });

  it("Company Mod thấy job hết hạn trong trang của mình là closed, không sửa được", async () => {
    const row = await job({ closesAt: new Date(Date.now() + DAY) });
    await jobPosts.closeExpiredJobPosts(new Date(Date.now() + 2 * DAY));
    const res = await call(modA, `/api/company/jobs/${row._id}`);
    assert.equal(res.job.status, "closed");
    assert.equal(res.job.closedReason, "expired");
    assert.equal((await call(modA, `/api/company/jobs/${row._id}`, "PATCH", { title: "Sửa sau hạn" })).status, 409);
  });
});

describe("Danh sách roleCategory chung (đề xuất (l))", () => {
  it("GET /api/role-categories công khai, có tên và năng lực gợi ý hợp lệ, hỗ trợ ETag", async () => {
    const { isValidCompetencyKey } = await import("../services/competencyFramework.js");
    const res = await call(null, "/api/role-categories");
    assert.equal(res.status, 200);
    const keys = res.roleCategories.map((r) => r.key);
    for (const key of ["software_engineer", "frontend", "backend", "fullstack", "mobile", "devops", "data_engineer"]) {
      assert.ok(keys.includes(key), `phải giữ key ${key} của khu công ty`);
    }
    for (const row of res.roleCategories) {
      assert.ok(row.nameVi && row.nameEn && row.interviewRole);
      assert.ok(row.suggestedCompetencies.length > 0);
      assert.ok(row.suggestedCompetencies.every((k) => isValidCompetencyKey(k)), row.key);
    }
    assert.ok(res.etag);
    assert.equal((await call(null, "/api/role-categories", "GET", undefined, { "If-None-Match": res.etag })).status, 304);
  });

  it("job, rubric, câu hỏi công ty từ chối roleCategory / key năng lực ngoài danh sách", async () => {
    const jobBody = { title: "Backend Engineer", roleCategory: "backend_engineer", level: "middle" };
    assert.equal((await call(modA, "/api/company/jobs", "POST", jobBody)).status, 400);
    assert.equal((await call(modA, "/api/company/jobs", "POST", { ...jobBody, roleCategory: "backend" })).status, 201);

    assert.equal((await call(modA, "/api/company/rubrics", "POST", { title: "Rubric", roleCategory: "devops_engineer" })).status, 400);
    const badCriteria = await call(modA, "/api/company/rubrics", "POST", { title: "Rubric", roleCategory: "devops", criteria: [{ name: "CI/CD", shrmKey: "technical_mastery", weight: 100 }] });
    assert.equal(badCriteria.status, 400);
    assert.match(badCriteria.error, /CI\/CD/);
    const rubric = await call(modA, "/api/company/rubrics", "POST", { title: "Rubric DevOps", roleCategory: "devops", criteria: [{ name: "CI/CD", shrmKey: "technical_learning", weight: 100 }] });
    assert.equal(rubric.status, 201, rubric.error);
    const rubricId = rubric.rubric._id;
    assert.equal((await call(modA, `/api/company/rubrics/${rubricId}`, "PATCH", { criteria: [{ name: "X", shrmKey: "khong_co", weight: 100 }] })).status, 400);
    // Rubric cũ lưu key sai (trước khi có kiểm tra) thì không gửi duyệt được.
    await models.CompanyRubric.updateOne({ _id: rubricId }, { $set: { "criteria.0.shrmKey": "technical_mastery" } });
    assert.equal((await call(modA, `/api/company/rubrics/${rubricId}/submit`, "POST")).status, 400);

    const qBody = { questionText: `Kể về một lần bạn tối ưu pipeline CI ${Date.now()}`, roleCategory: "devops", competencyId: "technical_learning" };
    assert.equal((await call(modA, "/api/company/questions", "POST", { ...qBody, roleCategory: "telecom_engineer" })).status, 400);
    assert.equal((await call(modA, "/api/company/questions", "POST", { ...qBody, competencyId: "technical_mastery" })).status, 400);
    const created = await call(modA, "/api/company/questions", "POST", qBody);
    assert.equal(created.status, 201, created.error);
    assert.equal(created.question.competencyId, "technical_learning");
    const defaults = await call(modA, "/api/company/questions", "POST", { questionText: `Câu mặc định ${Date.now()}` });
    assert.equal(defaults.status, 201, defaults.error);
    assert.equal(defaults.question.competencyId, "technical_learning", "mặc định là key có trong bộ tiêu chí");
    assert.equal((await call(modA, `/api/company/questions/${created.question._id}`, "PATCH", { roleCategory: "khong_co" })).status, 400);
    assert.equal((await call(modA, "/api/company/questions/generate-starter", "POST", { roleCategory: "khong_co" })).status, 400);
  });
});

describe("Yêu cầu mentor và lộ trình gắn job (quyết định 5)", () => {
  it("DTO lộ trình có jobPost với năng lực yêu cầu của job", async () => {
    const open = await job({ title: "Data Analyst JB03", roleCategory: "data_analyst", requiredCompetencies: [{ shrmKey: "data_driven_decision", minLevel: 3 }, { shrmKey: "communication", minLevel: 3 }] });
    const mentee = await models.User.create({ name: "Mentee JB03", email: "jb03-mentee@test.local", role: "customer" });
    const mentorUser = await models.User.create({ name: "Mentor JB03", email: "jb03-mentor@test.local", role: "mentor" });
    await models.Mentor.findOneAndUpdate(
      { userId: mentorUser._id },
      { $set: { userId: mentorUser._id, name: "Mentor JB03", title: "Data Lead", publicId: "jb03-mentor", isActive: true, isVerified: true, available: true, pricePerHour: 300000, sessionTypes: [{ type: "mock_interview", durationMinutes: 60, price: 300000 }] } },
      { upsert: true },
    );
    const act = (u) => mrService.requestActor(String(u._id));
    const files = { cv: [{ originalname: "cv.pdf", buffer: Buffer.from("cv") }], jd: [{ originalname: "jd.txt", buffer: Buffer.from("jd") }] };
    const request = await mrService.createRequest(await act(mentee), { position: "Data Analyst", description: "Muốn luyện phỏng vấn cho đúng vị trí Data Analyst này.", sessionType: "mock_interview", jobPostId: String(open._id) }, files);
    const offered = await mrService.sendOffer(await act(mentorUser), String(request._id), { message: "Tôi sẽ đánh giá kỹ năng phân tích dữ liệu và trình bày của bạn.", availability: "Tối thứ 4" });
    await mrService.selectOffer(await act(mentee), String(request._id), String(offered.offers[0]._id));

    const draft = await lpService.createLearningPathDraft(await act(mentorUser), { mentorshipRequestId: String(request._id), totalAmount: 0, sessions: [] });
    assert.equal(draft.jobPostId, String(open._id));
    assert.equal(draft.jobPost.title, "Data Analyst JB03");
    assert.equal(draft.jobPost.company.name, "Công ty Alpha");
    assert.deepEqual(draft.jobPost.requiredCompetencies.map((c) => c.shrmKey), ["data_driven_decision", "communication"]);

    const plain = await lpService.createLearningPathDraft(await act(mentorUser), {
      mentorshipRequestId: String((await (async () => {
        const r = await mrService.createRequest(await act(mentee), { position: "Data Analyst", description: "Yêu cầu không gắn job để so sánh DTO.", sessionType: "mock_interview" }, files);
        const o = await mrService.sendOffer(await act(mentorUser), String(r._id), { message: "Tôi sẽ đánh giá kỹ năng phân tích dữ liệu và trình bày của bạn.", availability: "Tối thứ 4" });
        await mrService.selectOffer(await act(mentee), String(r._id), String(o.offers[0]._id));
        return r;
      })())._id),
    });
    assert.equal(plain.jobPost, null);
  });
});

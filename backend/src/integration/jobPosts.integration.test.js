/**
 * JB-01: Model JobPost; API Company Moderator tạo, sửa, đăng (publish), đóng (close).
 * Xong khi: chỉ gắn rubric `approved` của cùng công ty; có test.
 */
import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();

let harness, http, models;
let companyA, companyB, modA, modB, candidate, rubricA, rubricDraftA, rubricOtherRoleA, rubricB;

const DESCRIPTION = "Phát triển và vận hành dịch vụ backend Node.js cho hệ thống thanh toán, làm việc cùng team sản phẩm.";
const baseJob = () => ({
  title: "Backend Engineer (Node.js)",
  roleCategory: "backend",
  level: "middle",
  location: "TP. Hồ Chí Minh",
  description: DESCRIPTION,
  requiredCompetencies: [{ shrmKey: "technical_learning", minLevel: 3 }, { shrmKey: "problem_solving", minLevel: 3 }],
  requiredSkills: ["Node.js", "MongoDB"],
});

async function call(user, path, method = "GET", body) {
  const res = await fetch(`${http.baseUrl}/api/company${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${mintAccessToken(user._id)}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, ...(await res.json()) };
}

async function createJob(user = modA, overrides = {}) {
  const res = await call(user, "/jobs", "POST", { ...baseJob(), ...overrides });
  assert.equal(res.status, 201, res.error);
  return res.job;
}

async function publishedJob(overrides = {}) {
  const job = await createJob(modA, overrides);
  const res = await call(modA, `/jobs/${job.id}/status`, "PATCH", { status: "published" });
  assert.equal(res.status, 200, res.error);
  return res.job;
}

const rubric = (companyId, roleCategory, status, version = 1) => models.CompanyRubric.create({
  companyId,
  roleCategory,
  title: `Rubric ${roleCategory} v${version}`,
  version,
  status,
  criteria: [{ name: "Kỹ thuật", shrmKey: "technical_learning", weight: 100 }],
});

before(async () => {
  harness = await startMongoHarness();
  models = await import("../models/index.js");
  await Promise.all(Object.values(models).filter((m) => m?.modelName).map((m) => m.init()));
  companyA = await models.Company.create({ name: "Công ty A", slug: "jb01-company-a" });
  companyB = await models.Company.create({ name: "Công ty B", slug: "jb01-company-b" });
  modA = await models.User.create({ name: "HR A", email: "jb01-mod-a@test.local", role: "company_moderator", companyId: companyA._id });
  modB = await models.User.create({ name: "HR B", email: "jb01-mod-b@test.local", role: "company_moderator", companyId: companyB._id });
  candidate = await models.User.create({ name: "Ứng viên", email: "jb01-candidate@test.local", role: "customer" });
  rubricA = await rubric(companyA._id, "backend", "approved");
  rubricDraftA = await rubric(companyA._id, "backend", "draft", 2);
  rubricOtherRoleA = await rubric(companyA._id, "frontend", "approved");
  rubricB = await rubric(companyB._id, "backend", "approved");
  http = await startHttpServer((await import("../app.js")).createApp());
});

after(async () => {
  if (http) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

describe("Tạo và sửa tin tuyển dụng (JB-01)", () => {
  it("tạo bản nháp: chuẩn hóa kỹ năng, kèm tên năng lực, mặc định full_time / onsite", async () => {
    const job = await createJob(modA, { requiredSkills: [" Node.js ", "node.js", "MongoDB", "Docker  Compose"] });
    assert.equal(job.status, "draft");
    assert.equal(job.companyId, String(companyA._id));
    assert.deepEqual(job.requiredSkills, ["Node.js", "MongoDB", "Docker Compose"]);
    assert.equal(job.employmentType, "full_time");
    assert.equal(job.workMode, "onsite");
    assert.equal(job.rubric, null);
    assert.deepEqual(job.requiredCompetencies.map((c) => c.shrmKey), ["technical_learning", "problem_solving"]);
    assert.ok(job.requiredCompetencies.every((c) => c.name && c.name !== c.shrmKey));
    assert.equal(job.publishedAt, null);

    const row = await models.JobPost.findById(job.id).lean();
    assert.equal(String(row.createdBy), String(modA._id));
  });

  it("bản nháp được để thiếu mô tả và năng lực; chỉ chặn khi đăng", async () => {
    const job = await createJob(modA, { description: "", requiredCompetencies: [] });
    assert.equal(job.status, "draft");
    const publish = await call(modA, `/jobs/${job.id}/status`, "PATCH", { status: "published" });
    assert.equal(publish.status, 400);
    assert.match(publish.error, /mô tả/);
    await call(modA, `/jobs/${job.id}`, "PATCH", { description: DESCRIPTION });
    const again = await call(modA, `/jobs/${job.id}/status`, "PATCH", { status: "published" });
    assert.equal(again.status, 400);
    assert.match(again.error, /năng lực/);
  });

  it("từ chối dữ liệu sai: key năng lực lạ, trùng key, mức ngoài 1–5, cấp độ lạ, roleCategory sai, hạn đã qua, thiếu tiêu đề", async () => {
    const bad = [
      { requiredCompetencies: [{ shrmKey: "khong_co_key_nay", minLevel: 3 }] },
      { requiredCompetencies: [{ shrmKey: "communication", minLevel: 3 }, { shrmKey: "communication", minLevel: 4 }] },
      { requiredCompetencies: [{ shrmKey: "communication", minLevel: 6 }] },
      { requiredCompetencies: [{ shrmKey: "communication", minLevel: 0 }] },
      { level: "ceo" },
      { roleCategory: "Back End!" },
      { closesAt: new Date(Date.now() - 86_400_000).toISOString() },
      { title: "" },
      { requiredSkills: Array.from({ length: 31 }, (_, i) => `skill-${i}`) },
    ];
    for (const overrides of bad) {
      const res = await call(modA, "/jobs", "POST", { ...baseJob(), ...overrides });
      assert.equal(res.status, 400, `phải từ chối ${JSON.stringify(overrides).slice(0, 80)}`);
      assert.equal(res.success, false);
      assert.ok(res.error);
    }
  });

  it("PATCH bỏ qua status / companyId trong body (không tự đăng, không chuyển công ty)", async () => {
    const job = await createJob();
    const res = await call(modA, `/jobs/${job.id}`, "PATCH", { title: "Senior Backend Engineer", status: "published", companyId: String(companyB._id) });
    assert.equal(res.status, 200, res.error);
    assert.equal(res.job.title, "Senior Backend Engineer");
    assert.equal(res.job.status, "draft");
    assert.equal(res.job.companyId, String(companyA._id));
    assert.equal((await call(modA, `/jobs/${job.id}`, "PATCH", {})).status, 400, "body rỗng");
  });
});

describe("Gắn rubric (JB-01: chỉ rubric approved của cùng công ty)", () => {
  it("gắn được rubric approved cùng công ty, cùng nhóm vị trí", async () => {
    const job = await createJob(modA, { rubricId: String(rubricA._id) });
    assert.equal(job.rubricId, String(rubricA._id));
    assert.deepEqual(job.rubric, { id: String(rubricA._id), title: rubricA.title, version: 1, status: "approved", roleCategory: "backend" });
  });

  it("từ chối rubric chưa duyệt, rubric của công ty khác, rubric khác nhóm vị trí, rubric không tồn tại", async () => {
    for (const rubricId of [rubricDraftA._id, rubricB._id, rubricOtherRoleA._id, "0123456789abcdef01234567"]) {
      const res = await call(modA, "/jobs", "POST", { ...baseJob(), rubricId: String(rubricId) });
      assert.equal(res.status, 400, `rubric ${rubricId}`);
    }
    const job = await createJob();
    const res = await call(modA, `/jobs/${job.id}`, "PATCH", { rubricId: String(rubricB._id) });
    assert.equal(res.status, 400);
    assert.equal((await models.JobPost.findById(job.id).lean()).rubricId, null);
  });

  it("đổi nhóm vị trí khi đang gắn rubric thì phải đổi rubric theo; gỡ rubric bằng null", async () => {
    const job = await createJob(modA, { rubricId: String(rubricA._id) });
    assert.equal((await call(modA, `/jobs/${job.id}`, "PATCH", { roleCategory: "frontend" })).status, 400);
    const moved = await call(modA, `/jobs/${job.id}`, "PATCH", { roleCategory: "frontend", rubricId: String(rubricOtherRoleA._id) });
    assert.equal(moved.status, 200, moved.error);
    assert.equal(moved.job.rubricId, String(rubricOtherRoleA._id));
    const detached = await call(modA, `/jobs/${job.id}`, "PATCH", { rubricId: null });
    assert.equal(detached.status, 200, detached.error);
    assert.equal(detached.job.rubricId, "");
    assert.equal(detached.job.rubric, null);
  });

  it("rubric bị lưu trữ sau khi gắn vào bản nháp thì không đăng được", async () => {
    const old = await rubric(companyA._id, "devops", "approved");
    const job = await createJob(modA, { roleCategory: "devops", rubricId: String(old._id) });
    await models.CompanyRubric.updateOne({ _id: old._id }, { $set: { status: "archived" } });
    const res = await call(modA, `/jobs/${job.id}/status`, "PATCH", { status: "published" });
    assert.equal(res.status, 400);
    assert.equal((await models.JobPost.findById(job.id).lean()).status, "draft");
  });
});

describe("Đăng và đóng tin (JB-01)", () => {
  it("draft → published → closed; ghi publishedAt, closedAt, closedReason", async () => {
    const job = await publishedJob({ closesAt: new Date(Date.now() + 7 * 86_400_000).toISOString() });
    assert.equal(job.status, "published");
    assert.ok(job.publishedAt);
    assert.ok(job.closesAt);
    assert.equal((await call(modA, `/jobs/${job.id}/status`, "PATCH", { status: "published" })).status, 409);

    const edited = await call(modA, `/jobs/${job.id}`, "PATCH", { location: "Hà Nội", requiredSkills: ["Node.js", "Redis"] });
    assert.equal(edited.status, 200, edited.error);
    assert.equal(edited.job.status, "published");
    assert.equal((await call(modA, `/jobs/${job.id}`, "PATCH", { requiredCompetencies: [] })).status, 400, "job đang đăng phải còn năng lực yêu cầu");
    assert.equal((await call(modA, `/jobs/${job.id}`, "PATCH", { description: "ngắn" })).status, 400);

    const closed = await call(modA, `/jobs/${job.id}/status`, "PATCH", { status: "closed" });
    assert.equal(closed.status, 200, closed.error);
    assert.equal(closed.job.status, "closed");
    assert.ok(closed.job.closedAt);
    assert.equal(closed.job.closedReason, "company");

    assert.equal((await call(modA, `/jobs/${job.id}/status`, "PATCH", { status: "closed" })).status, 409);
    assert.equal((await call(modA, `/jobs/${job.id}/status`, "PATCH", { status: "published" })).status, 409, "không mở lại tin đã đóng");
    assert.equal((await call(modA, `/jobs/${job.id}`, "PATCH", { title: "Đổi tên" })).status, 409);
  });

  it("bản nháp không đóng được; trạng thái lạ bị từ chối", async () => {
    const job = await createJob();
    assert.equal((await call(modA, `/jobs/${job.id}/status`, "PATCH", { status: "closed" })).status, 409);
    assert.equal((await call(modA, `/jobs/${job.id}/status`, "PATCH", { status: "hidden" })).status, 400, "ẩn là quyền Platform Mod (JB-04)");
    assert.equal((await call(modA, `/jobs/${job.id}/status`, "PATCH", {})).status, 400);
  });

  it("job bị Platform Mod ẩn: Company Mod không sửa được nhưng đóng được", async () => {
    const job = await publishedJob();
    await models.JobPost.updateOne({ _id: job.id }, { $set: { status: "hidden" } });
    assert.equal((await call(modA, `/jobs/${job.id}`, "PATCH", { title: "Sửa khi bị ẩn" })).status, 409);
    assert.equal((await call(modA, `/jobs/${job.id}/status`, "PATCH", { status: "published" })).status, 409, "bỏ ẩn là quyền Platform Mod");
    const closed = await call(modA, `/jobs/${job.id}/status`, "PATCH", { status: "closed" });
    assert.equal(closed.status, 200, closed.error);
    assert.equal(closed.job.status, "closed");
  });

  it("hạn nhận hồ sơ đã qua thì không đăng được", async () => {
    const job = await createJob();
    await models.JobPost.updateOne({ _id: job.id }, { $set: { closesAt: new Date(Date.now() - 60_000) } });
    const res = await call(modA, `/jobs/${job.id}/status`, "PATCH", { status: "published" });
    assert.equal(res.status, 400);
    assert.match(res.error, /Hạn nhận hồ sơ/);
  });

  it("đăng và đóng cùng lúc trên bản nháp: chỉ thao tác hợp lệ thắng", async () => {
    const job = await createJob();
    const results = await Promise.all([
      call(modA, `/jobs/${job.id}/status`, "PATCH", { status: "published" }),
      call(modA, `/jobs/${job.id}/status`, "PATCH", { status: "published" }),
    ]);
    assert.equal(results.filter((r) => r.status === 200).length, 1);
    assert.equal((await models.JobPost.findById(job.id).lean()).status, "published");
  });
});

describe("Danh sách và phân quyền (JB-01)", () => {
  it("danh sách chỉ có job của công ty mình; lọc theo trạng thái; có số lượng từng trạng thái", async () => {
    const own = await publishedJob({ title: "Job riêng A để lọc" });
    const other = await createJob(modB, { title: "Job của công ty B" });

    const all = await call(modA, "/jobs?limit=100");
    assert.equal(all.status, 200, all.error);
    assert.ok(all.jobs.some((j) => j.id === own.id));
    assert.ok(all.jobs.every((j) => j.companyId === String(companyA._id)));
    assert.equal(all.jobs.some((j) => j.id === other.id), false);
    const total = Object.values(all.counts).reduce((a, b) => a + b, 0);
    assert.equal(total, await models.JobPost.countDocuments({ companyId: companyA._id }));

    const published = await call(modA, "/jobs?status=published&limit=100");
    assert.ok(published.jobs.length >= 1);
    assert.ok(published.jobs.every((j) => j.status === "published"));
    assert.equal(published.pagination.total, all.counts.published);
    assert.equal((await call(modA, "/jobs?status=foo")).status, 400);
  });

  it("Company Mod công ty khác không xem, sửa, đổi trạng thái được (404)", async () => {
    const job = await createJob();
    assert.equal((await call(modB, `/jobs/${job.id}`)).status, 404);
    assert.equal((await call(modB, `/jobs/${job.id}`, "PATCH", { title: "Chiếm quyền" })).status, 404);
    assert.equal((await call(modB, `/jobs/${job.id}/status`, "PATCH", { status: "published" })).status, 404);
    const row = await models.JobPost.findById(job.id).lean();
    assert.equal(row.title, baseJob().title);
    assert.equal(row.status, "draft");
    assert.equal((await call(modA, "/jobs/khong-phai-id")).status, 400);
  });

  it("chưa đăng nhập 401; ứng viên 403; công ty bị khóa 403", async () => {
    assert.equal((await call(null, "/jobs")).status, 401);
    assert.equal((await call(candidate, "/jobs")).status, 403);
    assert.equal((await call(candidate, "/jobs", "POST", baseJob())).status, 403);

    const suspended = await models.Company.create({ name: "Công ty C", slug: "jb01-company-c", status: "suspended" });
    const modC = await models.User.create({ name: "HR C", email: "jb01-mod-c@test.local", role: "company_moderator", companyId: suspended._id });
    assert.equal((await call(modC, "/jobs", "POST", baseJob())).status, 403);
  });
});

/**
 * JB-04 (PM-05, C-10, PM-03): báo cáo tin tuyển dụng, Platform Moderator ẩn / bỏ ẩn tin.
 * Xong khi: job bị ẩn biến mất khỏi danh sách công khai; `/moderator/queue` không hiện báo cáo job;
 * test map đúng loại (report `job_post` → item `job_post_report`, không thành `evaluation_report`).
 */
import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";

const DAY = 86_400_000;
let harness, http, models, queueService, company, otherCompany, companyMod, otherMod, moderator, admin, seq = 0, userSeq = 0;

async function call(user, url, method = "GET", body) {
  const res = await fetch(`${http.baseUrl}${url}`, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${mintAccessToken(user._id)}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, ...(await res.json()) };
}

function job(overrides = {}) {
  seq += 1;
  return models.JobPost.create({
    companyId: company._id,
    title: `Kỹ sư Backend JB04 ${seq}`,
    roleCategory: "backend",
    level: "middle",
    description: "Mô tả công việc đủ dài cho tin tuyển dụng dùng trong test JB-04.",
    status: "published",
    publishedAt: new Date(Date.now() - seq * 1000),
    ...overrides,
  });
}

async function candidate() {
  userSeq += 1;
  return models.User.create({ name: `Ứng viên JB04 ${userSeq}`, email: `jb04-candidate-${userSeq}@test.local`, role: "customer" });
}

const report = (user, jobDoc, extra = {}) =>
  call(user, "/api/reports", "POST", { targetType: "job_post", targetId: String(jobDoc._id), reason: "misleading", description: "Mức lương ghi trong tin không đúng với thực tế phỏng vấn.", ...extra });

const publicIds = async () => (await call(null, "/api/jobs?limit=50")).jobs.map((j) => j.id);
const itemOf = (moderationItemId) => models.ModerationItem.findById(moderationItemId).lean();

before(async () => {
  harness = await startMongoHarness();
  models = await import("../models/index.js");
  queueService = await import("../services/moderationQueueService.js");
  await Promise.all(Object.values(models).filter((m) => m?.modelName).map((m) => m.init()));
  company = await models.Company.create({ name: "Công ty Gamma", slug: "jb04-gamma" });
  otherCompany = await models.Company.create({ name: "Công ty Delta", slug: "jb04-delta" });
  companyMod = await models.User.create({ name: "HR Gamma", email: "jb04-hr@test.local", role: "company_moderator", companyId: company._id });
  otherMod = await models.User.create({ name: "HR Delta", email: "jb04-hr-delta@test.local", role: "company_moderator", companyId: otherCompany._id });
  moderator = await models.User.create({ name: "Platform Mod", email: "jb04-mod@test.local", role: "moderator" });
  admin = await models.User.create({ name: "Admin JB04", email: "jb04-admin@test.local", role: "admin" });
  http = await startHttpServer((await import("../app.js")).createApp());
});

after(async () => {
  if (http) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

describe("Báo cáo tin tuyển dụng (JB-04)", () => {
  it("tạo Report job_post và ModerationItem job_post_report (map đúng loại), lừa đảo ưu tiên cao", async () => {
    const j = await job();
    const user = await candidate();
    const res = await report(user, j, { reason: "fraud" });
    assert.equal(res.status, 201, res.error);
    assert.ok(res.moderationItemId);

    const rep = await models.Report.findById(res.reportId).lean();
    assert.equal(rep.targetType, "job_post");
    assert.equal(String(rep.targetId), String(j._id));
    const item = await itemOf(res.moderationItemId);
    assert.equal(item.type, "job_post_report");
    assert.notEqual(item.type, "evaluation_report");
    assert.equal(item.priority, "high");
    assert.equal(String(item.refs.jobPostId), String(j._id));
    assert.equal(String(item.refs.companyId), String(company._id));
    assert.equal(String(item.refs.reportId), res.reportId);
    assert.equal(item.snapshot.jobTitle, j.title);
    assert.equal(item.snapshot.companyName, "Công ty Gamma");
  });

  it("chặn: chưa đăng nhập, lý do sai, mô tả ngắn, tin không đang đăng, công ty tự báo cáo, báo trùng khi đang chờ", async () => {
    const j = await job();
    const user = await candidate();
    assert.equal((await report(null, j)).status, 401);
    assert.equal((await report(user, j, { reason: "late" })).status, 400);
    assert.equal((await report(user, j, { description: "ngắn" })).status, 400);
    assert.equal((await report(user, j, { targetId: "abc" })).status, 400);
    for (const status of ["draft", "closed", "hidden"]) {
      const other = await job({ status });
      assert.equal((await report(user, other)).status, 404, status);
    }
    assert.equal((await report(companyMod, j)).status, 400, "Company Mod không tự báo cáo tin công ty mình");
    assert.equal((await report(otherMod, j)).status, 201, "Company Mod công ty khác báo cáo được");
    assert.equal((await report(user, j)).status, 201);
    assert.equal((await report(user, j)).status, 409);
  });

  it("createItemForReport chỉ nhận report AI — report job_post không bị đổi thành evaluation_report", async () => {
    await assert.rejects(
      queueService.createItemForReport({ report: { targetType: "job_post", _id: "x" }, session: { questions: [] } }),
      /chỉ nhận report AI/,
    );
  });

  it("/moderator/queue mặc định không có báo cáo job; lọc type=job_post_report thì có; KPI hàng đợi HITL không đếm", async () => {
    const j = await job();
    const res = await report(await candidate(), j);
    const evalItem = await models.ModerationItem.create({ type: "evaluation_report", refs: {}, snapshot: {} });

    const def = await call(moderator, "/api/moderator/queue?limit=100");
    assert.equal(def.status, 200, def.error);
    const ids = def.items.map((i) => String(i._id));
    assert.ok(ids.includes(String(evalItem._id)), "hàng đợi phỏng vấn vẫn có item phỏng vấn");
    assert.ok(!ids.includes(res.moderationItemId));
    assert.ok(def.items.every((i) => i.type !== "job_post_report"));

    const jobs = await call(moderator, "/api/moderator/queue?type=job_post_report&limit=100");
    assert.ok(jobs.items.some((i) => String(i._id) === res.moderationItemId));
    assert.ok(jobs.items.every((i) => i.type === "job_post_report"));

    const stats = await call(moderator, "/api/moderator/quality/stats");
    assert.equal(stats.status, 200, stats.error);
    const openHitl = await models.ModerationItem.countDocuments({ status: "open", type: { $ne: "job_post_report" } });
    assert.equal(stats.stats.queue.open, openHitl);
  });

  it("trang support admin và số 'báo cáo mở' không gồm báo cáo job", async () => {
    const j = await job();
    const res = await report(await candidate(), j);
    const list = await call(admin, "/api/admin/reports?limit=100");
    assert.equal(list.status, 200, list.error);
    const rows = list.reports || list.items || list.data || [];
    assert.ok(!rows.some((r) => String(r._id || r.id) === res.reportId));
    const stats = await call(admin, "/api/admin/stats");
    const open = await models.Report.countDocuments({ status: { $in: ["pending", "reviewing"] }, targetType: { $nin: ["interview_question", "interview_evaluation", "job_post"] } });
    assert.equal(stats.stats.reportsOpen, open);
    assert.equal((await call(admin, `/api/admin/reports/${res.reportId}`, "PATCH", { status: "resolved" })).status, 404, "admin không xử lý báo cáo job");
  });
});

describe("Platform Moderator xử lý báo cáo job (JB-04)", () => {
  it("hide_job: tin bị ẩn và biến mất khỏi API công khai; mọi báo cáo đang mở của tin được đóng; báo cho người báo và công ty", async () => {
    const j = await job();
    const [u1, u2] = [await candidate(), await candidate()];
    const r1 = await report(u1, j);
    const r2 = await report(u2, j, { reason: "discriminatory" });
    assert.ok((await publicIds()).includes(String(j._id)));

    assert.equal((await call(moderator, `/api/moderator/queue/${r1.moderationItemId}/resolve`, "PATCH", { action: "hide_job", note: "ngắn" })).status, 400, "lý do ẩn ≥ 5 ký tự");
    const res = await call(moderator, `/api/moderator/queue/${r1.moderationItemId}/resolve`, "PATCH", { action: "hide_job", note: "Tin đăng mức lương sai sự thật" });
    assert.equal(res.status, 200, res.error);

    const hidden = await models.JobPost.findById(j._id).lean();
    assert.equal(hidden.status, "hidden");
    assert.equal(hidden.hiddenReason, "Tin đăng mức lương sai sự thật");
    assert.equal(String(hidden.hiddenBy), String(moderator._id));
    assert.ok(!(await publicIds()).includes(String(j._id)), "biến mất khỏi danh sách công khai");
    assert.equal((await call(null, `/api/jobs/${j._id}`)).status, 404);

    for (const r of [r1, r2]) {
      const item = await itemOf(r.moderationItemId);
      assert.equal(item.status, "resolved");
      assert.equal(item.resolution.action, "hide_job");
      assert.equal((await models.Report.findById(r.reportId).lean()).status, "resolved");
    }
    for (const u of [u1, u2]) {
      assert.ok(await models.Notification.exists({ userId: u._id, title: "Báo cáo tin tuyển dụng đã được xử lý" }), "người báo cáo nhận thông báo");
    }
    const notif = await models.Notification.findOne({ userId: companyMod._id, type: "job_post_hidden", "metadata.jobPostId": j._id }).lean();
    assert.ok(notif, "Company Mod nhận thông báo job_post_hidden");
    assert.match(notif.body, /mức lương sai sự thật/);
    assert.equal(await models.Notification.countDocuments({ userId: otherMod._id, type: "job_post_hidden" }), 0, "công ty khác không nhận");

    const companyView = await call(companyMod, `/api/company/jobs/${j._id}`);
    assert.equal(companyView.status, 200, companyView.error);
    assert.equal(companyView.job.status, "hidden");
    assert.equal(companyView.job.hiddenReason, "Tin đăng mức lương sai sự thật");
  });

  it("dismiss: giữ nguyên tin, báo cáo bị bác bỏ; hành động sai loại bị chặn", async () => {
    const j = await job();
    const r = await report(await candidate(), j);
    assert.equal((await call(moderator, `/api/moderator/queue/${r.moderationItemId}/resolve`, "PATCH", { action: "override_score", payload: { scores: { clarity: 3, structure: 3, relevance: 3, credibility: 3 }, shrmLevel: "proficient" } })).status, 400);
    const evalItem = await models.ModerationItem.create({ type: "evaluation_report", refs: {}, snapshot: {} });
    assert.equal((await call(moderator, `/api/moderator/queue/${evalItem._id}/resolve`, "PATCH", { action: "hide_job", note: "Không áp dụng cho item phỏng vấn" })).status, 400);

    const res = await call(moderator, `/api/moderator/queue/${r.moderationItemId}/resolve`, "PATCH", { action: "dismiss", note: "Thông tin trong tin hợp lệ" });
    assert.equal(res.status, 200, res.error);
    assert.equal((await models.JobPost.findById(j._id).lean()).status, "published");
    assert.equal((await itemOf(r.moderationItemId)).status, "dismissed");
    assert.equal((await models.Report.findById(r.reportId).lean()).status, "dismissed");
    assert.equal((await call(moderator, `/api/moderator/queue/${r.moderationItemId}/resolve`, "PATCH", { action: "dismiss" })).status, 409);
  });

  it("báo cáo thứ hai sau khi tin đã bị ẩn bằng API trực tiếp vẫn đóng được bằng hide_job", async () => {
    const j = await job();
    const r = await report(await candidate(), j);
    // Ẩn trực tiếp đóng luôn báo cáo đang mở; tạo thêm một item mở giả lập báo cáo lọt sau.
    const late = await models.ModerationItem.create({ type: "job_post_report", refs: { jobPostId: j._id, companyId: company._id }, snapshot: { jobTitle: j.title } });
    assert.equal((await call(moderator, `/api/moderator/jobs/${j._id}/visibility`, "PATCH", { hidden: true, reason: "Nội dung phân biệt đối xử" })).status, 200);
    assert.equal((await itemOf(r.moderationItemId)).status, "resolved");
    // `late` cũng bị đóng cùng lúc vì cùng tin; tạo item mới sau khi ẩn để thử nhánh "đã bị ẩn".
    assert.equal((await itemOf(late._id)).status, "resolved");
    const after = await models.ModerationItem.create({ type: "job_post_report", refs: { jobPostId: j._id, companyId: company._id }, snapshot: {} });
    const res = await call(moderator, `/api/moderator/queue/${after._id}/resolve`, "PATCH", { action: "hide_job", note: "Đã ẩn từ trước" });
    assert.equal(res.status, 200, res.error);
    assert.equal((await itemOf(after._id)).status, "resolved");
  });
});

describe("PATCH /api/moderator/jobs/:id/visibility (JB-04)", () => {
  it("chỉ Platform Moderator; ẩn cần lý do; ẩn hai lần 409; bỏ ẩn hiện lại trên API công khai", async () => {
    const j = await job();
    const url = `/api/moderator/jobs/${j._id}/visibility`;
    assert.equal((await call(companyMod, url, "PATCH", { hidden: true, reason: "Không đủ quyền" })).status, 403);
    assert.equal((await call(await candidate(), url, "PATCH", { hidden: true, reason: "Không đủ quyền" })).status, 403);
    assert.equal((await call(moderator, url, "PATCH", { hidden: true })).status, 400);
    assert.equal((await call(moderator, url, "PATCH", { hidden: false })).status, 409, "tin đang hiển thị");

    const hide = await call(moderator, url, "PATCH", { hidden: true, reason: "Nghi ngờ tuyển dụng lừa đảo" });
    assert.equal(hide.status, 200, hide.error);
    assert.equal(hide.job.status, "hidden");
    assert.equal((await call(moderator, url, "PATCH", { hidden: true, reason: "Ẩn lần hai" })).status, 409);
    assert.ok(!(await publicIds()).includes(String(j._id)));

    // Company Mod không sửa tin đang bị ẩn, vẫn đóng được.
    assert.equal((await call(companyMod, `/api/company/jobs/${j._id}`, "PATCH", { title: "Sửa khi đang ẩn" })).status, 409);

    const show = await call(moderator, url, "PATCH", { hidden: false });
    assert.equal(show.status, 200, show.error);
    const shown = await models.JobPost.findById(j._id).lean();
    assert.equal(shown.status, "published");
    assert.equal(shown.hiddenAt, null);
    assert.equal(shown.hiddenReason, "");
    assert.ok((await publicIds()).includes(String(j._id)));
    assert.ok(await models.Notification.exists({ userId: companyMod._id, title: "Tin tuyển dụng hiển thị lại", "metadata.jobPostId": j._id }));
  });

  it("không ẩn được bản nháp / tin đã đóng; không bỏ ẩn tin đã quá hạn; id sai 400, không có 404", async () => {
    for (const status of ["draft", "closed"]) {
      const d = await job({ status });
      assert.equal((await call(moderator, `/api/moderator/jobs/${d._id}/visibility`, "PATCH", { hidden: true, reason: "Không áp dụng" })).status, 409, status);
    }
    const expired = await job({ status: "hidden", closesAt: new Date(Date.now() - DAY), hiddenAt: new Date() });
    const res = await call(moderator, `/api/moderator/jobs/${expired._id}/visibility`, "PATCH", { hidden: false });
    assert.equal(res.status, 409);
    assert.match(res.error, /quá hạn/);
    assert.equal((await call(moderator, "/api/moderator/jobs/abc/visibility", "PATCH", { hidden: false })).status, 400);
    assert.equal((await call(moderator, "/api/moderator/jobs/507f1f77bcf86cd799439011/visibility", "PATCH", { hidden: false })).status, 404);
  });

  it("hai moderator ẩn cùng lúc: chỉ một thao tác thành công", async () => {
    const j = await job();
    const url = `/api/moderator/jobs/${j._id}/visibility`;
    const results = await Promise.all([1, 2].map((n) => call(moderator, url, "PATCH", { hidden: true, reason: `Ẩn đồng thời ${n}` })));
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  });
});

describe("GET /api/moderator/jobs (JB-04, cho màn JB-17)", () => {
  it("lọc tin có báo cáo đang mở, kèm số báo cáo, tin nhiều báo cáo lên trước; lọc theo trạng thái", async () => {
    const many = await job({ title: "Tin nhiều báo cáo JB04" });
    const one = await job({ title: "Tin một báo cáo JB04" });
    for (const target of [many, many, one]) {
      const r = await report(await candidate(), target);
      assert.equal(r.status, 201, JSON.stringify(r));
    }

    const res = await call(moderator, "/api/moderator/jobs?reported=true&limit=100");
    assert.equal(res.status, 200, res.error);
    const pos = (doc) => res.jobs.findIndex((x) => x.id === String(doc._id));
    assert.ok(pos(many) >= 0 && pos(one) >= 0);
    assert.ok(pos(many) < pos(one));
    assert.equal(res.jobs[pos(many)].openReports, 2);
    assert.equal(res.jobs[pos(many)].companyName, "Công ty Gamma");
    assert.ok(res.jobs.every((x) => x.openReports > 0));

    const hiddenOnly = await call(moderator, "/api/moderator/jobs?status=hidden&limit=100");
    assert.ok(hiddenOnly.jobs.every((x) => x.status === "hidden"));
    assert.equal((await call(moderator, "/api/moderator/jobs?status=draft")).status, 400);
    assert.equal((await call(companyMod, "/api/moderator/jobs")).status, 403);
  });
});

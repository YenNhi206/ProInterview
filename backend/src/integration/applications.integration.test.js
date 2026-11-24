/**
 * JB-10 (NFR-06): test integration luồng ứng tuyển JB-08 (C-05) và Company Moderator xử lý đơn JB-09 (CM-04).
 * Xong khi (JB-10): consent, rút đơn, truy cập chéo công ty, job bị ẩn — một file test riêng chạy xanh.
 * Kèm "Xong khi" của JB-08 (không consent → 400; mỗi job mỗi người 1 đơn) và JB-09 (chỉ đọc qua đơn có
 * consent và chưa rút; đổi trạng thái gửi Notification).
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer,
} from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";

let harness, http, models;
let companyA, companyB, modA, modB, jobA, cvA;
let seq = 0;

const ANSWER = "Em gom log hai tuần, tìm ra nguyên nhân và thêm khóa idempotency cho mỗi đơn thanh toán.";

async function call(user, path, method = "GET", body) {
  const res = await fetch(`${http.baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${mintAccessToken(user._id)}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, body: await res.json() };
}

const apply = (user, jobId, body) => call(user, `/api/jobs/${jobId}/apply`, "POST", body);
const companyList = (mod, qs = "") => call(mod, `/api/company/applications${qs}`);
const companyGet = (mod, id) => call(mod, `/api/company/applications/${id}`);
const companySet = (mod, id, body) => call(mod, `/api/company/applications/${id}/status`, "PATCH", body);
const withdraw = (user, id) => call(user, `/api/applications/${id}/withdraw`, "PATCH");
const notifs = (userId, type) => models.Notification.find({ userId, type }).lean();

async function newCandidate({ withSession = false } = {}) {
  seq += 1;
  const user = await models.User.create({ name: `Ứng viên ${seq}`, email: `jb08-${seq}@test.local`, role: "customer" });
  const cv = await models.CVDocument.create({ userId: user._id, title: `CV ${seq}`, fileUrl: `https://cdn.test/cv-${seq}.pdf`, skills: ["Node.js"], isDefault: true });
  if (withSession) {
    // Buổi phỏng vấn AI có 1 câu của công ty A đã chấm rubric (JB-07) → chỉ số JB-19 vào snapshot.
    const qid = new mongoose.Types.ObjectId();
    await models.InterviewSession.create({
      userId: user._id, hrGender: "male", status: "completed", completedAt: new Date("2026-11-22T03:00:00Z"),
      questions: [{ id: "b1", question: "Giới thiệu", source: "baseline" }, { id: "company1", question: "Câu A", source: "company", questionBankId: qid }],
      companyQuestions: [{ questionId: qid, companyId: companyA._id, rubricId: new mongoose.Types.ObjectId() }],
      answers: [{
        questionIndex: 1, transcript: ANSWER,
        rubricScores: [{ criterionKey: "c1", criterionName: "Phân tích", shrmKey: "problem_solving", weight: 100, score: 4 }],
        rubricScoring: { status: "scored", companyId: companyA._id, scoredAt: new Date() },
      }],
    });
  }
  return { user, cv };
}

async function newJob(company, overrides = {}) {
  seq += 1;
  return models.JobPost.create({
    companyId: company._id, title: `Backend Developer ${seq}`, roleCategory: "backend", level: "junior",
    status: "published", publishedAt: new Date(), ...overrides,
  });
}

before(async () => {
  harness = await startMongoHarness();
  models = {
    User: (await import("../models/User.js")).User,
    Company: (await import("../models/Company.js")).Company,
    JobPost: (await import("../models/JobPost.js")).JobPost,
    CVDocument: (await import("../models/CVDocument.js")).CVDocument,
    InterviewSession: (await import("../models/InterviewSession.js")).InterviewSession,
    Application: (await import("../models/Application.js")).Application,
    Notification: (await import("../models/Notification.js")).Notification,
  };
  await models.Application.init();
  http = await startHttpServer((await import("../app.js")).createApp());

  companyA = await models.Company.create({ name: "Công ty A", slug: "jb08-cong-ty-a" });
  companyB = await models.Company.create({ name: "Công ty B", slug: "jb08-cong-ty-b" });
  modA = await models.User.create({ name: "HR A", email: "jb08-hr-a@test.local", role: "company_moderator", companyId: companyA._id });
  modB = await models.User.create({ name: "HR B", email: "jb08-hr-b@test.local", role: "company_moderator", companyId: companyB._id });
  jobA = await newJob(companyA);
});

after(async () => {
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

describe("JB-08 ứng tuyển: consent và mỗi job mỗi người 1 đơn", () => {
  it("không đồng ý (thiếu, false, chuỗi \"true\") → 400; thiếu CV → 400; CV người khác → 404; không tạo đơn", async () => {
    const { user, cv } = await newCandidate();
    const other = await newCandidate();
    for (const consent of [undefined, false, "true", 1]) {
      const res = await apply(user, jobA._id, { cvId: String(cv._id), consent });
      assert.equal(res.status, 400, `consent=${consent}`);
      assert.match(res.body.error, /đồng ý chia sẻ/);
    }
    assert.equal((await apply(user, jobA._id, { consent: true })).status, 400);
    assert.equal((await apply(user, jobA._id, { cvId: String(other.cv._id), consent: true })).status, 404);
    assert.equal(await models.Application.countDocuments({ candidateId: user._id }), 0);
  });

  it("nộp thành công: snapshot hồ sơ + CV + chỉ số JB-19, consent lưu thời điểm và phạm vi; Company Mod nhận thông báo", async () => {
    const { user, cv } = await newCandidate({ withSession: true });
    const res = await apply(user, jobA._id, { cvId: String(cv._id), consent: true });
    assert.equal(res.status, 201, res.body.error);
    assert.equal(res.body.application.status, "submitted");
    assert.equal(res.body.application.canWithdraw, true);
    assert.equal(res.body.application.job.company.name, "Công ty A");

    const app = await models.Application.findById(res.body.application.id).lean();
    assert.equal(app.consent.given, true);
    assert.ok(app.consent.at);
    assert.deepEqual(app.consent.scope, ["profile", "cv", "company_metrics"]);
    assert.equal(app.snapshot.candidate.name, user.name);
    assert.equal(app.snapshot.cv.id, String(cv._id));
    assert.equal(app.snapshot.cv.fileUrl, cv.fileUrl);
    assert.ok(Array.isArray(app.snapshot.profile.competencies));
    assert.equal(app.snapshot.companyMetrics.companyId, String(companyA._id));
    assert.equal(app.snapshot.companyMetrics.answeredCount, 1);
    assert.equal(app.snapshot.companyMetrics.rubricScoreAvg, 4);
    assert.deepEqual(app.snapshot.companyMetrics.criteria.map((c) => [c.criterionKey, c.avgScore]), [["c1", 4]]);
    // JB-16 (CM-04): câu trả lời kèm điểm rubric từng tiêu chí.
    const [ans] = app.snapshot.companyMetrics.answers;
    assert.equal(app.snapshot.companyMetrics.answers.length, 1);
    assert.equal(ans.question, "Câu A");
    assert.equal(ans.transcript, ANSWER);
    assert.equal(ans.scoringStatus, "scored");
    assert.equal(ans.rubricScore, 4);
    assert.deepEqual(ans.scores.map((x) => [x.criterionKey, x.criterionName, x.score]), [["c1", "Phân tích", 4]]);

    const n = await notifs(modA._id, "application_submitted");
    assert.ok(n.some((x) => String(x.metadata.applicationId) === String(app._id)));
    assert.equal((await notifs(modB._id, "application_submitted")).length, 0, "công ty khác không nhận");
  });

  it("nộp lần 2 → 409; bấm nộp 2 lần cùng lúc chỉ tạo 1 đơn", async () => {
    const { user, cv } = await newCandidate();
    const body = { cvId: String(cv._id), consent: true };
    assert.equal((await apply(user, jobA._id, body)).status, 201);
    assert.equal((await apply(user, jobA._id, body)).status, 409);

    const second = await newCandidate();
    const job = await newJob(companyA);
    const results = await Promise.all([1, 2, 3].map(() => apply(second.user, job._id, { cvId: String(second.cv._id), consent: true })));
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409]);
    assert.equal(await models.Application.countDocuments({ candidateId: second.user._id, jobPostId: job._id }), 1);
  });

  it("CV bị đánh dấu không hợp lệ → 400; Company Moderator / chưa đăng nhập không nộp được", async () => {
    const { user, cv } = await newCandidate();
    await models.CVDocument.updateOne({ _id: cv._id }, { $set: { isValidCv: false } });
    assert.equal((await apply(user, jobA._id, { cvId: String(cv._id), consent: true })).status, 400);
    assert.equal((await apply(modA, jobA._id, { cvId: String(cv._id), consent: true })).status, 403);
    assert.equal((await apply(null, jobA._id, { cvId: String(cv._id), consent: true })).status, 401);
  });

  it("GET /api/applications/me: chỉ đơn của mình, có job và công ty", async () => {
    const { user, cv } = await newCandidate();
    const job2 = await newJob(companyB);
    await apply(user, jobA._id, { cvId: String(cv._id), consent: true });
    await apply(user, job2._id, { cvId: String(cv._id), consent: true });
    const res = await call(user, "/api/applications/me");
    assert.equal(res.status, 200);
    assert.equal(res.body.applications.length, 2);
    assert.deepEqual(res.body.applications.map((a) => a.job.company.name).sort(), ["Công ty A", "Công ty B"]);
    assert.ok(res.body.applications.every((a) => a.cv.title === cv.title));
    assert.equal((await call(modA, "/api/applications/me")).status, 403);
  });
});

describe("JB-10 job bị ẩn / không mở", () => {
  it("không nộp được vào job hidden, closed, draft, quá hạn, công ty bị khóa, id sai", async () => {
    const { user, cv } = await newCandidate();
    const body = { cvId: String(cv._id), consent: true };
    const hidden = await newJob(companyA, { status: "hidden", hiddenAt: new Date(), hiddenReason: "Vi phạm" });
    const closed = await newJob(companyA, { status: "closed", closedAt: new Date(), closedReason: "company" });
    const draft = await newJob(companyA, { status: "draft", publishedAt: null });
    const expired = await newJob(companyA, { closesAt: new Date(Date.now() - 60_000) });
    const suspendedCo = await models.Company.create({ name: "Bị khóa", slug: "jb08-bi-khoa", status: "suspended" });
    const ofSuspended = await newJob(suspendedCo);
    for (const job of [hidden, closed, draft, expired, ofSuspended]) {
      assert.equal((await apply(user, job._id, body)).status, 404, job.title);
    }
    assert.equal((await apply(user, "khong-hop-le", body)).status, 400);
    assert.equal(await models.Application.countDocuments({ candidateId: user._id }), 0);
  });

  it("job bị ẩn sau khi đã nộp: công ty vẫn xử lý đơn đã có, ứng viên vẫn rút được", async () => {
    const job = await newJob(companyA);
    const a = await newCandidate();
    const b = await newCandidate();
    const appA = (await apply(a.user, job._id, { cvId: String(a.cv._id), consent: true })).body.application;
    const appB = (await apply(b.user, job._id, { cvId: String(b.cv._id), consent: true })).body.application;
    await models.JobPost.updateOne({ _id: job._id }, { $set: { status: "hidden", hiddenAt: new Date() } });

    assert.equal((await companySet(modA, appA.id, { status: "shortlisted" })).status, 200);
    assert.equal((await withdraw(b.user, appB.id)).status, 200);
    const mine = (await call(a.user, "/api/applications/me")).body.applications[0];
    assert.equal(mine.job.status, "hidden");
    assert.equal(mine.status, "shortlisted");
  });
});

describe("JB-09 / JB-10 Company Moderator xem đơn, truy cập chéo công ty", () => {
  it("công ty A thấy đơn của job A kèm counts; công ty B không thấy, GET / PATCH đơn của A → 404", async () => {
    const job = await newJob(companyA);
    const { user, cv } = await newCandidate({ withSession: true });
    const appId = (await apply(user, job._id, { cvId: String(cv._id), consent: true })).body.application.id;

    const listA = await companyList(modA, `?jobPostId=${job._id}`);
    assert.equal(listA.status, 200);
    assert.equal(listA.body.applications.length, 1);
    const row = listA.body.applications[0];
    assert.equal(row.candidate.name, user.name);
    assert.equal(row.cv.title, cv.title);
    assert.equal(row.companyMetrics.answeredCount, 1);
    assert.equal(listA.body.counts.submitted, 1);
    assert.equal(row.snapshot, undefined, "danh sách không trả snapshot đầy đủ");

    const listB = await companyList(modB);
    assert.ok(!listB.body.applications.some((x) => x.id === appId));
    assert.equal((await companyList(modB, `?jobPostId=${job._id}`)).body.applications.length, 0);
    assert.equal((await companyGet(modB, appId)).status, 404);
    assert.equal((await companySet(modB, appId, { status: "rejected" })).status, 404);
    assert.equal((await models.Application.findById(appId).lean()).status, "submitted", "B không đổi được đơn của A");

    // Ứng viên và người ngoài không gọi được API công ty.
    assert.equal((await companyList(user)).status, 403);
    assert.equal((await companyGet(null, appId)).status, 401);
  });

  it("mở chi tiết đơn submitted → viewed, ứng viên nhận thông báo; chi tiết có snapshot và lịch sử", async () => {
    const job = await newJob(companyA);
    const { user, cv } = await newCandidate();
    const appId = (await apply(user, job._id, { cvId: String(cv._id), consent: true })).body.application.id;

    const res = await companyGet(modA, appId);
    assert.equal(res.status, 200);
    assert.equal(res.body.application.status, "viewed");
    assert.equal(res.body.application.snapshot.cv.id, String(cv._id));
    assert.deepEqual(res.body.application.history.map((h) => h.status), ["submitted", "viewed"]);
    assert.ok(res.body.application.consent.at);
    assert.equal((await notifs(user._id, "application_status_changed")).length, 1);

    // Mở lại không đổi trạng thái, không báo thêm.
    await companyGet(modA, appId);
    assert.equal((await notifs(user._id, "application_status_changed")).length, 1);
  });

  it("shortlist / từ chối: gửi thông báo, ghi decidedAt; trạng thái cuối không đổi được; trạng thái lạ → 400", async () => {
    const job = await newJob(companyA);
    const a = await newCandidate();
    const b = await newCandidate();
    const appA = (await apply(a.user, job._id, { cvId: String(a.cv._id), consent: true })).body.application.id;
    const appB = (await apply(b.user, job._id, { cvId: String(b.cv._id), consent: true })).body.application.id;

    const sl = await companySet(modA, appA, { status: "shortlisted" });
    assert.equal(sl.status, 200);
    assert.equal(sl.body.application.status, "shortlisted");
    const savedA = await models.Application.findById(appA).lean();
    assert.ok(savedA.decidedAt && savedA.viewedAt, "shortlist thẳng từ submitted vẫn ghi mốc đã xem");
    const na = await notifs(a.user._id, "application_status_changed");
    assert.equal(na.length, 1);
    assert.match(na[0].title, /vòng tiếp theo/);

    const rj = await companySet(modA, appB, { status: "rejected", note: "Chưa đủ kinh nghiệm" });
    assert.equal(rj.body.application.status, "rejected");
    assert.match((await notifs(b.user._id, "application_status_changed"))[0].body, /Chưa đủ kinh nghiệm/);

    assert.equal((await companySet(modA, appA, { status: "rejected" })).status, 409);
    assert.equal((await companySet(modA, appB, { status: "shortlisted" })).status, 409);
    assert.equal((await companySet(modA, appA, { status: "withdrawn" })).status, 400);
    assert.equal((await companySet(modA, appA, { status: "submitted" })).status, 400);
    assert.equal((await withdraw(a.user, appA)).status, 409, "đã shortlist thì không rút");
  });
});

describe("JB-10 rút đơn: công ty chỉ còn thấy tên và \"Đã rút\"", () => {
  it("rút đơn xóa snapshot; danh sách và chi tiết phía công ty chỉ có tên; công ty nhận thông báo", async () => {
    const job = await newJob(companyA);
    const { user, cv } = await newCandidate({ withSession: true });
    const appId = (await apply(user, job._id, { cvId: String(cv._id), consent: true })).body.application.id;
    await companyGet(modA, appId); // viewed vẫn rút được

    const res = await withdraw(user, appId);
    assert.equal(res.status, 200);
    assert.equal(res.body.application.status, "withdrawn");
    assert.equal(res.body.application.canWithdraw, false);

    const saved = await models.Application.findById(appId).lean();
    assert.equal(saved.snapshot, null, "snapshot bị xóa khỏi DB");
    assert.equal(saved.candidateName, user.name);

    const detail = (await companyGet(modA, appId)).body.application;
    assert.deepEqual(Object.keys(detail).sort(), ["candidateName", "id", "jobPostId", "jobTitle", "status", "statusLabel", "submittedAt", "withdrawnAt"]);
    assert.equal(detail.status, "withdrawn");
    assert.equal(detail.candidateName, user.name);
    const row = (await companyList(modA, `?jobPostId=${job._id}`)).body.applications[0];
    assert.equal(row.candidate, undefined);
    assert.equal(row.cv, undefined);
    assert.equal(row.companyMetrics, undefined);
    assert.ok(!JSON.stringify(row).includes(user.email), "không lộ email sau khi rút");

    const n = await notifs(modA._id, "application_status_changed");
    assert.ok(n.some((x) => String(x.metadata.applicationId) === appId && /rút đơn/.test(x.title)));
  });

  it("rút lần 2 → 409; công ty đổi trạng thái đơn đã rút → 409; người khác rút → 404; không nộp lại được", async () => {
    const job = await newJob(companyA);
    const { user, cv } = await newCandidate();
    const other = await newCandidate();
    const appId = (await apply(user, job._id, { cvId: String(cv._id), consent: true })).body.application.id;
    assert.equal((await withdraw(other.user, appId)).status, 404);
    assert.equal((await withdraw(user, appId)).status, 200);
    assert.equal((await withdraw(user, appId)).status, 409);
    assert.equal((await companySet(modA, appId, { status: "shortlisted" })).status, 409);
    assert.equal((await apply(user, job._id, { cvId: String(cv._id), consent: true })).status, 409);
    assert.equal((await withdraw(user, "khong-hop-le")).status, 400);
  });

  it("đơn không có đồng ý (dữ liệu lỗi) không hiện với công ty", async () => {
    const job = await newJob(companyA);
    const { user, cv } = await newCandidate();
    const raw = await models.Application.create({
      jobPostId: job._id, companyId: companyA._id, candidateId: user._id, cvId: cv._id, candidateName: user.name,
      consent: { given: false, at: new Date() }, snapshot: { candidate: { name: user.name, email: user.email } },
      status: "submitted", submittedAt: new Date(),
    });
    assert.equal((await companyGet(modA, raw._id)).status, 404);
    assert.ok(!(await companyList(modA, `?jobPostId=${job._id}`)).body.applications.some((x) => x.id === String(raw._id)));
  });
});

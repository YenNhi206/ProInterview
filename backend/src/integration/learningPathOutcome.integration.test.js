/**
 * LP-13: mentor ghi kết quả buổi lộ trình — `PATCH /api/learning-paths/:id/sessions/:sid/outcome`
 * và đề xuất buổi bổ sung có phí — `POST /api/learning-paths/:id/sessions/:sid/supplementary`.
 * Xong khi: đủ nhánh đạt, không đạt lần 1, lần 2 có test.
 */
import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";

let harness, http, models, mrService, mentee, mentor, otherMentor, seq = 0;

const files = { cv: [{ originalname: "cv.pdf", buffer: Buffer.from("cv") }], jd: [{ originalname: "jd.txt", buffer: Buffer.from("jd") }] };
const requestFields = { position: "Data Analyst", description: "Muốn có lộ trình luyện phỏng vấn Data Analyst trong 1 tháng.", sessionType: "mock_interview" };
const offerBody = { message: "Tôi sẽ đánh giá năng lực SQL, phân tích và đề xuất lộ trình phù hợp.", availability: "Tối thứ 4" };
const SESSIONS = [
  { title: "SQL và phân tích dữ liệu", objectives: ["Viết truy vấn JOIN"], shrmKeys: ["technical_learning", "communication"] },
  { title: "Trình bày insight", objectives: [], shrmKeys: ["communication"] },
  { title: "Phỏng vấn thử tổng hợp", objectives: [], shrmKeys: [] },
];
const TOTAL = 1_000_000;

const pad = (n) => String(n).padStart(2, "0");
/** Khung giờ tương lai, mỗi lần gọi khác nhau và cách nhau 2 giờ (không chồng giờ với buổi trước của mentee). */
function slot(daysFromNow = 3) {
  seq += 1;
  const d = new Date(Date.now() + 86400000 + daysFromNow * 60_000 + seq * 2 * 3_600_000);
  return { date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, timeSlot: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}
const actor = (user) => mrService.requestActor(String(user._id));

async function api(user, path, method = "GET", body) {
  const res = await fetch(`${http.baseUrl}/api/learning-paths${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${mintAccessToken(user._id)}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, ...(await res.json()) };
}
const getPath = async (lp) => (await api(mentee, `/${lp.id}`)).learningPath;
const byOrder = (path, order, attempt = 1) => path.sessions.find((s) => s.order === order && s.attempt === attempt);

/** Ứng viên đặt lịch buổi rồi giả lập mentor kết thúc buổi (booking `completed`, luồng có sẵn ở bookingsService). */
async function attend(lp, session) {
  const res = await api(mentee, `/${lp.id}/sessions/${session.id}/schedule`, "POST", slot());
  assert.equal(res.status, 201, res.error);
  await models.Booking.updateOne({ _id: res.booking.id }, { $set: { status: "completed", completedAt: new Date() } });
  return res.booking;
}

const PASS = { outcome: "passed", feedback: { summary: "Trả lời rõ ràng, có số liệu cụ thể.", strengths: ["Cấu trúc STAR tốt"] } };
const FAIL = { outcome: "not_passed", feedback: { summary: "Còn thiếu ví dụ cụ thể cho phần JOIN.", improvements: ["Luyện thêm truy vấn nhiều bảng"] } };
const record = (lp, session, body, user = mentor.user) => api(user, `/${lp.id}/sessions/${session.id}/outcome`, "PATCH", body);
const propose = (lp, session, body, user = mentor.user) => api(user, `/${lp.id}/sessions/${session.id}/supplementary`, "POST", body);

/** Lộ trình 3 buổi, 1.000.000đ, đã thanh toán (`active`). */
async function activePath() {
  const request = await mrService.createRequest(await actor(mentee), requestFields, files);
  const offered = await mrService.sendOffer(await actor(mentor.user), String(request._id), offerBody);
  await mrService.selectOffer(await actor(mentee), String(request._id), String(offered.offers[0]._id));
  const assessed = await mrService.acceptAssessment(await actor(mentor.user), String(request._id), slot(1));
  await models.Booking.updateOne({ _id: assessed.assessmentBookingId }, { $set: { status: "completed" } });
  const lp = (await api(mentor.user, "", "POST", { mentorshipRequestId: String(request._id), goal: "Đậu Data Analyst", totalAmount: TOTAL, sessions: SESSIONS })).learningPath;
  assert.equal((await api(mentor.user, `/${lp.id}/propose`, "POST")).status, 200);
  assert.equal((await api(mentee, `/${lp.id}/accept`, "POST", {})).status, 200);
  await models.LearningPath.updateOne({ _id: lp.id }, { $set: { status: "active", paidAt: new Date() } });
  return getPath(lp);
}

async function createMentor(tag) {
  const user = await models.User.create({ name: `Mentor LP13 ${tag}`, email: `lp13-mentor-${tag}@test.local`, role: "mentor" });
  const doc = await models.Mentor.findOneAndUpdate(
    { userId: user._id },
    { $set: { userId: user._id, name: `Mentor LP13 ${tag}`, title: "Data Lead", publicId: `lp13-mentor-${tag}`, isActive: true, isVerified: true, available: true, pricePerHour: 300000, pricing: { platformFeeRate: 0.2 }, sessionTypes: [{ type: "mock_interview", durationMinutes: 60, price: 300000 }] } },
    { upsert: true, returnDocument: "after" },
  );
  return { user, doc };
}

/** Bộ người dùng riêng cho mỗi nhóm test: router giới hạn 60 thao tác/giờ mỗi tài khoản (`mutationLimit`). */
async function usePeople(tag) {
  mentee = await models.User.create({ name: `Mentee LP13 ${tag}`, email: `lp13-mentee-${tag}@test.local`, role: "customer" });
  mentor = await createMentor(tag);
  otherMentor = await createMentor(`${tag}-other`);
}

before(async () => {
  harness = await startMongoHarness();
  models = { ...(await import("../models/index.js")), ...(await import("../models/MentorshipRequest.js")) };
  mrService = await import("../services/mentorshipRequestsService.js");
  await Promise.all(Object.values(models).filter((m) => m?.modelName).map((m) => m.init()));
  http = await startHttpServer((await import("../app.js")).createApp());
});

after(async () => {
  if (http) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

describe("LP-13 nhánh đạt", () => {
  before(() => usePeople("pass"));

  it("đạt buổi 1 → lưu feedback + điểm LP-01, mở buổi 2; đạt buổi cuối → lộ trình completed", async () => {
    let lp = await activePath();
    const s1 = byOrder(lp, 1);
    await attend(lp, s1);

    const res = await record(lp, s1, {
      ...PASS,
      scores: [{ shrmKey: "technical_learning", score: 4, note: "JOIN đúng" }, { shrmKey: "communication", score: 3 }],
    });
    assert.equal(res.status, 200, res.error);
    assert.equal(res.nextStep, "open_next");
    assert.equal(res.suggestedOutcome, "passed", "mọi key ≥ ngưỡng 3 → gợi ý đạt");

    const saved = await models.LearningPathSession.findById(s1.id).lean();
    assert.equal(saved.status, "done");
    assert.equal(saved.outcome, "passed");
    assert.ok(saved.doneAt);
    assert.equal(saved.feedback.summary, PASS.feedback.summary);
    assert.deepEqual(saved.feedback.strengths, ["Cấu trúc STAR tốt"]);
    assert.deepEqual(saved.feedback.scores.map((r) => [r.shrmKey, r.score]), [["technical_learning", 4], ["communication", 3]]);
    assert.equal(saved.feedback.frameworkVersion, "2026-11-v1");

    lp = res.learningPath;
    assert.equal(byOrder(lp, 1).feedback.summary, PASS.feedback.summary, "ứng viên xem được nhận xét trong DTO");
    assert.equal(byOrder(lp, 2).canSchedule, true);
    assert.equal(lp.status, "active");

    const notif = await models.Notification.findOne({ userId: mentee._id, type: "learning_path_session_result", "metadata.learningPathSessionId": s1.id }).lean();
    assert.ok(notif, "ứng viên nhận thông báo kết quả buổi");
    assert.match(notif.title, /đạt buổi 1/);

    for (const order of [2, 3]) {
      const s = byOrder(await getPath(lp), order);
      await attend(lp, s);
      const r = await record(lp, s, PASS);
      assert.equal(r.status, 200, r.error);
      assert.equal(r.nextStep, order === 3 ? "complete_path" : "open_next");
    }
    const finished = await models.LearningPath.findById(lp.id).lean();
    assert.equal(finished.status, "completed");
    assert.ok(finished.completedAt);
    const doneNotif = await models.Notification.findOne({ userId: mentee._id, title: "Bạn đã hoàn thành lộ trình", "metadata.learningPathId": lp.id }).lean();
    assert.ok(doneNotif);
  });

  it("chặn: booking chưa completed, ghi 2 lần, người không phải mentor, dữ liệu sai", async () => {
    const lp = await activePath();
    const s1 = byOrder(lp, 1);

    const notYet = await record(lp, s1, PASS);
    assert.equal(notYet.status, 409, "buổi chưa đặt lịch");

    const booked = await api(mentee, `/${lp.id}/sessions/${s1.id}/schedule`, "POST", slot());
    assert.equal(booked.status, 201, booked.error);
    const unfinished = await record(lp, s1, PASS);
    assert.equal(unfinished.status, 409);
    assert.match(unfinished.error, /kết thúc buổi học/);
    await models.Booking.updateOne({ _id: booked.booking.id }, { $set: { status: "completed" } });

    assert.equal((await record(lp, s1, PASS, mentee)).status, 403, "ứng viên không tự ghi kết quả");
    assert.equal((await record(lp, s1, PASS, otherMentor.user)).status, 404, "mentor khác không thấy lộ trình");

    const badKey = await record(lp, s1, { ...PASS, scores: [{ shrmKey: "teamwork", score: 4 }] });
    assert.equal(badKey.status, 400, "chỉ chấm key gắn cho buổi");
    const badScore = await record(lp, s1, { ...PASS, scores: [{ shrmKey: "communication", score: 7 }] });
    assert.equal(badScore.status, 400, "điểm ngoài thang 0–5");
    const shortSummary = await record(lp, s1, { outcome: "passed", feedback: { summary: "ok" } });
    assert.equal(shortSummary.status, 400);
    const failNoImprovement = await record(lp, s1, { outcome: "not_passed", feedback: { summary: "Chưa đạt yêu cầu buổi này." } });
    assert.equal(failNoImprovement.status, 400);
    assert.match(failNoImprovement.error, /cần cải thiện/);
    assert.equal((await models.LearningPathSession.findById(s1.id).lean()).status, "scheduled", "request lỗi không đổi buổi");

    const [a, b] = await Promise.all([record(lp, s1, PASS), record(lp, s1, PASS)]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409], "bấm 2 lần cùng lúc chỉ một lần ghi");
  });
});

describe("LP-13 nhánh không đạt lần 1", () => {
  before(() => usePeople("fail1"));

  it("tạo buổi học lại 0đ mở đặt lịch; buổi 2 vẫn khóa; học lại đạt thì mở buổi 2", async () => {
    const lp = await activePath();
    const s1 = byOrder(lp, 1);
    await attend(lp, s1);

    const res = await record(lp, s1, { ...FAIL, scores: [{ shrmKey: "technical_learning", score: 2 }, { shrmKey: "communication", score: 4 }] });
    assert.equal(res.status, 200, res.error);
    assert.equal(res.nextStep, "free_retake");
    assert.equal(res.suggestedOutcome, "not_passed", "có key dưới ngưỡng → gợi ý chưa đạt");

    const retake = byOrder(res.learningPath, 1, 2);
    assert.ok(retake, "có buổi học lại cùng order, attempt 2");
    assert.equal(retake.status, "planned");
    assert.equal(retake.shareAmount, 0, "học lại lần đầu miễn phí (quyết định 2)");
    assert.equal(retake.retakeOf, s1.id);
    assert.deepEqual(retake.shrmKeys, s1.shrmKeys);
    assert.equal(retake.canSchedule, true);
    assert.equal(byOrder(res.learningPath, 2).canSchedule, false);
    assert.deepEqual(byOrder(res.learningPath, 1).feedback.improvements, FAIL.feedback.improvements);

    const notif = await models.Notification.findOne({ userId: mentee._id, "metadata.learningPathSessionId": s1.id, type: "learning_path_session_result" }).lean();
    assert.match(notif.body, /học lại miễn phí/);

    const booking = await attend(lp, retake);
    assert.equal((await models.Booking.findById(booking.id).lean()).totalAmount, 0);
    const passed = await record(lp, retake, PASS);
    assert.equal(passed.status, 200, passed.error);
    assert.equal(passed.nextStep, "open_next");
    assert.equal(byOrder(passed.learningPath, 2).canSchedule, true);
    assert.equal(await models.LearningPathSession.countDocuments({ pathId: lp.id, order: 1 }), 2, "không sinh thêm buổi");
  });

  it("lần trượt đầu không được đề xuất buổi bổ sung có phí", async () => {
    const lp = await activePath();
    const s1 = byOrder(lp, 1);
    await attend(lp, s1);
    assert.equal((await record(lp, s1, FAIL)).status, 200);
    const res = await propose(lp, s1, { price: 200_000 });
    assert.equal(res.status, 409);
    assert.match(res.error, /học lại miễn phí/);
  });
});

describe("LP-13 nhánh không đạt lần 2", () => {
  before(() => usePeople("fail2"));

  it("không tự tạo buổi; mentor đề xuất buổi bổ sung có phí, chờ thanh toán nên chưa đặt lịch được", async () => {
    const lp = await activePath();
    const s1 = byOrder(lp, 1);
    await attend(lp, s1);
    await record(lp, s1, FAIL);
    const retake = byOrder(await getPath(lp), 1, 2);
    await attend(lp, retake);

    const res = await record(lp, retake, FAIL);
    assert.equal(res.status, 200, res.error);
    assert.equal(res.nextStep, "supplementary_required");
    assert.equal(byOrder(res.learningPath, 1, 3), undefined, "lần 2 không có buổi miễn phí");
    assert.deepEqual(res.learningPath.sessions.map((s) => s.canSchedule), [false, false, false, false]);
    const notif = await models.Notification.findOne({ userId: mentee._id, "metadata.learningPathSessionId": retake.id, type: "learning_path_session_result" }).lean();
    assert.match(notif.body, /buổi bổ sung có phí/);

    assert.equal((await propose(lp, retake, { price: 5_000 })).status, 400, "giá dưới sàn");
    assert.equal((await propose(lp, retake, { price: 200_000 }, mentee)).status, 403);

    const proposed = await propose(lp, retake, { price: 250_000, note: "Tập trung window function" });
    assert.equal(proposed.status, 201, proposed.error);
    const extra = byOrder(proposed.learningPath, 1, 3);
    assert.equal(extra.status, "pending_payment");
    assert.equal(extra.shareAmount, 250_000);
    assert.equal(extra.retakeOf, retake.id);
    assert.equal(extra.supplementaryNote, "Tập trung window function");
    assert.equal(extra.canSchedule, false);

    const blocked = await api(mentee, `/${lp.id}/sessions/${extra.id}/schedule`, "POST", slot());
    assert.equal(blocked.status, 409, "chưa trả tiền thì không đặt lịch buổi bổ sung");
    assert.match(blocked.error, /thanh toán/);
    const next = await api(mentee, `/${lp.id}/sessions/${byOrder(proposed.learningPath, 2).id}/schedule`, "POST", slot());
    assert.equal(next.status, 409);
    assert.match(next.error, /chờ thanh toán/);

    assert.equal((await propose(lp, retake, { price: 250_000 })).status, 409, "không đề xuất trùng");
    const pathRow = await models.LearningPath.findById(lp.id).lean();
    assert.equal(pathRow.totalAmount, TOTAL, "buổi bổ sung thu riêng, không đổi T");
    assert.equal(pathRow.status, "active");
  });
});

/**
 * LP-07: API Mentor tạo / sửa bản nháp lộ trình và gửi đề xuất (draft → proposed),
 * kể cả các trường hợp bị chặn: chưa có buổi, chưa có giá, buổi đánh giá 0đ chưa completed.
 */
import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";

let harness, http, models, mrService, mentee, mentors, seq = 0;

const files = { cv: [{ originalname: "cv.pdf", buffer: Buffer.from("cv") }], jd: [{ originalname: "jd.txt", buffer: Buffer.from("jd") }] };
const requestFields = { position: "Backend Developer", description: "Cần đánh giá năng lực Node.js và lộ trình luyện phỏng vấn.", sessionType: "mock_interview" };
const offerBody = { message: "Tôi đánh giá năng lực Node.js và đề xuất lộ trình phù hợp.", availability: "Tối thứ 3" };
const SESSIONS = [
  { title: "Kể chuyện dự án theo STAR", objectives: ["Trình bày 2 dự án"], shrmKeys: ["communication"] },
  { title: "Thiết kế API REST", objectives: ["Phân tích yêu cầu", "Xử lý lỗi"], shrmKeys: ["problem_solving", "technical_depth"] },
  { title: "Phỏng vấn thử tổng hợp", objectives: [], shrmKeys: [] },
];

const pad = (n) => String(n).padStart(2, "0");
function slot(daysFromNow) {
  seq += 1;
  const d = new Date(Date.now() + daysFromNow * 86400000 + seq * 60_000);
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

/** Yêu cầu đã chọn mentors[0]; `assessment`: "none" | "confirmed" | "completed". */
async function requestReady(assessment = "completed") {
  const request = await mrService.createRequest(await actor(mentee), requestFields, files);
  const offered = await mrService.sendOffer(await actor(mentors[0].user), String(request._id), offerBody);
  let row = await mrService.selectOffer(await actor(mentee), String(request._id), String(offered.offers[0]._id));
  if (assessment !== "none") {
    row = await mrService.acceptAssessment(await actor(mentors[0].user), String(request._id), slot(2));
    if (assessment === "completed") await models.Booking.updateOne({ _id: row.assessmentBookingId }, { $set: { status: "completed", completedAt: new Date() } });
  }
  return row;
}

before(async () => {
  harness = await startMongoHarness();
  models = { ...(await import("../models/index.js")), ...(await import("../models/MentorshipRequest.js")) };
  mrService = await import("../services/mentorshipRequestsService.js");
  await Promise.all(Object.values(models).filter((m) => m?.modelName).map((m) => m.init()));
  mentee = await models.User.create({ name: "Mentee LP07", email: "lp07-mentee@test.local", role: "customer" });
  mentors = [];
  for (let i = 0; i < 2; i += 1) {
    const user = await models.User.create({ name: `Mentor LP07 ${i}`, email: `lp07-mentor-${i}@test.local`, role: "mentor" });
    const mentor = await models.Mentor.findOneAndUpdate(
      { userId: user._id },
      { $set: { userId: user._id, name: `Mentor LP07 ${i}`, title: "Senior Engineer", publicId: `lp07-mentor-${i}`, isActive: true, isVerified: true, available: true, pricePerHour: 300000, "pricing.platformFeeRate": 0.25, sessionTypes: [{ type: "mock_interview", durationMinutes: 60, price: 300000 }] } },
      { upsert: true, returnDocument: "after" },
    );
    mentors.push({ user, mentor });
  }
  http = await startHttpServer((await import("../app.js")).createApp());
});

after(async () => {
  if (http) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

describe("Mentor soạn và gửi lộ trình: draft → proposed (LP-07)", () => {
  it("tạo bản nháp 3 buổi, sửa, gửi đề xuất; request → path_proposed; mentee nhận thông báo và xem được", async () => {
    const request = await requestReady("completed");
    const created = await api(mentors[0].user, "", "POST", { mentorshipRequestId: String(request._id), goal: "Đậu vòng phỏng vấn Backend", totalAmount: 900_000, sessions: SESSIONS });
    assert.equal(created.status, 201, created.error);
    const lp = created.learningPath;
    assert.equal(lp.status, "draft");
    assert.equal(lp.candidateId, String(mentee._id));
    assert.equal(lp.assessmentBookingId, String(request.assessmentBookingId));
    assert.deepEqual(lp.sessions.map((s) => s.order), [1, 2, 3]);
    assert.deepEqual(lp.sessions[1].shrmKeys, ["problem_solving", "technical_depth"]);

    // Mentee chưa thấy bản nháp.
    assert.equal((await api(mentee, `/${lp.id}`)).status, 404);
    assert.equal((await api(mentee, "")).learningPaths.length, 0);

    const edited = await api(mentors[0].user, `/${lp.id}`, "PATCH", { totalAmount: 1_000_000, sessions: [...SESSIONS, { title: "Ôn tập và phản hồi", objectives: [], shrmKeys: ["adaptability"] }] });
    assert.equal(edited.status, 200, edited.error);
    assert.equal(edited.learningPath.totalAmount, 1_000_000);
    assert.equal(edited.learningPath.sessions.length, 4);
    assert.equal(await models.LearningPathSession.countDocuments({ pathId: lp.id }), 4, "sửa buổi thay toàn bộ, không nhân đôi");

    const proposed = await api(mentors[0].user, `/${lp.id}/propose`, "POST");
    assert.equal(proposed.status, 200, proposed.error);
    assert.equal(proposed.learningPath.status, "proposed");
    assert.equal(proposed.learningPath.version, 1);
    assert.equal(proposed.learningPath.platformFeeRate, 0.25, "chụp tỉ lệ phí của Mentor lúc gửi (quyết định 4)");
    assert.ok(proposed.learningPath.proposedAt);

    assert.equal((await models.MentorshipRequest.findById(request._id).lean()).status, "path_proposed");
    assert.equal(await models.Notification.countDocuments({ userId: mentee._id, type: "learning_path_proposed", "metadata.learningPathId": lp.id }), 1);

    const seen = await api(mentee, `/${lp.id}`);
    assert.equal(seen.status, 200, seen.error);
    assert.equal(seen.learningPath.sessions.length, 4);
    assert.equal((await api(mentee, "")).learningPaths.length, 1);
  });
});

describe("Các trường hợp bị chặn (LP-07)", () => {
  it("gửi đề xuất bị chặn khi: chưa có buổi, chưa có giá, buổi 0đ chưa completed; mentee và mentor khác không gửi được", async () => {
    const request = await requestReady("confirmed");
    const lp = (await api(mentors[0].user, "", "POST", { mentorshipRequestId: String(request._id) })).learningPath;
    assert.equal(lp.status, "draft");

    let res = await api(mentors[0].user, `/${lp.id}/propose`, "POST");
    assert.equal(res.status, 400);
    assert.match(res.error, /ít nhất 1 buổi/);

    await api(mentors[0].user, `/${lp.id}`, "PATCH", { sessions: SESSIONS.slice(0, 1) });
    res = await api(mentors[0].user, `/${lp.id}/propose`, "POST");
    assert.equal(res.status, 400);
    assert.match(res.error, /giá trọn gói/);

    await api(mentors[0].user, `/${lp.id}`, "PATCH", { totalAmount: 500_000 });
    res = await api(mentors[0].user, `/${lp.id}/propose`, "POST");
    assert.equal(res.status, 400);
    assert.match(res.error, /buổi đánh giá 0đ/);

    assert.equal((await api(mentee, `/${lp.id}/propose`, "POST")).status, 403);
    assert.equal((await api(mentors[1].user, `/${lp.id}/propose`, "POST")).status, 404);
    assert.equal((await models.LearningPath.findById(lp.id).lean()).status, "draft");
    assert.equal((await models.MentorshipRequest.findById(request._id).lean()).status, "assessing");

    await models.Booking.updateOne({ _id: request.assessmentBookingId }, { $set: { status: "completed" } });
    res = await api(mentors[0].user, `/${lp.id}/propose`, "POST");
    assert.equal(res.status, 200, res.error);
    assert.equal((await api(mentors[0].user, `/${lp.id}/propose`, "POST")).status, 409, "gửi lần hai khi đang chờ phản hồi");
    assert.equal((await api(mentors[0].user, `/${lp.id}`, "PATCH", { goal: "Đổi sau khi gửi" })).status, 409, "không sửa khi đã gửi");
  });

  it("buổi 0đ bị hủy (không completed) thì vẫn không gửi được", async () => {
    const request = await requestReady("confirmed");
    await models.Booking.updateOne({ _id: request.assessmentBookingId }, { $set: { status: "cancelled", cancelledBy: "user" } });
    const lp = (await api(mentors[0].user, "", "POST", { mentorshipRequestId: String(request._id), totalAmount: 600_000, sessions: SESSIONS })).learningPath;
    const res = await api(mentors[0].user, `/${lp.id}/propose`, "POST");
    assert.equal(res.status, 400);
    assert.match(res.error, /buổi đánh giá 0đ/);
  });

  it("tạo bản nháp bị chặn: mentor không được chọn, mentee, yêu cầu chưa chọn mentor, tạo trùng, dữ liệu sai", async () => {
    const request = await requestReady("none");
    const id = String(request._id);
    assert.equal((await api(mentors[1].user, "", "POST", { mentorshipRequestId: id })).status, 404);
    assert.equal((await api(mentee, "", "POST", { mentorshipRequestId: id })).status, 403);

    const open = await mrService.createRequest(await actor(mentee), requestFields, files);
    assert.equal((await api(mentors[0].user, "", "POST", { mentorshipRequestId: String(open._id) })).status, 404);

    const bad = await api(mentors[0].user, "", "POST", { mentorshipRequestId: id, sessions: Array.from({ length: 13 }, (_, i) => ({ title: `Buổi ${i + 1}` })) });
    assert.equal(bad.status, 400);
    assert.match(bad.error, /chưa hợp lệ/);
    assert.equal((await api(mentors[0].user, "", "POST", { mentorshipRequestId: id, sessions: [{ title: "Buổi 1", shrmKeys: ["Có dấu cách"] }] })).status, 400);
    assert.equal((await api(mentors[0].user, "", "POST", { mentorshipRequestId: id, totalAmount: 1000.5 })).status, 400);

    assert.equal((await api(mentors[0].user, "", "POST", { mentorshipRequestId: id })).status, 201);
    assert.equal((await api(mentors[0].user, "", "POST", { mentorshipRequestId: id })).status, 409, "mỗi yêu cầu 1 lộ trình chưa hủy");
    await models.MentorshipRequest.updateOne({ _id: open._id }, { $set: { status: "closed" } });
  });
});

describe("Gửi lại sau khi ứng viên yêu cầu sửa (LP-07 / chuẩn bị LP-08)", () => {
  it("revision_requested: mentor sửa được, gửi lại thì version + 1 và thông báo 'gửi lại'", async () => {
    const request = await requestReady("completed");
    const lp = (await api(mentors[0].user, "", "POST", { mentorshipRequestId: String(request._id), totalAmount: 800_000, sessions: SESSIONS })).learningPath;
    await api(mentors[0].user, `/${lp.id}/propose`, "POST");
    // LP-08 sẽ có endpoint cho ứng viên; ở đây giả lập ứng viên yêu cầu sửa.
    await models.LearningPath.updateOne({ _id: lp.id }, { $set: { status: "revision_requested", revisionNote: "Bớt 1 buổi" } });

    const edited = await api(mentors[0].user, `/${lp.id}`, "PATCH", { sessions: SESSIONS.slice(0, 2), totalAmount: 600_000 });
    assert.equal(edited.status, 200, edited.error);
    const resent = await api(mentors[0].user, `/${lp.id}/propose`, "POST");
    assert.equal(resent.status, 200, resent.error);
    assert.equal(resent.learningPath.status, "proposed");
    assert.equal(resent.learningPath.version, 2);
    assert.equal(resent.learningPath.sessions.length, 2);
    assert.equal(await models.Notification.countDocuments({ userId: mentee._id, type: "learning_path_proposed", "metadata.learningPathId": lp.id, title: "Mentor đã gửi lại lộ trình" }), 1);
  });
});

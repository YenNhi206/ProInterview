/**
 * LP-08: API ứng viên — xem, chấp nhận (proposed → pending_payment), yêu cầu sửa kèm ghi chú
 * (proposed → revision_requested); mentor gửi lại thì version + 1.
 * Xong khi: vòng sửa → gửi lại → chấp nhận có test.
 */
import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";

let harness, http, models, mrService, mentee, otherMentee, mentor, seq = 0;

const files = { cv: [{ originalname: "cv.pdf", buffer: Buffer.from("cv") }], jd: [{ originalname: "jd.txt", buffer: Buffer.from("jd") }] };
const requestFields = { position: "Data Analyst", description: "Muốn có lộ trình luyện phỏng vấn Data Analyst trong 1 tháng.", sessionType: "mock_interview" };
const offerBody = { message: "Tôi sẽ đánh giá năng lực SQL, phân tích và đề xuất lộ trình phù hợp.", availability: "Tối thứ 4" };
const SESSIONS = [
  { title: "SQL và phân tích dữ liệu", objectives: ["Viết truy vấn JOIN"], shrmKeys: ["technical_knowledge"] },
  { title: "Trình bày insight", objectives: [], shrmKeys: ["communication"] },
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

/** Lộ trình 3 buổi, 900.000đ, đã gửi cho mentee (status proposed, version 1). */
async function proposedPath() {
  const request = await mrService.createRequest(await actor(mentee), requestFields, files);
  const offered = await mrService.sendOffer(await actor(mentor.user), String(request._id), offerBody);
  await mrService.selectOffer(await actor(mentee), String(request._id), String(offered.offers[0]._id));
  const assessed = await mrService.acceptAssessment(await actor(mentor.user), String(request._id), slot(2));
  await models.Booking.updateOne({ _id: assessed.assessmentBookingId }, { $set: { status: "completed" } });
  const lp = (await api(mentor.user, "", "POST", { mentorshipRequestId: String(request._id), goal: "Đậu Data Analyst", totalAmount: 900_000, sessions: SESSIONS })).learningPath;
  const proposed = await api(mentor.user, `/${lp.id}/propose`, "POST");
  assert.equal(proposed.status, 200, proposed.error);
  return proposed.learningPath;
}

const notifCount = (userId, type, pathId) => models.Notification.countDocuments({ userId, type, "metadata.learningPathId": pathId });

before(async () => {
  harness = await startMongoHarness();
  models = { ...(await import("../models/index.js")), ...(await import("../models/MentorshipRequest.js")) };
  mrService = await import("../services/mentorshipRequestsService.js");
  await Promise.all(Object.values(models).filter((m) => m?.modelName).map((m) => m.init()));
  mentee = await models.User.create({ name: "Mentee LP08", email: "lp08-mentee@test.local", role: "customer" });
  otherMentee = await models.User.create({ name: "Other LP08", email: "lp08-other@test.local", role: "customer" });
  const user = await models.User.create({ name: "Mentor LP08", email: "lp08-mentor@test.local", role: "mentor" });
  const doc = await models.Mentor.findOneAndUpdate(
    { userId: user._id },
    { $set: { userId: user._id, name: "Mentor LP08", title: "Data Lead", publicId: "lp08-mentor", isActive: true, isVerified: true, available: true, pricePerHour: 300000, sessionTypes: [{ type: "mock_interview", durationMinutes: 60, price: 300000 }] } },
    { upsert: true, returnDocument: "after" },
  );
  mentor = { user, doc };
  http = await startHttpServer((await import("../app.js")).createApp());
});

after(async () => {
  if (http) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

describe("Vòng sửa → gửi lại → chấp nhận (LP-08)", () => {
  it("mentee xem, yêu cầu sửa kèm ghi chú; mentor sửa và gửi lại (version 2); mentee chấp nhận → pending_payment", async () => {
    const lp = await proposedPath();

    const seen = await api(mentee, `/${lp.id}`);
    assert.equal(seen.status, 200, seen.error);
    assert.equal(seen.learningPath.status, "proposed");
    assert.equal(seen.learningPath.sessions.length, 3);

    const revision = await api(mentee, `/${lp.id}/request-revision`, "POST", { note: "Mình muốn bớt 1 buổi và thêm phần dashboard." });
    assert.equal(revision.status, 200, revision.error);
    assert.equal(revision.learningPath.status, "revision_requested");
    assert.equal(revision.learningPath.revisionNote, "Mình muốn bớt 1 buổi và thêm phần dashboard.");
    assert.equal(await notifCount(mentor.user._id, "learning_path_revision_requested", lp.id), 1);

    // Đang chờ mentor sửa: mentee không chấp nhận / không gửi yêu cầu sửa lần nữa.
    assert.equal((await api(mentee, `/${lp.id}/accept`, "POST", {})).status, 409);
    assert.equal((await api(mentee, `/${lp.id}/request-revision`, "POST", { note: "Thêm một yêu cầu nữa" })).status, 409);

    const edited = await api(mentor.user, `/${lp.id}`, "PATCH", { totalAmount: 800_000, sessions: [SESSIONS[0], { title: "Dashboard và storytelling", objectives: [], shrmKeys: ["communication"] }] });
    assert.equal(edited.status, 200, edited.error);
    const resent = await api(mentor.user, `/${lp.id}/propose`, "POST");
    assert.equal(resent.status, 200, resent.error);
    assert.equal(resent.learningPath.version, 2);
    assert.equal(resent.learningPath.status, "proposed");

    // Chấp nhận phiên bản cũ đang mở trên trình duyệt → 409.
    assert.equal((await api(mentee, `/${lp.id}/accept`, "POST", { version: 1 })).status, 409);

    const accepted = await api(mentee, `/${lp.id}/accept`, "POST", { version: 2 });
    assert.equal(accepted.status, 200, accepted.error);
    assert.equal(accepted.learningPath.status, "pending_payment");
    assert.equal(accepted.learningPath.version, 2);
    assert.equal(accepted.learningPath.totalAmount, 800_000);
    assert.equal(accepted.learningPath.sessions.length, 2);
    assert.ok(accepted.learningPath.acceptedAt);
    assert.equal(await notifCount(mentor.user._id, "learning_path_accepted", lp.id), 1);

    // Sau khi chấp nhận: không chấp nhận lại, không yêu cầu sửa, mentor không sửa được.
    assert.equal((await api(mentee, `/${lp.id}/accept`, "POST", {})).status, 409);
    assert.equal((await api(mentee, `/${lp.id}/request-revision`, "POST", { note: "Đổi ý muốn sửa" })).status, 409);
    assert.equal((await api(mentor.user, `/${lp.id}`, "PATCH", { goal: "Đổi" })).status, 409);
  });

  it("chấp nhận ngay bản đầu tiên (không gửi version) cũng được", async () => {
    const lp = await proposedPath();
    const accepted = await api(mentee, `/${lp.id}/accept`, "POST", {});
    assert.equal(accepted.status, 200, accepted.error);
    assert.equal(accepted.learningPath.status, "pending_payment");
    assert.equal(accepted.learningPath.version, 1);
  });
});

describe("Các trường hợp bị chặn (LP-08)", () => {
  it("mentor không gọi được accept / request-revision; mentee khác không thấy lộ trình", async () => {
    const lp = await proposedPath();
    assert.equal((await api(mentor.user, `/${lp.id}/accept`, "POST", {})).status, 403);
    assert.equal((await api(mentor.user, `/${lp.id}/request-revision`, "POST", { note: "Mentor tự yêu cầu" })).status, 403);
    assert.equal((await api(otherMentee, `/${lp.id}`)).status, 404);
    assert.equal((await api(otherMentee, `/${lp.id}/accept`, "POST", {})).status, 404);
    assert.equal((await models.LearningPath.findById(lp.id).lean()).status, "proposed");
  });

  it("yêu cầu sửa phải có ghi chú (≥ 5 ký tự, ≤ 2000)", async () => {
    const lp = await proposedPath();
    assert.equal((await api(mentee, `/${lp.id}/request-revision`, "POST", {})).status, 400);
    assert.equal((await api(mentee, `/${lp.id}/request-revision`, "POST", { note: "  ok " })).status, 400);
    assert.equal((await api(mentee, `/${lp.id}/request-revision`, "POST", { note: "x".repeat(2001) })).status, 400);
    assert.equal((await models.LearningPath.findById(lp.id).lean()).status, "proposed");
  });

  it("bản nháp coi như không tồn tại với mentee", async () => {
    const request = await mrService.createRequest(await actor(mentee), requestFields, files);
    const offered = await mrService.sendOffer(await actor(mentor.user), String(request._id), offerBody);
    await mrService.selectOffer(await actor(mentee), String(request._id), String(offered.offers[0]._id));
    const draft = (await api(mentor.user, "", "POST", { mentorshipRequestId: String(request._id), totalAmount: 500_000, sessions: SESSIONS })).learningPath;
    assert.equal((await api(mentee, `/${draft.id}/accept`, "POST", {})).status, 404);
    assert.equal((await api(mentee, `/${draft.id}/request-revision`, "POST", { note: "Sửa giúp mình" })).status, 404);
  });

  it("chấp nhận và yêu cầu sửa cùng lúc: chỉ một thao tác thành công", async () => {
    const lp = await proposedPath();
    const results = await Promise.all([
      api(mentee, `/${lp.id}/accept`, "POST", {}),
      api(mentee, `/${lp.id}/request-revision`, "POST", { note: "Đổi giờ học giúp mình" }),
    ]);
    assert.equal(results.filter((r) => r.status === 200).length, 1);
    assert.ok(["pending_payment", "revision_requested"].includes((await models.LearningPath.findById(lp.id).lean()).status));
  });
});

/**
 * LP-06 (C-06, quyết định 13): giới hạn buổi đánh giá 0đ của ứng viên khi mentor hẹn
 * (`POST /api/mentorship-requests/:id/accept-assessment` → `acceptAssessment`).
 * Xong khi: test đủ 4 trường hợp — (1) 1 buổi chưa xong cùng lúc, (2) 2 buổi / 30 ngày,
 * (3) ứng viên vắng tính đã dùng, (4) mentor vắng không tính và được đặt lại.
 */
import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";

let harness, http, models, service, mentors, seq = 0, userSeq = 0;

const fields = { position: "Frontend Developer", description: "Muốn được đánh giá năng lực React trước khi luyện theo lộ trình.", sessionType: "mock_interview" };
const files = { cv: [{ originalname: "cv.pdf", buffer: Buffer.from("cv") }], jd: [{ originalname: "jd.txt", buffer: Buffer.from("jd") }] };
const offerBody = { message: "Tôi sẽ đánh giá năng lực React và đề xuất lộ trình phù hợp cho bạn.", availability: "Tối thứ 5" };
const DAY = 86_400_000;

const actor = (user) => service.requestActor(String(user._id));
const pad = (n) => String(n).padStart(2, "0");
function fmt(d) {
  return { date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, timeSlot: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}
/** Khung giờ tương lai, mỗi lần khác nhau, cách nhau 2 giờ. */
const slot = () => fmt(new Date(Date.now() + DAY + (seq += 1) * 2 * 3_600_000));

async function newMentee() {
  userSeq += 1;
  return models.User.create({ name: `Mentee LP06 ${userSeq}`, email: `lp06-mentee-${userSeq}@test.local`, role: "customer" });
}

/** Yêu cầu mới của `mentee`, mentor thứ `i` được chọn. */
async function selectedRequest(mentee, i = 0) {
  const request = await service.createRequest(await actor(mentee), fields, files);
  const offered = await service.sendOffer(await actor(mentors[i].user), String(request._id), offerBody);
  return service.selectOffer(await actor(mentee), String(request._id), String(offered.offers[0]._id));
}

const accept = async (request, i = 0) => service.acceptAssessment(await actor(mentors[i].user), String(request._id), slot());

/** Mong đợi `acceptAssessment` bị chặn 409 với thông báo khớp `pattern`. */
async function expectBlocked(request, i, pattern) {
  await assert.rejects(accept(request, i), (err) => {
    assert.equal(err.status, 409);
    assert.match(err.message, pattern);
    return true;
  });
}

/** Đẩy buổi về quá khứ (đã bắt đầu > 15 phút) để báo vắng / tự hoàn thành được. */
async function moveToPast(bookingId, hoursAgo = 3) {
  await models.Booking.updateOne({ _id: bookingId }, { $set: fmt(new Date(Date.now() - hoursAgo * 3_600_000 - (seq += 1) * 60_000)) });
}

async function call(user, url, method = "GET", body) {
  const res = await fetch(`${http.baseUrl}${url}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${mintAccessToken(user._id)}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, ...(await res.json()) };
}

before(async () => {
  harness = await startMongoHarness();
  models = { ...(await import("../models/index.js")), ...(await import("../models/MentorshipRequest.js")) };
  service = await import("../services/mentorshipRequestsService.js");
  await Promise.all(Object.values(models).filter((m) => m?.modelName).map((m) => m.init()));
  mentors = [];
  for (let i = 0; i < 3; i += 1) {
    const user = await models.User.create({ name: `Mentor LP06 ${i}`, email: `lp06-mentor-${i}@test.local`, role: "mentor" });
    const mentor = await models.Mentor.findOneAndUpdate(
      { userId: user._id },
      { $set: { userId: user._id, name: `Mentor LP06 ${i}`, title: "Senior Engineer", publicId: `lp06-mentor-${i}`, isActive: true, isVerified: true, available: true, pricePerHour: 250000, sessionTypes: [{ type: "mock_interview", durationMinutes: 60, price: 250000 }] } },
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

describe("LP-06 giới hạn buổi đánh giá 0đ", () => {
  it("(1) đang có 1 buổi 0đ chưa xong → mentor khác không hẹn thêm được; xong buổi đó thì hẹn được", async () => {
    const mentee = await newMentee();
    const first = await accept(await selectedRequest(mentee, 0), 0);
    const second = await selectedRequest(mentee, 1);
    await expectBlocked(second, 1, /chưa diễn ra/);
    assert.equal(await models.Booking.countDocuments({ userId: mentee._id, sessionType: "assessment" }), 1, "không để lại booking thừa");

    await models.Booking.updateOne({ _id: first.assessmentBookingId }, { $set: { status: "completed" } });
    const ok = await accept(second, 1);
    assert.ok(ok.assessmentBookingId);
  });

  it("(2) đã dùng 2 buổi trong 30 ngày → chặn kèm ngày mở lại; buổi cũ qua 30 ngày thì hẹn được", async () => {
    const mentee = await newMentee();
    const ids = [];
    for (const i of [0, 1]) {
      const r = await accept(await selectedRequest(mentee, i), i);
      await models.Booking.updateOne({ _id: r.assessmentBookingId }, { $set: { status: "completed" } });
      ids.push(r.assessmentBookingId);
    }
    const third = await selectedRequest(mentee, 2);
    await expectBlocked(third, 2, /2 buổi đánh giá 0đ trong 30 ngày.*từ ngày \d{1,2}\/\d{1,2}\/\d{4}/);

    // Buổi đầu tiên tạo cách đây 31 ngày → chỉ còn 1 lượt trong cửa sổ.
    await models.Booking.collection.updateOne({ _id: ids[0] }, { $set: { createdAt: new Date(Date.now() - 31 * DAY) } });
    const ok = await accept(third, 2);
    assert.ok(ok.assessmentBookingId);
  });

  it("(3) ứng viên vắng (no_show không do mentor) vẫn tính là đã dùng", async () => {
    const mentee = await newMentee();
    const r1 = await accept(await selectedRequest(mentee, 0), 0);
    await models.Booking.updateOne({ _id: r1.assessmentBookingId }, { $set: { status: "completed" } });
    const r2 = await accept(await selectedRequest(mentee, 1), 1);
    // Chưa có API ghi "ứng viên vắng"; mô phỏng bản ghi no_show do ứng viên (cancelledBy khác "mentor").
    await models.Booking.updateOne({ _id: r2.assessmentBookingId }, { $set: { status: "no_show", cancelledBy: "user" } });
    await expectBlocked(await selectedRequest(mentee, 2), 2, /trong 30 ngày/);
  });

  it("(4) mentor vắng (ứng viên báo qua API) không tính; đặt lại được ngay trên cùng yêu cầu", async () => {
    const mentee = await newMentee();
    const r1 = await accept(await selectedRequest(mentee, 0), 0);
    await models.Booking.updateOne({ _id: r1.assessmentBookingId }, { $set: { status: "completed" } });

    const request = await selectedRequest(mentee, 1);
    const r2 = await accept(request, 1);
    await moveToPast(r2.assessmentBookingId);
    const reported = await call(mentee, `/api/bookings/${r2.assessmentBookingId}/report-no-show`, "POST", { note: "Mentor không vào phòng" });
    assert.equal(reported.status, 200, reported.error);
    const absent = await models.Booking.findById(r2.assessmentBookingId).lean();
    assert.equal(absent.status, "no_show");
    assert.equal(absent.cancelledBy, "mentor");

    const again = await accept(request, 1);
    assert.notEqual(String(again.assessmentBookingId), String(r2.assessmentBookingId), "buổi mới thay buổi mentor vắng");
  });

  it("buổi 0đ bị ứng viên hủy trước khi diễn ra không tính lượt", async () => {
    const mentee = await newMentee();
    const r1 = await accept(await selectedRequest(mentee, 0), 0);
    await models.Booking.updateOne({ _id: r1.assessmentBookingId }, { $set: { status: "completed" } });

    const request = await selectedRequest(mentee, 1);
    const r2 = await accept(request, 1);
    const cancelled = await call(mentee, `/api/bookings/${r2.assessmentBookingId}`, "DELETE", { reason: "Bận đột xuất" });
    assert.equal(cancelled.status, 200, cancelled.error);
    assert.equal((await models.Booking.findById(r2.assessmentBookingId).lean()).status, "cancelled");

    const ok = await accept(await selectedRequest(mentee, 2), 2);
    assert.ok(ok.assessmentBookingId, "chỉ có 1 lượt đã dùng (buổi completed)");
  });

  it("hai mentor hẹn cùng lúc cho một ứng viên: chỉ một buổi được tạo", async () => {
    const mentee = await newMentee();
    const [a, b] = [await selectedRequest(mentee, 0), await selectedRequest(mentee, 1)];
    const results = await Promise.allSettled([accept(a, 0), accept(b, 1)]);
    const okCount = results.filter((r) => r.status === "fulfilled").length;
    assert.ok(okCount <= 1, "không được tạo 2 buổi 0đ chưa xong");
    for (const r of results.filter((x) => x.status === "rejected")) assert.equal(r.reason.status, 409);
    const open = await models.Booking.countDocuments({ userId: mentee._id, sessionType: "assessment", status: { $in: ["pending", "confirmed", "in_progress", "rescheduled"] } });
    assert.equal(open, okCount);
  });
});

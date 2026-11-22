/**
 * LP-12: ứng viên đặt lịch từng buổi lộ trình — `POST /api/learning-paths/:id/sessions/:sid/schedule`.
 * Tạo Booking gắn buổi theo LP-04 (paid, confirmed, tiền = shareAmount), buổi `planned → scheduled`,
 * chỉ mở khi buổi trước `passed`.
 * Xong khi: không đặt được buổi 3 khi buổi 2 chưa đạt.
 */
import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";

let harness, http, models, mrService, bookingsService, mentee, otherMentee, mentor, seq = 0;

const files = { cv: [{ originalname: "cv.pdf", buffer: Buffer.from("cv") }], jd: [{ originalname: "jd.txt", buffer: Buffer.from("jd") }] };
const requestFields = { position: "Data Analyst", description: "Muốn có lộ trình luyện phỏng vấn Data Analyst trong 1 tháng.", sessionType: "mock_interview" };
const offerBody = { message: "Tôi sẽ đánh giá năng lực SQL, phân tích và đề xuất lộ trình phù hợp.", availability: "Tối thứ 4" };
const SESSIONS = [
  { title: "SQL và phân tích dữ liệu", objectives: ["Viết truy vấn JOIN"], shrmKeys: ["technical_learning"] },
  { title: "Trình bày insight", objectives: [], shrmKeys: ["communication"] },
  { title: "Phỏng vấn thử tổng hợp", objectives: [], shrmKeys: [] },
];
const TOTAL = 1_000_000;

const pad = (n) => String(n).padStart(2, "0");
/** Khung giờ tương lai, mỗi lần gọi khác nhau (tránh trùng index mentorId + date + timeSlot giữa các test). */
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
const schedule = (lp, session, body = slot(), user = mentee) => api(user, `/${lp.id}/sessions/${session.id ?? session._id}/schedule`, "POST", body);
const getPath = async (lp) => (await api(mentee, `/${lp.id}`)).learningPath;

/** Lộ trình 3 buổi, 1.000.000đ; `status` mặc định `active` (đã thanh toán). */
async function pathWithStatus(status = "active") {
  const request = await mrService.createRequest(await actor(mentee), requestFields, files);
  const offered = await mrService.sendOffer(await actor(mentor.user), String(request._id), offerBody);
  await mrService.selectOffer(await actor(mentee), String(request._id), String(offered.offers[0]._id));
  const assessed = await mrService.acceptAssessment(await actor(mentor.user), String(request._id), slot(1));
  await models.Booking.updateOne({ _id: assessed.assessmentBookingId }, { $set: { status: "completed" } });
  const lp = (await api(mentor.user, "", "POST", { mentorshipRequestId: String(request._id), goal: "Đậu Data Analyst", totalAmount: TOTAL, sessions: SESSIONS })).learningPath;
  assert.equal((await api(mentor.user, `/${lp.id}/propose`, "POST")).status, 200);
  assert.equal((await api(mentee, `/${lp.id}/accept`, "POST", {})).status, 200);
  if (status !== "pending_payment") await models.LearningPath.updateOne({ _id: lp.id }, { $set: { status, paidAt: new Date() } });
  return getPath(lp);
}

/** Giả lập LP-13: ghi kết quả buổi (chưa có API). */
const markDone = (session, outcome) =>
  models.LearningPathSession.updateOne({ _id: session.id }, { $set: { status: "done", outcome, doneAt: new Date() } });
/** Giả lập LP-13: buổi học lại miễn phí sau lần `not_passed` đầu tiên. */
async function createRetake(lp, failed) {
  const row = await models.LearningPathSession.create({
    pathId: lp.id, order: failed.order, attempt: failed.attempt + 1, retakeOf: failed.id, title: failed.title, shrmKeys: failed.shrmKeys, shareAmount: 0,
  });
  return { id: String(row._id), order: row.order, attempt: row.attempt };
}
const byOrder = (path, order, attempt = 1) => path.sessions.find((s) => s.order === order && s.attempt === attempt);

/**
 * Tạo bộ mentee / mentee khác / mentor mới và gán vào biến dùng chung. Mỗi nhóm test dùng bộ riêng vì router
 * /api/learning-paths giới hạn 60 thao tác/giờ mỗi tài khoản (`mutationLimit`).
 */
async function usePeople(tag) {
  mentee = await models.User.create({ name: `Mentee LP12 ${tag}`, email: `lp12-mentee-${tag}@test.local`, role: "customer" });
  otherMentee = await models.User.create({ name: `Other LP12 ${tag}`, email: `lp12-other-${tag}@test.local`, role: "customer" });
  const user = await models.User.create({ name: `Mentor LP12 ${tag}`, email: `lp12-mentor-${tag}@test.local`, role: "mentor" });
  const doc = await models.Mentor.findOneAndUpdate(
    { userId: user._id },
    { $set: { userId: user._id, name: `Mentor LP12 ${tag}`, title: "Data Lead", publicId: `lp12-mentor-${tag}`, isActive: true, isVerified: true, available: true, pricePerHour: 300000, pricing: { platformFeeRate: 0.2 }, sessionTypes: [{ type: "mock_interview", durationMinutes: 60, price: 300000 }] } },
    { upsert: true, returnDocument: "after" },
  );
  mentor = { user, doc };
}

before(async () => {
  harness = await startMongoHarness();
  models = { ...(await import("../models/index.js")), ...(await import("../models/MentorshipRequest.js")) };
  mrService = await import("../services/mentorshipRequestsService.js");
  bookingsService = await import("../services/bookingsService.js");
  await Promise.all(Object.values(models).filter((m) => m?.modelName).map((m) => m.init()));
  await usePeople("a");
  http = await startHttpServer((await import("../app.js")).createApp());
});

after(async () => {
  if (http) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

describe("LP-12 đặt lịch buổi lộ trình", () => {
  it("vừa thanh toán: chỉ buổi 1 mở; đặt buổi 1 tạo Booking theo LP-04, không gắn mentorshipRequestId", async () => {
    const lp = await pathWithStatus("active");
    assert.deepEqual(lp.sessions.map((s) => s.canSchedule), [true, false, false]);
    const s1 = byOrder(lp, 1);

    const when = slot();
    const res = await schedule(lp, s1, { ...when, note: "Em muốn tập trung window function" });
    assert.equal(res.status, 201, res.error);
    assert.equal(res.booking.date, when.date);
    assert.equal(res.booking.timeSlot, when.timeSlot);

    const booking = await models.Booking.findById(res.booking.id).lean();
    assert.equal(String(booking.learningPathId), lp.id);
    assert.equal(String(booking.learningPathSessionId), s1.id);
    assert.equal(booking.mentorshipRequestId, undefined);
    assert.equal(String(booking.userId), String(mentee._id));
    assert.equal(String(booking.mentorId), String(mentor.doc._id));
    assert.equal(booking.status, "confirmed");
    assert.equal(booking.paymentStatus, "paid");
    assert.equal(booking.paymentMethod, "learning_path");
    assert.equal(booking.sessionType, "mock_interview");
    assert.equal(booking.price, s1.shareAmount);
    assert.equal(booking.totalAmount, s1.shareAmount);
    assert.equal(booking.platformFee, Math.round(s1.shareAmount * lp.platformFeeRate));
    assert.equal(booking.vat, 0);
    assert.match(booking.notes, /Buổi 1: SQL và phân tích dữ liệu/);
    assert.match(booking.notes, /window function/);

    const session = await models.LearningPathSession.findById(s1.id).lean();
    assert.equal(session.status, "scheduled");
    assert.equal(String(session.bookingId), res.booking.id);

    const dto = res.learningPath;
    assert.equal(byOrder(dto, 1).status, "scheduled");
    assert.equal(byOrder(dto, 1).booking.date, when.date);
    assert.deepEqual(dto.sessions.map((s) => s.canSchedule), [false, false, false]);

    const notif = await models.Notification.findOne({ userId: mentor.user._id, "metadata.learningPathSessionId": s1.id }).lean();
    assert.ok(notif, "mentor nhận thông báo buổi mới");
    assert.equal(notif.type, "booking_confirmed");
    assert.equal(String(notif.metadata.bookingId), res.booking.id);
  });

  it("không đặt được buổi 3 khi buổi 2 chưa đạt; học lại đạt thì mở buổi 3", async () => {
    let lp = await pathWithStatus("active");
    const [s1, s2, s3] = [1, 2, 3].map((o) => byOrder(lp, o));

    // Buổi 1 chưa đặt → buổi 2 và 3 bị chặn.
    for (const s of [s2, s3]) assert.equal((await schedule(lp, s)).status, 409);

    assert.equal((await schedule(lp, s1)).status, 201);
    // Buổi 1 đang scheduled (chưa có kết quả) → buổi 2 vẫn bị chặn.
    const waiting = await schedule(lp, s2);
    assert.equal(waiting.status, 409);
    assert.match(waiting.error, /buổi 1/);

    await markDone(s1, "passed");
    assert.equal(byOrder(await getPath(lp), 2).canSchedule, true);
    assert.equal((await schedule(lp, s2)).status, 201);

    await markDone(s2, "not_passed");
    const blocked = await schedule(lp, s3);
    assert.equal(blocked.status, 409, "buổi 2 chưa đạt thì không đặt được buổi 3");
    assert.match(blocked.error, /Buổi 2 chưa đạt/);
    assert.equal((await models.LearningPathSession.findById(s3.id).lean()).status, "planned");
    assert.equal(await models.Booking.countDocuments({ learningPathSessionId: s3.id }), 0);

    const retake = await createRetake(lp, (await getPath(lp)).sessions.find((s) => s.id === s2.id));
    lp = await getPath(lp);
    assert.equal(byOrder(lp, 2, 2).canSchedule, true);
    assert.equal(byOrder(lp, 3).canSchedule, false);
    assert.equal((await schedule(lp, s3)).status, 409, "đã có buổi học lại thì vẫn phải học lại trước");

    const booked = await schedule(lp, retake);
    assert.equal(booked.status, 201, booked.error);
    const retakeBooking = await models.Booking.findById(booked.booking.id).lean();
    assert.equal(retakeBooking.totalAmount, 0, "buổi học lại miễn phí: mọi field tiền 0");
    assert.equal(retakeBooking.platformFee, 0);
    assert.equal(retakeBooking.paymentStatus, "paid");
    assert.match(retakeBooking.notes, /Buổi 2 \(học lại\)/);

    await markDone(retake, "passed");
    assert.equal((await schedule(lp, s3)).status, 201);
  });

  it("lộ trình chưa thanh toán thì không đặt được, DTO không mở buổi nào", async () => {
    const lp = await pathWithStatus("pending_payment");
    assert.deepEqual(lp.sessions.map((s) => s.canSchedule), [false, false, false]);
    const res = await schedule(lp, byOrder(lp, 1));
    assert.equal(res.status, 409);
    assert.match(res.error, /chưa được thanh toán/);
  });

  it("đặt lại buổi đã scheduled bị chặn; bấm 2 lần cùng lúc chỉ tạo 1 booking", async () => {
    const lp = await pathWithStatus("active");
    const s1 = byOrder(lp, 1);
    const results = await Promise.all([schedule(lp, s1), schedule(lp, s1)]);
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    assert.equal(await models.Booking.countDocuments({ learningPathSessionId: s1.id }), 1);
    assert.equal((await schedule(lp, s1)).status, 409);
  });

  it("khung giờ mentor đã có lịch: 409 và buổi vẫn planned", async () => {
    const lp = await pathWithStatus("active");
    const s1 = byOrder(lp, 1);
    const taken = slot();
    await models.Booking.create({
      userId: otherMentee._id, mentorId: mentor.doc._id, sessionType: "mock_interview", status: "confirmed", ...taken, durationMinutes: 60,
      price: 300000, platformFee: 60000, vat: 0, totalAmount: 300000, paymentStatus: "paid", paymentMethod: "transfer",
    });
    const res = await schedule(lp, s1, taken);
    assert.equal(res.status, 409);
    assert.match(res.error, /đã có lịch/);
    const session = await models.LearningPathSession.findById(s1.id).lean();
    assert.equal(session.status, "planned");
    assert.equal(session.bookingId, null);
    assert.equal((await schedule(lp, s1)).status, 201, "chọn giờ khác thì đặt được");
  });

  it("khung giờ bị đơn CK hết hạn giữ thì được giải phóng", async () => {
    const lp = await pathWithStatus("active");
    const taken = slot();
    const stale = await models.Booking.create({
      userId: otherMentee._id, mentorId: mentor.doc._id, sessionType: "mock_interview", status: "pending", ...taken, durationMinutes: 60,
      price: 300000, platformFee: 60000, vat: 0, totalAmount: 300000, paymentStatus: "pending", paymentMethod: "transfer",
      paymentExpiresAt: new Date(Date.now() - 60_000),
    });
    const res = await schedule(lp, byOrder(lp, 1), taken);
    assert.equal(res.status, 201, res.error);
    assert.notEqual((await models.Booking.findById(stale._id).lean()).status, "pending");
  });

  it("giờ quá khứ, sai định dạng, ngoài lịch mentor mở: 400", async () => {
    const lp = await pathWithStatus("active");
    const s1 = byOrder(lp, 1);
    assert.equal((await schedule(lp, s1, { date: "01/01/2020", timeSlot: "09:00" })).status, 400);
    assert.equal((await schedule(lp, s1, { date: "hôm nay", timeSlot: "09:00" })).status, 400);
    assert.equal((await schedule(lp, s1, { ...slot(), timeSlot: "25:00" })).status, 400);
    assert.equal((await schedule(lp, s1, { ...slot(), durationMinutes: 300 })).status, 400);

    // Cùng quy tắc createBooking: mentor đã khai báo lịch tuần thì chỉ nhận đúng giờ đã mở, trừ ngày nghỉ.
    const when = slot(5);
    const [d, m, y] = when.date.split("/").map(Number);
    const mentorDay = (new Date(y, m - 1, d).getDay() + 6) % 7;
    const openSlot = when.timeSlot === "07:00" ? "07:30" : "07:00";
    await models.Mentor.updateOne({ _id: mentor.doc._id }, { $set: { recurringSchedule: [{ dayOfWeek: mentorDay, slots: [openSlot] }] } });
    try {
      const outside = await schedule(lp, s1, when);
      assert.equal(outside.status, 400);
      assert.match(outside.error, /không nằm trong lịch mentor mở/);
      await models.Mentor.updateOne({ _id: mentor.doc._id }, { $set: { blockedDates: [when.date] } });
      const dayOff = await schedule(lp, s1, { date: when.date, timeSlot: openSlot });
      assert.equal(dayOff.status, 400);
      assert.match(dayOff.error, /không mở lịch cho ngày này/);
    } finally {
      await models.Mentor.updateOne({ _id: mentor.doc._id }, { $set: { blockedDates: [], recurringSchedule: [] } });
    }
    assert.equal((await models.LearningPathSession.findById(s1.id).lean()).status, "planned");
  });

  it("mentee khác không thấy lộ trình (404); mentor không tự đặt lịch thay (403); mã buổi lạ 400/404", async () => {
    const lp = await pathWithStatus("active");
    const s1 = byOrder(lp, 1);
    assert.equal((await schedule(lp, s1, slot(), otherMentee)).status, 404);
    assert.equal((await schedule(lp, s1, slot(), mentor.user)).status, 403);
    assert.equal((await api(mentee, `/${lp.id}/sessions/abc/schedule`, "POST", slot())).status, 400);
    assert.equal((await api(mentee, `/${lp.id}/sessions/${"0".repeat(24)}/schedule`, "POST", slot())).status, 404);
  });

  it("buổi của lộ trình khác không đặt được qua lộ trình này", async () => {
    const a = await pathWithStatus("active");
    const b = await pathWithStatus("active");
    assert.equal((await schedule(a, byOrder(b, 1))).status, 404);
  });

  it("tạo Booking lỗi sau khi đã giữ buổi: buổi được trả về planned, không sinh booking", async () => {
    const lp = await pathWithStatus("active");
    const s1 = byOrder(lp, 1);
    // Dữ liệu hỏng (bỏ qua validator) làm learningPathBookingMoney ném lỗi đúng lúc tạo Booking.
    await models.LearningPathSession.collection.updateOne({ _id: new models.LearningPathSession.base.Types.ObjectId(s1.id) }, { $set: { shareAmount: 1000.5 } });
    const res = await schedule(lp, s1);
    assert.equal(res.status, 500);
    const session = await models.LearningPathSession.findById(s1.id).lean();
    assert.equal(session.status, "planned", "không để buổi kẹt ở scheduled");
    assert.equal(session.bookingId, null);
    assert.equal(await models.Booking.countDocuments({ learningPathSessionId: s1.id }), 0);

    await models.LearningPathSession.updateOne({ _id: s1.id }, { $set: { shareAmount: 300_000 } });
    assert.equal((await schedule(lp, s1)).status, 201, "sửa dữ liệu xong đặt lại được");
  });

  it("hai lộ trình cùng mentor tranh một khung giờ: chỉ một bên được, bên kia giữ buổi planned", async () => {
    const a = await pathWithStatus("active");
    const b = await pathWithStatus("active");
    const when = slot();
    const results = await Promise.all([schedule(a, byOrder(a, 1), when), schedule(b, byOrder(b, 1), when)]);
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    assert.equal(await models.Booking.countDocuments({ mentorId: mentor.doc._id, date: when.date, timeSlot: when.timeSlot, status: "confirmed" }), 1);
    const loser = results[0].status === 409 ? a : b;
    const session = await models.LearningPathSession.findById(byOrder(loser, 1).id).lean();
    assert.equal(session.status, "planned");
    assert.equal(session.bookingId, null);
  });

  it("mentor đang tạm ngưng thì không đặt lịch được", async () => {
    const lp = await pathWithStatus("active");
    await models.Mentor.updateOne({ _id: mentor.doc._id }, { $set: { isActive: false } });
    try {
      const res = await schedule(lp, byOrder(lp, 1));
      assert.equal(res.status, 409);
      assert.match(res.error, /tạm ngưng/);
    } finally {
      await models.Mentor.updateOne({ _id: mentor.doc._id }, { $set: { isActive: true } });
    }
    assert.equal((await models.LearningPathSession.findById(byOrder(lp, 1).id).lean()).status, "planned");
  });

  it("mentor hủy buổi (LP-22): không hoàn tiền riêng, buổi về planned và mentee đặt lại được", async () => {
    const lp = await pathWithStatus("active");
    const s1 = byOrder(lp, 1);
    const first = await schedule(lp, s1, slot(6));
    assert.equal(first.status, 201);
    const res = await bookingsService.cancelMentorBooking(String(mentor.user._id), first.booking.id, { reason: "Mentor bận đột xuất" });
    assert.equal(res.ok, true, res.error);
    const cancelled = await models.Booking.findById(first.booking.id).lean();
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.paymentStatus, "paid", "không hoàn tiền từng buổi");
    assert.ok(!cancelled.rebookCreditVnd, "không sinh rebook credit");
    assert.equal(byOrder(await getPath(lp), 1).canSchedule, true);
    assert.equal((await schedule(lp, s1)).status, 201);
  });

  it("mentee hủy buổi (LP-22) thì buổi quay về planned và đặt lại được", async () => {
    const lp = await pathWithStatus("active");
    const s1 = byOrder(lp, 1);
    const first = await schedule(lp, s1, slot(4));
    assert.equal(first.status, 201);
    const cancelled = await bookingsService.cancelMyBooking(String(mentee._id), first.booking.id, { reason: "Bận việc" });
    assert.equal(cancelled.ok, true, cancelled.error);
    const reopened = await getPath(lp);
    assert.equal(byOrder(reopened, 1).status, "planned");
    assert.equal(byOrder(reopened, 1).canSchedule, true);
    const again = await schedule(lp, s1);
    assert.equal(again.status, 201, again.error);
    assert.notEqual(again.booking.id, first.booking.id);
  });
});

/** Gọi API ngoài /api/learning-paths (lịch hẹn) bằng token của `user`; `user = null` thì không gửi token. */
async function rawApi(user, path, method = "GET", body) {
  const res = await fetch(`${http.baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${mintAccessToken(user._id)}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, ...(await res.json().catch(() => ({}))) };
}

/** Đưa booking về quá khứ để mentor được bấm hoàn thành / báo vắng (các hàm này chặn buổi chưa tới giờ). */
async function moveBookingToPast(bookingId) {
  const d = new Date(Date.now() - 2 * 86400000);
  await models.Booking.updateOne({ _id: bookingId }, { $set: { date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, timeSlot: "09:00" } });
}

describe("LP-12 các tình huống dễ bị hỏi vặn", () => {
  before(() => usePeople("b"));

  it("lộ trình đã hủy hoặc đã hoàn thành thì không đặt thêm buổi", async () => {
    for (const status of ["cancelled", "completed"]) {
      const lp = await pathWithStatus(status);
      assert.deepEqual(lp.sessions.map((s) => s.canSchedule), [false, false, false], status);
      const res = await schedule(lp, byOrder(lp, 1));
      assert.equal(res.status, 409, status);
      assert.equal(await models.Booking.countDocuments({ learningPathId: lp.id }), 0, status);
    }
  });

  it("ứng viên gửi kèm giá, trạng thái thanh toán, id lộ trình khác: server bỏ qua, tiền vẫn theo shareAmount", async () => {
    const lp = await pathWithStatus("active");
    const other = await pathWithStatus("active");
    const s1 = byOrder(lp, 1);
    const res = await schedule(lp, s1, {
      ...slot(), price: 1, totalAmount: 1, platformFee: 0, paymentStatus: "pending", paymentMethod: "transfer",
      status: "completed", userId: String(otherMentee._id), mentorId: String(otherMentee._id), learningPathId: other.id, shareAmount: 1,
    });
    assert.equal(res.status, 201, res.error);
    const booking = await models.Booking.findById(res.booking.id).lean();
    assert.equal(booking.totalAmount, s1.shareAmount);
    assert.equal(booking.price, s1.shareAmount);
    assert.equal(booking.platformFee, Math.round(s1.shareAmount * lp.platformFeeRate));
    assert.equal(booking.paymentStatus, "paid");
    assert.equal(booking.paymentMethod, "learning_path");
    assert.equal(booking.status, "confirmed");
    assert.equal(String(booking.userId), String(mentee._id));
    assert.equal(String(booking.mentorId), String(mentor.doc._id));
    assert.equal(String(booking.learningPathId), lp.id);
    assert.equal((await models.LearningPathSession.findById(s1.id).lean()).shareAmount, s1.shareAmount);
  });

  it("tổng tiền các buổi đúng bằng giá trọn gói, mỗi buổi đặt ra đúng phần tiền của nó", async () => {
    const lp = await pathWithStatus("active");
    const shares = [1, 2, 3].map((o) => byOrder(lp, o).shareAmount);
    assert.equal(shares.reduce((a, b) => a + b, 0), TOTAL);
    for (const order of [1, 2, 3]) {
      const s = byOrder(lp, order);
      const res = await schedule(lp, s);
      assert.equal(res.status, 201, res.error);
      assert.equal((await models.Booking.findById(res.booking.id).lean()).totalAmount, s.shareAmount);
      await markDone(s, "passed");
    }
    const sum = await models.Booking.aggregate([{ $match: { learningPathId: new models.Booking.base.Types.ObjectId(lp.id) } }, { $group: { _id: null, t: { $sum: "$totalAmount" } } }]);
    assert.equal(sum[0].t, TOTAL);
  });

  it("buổi đã đặt hiện trong lịch của ứng viên và lịch của mentor", async () => {
    const lp = await pathWithStatus("active");
    const res = await schedule(lp, byOrder(lp, 1));
    assert.equal(res.status, 201);
    const mine = await rawApi(mentee, "/api/bookings");
    assert.equal(mine.status, 200);
    assert.ok(mine.bookings.some((b) => String(b.id ?? b._id) === res.booking.id), "ứng viên thấy buổi trong Lịch hẹn của tôi");
    const theirs = await rawApi(mentor.user, "/api/bookings/mentor/list");
    assert.equal(theirs.status, 200);
    assert.ok(theirs.bookings.some((b) => String(b.id ?? b._id) === res.booking.id), "mentor thấy buổi trong lịch dạy");
  });

  it("mentor bấm hoàn thành nhưng chưa ghi đạt / không đạt: buổi sau vẫn chưa mở", async () => {
    const lp = await pathWithStatus("active");
    const [s1, s2] = [1, 2].map((o) => byOrder(lp, o));
    const res = await schedule(lp, s1);
    await moveBookingToPast(res.booking.id);
    const done = await bookingsService.completeMentorBooking(String(mentor.user._id), res.booking.id);
    assert.equal(done.ok, true, done.error);
    assert.equal((await models.Booking.findById(res.booking.id).lean()).status, "completed");

    const after = await getPath(lp);
    assert.equal(byOrder(after, 1).status, "scheduled", "kết quả buổi do mentor ghi ở LP-13, không suy từ booking completed");
    assert.equal(byOrder(after, 2).canSchedule, false);
    assert.equal((await schedule(lp, s2)).status, 409);
    const cancel = await bookingsService.cancelMyBooking(String(mentee._id), res.booking.id, { reason: "Thử hủy buổi đã học" });
    assert.equal(cancel.ok, false, "buổi đã học xong không hủy được để đặt lại");
  });

  it("mentor vắng mặt: buổi về planned, ứng viên đặt lại miễn phí, mentor bị ghi vi phạm", async () => {
    const lp = await pathWithStatus("active");
    const s1 = byOrder(lp, 1);
    const res = await schedule(lp, s1);
    await moveBookingToPast(res.booking.id);
    const noShowBefore = (await models.Mentor.findById(mentor.doc._id).lean()).stats?.noShowCount ?? 0;
    const noShow = await bookingsService.processBookingNoShow(res.booking.id, { note: "Mentor không vào phòng" }, { markedBy: "user", actorUserId: String(mentee._id) });
    assert.equal(noShow.ok, true, noShow.error);
    const closed = await models.Booking.findById(res.booking.id).lean();
    assert.equal(closed.status, "no_show");
    assert.equal(closed.paymentStatus, "paid", "không hoàn tiền từng buổi");
    assert.equal((await models.Mentor.findById(mentor.doc._id).lean()).stats?.noShowCount ?? 0, noShowBefore + 1, "mentor bị ghi một lần vắng");
    const reopened = await getPath(lp);
    assert.equal(byOrder(reopened, 1).status, "planned");
    assert.equal(byOrder(reopened, 1).canSchedule, true);
    const again = await schedule(lp, s1);
    assert.equal(again.status, 201, again.error);
    assert.equal((await models.Booking.findById(again.booking.id).lean()).totalAmount, s1.shareAmount, "đặt lại không thu thêm");
  });

  it("chưa đăng nhập → 401; tài khoản bị khóa → 403; ghi chú quá dài → 400", async () => {
    const lp = await pathWithStatus("active");
    const s1 = byOrder(lp, 1);
    const anon = await rawApi(null, `/api/learning-paths/${lp.id}/sessions/${s1.id}/schedule`, "POST", slot());
    assert.equal(anon.status, 401);
    assert.equal((await schedule(lp, s1, { ...slot(), note: "x".repeat(1001) })).status, 400);
    await models.User.updateOne({ _id: mentee._id }, { $set: { isActive: false } });
    try {
      const locked = await schedule(lp, s1);
      assert.ok([401, 403].includes(locked.status), `nhận ${locked.status}`);
    } finally {
      await models.User.updateOne({ _id: mentee._id }, { $set: { isActive: true } });
    }
    assert.equal(await models.Booking.countDocuments({ learningPathSessionId: s1.id }), 0);
  });
});

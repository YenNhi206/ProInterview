/**
 * Chặn ứng viên có 2 buổi chồng giờ, kể cả với 2 mentor khác nhau (`services/bookingConflictService.js`).
 * Phủ 5 luồng tạo / dời giờ booking: đặt lịch thường, mentor hẹn buổi 0đ, đặt buổi lộ trình (LP-12),
 * ứng viên chọn giờ mới sau khi mentor hủy, mentor dời lịch. Giờ không chồng thì đặt với mentor khác vẫn được.
 */
import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyTestEnv, startMongoHarness, stopMongoHarness } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";

let harness, models, bookings, mrService, sessionsService, conflict, util;
let mentee, otherUser, mentorA, mentorB;

const pad = (n) => String(n).padStart(2, "0");
/** Ngày DD/MM/YYYY cách hôm nay `n` ngày; mỗi test dùng ngày riêng để không dính lịch của test khác. */
function day(n) {
  const d = new Date(Date.now() + n * 86400000);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

async function makeMentor(key) {
  const user = await models.User.create({ name: `Mentor ${key}`, email: `conflict-${key}@test.local`, role: "mentor" });
  const doc = await models.Mentor.findOneAndUpdate(
    { userId: user._id },
    { $set: { userId: user._id, name: `Mentor ${key}`, publicId: `conflict-${key}`, isActive: true, isVerified: true, available: true, pricePerHour: 200000, sessionTypes: [{ type: "mock_interview", durationMinutes: 60, price: 200000 }] } },
    { upsert: true, returnDocument: "after" },
  );
  return { user, doc };
}

/** Booking đã trả tiền của `user` với `mentor`. */
function paidBooking(user, mentor, date, timeSlot, extra = {}) {
  return models.Booking.create({
    userId: user._id, mentorId: mentor.doc._id, sessionType: "mock_interview", status: "confirmed", date, timeSlot, durationMinutes: 60,
    price: 200000, platformFee: 40000, vat: 0, totalAmount: 200000, paymentStatus: "paid", paymentMethod: "transfer", paidAt: new Date(),
    ...extra,
  });
}

const book = (user, mentor, date, timeSlot) =>
  bookings.createBooking(String(user._id), { mentorId: mentor.doc.publicId, date, timeSlot, sessionType: "mock_interview", paymentMethod: "transfer" });

before(async () => {
  harness = await startMongoHarness();
  models = { ...(await import("../models/index.js")), ...(await import("../models/MentorshipRequest.js")) };
  bookings = await import("../services/bookingsService.js");
  mrService = await import("../services/mentorshipRequestsService.js");
  sessionsService = await import("../services/learningPathSessionsService.js");
  conflict = await import("../services/bookingConflictService.js");
  util = await import("../utils/bookingSchedule.js");
  await Promise.all(Object.values(models).filter((m) => m?.modelName).map((m) => m.init()));
  mentee = await models.User.create({ name: "Mentee trùng giờ", email: "conflict-mentee@test.local", role: "customer" });
  otherUser = await models.User.create({ name: "Người khác", email: "conflict-other@test.local", role: "customer" });
  mentorA = await makeMentor("a");
  mentorB = await makeMentor("b");
});

after(async () => {
  if (harness) await stopMongoHarness(harness);
});

describe("bookingsOverlap", () => {
  const at = (timeSlot, durationMinutes = 60) => ({ date: "10/12/2026", timeSlot, durationMinutes });
  it("chồng một phần, trùng giờ bắt đầu, nằm trọn bên trong: trùng", () => {
    assert.equal(util.bookingsOverlap(at("19:00"), at("19:30")), true);
    assert.equal(util.bookingsOverlap(at("19:00"), at("19:00")), true);
    assert.equal(util.bookingsOverlap(at("18:00", 180), at("19:00", 30)), true);
    assert.equal(util.bookingsOverlap(at("18:30"), at("19:00")), true);
  });
  it("nối tiếp hoặc cách nhau: không trùng", () => {
    assert.equal(util.bookingsOverlap(at("19:00"), at("20:00")), false);
    assert.equal(util.bookingsOverlap(at("18:00"), at("19:00")), false);
    assert.equal(util.bookingsOverlap(at("09:00"), at("15:00")), false);
  });
  it("khác ngày không trùng; thiếu thời lượng coi 60 phút; ngày hỏng không coi là trùng", () => {
    assert.equal(util.bookingsOverlap(at("19:00"), { date: "11/12/2026", timeSlot: "19:00", durationMinutes: 60 }), false);
    assert.equal(util.bookingsOverlap({ date: "10/12/2026", timeSlot: "19:00" }, at("19:59")), true);
    assert.equal(util.bookingsOverlap({ date: "", timeSlot: "19:00" }, at("19:00")), false);
  });
});

describe("POST /api/bookings — đặt lịch thường", () => {
  it("đã có buổi 19:00–20:00 với mentor A: mentor B lúc 19:00 / 19:30 / 18:30 bị chặn, 20:00 và 18:00 được", async () => {
    const date = day(10);
    await paidBooking(mentee, mentorA, date, "19:00");
    for (const time of ["19:00", "19:30", "18:30"]) {
      const res = await book(mentee, mentorB, date, time);
      assert.equal(res.ok, false, `${time} phải bị chặn`);
      assert.equal(res.status, 409);
      assert.match(res.error, /lúc 19:00 ngày .* trùng khung giờ/);
    }
    assert.equal((await book(mentee, mentorB, date, "20:00")).ok, true, "nối tiếp sau buổi trước thì được");
    assert.equal((await book(mentee, mentorB, date, "18:00")).ok, true, "kết thúc đúng lúc buổi kia bắt đầu thì được");
  });

  it("buổi dài 90 phút chặn tới hết giờ của nó", async () => {
    const date = day(11);
    await paidBooking(mentee, mentorA, date, "09:00", { durationMinutes: 90 });
    assert.equal((await book(mentee, mentorB, date, "10:00")).status, 409);
    assert.equal((await book(mentee, mentorB, date, "10:30")).ok, true);
  });

  it("buổi đã hủy, đơn CK đã hết hạn, lịch của người khác: không chặn", async () => {
    const date = day(12);
    await paidBooking(mentee, mentorA, date, "08:00", { status: "cancelled", cancelledBy: "user" });
    await paidBooking(mentee, mentorA, date, "13:00", {
      status: "pending", paymentStatus: "pending", paidAt: undefined, paymentExpiresAt: new Date(Date.now() - 60_000),
    });
    await paidBooking(otherUser, mentorA, date, "16:00");
    assert.equal((await book(mentee, mentorB, date, "08:00")).ok, true);
    assert.equal((await book(mentee, mentorB, date, "13:30")).ok, true);
    assert.equal((await book(mentee, mentorB, date, "16:00")).ok, true);
  });

  it("đơn CK còn hạn (đang chờ trả) vẫn giữ giờ", async () => {
    const date = day(13);
    assert.equal((await book(mentee, mentorA, date, "10:00")).ok, true);
    assert.equal((await book(mentee, mentorB, date, "10:15")).status, 409);
  });

  it("tải lại trang checkout đúng slot của mình không bị coi là trùng", async () => {
    const date = day(14);
    const first = await book(mentee, mentorA, date, "15:00");
    assert.equal(first.ok, true);
    const again = await book(mentee, mentorA, date, "15:00");
    assert.equal(again.ok, true, again.error);
    assert.equal(String(again.booking.id ?? again.booking._id), String(first.booking.id ?? first.booking._id));
  });
});

describe("Buổi lộ trình (LP-12)", () => {
  it("trùng giờ với buổi của mentor khác: 409, buổi vẫn planned; giờ khác thì đặt được", async () => {
    const date = day(15);
    await paidBooking(mentee, mentorB, date, "19:00");
    const path = await models.LearningPath.create({
      candidateId: mentee._id, mentorId: mentorA.doc._id, mentorshipRequestId: new models.LearningPath.base.Types.ObjectId(),
      status: "active", totalAmount: 300000, platformFeeRate: 0.2, paidAt: new Date(),
    });
    const session = await models.LearningPathSession.create({ pathId: path._id, order: 1, title: "Buổi 1", shareAmount: 300000 });
    const actor = { userId: String(mentee._id), mentor: null };

    await assert.rejects(
      sessionsService.scheduleLearningPathSession(actor, String(path._id), String(session._id), { date, timeSlot: "19:30" }),
      (err) => err.status === 409 && /trùng khung giờ/.test(err.message),
    );
    const row = await models.LearningPathSession.findById(session._id).lean();
    assert.equal(row.status, "planned");
    assert.equal(row.bookingId, null);

    const ok = await sessionsService.scheduleLearningPathSession(actor, String(path._id), String(session._id), { date, timeSlot: "20:00" });
    assert.equal(ok.booking.timeSlot, "20:00");
  });
});

describe("Mentor hẹn buổi 0đ (LP-05)", () => {
  it("mentee đã có lịch trùng giờ: 409, thông báo không lộ lịch với mentor khác, không tạo booking", async () => {
    const date = day(16);
    await paidBooking(mentee, mentorB, date, "14:00");
    const files = { cv: [{ originalname: "cv.pdf", buffer: Buffer.from("cv") }], jd: [{ originalname: "jd.txt", buffer: Buffer.from("jd") }] };
    const request = await mrService.createRequest(await mrService.requestActor(String(mentee._id)), { position: "Backend", description: "Cần mentor luyện phỏng vấn backend Node.js trong 2 tuần.", sessionType: "mock_interview" }, files);
    const offered = await mrService.sendOffer(await mrService.requestActor(String(mentorA.user._id)), String(request._id), { message: "Tôi có 5 năm kinh nghiệm backend, sẽ đánh giá kỹ năng thiết kế API.", availability: "Tối" });
    await mrService.selectOffer(await mrService.requestActor(String(mentee._id)), String(request._id), String(offered.offers[0]._id));
    const mentorActor = await mrService.requestActor(String(mentorA.user._id));

    await assert.rejects(
      mrService.acceptAssessment(mentorActor, String(request._id), { date, timeSlot: "14:30" }),
      (err) => err.status === 409 && err.message === conflict.MENTEE_BUSY_MESSAGE && !err.message.includes("14:00"),
    );
    assert.equal(await models.Booking.countDocuments({ userId: mentee._id, sessionType: "assessment" }), 0);
    const ok = await mrService.acceptAssessment(mentorActor, String(request._id), { date, timeSlot: "15:00" });
    assert.ok(ok.assessmentBookingId);
  });
});

describe("Dời lịch", () => {
  it("mentor dời lịch vào giờ mentee bận với mentor khác: 409 không lộ lịch; dời chồng lên chính buổi cũ thì được", async () => {
    const date = day(17);
    const mine = await paidBooking(mentee, mentorA, date, "10:00");
    await paidBooking(mentee, mentorB, date, "14:00");
    const blocked = await bookings.rescheduleMentorBooking(String(mentorA.user._id), String(mine._id), { newDate: date, newTimeSlot: "14:30", reason: "Bận họp" });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.status, 409);
    assert.equal(blocked.error, conflict.MENTEE_BUSY_MESSAGE);
    assert.equal((await models.Booking.findById(mine._id).lean()).timeSlot, "10:00");

    const moved = await bookings.rescheduleMentorBooking(String(mentorA.user._id), String(mine._id), { newDate: date, newTimeSlot: "10:30", reason: "Lùi 30 phút" });
    assert.equal(moved.ok, true, moved.error);
  });

  it("ứng viên chọn giờ mới sau khi mentor hủy: trùng buổi khác thì 409 và vẫn được chọn lại", async () => {
    const date = day(18);
    const cancelled = await paidBooking(mentee, mentorA, date, "08:00", {
      status: "cancelled", cancelledBy: "mentor", cancelledAt: new Date(), mentorCancelResolution: "awaiting_user",
    });
    await paidBooking(mentee, mentorB, date, "09:00");
    const blocked = await bookings.resolveMentorCancelBooking(String(mentee._id), String(cancelled._id), { choice: "reschedule", newDate: date, newTimeSlot: "09:30" });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.status, 409);
    assert.match(blocked.error, /lúc 09:00/);
    assert.equal((await models.Booking.findById(cancelled._id).lean()).mentorCancelResolution, "awaiting_user", "chưa ghi lựa chọn khi bị chặn");

    const ok = await bookings.resolveMentorCancelBooking(String(mentee._id), String(cancelled._id), { choice: "reschedule", newDate: date, newTimeSlot: "11:00" });
    assert.equal(ok.ok, true, ok.error);
    assert.equal((await models.Booking.findById(cancelled._id).lean()).status, "confirmed");
  });
});

describe("Các tình huống dễ bị hỏi vặn", () => {
  it("buổi vắt qua nửa đêm: 23:30–00:30 chặn 00:00 hôm sau; 23:00–00:00 thì 00:00 vẫn được", async () => {
    const [d1, d2] = [day(20), day(21)];
    await paidBooking(mentee, mentorA, d1, "23:30");
    const blocked = await book(mentee, mentorB, d2, "00:00");
    assert.equal(blocked.status, 409, "chồng 30 phút sang ngày hôm sau");
    assert.match(blocked.error, /lúc 23:30/);

    const [d3, d4] = [day(22), day(23)];
    await paidBooking(mentee, mentorA, d3, "23:00");
    assert.equal((await book(mentee, mentorB, d4, "00:00")).ok, true, "kết thúc đúng nửa đêm thì 00:00 được");
  });

  it("buổi đang diễn ra (in_progress) vẫn chặn; buổi đã hoàn thành hoặc vắng mặt thì không", async () => {
    const date = day(24);
    await paidBooking(mentee, mentorA, date, "08:00", { status: "in_progress" });
    await paidBooking(mentee, mentorA, date, "11:00", { status: "completed" });
    await paidBooking(mentee, mentorA, date, "14:00", { status: "no_show" });
    assert.equal((await book(mentee, mentorB, date, "08:30")).status, 409);
    assert.equal((await book(mentee, mentorB, date, "11:00")).ok, true);
    assert.equal((await book(mentee, mentorB, date, "14:00")).ok, true);
  });

  it("buổi 0đ và buổi lộ trình của chính ứng viên cũng giữ giờ khi đặt lịch thường", async () => {
    const date = day(25);
    await paidBooking(mentee, mentorA, date, "09:00", { sessionType: "assessment", price: 0, platformFee: 0, totalAmount: 0, paymentMethod: "" });
    await paidBooking(mentee, mentorA, date, "13:00", { paymentMethod: "learning_path", learningPathId: new models.Booking.base.Types.ObjectId() });
    assert.equal((await book(mentee, mentorB, date, "09:30")).status, 409);
    assert.equal((await book(mentee, mentorB, date, "13:15")).status, 409);
    assert.equal((await book(mentee, mentorB, date, "10:00")).ok, true);
  });

  it("thông báo cho ứng viên nêu giờ buổi đang trùng; người khác không bị ảnh hưởng bởi lịch của ứng viên", async () => {
    const date = day(26);
    await paidBooking(mentee, mentorA, date, "16:00");
    const res = await book(mentee, mentorB, date, "16:30");
    assert.equal(res.error, `Bạn đã có lịch hẹn khác lúc 16:00 ngày ${date} (60 phút) trùng khung giờ này. Vui lòng chọn giờ khác.`);
    assert.equal((await book(otherUser, mentorB, date, "16:30")).ok, true, "người khác đặt cùng giờ với mentor B vẫn được");
  });

  it("chặn trùng không làm mentor mất slot: ứng viên bị chặn thì không có booking rác nào được tạo", async () => {
    const date = day(27);
    await paidBooking(mentee, mentorA, date, "18:00");
    const before = await models.Booking.countDocuments({ mentorId: mentorB.doc._id, date });
    assert.equal((await book(mentee, mentorB, date, "18:00")).status, 409);
    assert.equal(await models.Booking.countDocuments({ mentorId: mentorB.doc._id, date }), before);
    assert.equal((await book(otherUser, mentorB, date, "18:00")).ok, true, "slot của mentor B vẫn trống cho người khác");
  });
});

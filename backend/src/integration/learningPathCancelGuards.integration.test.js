/**
 * LP-22: các luồng hủy / no-show có sẵn không hoàn tiền, không sinh rebook credit cho booking lộ trình
 * và buổi đánh giá 0đ; buổi lộ trình bị hủy quay về `planned` để đặt lại. Booking thường giữ nguyên hành vi.
 */
import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyTestEnv } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";

let mongo, db, models, svc, money;

before(async () => {
  const { MongoMemoryReplSet } = await import("mongodb-memory-server");
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  db = (await import("mongoose")).default;
  await db.connect(mongo.getUri());
  models = await import("../models/index.js");
  await Promise.all(Object.values(models).filter((m) => m?.modelName).map((m) => m.init()));
  svc = await import("../services/bookingsService.js");
  money = await import("../utils/learningPathBookingMoney.js");
});

after(async () => {
  if (db) await db.disconnect();
  if (mongo) await mongo.stop();
});

const REFUND_DEST = {
  refundReceiveBankName: "MB Bank",
  refundReceiveAccountNumber: "0123456789",
  refundReceiveAccountHolder: "NGUYEN VAN A",
};

let seq = 0;
async function fixture() {
  seq += 1;
  const customer = await models.User.create({ name: `Ứng viên ${seq}`, email: `lp22-c${seq}@test.local`, role: "customer" });
  const owner = await models.User.create({ name: `Mentor ${seq}`, email: `lp22-m${seq}@test.local`, role: "mentor" });
  const mentor = await models.Mentor.findOneAndUpdate(
    { userId: owner._id },
    { $set: { name: `Mentor ${seq}`, publicId: `lp22-${seq}`, isActive: true } },
    { upsert: true, returnDocument: "after" },
  );
  const path = await models.LearningPath.create({
    candidateId: customer._id,
    mentorId: mentor._id,
    mentorshipRequestId: new db.Types.ObjectId(),
    status: "active",
    totalAmount: 1_000_000,
    platformFeeRate: 0.3,
  });
  return { customer, owner, mentor, path };
}

let slot = 0;
/**
 * daysFromNow > 0: tương lai; < 0: đã qua. Ngày VÀ giờ lấy từ đúng thời điểm đích (giờ local của
 * process, giống parseBookingDateTime) — không chọn giờ cố định, nếu không kết quả phụ thuộc múi giờ
 * máy chạy (CI chạy UTC). Mỗi lần gọi lệch thêm 1 phút để không trùng slot {mentorId, date, timeSlot}.
 */
function schedule(daysFromNow) {
  slot += 1;
  const d = new Date(Date.now() + daysFromNow * 86400000 + slot * 60_000);
  const pad = (n) => String(n).padStart(2, "0");
  return {
    date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    timeSlot: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    durationMinutes: 60,
  };
}

async function pathBooking(f, { daysFromNow = 5, shareAmount = 333_333, order = 1 } = {}) {
  const session = await models.LearningPathSession.create({ pathId: f.path._id, order, title: `Buổi ${order}`, shareAmount, status: "scheduled" });
  const booking = await models.Booking.create({
    userId: f.customer._id,
    mentorId: f.mentor._id,
    sessionType: "mock_interview",
    status: "confirmed",
    learningPathId: f.path._id,
    learningPathSessionId: session._id,
    ...schedule(daysFromNow),
    ...money.learningPathBookingMoney({ shareAmount, platformFeeRate: 0.3 }),
  });
  await models.LearningPathSession.updateOne({ _id: session._id }, { $set: { bookingId: booking._id } });
  return { booking, session };
}

async function assessmentBooking(f, { daysFromNow = 5 } = {}) {
  return models.Booking.create({
    userId: f.customer._id,
    mentorId: f.mentor._id,
    mentorshipRequestId: f.path.mentorshipRequestId,
    sessionType: "assessment",
    status: "confirmed",
    ...schedule(daysFromNow),
    ...money.assessmentBookingMoney(),
  });
}

async function normalPaidBooking(f, { daysFromNow = 5 } = {}) {
  const booking = await models.Booking.create({
    userId: f.customer._id,
    mentorId: f.mentor._id,
    sessionType: "mock_interview",
    status: "confirmed",
    paymentStatus: "paid",
    paymentMethod: "transfer",
    paidAt: new Date(),
    ...schedule(daysFromNow),
    price: 300_000,
    platformFeeRate: 0.3,
    platformFee: 90_000,
    vat: 0,
    totalAmount: 300_000,
  });
  await models.Payment.create({
    userId: f.customer._id,
    type: "booking",
    referenceModel: "Booking",
    referenceId: booking._id,
    amount: 300_000,
    method: "transfer",
    provider: "transfer",
    providerRef: `lp22-${booking._id}`,
    status: "success",
    paidAt: new Date(),
  });
  return booking;
}

/** Không có tiền nào được hoàn hay giữ làm credit cho booking này. */
async function assertNoMoneyMoved(bookingId) {
  const b = await models.Booking.findById(bookingId).lean();
  assert.equal(b.paymentStatus, "paid", "paymentStatus không được chuyển sang hoàn tiền");
  assert.equal(b.cancelRefundAmountVnd, 0);
  assert.ok(!b.rebookCreditVnd, "không sinh rebook credit");
  assert.ok(!b.rebookCreditStatus, "không sinh rebook credit");
  assert.notEqual(b.mentorCancelResolution, "awaiting_user");
  assert.equal(await models.Payment.countDocuments({ referenceId: bookingId, status: { $in: ["refunded", "partial_refund"] } }), 0);
  return b;
}

async function assertSessionReopened(sessionId) {
  const s = await models.LearningPathSession.findById(sessionId).lean();
  assert.equal(s.status, "planned");
  assert.equal(s.bookingId, null);
}

describe("cancelMyBooking (LP-22)", () => {
  it("ứng viên hủy buổi lộ trình: không hoàn tiền, buổi quay về planned để đặt lại", async () => {
    const f = await fixture();
    const { booking, session } = await pathBooking(f);
    const res = await svc.cancelMyBooking(String(f.customer._id), String(booking._id), { reason: "Bận việc" });
    assert.equal(res.ok, true, res.error);
    assert.equal(res.cancellationPolicy.refundAmountVnd, 0);
    assert.equal(res.cancellationPolicy.ledger, "learning_path_no_refund");
    assert.equal(res.learningPathSessionReopened, true);
    const b = await assertNoMoneyMoved(booking._id);
    assert.equal(b.status, "cancelled");
    assert.equal(b.cancelledBy, "user");
    await assertSessionReopened(session._id);
  });

  it("ứng viên hủy buổi đánh giá 0đ: không đòi STK nhận hoàn, không hoàn tiền", async () => {
    const f = await fixture();
    const booking = await assessmentBooking(f, { daysFromNow: 0.2 }); // < 12h: booking thường sẽ mất 100%
    const res = await svc.cancelMyBooking(String(f.customer._id), String(booking._id), {});
    assert.equal(res.ok, true, res.error);
    assert.equal((await assertNoMoneyMoved(booking._id)).cancelledBy, "user");
  });

  it("booking thường đã trả vẫn được hoàn theo chính sách như cũ", async () => {
    const f = await fixture();
    const booking = await normalPaidBooking(f, { daysFromNow: 5 });
    const res = await svc.cancelMyBooking(String(f.customer._id), String(booking._id), REFUND_DEST);
    assert.equal(res.ok, true, res.error);
    assert.equal(res.cancellationPolicy.refundPercent, 100);
    assert.equal(res.cancellationPolicy.refundAmountVnd, 300_000);
    assert.notEqual((await models.Booking.findById(booking._id).lean()).paymentStatus, "paid");
  });
});

describe("cancelMentorBooking (LP-22)", () => {
  it("mentor hủy buổi lộ trình (≥ 24h): không awaiting_user, không hoàn tiền, buổi mở lại", async () => {
    const f = await fixture();
    const { booking, session } = await pathBooking(f, { daysFromNow: 5 });
    const res = await svc.cancelMentorBooking(String(f.owner._id), String(booking._id), { reason: "Ốm" });
    assert.equal(res.ok, true, res.error);
    assert.equal(res.refundPending, false);
    const b = await assertNoMoneyMoved(booking._id);
    assert.equal(b.cancelledBy, "mentor");
    await assertSessionReopened(session._id);
  });

  it("mentor hủy gấp (< 24h) buổi lộ trình: vẫn không hoàn tiền từng buổi", async () => {
    const f = await fixture();
    const { booking } = await pathBooking(f, { daysFromNow: 0.3 });
    const res = await svc.cancelMentorBooking(String(f.owner._id), String(booking._id), { reason: "Việc gấp" });
    assert.equal(res.ok, true, res.error);
    assert.equal(res.lateCancel, false);
    await assertNoMoneyMoved(booking._id);
  });

  it("mentor hủy buổi đánh giá 0đ: cancelledBy mentor (LP-06 không tính lượt)", async () => {
    const f = await fixture();
    const booking = await assessmentBooking(f);
    const res = await svc.cancelMentorBooking(String(f.owner._id), String(booking._id), { reason: "Trùng lịch" });
    assert.equal(res.ok, true, res.error);
    assert.equal((await assertNoMoneyMoved(booking._id)).cancelledBy, "mentor");
  });

  it("booking thường đã trả, mentor hủy ≥ 24h: vẫn chờ ứng viên chọn phương án", async () => {
    const f = await fixture();
    const booking = await normalPaidBooking(f, { daysFromNow: 5 });
    const res = await svc.cancelMentorBooking(String(f.owner._id), String(booking._id), { reason: "Ốm" });
    assert.equal(res.ok, true, res.error);
    assert.equal((await models.Booking.findById(booking._id).lean()).mentorCancelResolution, "awaiting_user");
  });
});

describe("processBookingNoShow (LP-22)", () => {
  it("mentor vắng buổi lộ trình: no_show, ghi vi phạm, không hoàn tiền, buổi mở lại", async () => {
    const f = await fixture();
    const { booking, session } = await pathBooking(f, { daysFromNow: -1 });
    const res = await svc.processBookingNoShow(String(booking._id), { note: "Không vào phòng" }, { markedBy: "user", actorUserId: String(f.customer._id) });
    assert.equal(res.ok, true, res.error);
    assert.equal(res.refundAmountVnd, 0);
    assert.equal(res.mentorNoShowCount, 1);
    const b = await assertNoMoneyMoved(booking._id);
    assert.equal(b.status, "no_show");
    assert.equal(b.cancelledBy, "mentor");
    await assertSessionReopened(session._id);

    const again = await svc.processBookingNoShow(String(booking._id), {}, { markedBy: "admin" });
    assert.equal(again.idempotent, true);
    assert.equal((await models.Mentor.findById(f.mentor._id).lean()).stats.noShowCount, 1);
  });

  it("mentor vắng buổi đánh giá 0đ: no_show do mentor, không hoàn tiền", async () => {
    const f = await fixture();
    const booking = await assessmentBooking(f, { daysFromNow: -1 });
    const res = await svc.processBookingNoShow(String(booking._id), {}, { markedBy: "admin" });
    assert.equal(res.ok, true, res.error);
    const b = await assertNoMoneyMoved(booking._id);
    assert.equal(b.status, "no_show");
    assert.equal(b.cancelledBy, "mentor");
  });

  it("booking thường đã trả: no-show vẫn hoàn 100% như cũ", async () => {
    const f = await fixture();
    const booking = await normalPaidBooking(f, { daysFromNow: -1 });
    const res = await svc.processBookingNoShow(String(booking._id), {}, { markedBy: "admin" });
    assert.equal(res.ok, true, res.error);
    assert.equal(res.refundAmountVnd, 300_000);
  });
});

describe("resolveMentorCancelBooking (LP-22)", () => {
  it("từ chối đổi mentor / hoàn tiền cho buổi lộ trình đã bị mentor hủy", async () => {
    const f = await fixture();
    const { booking } = await pathBooking(f, { daysFromNow: 5 });
    await svc.cancelMentorBooking(String(f.owner._id), String(booking._id), { reason: "Ốm" });
    for (const choice of ["change_mentor", "refund", "reschedule"]) {
      const res = await svc.resolveMentorCancelBooking(String(f.customer._id), String(booking._id), { choice, ...REFUND_DEST });
      assert.equal(res.ok, false, choice);
      assert.equal(res.status, 400);
    }
    await assertNoMoneyMoved(booking._id);
  });

  it("booking thường chờ xử lý: đổi mentor vẫn sinh rebook credit như cũ", async () => {
    const f = await fixture();
    const booking = await normalPaidBooking(f, { daysFromNow: 5 });
    await svc.cancelMentorBooking(String(f.owner._id), String(booking._id), { reason: "Ốm" });
    const res = await svc.resolveMentorCancelBooking(String(f.customer._id), String(booking._id), { choice: "change_mentor" });
    assert.equal(res.ok, true, res.error);
    const b = await models.Booking.findById(booking._id).lean();
    assert.equal(b.rebookCreditStatus, "available");
    assert.equal(b.rebookCreditVnd, 300_000);
  });
});

describe("Hủy song song (LP-22)", () => {
  it("ứng viên và mentor cùng hủy một buổi lộ trình: chỉ một lần thành công", async () => {
    const f = await fixture();
    const { booking } = await pathBooking(f, { daysFromNow: 5 });
    const results = await Promise.all([
      svc.cancelMyBooking(String(f.customer._id), String(booking._id), {}),
      svc.cancelMentorBooking(String(f.owner._id), String(booking._id), { reason: "Ốm" }),
    ]);
    assert.equal(results.filter((r) => r.ok).length, 1);
    await assertNoMoneyMoved(booking._id);
  });
});

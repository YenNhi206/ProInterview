/**
 * LP-04: Booking có sessionType "assessment", learningPathId, learningPathSessionId, paymentMethod "learning_path".
 * Xong khi: bookingStaleSweepJob không hủy; mentorNetFromBooking ra đúng share − platformFee;
 * báo cáo tài chính không cộng trùng.
 * Dùng replica set vì tryCreditMentorForCompletedBooking chạy trong transaction.
 */
import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyTestEnv, mintAccessToken, startHttpServer, stopHttpServer } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";

let mongo, db, models, http, admin;
let money, earnings, runStaleSweep;

before(async () => {
  const { MongoMemoryReplSet } = await import("mongodb-memory-server");
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  db = (await import("mongoose")).default;
  await db.connect(mongo.getUri());
  models = await import("../models/index.js");
  await Promise.all(Object.values(models).filter((m) => m?.modelName).map((m) => m.init()));
  money = await import("../utils/learningPathBookingMoney.js");
  earnings = await import("../services/mentorEarningsService.js");
  ({ runStaleSweep } = await import("../jobs/bookingStaleSweepJob.js"));
  http = await startHttpServer((await import("../app.js")).createApp());
  admin = await models.User.create({ name: "Admin LP-04", email: "admin-lp04@test.local", role: "admin" });
});

after(async () => {
  if (http) await stopHttpServer(http.server);
  if (db) await db.disconnect();
  if (mongo) await mongo.stop();
});

let seq = 0;
async function fixture() {
  seq += 1;
  const customer = await models.User.create({ name: `Ứng viên ${seq}`, email: `lp04-c${seq}@test.local`, role: "customer" });
  const owner = await models.User.create({ name: `Mentor ${seq}`, email: `lp04-m${seq}@test.local`, role: "mentor" });
  const mentor = await models.Mentor.findOneAndUpdate(
    { userId: owner._id },
    { $set: { name: `Mentor ${seq}`, publicId: `lp04-${seq}`, isActive: true } },
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
  return { customer, mentor, path };
}

let slot = 0;
/** Ngày và giờ lấy từ đúng thời điểm đích (giờ local) để không phụ thuộc múi giờ máy chạy test (CI: UTC). */
function schedule(daysAgo = 2) {
  slot += 1;
  const d = new Date(Date.now() - daysAgo * 86400000 + slot * 60_000);
  const pad = (n) => String(n).padStart(2, "0");
  return {
    date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    timeSlot: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    durationMinutes: 60,
  };
}

async function pathBooking(f, { shareAmount, status = "confirmed", order = 1, daysAgo = 2, extra = {} }) {
  const session = await models.LearningPathSession.create({ pathId: f.path._id, order, title: `Buổi ${order}`, shareAmount, status: "scheduled" });
  return models.Booking.create({
    userId: f.customer._id,
    mentorId: f.mentor._id,
    sessionType: "mock_interview",
    status,
    learningPathId: f.path._id,
    learningPathSessionId: session._id,
    ...schedule(daysAgo),
    ...money.learningPathBookingMoney({ shareAmount, platformFeeRate: f.path.platformFeeRate }),
    ...extra,
  });
}

async function assessmentBooking(f, { status = "confirmed", daysAgo = 2, extra = {} } = {}) {
  return models.Booking.create({
    userId: f.customer._id,
    mentorId: f.mentor._id,
    mentorshipRequestId: f.path.mentorshipRequestId,
    sessionType: "assessment",
    status,
    ...schedule(daysAgo),
    ...money.assessmentBookingMoney(),
    ...extra,
  });
}

describe("learningPathBookingMoney (LP-04)", () => {
  it("ghi đủ field tiền: price = totalAmount = share, platformFee = round(share × rate), vat 0, paid", () => {
    const m = money.learningPathBookingMoney({ shareAmount: 333_334, platformFeeRate: 0.3 });
    assert.equal(m.price, 333_334);
    assert.equal(m.totalAmount, 333_334);
    assert.equal(m.platformFee, 100_000);
    assert.equal(m.vat, 0);
    assert.equal(m.paymentStatus, "paid");
    assert.equal(m.paymentMethod, "learning_path");
    assert.equal(earnings.mentorNetFromBooking(m), 333_334 - 100_000);
  });

  it("buổi học lại (share 0) và buổi 0đ: mọi field tiền bằng 0", () => {
    for (const m of [money.learningPathBookingMoney({ shareAmount: 0, platformFeeRate: 0.3 }), money.assessmentBookingMoney()]) {
      for (const k of ["price", "totalAmount", "platformFee", "vat", "discountAmount", "couponDiscountAmount"]) assert.equal(m[k], 0, k);
      assert.equal(m.paymentStatus, "paid");
      assert.equal(earnings.mentorNetFromBooking(m), 0);
    }
  });

  it("từ chối share không nguyên / âm và rate ngoài [0, 1]", () => {
    assert.throws(() => money.learningPathBookingMoney({ shareAmount: 1000.5, platformFeeRate: 0.3 }), RangeError);
    assert.throws(() => money.learningPathBookingMoney({ shareAmount: -1, platformFeeRate: 0.3 }), RangeError);
    assert.throws(() => money.learningPathBookingMoney({ shareAmount: 1000, platformFeeRate: 1.5 }), RangeError);
    assert.throws(() => money.learningPathBookingMoney({ shareAmount: 1000 }), RangeError);
  });

  it("isLearningPathOrAssessmentBooking nhận đúng booking lộ trình, buổi 0đ; booking thường thì không", () => {
    assert.equal(money.isLearningPathOrAssessmentBooking({ learningPathId: "x" }), true);
    assert.equal(money.isLearningPathOrAssessmentBooking({ sessionType: "assessment" }), true);
    assert.equal(money.isLearningPathOrAssessmentBooking({ paymentMethod: "learning_path" }), true);
    assert.equal(money.isLearningPathOrAssessmentBooking({ sessionType: "mock_interview", paymentMethod: "transfer" }), false);
    assert.equal(money.isLearningPathOrAssessmentBooking(null), false);
  });
});

describe("Booking lưu field lộ trình (LP-04)", () => {
  it("lưu được sessionType assessment, learningPathId, learningPathSessionId, paymentMethod learning_path", async () => {
    const f = await fixture();
    const b = await pathBooking(f, { shareAmount: 333_333 });
    const a = await assessmentBooking(f);
    const saved = await models.Booking.findById(b._id).lean();
    assert.equal(String(saved.learningPathId), String(f.path._id));
    assert.ok(saved.learningPathSessionId);
    assert.equal(saved.paymentMethod, "learning_path");
    assert.equal(saved.mentorshipRequestId, undefined);
    assert.equal((await models.Booking.findById(a._id).lean()).sessionType, "assessment");
  });

  it("buổi 0đ và booking thường cùng một yêu cầu không lỗi E11000 (index LP-02)", async () => {
    const f = await fixture();
    await assessmentBooking(f, { status: "completed" });
    await models.Booking.create({
      userId: f.customer._id,
      mentorId: f.mentor._id,
      mentorshipRequestId: f.path.mentorshipRequestId,
      sessionType: "career_consulting",
      status: "pending",
      ...schedule(-3),
      price: 200_000,
      platformFee: 60_000,
      vat: 0,
      totalAmount: 200_000,
    });
  });
});

describe("bookingStaleSweepJob không hủy buổi lộ trình và buổi 0đ (LP-04)", () => {
  it("booking lộ trình / buổi 0đ đã qua giờ vẫn giữ trạng thái; booking thường chưa trả thì bị hủy", async () => {
    const f = await fixture();
    const pathRow = await pathBooking(f, { shareAmount: 333_333, status: "pending", order: 1, daysAgo: 1 });
    const retakeRow = await pathBooking(f, { shareAmount: 0, status: "confirmed", order: 2, daysAgo: 1 });
    const assessRow = await assessmentBooking(f, { status: "pending", daysAgo: 1 });
    const unpaid = await models.Booking.create({
      userId: f.customer._id,
      mentorId: f.mentor._id,
      sessionType: "mock_interview",
      status: "pending",
      paymentStatus: "pending",
      ...schedule(1),
      price: 100_000,
      platformFee: 30_000,
      vat: 0,
      totalAmount: 100_000,
    });

    await runStaleSweep(new Date());

    for (const row of [pathRow, retakeRow, assessRow]) {
      const after = await models.Booking.findById(row._id).lean();
      assert.notEqual(after.status, "cancelled", `${row.sessionType} bị hủy nhầm`);
      assert.equal(after.paymentStatus, "paid");
    }
    assert.equal((await models.Booking.findById(unpaid._id).lean()).status, "cancelled");
  });
});

describe("Thu nhập mentor từ booking lộ trình (LP-04)", () => {
  it("buổi lộ trình completed: mentor nhận đúng share − platformFee; buổi học lại và buổi 0đ: 0", async () => {
    const f = await fixture();
    const extra = { completedAt: new Date() };
    const paid = await pathBooking(f, { shareAmount: 333_334, status: "completed", order: 1, extra });
    const retake = await pathBooking(f, { shareAmount: 0, status: "completed", order: 2, extra });
    const assess = await assessmentBooking(f, { status: "completed", extra });

    for (const row of [paid, retake, assess]) await earnings.tryCreditMentorForCompletedBooking(String(row._id));

    const mentor = await models.Mentor.findById(f.mentor._id).lean();
    assert.equal(mentor.finance.clearingBalance, 333_334 - 100_000);
    assert.equal((await models.Booking.findById(paid._id).lean()).earningsNetAmount, 233_334);
    for (const row of [retake, assess]) {
      const after = await models.Booking.findById(row._id).lean();
      assert.ok(after.mentorEarningsCreditedAt, "booking 0đ phải được đánh dấu đã xử lý");
      assert.equal(after.earningsNetAmount, undefined);
    }
  });
});

describe("Báo cáo tài chính admin không cộng trùng (LP-04)", () => {
  it("GET /api/admin/finance/platform-summary bỏ booking lộ trình và buổi 0đ", async () => {
    await models.Booking.deleteMany({});
    const f = await fixture();
    const normalCustomer = await models.User.create({ name: "Khách thường", email: "lp04-normal@test.local", role: "customer" });
    await models.Booking.create({
      userId: normalCustomer._id,
      mentorId: f.mentor._id,
      sessionType: "mock_interview",
      status: "completed",
      paymentStatus: "paid",
      paymentMethod: "transfer",
      paidAt: new Date(),
      ...schedule(3),
      price: 200_000,
      platformFeeRate: 0.3,
      platformFee: 60_000,
      vat: 0,
      totalAmount: 200_000,
    });
    await pathBooking(f, { shareAmount: 333_334, status: "completed", order: 1 });
    await pathBooking(f, { shareAmount: 0, status: "completed", order: 2 });
    await assessmentBooking(f, { status: "completed" });

    const res = await fetch(`${http.baseUrl}/api/admin/finance/platform-summary`, {
      headers: { Authorization: `Bearer ${mintAccessToken(admin._id)}` },
    });
    const body = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body));
    const { booking, totals } = body.platformFinance;
    assert.equal(booking.count, 1);
    assert.equal(booking.grossCollected, 200_000);
    assert.equal(booking.platformRevenue, 60_000);
    assert.equal(booking.mentorNet, 140_000);
    // Ứng viên chỉ học lộ trình / buổi 0đ không bị đếm là khách trả tiền qua booking.
    assert.equal(totals.paidCustomerCount, 1);
  });
});

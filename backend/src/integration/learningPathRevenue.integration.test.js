/**
 * LP-16 (A-05, M-06): doanh thu lộ trình trong báo cáo tài chính admin (`GET /api/admin/finance/platform-summary`)
 * và thu nhập mentor tách theo lộ trình (`GET /api/mentor/finance`).
 * Xong khi: số khớp tổng Payment `learning_path`, không cộng thêm booking `paymentMethod: learning_path`.
 */
import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer } from "../test_helpers/mongoTestHarness.js";
import { getRevenueBySource, resolveRevenuePeriod } from "../services/revenueAnalyticsService.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";

let harness, http, models, admin, customer, mentorUser, mentor;
let slotSeq = 0;
let paySeq = 0;

async function call(user, url) {
  const res = await fetch(`${http.baseUrl}${url}`, { headers: { Authorization: `Bearer ${mintAccessToken(user._id)}` } });
  return { status: res.status, ...(await res.json()) };
}

function booking(fields) {
  slotSeq += 1;
  return models.Booking.create({
    userId: customer._id,
    mentorId: mentor._id,
    date: "01/01/2026",
    timeSlot: `${String(slotSeq % 24).padStart(2, "0")}:${String(slotSeq).padStart(2, "0").slice(-2)}`,
    durationMinutes: 60,
    sessionType: "mock_interview",
    status: "completed",
    paymentStatus: "paid",
    vat: 0,
    paidAt: new Date(),
    ...fields,
  });
}

function payment(fields) {
  paySeq += 1;
  return models.Payment.create({
    userId: customer._id,
    referenceId: new mongoose.Types.ObjectId(),
    provider: "transfer",
    providerRef: `PILP16${String(paySeq).padStart(4, "0")}`,
    paidAt: new Date(),
    ...fields,
  });
}

/** Lộ trình đã thu trọn gói, chia đều cho các buổi gốc, kèm một buổi học lại 0đ. */
async function paidPath({ totalAmount, rate, shares, status = "success", refundAmount = 0, providerRef }) {
  const path = await models.LearningPath.create({
    candidateId: customer._id,
    mentorId: mentor._id,
    mentorshipRequestId: new mongoose.Types.ObjectId(),
    status: "active",
    totalAmount,
    platformFeeRate: rate,
    paidAt: new Date(),
  });
  await models.LearningPathSession.insertMany([
    ...shares.map((shareAmount, i) => ({ pathId: path._id, order: i + 1, title: `Buổi ${i + 1}`, shareAmount, attempt: 1 })),
    { pathId: path._id, order: 1, title: "Học lại", shareAmount: 0, attempt: 2 },
  ]);
  await payment({
    type: "learning_path",
    referenceId: path._id,
    referenceModel: "LearningPath",
    amount: totalAmount,
    status,
    refundAmount,
    ...(providerRef && { providerRef }),
  });
  return path;
}

before(async () => {
  harness = await startMongoHarness();
  models = await import("../models/index.js");
  await Promise.all(Object.values(models).filter((m) => m?.modelName).map((m) => m.init()));
  admin = await models.User.create({ name: "Admin LP16", email: "lp16-admin@test.local", role: "admin" });
  customer = await models.User.create({ name: "Khách LP16", email: "lp16-customer@test.local", role: "customer" });
  mentorUser = await models.User.create({ name: "Mentor LP16", email: "lp16-mentor@test.local", role: "mentor" });
  mentor = await models.Mentor.findOneAndUpdate(
    { userId: mentorUser._id },
    { $set: { userId: mentorUser._id, name: "Mentor LP16", publicId: "lp16-mentor", isActive: true, isVerified: true } },
    { upsert: true, returnDocument: "after" },
  );

  // Lộ trình 1: 900.000đ, phí 20% → mỗi buổi 300.000, phí 60.000 → phí nền tảng 180.000.
  const p1 = await paidPath({ totalAmount: 900_000, rate: 0.2, shares: [300_000, 300_000, 300_000] });
  // Lộ trình 2: hoàn một phần 200.000 → giữ 400.000; phí 2 × 60.000 = 120.000 (≤ 400.000).
  await paidPath({ totalAmount: 600_000, rate: 0.2, shares: [300_000, 300_000], status: "partial_refund", refundAmount: 200_000 });
  // Không tính: Payment demo, Payment chưa thành công.
  await paidPath({ totalAmount: 5_000_000, rate: 0.2, shares: [5_000_000], providerRef: "UIMOCK-LP16" });
  await paidPath({ totalAmount: 7_000_000, rate: 0.2, shares: [7_000_000], status: "pending" });

  // Booking của lộ trình 1 đã học (đã nằm trong Payment trọn gói, không được cộng thêm) + buổi học lại 0đ + buổi 0đ.
  await booking({ price: 300_000, totalAmount: 300_000, platformFee: 60_000, paymentMethod: "learning_path", learningPathId: p1._id });
  await booking({ price: 300_000, totalAmount: 300_000, platformFee: 60_000, paymentMethod: "learning_path", learningPathId: p1._id });
  await booking({ price: 0, totalAmount: 0, platformFee: 0, paymentMethod: "learning_path", learningPathId: p1._id });
  await booking({ sessionType: "assessment", price: 0, totalAmount: 0, platformFee: 0 });
  // Booking thường: 500.000, phí 150.000.
  await booking({ price: 500_000, totalAmount: 500_000, platformFee: 150_000 });

  http = await startHttpServer((await import("../app.js")).createApp());
});

after(async () => {
  if (http) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

describe("LP-16 — doanh thu lộ trình trong báo cáo tài chính admin", () => {
  it("khối learningPath khớp tổng Payment learning_path (trừ hoàn, bỏ demo / chưa thu); booking lộ trình không cộng trùng", async () => {
    const res = await call(admin, "/api/admin/finance/platform-summary");
    assert.equal(res.status, 200, res.error);
    const { learningPath, booking, totals } = res.platformFinance;

    assert.equal(learningPath.count, 2);
    assert.equal(learningPath.grossCollected, 900_000 + 400_000);
    assert.equal(learningPath.platformRevenue, 180_000 + 120_000);
    assert.equal(learningPath.mentorNet, learningPath.grossCollected - learningPath.platformRevenue);

    // Truy vấn tay trên Payment
    const rows = await models.Payment.find({ type: "learning_path", status: { $in: ["success", "partial_refund"] }, providerRef: { $not: /^UIMOCK-/i } }).lean();
    assert.equal(learningPath.grossCollected, rows.reduce((s, p) => s + p.amount - (p.refundAmount || 0), 0));

    assert.equal(booking.count, 1, "chỉ booking thường, không có booking lộ trình hay buổi 0đ");
    assert.equal(booking.grossCollected, 500_000);
    assert.equal(totals.grossCollected, booking.grossCollected + learningPath.grossCollected + res.platformFinance.course.grossCollected + res.platformFinance.subscription.grossCollected);
    assert.equal(totals.platformRevenue, 150_000 + 300_000);
  });

  it("khớp số với analytics doanh thu theo nguồn (N-08) — hai trang dùng chung công thức", async () => {
    const admin2 = await call(admin, "/api/admin/finance/platform-summary");
    const analytics = await getRevenueBySource(resolveRevenuePeriod({ days: 30 }).period);
    const lp = analytics.sources.find((s) => s.key === "learning_path");
    assert.equal(lp.grossCollected, admin2.platformFinance.learningPath.grossCollected);
    assert.equal(lp.platformRevenue, admin2.platformFinance.learningPath.platformRevenue);
  });

  it("lọc theo tháng: tháng trước không có lộ trình nào", async () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const res = await call(admin, `/api/admin/finance/platform-summary?month=${month}`);
    assert.equal(res.status, 200, res.error);
    assert.equal(res.platformFinance.learningPath.count, 0);
  });
});

describe("LP-16 — thu nhập mentor theo lộ trình", () => {
  it("incomeBreakdown tách learningPath khỏi booking; lịch sử không có dòng 0đ, buổi lộ trình ghi rõ", async () => {
    const res = await call(mentorUser, "/api/mentor/finance");
    assert.equal(res.status, 200, res.error);
    const { incomeBreakdown, history } = res.finance;
    assert.equal(incomeBreakdown.learningPath, 2 * (300_000 - 60_000));
    assert.equal(incomeBreakdown.booking, 500_000 - 150_000);

    const incomes = history.filter((h) => h.type === "income");
    assert.ok(incomes.every((h) => h.amount > 0), "không hiện buổi 0đ / học lại");
    assert.equal(incomes.filter((h) => h.description === "Thu từ buổi lộ trình").length, 2);
    assert.equal(incomes.filter((h) => h.description === "Thu từ booking").length, 1);
  });
});

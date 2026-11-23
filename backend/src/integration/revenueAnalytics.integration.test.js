/**
 * N-08 (A-05): doanh thu theo nguồn `GET /api/admin/analytics/revenue`.
 * Xong khi: số khớp truy vấn tay trên DB — mỗi nguồn được đối chiếu với một aggregate viết tay
 * trên đúng collection, và booking lộ trình / buổi 0đ không bị cộng trùng.
 */
import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer } from "../test_helpers/mongoTestHarness.js";
import { resolveRevenuePeriod, vnDayKey, learningPathPlatformFee } from "../services/revenueAnalyticsService.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";

let harness, http, models, admin, customer, mentor, course;
const DAY = 86_400_000;
const daysAgo = (n) => new Date(Date.now() - n * DAY);
let slotSeq = 0;
let userSeq = 0;

async function call(user, url) {
  const res = await fetch(`${http.baseUrl}${url}`, {
    headers: user ? { Authorization: `Bearer ${mintAccessToken(user._id)}` } : {},
  });
  return { status: res.status, ...(await res.json()) };
}

async function newUser() {
  userSeq += 1;
  return models.User.create({ name: `Rev ${userSeq}`, email: `n08-user-${userSeq}@test.local`, role: "customer" });
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
    vat: 0,
    ...fields,
  });
}

async function enrollment(fields) {
  return models.Enrollment.create({ userId: (await newUser())._id, courseId: course._id, ...fields });
}

let paySeq = 0;
function payment(fields) {
  paySeq += 1;
  return models.Payment.create({
    userId: customer._id,
    referenceId: new mongoose.Types.ObjectId(),
    provider: "transfer",
    providerRef: `PIN08${String(paySeq).padStart(4, "0")}`,
    ...fields,
  });
}

/** Lộ trình đã thu trọn gói: `totalAmount` chia cho `shares` (buổi gốc) + một buổi học lại 0đ. */
async function paidLearningPath({ totalAmount, rate, shares, paidAt, refundAmount = 0, status = "success" }) {
  const path = await models.LearningPath.create({
    candidateId: customer._id,
    mentorId: mentor._id,
    mentorshipRequestId: new mongoose.Types.ObjectId(),
    status: "active",
    totalAmount,
    platformFeeRate: rate,
    paidAt,
  });
  await models.LearningPathSession.insertMany([
    ...shares.map((shareAmount, i) => ({ pathId: path._id, order: i + 1, title: `Buổi ${i + 1}`, shareAmount, attempt: 1 })),
    { pathId: path._id, order: 1, title: "Học lại", shareAmount: 0, attempt: 2 },
  ]);
  await payment({ type: "learning_path", referenceId: path._id, referenceModel: "LearningPath", amount: totalAmount, status, paidAt, refundAmount });
  return path;
}

/** Truy vấn tay: tổng tiền thực giữ lại của từng nguồn trong `[start, end)`. */
async function manualGross(start, end) {
  const range = { $gte: start, $lt: end };
  const inRange = { $or: [{ paidAt: range }, { paidAt: null, createdAt: range }] };
  const sum = async (Model, match, expr) => {
    const rows = await Model.aggregate([{ $match: { ...match, ...inRange } }, { $group: { _id: null, total: { $sum: expr }, count: { $sum: 1 } } }]);
    return { total: rows[0]?.total || 0, count: rows[0]?.count || 0 };
  };
  const minusRefund = (field, refund) => ({ $max: [0, { $subtract: [field, { $ifNull: [refund, 0] }] }] });
  return {
    booking: await sum(
      models.Booking,
      { paymentStatus: { $in: ["paid", "partial_refund"] }, paymentMethod: { $ne: "learning_path" }, sessionType: { $ne: "assessment" } },
      minusRefund("$totalAmount", "$cancelRefundAmountVnd"),
    ),
    course: await sum(models.Enrollment, { paymentStatus: "paid", pricePaid: { $gt: 0 } }, "$pricePaid"),
    subscription: await sum(models.Payment, { type: "subscription", status: "success", providerRef: { $not: /^UIMOCK-/i } }, minusRefund("$amount", "$refundAmount")),
    learning_path: await sum(
      models.Payment,
      { type: "learning_path", status: { $in: ["success", "partial_refund"] }, providerRef: { $not: /^UIMOCK-/i } },
      minusRefund("$amount", "$refundAmount"),
    ),
  };
}

before(async () => {
  harness = await startMongoHarness();
  models = await import("../models/index.js");
  await Promise.all(Object.values(models).filter((m) => m?.modelName).map((m) => m.init()));
  admin = await models.User.create({ name: "Admin N08", email: "n08-admin@test.local", role: "admin" });
  customer = await models.User.create({ name: "Khách N08", email: "n08-customer@test.local", role: "customer" });
  const mentorUser = await models.User.create({ name: "Mentor N08", email: "n08-mentor@test.local", role: "mentor" });
  mentor = await models.Mentor.findOneAndUpdate(
    { userId: mentorUser._id },
    { $set: { userId: mentorUser._id, name: "Mentor N08", publicId: "n08-mentor", isActive: true } },
    { upsert: true, returnDocument: "after" },
  );
  course = await models.Course.create({ mentorId: mentor._id, title: "Khóa N08", level: "basic" });

  // ── Booking ──
  await booking({ price: 500_000, totalAmount: 500_000, platformFee: 150_000, paymentStatus: "paid", paidAt: daysAgo(1) });
  // Hoàn 200k → giữ 200k; phí gốc 120k vẫn ≤ 200k.
  await booking({ price: 400_000, totalAmount: 400_000, platformFee: 120_000, paymentStatus: "partial_refund", cancelRefundAmountVnd: 200_000, paidAt: daysAgo(2) });
  // Không có paidAt → dùng createdAt (vừa tạo, trong kỳ).
  await booking({ price: 100_000, totalAmount: 100_000, platformFee: 30_000, paymentStatus: "paid" });
  // Không tính: chưa trả, đã hoàn hết, ngoài kỳ, booking lộ trình, buổi 0đ.
  await booking({ price: 900_000, totalAmount: 900_000, platformFee: 270_000, paymentStatus: "pending" });
  await booking({ price: 900_000, totalAmount: 900_000, platformFee: 270_000, paymentStatus: "refunded", paidAt: daysAgo(1) });
  await booking({ price: 700_000, totalAmount: 700_000, platformFee: 210_000, paymentStatus: "paid", paidAt: daysAgo(45) });
  await booking({ price: 333_333, totalAmount: 333_333, platformFee: 66_667, paymentStatus: "paid", paymentMethod: "learning_path", learningPathId: new mongoose.Types.ObjectId(), paidAt: daysAgo(1) });
  await booking({ sessionType: "assessment", price: 0, totalAmount: 0, platformFee: 0, paymentStatus: "paid", paidAt: daysAgo(1) });

  // ── Khóa học ──
  await enrollment({ pricePaid: 299_000, platformFee: 104_650, paymentStatus: "paid", paidAt: daysAgo(3) });
  await enrollment({ pricePaid: 199_000, paymentStatus: "paid", paidAt: daysAgo(4) }); // thiếu platformFee → 35%
  await enrollment({ pricePaid: 0, paymentStatus: "paid", paidAt: daysAgo(4) }); // khóa miễn phí
  await enrollment({ pricePaid: 499_000, paymentStatus: "pending" });

  // ── Gói ──
  await payment({ type: "subscription", amount: 99_000, status: "success", paidAt: daysAgo(5) });
  await payment({ type: "subscription", amount: 199_000, status: "success", paidAt: daysAgo(6) });
  await payment({ type: "subscription", amount: 199_000, status: "success", paidAt: daysAgo(6), providerRef: "UIMOCK-N08-1" });
  await payment({ type: "subscription", amount: 99_000, status: "pending" });

  // ── Lộ trình ──
  await paidLearningPath({ totalAmount: 1_000_000, rate: 0.2, shares: [333_333, 333_333, 333_334], paidAt: daysAgo(2) });
  await paidLearningPath({ totalAmount: 600_000, rate: 0.25, shares: [300_000, 300_000], paidAt: daysAgo(3), refundAmount: 300_000, status: "partial_refund" });
  await payment({ type: "learning_path", amount: 800_000, status: "pending" });

  http = await startHttpServer((await import("../app.js")).createApp());
});

after(async () => {
  if (http) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

describe("Quyền và tham số (N-08)", () => {
  it("chỉ admin xem được", async () => {
    assert.equal((await call(null, "/api/admin/analytics/revenue")).status, 401);
    assert.equal((await call(customer, "/api/admin/analytics/revenue")).status, 403);
  });

  it("tham số sai trả 400 tiếng Việt", async () => {
    for (const q of ["days=0", "days=abc", "days=400", "month=2026-13", "month=11-2026", "month=2999-01"]) {
      const res = await call(admin, `/api/admin/analytics/revenue?${q}`);
      assert.equal(res.status, 400, q);
      assert.equal(res.success, false);
      assert.ok(res.error);
    }
  });

  it("days tính cả hôm nay theo giờ Việt Nam; month là trọn tháng giờ Việt Nam", () => {
    const now = new Date("2026-11-23T20:00:00Z"); // 03:00 ngày 24/11 giờ VN
    const byDays = resolveRevenuePeriod({ days: 7 }, now).period;
    assert.equal(byDays.end.toISOString(), "2026-11-24T17:00:00.000Z");
    assert.equal(byDays.start.toISOString(), "2026-11-17T17:00:00.000Z");
    assert.equal(vnDayKey(now), "2026-11-24");
    const byMonth = resolveRevenuePeriod({ month: "2026-02" }, now).period;
    assert.equal(byMonth.start.toISOString(), "2026-01-31T17:00:00.000Z");
    assert.equal(byMonth.end.toISOString(), "2026-02-28T17:00:00.000Z");
    assert.equal(byMonth.days, 28);
  });
});

describe("Doanh thu theo nguồn khớp truy vấn tay (N-08)", () => {
  it("30 ngày: mỗi nguồn bằng aggregate tay, tổng bằng cộng các nguồn", async () => {
    const res = await call(admin, "/api/admin/analytics/revenue?days=30");
    assert.equal(res.status, 200, res.error);
    const { revenue } = res;
    const bySource = Object.fromEntries(revenue.sources.map((s) => [s.key, s]));
    assert.deepEqual(Object.keys(bySource), ["booking", "course", "subscription", "learning_path"]);

    const manual = await manualGross(new Date(revenue.period.startAt), new Date(revenue.period.endAt));
    for (const key of Object.keys(manual)) {
      assert.equal(bySource[key].grossCollected, manual[key].total, `gross ${key}`);
      assert.equal(bySource[key].count, manual[key].count, `count ${key}`);
    }

    // Giá trị cụ thể, tính tay từ dữ liệu mẫu.
    assert.equal(bySource.booking.grossCollected, 500_000 + 200_000 + 100_000);
    assert.equal(bySource.booking.platformRevenue, 150_000 + 120_000 + 30_000);
    assert.equal(bySource.course.grossCollected, 299_000 + 199_000);
    assert.equal(bySource.course.platformRevenue, 104_650 + Math.round(199_000 * 0.35));
    assert.equal(bySource.subscription.grossCollected, 99_000 + 199_000);
    assert.equal(bySource.subscription.platformRevenue, 99_000 + 199_000);
    assert.equal(bySource.subscription.mentorNet, 0);
    assert.equal(bySource.learning_path.grossCollected, 1_000_000 + 300_000);
    assert.equal(bySource.learning_path.count, 2);
    // Phí từng buổi gốc: round(333.333×0,2)×2 + round(333.334×0,2); lộ trình 2: 2 × 75.000 (buổi học lại 0đ không tính).
    assert.equal(bySource.learning_path.platformRevenue, 66_667 * 2 + 66_667 + 150_000);

    for (const s of revenue.sources) assert.equal(s.platformRevenue + s.mentorNet, s.grossCollected, s.key);
    const sum = (f) => revenue.sources.reduce((acc, s) => acc + s[f], 0);
    assert.equal(revenue.totals.grossCollected, sum("grossCollected"));
    assert.equal(revenue.totals.platformRevenue, sum("platformRevenue"));
    assert.equal(revenue.totals.mentorNet, sum("mentorNet"));
    assert.equal(revenue.totals.count, sum("count"));
    assert.equal(Math.round(sum("sharePct")), 100);
  });

  it("booking lộ trình và buổi 0đ không bị cộng trùng vào nguồn booking", async () => {
    const { revenue } = await call(admin, "/api/admin/analytics/revenue?days=30");
    const lpBookings = await models.Booking.aggregate([
      { $match: { paymentMethod: "learning_path" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);
    assert.equal(lpBookings[0].total, 333_333);
    const bookingSource = revenue.sources.find((s) => s.key === "booking");
    assert.equal(bookingSource.grossCollected, 800_000);
    assert.equal(revenue.totals.grossCollected, 800_000 + 498_000 + 298_000 + 1_300_000);
  });

  it("chuỗi theo ngày: đủ số ngày, cộng lại bằng tổng từng nguồn", async () => {
    const { revenue } = await call(admin, "/api/admin/analytics/revenue?days=30");
    assert.equal(revenue.series.length, 30);
    assert.equal(revenue.series.at(-1).date, vnDayKey(new Date()));
    for (const s of revenue.sources) {
      assert.equal(revenue.series.reduce((acc, d) => acc + d[s.key], 0), s.grossCollected, s.key);
    }
    for (const d of revenue.series) {
      assert.equal(d.total, d.booking + d.course + d.subscription + d.learning_path);
    }
  });

  it("kỳ 60 ngày có thêm booking 45 ngày trước; kỳ 1 ngày chỉ còn giao dịch hôm nay", async () => {
    const wide = (await call(admin, "/api/admin/analytics/revenue?days=60")).revenue;
    assert.equal(wide.sources.find((s) => s.key === "booking").grossCollected, 800_000 + 700_000);
    const today = (await call(admin, "/api/admin/analytics/revenue?days=1")).revenue;
    const manual = await manualGross(new Date(today.period.startAt), new Date(today.period.endAt));
    for (const s of today.sources) assert.equal(s.grossCollected, manual[s.key].total, s.key);
  });

  it("month: tháng chưa có giao dịch trả 0 cho mọi nguồn", async () => {
    const res = await call(admin, "/api/admin/analytics/revenue?month=2020-01");
    assert.equal(res.status, 200, res.error);
    assert.equal(res.revenue.period.month, "2020-01");
    assert.equal(res.revenue.totals.grossCollected, 0);
    assert.equal(res.revenue.series.length, 31);
    for (const s of res.revenue.sources) assert.equal(s.sharePct, 0);
  });
});

describe("Trang tài chính cũ dùng chung công thức (N-08)", () => {
  it("platform-summary: enrollment chưa ghi platformFee (null) tính theo tỉ lệ, khớp API doanh thu theo nguồn", async () => {
    const summary = await call(admin, "/api/admin/finance/platform-summary");
    assert.equal(summary.status, 200, summary.error);
    const fin = summary.platformFinance;
    // Trước N-08: Number(null) = 0 → enrollment 199.000đ bị tính phí 0%.
    assert.equal(fin.course.platformRevenue, 104_650 + Math.round(199_000 * 0.35));
    assert.equal(fin.course.mentorNet, 299_000 + 199_000 - fin.course.platformRevenue);

    // Mọi dữ liệu mẫu nằm trong 366 ngày → so với API mới cho booking và khóa học.
    const { revenue } = await call(admin, "/api/admin/analytics/revenue?days=366");
    for (const key of ["booking", "course"]) {
      const src = revenue.sources.find((s) => s.key === key);
      assert.equal(fin[key].grossCollected, src.grossCollected, `${key} gross`);
      assert.equal(fin[key].platformRevenue, src.platformRevenue, `${key} platformRevenue`);
      assert.equal(fin[key].mentorNet, src.mentorNet, `${key} mentorNet`);
    }
  });
});

describe("bookingRevenueRow / courseRevenueRow (N-08)", () => {
  it("phí null/thiếu → theo tỉ lệ; phí 0 là 0; phí kẹp trong [0, gross]; trừ tiền hoàn", async () => {
    const { bookingRevenueRow, courseRevenueRow } = await import("../services/revenueAnalyticsService.js");
    assert.deepEqual(courseRevenueRow({ pricePaid: 100_000, platformFee: null }), { gross: 100_000, fee: 35_000 });
    assert.deepEqual(courseRevenueRow({ pricePaid: 100_000, platformFee: null, platformFeeRate: 0.2 }), { gross: 100_000, fee: 20_000 });
    assert.deepEqual(courseRevenueRow({ pricePaid: 100_000, platformFee: 0 }), { gross: 100_000, fee: 0 });
    assert.deepEqual(courseRevenueRow({ pricePaid: 100_000, platformFee: 150_000 }), { gross: 100_000, fee: 100_000 });
    assert.deepEqual(bookingRevenueRow({ totalAmount: 400_000, platformFee: 120_000, cancelRefundAmountVnd: 350_000 }), { gross: 50_000, fee: 50_000 });
    assert.deepEqual(bookingRevenueRow({ price: 300_000, platformFee: undefined }), { gross: 300_000, fee: 90_000 });
  });
});

describe("learningPathPlatformFee (N-08)", () => {
  it("tổng phí các buổi gốc; không có buổi thì coi cả gói là 1 buổi", () => {
    assert.equal(learningPathPlatformFee({ platformFeeRate: 0.2 }, [{ shareAmount: 333_333 }, { shareAmount: 333_334 }]), 66_667 * 2);
    assert.equal(learningPathPlatformFee({ totalAmount: 1_000_000, platformFeeRate: 0.3 }, []), 300_000);
    assert.equal(learningPathPlatformFee({ totalAmount: 1_000_000 }, []), 0);
  });
});

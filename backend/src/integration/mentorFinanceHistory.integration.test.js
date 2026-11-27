/**
 * M-06: lịch sử tài chính mentor (`GET /api/mentor/finance`) hiện đúng số đã ghi vào ví:
 * học viên trả, phí nền tảng, thực nhận, trạng thái giữ tiền; khoản chưa ghi vào ví tách riêng;
 * tổng trong ví lệch tổng giao dịch thì `reconciliation.difference` ≠ 0.
 */
import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";

let harness, http, models, customer, mentorUser, mentor, course;
let slotSeq = 0;
const DAY = 86400000;

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
    timeSlot: `${String(slotSeq).padStart(2, "0")}:00`,
    durationMinutes: 60,
    sessionType: "mock_interview",
    status: "completed",
    paymentStatus: "paid",
    vat: 0,
    ...fields,
  });
}

before(async () => {
  harness = await startMongoHarness();
  models = await import("../models/index.js");
  await Promise.all(Object.values(models).filter((m) => m?.modelName).map((m) => m.init()));
  customer = await models.User.create({ name: "Trần Văn B", email: "fin-hist-customer@test.local", role: "customer" });
  mentorUser = await models.User.create({ name: "Mentor Fin", email: "fin-hist-mentor@test.local", role: "mentor" });
  mentor = await models.Mentor.findOneAndUpdate(
    { userId: mentorUser._id },
    { $set: { userId: mentorUser._id, name: "Mentor Fin", publicId: "fin-hist-mentor", isActive: true, isVerified: true } },
    { upsert: true, returnDocument: "after" },
  );
  course = await models.Course.create({ mentorId: mentor._id, title: "Luyện phỏng vấn React", price: 100000, level: "basic", status: "published" });

  const now = Date.now();
  // 1. Đang giữ: ghi có hôm qua, giữ thêm 6 ngày.
  await booking({ totalAmount: 350000, price: 350000, platformFee: 105000, platformFeeRate: 0.3, completedAt: new Date(now - DAY),
    mentorEarningsCreditedAt: new Date(now - DAY), earningsNetAmount: 245000, earningsClearAt: new Date(now + 6 * DAY) });
  // 2. Đã vào số dư khả dụng, ví ghi 200.000 (hoàn tiền một phần sau khi ghi có).
  await booking({ totalAmount: 300000, price: 300000, platformFee: 60000, paymentStatus: "partial_refund", completedAt: new Date(now - 10 * DAY),
    mentorEarningsCreditedAt: new Date(now - 10 * DAY), earningsNetAmount: 200000, earningsClearAt: new Date(now - 3 * DAY), earningsClearedAt: new Date(now - 3 * DAY) });
  // 3. Khóa học đã ghi có.
  await models.Enrollment.create({ userId: customer._id, courseId: course._id, paymentStatus: "paid", paymentMethod: "transfer", pricePaid: 100000,
    platformFeeRate: 0.35, platformFee: 35000, paidAt: new Date(now - 2 * DAY), mentorEarningsCreditedAt: new Date(now - 2 * DAY),
    earningsNetAmount: 65000, earningsClearAt: new Date(now + 5 * DAY) });
  // 4. Khóa học chưa từng ghi vào ví (dữ liệu cũ).
  const other = await models.User.create({ name: "Lê C", email: "fin-hist-other@test.local", role: "customer" });
  await models.Enrollment.create({ userId: other._id, courseId: course._id, paymentStatus: "paid", paymentMethod: "transfer", pricePaid: 30740,
    platformFeeRate: 0.35, platformFee: 10759, paidAt: new Date(now - 100 * DAY) });
  // 5. Buổi 0đ: không hiện.
  await booking({ sessionType: "assessment", totalAmount: 0, price: 0, platformFee: 0, mentorEarningsCreditedAt: new Date(now) });

  // Ví: 245.000 + 200.000 + 65.000 = 510.000 đã ghi; 200.000 khả dụng, 310.000 đang giữ.
  await models.Mentor.updateOne({ _id: mentor._id }, { $set: {
    "finance.totalEarned": 510000, "finance.clearingBalance": 310000, "finance.availableBalance": 200000,
    "finance.bankAccount": { bankName: "TPBank", accountNumber: "0384264611", accountName: "MENTOR FIN" },
  } });
  await models.PayoutRequest.create({ mentorId: mentor._id, amount: 150000, status: "pending",
    payoutAccount: { bankName: "TPBank", accountNumber: "0384264611", accountName: "MENTOR FIN" } });

  http = await startHttpServer((await import("../app.js")).createApp());
});

after(async () => {
  if (http) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

describe("Lịch sử tài chính mentor theo sổ ví", () => {
  it("mỗi khoản thu có học viên trả, phí, thực nhận theo ví, trạng thái giữ tiền", async () => {
    const res = await call(mentorUser, "/api/mentor/finance");
    assert.equal(res.status, 200, res.error);
    const incomes = res.finance.history.filter((h) => h.type === "income");
    assert.equal(incomes.length, 4, "không hiện buổi 0đ");

    const holding = incomes.find((h) => h.grossAmount === 350000);
    assert.equal(holding.platformFee, 105000);
    assert.equal(holding.platformFeeRate, 0.3);
    assert.equal(holding.amount, 245000);
    assert.equal(holding.earningsStatus, "holding");
    assert.equal(holding.counterpartyName, "Trần Văn B");
    assert.ok(holding.clearAt);

    const refunded = incomes.find((h) => h.grossAmount === 300000);
    assert.equal(refunded.amount, 200000, "thực nhận theo số đã ghi vào ví, không tính lại");
    assert.equal(refunded.adjustment, -40000);
    assert.equal(refunded.refunded, true);
    assert.equal(refunded.earningsStatus, "available");

    const sold = incomes.find((h) => h.source === "course" && h.credited);
    assert.equal(sold.courseTitle, "Luyện phỏng vấn React");
    assert.equal(sold.amount, 65000);

    const legacy = incomes.find((h) => h.source === "course" && !h.credited);
    assert.equal(legacy.earningsStatus, "not_credited");
    assert.equal(legacy.amount, 19981);
  });

  it("nguồn thu nhập chỉ cộng khoản đã ghi vào ví và khớp tổng trong ví", async () => {
    const { finance } = await call(mentorUser, "/api/mentor/finance");
    assert.deepEqual(finance.incomeBreakdown, { booking: 445000, learningPath: 0, course: 65000 });
    assert.equal(finance.totalEarned, 510000);
    assert.equal(finance.reconciliation.creditedTotal, 510000);
    assert.equal(finance.reconciliation.difference, 0);
    assert.equal(finance.reconciliation.notCreditedTotal, 19981);
    assert.equal(finance.reconciliation.notCreditedCount, 1);
  });

  it("ví lệch tổng giao dịch thì báo chênh lệch", async () => {
    await models.Mentor.updateOne({ _id: mentor._id }, { $set: { "finance.totalEarned": 526984 } });
    const { finance } = await call(mentorUser, "/api/mentor/finance");
    assert.equal(finance.totalEarned, 526984);
    assert.equal(finance.reconciliation.difference, 16984);
    await models.Mentor.updateOne({ _id: mentor._id }, { $set: { "finance.totalEarned": 510000 } });
  });

  it("dòng rút tiền có ngân hàng và số tài khoản đã che", async () => {
    const { finance } = await call(mentorUser, "/api/mentor/finance");
    const w = finance.history.find((h) => h.type === "withdraw");
    assert.equal(w.amount, 150000);
    assert.equal(w.bankName, "TPBank");
    assert.match(w.accountMasked, /4611$/);
    assert.ok(!String(w.accountMasked).includes("0384264611"));
  });
});

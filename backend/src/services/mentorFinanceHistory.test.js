import { test } from "node:test";
import assert from "node:assert/strict";
import { bookingIncomeRow, courseIncomeRow, EARNINGS_STATUS, summarizeIncome } from "./mentorFinanceHistory.js";

const NOW = new Date("2026-11-27T10:00:00Z");
const day = (n) => new Date(NOW.getTime() + n * 86400000);

test("buổi đã ghi có, đang giữ: thực nhận lấy từ sổ ví, có ngày hết giữ", () => {
  const row = bookingIncomeRow(
    {
      _id: "b1", totalAmount: 350000, platformFee: 105000, platformFeeRate: 0.3, sessionType: "mock_interview",
      userId: { name: "Trần Văn B" }, completedAt: day(-1), mentorEarningsCreditedAt: day(-1),
      earningsNetAmount: 245000, earningsClearAt: day(6), paymentStatus: "paid",
    },
    NOW,
  );
  assert.equal(row.source, "booking");
  assert.equal(row.grossAmount, 350000);
  assert.equal(row.platformFee, 105000);
  assert.equal(row.platformFeeRate, 0.3);
  assert.equal(row.amount, 245000);
  assert.equal(row.adjustment, 0);
  assert.equal(row.earningsStatus, EARNINGS_STATUS.HOLDING);
  assert.equal(row.counterpartyName, "Trần Văn B");
  assert.equal(row.clearAt.getTime(), day(6).getTime());
});

test("số trong ví khác (học viên trả − phí): hiện thực nhận theo ví và khoản điều chỉnh", () => {
  const row = bookingIncomeRow(
    { _id: "b2", totalAmount: 300000, platformFee: 60000, mentorEarningsCreditedAt: day(-10), earningsNetAmount: 200000,
      earningsClearAt: day(-3), earningsClearedAt: day(-3), paymentStatus: "partial_refund" },
    NOW,
  );
  assert.equal(row.amount, 200000);
  assert.equal(row.adjustment, -40000);
  assert.equal(row.refunded, true);
  assert.equal(row.earningsStatus, EARNINGS_STATUS.AVAILABLE);
});

test("đã qua ngày hết giữ nhưng chưa chuyển: hold_overdue", () => {
  const row = bookingIncomeRow(
    { _id: "b3", totalAmount: 100000, platformFee: 30000, mentorEarningsCreditedAt: day(-9), earningsNetAmount: 70000, earningsClearAt: day(-2) },
    NOW,
  );
  assert.equal(row.earningsStatus, EARNINGS_STATUS.HOLD_OVERDUE);
});

test("buổi lộ trình tách nguồn learning_path", () => {
  const row = bookingIncomeRow({ _id: "b4", learningPathId: "lp1", totalAmount: 300000, platformFee: 60000 }, NOW);
  assert.equal(row.source, "learning_path");
});

test("khóa học chưa từng ghi vào ví: not_credited, thực nhận ước tính theo phí lưu trên đơn", () => {
  const row = courseIncomeRow(
    { _id: "e1", courseId: { title: "Luyện phỏng vấn React" }, pricePaid: 30740, platformFee: 10759, paidAt: day(-100) },
    NOW,
    0.35,
  );
  assert.equal(row.id, "enrollment-e1");
  assert.equal(row.courseTitle, "Luyện phỏng vấn React");
  assert.equal(row.credited, false);
  assert.equal(row.earningsStatus, EARNINGS_STATUS.NOT_CREDITED);
  assert.equal(row.amount, 19981);
  assert.equal(row.platformFeeRate, 0.35);
});

test("khóa học không lưu phí: tính theo mức phí của mentor", () => {
  const row = courseIncomeRow({ _id: "e2", pricePaid: 100000, mentorEarningsCreditedAt: day(-1), earningsNetAmount: 65000 }, NOW, 0.35);
  assert.equal(row.platformFee, 35000);
  assert.equal(row.amount, 65000);
  assert.equal(row.adjustment, 0);
});

test("% phí hiển thị khớp số phí thật: bản ghi lưu phí 0 thì không hiện mức 35%", () => {
  const zeroFee = courseIncomeRow({ _id: "e3", pricePaid: 19981, platformFee: 0, mentorEarningsCreditedAt: day(-190) }, NOW, 0.35);
  assert.equal(zeroFee.platformFee, 0);
  assert.equal(zeroFee.platformFeeRate, 0);
  const mismatch = courseIncomeRow({ _id: "e4", pricePaid: 19981, platformFee: 2997, platformFeeRate: 0.35, mentorEarningsCreditedAt: day(-190), earningsNetAmount: 16984 }, NOW, 0.35);
  assert.equal(mismatch.platformFeeRate, 0.15);
  assert.equal(mismatch.amount, 16984);
  assert.equal(mismatch.adjustment, 0);
});

test("tổng hợp: chỉ cộng khoản đã ghi vào ví; báo chênh lệch với số trong ví", () => {
  const rows = [
    { type: "income", source: "booking", credited: true, amount: 245000 },
    { type: "income", source: "learning_path", credited: true, amount: 240000 },
    { type: "income", source: "course", credited: true, amount: 65000 },
    { type: "income", source: "course", credited: false, amount: 19981 },
    { type: "withdraw", amount: 100000 },
  ];
  const { breakdown, reconciliation } = summarizeIncome(rows, 566984);
  assert.deepEqual(breakdown, { booking: 245000, learningPath: 240000, course: 65000 });
  assert.equal(reconciliation.creditedTotal, 550000);
  assert.equal(reconciliation.notCreditedTotal, 19981);
  assert.equal(reconciliation.notCreditedCount, 1);
  assert.equal(reconciliation.difference, 16984);
  assert.equal(summarizeIncome(rows, 550000).reconciliation.difference, 0);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  computeLearningPathRefund,
  isFreeRetake,
  learningPathSessionFee,
  planLearningPathMoney,
  retakeShareAmount,
  splitLearningPathShares,
} from "./learningPathMoney.js";
import { learningPathBookingMoney } from "./learningPathBookingMoney.js";

const sum = (arr) => arr.reduce((a, b) => a + b, 0);

test("ví dụ DESIGN: 1.000.000 / 3 buổi → 333.333 · 333.333 · 333.334", () => {
  assert.deepEqual(splitLearningPathShares(1_000_000, 3), [333_333, 333_333, 333_334]);
});

test("tổng luôn bằng T với T không chia hết (và chia hết), buổi cuối nhận phần dư", () => {
  const totals = [1, 2, 7, 999, 10_000, 99_999, 100_001, 1_000_000, 1_234_567, 99_999_999, 100_000_000];
  for (const T of totals) {
    for (let n = 1; n <= 12; n += 1) {
      const shares = splitLearningPathShares(T, n);
      assert.equal(shares.length, n);
      assert.equal(sum(shares), T, `T=${T}, n=${n}`);
      const base = Math.floor(T / n);
      assert.ok(shares.slice(0, -1).every((s) => s === base), `buổi đầu đều nhau T=${T}, n=${n}`);
      assert.ok(shares.at(-1) >= base && shares.at(-1) - base < n, `phần dư ở buổi cuối T=${T}, n=${n}`);
      assert.ok(shares.every((s) => Number.isInteger(s) && s >= 0));
    }
  }
});

test("ngẫu nhiên 2.000 trường hợp: tổng bằng T", () => {
  let seed = 42;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (let i = 0; i < 2000; i += 1) {
    const T = Math.floor(rand() * 100_000_000);
    const n = 1 + Math.floor(rand() * 12);
    assert.equal(sum(splitLearningPathShares(T, n)), T);
  }
});

test("phí từng buổi = round(share × rate), khớp learningPathBookingMoney (LP-04); fee + net = share", () => {
  const plan = planLearningPathMoney(1_000_000, 3, 0.3);
  assert.deepEqual(plan.map((p) => p.platformFee), [100_000, 100_000, 100_000]);
  assert.deepEqual(plan.map((p) => p.mentorNet), [233_333, 233_333, 233_334]);
  for (const p of plan) {
    assert.equal(p.platformFee + p.mentorNet, p.shareAmount);
    assert.equal(p.platformFee, learningPathBookingMoney({ shareAmount: p.shareAmount, platformFeeRate: 0.3 }).platformFee);
  }
  assert.equal(sum(plan.map((p) => p.shareAmount)), 1_000_000);
  assert.equal(learningPathSessionFee(333_333, 0.25), 83_333);
  assert.equal(learningPathSessionFee(0, 0.3), 0);
});

test("buổi học lại: lần đầu miễn phí, từ lần 2 lấy giá buổi bổ sung", () => {
  assert.equal(isFreeRetake(2), true);
  assert.equal(isFreeRetake(3), false);
  assert.equal(retakeShareAmount(2, 500_000), 0);
  assert.equal(retakeShareAmount(3, 200_000), 200_000);
  assert.throws(() => retakeShareAmount(1), RangeError);
  assert.throws(() => retakeShareAmount(3, -1), RangeError);
});

test("tiền hoàn = T − tổng share các buổi gốc đã done", () => {
  const T = 1_000_000;
  const plan = splitLearningPathShares(T, 3);
  const sessions = (doneOrders, extra = []) => [
    ...plan.map((shareAmount, i) => ({ attempt: 1, status: doneOrders.includes(i + 1) ? "done" : "planned", shareAmount })),
    ...extra,
  ];
  assert.deepEqual(computeLearningPathRefund(T, sessions([])), { refundAmount: T, consumedAmount: 0 });
  // Hủy sau buổi 1.
  assert.deepEqual(computeLearningPathRefund(T, sessions([1])), { refundAmount: 666_667, consumedAmount: 333_333 });
  // Hủy sau buổi học lại miễn phí: buổi học lại không trừ thêm.
  assert.deepEqual(
    computeLearningPathRefund(T, sessions([1, 2], [{ attempt: 2, status: "done", shareAmount: 0 }])),
    { refundAmount: 333_334, consumedAmount: 666_666 },
  );
  // Buổi bổ sung có phí thu riêng, không nằm trong T.
  assert.equal(computeLearningPathRefund(T, sessions([1], [{ attempt: 3, status: "done", shareAmount: 200_000 }])).refundAmount, 666_667);
  // Học hết: không hoàn.
  assert.deepEqual(computeLearningPathRefund(T, sessions([1, 2, 3])), { refundAmount: 0, consumedAmount: T });
  // Buổi đang scheduled chưa tính.
  assert.equal(computeLearningPathRefund(T, [{ attempt: 1, status: "scheduled", shareAmount: 333_333 }]).refundAmount, T);
});

test("từ chối dữ liệu sai", () => {
  assert.throws(() => splitLearningPathShares(1000.5, 2), RangeError);
  assert.throws(() => splitLearningPathShares(-1, 2), RangeError);
  assert.throws(() => splitLearningPathShares(1000, 0), RangeError);
  assert.throws(() => splitLearningPathShares(1000, 1.5), RangeError);
  assert.throws(() => planLearningPathMoney(1000, 2, 1.2), RangeError);
  assert.throws(() => computeLearningPathRefund(1000, [{ attempt: 1, status: "done", shareAmount: 10.5 }]), RangeError);
});

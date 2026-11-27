import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALL_MONTHS,
  filterRows,
  incomeStatusMeta,
  incomeSubtitle,
  incomeTitle,
  listMonths,
  monthLabel,
  percentText,
  summarizeRows,
  withdrawTitle,
} from "./financeHistory.js";

const rows = [
  { type: "income", source: "booking", sessionType: "mock_interview", date: "2026-11-20T03:00:00Z", credited: true, grossAmount: 350000, platformFee: 105000, adjustment: 0, amount: 245000 },
  { type: "income", source: "booking", date: "2026-11-10T03:00:00Z", credited: true, grossAmount: 300000, platformFee: 60000, adjustment: -40000, amount: 200000 },
  { type: "income", source: "course", courseTitle: "React", date: "2026-05-17T03:00:00Z", credited: false, grossAmount: 30740, platformFee: 10759, amount: 19981 },
  { type: "withdraw", date: "2026-11-21T03:00:00Z", status: "paid", amount: 100000 },
  { type: "withdraw", date: "2026-11-22T03:00:00Z", status: "pending", amount: 50000 },
  { type: "withdraw", date: "2026-11-23T03:00:00Z", status: "failed", amount: 70000 },
];

test("danh sách tháng mới nhất trước, nhãn tiếng Việt", () => {
  assert.deepEqual(listMonths(rows), ["2026-11", "2026-05"]);
  assert.equal(monthLabel("2026-05"), "Tháng 5/2026");
  assert.equal(monthLabel(ALL_MONTHS), "Tất cả thời gian");
});

test("lọc theo tháng và loại", () => {
  assert.equal(filterRows(rows, { month: "2026-11" }).length, 5);
  assert.equal(filterRows(rows, { month: "2026-11", tab: "income" }).length, 2);
  assert.equal(filterRows(rows, { tab: "withdraw" }).length, 3);
});

test("tổng: khoản chưa ghi vào ví tách riêng; rút bị từ chối không tính", () => {
  const s = summarizeRows(rows);
  assert.equal(s.incomeCount, 2);
  assert.equal(s.gross, 650000);
  assert.equal(s.fee, 165000);
  assert.equal(s.adjustment, -40000);
  assert.equal(s.net, 445000);
  assert.equal(s.gross - s.fee + s.adjustment, s.net, "học viên trả − phí + điều chỉnh = thực nhận");
  assert.equal(s.notCreditedCount, 1);
  assert.equal(s.notCreditedNet, 19981);
  assert.equal(s.withdrawPaid, 100000);
  assert.equal(s.withdrawProcessing, 50000);
});

test("trạng thái tiền", () => {
  assert.equal(incomeStatusMeta({ earningsStatus: "holding", clearAt: "2026-11-27T03:00:00Z" }).label, "Đang giữ đến 27/11/2026");
  assert.equal(incomeStatusMeta({ earningsStatus: "available" }).tone, "done");
  assert.equal(incomeStatusMeta({ earningsStatus: "not_credited" }).tone, "warning");
  assert.equal(incomeStatusMeta({ earningsStatus: "hold_overdue" }).label, "Chờ chuyển vào số dư");
});

test("tên giao dịch dễ hiểu", () => {
  assert.equal(incomeTitle({ source: "course", courseTitle: "React" }), 'Khóa học "React"');
  assert.equal(incomeTitle({ source: "learning_path" }), "Buổi lộ trình học");
  assert.equal(incomeTitle({ source: "booking", sessionType: "mock_interview" }), "Buổi phỏng vấn giả lập");
  assert.equal(incomeSubtitle({ source: "booking", counterpartyName: "Trần Văn B", sessionDate: "20/11/2026", sessionTime: "19:00" }), "Học viên Trần Văn B · 20/11/2026 19:00");
  assert.equal(withdrawTitle({ bankName: "TPBank", accountMasked: "******4611" }), "Rút tiền về TPBank ******4611");
  assert.equal(withdrawTitle({}), "Rút tiền");
});

test("phần trăm phí", () => {
  assert.equal(percentText(0.35), "35%");
  assert.equal(percentText(0.125), "12.5%");
});

import { it } from "node:test";
import assert from "node:assert/strict";
import { mentorRequestStats, formatBudgetShort } from "./mentorRequestStats.js";

it("đếm nhu cầu mở, đề nghị đang chờ và số lần được chọn từ 2 danh sách thật", () => {
  const open = [{ id: "a", budget: 4000 }, { id: "b", budget: 8000 }, { id: "c", budget: null }];
  const mine = [
    { id: "a", status: "open", selectedOfferId: "", offers: [{ id: "o1", status: "pending" }] },
    { id: "d", status: "selected", selectedOfferId: "o2", offers: [{ id: "o2", status: "pending" }] },
    { id: "e", status: "selected", selectedOfferId: "other", offers: [{ id: "o3", status: "pending" }] },
    { id: "f", status: "open", selectedOfferId: "", offers: [{ id: "o4", status: "withdrawn" }] },
  ];
  assert.deepEqual(mentorRequestStats(open, mine), { openCount: 3, waiting: 1, chosen: 1, avgBudget: 6000 });
});

it("danh sách rỗng hoặc thiếu thì ra 0 và không có ngân sách", () => {
  assert.deepEqual(mentorRequestStats(undefined, null), { openCount: 0, waiting: 0, chosen: 0, avgBudget: null });
});

it("rút gọn ngân sách", () => {
  assert.equal(formatBudgetShort(6000), "6k");
  assert.equal(formatBudgetShort(1_500_000), "1,5tr");
  assert.equal(formatBudgetShort(null), "—");
});

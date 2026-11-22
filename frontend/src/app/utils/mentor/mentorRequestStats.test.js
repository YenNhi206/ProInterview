import { it } from "node:test";
import assert from "node:assert/strict";
import { mentorRequestStats } from "./mentorRequestStats.js";

it("đếm nhu cầu mở, đề nghị đang chờ và số lần được chọn từ 2 danh sách thật", () => {
  const open = [{ id: "a", budget: 4000 }, { id: "b", budget: 8000 }, { id: "c", budget: null }];
  const mine = [
    { id: "a", status: "open", selectedOfferId: "", offers: [{ id: "o1", status: "pending" }] },
    { id: "d", status: "selected", selectedOfferId: "o2", offers: [{ id: "o2", status: "pending" }] },
    { id: "e", status: "selected", selectedOfferId: "other", offers: [{ id: "o3", status: "pending" }] },
    { id: "f", status: "open", selectedOfferId: "", offers: [{ id: "o4", status: "withdrawn" }] },
  ];
  assert.deepEqual(mentorRequestStats(open, mine), { openCount: 3, waiting: 1, chosen: 1 });
});

it("danh sách rỗng hoặc thiếu thì ra 0", () => {
  assert.deepEqual(mentorRequestStats(undefined, null), { openCount: 0, waiting: 0, chosen: 0 });
});


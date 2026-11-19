import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CANDIDATE_NEXT_STEP,
  CANDIDATE_PATH_STATUS,
  CANDIDATE_PATH_TABS,
  countByTab,
  filterByTab,
  pathProgress,
} from "./candidateLearningPaths.js";

const paths = [
  { id: "a", status: "proposed" },
  { id: "b", status: "pending_payment" },
  { id: "c", status: "revision_requested" },
  { id: "d", status: "active" },
  { id: "e", status: "completed" },
];

test("mọi trạng thái ứng viên thấy đều có nhãn và bước tiếp theo (không có draft)", () => {
  for (const s of ["proposed", "revision_requested", "pending_payment", "active", "completed", "cancelled"]) {
    assert.ok(CANDIDATE_PATH_STATUS[s], s);
    assert.ok(CANDIDATE_NEXT_STEP[s], s);
  }
  assert.equal(CANDIDATE_PATH_STATUS.draft, undefined);
});

test("countByTab / filterByTab theo đúng nhóm trạng thái", () => {
  assert.deepEqual(countByTab(paths), { all: 5, todo: 2, waiting: 1, active: 1, closed: 1 });
  assert.deepEqual(filterByTab(paths, "todo").map((p) => p.id), ["a", "b"]);
  assert.equal(filterByTab(paths, "all").length, 5);
  assert.equal(filterByTab(paths, "khong-co").length, 5);
  assert.equal(new Set(CANDIDATE_PATH_TABS.map((t) => t.key)).size, CANDIDATE_PATH_TABS.length);
});

test("pathProgress: buổi học lại không cộng thêm buổi, lấy kết quả lần học mới nhất", () => {
  const sessions = [
    { order: 1, attempt: 1, status: "done", outcome: "passed" },
    { order: 2, attempt: 1, status: "done", outcome: "not_passed" },
    { order: 2, attempt: 2, status: "done", outcome: "passed" },
    { order: 3, attempt: 1, status: "planned", outcome: null },
  ];
  assert.deepEqual(pathProgress(sessions), { done: 2, total: 3 });
  assert.deepEqual(pathProgress([{ order: 1, attempt: 1, status: "done", outcome: "not_passed" }]), { done: 0, total: 1 });
  assert.deepEqual(pathProgress([]), { done: 0, total: 0 });
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { formatRate, formatHours, competencyLabel, COMPETENCIES } from "./moderationLabels.js";

test("formatRate: tỉ lệ → %, null → —", () => {
  assert.equal(formatRate(0.75), "75%");
  assert.equal(formatRate(0.3333, 1), "33.3%");
  assert.equal(formatRate(0), "0%");
  assert.equal(formatRate(null), "—");
});

test("formatHours: dưới 1 giờ hiện phút", () => {
  assert.equal(formatHours(4), "4 giờ");
  assert.equal(formatHours(0.5), "30 phút");
  assert.equal(formatHours(null), "—");
});

test("competencyLabel + danh sách 20 competency không trùng", () => {
  assert.equal(competencyLabel("teamwork"), "Làm việc nhóm & Cộng tác");
  assert.equal(competencyLabel("unknown_id"), "unknown_id");
  assert.equal(new Set(COMPETENCIES.map((c) => c.id)).size, 20);
});

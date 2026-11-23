import { it } from "node:test";
import assert from "node:assert/strict";
import { countFlags, prescreenBadge, sortFlags } from "./prescreenFlags.js";

const flags = [
  { code: "missing_thumbnail", severity: "info" },
  { code: "short_description", severity: "warning" },
  { code: "missing_video", severity: "critical" },
  { code: "too_few_lessons", severity: "warning" },
];

it("sắp cờ theo mức nghiêm trọng, giữ thứ tự trong cùng mức", () => {
  assert.deepEqual(sortFlags(flags).map((f) => f.code), ["missing_video", "short_description", "too_few_lessons", "missing_thumbnail"]);
  assert.deepEqual(countFlags(flags), { critical: 1, warning: 2, info: 1 });
});

it("nhãn tổng theo trạng thái và mức cờ", () => {
  assert.deepEqual(prescreenBadge(null), { tone: "muted", text: "Chưa sàng lọc" });
  assert.equal(prescreenBadge({ status: "pending" }).text, "AI đang sàng lọc…");
  assert.equal(prescreenBadge({ status: "failed" }).tone, "muted");
  assert.deepEqual(prescreenBadge({ status: "done", score: 42, flags }), { tone: "bad", text: "1 lỗi nghiêm trọng · 42/100" });
  assert.deepEqual(prescreenBadge({ status: "done", score: 80, flags: flags.slice(0, 2) }), { tone: "warn", text: "1 cảnh báo · 80/100" });
  assert.deepEqual(prescreenBadge({ status: "done", score: 95, flags: [{ severity: "info" }] }), { tone: "ok", text: "Không có cảnh báo · 95/100" });
});

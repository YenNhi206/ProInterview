import { it } from "node:test";
import assert from "node:assert/strict";
import { isInternalTestEmail, resolveDisplayStatus } from "./interviewSessionDisplay.js";

it("nhận ra tài khoản nội bộ @dev.local", () => {
  assert.equal(isInternalTestEmail("admin@dev.local"), true);
  assert.equal(isInternalTestEmail(" Mentor@DEV.local "), true);
  assert.equal(isInternalTestEmail("nhi@gmail.com"), false);
  assert.equal(isInternalTestEmail(undefined), false);
});

it("phiên đang làm quá 24h hiện là bỏ dở, trạng thái khác giữ nguyên", () => {
  const now = Date.parse("2026-11-23T12:00:00Z");
  assert.equal(resolveDisplayStatus("in_progress", "2026-11-22T11:00:00Z", now), "abandoned");
  assert.equal(resolveDisplayStatus("in_progress", "2026-11-23T10:00:00Z", now), "in_progress");
  assert.equal(resolveDisplayStatus("completed", "2026-01-01T00:00:00Z", now), "completed");
  assert.equal(resolveDisplayStatus("in_progress", "không phải ngày", now), "in_progress");
});

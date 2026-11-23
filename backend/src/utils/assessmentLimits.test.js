import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkAssessmentLimit, countsTowardAssessmentLimit } from "./assessmentLimits.js";

const NOW = new Date("2026-11-23T05:00:00Z");
const daysAgo = (n) => new Date(NOW.getTime() - n * 86_400_000);

describe("countsTowardAssessmentLimit (LP-06)", () => {
  it("tính buổi đang mở, đã xong, ứng viên vắng; không tính mentor vắng và buổi bị hủy", () => {
    for (const status of ["pending", "confirmed", "in_progress", "rescheduled", "completed"]) {
      assert.equal(countsTowardAssessmentLimit({ status }), true, status);
    }
    assert.equal(countsTowardAssessmentLimit({ status: "no_show", cancelledBy: "user" }), true);
    assert.equal(countsTowardAssessmentLimit({ status: "no_show", cancelledBy: "" }), true);
    assert.equal(countsTowardAssessmentLimit({ status: "no_show", cancelledBy: "mentor" }), false);
    assert.equal(countsTowardAssessmentLimit({ status: "cancelled", cancelledBy: "user" }), false);
    assert.equal(countsTowardAssessmentLimit({ status: "cancelled", cancelledBy: "mentor" }), false);
    assert.equal(countsTowardAssessmentLimit(null), false);
  });
});

describe("checkAssessmentLimit (LP-06)", () => {
  it("chưa có buổi nào hoặc 1 buổi đã xong → được hẹn", () => {
    assert.deepEqual(checkAssessmentLimit([], NOW), { ok: true });
    assert.deepEqual(checkAssessmentLimit([{ status: "completed", createdAt: daysAgo(3) }], NOW), { ok: true });
  });

  it("đang có 1 buổi chưa xong → chặn (open), kể cả buổi cũ hơn 30 ngày", () => {
    assert.deepEqual(checkAssessmentLimit([{ status: "confirmed", createdAt: daysAgo(40) }], NOW), { ok: false, reason: "open" });
  });

  it("2 buổi tính lượt trong 30 ngày → chặn, mở lại khi buổi cũ nhất qua 30 ngày", () => {
    const res = checkAssessmentLimit(
      [{ status: "completed", createdAt: daysAgo(20) }, { status: "no_show", cancelledBy: "user", createdAt: daysAgo(5) }],
      NOW,
    );
    assert.equal(res.ok, false);
    assert.equal(res.reason, "window");
    assert.equal(res.reopensAt.getTime(), daysAgo(20).getTime() + 30 * 86_400_000);
  });

  it("3 buổi trong cửa sổ (dữ liệu cũ) → mở lại theo buổi thứ 2 cũ nhất", () => {
    const res = checkAssessmentLimit(
      [25, 10, 2].map((d) => ({ status: "completed", createdAt: daysAgo(d) })),
      NOW,
    );
    assert.equal(res.reopensAt.getTime(), daysAgo(10).getTime() + 30 * 86_400_000);
  });

  it("mentor vắng và buổi bị hủy không tính; buổi quá 30 ngày không tính", () => {
    const rows = [
      { status: "completed", createdAt: daysAgo(10) },
      { status: "no_show", cancelledBy: "mentor", createdAt: daysAgo(8) },
      { status: "cancelled", cancelledBy: "user", createdAt: daysAgo(6) },
      { status: "completed", createdAt: daysAgo(31) },
    ];
    assert.deepEqual(checkAssessmentLimit(rows, NOW), { ok: true });
  });

  it("đúng mốc 30 ngày thì buổi cũ không còn tính", () => {
    const rows = [{ status: "completed", createdAt: daysAgo(30) }, { status: "completed", createdAt: daysAgo(1) }];
    assert.deepEqual(checkAssessmentLimit(rows, NOW), { ok: true });
  });
});

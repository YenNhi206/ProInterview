import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { groupReviewFlags, reviewStatusText, reviewBadgeText, flagLabel } from "./rubricReview.js";

const review = {
  status: "done",
  flags: [
    { code: "short_level", severity: "info", criterionIndex: 0 },
    { code: "weight_sum", severity: "critical", criterionIndex: null },
    { code: "shrm_mismatch", severity: "critical", criterionIndex: 0, suggestedShrmKey: "communication" },
    { code: "duplicate_level", severity: "warning", criterionIndex: 1 },
    { code: "vague_scale", severity: "warning", criterionIndex: 7 },
  ],
};

describe("groupReviewFlags (CO-09)", () => {
  it("tách cờ chung / theo tiêu chí, xếp nghiêm trọng trước, tiêu chí không tồn tại thành cờ chung", () => {
    const g = groupReviewFlags(review, 2);
    assert.deepEqual(g.general.map((f) => f.code), ["weight_sum", "vague_scale"]);
    assert.deepEqual(g.byCriterion[0].map((f) => f.code), ["shrm_mismatch", "short_level"]);
    assert.deepEqual(g.byCriterion[1].map((f) => f.code), ["duplicate_level"]);
    assert.deepEqual(g.counts, { critical: 2, warning: 2, info: 1 });
    assert.equal(g.total, 5);
  });

  it("không có aiReview → rỗng", () => {
    assert.deepEqual(groupReviewFlags(null), { general: [], byCriterion: {}, counts: { critical: 0, warning: 0, info: 0 }, total: 0 });
  });
});

describe("trạng thái và nhãn (CO-09)", () => {
  it("reviewStatusText theo status", () => {
    assert.equal(reviewStatusText(review), "");
    assert.match(reviewStatusText({ status: "pending" }), /đang kiểm tra/);
    assert.match(reviewStatusText({ status: "failed", error: "AI lỗi." }), /^AI lỗi\. .*theo luật/);
    assert.match(reviewStatusText({}), /chưa được AI kiểm tra/);
  });

  it("reviewBadgeText đếm theo mức độ; chưa kiểm tra / đang chạy → rỗng", () => {
    assert.equal(reviewBadgeText(review), "2 nghiêm trọng · 2 cảnh báo · 1 lưu ý");
    assert.equal(reviewBadgeText({ status: "done", flags: [] }), "Không có cảnh báo");
    assert.equal(reviewBadgeText({ status: "pending", flags: [] }), "");
    assert.equal(reviewBadgeText(undefined), "");
  });

  it("flagLabel có tên tiếng Việt, mã lạ giữ nguyên", () => {
    assert.equal(flagLabel("shrm_mismatch"), "Map sai năng lực SHRM");
    assert.equal(flagLabel("x"), "x");
  });
});

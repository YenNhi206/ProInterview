import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { changeTitle, correctionText, promptKeyLabel, rateDeltaBadge, rubricPendingHint, rubricReviewHint } from "./qualityAi07.js";

describe("qualityAi07 (AI-07)", () => {
  it("tỉ lệ bị sửa kèm số đếm", () => {
    assert.equal(correctionText({ sample: 10, corrected: 1, rate: 0.1 }), "10.0% (1/10)");
    assert.equal(correctionText({ sample: 0, corrected: 0, rate: null }), "Chưa có dữ liệu");
    assert.equal(correctionText(null), "—");
  });

  it("chênh: giảm là tốt hơn", () => {
    assert.deepEqual(rateDeltaBadge(-0.5), { text: "-50 điểm %", tone: "better" });
    assert.deepEqual(rateDeltaBadge(0.3), { text: "+30 điểm %", tone: "worse" });
    assert.deepEqual(rateDeltaBadge(0), { text: "Không đổi", tone: "same" });
    assert.deepEqual(rateDeltaBadge(null), { text: "—", tone: null });
  });

  it("tiêu đề lần đổi và nhãn prompt", () => {
    assert.equal(changeTitle({ change: "activate", fromVersion: "eval-v1", toVersion: "eval-v2" }), "Bật eval-v2 (thay eval-v1)");
    assert.equal(changeTitle({ change: "rollback", fromVersion: "eval-v2", toVersion: "eval-v1" }), "Rollback về eval-v1 (bỏ eval-v2)");
    assert.equal(changeTitle({ change: "activate", fromVersion: null, toVersion: "followup-v2" }), "Bật followup-v2");
    assert.equal(promptKeyLabel("question_gen"), "Sinh câu hỏi");
  });

  it("dòng phụ thẻ rubric", () => {
    assert.equal(rubricPendingHint({ pendingReview: 0 }), "Không có rubric nào đang chờ");
    assert.equal(rubricPendingHint({ pendingReview: 2, pendingOver7d: 1, oldestPendingHours: 240 }), "1 chờ quá 7 ngày · lâu nhất 240 giờ");
    assert.equal(rubricReviewHint({ reviewedInPeriod: 4, withoutSubmitTime: 1 }), "4 rubric đã xử lý trong kỳ · 1 rubric gửi trước khi có mốc gửi duyệt, không tính");
  });
});

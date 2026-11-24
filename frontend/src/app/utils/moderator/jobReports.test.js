import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { jobReportReasonLabel, hideReasonError, HIDE_REASON_MIN, isSafeEvidenceUrl } from "./jobReports.js";

describe("jobReports (JB-17)", () => {
  it("nhãn lý do báo cáo khớp danh sách của trang job; key lạ trả nguyên key", () => {
    assert.equal(jobReportReasonLabel("fraud"), "Lừa đảo, thu phí ứng viên");
    assert.equal(jobReportReasonLabel("discriminatory"), "Phân biệt đối xử");
    assert.equal(jobReportReasonLabel("khac_la"), "khac_la");
    assert.equal(jobReportReasonLabel(null), "");
  });

  it("lý do ẩn tin cần ít nhất 5 ký tự (sau khi bỏ khoảng trắng), khớp backend", () => {
    assert.equal(HIDE_REASON_MIN, 5);
    assert.match(hideReasonError("   abc  "), /ít nhất 5/);
    assert.equal(hideReasonError("Lừa đảo"), "");
  });

  it("chỉ link http(s) được bấm; javascript: / data: / chuỗi lạ thì không", () => {
    assert.equal(isSafeEvidenceUrl("https://example.com/a.png"), true);
    assert.equal(isSafeEvidenceUrl("http://example.com"), true);
    assert.equal(isSafeEvidenceUrl("javascript:alert(1)"), false);
    assert.equal(isSafeEvidenceUrl(" JavaScript:alert(1)"), false);
    assert.equal(isSafeEvidenceUrl("data:text/html,<b>x</b>"), false);
    assert.equal(isSafeEvidenceUrl("không phải link"), false);
  });
});

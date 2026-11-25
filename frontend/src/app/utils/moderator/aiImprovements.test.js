import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  backtestBadge,
  confirmText,
  evidenceText,
  formatExampleOutput,
  groupLabel,
  isAutoRejected,
  maeChangeText,
  newExamples,
  reviewNoteError,
  statRows,
  statusBadge,
} from "./aiImprovements.js";

describe("aiImprovements (AI-06)", () => {
  it("nhãn trạng thái và backtest", () => {
    assert.equal(statusBadge("approved").label, "Đang bật");
    assert.equal(statusBadge("x").tone, "neutral");
    assert.equal(backtestBadge(null).label, "Chưa backtest");
    assert.equal(backtestBadge({ status: "running" }).running, true);
    assert.equal(backtestBadge({ status: "failed" }).tone, "error");
    assert.equal(backtestBadge({ status: "done", verdict: "better" }).label, "Lệch ít hơn");
    assert.equal(backtestBadge({ status: "done", verdict: "worse" }).tone, "warning");
  });

  it("nhóm và bằng chứng", () => {
    assert.equal(groupLabel({ groupKey: "_general" }), "Chung");
    assert.equal(groupLabel({ groupKey: "teamwork" }, { teamwork: "Làm việc nhóm" }), "Làm việc nhóm");
    assert.equal(evidenceText({ kind: "few_shot", evidence: { overrideCount: 5, avgScoreDelta: -1.9 } }), "5 lượt kiểm duyệt, lệch TB -1,9");
    assert.equal(evidenceText({ kind: "rubric_anchor", evidence: { companyCount: 3 } }), "Rubric của 3 doanh nghiệp");
  });

  it("bảng trước / sau: lệch giảm là tốt hơn, tỉ lệ trùng tăng là tốt hơn", () => {
    const rows = statRows({
      before: { mae: 0.75, bias: 0.75, exact: 0.25, within1: 1, n: 20 },
      after: { mae: 0, bias: -0.1, exact: 1, within1: 1, n: 20 },
    });
    const by = Object.fromEntries(rows.map((r) => [r.key, r]));
    assert.equal(by.mae.trend, "better");
    assert.equal(by.bias.trend, "better");
    assert.equal(by.exact.trend, "better");
    assert.equal(by.within1.trend, "same");
    assert.equal(by.n.trend, null);
    assert.equal(by.exact.after, "100%");
    assert.equal(maeChangeText({ gold: { before: { mae: 0.75 }, after: { mae: 0 } } }), "0,75 → 0");
    assert.equal(maeChangeText(null), "—");
  });

  it("ví dụ mới = có ở bản sau, chưa có ở bản trước", () => {
    const a = { input: "a", output: "1" };
    const b = { input: "b", output: "2" };
    assert.deepEqual(newExamples({ before: { fewShotExamples: [a] }, after: { fewShotExamples: [a, b] } }), [b]);
  });

  it("ghi chú bắt buộc khi từ chối / rollback; xác nhận nêu version", () => {
    assert.equal(reviewNoteError("approve", ""), "");
    assert.notEqual(reviewNoteError("reject", "ab"), "");
    assert.equal(reviewNoteError("rollback", "tăng tỉ lệ bị sửa"), "");
    const p = { target: "evaluation", before: { version: "eval-v1" }, after: { version: "eval-v2" } };
    assert.match(confirmText("approve", p, "eval-v1"), /Bật eval-v2/);
    assert.match(confirmText("rollback", p), /Bật lại eval-v1/);
  });

  it("tự loại = từ chối không có người duyệt, ghi chú 'Tự loại'", () => {
    assert.equal(isAutoRejected({ status: "rejected", review: { by: null, note: "Tự loại: backtest…" } }), true);
    assert.equal(isAutoRejected({ status: "rejected", review: { by: "u1", note: "ví dụ chưa tốt" } }), false);
  });

  it("kết quả chuẩn dạng JSON điểm → câu đọc được; chữ thường giữ nguyên", () => {
    const out = JSON.stringify({ scores: { clarity: 1.5, structure: 2, relevance: 2, credibility: 1 }, overall: 1.5, shrm_level: "developing" });
    assert.equal(formatExampleOutput({ output: out }), "Tổng 1,5 · Rõ ràng 1,5 · Cấu trúc 2 · Liên quan 2 · Thuyết phục 1 · Mức SHRM: Đang phát triển");
    assert.equal(formatExampleOutput({ output: "Mức 0: ..." }), "Mức 0: ...");
  });
});

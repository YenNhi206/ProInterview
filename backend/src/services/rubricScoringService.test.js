import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applicableCriteria,
  formatCriteria,
  normalizeForQuote,
  sanitizeRubricScores,
  verifyEvidenceQuote,
} from "./rubricScoringService.js";

const TRANSCRIPT =
  "Em từng tối ưu API danh sách đơn hàng. Em đo bằng APM thấy truy vấn thiếu index, " +
  "thêm index kép nên thời gian phản hồi giảm từ 1,2 giây xuống 300 mili giây.";

describe("verifyEvidenceQuote: trích dẫn phải có thật trong transcript", () => {
  it("giữ trích dẫn khớp, chấp nhận khác hoa thường, khoảng trắng, nháy bao ngoài", () => {
    assert.equal(verifyEvidenceQuote("Em đo bằng APM thấy truy vấn thiếu index", TRANSCRIPT), "Em đo bằng APM thấy truy vấn thiếu index");
    assert.ok(verifyEvidenceQuote("“em   ĐO bằng APM thấy truy vấn thiếu index”", TRANSCRIPT));
    assert.ok(verifyEvidenceQuote("giảm từ 1,2 giây xuống 300 mili giây.", TRANSCRIPT));
  });

  it("bỏ trích dẫn bịa, bị diễn đạt lại, hoặc quá ngắn", () => {
    assert.equal(verifyEvidenceQuote("Em dùng Redis để cache kết quả", TRANSCRIPT), "");
    assert.equal(verifyEvidenceQuote("Em đo bằng công cụ APM và thấy thiếu index", TRANSCRIPT), "");
    assert.equal(verifyEvidenceQuote("index", TRANSCRIPT), "");
    assert.equal(verifyEvidenceQuote("", TRANSCRIPT), "");
    assert.equal(verifyEvidenceQuote(null, TRANSCRIPT), "");
  });

  it("normalizeForQuote gộp khoảng trắng và bỏ dấu câu hai đầu", () => {
    assert.equal(normalizeForQuote('  "Xin  chào." '), "xin chào");
  });
});

describe("applicableCriteria", () => {
  const q1 = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const q2 = "bbbbbbbbbbbbbbbbbbbbbbbb";
  const rubric = {
    criteria: [
      { _id: "c1", name: "A", questionIds: [q1] },
      { _id: "c2", name: "B", questionIds: [q2] },
      { _id: "c3", name: "C", questionIds: [q1, q2] },
    ],
  };
  it("chỉ lấy tiêu chí có gắn câu", () => {
    assert.deepEqual(applicableCriteria(rubric, q1).map((c) => c._id), ["c1", "c3"]);
  });
  it("câu chưa gắn tiêu chí nào thì chấm mọi tiêu chí", () => {
    assert.equal(applicableCriteria(rubric, "cccccccccccccccccccccccc").length, 3);
    assert.deepEqual(applicableCriteria(null, q1), []);
  });
});

describe("sanitizeRubricScores", () => {
  const criteria = [
    { _id: "c1", name: "Giải quyết vấn đề", shrmKey: "problem_solving", weight: 60 },
    { _id: "c2", name: "Giao tiếp", shrmKey: "communication", weight: 40 },
  ];
  it("làm tròn, kẹp 0–5, kiểm trích dẫn", () => {
    const out = sanitizeRubricScores(
      {
        criteria: [
          { criterion_key: "c1", score: 4.4, evidence_quote: "thêm index kép nên thời gian phản hồi giảm" },
          { criterion_key: "c2", score: 9, evidence_quote: "Em trình bày rất rõ ràng" },
        ],
      },
      criteria,
      TRANSCRIPT,
    );
    assert.deepEqual(out.map((r) => [r.criterionKey, r.score, r.shrmKey, r.weight]), [
      ["c1", 4, "problem_solving", 60],
      ["c2", 5, "communication", 40],
    ]);
    assert.equal(out[0].evidenceQuote, "thêm index kép nên thời gian phản hồi giảm");
    assert.equal(out[1].evidenceQuote, "");
  });
  it("thiếu tiêu chí hoặc điểm không phải số thì báo lỗi", () => {
    assert.throws(() => sanitizeRubricScores({ criteria: [{ criterion_key: "c1", score: 3 }] }, criteria, TRANSCRIPT));
    assert.throws(() =>
      sanitizeRubricScores({ criteria: [{ criterion_key: "c1", score: "cao" }, { criterion_key: "c2", score: 3 }] }, criteria, TRANSCRIPT),
    );
    assert.throws(() => sanitizeRubricScores(null, criteria, TRANSCRIPT));
  });
});

describe("formatCriteria", () => {
  it("in criterion_key và mô tả từng mức", () => {
    const text = formatCriteria([
      { _id: "c1", name: "Giải quyết vấn đề", description: "Phân tích nguyên nhân", levels: new Map([["0", "Không"], ["5", "Xuất sắc"]]) },
      { _id: "c2", name: "Giao tiếp", levels: {} },
    ]);
    assert.match(text, /criterion_key: c1 \| Giải quyết vấn đề — Phân tích nguyên nhân/);
    assert.match(text, /    0: Không\n    5: Xuất sắc/);
    assert.match(text, /criterion_key: c2 \| Giao tiếp\n    \(không có mô tả mức/);
  });
});

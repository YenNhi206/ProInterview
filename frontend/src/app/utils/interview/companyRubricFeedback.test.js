import { test } from "node:test";
import assert from "node:assert/strict";
import { RUBRIC_STATUS_MESSAGES, companyRubricView, rubricScoreTone, weightedRubricAverage } from "./companyRubricFeedback.js";

const scored = {
  company: { id: "c1", name: "Công ty A" },
  rubricStatus: "scored",
  rubricScores: [
    { criterionKey: "k1", criterionName: "Giải quyết vấn đề", shrmKey: "problem_solving", weight: 60, score: 4, evidenceQuote: " Em đo bằng APM " },
    { criterionKey: "k2", criterionName: "", shrmKey: "communication", weight: 40, score: 2, evidenceQuote: "" },
  ],
};

test("câu không phải của doanh nghiệp → null (không hiện phần rubric)", () => {
  assert.equal(companyRubricView({ overall: 3 }), null);
  assert.equal(companyRubricView({ company: null, rubricScores: [{ score: 3 }] }), null);
  assert.equal(companyRubricView(undefined), null);
});

test("câu đã chấm: tên doanh nghiệp, tiêu chí, trích dẫn, điểm trung bình theo trọng số", () => {
  const v = companyRubricView(scored);
  assert.equal(v.companyName, "Công ty A");
  assert.equal(v.status, "scored");
  assert.equal(v.message, "");
  assert.deepEqual(v.criteria.map((c) => [c.name, c.score, c.quote]), [
    ["Giải quyết vấn đề", 4, "Em đo bằng APM"],
    ["communication", 2, ""],
  ]);
  assert.equal(v.average, 3.2);
});

test("chưa chấm / lỗi / không trả lời → thông báo, không có tiêu chí", () => {
  for (const status of ["pending", "failed", "no_answer"]) {
    const v = companyRubricView({ company: { name: "A" }, rubricStatus: status, rubricScores: [] });
    assert.equal(v.status, status);
    assert.equal(v.message, RUBRIC_STATUS_MESSAGES[status]);
    assert.deepEqual(v.criteria, []);
    assert.equal(v.average, null);
  }
  // status lạ coi như đang chấm; "scored" mà rỗng coi như lỗi.
  assert.equal(companyRubricView({ company: { name: "A" }, rubricStatus: "xyz" }).status, "pending");
  assert.equal(companyRubricView({ company: { name: "A" }, rubricStatus: "scored", rubricScores: [] }).status, "failed");
});

test("điểm ngoài khoảng bị kẹp 0–5, điểm không phải số bị bỏ", () => {
  const v = companyRubricView({ ...scored, rubricScores: [{ criterionName: "X", score: 9 }, { criterionName: "Y", score: "?" }] });
  assert.deepEqual(v.criteria.map((c) => c.score), [5]);
});

test("weightedRubricAverage: không có trọng số thì trung bình cộng", () => {
  assert.equal(weightedRubricAverage([{ score: 3, weight: 0 }, { score: 4, weight: 0 }]), 3.5);
  assert.equal(weightedRubricAverage([]), null);
});

test("rubricScoreTone", () => {
  assert.equal(rubricScoreTone(5), "high");
  assert.equal(rubricScoreTone(3), "mid");
  assert.equal(rubricScoreTone(1), "low");
});

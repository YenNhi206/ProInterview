import { it } from "node:test";
import assert from "node:assert/strict";
import { buildCompetencyHints } from "./learningPathCompetencyHintsService.js";

const keys = (r) => r.items.map((i) => `${i.shrmKey}:${i.status}`);

it("job yêu cầu: thiếu xếp trước, chưa có dữ liệu sau, đã đạt cuối; key ngoài bộ tiêu chí bị bỏ", () => {
  const r = buildCompetencyHints({
    jobRequired: [{ shrmKey: "communication", minLevel: 3 }, { shrmKey: "problem_solving", minLevel: 4 }, { shrmKey: "teamwork", minLevel: 2 }, { shrmKey: "technical_mastery", minLevel: 3 }],
    candidate: [
      { key: "problem_solving", level: 2, evidenceCount: 3 },
      { key: "teamwork", level: 4, evidenceCount: 1 },
      { key: "communication", level: 1, evidenceCount: 0 }, // không bằng chứng → chưa có dữ liệu
      { key: "technical_mastery", level: 5, evidenceCount: 9 },
    ],
    passThreshold: 3,
  });
  assert.deepEqual(keys(r), ["problem_solving:gap", "communication:unknown", "teamwork:met"]);
  assert.equal(r.items[0].gap, 2);
  assert.equal(r.items[1].currentLevel, null);
  assert.equal(r.hasJob, true);
  assert.ok(r.items[0].name && r.items[0].name !== "problem_solving");
});

it("không có job: gợi ý năng lực có bằng chứng nhưng dưới mức đạt", () => {
  const r = buildCompetencyHints({
    candidate: [{ key: "leadership", level: 1, evidenceCount: 2 }, { key: "communication", level: 2, evidenceCount: 1 }, { key: "teamwork", level: 3, evidenceCount: 1 }],
    passThreshold: 3,
  });
  assert.deepEqual(keys(r), ["leadership:gap", "communication:gap"]);
  assert.equal(r.hasJob, false);
  assert.equal(r.items.every((i) => i.fromJob === false), true);
});

it("không có job và chưa có bằng chứng: danh sách rỗng", () => {
  const r = buildCompetencyHints({ candidate: [{ key: "communication", level: 1, evidenceCount: 0 }] });
  assert.deepEqual(r, { items: [], hasJob: false, hasEvidence: false });
});

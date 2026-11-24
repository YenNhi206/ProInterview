import { test } from "node:test";
import assert from "node:assert/strict";
import { competencyCards, displayLevel, isVerifiedCompetency, parseTargetRoles } from "./candidateProfile.js";

test("parseTargetRoles: tách dấu phẩy, bỏ rỗng và trùng (không phân biệt hoa thường), tối đa 5", () => {
  assert.deepEqual(parseTargetRoles("Frontend, React Developer ,, frontend"), ["Frontend", "React Developer"]);
  assert.equal(parseTargetRoles("a,b,c,d,e,f,g").length, 5);
  assert.deepEqual(parseTargetRoles(""), []);
});

test("competencyCards: tên theo LP-01, có bằng chứng lên trước, nguồn mới nhất trước", () => {
  const framework = { competencies: [{ key: "communication", nameVi: "Giao tiếp & Trình bày" }] };
  const cards = competencyCards([
    { key: "teamwork", name: "Làm việc nhóm", level: null, evidenceCount: 0, sources: [] },
    { key: "communication", name: "x", level: 3, evidenceCount: 2, sources: [{ at: "2026-11-01", title: "cũ" }, { at: "2026-11-10", title: "mới" }] },
  ], framework);
  assert.equal(cards[0].key, "communication");
  assert.equal(cards[0].name, "Giao tiếp & Trình bày");
  assert.equal(cards[0].verified, true);
  assert.equal(cards[0].sources[0].title, "mới");
  assert.equal(cards[1].name, "Làm việc nhóm", "key không có trong LP-01 thì dùng name backend");
  assert.equal(cards[1].verified, false);
});

test("isVerifiedCompetency: cần ít nhất 1 bằng chứng có mức (PR-06)", () => {
  assert.equal(isVerifiedCompetency({ evidenceCount: 0, level: null, sources: [] }), false);
  assert.equal(isVerifiedCompetency({ evidenceCount: 0, level: null, sources: [{ type: "course" }] }), false, "chỉ có khóa học");
  assert.equal(isVerifiedCompetency({ evidenceCount: 2, level: 2.67 }), true);
  assert.equal(isVerifiedCompetency({ evidenceCount: 1, level: 0 }), true, "mức 0 vẫn là dữ liệu");
});

test("competencyCards: mức làm tròn 1 chữ số, năng lực chỉ có khóa học không có mức (PR-06)", () => {
  const cards = competencyCards([
    { key: "teamwork", level: null, evidenceCount: 0, sources: [{ type: "course", at: "2026-11-01" }] },
    { key: "communication", level: 2.6667, evidenceCount: 3, sources: [] },
  ]);
  assert.equal(cards[0].key, "communication");
  assert.equal(cards[0].level, 2.7);
  assert.equal(cards[1].level, null);
  assert.equal(cards[1].verified, false);
  assert.equal(displayLevel(null), null);
});

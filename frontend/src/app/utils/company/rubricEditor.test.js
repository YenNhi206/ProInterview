import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RUBRIC_LEVELS,
  emptyCriterion,
  isRubricEditable,
  missingLevels,
  saveErrors,
  submitErrors,
  suggestLevels,
  toEditorState,
  toPayload,
  totalWeight,
} from "./rubricEditor.js";

const full = Object.fromEntries(RUBRIC_LEVELS.map((l) => [l, `Mức ${l}`]));
const keys = new Set(["communication", "problem_solving"]);
const state = (criteria, title = "Rubric FE") => ({ id: "", title, roleCategory: "frontend", description: "", criteria });

test("toEditorState: rubric từ API (levels, questionIds) → form; null → form trống 1 tiêu chí", () => {
  const s = toEditorState({ _id: "r1", title: "R", roleCategory: "backend", criteria: [{ name: "A", weight: 100, shrmKey: "communication", levels: { 0: "x" }, questionIds: ["q1"] }] });
  assert.equal(s.id, "r1");
  assert.equal(s.criteria[0].levels["0"], "x");
  assert.equal(s.criteria[0].levels["5"], "");
  assert.deepEqual(s.criteria[0].questionIds, ["q1"]);
  assert.equal(toEditorState(null).criteria.length, 1);
});

test("toPayload: trim chữ, ép trọng số về số, đủ 6 mức", () => {
  const p = toPayload(state([{ name: " Giao tiếp ", weight: "100", shrmKey: "communication", levels: { 0: " a " }, questionIds: [] }], " R "));
  assert.equal(p.title, "R");
  assert.equal(p.criteria[0].name, "Giao tiếp");
  assert.equal(p.criteria[0].weight, 100);
  assert.deepEqual(Object.keys(p.criteria[0].levels), RUBRIC_LEVELS);
  assert.equal(p.criteria[0].levels["0"], "a");
});

test("saveErrors: thiếu tên / trọng số sai / năng lực không còn dùng; thiếu mô tả mức vẫn lưu nháp được", () => {
  assert.deepEqual(saveErrors(state([{ ...emptyCriterion("communication"), name: "A", weight: 100 }]), keys), []);
  const errs = saveErrors(state([{ ...emptyCriterion("technical_mastery"), name: "", weight: 0 }], ""), keys);
  assert.equal(errs.length, 4);
  assert.deepEqual(saveErrors(state([{ ...emptyCriterion("technical_mastery"), name: "A", weight: 50 }]), null), [], "chưa tải bộ tiêu chí thì không chặn nhầm");
});

test("submitErrors: tổng 100% và đủ 6 mức mới gửi duyệt", () => {
  const ok = state([{ name: "A", weight: 60, shrmKey: "communication", levels: full, questionIds: [] }, { name: "B", weight: 40, shrmKey: "problem_solving", levels: full, questionIds: [] }]);
  assert.deepEqual(submitErrors(ok, keys), []);
  const bad = state([{ name: "A", weight: 60, shrmKey: "communication", levels: { ...full, 3: " " }, questionIds: [] }]);
  const errs = submitErrors(bad, keys);
  assert.ok(errs.some((e) => e.includes("100%")));
  assert.ok(errs.some((e) => e.includes("mức 3")));
});

test("suggestLevels: mức 1/3/5 lấy anchors của năng lực, mức khác lấy mô tả chung, không ghi đè mức đã nhập", () => {
  const framework = {
    levels: RUBRIC_LEVELS.map((l) => ({ score: Number(l), descriptor: `chung ${l}` })),
    competencies: [{ key: "communication", anchors: { 1: "riêng 1", 3: "riêng 3", 5: "riêng 5" } }],
  };
  const s = suggestLevels(framework, "communication", { 0: "đã nhập" });
  assert.equal(s["0"], "đã nhập");
  assert.equal(s["1"], "riêng 1");
  assert.equal(s["2"], "chung 2");
  assert.equal(s["5"], "riêng 5");
  assert.equal(suggestLevels(null, "communication")["3"], "");
});

test("helper nhỏ: totalWeight, missingLevels, isRubricEditable", () => {
  assert.equal(totalWeight([{ weight: 30 }, { weight: "70" }]), 100);
  assert.deepEqual(missingLevels({ levels: { ...full, 0: "", 5: "" } }), ["0", "5"]);
  assert.equal(isRubricEditable("rejected"), true);
  assert.equal(isRubricEditable("pending_review"), false);
});

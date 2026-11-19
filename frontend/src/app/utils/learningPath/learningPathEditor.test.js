import { test } from "node:test";
import assert from "node:assert/strict";
import {
  competencyOptions,
  draftableRequests,
  fromDTO,
  formatPriceInput,
  isEditable,
  moveSession,
  parsePrice,
  previewShares,
  proposeChecklist,
  saveErrors,
  splitObjectives,
  shrmLabel,
  toPayload,
  toggleShrm,
  unselectableShrmKeys,
} from "./learningPathEditor.js";

const session = (title, extra = {}) => ({ uid: title, title, objectivesText: "", shrmKeys: [], ...extra });

// Dạng rút gọn của `framework` trả về từ GET /api/competencies (LP-01).
const FRAMEWORK = {
  competencies: [
    { key: "communication", nameVi: "Giao tiếp & Trình bày", deprecated: false },
    { key: "teamwork", nameVi: "Làm việc nhóm & Cộng tác", deprecated: false },
    { key: "old_skill", nameVi: "Năng lực cũ", deprecated: true },
  ],
};

test("competencyOptions lấy từ bộ tiêu chí LP-01, bỏ key deprecated", () => {
  assert.deepEqual(competencyOptions(FRAMEWORK), [
    { key: "communication", label: "Giao tiếp & Trình bày" },
    { key: "teamwork", label: "Làm việc nhóm & Cộng tác" },
  ]);
  assert.deepEqual(competencyOptions(null), []);
});

test("shrmLabel hiện tên cả key deprecated; key lạ hoặc chưa tải bộ tiêu chí → chính key", () => {
  assert.equal(shrmLabel("old_skill", FRAMEWORK), "Năng lực cũ");
  assert.equal(shrmLabel("critical_thinking", FRAMEWORK), "critical_thinking");
  assert.equal(shrmLabel("communication"), "communication");
});

test("unselectableShrmKeys: key lạ và key deprecated; chưa có bộ tiêu chí thì không chặn", () => {
  assert.deepEqual(unselectableShrmKeys(["communication", "critical_thinking", "old_skill"], FRAMEWORK), ["critical_thinking", "old_skill"]);
  assert.deepEqual(unselectableShrmKeys(["critical_thinking"], null), []);
});

test("saveErrors chặn lưu khi buổi còn năng lực không còn dùng", () => {
  const state = { totalAmount: "", sessions: [session("Buổi một", { shrmKeys: ["communication", "critical_thinking"] })] };
  assert.deepEqual(saveErrors(state, FRAMEWORK), ["Buổi 1: bỏ chọn năng lực không còn dùng (critical_thinking)."]);
  assert.deepEqual(saveErrors(state), []);
});

test("parsePrice chấp nhận dấu chấm nghìn, từ chối chữ", () => {
  assert.equal(parsePrice("1.000.000"), 1_000_000);
  assert.equal(parsePrice("250000"), 250_000);
  assert.equal(parsePrice(""), 0);
  assert.ok(Number.isNaN(parsePrice("12a")));
  assert.equal(formatPriceInput("1000000"), "1.000.000");
  assert.equal(formatPriceInput(250000), "250.000");
  assert.equal(formatPriceInput(""), "");
  assert.equal(formatPriceInput("12a"), "12a");
});

test("toPayload: tách mục tiêu theo dòng, bỏ gạch đầu dòng và dòng trống, bỏ key trùng", () => {
  const payload = toPayload({
    goal: "  Đậu phỏng vấn  ",
    totalAmount: "1.000.000",
    sessions: [session(" STAR ", { objectivesText: "- Kể dự án\n\n• Trả lời follow-up", shrmKeys: ["communication", "communication"] })],
  });
  assert.deepEqual(payload, {
    goal: "Đậu phỏng vấn",
    totalAmount: 1_000_000,
    sessions: [{ title: "STAR", objectives: ["Kể dự án", "Trả lời follow-up"], shrmKeys: ["communication"] }],
  });
  assert.equal(splitObjectives(Array.from({ length: 15 }, (_, i) => `M${i}`).join("\n")).length, 10);
});

test("fromDTO chỉ lấy buổi lần đầu, đúng thứ tự", () => {
  const state = fromDTO({
    goal: "G", totalAmount: 900000,
    sessions: [
      { id: "b", order: 2, attempt: 1, title: "Hai", objectives: ["x"], shrmKeys: [] },
      { id: "a", order: 1, attempt: 1, title: "Một", objectives: [], shrmKeys: ["teamwork"] },
      { id: "r", order: 2, attempt: 2, title: "Hai (học lại)", objectives: [], shrmKeys: [] },
    ],
  });
  assert.deepEqual(state.sessions.map((s) => s.title), ["Một", "Hai"]);
  assert.equal(state.totalAmount, "900.000");
  assert.equal(state.sessions[1].objectivesText, "x");
});

test("checklist gửi: đủ 3 điều kiện mới ok; tên buổi quá ngắn chặn", () => {
  const ready = { totalAmount: "1000000", sessions: [session("Buổi một"), session("Buổi hai"), session("Buổi ba")] };
  assert.ok(proposeChecklist(ready, "completed").every((c) => c.ok));
  assert.equal(proposeChecklist(ready, "confirmed").find((c) => c.key === "assessment").ok, false);
  assert.equal(proposeChecklist({ ...ready, totalAmount: "5000" }, "completed").find((c) => c.key === "price").ok, false);
  assert.equal(proposeChecklist({ ...ready, sessions: [] }, "completed").find((c) => c.key === "sessions").ok, false);
  assert.deepEqual(saveErrors({ totalAmount: "", sessions: [session("ab")] }), ["Buổi 1: tên buổi cần ít nhất 3 ký tự."]);
});

test("moveSession, toggleShrm, previewShares (tổng luôn bằng T)", () => {
  const list = [session("A"), session("B"), session("C")];
  assert.deepEqual(moveSession(list, 0, 1).map((s) => s.title), ["B", "A", "C"]);
  assert.equal(moveSession(list, 0, -1), list);
  assert.deepEqual(toggleShrm(["a"], "a"), []);
  assert.deepEqual(toggleShrm([], "b"), ["b"]);
  const shares = previewShares("1.000.000", 3);
  assert.deepEqual(shares, [333_333, 333_333, 333_334]);
  assert.equal(shares.reduce((a, b) => a + b, 0), 1_000_000);
});

test("isEditable và draftableRequests", () => {
  assert.equal(isEditable("draft"), true);
  assert.equal(isEditable("revision_requested"), true);
  assert.equal(isEditable("proposed"), false);
  const rows = [
    { id: "1", status: "assessing", selectedOfferId: "o1", offers: [{ id: "o1" }], learningPath: null },
    { id: "2", status: "assessing", selectedOfferId: "o9", offers: [{ id: "o1" }], learningPath: null },
    { id: "3", status: "path_proposed", selectedOfferId: "o1", offers: [{ id: "o1" }], learningPath: { id: "p" } },
    { id: "4", status: "selected", selectedOfferId: "o1", offers: [{ id: "o1" }], learningPath: { id: "p2" } },
  ];
  assert.deepEqual(draftableRequests(rows).map((r) => r.id), ["1"]);
});

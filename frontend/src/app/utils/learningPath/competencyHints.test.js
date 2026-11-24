import { it } from "node:test";
import assert from "node:assert/strict";
import { addHintSession, hintStatusLabel, sessionsCoverKey } from "./competencyHints.js";
import { MAX_SESSIONS, emptySession } from "./learningPathEditor.js";

const hint = { shrmKey: "problem_solving", name: "Giải quyết vấn đề", status: "gap", gap: 2, currentLevel: 2, requiredLevel: 4, fromJob: true };

it("nhãn trạng thái theo từng loại gợi ý", () => {
  assert.equal(hintStatusLabel(hint), "Thiếu 2 mức (hiện 2/4)");
  assert.equal(hintStatusLabel({ status: "unknown", requiredLevel: 3 }), "Chưa có dữ liệu (job cần mức 3)");
  assert.equal(hintStatusLabel({ status: "met", currentLevel: 4, requiredLevel: 2 }), "Đã đạt (mức 4/2)");
});

it("điền vào buổi cuối còn trống thay vì thêm buổi mới", () => {
  const out = addHintSession([emptySession()], hint);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].shrmKeys, ["problem_solving"]);
  assert.equal(out[0].title, "Rèn năng lực: Giải quyết vấn đề");
});

it("thêm buổi mới khi buổi cuối đã có nội dung; không thêm trùng năng lực", () => {
  const first = { ...emptySession(), title: "Buổi 1", shrmKeys: ["communication"] };
  const out = addHintSession([first], hint);
  assert.equal(out.length, 2);
  assert.equal(sessionsCoverKey(out, "problem_solving"), true);
  assert.equal(addHintSession(out, hint), out);
});

it("không vượt số buổi tối đa", () => {
  const full = Array.from({ length: MAX_SESSIONS }, (_, i) => ({ ...emptySession(), title: `B${i}`, shrmKeys: ["teamwork"] }));
  assert.equal(addHintSession(full, hint).length, MAX_SESSIONS);
});

import { it } from "node:test";
import assert from "node:assert/strict";
import { bestFitInputError, cvContentText, setBestFitHandoff, takeBestFitHandoff, toggleCvSelection, txtFileName } from "./bestFit.js";

const JD = "Tuyển Backend Developer Node.js, MongoDB, Redis, 2 năm kinh nghiệm.";

it("kiểm tra đầu vào: 2–5 CV khác nhau và JD 30–20.000 ký tự", () => {
  assert.equal(bestFitInputError(["a"], JD), "Chọn ít nhất 2 CV để so sánh.");
  assert.equal(bestFitInputError(["a", "a"], JD), "Chọn ít nhất 2 CV để so sánh.");
  assert.equal(bestFitInputError(["a", "b", "c", "d", "e", "f"], JD), "Chọn tối đa 5 CV.");
  assert.match(bestFitInputError(["a", "b"], "ngắn"), /ít nhất 30 ký tự/);
  assert.equal(bestFitInputError(["a", "b"], JD), "");
});

it("chọn / bỏ chọn CV, không quá số tối đa", () => {
  assert.deepEqual(toggleCvSelection([], "a"), ["a"]);
  assert.deepEqual(toggleCvSelection(["a", "b"], "a"), ["b"]);
  assert.deepEqual(toggleCvSelection(["a", "b"], "c", 2), ["a", "b"]);
});

it("ghép chữ CV soạn trong editor giống backend", () => {
  const text = cvContentText({
    summary: "Backend dev",
    experiences: [{ position: "Dev", company: "ABC", startDate: "2023", isCurrent: true, bullets: ["Viết API"] }],
    skills: ["Node.js", "MongoDB"],
  });
  assert.equal(text, "Backend dev\nDev · ABC · 2023 – nay\nViết API\nKỹ năng: Node.js, MongoDB");
  assert.equal(cvContentText(null), "");
});

it("tên file .txt an toàn và bàn giao chỉ lấy được một lần", () => {
  assert.equal(txtFileName('CV / "Backend"'), "CV Backend.txt");
  assert.equal(txtFileName(""), "cv.txt");
  setBestFitHandoff({ cvFile: "x" });
  assert.deepEqual(takeBestFitHandoff(), { cvFile: "x" });
  assert.equal(takeBestFitHandoff(), null);
});

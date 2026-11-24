import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseQuestionUploadText, QUESTION_UPLOAD_MAX } from "./questionUpload.js";

describe("parseQuestionUploadText (CO-13)", () => {
  it("mỗi dòng một câu, bỏ dòng trống và khoảng trắng thừa", () => {
    assert.deepEqual(parseQuestionUploadText("  Câu 1?  \n\n\r\nCâu 2?\r\n   "), ["Câu 1?", "Câu 2?"]);
  });

  it("bỏ gạch đầu dòng và số thứ tự ở đầu dòng", () => {
    assert.deepEqual(parseQuestionUploadText("- Câu A\n* Câu B\n• Câu C\n1. Câu D\n12) Câu E"), [
      "Câu A",
      "Câu B",
      "Câu C",
      "Câu D",
      "Câu E",
    ]);
  });

  it("không cắt số nằm trong nội dung câu", () => {
    assert.deepEqual(parseQuestionUploadText("3 năm qua bạn học được gì?\n2024 là năm thế nào?"), [
      "3 năm qua bạn học được gì?",
      "2024 là năm thế nào?",
    ]);
  });

  it("đầu vào rỗng / null → mảng rỗng; giới hạn khớp backend", () => {
    assert.deepEqual(parseQuestionUploadText(""), []);
    assert.deepEqual(parseQuestionUploadText(null), []);
    assert.equal(QUESTION_UPLOAD_MAX, 50);
  });
});

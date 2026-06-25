import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeInterviewAnswersForEval } from "./mergeInterviewAnswers.js";

describe("mergeInterviewAnswersForEval", () => {
  it("giữ transcript thật, không cho body ghi đè", () => {
    const sessionAnswers = [
      { questionIndex: 0, questionText: "Q1", transcript: "Câu trả lời thật của tôi" },
    ];
    const backup = [{ questionIndex: 0, questionText: "Q1", transcript: "Câu trả lời hoàn hảo bịa ra" }];

    const merged = mergeInterviewAnswersForEval(sessionAnswers, backup);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].transcript, "Câu trả lời thật của tôi");
  });

  it("bù transcript từ body khi session chưa có (race condition)", () => {
    const sessionAnswers = [{ questionIndex: 0, questionText: "Q1", transcript: "" }];
    const backup = [{ questionIndex: 0, questionText: "Q1", transcript: "Trả lời bị mất do fire-and-forget" }];

    const merged = mergeInterviewAnswersForEval(sessionAnswers, backup);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].transcript, "Trả lời bị mất do fire-and-forget");
  });

  it("thêm câu hoàn toàn thiếu trong session từ body", () => {
    const sessionAnswers = [{ questionIndex: 0, questionText: "Q1", transcript: "A" }];
    const backup = [{ questionIndex: 1, questionText: "Q2", transcript: "B" }];

    const merged = mergeInterviewAnswersForEval(sessionAnswers, backup);
    assert.equal(merged.length, 2);
    assert.equal(merged[1].transcript, "B");
  });

  it("xử lý Mongoose subdocument có .toObject()", () => {
    const sessionAnswers = [
      {
        questionIndex: 0,
        transcript: "",
        toObject() {
          return { questionIndex: 0, questionText: "Q1", transcript: "" };
        },
      },
    ];
    const backup = [{ questionIndex: 0, transcript: "Bù vào" }];

    const merged = mergeInterviewAnswersForEval(sessionAnswers, backup);
    assert.equal(merged[0].transcript, "Bù vào");
    assert.equal(merged[0].questionText, "Q1");
  });

  it("không lỗi khi backupAnswers rỗng hoặc không hợp lệ", () => {
    const sessionAnswers = [{ questionIndex: 0, transcript: "A" }];
    assert.deepEqual(mergeInterviewAnswersForEval(sessionAnswers, []), sessionAnswers);
    assert.deepEqual(mergeInterviewAnswersForEval(sessionAnswers, null), sessionAnswers);
    assert.deepEqual(mergeInterviewAnswersForEval(null, null), []);
  });
});

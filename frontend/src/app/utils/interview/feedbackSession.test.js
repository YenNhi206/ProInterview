import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  questionObjectsFromSession,
  resolveFeedbackSessionId,
  tabDataBelongsTo,
  transcriptsFromSession,
} from "./feedbackSession.js";

const A = "64b7f0c2a1b2c3d4e5f60718";
const B = "64b7f0c2a1b2c3d4e5f60799";

describe("feedbackSession — trang kết quả mở từ thông báo", () => {
  it("ưu tiên ?sessionId= trên URL, rồi state, rồi buổi gần nhất của tab", () => {
    assert.equal(resolveFeedbackSessionId({ search: `?sessionId=${A}`, stateSessionId: B, storedSessionId: B }), A);
    assert.equal(resolveFeedbackSessionId({ search: "", stateSessionId: A, storedSessionId: B }), A);
    assert.equal(resolveFeedbackSessionId({ search: "", storedSessionId: B }), B);
    assert.equal(resolveFeedbackSessionId({}), "");
  });

  it("bỏ mã không hợp lệ trên URL, quay về state / tab", () => {
    assert.equal(resolveFeedbackSessionId({ search: "?sessionId=abc", storedSessionId: B }), B);
    assert.equal(resolveFeedbackSessionId({ search: "?sessionId=%3Cscript%3E", stateSessionId: A }), A);
  });

  it("chỉ dùng dữ liệu tab khi đúng buổi đang mở", () => {
    assert.equal(tabDataBelongsTo(A, A), true);
    assert.equal(tabDataBelongsTo(A, B), false, "tab đang giữ buổi khác → không ghép câu hỏi / transcript");
    assert.equal(tabDataBelongsTo(A, null), false);
    assert.equal(tabDataBelongsTo("", ""), false);
  });

  it("transcriptsFromSession xếp theo questionIndex, câu chưa trả lời là chuỗi rỗng", () => {
    const session = {
      questions: [{ question: "Q1" }, { question: "Q2" }, { question: "Q3" }],
      answers: [{ questionIndex: 2, transcript: "ba" }, { questionIndex: 0, transcript: "một" }],
    };
    assert.deepEqual(transcriptsFromSession(session), ["một", "", "ba"]);
    assert.deepEqual(transcriptsFromSession(null), []);
  });

  it("questionObjectsFromSession trả câu hỏi của buổi, không có thì null", () => {
    assert.deepEqual(questionObjectsFromSession({ questions: [{ question: "Q1" }] }), [{ question: "Q1" }]);
    assert.equal(questionObjectsFromSession({ questions: [] }), null);
    assert.equal(questionObjectsFromSession(undefined), null);
  });
});

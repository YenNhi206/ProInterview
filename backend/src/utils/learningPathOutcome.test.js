import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LEARNING_PATH_OUTCOME_NEXT as NEXT,
  allOrdersPassed,
  needsSupplementarySession,
  resolveOutcomeNextStep,
} from "./learningPathOutcome.js";

const s = (id, order, attempt, status, outcome = null) => ({ _id: id, order, attempt, status, outcome });

describe("allOrdersPassed", () => {
  it("true khi lần học mới nhất của mọi order đều đạt", () => {
    assert.equal(allOrdersPassed([s("a", 1, 1, "done", "passed"), s("b", 2, 1, "done", "passed")]), true);
  });

  it("buổi học lại đạt thay cho lần trượt trước", () => {
    assert.equal(allOrdersPassed([s("a", 1, 1, "done", "not_passed"), s("a2", 1, 2, "done", "passed"), s("b", 2, 1, "done", "passed")]), true);
  });

  it("false khi còn buổi chưa học hoặc buổi bổ sung chờ thanh toán", () => {
    assert.equal(allOrdersPassed([s("a", 1, 1, "done", "passed"), s("b", 2, 1, "planned")]), false);
    assert.equal(allOrdersPassed([s("a", 1, 2, "done", "not_passed"), s("a3", 1, 3, "pending_payment")]), false);
  });

  it("bỏ buổi cancelled; lộ trình không có buổi thì false", () => {
    assert.equal(allOrdersPassed([s("a", 1, 1, "done", "passed"), s("x", 2, 1, "cancelled")]), true);
    assert.equal(allOrdersPassed([]), false);
  });
});

describe("resolveOutcomeNextStep", () => {
  it("đạt buổi giữa → mở buổi kế; đạt buổi cuối → hoàn thành lộ trình", () => {
    const mid = s("a", 1, 1, "done", "passed");
    assert.equal(resolveOutcomeNextStep(mid, "passed", [mid, s("b", 2, 1, "planned")]), NEXT.OPEN_NEXT);
    const last = s("b", 2, 1, "done", "passed");
    assert.equal(resolveOutcomeNextStep(last, "passed", [mid, last]), NEXT.COMPLETE_PATH);
  });

  it("chưa đạt lần đầu → học lại miễn phí; từ lần học lại trở đi → buổi bổ sung có phí", () => {
    assert.equal(resolveOutcomeNextStep(s("a", 1, 1, "done", "not_passed"), "not_passed", []), NEXT.FREE_RETAKE);
    assert.equal(resolveOutcomeNextStep(s("a2", 1, 2, "done", "not_passed"), "not_passed", []), NEXT.SUPPLEMENTARY_REQUIRED);
    assert.equal(resolveOutcomeNextStep(s("a3", 1, 3, "done", "not_passed"), "not_passed", []), NEXT.SUPPLEMENTARY_REQUIRED);
  });
});

describe("needsSupplementarySession", () => {
  const failedRetake = [s("a", 1, 1, "done", "not_passed"), s("a2", 1, 2, "done", "not_passed")];

  it("true với lần học lại mới nhất chưa đạt", () => {
    assert.equal(needsSupplementarySession(failedRetake, "a2"), true);
  });

  it("false với lần trượt đầu, lần cũ hơn, hoặc khi đã có buổi bổ sung", () => {
    assert.equal(needsSupplementarySession([s("a", 1, 1, "done", "not_passed")], "a"), false);
    assert.equal(needsSupplementarySession(failedRetake, "a"), false);
    assert.equal(needsSupplementarySession([...failedRetake, s("a3", 1, 3, "pending_payment")], "a2"), false);
    assert.equal(needsSupplementarySession(failedRetake, "zzz"), false);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isScoreValue, missingDimensions, indexEvaluations, findIncomplete, mergeRetry } from "./evaluationCompleteness.js";

const full = (idx, extra = {}) => ({
  question_index: idx,
  scores: { clarity: 4, structure: 3.5, relevance: 4, credibility: 3 },
  overall: 3.6,
  ...extra,
});

describe("evaluationCompleteness", () => {
  it("isScoreValue: 0 hợp lệ; null, '', NaN, boolean, thiếu → không", () => {
    assert.equal(isScoreValue(0), true);
    assert.equal(isScoreValue("3.5"), true);
    for (const v of [null, undefined, "", "abc", NaN, true]) assert.equal(isScoreValue(v), false, String(v));
  });

  it("missingDimensions: câu không có trong output thiếu cả 4", () => {
    assert.deepEqual(missingDimensions(undefined), ["clarity", "structure", "relevance", "credibility"]);
    assert.deepEqual(missingDimensions({ scores: { clarity: 4, structure: null, relevance: 3 } }), ["structure", "credibility"]);
    assert.deepEqual(missingDimensions(full(0)), []);
  });

  it("findIncomplete gồm cả câu LLM bỏ sót; bỏ index lạ", () => {
    const byIndex = indexEvaluations([full(0), { question_index: 1, scores: { clarity: 4 } }, full(9)], [0, 1, 2]);
    const inc = findIncomplete(byIndex, [0, 1, 2]);
    assert.deepEqual([...inc.keys()], [1, 2]);
    assert.deepEqual(inc.get(1), ["structure", "relevance", "credibility"]);
    assert.equal(byIndex.has(9), false);
  });

  it("mergeRetry chỉ lấp tiêu chí thiếu, không ghi đè tiêu chí đã có", () => {
    const merged = mergeRetry(
      { question_index: 1, scores: { clarity: 4, structure: null }, strengths: ["a"] },
      { question_index: 1, scores: { clarity: 1, structure: 2, relevance: 3, credibility: 5 }, overall: 2.75 },
    );
    assert.deepEqual(merged.scores, { clarity: 4, structure: 2, relevance: 3, credibility: 5 });
    assert.equal(merged.overall, 2.75);
    assert.deepEqual(merged.strengths, ["a"]);
  });
});

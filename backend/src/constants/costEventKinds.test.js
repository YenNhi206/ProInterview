import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  COST_EVENT_KIND,
  COST_EVENT_KINDS,
  COST_KINDS_WITH_DAILY_THRESHOLD,
  getCostKindDailyThreshold,
  isValidCostEventKind,
} from "./costEventKinds.js";

const ENV_KEYS = [
  "COST_ALERT_RUBRIC_SCORING_DAILY_USD",
  "COST_ALERT_RUBRIC_SCORING_DAILY_COUNT",
];

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("costEventKinds (AI-12)", () => {
  it("giữ 3 kind cũ và thêm rubric_scoring, course_prescreen", () => {
    assert.deepEqual(
      [...COST_EVENT_KINDS].sort(),
      ["avatar_video_did", "avatar_video_elevenlabs", "course_prescreen", "llm_call", "rubric_scoring", "tts_elevenlabs"],
    );
    assert.equal(COST_EVENT_KIND.RUBRIC_SCORING, "rubric_scoring");
    assert.equal(COST_EVENT_KIND.COURSE_PRESCREEN, "course_prescreen");
  });

  it("isValidCostEventKind chỉ nhận kind trong danh sách", () => {
    assert.equal(isValidCostEventKind("rubric_scoring"), true);
    assert.equal(isValidCostEventKind("rubric"), false);
    assert.equal(isValidCostEventKind(undefined), false);
  });

  it("chỉ 2 kind mới có ngưỡng ngày, kèm giá trị mặc định", () => {
    assert.deepEqual([...COST_KINDS_WITH_DAILY_THRESHOLD].sort(), ["course_prescreen", "rubric_scoring"]);
    assert.deepEqual(getCostKindDailyThreshold("rubric_scoring"), { maxDailyUsd: 2, maxDailyCount: 300 });
    assert.deepEqual(getCostKindDailyThreshold("course_prescreen"), { maxDailyUsd: 1, maxDailyCount: 50 });
    assert.equal(getCostKindDailyThreshold("llm_call"), null);
  });

  it("env ghi đè ngưỡng; giá trị rỗng, âm, 0 hoặc không phải số thì dùng mặc định", () => {
    process.env.COST_ALERT_RUBRIC_SCORING_DAILY_USD = "5.5";
    process.env.COST_ALERT_RUBRIC_SCORING_DAILY_COUNT = "abc";
    assert.deepEqual(getCostKindDailyThreshold("rubric_scoring"), { maxDailyUsd: 5.5, maxDailyCount: 300 });

    for (const bad of ["", "  ", "0", "-3"]) {
      process.env.COST_ALERT_RUBRIC_SCORING_DAILY_USD = bad;
      assert.equal(getCostKindDailyThreshold("rubric_scoring").maxDailyUsd, 2, `giá trị "${bad}"`);
    }
  });
});

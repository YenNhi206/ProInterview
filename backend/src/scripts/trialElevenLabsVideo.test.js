/** AI-14: gộp kết quả chạy thử video ElevenLabs theo model (không gọi mạng). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { summarizeByModel, percentile } from "./trialElevenLabsVideo.js";

describe("AI-14: summarizeByModel", () => {
  it("p50/p95 theo thời gian render, credit/giây trung bình, có lỗi thì không đạt", () => {
    const rows = [
      { model: "a", ok: true, renderSeconds: 40, audioSeconds: 5, credits: 500 },
      { model: "a", ok: true, renderSeconds: 60, audioSeconds: 10, credits: 1000 },
      { model: "b", ok: true, renderSeconds: 200, audioSeconds: 5, credits: null },
      { model: "c", ok: true, renderSeconds: 50, audioSeconds: 5, credits: 100 },
      { model: "c", ok: false, error: "x" },
    ];
    const [a, b, c] = summarizeByModel(rows);
    assert.deepEqual(a, { model: "a", n: 2, failed: 0, p50Seconds: 40, p95Seconds: 60, creditsPerSecond: 100, meetsP95: true });
    assert.equal(b.meetsP95, false, "p95 > 130 giây");
    assert.equal(b.creditsPerSecond, null);
    assert.equal(c.failed, 1);
    assert.equal(c.meetsP95, false, "có video lỗi thì không đạt");
  });

  it("percentile nearest-rank, mảng rỗng trả null", () => {
    assert.equal(percentile([], 95), null);
    assert.equal(percentile([3, 1, 2], 50), 2);
  });
});

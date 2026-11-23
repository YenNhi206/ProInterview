import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createStepTimer } from "./stepTimer.js";

/** Đồng hồ giả: mỗi lần gọi `tick(ms)` tiến thời gian. */
function fakeClock() {
  let t = 1_000;
  return { now: () => t, tick: (ms) => { t += ms; } };
}

describe("createStepTimer (N-11)", () => {
  it("ghi thời gian từng bước và tổng durationMs", async () => {
    const clock = fakeClock();
    const timer = createStepTimer(clock.now);
    const v = await timer.step("ttsMs", async () => { clock.tick(800); return "audio"; });
    assert.equal(v, "audio");
    await timer.step("didRenderMs", async () => { clock.tick(4_000); });
    clock.tick(50);
    assert.deepEqual(timer.summary({ ok: true }), { ok: true, ttsMs: 800, didRenderMs: 4_000, durationMs: 4_850 });
    assert.equal(timer.current, null);
  });

  it("bước lỗi vẫn được ghi thời gian, `current` chỉ ra bước lỗi", async () => {
    const clock = fakeClock();
    const timer = createStepTimer(clock.now);
    await assert.rejects(
      timer.step("didRenderMs", async () => { clock.tick(120_000); throw new Error("timeout"); }),
      /timeout/,
    );
    assert.equal(timer.current, "didRenderMs");
    assert.equal(timer.summary().didRenderMs, 120_000);
  });

  it("cùng tên bước thì cộng dồn", async () => {
    const clock = fakeClock();
    const timer = createStepTimer(clock.now);
    await timer.step("pythonMs", async () => clock.tick(10));
    await timer.step("pythonMs", async () => clock.tick(15));
    assert.equal(timer.summary().pythonMs, 25);
  });
});

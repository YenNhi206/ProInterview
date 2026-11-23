/**
 * N-11 (NFR-01, NFR-02): đo thời gian từng bước của một pipeline để ghi log có `durationMs`.
 *
 *   const timing = createStepTimer();
 *   const audio = await timing.step("ttsMs", () => tts(text));
 *   logger.info("avatar_video_timing", timing.summary({ ok: true }));
 *   // → { ok: true, ttsMs: 812, durationMs: 815 }
 *
 * - `step` vẫn ghi thời gian khi bước ném lỗi; `current` là tên bước đang chạy hoặc vừa lỗi.
 * - Gọi cùng tên nhiều lần thì cộng dồn.
 * - `summary` không đổi trạng thái, gọi lại được.
 */
export function createStepTimer(now = () => Date.now()) {
  const startedAt = now();
  const steps = {};
  const timer = {
    current: null,
    async step(name, fn) {
      timer.current = name;
      const t0 = now();
      try {
        const value = await fn();
        timer.current = null;
        return value;
      } finally {
        steps[name] = (steps[name] ?? 0) + Math.max(0, now() - t0);
      }
    },
    elapsed() {
      return Math.max(0, now() - startedAt);
    },
    summary(extra = {}) {
      return { ...extra, ...steps, durationMs: timer.elapsed() };
    },
  };
  return timer;
}

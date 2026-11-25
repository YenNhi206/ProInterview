/**
 * Circuit breaker cho provider video avatar (AI-15), mỗi provider một bộ đếm riêng.
 * Mở sau `threshold` lỗi liên tiếp → bỏ qua pregen để không tốn credit; sau `resetMs` thì cho
 * một lượt thử lại (half-open). In-memory, theo từng process.
 */
import { logger } from "../../config/logger.js";

export function createCircuitBreaker(name, { threshold = 3, resetMs = 5 * 60 * 1000, now = () => Date.now() } = {}) {
  let failures = 0;
  let openSince = 0;

  return {
    name,
    isOpen() {
      if (failures < threshold) return false;
      if (now() - openSince > resetMs) {
        failures = 0; // half-open: lượt sau được thử
        return false;
      }
      return true;
    },
    recordFailure() {
      failures++;
      if (failures >= threshold) openSince = now();
      logger.warn("avatar_circuit_failure", { provider: name, failures, open: this.isOpen() });
    },
    recordSuccess() {
      if (failures > 0) logger.info("avatar_circuit_reset", { provider: name });
      failures = 0;
      openSince = 0;
    },
    /** Chỉ dùng trong test. */
    reset() {
      failures = 0;
      openSince = 0;
    },
  };
}

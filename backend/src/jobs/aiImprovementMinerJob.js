/**
 * AI-03: mỗi ngày đào ModerationItem đã xử lý thành đề xuất cải tiến AI (`aiImprovementMinerService`).
 * Lượt đầu chạy sau 10 phút để không tranh tài nguyên lúc khởi động.
 */
import mongoose from "mongoose";
import { mineImprovementProposals } from "../services/aiImprovementMinerService.js";
import { logger } from "../config/logger.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 10 * 60 * 1000;

let timer;
let running = false;

export function startAiImprovementMinerJob() {
  if (running) return;
  running = true;
  const tick = async () => {
    try {
      if (mongoose.connection.readyState === 1) await mineImprovementProposals();
    } catch (error) {
      logger.error("ai_improvement_miner_failed", { error: error?.message });
    }
    if (running) {
      timer = setTimeout(tick, DAY_MS);
      timer.unref?.();
    }
  };
  timer = setTimeout(tick, FIRST_RUN_DELAY_MS);
  timer.unref?.();
}

export function stopAiImprovementMinerJob() {
  running = false;
  clearTimeout(timer);
}

/**
 * costLedgerService.js
 * Ghi + tổng hợp chi phí AI (LLM/TTS/avatar video) vào MongoDB — phục vụ Epic 1
 * (Task 1.2 cost dashboard, Task 1.3 cache metrics) mà không phụ thuộc query API Langfuse.
 *
 * Nguồn ghi: langfuseService.js gọi recordCostEvent() ngay tại logGeneration()/logEvent()
 * (dual-write — Langfuse cho trace chi tiết, collection này cho dashboard/alert nội bộ).
 */
import mongoose from "mongoose";
import { CostEvent } from "../models/CostEvent.js";
import { logger } from "../config/logger.js";
import { sendSlackAlert } from "./alertService.js";

function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

/**
 * @param {object} opts
 * @param {string} opts.kind - "llm_call" | "tts_elevenlabs" | "avatar_video_did"
 * @param {string[]} [opts.tags]
 * @param {string} [opts.userId]
 * @param {string} [opts.model]
 * @param {number} [opts.costUsd=0]
 * @param {number} [opts.costVnd=0]
 * @param {boolean} [opts.fromCache=false]
 * @param {object} [opts.metadata]
 */
export async function recordCostEvent({
  kind,
  tags = [],
  userId,
  model,
  costUsd = 0,
  costVnd = 0,
  fromCache = false,
  metadata = {},
}) {
  // QA-01: Chế độ mock LLM/D-ID/ElevenLabs bằng biến môi trường -> không phát sinh CostEvent
  if (process.env.MOCK_AI_SERVICES === "true" || process.env.MOCK_AI === "true") {
    return null;
  }
  if (!isMongoReady()) return; // dev không có Mongo, hoặc DB tạm mất kết nối — bỏ qua, không throw
  try {
    await CostEvent.create({
      kind,
      tags,
      userId: userId ? String(userId) : null,
      model:  model ?? null,
      costUsd,
      costVnd,
      fromCache,
      metadata,
    });
  } catch (err) {
    logger.warn("cost_ledger_write_failed", { error: err.message, kind });
  }
}

/**
 * Cost/ngày breakdown theo `kind` (loại request), N ngày gần nhất + alert spike >2x so với
 * hôm trước (Task 1.2).
 * @param {number} [days=14]
 */
export async function getCostDashboard({ days = 14 } = {}) {
  if (!isMongoReady()) return { ok: false, error: "MongoDB chưa kết nối." };

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await CostEvent.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id:     { day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, kind: "$kind" },
        costUsd: { $sum: "$costUsd" },
        costVnd: { $sum: "$costVnd" },
        count:   { $sum: 1 },
      },
    },
    { $sort: { "_id.day": 1 } },
  ]);

  const byDayAndKind = rows.map((r) => ({
    day:     r._id.day,
    kind:    r._id.kind,
    costUsd: r.costUsd,
    costVnd: r.costVnd,
    count:   r.count,
  }));

  const totalsByDay = {};
  for (const r of byDayAndKind) {
    totalsByDay[r.day] = (totalsByDay[r.day] ?? 0) + r.costUsd;
  }
  const sortedDays   = Object.keys(totalsByDay).sort();
  const todayKey     = sortedDays.at(-1);
  const yesterdayKey = sortedDays.at(-2);
  const todayCostUsd     = totalsByDay[todayKey] ?? 0;
  const yesterdayCostUsd = totalsByDay[yesterdayKey] ?? 0;
  const spike = yesterdayCostUsd > 0 && todayCostUsd > yesterdayCostUsd * 2;

  if (spike) {
    sendSlackAlert(
      `🚨 *Cost spike phát hiện*: hôm nay $${todayCostUsd.toFixed(2)} vs hôm qua $${yesterdayCostUsd.toFixed(2)} (>2x). Kiểm tra dashboard cost.`,
      { dedupKey: "cost_spike" },
    );
  }

  return {
    ok: true,
    days,
    byDayAndKind,
    totalsByDay,
    todayCostUsd,
    yesterdayCostUsd,
    spike,
  };
}

/**
 * Cache hit/miss + số lần render baseline thực tế trong tháng — alert nếu > 6 (Task 1.3).
 * Baseline render = avatar_video_did, fromCache=false, metadata.persistVideo=true
 * (persistVideo chỉ được set true cho baseline questions — xem avatarService.js).
 * @param {number} [days=30] - phạm vi tính hit/miss rate
 */
export async function getCacheMetrics({ days = 30 } = {}) {
  if (!isMongoReady()) return { ok: false, error: "MongoDB chưa kết nối." };

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [hitMissRows, baselineRendersThisMonth] = await Promise.all([
    CostEvent.aggregate([
      { $match: { kind: "avatar_video_did", createdAt: { $gte: since } } },
      { $group: { _id: "$fromCache", count: { $sum: 1 } } },
    ]),
    CostEvent.countDocuments({
      kind:                    "avatar_video_did",
      fromCache:               false,
      "metadata.persistVideo": true,
      createdAt:               { $gte: monthStart },
    }),
  ]);

  const cacheHits   = hitMissRows.find((r) => r._id === true)?.count ?? 0;
  const cacheMisses = hitMissRows.find((r) => r._id === false)?.count ?? 0;
  const baselineRenderAlert = baselineRendersThisMonth > 6;

  if (baselineRenderAlert) {
    sendSlackAlert(
      `⚠️ *Baseline video render bất thường*: ${baselineRendersThisMonth} lần render thật trong tháng (kỳ vọng ≤ 6 = 3 câu × 2 gender). Có thể cache đang bị invalidate ngoài ý muốn.`,
      { dedupKey: "baseline_render_alert", dedupMs: 24 * 60 * 60 * 1000 },
    );
  }

  return {
    ok: true,
    days,
    cacheHits,
    cacheMisses,
    hitRate: cacheHits + cacheMisses > 0 ? cacheHits / (cacheHits + cacheMisses) : null,
    baselineRendersThisMonth,
    baselineRenderAlert,
  };
}

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
import {
  COST_EVENT_KIND,
  COST_KINDS_WITH_DAILY_THRESHOLD,
  getCostKindDailyThreshold,
  isValidCostEventKind,
} from "../constants/costEventKinds.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

/**
 * @param {object} opts
 * @param {string} opts.kind - một giá trị trong `COST_EVENT_KINDS` (constants/costEventKinds.js)
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
  if (!isValidCostEventKind(kind)) {
    logger.warn("cost_ledger_unknown_kind", { kind });
    return;
  }
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
    return;
  }

  if (getCostKindDailyThreshold(kind)) {
    try {
      await checkCostKindDailyThreshold(kind);
    } catch (err) {
      logger.warn("cost_threshold_check_failed", { error: err.message, kind });
    }
  }
}

function utcDayStart(now) {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Tổng chi phí và số lần gọi trong ngày (UTC, cùng cách group với getCostDashboard) của một kind
 * có ngưỡng; vượt `maxDailyUsd` hoặc `maxDailyCount` thì gửi Slack, tối đa 1 lần / kind / ngày (AI-12).
 *
 * @param {string} kind
 * @param {object} [opts]
 * @param {Date}    [opts.now=new Date()]
 * @param {boolean} [opts.alert=true] - false: chỉ trả trạng thái, không gửi Slack (dùng cho dashboard)
 * @returns {Promise<null | { kind, day, costUsd, count, maxDailyUsd, maxDailyCount, exceeded }>}
 *   null khi kind không có ngưỡng hoặc MongoDB chưa kết nối.
 */
export async function checkCostKindDailyThreshold(kind, { now = new Date(), alert = true } = {}) {
  const threshold = getCostKindDailyThreshold(kind);
  if (!threshold || !isMongoReady()) return null;

  const since = utcDayStart(now);
  const [row] = await CostEvent.aggregate([
    { $match: { kind, createdAt: { $gte: since, $lt: new Date(since.getTime() + DAY_MS) } } },
    { $group: { _id: null, costUsd: { $sum: "$costUsd" }, count: { $sum: 1 } } },
  ]);

  const day      = since.toISOString().slice(0, 10);
  const costUsd  = row?.costUsd ?? 0;
  const count    = row?.count ?? 0;
  const exceeded = costUsd > threshold.maxDailyUsd || count > threshold.maxDailyCount;

  if (exceeded && alert) {
    sendSlackAlert(
      `💸 *Chi phí ${kind} vượt ngưỡng ngày ${day}*: $${costUsd.toFixed(3)} / ${count} lần ` +
        `(ngưỡng $${threshold.maxDailyUsd} hoặc ${threshold.maxDailyCount} lần). ` +
        "Kiểm tra vòng lặp gọi lại hoặc model đang dùng.",
      { dedupKey: `cost_kind_${kind}_${day}`, dedupMs: DAY_MS },
    );
  }

  return { kind, day, costUsd, count, ...threshold, exceeded };
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

  const kindThresholds = (
    await Promise.all(
      COST_KINDS_WITH_DAILY_THRESHOLD.map((kind) => checkCostKindDailyThreshold(kind, { alert: false })),
    )
  ).filter(Boolean);

  return {
    ok: true,
    days,
    byDayAndKind,
    totalsByDay,
    todayCostUsd,
    yesterdayCostUsd,
    spike,
    kindThresholds,
  };
}

/**
 * Cache hit/miss + số lần render baseline thực tế trong tháng — alert nếu > 6 (Task 1.3).
 * Baseline render = video avatar (D-ID hoặc ElevenLabs, AI-16), fromCache=false, metadata.persistVideo=true
 * (persistVideo chỉ được set true cho baseline questions — xem avatarService.js).
 * @param {number} [days=30] - phạm vi tính hit/miss rate
 */
const AVATAR_VIDEO_KINDS = [COST_EVENT_KIND.AVATAR_VIDEO_DID, COST_EVENT_KIND.AVATAR_VIDEO_ELEVENLABS];

export async function getCacheMetrics({ days = 30 } = {}) {
  if (!isMongoReady()) return { ok: false, error: "MongoDB chưa kết nối." };

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [hitMissRows, baselineRendersThisMonth] = await Promise.all([
    CostEvent.aggregate([
      { $match: { kind: { $in: AVATAR_VIDEO_KINDS }, createdAt: { $gte: since } } },
      { $group: { _id: "$fromCache", count: { $sum: 1 } } },
    ]),
    CostEvent.countDocuments({
      kind:                    { $in: AVATAR_VIDEO_KINDS },
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

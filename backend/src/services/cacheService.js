/**
 * cacheService.js
 * Cache abstraction — Upstash Redis REST API hoặc in-memory Map.
 *
 * Priority:
 *   1. Upstash Redis REST (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN set)
 *   2. Standard Redis URL (REDIS_URL) — dùng chung format với ioredis nếu cần
 *      Note: Node 20 không có native Redis client; dùng Upstash REST nếu muốn cloud.
 *   3. In-memory Map fallback — CHỈ cho phép ở dev/test. Ở production, fallback im lặng
 *      sang Map làm cache hit rate tụt không ai biết (mỗi Render instance có Map riêng,
 *      mất khi restart) → tốn credit video avatar/LLM lãng phí. Vì vậy production fail-fast:
 *      lỗi Redis sẽ throw ra ngoài thay vì fallback (xem `isProd()` trong cacheGet/cacheSet).
 *      Việc thiếu cấu hình Redis hoàn toàn ở production được chặn sớm hơn, ở server.js
 *      (process.exit trước khi nhận request).
 *
 * Env vars (cấu hình 1 trong 2):
 *   UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN=AXXXyyy...
 *
 * Upstash REST API docs: https://upstash.com/docs/redis/features/restapi
 */

import { logger } from "../config/logger.js";

function isProd() {
  return process.env.NODE_ENV === "production";
}

// Mode quan sát được gần nhất — expose qua GET /api/health (cache_mode).
let lastMode = "unknown"; // "redis" | "memory"
export function getCacheMode() {
  return lastMode;
}

// ── In-memory fallback ────────────────────────────────────────────────────────
const memCache = new Map();   // key → { value, expiresAt }

function memGet(key) {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    memCache.delete(key);
    return null;
  }
  return entry.value;
}

function memSet(key, value, ttlSeconds) {
  memCache.set(key, {
    value,
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
  });
}

function memDel(key) {
  memCache.delete(key);
}

// ── Upstash Redis REST API ────────────────────────────────────────────────────

function upstashCfg() {
  return {
    url:   process.env.UPSTASH_REDIS_REST_URL   ?? "",
    token: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
  };
}

export function isRedisEnabled() {
  const { url, token } = upstashCfg();
  return Boolean(url && token);
}

async function upstashCmd(args) {
  const { url, token } = upstashCfg();
  const res = await fetch(`${url.replace(/\/$/, "")}`, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body:   JSON.stringify(args),
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) {
    throw new Error(`Upstash HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.result;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Lấy giá trị từ cache.
 * @param {string} key
 * @returns {Promise<string|null>}
 */
export async function cacheGet(key) {
  if (isRedisEnabled()) {
    try {
      const val = await upstashCmd(["GET", key]);
      lastMode = "redis";
      return typeof val === "string" ? val : null;
    } catch (err) {
      if (isProd()) {
        logger.error("cache_redis_failure_prod", { op: "GET", key, error: err.message });
        throw new Error(`Redis cache GET thất bại ở production (fail-fast, không fallback Map): ${err.message}`);
      }
      logger.warn("cache_redis_failure_dev_fallback", { op: "GET", key, error: err.message });
    }
  }
  lastMode = "memory";
  return memGet(key);
}

/**
 * Lưu giá trị vào cache với TTL.
 * @param {string} key
 * @param {string} value
 * @param {number|null} [ttlSeconds=86400] - Thời gian sống (giây). Truyền null/0 để cache vĩnh viễn (không hết hạn).
 */
export async function cacheSet(key, value, ttlSeconds = 86400) {
  if (isRedisEnabled()) {
    try {
      const args = ttlSeconds
        ? ["SET", key, String(value), "EX", ttlSeconds]
        : ["SET", key, String(value)];
      await upstashCmd(args);
      lastMode = "redis";
      return;
    } catch (err) {
      if (isProd()) {
        logger.error("cache_redis_failure_prod", { op: "SET", key, error: err.message });
        throw new Error(`Redis cache SET thất bại ở production (fail-fast, không fallback Map): ${err.message}`);
      }
      logger.warn("cache_redis_failure_dev_fallback", { op: "SET", key, error: err.message });
    }
  }
  lastMode = "memory";
  memSet(key, value, ttlSeconds);
}

/**
 * Xóa key khỏi cache.
 * @param {string} key
 */
export async function cacheDel(key) {
  if (isRedisEnabled()) {
    try {
      await upstashCmd(["DEL", key]);
      lastMode = "redis";
      return;
    } catch (err) {
      if (isProd()) {
        logger.error("cache_redis_failure_prod", { op: "DEL", key, error: err.message });
        throw new Error(`Redis cache DEL thất bại ở production (fail-fast, không fallback Map): ${err.message}`);
      }
      logger.warn("cache_redis_failure_dev_fallback", { op: "DEL", key, error: err.message });
    }
  }
  lastMode = "memory";
  memDel(key);
}

/**
 * INCR atomic — dùng cho counter (cache hit/miss metrics). Trả về giá trị mới sau khi tăng.
 * @param {string} key
 * @param {number|null} [ttlSeconds] - Set TTL nếu đây là lần tạo key đầu tiên (EXPIRE sau INCR).
 * @returns {Promise<number>}
 */
export async function cacheIncr(key, ttlSeconds) {
  if (isRedisEnabled()) {
    try {
      const val = await upstashCmd(["INCR", key]);
      if (ttlSeconds && val === 1) {
        // Chỉ set TTL ở lần tạo key đầu tiên — tránh refresh TTL liên tục mỗi lần INCR.
        await upstashCmd(["EXPIRE", key, ttlSeconds]).catch(() => {});
      }
      lastMode = "redis";
      return Number(val) || 0;
    } catch (err) {
      if (isProd()) {
        logger.error("cache_redis_failure_prod", { op: "INCR", key, error: err.message });
        throw new Error(`Redis cache INCR thất bại ở production (fail-fast, không fallback Map): ${err.message}`);
      }
      logger.warn("cache_redis_failure_dev_fallback", { op: "INCR", key, error: err.message });
    }
  }
  lastMode = "memory";
  const current = Number(memGet(key)) || 0;
  const next = current + 1;
  memSet(key, String(next), ttlSeconds);
  return next;
}

/**
 * Kiểm tra key có tồn tại không.
 * @param {string} key
 * @returns {Promise<boolean>}
 */
export async function cacheExists(key) {
  const val = await cacheGet(key);
  return val !== null;
}

/**
 * Helper: lấy hoặc tính toán giá trị (lazy cache).
 * @param {string} key
 * @param {Function} compute - async function trả về string
 * @param {number} [ttlSeconds]
 * @returns {Promise<{value: string, fromCache: boolean}>}
 */
export async function cacheGetOrSet(key, compute, ttlSeconds = 86400) {
  const cached = await cacheGet(key);
  if (cached !== null) return { value: cached, fromCache: true };

  const value = await compute();
  await cacheSet(key, value, ttlSeconds);
  return { value, fromCache: false };
}

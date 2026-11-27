/**
 * PM-06: Quality Dashboard (`getQualityStats`) vẫn trả số liệu khi Redis production không kết nối được.
 * Trước đây cacheService fail-fast ném lỗi → `/api/moderator/quality/stats` trả 500 (log production 27/11/2026:
 * `cache_redis_failure_prod ... fetch failed`). Chỉ dashboard này bỏ qua cache; các chỗ khác giữ fail-fast.
 */
import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyTestEnv, startMongoHarness, stopMongoHarness } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();

let harness;
let getQualityStats;
let cacheGet;
const saved = {};

function setEnv(vars) {
  for (const [k, v] of Object.entries(vars)) {
    if (!(k in saved)) saved[k] = process.env[k];
    process.env[k] = v;
  }
}

function restoreEnv() {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
    delete saved[k];
  }
}

before(async () => {
  harness = await startMongoHarness();
  ({ getQualityStats } = await import("../services/moderationQualityService.js"));
  ({ cacheGet } = await import("../services/cacheService.js"));
});

after(async () => {
  restoreEnv();
  if (harness) await stopMongoHarness(harness);
});

describe("Quality Dashboard khi Redis production lỗi", () => {
  it("cacheService ở production vẫn fail-fast (các chỗ khác không đổi)", async () => {
    // Cổng 9 trên máy cục bộ không có dịch vụ → fetch failed, giống log production.
    setEnv({ NODE_ENV: "production", UPSTASH_REDIS_REST_URL: "http://127.0.0.1:9", UPSTASH_REDIS_REST_TOKEN: "test-token" });
    try {
      await assert.rejects(() => cacheGet("any-key"), /Redis cache GET thất bại ở production/);
    } finally {
      restoreEnv();
    }
  });

  it("getQualityStats bỏ qua cache, vẫn trả số liệu thay vì lỗi 500", async () => {
    setEnv({ NODE_ENV: "production", UPSTASH_REDIS_REST_URL: "http://127.0.0.1:9", UPSTASH_REDIS_REST_TOKEN: "test-token" });
    try {
      const res = await getQualityStats({});
      assert.equal(res.ok, true);
      assert.equal(res.cached, false);
      assert.ok(res.stats.range?.from && res.stats.range?.to);
      assert.ok(res.stats.bank, "có khối số liệu ngân hàng câu hỏi");
    } finally {
      restoreEnv();
    }
  });

  it("Redis bình thường (dev, cache bộ nhớ): lần hai lấy từ cache", async () => {
    const q = { from: "2026-10-01T00:00:00.000Z", to: "2026-10-31T00:00:00.000Z" };
    const first = await getQualityStats(q);
    const second = await getQualityStats(q);
    assert.equal(first.cached, false);
    assert.equal(second.cached, true);
    assert.deepEqual(second.stats, first.stats);
  });
});

/**
 * Integration: cost ledger (Sprint 1 — Task 1.2/1.3) — recordCostEvent + aggregation +
 * GET /api/admin/cost-dashboard*.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  applyTestEnv,
  startMongoHarness,
  stopMongoHarness,
  mintAccessToken,
  startHttpServer,
  stopHttpServer,
} from "../test_helpers/mongoTestHarness.js";

applyTestEnv();

let harness;
let http;
let User;
let CostEvent;
let createApp;
let recordCostEvent;
let getCostDashboard;
let getCacheMetrics;
let checkCostKindDailyThreshold;

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ CostEvent } = await import("../models/CostEvent.js"));
  ({ createApp } = await import("../app.js"));
  ({ recordCostEvent, getCostDashboard, getCacheMetrics, checkCostKindDailyThreshold } = await import(
    "../services/costLedgerService.js"
  ));
  http = await startHttpServer(createApp());
});

after(async () => {
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

function bearer(userId) {
  return {
    Authorization: `Bearer ${mintAccessToken(userId)}`,
    Accept: "application/json",
  };
}

async function createAdmin() {
  return User.create({
    name:  "Cost Admin",
    email: `cost-admin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.local`,
    role:  "admin",
    plan:  "free",
  });
}

/** Insert trực tiếp qua driver (bỏ qua Mongoose timestamps hook) để backdate createdAt. */
async function insertCostEventAt(daysAgo, fields) {
  const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  await CostEvent.collection.insertOne({
    kind:      fields.kind,
    tags:      fields.tags ?? [],
    userId:    fields.userId ?? null,
    model:     fields.model ?? null,
    costUsd:   fields.costUsd ?? 0,
    costVnd:   fields.costVnd ?? 0,
    fromCache: fields.fromCache ?? false,
    metadata:  fields.metadata ?? {},
    createdAt,
    updatedAt: createdAt,
  });
}

describe("costLedgerService — recordCostEvent + aggregation", () => {
  it("recordCostEvent() ghi đúng document vào MongoDB", async () => {
    await CostEvent.deleteMany({});
    await recordCostEvent({
      kind:      "llm_call",
      tags:      ["question_generation"],
      userId:    "user-1",
      model:     "claude-sonnet",
      costUsd:   0.01,
      costVnd:   254,
      fromCache: false,
      metadata:  { name: "question_gen" },
    });
    const docs = await CostEvent.find({}).lean();
    assert.equal(docs.length, 1);
    assert.equal(docs[0].kind, "llm_call");
    assert.equal(docs[0].costUsd, 0.01);
  });

  it("getCostDashboard() group theo ngày + kind, phát hiện spike >2x", async () => {
    await CostEvent.deleteMany({});
    await insertCostEventAt(1, { kind: "llm_call", costUsd: 1, costVnd: 25400 }); // hôm qua: $1
    await insertCostEventAt(0, { kind: "llm_call", costUsd: 2, costVnd: 50800 }); // hôm nay: $3 (>2x)
    await insertCostEventAt(0, { kind: "avatar_video_did", costUsd: 1, costVnd: 25400 });

    const result = await getCostDashboard({ days: 14 });
    assert.equal(result.ok, true);
    assert.ok(result.todayCostUsd >= 3 - 1e-9, `todayCostUsd=${result.todayCostUsd}`);
    assert.ok(result.yesterdayCostUsd >= 1 - 1e-9, `yesterdayCostUsd=${result.yesterdayCostUsd}`);
    assert.equal(result.spike, true);
  });

  it("getCacheMetrics() tính hit/miss + alert khi baseline render > 6/tháng", async () => {
    await CostEvent.deleteMany({});
    for (let i = 0; i < 5; i++) {
      await insertCostEventAt(0, { kind: "avatar_video_did", fromCache: true });
    }
    for (let i = 0; i < 2; i++) {
      await insertCostEventAt(0, {
        kind: "avatar_video_did", fromCache: false, metadata: { persistVideo: false },
      });
    }
    for (let i = 0; i < 7; i++) {
      await insertCostEventAt(0, {
        kind: "avatar_video_did", fromCache: false, metadata: { persistVideo: true },
      });
    }

    const result = await getCacheMetrics({ days: 30 });
    assert.equal(result.ok, true);
    assert.equal(result.cacheHits, 5);
    assert.equal(result.cacheMisses, 9);
    assert.equal(result.baselineRendersThisMonth, 7);
    assert.equal(result.baselineRenderAlert, true);
  });
});

describe("AI-12 — kind rubric_scoring / course_prescreen + ngưỡng Slack theo ngày", () => {
  const SLACK_URL = "https://hooks.slack.test/ai-12";
  let slackCalls;
  let realFetch;
  let prevWebhook;

  before(() => {
    realFetch = globalThis.fetch;
    prevWebhook = process.env.SLACK_ALERT_WEBHOOK_URL;
    process.env.SLACK_ALERT_WEBHOOK_URL = SLACK_URL;
    // Chỉ chặn request tới Slack; request HTTP khác của test đi qua fetch thật.
    globalThis.fetch = async (url, init) => {
      if (String(url) === SLACK_URL) {
        slackCalls.push(JSON.parse(init.body).text);
        return new Response("ok", { status: 200 });
      }
      return realFetch(url, init);
    };
  });

  after(() => {
    globalThis.fetch = realFetch;
    if (prevWebhook === undefined) delete process.env.SLACK_ALERT_WEBHOOK_URL;
    else process.env.SLACK_ALERT_WEBHOOK_URL = prevWebhook;
    delete process.env.COST_ALERT_COURSE_PRESCREEN_DAILY_COUNT;
  });

  it("lưu được CostEvent rubric_scoring và course_prescreen", async () => {
    await CostEvent.deleteMany({});
    slackCalls = [];
    await recordCostEvent({ kind: "rubric_scoring", costUsd: 0.004, metadata: { sessionId: "s-1" } });
    await recordCostEvent({ kind: "course_prescreen", costUsd: 0.002, metadata: { courseId: "c-1" } });

    const kinds = (await CostEvent.find({}).lean()).map((d) => d.kind).sort();
    assert.deepEqual(kinds, ["course_prescreen", "rubric_scoring"]);
    assert.equal(slackCalls.length, 0, "dưới ngưỡng thì không gửi Slack");
  });

  it("kind lạ bị bỏ qua, schema cũng chặn khi ghi thẳng", async () => {
    await CostEvent.deleteMany({});
    await recordCostEvent({ kind: "rubric_scoreing", costUsd: 1 });
    assert.equal(await CostEvent.countDocuments({}), 0);
    await assert.rejects(CostEvent.create({ kind: "rubric_scoreing" }), /ValidationError|is not a valid enum/);
  });

  it("vượt ngưỡng USD ngày thì gửi đúng 1 alert, lần ghi sau trong ngày không gửi lại", async () => {
    await CostEvent.deleteMany({});
    slackCalls = [];
    await insertCostEventAt(0, { kind: "rubric_scoring", costUsd: 1.99 });
    await insertCostEventAt(1, { kind: "rubric_scoring", costUsd: 50 }); // hôm qua, không tính

    await recordCostEvent({ kind: "rubric_scoring", costUsd: 0.02 }); // hôm nay $2.01 > $2
    await recordCostEvent({ kind: "rubric_scoring", costUsd: 0.02 });

    assert.equal(slackCalls.length, 1);
    assert.match(slackCalls[0], /rubric_scoring vượt ngưỡng/);
  });

  it("ngưỡng số lần đọc từ env; checkCostKindDailyThreshold trả trạng thái", async () => {
    await CostEvent.deleteMany({});
    process.env.COST_ALERT_COURSE_PRESCREEN_DAILY_COUNT = "2";
    for (let i = 0; i < 3; i++) await insertCostEventAt(0, { kind: "course_prescreen", costUsd: 0 });

    const status = await checkCostKindDailyThreshold("course_prescreen", { alert: false });
    assert.equal(status.count, 3);
    assert.equal(status.maxDailyCount, 2);
    assert.equal(status.exceeded, true);
    assert.equal(await checkCostKindDailyThreshold("llm_call"), null, "kind không có ngưỡng → null");
  });

  it("getCostDashboard() trả kindThresholds cho 2 kind mới mà không gửi Slack", async () => {
    await CostEvent.deleteMany({});
    slackCalls = [];
    process.env.COST_ALERT_COURSE_PRESCREEN_DAILY_COUNT = "2";
    for (let i = 0; i < 3; i++) await insertCostEventAt(0, { kind: "course_prescreen", costUsd: 0 });

    const result = await getCostDashboard({ days: 7 });
    const byKind = Object.fromEntries(result.kindThresholds.map((t) => [t.kind, t]));
    assert.deepEqual(Object.keys(byKind).sort(), ["course_prescreen", "rubric_scoring"]);
    assert.equal(byKind.course_prescreen.exceeded, true);
    assert.equal(byKind.rubric_scoring.exceeded, false);
    assert.equal(slackCalls.length, 0);
  });
});

describe("GET /api/admin/cost-dashboard*", () => {
  it("403 khi không phải admin", async () => {
    const customer = await User.create({
      name:  "Not Admin",
      email: `not-admin-${Date.now()}@test.local`,
      role:  "customer",
    });
    const res = await fetch(`${http.baseUrl}/api/admin/cost-dashboard`, {
      headers: bearer(customer._id),
    });
    assert.equal(res.status, 403);
  });

  it("200 + dữ liệu hợp lệ khi là admin", async () => {
    await CostEvent.deleteMany({});
    await insertCostEventAt(0, { kind: "llm_call", costUsd: 0.5, costVnd: 12700 });
    const admin = await createAdmin();

    const res = await fetch(`${http.baseUrl}/api/admin/cost-dashboard?days=7`, {
      headers: bearer(admin._id),
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.byDayAndKind));
  });

  it("cache-metrics endpoint trả cacheHits/cacheMisses", async () => {
    await CostEvent.deleteMany({});
    await insertCostEventAt(0, { kind: "avatar_video_did", fromCache: true });
    const admin = await createAdmin();

    const res = await fetch(`${http.baseUrl}/api/admin/cost-dashboard/cache-metrics`, {
      headers: bearer(admin._id),
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.cacheHits, 1);
  });
});

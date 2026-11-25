/**
 * AI-15 (+AI-16): lớp provider video avatar, provider ElevenLabs `POST /v1/flows/video`.
 * ElevenLabs (TTS + video) và ảnh avatar giả lập bằng mock `fetch`; không gọi mạng thật. D-ID đã gỡ (AI-17).
 *
 * Kiểm: chạy video ElevenLabs với ảnh + audio base64; đổi model không trả video model cũ từ cache;
 * `failed` ném lỗi + log; thiếu giọng ElevenLabs thì không tạo job; circuit breaker mở sau 3 lỗi;
 * `GET /api/ai/config` báo provider + model; CostEvent đúng kind và đơn giá;
 * mock QA-01 không gọi provider, không ghi CostEvent; provider giả lập qua `__setAvatarProviderForTest`.
 */
import { describe, it, before, after, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import {
  applyTestEnv,
  startMongoHarness,
  stopMongoHarness,
  startHttpServer,
  stopHttpServer,
} from "../test_helpers/mongoTestHarness.js";

applyTestEnv();

const ENV = {
  MOCK_AI_SERVICES: "",
  MOCK_AI: "",
  AVATAR_PROVIDER: "elevenlabs",
  ELEVENLABS_API_KEY: "test-eleven-key",
  ELEVENLABS_VOICE_ID_FEMALE: "voice_female_test",
  ELEVENLABS_VOICE_ID_MALE: "voice_male_test",
  ELEVENLABS_VIDEO_POLL_MS: "5",
  ELEVENLABS_VIDEO_TIMEOUT_MS: "2000",
  ELEVENLABS_VIDEO_MODEL: "",
  ELEVENLABS_VIDEO_RESOLUTION: "",
  ELEVENLABS_VOICE_ID: "",
  ELEVENLABS_VIDEO_CREDITS_PER_SECOND: "",
  ELEVENLABS_USD_PER_CREDIT: "",
  UPSTASH_REDIS_REST_URL: "",
  UPSTASH_REDIS_REST_TOKEN: "",
  CLOUDINARY_URL: "",
  CLOUDINARY_CLOUD_NAME: "",
  CLOUDINARY_API_KEY: "",
  CLOUDINARY_API_SECRET: "",
};

function setEnv(overrides = {}) {
  for (const [k, v] of Object.entries({ ...ENV, ...overrides })) process.env[k] = v;
}
setEnv();

// 32.000 byte mp3 128kbps ≈ 2 giây
const TTS_BYTES = 32_000;

let harness, http, avatar, providers, CostEvent, logger, fetchMock, warnMock;
let calls;
/** "ok" | "failed" | "create_401" */
let elevenMode;
let seq = 0;
let genSeq = 0;

const jsonRes = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

before(async () => {
  harness = await startMongoHarness();
  ({ logger } = await import("../config/logger.js"));
  avatar = await import("../services/avatarService.js");
  providers = await import("../services/avatarProviders/index.js");
  ({ CostEvent } = await import("../models/CostEvent.js"));

  const realFetch = globalThis.fetch;
  fetchMock = mock.method(globalThis, "fetch", async (url, init = {}) => {
    const u = String(url?.url ?? url);
    const method = init.method ?? "GET";
    if (u.startsWith("http://127.0.0.1")) return realFetch(url, init);
    calls.push({ method, url: u, body: init.body ? JSON.parse(init.body) : null });

    if (u.startsWith("https://api.elevenlabs.io/v1/text-to-speech/")) {
      return new Response(Buffer.alloc(TTS_BYTES, 1), { status: 200, headers: { "Content-Type": "audio/mpeg" } });
    }
    if (u === "https://api.elevenlabs.io/v1/flows/video" && method === "POST") {
      if (elevenMode === "create_401") return new Response("invalid key", { status: 401 });
      return jsonRes({ id: `gen_${++genSeq}`, status: "pending" });
    }
    if (u.startsWith("https://api.elevenlabs.io/v1/flows/video/")) {
      const id = u.split("/").pop();
      const polls = calls.filter((c) => c.url === u).length;
      if (polls === 1) return jsonRes({ id, status: "generating" });
      if (elevenMode === "failed") {
        return jsonRes({ id, status: "failed", failure_reason: "moderated", error_message: "blocked" });
      }
      return jsonRes({
        id,
        status: "completed",
        content_mime_type: "video/mp4",
        content_url: `https://storage.elevenlabs.test/${id}.mp4?sig=abc`,
      });
    }
    if (u.startsWith("https://res.cloudinary.com/") && /\.png$/.test(u)) {
      return new Response(Buffer.from("PNGDATA"), { status: 200, headers: { "Content-Type": "image/png" } });
    }
    throw new Error(`fetch không mong đợi trong test: ${method} ${u}`);
  });

  const { createApp } = await import("../app.js");
  http = await startHttpServer(createApp());
});

after(async () => {
  fetchMock?.mock?.restore();
  providers?.__setAvatarProviderForTest(null);
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

beforeEach(async () => {
  setEnv();
  calls = [];
  elevenMode = "ok";
  providers.__setAvatarProviderForTest(null);
  for (const p of Object.values(providers.AVATAR_PROVIDERS)) p.circuit.reset();
  warnMock?.mock?.restore();
  warnMock = mock.method(logger, "warn", () => {});
  await CostEvent.deleteMany({});
});

const newQuestion = () => `Câu hỏi AI-15 số ${++seq}: bạn xử lý xung đột trong nhóm thế nào?`;
const flowsCreates = () => calls.filter((c) => c.method === "POST" && c.url.endsWith("/v1/flows/video"));

async function waitForCostEvents(filter, expected) {
  for (let i = 0; i < 50; i++) {
    const rows = await CostEvent.find(filter).lean();
    if (rows.length >= expected) return rows;
    await new Promise((r) => setTimeout(r, 20));
  }
  return CostEvent.find(filter).lean();
}

describe("AI-15: provider ElevenLabs", () => {
  it("mặc định chạy ElevenLabs: gửi ảnh + audio base64 với creatify-aurora, trả content_url", async () => {
    const out = await avatar.generateVideoForQuestion(newQuestion(), { gender: "female" });

    assert.equal(out.provider, "elevenlabs");
    assert.equal(out.fromCache, false);
    assert.match(out.videoUrl, /^https:\/\/storage\.elevenlabs\.test\/gen_\d+\.mp4/);

    const [create] = flowsCreates();
    assert.ok(create, "có gọi POST /v1/flows/video");
    assert.equal(create.body.model_id, "creatify-aurora");
    assert.equal(create.body.resolution, "720p");
    assert.equal(create.body.audio.type, "inline_base64");
    assert.equal(create.body.audio.mime_type, "audio/mpeg");
    assert.equal(Buffer.from(create.body.audio.content_base64, "base64").length, TTS_BYTES);
    assert.equal(create.body.image.type, "inline_base64");
    assert.equal(create.body.image.mime_type, "image/png");
    assert.equal(Buffer.from(create.body.image.content_base64, "base64").toString(), "PNGDATA");

    const tts = calls.find((c) => c.url.includes("/text-to-speech/"));
    assert.match(tts.url, /voice_female_test/);
  });

  it("đổi model qua ELEVENLABS_VIDEO_MODEL và ELEVENLABS_VIDEO_RESOLUTION", async () => {
    setEnv({ ELEVENLABS_VIDEO_MODEL: "veed-fabric", ELEVENLABS_VIDEO_RESOLUTION: "480p" });
    assert.equal(avatar.getAvatarModel(), "veed-fabric");
    await avatar.generateVideoForQuestion(newQuestion(), { gender: "male" });
    const [create] = flowsCreates();
    assert.equal(create.body.model_id, "veed-fabric");
    assert.equal(create.body.resolution, "480p");
  });

  it("đổi model không trả video model cũ từ cache; đổi lại model cũ vẫn trúng cache", async () => {
    const q = newQuestion();
    const aurora = await avatar.generateVideoForQuestion(q, { gender: "female" });

    setEnv({ ELEVENLABS_VIDEO_MODEL: "veed-fabric" });
    calls = [];
    const fabric = await avatar.generateVideoForQuestion(q, { gender: "female" });
    assert.equal(fabric.fromCache, false);
    assert.notEqual(fabric.videoUrl, aurora.videoUrl);
    assert.equal(flowsCreates().length, 1);

    calls = [];
    const again = await avatar.generateVideoForQuestion(q, { gender: "female" });
    assert.equal(again.fromCache, true);
    assert.equal(flowsCreates().length, 0, "trúng cache thì không gọi ElevenLabs");

    setEnv();
    const backToAurora = await avatar.generateVideoForQuestion(q, { gender: "female" });
    assert.equal(backToAurora.fromCache, true);
    assert.equal(backToAurora.videoUrl, aurora.videoUrl);
  });

  it("cache key có provider và model", () => {
    const base = { questionText: "Câu?", avatarImageUrl: "img", voiceTag: "vi", elevenLabsVoiceId: "v" };
    const aurora = avatar.buildCacheKey({ ...base, provider: "elevenlabs", model: "creatify-aurora" });
    const fabric = avatar.buildCacheKey({ ...base, provider: "elevenlabs", model: "veed-fabric" });
    assert.match(aurora, /^avatar:elevenlabs:creatify-aurora:/);
    assert.notEqual(aurora, fabric);
  });

  it("generation failed: ném lỗi có failure_reason, 1 dòng timing warn với provider/model", async () => {
    elevenMode = "failed";
    await assert.rejects(avatar.generateVideoForQuestion(newQuestion()), /failed \(moderated\)/);
    const lines = warnMock.mock.calls.filter((c) => c.arguments[0] === "avatar_video_timing").map((c) => c.arguments[1]);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].ok, false);
    assert.equal(lines[0].provider, "elevenlabs");
    assert.equal(lines[0].model, "creatify-aurora");
    assert.equal(lines[0].failedStep, "videoRenderMs");
  });

  it("thiếu giọng ElevenLabs: không tạo job video", async () => {
    setEnv({ ELEVENLABS_VOICE_ID_FEMALE: "", ELEVENLABS_VOICE_ID_MALE: "", ELEVENLABS_VOICE_ID: "" });
    await assert.rejects(avatar.generateVideoForQuestion(newQuestion()), /cần audio ElevenLabs/);
    assert.equal(flowsCreates().length, 0);
  });

  it("thiếu ELEVENLABS_API_KEY: isAvatarVideoEnabled=false, báo đúng biến thiếu", async () => {
    setEnv({ ELEVENLABS_API_KEY: "" });
    assert.equal(avatar.isAvatarVideoEnabled(), false);
    await assert.rejects(avatar.generateVideoForQuestion(newQuestion()), /ELEVENLABS_API_KEY/);
    assert.equal(calls.length, 0);
  });

  it("circuit breaker: ElevenLabs lỗi 3 lần thì mở, không gọi thêm", async () => {
    elevenMode = "create_401";
    for (let i = 0; i < 3; i++) {
      const [r] = await avatar.pregenerateVideos([newQuestion()]);
      assert.equal(r.videoUrl, null);
    }
    assert.equal(avatar.isCircuitOpen(), true);
    calls = [];
    await assert.rejects(avatar.generateVideoForQuestion(newQuestion()), /elevenlabs circuit open/);
    assert.equal(calls.length, 0, "circuit mở thì không gọi ElevenLabs");
  });

  it("GET /api/ai/config báo provider, model và videoEnabled", async () => {
    let body = await (await fetch(`${http.baseUrl}/api/ai/config`)).json();
    assert.equal(body.providers.avatar.provider, "elevenlabs");
    assert.equal(body.providers.avatar.model, "creatify-aurora");
    assert.equal(body.providers.avatar.videoEnabled, true);
    assert.equal(body.providers.avatar.did, undefined, "field cũ `did` đã gỡ ở AI-17");

    setEnv({ ELEVENLABS_API_KEY: "" });
    body = await (await fetch(`${http.baseUrl}/api/ai/config`)).json();
    assert.equal(body.providers.avatar.videoEnabled, false, "thiếu key ElevenLabs thì tắt video");

    setEnv({ ELEVENLABS_API_KEY: "test-eleven-key", AVATAR_PROVIDER: "did" });
    body = await (await fetch(`${http.baseUrl}/api/ai/config`)).json();
    assert.equal(body.providers.avatar.provider, "elevenlabs", "giá trị cũ AVATAR_PROVIDER=did rơi về elevenlabs");
  });
});

describe("AI-16: chi phí video ElevenLabs", () => {
  it("CostEvent kind avatar_video_elevenlabs, credit = ceil(giây × credit/giây), USD theo đơn giá credit", async () => {
    setEnv({ ELEVENLABS_VIDEO_CREDITS_PER_SECOND: "100", ELEVENLABS_USD_PER_CREDIT: "0.0002" });
    await avatar.generateVideoForQuestion(newQuestion(), { traceId: "trace-ai16-a" });

    const [row] = await waitForCostEvents({ kind: "avatar_video_elevenlabs" }, 1);
    assert.ok(row, "có CostEvent video ElevenLabs");
    assert.equal(row.fromCache, false);
    assert.equal(row.metadata.provider, "elevenlabs");
    assert.equal(row.metadata.model, "creatify-aurora");
    assert.equal(row.metadata.videoSeconds, 2);
    assert.equal(row.metadata.credits, 200);
    assert.ok(Math.abs(row.costUsd - 0.04) < 1e-9, `costUsd=${row.costUsd}`);
    assert.equal(await CostEvent.countDocuments({ kind: "avatar_video_did" }), 0);
  });

  it("chưa cấu hình credit/giây: ghi 0 USD kèm priceUnconfigured, không đoán giá", async () => {
    await avatar.generateVideoForQuestion(newQuestion(), { traceId: "trace-ai16-b" });
    const [row] = await waitForCostEvents({ kind: "avatar_video_elevenlabs" }, 1);
    assert.equal(row.costUsd, 0);
    assert.equal(row.metadata.priceUnconfigured, true);
  });

  it("trúng cache: CostEvent fromCache=true, 0 USD", async () => {
    setEnv({ ELEVENLABS_VIDEO_CREDITS_PER_SECOND: "100" });
    const q = newQuestion();
    await avatar.generateVideoForQuestion(q, { traceId: "trace-ai16-c" });
    await avatar.generateVideoForQuestion(q, { traceId: "trace-ai16-c" });
    const rows = await waitForCostEvents({ kind: "avatar_video_elevenlabs" }, 2);
    const cached = rows.find((r) => r.fromCache);
    assert.ok(cached);
    assert.equal(cached.costUsd, 0);
  });

  it("mock QA-01 với provider ElevenLabs: không gọi provider, không ghi CostEvent", async () => {
    setEnv({ MOCK_AI_SERVICES: "true", ELEVENLABS_VIDEO_CREDITS_PER_SECOND: "100" });
    const out = await avatar.generateVideoForQuestion(newQuestion(), { traceId: "trace-ai16-d" });
    assert.equal(out.provider, "elevenlabs");
    assert.match(out.talkId, /mock_talk_elevenlabs/);
    assert.equal(calls.length, 0);
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(await CostEvent.countDocuments({}), 0);
  });
});

describe("AI-15: provider giả lập qua lớp provider", () => {
  it("avatarService chỉ dùng hợp đồng provider (createJob, waitForResult, rawUrlTtlSec, circuit)", async () => {
    const { createCircuitBreaker } = await import("../services/avatarProviders/circuitBreaker.js");
    const seen = [];
    const fake = {
      name: "fake",
      model: () => "fake-v1",
      isEnabled: () => true,
      missingConfigMessage: "fake chưa cấu hình",
      rawUrlTtlSec: 60,
      costKind: "avatar_video_elevenlabs",
      circuit: createCircuitBreaker("fake"),
      async createJob(p) {
        seen.push(p);
        return "job_fake";
      },
      async waitForResult(id) {
        return `https://fake.video/${id}.mp4`;
      },
    };
    providers.__setAvatarProviderForTest(fake);

    const q = newQuestion();
    const out = await avatar.generateVideoForQuestion(q, { gender: "male" });
    assert.equal(out.videoUrl, "https://fake.video/job_fake.mp4");
    assert.equal(out.provider, "fake");
    assert.equal(seen.length, 1);
    assert.equal(seen[0].audio.buffer.length, TTS_BYTES);
    assert.equal(seen[0].audio.url, undefined, "audio gửi thẳng dạng buffer, không upload Cloudinary");
    assert.match(seen[0].imageUrl, /AI-male/);
    assert.equal(avatar.getAvatarProvider(), "fake");

    const again = await avatar.generateVideoForQuestion(q, { gender: "male" });
    assert.equal(again.fromCache, true);
    assert.equal(seen.length, 1);
  });
});

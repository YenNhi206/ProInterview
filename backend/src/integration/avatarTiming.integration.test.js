/**
 * N-11 (NFR-02): mỗi video avatar ghi đúng 1 dòng log `avatar_video_timing` có `durationMs` và thời gian từng bước
 * (cache, TTS, tạo job video, render, mirror, ghi cache), kể cả khi lỗi (`failedStep`), kèm provider + model (AI-15).
 * D-ID được giả lập bằng mock `fetch`; ElevenLabs và Cloudinary không cấu hình (D-ID tự dùng Azure TTS).
 */
import { describe, it, before, after, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { applyTestEnv, startMongoHarness, stopMongoHarness } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
process.env.MOCK_AI_SERVICES = "";
process.env.MOCK_AI = "";
process.env.D_ID_API_KEY = "test:didkey";
process.env.ELEVENLABS_API_KEY = "";
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";

let harness, avatar, logger, fetchMock, infoMock, warnMock;
/** "ok" | "create_fails" */
let didMode = "ok";
let seq = 0;

const timingLines = () => [
  ...infoMock.mock.calls.filter((c) => c.arguments[0] === "avatar_video_timing").map((c) => ({ level: "info", ...c.arguments[1] })),
  ...warnMock.mock.calls.filter((c) => c.arguments[0] === "avatar_video_timing").map((c) => ({ level: "warn", ...c.arguments[1] })),
];

before(async () => {
  harness = await startMongoHarness();
  ({ logger } = await import("../config/logger.js"));
  avatar = await import("../services/avatarService.js");
  const realFetch = globalThis.fetch;
  fetchMock = mock.method(globalThis, "fetch", async (url, init) => {
    const u = String(url);
    if (!u.startsWith("https://api.d-id.com")) return realFetch(url, init);
    if (u.endsWith("/talks") && init?.method === "POST") {
      if (didMode === "create_fails") return new Response("quota", { status: 500 });
      return new Response(JSON.stringify({ id: "tlk_test" }), { status: 201, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ status: "done", result_url: "https://d-id.example/video.mp4" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
});

after(async () => {
  fetchMock?.mock?.restore();
  if (harness) await stopMongoHarness(harness);
});

beforeEach(() => {
  infoMock?.mock?.restore();
  warnMock?.mock?.restore();
  infoMock = mock.method(logger, "info", () => {});
  warnMock = mock.method(logger, "warn", () => {});
  didMode = "ok";
});

describe("Log thời gian video avatar (N-11)", () => {
  it("render mới: 1 dòng ok, có durationMs và từng bước; lần sau lấy cache: 1 dòng fromCache", async () => {
    seq += 1;
    const question = `Câu hỏi đo thời gian số ${seq}`;
    const out = await avatar.generateVideoForQuestion(question, { gender: "female" });
    assert.equal(out.fromCache, false);

    let lines = timingLines();
    assert.equal(lines.length, 1);
    const line = lines[0];
    assert.equal(line.level, "info");
    assert.equal(line.ok, true);
    assert.equal(line.fromCache, false);
    assert.equal(line.talkId, "tlk_test");
    assert.equal(line.ttsProvider, "did_azure");
    assert.equal(line.mirrored, false);
    assert.equal(line.provider, "did");
    assert.equal(line.model, "express");
    for (const k of ["cacheLookupMs", "ttsMs", "videoCreateMs", "videoRenderMs", "cacheWriteMs", "durationMs"]) {
      assert.equal(typeof line[k], "number", k);
      assert.ok(line[k] >= 0, k);
    }
    assert.equal(line.mirrorMs, undefined, "không persistVideo thì không có bước mirror");
    assert.ok(line.videoRenderMs >= 1_500, "poll D-ID chờ ít nhất 1 nhịp (2 giây)");
    assert.ok(line.durationMs >= line.videoRenderMs);

    infoMock.mock.resetCalls();
    const cached = await avatar.generateVideoForQuestion(question, { gender: "female" });
    assert.equal(cached.fromCache, true);
    lines = timingLines();
    assert.equal(lines.length, 1);
    assert.equal(lines[0].fromCache, true);
    assert.equal(lines[0].ok, true);
    assert.equal(typeof lines[0].durationMs, "number");
    assert.equal(lines[0].ttsMs, undefined);
  });

  it("D-ID lỗi khi tạo talk: 1 dòng warn ok=false, failedStep = videoCreateMs, lỗi vẫn ném ra", async () => {
    didMode = "create_fails";
    seq += 1;
    await assert.rejects(avatar.generateVideoForQuestion(`Câu lỗi ${seq}`, { gender: "male" }), /D-ID create talk failed/);
    const lines = timingLines();
    assert.equal(lines.length, 1);
    assert.equal(lines[0].level, "warn");
    assert.equal(lines[0].ok, false);
    assert.equal(lines[0].failedStep, "videoCreateMs");
    assert.match(lines[0].error, /500/);
    assert.equal(typeof lines[0].videoCreateMs, "number");
    assert.equal(lines[0].videoRenderMs, undefined);
  });
});

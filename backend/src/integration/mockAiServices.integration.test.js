import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { CostEvent } from "../models/CostEvent.js";
import { recordCostEvent } from "../services/costLedgerService.js";
import { generateVideoForQuestion } from "../services/avatarService.js";
import { synthesizeSpeech } from "../services/ttsService.js";

describe("QA-01: Chế độ mock LLM, D-ID, ElevenLabs bằng biến môi trường", () => {
  let mongod;
  const originalEnv = process.env.MOCK_AI_SERVICES;

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });

  after(async () => {
    process.env.MOCK_AI_SERVICES = originalEnv;
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    await CostEvent.deleteMany({});
  });

  it("Khi bật MOCK_AI_SERVICES=true, recordCostEvent không lưu bất kỳ document nào vào DB", async () => {
    process.env.MOCK_AI_SERVICES = "true";

    const res = await recordCostEvent({
      kind: "llm_call",
      model: "mock-model",
      costUsd: 0.05,
      costVnd: 1250,
      metadata: { test: true },
    });

    assert.equal(res, null);

    const count = await CostEvent.countDocuments({});
    assert.equal(count, 0, "Không được phát sinh CostEvent khi bật cờ mock");
  });

  it("Khi bật MOCK_AI_SERVICES=true, generateVideoForQuestion trả về video mock mà không gọi D-ID", async () => {
    process.env.MOCK_AI_SERVICES = "true";

    const result = await generateVideoForQuestion("Câu hỏi test tải?");
    assert.ok(result);
    assert.ok(result.videoUrl.includes("mock_avatar_demo.mp4"));
    assert.equal(result.fromCache, true);

    const count = await CostEvent.countDocuments({});
    assert.equal(count, 0, "D-ID mock không tạo CostEvent");
  });

  it("Khi bật MOCK_AI_SERVICES=true, synthesizeSpeech trả về audio buffer mock", async () => {
    process.env.MOCK_AI_SERVICES = "true";

    const result = await synthesizeSpeech("Xin chào, tôi là AI interviewer");
    assert.ok(result);
    assert.ok(Buffer.isBuffer(result.buffer));
    assert.equal(result.contentType, "audio/mpeg");

    const count = await CostEvent.countDocuments({});
    assert.equal(count, 0, "ElevenLabs mock không tạo CostEvent");
  });

  it("Khi tắt MOCK_AI_SERVICES, recordCostEvent hoạt động bình thường", async () => {
    process.env.MOCK_AI_SERVICES = "false";

    await recordCostEvent({
      kind: "llm_call",
      model: "gemini-1.5-flash",
      costUsd: 0.002,
      costVnd: 50,
      metadata: { live: true },
    });

    const count = await CostEvent.countDocuments({});
    assert.equal(count, 1, "CostEvent được ghi khi tắt cờ mock");
  });
});

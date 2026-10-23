/**
 * Integration: PATCH /api/interviews/sessions/:id (updateAnswer) chỉ $set field nó quản lý,
 * không xoá field của luồng khác (moderatorOverride, evaluationIncomplete, behavioralData.emotion),
 * và trả 409 khi session đã kết thúc.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  applyTestEnv,
  startMongoHarness,
  stopMongoHarness,
  mintAccessToken,
  startHttpServer,
  stopHttpServer,
} from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";

let harness;
let http;
let User;
let InterviewSession;

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ InterviewSession } = await import("../models/InterviewSession.js"));
  const { createApp } = await import("../app.js");
  http = await startHttpServer(createApp());
});

after(async () => {
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

let seq = 0;
async function setup(status = "in_progress") {
  seq++;
  const user = await User.create({ name: "Answer", email: `answer-${seq}-${Date.now()}@test.local` });
  const session = await InterviewSession.create({
    userId: user._id,
    hrGender: "male",
    status,
    questions: [{ id: "b1", question: "Câu 1" }, { id: "b2", question: "Câu 2" }],
    answers: [{
      questionIndex: 0,
      transcript: "bản cũ",
      evaluationIncomplete: true,
      incompleteFields: ["credibility"],
      moderatorOverride: {
        scores: { clarity: 4, structure: 4, relevance: 4, credibility: 3 },
        overall: 3.75,
        shrmLevel: "proficient",
        by: new mongoose.Types.ObjectId(),
        at: new Date(),
      },
      behavioralData: { emotion: { joy: 4, sorrow: 1, anger: 1, surprise: 2 }, eyeContactScore: 0.5 },
    }],
  });
  return { user, session };
}

function patch(user, sessionId, body) {
  return fetch(`${http.baseUrl}/api/interviews/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${mintAccessToken(user._id)}` },
    body: JSON.stringify(body),
  });
}

describe("updateAnswer", () => {
  it("cập nhật transcript/durationSeconds/behavioralData nhưng giữ moderatorOverride, evaluationIncomplete, emotion", async () => {
    const { user, session } = await setup();
    const res = await patch(user, session._id, {
      questionIndex: 0,
      transcript: "bản mới",
      durationSeconds: 42,
      behavioralData: { eyeContactScore: 0.9, silenceRatio: 0.1 },
    });
    assert.equal(res.status, 200);

    const a = (await InterviewSession.findById(session._id).lean()).answers;
    assert.equal(a.length, 1);
    assert.equal(a[0].transcript, "bản mới");
    assert.equal(a[0].durationSeconds, 42);
    assert.equal(a[0].behavioralData.eyeContactScore, 0.9);
    assert.equal(a[0].behavioralData.silenceRatio, 0.1);
    assert.equal(a[0].behavioralData.emotion.joy, 4, "emotion từ analyzeFace phải còn");
    assert.equal(a[0].evaluationIncomplete, true);
    assert.deepEqual(a[0].incompleteFields, ["credibility"]);
    assert.equal(a[0].moderatorOverride.overall, 3.75);
  });

  it("câu chưa có answer → push mới, không đụng answer khác", async () => {
    const { user, session } = await setup();
    assert.equal((await patch(user, session._id, { questionIndex: 1, transcript: "câu 2" })).status, 200);
    const a = (await InterviewSession.findById(session._id).lean()).answers;
    assert.equal(a.length, 2);
    assert.equal(a.find((x) => x.questionIndex === 1).transcript, "câu 2");
    assert.equal(a.find((x) => x.questionIndex === 0).moderatorOverride.overall, 3.75);
  });

  it("session đã completed → 409, không ghi gì", async () => {
    const { user, session } = await setup("completed");
    const res = await patch(user, session._id, { questionIndex: 0, transcript: "ghi đè" });
    assert.equal(res.status, 409);
    const a = (await InterviewSession.findById(session._id).lean()).answers;
    assert.equal(a[0].transcript, "bản cũ");
  });

  it("session của người khác → 404", async () => {
    const { session } = await setup();
    const stranger = await User.create({ name: "Lạ", email: `stranger-${Date.now()}@test.local` });
    assert.equal((await patch(stranger, session._id, { questionIndex: 0, transcript: "x" })).status, 404);
  });
});

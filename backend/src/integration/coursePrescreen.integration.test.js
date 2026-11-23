/**
 * Integration AI-08: AI sàng lọc khóa học khi mentor gửi duyệt.
 * "Xong khi": mỗi khóa gửi duyệt có kết quả và cờ cụ thể.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer,
} from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";
process.env.LLM_API_KEY = "test-key";
process.env.LLM_BASE_URL = "http://llm.stub.local/v1";
process.env.LLM_MODEL = "gpt-4o-mini";
delete process.env.LLM_PRESCREEN_MODEL;
delete process.env.ANTHROPIC_API_KEY;
delete process.env.LLM_PROVIDER;
delete process.env.MOCK_AI_SERVICES;
delete process.env.MOCK_AI;

let harness, http, User, Mentor, Course, ModerationItem, CostEvent, svc;
const realFetch = globalThis.fetch;
let llmQueue = [];
let llmCalls = [];

const LONG_DESC = "Khóa học hướng dẫn chuẩn bị phỏng vấn backend: thiết kế hệ thống, cơ sở dữ liệu, trả lời câu hỏi hành vi theo STAR và đàm phán lương.";

before(async () => {
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith("http://llm.stub.local")) {
      const body = JSON.parse(init.body);
      llmCalls.push(body);
      const next = llmQueue.shift();
      if (next instanceof Error) return new Response("boom", { status: 400 });
      const content = typeof next === "string" ? next : JSON.stringify(next ?? { score: 90, summary: "Ổn", flags: [] });
      return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 1000, completion_tokens: 200 } }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    return realFetch(url, init);
  };
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ Mentor } = await import("../models/Mentor.js"));
  ({ Course } = await import("../models/Course.js"));
  ({ ModerationItem } = await import("../models/ModerationItem.js"));
  ({ CostEvent } = await import("../models/CostEvent.js"));
  svc = await import("../services/coursePrescreenService.js");
  await ModerationItem.init();
  http = await startHttpServer((await import("../app.js")).createApp());
});

after(async () => {
  globalThis.fetch = realFetch;
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

beforeEach(() => {
  llmQueue = [];
  llmCalls = [];
});

let seq = 0;
async function mentorWithCourse(overrides = {}) {
  seq += 1;
  const user = await User.create({ name: `Mentor AI08 ${seq}`, email: `ai08-mentor-${seq}@test.local`, role: "mentor" });
  let mentor = await Mentor.findOne({ userId: user._id });
  if (!mentor) mentor = await Mentor.create({ userId: user._id, publicId: `ai08-${seq}`, name: user.name, title: "Engineer", pricePerHour: 200000 });
  await Mentor.updateOne({ _id: mentor._id }, { $set: { isVerified: true, isActive: true } });
  const course = await Course.create({
    mentorId: mentor._id,
    title: "Phỏng vấn backend",
    description: LONG_DESC,
    level: "basic",
    price: 299000,
    thumbnail: "/uploads/thumb.png",
    whatYoullLearn: ["Trả lời câu hỏi thiết kế hệ thống"],
    modules: [{
      title: "Chương 1",
      order: 1,
      lessons: [
        { title: "Bài 1", type: "video", videoUrl: "/uploads/v1.mp4", description: "Giới thiệu", order: 1 },
        { title: "Bài 2", type: "video", videoUrl: "/uploads/v2.mp4", description: "STAR", order: 2 },
        { title: "Bài 3", type: "document", documentUrl: "/uploads/d.pdf", description: "Bài tập", order: 3 },
      ],
    }],
    ...overrides,
  });
  return { user, mentor, course };
}

function api(user, method, path, body) {
  return fetch(`${http.baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${mintAccessToken(user._id)}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function publishAndWait(user, course) {
  const res = await api(user, "PATCH", `/api/courses/${course._id}/publish`);
  assert.equal(res.status, 200);
  await svc.waitForPendingPrescreens();
  return Course.findById(course._id).lean();
}

describe("AI-08: sàng lọc khi mentor gửi duyệt", () => {
  it("khóa đầy đủ: done, điểm AI, không cờ; ghi CostEvent course_prescreen và ModerationItem", async () => {
    const { user, course } = await mentorWithCourse();
    llmQueue.push({ score: 88, summary: "Nội dung đúng chủ đề.", flags: [] });
    const saved = await publishAndWait(user, course);

    assert.equal(saved.status, "pending_review");
    const p = saved.aiPrescreen;
    assert.equal(p.status, "done");
    assert.equal(p.score, 88);
    assert.deepEqual(p.flags, []);
    assert.equal(p.target, "course");
    assert.equal(p.model, "gpt-4o-mini");
    assert.equal(p.promptVersion, "prescreen-v1");
    assert.equal(llmCalls.length, 1);
    assert.equal(llmCalls[0].temperature, 0);

    // CostEvent ghi nền (fire-and-forget) — chờ ngắn.
    let cost = null;
    for (let i = 0; i < 20 && !cost; i += 1) {
      cost = await CostEvent.findOne({ kind: "course_prescreen" }).lean();
      if (!cost) await new Promise((r) => setTimeout(r, 25));
    }
    assert.ok(cost, "có CostEvent course_prescreen");

    const item = await ModerationItem.findOne({ type: "course_prescreen", "refs.courseId": course._id }).lean();
    assert.equal(item.status, "open");
    assert.equal(item.priority, "normal");
    assert.equal(item.snapshot.aiPrescreen.score, 88);
  });

  it("thiếu video, mô tả ngắn, có Zalo + cờ AI: cờ cụ thể từ luật và AI, item priority high", async () => {
    const { user, course } = await mentorWithCourse({
      description: "Ngắn. Liên hệ zalo 0912345678 để được giảm giá.",
      whatYoullLearn: [],
      modules: [{ title: "C1", order: 1, lessons: [{ title: "Bài video trống", type: "video", order: 1 }] }],
    });
    llmQueue.push({
      score: 40,
      summary: "Có cam kết việc làm.",
      flags: [
        { code: "misleading_claim", severity: "critical", message: "Cam kết 100% có việc", evidence: "đảm bảo có việc" },
        { code: "made_up_code", severity: "critical", message: "mã lạ bị bỏ" },
      ],
    });
    const saved = await publishAndWait(user, course);
    const codes = saved.aiPrescreen.flags.map((f) => f.code).sort();
    assert.deepEqual(codes, [
      "external_contact", "lesson_missing_description", "misleading_claim", "missing_learning_outcomes", "missing_video",
      "short_description", "too_few_lessons",
    ].sort());
    const ext = saved.aiPrescreen.flags.find((f) => f.code === "external_contact");
    assert.equal(ext.source, "rule");
    assert.match(ext.evidence, /0912345678|zalo/i);
    assert.equal(saved.aiPrescreen.flags.find((f) => f.code === "misleading_claim").source, "ai");
    assert.ok(saved.aiPrescreen.score <= 40);

    const item = await ModerationItem.findOne({ type: "course_prescreen", "refs.courseId": course._id }).lean();
    assert.equal(item.priority, "high");
  });

  it("LLM lỗi: status failed, vẫn có cờ luật và điểm theo luật", async () => {
    const { user, course } = await mentorWithCourse({ thumbnail: "" });
    llmQueue.push(new Error("400"), new Error("400"));
    const saved = await publishAndWait(user, course);
    assert.equal(saved.aiPrescreen.status, "failed");
    assert.ok(saved.aiPrescreen.error);
    assert.deepEqual(saved.aiPrescreen.flags.map((f) => f.code), ["missing_thumbnail"]);
    assert.equal(saved.aiPrescreen.score, 100);
  });

  it("gửi lại nội dung y hệt không gọi LLM lần nữa; bản cập nhật của khóa đang bán được sàng lọc riêng", async () => {
    const { user, course } = await mentorWithCourse();
    await publishAndWait(user, course);
    assert.equal(llmCalls.length, 1);
    const again = await svc.prescreenCourse(course._id);
    assert.equal(again.status, "done");
    assert.equal(llmCalls.length, 1, "contentHash trùng → không gọi LLM");

    await Course.updateOne({ _id: course._id }, { $set: { status: "published" } });
    const res = await api(user, "PUT", `/api/courses/${course._id}`, {
      title: "Phỏng vấn backend (bản mới)",
      description: LONG_DESC,
      level: "basic",
      price: 299000,
      chapters: [{ title: "Chương 1", lessons: [{ title: "Bài 1", type: "video" }] }],
    });
    assert.equal(res.status, 200);
    await svc.waitForPendingPrescreens();
    const saved = await Course.findById(course._id).lean();
    assert.equal(saved.status, "pending_update");
    assert.equal(saved.aiPrescreen.target, "pending_update");
    assert.equal(llmCalls.length, 2);
    assert.ok(saved.aiPrescreen.flags.some((f) => f.code === "too_few_lessons"));
  });

  it("moderator thấy aiPrescreen trong danh sách chờ duyệt; duyệt / từ chối đóng item; item không vào hàng đợi HITL", async () => {
    const moderator = await User.create({ name: "Mod AI08", email: `ai08-mod-${Date.now()}@test.local`, role: "moderator" });
    const a = await mentorWithCourse();
    const b = await mentorWithCourse();
    await publishAndWait(a.user, a.course);
    await publishAndWait(b.user, b.course);

    const list = await (await api(moderator, "GET", "/api/moderator/courses/pending")).json();
    const row = (list.courses ?? list.items ?? []).find((c) => String(c._id) === String(a.course._id));
    assert.ok(row, JSON.stringify(list).slice(0, 300));
    assert.equal(row.aiPrescreen.status, "done");
    assert.equal(row.aiPrescreen.contentHash, undefined);

    const queue = await (await api(moderator, "GET", "/api/moderator/queue")).json();
    assert.ok(queue.items.every((i) => i.type !== "course_prescreen"));
    const item = await ModerationItem.findOne({ type: "course_prescreen", "refs.courseId": a.course._id }).lean();
    assert.equal((await api(moderator, "GET", `/api/moderator/queue/${item._id}`)).status, 404);

    assert.equal((await api(moderator, "PATCH", `/api/moderator/courses/${a.course._id}/approve`)).status, 200);
    assert.equal((await api(moderator, "PATCH", `/api/moderator/courses/${b.course._id}/reject`, { reason: "Thiếu nội dung" })).status, 200);
    const closed = await ModerationItem.find({ type: "course_prescreen", "refs.courseId": { $in: [a.course._id, b.course._id] } }).lean();
    assert.equal(closed.length, 2);
    for (const i of closed) assert.equal(i.status, "resolved");
    assert.deepEqual(closed.map((i) => i.resolution.note.split(":")[0]).sort(), ["approve", "reject"]);
  });
});

describe("AI-08: luật và điểm (unit)", () => {
  it("combineScore lấy min(điểm AI, 100 − phạt luật)", () => {
    const flags = [{ source: "rule", severity: "critical" }, { source: "rule", severity: "warning" }, { source: "ai", severity: "critical" }];
    assert.equal(svc.combineScore(90, flags), 60);
    assert.equal(svc.combineScore(50, flags), 50);
    assert.equal(svc.combineScore(null, flags), 60);
    assert.equal(svc.combineScore(150, []), 100);
  });

  it("không bắt nhầm giá tiền / năm thành số điện thoại", () => {
    const flags = svc.ruleFlags({
      title: "Khóa 2026", description: `${LONG_DESC} Giá gốc 1500000 đồng, cập nhật năm 2026.`,
      whatYoullLearn: ["x"], thumbnail: "t", price: 1, modules: [{ lessons: [1, 2, 3].map((i) => ({ title: `B${i}`, type: "video", videoUrl: "v", description: "d" })) }],
    });
    assert.deepEqual(flags, []);
  });
});

/**
 * AI-09: POST /api/courses/prescreen-preview — mentor xem trước cờ sàng lọc theo luật (ruleFlags của AI-08)
 * trên nội dung đang soạn, trước khi gửi duyệt. Không gọi LLM, không ghi DB.
 */
import { before, after, it } from "node:test";
import assert from "node:assert/strict";
import { applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";

let harness, http, mentorUser, customer, Course;
const realFetch = globalThis.fetch;
let llmCalls = 0;

async function preview(user, body) {
  const res = await realFetch(`${http.baseUrl}/api/courses/prescreen-preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${mintAccessToken(user._id)}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, ...(await res.json()) };
}

before(async () => {
  globalThis.fetch = async (url, init) => {
    if (!String(url).startsWith("http://127.0.0.1") && !String(url).startsWith("http://localhost")) llmCalls += 1;
    return realFetch(url, init);
  };
  harness = await startMongoHarness();
  const { User } = await import("../models/User.js");
  const { Mentor } = await import("../models/Mentor.js");
  ({ Course } = await import("../models/Course.js"));
  mentorUser = await User.create({ name: "Mentor AI09", email: "ai09-mentor@test.local", role: "mentor" });
  await Mentor.findOneAndUpdate({ userId: mentorUser._id }, { $set: { userId: mentorUser._id, name: "Mentor AI09", publicId: "ai09-mentor", isActive: true, isVerified: true } }, { upsert: true });
  customer = await User.create({ name: "Customer AI09", email: "ai09-customer@test.local", role: "customer" });
  http = await startHttpServer((await import("../app.js")).createApp());
});

after(async () => {
  globalThis.fetch = realFetch;
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

it("khóa đang soạn còn thiếu: trả đúng cờ theo luật, không gọi AI, không tạo khóa", async () => {
  const before = await Course.countDocuments();
  const res = await preview(mentorUser, {
    title: "Phỏng vấn backend",
    description: "Ngắn quá. Liên hệ zalo 0901234567 để học thêm.",
    price: 200000,
    outcomes: [],
    chapters: [{ title: "Chương 1", lessons: [{ title: "Bài 1", videoUrl: "" }, { title: "Bài 2", videoUrl: "/uploads/a.mp4" }] }],
  });
  assert.equal(res.status, 200, res.error);
  const codes = res.flags.map((f) => f.code);
  for (const code of ["short_description", "missing_learning_outcomes", "missing_thumbnail", "too_few_lessons", "missing_video", "external_contact"]) {
    assert.ok(codes.includes(code), `thiếu cờ ${code}: ${codes.join(",")}`);
  }
  assert.equal(res.flags.find((f) => f.code === "missing_video").severity, "critical");
  assert.equal(res.flags.every((f) => f.source === "rule"), true);
  assert.equal(res.rules.minLessons, 3);
  assert.equal(llmCalls, 0);
  assert.equal(await Course.countDocuments(), before);
});

it("khóa đủ nội dung: không còn cờ cảnh báo", async () => {
  const lesson = (i) => ({ title: `Bài ${i}`, videoUrl: `/uploads/v${i}.mp4` });
  const res = await preview(mentorUser, {
    title: "Phỏng vấn backend",
    description: "Khóa học hướng dẫn chuẩn bị phỏng vấn backend: thiết kế hệ thống, cơ sở dữ liệu, trả lời câu hỏi hành vi theo STAR và đàm phán lương.",
    price: 200000,
    thumbnail: "/uploads/cover.jpg",
    outcomes: ["Trả lời câu hỏi thiết kế hệ thống"],
    chapters: [{ title: "Chương 1", lessons: [lesson(1), lesson(2), lesson(3)] }],
  });
  assert.equal(res.status, 200, res.error);
  assert.deepEqual(res.flags.filter((f) => f.severity !== "info").map((f) => f.code), []);
});

it("không phải mentor thì bị chặn", async () => {
  const res = await preview(customer, { title: "x" });
  assert.equal(res.status, 403);
});

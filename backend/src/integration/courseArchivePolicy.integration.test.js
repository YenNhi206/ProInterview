/**
 * Integration: mentor chỉ gỡ (lưu trữ) được khóa học khi đạt mọi điều kiện ở courseArchivePolicy —
 * không có giao dịch đang chờ, không đang chờ admin duyệt. Còn học viên thì chỉ "ngừng bán".
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
let Mentor;
let Course;
let Enrollment;
let Cart;
let createApp;

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ Mentor } = await import("../models/Mentor.js"));
  ({ Course } = await import("../models/Course.js"));
  ({ Enrollment } = await import("../models/Enrollment.js"));
  ({ Cart } = await import("../models/Cart.js"));
  ({ createApp } = await import("../app.js"));
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
    "Content-Type": "application/json",
  };
}

let seq = 0;
async function setup(status = "published") {
  seq += 1;
  const suffix = `${Date.now()}-${seq}`;
  const mentorUser = await User.create({
    name: "Mentor Archive Test",
    email: `mentor-archive-${suffix}@test.local`,
    role: "mentor",
  });
  let mentor = await Mentor.findOne({ userId: mentorUser._id });
  if (!mentor) {
    mentor = await Mentor.create({
      userId: mentorUser._id,
      publicId: `m-archive-${suffix}`,
      name: "Mentor Archive Test",
      title: "Senior Engineer",
      company: "ProInterview",
      pricePerHour: 250000,
      isVerified: true,
      isActive: true,
      available: true,
    });
  }
  const course = await Course.create({
    mentorId: mentor._id,
    title: `Khóa học lưu trữ ${suffix}`,
    description: "Mô tả",
    level: "basic",
    topics: ["Technical"],
    price: 300000,
    status,
    modules: [{ title: "Chương 1", order: 1, lessons: [{ title: "Bài 1", type: "video", order: 1 }] }],
  });
  const learner = await User.create({
    name: "Learner Archive Test",
    email: `learner-archive-${suffix}@test.local`,
    role: "customer",
  });
  return { mentorUser, course, learner };
}

async function eligibility(mentorUser, course) {
  const res = await fetch(`${http.baseUrl}/api/courses/${course._id}/archive-eligibility`, {
    headers: bearer(mentorUser._id),
  });
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body));
  return body.eligibility;
}

function archive(userId, course) {
  return fetch(`${http.baseUrl}/api/courses/${course._id}`, { method: "DELETE", headers: bearer(userId) });
}

describe("Điều kiện mentor xóa khóa học", () => {
  it("Khóa không có học viên / giao dịch: xóa được và gỡ khỏi giỏ hàng", async () => {
    const { mentorUser, course, learner } = await setup();
    await Cart.create({ userId: learner._id, courseIds: [course._id] });

    const e = await eligibility(mentorUser, course);
    assert.equal(e.canArchive, true);
    assert.equal(e.mode, "delete");

    const res = await archive(mentorUser._id, course);
    assert.equal(res.status, 200);
    assert.equal((await Course.findById(course._id).lean()).status, "archived");
    assert.equal((await Cart.findOne({ userId: learner._id }).lean()).courseIds.length, 0);
  });

  it("Còn học viên: chỉ ngừng bán — học viên cũ giữ quyền học, người mới không ghi danh được", async () => {
    const { mentorUser, course, learner } = await setup();
    await Enrollment.create({ userId: learner._id, courseId: course._id, paymentStatus: "paid" });

    const e = await eligibility(mentorUser, course);
    assert.equal(e.canArchive, true);
    assert.equal(e.mode, "stop_selling");
    assert.equal(e.learners, 1);

    const res = await archive(mentorUser._id, course);
    const body = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal(body.mode, "stop_selling");
    assert.equal((await Course.findById(course._id).lean()).status, "archived");
    assert.equal((await Enrollment.findOne({ userId: learner._id, courseId: course._id }).lean()).paymentStatus, "paid");

    const newcomer = await User.create({
      name: "Newcomer Archive Test",
      email: `newcomer-archive-${Date.now()}@test.local`,
      role: "customer",
    });
    const enrollRes = await fetch(`${http.baseUrl}/api/courses/${course._id}/enroll`, {
      method: "POST",
      headers: bearer(newcomer._id),
      body: "{}",
    });
    assert.equal(enrollRes.status, 409);
    assert.equal(await Enrollment.countDocuments({ userId: newcomer._id }), 0);
  });

  it("Có giao dịch chuyển khoản chưa hết hạn: chặn xóa; hết hạn thì cho xóa", async () => {
    const { mentorUser, course, learner } = await setup();
    const enr = await Enrollment.create({
      userId: learner._id,
      courseId: course._id,
      paymentStatus: "pending",
      paymentExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    assert.equal((await archive(mentorUser._id, course)).status, 409);

    await Enrollment.updateOne({ _id: enr._id }, { $set: { paymentExpiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await archive(mentorUser._id, course)).status, 200);
  });

  it("Đang chờ admin duyệt: chặn xóa", async () => {
    const { mentorUser, course } = await setup("pending_review");
    const e = await eligibility(mentorUser, course);
    assert.equal(e.canArchive, false);
    assert.equal(e.checks.find((c) => c.key === "not_in_review").ok, false);
    assert.equal((await archive(mentorUser._id, course)).status, 409);
  });

  it("Mentor khác không xem được điều kiện và không xóa được", async () => {
    const { course } = await setup();
    const { mentorUser: other } = await setup();
    const res = await fetch(`${http.baseUrl}/api/courses/${course._id}/archive-eligibility`, {
      headers: bearer(other._id),
    });
    assert.equal(res.status, 403);
    assert.equal((await archive(other._id, course)).status, 403);
  });
});

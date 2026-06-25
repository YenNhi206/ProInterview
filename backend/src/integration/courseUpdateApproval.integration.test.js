/**
 * Integration: PUT /api/courses/:id không được ghi đè trực tiếp khóa học đang published —
 * phải qua pendingUpdate + admin duyệt (xem AdminController.approveCourse).
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
let createApp;

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ Mentor } = await import("../models/Mentor.js"));
  ({ Course } = await import("../models/Course.js"));
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

async function createVerifiedMentor(suffix) {
  const mentorUser = await User.create({
    name: "Mentor Course Update Test",
    email: `mentor-course-update-${suffix}@test.local`,
    role: "mentor",
  });
  let mentor = await Mentor.findOne({ userId: mentorUser._id });
  if (!mentor) {
    mentor = await Mentor.create({
      userId: mentorUser._id,
      publicId: `m-course-update-${suffix}`,
      name: "Mentor Course Update Test",
      title: "Senior Engineer",
      company: "ProInterview",
      pricePerHour: 250000,
      isVerified: true,
      isActive: true,
      available: true,
    });
  } else {
    await Mentor.updateOne({ _id: mentor._id }, { $set: { isVerified: true, isActive: true, available: true } });
    mentor = await Mentor.findById(mentor._id);
  }
  return { mentorUser, mentor };
}

async function createPublishedCourse(mentorId) {
  return Course.create({
    mentorId,
    title: "Khóa học gốc đã duyệt",
    description: "Mô tả gốc",
    level: "basic",
    topics: ["Technical"],
    price: 499000,
    status: "published",
    publishedAt: new Date(),
    modules: [{ title: "Chương 1", order: 1, lessons: [{ title: "Bài 1", type: "video", order: 1 }] }],
  });
}

describe("Mentor sửa khóa học đã published phải qua admin duyệt", () => {
  it("PUT /api/courses/:id không ghi đè trực tiếp — chuyển sang pending_update", async () => {
    const { mentorUser, mentor } = await createVerifiedMentor(`pending-${Date.now()}`);
    const course = await createPublishedCourse(mentor._id);

    const res = await fetch(`${http.baseUrl}/api/courses/${course._id}`, {
      method: "PUT",
      headers: bearer(mentorUser._id),
      body: JSON.stringify({
        title: "Tiêu đề bị đổi không qua duyệt",
        price: 1,
        level: "basic",
        chapters: [{ title: "Chương 1", lessons: [{ title: "Bài 1" }] }],
      }),
    });
    const body = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal(body.success, true);
    assert.equal(body.course.status, "pending_update");

    const stored = await Course.findById(course._id).lean();
    // Nội dung public KHÔNG đổi — vẫn là bản đã duyệt trước đó.
    assert.equal(stored.title, "Khóa học gốc đã duyệt");
    assert.equal(stored.price, 499000);
    assert.equal(stored.status, "pending_update");
    assert.equal(stored.pendingUpdate.title, "Tiêu đề bị đổi không qua duyệt");
    assert.equal(stored.pendingUpdate.price, 1);
  });

  it("Admin approve thì áp pendingUpdate vào khóa học live", async () => {
    const { mentorUser, mentor } = await createVerifiedMentor(`approve-${Date.now()}`);
    const admin = await User.create({
      name: "Admin Course Update",
      email: `admin-course-update-${Date.now()}@test.local`,
      role: "admin",
    });
    const course = await createPublishedCourse(mentor._id);

    await fetch(`${http.baseUrl}/api/courses/${course._id}`, {
      method: "PUT",
      headers: bearer(mentorUser._id),
      body: JSON.stringify({
        title: "Tiêu đề mới chờ duyệt",
        price: 599000,
        level: "basic",
        chapters: [{ title: "Chương 1", lessons: [{ title: "Bài 1" }] }],
      }),
    });

    const approveRes = await fetch(`${http.baseUrl}/api/admin/courses/${course._id}/approve`, {
      method: "PATCH",
      headers: bearer(admin._id),
    });
    assert.equal(approveRes.status, 200);

    const stored = await Course.findById(course._id).lean();
    assert.equal(stored.status, "published");
    assert.equal(stored.title, "Tiêu đề mới chờ duyệt");
    assert.equal(stored.price, 599000);
    assert.equal(stored.pendingUpdate, null);
  });

  it("Khóa học còn draft vẫn sửa trực tiếp được (chưa public, không cần duyệt)", async () => {
    const { mentorUser, mentor } = await createVerifiedMentor(`draft-${Date.now()}`);
    const course = await Course.create({
      mentorId: mentor._id,
      title: "Draft gốc",
      level: "basic",
      topics: ["Technical"],
      price: 0,
      status: "draft",
    });

    const res = await fetch(`${http.baseUrl}/api/courses/${course._id}`, {
      method: "PUT",
      headers: bearer(mentorUser._id),
      body: JSON.stringify({
        title: "Draft đã sửa",
        level: "basic",
        chapters: [],
      }),
    });
    const body = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal(body.course.title, "Draft đã sửa");

    const stored = await Course.findById(course._id).lean();
    assert.equal(stored.status, "draft");
    assert.equal(stored.title, "Draft đã sửa");
  });
});

describe("Chặn hotlink ảnh/video ngoài khi tạo/sửa khóa học", () => {
  it("POST /api/courses từ chối khi thumbnail là link ngoài", async () => {
    const { mentorUser } = await createVerifiedMentor(`hotlink-create-${Date.now()}`);

    const res = await fetch(`${http.baseUrl}/api/courses`, {
      method: "POST",
      headers: bearer(mentorUser._id),
      body: JSON.stringify({
        title: "Khóa học test hotlink",
        level: "basic",
        thumbnail: "https://evil.example.com/fake-thumbnail.png",
        chapters: [],
      }),
    });
    const body = await res.json();
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.match(body.error, /không hợp lệ/);
  });

  it("POST /api/courses từ chối khi videoUrl bài học là link ngoài", async () => {
    const { mentorUser } = await createVerifiedMentor(`hotlink-video-${Date.now()}`);

    const res = await fetch(`${http.baseUrl}/api/courses`, {
      method: "POST",
      headers: bearer(mentorUser._id),
      body: JSON.stringify({
        title: "Khóa học test hotlink video",
        level: "basic",
        chapters: [
          { title: "Chương 1", lessons: [{ title: "Bài 1", videoUrl: "https://youtube.com/watch?v=abc" }] },
        ],
      }),
    });
    const body = await res.json();
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.match(body.error, /không hợp lệ/);
  });

  it("POST /api/courses chấp nhận thumbnail/video từ /uploads/ hoặc Cloudinary", async () => {
    const { mentorUser } = await createVerifiedMentor(`hotlink-ok-${Date.now()}`);

    const res = await fetch(`${http.baseUrl}/api/courses`, {
      method: "POST",
      headers: bearer(mentorUser._id),
      body: JSON.stringify({
        title: "Khóa học hợp lệ",
        level: "basic",
        thumbnail: "/uploads/thumb-123.png",
        chapters: [
          {
            title: "Chương 1",
            lessons: [
              { title: "Bài 1", videoUrl: "https://res.cloudinary.com/demo/video/upload/v1/abc.mp4" },
            ],
          },
        ],
      }),
    });
    const body = await res.json();
    assert.equal(res.status, 201, JSON.stringify(body));
    assert.equal(body.success, true);
  });
});

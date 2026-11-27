/**
 * M-01: giá mentor chỉ đổi khi admin duyệt.
 * Lỗi phát hiện khi test thủ công trên production 27/11/2026 (kịch bản QA bước 1.18):
 *  1. Lưu /profile gửi `pricePerHour` lên PATCH /api/mentors/me → ghi thẳng giá, bỏ qua admin.
 *  2. Mỗi lần mentor đăng nhập (User.save) → `syncMentorProfileFromUser` ghi đè giá bằng
 *     `User.hourlyRate` (thường trống → 350.000).
 *  3. Mentor đã duyệt nộp lại hồ sơ (POST /api/mentors/apply) → ghi đè giá.
 *  4. Admin duyệt giá chỉ đổi `pricePerHour`, không đổi `sessionTypes[].price` mà booking dùng.
 */
import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";

const PASSWORD = "MatKhau@123";
const APPROVED_PRICE = 300000;
let harness, http, models, admin, mentorUser, mentorId;

async function call(user, url, method = "GET", body) {
  const res = await fetch(`${http.baseUrl}${url}`, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${mintAccessToken(user._id)}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, ...(await res.json()) };
}
const mentorDoc = () => models.Mentor.findById(mentorId).lean();
const mockPrice = (m) => m.sessionTypes.find((s) => s.type === "mock_interview")?.price;

before(async () => {
  harness = await startMongoHarness();
  models = await import("../models/index.js");
  await Promise.all(Object.values(models).filter((m) => m?.modelName).map((m) => m.init()));
  admin = await models.User.create({ name: "Admin giá", email: "price-admin@test.local", role: "admin" });
  mentorUser = await models.User.create({
    name: "Mentor giá", email: "price-mentor@test.local", role: "mentor",
    passwordHash: await bcrypt.hash(PASSWORD, 4), isEmailVerified: true,
  });
  const doc = await models.Mentor.findOneAndUpdate(
    { userId: mentorUser._id },
    {
      $set: {
        userId: mentorUser._id, name: "Mentor giá", title: "Senior Frontend", publicId: "price-mentor",
        isActive: true, isVerified: true, available: true, status: "active",
        adminReview: { status: "approved", reason: "", reviewedAt: new Date(), reviewedBy: admin._id },
        pricePerHour: APPROVED_PRICE,
        sessionTypes: [{ type: "mock_interview", durationMinutes: 60, price: APPROVED_PRICE }],
      },
    },
    { upsert: true, returnDocument: "after" },
  );
  mentorId = doc._id;
  http = await startHttpServer((await import("../app.js")).createApp());
});

after(async () => {
  if (http) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

describe("Giá mentor chỉ đổi qua admin duyệt (M-01)", () => {
  it("PATCH /api/mentors/me với pricePerHour không đổi giá; đổi thời lượng thì giá tính lại từ giá đang có hiệu lực", async () => {
    const res = await call(mentorUser, "/api/mentors/me", "PATCH", {
      bio: "Giới thiệu mới",
      pricePerHour: 223333,
      sessionTypes: [{ type: "mock_interview", durationMinutes: 30, price: 1000 }],
    });
    assert.equal(res.status, 200, JSON.stringify(res));
    const m = await mentorDoc();
    assert.equal(m.bio, "Giới thiệu mới", "các trường khác vẫn lưu được");
    assert.equal(m.pricePerHour, APPROVED_PRICE);
    assert.equal(mockPrice(m), APPROVED_PRICE / 2, "buổi 30 phút = nửa giá/giờ đã duyệt, không lấy giá client gửi");
    await models.Mentor.updateOne({ _id: mentorId }, { $set: { sessionTypes: [{ type: "mock_interview", durationMinutes: 60, price: APPROVED_PRICE }] } });
  });

  it("đăng nhập không reset giá về 350.000", async () => {
    const res = await call(null, "/api/auth/login", "POST", { email: "price-mentor@test.local", password: PASSWORD });
    assert.equal(res.status, 200, JSON.stringify(res));
    const m = await mentorDoc();
    assert.equal(m.pricePerHour, APPROVED_PRICE);
    assert.equal(mockPrice(m), APPROVED_PRICE);
  });

  it("mentor đã duyệt nộp lại hồ sơ không đổi giá", async () => {
    const res = await call(mentorUser, "/api/mentors/apply", "POST", {
      title: "Senior Frontend", company: "Hải Âu", bio: "Giới thiệu nộp lại",
      tags: ["React"], workExperience: "Senior Frontend tại Hải Âu", targetRate: 900000,
    });
    assert.equal(res.status, 200, JSON.stringify(res));
    const m = await mentorDoc();
    assert.equal(m.adminReview.status, "approved", "vẫn giữ trạng thái đã duyệt");
    assert.equal(m.pricePerHour, APPROVED_PRICE);
    assert.equal(mockPrice(m), APPROVED_PRICE);
  });

  it("yêu cầu đổi giá chưa duyệt thì giá cũ vẫn áp dụng; admin duyệt thì đổi cả giá/giờ lẫn giá từng loại buổi", async () => {
    const req = await call(mentorUser, "/api/mentor/request-price-change", "POST", { newPrice: 350000 });
    assert.equal(req.status, 200, JSON.stringify(req));
    let m = await mentorDoc();
    assert.equal(m.pricePerHour, APPROVED_PRICE);
    assert.equal(m.pendingPricePerHour, 350000);

    const me = await call(mentorUser, "/api/mentors/me");
    assert.equal(me.mentor.pendingPricePerHour, 350000, "trang /profile đọc được giá đang chờ duyệt");

    const ok = await call(admin, `/api/admin/mentors/${mentorId}/approve-price`, "POST");
    assert.equal(ok.status, 200, JSON.stringify(ok));
    m = await mentorDoc();
    assert.equal(m.pricePerHour, 350000);
    assert.equal(mockPrice(m), 350000, "booking tính theo sessionTypes nên phải đổi theo");
    assert.equal(m.pendingPricePerHour ?? null, null);
  });

  it("hồ sơ chưa duyệt nộp lại thì giá mong muốn mới áp cho cả giá từng loại buổi", async () => {
    await models.Mentor.updateOne({ _id: mentorId }, { $set: { "adminReview.status": "rejected" } });
    const res = await call(mentorUser, "/api/mentors/apply", "POST", {
      title: "Senior Frontend", company: "Hải Âu", bio: "Bổ sung giới thiệu",
      tags: ["React"], workExperience: "Senior Frontend tại Hải Âu", targetRate: 450000,
    });
    assert.equal(res.status, 200, JSON.stringify(res));
    const m = await mentorDoc();
    assert.equal(m.pricePerHour, 450000);
    assert.equal(mockPrice(m), 450000);
  });
});

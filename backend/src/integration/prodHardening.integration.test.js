/**
 * Integration: hardening production (S0) — /api/mock, cổng thanh toán mock, booking trả phí
 * khi thiếu JaaS, limit body của analyze-face.
 *
 * Các case "production" bật NODE_ENV=production tạm thời quanh lời gọi rồi trả lại "test",
 * vì applyTestEnv() đặt NODE_ENV=test cho cả file.
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
let User;
let Mentor;
let Payment;
let createApp;
let initiatePayment;
let handleWebhookMomo;
let createBooking;

async function asProduction(fn) {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    return await fn();
  } finally {
    process.env.NODE_ENV = prev;
  }
}

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ Mentor } = await import("../models/Mentor.js"));
  ({ Payment } = await import("../models/Payment.js"));
  ({ createApp } = await import("../app.js"));
  ({ initiatePayment, handleWebhookMomo } = await import("../services/paymentsService.js"));
  ({ createBooking } = await import("../services/bookingsService.js"));
});

after(async () => {
  if (harness) await stopMongoHarness(harness);
});

describe("S0.3 — /api/mock chỉ mount ngoài production", () => {
  it("prod app không có /api/mock (404), dev app vẫn có", async () => {
    const prodHttp = await asProduction(() => startHttpServer(createApp()));
    const devHttp = await startHttpServer(createApp());
    try {
      const prodRes = await fetch(`${prodHttp.baseUrl}/api/mock/courses`);
      assert.equal(prodRes.status, 404);
      const devRes = await fetch(`${devHttp.baseUrl}/api/mock/courses`);
      assert.equal(devRes.status, 200);
    } finally {
      await stopHttpServer(prodHttp.server);
      await stopHttpServer(devHttp.server);
    }
  });
});

describe("S0.4 — production không kích hoạt quyền qua thanh toán mock", () => {
  it("initiate MoMo/ZaloPay/card ở prod → 400, không tạo Payment", async () => {
    // .env local có thể có key VNPay sandbox — test case "chưa cấu hình".
    delete process.env.VNP_TMN_CODE;
    delete process.env.VNP_HASH_SECRET;
    const user = await User.create({ name: "Pay prod", email: `pay-prod-${Date.now()}@test.local` });
    for (const provider of ["momo", "zalopay", "card", "vnpay"]) {
      const res = await asProduction(() =>
        initiatePayment(String(user._id), { type: "subscription", provider, planKey: "elite_pro" }),
      );
      assert.equal(res.ok, false, provider);
      assert.equal(res.status, 400, provider);
      assert.equal(res.error, "Phương thức thanh toán chưa hỗ trợ.");
    }
    assert.equal(await Payment.countDocuments({ userId: user._id }), 0);
  });

  it("Payment mock tạo ở dev không thể được webhook MoMo kích hoạt ở prod, plan giữ free", async () => {
    process.env.PAYMENT_WEBHOOK_SECRET = "s0-test-secret";
    const user = await User.create({ name: "Pay mock", email: `pay-mock-${Date.now()}@test.local` });
    const init = await initiatePayment(String(user._id), { type: "subscription", provider: "momo", planKey: "elite_pro" });
    assert.equal(init.ok, true);
    assert.equal(init.mock, true);

    const hook = await asProduction(() => handleWebhookMomo({ paymentId: init.paymentId }, "s0-test-secret"));
    assert.equal(hook.ok, false);
    assert.equal(hook.status, 400);

    const after = await User.findById(user._id).lean();
    assert.equal(after.plan, "free");
    const pay = await Payment.findById(init.paymentId).lean();
    assert.equal(pay.status, "pending");
    delete process.env.PAYMENT_WEBHOOK_SECRET;
  });
});

describe("S0.7 — booking trả phí bị chặn khi thiếu JAAS_* ở production", () => {
  it("createBooking → 503, không tạo booking", async () => {
    for (const k of ["JAAS_APP_ID", "JAAS_API_KEY_ID", "JAAS_PRIVATE_KEY", "JAAS_PRIVATE_KEY_PATH", "JAAS_PRIVATE_KEY_BASE64"]) {
      delete process.env[k];
    }
    const suffix = Date.now();
    const mentorUser = await User.create({ name: "Mentor JaaS", email: `jaas-m-${suffix}@test.local`, role: "mentor" });
    let mentor = await Mentor.findOne({ userId: mentorUser._id });
    if (!mentor) {
      mentor = await Mentor.create({
        userId: mentorUser._id, publicId: `m-jaas-${suffix}`, name: "Mentor JaaS",
        pricePerHour: 250000, isVerified: true, isActive: true, available: true,
      });
    } else {
      await Mentor.updateOne({ _id: mentor._id }, { $set: { isVerified: true, isActive: true, available: true, pricePerHour: 250000 } });
    }
    const customer = await User.create({ name: "Customer JaaS", email: `jaas-c-${suffix}@test.local` });

    const d = new Date();
    d.setDate(d.getDate() + 14);
    const date = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

    const res = await asProduction(() =>
      createBooking(String(customer._id), {
        mentorId: String(mentor._id), date, timeSlot: "10:00", sessionType: "mock_interview", paymentMethod: "transfer",
      }),
    );
    assert.equal(res.ok, false);
    assert.equal(res.status, 503);
    const { Booking } = await import("../models/Booking.js");
    assert.equal(await Booking.countDocuments({ userId: customer._id }), 0);
  });
});

describe("S0.8 — analyze-face nhận body > 1mb", () => {
  it("ảnh ~1.2MB không còn 413 ở tầng body parser", async () => {
    const http = await startHttpServer(createApp());
    try {
      const user = await User.create({ name: "Face", email: `face-${Date.now()}@test.local` });
      const imageBase64 = "A".repeat(1_200_000);
      const res = await fetch(`${http.baseUrl}/api/interviews/sessions/000000000000000000000000/analyze-face`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${mintAccessToken(user._id)}` },
        body: JSON.stringify({ imageBase64, questionIndex: 0 }),
      });
      assert.notEqual(res.status, 413);
    } finally {
      await stopHttpServer(http.server);
    }
  });
});

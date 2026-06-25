/**
 * Integration: chuyển khoản (subscription, booking mentor, ghi danh khóa học).
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
let Payment;
let Mentor;
let Booking;
let Course;
let Enrollment;
let createApp;

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ Payment } = await import("../models/Payment.js"));
  ({ Mentor } = await import("../models/Mentor.js"));
  ({ Booking } = await import("../models/Booking.js"));
  ({ Course } = await import("../models/Course.js"));
  ({ Enrollment } = await import("../models/Enrollment.js"));
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

async function createCustomer() {
  return User.create({
    name: "CK Customer",
    email: `ck-cust-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.local`,
    role: "customer",
    plan: "free",
  });
}

async function createAdmin() {
  return User.create({
    name: "CK Admin",
    email: `ck-admin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.local`,
    role: "admin",
    plan: "free",
  });
}

function futureBookingDate(daysAhead = 14) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function uniqueTimeSlot() {
  const h = 8 + (Date.now() % 10);
  const m = Date.now() % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function bookingIdFromCreateBody(body) {
  const b = body?.booking;
  return String(b?._id || b?.id || "");
}

async function createVerifiedMentor() {
  const mentorUser = await User.create({
    name: "Mentor CK Test",
    email: `ck-mentor-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.local`,
    role: "mentor",
  });
  const { ensureMentorProfilesForAllMentorUsers } = await import(
    "../services/mentorProfileService.js"
  );
  await ensureMentorProfilesForAllMentorUsers();
  let mentor = await Mentor.findOne({ userId: mentorUser._id });
  if (!mentor) {
    mentor = await Mentor.create({
      userId: mentorUser._id,
      publicId: `m-${mentorUser._id}`,
      name: "Mentor CK Test",
      title: "Senior Engineer",
      company: "ProInterview",
      pricePerHour: 250000,
      isVerified: true,
      isActive: true,
      available: true,
    });
  } else {
    await Mentor.updateOne(
      { _id: mentor._id },
      {
        $set: {
          isVerified: true,
          isActive: true,
          available: true,
          pricePerHour: 250000,
        },
      },
    );
    mentor = await Mentor.findById(mentor._id);
  }
  return { mentorUser, mentor };
}

async function createPublishedCourse(mentorId, price = 499000) {
  return Course.create({
    mentorId,
    title: "Khóa CK test",
    description: "Integration test course",
    level: "basic",
    topics: ["Technical"],
    price,
    status: "published",
    publishedAt: new Date(),
  });
}

describe("Subscription bank transfer (CK)", () => {
  it("pending → submit-transfer → admin confirm kích hoạt plan", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const orderNum = `PI-TEST-${Date.now()}`;

    const pendingRes = await fetch(`${http.baseUrl}/api/payments/subscription/transfer-pending`, {
      method: "POST",
      headers: bearer(customer._id),
      body: JSON.stringify({
        planKey: "starter_pro",
        billing: "monthly",
        orderNum,
      }),
    });
    assert.equal(pendingRes.status, 201);
    const pendingBody = await pendingRes.json();
    assert.equal(pendingBody.success, true);
    assert.equal(pendingBody.amount, 99000);
    assert.ok(pendingBody.paymentId);

    const paymentId = pendingBody.paymentId;
    const pendingRow = await Payment.findById(paymentId).lean();
    assert.equal(pendingRow.status, "pending");
    assert.equal(pendingRow.type, "subscription");
    assert.equal(pendingRow.provider, "transfer");
    assert.equal(pendingRow.amount, 99000);

    const submitRes = await fetch(
      `${http.baseUrl}/api/payments/subscription/${paymentId}/submit-transfer`,
      {
        method: "PATCH",
        headers: bearer(customer._id),
        body: JSON.stringify({ reference: orderNum }),
      },
    );
    assert.equal(submitRes.status, 200);
    const submitBody = await submitRes.json();
    assert.equal(submitBody.success, true);

    const afterSubmit = await Payment.findById(paymentId).lean();
    assert.ok(afterSubmit.providerResponse?.submittedAt);

    const confirmRes = await fetch(
      `${http.baseUrl}/api/admin/payments/${paymentId}/confirm-subscription-transfer`,
      {
        method: "PATCH",
        headers: bearer(admin._id),
        body: JSON.stringify({}),
      },
    );
    assert.equal(confirmRes.status, 200);
    const confirmBody = await confirmRes.json();
    assert.equal(confirmBody.success, true);

    const paidRow = await Payment.findById(paymentId).lean();
    assert.equal(paidRow.status, "success");
    assert.ok(paidRow.paidAt);

    const refreshedUser = await User.findById(customer._id);
    assert.equal(refreshedUser.plan, "starter_pro");
    assert.ok(refreshedUser.planExpiresAt);
  });

  it("admin confirm trước submit → 400 (trừ khi force)", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const orderNum = `PI-EARLY-${Date.now()}`;

    const pendingRes = await fetch(`${http.baseUrl}/api/payments/subscription/transfer-pending`, {
      method: "POST",
      headers: bearer(customer._id),
      body: JSON.stringify({ planKey: "starter_pro", billing: "monthly", orderNum }),
    });
    const { paymentId } = await pendingRes.json();

    const earlyConfirm = await fetch(
      `${http.baseUrl}/api/admin/payments/${paymentId}/confirm-subscription-transfer`,
      { method: "PATCH", headers: bearer(admin._id), body: JSON.stringify({}) },
    );
    assert.equal(earlyConfirm.status, 400);

    const forceConfirm = await fetch(
      `${http.baseUrl}/api/admin/payments/${paymentId}/confirm-subscription-transfer`,
      {
        method: "PATCH",
        headers: bearer(admin._id),
        body: JSON.stringify({ force: true, forceNote: "test override admin" }),
      },
    );
    assert.equal(forceConfirm.status, 200);
  });

  it("401 khi không có JWT", async () => {
    const res = await fetch(`${http.baseUrl}/api/payments/subscription/transfer-pending`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planKey: "starter_pro", billing: "monthly", orderNum: "X" }),
    });
    assert.equal(res.status, 401);
  });

  it("400 khi amount client không khớp bảng giá", async () => {
    const customer = await createCustomer();
    const res = await fetch(`${http.baseUrl}/api/payments/subscription/transfer-pending`, {
      method: "POST",
      headers: bearer(customer._id),
      body: JSON.stringify({
        amount: 1000,
        planKey: "starter_pro",
        billing: "monthly",
        orderNum: `PI-TAMPER-${Date.now()}`,
      }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /bảng giá/i);
  });
});

describe("Booking bank transfer (CK)", () => {
  it("POST booking → submit-transfer → admin confirm", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const { mentor } = await createVerifiedMentor();
    const orderNum = `PI-BK-${Date.now()}`;
    const date = futureBookingDate();

    const createRes = await fetch(`${http.baseUrl}/api/bookings`, {
      method: "POST",
      headers: bearer(customer._id),
      body: JSON.stringify({
        mentorId: String(mentor._id),
        date,
        timeSlot: "10:00",
        sessionType: "mock_interview",
        paymentMethod: "transfer",
        orderNum,
      }),
    });
    const createText = await createRes.text();
    assert.equal(createRes.status, 201, createText);
    const createBody = JSON.parse(createText);
    assert.equal(createBody.success, true);
    const bookingId = String(createBody.booking?._id || createBody.booking?.id);
    assert.ok(bookingId);

    const ledger = await Payment.findOne({
      type: "booking",
      referenceId: bookingId,
      provider: "transfer",
    }).lean();
    assert.ok(ledger);
    assert.equal(ledger.status, "pending");

    const submitRes = await fetch(`${http.baseUrl}/api/bookings/${bookingId}/submit-transfer`, {
      method: "PATCH",
      headers: bearer(customer._id),
      body: JSON.stringify({ reference: orderNum }),
    });
    assert.equal(submitRes.status, 200);

    const confirmRes = await fetch(
      `${http.baseUrl}/api/admin/bookings/${bookingId}/confirm-transfer-payment`,
      { method: "PATCH", headers: bearer(admin._id), body: JSON.stringify({}) },
    );
    assert.equal(confirmRes.status, 200);

    const stored = await Booking.findById(bookingId).lean();
    assert.equal(stored.paymentStatus, "paid");
    assert.equal(stored.status, "confirmed");

    const paidLedger = await Payment.findById(ledger._id).lean();
    assert.equal(paidLedger.status, "success");
    assert.ok(paidLedger.paidAt);
  });
});

describe("Course enrollment bank transfer (CK)", () => {
  it("POST enroll → submit-transfer → admin confirm", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const { mentor } = await createVerifiedMentor();
    const course = await createPublishedCourse(mentor._id, 599000);
    const orderNum = `PI-CRS-${Date.now()}`;

    const enrollRes = await fetch(`${http.baseUrl}/api/courses/${course._id}/enroll`, {
      method: "POST",
      headers: bearer(customer._id),
      body: JSON.stringify({ paymentMethod: "transfer", orderNum }),
    });
    const enrollText = await enrollRes.text();
    assert.equal(enrollRes.status, 201, enrollText);
    const enrollBody = JSON.parse(enrollText);
    assert.equal(enrollBody.success, true);
    const enrollmentId = String(enrollBody.enrollment?._id);
    assert.ok(enrollmentId);

    const ledger = await Payment.findOne({
      type: "course",
      referenceId: enrollmentId,
      provider: "transfer",
    }).lean();
    assert.ok(ledger);
    assert.equal(ledger.status, "pending");

    const submitRes = await fetch(
      `${http.baseUrl}/api/enrollments/${enrollmentId}/submit-transfer`,
      {
        method: "PATCH",
        headers: bearer(customer._id),
        body: JSON.stringify({ reference: orderNum }),
      },
    );
    assert.equal(submitRes.status, 200);

    const confirmRes = await fetch(
      `${http.baseUrl}/api/admin/enrollments/${enrollmentId}/confirm-transfer-payment`,
      { method: "PATCH", headers: bearer(admin._id), body: JSON.stringify({}) },
    );
    assert.equal(confirmRes.status, 200);

    const stored = await Enrollment.findById(enrollmentId).lean();
    assert.equal(stored.paymentStatus, "paid");
    assert.ok(stored.paidAt);

    const paidLedger = await Payment.findById(ledger._id).lean();
    assert.equal(paidLedger.status, "success");
  });

  it("mentor không thể tự ghi danh khóa học của chính mình → 400", async () => {
    const { mentorUser, mentor } = await createVerifiedMentor();
    const course = await createPublishedCourse(mentor._id, 599000);

    const enrollRes = await fetch(`${http.baseUrl}/api/courses/${course._id}/enroll`, {
      method: "POST",
      headers: bearer(mentorUser._id),
      body: JSON.stringify({ paymentMethod: "transfer", orderNum: `PI-SELF-${Date.now()}` }),
    });
    assert.equal(enrollRes.status, 400);
    const body = await enrollRes.json();
    assert.match(body.error, /tự ghi danh/);
  });

  it("mentor không thể tự đánh giá khóa học của chính mình → 400", async () => {
    const { mentorUser, mentor } = await createVerifiedMentor();
    const course = await createPublishedCourse(mentor._id, 0);
    // Mô phỏng enrollment có sẵn (vd. dữ liệu cũ/đường khác) — review service phải tự chặn độc lập.
    await Enrollment.create({
      userId: mentorUser._id,
      courseId: course._id,
      pricePaid: 0,
      paymentStatus: "paid",
    });

    const { createReview } = await import("../services/reviewsService.js");
    const res = await createReview(String(mentorUser._id), {
      targetType: "course",
      targetId: String(course._id),
      rating: 5,
      comment: "Tự khen khóa học",
    });
    assert.equal(res.ok, false);
    assert.equal(res.status, 400);
    assert.match(res.error, /tự đánh giá/);
  });
});

describe("CK — lỗi nghiệp vụ & phân quyền", () => {
  it("subscription thiếu orderNum → 400", async () => {
    const customer = await createCustomer();
    const res = await fetch(`${http.baseUrl}/api/payments/subscription/transfer-pending`, {
      method: "POST",
      headers: bearer(customer._id),
      body: JSON.stringify({ planKey: "starter_pro", billing: "monthly", orderNum: "" }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /orderNum|mã đơn/i);
  });

  it("customer không được admin confirm subscription → 403", async () => {
    const customer = await createCustomer();
    const orderNum = `PI-NOADMIN-${Date.now()}`;
    const pendingRes = await fetch(`${http.baseUrl}/api/payments/subscription/transfer-pending`, {
      method: "POST",
      headers: bearer(customer._id),
      body: JSON.stringify({ planKey: "starter_pro", billing: "monthly", orderNum }),
    });
    const { paymentId } = await pendingRes.json();

    const confirmRes = await fetch(
      `${http.baseUrl}/api/admin/payments/${paymentId}/confirm-subscription-transfer`,
      { method: "PATCH", headers: bearer(customer._id), body: JSON.stringify({}) },
    );
    assert.equal(confirmRes.status, 403);
  });

  it("user khác submit-transfer booking → 404", async () => {
    const owner = await createCustomer();
    const intruder = await createCustomer();
    const { mentor } = await createVerifiedMentor();
    const orderNum = `PI-INTR-${Date.now()}`;

    const createRes = await fetch(`${http.baseUrl}/api/bookings`, {
      method: "POST",
      headers: bearer(owner._id),
      body: JSON.stringify({
        mentorId: String(mentor._id),
        date: futureBookingDate(),
        timeSlot: "11:00",
        sessionType: "mock_interview",
        paymentMethod: "transfer",
        orderNum,
      }),
    });
    const createBody = await createRes.json();
    const bookingId = bookingIdFromCreateBody(createBody);

    const submitRes = await fetch(`${http.baseUrl}/api/bookings/${bookingId}/submit-transfer`, {
      method: "PATCH",
      headers: bearer(intruder._id),
      body: JSON.stringify({ reference: orderNum }),
    });
    assert.equal(submitRes.status, 404);
  });

  it("đặt lịch ngày quá khứ → 400", async () => {
    const customer = await createCustomer();
    const { mentor } = await createVerifiedMentor();

    const res = await fetch(`${http.baseUrl}/api/bookings`, {
      method: "POST",
      headers: bearer(customer._id),
      body: JSON.stringify({
        mentorId: String(mentor._id),
        date: "01/01/2020",
        timeSlot: "09:00",
        sessionType: "mock_interview",
        paymentMethod: "transfer",
        orderNum: `PI-PAST-${Date.now()}`,
      }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /quá khứ/i);
  });

  it("admin confirm booking đã paid → 400", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const { mentor } = await createVerifiedMentor();
    const orderNum = `PI-DUP-${Date.now()}`;

    const createRes = await fetch(`${http.baseUrl}/api/bookings`, {
      method: "POST",
      headers: bearer(customer._id),
      body: JSON.stringify({
        mentorId: String(mentor._id),
        date: futureBookingDate(21),
        timeSlot: uniqueTimeSlot(),
        sessionType: "mock_interview",
        paymentMethod: "transfer",
        orderNum,
      }),
    });
    const createText = await createRes.text();
    assert.equal(createRes.status, 201, createText);
    const bookingId = bookingIdFromCreateBody(JSON.parse(createText));

    const submitRes = await fetch(`${http.baseUrl}/api/bookings/${bookingId}/submit-transfer`, {
      method: "PATCH",
      headers: bearer(customer._id),
      body: JSON.stringify({ reference: orderNum }),
    });
    assert.equal(submitRes.status, 200, await submitRes.text());

    const first = await fetch(
      `${http.baseUrl}/api/admin/bookings/${bookingId}/confirm-transfer-payment`,
      { method: "PATCH", headers: bearer(admin._id), body: JSON.stringify({}) },
    );
    assert.equal(first.status, 200, await first.text());

    const second = await fetch(
      `${http.baseUrl}/api/admin/bookings/${bookingId}/confirm-transfer-payment`,
      { method: "PATCH", headers: bearer(admin._id), body: JSON.stringify({}) },
    );
    assert.equal(second.status, 400);
    const body = await second.json();
    assert.match(body.error, /đã.*thanh toán/i);
  });

  it("submit-transfer booking khi đã paid → 400", async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const { mentor } = await createVerifiedMentor();
    const orderNum = `PI-RESUB-${Date.now()}`;

    const createRes = await fetch(`${http.baseUrl}/api/bookings`, {
      method: "POST",
      headers: bearer(customer._id),
      body: JSON.stringify({
        mentorId: String(mentor._id),
        date: futureBookingDate(22),
        timeSlot: uniqueTimeSlot(),
        sessionType: "mock_interview",
        paymentMethod: "transfer",
        orderNum,
      }),
    });
    const createText = await createRes.text();
    assert.equal(createRes.status, 201, createText);
    const bookingId = bookingIdFromCreateBody(JSON.parse(createText));

    const submitRes = await fetch(`${http.baseUrl}/api/bookings/${bookingId}/submit-transfer`, {
      method: "PATCH",
      headers: bearer(customer._id),
      body: JSON.stringify({ reference: orderNum }),
    });
    assert.equal(submitRes.status, 200, await submitRes.text());

    const confirmRes = await fetch(
      `${http.baseUrl}/api/admin/bookings/${bookingId}/confirm-transfer-payment`,
      { method: "PATCH", headers: bearer(admin._id), body: JSON.stringify({}) },
    );
    assert.equal(confirmRes.status, 200, await confirmRes.text());

    const again = await fetch(`${http.baseUrl}/api/bookings/${bookingId}/submit-transfer`, {
      method: "PATCH",
      headers: bearer(customer._id),
      body: JSON.stringify({ reference: orderNum }),
    });
    assert.equal(again.status, 400);
    const body = await again.json();
    assert.match(body.error, /đã được xử lý/i);
  });
});

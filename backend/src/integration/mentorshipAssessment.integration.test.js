/**
 * LP-05: mở rộng /api/mentorship-requests — jobPostId tùy chọn, status assessing / path_proposed,
 * POST /:id/accept-assessment (Mentor được chọn tạo buổi đánh giá 0đ), và status mới không chặn
 * luồng đặt lịch thường từ yêu cầu (resolveRequestBooking).
 */
import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer } from "../test_helpers/mongoTestHarness.js";
import { resetAssessmentQuota } from "../test_helpers/assessmentQuota.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";

let harness, server, baseUrl, models, service, createBooking, mentee, stranger, mentors;
let seq = 0;

const fields = { position: "Frontend Developer", description: "Muốn được đánh giá năng lực React trước khi luyện theo lộ trình.", sessionType: "mock_interview" };
const files = { cv: [{ originalname: "cv.pdf", buffer: Buffer.from("cv") }], jd: [{ originalname: "jd.txt", buffer: Buffer.from("jd") }] };
const offerBody = { message: "Tôi sẽ đánh giá năng lực React và đề xuất lộ trình phù hợp cho bạn.", availability: "Tối thứ 5" };

const actor = (user) => service.requestActor(String(user._id));
const pad = (n) => String(n).padStart(2, "0");
/** Ngày + giờ lấy theo đúng thời điểm đích (giờ local) để không phụ thuộc múi giờ máy chạy test. */
function slot(daysFromNow) {
  seq += 1;
  const d = new Date(Date.now() + 86400000 + daysFromNow * 60_000 + seq * 2 * 3_600_000);
  return { date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, timeSlot: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

async function selectedRequest(extra = {}) {
  const request = await service.createRequest(await actor(mentee), { ...fields, ...extra }, files);
  const offered = await service.sendOffer(await actor(mentors[0].user), String(request._id), offerBody);
  return service.selectOffer(await actor(mentee), String(request._id), String(offered.offers[0]._id));
}

before(async () => {
  harness = await startMongoHarness();
  // MentorshipRequest không export ở models/index.js nên import trực tiếp.
  models = { ...(await import("../models/index.js")), ...(await import("../models/MentorshipRequest.js")) };
  service = await import("../services/mentorshipRequestsService.js");
  ({ createBooking } = await import("../services/bookingsService.js"));
  mentee = await models.User.create({ name: "Mentee LP05", email: "lp05-mentee@test.local", role: "customer" });
  stranger = await models.User.create({ name: "Other LP05", email: "lp05-other@test.local", role: "customer" });
  mentors = [];
  for (let i = 0; i < 2; i += 1) {
    const user = await models.User.create({ name: `Mentor LP05 ${i}`, email: `lp05-mentor-${i}@test.local`, role: "mentor" });
    const mentor = await models.Mentor.findOneAndUpdate(
      { userId: user._id },
      { $set: { userId: user._id, name: `Mentor LP05 ${i}`, title: "Senior Engineer", company: "Test", publicId: `lp05-mentor-${i}`, isActive: true, isVerified: true, available: true, pricePerHour: 250000, sessionTypes: [{ type: "mock_interview", durationMinutes: 60, price: 250000 }], availableSlots: {}, recurringSchedule: [] } },
      { upsert: true, returnDocument: "after" },
    );
    mentors.push({ user, mentor });
  }
  await Promise.all([models.Booking.init(), models.MentorshipRequest.init(), models.Notification.init()]);
  const { mentorshipRequestsRouter } = await import("../routes/mentorshipRequests.js");
  const app = express();
  app.use(express.json());
  app.use("/api/mentorship-requests", mentorshipRequestsRouter);
  app.use((error, req, res, next) => res.status(error.status || 500).json({ success: false, error: error.message }));
  ({ server, baseUrl } = await startHttpServer(app));
});

after(async () => {
  if (server) await stopHttpServer(server);
  if (harness) await stopMongoHarness(harness);
});

describe("POST /api/mentorship-requests/:id/accept-assessment (LP-05)", () => {
  it("Mentor được chọn tạo buổi 0đ: booking assessment mọi field tiền 0, request → assessing, mentee nhận thông báo", async () => {
    const request = await selectedRequest();
    const s = slot(3);
    const res = await fetch(`${baseUrl}/api/mentorship-requests/${request._id}/accept-assessment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${mintAccessToken(mentors[0].user._id)}` },
      body: JSON.stringify({ ...s, note: "Chuẩn bị 1 dự án" }),
    });
    const body = await res.json();
    assert.equal(res.status, 201, body.error);
    assert.equal(body.request.status, "assessing");
    assert.equal(body.request.assessment.status, "confirmed");
    assert.equal(body.request.assessment.date, s.date);
    assert.equal(body.request.bookingId, "", "bookingId chỉ dành cho booking thường");

    const booking = await models.Booking.findById(body.request.assessment.bookingId).lean();
    assert.equal(booking.sessionType, "assessment");
    assert.equal(String(booking.mentorshipRequestId), String(request._id));
    assert.equal(String(booking.userId), String(mentee._id));
    assert.equal(booking.paymentStatus, "paid");
    for (const k of ["price", "totalAmount", "platformFee", "vat"]) assert.equal(booking[k], 0, k);
    assert.ok(booking.notes.includes("Chuẩn bị 1 dự án"));

    const row = await models.MentorshipRequest.findById(request._id).lean();
    assert.equal(String(row.assessmentBookingId), String(booking._id));
    assert.equal(await models.Notification.countDocuments({ userId: mentee._id, type: "booking_confirmed", "metadata.bookingId": booking._id }), 1);
  });

  it("chỉ Mentor được chọn mới tạo được; mentee và mentor khác bị 403; yêu cầu chưa chọn mentor bị 403/409", async () => {
    const request = await selectedRequest();
    const s = slot(3);
    await assert.rejects(service.acceptAssessment(await actor(mentors[1].user), String(request._id), s), { status: 403 });
    await assert.rejects(service.acceptAssessment(await actor(mentee), String(request._id), s), { status: 403 });

    const open = await service.createRequest(await actor(mentee), fields, files);
    await service.sendOffer(await actor(mentors[0].user), String(open._id), offerBody);
    await assert.rejects(service.acceptAssessment(await actor(mentors[0].user), String(open._id), slot(3)), { status: 403 });
    assert.equal(await models.Booking.countDocuments({ mentorshipRequestId: { $in: [request._id, open._id] } }), 0);
  });

  it("validate: sai định dạng, thời gian đã qua → 400; trùng khung giờ của mentor → 409 và không để booking mồ côi", async () => {
    const request = await selectedRequest();
    const mentor = await actor(mentors[0].user);
    await assert.rejects(service.acceptAssessment(mentor, String(request._id), { date: "2026-12-01", timeSlot: "10:00" }), { status: 400 });
    await assert.rejects(service.acceptAssessment(mentor, String(request._id), { ...slot(3), timeSlot: "25:00" }), { status: 400 });
    await assert.rejects(service.acceptAssessment(mentor, String(request._id), { date: "01/01/2020", timeSlot: "09:00" }), { status: 400 });

    const taken = slot(4);
    await models.Booking.create({
      userId: stranger._id, mentorId: mentors[0].mentor._id, sessionType: "mock_interview", status: "confirmed",
      ...taken, durationMinutes: 60, price: 1, platformFee: 0, vat: 0, totalAmount: 1,
    });
    await assert.rejects(service.acceptAssessment(mentor, String(request._id), taken), { status: 409 });
    const row = await models.MentorshipRequest.findById(request._id).lean();
    assert.equal(row.status, "selected");
    assert.equal(row.assessmentBookingId, null);
    assert.equal(await models.Booking.countDocuments({ mentorshipRequestId: request._id }), 0);
  });

  it("đang có buổi 0đ chưa diễn ra → 409; buổi trước bị hủy thì hẹn lại được; đã hoàn thành → 409", async () => {
    const request = await selectedRequest();
    await resetAssessmentQuota(mentee._id); // LP-06: một mentee dựng nhiều buổi 0đ trong file test
    const mentor = await actor(mentors[0].user);
    const first = await service.acceptAssessment(mentor, String(request._id), slot(3));
    await assert.rejects(service.acceptAssessment(mentor, String(request._id), slot(5)), { status: 409 });

    await models.Booking.updateOne({ _id: first.assessmentBookingId }, { $set: { status: "cancelled", cancelledBy: "mentor" } });
    const second = await service.acceptAssessment(mentor, String(request._id), slot(5));
    assert.notEqual(String(second.assessmentBookingId), String(first.assessmentBookingId));
    assert.equal(second.status, "assessing");

    await models.Booking.updateOne({ _id: second.assessmentBookingId }, { $set: { status: "completed" } });
    await assert.rejects(service.acceptAssessment(mentor, String(request._id), slot(6)), { status: 409 });
    assert.equal(await models.Booking.countDocuments({ mentorshipRequestId: request._id, sessionType: "assessment" }), 2);
  });

  it("yêu cầu đã path_proposed thì không tạo buổi 0đ mới", async () => {
    const request = await selectedRequest();
    await models.MentorshipRequest.updateOne({ _id: request._id }, { $set: { status: "path_proposed" } });
    await assert.rejects(service.acceptAssessment(await actor(mentors[0].user), String(request._id), slot(3)), { status: 409 });
  });
});

describe("Luồng đặt lịch thường từ yêu cầu với status mới (LP-05, sửa mentorshipRequestsService.js:125)", () => {
  for (const status of ["assessing", "path_proposed"]) {
    it(`request ${status}: mentee vẫn đặt được booking thường, không bị 403`, async () => {
      const request = await selectedRequest();
      if (status === "assessing") {
        await resetAssessmentQuota(mentee._id); // LP-06
        await service.acceptAssessment(await actor(mentors[0].user), String(request._id), slot(3));
      }
      else await models.MentorshipRequest.updateOne({ _id: request._id }, { $set: { status } });
      const d = new Date(Date.now() + 14 * 86400000);
      const payload = {
        mentorshipRequestId: String(request._id), mentorId: mentors[0].mentor.publicId,
        date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, timeSlot: status === "assessing" ? "10:00" : "11:00",
        sessionType: "mock_interview", paymentMethod: "transfer",
      };
      assert.equal((await createBooking(String(stranger._id), payload)).status, 403);
      const created = await createBooking(String(mentee._id), payload);
      assert.equal(created.ok, true, created.error);
      assert.equal(created.booking.mentorshipRequestId, String(request._id));
      const dto = await service.requestDTO(await service.loadRequest(String(request._id)), await actor(mentee));
      assert.equal(dto.bookingId, created.booking.id);
    });
  }

  it("request còn open (chưa chọn mentor) vẫn bị chặn như cũ", async () => {
    const request = await service.createRequest(await actor(mentee), fields, files);
    await assert.rejects(service.resolveRequestBooking(String(mentee._id), String(request._id), mentors[0].mentor), { status: 403 });
  });
});

describe("jobPostId tùy chọn khi tạo yêu cầu (LP-05, quyết định 5)", () => {
  it("lưu jobPostId của job đang mở, bỏ trống thì null, sai định dạng / không tồn tại / đã đóng thì 400", async () => {
    // Từ JB-03: jobPostId phải là job đang mở (published, chưa hết hạn, công ty không bị khóa).
    const company = await models.Company.create({ name: "Công ty LP05", slug: "lp05-company" });
    const job = await models.JobPost.create({
      companyId: company._id, title: "Frontend Developer (React)", roleCategory: "frontend", level: "junior",
      description: "Phát triển giao diện React cho sản phẩm thương mại điện tử, phối hợp cùng team thiết kế.",
      requiredCompetencies: [{ shrmKey: "technical_learning", minLevel: 3 }], status: "published", publishedAt: new Date(),
    });
    const jobPostId = String(job._id);
    const withJob = await service.createRequest(await actor(mentee), { ...fields, jobPostId }, files);
    assert.equal(String(withJob.jobPostId), jobPostId);
    const dto = await service.requestDTO(withJob, await actor(mentee));
    assert.equal(dto.jobPostId, jobPostId);
    assert.equal(dto.jobPost.title, "Frontend Developer (React)");
    assert.equal(dto.jobPost.isOpen, true);
    assert.deepEqual(dto.jobPost.requiredCompetencies.map((c) => c.shrmKey), ["technical_learning"]);
    assert.equal((await service.createRequest(await actor(mentee), { ...fields, jobPostId: "" }, files)).jobPostId, null);
    await assert.rejects(service.createRequest(await actor(mentee), { ...fields, jobPostId: "not-an-id" }, files), { status: 400 });
    await assert.rejects(service.createRequest(await actor(mentee), { ...fields, jobPostId: "65a1b2c3d4e5f60718293a4b" }, files), { status: 400 });
    await models.JobPost.updateOne({ _id: job._id }, { $set: { status: "closed" } });
    await assert.rejects(service.createRequest(await actor(mentee), { ...fields, jobPostId }, files), { status: 400 });
    // Job đóng sau khi đã gửi yêu cầu: yêu cầu vẫn giữ job, DTO báo isOpen = false.
    assert.equal((await service.requestDTO(withJob, await actor(mentee))).jobPost.isOpen, false);
    await models.MentorshipRequest.updateMany({ userId: mentee._id, status: "open" }, { $set: { status: "closed" } });
  });
});

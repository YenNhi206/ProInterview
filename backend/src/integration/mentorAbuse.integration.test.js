/**
 * Integration: chặn mentor tự đặt lịch / tự review chính mình, và grace period
 * trước khi mentor được tự đánh dấu "hoàn thành" booking (MongoDB).
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  applyTestEnv,
  startMongoHarness,
  stopMongoHarness,
} from "../test_helpers/mongoTestHarness.js";

applyTestEnv();

let harness;
let User;
let Mentor;
let Booking;
let createBooking;
let completeMentorBooking;
let cancelMyBooking;
let createReview;

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ Mentor } = await import("../models/Mentor.js"));
  ({ Booking } = await import("../models/Booking.js"));
  ({ createBooking, completeMentorBooking, cancelMyBooking } = await import("../services/bookingsService.js"));
  ({ createReview } = await import("../services/reviewsService.js"));
});

after(async () => {
  if (harness) await stopMongoHarness(harness);
});

async function createVerifiedMentor(suffix) {
  const mentorUser = await User.create({
    name: "Mentor Abuse Test",
    email: `mentor-abuse-${suffix}@test.local`,
    role: "mentor",
  });
  // userSchema.post("save") đã tự tạo Mentor doc cho role=mentor — cập nhật lại thay vì tạo mới.
  let mentor = await Mentor.findOne({ userId: mentorUser._id });
  if (!mentor) {
    mentor = await Mentor.create({
      userId: mentorUser._id,
      publicId: `m-abuse-${suffix}`,
      name: "Mentor Abuse Test",
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
      { $set: { isVerified: true, isActive: true, available: true, pricePerHour: 250000 } },
    );
    mentor = await Mentor.findById(mentor._id);
  }
  return { mentorUser, mentor };
}

function futureBookingDate(daysAhead = 14) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Tạo booking với giờ bắt đầu cách hiện tại `minutesAgo` phút — bypass service để test trực tiếp completeMentorBooking. */
async function createPastStartBooking({ mentorId, userId, minutesAgo }) {
  const startAt = new Date(Date.now() - minutesAgo * 60 * 1000);
  const dd = String(startAt.getDate()).padStart(2, "0");
  const mm = String(startAt.getMonth() + 1).padStart(2, "0");
  const date = `${dd}/${mm}/${startAt.getFullYear()}`;
  const timeSlot = `${String(startAt.getHours()).padStart(2, "0")}:${String(startAt.getMinutes()).padStart(2, "0")}`;
  return Booking.create({
    userId,
    mentorId,
    date,
    timeSlot,
    durationMinutes: 60,
    sessionType: "mock_interview",
    status: "confirmed",
    price: 250000,
    platformFee: 75000,
    vat: 0,
    totalAmount: 250000,
    paymentStatus: "paid",
  });
}

describe("Chặn mentor tự đặt lịch với chính mình", () => {
  it("createBooking trả 400 khi mentorId thuộc về chính người đặt", async () => {
    const { mentorUser, mentor } = await createVerifiedMentor(`self-book-${Date.now()}`);

    const res = await createBooking(String(mentorUser._id), {
      mentorId: String(mentor._id),
      date: futureBookingDate(),
      timeSlot: "10:00",
      sessionType: "mock_interview",
      paymentMethod: "transfer",
    });

    assert.equal(res.ok, false);
    assert.equal(res.status, 400);
    assert.match(res.error, /tự đặt lịch/);
  });
});

describe("Chặn mentor tự đánh giá chính mình", () => {
  it("createReview trả 400 khi reviewer là chính mentor được đánh giá", async () => {
    const { mentorUser, mentor } = await createVerifiedMentor(`self-review-${Date.now()}`);
    // Tạo booking trực tiếp trong DB (bypass createBooking) để mô phỏng dữ liệu cũ
    // hoặc đường khác — review service vẫn phải tự chặn độc lập với booking service.
    const booking = await createPastStartBooking({
      mentorId: mentor._id,
      userId: mentorUser._id,
      minutesAgo: 30,
    });
    booking.status = "completed";
    await booking.save();

    const res = await createReview(String(mentorUser._id), {
      targetType: "mentor",
      targetId: String(mentor._id),
      bookingId: String(booking._id),
      rating: 5,
      comment: "Tự khen",
    });

    assert.equal(res.ok, false);
    assert.equal(res.status, 400);
    assert.match(res.error, /tự đánh giá/);
  });
});

describe("Grace period trước khi mentor tự hoàn thành booking", () => {
  it("completeMentorBooking trả 400 nếu chưa qua 15' từ giờ bắt đầu", async () => {
    const { mentorUser, mentor } = await createVerifiedMentor(`grace-early-${Date.now()}`);
    const customer = await User.create({
      name: "Customer Grace",
      email: `customer-grace-${Date.now()}@test.local`,
      role: "customer",
    });
    const booking = await createPastStartBooking({
      mentorId: mentor._id,
      userId: customer._id,
      minutesAgo: 5,
    });

    const res = await completeMentorBooking(String(mentorUser._id), String(booking._id));
    assert.equal(res.ok, false);
    assert.equal(res.status, 400);
    assert.match(res.error, /15 phút/);

    const stored = await Booking.findById(booking._id).lean();
    assert.equal(stored.status, "confirmed");
  });

  it("completeMentorBooking thành công sau khi qua 15' từ giờ bắt đầu", async () => {
    const { mentorUser, mentor } = await createVerifiedMentor(`grace-ok-${Date.now()}`);
    const customer = await User.create({
      name: "Customer Grace OK",
      email: `customer-grace-ok-${Date.now()}@test.local`,
      role: "customer",
    });
    const booking = await createPastStartBooking({
      mentorId: mentor._id,
      userId: customer._id,
      minutesAgo: 20,
    });

    const res = await completeMentorBooking(String(mentorUser._id), String(booking._id));
    assert.equal(res.ok, true);

    const stored = await Booking.findById(booking._id).lean();
    assert.equal(stored.status, "completed");
  });
});

describe("Hoàn 100% khi khách hủy booking đã bị mentor đổi lịch đơn phương", () => {
  it("bỏ qua bậc phí hủy muộn nếu lần dời lịch gần nhất là do mentor", async () => {
    const { mentor } = await createVerifiedMentor(`reschedule-refund-${Date.now()}`);
    const customer = await User.create({
      name: "Customer Reschedule Refund",
      email: `customer-reschedule-${Date.now()}@test.local`,
      role: "customer",
    });
    // Giờ mới chỉ còn 5h nữa — nếu áp bậc phí thông thường (<12h) sẽ bị giữ 100%.
    const newStart = new Date(Date.now() + 5 * 60 * 60 * 1000);
    const dd = String(newStart.getDate()).padStart(2, "0");
    const mm = String(newStart.getMonth() + 1).padStart(2, "0");
    const date = `${dd}/${mm}/${newStart.getFullYear()}`;
    const timeSlot = `${String(newStart.getHours()).padStart(2, "0")}:${String(newStart.getMinutes()).padStart(2, "0")}`;

    const booking = await Booking.create({
      userId: customer._id,
      mentorId: mentor._id,
      date,
      timeSlot,
      durationMinutes: 60,
      sessionType: "mock_interview",
      status: "confirmed",
      price: 250000,
      platformFee: 75000,
      vat: 0,
      totalAmount: 250000,
      paymentStatus: "paid",
      rescheduleHistory: [
        {
          oldDate: "01/01/2099",
          oldTimeSlot: "09:00",
          newDate: date,
          newTimeSlot: timeSlot,
          reason: "Mentor bận việc đột xuất",
          changedBy: "mentor",
          changedAt: new Date(),
        },
      ],
    });

    const res = await cancelMyBooking(String(customer._id), String(booking._id), {
      reason: "Không sắp xếp được giờ mới",
      refundReceiveBankName: "VCB",
      refundReceiveAccountNumber: "1234567890",
      refundReceiveAccountHolder: "Customer Reschedule Refund",
    });

    assert.equal(res.ok, true);
    assert.equal(res.booking.cancelRefundPercent, 100);
    assert.equal(res.booking.cancelRefundAmountVnd, 250000);
  });
});

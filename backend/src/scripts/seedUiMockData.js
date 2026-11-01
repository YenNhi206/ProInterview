import "./_devOnlyGuard.js";
import mongoose from "mongoose";
import "../config/loadEnv.js";
import { connectDatabase } from "../db/connect.js";
import "../models/index.js";
import { User } from "../models/User.js";
import { Mentor } from "../models/Mentor.js";
import { Booking } from "../models/Booking.js";
import { PayoutRequest } from "../models/PayoutRequest.js";
import { createMentorProfileForUser } from "../services/mentorProfileService.js";

function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function ymd(date) {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

async function ensureDevUsers() {
  const [admin, customer, mentorUser] = await Promise.all([
    User.findOne({ email: "admin@dev.local" }),
    User.findOne({ email: "customer@dev.local" }),
    User.findOne({ email: "mentor@dev.local" }),
  ]);
  if (!admin || !customer || !mentorUser) {
    throw new Error("Thiếu user dev mặc định. Hãy chạy `npm run seed:users` trước.");
  }
  return { admin, customer, mentorUser };
}

async function ensureMentorProfile(mentorUser) {
  let mentor = await Mentor.findOne({ userId: mentorUser._id });
  if (!mentor) {
    await createMentorProfileForUser(mentorUser);
    mentor = await Mentor.findOne({ userId: mentorUser._id });
  }
  if (!mentor) throw new Error("Không thể tạo hồ sơ mentor dev.");
  return mentor;
}

async function seedBookings({ customerId, mentorId }) {
  await Booking.deleteMany({ notes: "UI_MOCK" });
  const basePrice = 450000;
  const rows = [
    { daysAgo: 1, status: "confirmed", paymentStatus: "paid", timeSlot: "09:00", sessionType: "mock_interview" },
    { daysAgo: 3, status: "completed", paymentStatus: "paid", timeSlot: "10:30", sessionType: "cv_review" },
    { daysAgo: 5, status: "completed", paymentStatus: "paid", timeSlot: "14:00", sessionType: "career_consulting" },
    { daysAgo: 7, status: "cancelled", paymentStatus: "refunded", timeSlot: "16:00", sessionType: "custom" },
    { daysAgo: 9, status: "pending", paymentStatus: "pending", timeSlot: "19:00", sessionType: "mock_interview" },
    { daysAgo: 12, status: "completed", paymentStatus: "paid", timeSlot: "08:30", sessionType: "mock_interview" },
  ];
  await Booking.insertMany(
    rows.map((row, idx) => {
      const price = basePrice + idx * 25000;
      const platformFee = Math.round(price * 0.2);
      const vat = Math.round(price * 0.1);
      const createdAt = daysAgoIso(row.daysAgo);
      return {
        userId: customerId,
        mentorId,
        date: ymd(createdAt),
        timeSlot: row.timeSlot,
        durationMinutes: 60,
        timezone: "Asia/Ho_Chi_Minh",
        sessionType: row.sessionType,
        notes: "UI_MOCK",
        meetingLink: "https://meet.google.com/ui-mock-room",
        status: row.status,
        price,
        platformFee,
        vat,
        totalAmount: price,
        paymentStatus: row.paymentStatus,
        paymentMethod: "transfer",
        paymentRef: `UI-MOCK-BOOKING-${idx + 1}`,
        paidAt: row.paymentStatus === "paid" ? createdAt : null,
        completedAt: row.status === "completed" ? createdAt : null,
        createdAt,
        updatedAt: createdAt,
      };
    }),
  );
}

async function seedPayouts({ mentor, adminId }) {
  await PayoutRequest.deleteMany({ providerRef: /^UI-MOCK-/ });
  const account = mentor.finance?.bankAccount || {
    bankName: "Vietcombank",
    accountNumber: "1234567890",
    accountName: mentor.name || "Mentor Dev",
  };
  const rows = [
    { amount: 300000, status: "pending", requestedAt: daysAgoIso(1), reviewedAt: null, rejectReason: "", note: "" },
    {
      amount: 450000,
      status: "approved",
      requestedAt: daysAgoIso(4),
      reviewedAt: daysAgoIso(3),
      rejectReason: "",
      note: "Đã duyệt theo lịch thanh toán tuần.",
    },
    {
      amount: 250000,
      status: "rejected",
      requestedAt: daysAgoIso(8),
      reviewedAt: daysAgoIso(7),
      rejectReason: "Thông tin tài khoản nhận tiền không khớp hồ sơ. Ghi chú: Vui lòng cập nhật lại STK trùng thông tin xác minh.",
      note: "",
    },
  ];
  await PayoutRequest.insertMany(
    rows.map((row, idx) => ({
      mentorId: mentor._id,
      amount: row.amount,
      status: row.status,
      payoutAccount: {
        bankName: account.bankName || "Vietcombank",
        accountNumber: account.accountNumber || "1234567890",
        accountName: account.accountName || mentor.name || "Mentor Dev",
      },
      requestedAt: row.requestedAt,
      reviewedAt: row.reviewedAt,
      reviewedBy: row.reviewedAt ? adminId : null,
      rejectReason: row.rejectReason,
      note: row.note,
      provider: "manual",
      providerRef: `UI-MOCK-PAYOUT-${idx + 1}`,
      createdAt: row.requestedAt,
      updatedAt: row.reviewedAt || row.requestedAt,
    })),
  );
}

async function updateMentorFinanceSnapshot(mentorId) {
  await Mentor.updateOne(
    { _id: mentorId },
    {
      $set: {
        "finance.availableBalance": 1800000,
        "finance.pendingBalance": 300000,
        "finance.totalEarned": 5200000,
        "finance.bankAccount.bankName": "Vietcombank",
        "finance.bankAccount.accountNumber": "1234567890",
      },
    },
  );
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Thiếu MONGO_URI trong .env");
    process.exit(1);
  }
  await connectDatabase(uri);
  const { admin, customer, mentorUser } = await ensureDevUsers();
  const mentor = await ensureMentorProfile(mentorUser);

  await seedBookings({ customerId: customer._id, mentorId: mentor._id });
  await seedPayouts({ mentor, adminId: admin._id });
  await updateMentorFinanceSnapshot(mentor._id);

  console.log("Da seed du lieu UI mock thanh cong.");
  console.log("- Admin: admin@dev.local / Dev123456");
  console.log("- Mentor: mentor@dev.local / Dev123456");
  console.log("- Customer: customer@dev.local / Dev123456");

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Seed UI mock that bai:", error?.message || error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

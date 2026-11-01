import "./_devOnlyGuard.js";
/**
 * Seed booking dev — customer@dev.local + mentor@dev.local
 * Chạy: npm run seed:users && npm run seed:bookings
 */
import mongoose from "mongoose";
import "../config/loadEnv.js";
import { connectDatabase } from "../db/connect.js";
import "../models/index.js";
import { User } from "../models/User.js";
import { Mentor } from "../models/Mentor.js";
import { Booking } from "../models/Booking.js";
import { createMentorProfileForUser } from "../services/mentorProfileService.js";

const SEED_TAG = "SEED_BOOKINGS_DEV";
const PAYMENT_REF_PREFIX = "SEED-BKG-DEV";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function dmy(date) {
  const d = new Date(date);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function addDays(date, offset) {
  const out = new Date(date);
  out.setDate(out.getDate() + offset);
  return out;
}

/** Khung giờ gần giờ hiện tại để test vào phòng / check-in mentor. */
function liveTimeSlot(now = new Date()) {
  const h = now.getHours();
  const slotH = Math.max(8, Math.min(h, 21));
  return `${pad2(slotH)}:00`;
}

function money(price) {
  const p = Math.round(Number(price) || 0);
  const platformFee = Math.round(p * 0.3);
  const vat = Math.round(p * 0.1 / 1.1);
  return {
    price: p,
    platformFeeRate: 0.3,
    platformFee,
    vat,
    totalAmount: p,
  };
}

async function ensureDevUsers() {
  const [customer, mentorUser] = await Promise.all([
    User.findOne({ email: "customer@dev.local" }),
    User.findOne({ email: "mentor@dev.local" }),
  ]);
  if (!customer || !mentorUser) {
    throw new Error("Thiếu user dev. Chạy `npm run seed:users` trước.");
  }
  return { customer, mentorUser };
}

async function ensureMentorProfile(mentorUser) {
  let mentor = await Mentor.findOne({ userId: mentorUser._id });
  if (!mentor) {
    await createMentorProfileForUser(mentorUser);
    mentor = await Mentor.findOne({ userId: mentorUser._id });
  }
  if (!mentor) throw new Error("Không tạo được hồ sơ mentor dev.");
  return mentor;
}

async function seedBookings({ customerId, mentorId }) {
  await Booking.deleteMany({
    $or: [{ notes: SEED_TAG }, { paymentRef: { $regex: `^${PAYMENT_REF_PREFIX}` } }],
  });

  const now = new Date();
  const today = dmy(now);
  const liveSlot = liveTimeSlot(now);

  const rows = [
    {
      key: "live-now",
      date: today,
      timeSlot: liveSlot,
      sessionType: "mock_interview",
      status: "confirmed",
      paymentStatus: "paid",
      daysOffset: 0,
      cvFileName: "cv-seed-live.pdf",
      cvFileUrl: "/uploads/seed-cv-live.pdf",
      position: "Frontend Developer",
      noteExtra: "Buổi LIVE — test vào phòng + check-in webcam mentor.",
    },
    {
      key: "in-progress",
      date: today,
      timeSlot: liveSlot,
      sessionType: "cv_review",
      status: "in_progress",
      paymentStatus: "paid",
      daysOffset: 0,
      mentorCheckIn: true,
      noteExtra: "Đang diễn ra (in_progress).",
    },
    {
      key: "upcoming-tomorrow",
      date: dmy(addDays(now, 1)),
      timeSlot: "10:00",
      sessionType: "career_consulting",
      status: "confirmed",
      paymentStatus: "paid",
      daysOffset: -1,
      noteExtra: "Buổi sắp tới ngày mai.",
    },
    {
      key: "upcoming-week",
      date: dmy(addDays(now, 4)),
      timeSlot: "15:00",
      sessionType: "mock_interview",
      status: "confirmed",
      paymentStatus: "paid",
      daysOffset: -2,
      noteExtra: "Buổi tuần sau.",
    },
    {
      key: "pending-transfer",
      date: dmy(addDays(now, 6)),
      timeSlot: "19:00",
      sessionType: "custom",
      status: "pending",
      paymentStatus: "pending",
      daysOffset: -1,
      noteExtra: "Chờ thanh toán CK.",
    },
    {
      key: "completed-review",
      date: dmy(addDays(now, -5)),
      timeSlot: "14:00",
      sessionType: "mock_interview",
      status: "completed",
      paymentStatus: "paid",
      daysOffset: -6,
      mentorCheckIn: true,
      completed: true,
      noteExtra: "Đã hoàn thành — học viên có thể review.",
    },
    {
      key: "completed-cv",
      date: dmy(addDays(now, -10)),
      timeSlot: "09:30",
      sessionType: "cv_review",
      status: "completed",
      paymentStatus: "paid",
      daysOffset: -11,
      completed: true,
      noteExtra: "Buổi xem CV đã xong.",
    },
    {
      key: "cancelled-refund",
      date: dmy(addDays(now, -3)),
      timeSlot: "16:00",
      sessionType: "mock_interview",
      status: "cancelled",
      paymentStatus: "refunded",
      daysOffset: -4,
      cancelledBy: "user",
      cancelReason: "Seed: học viên hủy trước 24h.",
      noteExtra: "Đã hủy và hoàn tiền.",
    },
  ];

  const docs = rows.map((row, idx) => {
    const price = 450000 + idx * 20000;
    const createdAt = addDays(now, row.daysOffset ?? -idx);
    const paid = row.paymentStatus === "paid";
    const doc = {
      userId: customerId,
      mentorId,
      date: row.date,
      timeSlot: row.timeSlot,
      durationMinutes: 60,
      timezone: "Asia/Ho_Chi_Minh",
      sessionType: row.sessionType,
      notes: `${SEED_TAG} | ${row.noteExtra}`,
      cvFileName: row.cvFileName || "cv-seed-demo.pdf",
      cvFileUrl: row.cvFileUrl || "",
      jdFileName: row.jdFileName || "",
      jdFileUrl: row.jdFileUrl || "",
      meetingLink: "",
      status: row.status,
      paymentStatus: row.paymentStatus,
      paymentMethod: row.paymentStatus === "pending" ? "transfer" : "transfer",
      paymentRef: `${PAYMENT_REF_PREFIX}-${row.key}`,
      paidAt: paid ? addDays(createdAt, 1) : null,
      completedAt: row.completed ? addDays(createdAt, 2) : null,
      cancelledBy: row.cancelledBy || "",
      cancelReason: row.cancelReason || "",
      cancelledAt: row.status === "cancelled" ? addDays(createdAt, 1) : null,
      createdAt,
      updatedAt: createdAt,
      ...money(price),
    };

    if (row.mentorCheckIn) {
      doc.mentorCheckInAt = addDays(createdAt, 1);
      doc.mentorCheckInImageUrl = "/uploads/seed-mentor-checkin.jpg";
    }

    return doc;
  });

  const inserted = await Booking.insertMany(docs);
  return inserted;
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Thiếu MONGO_URI trong .env");
    process.exit(1);
  }

  await connectDatabase(uri);
  const { customer, mentorUser } = await ensureDevUsers();
  const mentor = await ensureMentorProfile(mentorUser);
  const bookings = await seedBookings({ customerId: customer._id, mentorId: mentor._id });

  console.log(`\n✅ Đã seed ${bookings.length} booking dev (${SEED_TAG}).\n`);
  console.log("Tài khoản (mật khẩu Dev123456):");
  console.log("  • customer@dev.local — My Bookings / Session detail");
  console.log("  • mentor@dev.local   — Lịch mentor / Vào phòng\n");
  console.log("Booking nổi bật:");
  for (const b of bookings) {
    console.log(
      `  • ${b.paymentRef} | ${b.date} ${b.timeSlot} | ${b.sessionType} | ${b.status}/${b.paymentStatus}`,
    );
  }
  const live = bookings.find((b) => String(b.paymentRef || "").includes("live-now"));
  if (live) {
    console.log(`\n🔗 Test phòng họp (mentor check-in): /meeting/${live._id}`);
    console.log(`🔗 Chi tiết buổi (học viên): /session/${live._id}\n`);
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Seed bookings thất bại:", err?.message || err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

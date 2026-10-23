import "./_devOnlyGuard.js";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import "../config/loadEnv.js";
import { connectDatabase } from "../db/connect.js";
import "../models/index.js";
import { User } from "../models/User.js";
import { Mentor } from "../models/Mentor.js";
import { Booking } from "../models/Booking.js";
import { Course } from "../models/Course.js";
import { Enrollment } from "../models/Enrollment.js";
import { Payment } from "../models/Payment.js";
import { createMentorProfileForUser } from "../services/mentorProfileService.js";
import { resolveBookingPlatformFeeRate, resolveCoursePlatformFeeRate } from "../services/mentorCommissionService.js";
import {
  tryCreditMentorForCompletedBooking,
  tryCreditMentorForPaidEnrollment,
} from "../services/mentorEarningsService.js";

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = "Dev123456";
const SAMPLE_PREFIX = "COMMISSION_SAMPLE";

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

async function ensureMentorUser({ email, name }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  let user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
    user = await User.create({
      email: normalizedEmail,
      name,
      role: "mentor",
      passwordHash,
      isActive: true,
    });
  } else if (user.role !== "mentor") {
    user.role = "mentor";
    user.isActive = true;
    await user.save();
  }
  return user;
}

async function ensureMentorProfile(user, basic = {}) {
  let mentor = await Mentor.findOne({ userId: user._id });
  if (!mentor) {
    await createMentorProfileForUser(user);
    mentor = await Mentor.findOne({ userId: user._id });
  }
  if (!mentor) throw new Error(`Không tạo được hồ sơ mentor cho ${user.email}`);

  mentor.name = basic.name || mentor.name || user.name;
  mentor.title = basic.title || mentor.title || "Mentor";
  mentor.company = basic.company || mentor.company || "ProInterview";
  mentor.pricePerHour = Number(basic.pricePerHour || mentor.pricePerHour || 350000);
  mentor.isActive = true;
  mentor.available = true;
  mentor.isVerified = true;
  mentor.verifiedAt = mentor.verifiedAt || new Date();
  mentor.adminReview = {
    status: "approved",
    reason: "",
    reviewedAt: mentor.adminReview?.reviewedAt || new Date(),
    reviewedBy: mentor.adminReview?.reviewedBy || null,
  };
  await mentor.save();
  return mentor;
}

async function ensureCustomerUser() {
  const email = "customer@dev.local";
  let user = await User.findOne({ email });
  if (!user) {
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
    user = await User.create({
      email,
      name: "Customer Dev",
      role: "customer",
      passwordHash,
      isActive: true,
    });
  }
  return user;
}

async function cleanupSampleData() {
  const sampleBookings = await Booking.find({
    paymentRef: { $regex: `^${SAMPLE_PREFIX}-BOOKING-` },
  })
    .select("_id")
    .lean();
  const sampleBookingIds = sampleBookings.map((b) => b._id);

  const sampleCourses = await Course.find({
    title: { $regex: `^${SAMPLE_PREFIX}-COURSE-` },
  })
    .select("_id")
    .lean();
  const sampleCourseIds = sampleCourses.map((c) => c._id);

  const sampleEnrollments = await Enrollment.find({
    paymentRef: { $regex: `^${SAMPLE_PREFIX}-ENROLL-` },
  })
    .select("_id")
    .lean();
  const sampleEnrollmentIds = sampleEnrollments.map((e) => e._id);

  if (sampleBookingIds.length || sampleEnrollmentIds.length) {
    await Payment.deleteMany({
      $or: [
        { referenceModel: "Booking", referenceId: { $in: sampleBookingIds } },
        { referenceModel: "Enrollment", referenceId: { $in: sampleEnrollmentIds } },
      ],
    });
  }
  if (sampleEnrollmentIds.length) await Enrollment.deleteMany({ _id: { $in: sampleEnrollmentIds } });
  if (sampleCourseIds.length) await Course.deleteMany({ _id: { $in: sampleCourseIds } });
  if (sampleBookingIds.length) await Booking.deleteMany({ _id: { $in: sampleBookingIds } });
}

async function seedBookingSamplesForMentor({ mentor, customer, code }) {
  const rate = resolveBookingPlatformFeeRate(mentor).rate;
  const basePrice = Math.round(Number(mentor.pricePerHour || 400000));
  const rows = [
    { daysAgo: 3, price: basePrice },
    { daysAgo: 8, price: basePrice + 50000 },
  ];

  let gross = 0;
  let net = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const platformFee = Math.round(row.price * rate);
    const now = addDays(new Date(), -row.daysAgo);
    const booking = await Booking.create({
      userId: customer._id,
      mentorId: mentor._id,
      date: now.toLocaleDateString("vi-VN"),
      timeSlot: "09:00",
      durationMinutes: 60,
      timezone: "Asia/Ho_Chi_Minh",
      sessionType: "mock_interview",
      notes: SAMPLE_PREFIX,
      meetingLink: "https://meet.google.com/commission-sample",
      status: "completed",
      price: row.price,
      platformFeeRate: rate,
      platformFee,
      vat: 0,
      totalAmount: row.price,
      paymentStatus: "paid",
      paymentMethod: "transfer",
      paymentRef: `${SAMPLE_PREFIX}-BOOKING-${code}-${i + 1}`,
      paidAt: now,
      completedAt: now,
    });
    gross += row.price;
    net += row.price - platformFee;
    await tryCreditMentorForCompletedBooking(booking._id);
  }
  return { gross, net };
}

async function seedCourseSampleForMentor({ mentor, customer, code }) {
  const coursePrice = Math.round(Number(mentor.pricePerHour || 400000) * 0.9);
  const course = await Course.create({
    mentorId: mentor._id,
    title: `${SAMPLE_PREFIX}-COURSE-${code}`,
    description: "Seed du lieu mau tinh phi khoa hoc.",
    level: "intermediate",
    isFree: false,
    price: coursePrice,
    status: "published",
    modules: [
      {
        title: "Module mẫu",
        order: 1,
        lessons: [
          { title: "Bài 1", type: "video", durationMinutes: 20, order: 1, isFree: true },
          { title: "Bài 2", type: "video", durationMinutes: 25, order: 2, isFree: false },
        ],
      },
    ],
  });

  const courseRate = resolveCoursePlatformFeeRate(mentor).rate;
  const courseFee = Math.round(coursePrice * courseRate);
  const enrollment = await Enrollment.create({
    userId: customer._id,
    courseId: course._id,
    pricePaid: coursePrice,
    platformFeeRate: courseRate,
    platformFee: courseFee,
    paymentStatus: "paid",
    paymentMethod: "transfer",
    paymentRef: `${SAMPLE_PREFIX}-ENROLL-${code}-1`,
    paidAt: addDays(new Date(), -5),
    lastAccessedAt: new Date(),
  });

  await tryCreditMentorForPaidEnrollment(enrollment._id);
  return { gross: coursePrice, net: coursePrice - courseFee };
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Thiếu MONGO_URI trong .env");
    process.exit(1);
  }
  await connectDatabase(uri);

  const now = new Date();
  const customer = await ensureCustomerUser();
  await cleanupSampleData();

  // 1) Mentor Early còn hiệu lực (áp dụng 20% booking, 25% course)
  const earlyUser = await ensureMentorUser({
    email: "mentor@dev.local",
    name: "Mentor Early",
  });
  const earlyMentor = await ensureMentorProfile(earlyUser, {
    name: "Mentor Early",
    title: "System Design Mentor",
    company: "ProInterview",
    pricePerHour: 450000,
  });
  earlyMentor.pricing = {
    ...(earlyMentor.pricing || {}),
    mentorActivatedAt: addDays(now, -90),
    platformFeeRate: null,
    coursePlatformFeeRate: null,
    isEarlyMentor: true,
    earlyMentorRank: 7,
    earlyMentorExpiresAt: addDays(now, 275),
  };
  await earlyMentor.save();

  // 2) Mentor có phí riêng theo hợp đồng (override)
  const customUser = await ensureMentorUser({
    email: "mentor.contract@dev.local",
    name: "Mentor Contract",
  });
  const customMentor = await ensureMentorProfile(customUser, {
    name: "Mentor Contract",
    title: "Career Coach",
    company: "Partner Corp",
    pricePerHour: 600000,
  });
  customMentor.pricing = {
    ...(customMentor.pricing || {}),
    mentorActivatedAt: addDays(now, -220),
    platformFeeRate: 0.18,
    coursePlatformFeeRate: 0.22,
    isEarlyMentor: false,
    earlyMentorRank: null,
    earlyMentorExpiresAt: null,
  };
  await customMentor.save();

  // 3) Mentor tiêu chuẩn (hết ưu đãi, không override)
  const standardUser = await ensureMentorUser({
    email: "mentor.standard@dev.local",
    name: "Mentor Standard",
  });
  const standardMentor = await ensureMentorProfile(standardUser, {
    name: "Mentor Standard",
    title: "Interview Mentor",
    company: "Tech Co",
    pricePerHour: 400000,
  });
  standardMentor.pricing = {
    ...(standardMentor.pricing || {}),
    mentorActivatedAt: addDays(now, -500),
    platformFeeRate: null,
    coursePlatformFeeRate: null,
    isEarlyMentor: false,
    earlyMentorRank: null,
    earlyMentorExpiresAt: null,
  };
  await standardMentor.save();

  // Reset snapshot ví để dễ quan sát khi demo.
  await Mentor.updateMany(
    { _id: { $in: [earlyMentor._id, customMentor._id, standardMentor._id] } },
    {
      $set: {
        "finance.availableBalance": 0,
        "finance.pendingBalance": 0,
        "finance.totalEarned": 0,
      },
    },
  );

  const earlyBooking = await seedBookingSamplesForMentor({
    mentor: earlyMentor,
    customer,
    code: "EARLY",
  });
  const earlyCourse = await seedCourseSampleForMentor({
    mentor: earlyMentor,
    customer,
    code: "EARLY",
  });

  const contractBooking = await seedBookingSamplesForMentor({
    mentor: customMentor,
    customer,
    code: "CONTRACT",
  });
  const contractCourse = await seedCourseSampleForMentor({
    mentor: customMentor,
    customer,
    code: "CONTRACT",
  });

  const standardBooking = await seedBookingSamplesForMentor({
    mentor: standardMentor,
    customer,
    code: "STANDARD",
  });
  const standardCourse = await seedCourseSampleForMentor({
    mentor: standardMentor,
    customer,
    code: "STANDARD",
  });

  console.log("Đã seed mẫu commission cho mentor.");
  console.log("- mentor@dev.local => Early Mentor (20% booking, 25% course)");
  console.log("- mentor.contract@dev.local => Override hợp đồng (18% booking, 22% course)");
  console.log("- mentor.standard@dev.local => Mức chuẩn hệ thống (30% booking, 35% course)");
  console.log("Đã tạo booking completed + enrollment paid mẫu cho từng mentor để đối chiếu thực nhận.");
  console.log(`  Early net: ${(earlyBooking.net + earlyCourse.net).toLocaleString("vi-VN")}₫`);
  console.log(`  Contract net: ${(contractBooking.net + contractCourse.net).toLocaleString("vi-VN")}₫`);
  console.log(`  Standard net: ${(standardBooking.net + standardCourse.net).toLocaleString("vi-VN")}₫`);
  console.log(`Mật khẩu test: ${DEFAULT_PASSWORD}`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Seed commission mẫu thất bại:", err?.message || err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

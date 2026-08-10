/**
 * seedFinanceDemoData.js
 * Seed dữ liệu DEMO (khách hàng, ghi danh khóa học, gói Pro/Elite, booking) để trang admin
 * (/admin/finance, /admin/transactions, /admin/users) có số liệu để trình bày khi demo.
 *
 * KHÔNG dùng để làm "bằng chứng" doanh thu/khách hàng thật trong báo cáo nộp trường — chỉ để
 * demo giao diện. Toàn bộ bản ghi được đánh dấu rõ ràng (email "*.uimock@demo.local",
 * paymentRef/providerRef bắt đầu "UIMOCK-") để dễ nhận diện và xoá sau khi demo xong.
 *
 * Chạy:
 *   node src/scripts/seedFinanceDemoData.js            # seed dữ liệu demo
 *   node src/scripts/seedFinanceDemoData.js --cleanup  # xoá sạch dữ liệu demo đã tạo
 *
 * MONGO_URI lấy từ .env đang có — trỏ đúng DB bạn muốn demo (local hay DB thật đang deploy)
 * trước khi chạy.
 */
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import "../config/loadEnv.js";
import { connectDatabase } from "../db/connect.js";
import "../models/index.js";
import { User } from "../models/User.js";
import { Mentor } from "../models/Mentor.js";
import { Course } from "../models/Course.js";
import { Booking } from "../models/Booking.js";
import { Enrollment } from "../models/Enrollment.js";
import { Payment } from "../models/Payment.js";
import { Subscription } from "../models/Subscription.js";

const DEMO_EMAIL_SUFFIX = ".uimock@demo.local";
const DEMO_PASSWORD = "Demo123456";
const REF_PREFIX = "UIMOCK-";

const DEMO_CUSTOMERS = [
  { slug: "tran-le-hoang", name: "Trần Lê Hoàng", plan: "free" },
  { slug: "pham-thi-kim-ngan", name: "Phạm Thị Kim Ngân", plan: "free" },
  { slug: "nguyen-van-phuc", name: "Nguyễn Văn Phúc", plan: "starter_pro" },
  { slug: "vo-thi-thu-huyen", name: "Võ Thị Thu Huyền", plan: "starter_pro" },
  { slug: "dang-quoc-bao", name: "Đặng Quốc Bảo", plan: "elite_pro" },
  { slug: "le-ngoc-anh-thu", name: "Lê Ngọc Anh Thư", plan: "elite_pro" },
];

const PLAN_QUOTA = {
  starter_pro: { cvAnalysisLimit: 10, interviewLimit: 3, interviewQuestionsAllowed: 5, amount: 99000 },
  elite_pro:   { cvAnalysisLimit: 30, interviewLimit: 8, interviewQuestionsAllowed: 5, amount: 199000 },
};

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function monthsFromNow(n) {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d;
}

async function cleanup() {
  const users = await User.find({ email: { $regex: `${DEMO_EMAIL_SUFFIX}$` } }).select("_id");
  const userIds = users.map((u) => u._id);

  const [enr, pay, sub, book, usr] = await Promise.all([
    Enrollment.deleteMany({ paymentRef: { $regex: `^${REF_PREFIX}` } }),
    Payment.deleteMany({ providerRef: { $regex: `^${REF_PREFIX}` } }),
    Subscription.deleteMany({ userId: { $in: userIds } }),
    Booking.deleteMany({ paymentRef: { $regex: `^${REF_PREFIX}` } }),
    User.deleteMany({ email: { $regex: `${DEMO_EMAIL_SUFFIX}$` } }),
  ]);

  console.log("Da xoa du lieu demo:");
  console.log(`- Users: ${usr.deletedCount}`);
  console.log(`- Subscriptions: ${sub.deletedCount}`);
  console.log(`- Payments: ${pay.deletedCount}`);
  console.log(`- Enrollments: ${enr.deletedCount}`);
  console.log(`- Bookings: ${book.deletedCount}`);
}

async function ensureDemoCustomer({ slug, name, plan }) {
  const email = `${slug}${DEMO_EMAIL_SUFFIX}`;
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const quota = PLAN_QUOTA[plan];

  const update = {
    name,
    email,
    passwordHash,
    role: "customer",
    plan,
    planExpiresAt: plan === "free" ? null : monthsFromNow(1),
    isEmailVerified: true,
    isActive: true,
  };
  if (quota) {
    update.quota = {
      cvAnalysisUsed: Math.floor(Math.random() * 3),
      cvAnalysisLimit: quota.cvAnalysisLimit,
      interviewUsed: Math.floor(Math.random() * 2),
      interviewLimit: quota.interviewLimit,
      interviewQuestionsAllowed: quota.interviewQuestionsAllowed,
      resetAt: monthsFromNow(1),
    };
  }

  const user = await User.findOneAndUpdate(
    { email },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return user;
}

async function seedSubscriptionPayment(user, plan, daysAgoPaid) {
  const quota = PLAN_QUOTA[plan];
  if (!quota) return;

  const startedAt = daysAgo(daysAgoPaid);
  const expiresAt = monthsFromNow(1);

  const sub = await Subscription.findOneAndUpdate(
    { userId: user._id },
    {
      $set: { plan, billingCycle: "monthly", startedAt, expiresAt, isAutoRenew: false },
      $push: {
        history: {
          plan,
          billingCycle: "monthly",
          startedAt,
          expiresAt,
          paymentRef: `${REF_PREFIX}SUB-${user._id}`,
          amount: quota.amount,
        },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await Payment.findOneAndUpdate(
    { providerRef: `${REF_PREFIX}SUB-${user._id}` },
    {
      $set: {
        userId: user._id,
        type: "subscription",
        referenceId: sub._id,
        referenceModel: "Subscription",
        amount: quota.amount,
        currency: "VND",
        provider: "transfer",
        providerRef: `${REF_PREFIX}SUB-${user._id}`,
        status: "success",
        paidAt: startedAt,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function seedEnrollments(customers, courses) {
  if (!courses.length) {
    console.warn("Khong tim thay khoa hoc co price > 0 - bo qua seed enrollment.");
    return;
  }
  let i = 0;
  for (const user of customers) {
    const course = courses[i % courses.length];
    i += 1;
    const paidAt = daysAgo(2 + i * 3);
    await Enrollment.findOneAndUpdate(
      { userId: user._id, courseId: course._id },
      {
        $set: {
          userId: user._id,
          courseId: course._id,
          pricePaid: course.price,
          paymentStatus: "paid",
          paymentMethod: "transfer",
          paymentRef: `${REF_PREFIX}ENR-${user._id}`,
          paidAt,
          progressPercent: Math.floor(Math.random() * 60),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
}

async function seedBookings(customers, mentor) {
  if (!mentor) {
    console.warn("Khong tim thay mentor nao - bo qua seed booking.");
    return;
  }
  await Booking.deleteMany({ paymentRef: { $regex: `^${REF_PREFIX}BOOKING-` } });
  const rows = customers.slice(0, 4).map((user, idx) => {
    const price = 450000 + idx * 50000;
    const createdAt = daysAgo(1 + idx * 4);
    return {
      userId: user._id,
      mentorId: mentor._id,
      date: createdAt.toLocaleDateString("en-GB"),
      timeSlot: "09:00",
      durationMinutes: 60,
      timezone: "Asia/Ho_Chi_Minh",
      sessionType: "mock_interview",
      notes: "UI_MOCK",
      meetingLink: "https://meet.google.com/ui-mock-room",
      status: "completed",
      price,
      platformFee: Math.round(price * 0.3),
      vat: Math.round(price * 0.1),
      totalAmount: price,
      paymentStatus: "paid",
      paymentMethod: "transfer",
      paymentRef: `${REF_PREFIX}BOOKING-${idx + 1}`,
      paidAt: createdAt,
      completedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    };
  });
  await Booking.insertMany(rows);
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Thieu MONGO_URI trong .env");
    process.exit(1);
  }
  await connectDatabase(uri);

  if (process.argv.includes("--cleanup")) {
    await cleanup();
    await mongoose.disconnect();
    return;
  }

  console.log(`Dang seed vao DB: ${mongoose.connection.name} (${uri.includes("mongodb+srv") ? "Atlas/remote" : "local"})`);

  const customers = [];
  for (const c of DEMO_CUSTOMERS) {
    const user = await ensureDemoCustomer(c);
    customers.push({ user, plan: c.plan });
    if (c.plan !== "free") {
      await seedSubscriptionPayment(user, c.plan, 3 + customers.length * 2);
    }
  }

  const courses = await Course.find({ price: { $gt: 0 } }).limit(3).lean();
  await seedEnrollments(customers.map((c) => c.user), courses);

  const mentor = await Mentor.findOne().lean();
  await seedBookings(customers.map((c) => c.user), mentor);

  console.log("Da seed du lieu demo tai chinh thanh cong.");
  console.log(`- ${DEMO_CUSTOMERS.length} khach hang demo (mat khau: ${DEMO_PASSWORD})`);
  console.log(`- ${courses.length} khoa hoc duoc dung de tao enrollment`);
  console.log(mentor ? "- Da tao booking demo" : "- Bo qua booking (khong co mentor nao trong DB)");
  console.log("");
  console.log("De xoa sach du lieu demo sau khi dung xong:");
  console.log("  node src/scripts/seedFinanceDemoData.js --cleanup");

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Seed finance demo that bai:", error?.message || error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

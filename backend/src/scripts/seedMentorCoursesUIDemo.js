import "./_devOnlyGuard.js";
/**
 * Seed đánh giá + ghi danh paid cho khóa học của mentor dev — để xem UI "Khóa học của tôi".
 * Chạy (từ backend/):
 *   npm run seed:mentor-courses-ui
 *   MENTOR_EMAIL=mentor@dev.local npm run seed:mentor-courses-ui
 */
import "../config/loadEnv.js";
import mongoose from "mongoose";
import { connectDatabase } from "../db/connect.js";
import "../models/index.js";
import { User } from "../models/User.js";
import { Mentor } from "../models/Mentor.js";
import { Course } from "../models/Course.js";
import { Enrollment } from "../models/Enrollment.js";
import { Review } from "../models/Review.js";
import { countPaidEnrollmentsByCourseIds } from "../services/courseStatsService.js";
import { recalcCourseReviewStats } from "../services/reviewsService.js";

const TAG = "ui-mentor-courses-demo";
const MENTOR_EMAIL = String(process.env.MENTOR_EMAIL || "mentor@dev.local").trim().toLowerCase();

const REVIEW_COMMENTS = [
  "Nội dung rõ ràng, bài tập sát phỏng vấn thực tế.",
  "Giải thích dễ hiểu, phù hợp người mới.",
  "Cần thêm vài bài quiz nhưng tổng thể rất hay.",
  "Học xong tự tin hơn khi trả lời behavioral.",
  "Video ngắn gọn, đi thẳng vào trọng tâm.",
];

async function upsertPaidEnrollment(userId, courseId, price) {
  const filter = { userId, courseId };
  const existing = await Enrollment.findOne(filter).lean();
  if (existing?.paymentStatus === "paid") return existing;
  const now = new Date();
  return Enrollment.findOneAndUpdate(
    filter,
    {
      $set: {
        userId,
        courseId,
        paymentStatus: "paid",
        paymentMethod: "transfer",
        paymentRef: `${TAG}-${String(courseId).slice(-6)}`,
        pricePaid: price,
        progressPercent: 35,
        lastAccessedAt: now,
        transferConfirmedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true, new: true },
  );
}

async function upsertCourseReview(userId, courseId, rating, comment) {
  return Review.findOneAndUpdate(
    { userId, targetType: "course", targetId: courseId },
    {
      $set: {
        userId,
        targetType: "course",
        targetId: courseId,
        rating,
        comment,
        tags: [TAG],
        isVisible: true,
        isVerified: true,
      },
    },
    { upsert: true, new: true },
  );
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Thiếu MONGO_URI trong backend/.env");
    process.exit(1);
  }

  await connectDatabase(uri);

  const mentorUser = await User.findOne({ email: MENTOR_EMAIL, role: "mentor" }).lean();
  if (!mentorUser) {
    console.error(`Không tìm thấy mentor: ${MENTOR_EMAIL}. Chạy npm run seed:users trước.`);
    process.exit(1);
  }

  const mentor = await Mentor.findOne({ userId: mentorUser._id }).lean();
  if (!mentor) {
    console.error("Chưa có hồ sơ Mentor. Chạy: npm run sync:mentor-profiles");
    process.exit(1);
  }

  const courses = await Course.find({ mentorId: mentor._id, status: { $ne: "archived" } }).lean();
  if (!courses.length) {
    console.error("Mentor chưa có khóa học. Tạo khóa trên UI hoặc chạy npm run seed:all");
    process.exit(1);
  }

  let customers = await User.find({ role: "customer" }).limit(12).lean();
  if (customers.length < 3) {
    console.error("Cần ít nhất vài user customer. Chạy npm run seed:users");
    process.exit(1);
  }

  let reviewCount = 0;
  let enrollCount = 0;

  for (let ci = 0; ci < courses.length; ci++) {
    const course = courses[ci];
    const price = Number(course.price) || 299_000;

    const reviewsForCourse = Math.min(4, customers.length);
    for (let ri = 0; ri < reviewsForCourse; ri++) {
      const customer = customers[(ci + ri) % customers.length];
      const rating = ri % 2 === 0 ? 5 : 4;
      const comment = `${REVIEW_COMMENTS[(ci + ri) % REVIEW_COMMENTS.length]} (${TAG})`;
      await upsertCourseReview(customer._id, course._id, rating, comment);
      reviewCount += 1;
    }

    const enrollForCourse = Math.min(10, customers.length);
    for (let ei = 0; ei < enrollForCourse; ei++) {
      const customer = customers[(ci * 2 + ei) % customers.length];
      await upsertPaidEnrollment(customer._id, course._id, price);
      enrollCount += 1;
    }

    await recalcCourseReviewStats(course._id);
  }

  const courseIds = courses.map((c) => c._id);
  const countMap = await countPaidEnrollmentsByCourseIds(courseIds);
  for (const course of courses) {
    const paid = countMap.get(String(course._id)) ?? 0;
    await Course.updateOne(
      { _id: course._id },
      { $set: { "stats.enrollmentCount": paid } },
    );
  }

  const summaryCourses = courses.length;
  const uniqueStudents = await Enrollment.aggregate([
    {
      $match: {
        courseId: { $in: courseIds.map((id) => new mongoose.Types.ObjectId(String(id))) },
        paymentStatus: "paid",
      },
    },
    { $group: { _id: "$userId" } },
    { $count: "total" },
  ]);
  const avgAgg = await Review.aggregate([
    {
      $match: {
        targetType: "course",
        targetId: { $in: courseIds.map((id) => new mongoose.Types.ObjectId(String(id))) },
        isVisible: { $ne: false },
      },
    },
    { $group: { _id: null, avg: { $avg: "$rating" }, n: { $sum: 1 } } },
  ]);

  console.log(`\nĐã seed UI demo cho mentor: ${MENTOR_EMAIL} (${mentorUser.name || ""})`);
  console.log(`- Khóa học: ${summaryCourses}`);
  console.log(`- Đánh giá khóa (upsert): ${reviewCount}`);
  console.log(`- Ghi danh paid (upsert): ${enrollCount}`);
  console.log(`- Học viên unique (paid): ${uniqueStudents[0]?.total ?? 0}`);
  console.log(
    `- Đánh giá TB: ${avgAgg[0]?.n ? Number(avgAgg[0].avg).toFixed(1) : "—"} (${avgAgg[0]?.n ?? 0} review)`,
  );
  console.log("\nĐăng nhập: " + MENTOR_EMAIL + " / Dev123456 → /mentor/courses");
  console.log("Reload trang Khóa học của tôi để xem số liệu.\n");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Seed thất bại:", err?.message || err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

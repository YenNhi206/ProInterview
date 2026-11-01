import "./_devOnlyGuard.js";
/**
 * Seed đánh giá mentor + khóa học cho trang admin / demo.
 * Chạy: npm run seed:reviews (từ thư mục backend)
 */
import "../config/loadEnv.js";
import mongoose from "mongoose";
import { connectDatabase } from "../db/connect.js";
import "../models/index.js";
import { User } from "../models/User.js";
import { Mentor } from "../models/Mentor.js";
import { Course } from "../models/Course.js";
import { Booking } from "../models/Booking.js";
import { Review } from "../models/Review.js";
import { recalcCourseReviewStats, recalcMentorReviewStats } from "../services/reviewsService.js";

const SEED_TAG = "seed-reviews-demo";

async function upsertReview(filter, payload) {
  return Review.findOneAndUpdate(filter, { $set: payload }, { upsert: true, returnDocument: "after" });
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Thiếu MONGO_URI trong backend/.env");
    process.exit(1);
  }

  await connectDatabase(uri);

  const customers = await User.find({ role: "customer" }).limit(5).lean();
  const mentors = await Mentor.find().populate("userId", "name email").limit(5).lean();
  const courses = await Course.find({ status: "published" }).limit(5).lean();

  if (!customers.length) {
    console.error("Không có user role=customer. Chạy npm run seed:users trước.");
    process.exit(1);
  }
  if (!mentors.length) {
    console.error("Không có Mentor. Cần user role=mentor + npm run sync:mentor-profiles");
    process.exit(1);
  }

  const mentorA = mentors[0];
  const mentorB = mentors[1] || mentors[0];
  const c0 = customers[0];
  const c1 = customers[1] || customers[0];
  const courseA = courses[0];
  const courseB = courses[1] || courses[0];

  const completedBooking = await Booking.findOne({
    mentorId: mentorA._id,
    status: "completed",
    userId: c0._id,
  })
    .sort({ updatedAt: -1 })
    .lean();

  const samples = [
    {
      filter: { userId: c0._id, targetType: "mentor", targetId: mentorA._id },
      payload: {
        userId: c0._id,
        targetType: "mentor",
        targetId: mentorA._id,
        bookingId: completedBooking?._id,
        rating: 5,
        comment: "Buổi mock interview rất sát thực tế, mentor góp ý rõ ràng từng câu trả lời.",
        tags: [SEED_TAG, "mock-interview"],
        reply: {
          content: "Cảm ơn bạn. Tiếp tục luyện STAR và system design nhé.",
          repliedAt: new Date(),
        },
        isVerified: true,
        isVisible: true,
      },
    },
    {
      filter: { userId: c1._id, targetType: "mentor", targetId: mentorA._id },
      payload: {
        userId: c1._id,
        targetType: "mentor",
        targetId: mentorA._id,
        bookingId: completedBooking?._id,
        rating: 4,
        comment: "Nội dung tốt, hơi trễ vài phút nhưng phần feedback rất hữu ích.",
        tags: [SEED_TAG, "feedback"],
        isVerified: Boolean(completedBooking?._id),
        isVisible: true,
      },
    },
  ];

  if (courseA) {
    samples.push({
      filter: { userId: c0._id, targetType: "course", targetId: courseA._id },
      payload: {
        userId: c0._id,
        targetType: "course",
        targetId: courseA._id,
        rating: 5,
        comment: `Khóa "${courseA.title}" ngắn gọn, bài tập thực hành phù hợp người đi phỏng vấn.`,
        tags: [SEED_TAG, "course"],
        isVisible: true,
      },
    });
  }
  if (courseB && String(courseB._id) !== String(courseA?._id)) {
    samples.push({
      filter: { userId: c1._id, targetType: "course", targetId: courseB._id },
      payload: {
        userId: c1._id,
        targetType: "course",
        targetId: courseB._id,
        rating: 4,
        comment: `Nội dung khóa "${courseB.title}" hay, nên thêm vài bài quiz cuối chương.`,
        tags: [SEED_TAG, "course"],
        isVisible: true,
      },
    });
  }

  let upserted = 0;
  for (const row of samples) {
    await upsertReview(row.filter, row.payload);
    upserted += 1;
  }

  const mentorIds = await Review.distinct("targetId", { targetType: "mentor" });
  const courseIds = await Review.distinct("targetId", { targetType: "course" });
  for (const mid of mentorIds) await recalcMentorReviewStats(mid);
  for (const cid of courseIds) await recalcCourseReviewStats(cid);

  const total = await Review.countDocuments();
  const mentorCount = await Review.countDocuments({ targetType: "mentor" });
  const courseCount = await Review.countDocuments({ targetType: "course" });

  console.log(`Đã seed/ cập nhật ${upserted} đánh giá demo (${SEED_TAG}).`);
  console.log("Đã đồng bộ stats rating mentor/khóa.");
  console.log(`Tổng reviews trong DB: ${total} (mentor: ${mentorCount}, course: ${courseCount})`);
  console.log("Mở /#/admin/reviews và bấm Làm mới.");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});

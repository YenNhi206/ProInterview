import "./_devOnlyGuard.js";
/**
 * Seed báo cáo / khiếu nại cho trang admin Hỗ trợ.
 * Chạy: npm run seed:reports (từ thư mục backend)
 */
import "../config/loadEnv.js";
import mongoose from "mongoose";
import { connectDatabase } from "../db/connect.js";
import "../models/index.js";
import { User } from "../models/User.js";
import { Mentor } from "../models/Mentor.js";
import { Course } from "../models/Course.js";
import { Booking } from "../models/Booking.js";
import { Report } from "../models/Report.js";

const SEED_TAG = "seed-reports-demo";

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function upsertReport(filter, payload) {
  return Report.findOneAndUpdate(filter, { $set: payload }, { upsert: true, returnDocument: "after" });
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Thiếu MONGO_URI trong backend/.env");
    process.exit(1);
  }

  await connectDatabase(uri);

  const admin = await User.findOne({ role: "admin" }).lean();
  const customers = await User.find({ role: "customer" }).limit(5).lean();
  const mentors = await Mentor.find({ isActive: { $ne: false } }).limit(5).lean();
  const courses = await Course.find({ status: "published" }).limit(5).lean();
  const bookings = await Booking.find().sort({ createdAt: -1 }).limit(8).lean();

  if (!customers.length) {
    console.error("Không có user customer. Chạy: npm run seed:users hoặc npm run seed:all");
    process.exit(1);
  }
  if (!mentors.length) {
    console.error("Không có Mentor. Chạy: npm run sync:mentor-profiles");
    process.exit(1);
  }

  const c0 = customers[0];
  const c1 = customers[1] || c0;
  const c2 = customers[2] || c0;
  const m0 = mentors[0];
  const m1 = mentors[1] || m0;
  const course0 = courses[0];
  const course1 = courses[1] || course0;
  const booking0 = bookings[0];
  const booking1 = bookings[1] || booking0;

  const samples = [
    {
      filter: { reportedBy: c0._id, targetType: "mentor", targetId: m0._id, reason: "no_show" },
      payload: {
        reportedBy: c0._id,
        targetType: "mentor",
        targetId: m0._id,
        reason: "no_show",
        description:
          "Tiêu đề: Mentor không tham gia buổi phỏng vấn\n\nTôi đã vào phòng Jitsi đúng giờ và chờ hơn 15 phút nhưng mentor không xuất hiện. Đã nhắn tin nhưng không có phản hồi.",
        evidenceUrls: [],
        status: "pending",
        resolution: "",
        tags: [SEED_TAG],
        createdAt: daysAgo(0),
      },
    },
    {
      filter: { reportedBy: c1._id, targetType: "mentor", targetId: m1._id, reason: "unprofessional" },
      payload: {
        reportedBy: c1._id,
        targetType: "mentor",
        targetId: m1._id,
        reason: "unprofessional",
        description:
          "Tiêu đề: Thái độ thiếu chuyên nghiệp trong buổi mentor\n\nMentor liên tục trả lời điện thoại cá nhân và kết thúc sớm hơn 20 phút so với lịch đặt. Mong được hỗ trợ hoàn tiền hoặc đổi mentor khác.",
        evidenceUrls: [],
        status: "reviewing",
        resolution: "",
        tags: [SEED_TAG],
        createdAt: daysAgo(1),
      },
    },
    {
      filter: { reportedBy: c2._id, targetType: "mentor", targetId: m0._id, reason: "late" },
      payload: {
        reportedBy: c2._id,
        targetType: "mentor",
        targetId: m0._id,
        reason: "late",
        description:
          "Tiêu đề: Mentor vào muộn 25 phút\n\nBuổi bắt đầu lúc 14:00 nhưng mentor chỉ vào lúc 14:25, không xin lỗi trước. Phần còn lại của buổi bị gấp nên chất lượng kém.",
        evidenceUrls: [],
        status: "pending",
        resolution: "",
        tags: [SEED_TAG],
        createdAt: daysAgo(2),
      },
    },
  ];

  if (booking0) {
    samples.push({
      filter: { reportedBy: c0._id, targetType: "booking", targetId: booking0._id, reason: "other" },
      payload: {
        reportedBy: c0._id,
        targetType: "booking",
        targetId: booking0._id,
        reason: "other",
        description:
          "Tiêu đề: Sai nội dung agenda buổi hẹn\n\nAgenda trên hệ thống ghi mock interview kỹ thuật nhưng mentor lại hỏi chủ yếu về CV. Mong được làm rõ hoặc bù một buổi.\n\n(Booking liên quan: " +
          String(booking0._id) +
          ")",
        evidenceUrls: [],
        status: "reviewing",
        resolution: "",
        tags: [SEED_TAG],
        createdAt: daysAgo(3),
      },
    });
  }

  if (course0) {
    samples.push({
      filter: { reportedBy: c1._id, targetType: "course", targetId: course0._id, reason: "other" },
      payload: {
        reportedBy: c1._id,
        targetType: "course",
        targetId: course0._id,
        reason: "other",
        description: `Tiêu đề: Link tài liệu khóa học bị hỏng\n\nTrong khóa "${course0.title}", bài 3 và bài 5 trỏ tới file PDF không tải được (404). Đã thử trên Chrome và mobile.`,
        evidenceUrls: ["https://example.com/evidence/broken-pdf"],
        status: "resolved",
        resolvedBy: admin?._id,
        resolvedAt: daysAgo(1),
        resolution: "Đã cập nhật lại link tài liệu và thông báo cho học viên qua email.",
        tags: [SEED_TAG],
        createdAt: daysAgo(5),
      },
    });
  }

  if (course1 && String(course1._id) !== String(course0?._id)) {
    samples.push({
      filter: { reportedBy: c2._id, targetType: "course", targetId: course1._id, reason: "inappropriate" },
      payload: {
        reportedBy: c2._id,
        targetType: "course",
        targetId: course1._id,
        reason: "inappropriate",
        description: `Tiêu đề: Nội dung video không phù hợp mô tả khóa\n\nKhóa "${course1.title}" có đoạn video demo không liên quan đến chủ đề đã quảng cáo trên trang chi tiết.`,
        evidenceUrls: [],
        status: "dismissed",
        resolvedBy: admin?._id,
        resolvedAt: daysAgo(2),
        resolution: "Đã rà soát — video thuộc phần giới thiệu tổng quan, không vi phạm chính sách.",
        tags: [SEED_TAG],
        createdAt: daysAgo(7),
      },
    });
  }

  if (booking1 && String(booking1._id) !== String(booking0?._id)) {
    samples.push({
      filter: { reportedBy: c1._id, targetType: "booking", targetId: booking1._id, reason: "fraud" },
      payload: {
        reportedBy: c1._id,
        targetType: "booking",
        targetId: booking1._id,
        reason: "fraud",
        description:
          "Tiêu đề: Nghi ngờ thông tin mentor không trùng hồ sơ\n\nẢnh đại diện và tên trên buổi video khác với hồ sơ public. Cần xác minh danh tính mentor.",
        evidenceUrls: [],
        status: "pending",
        resolution: "",
        tags: [SEED_TAG],
        createdAt: daysAgo(1),
      },
    });
  }

  samples.push({
    filter: { reportedBy: c0._id, targetType: "mentor", targetId: m1._id, reason: "other" },
    payload: {
      reportedBy: c0._id,
      targetType: "mentor",
      targetId: m1._id,
      reason: "other",
      description:
        "Tiêu đề: Yêu cầu hoàn tiền do hủy buổi gấp\n\nMentor hủy buổi trong vòng 2 giờ trước giờ hẹn. Tôi đã sắp xếp lịch nghỉ việc để tham gia. Mong được hoàn 100% phí buổi.",
      evidenceUrls: [],
      status: "resolved",
      resolvedBy: admin?._id,
      resolvedAt: daysAgo(0),
      resolution: "Đã hoàn tiền qua chuyển khoản theo chính sách hủy muộn từ phía mentor.",
      tags: [SEED_TAG],
      createdAt: daysAgo(4),
    },
  });

  let upserted = 0;
  for (const row of samples) {
    await upsertReport(row.filter, row.payload);
    upserted += 1;
  }

  const total = await Report.countDocuments();
  const open = await Report.countDocuments({ status: { $in: ["pending", "reviewing"] } });
  const pending = await Report.countDocuments({ status: "pending" });

  console.log(`Đã seed/cập nhật ${upserted} báo cáo demo (${SEED_TAG}).`);
  console.log(`Tổng reports: ${total} | Đang mở: ${open} | Chờ xử lý: ${pending}`);
  console.log("Mở /#/admin/support (đăng nhập admin) và bấm Làm mới.");

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

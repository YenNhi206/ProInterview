/**
 * LP-06: mỗi ứng viên tối đa 1 buổi 0đ chưa xong và 2 buổi 0đ trong 30 ngày.
 * Nhiều test cũ dùng **một** ứng viên để dựng nhiều yêu cầu / lộ trình (mỗi cái một buổi 0đ). Gọi helper này
 * ngay trước khi dựng buổi 0đ mới để các buổi 0đ trước đó của ứng viên không còn tính vào giới hạn:
 * - buổi còn mở → `cancelled` (giữ nguyên buổi đã xong);
 * - lùi `createdAt` của mọi buổi 0đ ra ngoài cửa sổ 30 ngày.
 * Ghi thẳng qua driver vì Mongoose không cho `$set` `createdAt` khi bật `timestamps`.
 * Không dùng helper này trong test kiểm tra chính giới hạn LP-06.
 */
import mongoose from "mongoose";

const OPEN = ["pending", "confirmed", "in_progress", "rescheduled"];

export async function resetAssessmentQuota(userId) {
  const Booking = mongoose.model("Booking");
  const filter = { userId: new mongoose.Types.ObjectId(String(userId)), sessionType: "assessment" };
  await Booking.collection.updateMany({ ...filter, status: { $in: OPEN } }, { $set: { status: "cancelled", cancelledBy: "system" } });
  await Booking.collection.updateMany(filter, { $set: { createdAt: new Date(Date.now() - 31 * 86_400_000) } });
}

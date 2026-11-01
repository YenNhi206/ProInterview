import { Enrollment } from "../models/Enrollment.js";
import { CartOrder } from "../models/CartOrder.js";
import { Cart } from "../models/Cart.js";

/**
 * Điều kiện bắt buộc để mentor gỡ khóa học (status → "archived").
 * Khóa bán "truy cập trọn đời", nên:
 * - Chưa có học viên → mode "delete": gỡ hẳn khỏi marketplace.
 * - Đã có học viên  → mode "stop_selling": ẩn khỏi marketplace, không nhận mua mới,
 *   học viên cũ vẫn học tiếp (quyền học không phụ thuộc status khóa).
 * Trả về từng điều kiện để UI hiển thị checklist; canArchive = tất cả đều ok.
 */
export async function getCourseArchiveEligibility(course, now = new Date()) {
  const courseId = course._id;

  const [learners, pendingEnrollments, openOrders] = await Promise.all([
    Enrollment.countDocuments({ courseId, paymentStatus: "paid" }),
    Enrollment.countDocuments({ courseId, paymentStatus: "pending", paymentExpiresAt: { $gt: now } }),
    CartOrder.countDocuments({
      "items.courseId": courseId,
      status: { $in: ["preparing", "pending"] },
      paymentExpiresAt: { $gt: now },
    }),
  ]);
  const pendingPayments = Math.max(pendingEnrollments, openOrders);
  const inReview = course.status === "pending_review" || course.status === "pending_update";

  const checks = [
    {
      key: "not_archived",
      ok: course.status !== "archived",
      label: "Khóa học chưa bị gỡ trước đó",
      detail: course.status === "archived" ? "Khóa học đã được gỡ khỏi trang Khám phá." : "",
    },
    {
      key: "not_in_review",
      ok: !inReview,
      label: "Không có yêu cầu đang chờ admin duyệt",
      detail: inReview ? "Hãy đợi admin duyệt xong rồi mới gỡ." : "",
    },
    {
      key: "no_pending_payments",
      ok: pendingPayments === 0,
      label: "Không có giao dịch đang chờ thanh toán",
      detail:
        pendingPayments > 0
          ? `Có ${pendingPayments} giao dịch chưa hoàn tất. Hãy đợi giao dịch thanh toán xong hoặc hết hạn.`
          : "",
    },
  ];

  return {
    canArchive: checks.every((c) => c.ok),
    mode: learners > 0 ? "stop_selling" : "delete",
    learners,
    pendingPayments,
    checks,
  };
}

/** Gỡ khóa đã lưu trữ khỏi giỏ hàng của khách để không ai thanh toán được nữa. */
export async function removeArchivedCourseFromCarts(courseId) {
  await Cart.updateMany({ courseIds: courseId }, { $pull: { courseIds: courseId } });
}

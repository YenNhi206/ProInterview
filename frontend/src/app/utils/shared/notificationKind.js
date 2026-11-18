import { Bell, BookOpen, Briefcase, Building2, CalendarDays, CalendarX2, CreditCard, EyeOff, MessageSquare, Route, ShieldCheck, Sparkles } from "lucide-react";

/**
 * Icon, nhãn và tông màu cho một loại thông báo (`Notification.type` ở backend).
 * Loại mới phải khớp enum trong `backend/src/models/Notification.js` (N-06).
 */
export function notificationKind(type = "") {
  // Loại mới (N-06) đặt trước nhánh `includes("booking")` để không bị nhận nhầm.
  if (type === "learning_path_cancelled") return { icon: Route, label: "Lộ trình", tone: "coral" };
  if (type.startsWith("learning_path")) return { icon: Route, label: "Lộ trình", tone: "violet" };
  if (type === "job_post_hidden") return { icon: EyeOff, label: "Việc làm", tone: "coral" };
  if (type.startsWith("application") || type.startsWith("job_post")) return { icon: Briefcase, label: "Việc làm", tone: "blue" };
  if (type.startsWith("company")) return { icon: Building2, label: "Công ty", tone: "teal" };
  if (type === "rubric_rejected") return { icon: ShieldCheck, label: "Rubric", tone: "coral" };
  if (type.startsWith("rubric")) return { icon: ShieldCheck, label: "Rubric", tone: "green" };
  if (type.startsWith("ai_improvement")) return { icon: Sparkles, label: "Cải tiến AI", tone: "amber" };
  if (type === "booking_cancelled") return { icon: CalendarX2, label: "Lịch hẹn", tone: "coral" };
  if (type.includes("booking")) return { icon: CalendarDays, label: "Lịch hẹn", tone: "violet" };
  if (type.startsWith("payment")) return { icon: CreditCard, label: "Thanh toán", tone: type === "payment_failed" ? "coral" : "green" };
  if (type.startsWith("course") || type === "certificate_ready") return { icon: BookOpen, label: "Khóa học", tone: "blue" };
  if (type === "feedback" || type === "new_review") return { icon: MessageSquare, label: "Nhận xét", tone: "teal" };
  return { icon: Bell, label: "Cập nhật", tone: "amber" };
}

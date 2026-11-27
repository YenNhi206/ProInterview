import {
  CalendarCheck,
  CalendarPlus,
  CalendarX,
  Clock,
  Star,
  ArrowLeftRight,
  Wallet,
  ClipboardCheck,
  UserCheck,
  CreditCard,
  Sparkles,
  FileText,
  UserMinus,
  EyeOff,
  AlertTriangle,
  Briefcase,
  ShieldCheck,
} from "lucide-react";

/**
 * Cài đặt thông báo theo role — khóa phải khớp `backend/src/constants/notificationPrefs.js`.
 * `slice`: nhánh trong `user.notificationPrefs` (GET /me) và body PATCH /me.
 * Chỉ liệt kê loại thông báo role đó thực sự nhận; thông báo không có khóa ở đây luôn được gửi.
 */
const CUSTOMER = {
  slice: "customer",
  groups: [
    {
      id: "appointments",
      title: "Lịch hẹn & Phiên cố vấn",
      subtitle: "Thông báo về phiên cố vấn 1:1 & lịch phỏng vấn",
      icon: CalendarCheck,
      items: [
        { id: "booking_confirmed", label: "Xác nhận lịch hẹn", description: "Khi thanh toán được duyệt và lịch hẹn được xác nhận thành công.", icon: CalendarCheck },
        { id: "interview_reminder", label: "Nhắc trước buổi hẹn", description: "Nhắc qua email và thông báo trước phiên cố vấn khoảng 1 giờ.", icon: Clock },
        { id: "booking_cancelled", label: "Thay đổi hoặc hủy lịch", description: "Cập nhật đổi lịch, hủy lịch và thông tin hoàn tiền từ mentor.", icon: CalendarX },
        { id: "mentor_feedback", label: "Phản hồi từ mentor", description: "Nhận góp ý, đánh giá và nhận xét sau buổi phỏng vấn.", icon: UserCheck },
      ],
    },
    {
      id: "account",
      title: "Luyện tập & Gói tài khoản",
      subtitle: "Nhắc luyện tập cùng Pio AI & gói dịch vụ",
      icon: Star,
      items: [
        { id: "streak_reminder", label: "Nhắc luyện tập AI", description: "Nhắc luyện phỏng vấn cùng Pio AI để duy trì mục tiêu tuần.", icon: Star },
        { id: "plan_expiring", label: "Gói sắp hết hạn", description: "Nhắc trước 7 ngày khi gói Pro hoặc Elite của bạn sắp hết hạn.", icon: CreditCard },
      ],
    },
  ],
};

const MENTOR = {
  slice: "mentor",
  groups: [
    {
      id: "appointments",
      title: "Lịch hẹn & Phiên cố vấn",
      subtitle: "Thông báo về phiên cố vấn 1:1 với học viên",
      icon: CalendarCheck,
      items: [
        { id: "booking_request", label: "Buổi mentor đã thanh toán", description: "Thông báo khi học viên hoàn tất thanh toán đặt lịch.", icon: CalendarPlus },
        { id: "session_reminder", label: "Nhắc buổi mentor sắp tới", description: "Email và thông báo ứng dụng trước phiên cố vấn 1 giờ.", icon: Clock },
        { id: "mentee_review", label: "Đánh giá từ học viên", description: "Học viên gửi nhận xét và chấm điểm sau buổi học với bạn.", icon: Star },
        { id: "booking_change", label: "Đổi hoặc hủy lịch", description: "Học viên yêu cầu đổi lịch hoặc hủy phiên cố vấn.", icon: ArrowLeftRight },
      ],
    },
    {
      id: "finance",
      title: "Tài chính & Khóa học",
      subtitle: "Cập nhật doanh thu & hoạt động mentor",
      icon: Wallet,
      items: [
        { id: "payout_update", label: "Cập nhật tài chính & thu nhập", description: "Thông báo thu nhập, quyết toán và chuyển khoản từ hệ thống.", icon: Wallet },
        { id: "peer_review_course", label: "Đánh giá chéo khóa học", description: "Có khóa học đồng nghiệp cần bạn thực hiện thẩm định.", icon: ClipboardCheck },
      ],
    },
  ],
};

const MODERATOR = {
  slice: "moderator",
  groups: [
    {
      id: "ai-quality",
      title: "Kiểm định & Chất lượng AI",
      subtitle: "Việc cần Platform Moderator xem xét",
      icon: ShieldCheck,
      items: [
        { id: "ai_improvement_proposed", label: "Đề xuất cải tiến AI mới", description: "Khi hệ thống gom đủ lượt kiểm duyệt cùng nhóm và tạo đề xuất sửa prompt chờ bạn duyệt.", icon: Sparkles },
      ],
    },
  ],
};

const COMPANY = {
  slice: "company",
  groups: [
    {
      id: "applications",
      title: "Đơn ứng tuyển",
      subtitle: "Hoạt động của ứng viên với tin tuyển dụng của công ty",
      icon: FileText,
      items: [
        { id: "application_submitted", label: "Đơn ứng tuyển mới", description: "Khi có ứng viên nộp đơn vào tin tuyển dụng của công ty.", icon: FileText },
        { id: "application_withdrawn", label: "Ứng viên rút đơn", description: "Khi ứng viên rút đơn trước khi công ty xử lý.", icon: UserMinus },
      ],
    },
    {
      id: "jobs",
      title: "Tin tuyển dụng",
      subtitle: "Quyết định kiểm duyệt từ Platform Moderator",
      icon: Briefcase,
      items: [
        { id: "job_post_visibility", label: "Tin bị ẩn hoặc hiển thị lại", description: "Khi Platform Moderator ẩn tin do bị báo cáo, hoặc bỏ ẩn tin.", icon: EyeOff },
      ],
    },
  ],
};

const ADMIN = {
  slice: "admin",
  groups: [
    {
      id: "approvals",
      title: "Việc chờ duyệt",
      subtitle: "Hồ sơ và yêu cầu cần Admin xử lý",
      icon: ClipboardCheck,
      items: [
        { id: "mentor_application_submitted", label: "Hồ sơ đăng ký mentor", description: "Khi có hồ sơ mentor mới hoặc hồ sơ được gửi lại, đang chờ duyệt.", icon: UserCheck },
        { id: "payout_requested", label: "Yêu cầu rút tiền của mentor", description: "Khi mentor gửi yêu cầu rút tiền cần duyệt.", icon: Wallet },
      ],
    },
    {
      id: "operations",
      title: "Vận hành buổi hẹn",
      subtitle: "Cảnh báo cần Admin rà soát",
      icon: AlertTriangle,
      items: [
        { id: "booking_stale", label: "Buổi hẹn quá giờ chưa có kết quả", description: "Buổi đã thanh toán quá giờ kết thúc hơn 60 phút mà chưa ghi nhận hoàn thành.", icon: AlertTriangle },
      ],
    },
  ],
};

const BY_ROLE = {
  customer: CUSTOMER,
  mentor: MENTOR,
  moderator: MODERATOR,
  company_moderator: COMPANY,
  enterprise: COMPANY,
  admin: ADMIN,
};

/** Cấu hình thông báo của role; role lạ dùng như Candidate (khớp backend). */
export function notificationConfigForRole(role) {
  return BY_ROLE[role] ?? CUSTOMER;
}

/** Danh sách phẳng `{ id, label, description, icon, value: true }` làm giá trị mặc định. */
export function defaultNotificationItems(config) {
  return config.groups.flatMap((g) => g.items.map((item) => ({ ...item, groupId: g.id, value: true })));
}

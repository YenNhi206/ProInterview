import React, { useMemo } from "react";
import { useAdminNavCounts } from "../../hooks/useAdminNavCounts.js";
import {
  LayoutDashboard,
  Calendar,
  Camera,
  LifeBuoy,
  UserPlus,
  Crown,
  Route,
  BookOpen,
  Banknote,
  Wallet,
  ArrowLeftRight,
  Users,
  Building2,
  GraduationCap,
  FileQuestion,
  Star,
  LineChart,
  User,
  Settings,
} from "lucide-react";
import { WorkspaceNav } from "./WorkspaceNav.jsx";

export const ADMIN_MAIN_NAV = [
  { section: "Vận hành" },
  {
    title: "Lịch hẹn & thanh toán",
    url: "/admin/bookings",
    icon: Calendar,
    customActive: (p) => p.startsWith("/admin/bookings") && !p.startsWith("/admin/bookings/check-ins"),
  },
  { title: "Check-in mentor", url: "/admin/bookings/check-ins", icon: Camera },
  { title: "Hỗ trợ", url: "/admin/support", icon: LifeBuoy },
  { title: "Duyệt cố vấn", url: "/admin/mentors/pending", icon: UserPlus },
  { section: "Đối soát SePay" },
  { title: "Theo dõi gói Pro/Elite", url: "/admin/subscription-payments", icon: Crown },
  { title: "Đối soát lộ trình học", url: "/admin/learning-path-payments", icon: Route },
  { title: "Theo dõi học phí khóa", url: "/admin/course-payments", icon: BookOpen },
  { section: "Tài chính" },
  { title: "Rút tiền cố vấn", url: "/admin/payouts", icon: Banknote },
  { title: "Tổng quan tài chính", url: "/admin/finance", icon: Wallet, end: true },
  { title: "Giải ngân & đối soát", url: "/admin/finance/operations", icon: Banknote },
  { title: "Giao dịch", url: "/admin/transactions", icon: ArrowLeftRight },
  { section: "Người dùng & Đối tác" },
  { title: "Người dùng", url: "/admin/users", icon: Users },
  { title: "Đối tác doanh nghiệp", url: "/admin/companies", icon: Building2 },
  {
    title: "Cố vấn",
    url: "/admin/mentors",
    icon: GraduationCap,
    customActive: (p) => p.startsWith("/admin/mentors") && !p.startsWith("/admin/mentors/pending"),
  },
  { section: "Nội dung & Báo cáo" },
  { title: "Phỏng vấn AI", url: "/admin/content/questions", icon: FileQuestion },
  { title: "Đánh giá", url: "/admin/reviews", icon: Star },
  { title: "Phân tích", url: "/admin/analytics", icon: LineChart },
  { title: "Nhật ký admin", url: "/admin/audit-log", icon: BookOpen },
];

export const ADMIN_SECONDARY_NAV = [
  { title: "Hồ sơ", url: "/profile", icon: User },
  { title: "Cài đặt", url: "/settings", icon: Settings },
];

export function AdminWorkspaceNav() {
  const { pendingMentors, pendingPayouts } = useAdminNavCounts();
  const mainNav = useMemo(
    () =>
      ADMIN_MAIN_NAV.map((item) => {
        if (item.url === "/admin/mentors/pending") {
          return { ...item, count: pendingMentors, countLabel: `${pendingMentors} hồ sơ chờ duyệt` };
        }
        if (item.url === "/admin/payouts") {
          return { ...item, count: pendingPayouts, countLabel: `${pendingPayouts} yêu cầu rút tiền cần xử lý` };
        }
        return item;
      }),
    [pendingMentors, pendingPayouts],
  );
  return (
    <WorkspaceNav
      homeUrl="/admin"
      heading="Quản trị hệ thống"
      badge="ADMIN"
      label="Quản trị"
      mainNav={mainNav}
      secondaryNav={ADMIN_SECONDARY_NAV}
      separatorIndex={-1}
    />
  );
}

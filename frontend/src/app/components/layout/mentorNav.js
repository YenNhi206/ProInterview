import {
  LayoutGrid,
  Calendar,
  GraduationCap,
  ClipboardList,
  CircleDollarSign,
  TrendingUp,
  Star,
  User,
  Settings,
} from "lucide-react";

export const MENTOR_MAIN_NAV = [
  { title: "Bảng điều khiển", url: "/mentor/dashboard", icon: LayoutGrid },
  { title: "Nhu cầu mentee", url: "/mentor/requests", icon: ClipboardList },
  { title: "Lịch họp", url: "/mentor/schedule", icon: Calendar },
  { title: "Khóa học", url: "/mentor/courses", icon: GraduationCap },
  { title: "Đánh giá chéo", url: "/mentor/peer-review", icon: ClipboardList },
  { title: "Tài chính", url: "/mentor/finance", icon: CircleDollarSign },
  { title: "Phân tích", url: "/mentor/analytics", icon: TrendingUp },
  { title: "Đánh giá", url: "/mentor/reviews", icon: Star },
];

export const MENTOR_SECONDARY_NAV = [
  { title: "Hồ sơ", url: "/profile", icon: User },
  { title: "Cài đặt", url: "/settings", icon: Settings },
];

export function isMentorNavActive(pathname, url) {
  if (url === "/mentor/dashboard") return pathname === url;
  return pathname === url || pathname.startsWith(`${url}/`);
}

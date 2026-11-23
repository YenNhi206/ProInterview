import { Inbox, Library, Sliders, BarChart3, GraduationCap, User, Settings } from "lucide-react";
import { WorkspaceNav } from "./WorkspaceNav.jsx";

const MODERATOR_MAIN_NAV = [
  // end: false — `/moderator/queue/:id` vẫn tô sáng mục hàng đợi.
  { title: "Hàng đợi kiểm định", url: "/moderator/queue", icon: Inbox, end: false },
  { title: "Ngân hàng câu hỏi", url: "/moderator/questions", icon: Library },
  { title: "Duyệt Rubric", url: "/moderator/rubrics", icon: Sliders },
  { title: "Chất lượng AI", url: "/moderator/quality", icon: BarChart3 },
  { title: "Duyệt khóa học", url: "/moderator/courses", icon: GraduationCap },
];

const MODERATOR_SECONDARY_NAV = [
  { title: "Hồ sơ", url: "/profile", icon: User },
  { title: "Cài đặt", url: "/settings", icon: Settings },
];

export function ModeratorWorkspaceNav() {
  return (
    <WorkspaceNav
      homeUrl="/moderator/queue"
      heading="Khu Kiểm duyệt"
      badge="MODERATOR"
      label="Kiểm duyệt"
      mainNav={MODERATOR_MAIN_NAV}
      secondaryNav={MODERATOR_SECONDARY_NAV}
      separatorIndex={3}
    />
  );
}

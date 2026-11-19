import { LayoutGrid, FileQuestion, ClipboardList, Briefcase, Users, User, Settings } from "lucide-react";
import { WorkspaceNav } from "./WorkspaceNav.jsx";

/** Role cũ `enterprise` giữ tạm tới khi N-02/N-03 đổi tên và migrate xong — sau đó bỏ khỏi mảng. */
export const COMPANY_ROLES = ["company_moderator", "enterprise"];

export const COMPANY_MAIN_NAV = [
  { title: "Tổng quan", url: "/company/overview", icon: LayoutGrid },
  { title: "Câu hỏi phỏng vấn", url: "/company/questions", icon: FileQuestion },
  { title: "Rubric chấm điểm", url: "/company/rubrics", icon: ClipboardList },
  { title: "Tin tuyển dụng", url: "/company/jobs", icon: Briefcase },
  { title: "Đơn ứng tuyển", url: "/company/applications", icon: Users },
];

const COMPANY_SECONDARY_NAV = [
  { title: "Hồ sơ", url: "/profile", icon: User },
  { title: "Cài đặt", url: "/settings", icon: Settings },
];

export function CompanyWorkspaceNav() {
  return (
    <WorkspaceNav
      homeUrl="/company/overview"
      heading="Không gian Công ty"
      label="Doanh nghiệp"
      mainNav={COMPANY_MAIN_NAV}
      secondaryNav={COMPANY_SECONDARY_NAV}
      separatorIndex={3}
    />
  );
}

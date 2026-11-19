import React from "react";
import { Link } from "react-router";
import { ArrowRight, ClipboardList, FileQuestion, Briefcase, Users } from "lucide-react";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";

/**
 * Các trang khu vực /company. Hiện là khung (chưa có API `/api/company/*`), không hiển số liệu giả —
 * mỗi trang ghi rõ task sẽ nối dữ liệu để nhóm biết làm tiếp ở đâu.
 * Bố cục theo trang mentor (MentorReviews): MentorPageShell + tiêu đề font-headline + glass-card.
 */
function CompanyPage({ title, accent, subtitle, children }) {
  return (
    <MentorPageShell bottomPad="pb-20" showAmbient={false} className="bg-transparent">
      <div className="relative z-10 mx-auto max-w-[1280px] px-4 pb-12 sm:px-6 lg:px-10">
        <header className="mb-6 pt-2 sm:mb-8">
          <h1 className="font-headline text-[clamp(1.75rem,4vw,2.75rem)] font-black leading-tight tracking-tight text-slate-900">
            {title} {accent ? <span className="text-[#8037f4]">{accent}</span> : null}
          </h1>
          {subtitle ? <p className="mt-2 max-w-xl text-sm text-slate-500">{subtitle}</p> : null}
        </header>
        {children}
      </div>
    </MentorPageShell>
  );
}

function PendingState({ icon: Icon, title, description, task }) {
  return (
    <section className="glass-card flex flex-col items-center px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-violet-50 text-[#8037f4]">
        <Icon className="size-6" aria-hidden />
      </span>
      <h2 className="mt-4 text-base font-bold text-slate-900">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>
      <span className="mt-4 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
        Đang phát triển · {task}
      </span>
    </section>
  );
}

const SECTIONS = [
  {
    to: "/company/questions",
    icon: FileQuestion,
    title: "Câu hỏi phỏng vấn",
    description: "Sinh bộ câu nháp theo vị trí, duyệt, sửa hoặc từ chối trước khi ứng viên luyện tập.",
  },
  {
    to: "/company/rubrics",
    icon: ClipboardList,
    title: "Rubric chấm điểm",
    description: "Định nghĩa tiêu chí riêng của công ty, gắn với khung SHRM/DDI, gửi Platform Moderator duyệt.",
  },
  {
    to: "/company/jobs",
    icon: Briefcase,
    title: "Tin tuyển dụng",
    description: "Đăng và đóng tin với năng lực yêu cầu và rubric áp dụng.",
  },
  {
    to: "/company/applications",
    icon: Users,
    title: "Đơn ứng tuyển",
    description: "Xem CV, hồ sơ năng lực đã xác thực và điểm theo rubric; shortlist hoặc từ chối.",
  },
];

export function CompanyOverview() {
  return (
    <CompanyPage
      title="Tổng quan"
      accent="doanh nghiệp"
      subtitle="Đóng góp tiêu chí đánh giá của công ty và tuyển ứng viên trên ProInterview."
    >
      {/* Thứ tự thẻ = thứ tự công việc của HR: câu hỏi → rubric → đăng tin → xét đơn. */}
      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map(({ to, icon: Icon, title, description }, index) => (
          <Link
            key={to}
            to={to}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur-sm transition-colors duration-200 hover:border-[#93f72b]/60 hover:bg-white/[0.08] focus-visible:border-[#93f72b] sm:p-7"
          >
            <span
              className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-[#93f72b]/10 blur-2xl transition-opacity duration-200 group-hover:opacity-100 sm:opacity-60"
              aria-hidden
            />
            <div className="relative flex items-start justify-between gap-3">
              <span className="flex size-12 items-center justify-center rounded-xl border border-[#93f72b]/35 bg-[#93f72b]/15 text-[#93f72b]">
                <Icon className="size-6" strokeWidth={1.8} aria-hidden />
              </span>
              <span className="font-headline text-3xl font-black leading-none text-white/10 transition-colors group-hover:text-[#93f72b]/40">
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>
            <h2 className="relative mt-5 text-lg font-bold text-white">{title}</h2>
            <p className="relative mt-1.5 flex-1 text-sm leading-relaxed text-slate-300">{description}</p>
            <span className="relative mt-5 inline-flex w-fit items-center gap-1.5 rounded-lg border border-[#93f72b]/40 bg-[#93f72b]/10 px-3 py-1.5 text-xs font-semibold text-[#b9ff6e] transition-colors group-hover:border-[#93f72b] group-hover:bg-[#93f72b] group-hover:text-[#17210b]">
              Mở {title.toLowerCase()}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        ))}
      </div>
    </CompanyPage>
  );
}

export function CompanyQuestions() {
  return (
    <CompanyPage title="Câu hỏi" accent="phỏng vấn" subtitle="Bộ câu hỏi riêng của công ty theo từng vị trí.">
      <PendingState
        icon={FileQuestion}
        title="Chưa có câu hỏi"
        description="Bạn sẽ sinh bộ câu nháp 8–12 câu theo vị trí, rồi duyệt, sửa hoặc từ chối từng câu tại đây."
        task="CO-13"
      />
    </CompanyPage>
  );
}

export function CompanyRubrics() {
  return (
    <CompanyPage title="Rubric" accent="chấm điểm" subtitle="Tiêu chí riêng của công ty, cần Platform Moderator duyệt trước khi dùng.">
      <PendingState
        icon={ClipboardList}
        title="Chưa có rubric"
        description="Soạn tiêu chí, trọng số, năng lực SHRM tương ứng và mô tả thang 0–5, sau đó gửi duyệt."
        task="CO-14"
      />
    </CompanyPage>
  );
}

export function CompanyJobs() {
  return (
    <CompanyPage title="Tin" accent="tuyển dụng" subtitle="Đăng và quản lý tin tuyển dụng của công ty.">
      <PendingState
        icon={Briefcase}
        title="Chưa có tin tuyển dụng"
        description="Đăng tin với năng lực yêu cầu, kỹ năng, rubric áp dụng và ngày đóng."
        task="JB-15"
      />
    </CompanyPage>
  );
}

export function CompanyApplications() {
  return (
    <CompanyPage title="Đơn" accent="ứng tuyển" subtitle="Ứng viên đã nộp đơn và đồng ý chia sẻ hồ sơ.">
      <PendingState
        icon={Users}
        title="Chưa có đơn ứng tuyển"
        description="Đơn sẽ hiện khi ứng viên ứng tuyển vào tin của công ty kèm sự đồng ý chia sẻ dữ liệu."
        task="JB-16"
      />
    </CompanyPage>
  );
}

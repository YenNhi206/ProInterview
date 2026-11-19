import React from "react";
import { Briefcase, Users, Clock } from "lucide-react";

export function CompanyJobsPlaceholder() {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-12 text-center backdrop-blur-xl">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400">
        <Briefcase className="size-7" />
      </div>
      <h2 className="mt-4 text-xl font-bold text-white">Quản lý Tin tuyển dụng (Job Post)</h2>
      <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
        Tính năng thuộc Giai đoạn 4: Đăng tin tuyển dụng, gắn Rubric đánh giá năng lực và tự động lọc ứng viên.
      </p>
      <div className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-400">
        <Clock className="size-3.5" /> Giai đoạn 4 (Task JB-15)
      </div>
    </div>
  );
}

export function CompanyApplicationsPlaceholder() {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-12 text-center backdrop-blur-xl">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
        <Users className="size-7" />
      </div>
      <h2 className="mt-4 text-xl font-bold text-white">Quản lý Đơn ứng tuyển</h2>
      <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
        Tính năng thuộc Giai đoạn 4: Xem danh sách ứng viên có consent chia sẻ CV, hồ sơ năng lực xác thực và điểm chấm Rubric từ AI.
      </p>
      <div className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-400">
        <Clock className="size-3.5" /> Giai đoạn 4 (Task JB-16)
      </div>
    </div>
  );
}

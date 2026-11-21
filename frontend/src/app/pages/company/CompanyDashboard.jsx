import React, { useState, useEffect } from "react";
import { Link } from "react-router";
import {
  FileQuestion,
  Sliders,
  Briefcase,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  Plus,
  Sparkles,
  Layers,
  ShieldCheck,
  Building2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { companyApi } from "../../api/companyApi.js";
import { toastApiError } from "../../utils/shared/apiToast.js";

export function CompanyDashboard() {
  const [stats, setStats] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [profileRes, statsRes] = await Promise.all([
        companyApi.getProfile(),
        companyApi.getDashboardStats(),
      ]);

      if (profileRes.success) setCompany(profileRes.company);
      if (statsRes.success) setStats(statsRes.stats);
    } catch (err) {
      toastApiError(err, "Không thể tải dữ liệu bảng điều khiển.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-8">
      {/* Top Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-900 p-6 sm:p-8 backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
              <Building2 className="size-3.5" />
              {company?.name || "Doanh nghiệp đối tác"}
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Không gian quản trị tuyển dụng
            </h1>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              Quản lý bộ câu hỏi chuẩn hóa, rubric chấm điểm AI độc quyền và theo dõi các ứng viên tiềm năng ứng tuyển vào doanh nghiệp của bạn.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/company/questions"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500"
            >
              <FileQuestion className="size-4" />
              Ngân hàng câu hỏi
            </Link>
            <Link
              to="/company/rubrics"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-700 hover:text-white"
            >
              <Sliders className="size-4" />
              Quản lý Rubric
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Tổng câu hỏi
            </span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
              <FileQuestion className="size-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">
              {stats?.questions?.total ?? 0}
            </span>
            <span className="text-xs text-slate-400">câu trong kho</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs border-t border-slate-800/80 pt-2.5 text-slate-400">
            <span>Đã duyệt: <strong className="text-emerald-400">{stats?.questions?.approved ?? 0}</strong></span>
            <span>Bản nháp: <strong className="text-amber-400">{stats?.questions?.draft ?? 0}</strong></span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Rubric đánh giá
            </span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
              <Sliders className="size-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">
              {stats?.rubrics?.approved ?? 0}
            </span>
            <span className="text-xs text-emerald-400 font-medium">Đã được phê duyệt</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs border-t border-slate-800/80 pt-2.5 text-slate-400">
            <span>Đang chờ duyệt:</span>
            <strong className="text-amber-400">{stats?.rubrics?.pending ?? 0}</strong>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Tin tuyển dụng
            </span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
              <Briefcase className="size-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">0</span>
            <span className="text-xs text-slate-400">vị trí mở</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs border-t border-slate-800/80 pt-2.5 text-slate-400">
            <span>Giai đoạn 4</span>
            <span className="text-indigo-400 hover:underline">Sắp ra mắt</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Đơn ứng tuyển
            </span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <Users className="size-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">0</span>
            <span className="text-xs text-slate-400">ứng viên</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs border-t border-slate-800/80 pt-2.5 text-slate-400">
            <span>Đã đồng ý chia sẻ CV</span>
            <span className="text-emerald-400">100% consent</span>
          </div>
        </div>
      </div>

      {/* Workflow & Quick Setup Guide */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/40 p-6 sm:p-8 backdrop-blur-xl">
        <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <Sparkles className="size-5 text-indigo-400" />
          Quy trình thiết lập chuẩn hóa phỏng vấn
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Thực hiện theo 3 bước sau để bắt đầu tuyển dụng nhân sự chất lượng cao:
        </p>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-600/20 text-xs font-bold text-indigo-400">
                  01
                </span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                  Bước đầu
                </span>
              </div>
              <h3 className="mt-3 font-semibold text-white text-base">Chuẩn bị ngân hàng câu hỏi</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Tự tạo câu hỏi đặc thù hoặc bấm nút "Sinh bộ câu hỏi mẫu" để hệ thống tự tạo bộ câu hỏi technical chuẩn cho công ty bạn.
              </p>
            </div>
            <Link
              to="/company/questions"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
            >
              Vào ngân hàng câu hỏi <ArrowRight className="size-3.5" />
            </Link>
          </div>

          {/* Step 2 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex size-8 items-center justify-center rounded-lg bg-violet-600/20 text-xs font-bold text-violet-400">
                  02
                </span>
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                  Chấm điểm AI
                </span>
              </div>
              <h3 className="mt-3 font-semibold text-white text-base">Soạn Rubric đánh giá</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Định nghĩa các tiêu chí năng lực, mức thang điểm 0–5 và đảm bảo tổng trọng số đúng 100%. Gửi Platform Mod thẩm định.
              </p>
            </div>
            <Link
              to="/company/rubrics"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300"
            >
              Tạo Rubric mới <ArrowRight className="size-3.5" />
            </Link>
          </div>

          {/* Step 3 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="flex size-8 items-center justify-center rounded-lg bg-blue-600/20 text-xs font-bold text-blue-400">
                  03
                </span>
                <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                  Tuyển dụng
                </span>
              </div>
              <h3 className="mt-3 font-semibold text-white text-base">Đăng tin & Chấm ứng viên</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Đăng tin tuyển dụng kèm Rubric. Ứng viên luyện phỏng vấn trước khi nộp hồ sơ, AI tự trích dẫn bằng chứng chấm điểm.
              </p>
            </div>
            <Link
              to="/company/jobs"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300"
            >
              Quản lý tin tuyển dụng <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

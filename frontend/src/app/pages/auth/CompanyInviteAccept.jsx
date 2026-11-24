import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import {
  Building2,
  Lock,
  User,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { companyApi } from "../../api/companyApi.js";
import { setLoggedIn } from "../../utils/auth/auth.js";
import { toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";

const TOKEN_KEY = "prointerview_access_token";

export function CompanyInviteAccept() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [verifying, setVerifying] = useState(true);
  const [inviteData, setInviteData] = useState(null);
  const [verifyError, setVerifyError] = useState("");

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // CO-02: đồng ý điều khoản dùng rubric ẩn danh (bắt buộc để nhận lời mời)
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function checkToken() {
      if (!token) {
        setVerifyError("Thiếu mã lời mời xác thực.");
        setVerifying(false);
        return;
      }
      try {
        const res = await companyApi.verifyInvite(token);
        if (!mounted) return;
        if (res.success) {
          setInviteData({ ...res.invite, terms: res.terms });
        } else {
          setVerifyError(res.error || "Mã lời mời không hợp lệ hoặc đã hết hạn.");
        }
      } catch (err) {
        if (!mounted) return;
        setVerifyError("Không thể xác thực mã lời mời. Vui lòng kiểm tra lại liên kết.");
      } finally {
        if (mounted) setVerifying(false);
      }
    }

    checkToken();
    return () => {
      mounted = false;
    };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toastApiError("Vui lòng nhập họ và tên.");
      return;
    }
    if (!acceptTerms) {
      toastApiError("Bạn cần đồng ý điều khoản dùng rubric ẩn danh để nhận lời mời.");
      return;
    }
    if (password.length < 6) {
      toastApiError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }
    if (password !== confirmPassword) {
      toastApiError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await companyApi.acceptInvite({
        token,
        name: name.trim(),
        password,
        acceptRubricTerms: true,
        termsVersion: inviteData?.terms?.version,
      });

      if (res.success && res.user && res.token) {
        localStorage.setItem(TOKEN_KEY, res.token);
        setLoggedIn(res.user);
        toastApiSuccess("Kích hoạt tài khoản thành công! Đang chuyển hướng...");
        setTimeout(() => {
          navigate("/company");
        }, 1000);
      } else {
        toastApiError(res.error || "Không thể kích hoạt tài khoản.");
      }
    } catch (err) {
      toastApiError(err, "Có lỗi xảy ra khi chấp nhận lời mời.");
    } finally {
      setSubmitting(false);
    }
  };

  if (verifying) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0d12] px-4 text-slate-100">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="size-8 animate-spin text-indigo-500" />
          <p className="text-sm text-slate-400">Đang kiểm tra thông tin lời mời...</p>
        </div>
      </div>
    );
  }

  if (verifyError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0d12] px-4 text-slate-100">
        <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-slate-900/80 p-8 text-center backdrop-blur-xl shadow-2xl">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400">
            <AlertCircle className="size-8" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-white">Lời mời không hợp lệ</h2>
          <p className="mt-2 text-sm text-slate-400">{verifyError}</p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500"
            >
              Về trang đăng nhập
            </Link>
            <Link
              to="/"
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              Trang chủ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const company = inviteData?.company || {};
  const email = inviteData?.email || "";
  const terms = inviteData?.terms;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b0c10] px-4 py-12 text-slate-100 selection:bg-indigo-500 selection:text-white">
      <div className="relative w-full max-w-lg">
        {/* Glow accent */}
        <div className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-indigo-600/20 blur-3xl" />

        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20">
              <Building2 className="size-7" />
            </div>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
              <ShieldCheck className="size-3.5" />
              Company Moderator Invite
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Tham gia {company.name || "Doanh nghiệp"}
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Bạn được mời quản lý ngân hàng câu hỏi, rubric đánh giá và tuyển dụng của doanh nghiệp trên ProInterview.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {/* Email disabled */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Email nhận lời mời
              </label>
              <div className="relative mt-1.5">
                <input
                  type="text"
                  value={email}
                  disabled
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-2.5 text-sm text-slate-400 cursor-not-allowed"
                />
                <span className="absolute right-3 top-2.5 text-xs text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" /> Xác thực
                </span>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Họ và tên của bạn
              </label>
              <div className="relative mt-1.5">
                <User className="pointer-events-none absolute left-3.5 top-3 size-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Nguyễn Văn A"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Mật khẩu đăng nhập
              </label>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute left-3.5 top-3 size-4 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Tối thiểu 6 ký tự"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Xác nhận mật khẩu
              </label>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute left-3.5 top-3 size-4 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Nhập lại mật khẩu"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* CO-02: điều khoản dùng rubric ẩn danh (quyết định AI-18) */}
            {terms && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{terms.title}</p>
                <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-slate-300">
                  {terms.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                <label className="mt-3 flex items-start gap-2.5 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    required
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 accent-indigo-500"
                  />
                  <span>Tôi đồng ý thay mặt {company.name || "doanh nghiệp"} với điều khoản trên.</span>
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !acceptTerms}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Đang kích hoạt tài khoản...
                </>
              ) : (
                <>
                  Hoàn tất và vào Không gian làm việc
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-800 pt-4 text-center">
            <p className="text-xs text-slate-500">
              Đã có tài khoản?{" "}
              <Link to="/login" className="font-semibold text-indigo-400 hover:text-indigo-300">
                Đăng nhập
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

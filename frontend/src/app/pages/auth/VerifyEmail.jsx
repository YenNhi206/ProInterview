import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { AuthShell } from "../../components/auth/AuthShell.jsx";
import { useWorkspaceTheme } from "../../hooks/useWorkspaceTheme.js";
import { verifyEmail } from "../../utils/auth/auth.js";
import { toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";

const BRAND_LIME = "#93f72b";

const AUTH_CTA_STYLE = {
  background: BRAND_LIME,
  color: "#0f172a",
  boxShadow: "0 4px 14px rgba(147, 247, 43, 0.12)",
};

export function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => (searchParams.get("token") || "").trim(), [searchParams]);

  const theme = useWorkspaceTheme(true);
  const light = theme.resolved === "light";

  const [status, setStatus] = useState("loading"); // loading, success, error
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Thiếu token xác thực. Vui lòng kiểm tra lại đường dẫn trong email.");
      return;
    }

    const doVerify = async () => {
      const res = await verifyEmail(token);
      if (res.success) {
        setStatus("success");
        const okMsg = res.message || "Xác thực email thành công!";
        setMessage(okMsg);
        toastApiSuccess(okMsg);
      } else {
        setStatus("error");
        const errMsg = res.error || "Xác thực thất bại hoặc token đã hết hạn.";
        setMessage(errMsg);
        toastApiError(errMsg);
      }
    };

    doVerify();
  }, [token]);

  const cardClass = light
    ? "w-full max-w-md rounded-3xl border border-[#ddd3f5] bg-white/95 p-8 shadow-[0_24px_64px_rgba(124,58,237,0.08)] sm:p-10 text-center backdrop-blur-xl"
    : "w-full max-w-md rounded-3xl border border-[#a998d0]/25 bg-[#211a36] p-8 shadow-[0_24px_64px_rgba(5,3,18,0.35)] sm:p-10 text-center text-white";

  return (
    <AuthShell
      headerRight={
        <Link
          to="/login"
          className={`text-xs sm:text-sm font-semibold transition-colors ${
            light ? "text-[#6d28d9] hover:text-[#5b21b6]" : "text-violet-300 hover:text-white"
          }`}
        >
          Đăng nhập
        </Link>
      }
    >
      <div className={cardClass}>
        {status === "loading" && (
          <div className="flex flex-col items-center py-8">
            <Loader2 className="h-12 w-12 text-[#8037f4] animate-spin mb-4" />
            <h1 className={`text-2xl font-black mb-2 ${light ? "text-[#1e1338]" : "text-white"}`}>
              Đang xác thực...
            </h1>
            <p className={`text-sm ${light ? "text-[#5e5875]" : "text-white/80"}`}>
              Vui lòng đợi trong giây lát khi chúng tôi xác nhận email của bạn.
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center py-6">
            <div
              className={`h-20 w-20 rounded-full flex items-center justify-center mb-6 ${
                light ? "bg-emerald-100 text-emerald-600" : "bg-emerald-500/20 text-[#93f72b]"
              }`}
            >
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h1 className={`text-2xl sm:text-3xl font-black mb-3 ${light ? "text-emerald-950" : "text-emerald-300"}`}>
              Xác thực thành công!
            </h1>
            <p className={`text-sm mb-8 leading-relaxed ${light ? "text-[#5e5875]" : "text-white/80"}`}>
              Email của bạn đã được xác minh. Bây giờ bạn đã có thể đăng nhập và trải nghiệm đầy đủ các tính năng của ProInterview.
            </p>
            <Link
              to="/login"
              className="w-full inline-flex items-center justify-center rounded-full py-3.5 text-base font-bold transition-all hover:brightness-105 active:scale-[0.98]"
              style={AUTH_CTA_STYLE}
            >
              Đăng nhập ngay
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center py-6">
            <div className="h-20 w-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
              <AlertCircle className="h-10 w-10 text-red-500" />
            </div>
            <h1 className={`text-2xl sm:text-3xl font-black mb-3 ${light ? "text-red-950" : "text-red-300"}`}>
              Opps! Lỗi rồi
            </h1>
            <p className="text-red-500 mb-8 leading-relaxed text-sm font-medium">
              {message}
            </p>
            <div className="space-y-3 w-full">
              <Link
                to="/forgot-password"
                className="w-full inline-flex items-center justify-center rounded-full py-3.5 text-base font-bold transition-all hover:brightness-105 active:scale-[0.98]"
                style={AUTH_CTA_STYLE}
              >
                Gửi lại yêu cầu
              </Link>
              <Link
                to="/"
                className={`w-full inline-flex items-center justify-center rounded-full py-3.5 text-sm font-semibold transition-all ${
                  light
                    ? "border border-[#ddd3f5] bg-white text-slate-700 hover:bg-slate-50"
                    : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                }`}
              >
                Về trang chủ
              </Link>
            </div>
          </div>
        )}
      </div>
    </AuthShell>
  );
}

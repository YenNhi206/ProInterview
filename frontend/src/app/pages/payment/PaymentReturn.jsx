import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ArrowRight, 
  ShieldCheck, 
  Receipt,
  Calendar,
  CreditCard,
  AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { refreshUserProfile } from "../../utils/auth/auth.js";
import { apiUrl } from "../../api/http.js";
import { formatVnd } from "../../utils/shared/formatVnd.js";

export function PaymentReturn() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading, success, failure, error
  const [details, setDetails] = useState({
    amount: "0",
    orderId: "",
    transNo: "",
    date: ""
  });

  useEffect(() => {
    // VNPay sometimes appends params BEFORE the hash: ?vnp_...#/payment-return
    // and sometimes AFTER the hash: #/payment-return?vnp_...
    const urlParams = new URLSearchParams(window.location.search);
    const combinedParams = new URLSearchParams({
      ...Object.fromEntries(urlParams.entries()),
      ...Object.fromEntries(searchParams.entries())
    });

    const responseCode = combinedParams.get("vnp_ResponseCode");
    const amountVal = combinedParams.get("vnp_Amount");
    const amount = amountVal ? formatVnd(Number(amountVal) / 100) : formatVnd(0);
    const orderId = combinedParams.get("vnp_TxnRef");
    const transNo = combinedParams.get("vnp_BankTranNo") || combinedParams.get("vnp_TransactionNo");
    const payDate = combinedParams.get("vnp_PayDate");
    
    const formattedDate = payDate ? `${payDate.slice(6,8)}/${payDate.slice(4,6)}/${payDate.slice(0,4)} ${payDate.slice(8,10)}:${payDate.slice(10,12)}` : "";

    setDetails({ amount, orderId, transNo, date: formattedDate });

    const timer = setTimeout(async () => {
      if (responseCode === "00") {
        // Chủ động gọi backend để verify và cập nhật database ngay lập tức (Xử lý vấn đề localhost không nhận được IPN)
        try {
          // Gửi toàn bộ query params sang backend để verify hash và cập nhật trạng thái
          const verifyRes = await fetch(apiUrl(`/api/payments/vnpay/vnpay-return?${combinedParams.toString()}`));
          const verifyData = await verifyRes.json();
          if (verifyData.success) {
             console.log("Xác thực và cập nhật database thành công.");
          }
        } catch (e) {
          console.error("Lỗi khi xác thực tự động:", e);
          toastApiError("Không xác thực được giao dịch trên server. Kiểm tra email hoặc liên hệ hỗ trợ.");
        }

        try {
          await refreshUserProfile();
        } catch {
          /* profile refresh best-effort */
        }
        navigate("/payment-success", { state: { details }, replace: true });
      } else if (["24", "99", "07", "09", "10", "11", "51", "65"].includes(responseCode)) {
        navigate("/payment-failure", { state: { error: getVnpayErrorMsg(responseCode) }, replace: true });
      } else {
        navigate("/payment-failure", { state: { error: "Có lỗi xảy ra trong quá trình xác thực." }, replace: true });
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [searchParams]);


  const getVnpayErrorMsg = (code) => {
    const errors = {
      "24": "Bạn đã hủy giao dịch thanh toán.",
      "51": "Tài khoản của bạn không đủ số dư để thực hiện giao dịch.",
      "65": "Giao dịch vượt quá hạn mức thanh toán trong ngày.",
      "11": "Giao dịch hết hạn chờ thanh toán.",
      "09": "Thẻ/Tài khoản chưa đăng ký dịch vụ Internet Banking.",
      "10": "Xác thực thông tin thẻ/tài khoản không đúng quá 3 lần.",
      "99": "Có lỗi xảy ra trong quá trình xử lý thanh toán tại VNPay."
    };
    return errors[code] || "Giao dịch không thành công. Vui lòng thử lại sau.";
  };

  return (
    <div className="pi-page-dashboard-bg relative min-h-screen flex items-center justify-center overflow-hidden p-6 font-sans antialiased text-white">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] right-[-10%] h-[60vh] w-[60vh] rounded-full bg-fuchsia-600/20 blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] h-[60vh] w-[60vh] rounded-full bg-[#93f72b]/10 blur-[120px]" />

      <AnimatePresence mode="wait">
        <motion.div 
          key={status}
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          className="relative z-10 w-full max-w-lg"
        >
          <div className="glass-card p-10 md:p-12 text-center shadow-[0_32px_80px_rgba(0,0,0,0.5)] border border-white/10 backdrop-blur-3xl overflow-hidden">
             
             {/* Header Section */}
             <div className="mb-10">
                {status === "loading" && (
                   <div className="relative inline-block">
                      <Loader2 className="w-20 h-20 text-[#93f72b] animate-spin mb-6" />
                      <div className="absolute inset-0 bg-[#93f72b]/20 blur-2xl rounded-full" />
                   </div>
                )}
                
                {status === "success" && (
                   <div className="relative inline-block mb-3">
                      <div className="w-24 h-24 bg-emerald-500/20 rounded-[32px] flex items-center justify-center border border-emerald-500/30 scale-110">
                        <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                      </div>
                      <div className="absolute inset-x-0 -bottom-2 h-4 bg-emerald-500/40 blur-xl rounded-full" />
                   </div>
                )}

                {status === "failure" && (
                   <div className="relative inline-block">
                      <div className="w-24 h-24 bg-amber-500/20 rounded-[32px] flex items-center justify-center border border-amber-500/30">
                        <AlertTriangle className="w-12 h-12 text-amber-400" />
                      </div>
                      <div className="absolute inset-x-0 -bottom-2 h-4 bg-amber-500/40 blur-xl rounded-full" />
                   </div>
                )}

                {status === "error" && (
                   <div className="relative inline-block">
                      <div className="w-24 h-24 bg-red-500/20 rounded-[32px] flex items-center justify-center border border-red-500/30">
                        <XCircle className="w-12 h-12 text-red-500" />
                      </div>
                      <div className="absolute inset-x-0 -bottom-2 h-4 bg-red-500/40 blur-xl rounded-full" />
                   </div>
                )}

                <h1 className="text-3xl md:text-4xl font-black tracking-tighter mt-6 lowercase first-letter:uppercase">
                   {status === "loading" && "Đang xác thực..."}
                   {status === "success" && <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent uppercase font-black">Thanh toán Thành công!</span>}
                   {status === "failure" && <span className="text-amber-400 uppercase font-black">Giao dịch bị Hủy</span>}
                   {status === "error" && <span className="text-red-500 uppercase font-black">Lỗi Thanh toán</span>}
                </h1>
                <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em] mt-3">
                   {status === "loading" ? "Vui lòng giữ kết nối" : "VNPay Digital Gateway"}
                </p>
             </div>

             {/* Details Section */}
             {(status === "success" || status === "failure") && (
                <div className="space-y-3 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-both">
                   <div className="bg-white/[0.03] border border-white/[0.08] rounded-3xl p-6 text-left">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-4 flex items-center gap-2">
                         <Receipt size={12} /> Chi tiết giao dịch
                      </p>
                      
                      <div className="space-y-4">
                         <div className="flex justify-between items-end border-b border-white/[0.05] pb-3">
                            <span className="text-[10px] font-bold text-white/40 uppercase">Số tiền</span>
                            <span className="text-xl font-black text-[#93f72b]">{details.amount}</span>
                         </div>
                         <div className="flex justify-between items-center text-xs">
                            <span className="text-white/40 font-medium">Mã đơn hàng</span>
                            <span className="font-bold text-white/80">{details.orderId}</span>
                         </div>
                         {details.transNo && (
                           <div className="flex justify-between items-center text-xs">
                              <span className="text-white/40 font-medium">Mã giao dịch</span>
                              <span className="font-mono text-white/80 text-[10px]">{details.transNo}</span>
                           </div>
                         )}
                         <div className="flex justify-between items-center text-xs">
                            <span className="text-white/40 font-medium">Thời gian</span>
                            <span className="text-white/80">{details.date}</span>
                         </div>
                      </div>
                   </div>
                   
                   {status === "failure" && (
                     <div className="px-6 py-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-4">
                        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                        <p className="text-[11px] text-amber-100/70 text-left font-bold lowercase first-letter:uppercase leading-relaxed">
                           {getVnpayErrorMsg(searchParams.get("vnp_ResponseCode"))}
                        </p>
                     </div>
                   )}
                </div>
             )}

             {/* Action Buttons */}
             <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-500 fill-mode-both">
                {status === "success" ? (
                   <button
                      onClick={() => navigate("/")}
                      className="group relative flex h-16 items-center justify-center gap-3 overflow-hidden rounded-[24px] bg-[#93f72b] font-black text-black transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_10px_40px_rgba(196,255,71,0.25)]"
                   >
                      <span className="text-[10px] uppercase tracking-[0.25em]">Về trang chủ</span>
                      <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                   </button>
                ) : (
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <button
                        onClick={() => navigate("/pricing")}
                        className="h-14 rounded-2xl bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/20 transition-all font-sans"
                      >
                        Thử lại
                      </button>
                      <button
                        onClick={() => navigate("/")}
                        className="h-14 rounded-2xl bg-white/5 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all font-sans"
                      >
                        Quay về Trang chủ
                      </button>
                   </div>
                )}
             </div>

             {/* Footer Footer */}
             <div className="mt-12 flex items-center justify-center gap-6 text-white/20 border-t border-white/5 pt-8">
                <div className="flex items-center gap-2">
                   <ShieldCheck size={14} className="text-[#93f72b]" />
                   <span className="text-[8px] font-black uppercase tracking-widest">Bảo mật SSL 256-bit</span>
                </div>
                <div className="flex items-center gap-2">
                   <CreditCard size={14} />
                   <span className="text-[8px] font-black uppercase tracking-widest">Hỗ trợ 24/7</span>
                </div>
             </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <style>{`
        .glass-card {
           background: linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%);
           backdrop-filter: blur(48px);
           border-radius: 40px;
           position: relative;
        }
        .pi-page-dashboard-bg {
           background-color: #07060E;
        }
      `}</style>
    </div>
  );
}

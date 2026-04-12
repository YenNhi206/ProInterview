import React, { useState } from "react";
import { useNavigate } from "react-router";
import { 
  CheckCircle2, 
  Sparkles as Sparkle, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Brain,
  Video,
  FileText,
  Users
} from "lucide-react";
import { Footer } from "../../components/layout/Footer";

const FAQ_DATA = [
  {
    q: "Gói Phổ thông (Pro) và Cao cấp (Elite) khác nhau như thế nào?",
    a: "Gói Chuyên nghiệp (Pro) cung cấp 10 buổi phỏng vấn AI mỗi tháng và các tính năng phân tích cơ bản. Gói Thượng hạng (Elite) cung cấp số buổi không giới hạn, phân tích hành vi nâng cao qua camera và ưu tiên kết nối với các mentor hàng đầu."
  },
  {
    q: "Tôi có thể hủy gói đăng ký bất cứ lúc nào không?",
    a: "Có, bạn có thể hủy gia hạn gói bất cứ lúc nào trong phần Cài đặt tài khoản. Bạn vẫn sẽ giữ được quyền lợi của gói cho đến hết chu kỳ thanh toán hiện tại."
  },
  {
    q: "Mentor của ProInterview là ai?",
    a: "Đội ngũ Mentor của chúng tôi là các chuyên gia HR, Senior Engineer và Manager đang làm việc tại các tập đoàn hàng đầu như Shopee, Vingroup, FPT, và các công ty Big 4."
  },
  {
    q: "Làm sao để nhận được hoàn tiền?",
    a: "Chúng tôi cam kết hoàn tiền 100% trong vòng 7 ngày nếu bạn không hài lòng với chất lượng dịch vụ và chưa sử dụng quá 2 buổi phỏng vấn AI."
  }
];

export function Pricing() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(null);

  const toggleFaq = (i) => setOpenFaq(openFaq === i ? null : i);

  return (
    <div className="min-h-screen bg-[#120B2E] text-white selection:bg-primary-fixed selection:text-[#120B2E]">
      <style>{`
        .glass-card {
           background: rgba(255, 255, 255, 0.03);
           backdrop-filter: blur(20px);
           border-radius: 24px;
           border: 1px solid rgba(255, 255, 255, 0.08);
           transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .glass-card:hover {
           border-color: rgba(255, 255, 255, 0.15);
           background: rgba(255, 255, 255, 0.05);
           transform: translateY(-8px);
        }
        .glow-purple {
          box-shadow: 0 0 40px rgba(110, 53, 232, 0.15);
        }
        .glow-lime {
          box-shadow: 0 0 40px rgba(180, 245, 0, 0.15);
        }
      `}</style>

      {/* Atmospheric Background Glows */}
      <div className="fixed top-0 right-0 w-[800px] h-[800px] bg-secondary/10 blur-[180px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none -z-0"></div>
      <div className="fixed bottom-0 left-0 w-[800px] h-[800px] bg-primary-fixed/5 blur-[180px] rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none -z-0"></div>

      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-[#07060E]/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-center px-5">
        <div className="max-w-7xl w-full flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate("/")}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-[#6E35E8] to-[#9B6DFF]">
              <Sparkle className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-[1.05rem] tracking-tight">ProInterview</span>
          </div>
          
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-xs font-semibold text-white/60 hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Quay lại
          </button>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative pt-24 pb-16 px-5 text-center z-10 overflow-hidden">
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.05]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)",
          backgroundSize: "40px 40px"
        }} />
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sparkle className="text-primary-fixed size-5" />
            <span className="text-secondary font-bold uppercase tracking-[0.2em] text-xs">Premium Access</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter leading-none text-white mb-4 whitespace-nowrap">
            Đầu tư cho sự nghiệp <span className="text-primary-fixed">Xứng đáng.</span>
          </h1>
          <p className="text-lg text-white/50 max-w-2xl mx-auto leading-relaxed mb-0">
            Chọn gói dịch vụ phù hợp để mở khóa toàn bộ tính năng phân tích CV,
            phỏng vấn AI không giới hạn và kết nối trực tiếp với Mentor.
          </p>
        </div>
      </section>

      {/* ── Pricing Grid ── */}
      <section className="px-5 pb-32 z-10 relative">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Free Tier */}
            <div className="glass-card p-10 flex flex-col h-full border-white/5 group">
              <div className="mb-10">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:bg-white/10 transition-colors">
                  <Brain className="w-6 h-6 text-white/40" />
                </div>
                <h3 className="text-2xl font-black mb-2">Cơ bản (Free)</h3>
                <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-6">Trải nghiệm miễn phí</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black">0đ</span>
                  <span className="text-white/30 text-sm font-bold">/tháng</span>
                </div>
              </div>

              <ul className="space-y-5 mb-12 flex-grow">
                {[
                  "2 buổi AI Interview trải nghiệm",
                  "3 lần phân tích CV/JD chi tiết",
                  "10 câu hỏi mẫu theo ngành nghề",
                  "Truy cập cộng đồng Career Hub"
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-white/60">
                    <CheckCircle2 className="w-4 h-4 text-secondary flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <button 
                onClick={() => navigate("/register")}
                className="w-full py-4 rounded-2xl border border-white/10 text-white font-black text-xs uppercase tracking-widest hover:bg-white/5 transition-all active:scale-[0.98]"
              >
                Bắt đầu ngay
              </button>
            </div>

            {/* Pro Tier (Popular) */}
            <div className="glass-card p-10 flex flex-col h-full border-primary-fixed/30 bg-primary-fixed/5 glow-lime relative scale-105 z-20 overflow-hidden">
              <div className="absolute top-0 right-0 py-2 px-8 bg-primary-fixed text-black text-[10px] font-black uppercase tracking-widest translate-x-[30%] translate-y-[100%] rotate-45">
                Popular
              </div>
              
              <div className="mb-10">
                <div className="w-12 h-12 rounded-2xl bg-primary-fixed flex items-center justify-center mb-6 shadow-lg shadow-primary-fixed/20">
                  <Zap className="w-6 h-6 text-black" />
                </div>
                <h3 className="text-2xl font-black mb-2 text-primary-fixed">Chuyên nghiệp (Pro)</h3>
                <p className="text-primary-fixed/60 text-xs font-bold uppercase tracking-widest mb-6">Dành cho ứng viên chủ động</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black text-white">79.000đ</span>
                  <span className="text-white/30 text-sm font-bold">/tháng</span>
                </div>
              </div>

              <ul className="space-y-5 mb-12 flex-grow">
                {[
                  "10 buổi AI Interview / tháng",
                  "Công nghệ nhận diện giọng nói AI",
                  "20 lượt phân tích CV/JD chuyên sâu",
                  "Phản hồi AI chi tiết từng câu trả lời",
                  "Lịch sử luyện tập 12 tháng"
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-white font-bold">
                    <CheckCircle2 className="w-5 h-5 text-primary-fixed flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <button 
                onClick={() => navigate("/checkout?plan=starterPro&billing=monthly&planPrice=79000")}
                className="w-full py-5 rounded-2xl bg-primary-fixed text-black font-black text-xs uppercase tracking-widest shadow-xl shadow-primary-fixed/10 hover:brightness-110 transition-all active:scale-[0.98]"
              >
                Nâng cấp Pro
              </button>
            </div>

            {/* Elite Tier */}
            <div className="glass-card p-10 flex flex-col h-full border-secondary/20 shadow-xl shadow-secondary/5 group">
              <div className="mb-10">
                <div className="w-12 h-12 rounded-2xl bg-secondary/20 flex items-center justify-center mb-6 border border-secondary/30">
                  <ShieldCheck className="w-6 h-6 text-secondary" />
                </div>
                <h3 className="text-2xl font-black mb-2 text-secondary">Thượng hạng (Elite)</h3>
                <p className="text-secondary/60 text-xs font-bold uppercase tracking-widest mb-6">Chinh phục Big Corporations</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black text-white">99.000đ</span>
                  <span className="text-white/30 text-sm font-bold">/tháng</span>
                </div>
              </div>

              <ul className="space-y-5 mb-12 flex-grow">
                {[
                  "AI Interview KHÔNG GIỚI HẠN",
                  "Phân tích hành vi & tư thế qua Camera",
                  "Nhận diện giọng nói Turbo (độ trễ thấp)",
                  "Mentor ưu tiên hỗ trợ 24/7",
                  "Tải báo cáo bản PDF chuyên nghiệp"
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-white font-bold">
                    <CheckCircle2 className="w-5 h-5 text-secondary flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <button 
                onClick={() => navigate("/checkout?plan=elitePro&billing=monthly&planPrice=99000")}
                className="w-full py-4 rounded-2xl border border-secondary/40 text-secondary font-black text-xs uppercase tracking-widest hover:bg-secondary/10 transition-all active:scale-[0.98]"
              >
                Nâng cấp Elite
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ Section ── */}
      <section className="px-5 py-32 bg-white/2 relative z-10">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black tracking-tight mb-4 text-white">Câu hỏi thường gặp</h2>
            <p className="text-white/40">Mọi thứ bạn cần biết về gói và quyền lợi của mình.</p>
          </div>

          <div className="space-y-4">
            {FAQ_DATA.map((item, i) => (
              <div 
                key={i} 
                className={`glass-card p-6 cursor-pointer border-white/5 transition-all ${openFaq === i ? "bg-white/5" : ""}`}
                onClick={() => toggleFaq(i)}
              >
                <div className="flex items-center justify-between gap-4">
                  <h4 className="font-bold text-lg text-white/90">{item.q}</h4>
                  {openFaq === i ? <ChevronUp className="w-5 h-5 text-primary-fixed" /> : <ChevronDown className="w-5 h-5 text-white/20" />}
                </div>
                {openFaq === i && (
                  <div className="mt-4 pt-4 border-t border-white/5 text-white/50 leading-relaxed text-sm animate-fade-in">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="px-5 py-32 z-10 relative">
        <div className="max-w-5xl mx-auto glass-card p-12 lg:p-20 text-center border-primary-fixed/20 glow-lime overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-full bg-primary-fixed/5 opacity-50"></div>
          <div className="relative z-10">
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-8 text-white">Sẵn sàng để tỏa sáng?</h2>
            <p className="text-white/40 mb-12 max-w-xl mx-auto text-lg leading-relaxed">
              Gia nhập cùng 10,000+ ứng viên đã thành công có được công việc mơ ước với lộ trình từ ProInterview.
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-6">
              <button 
                onClick={() => navigate("/register")}
                className="bg-primary-fixed text-black font-black px-12 py-5 rounded-2xl text-lg hover:scale-105 transition-all active:scale-[0.98] shadow-2xl shadow-primary-fixed/20"
              >
                Bắt đầu miễn phí
              </button>
              <button 
                onClick={() => navigate("/mentors")}
                className="px-10 py-5 rounded-2xl text-white/60 font-bold hover:text-white transition-colors"
              >
                Hoặc tìm Mentor chuyên gia
              </button>
            </div>
          </div>
        </div>
      </section>

      <Footer variant="dark" />
    </div>
  );
}

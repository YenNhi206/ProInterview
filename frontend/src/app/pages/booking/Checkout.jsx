import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router";
import {
  ArrowLeft,
  Sparkles as Sparkle,
  Sparkles,
  Check,
  CheckCircle,
  CheckCircle2,
  Lock,
  ShieldCheck,
  CreditCard,
  BadgeCheck as SealCheck,
  AlertCircle as Warning,
  Tag,
  Phone,
  Copy,
  Calendar,
  Clock,
  Video,
  Users,
  Chrome as GoogleLogo,
  ExternalLink as ArrowSquareOut,
  ArrowRight,
} from "lucide-react";
import { setActivePlan, activateAllPlans } from "../utils/auth";
import { fetchMentor } from "../utils/mentorApi";
import { MENTORS } from "../data/mockData";
import { saveBooking, genMeetLink } from "../utils/bookings";

/* ─── Plan meta ─────────────────────────────────────────── */

const PLANS = {
  starterPro: {
    name: "Pro",
    tagline: "Luyện tập nghiêm túc",
    monthlyPrice: 79000,
    yearlyPrice: 63000,
    badge: "PHỔ BIẾN",
    accentColor: "#6E35E8",
    features: ["10 buổi AI phỏng vấn/tháng", "AI nhận dạng giọng nói", "20 lần phân tích CV/JD/tháng", "Phản hồi chi tiết từng câu", "Xuất kết quả PDF"],
  },
  elitePro: {
    name: "Elite",
    tagline: "Chinh phục mọi vòng phỏng vấn",
    monthlyPrice: 99000,
    yearlyPrice: 79000,
    badge: "TỐT NHẤT",
    accentColor: "#c4ff47",
    features: ["AI phỏng vấn không giới hạn", "AI nhận dạng giọng nói — Turbo 2×", "CV/JD phân tích không giới hạn", "Phân tích hành vi: Giao tiếp mắt, Tư thế", "Phân tích giọng nói: Tốc độ, Từ đệm", "Mentor 1-1 ưu tiên"],
  },
};

function fmt(n) {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}

/* ─── CopyBtn ────────────────────────────────────────────── */
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg transition-all"
      style={{ background: copied ? "rgba(16,185,129,0.1)" : "#F3F4F6", color: copied ? "#10b981" : "#6B7280" }}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Đã sao chép" : "Sao chép"}
    </button>
  );
}

/* ─── Mock QR ────────────────────────────────────────────── */
function MockQR({ color }) {
  const pattern = [
    [1,1,1,1,1,1,1,0,1,0,0,1,0,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,0,1,1,0,1,0,1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,0,1,0,0,1,0,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,0,1,1,0,1,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,1,0,0,1,0,0,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,0,1,0,1,1,0,1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,1,0,0,1,0,1,0,0,0,0,0,0,0],
    [0,1,1,0,1,0,1,1,0,1,1,0,1,0,0,1,1,0,1,0,1],
    [1,0,0,1,0,0,0,0,1,0,0,1,1,0,1,0,0,1,0,1,0],
    [0,1,0,0,1,1,1,1,0,1,1,0,0,1,0,1,0,0,1,0,1],
    [1,0,1,1,0,0,0,0,1,0,0,1,0,0,1,0,1,1,0,1,0],
    [0,1,1,0,1,1,1,0,0,1,1,0,1,1,0,1,1,0,1,1,1],
    [0,0,0,0,0,0,0,0,1,1,0,1,0,0,0,1,0,0,0,1,0],
    [1,1,1,1,1,1,1,0,0,0,1,0,1,0,1,0,1,0,0,1,1],
    [1,0,0,0,0,0,1,0,1,1,0,1,0,1,0,1,0,1,1,0,1],
    [1,0,1,1,1,0,1,0,0,0,1,0,1,0,1,0,0,0,1,0,0],
    [1,0,1,1,1,0,1,1,1,1,0,1,0,1,0,1,1,1,0,1,1],
    [1,0,1,1,1,0,1,0,1,0,1,0,0,1,1,0,0,0,1,0,0],
    [1,0,0,0,0,0,1,0,0,1,0,1,1,0,0,1,1,1,0,1,1],
    [1,1,1,1,1,1,1,0,1,0,1,0,0,1,1,0,0,0,1,0,1],
  ];
  return (
    <div className="inline-block p-3 card-premium">
      <div style={{ display: "grid", gridTemplateColumns: `repeat(21, 1fr)`, gap: "1.5px" }}>
        {pattern.flat().map((cell, i) => (
          <div key={i} style={{ width: 9, height: 9, borderRadius: 1, background: cell ? color : "transparent" }} />
        ))}
      </div>
    </div>
  );
}

/* ─── Step indicator ─────────────────────────────────────── */
const STEPS = ["THÔNG TIN", "THANH TOÁN", "XÁC NHẬN"];

function StepBar({ current }) {
  return (
    <div className="flex items-center justify-center mb-12">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-3">
              {/* Circle */}
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-lg ${
                  done 
                    ? "bg-secondary text-white shadow-secondary/20" 
                    : active 
                    ? "bg-primary-fixed text-on-primary-fixed shadow-primary-fixed/20 scale-110" 
                    : "bg-white/5 text-white/20 border border-white/5"
                }`}
              >
                {done ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : active ? (
                  <Sparkles className="w-5 h-5" />
                ) : (
                   <span className="text-[10px] font-black">{i + 1}</span>
                )}
              </div>
              {/* Label */}
              <span
                className={`text-[10px] font-black tracking-[0.2em] uppercase transition-colors duration-500 ${
                  done || active ? "text-primary-fixed" : "text-white/20"
                }`}
              >
                {label}
              </span>
            </div>
            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div
                className={`h-px mx-6 mb-8 w-12 md:w-20 rounded-full transition-all duration-700 ${
                  i < current ? "bg-gradient-to-r from-secondary to-primary-fixed" : "bg-white/5"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────── */

export function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  /* ── Booking vs Plan mode ─────────────────────────────── */
  const isBooking = searchParams.get("type") === "booking";
  const mentorId = searchParams.get("mentorId") ?? "";
  const [bookingMentor, setBookingMentor] = React.useState(() =>
    mentorId ? MENTORS.find((m) => m.id === mentorId) ?? null : null
  );

  React.useEffect(() => {
    if (!isBooking || !mentorId) return;
    setBookingMentor(MENTORS.find((m) => m.id === mentorId) ?? null);
    fetchMentor(mentorId).then((m) => {
      if (m) setBookingMentor(m);
    });
  }, [isBooking, mentorId]);

  const bookingPrice = Number(searchParams.get("price") ?? bookingMentor?.price ?? 0);
  const bookingDate = searchParams.get("date") ?? "";
  const bookingTime = searchParams.get("time") ?? "";

  /* ── Plan mode ────────────────────────────────────────── */
  const planKey = searchParams.get("plan") ?? "starterPro";
  const billing = (searchParams.get("billing") ?? "yearly");
  const plan = PLANS[planKey] ?? PLANS.starterPro;
  // Read the exact price shown on the Pricing page (passed via URL); fall back to PLANS data
  const urlPlanPrice = Number(searchParams.get("planPrice") ?? "0");
  const price = urlPlanPrice > 0
    ? urlPlanPrice
    : (billing === "yearly" ? plan.yearlyPrice : plan.monthlyPrice);
  const baseTotal = isBooking ? bookingPrice : plan.monthlyPrice;
  const total = isBooking ? bookingPrice : price; // never multiply by 12 — price is always the per-period amount shown on the card

  const orderNum = useMemo(() => `PI${Math.floor(Math.random() * 900000 + 100000)}`, []);
  const meetLink = useMemo(() => genMeetLink(orderNum), [orderNum]);

  /* ── Read all booking params from URL ── */
  const bookingPosition = searchParams.get("position") ?? "";
  const bookingNote = searchParams.get("note") ?? "";
  const bookingCvFile = searchParams.get("cvFile") || null;
  const bookingJdFile = searchParams.get("jdFile") || null;

  const [method, setMethod] = useState("visa");
  const [appStep, setAppStep] = useState("checkout");
  const [progress, setProgress] = useState(0);

  /* Card form state */
  const [cardNum, setCardNum] = useState("");
  const [cardName, setCardName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [savedCard, setSavedCard] = useState(null);
  const [cardError, setCardError] = useState("");

  /* Coupon */
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const discount = couponApplied ? Math.round(total * 0.1) : 0;

  /* Processing */
  useEffect(() => {
    if (appStep !== "processing") return;
    setProgress(0);
    const iv = setInterval(() => setProgress((p) => Math.min(p + 2, 100)), 40);
    const tm = setTimeout(() => {
      clearInterval(iv);
      if (!isBooking) {
        if (planKey === "all") activateAllPlans();
        else if (["textPro", "voicePro", "cvPro"].includes(planKey)) setActivePlan(planKey );
        else if (["starterPro", "elitePro"].includes(planKey)) setActivePlan(planKey );
      } else if (bookingMentor) {
        // Save booking via unified utility
        const endTime = bookingTime
          ? String(parseInt(bookingTime.split(":")[0]) + 1).padStart(2, "0") + ":00"
          : "";
        saveBooking({
          orderNum,
          mentorId: bookingMentor.id,
          mentorName: bookingMentor.name,
          mentorTitle: bookingMentor.title,
          mentorCompany: bookingMentor.company,
          mentorAvatar: bookingMentor.avatar,
          date: bookingDate,
          time: bookingTime,
          endTime,
          price: bookingPrice,
          meetLink,
          position: bookingPosition,
          note: bookingNote,
          cvFile: bookingCvFile,
          jdFile: bookingJdFile,
          status: "confirmed",
        });
      }
      setAppStep("success");
    }, 2600);
    return () => { clearInterval(iv); clearTimeout(tm); };
  }, [appStep, planKey, isBooking]);

  const handlePay = () => {
    if (method === "visa" && !savedCard) {
      if (cardNum.replace(/\s/g, "").length < 16) return setCardError("Số thẻ không hợp lệ");
      if (!cardName.trim()) return setCardError("Vui lòng nhập tên chủ thẻ");
      if (expiry.length < 5) return setCardError("Ngày hết hạn không hợp lệ");
      if (cvv.length < 3) return setCardError("CVV không hợp lệ");
      setCardError("");
    }
    setAppStep("processing");
  };

  /* ── Success ── */
  if (appStep === "success") {
    return (
      <div className="min-h-screen bg-[#07060E] text-white relative overflow-hidden flex items-center justify-center p-6">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-secondary/10 blur-[150px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary-fixed/5 blur-[150px] rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

        <div className="max-w-xl w-full text-center fade-in relative z-10">
          <div className="w-24 h-24 rounded-[32px] bg-primary-fixed flex items-center justify-center mx-auto mb-8 shadow-[0_20px_50px_rgba(196, 255, 71,0.3)] scale-110">
            <SealCheck className="w-12 h-12 text-black" />
          </div>

          <h1 className="text-4xl font-black tracking-tighter text-white mb-4">Payment Success 🎉</h1>
          <p className="text-white/40 text-sm mb-12">Your order <span className="font-black text-white">#{orderNum}</span> has been confirmed and activated.</p>

          <div className="glass-panel p-8 mb-12 text-left relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-fixed/5 blur-3xl rounded-full"></div>
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6 text-primary-fixed" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-1">Active Plan</p>
                <p className="text-xl font-black text-white">
                  {isBooking ? `1-1 with ${bookingMentor?.name ?? "mentor"}` : plan.name}
                </p>
                <p className="text-[10px] font-bold text-primary-fixed mt-1">Status: Active ✓</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => navigate("/dashboard")} 
              className="px-10 h-14 rounded-full bg-primary-fixed text-black font-black uppercase tracking-widest text-xs shadow-[0_10px_30px_rgba(196, 255, 71,0.2)] hover:scale-105 transition-all"
            >
              Go to Dashboard →
            </button>
            <button 
              onClick={() => window.location.href = "/"} 
              className="px-10 h-14 rounded-full bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all"
            >
              Back Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Processing ── */
  if (appStep === "processing") {
    return (
      <div className="min-h-screen bg-[#07060E] flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-secondary/10 blur-[150px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="text-center max-w-sm w-full fade-in relative z-10">
          <div className="w-24 h-24 rounded-[32px] bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-8 relative group">
            <div className="absolute inset-0 rounded-[32px] bg-primary-fixed/20 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <svg className="absolute inset-0 w-full h-full -rotate-90 scale-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
              <circle cx="50" cy="50" r="45" fill="none" stroke="#c4ff47" strokeWidth="6"
                strokeDasharray="282.7"
                strokeDashoffset={282.7 * (1 - progress / 100)}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.1s linear" }}
              />
            </svg>
            <Lock className="w-8 h-8 text-primary-fixed relative z-10" />
          </div>
          <h2 className="text-2xl font-black tracking-tighter text-white mb-2">Securing Payment</h2>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-8">Please do not close this window</p>
          
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-gradient-to-r from-secondary to-primary-fixed transition-all duration-300 shadow-[0_0_20px_rgba(196, 255, 71,0.5)]" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[10px] font-black tracking-[0.2em] text-primary-fixed">{progress}% COMPLETE</p>
        </div>
      </div>
    );
  }

  /* ── Checkout UI ── */
  const momoRef = `PI_MOMO_${orderNum}`;
  const vnpayRef = `VNPAY_${orderNum}`;

  const methodTabs = [
    { id: "visa", label: "Thẻ quốc tế", sub: "Visa / Mastercard" },
    { id: "momo", label: "MoMo", sub: "Ví điện tử" },
    { id: "vnpay", label: "VNPay", sub: "Internet Banking" },
  ];

  return (
    <div className="min-h-screen bg-[#07060E] text-white overflow-x-hidden">
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .fade-in { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .card-input { 
          background: rgba(255,255,255,0.03); 
          border: 1px solid rgba(255,255,255,0.08); 
          border-radius: 12px; 
          padding: 12px 16px; 
          font-size: 0.9rem; 
          width: 100%; 
          color: white; 
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .card-input:focus { 
          outline: none; 
          border-color: #c4ff47; 
          background: rgba(255,255,255,0.06);
          box-shadow: 0 0 20px rgba(196, 255, 71,0.1);
        }
        .card-input::placeholder { color: rgba(255,255,255,0.2); }
        .glass-panel {
          background: rgba(255,255,255,0.03);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
        }
      `}</style>

      {/* Atmospheric Background Glows */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-secondary/10 blur-[150px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary-fixed/5 blur-[150px] rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

      {/* ── Navbar ── */}
      <div className="sticky top-6 z-50 px-4">
        <nav className="mx-auto flex justify-between items-center px-6 lg:px-8 h-14 rounded-full w-full max-w-6xl border border-white/10 bg-black/60 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center gap-2.5 flex-shrink-0 cursor-pointer" onClick={() => navigate("/")}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#6E35E8] to-[#9B6DFF] flex-shrink-0 shadow-lg">
              <Sparkle className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-[1.05rem] tracking-tight whitespace-nowrap">ProInterview</span>
          </div>
          
          <div className="flex items-center gap-4 lg:gap-6 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 whitespace-nowrap">
              <Phone className="w-3 h-3 text-primary-fixed" />
              <span>Support: 1800 1234</span>
            </div>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/60 hover:text-white transition-colors whitespace-nowrap"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>
        </nav>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* ── Step bar ── */}
        <StepBar current={1} />

        <div className="lg:flex gap-6 items-start">

          {/* ══ LEFT PANEL ══ */}
          <div className="flex-1 mb-6 lg:mb-0">
            <div className="glass-panel overflow-hidden shadow-2xl">
              {/* Account info bar */}
              <div className="flex items-center justify-between px-8 py-4 border-b border-white/5 bg-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-[#c4ff47] flex items-center justify-center shadow-[0_0_20px_rgba(196, 255, 71,0.2)]">
                    <span className="text-sm font-black text-black">U</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-0.5">Account Info</p>
                    <p className="text-sm font-bold text-white">user@prointerview.vn</p>
                  </div>
                </div>
                <button className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-fixed hover:text-white transition-colors">Change</button>
              </div>

              <div className="p-8">
                {/* Payment method heading */}
                <h2 className="text-2xl font-black tracking-tighter text-white mb-8">
                  Choose payment method
                </h2>

                {/* Method tabs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  {methodTabs.map((m) => {
                    const active = method === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => { setMethod(m.id); setCardError(""); setSavedCard(null); }}
                        className={`group relative flex flex-col items-center justify-center py-6 rounded-3xl transition-all duration-500 gap-2 border ${
                          active 
                            ? "bg-white/10 border-primary-fixed shadow-[0_0_30px_rgba(196, 255, 71,0.1)] scale-[1.02] z-10" 
                            : "bg-white/5 border-white/5 hover:border-white/20"
                        }`}
                      >
                        {/* Method icon */}
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-2 transition-all duration-500 ${
                          active ? "bg-primary-fixed text-black" : "bg-white/5 text-white/40 group-hover:bg-white/10"
                        }`}>
                          {m.id === "visa" && <CreditCard className="w-6 h-6" />}
                          {m.id === "momo" && <span className="text-sm font-black italic">M</span>}
                          {m.id === "vnpay" && <span className="text-[10px] font-black italic">VNP</span>}
                        </div>
                        
                        <div className="text-center">
                          <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${active ? "text-primary-fixed" : "text-white/40"}`}>{m.label}</p>
                          <p className="text-[10px] text-white/20 font-medium">{m.sub}</p>
                        </div>

                        {active && (
                          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary-fixed rounded-full flex items-center justify-center shadow-lg border-4 border-[#07060E]">
                            <CheckCircle2 className="w-3 h-3 text-black" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Pay button */}
                <button
                  onClick={handlePay}
                  className="w-full h-16 rounded-3xl font-black text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 mb-8 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl"
                  style={{
                    background: method === "momo" ? "linear-gradient(135deg,#A50064,#D4007A)"
                      : method === "vnpay" ? "linear-gradient(135deg,#0060AC,#003D7A)"
                      : "linear-gradient(135deg,#6E35E8,#9B6DFF)",
                    boxShadow: "0 20px 40px rgba(110,53,232,0.3)",
                  }}
                >
                  <Lock className="w-5 h-5" />
                  Pay {fmt(total - discount)}
                </button>

                {/* ── VISA: saved cards + card form ── */}
                {method === "visa" && (
                  <div className="fade-in space-y-6">
                    {/* Saved cards */}
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-4">Saved Cards</p>
                      <div className="space-y-3">
                        {[
                          { id: "mc-1420", brand: "MC", num: "1420", color: "#EB001B" },
                          { id: "visa-2020", brand: "VISA", num: "2020", color: "#1A1F71" },
                        ].map((card) => (
                          <label
                            key={card.id}
                            className={`flex items-center gap-4 px-6 py-4 rounded-2xl cursor-pointer transition-all border ${
                              savedCard === card.id ? "bg-white/10 border-primary-fixed" : "bg-white/5 border-white/5 hover:border-white/10"
                            }`}
                          >
                            <input
                              type="radio"
                              name="savedCard"
                              checked={savedCard === card.id}
                              onChange={() => setSavedCard(card.id)}
                              className="w-4 h-4 accent-primary-fixed"
                            />
                            <span
                              className="text-[10px] font-black px-2 py-0.5 rounded bg-white/5 border border-white/10"
                              style={{ color: card.color }}
                            >
                              {card.brand}
                            </span>
                            <span className="text-sm text-white/60 font-mono tracking-widest flex-1">
                              XXXX – {card.num}
                            </span>
                             {savedCard === card.id && <CheckCircle2 className="w-4 h-4 text-primary-fixed" />}
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* OR divider */}
                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-px bg-white/5" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">OR NEW CARD</span>
                      <div className="flex-1 h-px bg-white/5" />
                    </div>

                    {/* Card form */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">Card Number</label>
                        <div className="relative">
                          <input
                            className="card-input pr-12"
                            placeholder="0000 0000 0000 0000"
                            value={cardNum}
                            maxLength={19}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/\D/g, "").slice(0, 16);
                              setCardNum(raw.replace(/(.{4})/g, "$1 ").trim());
                              setCardError(""); setSavedCard(null);
                            }}
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <CreditCard className={`w-5 h-5 ${cardNum.replace(/\s/g,"").length === 16 ? "text-primary-fixed" : "text-white/20"}`} />
                          </div>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">Card Holder Name</label>
                        <input
                          className="card-input"
                          placeholder="EX: NGUYEN VAN A"
                          value={cardName}
                          onChange={(e) => { setCardName(e.target.value.toUpperCase()); setCardError(""); setSavedCard(null); }}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">Expiry Date</label>
                        <input
                          className="card-input"
                          placeholder="MM/YY"
                          value={expiry}
                          maxLength={5}
                          onChange={(e) => {
                            let v = e.target.value.replace(/\D/g, "").slice(0, 4);
                            if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
                            setExpiry(v); setCardError(""); setSavedCard(null);
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">CVC / CVV</label>
                        <input
                          className="card-input"
                          placeholder="•••"
                          value={cvv}
                          maxLength={4}
                          type="password"
                          onChange={(e) => { setCvv(e.target.value.replace(/\D/g, "").slice(0, 4)); setCardError(""); setSavedCard(null); }}
                        />
                      </div>
                    </div>

                    {cardError && (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold">
                        <Warning className="w-4 h-4" />
                        {cardError}
                      </div>
                    )}
                  </div>
                )}

                {/* ── MoMo panel ── */}
                {method === "momo" && (
                  <div className="fade-in">
                    <div className="rounded-3xl p-8 mb-6 bg-[#A50064]/5 border border-[#A50064]/20 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[#A50064]/10 blur-3xl rounded-full"></div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A50064] mb-6 text-center">Scan QR code via MoMo app</p>
                      <div className="flex justify-center mb-8"><MockQR color="#A50064" /></div>
                      
                      <div className="space-y-4">
                        {[
                          { label: "Momo Phone", value: "0901 234 567", copy: true },
                          { label: "Account Name", value: "PROINTERVIEW CORP", copy: false },
                          { label: "Amount", value: fmt(total - discount), copy: true },
                          { label: "Reference", value: momoRef, copy: true },
                        ].map((r) => (
                          <div key={r.label} className="flex items-center justify-between gap-4 py-3 border-b border-[#A50064]/10">
                            <div>
                              <p className="text-[8px] font-black uppercase tracking-widest text-[#A50064]/60 mb-1">{r.label}</p>
                              <p className="text-sm font-bold text-white">{r.value}</p>
                            </div>
                            {r.copy && <CopyBtn text={r.value} />}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-start gap-4 px-6 py-4 rounded-2xl bg-white/5 border border-white/5 text-[10px] font-bold text-white/40">
                      <Warning className="w-4 h-4 text-primary-fixed flex-shrink-0" />
                      Please include the Reference code in your transfer for instant activation.
                    </div>
                  </div>
                )}

                {/* ── VNPay panel ── */}
                {method === "vnpay" && (
                  <div className="fade-in">
                    <div className="rounded-3xl p-8 mb-6 bg-[#0060AC]/5 border border-[#0060AC]/20 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[#0060AC]/10 blur-3xl rounded-full"></div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0060AC] mb-6 text-center">Scan QR code via Bank app</p>
                      <div className="flex justify-center mb-8"><MockQR color="#0060AC" /></div>
                      
                      <div className="space-y-4">
                        ={[
                          { label: "Bank", value: "Vietcombank (VCB)", copy: false },
                          { label: "Account Num", value: "1234 5678 9012 3456", copy: true },
                          { label: "Account Holder", value: "PROINTERVIEW CORP", copy: false },
                          { label: "Amount", value: fmt(total - discount), copy: true },
                          { label: "Reference", value: vnpayRef, copy: true },
                        ].map((r) => (
                          <div key={r.label} className="flex items-center justify-between gap-4 py-3 border-b border-[#0060AC]/10">
                            <div>
                              <p className="text-[8px] font-black uppercase tracking-widest text-[#0060AC]/60 mb-1">{r.label}</p>
                              <p className="text-sm font-bold text-white">{r.value}</p>
                            </div>
                            {r.copy && <CopyBtn text={r.value} />}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-start gap-4 px-6 py-4 rounded-2xl bg-white/5 border border-white/5 text-[10px] font-bold text-white/40">
                      <Warning className="w-4 h-4 text-primary-fixed flex-shrink-0" />
                      Activation typically takes 1-5 minutes during business hours.
                    </div>
                  </div>
                )}

                {/* Security note */}
                <div className="flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mt-8">
                  <ShieldCheck className="w-4 h-4 text-primary-fixed" />
                  Your payment is secured with 256-bit SSL encryption
                </div>
              </div>
            </div>
          </div>

          {/* ══ RIGHT PANEL: Order summary ══ */}
          <div className="lg:w-96 flex-shrink-0">
            <div className="glass-panel overflow-hidden sticky top-24 shadow-2xl">

              {/* Summary header */}
              <div className="px-8 py-6 border-b border-white/5 bg-white/5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-1">Order Summary</p>
                <p className="text-xl font-black text-white tracking-tighter">#{orderNum}</p>
              </div>

              {isBooking ? (
                /* ── BOOKING summary ── */
                <>
                  <div className="px-8 py-6 border-b border-white/5">
                    <div className="mb-6 flex items-center gap-4">
                      {bookingMentor ? (
                        <>
                          <img
                            src={bookingMentor.avatar}
                            alt={bookingMentor.name}
                            className="h-12 w-12 rounded-2xl border border-white/10 object-cover"
                          />
                          <div>
                            <p className="text-sm font-bold text-white">{bookingMentor.name}</p>
                            <p className="text-xs text-white/40">{bookingMentor.title}</p>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-white/50">Đang tải thông tin mentor…</p>
                      )}
                    </div>
                    <div className="space-y-4">
                      {[
                        { icon: Calendar, label: "Day", value: bookingDate || "" },
                        { icon: Clock, label: "Time", value: bookingTime || "" },
                        { icon: Video, label: "Platform", value: "Google Meet" },
                        { icon: Users, label: "Type", value: "60 mins · 1-1" },
                      ].map((row) => (
                        <div key={row.label} className="flex justify-between items-center text-xs">
                          <span className="text-white/40 font-black uppercase tracking-widest flex items-center gap-2"><row.icon className="w-3.5 h-3.5 text-primary-fixed" />{row.label}</span>
                          <span className="text-white font-bold">{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                /* ── PLAN summary ── */
                <>
                  <div className="px-8 py-6 border-b border-white/5 space-y-4">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                      <span className="text-white/40">Activation</span>
                      <span className="text-white">{new Date().toLocaleDateString("vi-VN")}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                      <span className="text-white/40">Cycle</span>
                      <span className="text-primary-fixed">{billing === "yearly" ? "Yarly" : "Monthly"}</span>
                    </div>
                  </div>

                  <div className="px-8 py-6 border-b border-white/5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#c4ff47] mb-4">What's included</p>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-black text-white uppercase tracking-tighter">{plan.name} Package</span>
                        <span className="text-[10px] font-bold text-white/40">{billing === "yearly" ? "12 Months" : "1 Month"}</span>
                      </div>
                      {plan.features.slice(0, 4).map((f, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <Check className="w-3.5 h-3.5 flex-shrink-0 text-primary-fixed mt-0.5" />
                          <span className="text-xs text-white/60 leading-relaxed">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Coupon */}
                  <div className="px-8 py-6 border-b border-white/5 bg-white/5">
                    {couponApplied ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-primary-fixed" />
                          <span className="text-sm font-black text-white">{coupon.toUpperCase()}</span>
                        </div>
                        <span className="text-[8px] font-black px-2 py-1 rounded bg-primary-fixed/20 text-primary-fixed border border-primary-fixed/30 uppercase tracking-[0.2em]">Applied</span>
                      </div>
                    ) : (
                      <div className="flex gap-2 p-1.5 bg-black/40 rounded-2xl border border-white/10">
                        <input
                          className="flex-1 bg-transparent text-xs px-3 focus:outline-none placeholder:text-white/20 text-white"
                          placeholder="Coupon Code"
                          value={coupon}
                          onChange={(e) => setCoupon(e.target.value)}
                        />
                        <button
                          onClick={() => { if (coupon.trim()) setCouponApplied(true); }}
                          className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-primary-fixed text-black transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(196, 255, 71,0.3)]"
                        >
                          Apply
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Totals */}
              <div className="px-8 py-8 space-y-4 bg-gradient-to-b from-transparent to-white/5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/40">Base Amount</span>
                  <span className="text-white/80 font-bold">{fmt(baseTotal)}</span>
                </div>
                {billing === "yearly" && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white/40">Yearly Discount</span>
                    <span className="text-[#c4ff47] font-bold">−{fmt(baseTotal - total)}</span>
                  </div>
                )}
                {couponApplied && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white/40">Coupon Discount (10%)</span>
                    <span className="text-[#c4ff47] font-bold">−{fmt(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/40">Transaction Fee</span>
                  <span className="text-primary-fixed font-bold italic tracking-widest">FREE</span>
                </div>
                
                <div className="pt-6 border-t border-white/10 flex justify-between items-end">
                   <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-1">Grand Total</p>
                    <p className="text-2xl font-black text-white tracking-tighter">{fmt(total - discount)}</p>
                   </div>
                   <ShieldCheck className="w-10 h-10 text-primary-fixed/20" />
                </div>
              </div>

              {/* Premium feature footer */}
              <div className="px-8 py-4 flex items-center gap-4 bg-primary-fixed">
                <div className="w-10 h-10 rounded-2xl bg-black flex items-center justify-center shadow-lg">
                  <ShieldCheck className="w-6 h-6 text-primary-fixed" />
                </div>
                <div>
                  <p className="text-black font-black text-[10px] uppercase tracking-widest">Secure Activation</p>
                  <p className="text-black/60 text-[10px] font-bold mt-0.5 whitespace-nowrap">Instant Access · Money back guarantee</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
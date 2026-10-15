import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, ShieldCheck, ChevronDown, Sparkles } from "lucide-react";
import { SparkleGlyph } from "../../components/decor/SparkleGlyph.jsx";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { requireLoginNavigate } from "../../utils/auth/authGate.js";
import { getUser, isLoggedIn } from "../../utils/auth/auth.js";
import { fetchCurrentPlan } from "../../api/plansApi.js";
import { trackAction } from "../../utils/analytics/analyticsApi.js";
import { PRICING_SUBTITLE, PRICING_FAQ } from "../../constants/brandVoice";
import { buildPlanCheckoutPath, getPlanDisplayAmount } from "../../constants/planCatalog.js";
import { formatVnd } from "../../utils/shared/formatVnd.js";
import "../../../styles/pricing-card-3d.css";

/* ─── Helpers ────────────────────────────────────────────────── */
const UNLIMITED_HIGHLIGHT = "KHÔNG GIỚI HẠN";

// Chỉ tô màu riêng con số đầu dòng ("03", "10 phiên...", "Ưu đãi 5%") — không bold cả cụm chữ.
const LEADING_NUMBER = /^(\d+)(.*)$/;
const PERCENT_PREFIX = /^(Ưu đãi )(\d+%)(.*)$/;
const NUMBER_ACCENT_BY_VARIANT = {
  outline: "text-violet-300 font-extrabold",
  lime: "text-violet-300 font-extrabold",
  elite: "text-violet-300 font-extrabold",
};

function FeatureLabel({ text, variant = "lime" }) {
  const accentClass = `text-[1.05em] font-extrabold ${NUMBER_ACCENT_BY_VARIANT[variant] || NUMBER_ACCENT_BY_VARIANT.lime}`;
  const percentMatch = text.match(PERCENT_PREFIX);
  if (percentMatch) {
    const [, prefix, pct, rest] = percentMatch;
    return (
      <span className="leading-snug">
        {prefix}
        <span className={accentClass}>{pct}</span>
        {rest}
      </span>
    );
  }
  const leadingNumMatch = text.match(LEADING_NUMBER);
  if (leadingNumMatch) {
    const [, num, rest] = leadingNumMatch;
    return (
      <span className="leading-snug">
        <span className={accentClass}>{num}</span>
        {rest}
      </span>
    );
  }
  if (!text.includes(UNLIMITED_HIGHLIGHT)) return <span className="leading-snug">{text}</span>;
  const parts = text.split(UNLIMITED_HIGHLIGHT);
  return (
    <span className="leading-snug">
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {part}
          {i < parts.length - 1 && <span className={accentClass}>{UNLIMITED_HIGHLIGHT}</span>}
        </React.Fragment>
      ))}
    </span>
  );
}

function normalizePlanKey(plan) {
  const k = String(plan ?? "").trim();
  if (k === "starterPro" || k === "starter_pro") return "starter_pro";
  if (k === "elitePro"   || k === "elite_pro")   return "elite_pro";
  return "free";
}

/* ─── FAQ item ───────────────────────────────────────────────── */
function FaqItem({ item, index, isOpen, onToggle }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      className={`overflow-hidden rounded-2xl border transition-all ${
        isOpen
          ? "border-violet-500/60 bg-white/[0.08] shadow-[0_0_30px_rgba(128,55,244,0.25)]"
          : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
      }`}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 p-5 text-left"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <h4 className="text-sm font-bold text-white sm:text-base">{item.q}</h4>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="shrink-0"
        >
          <ChevronDown className={`h-5 w-5 ${isOpen ? "text-violet-400" : "text-slate-400"}`} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-5 pb-5">
              <div className="mt-3 space-y-3 border-t border-white/10 pt-3 text-sm leading-relaxed text-slate-300">
                {item.paragraphs?.map((p, idx) => <p key={idx}>{p}</p>)}
                {item.bullets?.length ? (
                  <ul className="list-disc space-y-2 pl-5 marker:text-violet-400">
                    {item.bullets.map((b, idx) => <li key={idx}>{b}</li>)}
                  </ul>
                ) : null}
                {item.note && (
                  <p className="rounded-xl border border-violet-500/30 bg-violet-950/60 px-3.5 py-2.5 text-[13px] font-medium text-violet-200">
                    {item.note}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Plan data ──────────────────────────────────────────────── */
const PLANS = [
  {
    id: "free",
    title: "Basic",
    subtitle: "Khởi đầu",
    features: [
      "03 lượt phân tích CV theo vị trí ứng tuyển",
      "01 phiên AI Interview trải nghiệm với 03 câu hỏi cơ bản",
      "Nhận kết quả đánh giá tổng quan sau phiên luyện tập",
    ],
    cta: "Bắt đầu ngay",
    popular: false,
    variant: "outline",
  },
  {
    id: "starter_pro",
    title: "Pro",
    subtitle: "Tăng tốc",
    features: [
      "10 lượt phân tích CV theo từng vị trí ứng tuyển",
      "03 phiên AI Interview cá nhân hóa theo CV và vị trí ứng tuyển (05 câu hỏi/phiên)",
      "Đánh giá câu trả lời và gợi ý cải thiện chi tiết cho từng câu hỏi",
      "Ưu đãi 5% khi booking Mentor và đăng ký khóa học từ Mentor",
    ],
    cta: "Nâng cấp Pro",
    popular: false,
    variant: "lime",
  },
  {
    id: "elite_pro",
    title: "Elite",
    subtitle: "Bứt phá",
    features: [
      "30 lượt phân tích CV theo từng vị trí ứng tuyển",
      "08 phiên AI Interview cá nhân hóa theo CV và vị trí ứng tuyển (05 câu hỏi/phiên)",
      "Đánh giá câu trả lời và gợi ý cải thiện chi tiết cho từng câu hỏi",
      "Ưu đãi 10% khi booking Mentor và đăng ký khóa học từ Mentor",
    ],
    cta: "Nâng cấp Elite",
    popular: true,
    variant: "elite",
  },
];

/* ─── Main page ──────────────────────────────────────────────── */
export function Pricing() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(null);
  const [currentPlan, setCurrentPlan] = useState(() => normalizePlanKey(getUser()?.plan));

  useEffect(() => {
    if (!isLoggedIn()) return;
    let cancelled = false;
    fetchCurrentPlan().then((res) => {
      if (!cancelled && res.success) setCurrentPlan(normalizePlanKey(res.plan));
    });
    return () => { cancelled = true; };
  }, []);

  const toggleFaq = (i) => setOpenFaq(openFaq === i ? null : i);

  const handleCta = (plan) => {
    if (plan.id === "free") { requireLoginNavigate(navigate, "/"); return; }
    if (currentPlan === plan.id) return;
    const path = buildPlanCheckoutPath(plan.id, "monthly");
    trackAction("plan_checkout_start", "/pricing", { planId: plan.id });
    requireLoginNavigate(navigate, path);
  };

  return (
    <MentorPageShell className="pricing-page" bottomPad="pb-28 sm:pb-36" showAmbient={false}>
      <div className="w-full px-4 sm:px-6 md:px-8 lg:px-12">
        <div className="mx-auto w-full max-w-[1400px] pt-2 pb-16 sm:pt-4 sm:pb-24">

          {/* ── Header ─────────────────────────────────────────── */}
          <div className="mb-7 text-center sm:mb-9">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="font-headline text-[clamp(1.75rem,3.2vw,2.75rem)] font-black leading-[1.15] tracking-tight text-white"
            >
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-300 to-lime-300 bg-clip-text text-transparent">
                Sẵn sàng hơn cho
              </span>{" "}
              mọi buổi phỏng vấn
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.12 }}
              className="mx-auto mt-2.5 max-w-2xl text-sm font-medium leading-relaxed text-slate-300 sm:text-base"
            >
              {PRICING_SUBTITLE}
            </motion.p>
          </div>

          {/* ── Plan cards ─────────────────────────────────────── */}
          <div className="pricing-cards-grid mt-6 mb-16 sm:mb-24 grid w-full grid-cols-1 items-stretch gap-6 md:grid-cols-3 lg:gap-8">
            {PLANS.map((plan, cardIndex) => {
              const PLAN_LEVELS = { free: 0, starter_pro: 1, elite_pro: 2 };
              const currentLevel = PLAN_LEVELS[currentPlan] || 0;
              const planLevel = PLAN_LEVELS[plan.id] || 0;
              
              const isCurrent = currentPlan === plan.id;
              const isLowerTier = !isCurrent && planLevel < currentLevel;
              const isPopular = plan.popular;
              const isFree    = plan.id === "free";
              const displayAmount = isFree ? 0 : getPlanDisplayAmount(plan.id, "monthly");
              const variant = plan.variant;
              const tierClass =
                plan.id === "free"
                  ? "pricing-card--basic"
                  : plan.id === "starter_pro"
                  ? "pricing-card--pro"
                  : "pricing-card--elite";

              return (
                <motion.article
                  key={plan.id}
                  initial={{ opacity: 0, y: 48 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -12, scale: 1.03, transition: { type: "spring", stiffness: 350, damping: 22 } }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.5, delay: cardIndex * 0.12, ease: [0.16, 1, 0.3, 1] }}
                  className={`pricing-plan-card ${tierClass} relative flex h-full w-full min-w-0 flex-col rounded-[24px] p-6 pt-5 sm:p-7 sm:pt-6 cursor-pointer ${
                    isPopular ? "is-popular z-10" : ""
                  }`}
                >
                  {/* The animated rotating border beam wrapper from user snippet */}
                  <div className="pricing-border-beam-wrap" aria-hidden="true" />

                  {/* Popular badge */}
                  {isPopular && (
                    <motion.div
                      initial={{ scale: 0, y: -10 }}
                      animate={{ scale: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 18, delay: cardIndex * 0.12 + 0.3 }}
                      className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 z-20"
                    >
                      <span className="relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-1 text-xs font-bold uppercase tracking-widest text-white shadow-[0_0_20px_rgba(128,55,244,0.5)] border border-violet-400/30">
                        <Sparkles className="size-3.5 text-violet-200" />
                        <span>Phổ biến nhất</span>
                      </span>
                    </motion.div>
                  )}

                  {/* Inner card content (z-10 ensures it is crisp above the rotating beam) */}
                  <div className="relative z-10 flex flex-1 flex-col">
                    {/* Current plan badge */}
                    <div className="mb-2 flex h-6 shrink-0 items-center justify-between">
                      {isCurrent ? (
                        <motion.span
                          initial={{ scale: 0.7, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 400, damping: 20 }}
                          className="rounded-full border border-violet-500/40 bg-violet-500/20 px-3 py-0.5 text-[11px] font-bold text-violet-300 shadow-[0_0_12px_rgba(168,85,247,0.3)]"
                        >
                          Gói hiện tại
                        </motion.span>
                      ) : (
                        <span className="invisible px-2.5 py-0.5 text-[10px]" aria-hidden>—</span>
                      )}
                    </div>

                    {/* Title + price */}
                    <div className="shrink-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{plan.subtitle}</p>
                      <h3 className="mt-1 font-headline text-2xl font-black text-white">
                        {plan.title}
                      </h3>
                      <div className="mt-3 min-h-[2.75rem]">
                        <p className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                          {isFree ? "0 VND" : formatVnd(displayAmount)}
                          {!isFree && (
                            <span className="ml-1 text-sm font-semibold text-slate-400">/tháng</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="my-4 shrink-0 border-t border-white/10" />

                    {/* Features (Directly visible, clean and readable) */}
                    <ul className="flex flex-1 flex-col gap-3 py-1">
                      {plan.features.map((f, fi) => (
                        <motion.li
                          key={fi}
                          initial={{ opacity: 0, x: -12 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.3, delay: cardIndex * 0.12 + fi * 0.05 + 0.2 }}
                          className="flex items-start gap-2.5 text-sm text-slate-200 leading-snug"
                        >
                          {variant === "elite" ? (
                            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
                          ) : (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
                          )}
                          <span className="min-w-0 flex-1"><FeatureLabel text={f} variant={variant} /></span>
                        </motion.li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <div className="mt-auto w-full shrink-0 pt-6">
                      <motion.button
                        type="button"
                        disabled={isCurrent || isLowerTier}
                        onClick={() => handleCta(plan)}
                        whileHover={!(isCurrent || isLowerTier) ? { scale: 1.02 } : undefined}
                        whileTap={!(isCurrent || isLowerTier) ? { scale: 0.98 } : undefined}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        className={`group relative flex w-full items-center justify-center overflow-hidden rounded-2xl py-3.5 px-4 text-center text-sm font-bold transition-all ${
                          isCurrent || isLowerTier
                            ? "cursor-not-allowed border border-white/10 bg-white/5 text-slate-400"
                            : variant === "outline"
                            ? "border border-violet-500/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20 hover:border-violet-400/50 shadow-sm cursor-pointer"
                            : variant === "lime"
                            ? "bg-violet-600 hover:bg-violet-500 text-white font-bold shadow-[0_0_20px_rgba(128,55,244,0.35)] cursor-pointer"
                            : "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold shadow-[0_0_25px_rgba(139,92,246,0.45)] cursor-pointer"
                        }`}
                      >
                        <span>{isCurrent ? "Đang dùng" : plan.cta}</span>
                      </motion.button>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>

          {/* ── FAQ ────────────────────────────────────────────── */}
          <section className="mx-auto mt-16 max-w-3xl sm:mt-20">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.45 }}
              className="mb-8 text-center"
            >
              <h2 className="font-headline text-2xl font-black text-white sm:text-3xl">
                Câu hỏi thường gặp
              </h2>
              <p className="mt-2 text-sm text-slate-300 sm:text-base">
                Hướng dẫn chi tiết về gói dịch vụ, thanh toán, quota và quyền lợi của bạn.
              </p>
            </motion.div>

            <div className="space-y-3">
              {PRICING_FAQ.map((item, i) => (
                <FaqItem
                  key={item.q}
                  item={item}
                  index={i}
                  isOpen={openFaq === i}
                  onToggle={() => toggleFaq(i)}
                />
              ))}
            </div>
          </section>

        </div>
      </div>
    </MentorPageShell>
  );
}

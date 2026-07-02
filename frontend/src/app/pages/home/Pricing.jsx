import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, ShieldCheck, ChevronDown } from "lucide-react";
import { SparkleGlyph } from "../../components/decor/SparkleGlyph.jsx";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { requireLoginNavigate } from "../../utils/auth/authGate.js";
import { getUser, isLoggedIn } from "../../utils/auth/auth.js";
import { fetchCurrentPlan } from "../../api/plansApi.js";
import { trackAction } from "../../utils/analytics/analyticsApi.js";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";
import { PRICING_SUBTITLE, PRICING_FAQ } from "../../constants/brandVoice";
import { buildPlanCheckoutPath, getPlanDisplayAmount } from "../../constants/planCatalog.js";
import { formatVnd } from "../../utils/shared/formatVnd.js";

/* ─── Helpers ────────────────────────────────────────────────── */
const UNLIMITED_HIGHLIGHT = "KHÔNG GIỚI HẠN";

function FeatureLabel({ text }) {
  if (!text.includes(UNLIMITED_HIGHLIGHT)) return <span className="leading-snug">{text}</span>;
  const parts = text.split(UNLIMITED_HIGHLIGHT);
  return (
    <span className="leading-snug">
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {part}
          {i < parts.length - 1 && (
            <span className="font-bold text-[#6d2fd6]">{UNLIMITED_HIGHLIGHT}</span>
          )}
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
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-colors ${
        isOpen ? "border-violet-300 ring-2 ring-violet-100" : "border-slate-200/90 hover:border-violet-200"
      }`}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 p-5 text-left"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <h4 className="text-sm font-bold text-slate-900 sm:text-base">{item.q}</h4>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="shrink-0"
        >
          <ChevronDown className={`h-5 w-5 ${isOpen ? "text-[#6d2fd6]" : "text-slate-400"}`} />
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
              <div className="mt-3 space-y-3 border-t border-violet-100 pt-3 text-sm leading-relaxed text-slate-600">
                {item.paragraphs?.map((p, idx) => <p key={idx}>{p}</p>)}
                {item.bullets?.length ? (
                  <ul className="list-disc space-y-2 pl-5 marker:text-[#6d2fd6]">
                    {item.bullets.map((b, idx) => <li key={idx}>{b}</li>)}
                  </ul>
                ) : null}
                {item.note && (
                  <p className="rounded-xl bg-violet-50/80 px-3 py-2 text-[13px] font-medium text-violet-900/90">
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
    <MentorPageShell className="pricing-page" bottomPad="pb-16" showAmbient={false}>
      <div className={CUSTOMER_SHELL_GUTTER}>
        <div className={`${CUSTOMER_SHELL_MAX} py-10 sm:py-14`}>

          {/* ── Header ─────────────────────────────────────────── */}
          <div className="mb-8 text-center sm:mb-10">
            <motion.div
              initial={{ opacity: 0, y: -24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="font-headline text-[clamp(1.45rem,2.8vw,2.65rem)] font-extrabold leading-[1.12] tracking-tight text-slate-900"
            >
              <span className="bg-gradient-to-r from-[#8037f4] to-[#630ed4] bg-clip-text text-transparent">
                Sẵn sàng hơn cho
              </span>{" "}
              mọi buổi phỏng vấn
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.15 }}
              className="mt-3 text-base font-medium leading-relaxed text-violet-700/90"
            >
              {PRICING_SUBTITLE}
            </motion.p>
          </div>

          {/* ── Plan cards ─────────────────────────────────────── */}
          <div className="mt-10 grid w-full grid-cols-1 items-stretch gap-6 md:grid-cols-3 lg:gap-8">
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

              return (
                <motion.article
                  key={plan.id}
                  initial={{ opacity: 0, y: 48 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.5, delay: cardIndex * 0.12, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={!isPopular ? {
                    y: -6,
                    boxShadow: "0 20px 48px rgba(128,55,244,0.13)",
                    borderColor: "rgba(128,55,244,0.3)",
                    transition: { type: "spring", stiffness: 300, damping: 24 },
                  } : undefined}
                  className={`glass-card relative flex h-full w-full min-w-0 flex-col !rounded-[20px] p-6 pt-[0.7rem] sm:p-7 sm:pt-[0.95rem] ${
                    isPopular
                      ? "z-10 !overflow-visible !border-[3px] !border-[#6d2fd6] !shadow-[0_8px_40px_rgba(109,47,214,0.18)]"
                      : ""
                  }`}
                >
                  {/* Popular badge */}
                  {isPopular && (
                    <motion.div
                      initial={{ scale: 0, y: -10 }}
                      animate={{ scale: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 18, delay: cardIndex * 0.12 + 0.3 }}
                      className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[62%]"
                    >
                      <span className="relative inline-block whitespace-nowrap rounded-full bg-[#6d2fd6] px-4 py-1 text-xs font-black uppercase tracking-widest text-white shadow-md">
                        Phổ biến nhất
                        <SparkleGlyph className="absolute -right-5 -top-4 h-8 w-8" style={{ filter: "drop-shadow(0 0 8px rgba(95,0,240,0.35))", transform: "translateY(-0.1rem) rotate(16deg)" }} />
                        <SparkleGlyph className="absolute -left-6 -top-6 h-4 w-4 opacity-60" style={{ filter: "drop-shadow(0 0 5px rgba(95,0,240,0.22))", transform: "rotate(-18deg)" }} />
                        <SparkleGlyph className="absolute -right-9 -top-6 h-4 w-4 opacity-70" style={{ filter: "drop-shadow(0 0 6px rgba(95,0,240,0.28))", transform: "rotate(22deg)" }} />
                        <SparkleGlyph className="absolute -right-11 -top-8 h-3.5 w-3.5 opacity-60" style={{ filter: "drop-shadow(0 0 5px rgba(95,0,240,0.22))", transform: "rotate(28deg)" }} />
                      </span>
                    </motion.div>
                  )}

                  {/* Current plan badge */}
                  <div className="mb-2 flex h-6 shrink-0 items-center">
                    {isCurrent ? (
                      <motion.span
                        initial={{ scale: 0.7, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                        className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-bold text-violet-800 ring-1 ring-violet-200"
                      >
                        Gói hiện tại
                      </motion.span>
                    ) : (
                      <span className="invisible px-2.5 py-0.5 text-[10px]" aria-hidden>—</span>
                    )}
                  </div>

                  {/* Title + price */}
                  <div className="shrink-0">
                    <p className="text-xs font-semibold text-slate-500">{plan.subtitle}</p>
                    <h3 className={`mt-1 font-headline text-xl font-bold ${variant === "elite" ? "text-[#6d2fd6]" : "text-slate-900"}`}>
                      {plan.title}
                    </h3>
                    <div className="mt-3 min-h-[2.75rem]">
                      <p className="text-3xl font-black tracking-tight text-[#630ed4] sm:text-4xl">
                        {isFree ? "0 VND" : formatVnd(displayAmount)}
                        {!isFree && (
                          <span className="ml-1 text-base font-bold text-slate-500">/tháng</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="my-3 shrink-0 border-t border-slate-100" />

                  {/* Features */}
                  <ul className="flex flex-1 flex-col gap-2">
                    {plan.features.map((f, fi) => (
                      <motion.li
                        key={fi}
                        initial={{ opacity: 0, x: -12 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3, delay: cardIndex * 0.12 + fi * 0.05 + 0.2 }}
                        className="flex items-start gap-2.5 text-sm text-slate-700"
                      >
                        {variant === "elite" ? (
                          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#6d2fd6]" />
                        ) : (
                          <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${variant === "lime" ? "text-[#6d2fd6]" : "text-slate-400"}`} />
                        )}
                        <span className="min-w-0 flex-1"><FeatureLabel text={f} /></span>
                      </motion.li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <div className="mt-auto w-full shrink-0 pt-4">
                    <motion.button
                      type="button"
                      disabled={isCurrent || isLowerTier}
                      onClick={() => handleCta(plan)}
                      whileHover={!(isCurrent || isLowerTier) ? { scale: 1.04 } : undefined}
                      whileTap={!(isCurrent || isLowerTier) ? { scale: 0.96 } : undefined}
                      transition={{ type: "spring", stiffness: 380, damping: 22 }}
                      className={`flex w-full items-center justify-center rounded-full py-3 text-center text-sm font-bold transition-all ${
                        isCurrent || isLowerTier
                          ? "cursor-not-allowed border border-violet-200 bg-violet-50/50 text-violet-400"
                          : variant === "outline"
                          ? "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                          : "font-black"
                      }`}
                      style={
                        isCurrent || isLowerTier || variant === "outline"
                          ? undefined
                          : { background: "#93f72b", color: "#0f172a", boxShadow: "0 8px 20px rgba(15,23,42,0.1)" }
                      }
                    >
                      {isCurrent ? "Đang dùng" : isLowerTier ? "Gói thấp hơn" : plan.cta}
                    </motion.button>
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
              <h2 className="font-headline text-xl font-extrabold text-violet-950 sm:text-2xl">
                Câu hỏi thường gặp
              </h2>
              <p className="mt-2 text-sm text-violet-700/90 sm:text-base">
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

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  CheckCircle2,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { SparkleGlyph } from "../../components/decor/SparkleGlyph.jsx";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { requireLoginNavigate } from "../../utils/auth/authGate.js";
import { getUser, isLoggedIn } from "../../utils/auth/auth.js";
import { fetchCurrentPlan } from "../../api/plansApi.js";
import { trackAction } from "../../utils/analytics/analyticsApi.js";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";
import { CustomerPageHeader, CustomerPageSplitTitle } from "../../components/layout/CustomerPageHeader";
import { PRICING_SUBTITLE, PRICING_FAQ } from "../../constants/brandVoice";
import { buildPlanCheckoutPath, getPlanDisplayAmount } from "../../constants/planCatalog.js";
import { formatVnd } from "../../utils/shared/formatVnd.js";

function PricingFaqAnswer({ item }) {
  return (
    <div className="mt-3 space-y-3 border-t border-violet-100 pt-3 text-sm leading-relaxed text-slate-600">
      {item.paragraphs?.map((p, idx) => (
        <p key={idx}>{p}</p>
      ))}
      {item.bullets?.length ? (
        <ul className="list-disc space-y-2 pl-5 marker:text-[#6d2fd6]">
          {item.bullets.map((b, idx) => (
            <li key={idx}>{b}</li>
          ))}
        </ul>
      ) : null}
      {item.note ? (
        <p className="rounded-xl bg-violet-50/80 px-3 py-2 text-[13px] font-medium text-violet-900/90">
          {item.note}
        </p>
      ) : null}
    </div>
  );
}

const PLANS = [
  {
    id: "free",
    title: "Basic",
    subtitle: "Miễn phí mãi mãi",
    features: [
      "10 lượt phân tích CV & JD",
      "1 buổi AI Interview trải nghiệm (3 câu hỏi)",
    ],
    cta: "Bắt đầu ngay",
    checkoutMonthly: "/",
    checkoutYearly: "/",
    popular: false,
    variant: "outline",
  },
  {
    id: "starter_pro",
    title: "Pro",
    subtitle: "Dành cho ứng viên chủ động",
    features: [
      "30 lượt phân tích CV & JD",
      "4 phiên AI Interview thực chiến (5 câu hỏi)",
      "Nhận phản hồi chi tiết sau mỗi phiên",
    ],
    cta: "Nâng cấp Pro",
    popular: false,
    variant: "lime",
  },
  {
    id: "elite_pro",
    title: "Elite",
    subtitle: "Chinh phục tập đoàn lớn",
    features: [
      "Phân tích CV & JD không giới hạn",
      "10 phiên AI Interview nâng cao (5 câu hỏi)",
      "Phản hồi chuyên sâu & theo dõi tiến độ",
    ],
    cta: "Nâng cấp Elite",
    popular: true,
    variant: "elite",
  },
];


function fmtVnd(amount) {
  return formatVnd(amount);
}

const UNLIMITED_HIGHLIGHT = "KHÔNG GIỚI HẠN";

function FeatureLabel({ text }) {
  if (!text.includes(UNLIMITED_HIGHLIGHT)) {
    return <span className="leading-snug">{text}</span>;
  }
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
  if (k === "elitePro" || k === "elite_pro") return "elite_pro";
  return "free";
}



export function Pricing() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(null);
  const [billing, setBilling] = useState("monthly");
  const [currentPlan, setCurrentPlan] = useState(() =>
    normalizePlanKey(getUser()?.plan),
  );

  useEffect(() => {
    if (!isLoggedIn()) return;
    let cancelled = false;
    fetchCurrentPlan().then((res) => {
      if (!cancelled && res.success) {
        setCurrentPlan(normalizePlanKey(res.plan));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleFaq = (i) => setOpenFaq(openFaq === i ? null : i);

  const handleCta = (plan) => {
    if (plan.id === "free") {
      requireLoginNavigate(navigate, "/");
      return;
    }
    if (currentPlan === plan.id) return;
    const path = buildPlanCheckoutPath(plan.id, billing);
    trackAction("plan_checkout_start", "/pricing", { planId: plan.id, billing });
    requireLoginNavigate(navigate, path);
  };

  return (
    <MentorPageShell className="pricing-page" bottomPad="pb-16" showAmbient={false}>
      <div className={CUSTOMER_SHELL_GUTTER}>
        <div className={`${CUSTOMER_SHELL_MAX} py-10 sm:py-14`}>
          <CustomerPageHeader
            centered
            className="mb-8 sm:mb-10"
            title={
              <CustomerPageSplitTitle
                accent="Sẵn sàng hơn cho"
                rest="mọi buổi phỏng vấn"
              />
            }
            titleClassName="font-headline text-[clamp(1.5rem,3.5vw,3.25rem)] font-extrabold leading-[1.12] tracking-tight"
            subtitle={PRICING_SUBTITLE}
            subtitleClassName="mt-3 max-w-2xl text-base font-medium leading-relaxed text-violet-700/90"
          />



          <div className="mt-10 grid w-full grid-cols-1 items-stretch justify-items-stretch gap-6 md:grid-cols-3 lg:gap-8 [&>article]:min-w-0 [&>article]:w-full">
            {PLANS.map((plan) => {
              const isCurrent = currentPlan === plan.id;
              const isPopular = plan.popular;
              const isYearly = billing === "yearly";
              const isFree = plan.id === "free";
              const displayAmount = isFree ? 0 : getPlanDisplayAmount(plan.id, billing);
              const variant = plan.variant;
              /** Cùng chiều cao khối giá → vạch ngăn & list thẳng hàng (Basic 0đ = Pro/Elite) */
              const priceBlockMin = "min-h-[2.75rem]";
              return (
                <article
                  key={plan.id}
                  className={`glass-card relative flex h-full w-full min-w-0 flex-col !rounded-[20px] p-6 pt-[0.7rem] sm:p-7 sm:pt-[0.95rem] ${
                    isPopular
                      ? "z-10 !overflow-visible !border-[3px] !border-[#6d2fd6] !shadow-none hover:!translate-y-0 hover:!border-[#6d2fd6] hover:!shadow-none"
                      : ""
                  }`}
                >
                  {isPopular && (
                    <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[62%]">
                      <span className="relative inline-block whitespace-nowrap rounded-full bg-[#6d2fd6] px-4 py-1 text-xs font-black uppercase tracking-widest text-white shadow-md">
                        Phổ biến nhất
                        <SparkleGlyph
                          className="absolute -right-5 -top-4 h-8 w-8"
                          style={{
                            filter:
                              "drop-shadow(0 1px 2px rgba(15,23,42,0.12)) drop-shadow(0 0 8px rgba(95,0,240,0.35))",
                            transform: "translateY(-0.1rem) rotate(16deg)",
                          }}
                        />
                        <SparkleGlyph
                          className="absolute -left-6 -top-6 h-4 w-4 -translate-y-[0.3rem] translate-x-[9.8rem] opacity-60"
                          style={{
                            filter:
                              "drop-shadow(0 1px 2px rgba(15,23,42,0.08)) drop-shadow(0 0 5px rgba(95,0,240,0.22))",
                            transform: "rotate(-18deg)",
                          }}
                        />
                        <SparkleGlyph
                          className="absolute -right-9 -top-6 h-4 w-4 opacity-70"
                          style={{
                            filter:
                              "drop-shadow(0 1px 2px rgba(15,23,42,0.1)) drop-shadow(0 0 6px rgba(95,0,240,0.28))",
                            transform: "rotate(22deg)",
                          }}
                        />
                        <SparkleGlyph
                          className="absolute -right-11 -top-8 h-3.5 w-3.5 opacity-60"
                          style={{
                            filter:
                              "drop-shadow(0 1px 2px rgba(15,23,42,0.08)) drop-shadow(0 0 5px rgba(95,0,240,0.22))",
                            transform: "rotate(28deg)",
                          }}
                        />
                      </span>
                    </div>
                  )}

                  <div className="mb-2 flex h-6 shrink-0 items-center">
                    {isCurrent ? (
                      <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-bold text-violet-800 ring-1 ring-violet-200">
                        Gói hiện tại
                      </span>
                    ) : (
                      <span className="invisible rounded-full px-2.5 py-0.5 text-[10px]" aria-hidden>
                        —
                      </span>
                    )}
                  </div>

                  <div className="shrink-0">
                    <p className="text-xs font-semibold text-slate-500">{plan.subtitle}</p>
                    <h3
                      className={`mt-1 font-headline text-xl font-bold ${
                        variant === "elite" ? "text-[#6d2fd6]" : "text-slate-900"
                      }`}
                    >
                      {plan.title}
                    </h3>

                    <div className={`mt-3 flex flex-col justify-start space-y-1.5 ${priceBlockMin}`}>
                      <p className="text-3xl font-black tracking-tight text-[#630ed4] sm:text-4xl">
                        {fmtVnd(displayAmount)}
                        {!isFree ? (
                          <span className="ml-1 text-base font-bold text-slate-500">
                            {isYearly ? "/năm" : "/tháng"}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>

                  <div className="my-3 shrink-0 border-t border-slate-100" />

                  <ul className="flex flex-1 flex-col gap-2">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                        {variant === "elite" ? (
                          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#6d2fd6]" />
                        ) : (
                          <CheckCircle2
                            className={`mt-0.5 h-4 w-4 shrink-0 ${
                              variant === "lime" ? "text-[#6d2fd6]" : "text-slate-400"
                            }`}
                          />
                        )}
                        <span className="min-w-0 flex-1">
                          <FeatureLabel text={f} />
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto w-full shrink-0 pt-4">
                  <button
                    type="button"
                    disabled={isCurrent}
                    onClick={() => handleCta(plan)}
                    className={`flex w-full items-center justify-center rounded-full py-3 text-center text-sm font-bold transition-all ${
                      isCurrent
                        ? "cursor-not-allowed border border-slate-200 bg-slate-50 text-slate-400"
                        : variant === "outline"
                          ? "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                          : "font-black hover:brightness-105 active:scale-[0.99]"
                    }`}
                    style={
                      isCurrent || variant === "outline"
                        ? undefined
                        : {
                            background: "#93f72b",
                            color: "#0f172a",
                            boxShadow: "0 8px 20px rgba(15,23,42,0.1)",
                          }
                    }
                  >
                    {isCurrent ? "Đang dùng" : plan.cta}
                  </button>
                  </div>
                </article>
              );
            })}
          </div>

          <section className="mx-auto mt-16 max-w-3xl sm:mt-20">
            <div className="mb-8 text-center">
              <h2 className="font-headline text-xl font-extrabold text-violet-950 sm:text-2xl">
                Câu hỏi thường gặp
              </h2>
              <p className="mt-2 text-sm text-violet-700/90 sm:text-base">
                Hướng dẫn chi tiết về gói dịch vụ, thanh toán, quota và quyền lợi của bạn.
              </p>
            </div>

            <div className="space-y-3">
              {PRICING_FAQ.map((item, i) => {
                const isOpen = openFaq === i;
                return (
                  <div
                    key={item.q}
                    className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-all ${
                      isOpen
                        ? "border-violet-300 ring-2 ring-violet-100"
                        : "border-slate-200/90 hover:border-violet-200"
                    }`}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-4 p-5 text-left"
                      aria-expanded={isOpen}
                      onClick={() => toggleFaq(i)}
                    >
                      <h4 className="text-sm font-bold text-slate-900 sm:text-base">{item.q}</h4>
                      {isOpen ? (
                        <ChevronUp className="h-5 w-5 shrink-0 text-[#6d2fd6]" />
                      ) : (
                        <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />
                      )}
                    </button>
                    {isOpen ? (
                      <div className="px-5 pb-5">
                        <PricingFaqAnswer item={item} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </MentorPageShell>
  );
}

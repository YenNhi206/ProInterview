import React from "react";
import { useNavigate } from "react-router";
import {
  Zap as Lightning,
  Brain,
  GraduationCap,
  Users,
  ArrowRight,
  ChevronRight as CaretRight,
} from "lucide-react";

const JOURNEY_STEPS = [
  {
    number: "01",
    icon: Brain,
    title: "Phỏng vấn AI",
    desc: "Luyện tập với AI và nhận phản hồi chi tiết",
    route: "/interview",
    color: "#6E35E8",
    bgColor: "rgba(110, 53, 232,0.12)",
    borderColor: "rgba(110, 53, 232,0.35)",
  },
  {
    number: "02",
    icon: GraduationCap,
    title: "Học khóa học",
    desc: "Nâng cao kỹ năng với khóa học phù hợp",
    route: "/courses",
    color: "#B4F000",
    bgColor: "rgba(180,240,0,0.12)",
    borderColor: "rgba(180,240,0,0.35)",
  },
  {
    number: "03",
    icon: Users,
    title: "Đặt lịch Mentor",
    desc: "Củng cố kiến thức với mentor 1-1",
    route: "/mentors",
    color: "#FFB800",
    bgColor: "rgba(255,184,0,0.12)",
    borderColor: "rgba(255,184,0,0.35)",
  },
];

export function RecommendedJourney({
  variant = "full",
  currentStep,
}) {
  const navigate = useNavigate();

  if (variant === "compact") {
    return (
      <div
        className="p-5 rounded-2xl"
        style={{
          background: "rgba(110, 53, 232,0.08)",
          border: "1px solid rgba(110, 53, 232,0.2)",
        }}
      >
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #6E35E8, #9B6DFF)",
            }}
          >
            <Lightning className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h4 className="text-white font-bold mb-1" style={{ fontSize: "0.9375rem" }}>
              Luồng học tập được khuyên dùng
            </h4>
            <p className="text-white/50 text-xs leading-relaxed">
              Theo dõi lộ trình để tối ưu hóa kết quả học tập và chuẩn bị phỏng vấn
            </p>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {JOURNEY_STEPS.map((step, i) => {
            const isActive = currentStep !== undefined && i + 1 === currentStep;
            const isCompleted = currentStep !== undefined && i + 1 < currentStep;

            return (
              <button
                key={i}
                onClick={() => navigate(step.route)}
                className="w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:brightness-110"
                style={{
                  background: isActive
                    ? step.bgColor
                    : isCompleted
                    ? "rgba(180,240,0,0.08)"
                    : "rgba(255,255,255,0.04)",
                  border: `1px solid ${
                    isActive
                      ? step.borderColor
                      : isCompleted
                      ? "rgba(180,240,0,0.2)"
                      : "rgba(255,255,255,0.08)"
                  }`,
                }}
              >
                {/* Number badge */}
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-xs"
                  style={{
                    background: isCompleted
                      ? "#B4F000"
                      : isActive
                      ? step.color
                      : "rgba(255,255,255,0.08)",
                    color: isCompleted || isActive ? "#1F1F1F" : "rgba(255,255,255,0.35)",
                  }}
                >
                  {step.number}
                </div>

                {/* Content */}
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2 mb-0.5">
                    <step.icon
                      className="w-4 h-4"
                      style={{ color: isActive ? step.color : "rgba(255,255,255,0.5)" }}
                    />
                    <span
                      className="font-semibold text-sm"
                      style={{
                        color: isActive ? "white" : "rgba(255,255,255,0.7)",
                      }}
                    >
                      {step.title}
                    </span>
                  </div>
                  <p
                    className="text-xs"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                  >
                    {step.desc}
                  </p>
                </div>

                {/* Arrow */}
                <CaretRight
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                 
                />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Full variant
  return (
    <div
      className="p-8 rounded-3xl"
      style={{
        background: "linear-gradient(135deg, rgba(110, 53, 232,0.12) 0%, rgba(180,240,0,0.08) 100%)",
        border: "1px solid rgba(110, 53, 232,0.25)",
      }}
    >
      {/* Header */}
      <div className="text-center mb-10">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-4"
          style={{
            background: "rgba(110, 53, 232,0.2)",
            border: "1px solid rgba(110, 53, 232,0.35)",
            color: "#B89DFF",
          }}
        >
          <Lightning className="w-3.5 h-3.5" />
          Lộ trình học tập
        </div>
        <h3
          className="text-white mb-3"
          style={{
            fontSize: "1.75rem",
            fontWeight: 750,
            letterSpacing: "-0.02em",
          }}
        >
          Luồng được khuyên dùng
        </h3>
        <p
          className="text-white/50 max-w-lg mx-auto"
          style={{ fontSize: "0.9375rem", lineHeight: 1.6 }}
        >
          Theo dõi 3 bước này để tối ưu hóa kết quả học tập và sẵn sàng chinh phục mọi cuộc phỏng vấn
        </p>
      </div>

      {/* Steps */}
      <div className="relative">
        {/* Connector line */}
        <div
          className="hidden md:block absolute top-12 left-[16.66%] right-[16.66%] h-0.5"
          style={{
            background:
              "linear-gradient(90deg, rgba(110, 53, 232,0.3), rgba(180,240,0,0.3), rgba(255,184,0,0.3))",
          }}
        />

        <div className="grid md:grid-cols-3 gap-6 relative">
          {JOURNEY_STEPS.map((step, i) => {
            const isActive = currentStep !== undefined && i + 1 === currentStep;
            const isCompleted = currentStep !== undefined && i + 1 < currentStep;

            return (
              <button
                key={i}
                onClick={() => navigate(step.route)}
                className="group flex flex-col items-center text-center transition-all hover:-translate-y-1"
              >
                {/* Number badge with icon */}
                <div className="relative mb-5">
                  <div
                    className="w-24 h-24 rounded-2xl flex items-center justify-center relative transition-all group-hover:scale-105"
                    style={{
                      background: isCompleted
                        ? "linear-gradient(135deg, #B4F000, #80C800)"
                        : isActive
                        ? `linear-gradient(135deg, ${step.color}DD, ${step.color})`
                        : step.bgColor,
                      border: `2px solid ${
                        isCompleted
                          ? "#B4F000"
                          : isActive
                          ? step.color
                          : step.borderColor
                      }`,
                      boxShadow: isActive
                        ? `0 0 32px ${step.color}40`
                        : "0 8px 24px rgba(0,0,0,0.2)",
                    }}
                  >
                    <step.icon
                      className="w-10 h-10"
                      style={{
                        color: isCompleted || isActive ? "white" : step.color,
                      }}
                     
                    />
                    {/* Number overlay */}
                    <div
                      className="absolute -top-2 -right-2 w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs"
                      style={{
                        background: isCompleted
                          ? "#B4F000"
                          : step.color,
                        color: "#1F1F1F",
                        border: "2px solid #07060E",
                      }}
                    >
                      {step.number}
                    </div>
                  </div>

                  {/* Arrow connector (mobile) */}
                  {i < JOURNEY_STEPS.length - 1 && (
                    <div
                      className="md:hidden absolute -bottom-3 left-1/2 -translate-x-1/2"
                      style={{ color: step.color }}
                    >
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="mb-4">
                  <h4
                    className="text-white font-bold mb-2 transition-colors group-hover:opacity-100"
                    style={{
                      fontSize: "1.125rem",
                      letterSpacing: "-0.01em",
                      opacity: isActive ? 1 : 0.8,
                    }}
                  >
                    {step.title}
                  </h4>
                  <p
                    className="text-white/45 text-sm leading-relaxed max-w-xs mx-auto"
                  >
                    {step.desc}
                  </p>
                </div>

                {/* CTA */}
                <div
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all group-hover:gap-2.5"
                  style={{
                    background: isActive
                      ? step.color
                      : "rgba(255,255,255,0.08)",
                    color: isActive ? "#1F1F1F" : "rgba(255,255,255,0.5)",
                    border: `1px solid ${
                      isActive ? "transparent" : "rgba(255,255,255,0.12)"
                    }`,
                  }}
                >
                  {isCompleted ? "Xem lại" : isActive ? "Tiếp tục" : "Bắt đầu"}
                  <CaretRight className="w-3.5 h-3.5" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom note */}
      <div
        className="mt-8 p-4 rounded-xl text-center"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <p className="text-white/60 text-sm">
          <span className="text-white font-semibold">Mẹo:</span> Hoàn thành từng
          bước theo thứ tự để đạt hiệu quả tốt nhất trong hành trình chuẩn bị phỏng vấn
        </p>
      </div>
    </div>
  );
}

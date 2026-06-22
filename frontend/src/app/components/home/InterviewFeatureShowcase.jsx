import React from "react";
import { Brain } from "lucide-react";
import { HOME_SECTION_INNER } from "../layout/customerShellLayout";
import { HOME_SECTION_TITLE_SIZE, homeSectionClasses as ty } from "../../constants/homeTypography";
import { HeroInterviewVideoCard } from "./HeroInterviewVideoCard";

/** Showcase phỏng vấn AI — khớp mock: mockup trái + mascot, copy phải gọn */
export function InterviewFeatureShowcase() {
  return (
    <section id="ai-interview" aria-label="Luyện phỏng vấn với AI" className={ty.section}>
      <div className={`${ty.sectionShell} ${HOME_SECTION_INNER} !overflow-visible`}>
        <div className="mx-auto grid w-full min-w-0 grid-cols-1 items-center gap-8 max-lg:gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] lg:gap-6 xl:gap-8">
          {/* Mockup trái */}
          <div className="relative order-2 min-w-0 lg:order-1">
            <HeroInterviewVideoCard overlap />
            <div
              className="pointer-events-none absolute -bottom-3 right-[-0.5rem] z-20 hidden sm:block lg:-bottom-4 lg:right-[-2.5rem]"
              aria-hidden
            >
              <img
                src="/mascot-features.png"
                alt=""
                className="h-[11rem] w-auto object-contain drop-shadow-lg lg:h-[14rem]"
              />
            </div>
          </div>

          {/* Copy phải */}
          <div className={`${ty.sectionCopy} order-1 lg:order-2 lg:pl-2`}>
            <span className={ty.badge}>
              <Brain className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Luyện PV với AI
            </span>
            <h2
              className="flex w-full flex-col gap-0.5 font-headline text-pretty font-bold leading-[1.1] tracking-tight"
              style={{ fontSize: HOME_SECTION_TITLE_SIZE }}
            >
              <span className="text-slate-900">Luyện phỏng vấn với AI sẵn sàng</span>
              <span className="text-[#630ed4]">cho cơ hội thật</span>
            </h2>
            <p className={`${ty.sectionBody} max-w-md lg:max-w-none`}>
              Thực chiến phỏng vấn 1-1 cùng AI với bộ câu hỏi được cá nhân hóa theo CV & JD.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

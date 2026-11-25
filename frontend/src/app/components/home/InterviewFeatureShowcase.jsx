import React from "react";
import { Brain } from "lucide-react";
import { homeSectionClasses as ty } from "../../constants/homeTypography";
import { HeroInterviewVideoCard } from "./HeroInterviewVideoCard";
import { HomeSectionHeader } from "./HomeSectionHeader";

/** Showcase phỏng vấn AI — khớp mock: mockup trái + mascot, copy phải gọn */
export function InterviewFeatureShowcase() {
  return (
    <section id="ai-interview" aria-label="Luyện phỏng vấn với AI" className={ty.section}>
      <div className={`${ty.sectionShell} px-10 sm:px-16 lg:px-[4.5rem] mx-auto w-full max-w-[93rem] !overflow-visible lg:translate-x-[1.5rem]`}>
        <div className="mx-auto grid w-full min-w-0 grid-cols-1 items-center gap-8 max-lg:gap-10 lg:grid-cols-[minmax(0,5.5fr)_minmax(0,4.5fr)] lg:gap-6 xl:gap-8">
          {/* Mockup trái */}
          <div className="relative order-2 min-w-0 lg:order-1 lg:w-[calc(100%+3.2rem)]">
            <HeroInterviewVideoCard overlap />
            <div
              className="pointer-events-none absolute -bottom-3 right-[-0.5rem] z-20 hidden sm:block lg:-bottom-[1.2rem] lg:right-[-2.5rem]"
              aria-hidden
            >
              <img
                src="/mascot-features.png"
                alt=""
                className="h-[11rem] w-auto object-contain drop-shadow-lg lg:h-[14.5rem]"
              />
            </div>
          </div>

          {/* Copy phải */}
          <HomeSectionHeader
            icon={Brain}
            badge="Luyện phỏng vấn với AI"
            lines={[
              { text: "Luyện phỏng vấn với AI", tone: "dark" },
              { text: "sẵn sàng cho cơ hội thật", tone: "accent" },
            ]}
            body={
              <>
                Thực chiến phỏng vấn 1-1 cùng AI với bộ câu hỏi được{" "}
                <br className="hidden lg:block" /> cá nhân hóa theo CV & JD.
              </>
            }
            className="order-1 lg:order-2 lg:translate-x-[2.3rem]"
          />
        </div>
      </div>
    </section>
  );
}

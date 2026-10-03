/**
 * Typography & layout tokens — toàn bộ section Home (trừ hero headline).
 */
export const HOME_HERO_TITLE_CLAMP = "clamp(2.6rem, 8vw, 8.5rem)";

/** Tiêu đề section — đồng bộ, vừa phải (không quá đậm). */
export const HOME_SECTION_TITLE_SIZE = "clamp(1.45rem, 2.8vw, 2.65rem)";

/** @deprecated dùng HOME_SECTION_TITLE_SIZE */
export const HOME_SECTION_TITLE_CLAMP = HOME_SECTION_TITLE_SIZE;

const HOME_SECTION_BODY =
  "w-full !max-w-full text-pretty text-base font-medium leading-relaxed text-white/70 sm:text-lg";

export const homeSectionClasses = {
  /** Wrapper section — padding & overflow đồng bộ */
  section:
    "relative z-10 flex flex-col justify-center overflow-x-hidden py-12 sm:py-16 lg:py-20",
  /** Inner shell (kết hợp với HOME_SECTION_INNER ở JSX) */
  sectionShell: "relative z-10 flex w-full items-center overflow-hidden py-2",
  /** Grid 2 cột desktop — mockup | copy hoặc copy | mockup */
  sectionGrid:
    "mx-auto grid w-full min-w-0 grid-cols-1 items-center gap-8 max-lg:gap-6 lg:grid-cols-2 lg:gap-10 xl:gap-12",
  /** Khối copy bên trái/phải */
  sectionCopy:
    "relative z-10 flex w-full min-w-0 flex-col items-start gap-3 sm:gap-3.5",
  sectionCopyCenter:
    "relative z-10 flex w-full min-w-0 flex-col items-center gap-3 text-center sm:gap-3.5",

  badge:
    "liquid-glass inline-flex items-center gap-2 rounded-full px-3.5 py-1 font-semibold text-white/90 text-xs sm:text-sm",
  sectionTitle:
    "flex w-full max-w-full flex-col gap-1 font-headline text-pretty font-extrabold leading-[1.15] tracking-tight text-white",
  sectionTitleLineDark: "block text-white",
  sectionTitleLineAccent: "block text-[#c7f36b]",
  sectionTitleLineLime: "block text-[#a3e635]",
  sectionBody: HOME_SECTION_BODY,

  /** Legacy aliases — giữ tương thích, trỏ về token mới */
  title: "flex w-full max-w-full flex-col gap-1 font-headline text-pretty font-extrabold leading-[1.15] tracking-tight text-white",
  titleLineDark: "block text-white",
  titleLineAccent: "block text-[#c7f36b]",
  titleLineSecond: "block w-full text-white/90",
  body: HOME_SECTION_BODY,
  cvShowcaseBadge:
    "liquid-glass inline-flex items-center gap-2 rounded-full px-3.5 py-1 font-semibold text-white/90 text-xs sm:text-sm",
  cvShowcaseBody: HOME_SECTION_BODY,
  coursesBody: HOME_SECTION_BODY,
  coursesBulletList:
    "w-full !max-w-full space-y-3 text-pretty text-base font-normal leading-relaxed text-white/70 sm:text-lg",
  bulletList: `w-full !max-w-full space-y-3 ${HOME_SECTION_BODY}`,
  bulletIcon: "mt-0.5 h-5 w-5 shrink-0 text-[#c7f36b]",
  cta: "liquid-glass-strong inline-flex shrink-0 items-center gap-2 rounded-full px-6 py-2.5 text-[15px] font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98] sm:px-8 sm:py-3 sm:text-base",
  cardTitle: "font-headline text-lg font-bold text-white md:text-xl",
  cardScore: "shrink-0 rounded-2xl border border-white/10 px-4 py-1.5 text-sm font-bold sm:text-base bg-white/5 text-white/90",
};

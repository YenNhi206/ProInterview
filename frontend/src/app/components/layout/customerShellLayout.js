/** Khoảng cách từ thanh header mentor xuống nội dung trang */
export const MENTOR_MAIN_TOP_PAD = "pt-8";

/** Gutter + max-width dùng chung: navbar, hero Home, nội dung customer */
export const CUSTOMER_SHELL_GUTTER = "px-4 sm:px-10 md:px-16 lg:px-24";
export const CUSTOMER_SHELL_MAX = "mx-auto w-full max-w-7xl";

/** Trang chi tiết khóa học — rộng hơn shell chuẩn 4rem */
export const COURSE_DETAIL_SHELL_MAX = "mx-auto w-full max-w-[calc(80rem+4rem)]";

/** Home — loang hơn 7xl; dùng thống nhất cho navbar (Home), sections, footer (Home) */
export const HOME_SHELL_MAX = "mx-auto w-full max-w-[90rem]";
export const HOME_SECTION_INNER = `${CUSTOMER_SHELL_GUTTER} ${HOME_SHELL_MAX}`;

/** Căn mép trái/phải với pill navbar (max-w-7xl + gutter) */
export const NAV_SHELL_INNER = `${CUSTOMER_SHELL_GUTTER} ${CUSTOMER_SHELL_MAX}`;

/** Khối phân tích / lịch sử CV+JD — full width trong shell 7xl, layout loang */
export const CV_JD_PAGE_WRAP = "flex w-full flex-col gap-8 sm:gap-10";

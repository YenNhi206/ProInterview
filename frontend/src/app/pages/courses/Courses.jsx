import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Search, Star, Clock, ShoppingCart, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationEllipsis,
} from "../../components/ui/pagination";

import { fetchCourses } from "../../api/courseApi.js";
import { toastApiError } from "../../utils/shared/apiToast.js";
import { normalizeCourseStats } from "../../utils/course/courseStats.js";
import { mediaSrc, DEFAULT_COURSE_THUMB, avatarSrc } from "../../utils/shared/mediaUrl.js";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";
import { AppSelect } from "../../components/ui/AppSelect";
import { CustomerPageHeader, CustomerPageSplitTitle } from "../../components/layout/CustomerPageHeader";
import {
  buildCourseFilterCategories,
  courseMatchesTopic,
  getCourseTopicLabel,
} from "../../constants/courseCategories";
import {
  ExploreFilterSidebar,
  FilterRadio,
  FilterSection,
} from "../../components/shared/ExploreFilterSidebar";
import { formatVnd } from "../../utils/shared/formatVnd.js";

const LEVEL_OPTIONS = [
  { label: "Người mới", value: "Beginner" },
  { label: "Trung cấp", value: "Intermediate" },
  { label: "Nâng cao", value: "Advanced" },
];

const FEE_OPTIONS = [
  { label: "Miễn phí", value: "free" },
  { label: "Trả phí", value: "paid" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Mới nhất" },
  { value: "price_asc", label: "Giá thấp đến cao" },
  { value: "price_desc", label: "Giá cao đến thấp" },
  { value: "rating", label: "Đánh giá cao" },
];

const COURSES_PAGE_SIZE = 8;

function getPaginationItems(currentPage, totalPages) {
  if (totalPages <= 11) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items = [1];
  const windowStart = Math.max(2, currentPage - 2);
  const windowEnd = Math.min(totalPages - 1, currentPage + 2);
  if (windowStart > 2) items.push("ellipsis-start");
  for (let p = windowStart; p <= windowEnd; p += 1) items.push(p);
  if (windowEnd < totalPages - 1) items.push("ellipsis-end");
  items.push(totalPages);
  return items;
}

function CoursesPagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const items = getPaginationItems(currentPage, totalPages);

  return (
    <Pagination className="mt-8 border-t border-slate-100 pt-6">
      <PaginationContent className="gap-1 sm:gap-2">
        <PaginationItem>
          <PaginationLink
            href="#"
            size="default"
            className={cnPageNav(currentPage <= 1)}
            aria-disabled={currentPage <= 1}
            onClick={(e) => {
              e.preventDefault();
              if (currentPage > 1) onPageChange(currentPage - 1);
            }}
          >
            <ChevronLeft className="size-4" />
            <span>Trước</span>
          </PaginationLink>
        </PaginationItem>

        {items.map((item) =>
          typeof item === "string" ? (
            <PaginationItem key={item}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationLink
                href="#"
                isActive={item === currentPage}
                size="icon"
                className={
                  item === currentPage
                    ? "min-w-9 border-slate-200 bg-white font-semibold text-slate-900 shadow-sm"
                    : "min-w-9 font-medium text-slate-700 hover:bg-slate-50"
                }
                onClick={(e) => {
                  e.preventDefault();
                  onPageChange(item);
                }}
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          <PaginationLink
            href="#"
            size="default"
            className={cnPageNav(currentPage >= totalPages)}
            aria-disabled={currentPage >= totalPages}
            onClick={(e) => {
              e.preventDefault();
              if (currentPage < totalPages) onPageChange(currentPage + 1);
            }}
          >
            <span>Sau</span>
            <ChevronRight className="size-4" />
          </PaginationLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

function cnPageNav(disabled) {
  return `gap-1 px-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 ${
    disabled ? "pointer-events-none opacity-40" : ""
  }`;
}

function CoursesExploreSidebar({
  selectedLevel,
  onLevelChange,
  selectedCategory,
  onCategoryChange,
  selectedFee,
  onFeeChange,
  categories,
  onClear,
  hasFilter,
}) {
  const filterSectionsOpenOnDesktop = () =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

  const [openLevel, setOpenLevel] = useState(filterSectionsOpenOnDesktop);
  const [openCategory, setOpenCategory] = useState(filterSectionsOpenOnDesktop);
  const [openFee, setOpenFee] = useState(filterSectionsOpenOnDesktop);

  const collapseFilterSections = () => {
    setOpenLevel(false);
    setOpenCategory(false);
    setOpenFee(false);
  };

  return (
    <ExploreFilterSidebar
      onClear={onClear}
      hasFilter={hasFilter}
      mobileCollapsible
      onMobilePanelOpen={collapseFilterSections}
    >
      <FilterSection title="Cấp độ" open={openLevel} onToggle={() => setOpenLevel((v) => !v)}>
        {LEVEL_OPTIONS.map((opt) => (
          <FilterRadio
            key={opt.value}
            active={selectedLevel === opt.value}
            onClick={() => onLevelChange(selectedLevel === opt.value ? null : opt.value)}
          >
            {opt.label}
          </FilterRadio>
        ))}
      </FilterSection>

      <FilterSection title="Danh mục" open={openCategory} onToggle={() => setOpenCategory((v) => !v)}>
        {categories.map((cat) => (
          <FilterRadio
            key={cat.value}
            active={selectedCategory === cat.value}
            onClick={() =>
              onCategoryChange(selectedCategory === cat.value ? null : cat.value)
            }
          >
            {cat.label}
          </FilterRadio>
        ))}
      </FilterSection>

      <FilterSection title="Học phí" open={openFee} onToggle={() => setOpenFee((v) => !v)}>
        {FEE_OPTIONS.map((opt) => (
          <FilterRadio
            key={opt.value}
            active={selectedFee === opt.value}
            onClick={() => onFeeChange(selectedFee === opt.value ? null : opt.value)}
          >
            {opt.label}
          </FilterRadio>
        ))}
      </FilterSection>
    </ExploreFilterSidebar>
  );
}

function CourseListRow({ course, formatPrice, onOpen }) {
  const ratingDisplay = course.rating != null ? course.rating.toFixed(1) : "—";
  const durationHours = Math.floor((course.duration || 0) / 60);
  const mentorLine = [course.mentorName, course.mentorTitle].filter(Boolean).join(" · ");

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group cursor-pointer rounded-md border border-slate-200/90 bg-white p-3 shadow-sm transition-all hover:border-violet-200 hover:shadow-md lg:flex lg:items-stretch lg:gap-5 lg:p-4"
    >
      <div className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-x-3 gap-y-2 lg:contents">
        <div className="relative row-span-2 h-[4.75rem] w-full shrink-0 overflow-hidden rounded-sm bg-violet-50 lg:row-span-auto lg:h-28 lg:w-40">
          <ImageWithFallback
            src={course.thumbnail}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>

        <div className="col-start-2 flex min-w-0 flex-col justify-between py-0.5 lg:flex-1">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="line-clamp-2 flex-1 text-sm font-bold leading-snug text-slate-900 group-hover:text-[#8037f4] lg:text-lg">
                {course.title}
              </h3>
              <p className="shrink-0 whitespace-nowrap pt-0.5 text-right text-[11px] font-black leading-tight text-[#8037f4] sm:text-xs lg:hidden">
                {formatPrice(course.price)}
              </p>
            </div>
            {course.description ? (
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 lg:mt-1.5 lg:text-sm">
                {course.description}
              </p>
            ) : null}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 lg:mt-2 lg:gap-3 lg:text-xs">
              <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-amber-600">
                <Star className="size-3 fill-amber-400 text-amber-400 lg:size-3.5" />
                {ratingDisplay}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1">
                <Clock className="size-3 lg:size-3.5" />
                {durationHours > 0 ? `${durationHours}h` : "—"}
              </span>
              <span className="shrink-0">{getLevelBadge(course.level)}</span>
            </div>
          </div>
          {mentorLine ? (
            <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-slate-500 lg:mt-2 lg:line-clamp-1 lg:truncate lg:text-xs">
              {mentorLine}
            </p>
          ) : null}
          <div className="mt-2 flex justify-end lg:hidden">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              className="flex size-9 items-center justify-center rounded-sm border-2 border-[#8037f4] text-[#8037f4] transition-colors hover:bg-violet-50"
              aria-label="Xem khóa học"
            >
              <ShoppingCart className="size-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      <div className="hidden shrink-0 flex-col items-end justify-between gap-2 py-0.5 lg:flex">
        <p className="text-right text-lg font-black text-[#8037f4]">{formatPrice(course.price)}</p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="flex size-10 items-center justify-center rounded-sm border-2 border-[#8037f4] text-[#8037f4] transition-colors hover:bg-violet-50"
          aria-label="Xem khóa học"
        >
          <ShoppingCart className="size-4" strokeWidth={2} />
        </button>
      </div>
    </article>
  );
}

const getLevelBadge = (level) => {
  const configs = {
    Beginner: {
      bg: "rgba(180,240,0,0.92)",
      text: "#1a3300",
      shadow: "0 2px 8px rgba(0,0,0,0.25)",
      label: "Cơ bản",
    },
    Intermediate: {
      bg: "rgba(128, 55, 244,0.92)",
      text: "#ffffff",
      shadow: "0 2px 8px rgba(128, 55, 244,0.45)",
      label: "Trung cấp",
    },
    Advanced: {
      bg: "rgba(255,140,66,0.92)",
      text: "#1F1F1F",
      shadow: "0 2px 8px rgba(255,140,66,0.45)",
      label: "Nâng cao",
    },
  };
  const cfg = configs[level] || configs.Intermediate;
  return (
    <span
      className="inline-block shrink-0 whitespace-nowrap rounded-sm px-2 py-0.5 text-[10px] font-bold lg:px-2.5 lg:py-1 lg:text-xs"
      style={{
        background: cfg.bg,
        color: cfg.text,
        boxShadow: cfg.shadow,
        backdropFilter: "blur(6px)",
        letterSpacing: "0.01em",
      }}
    >
      {cfg.label}
    </span>
  );
};

export function Courses() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [courses, setCourses] = useState([]);
  const [filterCategories, setFilterCategories] = useState(() => buildCourseFilterCategories());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (searchParams.get("tab") === "my-courses") {
      navigate("/my-courses", { replace: true });
    }
  }, [searchParams, navigate]);

  useEffect(() => {
    fetchCourses().then((res) => {
      if (res.success) {
        const mapped = res.courses.map((c) => {
          const { rating } = normalizeCourseStats(c.stats);
          return {
            id: c._id,
            title: c.title,
            description: c.description,
            thumbnail: mediaSrc(c.thumbnail, DEFAULT_COURSE_THUMB),
            category: c.topics?.[0] || "Kỹ năng khác",
            level: c.level === "basic" ? "Beginner" : c.level === "intermediate" ? "Intermediate" : "Advanced",
            mentorName: c.mentorId?.userId?.name || "Khuất danh",
            mentorAvatar: avatarSrc(c.mentorId?.userId?.avatar),
            mentorTitle: c.mentorId?.userId?.desiredPosition || "Chuyên gia",
            mentorCompany: c.mentorId?.userId?.currentCompany || "ProInterview",
            rating,
            duration: c.totalDurationMinutes || 120,
            price: c.price || 0,
            tags: c.tags || [],
            createdAt: c.createdAt ? new Date(c.createdAt).getTime() : 0,
          };
        });
        setCourses(mapped);
        setFilterCategories(buildCourseFilterCategories(res.courses));
      } else {
        toastApiError(res.error, "Không tải được danh sách khóa học.");
        setCourses([]);
        setFilterCategories(buildCourseFilterCategories());
      }
      setLoading(false);
    }).catch(() => {
      toastApiError("Lỗi kết nối khi tải khóa học.");
      setCourses([]);
      setFilterCategories(buildCourseFilterCategories());
      setLoading(false);
    });
  }, []);

  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedFee, setSelectedFee] = useState(null);
  const [sortBy, setSortBy] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);

  const exploreHasFilter =
    Boolean(selectedLevel) || Boolean(selectedCategory) || Boolean(selectedFee);

  const clearExploreFilters = () => {
    setSelectedLevel(null);
    setSelectedCategory(null);
    setSelectedFee(null);
  };

  const filteredCourses = useMemo(() => {
    const list = courses.filter((course) => {
      const matchLevel = !selectedLevel || course.level === selectedLevel;
      const matchCategory = courseMatchesTopic(course.category, selectedCategory);
      const matchFee =
        !selectedFee ||
        (selectedFee === "free" && course.price === 0) ||
        (selectedFee === "paid" && course.price > 0);
      return matchLevel && matchCategory && matchFee;
    });

    const sorted = [...list];
    switch (sortBy) {
      case "price_asc":
        sorted.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        sorted.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        break;
      case "newest":
      default:
        sorted.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        break;
    }
    return sorted;
  }, [courses, selectedLevel, selectedCategory, selectedFee, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredCourses.length / COURSES_PAGE_SIZE));

  const paginatedCourses = useMemo(() => {
    const start = (currentPage - 1) * COURSES_PAGE_SIZE;
    return filteredCourses.slice(start, start + COURSES_PAGE_SIZE);
  }, [filteredCourses, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedLevel, selectedCategory, selectedFee, sortBy]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const formatPrice = (price) => formatVnd(price, { freeLabel: "Miễn phí" });

  return (
    <MentorPageShell bottomPad="pb-20">
      <div className={`relative z-10 flex flex-col pb-8 pt-8 sm:pt-10 ${CUSTOMER_SHELL_GUTTER}`}>
        <div className={`${CUSTOMER_SHELL_MAX} w-full`}>
          <CustomerPageHeader
            title={
              <CustomerPageSplitTitle
                accent="Học kỹ năng,"
                rest="tự tin hơn khi ứng tuyển"
              />
            }
            titleClassName="font-headline text-[clamp(1.45rem,2.8vw,2.65rem)] font-extrabold leading-[1.12] tracking-tight"
            subtitle="Các khóa học do Mentor xây dựng, giúp bạn bổ sung kỹ năng cần thiết cho hành trình ứng tuyển."
            subtitleClassName="mt-3 max-w-none text-base font-medium leading-relaxed text-violet-700/90 lg:whitespace-nowrap"
          />

          <div className="w-full rounded-3xl border border-violet-200/80 bg-white px-5 py-5 shadow-sm sm:px-7 sm:py-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                  <CoursesExploreSidebar
                    selectedLevel={selectedLevel}
                    onLevelChange={setSelectedLevel}
                    selectedCategory={selectedCategory}
                    onCategoryChange={setSelectedCategory}
                    selectedFee={selectedFee}
                    onFeeChange={setSelectedFee}
                    categories={filterCategories}
                    onClear={clearExploreFilters}
                    hasFilter={exploreHasFilter}
                  />

                  <div className="min-w-0 flex-1">
                    <label className="mb-3 flex items-center gap-2 text-sm text-slate-600 lg:hidden">
                      <span className="shrink-0 font-medium">Sắp xếp theo</span>
                      <AppSelect
                        size="compact"
                        value={sortBy}
                        onValueChange={setSortBy}
                        triggerClassName="min-w-0 flex-1"
                        options={SORT_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
                      />
                    </label>

                    <div
                      className={`mb-4 lg:flex lg:flex-row lg:items-center lg:justify-between ${
                        exploreHasFilter
                          ? "rounded-xl bg-gradient-to-r from-violet-100/80 via-violet-50/50 to-slate-50 px-4 py-3"
                          : "lg:justify-end"
                      }`}
                    >
                      {exploreHasFilter ? (
                        <p className="text-sm font-semibold text-violet-950">
                          <span className="text-lg font-black">{filteredCourses.length}</span> kết quả
                          {selectedCategory ? (
                            <span className="font-normal text-slate-600">
                              {" "}
                              · {getCourseTopicLabel(selectedCategory)}
                            </span>
                          ) : null}
                          {selectedLevel ? (
                            <span className="font-normal text-slate-600">
                              {" "}
                              ·{" "}
                              {LEVEL_OPTIONS.find((o) => o.value === selectedLevel)?.label ||
                                selectedLevel}
                            </span>
                          ) : null}
                          {selectedFee ? (
                            <span className="font-normal text-slate-600">
                              {" "}
                              · {FEE_OPTIONS.find((o) => o.value === selectedFee)?.label}
                            </span>
                          ) : null}
                        </p>
                      ) : null}
                      <label
                        className={`hidden items-center gap-2 text-sm text-slate-600 lg:flex ${
                          exploreHasFilter ? "mt-3 lg:mt-0" : ""
                        }`}
                      >
                        <span className="shrink-0 font-medium">Sắp xếp theo</span>
                        <AppSelect
                          size="compact"
                          value={sortBy}
                          onValueChange={setSortBy}
                          options={SORT_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
                        />
                      </label>
                    </div>

                    {loading ? (
                      <div className="space-y-4">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className="h-28 animate-pulse rounded-xl border border-violet-100 bg-violet-50/50 sm:h-32"
                          />
                        ))}
                      </div>
                    ) : filteredCourses.length > 0 ? (
                      <>
                        <div className="space-y-4">
                          {paginatedCourses.map((course) => (
                            <CourseListRow
                              key={course.id}
                              course={course}
                              formatPrice={formatPrice}
                              onOpen={() => navigate(`/courses/${course.id}`)}
                            />
                          ))}
                        </div>
                        <CoursesPagination
                          currentPage={currentPage}
                          totalPages={totalPages}
                          onPageChange={setCurrentPage}
                        />
                      </>
                    ) : (
                      <div className="rounded-2xl border border-violet-100 bg-violet-50/30 py-16 text-center">
                        <Search className="mx-auto mb-4 size-12 text-violet-300" />
                        <h3 className="mb-2 text-lg font-bold text-violet-950">Không tìm thấy khóa học</h3>
                        <p className="mb-8 text-sm text-slate-600">Thử đổi bộ lọc nhé.</p>
                        <button
                          type="button"
                          onClick={clearExploreFilters}
                          className="rounded-xl bg-[#8037f4] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-violet-700"
                        >
                          Xóa bộ lọc
                        </button>
                      </div>
                    )}
                  </div>
            </div>
          </div>
        </div>
      </div>
    </MentorPageShell>
  );
}
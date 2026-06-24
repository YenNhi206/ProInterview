import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import React, { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Search as MagnifyingGlass,
  Star,
  X,
  Loader2 as CircleNotch,
  AlertCircle,
} from "lucide-react";
import { MentorListCard } from "../../components/mentor/MentorListCard";
import { fetchMentors } from "../../api/mentorApi.js";
import { fetchRebookCredit } from "../../api/bookingsApi.js";
import { toastApiError } from "../../utils/shared/apiToast.js";
import { formatVnd } from "../../utils/shared/formatVnd.js";
import {
  MENTOR_FILTER_FIELDS,
  mentorMatchesFilterField,
} from "../../constants/mentorFilterFields";
import { CustomerPageHeader, CustomerPageSplitTitle } from "../../components/layout/CustomerPageHeader";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";

import { ListPagination } from "../../components/shared/ListPagination";
import { ExploreFilterSidebar, FilterSection, FilterRadio } from "../../components/shared/ExploreFilterSidebar";

const EXPERIENCE_OPTIONS = [
  { label: "1-3 năm", value: "1-3" },
  { label: "4-6 năm", value: "4-6" },
  { label: "7+ năm", value: "7+" },
];

const PRICE_OPTIONS = [
  { label: "Dưới 280k", min: 0, max: 280000 },
  { label: "280k - 320k", min: 280000, max: 320000 },
  { label: "Trên 320k", min: 320000, max: Infinity },
];

const RATING_OPTIONS = [
  { label: "4.5+", min: 4.5 },
  { label: "4.0+", min: 4.0 },
  { label: "3.5+", min: 3.5 },
];

const MENTORS_PAGE_SIZE = 8;

function MentorsExploreSidebar({
  selectedField, onFieldChange,
  selectedExp, onExpChange,
  selectedPriceIndex, onPriceChange,
  selectedRating, onRatingChange,
  onClear, hasFilter
}) {
  const filterSectionsOpenOnDesktop = () =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

  const [openField, setOpenField] = useState(filterSectionsOpenOnDesktop);
  const [openExp, setOpenExp] = useState(filterSectionsOpenOnDesktop);
  const [openPrice, setOpenPrice] = useState(filterSectionsOpenOnDesktop);
  const [openRating, setOpenRating] = useState(filterSectionsOpenOnDesktop);

  const collapseFilterSections = () => {
    setOpenField(false);
    setOpenExp(false);
    setOpenPrice(false);
    setOpenRating(false);
  };

  return (
    <ExploreFilterSidebar
      onClear={onClear}
      hasFilter={hasFilter}
      mobileCollapsible
      onMobilePanelOpen={collapseFilterSections}
    >
      <FilterSection title="Lĩnh vực" open={openField} onToggle={() => setOpenField((v) => !v)}>
        {MENTOR_FILTER_FIELDS.map((opt) => (
          <FilterRadio
            key={opt}
            active={selectedField === opt}
            onClick={() => onFieldChange(selectedField === opt ? null : opt)}
          >
            {opt}
          </FilterRadio>
        ))}
      </FilterSection>

      <FilterSection title="Kinh nghiệm" open={openExp} onToggle={() => setOpenExp((v) => !v)}>
        {EXPERIENCE_OPTIONS.map((opt) => (
          <FilterRadio
            key={opt.value}
            active={selectedExp === opt.value}
            onClick={() => onExpChange(selectedExp === opt.value ? null : opt.value)}
          >
            {opt.label}
          </FilterRadio>
        ))}
      </FilterSection>

      <FilterSection title="Mức giá" open={openPrice} onToggle={() => setOpenPrice((v) => !v)}>
        {PRICE_OPTIONS.map((opt, i) => (
          <FilterRadio
            key={i}
            active={selectedPriceIndex === i}
            onClick={() => onPriceChange(selectedPriceIndex === i ? null : i)}
          >
            {opt.label}
          </FilterRadio>
        ))}
      </FilterSection>

      <FilterSection title="Đánh giá" open={openRating} onToggle={() => setOpenRating((v) => !v)}>
        {RATING_OPTIONS.map((opt) => (
          <FilterRadio
            key={opt.label}
            active={selectedRating === opt.label}
            onClick={() => onRatingChange(selectedRating === opt.label ? null : opt.label)}
          >
            Từ {opt.label} sao
          </FilterRadio>
        ))}
      </FilterSection>
    </ExploreFilterSidebar>
  );
}

export function Mentors() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rebookFrom =
    searchParams.get("rebookFrom") ||
    (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("prointerview_rebook_from") : "") ||
    "";
  const [rebookCredit, setRebookCredit] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedField, setSelectedField] = useState(null);
  const [selectedExp, setSelectedExp] = useState(null);
  const [selectedPriceIndex, setSelectedPriceIndex] = useState(null);
  const [selectedRating, setSelectedRating] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!rebookFrom) {
      setRebookCredit(null);
      return;
    }
    void fetchRebookCredit(rebookFrom)
      .then((r) => {
        if (r.success && r.credit?.available) {
          setRebookCredit(r.credit);
          return;
        }
        setRebookCredit(null);
        if (r && !r.success && r.error) toastApiError(r.error);
      })
      .catch(() => {
        setRebookCredit(null);
        toastApiError("Không tải được thông tin tín dụng đặt lại.");
      });
  }, [rebookFrom]);

  const bookingPath = (mentorId) => {
    const base = `/booking/${mentorId}`;
    return rebookFrom ? `${base}?rebookFrom=${encodeURIComponent(rebookFrom)}` : base;
  };

  useEffect(() => {
    setLoading(true);
    fetchMentors()
      .then((res) => {
        if (res.success) {
          setMentors(res.mentors || []);
          setError(null);
        } else {
          const msg = res.error || "Không tải được danh sách mentor.";
          setError(msg);
          setMentors([]);
          toastApiError(msg);
        }
      })
      .catch((e) => {
        const msg = e?.message || "Lỗi kết nối khi tải danh sách mentor.";
        setError(msg);
        setMentors([]);
        toastApiError(msg);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredMentors = useMemo(() => {
    return mentors.filter((m) => {
      const q = search.toLowerCase();
      const matchSearch =
        search === "" ||
        m.name.toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q) ||
        (m.bio || "").toLowerCase().includes(q) ||
        m.field.toLowerCase().includes(q) ||
        m.tags.some((t) => t.toLowerCase().includes(q));

      const matchField = mentorMatchesFilterField(m, selectedField);

      const matchExp =
        !selectedExp ||
        (selectedExp === "1-3" && m.experience <= 3) ||
        (selectedExp === "4-6" && m.experience >= 4 && m.experience <= 6) ||
        (selectedExp === "7+" && m.experience >= 7);

      const priceRange =
        selectedPriceIndex != null ? PRICE_OPTIONS[selectedPriceIndex] : null;
      const matchPrice =
        !priceRange || (m.price >= priceRange.min && m.price <= priceRange.max);

      const ratingMin = RATING_OPTIONS.find((r) => r.label === selectedRating)?.min;
      const matchRating = !ratingMin || m.rating >= ratingMin;

      return matchSearch && matchField && matchExp && matchPrice && matchRating;
    });
  }, [search, selectedField, selectedExp, selectedPriceIndex, selectedRating, mentors]);

  const totalPages = Math.max(1, Math.ceil(filteredMentors.length / MENTORS_PAGE_SIZE));

  const paginatedMentors = useMemo(() => {
    const start = (currentPage - 1) * MENTORS_PAGE_SIZE;
    return filteredMentors.slice(start, start + MENTORS_PAGE_SIZE);
  }, [filteredMentors, currentPage]);

  const hasFilter =
    Boolean(search) ||
    Boolean(selectedField) ||
    Boolean(selectedExp) ||
    selectedPriceIndex != null ||
    Boolean(selectedRating);

  const clearFilters = () => {
    setSearch("");
    setSelectedField(null);
    setSelectedExp(null);
    setSelectedPriceIndex(null);
    setSelectedRating(null);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedField, selectedExp, selectedPriceIndex, selectedRating]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  return (
    <MentorPageShell bottomPad="pb-20">
      <div className={`relative z-10 flex flex-col pb-8 pt-8 sm:pt-10 ${CUSTOMER_SHELL_GUTTER}`}>
        <div className={`${CUSTOMER_SHELL_MAX} w-full`}>
          {rebookCredit?.available ? (
            <div className="mb-6 rounded-2xl border border-violet-200/80 bg-violet-50/95 px-4 py-3 text-sm text-violet-950">
              <p className="font-bold">Credit đổi mentor</p>
              <p className="mt-1 text-xs leading-relaxed text-violet-900/90">
                Bạn có <strong>{formatVnd(rebookCredit.creditVnd || 0)}</strong> từ lịch mentor đã
                hủy. Chọn <strong>mentor khác</strong> — nếu giá buổi mới ≤ credit thì{" "}
                <strong>không cần chuyển khoản lại</strong>.
              </p>
            </div>
          ) : null}

          <CustomerPageHeader
            title={<CustomerPageSplitTitle accent="Kết nối Mentor" rest="phù hợp" />}
            titleClassName="font-headline text-[clamp(1.45rem,2.8vw,2.65rem)] font-extrabold leading-[1.12] tracking-tight"
            subtitle="Kết nối với Mentor để có thêm góc nhìn thực tế từ ngành, hiểu kỳ vọng của nhà tuyển dụng và chuẩn bị tự tin hơn cho buổi phỏng vấn thật."
            subtitleClassName="mt-3 max-w-none text-base font-medium leading-relaxed text-violet-700/90 lg:whitespace-nowrap"
            className="mb-6"
          />

          <div className="rounded-3xl border border-violet-200/80 bg-white px-5 py-5 shadow-sm sm:px-7 sm:py-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              <MentorsExploreSidebar
                selectedField={selectedField}
                onFieldChange={setSelectedField}
                selectedExp={selectedExp}
                onExpChange={setSelectedExp}
                selectedPriceIndex={selectedPriceIndex}
                onPriceChange={setSelectedPriceIndex}
                selectedRating={selectedRating}
                onRatingChange={setSelectedRating}
                onClear={clearFilters}
                hasFilter={hasFilter}
              />

              <div className="min-w-0 flex-1">
                {/* Search & Filters */}
                <div className="flex flex-col gap-4 mb-6">
                  <div className="relative">
                    <MagnifyingGlass className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-violet-400" />
                    <input
                      type="search"
                      className="w-full rounded-2xl border-2 border-violet-100 bg-slate-50/50 py-3.5 pl-12 pr-12 text-base font-medium shadow-sm transition-all focus:border-violet-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-500/10 hover:border-violet-200"
                      placeholder="Tìm theo tên, ngành, kỹ năng hoặc công ty..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {search ? (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-slate-100 p-1.5 text-slate-400 transition-colors hover:bg-violet-100 hover:text-violet-600"
                        aria-label="Xóa từ khóa"
                      >
                        <X className="size-4" />
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Results Area */}

                {hasFilter ? (
                  <div className="mb-4 rounded-xl bg-gradient-to-r from-violet-100/80 via-violet-50/50 to-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-violet-950">
                      {loading ? (
                        <span className="inline-flex items-center gap-2">
                          <CircleNotch className="size-4 animate-spin" />
                          Đang tải...
                        </span>
                      ) : (
                        <>
                          <span className="text-lg font-black">{filteredMentors.length}</span> mentor phù hợp
                          {search ? (
                            <span className="font-normal text-slate-600"> · &ldquo;{search}&rdquo;</span>
                          ) : null}
                          {selectedField ? (
                            <span className="font-normal text-slate-600"> · {selectedField}</span>
                          ) : null}
                          {selectedExp ? (
                            <span className="font-normal text-slate-600">
                              {" "}
                              · {EXPERIENCE_OPTIONS.find((o) => o.value === selectedExp)?.label}
                            </span>
                          ) : null}
                          {selectedPriceIndex != null ? (
                            <span className="font-normal text-slate-600">
                              {" "}
                              · {PRICE_OPTIONS[selectedPriceIndex].label}
                            </span>
                          ) : null}
                          {selectedRating ? (
                            <span className="font-normal text-slate-600"> · {selectedRating}</span>
                          ) : null}
                        </>
                      )}
                    </p>
                  </div>
                ) : null}

                {loading ? (
                  <div className="divide-y divide-slate-200/90">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="flex gap-4 py-7">
                        <div className="size-20 shrink-0 animate-pulse rounded-full bg-violet-100" />
                        <div className="flex-1 space-y-3">
                          <div className="h-5 w-48 animate-pulse rounded bg-violet-100" />
                          <div className="h-4 w-full max-w-md animate-pulse rounded bg-violet-50" />
                          <div className="h-4 w-3/4 animate-pulse rounded bg-violet-50" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : error ? (
                  <div className="rounded-2xl border border-violet-100 bg-violet-50/30 py-16 text-center">
                    <AlertCircle className="mx-auto mb-3 size-10 text-violet-400" />
                    <p className="font-medium text-violet-950">Không thể tải danh sách mentor</p>
                    <button
                      type="button"
                      onClick={() => {
                        setLoading(true);
                        fetchMentors()
                          .then((res) => {
                            if (res.success) {
                              setMentors(res.mentors || []);
                              setError(null);
                            } else {
                              const msg = res.error || "Không tải được danh sách mentor.";
                              setError(msg);
                              toastApiError(msg);
                            }
                          })
                          .catch(() => toastApiError("Lỗi kết nối khi tải danh sách mentor."))
                          .finally(() => setLoading(false));
                      }}
                      className="mt-4 rounded-xl bg-[#8037f4] px-6 py-2.5 text-sm font-bold text-white hover:bg-violet-700"
                    >
                      Thử lại
                    </button>
                  </div>
                ) : filteredMentors.length === 0 ? (
                  <div className="rounded-2xl border border-violet-100 bg-violet-50/30 py-16 text-center">
                    <MagnifyingGlass className="mx-auto mb-4 size-12 text-violet-300" />
                    <h3 className="mb-2 text-lg font-bold text-violet-950">Không tìm thấy mentor phù hợp</h3>
                    <p className="mb-6 text-sm text-slate-600">Thử đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="rounded-xl bg-[#8037f4] px-6 py-2.5 text-sm font-bold text-white hover:bg-violet-700"
                    >
                      Xóa bộ lọc
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-2 sm:px-5">
                      {paginatedMentors.map((mentor) => (
                        <MentorListCard
                          key={mentor.id}
                          mentor={mentor}
                          onOpenProfile={() => navigate(`/mentors/${mentor.id}`)}
                          onBook={() => navigate(bookingPath(mentor.id))}
                        />
                      ))}
                    </div>
                    <ListPagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MentorPageShell>
  );
}

import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "motion/react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Search as MagnifyingGlass,
  Star,
  X,
  Loader2 as CircleNotch,
  AlertCircle,
  ChevronDown,
  Filter,
  SlidersHorizontal,
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
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";
import { ListPagination } from "../../components/shared/ListPagination";
import { AppSelect } from "../../components/ui/AppSelect";

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

const TOPIC_OPTIONS = [
  { label: "CV Review", value: "cv_review" },
  { label: "Mock Interview", value: "mock_interview" },
  { label: "Career Advisory", value: "career_advisory" },
  { label: "Tech Stack Sharing", value: "tech_sharing" },
  { label: "Coding Practice", value: "coding_practice" }
];

const MENTORS_PAGE_SIZE = 8;

export function Mentors() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const glow1Y = useTransform(scrollYProgress, [0, 1], [0, -70]);
  const glow2Y = useTransform(scrollYProgress, [0, 1], [0, -45]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rebookFrom =
    searchParams.get("rebookFrom") ||
    (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("prointerview_rebook_from") : "") ||
    "";
  const [rebookCredit, setRebookCredit] = useState(null);
  const [search, setSearch] = useState("");
  
  // Custom filter states matching screenshot requirements
  const [selectedTopic, setSelectedTopic] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [titleSearch, setTitleSearch] = useState("");
  const [selectedSchedule, setSelectedSchedule] = useState("");
  
  // Advanced filters state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  // Original filters state
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
      // General keywords search
      const q = search.toLowerCase();
      const matchSearch =
        search === "" ||
        m.name.toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q) ||
        (m.bio || "").toLowerCase().includes(q) ||
        m.field.toLowerCase().includes(q) ||
        m.tags.some((t) => t.toLowerCase().includes(q));

      // Company specific filter
      const matchCompany =
        !companySearch ||
        (m.company || "").toLowerCase().includes(companySearch.toLowerCase());

      // Position/Title specific filter
      const matchTitle =
        !titleSearch ||
        (m.title || "").toLowerCase().includes(titleSearch.toLowerCase());

      // Topic selector (matches tags or fields)
      const matchTopic =
        !selectedTopic ||
        m.tags.some((t) => t.toLowerCase().includes(selectedTopic.toLowerCase())) ||
        m.field.toLowerCase().includes(selectedTopic.toLowerCase());

      // Schedule selector
      const matchSchedule =
        !selectedSchedule ||
        selectedSchedule === "all" ||
        (selectedSchedule === "today" && m.isOnline) ||
        (selectedSchedule === "week"); // "week" is the default calendar availability for all

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

      return (
        matchSearch &&
        matchCompany &&
        matchTitle &&
        matchTopic &&
        matchSchedule &&
        matchField &&
        matchExp &&
        matchPrice &&
        matchRating
      );
    });
  }, [
    search,
    companySearch,
    titleSearch,
    selectedTopic,
    selectedSchedule,
    selectedField,
    selectedExp,
    selectedPriceIndex,
    selectedRating,
    mentors,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredMentors.length / MENTORS_PAGE_SIZE));

  const paginatedMentors = useMemo(() => {
    const start = (currentPage - 1) * MENTORS_PAGE_SIZE;
    return filteredMentors.slice(start, start + MENTORS_PAGE_SIZE);
  }, [filteredMentors, currentPage]);

  const hasFilter =
    Boolean(search) ||
    Boolean(companySearch) ||
    Boolean(titleSearch) ||
    Boolean(selectedTopic) ||
    Boolean(selectedSchedule) ||
    Boolean(selectedField) ||
    Boolean(selectedExp) ||
    selectedPriceIndex != null ||
    Boolean(selectedRating);

  const clearFilters = () => {
    setSearch("");
    setCompanySearch("");
    setTitleSearch("");
    setSelectedTopic("");
    setSelectedSchedule("");
    setSelectedField(null);
    setSelectedExp(null);
    setSelectedPriceIndex(null);
    setSelectedRating(null);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    companySearch,
    titleSearch,
    selectedTopic,
    selectedSchedule,
    selectedField,
    selectedExp,
    selectedPriceIndex,
    selectedRating,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  return (
    <MentorPageShell bottomPad="pb-20" showAmbient={false}>
      {/* Hero Banner Section */}
      <div
        ref={heroRef}
        className="relative w-full text-center overflow-hidden"
        style={{
          backgroundImage: "linear-gradient(rgba(26, 19, 47, 0.8), rgba(26, 19, 47, 0.92)), url('/mentor_hero_handshake.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          paddingTop: "5rem",
          paddingBottom: "5rem",
          minHeight: "420px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {/* Glow Effects — parallax */}
        <motion.div style={{ y: glow1Y }} className="absolute top-0 left-1/4 w-[350px] h-[350px] rounded-full bg-[#8037f4]/20 blur-[90px] pointer-events-none" />
        <motion.div style={{ y: glow2Y }} className="absolute bottom-0 right-1/4 w-[300px] h-[300px] rounded-full bg-lime-500/10 blur-[80px] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 flex flex-col items-center">
          {rebookCredit?.available ? (
            <div className="w-full mb-6 max-w-2xl rounded-2xl border border-violet-800/40 bg-[#1a132f]/85 px-4 py-3 text-left text-sm text-violet-200 backdrop-blur-md shadow-md animate-in fade-in slide-in-from-top-2">
              <p className="font-bold text-lime-400">Credit đổi mentor</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                Bạn có <strong>{formatVnd(rebookCredit.creditVnd || 0)}</strong> từ lịch mentor đã
                hủy. Chọn <strong>mentor khác</strong> — nếu giá buổi mới ≤ credit thì{" "}
                <strong>không cần chuyển khoản lại</strong>.
              </p>
            </div>
          ) : null}

          {/* Heading */}
          <motion.h1
            className="font-headline text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-white mb-3"
            initial={{ opacity: 0, y: -28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
          >
            CỘNG ĐỒNG MENTOR
          </motion.h1>
          {/* Subtitle */}
          <motion.p
            className="text-sm sm:text-base font-medium text-slate-300 max-w-2xl mb-10 leading-relaxed"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut", delay: 0.2 }}
          >
            Tiến nhanh và xa hơn trong hành trình sự nghiệp cùng ProInterview
          </motion.p>

          {/* Search form overlay inside Hero */}
          <motion.div
            className="w-full bg-[#120b24]/90 border border-violet-850/50 p-2 rounded-3xl md:rounded-full shadow-2xl flex flex-col md:flex-row items-center gap-2 max-w-3xl backdrop-blur-lg"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
          >
            {/* Input Keyword */}
            <div className="flex-1 w-full relative pl-2">
              <input
                type="text"
                placeholder="Nhập từ khóa để tìm kiếm, ví dụ Tên, Công ty, Vị trí..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-white placeholder-slate-400 text-xs font-semibold px-4 py-3 outline-none border-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-violet-900/40 hover:text-white"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Separator */}
            <div className="hidden md:block h-6 w-px bg-violet-800/40 shrink-0" />

            {/* Dropdown Field */}
            <div className="w-full md:w-48 shrink-0">
              <AppSelect
                value={selectedField || ""}
                onValueChange={(val) => setSelectedField(val || null)}
                options={[
                  { value: "", label: "Chọn Lĩnh vực" },
                  ...MENTOR_FILTER_FIELDS.map((opt) => ({ value: opt, label: opt }))
                ]}
                triggerClassName="w-full !bg-transparent !border-none !text-white hover:!bg-violet-900/30 rounded-none shadow-none text-xs font-bold h-11 px-4"
              />
            </div>

            {/* Button TÌM KIẾM */}
            <button
              type="button"
              className="w-full md:w-auto bg-[#a3e635] hover:bg-[#84cc16] active:scale-98 transition-all px-6 py-3 rounded-full text-slate-900 font-black flex items-center justify-center gap-2 text-xs cursor-pointer shadow-md shadow-[#a3e635]/20"
            >
              <MagnifyingGlass className="size-3.5" />
              <span>TÌM KIẾM</span>
            </button>
          </motion.div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`relative z-10 flex flex-col pb-8 pt-8 ${CUSTOMER_SHELL_GUTTER}`}>
        <div className={`${CUSTOMER_SHELL_MAX} w-full`}>
          
          {/* Results count indicator and Toggle Button */}
          <motion.div
            className="mb-6 flex items-center justify-between px-1 border-b border-slate-100 pb-3"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
          >
            <p className="text-sm font-semibold text-slate-700">
              Tìm thấy <span className="text-base font-extrabold text-[#8037f4]">{filteredMentors.length}</span> Mentor cho bạn!
            </p>
            <button
              type="button"
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#8037f4] hover:text-[#6d28d9] transition-all cursor-pointer bg-violet-50 hover:bg-violet-100/80 px-4.5 py-2.5 rounded-full border border-violet-100"
            >
              <Filter className="size-3.5" />
              <span>Lọc kết quả</span>
              <ChevronDown className={`size-3.5 transition-transform duration-200 ${filtersOpen ? "rotate-180" : ""}`} />
            </button>
          </motion.div>

          {/* Collapsible Filter Bar */}
          {filtersOpen && (
            <div className="mb-8 rounded-3xl bg-[#1a132f] p-5.5 shadow-xl border border-violet-950/20 transition-all duration-300 animate-in fade-in slide-in-from-top-3">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 items-end">
                {/* Chọn Chủ đề */}
                <div className="flex flex-col gap-1.5">
                  <label className="px-1 text-[10px] font-extrabold uppercase tracking-wider text-violet-300/80">Chọn Chủ đề</label>
                  <AppSelect
                    value={selectedTopic}
                    onValueChange={setSelectedTopic}
                    options={[
                      { value: "", label: "Tất cả chủ đề" },
                      ...TOPIC_OPTIONS
                    ]}
                    triggerClassName="w-full !bg-violet-950/40 !border-violet-850 !text-slate-100 hover:!bg-violet-900/30 focus:!border-[#8037f4] focus:ring-2 focus:ring-violet-500/20 rounded-2xl h-[38px] text-xs font-bold"
                  />
                </div>

                {/* Tên công ty */}
                <div className="flex flex-col gap-1.5">
                  <label className="px-1 text-[10px] font-extrabold uppercase tracking-wider text-violet-300/80">Tên công ty</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Nhập tên công ty..."
                      value={companySearch}
                      onChange={(e) => setCompanySearch(e.target.value)}
                      className="w-full rounded-2xl border border-violet-850 bg-violet-950/40 px-4 py-2.5 text-xs font-bold text-slate-100 placeholder-slate-500 outline-none transition-all focus:border-[#8037f4] focus:ring-2 focus:ring-violet-500/20"
                    />
                    {companySearch && (
                      <button
                        type="button"
                        onClick={() => setCompanySearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-violet-900/40 hover:text-white"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Vị trí */}
                <div className="flex flex-col gap-1.5">
                  <label className="px-1 text-[10px] font-extrabold uppercase tracking-wider text-violet-300/80">Vị trí</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Nhập vị trí..."
                      value={titleSearch}
                      onChange={(e) => setTitleSearch(e.target.value)}
                      className="w-full rounded-2xl border border-violet-850 bg-violet-950/40 px-4 py-2.5 text-xs font-bold text-slate-100 placeholder-slate-500 outline-none transition-all focus:border-[#8037f4] focus:ring-2 focus:ring-violet-500/20"
                    />
                    {titleSearch && (
                      <button
                        type="button"
                        onClick={() => setTitleSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-violet-900/40 hover:text-white"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Lịch rảnh */}
                <div className="flex flex-col gap-1.5">
                  <label className="px-1 text-[10px] font-extrabold uppercase tracking-wider text-violet-300/80">Lịch rảnh</label>
                  <AppSelect
                    value={selectedSchedule}
                    onValueChange={setSelectedSchedule}
                    options={[
                      { value: "", label: "Tất cả thời gian" },
                      { value: "today", label: "Hôm nay" },
                      { value: "week", label: "Có sẵn tuần này" }
                    ]}
                    triggerClassName="w-full !bg-violet-950/40 !border-violet-850 !text-slate-100 hover:!bg-violet-900/30 focus:!border-[#8037f4] focus:ring-2 focus:ring-violet-500/20 rounded-2xl h-[38px] text-xs font-bold"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={clearFilters}
                    disabled={!hasFilter && !selectedTopic && !selectedSchedule}
                    className="flex-1 rounded-2xl border border-violet-850 bg-violet-950/30 py-2.5 text-xs font-extrabold text-slate-300 transition-all hover:bg-violet-900/20 disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
                  >
                    Xóa lọc
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    className="flex-1 rounded-2xl bg-lime-400 py-2.5 text-xs font-black text-violet-950 shadow-sm transition-all hover:bg-lime-300 hover:shadow-md active:scale-98 cursor-pointer"
                  >
                    ÁP DỤNG
                  </button>
                </div>
              </div>

              {/* Advanced Filters Toggle */}
              <div className="mt-4 pt-4 border-t border-violet-900/40">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-xs font-bold text-violet-300 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <SlidersHorizontal className="size-3.5" />
                  <span>{showAdvanced ? "Ẩn bộ lọc nâng cao" : "Hiện bộ lọc nâng cao"}</span>
                </button>

                {showAdvanced && (
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 animate-in fade-in duration-200">
                    {/* Kinh nghiệm */}
                    <div className="flex flex-col gap-1.5">
                      <label className="px-1 text-[10px] font-extrabold uppercase tracking-wider text-violet-300/80">Kinh nghiệm</label>
                      <AppSelect
                        value={selectedExp || ""}
                        onValueChange={(val) => setSelectedExp(val || null)}
                        options={[
                          { value: "", label: "Tất cả kinh nghiệm" },
                          ...EXPERIENCE_OPTIONS
                        ]}
                        triggerClassName="w-full !bg-violet-950/40 !border-violet-850 !text-slate-100 hover:!bg-violet-900/30 focus:!border-[#8037f4] focus:ring-2 focus:ring-violet-500/20 rounded-2xl h-[38px] text-xs font-bold"
                      />
                    </div>

                    {/* Mức giá */}
                    <div className="flex flex-col gap-1.5">
                      <label className="px-1 text-[10px] font-extrabold uppercase tracking-wider text-violet-300/80">Mức giá</label>
                      <AppSelect
                        value={selectedPriceIndex ?? ""}
                        onValueChange={(val) => setSelectedPriceIndex(val === "" ? null : Number(val))}
                        options={[
                          { value: "", label: "Tất cả mức giá" },
                          ...PRICE_OPTIONS.map((opt, i) => ({ value: i, label: opt.label }))
                        ]}
                        triggerClassName="w-full !bg-violet-950/40 !border-violet-850 !text-slate-100 hover:!bg-violet-900/30 focus:!border-[#8037f4] focus:ring-2 focus:ring-violet-500/20 rounded-2xl h-[38px] text-xs font-bold"
                      />
                    </div>

                    {/* Đánh giá */}
                    <div className="flex flex-col gap-1.5">
                      <label className="px-1 text-[10px] font-extrabold uppercase tracking-wider text-violet-300/80">Đánh giá</label>
                      <AppSelect
                        value={selectedRating || ""}
                        onValueChange={(val) => setSelectedRating(val || null)}
                        options={[
                          { value: "", label: "Tất cả đánh giá" },
                          ...RATING_OPTIONS.map((opt) => ({ value: opt.label, label: opt.label }))
                        ]}
                        triggerClassName="w-full !bg-violet-950/40 !border-violet-850 !text-slate-100 hover:!bg-violet-900/30 focus:!border-[#8037f4] focus:ring-2 focus:ring-violet-500/20 rounded-2xl h-[38px] text-xs font-bold"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Results Grid Area */}
          {loading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="rounded-3xl border border-violet-50 bg-white p-5 shadow-sm space-y-4 animate-pulse flex flex-col items-center">
                  <div className="size-24 rounded-full bg-violet-100/80" />
                  <div className="h-4 w-32 bg-violet-100 rounded" />
                  <div className="h-3 w-40 bg-violet-50 rounded" />
                  <div className="h-6 w-28 bg-emerald-50 rounded-full" />
                  <div className="w-full border-t border-slate-100 pt-3 flex justify-between">
                    <div className="h-3 w-16 bg-violet-50 rounded" />
                    <div className="h-3 w-12 bg-violet-50 rounded" />
                  </div>
                  <div className="h-8 w-full bg-slate-100 rounded-2xl" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-violet-100 bg-white py-16 text-center shadow-sm">
              <AlertCircle className="mx-auto mb-3 size-10 text-violet-400" />
              <p className="font-semibold text-violet-950">Không thể tải danh sách mentor</p>
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
                className="mt-4 rounded-xl bg-[#a3e635] px-6 py-2.5 text-sm font-bold text-slate-900 hover:bg-[#84cc16] cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          ) : filteredMentors.length === 0 ? (
            <div className="rounded-3xl border border-violet-100 bg-white py-16 text-center shadow-sm">
              <MagnifyingGlass className="mx-auto mb-4 size-12 text-violet-300" />
              <h3 className="mb-2 text-lg font-bold text-violet-950">Không tìm thấy mentor phù hợp</h3>
              <p className="mb-6 text-sm text-slate-600">Thử đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-xl bg-[#a3e635] px-6 py-2.5 text-sm font-bold text-slate-900 hover:bg-[#84cc16] cursor-pointer"
              >
                Xóa bộ lọc
              </button>
            </div>
          ) : (
            <>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentPage}
                  className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {paginatedMentors.map((mentor, index) => (
                    <motion.div
                      key={mentor.id}
                      className="h-full"
                      initial={{ opacity: 0, y: 44 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.12 }}
                      transition={{
                        duration: 0.48,
                        delay: (index % 4) * 0.09,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      <MentorListCard
                        mentor={mentor}
                        onOpenProfile={() => navigate(`/mentors/${mentor.id}`)}
                        onBook={() => navigate(bookingPath(mentor.id))}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>
              <motion.div
                className="mt-8"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: 0.1 }}
              >
                <ListPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </motion.div>
            </>
          )}
        </div>
      </div>
    </MentorPageShell>
  );
}

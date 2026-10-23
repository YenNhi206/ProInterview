import { Link } from "react-router";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { MentorHeroAtmosphere } from "../../components/mentor/MentorHeroAtmosphere";
import "../../../styles/mentor-search.css";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "motion/react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import {
  Search as MagnifyingGlass,
  Star,
  X,
  Loader2 as CircleNotch,
  AlertCircle,
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

const MENTORS_PAGE_SIZE = 8;

export function Mentors() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const glow1Y = useTransform(scrollYProgress, [0, 1], [0, -70]);
  const glow2Y = useTransform(scrollYProgress, [0, 1], [0, -45]);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const rebookFrom =
    searchParams.get("rebookFrom") ||
    (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("prointerview_rebook_from") : "") ||
    "";
  const [rebookCredit, setRebookCredit] = useState(null);
  const [search, setSearch] = useState("");
  
  const [selectedField, setSelectedField] = useState(null);

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

      return matchSearch && mentorMatchesFilterField(m, selectedField);
    });
  }, [search, selectedField, mentors]);

  const totalPages = Math.max(1, Math.ceil(filteredMentors.length / MENTORS_PAGE_SIZE));

  const paginatedMentors = useMemo(() => {
    const start = (currentPage - 1) * MENTORS_PAGE_SIZE;
    return filteredMentors.slice(start, start + MENTORS_PAGE_SIZE);
  }, [filteredMentors, currentPage]);

  const hasFilter = Boolean(search) || Boolean(selectedField);
  const clearFilters = () => {
    setSearch("");
    setSelectedField(null);
  };
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedField]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  return (
    <MentorPageShell bottomPad="pb-20" showAmbient={false}>
      {/* Hero Banner Section */}
      <div
        ref={heroRef}
        className="relative w-full overflow-hidden text-center"
        style={{
          paddingTop: "5rem",
          paddingBottom: "5rem",
          minHeight: "420px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {/* Unique Celestial & Orbital Atmosphere for Mentors (No horizontal waves, 100% seamless transparent) */}
        <MentorHeroAtmosphere />

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
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
          >
            CỘNG ĐỒNG MENTOR
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="text-sm sm:text-base font-medium text-slate-300 max-w-2xl mb-10 leading-relaxed"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut", delay: 0.18 }}
          >
            Tiến nhanh và xa hơn trong hành trình sự nghiệp cùng ProInterview
          </motion.p>

          {/* Search form overlay inside Hero — poda-style animated border */}
          <motion.div
            className="ms-wrap"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          >
            {/* Animated border layers */}
            <div className="ms-darkBorderBg" aria-hidden="true" />
            <div className="ms-border"       aria-hidden="true" />
            <div className="ms-white"        aria-hidden="true" />
            <div className="ms-glow"         aria-hidden="true" />

            {/* Actual bar content */}
            <div className="ms-inner flex-col md:flex-row">
              {/* Input Keyword */}
              <div className="flex-1 w-full relative pl-2">
                <input
                  type="text"
                  placeholder="Tìm mentor IT (React, Node.js, AI, DevOps...)"
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
              <div className="hidden md:block h-6 w-px bg-violet-700/30 shrink-0" />

              {/* Dropdown Field */}
              <div className="w-full md:w-52 shrink-0">
                <AppSelect
                  value={selectedField || ""}
                  onValueChange={(val) => setSelectedField(val || null)}
                  options={[
                    { value: "", label: "Tất cả chuyên môn IT" },
                    ...MENTOR_FILTER_FIELDS.map((opt) => ({ value: opt, label: opt }))
                  ]}
                  theme="dark"
                  noRing
                  triggerClassName="w-full !bg-transparent !border-none !text-white hover:!bg-violet-900/30 rounded-none shadow-none text-xs font-bold h-11 px-4 !ring-0 !outline-none focus-visible:!ring-0 focus-visible:!border-transparent"
                />
              </div>

              {/* Button TÌM KIẾM */}
              <button
                type="button"
                className="ms-cta-btn inline-flex shrink-0 items-center gap-3 rounded-full py-2.5 pl-5 pr-2.5 text-[13px] font-black text-[#93f72b] w-full md:w-auto justify-center cursor-pointer"
              >
                TÌM KIẾM
                <span className="ms-cta-icon">
                  <MagnifyingGlass className="size-3.5" />
                </span>
              </button>
            </div>
          </motion.div>

        </div>
      </div>

      {/* Main Content Area */}
      <div className={`relative z-10 flex flex-col pb-8 pt-8 ${CUSTOMER_SHELL_GUTTER}`}>
        <div className={`${CUSTOMER_SHELL_MAX} w-full`}>
          
          {/* Results count indicator and Toggle Button */}
          <motion.div
            className="mb-6 flex flex-wrap items-center justify-between gap-4 px-1 border-b border-white/10 pb-4"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
          >
            <p className="text-sm font-semibold text-slate-300">
              Tìm thấy <span className="text-base font-black text-[#93f72b]">{filteredMentors.length}</span> Mentor cho bạn!
            </p>
            <div className="flex max-w-full flex-wrap items-center gap-x-4 gap-y-3">
              <div className="text-left sm:text-right">
                <p className="text-xs font-semibold text-slate-200">Muốn Mentor chủ động tìm đến bạn?</p>
                <p id="mentor-request-action-description" className="mt-1 text-[11px] leading-relaxed text-slate-400">Gửi CV, JD và mục tiêu để nhận đề nghị hỗ trợ.</p>
              </div>
              <Link
                to="/mentor-requests/new"
                state={{ returnTo: `${location.pathname}${location.search}` }}
                aria-describedby="mentor-request-action-description"
                data-button-surface="none"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#c2ff86] bg-[#93f72b] px-5 py-2 text-xs font-bold text-[#142008] no-underline transition-colors hover:bg-[#aaff4d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#93f72b]"
              >Nhờ Mentor đề xuất hỗ trợ <span aria-hidden>→</span></Link>
            </div>
          </motion.div>

          {/* Results Grid Area */}
          {loading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="rounded-3xl border border-white/10 bg-[#18113c]/80 p-5 shadow-sm space-y-4 animate-pulse flex flex-col items-center">
                  <div className="size-24 rounded-full bg-white/10" />
                  <div className="h-4 w-32 bg-white/10 rounded" />
                  <div className="h-3 w-40 bg-white/5 rounded" />
                  <div className="h-6 w-28 bg-white/10 rounded-full" />
                  <div className="w-full border-t border-white/10 pt-3 flex justify-between">
                    <div className="h-3 w-16 bg-white/5 rounded" />
                    <div className="h-3 w-12 bg-white/5 rounded" />
                  </div>
                  <div className="h-8 w-full bg-white/10 rounded-2xl" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-white/10 bg-[#18113c]/80 py-16 text-center shadow-lg backdrop-blur-xl">
              <AlertCircle className="mx-auto mb-3 size-10 text-violet-400" />
              <p className="font-bold text-white text-base">Không thể tải danh sách mentor</p>
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
                className="mt-4 rounded-xl bg-[#93f72b] px-6 py-2.5 text-xs font-black text-[#0a0518] hover:bg-[#82e221] cursor-pointer shadow-md"
              >
                Thử lại
              </button>
            </div>
          ) : filteredMentors.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-[#18113c]/80 py-16 text-center shadow-lg backdrop-blur-xl">
              <MagnifyingGlass className="mx-auto mb-4 size-12 text-violet-400" />
              <h3 className="mb-2 text-lg font-bold text-white">Không tìm thấy mentor phù hợp</h3>
              <p className="mb-6 text-sm text-slate-300">Thử đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-xl bg-[#93f72b] px-6 py-2.5 text-xs font-black text-[#0a0518] hover:bg-[#82e221] cursor-pointer shadow-md"
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

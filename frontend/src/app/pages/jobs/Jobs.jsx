import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { motion } from "motion/react";
import { AlertCircle, Briefcase, Building2, Clock, MapPin, Search as MagnifyingGlass, Wallet, X } from "lucide-react";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { MentorHeroAtmosphere } from "../../components/mentor/MentorHeroAtmosphere";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";
import { ListPagination } from "../../components/shared/ListPagination";
import { AppSelect } from "../../components/ui/AppSelect";
import {
  CUSTOMER_PAGE_TITLE_CLASS,
  CUSTOMER_PAGE_TITLE_BASE,
  CUSTOMER_PAGE_TITLE_ACCENT,
  CUSTOMER_PAGE_SUBTITLE_CLASS,
} from "../../components/layout/CustomerPageHeader";
import { useRoleCategories } from "../../hooks/useRoleCategories.js";
import { listJobs } from "../../api/jobsApi.js";
import {
  JOB_EMPLOYMENT_TYPE_LABELS,
  JOB_LEVEL_LABELS,
  JOB_WORK_MODE_LABELS,
  activeJobFilterCount,
  jobDeadlineInfo,
  jobFiltersToQuery,
  readJobFilters,
} from "../../utils/jobs/jobFilters.js";
import "../../../styles/mentor-search.css";

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 400;

const toOptions = (labels, allLabel) => [
  { value: "", label: allLabel },
  ...Object.entries(labels).map(([value, label]) => ({ value, label })),
];
const LEVEL_OPTIONS = toOptions(JOB_LEVEL_LABELS, "Mọi cấp độ");
const EMPLOYMENT_OPTIONS = toOptions(JOB_EMPLOYMENT_TYPE_LABELS, "Mọi hình thức");
const WORK_MODE_OPTIONS = toOptions(JOB_WORK_MODE_LABELS, "Mọi nơi làm việc");

const FILTER_SELECT_CLASS =
  "h-10 w-full rounded-full border border-white/10 bg-white/[0.04] px-4 text-xs font-bold text-white hover:border-violet-400/50";

function JobCard({ job }) {
  const deadline = jobDeadlineInfo(job.closesAt);
  const company = job.company || {};
  return (
    <Link
      to={`/jobs/${job.id}`}
      className="flex h-full flex-col rounded-3xl border border-white/10 bg-[#18113c]/80 p-5 shadow-sm backdrop-blur-xl transition-colors hover:border-violet-400/50"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          {company.logo ? (
            <img src={company.logo} alt="" className="size-full object-cover" />
          ) : (
            <Building2 className="size-5 text-violet-300" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-headline text-base font-black leading-snug text-white">{job.title}</h3>
          <p className="mt-0.5 truncate text-xs font-semibold text-slate-400">{company.name || "Công ty đối tác"}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {job.roleCategoryName ? (
          <span className="rounded-full border border-[#93f72b]/30 bg-[#93f72b]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#93f72b]">
            {job.roleCategoryName}
          </span>
        ) : null}
        {/* Cấp "Thực tập" và hình thức "Thực tập" trùng chữ → chỉ hiện một lần. */}
        {[...new Set([JOB_LEVEL_LABELS[job.level], JOB_EMPLOYMENT_TYPE_LABELS[job.employmentType], JOB_WORK_MODE_LABELS[job.workMode]])]
          .filter(Boolean)
          .map((label) => (
            <span key={label} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300">
              {label}
            </span>
          ))}
      </div>

      {job.summary ? <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-slate-400">{job.summary}</p> : null}

      {job.requiredSkills?.length ? (
        <p className="mt-3 text-[11px] font-semibold text-slate-300">
          <span className="text-slate-500">Kỹ năng: </span>
          {job.requiredSkills.slice(0, 5).join(" · ")}
        </p>
      ) : null}

      <div className="mt-auto space-y-1.5 border-t border-white/10 pt-3 text-[11px] font-semibold text-slate-400">
        {job.location ? (
          <p className="flex items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0" aria-hidden /> {job.location}
          </p>
        ) : null}
        <p className="flex items-center gap-1.5">
          <Wallet className="size-3.5 shrink-0" aria-hidden /> {job.salaryRange || "Lương thỏa thuận"}
        </p>
        {deadline ? (
          <p className={`flex items-center gap-1.5 ${deadline.urgent ? "text-amber-300" : ""}`}>
            <Clock className="size-3.5 shrink-0" aria-hidden />
            Hạn nộp {deadline.date}
            {deadline.urgent ? ` · còn ${Math.max(deadline.daysLeft, 0)} ngày` : ""}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

/** JB-11: danh sách tin tuyển dụng đang mở của công ty đối tác, lọc qua `GET /api/jobs`. */
export function Jobs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readJobFilters(searchParams), [searchParams]);
  const query = jobFiltersToQuery(filters);
  const { roleCategories } = useRoleCategories();

  const [searchInput, setSearchInput] = useState(filters.q || "");
  const [result, setResult] = useState({ jobs: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  /** Đổi bộ lọc thì về trang 1; giữ URL làm nguồn sự thật để chia sẻ link được. */
  const updateFilters = (patch) => {
    const next = { ...filters, ...patch, page: patch.page ?? 1 };
    setSearchParams(new URLSearchParams(jobFiltersToQuery(next)), { replace: true });
  };

  useEffect(() => {
    setSearchInput(filters.q || "");
  }, [filters.q]);

  useEffect(() => {
    const value = searchInput.trim();
    if (value === (filters.q || "")) return undefined;
    const timer = setTimeout(() => updateFilters({ q: value }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams(query);
    params.set("limit", String(PAGE_SIZE));
    listJobs(params.toString()).then((res) => {
      if (!active) return;
      if (res.success) setResult({ jobs: res.jobs || [], pagination: res.pagination || null });
      else setError(res.error);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [query, reload]);

  const roleOptions = useMemo(
    () => [{ value: "", label: "Mọi nhóm vị trí" }, ...roleCategories.map((r) => ({ value: r.key, label: r.nameVi }))],
    [roleCategories],
  );
  const total = result.pagination?.total ?? 0;
  const totalPages = result.pagination?.totalPages ?? 1;
  const hasFilter = Boolean(filters.q) || activeJobFilterCount(filters) > 0;
  const clearFilters = () => {
    setSearchInput("");
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  return (
    <MentorPageShell bottomPad="pb-20" showAmbient={false}>
      <div className="relative w-full overflow-hidden pb-14 pt-20 text-center">
        <MentorHeroAtmosphere />
        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-4">
          <motion.h1
            className={`font-headline ${CUSTOMER_PAGE_TITLE_CLASS} mb-3 text-center`}
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
          >
            <span className={CUSTOMER_PAGE_TITLE_BASE}>Việc làm</span>{" "}
            <span className={CUSTOMER_PAGE_TITLE_ACCENT}>IT</span>
          </motion.h1>
          <motion.p
            className={`${CUSTOMER_PAGE_SUBTITLE_CLASS} mb-10`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut", delay: 0.18 }}
          >
            Tin tuyển dụng đang mở từ các công ty đối tác của ProInterview.
          </motion.p>

          <motion.form
            className="ms-wrap"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              updateFilters({ q: searchInput.trim() });
            }}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          >
            <div className="ms-darkBorderBg" aria-hidden="true" />
            <div className="ms-border" aria-hidden="true" />
            <div className="ms-white" aria-hidden="true" />
            <div className="ms-glow" aria-hidden="true" />
            <div className="ms-inner flex-col md:flex-row">
              <div className="relative w-full flex-1 pl-2">
                <input
                  type="search"
                  aria-label="Tìm việc làm"
                  placeholder="Tìm theo vị trí, kỹ năng hoặc địa điểm (React, Node.js, Hà Nội...)"
                  value={searchInput}
                  maxLength={100}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full border-none bg-transparent px-4 py-3 text-xs font-semibold text-white [html[data-workspace-theme=light]_&]:text-[#1e1338] placeholder-slate-400 [html[data-workspace-theme=light]_&]:placeholder-[#6b6785] outline-none"
                />
                {searchInput ? (
                  <button
                    type="button"
                    aria-label="Xóa từ khóa"
                    onClick={() => {
                      setSearchInput("");
                      updateFilters({ q: "" });
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-violet-900/40 hover:text-white [html[data-workspace-theme=light]_&]:text-slate-500 [html[data-workspace-theme=light]_&]:hover:bg-violet-100 [html[data-workspace-theme=light]_&]:hover:text-[#8037f4]"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>
              <button
                type="submit"
                className="ms-cta-btn inline-flex w-full shrink-0 cursor-pointer items-center justify-center gap-3 rounded-full py-2.5 pl-5 pr-2.5 text-[13px] font-black text-[#131f00] md:w-auto"
              >
                TÌM KIẾM
                <span className="ms-cta-icon">
                  <MagnifyingGlass className="size-3.5" />
                </span>
              </button>
            </div>
          </motion.form>
        </div>
      </div>

      <div className={`relative z-10 flex flex-col pb-8 pt-2 ${CUSTOMER_SHELL_GUTTER}`}>
        <div className={`${CUSTOMER_SHELL_MAX} w-full`}>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" role="group" aria-label="Bộ lọc việc làm">
            <AppSelect
              aria-label="Nhóm vị trí"
              value={filters.roleCategory || ""}
              onValueChange={(v) => updateFilters({ roleCategory: v })}
              options={roleOptions}
              theme="dark"
              triggerClassName={FILTER_SELECT_CLASS}
            />
            <AppSelect
              aria-label="Cấp độ"
              value={filters.level || ""}
              onValueChange={(v) => updateFilters({ level: v })}
              options={LEVEL_OPTIONS}
              theme="dark"
              triggerClassName={FILTER_SELECT_CLASS}
            />
            <AppSelect
              aria-label="Hình thức làm việc"
              value={filters.employmentType || ""}
              onValueChange={(v) => updateFilters({ employmentType: v })}
              options={EMPLOYMENT_OPTIONS}
              theme="dark"
              triggerClassName={FILTER_SELECT_CLASS}
            />
            <AppSelect
              aria-label="Nơi làm việc"
              value={filters.workMode || ""}
              onValueChange={(v) => updateFilters({ workMode: v })}
              options={WORK_MODE_OPTIONS}
              theme="dark"
              triggerClassName={FILTER_SELECT_CLASS}
            />
          </div>

          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-1 pb-4">
            <p className="text-sm font-semibold text-slate-300" aria-live="polite">
              {loading ? "Đang tải…" : (
                <>
                  Tìm thấy <span className="text-base font-black text-[#93f72b]">{total}</span> việc làm
                </>
              )}
            </p>
            {hasFilter ? (
              <button type="button" onClick={clearFilters} className="text-xs font-bold text-violet-300 hover:text-white">
                Xóa bộ lọc
              </button>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-3xl border border-white/10 bg-[#18113c]/80 py-16 text-center shadow-lg backdrop-blur-xl">
              <AlertCircle className="mx-auto mb-3 size-10 text-violet-400" />
              <p className="text-base font-bold text-white">{error}</p>
              <button
                type="button"
                onClick={() => setReload((n) => n + 1)}
                className="mt-4 rounded-xl bg-[#93f72b] px-6 py-2.5 text-xs font-black text-[#0a0518] hover:bg-[#82e221]"
              >
                Thử lại
              </button>
            </div>
          ) : loading && result.jobs.length === 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-60 animate-pulse rounded-3xl border border-white/10 bg-[#18113c]/80" />
              ))}
            </div>
          ) : result.jobs.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-[#18113c]/80 py-16 text-center shadow-lg backdrop-blur-xl">
              <Briefcase className="mx-auto mb-3 size-10 text-violet-400" />
              <p className="text-base font-bold text-white">
                {hasFilter ? "Không có việc làm nào khớp bộ lọc" : "Chưa có tin tuyển dụng nào đang mở"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {hasFilter ? "Thử từ khóa khác hoặc bỏ bớt bộ lọc." : "Tin mới từ công ty đối tác sẽ hiện ở đây."}
              </p>
              {hasFilter ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 rounded-xl bg-[#93f72b] px-6 py-2.5 text-xs font-black text-[#0a0518] hover:bg-[#82e221]"
                >
                  Xóa bộ lọc
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div
                className={`grid grid-cols-1 gap-5 transition-opacity sm:grid-cols-2 lg:grid-cols-3 ${loading ? "pointer-events-none opacity-50" : ""}`}
                aria-busy={loading}
              >
                {result.jobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
              {totalPages > 1 ? (
                <div className="mt-8">
                  <ListPagination
                    currentPage={filters.page}
                    totalPages={totalPages}
                    onPageChange={(page) => updateFilters({ page })}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </MentorPageShell>
  );
}

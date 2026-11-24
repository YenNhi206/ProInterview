import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  CircleDashed,
  Clock,
  ExternalLink,
  Flag,
  Globe,
  MapPin,
  Mic,
  Send,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";
import { getJob, getJobGap, reportJob } from "../../api/jobsApi.js";
import { getUser } from "../../utils/auth/auth.js";
import {
  JOB_EMPLOYMENT_TYPE_LABELS,
  JOB_LEVEL_LABELS,
  JOB_WORK_MODE_LABELS,
  jobDeadlineInfo,
} from "../../utils/jobs/jobFilters.js";
import {
  GAP_STATUS_LABELS,
  JOB_REPORT_MIN_DESCRIPTION,
  JOB_REPORT_REASONS,
  gapAudience,
  interviewUrl,
  jobReportError,
  mentorRequestUrl,
  safeInternalPath,
} from "../../utils/jobs/jobDetail.js";

const PANEL = "rounded-3xl border border-white/10 bg-[#18113c]/80 p-5 backdrop-blur-xl sm:p-6";
const CHIP = "rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300";
const PRIMARY_BTN =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[#93f72b] px-5 py-2.5 text-sm font-black text-[#131f00] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_BTN =
  "inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold text-white hover:border-violet-400/60 hover:bg-white/10";

const STATUS_STYLE = {
  met: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  below: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  no_evidence: "border-white/15 bg-white/5 text-slate-300",
};

function SectionTitle({ children }) {
  return <h2 className="font-headline mb-3 text-base font-black text-white">{children}</h2>;
}

function NextStep({ step }) {
  const to = safeInternalPath(step?.actionUrl);
  if (!step?.label || !to) return null;
  return (
    <Link to={to} className="mt-1 inline-block text-xs font-semibold text-violet-300 hover:text-white hover:underline">
      {step.label} →
    </Link>
  );
}

/** Khoảng thiếu năng lực và kỹ năng của ứng viên so với job (JB-05). */
function GapPanel({ jobId, audience, loginUrl }) {
  const [state, setState] = useState({ loading: audience === "candidate", error: "", gap: null });

  useEffect(() => {
    if (audience !== "candidate") return undefined;
    let active = true;
    getJobGap(jobId).then((res) => {
      if (!active) return;
      setState({ loading: false, error: res.success ? "" : res.error, gap: res.success ? res.gap : null });
    });
    return () => {
      active = false;
    };
  }, [jobId, audience]);

  if (audience === "guest") {
    return (
      <section className={PANEL} aria-labelledby="job-gap-title">
        <SectionTitle><span id="job-gap-title">Bạn còn thiếu gì cho job này?</span></SectionTitle>
        <p className="text-sm text-slate-400">Đăng nhập để so hồ sơ năng lực và CV mặc định của bạn với yêu cầu của job.</p>
        <Link to={loginUrl} className={`${PRIMARY_BTN} mt-4`}>Đăng nhập</Link>
      </section>
    );
  }
  if (audience !== "candidate") return null;

  const { loading, error, gap } = state;
  return (
    <section className={PANEL} aria-labelledby="job-gap-title" aria-busy={loading}>
      <SectionTitle><span id="job-gap-title">Bạn còn thiếu gì cho job này?</span></SectionTitle>
      {loading ? (
        <p className="text-sm text-slate-400" role="status">Đang so hồ sơ của bạn với job…</p>
      ) : error ? (
        <p className="flex items-start gap-2 text-sm text-red-300" role="alert"><AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}</p>
      ) : (
        <>
          <p className="mb-4 text-xs font-semibold text-slate-400">
            Đạt {gap.summary.competenciesMet}/{gap.summary.competenciesTotal} năng lực
            {gap.summary.competenciesNoEvidence ? ` · ${gap.summary.competenciesNoEvidence} chưa có dữ liệu` : ""}
            {gap.summary.skillsTotal ? ` · khớp ${gap.summary.skillsMatched}/${gap.summary.skillsTotal} kỹ năng` : ""}
          </p>

          {gap.competencies.length ? (
            <ul className="space-y-3">
              {gap.competencies.map((c) => (
                <li key={c.shrmKey} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold text-white">{c.name}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[c.status] || STATUS_STYLE.no_evidence}`}>
                      {GAP_STATUS_LABELS[c.status] || c.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Yêu cầu mức {c.requiredLevel}/5
                    {c.currentLevel !== null ? ` · bạn đang ở mức ${c.currentLevel}/5` : ""}
                  </p>
                  <NextStep step={c.nextStep} />
                </li>
              ))}
            </ul>
          ) : null}

          {gap.skills ? (
            <div className="mt-5">
              <h3 className="mb-2 text-sm font-black text-white">Kỹ năng trong CV</h3>
              {gap.skills.cv ? (
                <p className="mb-2 text-xs text-slate-400">So với CV mặc định: <strong className="text-slate-200">{gap.skills.cv.title || "CV"}</strong></p>
              ) : null}
              <div className="flex flex-wrap gap-1.5">
                {gap.skills.matched.map((s) => (
                  <span key={`m-${s}`} className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                    <CheckCircle2 className="size-3" aria-hidden /> {s}
                  </span>
                ))}
                {gap.skills.missing.map((m) => (
                  <span key={`x-${m.skill}`} className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                    <CircleDashed className="size-3" aria-hidden /> {m.skill}
                  </span>
                ))}
              </div>
              {gap.skills.missing.length ? <NextStep step={gap.skills.missing[0].nextStep} /> : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

/** Chỉ số của ứng viên với doanh nghiệp (JB-19). API chưa có: hiện hướng dẫn luyện câu của doanh nghiệp. */
function CompanyScorePanel({ jobId, companyName, audience }) {
  if (audience !== "candidate") return null;
  return (
    <section className={PANEL} aria-labelledby="job-company-score-title">
      <SectionTitle><span id="job-company-score-title">Chỉ số của bạn với {companyName || "doanh nghiệp này"}</span></SectionTitle>
      <p className="text-sm text-slate-400">Bạn chưa trả lời câu nào của doanh nghiệp này.</p>
      <Link to={interviewUrl(jobId)} className={`${SECONDARY_BTN} mt-4`}>
        <Mic className="size-4" aria-hidden /> Luyện phỏng vấn AI theo job này
      </Link>
    </section>
  );
}

function ReportDialog({ jobId, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const inputError = jobReportError({ reason, description });

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !sending && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, sending]);

  const submit = async (e) => {
    e.preventDefault();
    if (inputError || sending) return;
    setSending(true);
    setError("");
    const res = await reportJob(jobId, { reason, description });
    setSending(false);
    if (res.success) onDone();
    else setError(res.error);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation" onClick={() => !sending && onClose()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-report-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md rounded-3xl border border-white/10 bg-[#18113c] p-5 shadow-2xl sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="job-report-title" className="font-headline text-lg font-black text-white">Báo cáo tin tuyển dụng</h2>
          <button type="button" data-button-surface="none" aria-label="Đóng" onClick={onClose} disabled={sending} className="rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white">
            <X className="size-4" />
          </button>
        </div>
        <fieldset className="space-y-2" disabled={sending}>
          <legend className="mb-2 text-sm font-bold text-slate-200">Lý do</legend>
          {JOB_REPORT_REASONS.map((r) => (
            <label key={r.value} className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-300">
              <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="accent-[#93f72b]" />
              {r.label}
            </label>
          ))}
        </fieldset>
        <label className="mt-4 block text-sm font-bold text-slate-200" htmlFor="job-report-desc">Mô tả vấn đề</label>
        <textarea
          id="job-report-desc"
          rows={4}
          maxLength={2000}
          value={description}
          disabled={sending}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ví dụ: Công ty yêu cầu nộp phí trước khi phỏng vấn."
          className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-400/60"
        />
        <p className="mt-1 text-[11px] text-slate-500">Ít nhất {JOB_REPORT_MIN_DESCRIPTION} ký tự. Platform Moderator sẽ xem xét báo cáo.</p>
        {error ? <p className="mt-3 text-sm text-red-300" role="alert">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={sending} className={SECONDARY_BTN}>Hủy</button>
          <button type="submit" disabled={Boolean(inputError) || sending} title={inputError || undefined} className={PRIMARY_BTN}>
            {sending ? "Đang gửi…" : "Gửi báo cáo"}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * JB-12: chi tiết tin tuyển dụng `/jobs/:id` — mô tả, khoảng thiếu (JB-05), chỉ số với doanh nghiệp (JB-19),
 * luyện phỏng vấn theo job, gửi yêu cầu mentor gắn job, báo cáo (JB-04). Ứng tuyển chờ JB-08.
 */
export function JobDetail() {
  const { id } = useParams();
  const location = useLocation();
  const user = getUser();
  const audience = gapAudience(user);
  const loginUrl = `/login?redirect=${encodeURIComponent(location.pathname)}`;

  const [state, setState] = useState({ loading: true, error: "", job: null });
  const [reload, setReload] = useState(0);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    let active = true;
    setState({ loading: true, error: "", job: null });
    getJob(id).then((res) => {
      if (!active) return;
      setState({ loading: false, error: res.success ? "" : res.error, job: res.success ? res.job : null });
    });
    return () => {
      active = false;
    };
  }, [id, reload]);

  useEffect(() => {
    if (state.job?.title) document.title = `${state.job.title} | ProInterview`;
  }, [state.job?.title]);

  const { loading, error, job } = state;
  const company = job?.company || {};
  const deadline = job ? jobDeadlineInfo(job.closesAt) : null;
  const chips = job
    ? [...new Set([JOB_LEVEL_LABELS[job.level], JOB_EMPLOYMENT_TYPE_LABELS[job.employmentType], JOB_WORK_MODE_LABELS[job.workMode]])].filter(Boolean)
    : [];
  const canAct = audience === "candidate";

  return (
    <MentorPageShell bottomPad="pb-20">
      <div className={`relative z-10 flex flex-col pt-6 ${CUSTOMER_SHELL_GUTTER}`}>
        <div className={`${CUSTOMER_SHELL_MAX} w-full space-y-5`}>
          <Link to="/jobs" className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-300 hover:text-white">
            <ArrowLeft className="size-4" aria-hidden /> Việc làm
          </Link>

          {loading ? (
            <div className={`${PANEL} animate-pulse`} role="status" aria-label="Đang tải tin tuyển dụng">
              <div className="mb-3 h-6 w-1/2 rounded bg-white/10" />
              <div className="h-4 w-1/3 rounded bg-white/10" />
            </div>
          ) : error ? (
            <div className={`${PANEL} text-center`} role="alert">
              <AlertCircle className="mx-auto mb-3 size-10 text-violet-400" />
              <p className="text-sm font-semibold text-slate-200">{error}</p>
              <div className="mt-4 flex justify-center gap-2">
                <button type="button" onClick={() => setReload((v) => v + 1)} className={SECONDARY_BTN}>Thử lại</button>
                <Link to="/jobs" className={PRIMARY_BTN}>Xem việc làm khác</Link>
              </div>
            </div>
          ) : (
            <>
              <header className={PANEL}>
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                      {company.logo ? <img src={company.logo} alt="" className="size-full object-cover" /> : <Building2 className="size-6 text-violet-300" aria-hidden />}
                    </div>
                    <div className="min-w-0">
                      <h1 className="font-headline text-xl font-black leading-snug text-white sm:text-2xl">{job.title}</h1>
                      <p className="mt-0.5 text-sm font-semibold text-slate-400">{company.name || "Công ty đối tác"}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {job.roleCategoryName ? (
                          <span className="rounded-full border border-[#93f72b]/30 bg-[#93f72b]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#93f72b]">{job.roleCategoryName}</span>
                        ) : null}
                        {chips.map((label) => <span key={label} className={CHIP}>{label}</span>)}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-semibold text-slate-400">
                        {job.location ? <span className="flex items-center gap-1.5"><MapPin className="size-3.5" aria-hidden /> {job.location}</span> : null}
                        <span className="flex items-center gap-1.5"><Wallet className="size-3.5" aria-hidden /> {job.salaryRange || "Lương thỏa thuận"}</span>
                        {deadline ? (
                          <span className={`flex items-center gap-1.5 ${deadline.urgent ? "text-amber-300" : ""}`}>
                            <Clock className="size-3.5" aria-hidden /> Hạn nộp {deadline.date}
                            {deadline.urgent ? ` · còn ${Math.max(deadline.daysLeft, 0)} ngày` : ""}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col lg:items-stretch">
                    <button type="button" disabled className={PRIMARY_BTN} title="Chức năng ứng tuyển sẽ mở trong bản cập nhật tới">
                      <Send className="size-4" aria-hidden /> Ứng tuyển (sắp mở)
                    </button>
                    <Link to={canAct ? mentorRequestUrl(job.id) : loginUrl} className={SECONDARY_BTN}>
                      <Users className="size-4" aria-hidden /> Tìm mentor cho job này
                    </Link>
                    {reported ? (
                      <p className="text-center text-xs font-semibold text-emerald-300" role="status">Đã gửi báo cáo, cảm ơn bạn.</p>
                    ) : user ? (
                      <button type="button" data-button-surface="none" onClick={() => setReporting(true)} className="inline-flex items-center justify-center gap-1.5 px-2 py-1 text-xs font-bold text-slate-400 hover:text-red-300">
                        <Flag className="size-3.5" aria-hidden /> Báo cáo tin này
                      </button>
                    ) : null}
                  </div>
                </div>
              </header>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
                <div className="min-w-0 space-y-5">
                  <section className={PANEL} aria-labelledby="job-desc-title">
                    <SectionTitle><span id="job-desc-title">Mô tả công việc</span></SectionTitle>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">{job.description || job.summary || "Công ty chưa thêm mô tả."}</p>
                  </section>

                  {job.requiredSkills?.length || job.requiredCompetencies?.length ? (
                    <section className={PANEL} aria-labelledby="job-req-title">
                      <SectionTitle><span id="job-req-title">Yêu cầu</span></SectionTitle>
                      {job.requiredSkills?.length ? (
                        <>
                          <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">Kỹ năng</h3>
                          <div className="mb-4 flex flex-wrap gap-1.5">
                            {job.requiredSkills.map((s) => <span key={s} className={CHIP}>{s}</span>)}
                          </div>
                        </>
                      ) : null}
                      {job.requiredCompetencies?.length ? (
                        <>
                          <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">Năng lực</h3>
                          <ul className="space-y-1.5">
                            {job.requiredCompetencies.map((c) => (
                              <li key={c.shrmKey} className="flex items-center justify-between gap-3 text-sm text-slate-300">
                                <span>{c.name}</span>
                                <span className="shrink-0 text-xs font-bold text-slate-400">tối thiểu mức {c.minLevel}/5</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : null}
                    </section>
                  ) : null}

                  {company.name ? (
                    <section className={PANEL} aria-labelledby="job-company-title">
                      <SectionTitle><span id="job-company-title">Về {company.name}</span></SectionTitle>
                      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                        {company.industry ? <div><dt className="text-xs text-slate-500">Lĩnh vực</dt><dd className="text-slate-200">{company.industry}</dd></div> : null}
                        {company.size ? <div><dt className="text-xs text-slate-500">Quy mô</dt><dd className="text-slate-200">{company.size}</dd></div> : null}
                        {company.address ? <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Địa chỉ</dt><dd className="text-slate-200">{company.address}</dd></div> : null}
                      </dl>
                      {/^https?:\/\//i.test(company.website || "") ? (
                        <a href={company.website} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-violet-300 hover:text-white">
                          <Globe className="size-4" aria-hidden /> Website công ty <ExternalLink className="size-3" aria-hidden />
                        </a>
                      ) : null}
                    </section>
                  ) : null}
                </div>

                <aside className="min-w-0 space-y-5">
                  <GapPanel jobId={job.id} audience={audience} loginUrl={loginUrl} />
                  <CompanyScorePanel jobId={job.id} companyName={company.name} audience={audience} />
                </aside>
              </div>
            </>
          )}
        </div>
      </div>

      {reporting && job ? (
        <ReportDialog
          jobId={job.id}
          onClose={() => setReporting(false)}
          onDone={() => {
            setReporting(false);
            setReported(true);
          }}
        />
      ) : null}
    </MentorPageShell>
  );
}

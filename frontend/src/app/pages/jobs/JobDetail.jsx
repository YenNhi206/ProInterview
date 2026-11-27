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
  FileText,
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
import { applyToJob, getMyCompanyMetrics, listMyApplications } from "../../api/applicationsApi.js";
import { cvsApi } from "../../api/cvsApi.js";
import {
  APPLICATION_STATUS_TONE,
  applicationForJob,
  applyFormError,
  companyMetricsView,
  defaultCvId,
  statusLabelOf,
} from "../../utils/jobs/applications.js";
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

/** Chỉ số của ứng viên với doanh nghiệp (JB-19): câu doanh nghiệp đã trả lời trong phỏng vấn AI và điểm rubric (JB-07). */
function CompanyScorePanel({ jobId, companyId, companyName, audience }) {
  const [state, setState] = useState({ loading: true, error: "", view: null });

  useEffect(() => {
    if (audience !== "candidate" || !companyId) return undefined;
    let active = true;
    getMyCompanyMetrics(companyId).then((res) => {
      if (!active) return;
      setState({ loading: false, error: res.success ? "" : res.error, view: res.success ? companyMetricsView(res.metrics) : null });
    });
    return () => {
      active = false;
    };
  }, [audience, companyId]);

  if (audience !== "candidate") return null;
  const { loading, error, view } = state;
  const practice = (
    <Link to={interviewUrl(jobId)} className={`${SECONDARY_BTN} mt-4`}>
      <Mic className="size-4" aria-hidden /> Luyện phỏng vấn AI theo job này
    </Link>
  );
  return (
    <section className={PANEL} aria-labelledby="job-company-score-title" aria-busy={loading}>
      <SectionTitle><span id="job-company-score-title">Chỉ số của bạn với {companyName || "doanh nghiệp này"}</span></SectionTitle>
      {loading ? (
        <p className="text-sm text-slate-400" role="status">Đang tải chỉ số…</p>
      ) : error ? (
        <p className="flex items-start gap-2 text-sm text-red-300" role="alert"><AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}</p>
      ) : view.empty ? (
        <>
          <p className="text-sm text-slate-400">Bạn chưa trả lời câu nào của doanh nghiệp này.</p>
          {practice}
        </>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Điểm rubric TB</dt>
              <dd className="mt-1 text-xl font-black text-white">
                {view.average !== null ? view.average.toFixed(1) : "—"}<span className="text-xs font-semibold text-slate-500">/5</span>
              </dd>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Câu đã trả lời</dt>
              <dd className="mt-1 text-xl font-black text-white">
                {view.answeredCount}<span className="text-xs font-semibold text-slate-500">/{view.questionCount}</span>
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-400">
            {view.sessionCount} buổi phỏng vấn AI{view.lastAnsweredAt ? ` · gần nhất ${view.lastAnsweredAt}` : ""}
            {view.pendingScoringCount ? ` · ${view.pendingScoringCount} câu đang chấm` : ""}
          </p>
          {view.criteria.length ? (
            <ul className="mt-4 space-y-2.5">
              {view.criteria.map((c) => (
                <li key={c.key}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold text-slate-200">{c.name}</span>
                    <span className="shrink-0 font-bold tabular-nums text-white">{c.avg.toFixed(1)}/5</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
                    <div
                      className={`h-full rounded-full ${c.avg >= 4 ? "bg-[#93f72b]" : c.avg >= 3 ? "bg-violet-400" : "bg-amber-400"}`}
                      style={{ width: `${(c.avg / 5) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
            Doanh nghiệp chỉ thấy các chỉ số này khi bạn ứng tuyển và đồng ý chia sẻ.
          </p>
          {practice}
        </>
      )}
    </section>
  );
}

const APP_TONE_STYLE = {
  info: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  good: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  bad: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  muted: "border-white/15 bg-white/5 text-slate-300",
};

/** Hộp thoại ứng tuyển (JB-08): chọn CV trong kho + đồng ý chia sẻ. */
function ApplyDialog({ job, onClose, onDone }) {
  const [cvState, setCvState] = useState({ loading: true, error: "", cvs: [] });
  const [cvId, setCvId] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    cvsApi.list().then((res) => {
      if (!active) return;
      const cvs = res.success ? res.cvs || [] : [];
      setCvState({ loading: false, error: res.success ? "" : res.error || "Không tải được kho CV.", cvs });
      setCvId(defaultCvId(cvs));
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !sending && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, sending]);

  const inputError = applyFormError({ cvId, consent });
  const submit = async (e) => {
    e.preventDefault();
    if (inputError || sending) return;
    setSending(true);
    setError("");
    const res = await applyToJob(job.id, { cvId });
    setSending(false);
    if (res.success) onDone(res.application);
    else setError(res.error);
  };

  const companyName = job.company?.name || "doanh nghiệp";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation" onClick={() => !sending && onClose()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-apply-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#18113c] p-5 shadow-2xl sm:p-6"
      >
        <div className="mb-1 flex items-start justify-between gap-3">
          <h2 id="job-apply-title" className="font-headline text-lg font-black text-white">Ứng tuyển {job.title}</h2>
          <button type="button" data-button-surface="none" aria-label="Đóng" onClick={onClose} disabled={sending} className="rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white">
            <X className="size-4" />
          </button>
        </div>
        <p className="mb-4 text-xs text-slate-400">{companyName} · Mỗi tin chỉ ứng tuyển được một lần, rút đơn rồi không nộp lại.</p>

        <fieldset disabled={sending}>
          <legend className="mb-2 text-sm font-bold text-slate-200">Chọn CV</legend>
          {cvState.loading ? (
            <p className="text-sm text-slate-400" role="status">Đang tải kho CV…</p>
          ) : cvState.error ? (
            <p className="text-sm text-red-300" role="alert">{cvState.error}</p>
          ) : cvState.cvs.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
              Kho CV của bạn đang trống. <Link to="/cvs" className="font-bold text-[#93f72b] hover:underline">Tải CV vào kho</Link> rồi quay lại ứng tuyển.
            </p>
          ) : (
            <ul className="space-y-2">
              {cvState.cvs.map((cv) => {
                const invalid = cv.isValidCv === false;
                const on = cvId === cv.id;
                return (
                  <li key={cv.id}>
                    <label
                      className={`flex items-start gap-3 rounded-2xl border p-3 text-sm transition-colors ${
                        invalid ? "cursor-not-allowed border-white/5 opacity-50" : on ? "cursor-pointer border-[#93f72b] bg-[#93f72b]/[0.08]" : "cursor-pointer border-white/10 bg-white/[0.03] hover:border-white/25"
                      }`}
                    >
                      <input type="radio" name="cv" value={cv.id} checked={on} disabled={invalid} onChange={() => setCvId(cv.id)} className="mt-0.5 accent-[#93f72b]" />
                      <FileText className="mt-0.5 size-4 shrink-0 text-violet-300" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold text-white">
                          {cv.title || "CV"}
                          {cv.isDefault ? <span className="ml-2 text-[11px] font-semibold text-[#93f72b]">Mặc định</span> : null}
                        </span>
                        <span className="block truncate text-xs text-slate-400">
                          {invalid ? "Tệp này không được nhận là CV" : [cv.targetRole, cv.fileName || "CV soạn trên ProInterview"].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
          <input type="checkbox" checked={consent} disabled={sending} onChange={(e) => setConsent(e.target.checked)} className="mt-1 accent-[#93f72b]" />
          <span>
            Tôi đồng ý chia sẻ với <strong className="text-white">{companyName}</strong>: họ tên, email, hồ sơ năng lực, CV đã chọn và
            kết quả trả lời câu hỏi của doanh nghiệp này trong phỏng vấn AI. Doanh nghiệp xem bản chụp tại thời điểm nộp; rút đơn thì bản chụp bị xóa.
          </span>
        </label>

        {error ? <p className="mt-3 text-sm text-red-300" role="alert">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={sending} className={SECONDARY_BTN}>Hủy</button>
          <button type="submit" disabled={Boolean(inputError) || sending || cvState.loading} title={inputError || undefined} className={PRIMARY_BTN}>
            <Send className="size-4" aria-hidden /> {sending ? "Đang nộp…" : "Nộp đơn"}
          </button>
        </div>
      </form>
    </div>
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
        className="max-h-[90vh] overflow-y-auto w-full max-w-md rounded-3xl border border-white/10 bg-[#18113c] p-5 shadow-2xl sm:p-6"
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
  // JB-08: đơn của ứng viên cho job này (undefined = đang tải, null = chưa ứng tuyển).
  const [myApplication, setMyApplication] = useState(undefined);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (audience !== "candidate") return undefined;
    let active = true;
    listMyApplications().then((res) => {
      if (active) setMyApplication(res.success ? applicationForJob(res.applications, id) : null);
    });
    return () => {
      active = false;
    };
  }, [audience, id]);

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
                          <span className="job-role-badge rounded-full border border-[#93f72b]/30 bg-[#93f72b]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#93f72b] [html[data-workspace-theme=light]_&]:border-violet-200 [html[data-workspace-theme=light]_&]:bg-violet-50 [html[data-workspace-theme=light]_&]:text-[#6d28d9]">{job.roleCategoryName}</span>
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
                    {audience === "guest" ? (
                      <Link to={loginUrl} className={PRIMARY_BTN}>
                        <Send className="size-4" aria-hidden /> Đăng nhập để ứng tuyển
                      </Link>
                    ) : !canAct ? null : myApplication ? (
                      <div className="flex flex-col items-stretch gap-1.5 text-center">
                        <span className={`rounded-full border px-4 py-2 text-sm font-bold ${APP_TONE_STYLE[APPLICATION_STATUS_TONE[myApplication.status]] || APP_TONE_STYLE.muted}`}>
                          {applied ? "Đã nộp đơn" : `Đã ứng tuyển · ${statusLabelOf(myApplication)}`}
                        </span>
                        {myApplication.status === "withdrawn" && (
                          <p className="max-w-[17rem] self-center text-[11px] leading-snug text-slate-400">
                            Bạn đã rút đơn cho tin này nên không thể ứng tuyển lại.
                          </p>
                        )}
                        <Link to="/my-applications" className="text-xs font-bold text-violet-300 hover:text-white">Xem đơn ứng tuyển</Link>
                      </div>
                    ) : (
                      <button type="button" disabled={myApplication === undefined} onClick={() => setApplying(true)} className={PRIMARY_BTN}>
                        <Send className="size-4" aria-hidden /> Ứng tuyển
                      </button>
                    )}
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
                  <CompanyScorePanel jobId={job.id} companyId={company.id} companyName={company.name} audience={audience} />
                </aside>
              </div>
            </>
          )}
        </div>
      </div>

      {applying && job ? (
        <ApplyDialog
          job={job}
          onClose={() => setApplying(false)}
          onDone={(application) => {
            setApplying(false);
            setApplied(true);
            setMyApplication(application ?? { status: "submitted", statusLabel: "Đã nộp" });
          }}
        />
      ) : null}

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

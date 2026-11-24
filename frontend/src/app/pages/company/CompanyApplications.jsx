import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquareQuote,
  RefreshCw,
  ShieldCheck,
  Star,
  UserX,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { companyApi } from "../../api/companyApi.js";
import { competenciesApi } from "../../api/competenciesApi.js";
import { tryApi } from "../../utils/shared/apiToast.js";
import { competencyCards } from "../../utils/profile/candidateProfile.js";
import { SHRM_NO_DATA_LABEL } from "../../utils/interview/feedbackModeration.js";
import {
  APPLICATION_NOTE_MAX,
  APPLICATION_STATUS,
  APPLICATION_STATUS_TABS,
  answersBySession,
  applicationActions,
  cvSections,
  formatApplicationDate,
  formatRubricScore,
} from "../../utils/company/applicationReview.js";

const PAGE_SIZE = 20;
const STATUS_STYLE = {
  submitted: "bg-violet-500/15 text-violet-300",
  viewed: "bg-sky-500/10 text-sky-300",
  shortlisted: "bg-emerald-500/10 text-emerald-400",
  rejected: "bg-rose-500/10 text-rose-400",
  withdrawn: "bg-slate-500/15 text-slate-400",
};
const cardCls = "rounded-2xl border border-slate-800 bg-[#120c22]/60 p-5 backdrop-blur-xl";

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status] || STATUS_STYLE.submitted}`}>
      {APPLICATION_STATUS[status] || status}
    </span>
  );
}

/**
 * /company/applications — JB-16 (CM-04). Company Moderator xem đơn ứng tuyển vào job của công ty (API JB-09),
 * lọc theo trạng thái / tin, mở chi tiết để xem CV, thẻ năng lực, chỉ số JB-19 và câu trả lời kèm điểm rubric.
 */
export function CompanyApplications() {
  const navigate = useNavigate();
  const [apps, setApps] = useState([]);
  const [counts, setCounts] = useState({});
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [status, setStatus] = useState("");
  const [jobPostId, setJobPostId] = useState("");
  const [jobs, setJobs] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchApps = useCallback(async () => {
    setLoading(true);
    const res = await tryApi(() => companyApi.listApplications({ status, jobPostId, page, limit: PAGE_SIZE }), {
      fallback: "Không tải được danh sách đơn ứng tuyển.",
    });
    setLoading(false);
    if (!res.success) return;
    setApps(res.applications || []);
    setCounts(res.counts || {});
    setPagination(res.pagination || { page: 1, totalPages: 1, total: 0 });
  }, [status, jobPostId, page]);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  useEffect(() => {
    companyApi.listJobs({ limit: 50 }).then((res) => res?.success && setJobs(res.jobs || [])).catch(() => {});
  }, []);

  const totalAll = Object.values(counts).reduce((s, n) => s + (Number(n) || 0), 0);
  const open = (app) => navigate(`/company/applications/${app.id}`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-white">
          <Users className="size-6 text-violet-400" />
          Đơn ứng tuyển
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Ứng viên đã nộp đơn và đồng ý chia sẻ CV, hồ sơ năng lực và kết quả trả lời câu hỏi của công ty. Mở đơn để shortlist hoặc từ chối.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-[#120c22]/60 p-3.5 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Lọc theo trạng thái">
          {APPLICATION_STATUS_TABS.map((s) => {
            const active = status === s;
            const n = s ? counts[s] || 0 : totalAll;
            return (
              <button
                key={s || "all"}
                role="tab"
                aria-selected={active}
                onClick={() => { setStatus(s); setPage(1); }}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${active ? "bg-violet-600 text-white" : "border border-slate-800 bg-[#0b0716] text-slate-400 hover:text-white"}`}
              >
                {s ? APPLICATION_STATUS[s] : "Tất cả"} <span className="ml-1 opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={jobPostId}
            onChange={(e) => { setJobPostId(e.target.value); setPage(1); }}
            aria-label="Lọc theo tin tuyển dụng"
            className="max-w-[240px] rounded-xl border border-slate-800 bg-[#0b0716] px-3 py-1.5 text-xs text-slate-300 focus:border-violet-500 focus:outline-none"
          >
            <option value="">Tất cả tin tuyển dụng</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
          <button onClick={fetchApps} title="Làm mới" aria-label="Làm mới" className="rounded-xl border border-slate-800 bg-[#0b0716] p-2 text-slate-400 transition hover:text-white">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#120c22]/60 backdrop-blur-xl">
        {loading && !apps.length ? (
          <div className="py-12 text-center text-slate-400">
            <Loader2 className="mx-auto size-6 animate-spin text-violet-500" />
            <span className="mt-2 block text-xs">Đang tải đơn ứng tuyển...</span>
          </div>
        ) : apps.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Users className="mx-auto size-8 text-slate-600" />
            <p className="mt-2 font-medium text-slate-300">{status || jobPostId ? "Không có đơn nào khớp bộ lọc" : "Chưa có đơn ứng tuyển"}</p>
            <p className="mt-0.5 text-xs text-slate-500">Đơn hiện ở đây khi ứng viên ứng tuyển vào tin đang đăng của công ty.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-[#0b0716]/60 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="min-w-[200px] px-4 py-3">Ứng viên</th>
                  <th className="min-w-[160px] px-3 py-3">Tin tuyển dụng</th>
                  <th className="px-3 py-3">Câu đã trả lời</th>
                  <th className="px-3 py-3">Điểm rubric</th>
                  <th className="px-3 py-3">Trạng thái</th>
                  <th className="px-3 py-3">Ngày nộp</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {apps.map((app) => {
                  const withdrawn = app.status === "withdrawn";
                  const name = withdrawn ? app.candidateName : app.candidate?.name;
                  return (
                    <tr key={app.id} className="align-top text-slate-300 transition hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        {withdrawn ? (
                          <span className="text-sm font-semibold text-slate-400">{name || "Ứng viên"}</span>
                        ) : (
                          <button onClick={() => open(app)} className="text-left text-sm font-semibold text-white hover:text-violet-300">
                            {name || "Ứng viên"}
                          </button>
                        )}
                        {!withdrawn && (
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
                            {app.cv?.title && <span className="inline-flex items-center gap-1"><FileText className="size-3" />{app.cv.title}</span>}
                            {app.isVerified && <span className="inline-flex items-center gap-1 text-emerald-400"><BadgeCheck className="size-3" />Hồ sơ đã xác thực</span>}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3">{app.jobTitle || "—"}</td>
                      <td className="px-3 py-3">{withdrawn ? "—" : app.companyMetrics?.answeredCount ?? 0}</td>
                      <td className="px-3 py-3 font-semibold text-white">{withdrawn ? "—" : formatRubricScore(app.companyMetrics?.rubricScoreAvg)}</td>
                      <td className="px-3 py-3"><StatusBadge status={app.status} /></td>
                      <td className="px-3 py-3 text-slate-500">{formatApplicationDate(app.submittedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        {withdrawn ? (
                          <span className="text-[11px] text-slate-500">Không còn dữ liệu</span>
                        ) : (
                          <button onClick={() => open(app)} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 font-semibold text-slate-200 hover:bg-slate-800">
                            Xem đơn
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-800 px-4 py-2.5 text-xs text-slate-400">
            <span>Trang {pagination.page}/{pagination.totalPages} · {pagination.total} đơn</span>
            <div className="flex gap-1.5">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Trang trước" className="rounded-lg border border-slate-800 p-1.5 disabled:opacity-40"><ChevronLeft className="size-3.5" /></button>
              <button disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Trang sau" className="rounded-lg border border-slate-800 p-1.5 disabled:opacity-40"><ChevronRight className="size-3.5" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children, aside }) {
  return (
    <section className={cardCls}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-white">
          <Icon className="size-4 text-violet-400" />
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }) {
  return <p className="text-xs text-slate-500">{children}</p>;
}

function CvSection({ cv }) {
  const data = cvSections(cv);
  if (!data) return <Section icon={FileText} title="CV"><Empty>Đơn không kèm CV.</Empty></Section>;
  return (
    <Section
      icon={FileText}
      title={`CV · ${data.title}`}
      aside={data.fileUrl ? (
        <a href={data.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800">
          <ExternalLink className="size-3.5" /> Mở file CV
        </a>
      ) : null}
    >
      <div className="space-y-4 text-xs text-slate-300">
        {data.targetRole && <p><span className="text-slate-500">Vị trí mong muốn:</span> {data.targetRole}</p>}
        {data.summary && <p className="whitespace-pre-line leading-relaxed">{data.summary}</p>}
        {data.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {data.skills.map((s) => <span key={s} className="rounded-md border border-slate-700 bg-slate-800/50 px-2 py-0.5 text-[11px]">{s}</span>)}
          </div>
        )}
        {data.experiences.length > 0 && (
          <div>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Kinh nghiệm</h3>
            <ul className="space-y-2.5">
              {data.experiences.map((e, i) => (
                <li key={i}>
                  <p className="font-semibold text-white">{e.title}</p>
                  {e.period && <p className="text-[11px] text-slate-500">{e.period}</p>}
                  {e.description && <p className="mt-1 whitespace-pre-line">{e.description}</p>}
                  {e.bullets.length > 0 && <ul className="mt-1 list-disc space-y-0.5 pl-4">{e.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.projects.length > 0 && (
          <div>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Dự án</h3>
            <ul className="space-y-2.5">
              {data.projects.map((p, i) => (
                <li key={i}>
                  <p className="font-semibold text-white">
                    {p.name}{p.role ? <span className="font-normal text-slate-400"> · {p.role}</span> : null}
                    {p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" className="ml-2 text-violet-300 hover:underline">Link</a>}
                  </p>
                  {p.description && <p className="mt-1 whitespace-pre-line">{p.description}</p>}
                  {p.technologies.length > 0 && <p className="mt-1 text-[11px] text-slate-500">{p.technologies.join(", ")}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.educations.length > 0 && (
          <div>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Học vấn</h3>
            <ul className="space-y-1.5">
              {data.educations.map((e, i) => (
                <li key={i}><span className="font-semibold text-white">{e.institution}</span>{e.title ? ` · ${e.title}` : ""}{e.period ? <span className="text-slate-500"> ({e.period})</span> : null}</li>
              ))}
            </ul>
          </div>
        )}
        {data.certifications.length > 0 && (
          <div>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Chứng chỉ</h3>
            <ul className="space-y-1">{data.certifications.map((c, i) => <li key={i}>{c.name}{c.issuer ? <span className="text-slate-500"> · {c.issuer}</span> : null}</li>)}</ul>
          </div>
        )}
      </div>
    </Section>
  );
}

function CompetencySection({ profile, framework }) {
  const cards = useMemo(() => competencyCards(profile?.competencies || [], framework), [profile, framework]);
  return (
    <Section
      icon={ShieldCheck}
      title="Thẻ năng lực"
      aside={profile?.isVerified ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400"><BadgeCheck className="size-3.5" />Hồ sơ đã xác thực</span> : null}
    >
      {profile?.headline && <p className="mb-3 text-xs text-slate-300">{profile.headline}</p>}
      {cards.length === 0 ? (
        <Empty>Ứng viên chưa có năng lực nào được ghi nhận lúc nộp đơn.</Empty>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {cards.map((c) => (
            <li key={c.key} className="rounded-xl border border-slate-800 bg-[#0b0716]/60 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white">{c.name}</span>
                <span className={`text-xs font-bold ${c.verified ? "text-violet-300" : "text-slate-500"}`}>
                  {c.verified ? `${c.level}/5` : SHRM_NO_DATA_LABEL}
                </span>
              </div>
              {c.verified && (
                <>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-violet-500" style={{ width: `${(c.level / 5) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">{c.evidenceCount} bằng chứng</p>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {profile?.capturedAt && <p className="mt-3 text-[11px] text-slate-500">Chụp lúc nộp đơn: {formatApplicationDate(profile.capturedAt, true)}</p>}
    </Section>
  );
}

function MetricsSection({ metrics }) {
  if (!metrics) {
    return <Section icon={Star} title="Chỉ số với công ty"><Empty>Không có chỉ số.</Empty></Section>;
  }
  const stats = [
    ["Câu đã trả lời", metrics.answeredCount ?? 0],
    ["Câu đã chấm rubric", metrics.scoredCount ?? 0],
    ["Điểm rubric trung bình", formatRubricScore(metrics.rubricScoreAvg)],
    ["Lần trả lời gần nhất", formatApplicationDate(metrics.lastAnsweredAt)],
  ];
  return (
    <Section icon={Star} title="Chỉ số với công ty">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-[#0b0716]/60 px-3 py-2.5">
            <p className="text-[11px] text-slate-500">{label}</p>
            <p className="mt-0.5 text-base font-bold text-white">{value}</p>
          </div>
        ))}
      </div>
      {(metrics.criteria || []).length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] uppercase tracking-wider text-slate-500">
              <tr><th className="py-2 pr-3">Tiêu chí rubric</th><th className="px-3 py-2">Điểm trung bình</th><th className="px-3 py-2">Số lần chấm</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              {metrics.criteria.map((c) => (
                <tr key={c.criterionKey}>
                  <td className="py-2 pr-3 font-semibold text-white">{c.criterionName || c.criterionKey}</td>
                  <td className="px-3 py-2">{formatRubricScore(c.avgScore)}</td>
                  <td className="px-3 py-2">{c.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-xs text-slate-500">Ứng viên chưa có câu trả lời nào được chấm theo rubric của công ty.</p>
      )}
    </Section>
  );
}

function AnswersSection({ answers }) {
  const groups = answersBySession(answers);
  return (
    <Section icon={MessageSquareQuote} title="Câu trả lời kèm điểm rubric">
      {groups.length === 0 ? (
        <Empty>Ứng viên chưa trả lời câu hỏi nào của công ty trong phỏng vấn AI.</Empty>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.sessionId}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Buổi phỏng vấn AI · {formatApplicationDate(g.date, true)}</p>
              <ul className="space-y-3">
                {g.answers.map((a) => (
                  <li key={`${g.sessionId}-${a.questionIndex}`} className="rounded-xl border border-slate-800 bg-[#0b0716]/60 p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-semibold text-white">{a.question || "Câu hỏi của công ty"}</p>
                      <span className={`shrink-0 text-xs font-bold ${a.scoringStatus === "scored" ? "text-violet-300" : "text-slate-500"}`}>
                        {a.scoringStatus === "scored" ? formatRubricScore(a.rubricScore) : "Chưa chấm"}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-300">{a.transcript}</p>
                    {(a.scores || []).length > 0 && (
                      <ul className="mt-3 space-y-1.5 border-t border-slate-800 pt-3">
                        {a.scores.map((s) => (
                          <li key={s.criterionKey} className="text-[11px]">
                            <span className="font-semibold text-slate-200">{s.criterionName || s.criterionKey}</span>
                            <span className="ml-1.5 font-bold text-violet-300">{formatRubricScore(s.score)}</span>
                            {s.evidenceQuote && <span className="ml-1.5 italic text-slate-500">"{s.evidenceQuote}"</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function RejectDialog({ name, busy, onCancel, onConfirm }) {
  const [note, setNote] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="reject-title">
      <div className="max-h-[90vh] overflow-y-auto w-full max-w-md rounded-2xl border border-slate-800 bg-[#120c22] p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id="reject-title" className="text-base font-bold text-white">Từ chối đơn của {name || "ứng viên"}?</h2>
          <button onClick={onCancel} aria-label="Đóng" className="text-slate-400 hover:text-white"><X className="size-4" /></button>
        </div>
        <p className="mt-1 text-xs text-slate-400">Ứng viên nhận thông báo "chưa phù hợp". Ghi chú (không bắt buộc) được gửi kèm thông báo.</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, APPLICATION_NOTE_MAX))}
          rows={4}
          placeholder="Ví dụ: Vị trí cần thêm kinh nghiệm làm việc với hệ thống phân tán."
          className="mt-3 w-full rounded-lg border border-slate-800 bg-[#0b0716] px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
        />
        <p className="text-right text-[11px] text-slate-500">{note.length}/{APPLICATION_NOTE_MAX}</p>
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800">Hủy</button>
          <button disabled={busy} onClick={() => onConfirm(note.trim())} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <XCircle className="size-3.5" />} Từ chối
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * /company/applications/:id — JB-16. Mở đơn `submitted` lần đầu → backend chuyển `viewed`.
 * Shortlist / từ chối → ứng viên nhận thông báo `application_status_changed` (JB-09).
 */
export function CompanyApplicationDetail() {
  const { id } = useParams();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [framework, setFramework] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await tryApi(() => companyApi.getApplication(id), { fallback: "Không tải được đơn ứng tuyển." });
    setLoading(false);
    if (res.success) setApp(res.application);
    else setNotFound(true);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    competenciesApi.getFramework().then((res) => res?.success && setFramework(res.framework)).catch(() => {});
  }, []);

  const decide = async (status, note = "") => {
    if (status === "shortlisted" && !window.confirm(`Đưa ${app?.candidate?.name || "ứng viên"} vào danh sách chọn? Ứng viên sẽ nhận thông báo và không đổi lại được.`)) return;
    setBusy(true);
    const res = await tryApi(() => companyApi.changeApplicationStatus(id, status, note), {
      fallback: "Không cập nhật được đơn.",
      successMessage: status === "shortlisted" ? "Đã shortlist. Ứng viên đã nhận thông báo." : "Đã từ chối đơn. Ứng viên đã nhận thông báo.",
    });
    setBusy(false);
    setRejecting(false);
    if (res.success) setApp(res.application);
    else load();
  };

  const back = (
    <Link to="/company/applications" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white">
      <ArrowLeft className="size-3.5" /> Danh sách đơn
    </Link>
  );

  if (loading && !app) {
    return (
      <div className="space-y-4">
        {back}
        <div className="py-16 text-center text-slate-400"><Loader2 className="mx-auto size-6 animate-spin text-violet-500" /></div>
      </div>
    );
  }
  if (!app) {
    return (
      <div className="space-y-4">
        {back}
        <div className={`${cardCls} py-12 text-center`}>
          <p className="font-medium text-slate-300">{notFound ? "Không tìm thấy đơn ứng tuyển" : "Không tải được đơn"}</p>
          <p className="mt-1 text-xs text-slate-500">Đơn có thể thuộc công ty khác hoặc đã bị xóa.</p>
        </div>
      </div>
    );
  }

  if (app.status === "withdrawn") {
    return (
      <div className="space-y-4">
        {back}
        <div className={`${cardCls} py-12 text-center`}>
          <UserX className="mx-auto size-8 text-slate-500" />
          <p className="mt-2 text-base font-semibold text-white">{app.candidateName || "Ứng viên"} đã rút đơn</p>
          <p className="mt-1 text-xs text-slate-500">
            Tin "{app.jobTitle}" · rút ngày {formatApplicationDate(app.withdrawnAt)}. Dữ liệu ứng viên đã chia sẻ không còn hiển thị.
          </p>
        </div>
      </div>
    );
  }

  const s = app.snapshot || {};
  const actions = applicationActions(app.status);
  const name = app.candidate?.name || s.candidate?.name || "Ứng viên";

  return (
    <div className="space-y-6 break-words">
      {back}
      <div className={`${cardCls} flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between`}>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-white">{name}</h1>
            <StatusBadge status={app.status} />
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Ứng tuyển "{app.jobTitle}" · nộp {formatApplicationDate(app.submittedAt, true)}
            {app.candidate?.email ? ` · ${app.candidate.email}` : ""}
          </p>
          {app.consent?.at && (
            <p className="mt-1 text-[11px] text-slate-500">Ứng viên đồng ý chia sẻ hồ sơ, CV và kết quả câu hỏi của công ty lúc {formatApplicationDate(app.consent.at, true)}.</p>
          )}
        </div>
        {(actions.shortlist || actions.reject) && (
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => setRejecting(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/10 disabled:opacity-50">
              <XCircle className="size-4" /> Từ chối
            </button>
            <button disabled={busy} onClick={() => decide("shortlisted")} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 disabled:opacity-50">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />} Shortlist
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <CompetencySection profile={s.profile} framework={framework} />
        <MetricsSection metrics={s.companyMetrics} />
      </div>
      <AnswersSection answers={s.companyMetrics?.answers} />
      <CvSection cv={s.cv} />

      {(app.history || []).length > 0 && (
        <Section icon={RefreshCw} title="Lịch sử đơn">
          <ol className="space-y-1.5 text-xs text-slate-300">
            {app.history.map((h, i) => (
              <li key={i}>
                <span className="text-slate-500">{formatApplicationDate(h.at, true)}</span> · {APPLICATION_STATUS[h.status] || h.status}
                {h.note ? <span className="text-slate-400"> — {h.note}</span> : null}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {rejecting && <RejectDialog name={name} busy={busy} onCancel={() => setRejecting(false)} onConfirm={(note) => decide("rejected", note)} />}
    </div>
  );
}

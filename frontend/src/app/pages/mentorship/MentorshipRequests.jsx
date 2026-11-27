import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import {
  ListFilter,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  FileText,
  LockKeyhole,
  MessageSquare,
  Plus,
  RefreshCw,
  Users,
  Search,
  Award,
  Calendar,
  Send,
  AlertCircle,
  HelpCircle,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { mentorshipBackTarget } from "../../utils/mentor/mentorshipNavigation.js";
import { getUser } from "../../utils/auth/auth.js";
import {
  listMentorshipDocuments,
  listMentorshipRequests,
  getMentorshipRequest,
  createMentorshipRequest,
  sendMentorshipOffer,
  selectMentorshipOffer,
  withdrawMentorshipOffer,
  closeMentorshipRequest,
  downloadMentorshipFile,
  acceptMentorshipAssessment,
} from "../../api/mentorshipRequestsApi.js";
import { MentorPageShell } from "../../components/mentor/MentorPageShell.jsx";
import { getJob } from "../../api/jobsApi.js";
import { jdFileName, jobToJdText, readJobPostId } from "../../utils/jobs/jobDetail.js";
import { MentorStatPanel, MentorStatFrame } from "../../components/mentor/MentorStatFrames.jsx";
import { mentorRequestStats } from "../../utils/mentor/mentorRequestStats.js";
import "../../../styles/mentorship-requests.css";

const TYPES = {
  mock_interview: "Phỏng vấn thử",
  cv_review: "Review CV",
  career_consulting: "Tư vấn nghề nghiệp",
};

const STATUS = {
  open: "Đang nhận đề nghị",
  selected: "Đã chọn Mentor",
  assessing: "Đang đánh giá đầu vào",
  path_proposed: "Đã đề xuất lộ trình",
  closed: "Đã đóng",
};

/** Trạng thái sau khi đã chọn Mentor (LP-05): vẫn hiện khung Mentor đã chọn và cho đặt lịch thường. */
const CHOSEN_STATUSES = ["selected", "assessing", "path_proposed"];

const ASSESSMENT_STATUS = {
  pending: "Chờ xác nhận",
  confirmed: "Đã hẹn",
  in_progress: "Đang diễn ra",
  completed: "Đã hoàn thành",
  cancelled: "Đã hủy",
  no_show: "Vắng mặt",
  rescheduled: "Đã dời lịch",
};

/** Buổi 0đ đã kết thúc không thành (hủy / vắng) → Mentor được hẹn lại. */
const assessmentClosed = (assessment) =>
  !assessment || ["cancelled", "no_show"].includes(assessment.status);

/** <input type="date"> trả YYYY-MM-DD; booking dùng DD/MM/YYYY. */
const toBookingDate = (value) => {
  const [y, m, d] = String(value || "").split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
};

const money = (value) => `${Number(value || 0).toLocaleString("vi-VN")}₫`;
const date = (value) => new Date(value).toLocaleDateString("vi-VN");

export function MentorshipRequests() {
  const user = getUser();
  const mentor = user?.role === "mentor";
  const base = mentor ? "/mentor/requests" : "/mentor-requests";
  const { requestId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [scope, setScope] = useState("open");
  const [rows, setRows] = useState([]);
  /** Số liệu đầu trang của mentor: luôn tính từ cả 2 danh sách, không đổi theo tab. */
  const [summaryRows, setSummaryRows] = useState({ open: [], mine: [] });
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const confirmationRef = useRef(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [sessionFilter, setSessionFilter] = useState("all");

  // Link từ trang lộ trình (`#buoi-danh-gia`): cuộn tới khung buổi đánh giá 0đ sau khi tải xong yêu cầu.
  useEffect(() => {
    if (!request || location.hash !== "#buoi-danh-gia") return;
    document.getElementById("buoi-danh-gia")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [request, location.hash]);

  useEffect(() => {
    if (confirmation && confirmationRef.current && !confirmationRef.current.open) {
      confirmationRef.current.showModal();
    }
  }, [confirmation]);

  const [reload, setReload] = useState(0);
  const isNew = requestId === "new" && !mentor;
  const isListView = !requestId && !isNew;
  const listLoadedOnce = useRef(false);
  const backTarget = mentorshipBackTarget({
    returnTo: location.state?.returnTo,
    mentor,
    detail: !!requestId && !isNew,
  });
  const entryState = { returnTo: `${location.pathname}${location.search}` };
  const requestTitle = request?.title || location.state?.title || "";

  const [documentMode, setDocumentMode] = useState({ cv: "upload", jd: "upload" });

  // JB-12: yêu cầu mentor gắn job (`/mentor-requests/new?jobPostId=`), JD lấy từ mô tả job.
  const jobPostId = isNew ? readJobPostId(new URLSearchParams(location.search)) : "";
  const [jobPost, setJobPost] = useState(null);
  const [jobPostError, setJobPostError] = useState("");
  useEffect(() => {
    if (!jobPostId) {
      setJobPost(null);
      setJobPostError("");
      return undefined;
    }
    let active = true;
    getJob(jobPostId).then((res) => {
      if (!active) return;
      if (res.success) {
        setJobPost(res.job);
        setJobPostError("");
        setDocumentMode((prev) => ({ ...prev, jd: "job" }));
      } else {
        setJobPost(null);
        setJobPostError(res.error || "Không tải được tin tuyển dụng.");
      }
    });
    return () => {
      active = false;
    };
  }, [jobPostId]);
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState("");
  const [documentsReload, setDocumentsReload] = useState(0);

  useEffect(() => {
    if (!isNew) return;
    let active = true;
    setDocumentsLoading(true);
    setDocumentsError("");
    listMentorshipDocuments()
      .then((body) => {
        if (active) setDocuments(body.documents || []);
      })
      .catch((err) => {
        if (active) setDocumentsError(err.message);
      })
      .finally(() => {
        if (active) setDocumentsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isNew, documentsReload]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setNotice("");
    setRequest(null);
    setConfirmation(null);

    const fetchData = isNew
      ? Promise.resolve(null)
      : requestId
      ? getMentorshipRequest(requestId)
      : listMentorshipRequests(scope);

    fetchData
      .then((body) => {
        if (!active) return;
        if (requestId) {
          setRequest(body?.request || null);
        } else {
          setRows(body?.requests || []);
          listLoadedOnce.current = true;
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [requestId, scope, reload, isNew]);

  useEffect(() => {
    if (!mentor || requestId) return undefined;
    let active = true;
    Promise.all([listMentorshipRequests("open"), listMentorshipRequests("mine")])
      .then(([open, mine]) => {
        if (active) setSummaryRows({ open: open?.requests || [], mine: mine?.requests || [] });
      })
      .catch(() => {
        /* Lỗi tải đã hiện ở danh sách chính; ô số liệu giữ giá trị cũ. */
      });
    return () => {
      active = false;
    };
  }, [mentor, requestId, reload]);

  const action = async (fn, message) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const body = await fn();
      if (body?.request) setRequest(body.request);
      setNotice(message);
      setConfirmation(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const chosen = request?.offers?.find((offer) => offer.id === request.selectedOfferId);
  const ownOffer = mentor ? request?.offers?.[0] : null;

  const submitNew = async (event) => {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    if (jobPost && documentMode.jd === "job") {
      form.set("jd", new File([jobToJdText(jobPost)], jdFileName(jobPost.title), { type: "text/plain" }));
    }
    for (const kind of ["cv", "jd"]) {
      if (form.get(`${kind}Source`)) continue;
      const file = form.get(kind);
      if (
        !file?.size ||
        file.size > 5 * 1024 * 1024 ||
        !/\.(pdf|doc|docx|txt)$/i.test(file.name)
      ) {
        setError("CV và JD phải là PDF, DOC, DOCX hoặc TXT, tối đa 5MB mỗi file.");
        return;
      }
    }
    setBusy(true);
    setError("");
    try {
      const body = await createMentorshipRequest(form);
      navigate(`${base}/${body.request.id}`, {
        replace: true,
        state: { returnTo: backTarget.to, title: body.request?.title },
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submitOffer = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    action(
      () => sendMentorshipOffer(request.id, Object.fromEntries(data)),
      "Đã gửi đề nghị. Bạn có thể theo dõi tại mục Đề nghị của tôi."
    );
  };
  const submitAssessment = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = {
      date: toBookingDate(data.get("date")),
      timeSlot: String(data.get("timeSlot") || ""),
      note: String(data.get("note") || ""),
    };
    if (!payload.date || !payload.timeSlot) {
      setError("Chọn ngày và giờ cho buổi đánh giá.");
      return;
    }
    action(
      () => acceptMentorshipAssessment(request.id, payload),
      "Đã hẹn buổi đánh giá 0đ. Mentee đã nhận thông báo."
    );
  };

  const canScheduleAssessment =
    mentor &&
    request &&
    ["selected", "assessing"].includes(request.status) &&
    request.canDownload &&
    assessmentClosed(request.assessment);

  // Filtered rows for list view
  const filteredRows = useMemo(() => {
    return (rows || []).filter((row) => {
      if (sessionFilter !== "all" && row.sessionType !== sessionFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchPos = (row.position || "").toLowerCase().includes(q);
        const matchTitle = (row.title || "").toLowerCase().includes(q);
        const matchDesc = (row.description || "").toLowerCase().includes(q);
        if (!matchPos && !matchTitle && !matchDesc) return false;
      }
      return true;
    });
  }, [rows, sessionFilter, searchQuery]);

  const mentorStats = useMemo(() => mentorRequestStats(summaryRows.open, summaryRows.mine), [summaryRows]);

  const content = (
    <div className={`mr-page ${mentor ? "mr-page-mentor" : ""} ${isNew ? "mr-page-new" : requestId ? "mr-page-detail" : ""}`}>
      {/* Top Header */}
      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {!isListView && backTarget ? (
            <nav
              aria-label="Đường dẫn điều hướng"
              className="mb-3.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-400"
            >
              <Link
                to={backTarget.to}
                title={`Quay lại ${backTarget.label}`}
                className="mr-breadcrumb-link"
              >
                {backTarget.label}
              </Link>
              {requestId && requestTitle ? (
                <>
                  <span className="text-slate-500" aria-hidden>
                    /
                  </span>
                  <span
                    className="max-w-[260px] truncate font-medium text-slate-200 sm:max-w-md"
                    title={requestTitle}
                  >
                    {requestTitle}
                  </span>
                </>
              ) : null}
            </nav>
          ) : null}
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#93f72b] shadow-[0_0_8px_rgba(147,247,43,0.8)]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#93f72b]">
              {mentor ? "Kết nối 1:1 với mentee" : "Đồng hành cùng chuyên gia"}
            </span>
          </div>
          <h1 className="font-headline mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
            {isNew ? (
              <>
                Đăng nhu cầu <span className="text-[#93f72b]">tìm Mentor</span>
              </>
            ) : requestId ? (
              <>
                Chi tiết <span className="text-[#93f72b]">nhu cầu</span>
              </>
            ) : mentor ? (
              <>
                Nhu cầu <span className="text-[#93f72b]">của mentee</span>
              </>
            ) : (
              <>
                Yêu cầu <span className="text-[#93f72b]">của tôi</span>
              </>
            )}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {isNew
              ? "Chia sẻ mục tiêu nghề nghiệp và đính kèm hồ sơ để nhận đề nghị từ Mentor chuyên gia."
              : requestId
              ? mentor
                ? "Đọc mentee cần gì và tài liệu đính kèm. Nếu bạn giúp được, gửi đề nghị ở bên dưới."
                : "Xem các đề nghị mentor gửi và chọn người phù hợp với bạn."
              : mentor
              ? "Mentee đăng nhu cầu cần hỗ trợ. Chọn nhu cầu hợp với chuyên môn của bạn và gửi đề nghị."
              : "Đăng nhu cầu, nhận đề xuất giải pháp và lựa chọn Mentor phù hợp nhất."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!isNew && (
            <button
              type="button"
              disabled={busy || loading}
              onClick={() => setReload((v) => v + 1)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#160f26]/80 px-4 py-2.5 text-xs font-bold text-slate-300 backdrop-blur-xl transition hover:border-[#93f72b]/50 hover:bg-[#1a1230] hover:text-[#93f72b] disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-[#93f72b]" : ""} />
              Làm mới
            </button>
          )}
          {!requestId && !mentor && (
            <Link
              to={`${base}/new`}
              state={entryState}
              className="inline-flex items-center gap-2 rounded-xl bg-[#93f72b] px-5 py-2.5 text-xs font-bold text-slate-950 shadow-[0_0_20px_rgba(147,247,43,0.35)] transition hover:bg-[#a8ff4e]"
            >
              <Plus size={16} />
              Đăng nhu cầu mới
            </Link>
          )}
        </div>
      </header>

      {/* Global Alerts */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-950/40 px-5 py-3.5 text-xs font-medium text-rose-200 backdrop-blur-xl"
            role="alert"
          >
            <div className="flex items-center gap-2.5">
              <AlertCircle size={16} className="text-rose-400" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setReload((v) => v + 1)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20"
            >
              <RefreshCw size={12} /> Tải lại
            </button>
          </motion.div>
        )}
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 flex items-center gap-2.5 rounded-xl border border-[#93f72b]/30 bg-[#93f72b]/10 px-5 py-3.5 text-xs font-semibold text-[#b8ff78] backdrop-blur-xl"
            role="status"
          >
            <CheckCircle2 size={16} className="text-[#93f72b]" />
            <span>{notice}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Skeleton: chỉ lần tải đầu. Đổi tab ở danh sách thì tải tại chỗ (xem khối Requests Grid). */}
      {loading && !(isListView && listLoadedOnce.current) ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#140c24]/80 p-16 text-center backdrop-blur-xl">
          <div className="relative mb-4">
            <RefreshCw size={36} className="animate-spin text-[#93f72b]" />
            <div className="absolute inset-0 rounded-full blur-md bg-[#93f72b]/30" />
          </div>
          <p className="text-sm font-semibold text-slate-300">Đang tải danh sách nhu cầu…</p>
        </div>
      ) : isNew ? (
        /* Create Request View (Candidate only) */
        <form className="mr-form mr-panel" onSubmit={submitNew} key={jobPost?.id || "no-job"}>
          {jobPost ? (
            <div className="mr-job-link flex items-start gap-3 rounded-2xl border border-[#93f72b]/30 bg-[#93f72b]/10 p-4">
              <Briefcase size={18} className="mt-0.5 shrink-0 text-[#93f72b]" />
              <div className="min-w-0 text-sm">
                <p className="font-bold text-white">
                  Gắn với job: {jobPost.title}
                  {jobPost.company?.name ? ` · ${jobPost.company.name}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-slate-300">
                  Mentor thấy job này và dựa vào năng lực job yêu cầu để đề xuất lộ trình.
                </p>
              </div>
              <input type="hidden" name="jobPostId" value={jobPost.id} />
            </div>
          ) : jobPostError ? (
            <p className="mr-document-hint" role="alert">
              {jobPostError} Yêu cầu sẽ được gửi không kèm job.
            </p>
          ) : null}
          <div className="mr-form-grid">
            <label>
              Vị trí ứng tuyển
              <input name="position" required maxLength={160} defaultValue={jobPost?.title || ""} placeholder="Ví dụ: Frontend Developer" />
            </label>
            <label>
              Hình thức hỗ trợ
              <select name="sessionType" required>
                {Object.entries(TYPES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Bạn muốn Mentor giúp gì?
            <textarea
              name="description"
              required
              minLength={20}
              maxLength={4000}
              rows={4}
              placeholder="Ví dụ: Luyện trả lời câu hỏi React, tối ưu kỹ năng đàm phán lương và góp ý cách trình bày dự án trong CV."
            />
          </label>
          <details className="mr-optional">
            <summary>
              Thêm thời gian và ngân sách dự kiến <span>(Không bắt buộc)</span>
            </summary>
            <div className="mr-form-grid">
              <label>
                Thời gian mong muốn
                <input name="availability" maxLength={500} placeholder="Ví dụ: Tối thứ 3 hoặc thứ 5 sau 19:30" />
              </label>
              <label>
                Ngân sách dự kiến / buổi (VND)
                <input
                  name="budget"
                  type="number"
                  min={0}
                  max={100000000}
                  step={1000}
                  placeholder="Để trống nếu muốn trao đổi sau"
                />
              </label>
            </div>
          </details>

          <div className="mr-document-section-heading">
            <h2 className="text-lg font-bold text-white">CV & JD mục tiêu</h2>
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <LockKeyhole size={13} className="text-[#93f72b]" /> Chỉ chia sẻ với Mentor bạn chọn
            </span>
          </div>

          <div className="mr-form-grid">
            {["cv", "jd"].map((kind) => {
              const saved = documents.filter((doc) => doc.kind === kind);
              return (
                <div className="mr-upload" key={kind}>
                  <div className="mr-document-heading">
                    <FileText size={20} className="text-[#93f72b]" />
                    <strong>{kind.toUpperCase()}</strong>
                  </div>
                  <div className="mr-document-tabs" role="group" aria-label={`Nguồn ${kind.toUpperCase()}`}>
                    <button
                      type="button"
                      data-button-surface="none"
                      aria-pressed={documentMode[kind] === "upload"}
                      className={documentMode[kind] === "upload" ? "active" : ""}
                      onClick={() => setDocumentMode((prev) => ({ ...prev, [kind]: "upload" }))}
                    >
                      Tải file mới
                    </button>
                    <button
                      type="button"
                      data-button-surface="none"
                      aria-pressed={documentMode[kind] === "saved"}
                      className={documentMode[kind] === "saved" ? "active" : ""}
                      onClick={() => setDocumentMode((prev) => ({ ...prev, [kind]: "saved" }))}
                    >
                      Chọn {kind.toUpperCase()} đã lưu
                    </button>
                    {kind === "jd" && jobPost ? (
                      <button
                        type="button"
                        data-button-surface="none"
                        aria-pressed={documentMode.jd === "job"}
                        className={documentMode.jd === "job" ? "active" : ""}
                        onClick={() => setDocumentMode((prev) => ({ ...prev, jd: "job" }))}
                      >
                        Lấy từ job
                      </button>
                    ) : null}
                  </div>
                  {kind === "jd" && jobPost && documentMode.jd === "job" ? (
                    <p className="mr-document-hint">
                      JD được tạo từ mô tả, kỹ năng và năng lực yêu cầu của job “{jobPost.title}”.
                    </p>
                  ) : documentMode[kind] === "upload" ? (
                    <label>
                      Tệp từ máy tính
                      <small className="mr-document-hint">PDF, DOC, DOCX, TXT · tối đa 5MB</small>
                      <input name={kind} type="file" accept=".pdf,.doc,.docx,.txt" required />
                    </label>
                  ) : documentsLoading ? (
                    <p className="mr-document-hint" role="status">
                      Đang tải tài liệu của bạn…
                    </p>
                  ) : documentsError ? (
                    <div>
                      <p className="mr-document-hint" role="alert">
                        {documentsError}
                      </p>
                      <button
                        type="button"
                        data-button-surface="none"
                        className="mr-text-button"
                        onClick={() => setDocumentsReload((v) => v + 1)}
                      >
                        Thử tải lại
                      </button>
                    </div>
                  ) : saved.length ? (
                    <label>
                      Chọn một phiên bản
                      <select name={`${kind}Source`} required defaultValue="">
                        <option value="" disabled>
                          Chọn {kind.toUpperCase()} đã tải trước đây…
                        </option>
                        {saved.map((doc) => (
                          <option key={doc.id} value={doc.id}>
                            {doc.name} · {doc.source} · {date(doc.createdAt)}
                          </option>
                        ))}
                      </select>
                      <small className="mr-document-hint">
                        Yêu cầu mới sẽ giữ bản sao tài liệu bạn chọn (tối đa 5MB).
                      </small>
                    </label>
                  ) : (
                    <div>
                      <p className="mr-document-hint">
                        Chưa có {kind.toUpperCase()} đã lưu trong lịch sử phân tích của bạn.
                      </p>
                      <button
                        type="button"
                        data-button-surface="none"
                        className="mr-text-button"
                        onClick={() => setDocumentMode((prev) => ({ ...prev, [kind]: "upload" }))}
                      >
                        Tải file từ máy tính →
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mr-form-bottom">
            <p className="text-xs text-slate-400">Mentor sẽ gửi đề nghị hỗ trợ dựa trên thông tin này.</p>
            <div className="mr-form-actions">
              <Link to={backTarget.to} className="mr-cancel">
                Hủy bỏ
              </Link>
              <button
                data-button-surface="none"
                className="mr-primary"
                disabled={
                  busy ||
                  ["cv", "jd"].some(
                    (kind) =>
                      documentMode[kind] === "saved" &&
                      (documentsLoading || !!documentsError || !documents.some((d) => d.kind === kind))
                  )
                }
              >
                {busy ? "Đang gửi…" : "Đăng nhu cầu"}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </form>
      ) : request ? (
        /* Request Detail View */
        <>
          <div className="mr-detail-layout">
            <div className="mr-detail-main">
              {/* Overview Card */}
              <section className="mr-panel mr-detail-overview" aria-labelledby="request-detail-title">
                <div className="mr-meta">
                  <span className={`mr-status ${request.status}`}>
                    <span className="mr-status-dot" />
                    {STATUS[request.status]}
                  </span>
                  <span className="text-xs text-slate-400">Đăng ngày {date(request.createdAt)}</span>
                </div>
                <h2 id="request-detail-title" className="text-2xl font-black text-white">
                  {request.title}
                </h2>
                <div className="mr-detail-type">
                  <Briefcase size={15} className="text-[#93f72b]" />
                  <span className="font-semibold text-slate-200">{request.position}</span>
                  <span aria-hidden className="text-slate-600">·</span>
                  <span className="text-[#93f72b] font-medium">{TYPES[request.sessionType]}</span>
                </div>
                {request.jobPost ? (
                  <p className="mt-2 text-sm text-slate-300">
                    Job mục tiêu:{" "}
                    {request.jobPost.isOpen ? (
                      <Link to={`/jobs/${request.jobPost.id}`} className="font-semibold text-[#93f72b] hover:underline">
                        {request.jobPost.title}
                      </Link>
                    ) : (
                      <span className="font-semibold text-slate-200">{request.jobPost.title} (đã đóng)</span>
                    )}
                    {request.jobPost.company?.name ? ` · ${request.jobPost.company.name}` : ""}
                  </p>
                ) : null}
                <div className="mr-detail-goal">
                  <h3>{mentor ? "Mentee cần hỗ trợ gì" : "MỤC TIÊU CỦA BẠN"}</h3>
                  <p className="mr-description">{request.description}</p>
                </div>
              </section>

              {/* Offers Section */}
              <section className="mr-panel mr-detail-offers">
                <div className="mr-section-heading">
                  <div>
                    <span className="mr-eyebrow">
                      {mentor ? "Gửi cho mentee" : "CHỌN NGƯỜI PHÙ HỢP NHẤT VỚI MỤC TIÊU"}
                    </span>
                    <h2 className="text-xl font-bold text-white">
                      {mentor
                        ? "Đề nghị của bạn"
                        : `Đề nghị từ Mentor (${request.offers.filter((o) => o.status === "pending").length})`}
                    </h2>
                  </div>
                </div>

                {request.offers.length ? (
                  <div className="mr-offers">
                    {request.offers.map((offer) => (
                      <article
                        className={`mr-offer ${request.selectedOfferId === offer.id ? "selected" : ""}`}
                        key={offer.id}
                      >
                        <div className="mr-offer-top">
                          <div className="mr-avatar">{offer.mentorName.charAt(0)}</div>
                          <div>
                            <Link to={mentor ? "/profile" : `/mentors/${offer.mentorPublicId}`}>
                              {offer.mentorName}
                            </Link>
                            <p>{offer.mentorTitle}</p>
                          </div>
                          <span className="mr-estimate">
                            {money(offer.priceEstimate)}
                            <small>Phí tham khảo / buổi 60 phút</small>
                          </span>
                        </div>
                        <p className="mr-description">{offer.message}</p>
                        <div className="mr-offer-time">
                          <Clock size={15} className="text-[#93f72b]" />
                          <span>{offer.availability}</span>
                        </div>
                        <div className="mr-offer-bottom">
                          <span className="text-xs text-slate-400">
                            {offer.status === "withdrawn"
                              ? "Đã rút đề nghị"
                              : request.selectedOfferId === offer.id
                              ? "✓ Đề nghị đã được chọn"
                              : request.status === "selected"
                              ? "Mentee đã chọn đề nghị khác"
                              : date(offer.createdAt)}
                          </span>
                          {!mentor && request.status === "open" && offer.status === "pending" && (
                            <button
                              data-button-surface="none"
                              className="mr-primary"
                              onClick={() => setConfirmation({ offer })}
                              disabled={busy}
                            >
                              Chọn Mentor này <ArrowRight size={15} />
                            </button>
                          )}
                          {mentor && request.status === "open" && offer.status === "pending" && (
                            <button
                              data-button-surface="none"
                              className="mr-secondary"
                              onClick={() =>
                                action(
                                  () => withdrawMentorshipOffer(request.id, offer.id),
                                  "Đã rút đề nghị."
                                )
                              }
                              disabled={busy}
                            >
                              Rút đề nghị
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="mr-empty">
                    <Users size={30} className="text-[#93f72b]" />
                    <h3 className="text-base font-bold text-white">
                      {mentor ? "Bạn chưa gửi đề nghị" : "Chưa có đề nghị nào từ Mentor"}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {mentor
                        ? "Điền form bên dưới: bạn giúp mentee được gì và rảnh lúc nào."
                        : "Các Mentor uy tín trên hệ thống đang xem xét yêu cầu và sẽ gửi đề nghị sớm nhất cho bạn."}
                    </p>
                    {!mentor && (
                      <Link to="/mentors" className="mr-text-button font-bold text-[#93f72b]">
                        Chủ động tìm Mentor ngay →
                      </Link>
                    )}
                  </div>
                )}

                {/* Offer Submission Form for Mentor */}
                {mentor && request.status === "open" && !ownOffer && (
                  <form className="mr-offer-form" onSubmit={submitOffer}>
                    <div className="flex items-center gap-2 mb-2">
                      <Send size={16} className="text-[#93f72b]" />
                      <h3 className="text-base font-bold text-white">Gửi đề nghị</h3>
                    </div>
                    <label>
                      Bạn sẽ giúp mentee thế nào?
                      <textarea
                        name="message"
                        required
                        minLength={20}
                        maxLength={3000}
                        rows={4}
                        placeholder="Ví dụ: Mình làm Business Analyst 5 năm. Buổi này mình sẽ hỏi thử 5–6 câu hay gặp, góp ý cách trả lời và chỉ chỗ cần sửa trong CV."
                      />
                    </label>
                    <label>
                      Bạn rảnh lúc nào?
                      <input
                        name="availability"
                        required
                        maxLength={500}
                        placeholder="Ví dụ: Tối thứ 5 từ 19:30 - 20:30 (giờ Việt Nam)"
                      />
                    </label>
                    <p className="mr-muted">
                      Mỗi đề nghị là 1 buổi 60 phút, phí lấy theo giá trong hồ sơ của bạn. Nếu mentee chọn bạn, họ sẽ đặt giờ theo lịch trống của bạn và thanh toán.
                    </p>
                    <button data-button-surface="none" className="mr-primary" disabled={busy}>
                      {busy ? "Đang gửi…" : "Gửi đề nghị"}
                      <ArrowRight size={16} />
                    </button>
                  </form>
                )}
              </section>
            </div>

            {/* Sidebar */}
            <aside className="mr-detail-sidebar" aria-label="Thông tin và tài liệu của nhu cầu">
              {CHOSEN_STATUSES.includes(request.status) && chosen && (request.assessment || canScheduleAssessment || !mentor || request.canDownload) && (
                <section className="mr-panel mr-detail-assessment" id="buoi-danh-gia">
                  <div className="mr-detail-section-label">
                    <ClipboardCheck size={17} className="text-[#93f72b]" />
                    <h2 className="text-sm font-bold text-white">Buổi đánh giá 0đ</h2>
                  </div>
                  {request.assessment && (
                    <div className="mr-assessment-current">
                      <p className="text-xs text-slate-300">
                        <strong className="text-white">{request.assessment.timeSlot} · {request.assessment.date}</strong>{" "}
                        <span className="mr-muted">
                          ({request.assessment.durationMinutes} phút · {ASSESSMENT_STATUS[request.assessment.status] || request.assessment.status})
                        </span>
                      </p>
                      {!assessmentClosed(request.assessment) && (
                        <Link
                          className="mr-secondary mt-2 inline-flex"
                          to={
                            mentor
                              ? `/mentor/meeting-detail/${request.assessment.bookingId}`
                              : `/session/${request.assessment.bookingId}`
                          }
                        >
                          Xem buổi đánh giá <ArrowRight size={15} />
                        </Link>
                      )}
                      {request.assessment.status === "completed" && (
                        <p className="mr-muted text-xs mt-2">
                          {mentor
                            ? "Bước tiếp theo: soạn lộ trình cho mentee."
                            : "Mentor sẽ đề xuất lộ trình dựa trên buổi đánh giá."}
                        </p>
                      )}
                    </div>
                  )}
                  {/* Mentee: buổi 0đ do mentor hẹn; không có bước tự đặt và trả tiền. */}
                  {!mentor && ["selected", "assessing"].includes(request.status) && assessmentClosed(request.assessment) && (
                    <p className="mr-muted text-xs">
                      {request.assessment
                        ? "Buổi đánh giá trước không diễn ra. Mentor sẽ hẹn lại một buổi miễn phí, bạn sẽ nhận thông báo khi có lịch."
                        : "Mentor sẽ hẹn một buổi đánh giá đầu vào miễn phí (0đ) để hai bên xem có phù hợp không. Bạn sẽ nhận thông báo khi có lịch; sau buổi này mentor mới đề xuất lộ trình."}
                    </p>
                  )}
                  {canScheduleAssessment && (
                    <form className="mr-assessment-form mt-3" onSubmit={submitAssessment}>
                      <p className="mr-muted text-xs mb-3">
                        {request.assessment
                          ? "Buổi trước không diễn ra. Hẹn lại buổi đánh giá miễn phí cho mentee."
                          : "Hẹn một buổi đánh giá đầu vào miễn phí để hiểu năng lực mentee trước khi đề xuất lộ trình."}
                      </p>
                      <div className="mr-form-grid">
                        <label>
                          Ngày
                          <input name="date" type="date" required />
                        </label>
                        <label>
                          Giờ bắt đầu
                          <input name="timeSlot" type="time" required />
                        </label>
                      </div>
                      <label>
                        Ghi chú cho mentee
                        <textarea
                          name="note"
                          rows={2}
                          maxLength={1000}
                          placeholder="Ví dụ: Chuẩn bị 1 dự án muốn trình bày"
                        />
                      </label>
                      <button data-button-surface="none" className="mr-primary" disabled={busy}>
                        {busy ? "Đang tạo…" : "Tạo buổi đánh giá 0đ"}
                        <ArrowRight size={16} />
                      </button>
                    </form>
                  )}
                  {/* LP-20: Mentor được chọn soạn / mở lộ trình của yêu cầu này. */}
                  {mentor && request.canDownload && (
                    request.learningPath ? (
                      <Link
                        className="mr-secondary mt-3 inline-flex"
                        to={`/mentor/learning-paths/${request.learningPath.id}/edit`}
                      >
                        Mở lộ trình <ArrowRight size={15} />
                      </Link>
                    ) : (
                      ["selected", "assessing"].includes(request.status) && (
                        <Link
                          className={`${
                            request.assessment?.status === "completed" ? "mr-primary" : "mr-secondary"
                          } mt-3 inline-flex`}
                          to={`/mentor/learning-paths/new?requestId=${request.id}`}
                        >
                          Soạn lộ trình <ArrowRight size={15} />
                        </Link>
                      )
                    )
                  )}
                  {/* LP-18: ứng viên thấy lộ trình mentor đã gửi (backend không trả bản nháp cho ứng viên). */}
                  {!mentor && request.learningPath && (
                    <Link className="mr-primary mt-3 inline-flex" to="/learning-paths">
                      Xem lộ trình mentor gửi <ArrowRight size={15} />
                    </Link>
                  )}
                </section>
              )}

              {CHOSEN_STATUSES.includes(request.status) && chosen && (
                <section className="mr-panel mr-detail-booking">
                  <div className="mr-detail-section-label">
                    <CheckCircle2 size={17} className="text-[#93f72b]" />
                    <h2 className="text-sm font-bold text-white">Mentor đã chọn</h2>
                  </div>
                  <div className="mr-detail-chosen">
                    <div className="mr-avatar">{chosen.mentorName.charAt(0)}</div>
                    <div>
                      <strong className="text-white">{chosen.mentorName}</strong>
                      <p className="text-xs text-slate-400">{chosen.mentorTitle}</p>
                    </div>
                  </div>
                  {request.bookingId ? (
                    <Link
                      className="mr-primary"
                      to={
                        mentor
                          ? `/mentor/meeting-detail/${request.bookingId}`
                          : `/session/${request.bookingId}`
                      }
                    >
                      Xem lịch hẹn <ArrowRight size={16} />
                    </Link>
                  ) : (
                    <p className="mr-muted">
                      {mentor
                        ? "Bước tiếp theo: hẹn buổi đánh giá 0đ với mentee, sau đó soạn lộ trình."
                        : "Bước tiếp theo: buổi đánh giá 0đ do mentor hẹn, sau đó mentor gửi lộ trình để bạn xem và thanh toán trọn gói."}
                    </p>
                  )}
                </section>
              )}

              <section className="mr-panel mr-detail-information">
                <div className="mr-detail-section-label">
                  <Clock size={17} className="text-[#93f72b]" />
                  <h2 className="text-sm font-bold text-white">Thông tin buổi gặp</h2>
                </div>
                <dl className="mr-detail-dl">
                  <div>
                    <dt>Thời gian mong muốn</dt>
                    <dd>{request.availability || "Linh hoạt trao đổi"}</dd>
                  </div>
                  <div>
                    <dt>Ngân sách / buổi</dt>
                    <dd className={request.budget == null ? "" : "mr-detail-amount"}>
                      {request.budget == null ? "Thương lượng" : money(request.budget)}
                    </dd>
                  </div>
                  <div>
                    <dt>{mentor ? "Loại hỗ trợ" : "Hình thức"}</dt>
                    <dd className="font-semibold text-[#93f72b]">{TYPES[request.sessionType]}</dd>
                  </div>
                </dl>

                <div className="mr-detail-documents">
                  <div className="mr-detail-section-label">
                    <FileText size={17} className="text-[#93f72b]" />
                    <h2 className="text-sm font-bold text-white">Tài liệu của {mentor ? "mentee" : "bạn"}</h2>
                  </div>
                  {request.canDownload ? (
                    <div className="mr-detail-file-list">
                      {["cv", "jd"].map((kind) => (
                        <button
                          type="button"
                          data-button-surface="none"
                          key={kind}
                          onClick={() =>
                            action(
                              () =>
                                downloadMentorshipFile(
                                  request.id,
                                  kind,
                                  request[`${kind}Name`]
                                ),
                              "Đã tải tài liệu."
                            )
                          }
                          disabled={busy}
                          aria-label={`Tải ${kind.toUpperCase()}: ${request[`${kind}Name`]}`}
                        >
                          <span className="mr-file-kind">{kind.toUpperCase()}</span>
                          <span className="mr-file-name" title={request[`${kind}Name`]}>
                            {request[`${kind}Name`]}
                          </span>
                          <Download size={15} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mr-muted">Mentee sẽ chia sẻ CV/JD khi chọn đề nghị của bạn.</p>
                  )}
                  <p className="mr-detail-private">
                    <LockKeyhole size={13} className="text-[#93f72b]" />
                    <span>Chỉ mentee và mentor được chọn mới tải được tài liệu này.</span>
                  </p>
                </div>
              </section>

              {request.status === "open" && (
                <div className="mr-detail-tip">
                  <MessageSquare size={16} className="text-[#93f72b]" />
                  <p>
                    {mentor
                      ? "Mẹo: nói rõ bạn giúp được gì và rảnh lúc nào, mentee sẽ dễ chọn bạn hơn."
                      : "Khi nhận được đề nghị, bạn có thể xem xét profile, lịch rảnh và chi phí trước khi quyết định chọn."}
                  </p>
                </div>
              )}

              {!mentor && request.status === "open" && (
                <button
                  type="button"
                  data-button-surface="none"
                  className="mr-close-request"
                  onClick={() => setConfirmation({ close: true })}
                >
                  Ngừng nhận đề nghị
                </button>
              )}
            </aside>
          </div>

          {confirmation && (
            <dialog
              ref={confirmationRef}
              className="mr-confirm"
              aria-label="Xác nhận lựa chọn"
              onCancel={(e) => {
                if (busy) e.preventDefault();
                else setConfirmation(null);
              }}
            >
              <h3>{confirmation.close ? "Đóng yêu cầu này?" : `Chọn ${confirmation.offer.mentorName}?`}</h3>
              <p>
                {confirmation.close
                  ? "Yêu cầu sẽ ngừng nhận đề nghị mới. Hành động này không tạo hoặc hủy lịch hẹn."
                  : "Yêu cầu sẽ ngừng nhận đề nghị mới và chia sẻ CV/JD với Mentor này. Bạn sẽ chọn giờ và thanh toán ở bước tiếp theo."}
              </p>
              <div>
                <button
                  data-button-surface="none"
                  className="mr-secondary"
                  disabled={busy}
                  onClick={() => setConfirmation(null)}
                >
                  Quay lại
                </button>
                <button
                  data-button-surface="none"
                  className="mr-primary"
                  disabled={busy}
                  onClick={() =>
                    action(
                      () =>
                        confirmation.close
                          ? closeMentorshipRequest(request.id)
                          : selectMentorshipOffer(request.id, confirmation.offer.id),
                      confirmation.close
                        ? "Đã đóng yêu cầu."
                        : "Đã chọn Mentor. Tiếp tục chọn lịch khi bạn sẵn sàng."
                    )
                  }
                >
                  {busy ? "Đang xử lý…" : "Xác nhận"}
                </button>
              </div>
            </dialog>
          )}
        </>
      ) : !requestId ? (
        /* List View */
        <>
          {/* Bento KPI Summary Frames (Mentor only) */}
          {mentor && (
            <MentorStatPanel className="mb-8">
              <MentorStatFrame
                index={1}
                value={mentorStats.openCount}
                title="Nhu cầu đang mở"
                subtitle="Mentee đang tìm mentor"
                cornerIcon={Briefcase}
                accent="lime"
                compact
              />
              <MentorStatFrame
                index={2}
                value={mentorStats.waiting}
                title="Đề nghị chờ phản hồi"
                subtitle="Bạn đã gửi, mentee chưa chọn"
                cornerIcon={Send}
                accent="purple"
                compact
              />
              <MentorStatFrame
                index={3}
                value={mentorStats.chosen}
                title="Được mentee chọn"
                subtitle="Đề nghị của bạn được nhận"
                cornerIcon={CheckCircle2}
                accent="purple"
                compact
              />
            </MentorStatPanel>
          )}

          {/* Thanh lọc: hàng 1 = tab (mentor) + ô tìm kiếm; hàng 2 = biểu tượng lọc + loại hỗ trợ. Chữ không xuống dòng. */}
          <div className="mb-6 rounded-2xl border border-white/10 bg-[#160f26]/85 p-4 shadow-[0_12px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {mentor && (
                <div className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1" role="tablist" aria-label="Danh sách">
                  {[
                    ["open", "Nhu cầu đang mở", summaryRows.open.length],
                    ["mine", "Đề nghị của tôi", summaryRows.mine.length],
                  ].map(([val, label, count]) => {
                    const active = scope === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setScope(val)}
                        className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold transition-colors ${
                          active ? "bg-[#93f72b] text-slate-950" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {label}
                        <span
                          className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-black tabular-nums ${
                            active ? "bg-slate-950/15 text-slate-950" : "bg-white/10 text-slate-400"
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="relative w-full sm:max-w-xs">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm vị trí, từ khóa..."
                  aria-label="Tìm nhu cầu"
                  /* .mr-page input đặt padding 11px 14px (độ ưu tiên cao hơn pl-9) → chữ đè kính lúp; ghi đè bằng style. */
                  style={{ paddingLeft: "2.25rem", paddingRight: "2rem", paddingTop: "0.5rem", paddingBottom: "0.5rem" }}
                  className="w-full rounded-xl border border-white/10 bg-[#120a20] text-xs text-white placeholder-slate-500 transition focus:border-[#93f72b] focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Xóa tìm kiếm"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
              <ListFilter size={15} className="mr-0.5 shrink-0 text-slate-500" aria-label="Lọc theo loại hỗ trợ" />
              {[
                ["all", "Tất cả"],
                ["mock_interview", "Phỏng vấn thử"],
                ["cv_review", "Review CV"],
                ["career_consulting", "Tư vấn nghề nghiệp"],
              ].map(([key, label]) => {
                const active = sessionFilter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSessionFilter(key)}
                    className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      active
                        ? "border border-[#93f72b]/50 bg-[#93f72b]/15 text-[#93f72b]"
                        : "border border-white/10 bg-transparent text-slate-400 hover:border-white/20 hover:text-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Đổi tab: giữ danh sách cũ (mờ) tại chỗ trong lúc tải, không thay cả trang bằng khung tải → không nhảy. */}
          <div className={`transition-opacity duration-200 ${loading ? "pointer-events-none opacity-50" : ""}`} aria-busy={loading}>
          {/* Requests Grid */}
          {filteredRows.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {filteredRows.map((row) => {
                const sessionLabel = TYPES[row.sessionType] || row.sessionType;
                const isMock = row.sessionType === "mock_interview";
                const isCv = row.sessionType === "cv_review";

                return (
                  <Link
                    to={`${base}/${row.id}`}
                    state={{ ...entryState, title: row.title }}
                    key={row.id}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#181128]/95 to-[#120a20]/95 p-6 shadow-[0_12px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-[#93f72b]/50 hover:shadow-[0_0_30px_rgba(147,247,43,0.15)]"
                  >
                    {/* Top hairline light */}
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                    <div>
                      {/* Top Badges */}
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            isMock
                              ? "border border-[#93f72b]/30 bg-[#93f72b]/15 text-[#93f72b]"
                              : isCv
                              ? "border border-violet-500/30 bg-violet-500/15 text-violet-300"
                              : "border border-cyan-500/30 bg-cyan-500/15 text-cyan-300"
                          }`}
                        >
                          {isMock ? (
                            <Users size={12} />
                          ) : isCv ? (
                            <FileText size={12} />
                          ) : (
                            <Briefcase size={12} />
                          )}
                          {sessionLabel}
                        </span>

                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#93f72b]" />
                          <span>{STATUS[row.status]}</span>
                          <span className="text-slate-600">·</span>
                          <span>{date(row.createdAt)}</span>
                        </div>
                      </div>

                      {/* Title & Target Position */}
                      <h2 className="text-lg font-bold text-white transition-colors group-hover:text-[#93f72b] line-clamp-2">
                        {row.title}
                      </h2>
                      <div className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-300">
                        <Briefcase size={13} className="text-[#93f72b]" />
                        <span>Vị trí: <strong>{row.position}</strong></span>
                      </div>

                      {/* Description Preview */}
                      <p className="mt-3 text-xs leading-relaxed text-slate-400 line-clamp-2">
                        {row.description}
                      </p>
                    </div>

                    {/* Footer Info & Action */}
                    <div className="mt-6 border-t border-white/10 pt-4">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <Clock size={13} className="text-[#93f72b]" />
                          <span>{row.availability || "Thời gian linh hoạt"}</span>
                        </span>
                        <div className="text-right">
                          <span className="text-xs text-slate-400">Ngân sách: </span>
                          <strong className="text-sm font-bold text-[#93f72b]">
                            {row.budget == null ? "Thương lượng" : money(row.budget)}
                          </strong>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-3.5 py-2.5 text-xs font-bold text-[#93f72b] transition group-hover:border-[#93f72b]/30 group-hover:bg-[#93f72b]/10">
                        <span>
                          {mentor
                            ? scope === "mine" ? "Xem đề nghị của bạn" : "Xem chi tiết và gửi đề nghị"
                            : `${row.offerCount ?? 0} đề nghị từ Mentor`}
                        </span>
                        <ArrowRight
                          size={14}
                          className="transition-transform duration-200 group-hover:translate-x-1"
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            /* Luxury Empty State */
            <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#140c24]/85 px-6 py-16 text-center shadow-[0_16px_40px_rgba(0,0,0,0.4)] backdrop-blur-xl">
              {/* Radial background glow */}
              <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(147,247,43,0.08)_0%,transparent_70%)]" />

              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-[#93f72b]/30 bg-[#93f72b]/10 shadow-[0_0_24px_rgba(147,247,43,0.2)]">
                <MessageSquare size={28} className="text-[#93f72b]" />
              </div>

              <h2 className="font-headline text-xl font-bold text-white">
                {searchQuery || sessionFilter !== "all"
                  ? "Không có nhu cầu nào khớp bộ lọc"
                  : mentor
                  ? scope === "mine"
                    ? "Bạn chưa gửi đề nghị nào"
                    : "Chưa có nhu cầu nào đang mở"
                  : "Bạn chưa đăng nhu cầu nào"}
              </h2>

              <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-400">
                {searchQuery || sessionFilter !== "all"
                  ? "Thử từ khóa khác, hoặc chọn 'Tất cả' để xem hết."
                  : mentor
                  ? scope === "mine"
                    ? "Vào tab 'Nhu cầu đang mở', chọn một nhu cầu hợp với bạn và gửi đề nghị."
                    : "Khi mentee đăng nhu cầu mới, nhu cầu sẽ hiện ở đây."
                  : "Hãy đính kèm CV, JD mục tiêu và mô tả ngắn để các chuyên gia phù hợp chủ động đề xuất hỗ trợ."}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                {searchQuery || sessionFilter !== "all" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSessionFilter("all");
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#93f72b] px-5 py-2.5 text-xs font-bold text-slate-950 shadow-[0_0_20px_rgba(147,247,43,0.35)] transition hover:bg-[#a8ff4e]"
                  >
                    Đặt lại bộ lọc
                  </button>
                ) : mentor ? (
                  scope === "mine" ? (
                    <button
                      type="button"
                      onClick={() => setScope("open")}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#93f72b] px-5 py-2.5 text-xs font-bold text-slate-950 shadow-[0_0_20px_rgba(147,247,43,0.35)] transition hover:bg-[#a8ff4e]"
                    >
                      Xem nhu cầu đang mở →
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setReload((v) => v + 1)}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-bold text-white transition hover:border-[#93f72b]/50 hover:text-[#93f72b]"
                    >
                      <RefreshCw size={13} />
                      Làm mới danh sách
                    </button>
                  )
                ) : (
                  <Link
                    to={`${base}/new`}
                    state={entryState}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#93f72b] px-5 py-2.5 text-xs font-bold text-slate-950 shadow-[0_0_20px_rgba(147,247,43,0.35)] transition hover:bg-[#a8ff4e]"
                  >
                    <Plus size={16} />
                    Đăng nhu cầu đầu tiên
                  </Link>
                )}
              </div>
            </div>
          )}
          </div>
        </>
      ) : null}
    </div>
  );

  return mentor ? (
    <MentorPageShell mentorRole className="p-4 sm:p-6 lg:p-8">
      {content}
    </MentorPageShell>
  ) : (
    content
  );
}

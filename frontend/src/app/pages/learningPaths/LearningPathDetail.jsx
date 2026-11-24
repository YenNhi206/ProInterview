import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, CalendarPlus, CheckCircle2, ExternalLink, Layers, MessageSquareWarning, PartyPopper, RefreshCw, Send, Wallet } from "lucide-react";
import { acceptLearningPath, getLearningPath, requestLearningPathRevision } from "../../api/learningPathsApi.js";
import { competenciesApi } from "../../api/competenciesApi.js";
import { CANDIDATE_NEXT_STEP, CANDIDATE_PATH_STATUS, pathProgress } from "../../utils/learningPath/candidateLearningPaths.js";
import { schedulableSession } from "../../utils/learningPath/learningPathTimeline.js";
import { formatVnd } from "../../utils/shared/formatVnd.js";
import { LearningPathTimeline } from "../../components/learningPath/LearningPathTimeline.jsx";
import { PathPaymentPanel } from "../../components/learningPath/PathPaymentPanel.jsx";
import { SessionSchedulePicker } from "../../components/learningPath/SessionSchedulePicker.jsx";
import "../../../styles/mentorship-requests.css";
import "../../../styles/learning-paths.css";

/**
 * LP-19: ứng viên xem lộ trình dạng timeline và đi hết luồng trên UI:
 * proposed → chấp nhận / yêu cầu sửa (LP-08) → pending_payment → chuyển khoản trọn gói (LP-10)
 * → active → đặt lịch từng buổi theo giờ rảnh của mentor (LP-12) → xem đạt / học lại / nhận xét (LP-13).
 */
export function LearningPathDetail() {
  const { id } = useParams();
  const [path, setPath] = useState(null);
  const [framework, setFramework] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const [picking, setPicking] = useState(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const { learningPath } = await getLearningPath(id);
      setPath(learningPath);
      setError("");
    } catch (e) {
      if (!quiet) setError(e.message);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    competenciesApi.getFramework().then((res) => res.success && setFramework(res.framework));
  }, []);
  // Khi tiền về (SePay / admin), lộ trình chuyển sang active trong lúc trang đang mở.
  const poll = useCallback(() => load(true), [load]);
  const prevStatus = useRef(null);
  useEffect(() => {
    if (prevStatus.current === "pending_payment" && path?.status === "active") {
      setNotice("Đã nhận thanh toán. Bạn đặt lịch buổi 1 ngay bên dưới.");
    }
    prevStatus.current = path?.status ?? null;
  }, [path?.status]);

  async function run(action, message) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { learningPath } = await action();
      setPath(learningPath);
      setNotice(message);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="mr-page lp-page"><div className="mr-loading" role="status">Đang tải lộ trình…</div></div>;
  if (!path) {
    return (
      <div className="mr-page lp-page">
        <Link to="/learning-paths" className="mr-back"><ArrowLeft size={15} /> Lộ trình của bạn</Link>
        <div className="mr-error" role="alert">{error || "Không tìm thấy lộ trình."}</div>
      </div>
    );
  }

  const progress = pathProgress(path.sessions);
  const openSession = schedulableSession(path.sessions);
  const originalCount = path.sessions.filter((s) => Number(s.attempt) === 1).length;

  const renderAction = (s) => {
    if (path.status !== "active") return null;
    if (s.canSchedule) {
      return picking === s.id ? (
        <SessionSchedulePicker
          path={path}
          session={s}
          onCancel={() => setPicking(null)}
          onScheduled={(next, message) => { setPath(next); setPicking(null); setNotice(message); }}
        />
      ) : (
        <button type="button" data-button-surface="none" className="mr-primary lp-attempt-action" onClick={() => setPicking(s.id)}>
          <CalendarPlus size={15} />Đặt lịch buổi này
        </button>
      );
    }
    if (s.status === "scheduled" && s.bookingId) {
      return <Link className="mr-text-button lp-attempt-action" to={`/session/${s.bookingId}`}>Xem buổi hẹn, vào phòng học <ExternalLink size={13} /></Link>;
    }
    if (s.status === "pending_payment") {
      return <p className="lp-field-hint lp-attempt-action">Thanh toán buổi bổ sung trên web đang được phát triển. Liên hệ hỗ trợ để thanh toán buổi này.</p>;
    }
    return null;
  };

  return (
    <div className="mr-page lp-page lp-detail">
      <Link to="/learning-paths" className="mr-back"><ArrowLeft size={15} /> Lộ trình của bạn</Link>

      <header className="mr-panel mr-detail-overview">
        <div className="mr-meta">
          <span className={`mr-status ${path.status}`}><span className="mr-status-dot" />{CANDIDATE_PATH_STATUS[path.status] || path.status}</span>
          <span>{path.version > 1 ? `Bản ${path.version}` : ""}{path.proposedAt ? ` · Gửi ngày ${new Date(path.proposedAt).toLocaleDateString("vi-VN")}` : ""}</span>
          <button type="button" data-button-surface="none" className="mr-secondary lp-refresh" onClick={() => load()}><RefreshCw size={14} />Làm mới</button>
        </div>
        <h1 className="lp-detail-title">{path.goal || path.request?.title || "Lộ trình học"}</h1>
        <p className="mr-row-position">
          Mentor {path.mentor?.publicId ? <Link to={`/mentors/${path.mentor.publicId}`} className="lp-mentor-link">{path.mentor.name}</Link> : path.mentor?.name}
          {path.mentor?.title ? ` · ${path.mentor.title}` : ""}{path.request?.position ? ` · ${path.request.position}` : ""}
        </p>
        <div className="lp-card-facts">
          <span><Layers size={14} />{originalCount} buổi</span>
          <span><Wallet size={14} />{formatVnd(path.totalAmount)} trọn gói</span>
          {["active", "completed"].includes(path.status) && <span><CheckCircle2 size={14} />Đã đạt {progress.done}/{progress.total} buổi</span>}
        </div>
        <p className="lp-next-step">{CANDIDATE_NEXT_STEP[path.status]}</p>
        {path.jobPost && <p className="lp-field-hint">Gắn với tin tuyển dụng: {path.jobPost.title}{path.jobPost.company?.name ? ` · ${path.jobPost.company.name}` : ""}</p>}
      </header>

      {error && <div className="mr-error" role="alert">{error}</div>}
      {notice && <div className="mr-notice" role="status"><CheckCircle2 size={18} />{notice}</div>}

      {path.status === "proposed" && (
        <section className="mr-panel lp-block" aria-labelledby="lp-review-title">
          <div className="lp-block-heading"><div><span className="mr-eyebrow">Bước 1</span><h2 id="lp-review-title">Xem và phản hồi lộ trình</h2></div></div>
          <p className="lp-shares">Đồng ý thì bạn chuyển sang thanh toán trọn gói {formatVnd(path.totalAmount)}. Chưa hợp lý thì yêu cầu mentor sửa, mentor sẽ gửi lại bản mới.</p>
          {revisionOpen ? (
            <div className="lp-revision-form">
              <label>Bạn muốn mentor sửa gì? <span className="lp-field-hint">5–2000 ký tự</span>
                <textarea rows={4} maxLength={2000} value={revisionNote} onChange={(e) => setRevisionNote(e.target.value)} placeholder="Ví dụ: Em muốn thêm 1 buổi luyện câu hỏi tình huống, giảm buổi SQL." />
              </label>
              <div className="lp-picker-actions">
                <button type="button" data-button-surface="none" className="mr-secondary" onClick={() => setRevisionOpen(false)}>Hủy</button>
                <button type="button" data-button-surface="none" className="mr-primary" disabled={busy || revisionNote.trim().length < 5}
                  onClick={() => run(() => requestLearningPathRevision(path.id, revisionNote.trim()), "Đã gửi yêu cầu sửa cho mentor.").then((ok) => ok && setRevisionOpen(false))}>
                  <Send size={15} />Gửi yêu cầu sửa
                </button>
              </div>
            </div>
          ) : (
            <div className="lp-picker-actions">
              <button type="button" data-button-surface="none" className="mr-secondary" disabled={busy} onClick={() => setRevisionOpen(true)}><MessageSquareWarning size={15} />Yêu cầu sửa</button>
              <button type="button" data-button-surface="none" className="mr-primary" disabled={busy}
                onClick={() => run(() => acceptLearningPath(path.id, path.version), "Bạn đã chấp nhận lộ trình. Thanh toán để bắt đầu học.")}>
                <CheckCircle2 size={15} />Chấp nhận lộ trình
              </button>
            </div>
          )}
        </section>
      )}

      {path.status === "revision_requested" && (
        <div className="lp-revision" role="note">
          <MessageSquareWarning size={16} />
          <div><strong>Bạn đã yêu cầu sửa — đang chờ mentor gửi lại</strong>{path.revisionNote}</div>
        </div>
      )}

      {path.status === "pending_payment" && <PathPaymentPanel path={path} onPoll={poll} />}

      {path.status === "completed" && (
        <div className="mr-notice lp-done" role="status"><PartyPopper size={18} />Bạn đã hoàn thành lộ trình{path.completedAt ? ` ngày ${new Date(path.completedAt).toLocaleDateString("vi-VN")}` : ""}. Chúc mừng!</div>
      )}

      <section className="mr-panel lp-block" aria-labelledby="lp-sessions-title">
        <div className="lp-block-heading">
          <div><span className="mr-eyebrow">{path.status === "active" ? "Đang học" : "Nội dung"}</span><h2 id="lp-sessions-title">Các buổi trong lộ trình</h2></div>
          {path.status === "active" && (
            <span className="lp-counter">{openSession ? `Đang mở: buổi ${openSession.order}${Number(openSession.attempt) > 1 ? " (học lại)" : ""}` : "Chờ mentor chấm buổi đang học"}</span>
          )}
        </div>
        {path.status === "active" && <p className="lp-shares">Học lần lượt: buổi sau chỉ mở khi mentor chấm buổi trước đạt. Chưa đạt lần đầu thì được học lại miễn phí.</p>}
        <LearningPathTimeline path={path} framework={framework} renderAction={renderAction} />
      </section>

      {path.request && (
        <Link to={`/mentor-requests/${path.mentorshipRequestId}`} className="mr-text-button">Xem yêu cầu mentor ban đầu →</Link>
      )}
    </div>
  );
}

import { CalendarClock, CheckCircle2, CircleDashed, Lock, RotateCcw, Wallet, XCircle } from "lucide-react";
import { formatVnd } from "../../utils/shared/formatVnd.js";
import { shrmLabel } from "../../utils/learningPath/learningPathEditor.js";
import { attemptLabel, groupSessionsByOrder, sessionBadge } from "../../utils/learningPath/learningPathTimeline.js";

const TONE_ICON = { ok: CheckCircle2, bad: XCircle, info: CalendarClock, warn: Wallet, open: CircleDashed, muted: Lock };

/** Nhận xét + điểm năng lực mentor ghi cho một lần học (LP-13). */
export function SessionFeedback({ session, framework }) {
  const fb = session.feedback || {};
  if (!fb.summary) return null;
  const levelLabel = (score) => {
    if (score === null || score === undefined) return framework?.nullLabel || "Chưa đủ dữ liệu";
    const level = framework?.levels?.find((l) => l.score === score);
    return `${score}/5${level?.label ? ` · ${level.label}` : ""}`;
  };
  return (
    <div className="lp-feedback">
      <p className="lp-feedback-summary">{fb.summary}</p>
      {fb.strengths?.length > 0 && (
        <div><strong>Điểm mạnh</strong><ul>{fb.strengths.map((t) => <li key={t}>{t}</li>)}</ul></div>
      )}
      {fb.improvements?.length > 0 && (
        <div><strong>Cần cải thiện</strong><ul>{fb.improvements.map((t) => <li key={t}>{t}</li>)}</ul></div>
      )}
      {fb.scores?.length > 0 && (
        <dl className="lp-feedback-scores">
          {fb.scores.map((r) => (
            <div key={r.shrmKey}>
              <dt>{shrmLabel(r.shrmKey, framework)}</dt>
              <dd>{levelLabel(r.score)}{r.note ? ` — ${r.note}` : ""}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/**
 * LP-19 / LP-21: timeline các buổi của lộ trình, mỗi buổi liệt kê mọi lần học (buổi chính, học lại, buổi bổ sung).
 * `renderAction(session)` cho phép trang gắn nút riêng (ứng viên: đặt lịch / vào buổi; mentor: chấm kết quả).
 */
export function LearningPathTimeline({ path, framework, renderAction }) {
  const groups = groupSessionsByOrder(path?.sessions || []);
  if (!groups.length) return <p className="lp-empty-sessions">Lộ trình chưa có buổi nào.</p>;
  return (
    <ol className="lp-timeline">
      {groups.map((g) => {
        const latestBadge = sessionBadge(g.latest);
        return (
          <li key={g.order} className={`lp-timeline-item lp-tone-${latestBadge.tone}`}>
            <span className="lp-session-index" aria-hidden>{g.order}</span>
            <div className="lp-timeline-body">
              <div className="lp-timeline-head">
                <h3>{g.title}</h3>
                {g.attempts[0]?.shrmKeys?.length > 0 && (
                  <div className="lp-chips">{g.attempts[0].shrmKeys.map((k) => <span key={k} className="lp-chip is-static">{shrmLabel(k, framework)}</span>)}</div>
                )}
                {g.attempts[0]?.objectives?.length > 0 && (
                  <ul className="lp-readonly-objectives">{g.attempts[0].objectives.map((o) => <li key={o}>{o}</li>)}</ul>
                )}
              </div>
              <ol className="lp-attempts">
                {g.attempts.map((s) => {
                  const badge = sessionBadge(s);
                  const Icon = TONE_ICON[badge.tone] || Lock;
                  return (
                    <li key={s.id} className={`lp-attempt lp-tone-${badge.tone}`}>
                      <div className="lp-attempt-row">
                        <span className="lp-attempt-name">
                          {Number(s.attempt) > 1 && <RotateCcw size={13} aria-hidden />}
                          {attemptLabel(s.attempt)}
                          {Number(s.attempt) >= 3 && <em> · {formatVnd(s.shareAmount)}</em>}
                        </span>
                        <span className={`lp-badge lp-tone-${badge.tone}`}><Icon size={13} aria-hidden />{badge.label}</span>
                      </div>
                      {s.booking && s.status !== "done" && (
                        <p className="lp-attempt-meta">Lịch hẹn: {s.booking.timeSlot} ngày {s.booking.date} · {s.booking.durationMinutes} phút</p>
                      )}
                      {s.status === "done" && s.doneAt && (
                        <p className="lp-attempt-meta">Chấm ngày {new Date(s.doneAt).toLocaleDateString("vi-VN")}</p>
                      )}
                      {s.status === "pending_payment" && (
                        <p className="lp-attempt-meta">Mentor đề xuất buổi bổ sung {formatVnd(s.shareAmount)}{s.supplementaryNote ? `: ${s.supplementaryNote}` : ""}.</p>
                      )}
                      <SessionFeedback session={s} framework={framework} />
                      {renderAction?.(s)}
                    </li>
                  );
                })}
              </ol>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

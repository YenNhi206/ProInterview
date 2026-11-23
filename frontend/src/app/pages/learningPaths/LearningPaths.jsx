import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, CheckCircle2, Layers, RefreshCw, Route, Wallet } from "lucide-react";
import { listLearningPaths } from "../../api/learningPathsApi.js";
import {
  CANDIDATE_NEXT_STEP,
  CANDIDATE_PATH_STATUS,
  CANDIDATE_PATH_TABS,
  countByTab,
  filterByTab,
  pathProgress,
} from "../../utils/learningPath/candidateLearningPaths.js";
import { formatVnd } from "../../utils/shared/formatVnd.js";
import "../../../styles/mentorship-requests.css";
import "../../../styles/learning-paths.css";

const date = (value) => (value ? new Date(value).toLocaleDateString("vi-VN") : "");

/**
 * LP-18: ứng viên xem các lộ trình mentor đã gửi cho mình (backend không trả bản nháp).
 * Bấm vào thẻ để sang `/learning-paths/:id` (LP-19): chấp nhận / yêu cầu sửa, thanh toán, đặt lịch từng buổi.
 */
export function LearningPaths() {
  const [paths, setPaths] = useState([]);
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    listLearningPaths()
      .then((body) => active && setPaths(body.learningPaths || []))
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [reload]);

  const counts = useMemo(() => countByTab(paths), [paths]);
  const visible = useMemo(() => filterByTab(paths, tab), [paths, tab]);

  return (
    <div className="mr-page lp-page">
      <header className="mr-heading">
        <div>
          <h1>Lộ trình học của bạn</h1>
          <p>Lộ trình nhiều buổi mentor soạn riêng cho bạn sau buổi đánh giá 0đ. Chấp nhận, thanh toán trọn gói rồi học lần lượt từng buổi.</p>
        </div>
        <button type="button" data-button-surface="none" className="mr-secondary" disabled={loading} onClick={() => setReload((v) => v + 1)}>
          <RefreshCw size={15} /> Làm mới
        </button>
      </header>

      {error && (
        <div className="mr-error" role="alert">
          {error}
          <button data-button-surface="none" onClick={() => setReload((v) => v + 1)}><RefreshCw size={14} /> Tải lại</button>
        </div>
      )}

      {loading ? (
        <div className="mr-loading" role="status">Đang tải lộ trình…</div>
      ) : (
        <>
          <div className="mr-tabs" role="group" aria-label="Lọc lộ trình theo trạng thái">
            {CANDIDATE_PATH_TABS.map((t) => (
              <button key={t.key} data-button-surface="none" aria-pressed={tab === t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>
                {t.label}<span>{counts[t.key]}</span>
              </button>
            ))}
          </div>

          {visible.length ? (
            <div className="mr-list">
              {visible.map((p) => {
                const progress = pathProgress(p.sessions);
                return (
                  <article className="mr-list-item lp-candidate-card" key={p.id}>
                    <div className="mr-meta">
                      <span className={`mr-status ${p.status}`}>{CANDIDATE_PATH_STATUS[p.status] || p.status}</span>
                      <span>Cập nhật {date(p.updatedAt)}{p.version > 1 ? ` · bản ${p.version}` : ""}</span>
                    </div>
                    <h2>{p.goal || p.request?.title || "Lộ trình học"}</h2>
                    <p className="mr-row-position">
                      {p.mentor?.publicId
                        ? <Link to={`/mentors/${p.mentor.publicId}`} className="lp-mentor-link">{p.mentor.name}</Link>
                        : p.mentor?.name}
                      {p.mentor?.title ? ` · ${p.mentor.title}` : ""}
                      {p.request?.position ? ` · ${p.request.position}` : ""}
                    </p>
                    <div className="lp-card-facts">
                      <span><Layers size={14} />{progress.total} buổi</span>
                      <span><Wallet size={14} />{formatVnd(p.totalAmount)} trọn gói</span>
                      {["active", "completed"].includes(p.status) && (
                        <span><CheckCircle2 size={14} />Xong {progress.done}/{progress.total} buổi</span>
                      )}
                    </div>
                    <p className="lp-next-step">{CANDIDATE_NEXT_STEP[p.status]}</p>
                    <Link to={`/learning-paths/${p.id}`} className="mr-list-link">
                      {p.status === "proposed" ? "Xem và phản hồi lộ trình" : p.status === "pending_payment" ? "Thanh toán trọn gói" : p.status === "active" ? "Vào lộ trình, đặt lịch buổi học" : "Xem chi tiết lộ trình"} <ArrowRight size={16} />
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mr-empty mr-panel">
              <Route size={30} />
              <h2>{paths.length ? "Không có lộ trình ở mục này" : "Bạn chưa có lộ trình nào"}</h2>
              <p>
                {paths.length
                  ? "Chọn mục khác để xem các lộ trình còn lại."
                  : "Gửi yêu cầu mentor, chọn mentor phù hợp và học buổi đánh giá 0đ. Mentor sẽ gửi lộ trình cho bạn tại đây."}
              </p>
              {!paths.length && <Link to="/mentor-requests" className="mr-text-button">Gửi yêu cầu mentor →</Link>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

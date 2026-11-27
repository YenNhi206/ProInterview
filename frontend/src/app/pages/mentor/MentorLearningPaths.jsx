import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, CalendarCheck2, CircleDashed, Layers, RefreshCw, Route, Wallet } from "lucide-react";
import { listLearningPaths } from "../../api/learningPathsApi.js";
import { listMentorshipRequests } from "../../api/mentorshipRequestsApi.js";
import { PATH_STATUS, draftableRequests } from "../../utils/learningPath/learningPathEditor.js";
import { formatVnd } from "../../utils/shared/formatVnd.js";
import { MentorPageShell } from "../../components/mentor/MentorPageShell.jsx";
import { MentorPageHeader } from "../../components/mentor/MentorPageHeader.jsx";
import "../../../styles/mentorship-requests.css";
import "../../../styles/learning-paths.css";

const TABS = [
  { key: "all", label: "Tất cả", statuses: null },
  { key: "todo", label: "Cần xử lý", statuses: ["draft", "revision_requested"] },
  { key: "sent", label: "Đã gửi", statuses: ["proposed", "pending_payment"] },
  { key: "active", label: "Đang học", statuses: ["active"] },
  { key: "closed", label: "Đã kết thúc", statuses: ["completed", "cancelled"] },
];
const date = (value) => (value ? new Date(value).toLocaleDateString("vi-VN") : "");

/** LP-20: Mentor xem lộ trình đã soạn và các yêu cầu sẵn sàng soạn lộ trình. */
export function MentorLearningPaths() {
  const [paths, setPaths] = useState([]);
  const [requests, setRequests] = useState([]);
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([listLearningPaths(), listMentorshipRequests("mine")])
      .then(([pathBody, requestBody]) => {
        if (!active) return;
        setPaths(pathBody.learningPaths || []);
        setRequests(draftableRequests(requestBody.requests));
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [reload]);

  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.key, t.statuses ? paths.filter((p) => t.statuses.includes(p.status)).length : paths.length])),
    [paths],
  );
  const visible = useMemo(() => {
    const statuses = TABS.find((t) => t.key === tab)?.statuses;
    return statuses ? paths.filter((p) => statuses.includes(p.status)) : paths;
  }, [paths, tab]);

  return (
    <MentorPageShell bottomPad="pb-24" showAmbient={false} className="bg-transparent text-white">
      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8 py-5">
        <div className="mr-page mr-page-mentor lp-page !max-w-none !p-0">
          <MentorPageHeader
            title="Lộ trình"
            highlight="học tập"
            actions={
              <button
                type="button"
                data-button-surface="none"
                disabled={loading}
                onClick={() => setReload((v) => v + 1)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#160f26]/80 px-4 py-2.5 text-xs font-bold text-slate-300 backdrop-blur-xl transition hover:border-violet-500/50 hover:bg-[#1a1230] hover:text-violet-300 disabled:opacity-50"
              >
                <RefreshCw size={14} className={loading ? "animate-spin text-violet-400" : ""} />
                Làm mới
              </button>
            }
          />

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
          {requests.length > 0 && (
            <section className="lp-ready" aria-labelledby="lp-ready-title">
              <div className="lp-ready-heading">
                <h2 id="lp-ready-title">Sẵn sàng soạn lộ trình</h2>
                <p>Mentee đã chọn bạn. Có thể soạn trước, gửi được khi buổi đánh giá 0đ hoàn thành.</p>
              </div>
              <div className="lp-ready-list">
                {requests.map((r) => {
                  const done = r.assessment?.status === "completed";
                  // Chưa có buổi 0đ (hoặc buổi trước bị hủy / vắng): bước đầu tiên là hẹn buổi 0đ.
                  const needsAssessment = !r.assessment || ["cancelled", "no_show"].includes(r.assessment.status);
                  return (
                    <article className="lp-ready-card" key={r.id}>
                      <h3>{r.title}</h3>
                      <p>{r.position}</p>
                      <span className={`lp-ready-assess ${done ? "is-done" : ""}`}>
                        {done ? <CalendarCheck2 size={14} /> : <CircleDashed size={14} />}
                        {done ? "Đã xong buổi đánh giá 0đ" : r.assessment ? `Buổi 0đ: ${r.assessment.timeSlot} · ${r.assessment.date}` : "Chưa hẹn buổi đánh giá 0đ"}
                      </span>
                      <div className="lp-ready-actions">
                        {needsAssessment && (
                          <Link className="mr-primary" to={`/mentor/requests/${r.id}#buoi-danh-gia`}>
                            Hẹn buổi đánh giá 0đ <ArrowRight size={15} />
                          </Link>
                        )}
                        <Link className={needsAssessment ? "mr-secondary" : "mr-primary"} to={`/mentor/learning-paths/new?requestId=${r.id}`}>
                          Soạn lộ trình <ArrowRight size={15} />
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          <div className="mr-tabs" role="group" aria-label="Lọc lộ trình theo trạng thái">
            {TABS.map((t) => (
              <button key={t.key} data-button-surface="none" aria-pressed={tab === t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>
                {t.label}<span>{counts[t.key]}</span>
              </button>
            ))}
          </div>

          {visible.length ? (
            <div className="mr-list">
              {visible.map((p) => {
                const firstSessions = p.sessions.filter((s) => (s.attempt || 1) === 1).length;
                return (
                  <Link to={`/mentor/learning-paths/${p.id}/edit`} className="mr-list-item" key={p.id}>
                    <div className="mr-meta">
                      <span className={`mr-status ${p.status}`}>{PATH_STATUS[p.status] || p.status}</span>
                      <span>Cập nhật {date(p.updatedAt)}{p.version > 1 ? ` · bản ${p.version}` : ""}</span>
                    </div>
                    <h2>{p.goal || p.request?.title || "Lộ trình chưa đặt mục tiêu"}</h2>
                    <p className="mr-row-position">{p.candidate?.name} · {p.request?.position || "Vị trí chưa rõ"}</p>
                    <div className="lp-card-facts">
                      <span><Layers size={14} />{firstSessions} buổi</span>
                      <span><Wallet size={14} />{p.totalAmount ? formatVnd(p.totalAmount) : "Chưa đặt giá"}</span>
                    </div>
                    <div className="mr-list-link">
                      {["draft", "revision_requested"].includes(p.status) ? "Mở trình soạn" : "Xem lộ trình"}
                      <ArrowRight size={16} />
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="mr-empty mr-panel">
              <Route size={30} />
              <h2>{paths.length ? "Không có lộ trình ở mục này" : "Bạn chưa soạn lộ trình nào"}</h2>
              <p>
                {paths.length
                  ? "Chọn mục khác để xem các lộ trình còn lại."
                  : "Khi mentee chọn bạn ở mục Nhu cầu mentee, hẹn buổi đánh giá 0đ rồi soạn lộ trình tại đây."}
              </p>
              {!paths.length && <Link to="/mentor/requests" className="mr-text-button">Mở Nhu cầu mentee →</Link>}
            </div>
          )}
        </>
      )}
        </div>
      </div>
    </MentorPageShell>
  );
}

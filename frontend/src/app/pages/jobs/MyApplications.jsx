import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Briefcase, Building2, FileText, Loader2, RefreshCw, Undo2 } from "lucide-react";
import { listMyApplications, withdrawApplication } from "../../api/applicationsApi.js";
import { tryApi } from "../../utils/shared/apiToast.js";
import {
  APPLICATION_FILTERS,
  applicationTimeline,
  countByFilter,
  filterApplications,
  statusLabelOf,
} from "../../utils/jobs/applications.js";
import "../../../styles/mentorship-requests.css";
import "../../../styles/cv-vault.css";

/** Lớp màu `mr-status` có sẵn: open (tím), selected (xanh lá), closed (xám). */
const STATUS_CLASS = {
  submitted: "open",
  viewed: "open",
  shortlisted: "selected",
  rejected: "closed",
  withdrawn: "closed",
};

/**
 * JB-13: đơn ứng tuyển của ứng viên (`GET /api/applications/me`, JB-08) — trạng thái do công ty xử lý (JB-09),
 * rút đơn khi còn `submitted` / `viewed` (`PATCH /api/applications/:id/withdraw`).
 */
export function MyApplications() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    listMyApplications().then((res) => {
      if (!active) return;
      if (res.success) setApps(res.applications || []);
      else setError(res.error || "Không tải được đơn ứng tuyển.");
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [reload]);

  const withdraw = async (app) => {
    const title = app.job?.title || "tin tuyển dụng này";
    if (!window.confirm(`Rút đơn ứng tuyển "${title}"? Doanh nghiệp sẽ không còn xem được hồ sơ và CV bạn đã gửi, và bạn không nộp lại được tin này.`)) return;
    setBusyId(app.id);
    const res = await tryApi(() => withdrawApplication(app.id), { fallback: "Không rút được đơn.", successMessage: "Đã rút đơn ứng tuyển." });
    setBusyId("");
    if (res.success) setReload((v) => v + 1);
  };

  const counts = countByFilter(apps);
  const visible = filterApplications(apps, filter);

  return (
    <div className="mr-page cv-vault my-applications">
      <header className="mr-heading">
        <div>
          <h1>Đơn ứng tuyển của tôi</h1>
          <p>Theo dõi trạng thái các đơn đã nộp. Doanh nghiệp xem hồ sơ đã đồng ý chia sẻ lúc nộp; rút đơn thì doanh nghiệp không còn xem được.</p>
        </div>
        <button type="button" data-button-surface="none" className="mr-secondary" disabled={loading} onClick={() => setReload((v) => v + 1)}>
          <RefreshCw size={14} /> Tải lại
        </button>
      </header>

      {error ? (
        <div className="mr-error" role="alert">
          {error}
          <button type="button" data-button-surface="none" onClick={() => setReload((v) => v + 1)}><RefreshCw size={14} /> Thử lại</button>
        </div>
      ) : null}

      {loading ? (
        <div className="mr-loading" role="status">Đang tải đơn ứng tuyển…</div>
      ) : !error && apps.length === 0 ? (
        <div className="mr-empty mr-panel">
          <Briefcase size={30} />
          <h2>Bạn chưa ứng tuyển tin nào</h2>
          <p>Tìm tin tuyển dụng phù hợp, xem bạn còn thiếu gì rồi nộp đơn bằng CV trong kho.</p>
          <Link to="/jobs" className="mr-primary">Xem việc làm</Link>
        </div>
      ) : !error ? (
        <>
          <div className="mr-tabs" role="tablist" aria-label="Lọc đơn ứng tuyển">
            {APPLICATION_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="tab"
                data-button-surface="none"
                aria-selected={filter === f.value}
                className={filter === f.value ? "active" : ""}
                onClick={() => setFilter(f.value)}
              >
                {f.label} ({counts[f.value]})
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="mr-muted">Không có đơn nào trong mục này.</p>
          ) : (
            <div className="mr-list">
              {visible.map((app) => {
                const busy = busyId === app.id;
                const job = app.job || {};
                const jobOpen = job.status === "published";
                return (
                  <article key={app.id} className="mr-list-item">
                    <div className="mr-meta">
                      <span className={`mr-status ${STATUS_CLASS[app.status] || ""}`}>{statusLabelOf(app)}</span>
                      <span>{applicationTimeline(app)}</span>
                    </div>
                    <h2>
                      {job.id && jobOpen ? <Link to={`/jobs/${job.id}`}>{job.title}</Link> : job.title || "Tin tuyển dụng"}
                      {job.id && !jobOpen ? <small className="mr-muted"> (tin đã đóng)</small> : null}
                    </h2>
                    <p className="mr-row-position">
                      <span className="inline-flex items-center gap-1.5">
                        <Building2 size={14} aria-hidden className="shrink-0" /> {job.company?.name || "Doanh nghiệp"}
                      </span>
                    </p>
                    {app.cv ? (
                      <p className="mr-row-description">
                        <span className="inline-flex items-center gap-1.5">
                          <FileText size={14} aria-hidden className="shrink-0" /> CV đã gửi: {app.cv.title || "CV"}
                        </span>
                      </p>
                    ) : null}
                    {app.status === "rejected" ? (
                      <p className="mr-row-description">Doanh nghiệp đã xem xét và chưa chọn hồ sơ này. Bạn có thể luyện thêm câu hỏi của doanh nghiệp và ứng tuyển tin khác.</p>
                    ) : app.status === "shortlisted" ? (
                      <p className="mr-row-description">Hồ sơ của bạn đã vào danh sách chọn. Doanh nghiệp sẽ liên hệ qua email bạn đã chia sẻ.</p>
                    ) : null}
                    {app.canWithdraw ? (
                      <div className="cv-actions">
                        <button type="button" data-button-surface="none" className="mr-secondary" disabled={busy} onClick={() => withdraw(app)}>
                          {busy ? <Loader2 size={14} className="cv-spin" /> : <Undo2 size={14} />} Rút đơn
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Copy, ExternalLink, FileText, PencilLine, Loader2, RefreshCw, Star, Trash2, Upload } from "lucide-react";
import { cvsApi } from "../../api/cvsApi.js";
import { tryApi } from "../../utils/shared/apiToast.js";
import { CV_ACCEPT_ATTR, cvFileError, defaultCvTitle, formatFileSize, sortCvs } from "../../utils/cv/cvVault.js";
import "../../../styles/mentorship-requests.css";
import "../../../styles/cv-vault.css";

const date = (value) => (value ? new Date(value).toLocaleDateString("vi-VN") : "");

/**
 * PR-11: kho CV của ứng viên — tải lên, nhân bản, đặt mặc định, xóa (API `/api/cvs`, PR-02).
 * CV mặc định dùng cho ứng tuyển và hồ sơ (PR-10); sửa nội dung CV ở `/cvs/:id/edit` (PR-13).
 */
export function CvVault() {
  const [cvs, setCvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    cvsApi.list().then((res) => {
      if (!active) return;
      if (res.success) setCvs(sortCvs(res.items || res.cvs || []));
      else setError(res.error);
      setLoading(false);
    });
    return () => { active = false; };
  }, [reload]);

  const run = async (id, fn, successMessage) => {
    setBusyId(id);
    const res = await tryApi(fn, { fallback: "Không thực hiện được thao tác.", successMessage });
    setBusyId("");
    if (res.success) setReload((v) => v + 1);
    return res;
  };

  const remove = (cv) => {
    const extra = cv.isDefault && cvs.length > 1 ? " CV mới cập nhật gần nhất sẽ thành CV mặc định." : "";
    if (!window.confirm(`Xóa "${cv.title}" khỏi kho CV?${extra}`)) return;
    run(cv.id, () => cvsApi.remove(cv.id), "Đã xóa CV.");
  };

  return (
    <div className="mr-page cv-vault">
      <header className="mr-heading">
        <div>
          <h1>Kho CV của bạn</h1>
          <p>Lưu nhiều phiên bản CV cho từng vị trí. CV mặc định được dùng khi ứng tuyển và hiển thị trên hồ sơ.</p>
        </div>
        <button type="button" data-button-surface="none" className="mr-secondary" disabled={loading} onClick={() => setReload((v) => v + 1)}>
          <RefreshCw size={15} /> Làm mới
        </button>
      </header>

      <UploadPanel onUploaded={() => setReload((v) => v + 1)} />

      {error && (
        <div className="mr-error" role="alert">
          {error}
          <button data-button-surface="none" onClick={() => setReload((v) => v + 1)}><RefreshCw size={14} /> Tải lại</button>
        </div>
      )}

      {loading ? (
        <div className="mr-loading" role="status">Đang tải kho CV…</div>
      ) : cvs.length ? (
        <div className="mr-list">
          {cvs.map((cv) => {
            const busy = busyId === cv.id;
            return (
              <article key={cv.id} className={`mr-list-item cv-card${cv.isDefault ? " is-default" : ""}`}>
                <div className="mr-meta">
                  {cv.isDefault ? <span className="mr-status selected"><Star size={11} /> Mặc định</span> : <span className="mr-status">Bản {cv.version || 1}</span>}
                  <span>Cập nhật {date(cv.updatedAt)}</span>
                </div>
                <h2>{cv.title}</h2>
                <p className="mr-row-position">{cv.targetRole || "Chưa đặt vị trí mục tiêu"}</p>
                <p className="cv-file">
                  <FileText size={14} />
                  <span title={cv.fileName}>{cv.fileName || "CV soạn trên ProInterview"}</span>
                  {cv.fileSize ? <small>{formatFileSize(cv.fileSize)}</small> : null}
                </p>
                <div className="cv-actions">
                  <Link className="mr-secondary" to={`/cvs/${cv.id}/edit`}>
                    <PencilLine size={14} /> Sửa nội dung
                  </Link>
                  {cv.fileUrl && (
                    <a className="mr-secondary" href={cv.fileUrl} target="_blank" rel="noreferrer">
                      <ExternalLink size={14} /> Xem tệp
                    </a>
                  )}
                  {!cv.isDefault && (
                    <button type="button" data-button-surface="none" className="mr-secondary" disabled={busy} onClick={() => run(cv.id, () => cvsApi.setDefault(cv.id), "Đã đặt làm CV mặc định.")}>
                      <Star size={14} /> Đặt mặc định
                    </button>
                  )}
                  <button type="button" data-button-surface="none" className="mr-secondary" disabled={busy} onClick={() => run(cv.id, () => cvsApi.duplicate(cv.id), "Đã nhân bản CV.")}>
                    <Copy size={14} /> Nhân bản
                  </button>
                  <button type="button" data-button-surface="none" className="mr-secondary cv-danger" disabled={busy} onClick={() => remove(cv)} aria-label={`Xóa ${cv.title}`}>
                    <Trash2 size={14} /> Xóa
                  </button>
                  {busy && <Loader2 size={15} className="cv-spin" aria-label="Đang xử lý" />}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        !error && (
          <div className="mr-empty mr-panel">
            <FileText size={30} />
            <h2>Kho CV đang trống</h2>
            <p>Tải lên CV đầu tiên ở trên. CV đầu tiên sẽ tự thành CV mặc định.</p>
            <Link to="/cv-analysis" className="mr-text-button">Hoặc phân tích CV với JD →</Link>
          </div>
        )
      )}
    </div>
  );
}

function UploadPanel({ onUploaded }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  /** Tên do hệ thống điền theo tệp; người dùng tự gõ tên khác thì không ghi đè nữa. */
  const [autoTitle, setAutoTitle] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [fileError, setFileError] = useState("");
  const [uploading, setUploading] = useState(false);

  const pick = (f) => {
    setFile(f || null);
    setFileError(f ? cvFileError(f) || "" : "");
    if (f && (!title.trim() || title === autoTitle)) {
      const next = defaultCvTitle(f.name);
      setTitle(next);
      setAutoTitle(next);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const err = cvFileError(file);
    if (err) { setFileError(err); return; }
    setUploading(true);
    const res = await tryApi(() => cvsApi.upload({ file, title, targetRole }), {
      fallback: "Không tải lên được CV.",
      successMessage: "Đã thêm CV vào kho.",
    });
    setUploading(false);
    if (res.success) {
      setFile(null); setTitle(""); setAutoTitle(""); setTargetRole(""); setFileError("");
      if (inputRef.current) inputRef.current.value = "";
      onUploaded();
    }
  };

  return (
    <form className="mr-panel cv-upload" onSubmit={submit}>
      <div className="mr-form-grid">
        <label>
          Tệp CV (PDF, DOCX, DOC, TXT · tối đa 5 MB)
          <input ref={inputRef} type="file" accept={CV_ACCEPT_ATTR} onChange={(e) => pick(e.target.files?.[0])} aria-invalid={Boolean(fileError)} />
          {fileError && <span className="cv-field-error" role="alert">{fileError}</span>}
        </label>
        <label>
          Tên CV
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Ví dụ: CV Frontend – bản tiếng Anh" />
        </label>
        <label>
          Vị trí mục tiêu (không bắt buộc)
          <input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} maxLength={120} placeholder="Ví dụ: Frontend Developer" />
        </label>
        <div className="cv-upload-submit">
          <button type="submit" data-button-surface="none" className="mr-primary" disabled={uploading || !file || Boolean(fileError)}>
            {uploading ? <Loader2 size={15} className="cv-spin" /> : <Upload size={15} />}
            {uploading ? "Đang tải lên…" : "Tải lên CV"}
          </button>
        </div>
      </div>
      <p className="mr-muted">Hệ thống kiểm tra tệp có đúng là CV không; ảnh, hóa đơn hay tài liệu khác sẽ bị từ chối.</p>
    </form>
  );
}

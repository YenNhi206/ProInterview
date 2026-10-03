import { useState, useEffect } from "react";
import { financeRequest } from "../../api/financeOperationsApi.js";
import { useNavigate } from "react-router";
import { Trash2 as Trash } from "lucide-react";
import { toastApiError, toastApiSuccess, tryApi } from "../../utils/shared/apiToast.js";
import { deleteAccount, getUser } from "../../utils/auth/auth.js";

export function AccountDangerZone({ SectionCard }) {
  const navigate = useNavigate();
  const user = getUser();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [impact, setImpact] = useState(null);
  const [error, setError] = useState("");
  const loadImpact = async () => {
    setError("");
    try { setImpact((await financeRequest("/api/auth/me/closure-impact")).impact); }
    catch (err) { setError(err.message); }
  };
  useEffect(() => { void loadImpact(); }, []);

  const email = (user?.email || "").trim().toLowerCase();
  const canDelete = impact?.canClose && user?.role !== "admin" && email && confirmText.trim().toLowerCase() === email;

  const handleDeleteAccount = async () => {
    if (!canDelete) {
      toastApiError("Nhập đúng email tài khoản để xác nhận.");
      return;
    }
    if (!window.confirm("Đóng vĩnh viễn tài khoản và ngừng quyền truy cập? Lịch sử tài chính được giữ để đối soát.")) {
      return;
    }
    setDeleting(true);
    const res = await tryApi(() => deleteAccount(), { fallback: "Không xóa được tài khoản." });
    setDeleting(false);
    if (!res.success) { await loadImpact(); return; }
    toastApiSuccess(res.message || "Đã xóa tài khoản.");
    navigate("/");
  };

  return (
    <SectionCard className="settings-danger" title="Đóng tài khoản" icon={Trash}>
      <div className="settings-danger-copy">
        <p>Tài khoản sẽ bị đóng vĩnh viễn, thông tin cơ bản được ẩn danh và các phiên đăng nhập bị vô hiệu hóa. Lịch sử tài chính vẫn được giữ để đối soát.</p>
        {error && <p role="alert" className="settings-text-error">{error}</p>}
        {!impact && !error && <p role="status">Đang kiểm tra tài khoản…</p>}
        {impact?.blockers.length > 0 && <ul className="settings-text-warning">{impact.blockers.map((blocker) => <li key={blocker.code}>{blocker.message}</li>)}</ul>}
        {impact && <p>Sau khi đóng, bạn không thể truy cập {impact.asStudent.activeEnrollments} khóa học đã mua bằng tài khoản này.</p>}
        <button type="button" onClick={loadImpact} className="settings-text-action">Kiểm tra lại</button>
      </div>
      <div className="settings-danger-controls">
        <label htmlFor="settings-close-email">Nhập email tài khoản để xác nhận</label>
        <input id="settings-close-email" type="email" autoComplete="off" placeholder={email || "email@example.com"}
          className="settings-input" value={confirmText} disabled={deleting} onChange={(event) => setConfirmText(event.target.value)} />
        <button type="button" className="settings-button settings-button--danger" disabled={!canDelete || deleting} onClick={handleDeleteAccount}>
          {deleting ? "Đang đóng…" : "Đóng tài khoản"}
        </button>
      </div>
    </SectionCard>
  );
}

export default AccountDangerZone;

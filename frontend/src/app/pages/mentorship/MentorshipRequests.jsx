import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { ArrowLeft, ArrowRight, Briefcase, CheckCircle2, Clock, Download, FileText, LockKeyhole, MessageSquare, Plus, RefreshCw, Users } from "lucide-react";
import { mentorshipBackTarget } from "../../utils/mentor/mentorshipNavigation.js";
import { getUser } from "../../utils/auth/auth.js";
import { listMentorshipDocuments, listMentorshipRequests, getMentorshipRequest, createMentorshipRequest, sendMentorshipOffer, selectMentorshipOffer, withdrawMentorshipOffer, closeMentorshipRequest, downloadMentorshipFile } from "../../api/mentorshipRequestsApi.js";
import "../../../styles/mentorship-requests.css";

const TYPES = { mock_interview: "Phỏng vấn thử", cv_review: "Review CV", career_consulting: "Tư vấn nghề nghiệp" };
const STATUS = { open: "Đang nhận đề nghị", selected: "Đã chọn Mentor", closed: "Đã đóng" };
const money = value => `${Number(value || 0).toLocaleString("vi-VN")}₫`;
const date = value => new Date(value).toLocaleDateString("vi-VN");

export function MentorshipRequests() {
  const mentor = getUser()?.role === "mentor";
  const base = mentor ? "/mentor/requests" : "/mentor-requests";
  const { requestId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [scope, setScope] = useState("open");
  const [rows, setRows] = useState([]);
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const confirmationRef = useRef(null);
  useEffect(() => {
    if (confirmation && confirmationRef.current && !confirmationRef.current.open) confirmationRef.current.showModal();
  }, [confirmation]);
  const [reload, setReload] = useState(0);
  const isNew = requestId === "new" && !mentor;
  const backTarget = mentorshipBackTarget({ returnTo: location.state?.returnTo, mentor, detail: !!requestId && !isNew });
  const entryState = { returnTo: `${location.pathname}${location.search}` };
  const [documentMode, setDocumentMode] = useState({ cv: "upload", jd: "upload" });
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState("");
  const [documentsReload, setDocumentsReload] = useState(0);
  useEffect(() => {
    if (!isNew) return;
    let active = true;
    setDocumentsLoading(true); setDocumentsError("");
    listMentorshipDocuments().then(body => { if (active) setDocuments(body.documents); })
      .catch(error => { if (active) setDocumentsError(error.message); })
      .finally(() => { if (active) setDocumentsLoading(false); });
    return () => { active = false; };
  }, [isNew, documentsReload]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setNotice(""); setRequest(null); setConfirmation(null);
    const fetchData = isNew ? Promise.resolve(null) : requestId ? getMentorshipRequest(requestId) : listMentorshipRequests(scope);
    fetchData.then(body => { if (!active) return; if (requestId) setRequest(body?.request || null); else setRows(body.requests); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [requestId, scope, reload, isNew]);
  const action = async (fn, message) => {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { const body = await fn(); if (body?.request) setRequest(body.request); setNotice(message); setConfirmation(null); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const chosen = request?.offers.find(offer => offer.id === request.selectedOfferId);
  const ownOffer = mentor ? request?.offers[0] : null;
  const submitNew = async event => {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget);
    for (const kind of ["cv", "jd"]) {
      if (form.get(`${kind}Source`)) continue;
      const file = form.get(kind);
      if (!file?.size || file.size > 5 * 1024 * 1024 || !/\.(pdf|doc|docx|txt)$/i.test(file.name)) { setError("CV và JD phải là PDF, DOC, DOCX hoặc TXT, tối đa 5MB mỗi file."); return; }
    }
    setBusy(true); setError("");
    try { const body = await createMentorshipRequest(form); navigate(`${base}/${body.request.id}`, { replace: true, state: { returnTo: backTarget.to } }); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const submitOffer = event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    action(() => sendMentorshipOffer(request.id, Object.fromEntries(data)), "Đã gửi đề nghị. Bạn có thể theo dõi tại mục Đề nghị của tôi.");
  };
  return <div className={`mr-page ${mentor ? "mr-page-mentor" : ""} ${isNew ? "mr-page-new" : requestId ? "mr-page-detail" : ""}`}>
    <header className="mr-heading"><div><Link to={backTarget.to} className="mr-back"><ArrowLeft size={15} />{backTarget.label}</Link><h1>{isNew ? "Đăng nhu cầu tìm Mentor" : requestId ? "Chi tiết yêu cầu" : mentor ? "Nhu cầu từ mentee" : "Yêu cầu của tôi"}</h1><p>{isNew ? "Chia sẻ mục tiêu và CV/JD để nhận đề nghị từ Mentor phù hợp." : requestId ? "Theo dõi đề nghị và chuẩn bị buổi gặp ngay tại đây." : mentor ? "Tìm nhu cầu phù hợp với chuyên môn và chủ động đề xuất hỗ trợ." : "Đăng nhu cầu, nhận đề nghị và chọn Mentor phù hợp với bạn."}</p></div>{!isNew && <button type="button" data-button-surface="none" className="mr-secondary" disabled={busy || loading} onClick={() => setReload(value => value + 1)}><RefreshCw size={15} /> Làm mới</button>}{!requestId && !mentor && <Link className="mr-primary" to={`${base}/new`} state={entryState}><Plus size={17} /> Đăng nhu cầu</Link>}</header>
    {error && <div className="mr-error" role="alert">{error}<button data-button-surface="none" onClick={() => setReload(value => value + 1)} disabled={busy}><RefreshCw size={14} /> Tải lại</button></div>}
    {notice && <div className="mr-notice" role="status"><CheckCircle2 size={18} />{notice}</div>}
    {loading ? <div className="mr-loading" role="status">Đang tải yêu cầu…</div> : isNew ? <form className="mr-form mr-panel" onSubmit={submitNew}>
      <div className="mr-form-grid"><label>Vị trí ứng tuyển<input name="position" required maxLength={160} placeholder="Frontend Developer" /></label><label>Hình thức hỗ trợ<select name="sessionType" required>{Object.entries(TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
      <label>Bạn muốn Mentor giúp gì?<textarea name="description" required minLength={20} maxLength={4000} rows={3} placeholder="Ví dụ: Luyện trả lời câu hỏi React và góp ý cách trình bày dự án trong CV." /></label>
      <details className="mr-optional">
        <summary>Thêm thời gian và ngân sách <span>Không bắt buộc</span></summary>
        <div className="mr-form-grid"><label>Thời gian mong muốn<input name="availability" maxLength={500} placeholder="Ví dụ: Tối thứ 3, sau 19:00" /></label><label>Ngân sách / buổi (VND)<input name="budget" type="number" min={0} max={100000000} step={1000} placeholder="Để trống nếu muốn trao đổi sau" /></label></div>
      </details>
      <div className="mr-document-section-heading"><h2>CV & JD</h2><span><LockKeyhole size={13} />Chỉ chia sẻ với Mentor bạn chọn</span></div>
      <div className="mr-form-grid">{["cv", "jd"].map(kind => {
        const saved = documents.filter(document => document.kind === kind);
        return <div className="mr-upload" key={kind}>
          <div className="mr-document-heading"><FileText size={21} /><strong>{kind.toUpperCase()}</strong></div>
          <div className="mr-document-tabs" role="group" aria-label={`Nguồn ${kind.toUpperCase()}`}>
            <button type="button" data-button-surface="none" aria-pressed={documentMode[kind] === "upload"} className={documentMode[kind] === "upload" ? "active" : ""} onClick={() => setDocumentMode(previous => ({ ...previous, [kind]: "upload" }))}>Tải file mới</button>
            <button type="button" data-button-surface="none" aria-pressed={documentMode[kind] === "saved"} className={documentMode[kind] === "saved" ? "active" : ""} onClick={() => setDocumentMode(previous => ({ ...previous, [kind]: "saved" }))}>Chọn {kind.toUpperCase()} đã lưu</button>
          </div>
          {documentMode[kind] === "upload" ? <label>Tệp từ máy tính<small className="mr-document-hint">PDF, DOC, DOCX, TXT · tối đa 5MB</small><input name={kind} type="file" accept=".pdf,.doc,.docx,.txt" required /></label>
            : documentsLoading ? <p className="mr-document-hint" role="status">Đang tải tài liệu của bạn…</p>
            : documentsError ? <div><p className="mr-document-hint" role="alert">{documentsError}</p><button type="button" data-button-surface="none" className="mr-text-button" onClick={() => setDocumentsReload(value => value + 1)}>Thử tải lại</button></div>
            : saved.length ? <label>Chọn một phiên bản<select name={`${kind}Source`} required defaultValue=""><option value="" disabled>Chọn {kind.toUpperCase()} đã tải trước đây…</option>{saved.map(document => <option key={document.id} value={document.id}>{document.name} · {document.source} · {date(document.createdAt)}</option>)}</select><small className="mr-document-hint">Yêu cầu mới sẽ giữ bản sao của tài liệu bạn chọn, tối đa 5MB.</small></label>
            : <div><p className="mr-document-hint">Chưa có {kind.toUpperCase()} đã lưu trong lịch sử phân tích, lịch hẹn hoặc yêu cầu Mentor của bạn.</p><button type="button" data-button-surface="none" className="mr-text-button" onClick={() => setDocumentMode(previous => ({ ...previous, [kind]: "upload" }))}>Tải file từ máy tính →</button></div>}
        </div>;
      })}</div>
      <div className="mr-form-bottom"><p>Mentor sẽ gửi đề nghị dựa trên thông tin này.</p><div className="mr-form-actions"><Link to={backTarget.to} className="mr-cancel">Hủy</Link><button data-button-surface="none" className="mr-primary" disabled={busy || ["cv", "jd"].some(kind => documentMode[kind] === "saved" && (documentsLoading || !!documentsError || !documents.some(document => document.kind === kind)))}>{busy ? "Đang đăng…" : "Đăng nhu cầu"}<ArrowRight size={16} /></button></div></div>
    </form> : request ? <>
      <div className="mr-detail-layout">
        <div className="mr-detail-main">
          <section className="mr-panel mr-detail-overview" aria-labelledby="request-detail-title">
            <div className="mr-meta"><span className={`mr-status ${request.status}`}><span className="mr-status-dot" />{STATUS[request.status]}</span><span>Đăng ngày {date(request.createdAt)}</span></div>
            <h2 id="request-detail-title">{request.title}</h2>
            <div className="mr-detail-type"><Briefcase size={14} /><span>{request.position}</span><span aria-hidden>·</span><span>{TYPES[request.sessionType]}</span></div>
            <div className="mr-detail-goal"><h3>{mentor ? "Mentee muốn được hỗ trợ" : "Mục tiêu của bạn"}</h3><p className="mr-description">{request.description}</p></div>
          </section>
      <section className="mr-panel mr-detail-offers"><div className="mr-section-heading"><div><span className="mr-eyebrow">{mentor ? "Cách bạn có thể hỗ trợ" : "Chọn người phù hợp với mục tiêu của bạn"}</span><h2>{mentor ? "Đề nghị của bạn" : `Đề nghị từ Mentor (${request.offers.filter(offer => offer.status === "pending").length})`}</h2></div></div>
      {request.offers.length ? <div className="mr-offers">{request.offers.map(offer => <article className={`mr-offer ${request.selectedOfferId === offer.id ? "selected" : ""}`} key={offer.id}><div className="mr-offer-top"><div className="mr-avatar">{offer.mentorName.charAt(0)}</div><div><Link to={mentor ? "/profile" : `/mentors/${offer.mentorPublicId}`}>{offer.mentorName}</Link><p>{offer.mentorTitle}</p></div><span className="mr-estimate">{money(offer.priceEstimate)}<small>Phí tham khảo / buổi 60 phút</small></span></div><p className="mr-description">{offer.message}</p><div className="mr-offer-time"><Clock size={15} />{offer.availability}</div><div className="mr-offer-bottom"><span>{offer.status === "withdrawn" ? "Đã rút đề nghị" : request.selectedOfferId === offer.id ? "Đề nghị đã được chọn" : request.status === "selected" ? "Mentee đã chọn đề nghị khác" : date(offer.createdAt)}</span>{!mentor && request.status === "open" && offer.status === "pending" && <button data-button-surface="none" className="mr-primary" onClick={() => setConfirmation({ offer })} disabled={busy}>Chọn Mentor này <ArrowRight size={15} /></button>}{mentor && request.status === "open" && offer.status === "pending" && <button data-button-surface="none" className="mr-secondary" onClick={() => action(() => withdrawMentorshipOffer(request.id, offer.id), "Đã rút đề nghị.")} disabled={busy}>Rút đề nghị</button>}</div></article>)}</div> : <div className="mr-empty"><Users size={27} /><h3>{mentor ? "Bạn chưa gửi đề nghị" : "Chưa có đề nghị nào"}</h3><p>{mentor ? "Giới thiệu cách bạn có thể hỗ trợ trong biểu mẫu bên dưới." : "Mentor đã được duyệt có thể xem nhu cầu này và đề xuất hỗ trợ. Bạn có thể quay lại sau hoặc chủ động tìm Mentor."}</p>{!mentor && <Link to="/mentors" className="mr-text-button">Chủ động tìm Mentor →</Link>}</div>}
      {mentor && request.status === "open" && !ownOffer && <form className="mr-offer-form" onSubmit={submitOffer}><label>Bạn có thể hỗ trợ như thế nào?<textarea name="message" required minLength={20} maxLength={3000} rows={4} placeholder="Nêu chuyên môn phù hợp, nội dung dự kiến và kết quả mentee nhận được…" /></label><label>Thời gian bạn có thể gặp<input name="availability" required maxLength={500} placeholder="Ví dụ: Thứ 5, 19:00–20:00 (giờ Việt Nam)" /></label><p className="mr-muted">Mức phí tham khảo lấy từ hồ sơ của bạn cho loại buổi này. Giá cuối cùng và ưu đãi hiển thị tại checkout; thời gian được chốt theo lịch trống. Một đề nghị tương ứng một buổi 60 phút.</p><button data-button-surface="none" className="mr-primary" disabled={busy}>{busy ? "Đang gửi…" : "Gửi đề nghị hỗ trợ"}<ArrowRight size={16} /></button></form>}
      </section>

        </div>
        <aside className="mr-detail-sidebar" aria-label="Thông tin và tài liệu yêu cầu">
          {request.status === "selected" && chosen && <section className="mr-panel mr-detail-booking">
            <div className="mr-detail-section-label"><CheckCircle2 size={17} /><h2>Mentor đã chọn</h2></div>
            <div className="mr-detail-chosen"><div className="mr-avatar">{chosen.mentorName.charAt(0)}</div><div><strong>{chosen.mentorName}</strong><p>{chosen.mentorTitle}</p></div></div>
            {request.bookingId ? <Link className="mr-primary" to={mentor ? `/mentor/meeting-detail/${request.bookingId}` : `/session/${request.bookingId}`}>Xem lịch hẹn <ArrowRight size={16} /></Link> : !mentor ? <><p className="mr-muted">Chọn giờ phù hợp và xác nhận phí để hoàn tất đặt lịch.</p><Link className="mr-primary" to={`/booking/${chosen.mentorPublicId}?mentorshipRequestId=${request.id}`}>Chọn lịch và thanh toán <ArrowRight size={16} /></Link></> : <p className="mr-muted">Đang chờ mentee chọn giờ và hoàn tất đặt lịch.</p>}
          </section>}
          <section className="mr-panel mr-detail-information">
            <div className="mr-detail-section-label"><Clock size={17} /><h2>Thông tin buổi gặp</h2></div>
            <dl className="mr-detail-dl"><div><dt>Thời gian mong muốn</dt><dd>{request.availability || "Trao đổi với Mentor"}</dd></div><div><dt>Ngân sách / buổi</dt><dd className={request.budget == null ? "" : "mr-detail-amount"}>{request.budget == null ? "Chưa xác định" : money(request.budget)}</dd></div><div><dt>Hình thức</dt><dd>{TYPES[request.sessionType]}</dd></div></dl>
            <div className="mr-detail-documents">
              <div className="mr-detail-section-label"><FileText size={17} /><h2>Tài liệu của {mentor ? "mentee" : "bạn"}</h2></div>
              {request.canDownload ? <div className="mr-detail-file-list">{["cv", "jd"].map(kind => <button type="button" data-button-surface="none" key={kind} onClick={() => action(() => downloadMentorshipFile(request.id, kind, request[`${kind}Name`]), "Đã tải tài liệu.")} disabled={busy} aria-label={`Tải ${kind.toUpperCase()}: ${request[`${kind}Name`]}`}><span className="mr-file-kind">{kind.toUpperCase()}</span><span className="mr-file-name" title={request[`${kind}Name`]}>{request[`${kind}Name`]}</span><Download size={15} /></button>)}</div> : <p className="mr-muted">Mentee sẽ chia sẻ CV/JD khi chọn đề nghị của bạn.</p>}
              <p className="mr-detail-private"><LockKeyhole size={12} /><span>Chỉ mentee và Mentor được chọn có quyền tải tài liệu.</span></p>
            </div>
          </section>
          {request.status === "open" && <div className="mr-detail-tip"><MessageSquare size={16} /><p>{mentor ? "Đọc mục tiêu và gửi đề nghị cụ thể để mentee dễ lựa chọn." : "Khi có đề nghị, bạn có thể so sánh chuyên môn, lịch và phí trước khi chọn Mentor."}</p></div>}
          {!mentor && request.status === "open" && <button type="button" data-button-surface="none" className="mr-close-request" onClick={() => setConfirmation({ close: true })}>Ngừng nhận đề nghị</button>}
        </aside>
      </div>
      {confirmation && <dialog ref={confirmationRef} className="mr-confirm" aria-label="Xác nhận lựa chọn" onCancel={event => { if (busy) event.preventDefault(); else setConfirmation(null); }}><h3>{confirmation.close ? "Đóng yêu cầu này?" : `Chọn ${confirmation.offer.mentorName}?`}</h3><p>{confirmation.close ? "Yêu cầu sẽ ngừng nhận đề nghị mới. Hành động này không tạo hoặc hủy lịch hẹn." : "Yêu cầu sẽ ngừng nhận đề nghị mới và chia sẻ CV/JD với Mentor này. Bạn sẽ chọn giờ và thanh toán ở bước tiếp theo."}</p><div><button data-button-surface="none" className="mr-secondary" disabled={busy} onClick={() => setConfirmation(null)}>Quay lại</button><button data-button-surface="none" className="mr-primary" disabled={busy} onClick={() => action(() => confirmation.close ? closeMentorshipRequest(request.id) : selectMentorshipOffer(request.id, confirmation.offer.id), confirmation.close ? "Đã đóng yêu cầu." : "Đã chọn Mentor. Tiếp tục chọn lịch khi bạn sẵn sàng.")}>{busy ? "Đang xử lý…" : "Xác nhận"}</button></div></dialog>}
    </> : !requestId ? <>
      {mentor && <div className="mr-tabs" role="group" aria-label="Danh sách nhu cầu">{[["open", "Nhu cầu đang mở"], ["mine", "Đề nghị của tôi"]].map(([value, label]) => <button key={value} data-button-surface="none" aria-pressed={scope === value} className={scope === value ? "active" : ""} onClick={() => setScope(value)}>{label}</button>)}</div>}
      <div className="mr-list">{rows.map(row => <Link to={`${base}/${row.id}`} state={entryState} className="mr-list-item" key={row.id}><div className="mr-meta"><span className={`mr-status ${row.status}`}>{STATUS[row.status]}</span><span>{date(row.createdAt)}</span></div><h2>{row.title}</h2><p className="mr-row-position">{row.position} · {TYPES[row.sessionType]}</p><p className="mr-row-description">{row.description}</p><div className="mr-list-bottom"><span><Clock size={14} />{row.availability || "Linh hoạt thời gian"}</span><strong>{row.budget == null ? "Trao đổi ngân sách" : <>{money(row.budget)} <small>/ buổi</small></>}</strong></div><div className="mr-list-link">{mentor ? "Xem nhu cầu và đề nghị" : `${row.offerCount ?? 0} đề nghị · Xem chi tiết`}<ArrowRight size={16} /></div></Link>)}</div>
      {!rows.length && !error && <div className="mr-empty mr-panel"><MessageSquare size={30} /><h2>{mentor ? scope === "mine" ? "Bạn chưa gửi đề nghị nào" : "Chưa có nhu cầu đang mở" : "Bạn chưa đăng nhu cầu nào"}</h2><p>{mentor ? "Quay lại danh sách nhu cầu để tìm mentee phù hợp với chuyên môn của bạn." : "Đính kèm CV, JD và mô tả mục tiêu để Mentor có thể chủ động đề xuất hỗ trợ."}</p>{!mentor && <Link className="mr-primary" to={`${base}/new`} state={entryState}>Đăng nhu cầu đầu tiên <Plus size={16} /></Link>}</div>}
    </> : null}
  </div>;
}

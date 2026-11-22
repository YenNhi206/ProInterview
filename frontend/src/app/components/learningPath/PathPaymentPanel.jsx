import { useEffect, useState } from "react";
import { Copy, Loader2, QrCode, RefreshCw, Send } from "lucide-react";
import { checkoutLearningPath, submitLearningPathTransfer } from "../../api/learningPathsApi.js";
import { BANK_TRANSFER, buildVietQrImageUrl, displayBankName, inferVietQrBankId } from "../../utils/shared/bankTransfer.js";
import { formatVnd } from "../../utils/shared/formatVnd.js";

const mmss = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

/**
 * LP-19: thanh toán trọn gói lộ trình bằng chuyển khoản (API LP-10). Bấm "Lấy mã" → backend sinh mã PI…
 * (gọi lại khi mã còn hạn trả đúng mã cũ). SePay hoặc admin xác nhận → lộ trình `active`; trang cha poll
 * lại lộ trình (`onPoll`) mỗi 5 giây khi đang mở mã.
 */
export function PathPaymentPanel({ path, onPoll }) {
  const [payment, setPayment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState("");

  const expiresAt = payment?.paymentExpiresAt ? new Date(payment.paymentExpiresAt).getTime() : 0;
  const remaining = expiresAt ? expiresAt - now : 0;
  const expired = Boolean(payment) && remaining <= 0;

  useEffect(() => {
    if (!payment || expired) return undefined;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => onPoll?.(), 5000);
    return () => { clearInterval(tick); clearInterval(poll); };
  }, [payment, expired, onPoll]);

  async function getCode() {
    setBusy(true);
    setError("");
    try {
      const body = await checkoutLearningPath(path.id);
      setPayment(body.payment);
      setSubmitted(Boolean(body.payment?.submittedAt));
      setNow(Date.now());
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function markSent() {
    setBusy(true);
    setError("");
    try {
      await submitLearningPathTransfer(path.id);
      setSubmitted(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function copy(key, text) {
    navigator.clipboard?.writeText(String(text)).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(""), 1500);
    });
  }

  const qr = payment ? buildVietQrImageUrl(inferVietQrBankId(), BANK_TRANSFER.accountNumber, payment.amount, payment.orderRef) : null;

  return (
    <section className="mr-panel lp-block lp-pay" aria-labelledby="lp-pay-title">
      <div className="lp-block-heading">
        <div><span className="mr-eyebrow">Bước 2</span><h2 id="lp-pay-title">Thanh toán trọn gói {formatVnd(path.totalAmount)}</h2></div>
      </div>
      <p className="lp-shares">Trả một lần cho cả {path.sessions.filter((s) => Number(s.attempt) === 1).length} buổi. Buổi học lại lần đầu miễn phí. Sau khi tiền về, bạn đặt lịch từng buổi theo giờ rảnh của mentor.</p>

      {!payment && (
        <button type="button" data-button-surface="none" className="mr-primary lp-pay-start" disabled={busy} onClick={getCode}>
          {busy ? <Loader2 size={15} className="lp-spin" /> : <QrCode size={15} />}Lấy mã chuyển khoản
        </button>
      )}

      {payment && (
        <div className="lp-pay-body">
          {qr ? <img className="lp-pay-qr" src={qr} alt={`QR chuyển ${formatVnd(payment.amount)} nội dung ${payment.orderRef}`} /> : (
            <p className="lp-field-hint">Chưa cấu hình tài khoản nhận (VITE_BANK_TRANSFER_*) nên không tạo được QR. Chuyển tay theo thông tin bên cạnh.</p>
          )}
          <dl className="mr-detail-dl lp-pay-info">
            {BANK_TRANSFER.bankName && <div><dt>Ngân hàng</dt><dd>{displayBankName(BANK_TRANSFER.bankName)}</dd></div>}
            {BANK_TRANSFER.accountNumber && (
              <div><dt>Số tài khoản</dt><dd>{BANK_TRANSFER.accountNumber} <button type="button" data-button-surface="none" className="lp-copy" onClick={() => copy("acc", BANK_TRANSFER.accountNumber)}><Copy size={12} />{copied === "acc" ? "Đã chép" : "Chép"}</button></dd></div>
            )}
            {BANK_TRANSFER.accountOwner && <div><dt>Chủ tài khoản</dt><dd>{BANK_TRANSFER.accountOwner}</dd></div>}
            <div><dt>Số tiền</dt><dd><strong>{formatVnd(payment.amount)}</strong></dd></div>
            <div><dt>Nội dung (bắt buộc)</dt><dd><strong className="lp-pay-ref">{payment.orderRef}</strong> <button type="button" data-button-surface="none" className="lp-copy" onClick={() => copy("ref", payment.orderRef)}><Copy size={12} />{copied === "ref" ? "Đã chép" : "Chép"}</button></dd></div>
            <div><dt>Hết hạn sau</dt><dd className={expired ? "lp-pay-expired" : ""}>{expired ? "Mã đã hết hạn" : mmss(remaining)}</dd></div>
          </dl>
          <div className="lp-pay-actions">
            {expired ? (
              <button type="button" data-button-surface="none" className="mr-primary" disabled={busy} onClick={getCode}><RefreshCw size={15} />Lấy mã mới</button>
            ) : submitted ? (
              <p className="lp-field-hint"><Loader2 size={13} className="lp-spin" /> Đã ghi nhận bạn chuyển khoản. Đang chờ ngân hàng / admin xác nhận, trang tự cập nhật.</p>
            ) : (
              <button type="button" data-button-surface="none" className="mr-primary" disabled={busy} onClick={markSent}><Send size={15} />Tôi đã chuyển khoản</button>
            )}
          </div>
        </div>
      )}

      {error && <div className="mr-error" role="alert">{error}</div>}
    </section>
  );
}

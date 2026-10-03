import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { AccountReveal } from "../../components/account/AccountMotion";
import {
  ShoppingBag,
  Trash2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Clock,
  AlertCircle,
} from "lucide-react";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";
import { useCart } from "../../hooks/useCart.jsx";
import { cartApi } from "../../api/cartApi.js";
import { formatVnd } from "../../utils/shared/formatVnd.js";
import { mediaSrc } from "../../utils/shared/mediaUrl.js";
import {
  BANK_TRANSFER,
  displayBankName,
  inferVietQrBankId,
  buildVietQrImageUrl,
} from "../../utils/shared/bankTransfer.js";

import "../../../styles/cart.css";

export function Cart() {
  const { cart, loading, error: cartError, refresh, remove } = useCart();
  const [params, setParams] = useSearchParams();
  const orderId = params.get("order");
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [coupon, setCoupon] = useState("");
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState("");

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    const result = await cartApi.order(orderId);
    setOrder(result.order);
    setError("");
    return result.order;
  }, [orderId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      return;
    }
    let cancelled = false;
    let timer;
    setOrder(null);
    const poll = async () => {
      try {
        const result = await cartApi.order(orderId);
        if (cancelled) return;
        setOrder(result.order);
        setError("");
        if (result.order.status === "paid") {
          void refresh();
          return;
        }
        if (result.order.status === "expired") return;
      } catch (err) {
        if (cancelled) return;
        setError(err.message);
      }
      timer = setTimeout(poll, 5000);
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [orderId, refresh]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const checkout = async () => {
    setBusy("checkout");
    setError("");
    try {
      const result = await cartApi.checkout(coupon);
      setParams({ order: result.order.id });
      setOrder(result.order);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  const removeItem = async (id) => {
    setBusy(id);
    setError("");
    try {
      await remove(id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  const copy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(""), 3000);
    } catch {
      setError("Không sao chép được. Bạn có thể chọn và sao chép thủ công.");
    }
  };

  const items = order?.items || cart.items;
  const total = order?.totalAmount ?? cart.totalAmount;
  const remaining =
    Math.max(0, Math.ceil((new Date(order?.paymentExpiresAt).getTime() - now) / 1000)) || 0;
  const expired = order?.status === "expired" || (order?.status === "pending" && remaining === 0);
  const paid = order?.status === "paid";
  const processing = order?.status === "processing";
  const qr =
    order && !expired && !paid && !processing
      ? buildVietQrImageUrl(
          inferVietQrBankId(),
          BANK_TRANSFER.accountNumber,
          order.totalAmount,
          order.orderRef
        )
      : null;

  const buttonClass = "cart-button cart-button--primary";

  return (
    <div className={`cart-page ${CUSTOMER_SHELL_GUTTER}`}>
      <div className={CUSTOMER_SHELL_MAX}>
        <header className="cart-header">
          <Link to={orderId ? "/cart" : "/courses"} className="cart-back">
            <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
            {orderId ? "Giỏ hàng" : "Tiếp tục mua sắm"}
          </Link>
          <h1>{orderId ? "Thanh toán" : "Giỏ hàng"}</h1>
        </header>

        {(error || cartError) && (
          <div className="cart-notice cart-notice--error" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{error || cartError}</span>
            <button
              type="button"
              onClick={() => orderId ? loadOrder().catch((err) => setError(err.message)) : refresh()}
              className="cart-text-button"
            >
              Thử lại
            </button>
          </div>
        )}

        {paid ? (
          <section className="cart-empty" aria-labelledby="cart-paid-title">
            <div className="cart-empty-icon cart-empty-icon--success">
              <CheckCircle2 size={38} strokeWidth={1.5} aria-hidden="true" />
            </div>
            <h2 id="cart-paid-title">Thanh toán thành công</h2>
            <p>{order.items.length} khóa học đã sẵn sàng. Mã đơn: <strong>{order.orderRef}</strong>.</p>
            <div className="cart-success-actions">
              <Link to="/my-courses" className={buttonClass}>Vào học</Link>
              <Link to="/payment-history" className="cart-text-button">Lịch sử thanh toán</Link>
            </div>
          </section>
        ) : orderId && !order ? (
          <p className="cart-loading" role="status">Đang tải đơn hàng…</p>
        ) : loading && !items.length ? (
          <p className="cart-loading" role="status">Đang tải giỏ hàng…</p>
        ) : !items.length && !cart.pendingOrder ? (
          <section className="cart-empty" aria-labelledby="cart-empty-title">
            <div className="cart-empty-icon">
              <ShoppingBag size={40} strokeWidth={1.5} aria-hidden="true" />
            </div>
            <h2 id="cart-empty-title">Giỏ hàng trống</h2>
            <p>Chọn khóa học để bắt đầu hành trình của bạn.</p>
            <Link to="/courses" className="cart-button cart-button--ghost">Xem khóa học</Link>
          </section>
        ) : (
          <div className="cart-grid">
            <section className="cart-items" aria-label="Khóa học trong đơn">
              <div className="cart-items-heading">
                <span>{items.length} khóa học</span>
                {order && <span className="cart-order-ref">{order.orderRef}</span>}
              </div>
              {items.map((item, index) => (
                <AccountReveal as="article" index={index} key={String(item.courseId)} className="cart-item">
                  {item.thumbnail && (
                    <img src={mediaSrc(item.thumbnail)} alt="" className="cart-item-image" />
                  )}
                  <div className="cart-item-content">
                    <Link to={`/courses/${item.courseId}`} className="cart-item-title">
                      {item.title}
                    </Link>
                    {item.mentorName && <p className="cart-item-mentor">{item.mentorName}</p>}
                    {!order && !item.available && (
                      <p className="cart-item-unavailable">Ngừng bán. Vui lòng xóa khỏi giỏ.</p>
                    )}
                    <div className="cart-item-price">
                      <strong>{formatVnd(item.price)}</strong>
                      {item.originalPrice > item.price && <del>{formatVnd(item.originalPrice)}</del>}
                    </div>
                  </div>
                  {!order && (
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => removeItem(item.courseId)}
                      aria-label={`Xóa ${item.title} khỏi giỏ hàng`}
                      title="Xóa khỏi giỏ"
                      className="cart-icon-button cart-remove"
                    >
                      <Trash2 size={18} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  )}
                </AccountReveal>
              ))}
            </section>

            <aside className="cart-summary" aria-label="Thông tin thanh toán">
              <h2>{order ? "Thanh toán" : "Đơn hàng"}</h2>
              <div className="cart-total">
                <span>Tổng cộng</span>
                <strong>{formatVnd(total)}</strong>
              </div>

              {!order && cart.items.some((item) => item.discountAmount > 0) && (
                <p className="cart-discount">Đã áp dụng ưu đãi Pro/Elite.</p>
              )}

              {!order && cart.pendingOrder ? (
                <div className="cart-payment-section">
                  <p className="cart-help">Bạn có đơn chờ thanh toán. Khóa học mới sẽ thuộc đơn tiếp theo.</p>
                  <Link className={buttonClass} to={`/cart?order=${cart.pendingOrder.id}`}>
                    Tiếp tục thanh toán
                  </Link>
                </div>
              ) : !order ? (
                <div className="cart-payment-section">
                  <div className="cart-coupon">
                    <label htmlFor="cart-coupon">Mã giảm giá</label>
                    <input
                      id="cart-coupon"
                      value={coupon}
                      onChange={(event) => setCoupon(event.target.value)}
                      placeholder="Nhập mã"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={Boolean(busy) || !items.length || items.some((item) => !item.available)}
                    onClick={checkout}
                    className={buttonClass}
                    aria-busy={busy === "checkout"}
                  >
                    {busy === "checkout" ? "Đang tạo đơn…" : "Thanh toán"}
                    <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
                  </button>
                  <p className="cart-help">Giá và ưu đãi được cập nhật khi tạo đơn.</p>
                </div>
              ) : expired ? (
                <div role="status" className="cart-payment-section">
                  <p className="cart-notice cart-notice--warning">Đơn đã hết hạn. Hãy tạo đơn mới trước khi chuyển khoản.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setParams({});
                      setOrder(null);
                      void refresh();
                    }}
                    className={buttonClass}
                  >
                    Về giỏ hàng
                  </button>
                </div>
              ) : processing ? (
                <p role="status" className="cart-notice">Đã nhận thanh toán. Đang kích hoạt khóa học…</p>
              ) : (
                <div className="cart-payment-section">
                  <div className="cart-timer">
                    <Clock size={16} strokeWidth={1.5} aria-hidden="true" />
                    <span>Còn {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")} để thanh toán</span>
                  </div>
                  {qr && (
                    <div className="cart-qr">
                      <img src={qr} alt={`Mã QR chuyển khoản ${formatVnd(total)} cho đơn ${order.orderRef}`} />
                      <p className="cart-help">Quét mã bằng ứng dụng ngân hàng</p>
                    </div>
                  )}
                  {!BANK_TRANSFER.accountNumber ? (
                    <p className="cart-notice cart-notice--warning">
                      Thanh toán chuyển khoản tạm thời chưa khả dụng. Vui lòng liên hệ hỗ trợ.
                    </p>
                  ) : (
                    <dl className="cart-bank-details">
                      <div>
                        <dt>Ngân hàng</dt>
                        <dd>{displayBankName(BANK_TRANSFER.bankName) || BANK_TRANSFER.bankName}</dd>
                      </div>
                      {[
                        ["Số tài khoản", BANK_TRANSFER.accountNumber],
                        ["Chủ tài khoản", BANK_TRANSFER.accountOwner],
                        ["Nội dung chuyển khoản", order.orderRef],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>
                            <strong>{value || "—"}</strong>
                            {value && (
                              <button
                                type="button"
                                onClick={() => copy(value)}
                                aria-label={`Sao chép ${label}`}
                                title={copied === value ? "Đã sao chép" : `Sao chép ${label}`}
                                className="cart-icon-button"
                              >
                                {copied === value ? (
                                  <CheckCircle2 size={16} aria-hidden="true" />
                                ) : (
                                  <Copy size={16} strokeWidth={1.5} aria-hidden="true" />
                                )}
                              </button>
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <p className="cart-help">Chuyển đúng số tiền và nội dung để khóa học được kích hoạt tự động.</p>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

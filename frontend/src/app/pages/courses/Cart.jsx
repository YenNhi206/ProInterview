import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { AccountReveal } from "../../components/account/AccountMotion";
import {
  ShoppingCart,
  Trash2,
  ArrowRight,
  CheckCircle2,
  Copy,
  Clock,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Tag,
  GraduationCap,
  RotateCcw,
  BookOpen,
  Users,
  Bot,
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

function formatCourseDisplayTitle(title) {
  if (!title) return "Khóa học ProInterview";
  let clean = String(title).trim();

  // Strip bracketed developer/seed prefixes like [Update cho duyet], [Seed ...], [Test]
  clean = clean.replace(/^\[[^\]]+\]\s*/i, "").trim();

  // If title is just a numeric string like "14256", give it a readable name
  if (/^\d+$/.test(clean)) {
    return `Kỹ năng phỏng vấn chuyên nghiệp #${clean}`;
  }

  // Handle COMMISSION_SAMPLE-COURSE-
  if (clean.startsWith("COMMISSION_SAMPLE-COURSE-")) {
    const raw = clean.replace("COMMISSION_SAMPLE-COURSE-", "").toLowerCase();
    const map = {
      contract: "Hợp đồng & Đàm phán đãi ngộ cùng Mentor",
      standard: "Kỹ năng phỏng vấn chuyên nghiệp & Case Study",
    };
    return map[raw] || `Kỹ năng phỏng vấn thực chiến (${raw.toUpperCase()})`;
  }

  return clean || title;
}

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

  return (
    <div className={`cart-page ${CUSTOMER_SHELL_GUTTER}`}>
      <div className={CUSTOMER_SHELL_MAX}>
        {/* Breadcrumb (Khóa học › Giỏ hàng — đồng bộ chuẩn CourseDetail) */}
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm sm:text-base font-medium text-slate-300">
          <Link to="/courses" className="hover:text-white transition-colors">
            Khóa học
          </Link>
          <span className="text-slate-500">›</span>
          {orderId ? (
            <>
              <Link to="/cart" className="hover:text-white transition-colors">
                Giỏ hàng
              </Link>
              <span className="text-slate-500">›</span>
              <span className="text-slate-100 font-semibold">Thanh toán</span>
            </>
          ) : (
            <span className="text-slate-100 font-semibold">Giỏ hàng</span>
          )}
        </nav>

        {/* Page Header */}
        <header className="cart-header mb-6">
          <h1 className="text-2xl font-black leading-tight tracking-tight sm:text-3xl text-white">
            {orderId ? "Thanh toán" : "Giỏ hàng"}
          </h1>
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
            <div className="cart-empty-icon-wrap" style={{ background: "rgba(147, 247, 43, 0.15)", borderColor: "rgba(147, 247, 43, 0.4)", color: "#93f72b" }}>
              <CheckCircle2 size={44} strokeWidth={2} aria-hidden="true" />
            </div>
            <h2 id="cart-paid-title" style={{ fontSize: "1.75rem", fontWeight: 800, color: "#fff", marginBottom: "0.5rem" }}>
              Thanh toán thành công!
            </h2>
            <p style={{ color: "#94a3b8", maxWidth: "480px", marginBottom: "1.75rem" }}>
              {order.items.length} khóa học đã sẵn sàng để bạn trải nghiệm. Mã đơn hàng của bạn là <strong style={{ color: "#c4b5fd" }}>#{order.orderRef}</strong>.
            </p>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
              <Link to="/my-courses" className="cart-checkout-btn" style={{ width: "auto", padding: "0.85rem 2rem", textDecoration: "none" }}>
                <span>Vào học ngay</span>
                <ArrowRight size={16} />
              </Link>
              <Link to="/payment-history" className="cart-back" style={{ padding: "0.85rem 1.5rem" }}>
                Lịch sử thanh toán
              </Link>
            </div>
          </section>
        ) : orderId && !order ? (
          <p className="cart-loading" role="status">Đang tải thông tin đơn hàng…</p>
        ) : loading && !items.length ? (
          <p className="cart-loading" role="status">Đang cập nhật giỏ hàng…</p>
        ) : !items.length && !cart.pendingOrder ? (
          <div className="cart-empty-canvas">
            {/* Ambient Background Glows */}
            <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-violet-600/20 blur-[130px]" aria-hidden="true" />
            <div className="pointer-events-none absolute top-1/3 left-1/4 h-72 w-72 rounded-full bg-indigo-600/15 blur-[110px]" aria-hidden="true" />
            <div className="pointer-events-none absolute bottom-10 right-1/4 h-72 w-72 rounded-full bg-emerald-500/10 blur-[120px]" aria-hidden="true" />

            {/* Transparent Seamless Hero Section (No dark enclosing box) */}
            <div className="cart-empty-hero">
              {/* Floating Cosmic 3D Icon Graphic */}
              <div className="cart-empty-graphic-wrap">
                <div className="cart-empty-orbit-ring" aria-hidden="true" />
                <div className="cart-empty-sphere">
                  <ShoppingCart size={36} strokeWidth={2} className="text-[#93f72b] drop-shadow-[0_0_14px_rgba(147,247,43,0.7)]" aria-hidden="true" />
                </div>
                <div className="cart-empty-sparkle-pill" aria-hidden="true">
                  <Sparkles size={13} className="text-amber-300" />
                </div>
              </div>

              {/* Typography */}
              <h2 className="cart-empty-title">
                Giỏ hàng của bạn đang trống
              </h2>
              <p className="cart-empty-subtitle">
                Khám phá các khóa học phỏng vấn để bắt đầu học ngay.
              </p>

              {/* Action Buttons */}
              <div className="cart-empty-actions">
                <Link
                  to="/courses"
                  className="cart-btn-primary group"
                >
                  <span>Khám phá khóa học</span>
                  <span className="cart-btn-icon-bubble">
                    <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>

                <Link
                  to="/pricing"
                  className="cart-btn-secondary"
                >
                  <span>Bảng giá &amp; Gói Pro</span>
                </Link>
              </div>
            </div>
          </div>
        ) : order ? (
          /* ─── ENHANCED UIVERSE ANIMATED PAYMENT VIEW ─── */
          <div className="cart-checkout-layout">
            {/* Cột trái: QR & Thông tin chuyển khoản trong khung viền Neon Beam */}
            <div className="uiverse-payment-card-wrap">
              <div className="cart-payment-main-card">
                <div className="cart-payment-header">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">Chuyển khoản ngân hàng</span>
                    <span className="cart-order-tag">#{order.orderRef}</span>
                  </div>
                  <div className="cart-payment-timer-pill">
                    <Clock size={14} className="cart-timer-icon-spin" />
                    <span>Hết hạn sau: <strong>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</strong></span>
                  </div>
                </div>

                {expired ? (
                  <div className="p-8 text-center">
                    <p className="cart-notice cart-notice--warning mb-4">Đơn hàng đã hết thời gian thanh toán.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setParams({});
                        setOrder(null);
                        void refresh();
                      }}
                      className="cart-checkout-btn mx-auto"
                      style={{ width: "auto", padding: "0.75rem 2rem" }}
                    >
                      <RotateCcw size={16} />
                      <span>Tạo đơn mới</span>
                    </button>
                  </div>
                ) : processing ? (
                  <div className="p-8 text-center">
                    <div className="inline-flex items-center gap-3 rounded-2xl border border-violet-500/30 bg-violet-500/10 px-6 py-4 text-violet-300">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
                      <span>Đã nhận thanh toán. Đang kích hoạt khóa học…</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="cart-payment-body">
                      {/* Khối mã QR với hiệu ứng quét Laser & HUD corners */}
                      <div className="cart-payment-qr-wrap">
                        <div className="cart-payment-qr-box">
                          <div className="cart-qr-corner cart-qr-corner--tl" aria-hidden="true" />
                          <div className="cart-qr-corner cart-qr-corner--tr" aria-hidden="true" />
                          <div className="cart-qr-corner cart-qr-corner--bl" aria-hidden="true" />
                          <div className="cart-qr-corner cart-qr-corner--br" aria-hidden="true" />
                          <div className="cart-payment-qr-laser" aria-hidden="true" />
                          {qr ? (
                            <img src={qr} alt={`Mã QR đơn ${order.orderRef}`} className="cart-payment-qr-img" />
                          ) : (
                            <p className="text-xs text-slate-400 text-center p-4">Chưa có mã QR. Vui lòng chuyển khoản theo thông tin bên cạnh.</p>
                          )}
                        </div>
                        <p className="cart-payment-qr-hint">
                          Quét mã bằng ứng dụng ngân hàng
                        </p>
                      </div>

                      {/* Khối chi tiết ngân hàng */}
                      <div className="cart-payment-details-wrap">
                        <div className="cart-bank-field-card">
                          <span className="cart-field-label">Ngân hàng</span>
                          <div className="cart-field-val-row">
                            <span className="cart-field-val font-semibold text-white">
                              {displayBankName(BANK_TRANSFER.bankName) || BANK_TRANSFER.bankName}
                            </span>
                          </div>
                        </div>

                        <div className="cart-bank-field-card">
                          <span className="cart-field-label">Số tài khoản</span>
                          <div className="cart-field-val-row">
                            <span className="cart-field-val font-mono text-base font-bold text-white">
                              {BANK_TRANSFER.accountNumber}
                            </span>
                            {BANK_TRANSFER.accountNumber && (
                              <button
                                type="button"
                                onClick={() => copy(BANK_TRANSFER.accountNumber)}
                                className={`cart-copy-btn ${copied === BANK_TRANSFER.accountNumber ? "copied" : ""}`}
                              >
                                {copied === BANK_TRANSFER.accountNumber ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                                <span>{copied === BANK_TRANSFER.accountNumber ? "Đã chép" : "Sao chép"}</span>
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="cart-bank-field-card">
                          <span className="cart-field-label">Chủ tài khoản</span>
                          <div className="cart-field-val-row">
                            <span className="cart-field-val font-medium uppercase text-slate-200">
                              {BANK_TRANSFER.accountOwner}
                            </span>
                          </div>
                        </div>

                        <div className="cart-bank-field-card">
                          <span className="cart-field-label">Số tiền</span>
                          <div className="cart-field-val-row">
                            <span className="cart-field-val font-mono text-lg font-bold text-white">
                              {formatVnd(total)}
                            </span>
                            <button
                              type="button"
                              onClick={() => copy(String(total))}
                              className={`cart-copy-btn ${copied === String(total) ? "copied" : ""}`}
                            >
                              {copied === String(total) ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                              <span>{copied === String(total) ? "Đã chép" : "Sao chép"}</span>
                            </button>
                          </div>
                        </div>

                        <div className="cart-bank-field-card cart-bank-field-card--memo">
                          <div className="flex items-center justify-between">
                            <span className="cart-field-label">Nội dung chuyển khoản</span>
                            <span className="cart-memo-badge">
                              <span className="cart-memo-beacon"></span>
                              Bắt buộc chính xác
                            </span>
                          </div>
                          <div className="cart-field-val-row">
                            <span className="cart-field-val font-mono text-base font-bold text-violet-300">
                              {order.orderRef}
                            </span>
                            <button
                              type="button"
                              onClick={() => copy(order.orderRef)}
                              className={`cart-copy-btn cart-copy-btn--memo ${copied === order.orderRef ? "copied" : ""}`}
                            >
                              {copied === order.orderRef ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                              <span>{copied === order.orderRef ? "Đã chép" : "Sao chép"}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="cart-payment-footer">
                      <div className="cart-live-ping-wrap">
                        <div className="cart-radar-ping-dot" aria-hidden="true">
                          <span className="cart-radar-ring"></span>
                          <span className="cart-radar-ring cart-radar-ring--delayed"></span>
                          <span className="cart-radar-core"></span>
                        </div>
                        <p className="cart-radar-text m-0">
                          Hệ thống đang tự động kiểm tra giao dịch chuyển khoản realtime…
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Cột phải: Tóm tắt đơn hàng */}
            <div className="cart-order-sidebar">
              <div className="uiverse-payment-card-wrap">
                <div className="cart-order-summary-card">
                  <div className="cart-order-summary-header">
                    <h2>Đơn hàng</h2>
                  </div>

                  <div className="cart-order-items-list">
                    {items.map((item) => (
                      <div key={String(item.courseId)} className="cart-order-item-row">
                        <div className="cart-order-item-thumb">
                          {item.thumbnail ? (
                            <img src={mediaSrc(item.thumbnail)} alt={item.title} />
                          ) : (
                            <GraduationCap size={16} />
                          )}
                        </div>
                        <div className="cart-order-item-info">
                          <span className="cart-order-item-title" title={formatCourseDisplayTitle(item.title)}>
                            {formatCourseDisplayTitle(item.title)}
                          </span>
                          <span className="cart-order-item-price">{formatVnd(item.price)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="cart-order-total-block">
                    <div className="cart-order-total-row">
                      <span>Tổng thanh toán</span>
                      <strong>{formatVnd(total)}</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={busy === "cancel_order"}
                    onClick={async () => {
                      try {
                        setBusy("cancel_order");
                        if (order?.id) {
                          await cartApi.cancelOrder(order.id);
                        }
                        setParams({});
                        setOrder(null);
                        await refresh();
                      } catch (err) {
                        console.error("Cancel order error:", err);
                        setParams({});
                        setOrder(null);
                        await refresh();
                      } finally {
                        setBusy("");
                      }
                    }}
                    className="cart-cancel-order-btn"
                  >
                    <RotateCcw size={14} />
                    <span>{busy === "cancel_order" ? "Đang hủy đơn…" : "Hủy đơn / Về giỏ hàng"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="cart-grid">
            {/* Unified Glass Card Panel (Stripe / Apple Style) */}
            <div className="cart-unified-panel">
              <div className="cart-unified-header">
                <div className="cart-unified-header-title">
                  <span>Khóa học đã chọn</span>
                  <span className="cart-unified-count-tag">{items.length}</span>
                </div>
                <div className="cart-unified-header-right">
                  {items.length > 4 ? (
                    <span className="cart-scroll-hint">Cuộn để xem tất cả ({items.length})</span>
                  ) : null}
                </div>
              </div>

              <div className="cart-unified-body">
                {items.map((item, index) => {
                  const hasDiscount = item.originalPrice > item.price;
                  const discountPercent = hasDiscount && item.originalPrice
                    ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
                    : 0;

                  return (
                    <AccountReveal as="article" index={index} key={String(item.courseId)} className="cart-row">
                      {/* Compact Thumbnail */}
                      <div className="cart-row-thumb">
                        {item.thumbnail ? (
                          <img src={mediaSrc(item.thumbnail)} alt={item.title} className="cart-row-image" />
                        ) : (
                          <div className="cart-row-fallback">
                            <GraduationCap size={20} strokeWidth={2} />
                            <span className="cart-row-fallback-badge">PRO</span>
                          </div>
                        )}
                      </div>

                      {/* Course Info */}
                      <div className="cart-row-info">
                        <Link to={`/courses/${item.courseId}`} className="cart-row-title" title={formatCourseDisplayTitle(item.title)}>
                          {formatCourseDisplayTitle(item.title)}
                        </Link>

                        <div className="cart-row-meta">
                          {item.mentorName && (
                            <>
                              <span className="cart-mentor-dot" />
                              <span>{item.mentorName}</span>
                              <span style={{ opacity: 0.35 }}>•</span>
                            </>
                          )}
                          <span style={{ color: "#c084fc", fontWeight: 600 }}>Thực chiến</span>
                          <span style={{ opacity: 0.35 }}>•</span>
                          <span>Truy cập trọn đời</span>
                        </div>

                        {!item.available && (
                          <p className="cart-item-unavailable">Đã tạm ngừng bán. Vui lòng xóa để tiếp tục.</p>
                        )}
                      </div>

                      {/* Price & Remove */}
                      <div className="cart-row-right">
                        <div className="cart-row-price">
                          <span className="cart-row-price-val">{formatVnd(item.price)}</span>
                          {hasDiscount && (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                              <span className="cart-row-price-del">{formatVnd(item.originalPrice)}</span>
                              {discountPercent > 0 && (
                                <span className="cart-row-price-saving">-{discountPercent}%</span>
                              )}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() => removeItem(item.courseId)}
                          aria-label={`Xóa ${item.title} khỏi giỏ hàng`}
                          title="Xóa khỏi giỏ hàng"
                          className="cart-row-remove"
                        >
                          <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                      </div>
                    </AccountReveal>
                  );
                })}
              </div>
            </div>

            {/* Uiverse Rotating Border Beam Summary Card */}
            <div className="uiverse-summary-card">
              <aside className="cart-summary" aria-label="Thông tin thanh toán">
                <div className="cart-summary-header">
                  <h2>Đơn hàng</h2>
                  <Sparkles size={18} style={{ color: "#c4b5fd" }} />
                </div>

                {/* Price Breakdown */}
                <div className="cart-breakdown">
                  <div className="cart-breakdown-row">
                    <span>Tạm tính ({items.length} khóa học)</span>
                    <strong>{formatVnd(items.reduce((acc, it) => acc + (it.originalPrice || it.price), 0))}</strong>
                  </div>

                  {items.some((item) => (item.originalPrice && item.originalPrice > item.price) || (item.discountAmount && item.discountAmount > 0)) && (
                    <div className="cart-breakdown-row cart-breakdown-row--discount">
                      <span>Ưu đãi đã áp dụng</span>
                      <strong>
                        -
                        {formatVnd(
                          items.reduce((acc, it) => {
                            const diff = (it.originalPrice || it.price) - it.price;
                            return acc + (diff > 0 ? diff : (it.discountAmount || 0));
                          }, 0)
                        )}
                      </strong>
                    </div>
                  )}

                  <div className="cart-breakdown-divider" />

                  <div className="cart-total-row">
                    <span>Tổng cộng</span>
                    <strong>{formatVnd(total)}</strong>
                  </div>
                </div>

                {/* Coupon input */}
                <div className="cart-coupon-wrap">
                  <label htmlFor="cart-coupon">Mã giảm giá</label>
                  <div className="cart-coupon-input-box">
                    <Tag size={16} className="cart-coupon-icon" />
                    <input
                      id="cart-coupon"
                      value={coupon}
                      onChange={(event) => setCoupon(event.target.value)}
                      placeholder="Nhập mã ưu đãi..."
                      className="cart-coupon-input"
                    />
                    {coupon.trim() && (
                      <button type="button" className="cart-coupon-apply-btn" onClick={() => {}}>
                        Áp dụng
                      </button>
                    )}
                  </div>
                </div>

                {/* Checkout / Pay Options */}
                {cart.pendingOrder ? (
                  <div className="cart-payment-section">
                    <p className="cart-help">Đơn chờ thanh toán: <strong>{cart.pendingOrder.orderRef}</strong></p>
                    <Link className="cart-checkout-btn" to={`/cart?order=${cart.pendingOrder.id}`}>
                      <span>Tiếp tục thanh toán</span>
                      <ArrowRight size={16} />
                    </Link>
                    <button
                      type="button"
                      disabled={busy === "cancel_order"}
                      onClick={async () => {
                        try {
                          setBusy("cancel_order");
                          await cartApi.cancelOrder(cart.pendingOrder.id);
                          await refresh();
                        } catch (err) {
                          setError(err.message);
                        } finally {
                          setBusy("");
                        }
                      }}
                      className="w-full mt-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-rose-300 transition-colors cursor-pointer text-center"
                    >
                      {busy === "cancel_order" ? "Đang hủy…" : "Hủy đơn này để thêm/bớt khóa học"}
                    </button>
                  </div>
                ) : (
                  <div className="cart-payment-section">
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={checkout}
                      className="cart-checkout-btn"
                      aria-busy={busy === "checkout"}
                    >
                      <span>{busy === "checkout" ? "Đang tạo đơn…" : "Thanh toán"}</span>
                      <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
                    </button>
                    <p className="cart-help">Giá và ưu đãi được cập nhật khi tạo đơn.</p>
                  </div>
                )}

                {/* Trust assurances */}
                <div className="cart-trust-badges">
                  <div className="cart-trust-item">
                    <ShieldCheck size={16} />
                    <span>Kích hoạt khóa học ngay sau khi hoàn tất thanh toán</span>
                  </div>
                  <div className="cart-trust-item">
                    <Sparkles size={16} />
                    <span>Truy cập trọn đời & tài liệu độc quyền từ mentor</span>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

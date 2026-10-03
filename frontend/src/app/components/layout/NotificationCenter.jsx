import { useId, useState } from "react";
import { Bell, BookOpen, CalendarDays, CalendarX2, Check, CheckCheck, ChevronDown, CreditCard, LoaderCircle, MessageSquare, RefreshCw, Trash2, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { useNavbarNotifications } from "../../hooks/useNavbarNotifications.js";
import "../../../styles/notifications.css";

function notificationKind(type = "") {
  if (type === "booking_cancelled") return { icon: CalendarX2, label: "Lịch hẹn", tone: "coral" };
  if (type.includes("booking")) return { icon: CalendarDays, label: "Lịch hẹn", tone: "violet" };
  if (type.startsWith("payment")) return { icon: CreditCard, label: "Thanh toán", tone: type === "payment_failed" ? "coral" : "green" };
  if (type.startsWith("course") || type === "certificate_ready") return { icon: BookOpen, label: "Khóa học", tone: "blue" };
  if (type === "feedback" || type === "new_review") return { icon: MessageSquare, label: "Nhận xét", tone: "teal" };
  return { icon: Bell, label: "Cập nhật", tone: "amber" };
}

function notificationDate(value) {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date : null;
}

function notificationTime(date) {
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} giờ trước`;
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function groupByDate(notifications) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const groups = new Map();
  for (const notification of [...notifications].sort((a, b) =>
    (notificationDate(b.createdAt)?.getTime() || 0) - (notificationDate(a.createdAt)?.getTime() || 0)
  )) {
    const date = notificationDate(notification.createdAt);
    const label = !date ? "Thông báo khác"
      : date.toDateString() === today.toDateString() ? "Hôm nay"
      : date.toDateString() === yesterday.toDateString() ? "Hôm qua"
      : date.toLocaleDateString("vi-VN", { day: "numeric", month: "long", ...(date.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}) });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(notification);
  }
  return [...groups.entries()];
}

function NotificationRow({ notification, onSelect, onDelete, disabled, deleting }) {
  const [expanded, setExpanded] = useState(false);
  const bodyId = useId();
  const { icon: Icon, label, tone } = notificationKind(notification.type);
  const date = notificationDate(notification.createdAt);
  const body = notification.body || notification.message || "";
  const canExpand = body.length > 110;

  return (
    <article className={`notification-row${notification.isRead ? "" : " notification-row--unread"}`}>
      <button type="button" className="notification-row-main" onClick={() => onSelect(notification)} disabled={disabled}>
        <span className={`notification-kind-icon notification-kind-icon--${tone}`} aria-hidden="true"><Icon size={18} strokeWidth={1.8} /></span>
        <span className="notification-copy">
          <span className="notification-title">{notification.title}</span>
          {body && <span id={bodyId} className={`notification-body${canExpand && !expanded ? " notification-body--clamped" : ""}`}>{body}</span>}
          <span className="notification-meta">
            <span>{label}</span>
            {date && <><span aria-hidden="true">·</span><time dateTime={date.toISOString()} title={date.toLocaleString("vi-VN")}>{notificationTime(date)}</time></>}
            {!notification.isRead && <span className="notification-unread-dot" aria-label="Chưa đọc" />}
          </span>
        </span>
      </button>
      <button
        type="button"
        className="notification-delete"
        onClick={() => onDelete(notification._id)}
        disabled={disabled}
        aria-label={`Xóa thông báo: ${notification.title}`}
        aria-busy={deleting}
        title={deleting ? "Đang xóa…" : "Xóa thông báo"}
      >
        {deleting
          ? <LoaderCircle size={15} className="notification-delete-spinner" aria-hidden="true" />
          : <Trash2 size={15} strokeWidth={1.6} aria-hidden="true" />}
      </button>
      {canExpand && (
        <button type="button" className="notification-expand" aria-expanded={expanded} aria-controls={bodyId} onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Thu gọn" : "Xem thêm"}<ChevronDown size={12} aria-hidden="true" />
        </button>
      )}
    </article>
  );
}

export function NotificationCenter({ active = true, onSelect }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [deletionMessage, setDeletionMessage] = useState("");
  const titleId = useId();
  const { notifications, unreadCount, loading, error, busy, loadNotifications, handleMarkAllRead, handleMarkOneRead, handleDeleteNotification } = useNavbarNotifications(active);
  const filtered = filter === "unread" ? notifications.filter((notification) => !notification.isRead) : notifications;
  const groups = groupByDate(filtered);
  const hasNotifications = notifications.length > 0 || unreadCount > 0;
  const allRead = filter === "unread" && hasNotifications && !unreadCount;

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen);
    if (nextOpen) void loadNotifications();
  };

  const selectNotification = async (notification) => {
    if (!await handleMarkOneRead(notification._id)) return;
    setOpen(false);
    onSelect?.(notification);
  };

  const removeNotification = async (id) => {
    setDeletionMessage("");
    if (await handleDeleteNotification(id)) setDeletionMessage("Đã xóa thông báo.");
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button type="button" className="notification-trigger" aria-label={unreadCount ? `Thông báo, ${unreadCount} chưa đọc` : "Thông báo"}>
          <Bell size={20} strokeWidth={1.7} aria-hidden="true" />
          {unreadCount > 0 && <span className="notification-trigger-count" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} collisionPadding={12} className="notification-center" aria-labelledby={titleId}>
        <span className="sr-only" role="status">{deletionMessage}</span>
        <header className="notification-header">
          <h2 id={titleId}>Thông báo</h2>
          <div className="notification-header-actions">
            {unreadCount > 0 && (
              <button type="button" className="notification-read-all" disabled={loading || Boolean(busy)} onClick={handleMarkAllRead} aria-label="Đánh dấu tất cả là đã đọc" title="Đánh dấu tất cả là đã đọc">
                {busy === "all" ? <LoaderCircle size={17} className="notification-delete-spinner" aria-hidden="true" /> : <CheckCheck size={17} strokeWidth={1.7} aria-hidden="true" />}
              </button>
            )}
            <button type="button" className="notification-close" aria-label="Đóng thông báo" onClick={() => setOpen(false)}><X size={18} aria-hidden="true" /></button>
          </div>
        </header>

        {hasNotifications && <div className="notification-filters" role="group" aria-label="Lọc thông báo">
          <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>Tất cả</button>
          <button type="button" aria-pressed={filter === "unread"} onClick={() => setFilter("unread")}>Chưa đọc{unreadCount > 0 && <span>{unreadCount}</span>}</button>
        </div>}

        {error && (
          <div className="notification-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={loadNotifications} disabled={loading}><RefreshCw size={14} aria-hidden="true" />Thử lại</button>
          </div>
        )}

        <div key={filter} className="notification-scroll" aria-busy={loading || Boolean(busy)}>
          {loading ? (
            <div className="notification-loading" role="status" aria-label="Đang tải thông báo">
              {[0, 1, 2].map((index) => <div key={index} className="notification-skeleton" aria-hidden="true"><span /><div><span /><span /><span /></div></div>)}
            </div>
          ) : groups.length ? groups.map(([label, entries]) => (
            <section key={label} className="notification-date-group" aria-label={label}>
              <h3>{label}</h3>
              {entries.map((notification) => (
                <NotificationRow
                  key={notification._id}
                  notification={notification}
                  onSelect={selectNotification}
                  onDelete={removeNotification}
                  disabled={Boolean(busy)}
                  deleting={busy === `delete:${notification._id}`}
                />
              ))}
            </section>
          )) : !error ? (
            <div className="notification-empty" role="status">
              <span className={`notification-empty-icon${allRead ? " notification-empty-icon--done" : ""}`} aria-hidden="true">
                {allRead ? <Check size={20} strokeWidth={1.8} /> : <Bell size={20} strokeWidth={1.8} />}
              </span>
              <div>
                <h3>{filter === "unread" && hasNotifications ? unreadCount > 0 ? "Không có mục chưa đọc gần đây" : "Bạn đã đọc hết" : "Chưa có thông báo"}</h3>
                <p>{filter === "unread" && hasNotifications ? unreadCount > 0 ? "Danh sách chỉ hiển thị 50 thông báo gần nhất." : "Không còn cập nhật nào chưa xem." : "Các cập nhật mới sẽ xuất hiện ở đây."}</p>
                {filter === "unread" && notifications.length > 0 && <button type="button" className="notification-show-all" onClick={() => setFilter("all")}>Xem tất cả thông báo</button>}
              </div>
            </div>
          ) : null}
        </div>
        {!loading && notifications.length >= 50 && <p className="notification-footnote">50 thông báo gần nhất</p>}
      </PopoverContent>
    </Popover>
  );
}

import { useId, useState, useEffect } from "react";
import { Bell, Check, CheckCheck, ChevronDown, LoaderCircle, RefreshCw, Trash2, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from "../ui/popover";
import { useNavbarNotifications } from "../../hooks/useNavbarNotifications.js";
import { notificationKind } from "../../utils/shared/notificationKind.js";
import "../../../styles/notifications.css";

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
  const canExpand = body.length > 100;

  return (
    <article
      className={`notification-row${notification.isRead ? "" : " notification-row--unread"}`}
      onClick={() => onSelect(notification)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(notification);
        }
      }}
    >
      <div className="notification-row-main">
        <span className={`notification-kind-icon notification-kind-icon--${tone}`} aria-hidden="true">
          <Icon size={18} strokeWidth={1.8} />
        </span>
        <div className="notification-copy">
          <span className="notification-title">{notification.title}</span>
          {body && (
            <div id={bodyId} className={`notification-body${canExpand && !expanded ? " notification-body--clamped" : ""}`}>
              {body}
            </div>
          )}
          {canExpand && (
            <button
              type="button"
              className="notification-expand"
              aria-expanded={expanded}
              aria-controls={bodyId}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((val) => !val);
              }}
            >
              <span>{expanded ? "Thu gọn" : "Xem thêm"}</span>
              <ChevronDown size={11} className={expanded ? "rotate-180 transition-transform" : "transition-transform"} aria-hidden="true" />
            </button>
          )}
          <span className="notification-meta">
            <span>{label}</span>
            {date && (
              <>
                <span aria-hidden="true">·</span>
                <time dateTime={date.toISOString()} title={date.toLocaleString("vi-VN")}>
                  {notificationTime(date)}
                </time>
              </>
            )}
            {!notification.isRead && <span className="notification-unread-dot" aria-label="Chưa đọc" />}
          </span>
        </div>
      </div>
      <button
        type="button"
        className="notification-delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(notification._id);
        }}
        disabled={disabled}
        aria-label={`Xóa thông báo: ${notification.title}`}
        aria-busy={deleting}
        title={deleting ? "Đang xóa…" : "Xóa thông báo"}
      >
        {deleting ? (
          <LoaderCircle size={15} className="notification-delete-spinner" aria-hidden="true" />
        ) : (
          <Trash2 size={15} strokeWidth={1.6} aria-hidden="true" />
        )}
      </button>
    </article>
  );
}

export function NotificationCenter({
  active = true,
  onSelect,
  asBar = false,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  trigger = null,
  anchor = null,
  side,
  align,
  onUnreadCountChange,
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (controlledOnOpenChange || (() => {})) : setInternalOpen;
  const [filter, setFilter] = useState("all");
  const [deletionMessage, setDeletionMessage] = useState("");
  const titleId = useId();
  const {
    notifications,
    unreadCount,
    loading,
    error,
    busy,
    loadNotifications,
    handleMarkAllRead,
    handleMarkOneRead,
    handleDeleteNotification,
  } = useNavbarNotifications(active);

  useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [unreadCount, onUnreadCountChange]);

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

  const resolvedSide = side || (asBar ? "top" : "bottom");
  const resolvedAlign = align || (asBar ? "start" : "end");

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      {anchor && <PopoverAnchor asChild>{anchor}</PopoverAnchor>}
      {trigger ? (
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      ) : !anchor ? (
        <PopoverTrigger asChild>
          {asBar ? (
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-300 transition-all hover:border-violet-500/40 hover:bg-white/[0.07] hover:text-white focus:outline-none"
              aria-label={unreadCount ? `Thông báo, ${unreadCount} chưa đọc` : "Thông báo"}
            >
              <div className="flex items-center gap-2.5">
                <Bell size={15} className="text-violet-400 shrink-0" strokeWidth={1.8} />
                <span>Thông báo</span>
              </div>
              {unreadCount > 0 ? (
                <span className="rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-2 py-0.5 text-[10px] font-black text-white shadow-[0_0_8px_rgba(124,58,237,0.5)]">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : (
                <span className="text-[10px] font-medium text-slate-500">0</span>
              )}
            </button>
          ) : (
            <button type="button" className="notification-trigger" aria-label={unreadCount ? `Thông báo, ${unreadCount} chưa đọc` : "Thông báo"}>
              <Bell size={20} strokeWidth={1.7} aria-hidden="true" />
              {unreadCount > 0 && <span className="notification-trigger-count" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>}
            </button>
          )}
        </PopoverTrigger>
      ) : null}
      <PopoverContent side={resolvedSide} align={resolvedAlign} sideOffset={12} collisionPadding={12} className="notification-center" aria-labelledby={titleId}>
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

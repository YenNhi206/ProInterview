import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationAsRead,
  deleteNotification,
} from "../api/notificationApi.js";

export function useNavbarNotifications(active) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const generation = useRef(0);
  const listRequest = useRef(0);
  const countRequest = useRef(0);
  const actionInFlight = useRef(false);

  useEffect(() => {
    const currentGeneration = ++generation.current;
    if (!active) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      setError("");
      setBusy("");
      actionInFlight.current = false;
      return;
    }

    const refreshCount = async () => {
      if (actionInFlight.current) return;
      const request = ++countRequest.current;
      const result = await fetchUnreadNotificationCount();
      if (generation.current === currentGeneration && request === countRequest.current && result.success) {
        setUnreadCount(result.count ?? 0);
      }
    };

    void refreshCount();
    const interval = setInterval(refreshCount, 60000);
    return () => {
      generation.current++;
      clearInterval(interval);
    };
  }, [active]);

  const loadNotifications = useCallback(async () => {
    if (!active || actionInFlight.current) return;
    const currentGeneration = generation.current;
    const request = ++listRequest.current;
    const countVersion = ++countRequest.current;
    setLoading(true);
    setError("");
    const [result, count] = await Promise.all([fetchNotifications(), fetchUnreadNotificationCount()]);
    if (generation.current !== currentGeneration || request !== listRequest.current) return;
    if (result.success) setNotifications(result.notifications);
    else setError(result.error || "Không thể tải thông báo.");
    if (countVersion === countRequest.current && count.success) setUnreadCount(count.count ?? 0);
    setLoading(false);
  }, [active]);

  const handleMarkAllRead = useCallback(async () => {
    if (!active || actionInFlight.current) return false;
    const currentGeneration = generation.current;
    actionInFlight.current = true;
    countRequest.current++;
    setBusy("all");
    setError("");
    const result = await markAllNotificationsRead();
    if (generation.current !== currentGeneration) return false;
    if (result.success) {
      setNotifications((previous) => previous.map((notification) => ({ ...notification, isRead: true })));
      setUnreadCount(0);
    } else setError(result.error || "Chưa thể đánh dấu đã đọc. Hãy thử lại.");
    actionInFlight.current = false;
    setBusy("");
    return result.success;
  }, [active]);

  const handleMarkOneRead = useCallback(async (id) => {
    if (!active || actionInFlight.current) return false;
    if (notifications.find((notification) => notification._id === id)?.isRead) return true;
    const currentGeneration = generation.current;
    actionInFlight.current = true;
    countRequest.current++;
    setBusy(id);
    setError("");
    const result = await markNotificationAsRead(id);
    if (generation.current !== currentGeneration) return false;
    if (result.success) {
      setNotifications((previous) => previous.map((notification) => notification._id === id ? { ...notification, isRead: true } : notification));
      setUnreadCount((count) => Math.max(0, count - 1));
    } else setError(result.error || "Chưa thể đánh dấu đã đọc. Hãy thử lại.");
    actionInFlight.current = false;
    setBusy("");
    return result.success;
  }, [active, notifications]);

  const handleDeleteNotification = useCallback(async (id) => {
    if (!active || loading || actionInFlight.current) return false;
    const notification = notifications.find((item) => item._id === id);
    if (!notification) return false;
    const currentGeneration = generation.current;
    actionInFlight.current = true;
    listRequest.current++;
    countRequest.current++;
    setBusy(`delete:${id}`);
    setError("");
    const result = await deleteNotification(id);
    if (generation.current !== currentGeneration) return false;
    if (result.success) {
      setNotifications((previous) => previous.filter((item) => item._id !== id));
      if (!notification.isRead) setUnreadCount((count) => Math.max(0, count - 1));
    } else setError(result.error || "Không thể xóa thông báo. Hãy thử lại.");
    actionInFlight.current = false;
    setBusy("");
    return result.success;
  }, [active, loading, notifications]);

  return { notifications, unreadCount, loading, error, busy, loadNotifications, handleMarkAllRead, handleMarkOneRead, handleDeleteNotification };
}

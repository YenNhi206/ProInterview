import { Notification } from "../models/index.js";

export const NotificationsController = {
  /** Lấy danh sách thông báo của user hiện tại */
  list: async (req, res) => {
    try {
      const userId = req.userId;
      const notifications = await Notification.find({ userId })
        .sort({ createdAt: -1 })
        .limit(50);
      res.json({ success: true, notifications });
    } catch (error) {
      console.error("[Notifications Error] list:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /** Đánh dấu đã đọc */
  markAsRead: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.userId;

      const notification = await Notification.findOneAndUpdate(
        { _id: id, userId },
        { $set: { isRead: true } },
        { new: true }
      );

      if (!notification) {
        return res.status(404).json({ success: false, error: "Thông báo không tồn tại" });
      }

      res.json({ success: true, notification });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /** Đánh dấu tất cả đã đọc */
  markAllRead: async (req, res) => {
    try {
      const userId = req.userId;
      await Notification.updateMany({ userId, isRead: false }, { $set: { isRead: true } });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
};

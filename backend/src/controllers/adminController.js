import mongoose from "mongoose";
const User = mongoose.model("User");
const Mentor = mongoose.model("Mentor");
const Booking = mongoose.model("Booking");

export const AdminController = {
  // Lấy danh sách toàn bộ mentor (chỉ hiện những người vẫn còn role mentor ở bảng User)
  getAllMentors: async (req, res) => {
    try {
      // Ép hệ thống kiểm tra và tạo hồ sơ mới nếu bạn vừa sửa ở Compass
      const { ensureMentorProfilesForAllMentorUsers } = await import("../services/mentorProfileService.js");
      await ensureMentorProfilesForAllMentorUsers();

      const mentors = await Mentor.find()
        .populate("userId", "name email avatar role isActive")
        .sort({ createdAt: -1 })
        .lean();
      
      // Lọc bỏ những ai đã bị đổi role ở bảng User nhưng vẫn còn record ở bảng Mentor
      const filtered = mentors.filter(m => m.userId && m.userId.role === "mentor");
      
      res.json({ success: true, mentors: filtered });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Duyệt/Kích hoạt mentor
  toggleMentorStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      
      const mentor = await Mentor.findByIdAndUpdate(
        id, 
        { isActive }, 
        { new: true }
      );
      
      if (!mentor) return res.status(404).json({ success: false, error: "Không tìm thấy mentor" });
      
      res.json({ success: true, mentor });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Lấy danh sách toàn bộ User
  getAllUsers: async (req, res) => {
    try {
      const users = await User.find().sort({ createdAt: -1 });
      res.json({ success: true, users });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Khóa/Mở khóa User — khóa: vô hiệu JWT + xóa refresh (tokenVersion++, authSessions [])
  toggleUserStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      let user;
      if (isActive === false) {
        user = await User.findByIdAndUpdate(
          id,
          { $set: { isActive: false, authSessions: [] }, $inc: { tokenVersion: 1 } },
          { new: true },
        );
      } else {
        user = await User.findByIdAndUpdate(id, { $set: { isActive: true } }, { new: true });
      }
      if (!user) return res.status(404).json({ success: false, error: "Không tìm thấy người dùng" });
      res.json({ success: true, user });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Lấy danh sách toàn bộ Booking
  getAllBookings: async (req, res) => {
    try {
      const bookings = await Booking.find()
        .populate("mentorId", "name email")
        .populate("userId", "name email")
        .sort({ createdAt: -1 });
      res.json({ success: true, bookings });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Thống kê nhanh cho Dashboard
  getStats: async (req, res) => {
    try {
      const [userCount, mentorCount, bookingCount, recentBookings] = await Promise.all([
        User.countDocuments({ role: "customer" }),
        Mentor.countDocuments(),
        Booking.countDocuments(),
        Booking.find().sort({ createdAt: -1 }).limit(5).populate("mentorId userId")
      ]);

      res.json({
        success: true,
        stats: {
          users: userCount,
          mentors: mentorCount,
          bookings: bookingCount,
          recentBookings
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

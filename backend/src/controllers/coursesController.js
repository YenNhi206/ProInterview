import { Course } from "../models/Course.js";

export const CoursesController = {
  /** Danh sách khóa học */
  list: async (req, res) => {
    try {
      const courses = await Course.find({ status: "published" })
        .populate({
          path: "mentorId",
          select: "userId stats",
          populate: { path: "userId", select: "name avatar desiredPosition currentCompany" }
        })
        .sort({ createdAt: -1 });
      
      // Map to flat structure for FE if needed, or FE handles nested
      res.json({ success: true, courses });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /** Chi tiết khóa học */
  getById: async (req, res) => {
    try {
      const course = await Course.findById(req.params.id)
        .populate({
          path: "mentorId",
          select: "userId stats",
          populate: { path: "userId", select: "name avatar desiredPosition currentCompany" }
        });
      if (!course) {
        return res.status(404).json({ success: false, error: "Khóa học không tồn tại" });
      }
      res.json({ success: true, course });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
};

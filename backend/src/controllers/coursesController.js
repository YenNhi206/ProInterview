import { Course } from "../models/Course.js";
import { Enrollment } from "../models/Enrollment.js";
import { Mentor } from "../models/Mentor.js";

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

  /** Nội dung bài học */
  getLessonContent: async (req, res) => {
    try {
      const { id: courseId, lessonId } = req.params;
      const userId = req.userId;

      const course = await Course.findById(courseId);
      if (!course) return res.status(404).json({ success: false, error: "Khóa học không tồn tại" });

      // Tìm bài học trong các modules
      let lesson = null;
      if (course.modules) {
        for (const module of course.modules) {
          const found = module.lessons.find((l) => l._id.toString() === lessonId);
          if (found) {
            lesson = found;
            break;
          }
        }
      }

      if (!lesson) return res.status(404).json({ success: false, error: "Bài học không tồn tại" });

      // Kiểm tra quyền truy cập (nếu không miễn phí thì phải có ghi danh)
      if (!lesson.isFree) {
        const enrolled = await Enrollment.findOne({ userId, courseId });
        if (!enrolled) {
          return res.status(403).json({ success: false, error: "Bạn chưa ghi danh khóa học này để xem nội dung" });
        }
      }

      res.json({ success: true, lesson });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /** Tạo khóa học (Mentor) */
  create: async (req, res) => {
    try {
      const userId = req.userId;
      const mentor = await Mentor.findOne({ userId });
      if (!mentor) return res.status(403).json({ success: false, error: "Tài khoản chưa được thiết lập hồ sơ Mentor" });

      const course = await Course.create({
        ...req.body,
        mentorId: mentor._id,
        status: "draft"
      });

      res.status(201).json({ success: true, course });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /** Cập nhật khóa học */
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const course = await Course.findById(id);
      if (!course) return res.status(404).json({ success: false, error: "Không tìm thấy khóa học" });

      // Xác thực chủ sở hữu
      const mentor = await Mentor.findOne({ userId: req.userId });
      if (!mentor || course.mentorId.toString() !== mentor._id.toString()) {
        return res.status(403).json({ success: false, error: "Bạn không có quyền chỉnh sửa khóa học này" });
      }

      const updated = await Course.findByIdAndUpdate(id, req.body, { new: true });
      res.json({ success: true, course: updated });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /** Xuất bản khóa học */
  publish: async (req, res) => {
    try {
      const { id } = req.params;
      const course = await Course.findById(id);
      if (!course) return res.status(404).json({ success: false, error: "Không tìm thấy khóa học" });

      // Xác thực chủ sở hữu
      const mentor = await Mentor.findOne({ userId: req.userId });
      if (!mentor || course.mentorId.toString() !== mentor._id.toString()) {
        return res.status(403).json({ success: false, error: "Bạn không có quyền thực hiện thao tác này" });
      }

      course.status = "published";
      course.publishedAt = new Date();
      await course.save();

      res.json({ success: true, course });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /** Lưu trữ / Xóa mềm */
  archive: async (req, res) => {
    try {
      const { id } = req.params;
      const course = await Course.findById(id);
      if (!course) return res.status(404).json({ success: false, error: "Không tìm thấy khóa học" });

      const mentor = await Mentor.findOne({ userId: req.userId });
      if (!mentor || course.mentorId.toString() !== mentor._id.toString()) {
        return res.status(403).json({ success: false, error: "Bạn không có quyền thực hiện thao tác này" });
      }

      course.status = "archived";
      await course.save();

      res.json({ success: true, message: "Đã lưu trữ khóa học" });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
};

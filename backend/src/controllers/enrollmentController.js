import { Enrollment } from "../models/Enrollment.js";
import { Course } from "../models/Course.js";

export const EnrollmentController = {
  // Ghi danh khóa học
  enroll: async (req, res) => {
    try {
      const { id: courseId } = req.params;
      const userId = req.userId;

      // Kiểm tra khóa học tồn tại
      const course = await Course.findById(courseId);
      if (!course) return res.status(404).json({ success: false, error: "Không tìm thấy khóa học" });

      // Kiểm tra đã ghi danh chưa
      const existing = await Enrollment.findOne({ userId, courseId });
      if (existing) {
        return res.json({ success: true, message: "Bạn đã ghi danh khóa học này rồi", enrollment: existing });
      }

      const enrollment = await Enrollment.create({
        userId,
        courseId,
        pricePaid: course.price || 0,
        lastAccessedAt: new Date()
      });

      res.status(201).json({ success: true, enrollment });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Lấy danh sách khóa học của tôi
  getMyEnrollments: async (req, res) => {
    try {
      const enrollments = await Enrollment.find({ userId: req.userId })
        .populate({
          path: "courseId",
          populate: { 
            path: "mentorId", 
            populate: { path: "userId", select: "name avatar" }
          }
        })
        .sort({ updatedAt: -1 });

      res.json({ success: true, enrollments });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Cập nhật tiến độ học tập (đánh dấu bài đã học)
  updateProgress: async (req, res) => {
    try {
      const { id: enrollmentId } = req.params;
      const { lessonId, isCompleted } = req.body;
      const userId = req.userId;

      const enrollment = await Enrollment.findOne({ _id: enrollmentId, userId });
      if (!enrollment) return res.status(404).json({ success: false, error: "Hồ sơ ghi danh không tồn tại" });

      if (isCompleted) {
        // Thêm vào list completed nếu chưa có
        if (!enrollment.completedLessons.includes(lessonId)) {
          enrollment.completedLessons.push(lessonId);
        }
      } else {
        // Xóa khỏi list completed
        enrollment.completedLessons = enrollment.completedLessons.filter(id => id.toString() !== lessonId.toString());
      }

      enrollment.lastLessonId = lessonId;
      enrollment.lastAccessedAt = new Date();
      
      // Tính % tiến độ (giả định FE gửi số bài hoặc lấy từ course)
      const course = await Course.findById(enrollment.courseId);
      if (course && course.sections) {
        let totalLessons = 0;
        course.sections.forEach(s => totalLessons += (s.lessons?.length || 0));
        if (totalLessons > 0) {
          enrollment.progressPercent = Math.round((enrollment.completedLessons.length / totalLessons) * 100);
        }
      }

      await enrollment.save();
      res.json({ success: true, enrollment });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Lấy hoặc tạo chứng chỉ
  getCertificate: async (req, res) => {
    try {
      const { id: enrollmentId } = req.params;
      const userId = req.userId;

      const enrollment = await Enrollment.findOne({ _id: enrollmentId, userId })
        .populate("courseId")
        .populate("userId", "name");

      if (!enrollment) return res.status(404).json({ success: false, error: "Hồ sơ ghi danh không tồn tại" });

      const course = enrollment.courseId;
      if (!course) return res.status(404).json({ success: false, error: "Không tìm thấy thông tin khóa học" });

      // Kiểm tra khóa học có hỗ trợ chứng chỉ không
      if (course.settings && course.settings.certificateEnabled === false) {
        return res.status(400).json({ success: false, error: "Khóa học này không cấp chứng chỉ" });
      }

      // Kiểm tra xem đã đủ điều kiện nhận chứng chỉ chưa (ví dụ: tiến độ >= 100%)
      if (enrollment.progressPercent < 100 && !enrollment.isCompleted) {
        return res.status(400).json({ success: false, error: "Bạn cần hoàn thành 100% khóa học để nhận chứng chỉ" });
      }

      // Nếu chưa có certificateUrl thì tạo mới
      if (!enrollment.certificateUrl) {
        const certCode = `CERT-${enrollmentId.toString().slice(-6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
        enrollment.certificateUrl = `https://prointerview.vn/certificates/${certCode}.pdf`; // Mock URL
        enrollment.certificateIssuedAt = new Date();
        enrollment.isCompleted = true;
        if (!enrollment.completedAt) enrollment.completedAt = new Date();
        
        await enrollment.save();
      }

      res.json({
        success: true,
        certificate: {
          url: enrollment.certificateUrl,
          issuedAt: enrollment.certificateIssuedAt,
          courseTitle: course.title,
          studentName: enrollment.userId?.name || "Học viên",
          code: enrollment.certificateUrl.split("/").pop().replace(".pdf", "")
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

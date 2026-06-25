import { Course } from "../models/Course.js";
import { Enrollment } from "../models/Enrollment.js";
import { Mentor } from "../models/Mentor.js";
import { enrollmentAccessGranted } from "../helpers/enrollmentAccess.js";
import { mentorCanPeerPreviewCourse } from "../helpers/mentorPeerPreviewAccess.js";
import {
  applyPaidEnrollmentCountsToCourses,
  buildMentorCourseListSummary,
  countPaidEnrollmentsByCourseIds,
} from "../services/courseStatsService.js";
import {
  serializeCourseForApi,
  resolveStoredUploadUrl,
  normalizeUploadPathForStorage,
  isAllowedMediaUrl,
} from "../utils/resolveStoredUploadUrl.js";
import * as courseMentorInsights from "../services/courseMentorInsightsService.js";
import * as reviewsService from "../services/reviewsService.js";

function normalizeCoursePayload(body = {}) {
  const chapters = Array.isArray(body.chapters) ? body.chapters : [];
  const modules = chapters.map((ch, idx) => ({
    title: String(ch.title || `Chương ${idx + 1}`).trim(),
    order: idx + 1,
    lessons: (Array.isArray(ch.lessons) ? ch.lessons : []).map((lesson, lidx) => ({
      title: String(lesson.title || `Bài ${lidx + 1}`).trim(),
      type: "video",
      videoUrl: normalizeUploadPathForStorage(lesson.videoUrl || lesson.videoFileName || ""),
      durationMinutes: Number(lesson.duration || lesson.durationMinutes || 0),
      order: lidx + 1,
      isFree: Boolean(lesson.isPreview || lesson.isFree),
    })),
  }));

  const tags =
    typeof body.tags === "string"
      ? body.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : Array.isArray(body.tags)
        ? body.tags.map((t) => String(t).trim()).filter(Boolean)
        : [];

  const whatYoullLearn = Array.isArray(body.whatYoullLearn)
    ? body.whatYoullLearn.map((s) => String(s).trim()).filter(Boolean)
    : Array.isArray(body.outcomes)
      ? body.outcomes.map((s) => String(s).trim()).filter(Boolean)
      : [];

  const topicMap = {
    "behavioral-interview": "Behavioral",
    "technical-interview": "Technical",
    "career-development": "Other",
  };
  const topic = topicMap[String(body.category || "").trim()] || "Other";

  return {
    title: String(body.title || "").trim(),
    description: String(body.description || "").trim(),
    thumbnail: normalizeUploadPathForStorage(body.thumbnail),
    level: ["basic", "intermediate", "advanced"].includes(String(body.level))
      ? String(body.level)
      : "basic",
    price: Math.max(0, Number(body.price || 0)),
    isFree: Math.max(0, Number(body.price || 0)) <= 0,
    tags,
    topics: [topic],
    whatYoullLearn,
    modules,
  };
}

/**
 * Trả về tên field đầu tiên có link media không hợp lệ (hotlink ngoài), hoặc null nếu ổn.
 * Validate trên giá trị RAW từ request body — normalizeUploadPathForStorage có heuristic
 * tự rewrite path đuôi ảnh/video thành "/uploads/..." (bỏ host gốc), nên phải chặn TRƯỚC
 * khi normalize, không phải sau (nếu không hotlink sẽ bị "tẩy trắng" qua được check).
 */
function findInvalidMediaUrl(body = {}) {
  if (!isAllowedMediaUrl(body.thumbnail)) return "ảnh đại diện khóa học";
  const chapters = Array.isArray(body.chapters) ? body.chapters : [];
  for (const ch of chapters) {
    const lessons = Array.isArray(ch.lessons) ? ch.lessons : [];
    for (const lesson of lessons) {
      const videoUrl = lesson.videoUrl || lesson.videoFileName || "";
      if (!isAllowedMediaUrl(videoUrl)) return `video bài "${lesson.title || "không tên"}"`;
    }
  }
  return null;
}

export const CoursesController = {
  /** Danh sách khóa học */
  list: async (req, res, next) => {
    try {
      const courses = await Course.find({ status: { $in: ["published", "pending_update"] } })
        .populate({
          path: "mentorId",
          select: "userId stats",
          populate: { path: "userId", select: "name avatar desiredPosition currentCompany" }
        })
        .sort({ createdAt: -1 });
      
      res.json({
        success: true,
        courses: courses.map((c) => serializeCourseForApi(c)),
      });
    } catch (error) {
      next(error);
    }
  },

  /** Chi tiết khóa học */
  getById: async (req, res, next) => {
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
      res.json({ success: true, course: serializeCourseForApi(course) });
    } catch (error) {
      next(error);
    }
  },

  /** Danh sách khóa học của mentor hiện tại */
  listMine: async (req, res, next) => {
    try {
      const mentor = await Mentor.findOne({ userId: req.userId }).select("_id").lean();
      if (!mentor) return res.status(403).json({ success: false, error: "Tài khoản chưa là mentor." });
      const courseRows = await Course.find({ mentorId: mentor._id }).sort({ updatedAt: -1 });
      const serialized = courseRows.map((c) => serializeCourseForApi(c));
      const countMap = await countPaidEnrollmentsByCourseIds(serialized.map((c) => c._id));
      const coursesWithCounts = applyPaidEnrollmentCountsToCourses(serialized, countMap);
      const summary = await buildMentorCourseListSummary(coursesWithCounts);
      return res.json({
        success: true,
        courses: coursesWithCounts,
        summary,
      });
    } catch (error) {
      return next(error);
    }
  },

  /** Nội dung bài học */
  getLessonContent: async (req, res, next) => {
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

      let hasAccess = Boolean(lesson.isFree);
      if (!hasAccess) {
        const enrolled = await Enrollment.findOne({ userId, courseId });
        hasAccess = Boolean(enrolled && enrollmentAccessGranted(enrolled));
      }
      if (!hasAccess) {
        hasAccess = await mentorCanPeerPreviewCourse(userId, course);
      }
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: "Bạn chưa ghi danh khóa học này để xem nội dung",
        });
      }

      const lessonPayload = lesson.toObject ? lesson.toObject() : { ...lesson };
      if (lessonPayload.videoUrl) {
        lessonPayload.videoUrl = resolveStoredUploadUrl(lessonPayload.videoUrl);
      }
      if (lessonPayload.documentUrl) {
        lessonPayload.documentUrl = resolveStoredUploadUrl(lessonPayload.documentUrl);
      }

      res.json({ success: true, lesson: lessonPayload });
    } catch (error) {
      next(error);
    }
  },

  /** Tạo khóa học (Mentor) */
  create: async (req, res, next) => {
    try {
      const userId = req.userId;
      const mentor = await Mentor.findOne({ userId });
      if (!mentor) return res.status(403).json({ success: false, error: "Tài khoản chưa được thiết lập hồ sơ Mentor" });

      const invalidMedia = findInvalidMediaUrl(req.body ?? {});
      if (invalidMedia) {
        return res.status(400).json({
          success: false,
          error: `Link ${invalidMedia} không hợp lệ — chỉ chấp nhận file đã upload qua hệ thống.`,
        });
      }
      const payload = normalizeCoursePayload(req.body ?? {});
      if (!payload.title) {
        return res.status(400).json({ success: false, error: "Thiếu tiêu đề khóa học." });
      }

      const course = await Course.create({
        ...payload,
        mentorId: mentor._id,
        status: "draft"
      });

      res.status(201).json({ success: true, course: serializeCourseForApi(course) });
    } catch (error) {
      next(error);
    }
  },

  /** Cập nhật khóa học */
  update: async (req, res, next) => {
    try {
      const { id } = req.params;
      const course = await Course.findById(id);
      if (!course) return res.status(404).json({ success: false, error: "Không tìm thấy khóa học" });

      // Xác thực chủ sở hữu
      const mentor = await Mentor.findOne({ userId: req.userId });
      if (!mentor || course.mentorId.toString() !== mentor._id.toString()) {
        return res.status(403).json({ success: false, error: "Bạn không có quyền chỉnh sửa khóa học này" });
      }

      const invalidMedia = findInvalidMediaUrl(req.body ?? {});
      if (invalidMedia) {
        return res.status(400).json({
          success: false,
          error: `Link ${invalidMedia} không hợp lệ — chỉ chấp nhận file đã upload qua hệ thống.`,
        });
      }
      const payload = normalizeCoursePayload(req.body ?? {});

      // Khóa học đang public (published) hoặc đã có bản chờ duyệt — lưu vào pendingUpdate,
      // KHÔNG ghi đè trực tiếp nội dung đang hiển thị public. Tránh mentor né luồng admin
      // duyệt nội dung/giá bằng cách gọi update() thay vì publish() (xem approveCourse ở
      // adminController.js — đó là nơi duy nhất áp pendingUpdate vào khóa học live).
      if (course.status === "published" || course.status === "pending_update") {
        course.pendingUpdate = payload;
        course.status = "pending_update";
        await course.save();
        return res.json({
          success: true,
          course: serializeCourseForApi(course),
          message: "Đã lưu bản chỉnh sửa, chờ admin duyệt trước khi áp dụng cho khóa học đang public.",
        });
      }

      const updated = await Course.findByIdAndUpdate(id, payload, { new: true });
      res.json({ success: true, course: serializeCourseForApi(updated) });
    } catch (error) {
      next(error);
    }
  },

  /** Mentor gửi khóa học chờ admin duyệt */
  publish: async (req, res, next) => {
    try {
      const { id } = req.params;
      const course = await Course.findById(id);
      if (!course) return res.status(404).json({ success: false, error: "Không tìm thấy khóa học" });

      // Xác thực chủ sở hữu
      const mentor = await Mentor.findOne({ userId: req.userId });
      if (!mentor || course.mentorId.toString() !== mentor._id.toString()) {
        return res.status(403).json({ success: false, error: "Bạn không có quyền thực hiện thao tác này" });
      }

      // Published -> lưu bản chỉnh sửa vào pendingUpdate, không làm khóa public biến mất.
      if (course.status === "published" || course.status === "pending_update") {
        const invalidMedia = findInvalidMediaUrl(req.body ?? {});
        if (invalidMedia) {
          return res.status(400).json({
            success: false,
            error: `Link ${invalidMedia} không hợp lệ — chỉ chấp nhận file đã upload qua hệ thống.`,
          });
        }
        const pendingPayload = normalizeCoursePayload(req.body ?? {});
        if (!pendingPayload.title || !pendingPayload.modules?.length) {
          return res.status(400).json({
            success: false,
            error: "Bản cập nhật chưa đủ thông tin để gửi duyệt.",
          });
        }
        course.pendingUpdate = pendingPayload;
        course.status = "pending_update";
        await course.save();
        return res.json({
          success: true,
          course,
          message: "Đã gửi bản cập nhật khóa học để admin duyệt.",
        });
      }

      // Draft -> gửi duyệt khóa mới.
      if (!course.title || !course.modules?.length) {
        return res.status(400).json({
          success: false,
          error: "Khóa học chưa đủ thông tin để đăng (thiếu tiêu đề hoặc nội dung bài học).",
        });
      }
      course.status = "pending_review";
      course.publishedAt = null;
      await course.save();

      return res.json({ success: true, course, message: "Đã gửi khóa học để admin duyệt." });
    } catch (error) {
      next(error);
    }
  },

  /** Lưu trữ / Xóa mềm */
  archive: async (req, res, next) => {
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
      next(error);
    }
  },

  mentorStudents: async (req, res, next) => {
    try {
      const result = await courseMentorInsights.getCourseStudentsForMentor(req.userId, req.params.id);
      if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
      return res.json({ success: true, students: result.students, summary: result.summary });
    } catch (error) {
      return next(error);
    }
  },

  mentorQA: async (req, res, next) => {
    try {
      const result = await courseMentorInsights.getCourseQAForMentor(req.userId, req.params.id);
      if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
      return res.json({ success: true, items: result.items, pendingCount: result.pendingCount });
    } catch (error) {
      return next(error);
    }
  },

  mentorAnswerQA: async (req, res, next) => {
    try {
      const result = await courseMentorInsights.answerCourseQAForMentor(
        req.userId,
        req.params.id,
        req.params.qaId,
        req.body?.content,
      );
      if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
      return res.json({ success: true, message: result.message });
    } catch (error) {
      return next(error);
    }
  },

  studentLessonQA: async (req, res, next) => {
    try {
      const result = await courseMentorInsights.getLessonQAForStudent(
        req.userId,
        req.params.id,
        req.params.lessonId,
      );
      if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
      return res.json({ success: true, items: result.items });
    } catch (error) {
      return next(error);
    }
  },

  studentCreateLessonQA: async (req, res, next) => {
    try {
      const result = await courseMentorInsights.createLessonQAForStudent(
        req.userId,
        req.params.id,
        req.params.lessonId,
        req.body?.question,
      );
      if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
      return res.status(201).json({ success: true, item: result.item, message: result.message });
    } catch (error) {
      return next(error);
    }
  },

  studentLessonNotes: async (req, res, next) => {
    try {
      const result = await courseMentorInsights.getLessonNotesForStudent(
        req.userId,
        req.params.id,
        req.params.lessonId,
      );
      if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
      return res.json({
        success: true,
        content: result.content,
        updatedAt: result.updatedAt,
      });
    } catch (error) {
      return next(error);
    }
  },

  studentSaveLessonNotes: async (req, res, next) => {
    try {
      const result = await courseMentorInsights.saveLessonNotesForStudent(
        req.userId,
        req.params.id,
        req.params.lessonId,
        req.body?.content,
      );
      if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
      return res.json({
        success: true,
        content: result.content,
        updatedAt: result.updatedAt,
        message: result.message,
      });
    } catch (error) {
      return next(error);
    }
  },

  mentorReviews: async (req, res, next) => {
    try {
      const result = await courseMentorInsights.getCourseReviewsForMentor(req.userId, req.params.id);
      if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
      return res.json({ success: true, reviews: result.reviews, summary: result.summary });
    } catch (error) {
      return next(error);
    }
  },

  /** Đánh giá chéo mentor — public trên trang chi tiết khóa học. */
  peerReviewsPublic: async (req, res, next) => {
    try {
      const result = await reviewsService.listCoursePeerReviewsPublic(req.params.id);
      if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
      return res.json({ success: true, reviews: result.reviews });
    } catch (error) {
      return next(error);
    }
  },

  mentorAnalytics: async (req, res, next) => {
    try {
      const result = await courseMentorInsights.getCourseAnalyticsForMentor(req.userId, req.params.id);
      if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
      return res.json({ success: true, lessonStats: result.lessonStats, totals: result.totals });
    } catch (error) {
      return next(error);
    }
  },
};

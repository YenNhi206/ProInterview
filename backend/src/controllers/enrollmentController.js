import mongoose from "mongoose";
import { Enrollment } from "../models/Enrollment.js";
import { Course } from "../models/Course.js";
import { Mentor } from "../models/Mentor.js";
import { User } from "../models/User.js";
import { enrollmentAccessGranted } from "../helpers/enrollmentAccess.js";
import { recordTransferPending, recordTransferSubmitted } from "../services/paymentsService.js";
import { incrementCourseEnrollmentCount } from "../services/courseStatsService.js";
import { resolveCoursePlatformFeeRate } from "../services/mentorCommissionService.js";
import { serializeCourseForApi } from "../utils/resolveStoredUploadUrl.js";
import { newPaymentExpiresAt } from "../utils/transferPaymentExpiry.js";
import { expireEnrollmentTransferIfNeeded } from "../services/transferPaymentExpiryService.js";
import { enforceExpiry } from "../utils/planGuard.js";
import { resolvePlanPerkDiscountRate } from "../constants/planCatalog.js";

function genOrderRef() {
  return `PI${Math.floor(Math.random() * 900000 + 100000)}`;
}

function extractOrderPart(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  return s.split("|")[0].trim().slice(0, 120);
}

function mergePaymentRef(orderPart, refRaw) {
  const order = extractOrderPart(orderPart);
  const fallback = extractOrderPart(refRaw);
  return (order || fallback).slice(0, 120);
}

export const EnrollmentController = {
  enroll: async (req, res, next) => {
    try {
      const { id: courseId } = req.params;
      const userId = req.userId;

      const course = await Course.findById(courseId);
      if (!course) return res.status(404).json({ success: false, error: "Không tìm thấy khóa học" });

      const price = Number(course.price || 0);
      const courseMentor = course?.mentorId
        ? await Mentor.findById(course.mentorId).select("pricing userId").lean()
        : null;
      if (courseMentor?.userId && String(courseMentor.userId) === String(userId)) {
        return res.status(400).json({ success: false, error: "Không thể tự mua khóa học của chính mình." });
      }
      const { rate: coursePlatformFeeRate } = resolveCoursePlatformFeeRate(courseMentor);
      const coursePlatformFee = Math.round(Math.max(0, price) * coursePlatformFeeRate);

      let buyer = await User.findById(userId).select("plan planExpiresAt").lean();
      if (buyer) buyer = await enforceExpiry(buyer);
      const discountRate = resolvePlanPerkDiscountRate(buyer?.plan);
      const discountAmount = discountRate > 0 ? Math.round(Math.max(0, price) * discountRate) : 0;
      const coursePriceAfterDiscount = Math.max(0, price - discountAmount);
      const coursePlatformFeeAfterDiscount = Math.max(0, coursePlatformFee - discountAmount);

      const existing = await Enrollment.findOne({ userId, courseId });

      if (existing) {
        if (enrollmentAccessGranted(existing)) {
          return res.json({ success: true, message: "Bạn đã mua khóa học này rồi", enrollment: existing });
        }
        const bodyPm = String(req.body?.paymentMethod || "").trim();
        if (price > 0 && bodyPm === "transfer") {
          const expired = await expireEnrollmentTransferIfNeeded(existing);
          if (expired.expired) {
            // Ghi danh cũ đã hết hạn — tạo mới bên dưới.
          } else {
            const coursePrice = Math.round(coursePriceAfterDiscount);
            const clientOrder = extractOrderPart(req.body?.orderNum);
            let dirty = false;
            if (Math.round(Number(existing.pricePaid ?? 0)) !== coursePrice) {
              existing.pricePaid = coursePrice;
              dirty = true;
            }
            if (Number(existing.platformFeeRate) !== Number(coursePlatformFeeRate)) {
              existing.platformFeeRate = coursePlatformFeeRate;
              dirty = true;
            }
            if (Math.round(Number(existing.platformFee ?? 0)) !== Math.round(coursePlatformFeeAfterDiscount)) {
              existing.platformFee = coursePlatformFeeAfterDiscount;
              dirty = true;
            }
            if (Number(existing.discountRate ?? 0) !== discountRate) {
              existing.discountRate = discountRate;
              dirty = true;
            }
            if (Math.round(Number(existing.discountAmount ?? 0)) !== Math.round(discountAmount)) {
              existing.discountAmount = discountAmount;
              dirty = true;
            }
            if (clientOrder && extractOrderPart(existing.paymentRef) !== clientOrder) {
              existing.paymentRef = clientOrder;
              dirty = true;
            }
            if (dirty) await existing.save();
            const orderPart = extractOrderPart(existing.paymentRef) || String(existing._id).slice(-8);
            return res.json({
              success: true,
              enrollment: existing,
              orderNum: orderPart,
              awaitingPayment: true,
              paymentExpiresAt: existing.paymentExpiresAt,
            });
          }
        } else {
          return res.status(400).json({
            success: false,
            error: "Đơn mua khóa học đang chờ thanh toán. Mở lại trang thanh toán để hoàn tất chuyển khoản.",
          });
        }
      }

      if (price <= 0) {
        const enrollment = await Enrollment.create({
          userId,
          courseId,
          pricePaid: 0,
          platformFeeRate: coursePlatformFeeRate,
          platformFee: 0,
          paymentStatus: "paid",
          paymentMethod: "",
          lastAccessedAt: new Date(),
        });
        await incrementCourseEnrollmentCount(courseId);
        return res.status(201).json({ success: true, enrollment });
      }

      const pm = String(req.body?.paymentMethod || "").trim();
      if (pm !== "transfer") {
        return res.status(400).json({
          success: false,
          error: "Khóa học có phí. Vui lòng thanh toán chuyển khoản qua trang thanh toán.",
          requiresPayment: true,
          price,
        });
      }

      const clientOrder = extractOrderPart(req.body?.orderNum);
      const orderRef = clientOrder || genOrderRef();
      const paymentExpiresAt = newPaymentExpiresAt();

      const enrollment = await Enrollment.create({
        userId,
        courseId,
        pricePaid: coursePriceAfterDiscount,
        platformFeeRate: coursePlatformFeeRate,
        platformFee: coursePlatformFeeAfterDiscount,
        discountRate,
        discountAmount,
        paymentStatus: "pending",
        paymentMethod: "transfer",
        paymentRef: orderRef,
        paymentExpiresAt,
        lastAccessedAt: new Date(),
      });

      // Ledger pending cho CK khóa học
      const ledgerAmt = Math.round(Number(enrollment.pricePaid ?? 0));
      if (ledgerAmt > 0) {
        const ledger = await recordTransferPending({
          userId: enrollment.userId,
          type: "course",
          referenceModel: "Enrollment",
          referenceId: enrollment._id,
          amount: ledgerAmt,
          paymentExpiresAt,
        });
        if (!ledger.ok && !ledger.idempotent) {
          console.error("[enroll] ledger:", ledger.error);
        }
      }

      return res.status(201).json({
        success: true,
        enrollment,
        orderNum: enrollment.paymentRef,
        paymentExpiresAt: enrollment.paymentExpiresAt,
      });
    } catch (error) {
      next(error);
    }
  },

  submitTransfer: async (req, res, next) => {
    try {
      const { id: enrollmentId } = req.params;
      const userId = req.userId;
      if (!mongoose.isValidObjectId(enrollmentId)) {
        return res.status(400).json({ success: false, error: "id đơn mua khóa không hợp lệ." });
      }

      const enrollment = await Enrollment.findOne({ _id: enrollmentId, userId });
      if (!enrollment) return res.status(404).json({ success: false, error: "Không tìm thấy đơn mua khóa." });
      if (enrollment.paymentStatus === "paid" || enrollmentAccessGranted(enrollment)) {
        return res.status(400).json({ success: false, error: "Thanh toán đã được xử lý." });
      }
      if (enrollment.paymentMethod !== "transfer") {
        return res.status(400).json({ success: false, error: "Đơn mua khóa này không dùng chuyển khoản." });
      }

      const refRaw = String(req.body?.reference ?? req.body?.transferReference ?? "").trim();
      const orderPart = String(enrollment.paymentRef || "").trim() || String(enrollment._id).slice(-8);
      enrollment.paymentRef = mergePaymentRef(orderPart, refRaw);
      enrollment.transferSubmittedAt = new Date();
      await enrollment.save();

      // Đồng bộ ledger (payments) tương tự booking CK.
      const ledgerAmt = Math.round(Number(enrollment.pricePaid ?? 0));
      if (ledgerAmt > 0) {
        const ensure = await recordTransferPending({
          userId: enrollment.userId,
          type: "course",
          referenceModel: "Enrollment",
          referenceId: enrollment._id,
          amount: ledgerAmt,
        });
        if (!ensure.ok && !ensure.idempotent) {
          console.error("[submitTransfer] ensure ledger:", ensure.error);
        } else {
          const meta = await recordTransferSubmitted({
            userId: enrollment.userId,
            type: "course",
            referenceId: enrollment._id,
            paymentRef: enrollment.paymentRef,
            submittedAt: enrollment.transferSubmittedAt,
          });
          if (!meta.ok) {
            console.error("[submitTransfer] ledger meta:", meta.error);
          }
        }
      }

      res.json({ success: true, enrollment });
    } catch (error) {
      next(error);
    }
  },

  getMyEnrollments: async (req, res, next) => {
    try {
      const enrollments = await Enrollment.find({ userId: req.userId })
        .populate({
          path: "courseId",
          populate: {
            path: "mentorId",
            populate: { path: "userId", select: "name avatar" },
          },
        })
        .sort({ updatedAt: -1 });

      res.json({
        success: true,
        enrollments: enrollments.map((e) => {
          const doc = e.toObject ? e.toObject() : e;
          if (doc.courseId) doc.courseId = serializeCourseForApi(doc.courseId);
          return doc;
        }),
      });
    } catch (error) {
      next(error);
    }
  },

  updateProgress: async (req, res, next) => {
    try {
      const { id: enrollmentId } = req.params;
      const { lessonId, isCompleted } = req.body;
      const userId = req.userId;

      if (!lessonId || !mongoose.isValidObjectId(String(lessonId))) {
        return res.status(400).json({ success: false, error: "lessonId không hợp lệ." });
      }

      const enrollment = await Enrollment.findOne({ _id: enrollmentId, userId });
      if (!enrollment) return res.status(404).json({ success: false, error: "Hồ sơ mua khóa không tồn tại" });
      if (!enrollmentAccessGranted(enrollment)) {
        return res.status(403).json({ success: false, error: "Hoàn tất thanh toán khóa học để cập nhật tiến độ." });
      }

      // Fetch course trước để validate lesson tồn tại trong khóa học
      const course = await Course.findById(enrollment.courseId);

      if (course) {
        const allLessons = [];
        if (Array.isArray(course.modules) && course.modules.length > 0) {
          course.modules.forEach((m) => allLessons.push(...(m.lessons ?? [])));
        } else if (Array.isArray(course.sections) && course.sections.length > 0) {
          course.sections.forEach((s) => allLessons.push(...(s.lessons ?? [])));
        }
        const lessonExists = allLessons.some((l) => l._id?.toString() === String(lessonId));
        if (!lessonExists) {
          return res.status(400).json({ success: false, error: "Bài học không tồn tại trong khóa học này." });
        }
      }

      if (isCompleted) {
        if (!enrollment.completedLessons.some((id) => id.toString() === lessonId)) {
          enrollment.completedLessons.push(lessonId);
        }
      } else {
        enrollment.completedLessons = enrollment.completedLessons.filter(
          (id) => id.toString() !== lessonId.toString(),
        );
      }

      enrollment.lastLessonId = lessonId;
      enrollment.lastAccessedAt = new Date();

      if (course) {
        let totalLessons = 0;
        if (Array.isArray(course.modules) && course.modules.length > 0) {
          course.modules.forEach((m) => {
            totalLessons += m.lessons?.length || 0;
          });
        } else if (Array.isArray(course.sections) && course.sections.length > 0) {
          course.sections.forEach((s) => {
            totalLessons += s.lessons?.length || 0;
          });
        }
        if (totalLessons > 0) {
          enrollment.progressPercent = Math.round((enrollment.completedLessons.length / totalLessons) * 100);
        }
      }

      await enrollment.save();
      res.json({ success: true, enrollment });
    } catch (error) {
      next(error);
    }
  },

  getCertificate: async (req, res, next) => {
    try {
      const { id: enrollmentId } = req.params;
      const userId = req.userId;

      const enrollment = await Enrollment.findOne({ _id: enrollmentId, userId })
        .populate("courseId")
        .populate("userId", "name");

      if (!enrollment) return res.status(404).json({ success: false, error: "Hồ sơ mua khóa không tồn tại" });
      if (!enrollmentAccessGranted(enrollment)) {
        return res.status(403).json({ success: false, error: "Hoàn tất thanh toán khóa học để nhận chứng chỉ." });
      }

      const course = enrollment.courseId;
      if (!course) return res.status(404).json({ success: false, error: "Không tìm thấy thông tin khóa học" });

      if (course.settings && course.settings.certificateEnabled === false) {
        return res.status(400).json({ success: false, error: "Khóa học này không cấp chứng chỉ" });
      }

      if (enrollment.progressPercent < 100 && !enrollment.isCompleted) {
        return res.status(400).json({ success: false, error: "Bạn cần hoàn thành 100% khóa học để nhận chứng chỉ" });
      }

      if (!enrollment.certificateUrl) {
        const certCode = `CERT-${enrollmentId.toString().slice(-6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
        enrollment.certificateUrl = `https://prointerview.vn/certificates/${certCode}.pdf`;
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
          code: enrollment.certificateUrl.split("/").pop().replace(".pdf", ""),
        },
      });
    } catch (error) {
      next(error);
    }
  },
};

import mongoose from "mongoose";
import bcrypt from "bcrypt";
import fs from "fs";
import * as bookingsService from "../services/bookingsService.js";
import * as paymentsService from "../services/paymentsService.js";
import { tryCreditMentorForPaidEnrollment, tryCreditMentorForCompletedBooking } from "../services/mentorEarningsService.js";
import { normalizeTransferRefs } from "../services/normalizeTransferRefsService.js";
import { runInTransaction } from "../helpers/dbHelper.js";

import { PayoutRequest } from "../models/PayoutRequest.js";
import { Enrollment } from "../models/Enrollment.js";
import { InterviewSession } from "../models/InterviewSession.js";
import { Notification } from "../models/index.js";
import { deliverNotification } from "../services/notificationDeliveryService.js";
import { activateMentorCommissionPolicy } from "../services/mentorCommissionService.js";
import { serializeCourseForApi, resolveStoredUploadUrl } from "../utils/resolveStoredUploadUrl.js";
import {
  applyPaidEnrollmentCountsToAdminCourses,
  countPaidEnrollmentsByCourseIds,
} from "../services/courseStatsService.js";
import { isUserOnline } from "../utils/userPresence.js";
import { getPlatformBehavior, getUserJourney } from "../services/analyticsService.js";
import { uploadToCloudinary } from "../utils/cloudinaryUpload.js";
import { downloadGoogleDriveFile } from "../utils/googleDrive.js";
import { CVAnalysis } from "../models/CVAnalysis.js";
const User = mongoose.model("User");
const Mentor = mongoose.model("Mentor");
const Booking = mongoose.model("Booking");
const Course = mongoose.model("Course");
const Report = mongoose.model("Report");
const Payment = mongoose.model("Payment");

function normalizeRateInput(raw) {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 1) return NaN;
  return n;
}

function serializeSubscriptionPayment(p) {
  const pr = p.providerResponse && typeof p.providerResponse === "object" ? p.providerResponse : {};
  const u = p.userId && typeof p.userId === "object" ? p.userId : null;
  return {
    id: String(p._id),
    amount: p.amount,
    providerRef: p.providerRef || "",
    plan: pr.plan === "elite_pro" ? "elite_pro" : "starter_pro",
    status: p.status,
    createdAt: p.createdAt,
    paidAt: p.paidAt || null,
    paymentRef: pr.paymentRef || "",
    user: u
      ? {
          id: String(u._id),
          name: u.name || "",
          email: u.email || "",
          plan: u.plan || "free",
        }
      : null,
  };
}

function safeFeeRate(raw, fallback) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 1) return fallback;
  return n;
}

function parseMonthRange(rawMonth) {
  const month = String(rawMonth || "").trim();
  if (!month) return null;
  const m = month.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) return null;
  const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const end = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0);
  return { month, start, end };
}

function planCountsFromAgg(rows = []) {
  const out = { free: 0, starter_pro: 0, elite_pro: 0 };
  for (const row of rows) {
    const key = String(row._id || "free");
    if (Object.prototype.hasOwnProperty.call(out, key)) out[key] += Number(row.count) || 0;
    else out.free += Number(row.count) || 0;
  }
  return out;
}

function statusCountsFromAgg(rows = []) {
  const out = {};
  for (const row of rows) {
    out[String(row._id || "unknown")] = Number(row.count) || 0;
  }
  return out;
}

function serializeRecentBookingForAdmin(booking) {
  const mentorUser = booking?.mentorId?.userId;
  return {
    _id: booking._id,
    date: booking.date,
    timeSlot: booking.timeSlot,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    totalAmount: booking.totalAmount,
    createdAt: booking.createdAt,
    studentName: booking.userId?.name || booking.userId?.email || "—",
    mentorName:
      (typeof mentorUser === "object" && mentorUser?.name) ||
      booking.mentorId?.title ||
      "—",
  };
}

/** Câu hỏi từ mảng LLM hoặc fallback questionText trong answers (phiên cũ). */
function resolveAdminSessionQuestions(session) {
  const fromBank = (session.questions || []).filter((q) => String(q?.question || "").trim());
  if (fromBank.length) {
    return fromBank.map((q, i) => ({
      index: i + 1,
      layer: q.layer || "",
      question: q.question,
      competencyName: q.competencyName || "",
      source: "llm",
    }));
  }
  const answers = Array.isArray(session.answers) ? session.answers : [];
  return [...answers]
    .sort((a, b) => (a.questionIndex ?? 0) - (b.questionIndex ?? 0))
    .filter((a) => String(a?.questionText || "").trim())
    .map((a, i) => ({
      index: (a.questionIndex ?? i) + 1,
      layer: "",
      question: a.questionText,
      competencyName: "",
      source: "answer",
      transcriptPreview: String(a.transcript || "").trim().slice(0, 160) || null,
    }));
}

export const AdminController = {
  // Lấy danh sách mentor (có cả ứng viên chờ duyệt role customer) — admin UI lọc theo ngữ cảnh.
  getAllMentors: async (req, res, next) => {
    try {
      // Ép hệ thống kiểm tra và tạo hồ sơ mới nếu bạn vừa sửa ở Compass
      const { ensureMentorProfilesForAllMentorUsers } = await import("../services/mentorProfileService.js");
      await ensureMentorProfilesForAllMentorUsers();

      const mentors = await Mentor.find()
        .populate(
          "userId",
          "name email avatar role isActive lastSeenAt profileWorkExperience profileEducation profileExtracurricular profileAwards desiredPosition currentCompany experience school",
        )
        .sort({ createdAt: -1 })
        .lean();
      
      // Có userId: gồm cố vấn đã duyệt (role mentor) và ứng viên đang chờ (role customer).
      const filtered = mentors
        .filter((m) => m.userId)
        .map((m) => ({
          ...m,
          lastSeenAt: m.userId?.lastSeenAt ?? null,
          isOnline: isUserOnline(m.userId?.lastSeenAt),
        }));
      
      res.json({ success: true, mentors: filtered });
    } catch (error) {
      next(error);
    }
  },

  getMentorById: async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, error: "mentorId không hợp lệ." });
      }
      const mentor = await Mentor.findById(id)
        .populate("userId", "name email avatar role isActive plan lastSeenAt")
        .lean();
      if (!mentor) return res.status(404).json({ success: false, error: "Không tìm thấy cố vấn." });

      const sessionsCount = await Booking.countDocuments({ mentorId: mentor._id });
      res.json({
        success: true,
        mentor: {
          ...mentor,
          lastSeenAt: mentor.userId?.lastSeenAt ?? null,
          isOnline: isUserOnline(mentor.userId?.lastSeenAt),
          stats: { ...(mentor.stats || {}), sessionsCount },
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // Duyệt/Kích hoạt mentor
  toggleMentorStatus: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      if (typeof isActive !== "boolean") {
        return res.status(400).json({ success: false, error: "isActive phải là boolean." });
      }

      const update = isActive
        ? {
            isActive: true,
            available: true,
            isVerified: true,
            verifiedAt: new Date(),
            "adminReview.status": "approved",
            "adminReview.reason": "",
            "adminReview.reviewedAt": new Date(),
            "adminReview.reviewedBy": req.userId || null,
          }
        : { isActive: false, available: false };

      const mentor = await Mentor.findByIdAndUpdate(id, update, { new: true });

      if (!mentor) return res.status(404).json({ success: false, error: "Không tìm thấy mentor" });

      if (mentor.userId && isActive) {
        await User.updateOne(
          { _id: mentor.userId },
          {
            $set: {
              role: "mentor",
              desiredPosition: mentor.title || "",
              currentCompany: mentor.company || "",
              experience: mentor.experienceYears ?? 0,
              skills: Array.isArray(mentor.specialties) ? mentor.specialties : [],
              bio: mentor.bio || "",
            },
          },
        );
        await activateMentorCommissionPolicy(mentor._id).catch((err) => {
          console.error("[Admin] activateMentorCommissionPolicy:", err?.message || err);
        });
        try {
          const { markMentorPendingNotificationsRead } = await import(
            "../services/mentorMeService.js"
          );
          await markMentorPendingNotificationsRead(mentor.userId);
          await Notification.create({
            userId: mentor.userId,
            type: "system",
            title: "Hồ sơ mentor đã được duyệt",
            body: "Chúc mừng! Bạn có thể truy cập khu vực Mentor trên ProInterview.",
            metadata: { actionUrl: "/mentor/dashboard" },
          });
        } catch (notifErr) {
          console.error("[Admin] mentor approved notification:", notifErr);
        }
      }

      res.json({ success: true, mentor });
    } catch (error) {
      next(error);
    }
  },

  rejectMentorApplication: async (req, res, next) => {
    try {
      const { id } = req.params;
      const reason = String(req.body?.reason || "").trim();
      if (!reason) {
        return res.status(400).json({ success: false, error: "Vui lòng nhập lý do từ chối hồ sơ." });
      }

      const mentor = await Mentor.findByIdAndUpdate(
        id,
        {
          isActive: false,
          available: false,
          isVerified: false,
          verifiedAt: null,
          "adminReview.status": "rejected",
          "adminReview.reason": reason,
          "adminReview.reviewedAt": new Date(),
          "adminReview.reviewedBy": req.userId || null,
        },
        { new: true },
      );

      if (!mentor) return res.status(404).json({ success: false, error: "Không tìm thấy cố vấn." });

      if (mentor.userId) {
        await User.updateOne({ _id: mentor.userId }, { $set: { role: "customer" } });
        try {
          const { markMentorPendingNotificationsRead } = await import(
            "../services/mentorMeService.js"
          );
          await markMentorPendingNotificationsRead(mentor.userId);
          const reasonShort =
            reason.length > 220 ? `${reason.slice(0, 217)}…` : reason;
          await Notification.create({
            userId: mentor.userId,
            type: "feedback",
            title: "Hồ sơ mentor bị từ chối",
            body: `Admin từ chối hồ sơ của bạn. Lý do: ${reasonShort}. Vui lòng cập nhật hồ sơ và đăng ký lại.`,
            metadata: {
              mentorId: mentor._id,
              actionUrl: "/profile",
            },
          });
        } catch (notifErr) {
          console.error("[Admin] rejectMentorApplication notification:", notifErr);
        }
      }

      res.json({ success: true, mentor });
    } catch (error) {
      next(error);
    }
  },

  /** Cập nhật mức phí riêng theo hợp đồng cho mentor (override). */
  updateMentorCommission: async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, error: "mentorId không hợp lệ." });
      }

      const hasBookingRate = Object.prototype.hasOwnProperty.call(req.body ?? {}, "bookingPlatformFeeRate");
      const hasCourseRate = Object.prototype.hasOwnProperty.call(req.body ?? {}, "coursePlatformFeeRate");
      if (!hasBookingRate && !hasCourseRate) {
        return res.status(400).json({
          success: false,
          error: "Thiếu dữ liệu cập nhật phí mentor.",
        });
      }

      const bookingRate = hasBookingRate ? normalizeRateInput(req.body?.bookingPlatformFeeRate) : undefined;
      const courseRate = hasCourseRate ? normalizeRateInput(req.body?.coursePlatformFeeRate) : undefined;
      if (Number.isNaN(bookingRate) || Number.isNaN(courseRate)) {
        return res.status(400).json({
          success: false,
          error: "Mức phí phải là số trong khoảng 0–1 (ví dụ 0.3 = 30%), hoặc để trống để bỏ override.",
        });
      }

      const update = {};
      if (hasBookingRate) update["pricing.platformFeeRate"] = bookingRate;
      if (hasCourseRate) update["pricing.coursePlatformFeeRate"] = courseRate;

      const mentor = await Mentor.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
      if (!mentor) {
        return res.status(404).json({ success: false, error: "Không tìm thấy mentor." });
      }
      res.json({ success: true, mentor });
    } catch (error) {
      next(error);
    }
  },

  approveMentorPrice: async (req, res, next) => {
    try {
      const { id } = req.params;
      const mentor = await Mentor.findById(id);
      if (!mentor) return res.status(404).json({ success: false, error: "Không tìm thấy mentor." });
      if (!mentor.pendingPricePerHour) {
        return res.status(400).json({ success: false, error: "Không có yêu cầu đổi giá nào." });
      }

      mentor.pricePerHour = mentor.pendingPricePerHour;
      mentor.pendingPricePerHour = null;
      await mentor.save();

      // Send notification to the mentor
      if (mentor.userId) {
        await Notification.create({
          userId: mentor.userId,
          type: "system",
          title: "Yêu cầu đổi giá đã được duyệt",
          body: `Admin đã chấp thuận mức giá mới của bạn là ${mentor.pricePerHour} VND/giờ.`,
        });
      }

      res.json({ success: true, mentor });
    } catch (error) {
      next(error);
    }
  },

  rejectMentorPrice: async (req, res, next) => {
    try {
      const { id } = req.params;
      const mentor = await Mentor.findById(id);
      if (!mentor) return res.status(404).json({ success: false, error: "Không tìm thấy mentor." });
      if (!mentor.pendingPricePerHour) {
        return res.status(400).json({ success: false, error: "Không có yêu cầu đổi giá nào." });
      }

      mentor.pendingPricePerHour = null;
      await mentor.save();

      // Send notification to the mentor
      if (mentor.userId) {
        await Notification.create({
          userId: mentor.userId,
          type: "system",
          title: "Yêu cầu đổi giá bị từ chối",
          body: `Admin đã từ chối mức giá mới bạn đề xuất. Mức giá hiện tại vẫn được giữ nguyên.`,
        });
      }

      res.json({ success: true, mentor });
    } catch (error) {
      next(error);
    }
  },

  // ── Import người dùng + phân tích CV từ Google Form (Admin only) ────────────
  importUserAndCV: async (req, res, next) => {
    const filePath = req.file?.path ?? null;
    try {
      const { email, name, field = "IT / Công nghệ", cvUrl } = req.body ?? {};

      if (!email) {
        return res.status(400).json({
          success: false,
          error: "Cần cung cấp email.",
        });
      }

      const normalizedEmail = String(email).toLowerCase().trim();

      // ── 1. Tạo mới hoặc lấy user đã có theo email ──────────────────────────
      let user = await User.findOne({ email: normalizedEmail });
      let isNewUser = false;
      if (!user) {
        const passwordHash = await bcrypt.hash("Prointerview", 10);
        user = await User.create({
          email: normalizedEmail,
          name: String(name || normalizedEmail).trim(),
          passwordHash,
          role: "customer",
          plan: "free",
          isEmailVerified: true,
          "journeyProgress.uploadedCV": false,
          "journeyProgress.analyzedCVJD": false,
        });
        isNewUser = true;
      }

      // ── 1b. Không có CV (file hoặc link) → chỉ tạo tài khoản, bỏ qua phân tích ──
      if (!req.file && !cvUrl) {
        return res.status(201).json({
          success: true,
          isNewUser,
          userId: String(user._id),
          analysisId: null,
          matchScore: null,
          cvFileUrl: null,
          message: isNewUser
            ? `Đã tạo tài khoản mới cho ${normalizedEmail} (chưa có CV để phân tích).`
            : `Tài khoản ${normalizedEmail} đã tồn tại, không có CV để phân tích.`,
        });
      }

      // ── 2. Lấy nội dung CV: file upload trực tiếp hoặc tải từ Google Drive ──
      let fileBuffer;
      let originalFilename;
      let driveFileId = null;
      if (req.file) {
        fileBuffer = fs.readFileSync(req.file.path);
        originalFilename = req.file.originalname;
      } else {
        try {
          const drive = await downloadGoogleDriveFile(cvUrl);
          fileBuffer = drive.buffer;
          driveFileId = drive.fileId;
          originalFilename = `${String(name || normalizedEmail).trim().replace(/\s+/g, "_")}-cv.pdf`;
        } catch (driveErr) {
          return res.status(422).json({ success: false, error: driveErr.message });
        }
      }

      // ── 3. Upload CV lên Cloudinary (fallback: bỏ qua, vẫn tiếp tục phân tích) ──
      let cvFileUrl = null;
      try {
        const result = await uploadToCloudinary(fileBuffer, {
          folder: "prointerview/cv-files",
          resource_type: "raw",
        });
        if (result?.url) {
          cvFileUrl = result.url;
        }
      } catch (_uploadErr) {
        // Fallback: bỏ qua lỗi upload CDN, vẫn tiếp tục phân tích CV
      }

      // ── 4. Gọi Python FastAPI /analyze/field ───────────────────────────────
      const CV_ANALYZER_URL = process.env.CV_ANALYZER_URL || "http://localhost:8000";
      const blob = new Blob([fileBuffer], { type: "application/pdf" });
      const formData = new FormData();
      formData.append("resume", blob, originalFilename);
      formData.append("field", field);

      let raw = null;
      let pyStatus = null;
      try {
        const pyRes = await fetch(`${CV_ANALYZER_URL}/analyze/field`, { method: "POST", body: formData });
        pyStatus = pyRes.status;
        const text = await pyRes.text();
        raw = text ? JSON.parse(text) : null;
        if (!pyRes.ok) {
          const detail = raw?.detail ? (typeof raw.detail === "string" ? raw.detail : JSON.stringify(raw.detail)) : text;
          return res.status(502).json({
            success: false,
            error: `Python service trả lỗi (HTTP ${pyStatus}): ${detail || "không rõ nguyên nhân"}`,
          });
        }
      } catch (pyErr) {
        return res.status(503).json({
          success: false,
          error: `Không kết nối được service phân tích CV (Python). Kiểm tra CV_ANALYZER_URL. Chi tiết: ${pyErr.message}`,
        });
      }

      if (!raw) {
        return res.status(502).json({ success: false, error: "Python service trả về dữ liệu rỗng." });
      }

      // ── 5. Map kết quả FastAPI → cấu trúc DB ──────────────────────────────
      const m = raw.match ?? {};
      const s = raw.scores ?? {};
      const sugg = raw.suggestions ?? {};
      const matchedKws = m.matching ?? [];
      const missingKws = m.missing ?? [];
      const matchScore = Math.round(m.match_score ?? 0);

      const normScore = (v) => {
        const n = Number(v ?? 0);
        // Python trả về thang 0-10; DB lưu 0-5
        return n > 5 ? Math.round((n / 10) * 5 * 10) / 10 : n;
      };

      const rewrittenBulletsForDb = (sugg.rewritten_bullets ?? []).slice(0, 10).map((b) => ({
        original:  String(b.original  || "").slice(0, 2000),
        rewritten: String(b.rewritten || "").slice(0, 2000),
        reasoning: String(b.changes_made?.join(" · ") || ""),
      })).filter((b) => b.original && b.rewritten);

      const missingSkillSuggestionsForDb = (sugg.missing_skill_suggestions ?? []).slice(0, 10).map((item) => ({
        skill:    String(item.skill || ""),
        priority: ["high", "medium", "low"].includes(String(item.priority).toLowerCase())
          ? String(item.priority).toLowerCase()
          : "medium",
        reason:   String(item.reframe_tip || item.acquisition_path || "").slice(0, 500),
      })).filter((i) => i.skill);

      const cvAnalysisPayload = {
        userId: user._id,
        cvFileName: originalFilename,
        cvFileId: req.file?.filename || driveFileId || undefined,
        cvFileUrl: cvFileUrl || undefined,
        field: String(field).trim(),
        position: raw.position || undefined,
        mode: "field",
        tier: "suggestions",
        planAtTime: user.plan === "elite_pro" ? "enterprise" : user.plan === "starter_pro" ? "pro" : "free",
        status: "completed",
        meta: {
          llmProvider: raw.llm_provider ?? "unknown",
          pythonEndpoint: "/analyze/field",
          fallbackTriggered: Boolean(raw._fallback),
        },
        result: {
          skills: {
            cv: matchedKws.map((n) => ({ name: n })),
            jd: [...matchedKws, ...missingKws].map((n) => ({ name: n })),
            matched: matchedKws,
            missing: missingKws,
          },
          match: {
            score: matchScore,
            matchedKeywords: matchedKws,
            missingKeywords: missingKws,
          },
          scores: {
            clarity:     normScore(s.clarity?.score),
            structure:   normScore(s.structure?.score),
            relevance:   normScore(s.relevance?.score ?? (matchScore / 10)),
            credibility: normScore(s.credibility?.score),
          },
          suggestions: {
            rewrittenBullets: rewrittenBulletsForDb,
            missingSkillSuggestions: missingSkillSuggestionsForDb,
            executiveSummary: String(sugg.executive_summary || s?.summary || "").slice(0, 5000),
          },
          _ui: {
            matchScore,
            matchedKeywords: matchedKws,
            missingKeywords: missingKws,
            scores: {
              clarity:     normScore(s.clarity?.score),
              structure:   normScore(s.structure?.score),
              relevance:   normScore(s.relevance?.score ?? (matchScore / 10)),
              credibility: normScore(s.credibility?.score),
            },
            // Mảng phẳng cho UI card "Đề xuất chỉnh sửa" — khớp shape CVAnalysis.jsx build khi user tự phân tích.
            // Thiếu field này thì FE rơi về demo mẫu ("STAR + KPI") thay vì gợi ý thật (xem cvMappers.js).
            suggestions: [
              ...rewrittenBulletsForDb.map((b) => ({
                type: "fix",
                priority: "medium",
                title: `Cải thiện bullet: "${b.original.slice(0, 65)}${b.original.length > 65 ? "…" : ""}"`,
                reason: b.reasoning || "",
                before: b.original,
                after: b.rewritten,
                keywordsAdded: [],
                starCheck: {},
                confidence: "medium",
              })),
              ...missingSkillSuggestionsForDb.map((item) => ({
                type: "add",
                priority: item.priority,
                title: `Bổ sung kỹ năng "${item.skill}"`,
                reason: item.reason,
                before: "Chưa có trong CV",
                after: `Bổ sung «${item.skill}» vào mục Kỹ năng hoặc mô tả kinh nghiệm.`,
                keywordsAdded: [],
                starCheck: {},
                confidence: null,
              })),
            ],
            summary: String(sugg.executive_summary || s?.summary || "").slice(0, 5000),
            field:   String(field).trim(),
            mode:    "field",
          },
        },
      };

      // Re-import cùng email → xóa các bản phân tích "field" cũ của người này, tránh nhân bản lịch sử
      await CVAnalysis.deleteMany({ userId: user._id, mode: "field" });
      const analysis = await CVAnalysis.create(cvAnalysisPayload);

      // ── 6. Cập nhật journeyProgress ─────────────────────────────────────────
      await User.updateOne(
        { _id: user._id },
        { $set: { "journeyProgress.uploadedCV": true, "journeyProgress.analyzedCVJD": true } }
      );

      return res.status(201).json({
        success: true,
        isNewUser,
        userId: String(user._id),
        analysisId: String(analysis._id),
        matchScore,
        cvFileUrl,
        message: isNewUser
          ? `Đã tạo tài khoản mới và phân tích CV cho ${normalizedEmail}`
          : `Đã thêm phân tích CV vào tài khoản có sẵn của ${normalizedEmail}`,
      });
    } catch (error) {
      next(error);
    } finally {
      // Dọn file tạm dù thành công hay lỗi
      if (filePath) {
        try { fs.unlinkSync(filePath); } catch (_) { /* ignore */ }
      }
    }
  },

  // Lấy danh sách toàn bộ User
  getAllUsers: async (req, res, next) => {

    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 1000);
      const users = await User.find()
        .select("name email avatar role plan isActive lastSeenAt lastLoginAt createdAt")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      const rows = users.map((u) => ({
        ...u,
        isOnline: isUserOnline(u.lastSeenAt),
      }));
      res.json({ success: true, users: rows });
    } catch (error) {
      next(error);
    }
  },

  getUserById: async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, error: "userId không hợp lệ." });
      }
      const user = await User.findById(id)
        .select("-passwordHash -authSessions -integrations.googleCalendar.accessToken -integrations.googleCalendar.refreshToken")
        .lean();
      if (!user) return res.status(404).json({ success: false, error: "Không tìm thấy người dùng." });

      const [bookingsCount, enrollmentsCount] = await Promise.all([
        Booking.countDocuments({ userId: user._id }),
        Enrollment.countDocuments({ userId: user._id }),
      ]);

      res.json({
        success: true,
        user: {
          ...user,
          isOnline: isUserOnline(user.lastSeenAt),
          stats: { bookingsCount, enrollmentsCount },
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // Khóa/Mở khóa User — khóa: vô hiệu JWT + xóa refresh (tokenVersion++, authSessions [])
  toggleUserStatus: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      const shouldBeActive = isActive === true || isActive === "true";
      let user;
      if (!shouldBeActive) {
        user = await User.findByIdAndUpdate(
          id,
          { $set: { isActive: false, authSessions: [] }, $inc: { tokenVersion: 1 } },
          { new: true },
        );
      } else {
        user = await User.findByIdAndUpdate(id, { $set: { isActive: shouldBeActive } }, { new: true });
      }
      if (!user) return res.status(404).json({ success: false, error: "Không tìm thấy người dùng" });
      res.json({ success: true, user });
    } catch (error) {
      next(error);
    }
  },

  // Lấy danh sách toàn bộ Booking
  getAllBookings: async (req, res, next) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 1000);
      const bookings = await Booking.find()
        .populate("mentorId", "name email")
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .limit(limit);
      res.json({ success: true, bookings });
    } catch (error) {
      next(error);
    }
  },

  getBookingById: async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, error: "bookingId không hợp lệ." });
      }
      const booking = await Booking.findById(id)
        .populate({ path: "mentorId", select: "name email userId", populate: { path: "userId", select: "name email" } })
        .populate("userId", "name email avatar phone")
        .lean();
      if (!booking) return res.status(404).json({ success: false, error: "Không tìm thấy lịch hẹn." });
      res.json({ success: true, booking });
    } catch (error) {
      next(error);
    }
  },

  updateBookingStatus: async (req, res, next) => {
    try {
      const { id } = req.params;
      const nextStatus = String(req.body?.status || "").trim();
      const reason = String(req.body?.reason || "").trim();
      const ALLOWED = new Set(["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show"]);

      if (!ALLOWED.has(nextStatus)) {
        return res.status(400).json({ success: false, error: "Trạng thái booking không hợp lệ." });
      }

      if (nextStatus === "no_show") {
        const result = await bookingsService.processBookingNoShow(id, { note: reason }, {
          markedBy: "admin",
          actorUserId: req.userId,
        });
        if (!result.ok) {
          return res.status(result.status).json({ success: false, error: result.error });
        }
        return res.json({ success: true, booking: result.booking, refundAmountVnd: result.refundAmountVnd });
      }

      const booking = await Booking.findById(id);
      if (!booking) return res.status(404).json({ success: false, error: "Không tìm thấy lịch hẹn." });

      // Trạng thái cuối (completed/cancelled/no_show) không được chuyển tiếp qua route generic này —
      // đặc biệt completed → cancelled từng cho phép tạo booking "đã hủy" nhưng vẫn giữ paymentStatus
      // "paid" và mentor đã được cộng tiền, không có hoàn tiền nào được ghi nhận. Dùng luồng hoàn tiền
      // riêng (confirm-refund) nếu cần đảo ngược một booking đã hoàn tất/hủy.
      const TERMINAL_STATUSES = new Set(["completed", "cancelled", "no_show"]);
      if (TERMINAL_STATUSES.has(booking.status) && booking.status !== nextStatus) {
        return res.status(400).json({
          success: false,
          error: `Booking đã ở trạng thái cuối "${booking.status}", không thể đổi sang "${nextStatus}" qua thao tác này.`,
        });
      }

      const payGate = bookingsService.assertBookingPaidBeforeActiveStatus(booking, nextStatus);
      if (!payGate.ok) {
        return res.status(payGate.status).json({ success: false, error: payGate.error });
      }

      booking.status = nextStatus;

      if (nextStatus === "completed") {
        booking.completedAt = new Date();
      }
      if (nextStatus === "cancelled") {
        booking.cancelledAt = new Date();
        booking.cancelledBy = "system";
        booking.cancelReason = reason || booking.cancelReason || "Admin cập nhật trạng thái.";
      }

      await booking.save();

      if (nextStatus === "completed") {
        const credit = await tryCreditMentorForCompletedBooking(booking._id);
        if (!credit.ok) {
          console.error("[updateBookingStatus] mentor earnings:", credit.error || credit);
        }
      }

      res.json({ success: true, booking });
    } catch (error) {
      next(error);
    }
  },

  /** Xác nhận đã nhận tiền chuyển khoản (booking paymentMethod = transfer, paymentStatus = pending). */
  confirmBookingTransferPayment: async (req, res, next) => {
    try {
      const { id } = req.params;
      const force = Boolean(req.body?.force || req.body?.override);
      const forceNote = String(req.body?.forceNote || req.body?.note || "").trim();
      const result = await bookingsService.confirmBankTransferPaymentByAdmin(id, {
        force,
        forceNote,
        adminUserId: req.userId || "",
      });
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.json({ success: true, booking: result.booking });
    } catch (error) {
      next(error);
    }
  },

  /** Admin xác nhận đã CK hoàn cho HV (booking paymentStatus = refund_pending). */
  confirmBookingRefund: async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await bookingsService.confirmBankRefundByAdmin(id, {
        adminUserId: req.userId || "",
      });
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.json({ success: true, booking: result.booking });
    } catch (error) {
      next(error);
    }
  },

  getPendingEnrollmentTransfers: async (_req, res, next) => {
    try {
      const enrollments = await Enrollment.find({
        paymentMethod: "transfer",
        paymentStatus: "pending",
      })
        .populate("userId", "name email")
        .populate("courseId", "title price")
        .sort({ updatedAt: -1 })
        .limit(200)
        .lean();
      res.json({ success: true, enrollments });
    } catch (error) {
      next(error);
    }
  },

  /** Danh sách ghi danh có học phí (CK) — chờ + đã xác nhận, cho màn admin Học phí khóa học */
  getCoursePaymentEnrollments: async (_req, res, next) => {
    try {
      const enrollments = await Enrollment.find({
        pricePaid: { $gt: 0 },
        paymentMethod: "transfer",
      })
        .populate("userId", "name email")
        .populate({
          path: "courseId",
          select: "title price mentorId",
          populate: { path: "mentorId", select: "name" },
        })
        .sort({ updatedAt: -1 })
        .limit(200)
        .lean();
      res.json({ success: true, enrollments });
    } catch (error) {
      next(error);
    }
  },

  /** Tổng quan học phí khóa học (CK) cho admin Tài chính / Giao dịch */
  getCourseFinanceSummary: async (_req, res, next) => {
    try {
      const pendAgg = await Enrollment.aggregate([
        { $match: { paymentMethod: "transfer", paymentStatus: "pending", pricePaid: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: "$pricePaid" }, count: { $sum: 1 } } },
      ]);
      const paidAgg = await Enrollment.aggregate([
        { $match: { paymentStatus: "paid", pricePaid: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: "$pricePaid" }, count: { $sum: 1 } } },
      ]);

      const pendingList = await Enrollment.find({
        paymentMethod: "transfer",
        paymentStatus: "pending",
        pricePaid: { $gt: 0 },
      })
        .populate("userId", "name email")
        .populate("courseId", "title price")
        .sort({ updatedAt: -1 })
        .limit(40)
        .lean();

      const recentPaidRows = await Enrollment.find({ paymentStatus: "paid", pricePaid: { $gt: 0 } })
        .populate("userId", "name email")
        .populate("courseId", "title")
        .sort({ paidAt: -1, updatedAt: -1 })
        .limit(50)
        .lean();

      res.json({
        success: true,
        courseFinance: {
          pendingTransferCount: pendAgg[0]?.count || 0,
          pendingTransferAmount: pendAgg[0]?.total || 0,
          paidCollectedCount: paidAgg[0]?.count || 0,
          paidCollectedAmount: paidAgg[0]?.total || 0,
          pendingList,
          recentPaidRows,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /** Tổng quan doanh thu gói Pro/Elite (CK qua SePay) cho admin Tài chính */
  getSubscriptionFinanceSummary: async (_req, res, next) => {
    try {
      const pendAgg = await Payment.aggregate([
        { $match: { type: "subscription", provider: "transfer", status: "pending" } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]);
      const paidAgg = await Payment.aggregate([
        { $match: { type: "subscription", status: "success" } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]);

      const pendingList = await Payment.find({
        type: "subscription",
        provider: "transfer",
        status: "pending",
      })
        .populate("userId", "name email plan")
        .sort({ createdAt: -1 })
        .limit(40)
        .lean();

      const recentPaidRows = await Payment.find({ type: "subscription", status: "success" })
        .populate("userId", "name email plan")
        .sort({ paidAt: -1, createdAt: -1 })
        .limit(200)
        .lean();

      res.json({
        success: true,
        subscriptionFinance: {
          pendingTransferCount: pendAgg[0]?.count || 0,
          pendingTransferAmount: pendAgg[0]?.total || 0,
          paidCollectedCount: paidAgg[0]?.count || 0,
          paidCollectedAmount: paidAgg[0]?.total || 0,
          pendingList: pendingList.map(serializeSubscriptionPayment),
          recentPaidRows: recentPaidRows.map(serializeSubscriptionPayment),
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /** Tổng quan lợi nhuận nền tảng sau chia mentor (booking + khóa học + gói Pro/Elite). */
  getPlatformFinanceSummary: async (req, res, next) => {
    try {
      const monthRange = parseMonthRange(req.query?.month);
      if (String(req.query?.month || "").trim() && !monthRange) {
        return res.status(400).json({
          success: false,
          error: "month phải theo định dạng YYYY-MM (ví dụ 2026-06).",
        });
      }
      if (monthRange) {
        const currentMonthStart = new Date();
        currentMonthStart.setDate(1);
        currentMonthStart.setHours(0, 0, 0, 0);
        if (monthRange.start.getTime() > currentMonthStart.getTime()) {
          return res.status(400).json({
            success: false,
            error: "Không thể xem doanh thu tương lai.",
          });
        }
      }

      const bookingRows = await Booking.find({
        paymentStatus: { $in: ["paid", "partial_refund"] },
      })
        .select("userId price platformFee platformFeeRate totalAmount status paidAt createdAt cancelRefundAmountVnd")
        .lean();
      const bookingRowsFiltered = monthRange
        ? bookingRows.filter((row) => {
            const t = row.paidAt ? new Date(row.paidAt) : new Date(row.createdAt);
            const ms = t.getTime();
            return ms >= monthRange.start.getTime() && ms < monthRange.end.getTime();
          })
        : bookingRows;
      const booking = bookingRowsFiltered.reduce(
        (acc, row) => {
          // partial_refund: trừ phần đã hoàn cho học viên — chỉ tính phần tiền THỰC SỰ còn giữ lại
          // (nền tảng + mentor), tránh Tổng thu/Lợi nhuận/Chia mentor bị thổi phồng bằng số tiền đã hoàn.
          const rawGross = Number(row.totalAmount ?? row.price ?? 0);
          const refunded = Number(row.cancelRefundAmountVnd) || 0;
          const gross = Math.round(Math.max(0, rawGross - refunded));
          const rate = safeFeeRate(row.platformFeeRate, Number(process.env.BOOKING_PLATFORM_FEE_RATE) || 0.3);
          const rawFee = Number.isFinite(Number(row.platformFee))
            ? Math.round(Number(row.platformFee))
            : Math.round(gross * rate);
          // Kẹp fee trong [0, gross] — sau khi trừ hoàn tiền, gross có thể nhỏ hơn fee gốc; không để
          // platformRevenue vượt quá số tiền thực sự còn giữ lại (giữ đúng platformRevenue + mentorNet = gross).
          const fee = Math.max(0, Math.min(gross, rawFee));
          acc.grossCollected += gross;
          acc.platformRevenue += fee;
          acc.mentorNet += gross - fee;
          acc.count += 1;
          return acc;
        },
        { grossCollected: 0, platformRevenue: 0, mentorNet: 0, count: 0 },
      );

      const enrollmentRows = await Enrollment.find({ paymentStatus: "paid", pricePaid: { $gt: 0 } })
        .select("userId pricePaid platformFee platformFeeRate paidAt updatedAt createdAt")
        .lean();
      const enrollmentRowsFiltered = monthRange
        ? enrollmentRows.filter((row) => {
            const t = row.paidAt ? new Date(row.paidAt) : new Date(row.updatedAt || row.createdAt);
            const ms = t.getTime();
            return ms >= monthRange.start.getTime() && ms < monthRange.end.getTime();
          })
        : enrollmentRows;
      const course = enrollmentRowsFiltered.reduce(
        (acc, row) => {
          const gross = Math.round(Number(row.pricePaid || 0));
          const rate = safeFeeRate(row.platformFeeRate, Number(process.env.COURSE_PLATFORM_FEE_RATE) || 0.35);
          const fee = Number.isFinite(Number(row.platformFee))
            ? Math.round(Number(row.platformFee))
            : Math.round(gross * rate);
          acc.grossCollected += gross;
          acc.platformRevenue += Math.max(0, fee);
          acc.mentorNet += Math.max(0, gross - fee);
          acc.count += 1;
          return acc;
        },
        { grossCollected: 0, platformRevenue: 0, mentorNet: 0, count: 0 },
      );

      const subscriptionRows = await Payment.find({ type: "subscription", status: "success" })
        .select("userId amount paidAt createdAt")
        .lean();
      const subscriptionRowsFiltered = monthRange
        ? subscriptionRows.filter((row) => {
            const t = row.paidAt ? new Date(row.paidAt) : new Date(row.createdAt);
            const ms = t.getTime();
            return ms >= monthRange.start.getTime() && ms < monthRange.end.getTime();
          })
        : subscriptionRows;
      // Gói Pro/Elite không chia % mentor → toàn bộ tiền thu về là lợi nhuận nền tảng.
      const subscription = subscriptionRowsFiltered.reduce(
        (acc, row) => {
          const gross = Math.round(Number(row.amount || 0));
          acc.grossCollected += gross;
          acc.platformRevenue += gross;
          acc.mentorNet += 0;
          acc.count += 1;
          return acc;
        },
        { grossCollected: 0, platformRevenue: 0, mentorNet: 0, count: 0 },
      );

      const paidCustomerIds = new Set();
      for (const row of bookingRowsFiltered) if (row.userId) paidCustomerIds.add(String(row.userId));
      for (const row of enrollmentRowsFiltered) if (row.userId) paidCustomerIds.add(String(row.userId));
      for (const row of subscriptionRowsFiltered) if (row.userId) paidCustomerIds.add(String(row.userId));

      const totals = {
        grossCollected: booking.grossCollected + course.grossCollected + subscription.grossCollected,
        platformRevenue: booking.platformRevenue + course.platformRevenue + subscription.platformRevenue,
        mentorNet: booking.mentorNet + course.mentorNet + subscription.mentorNet,
        paidCustomerCount: paidCustomerIds.size,
      };

      res.json({
        success: true,
        platformFinance: {
          period: monthRange
            ? {
                month: monthRange.month,
                startAt: monthRange.start.toISOString(),
                endAt: monthRange.end.toISOString(),
              }
            : null,
          totals,
          booking,
          course,
          subscription,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  confirmEnrollmentTransferPayment: async (req, res, next) => {
    try {
      const { id } = req.params;
      const force = Boolean(req.body?.force || req.body?.override);
      const forceNote = String(req.body?.forceNote || req.body?.note || "").trim();
      const result = await paymentsService.confirmEnrollmentTransferByAdmin(id, {
        adminUserId: req.userId,
        force,
        forceNote,
      });
      if (!result.ok) {
        return res.status(result.status || 400).json({ success: false, error: result.error });
      }

      const credit = await tryCreditMentorForPaidEnrollment(id);
      if (!credit.ok) {
        console.error("[confirmEnrollmentTransferPayment] mentor earnings:", credit.error || credit);
      }

      const populated = await Enrollment.findById(id)
        .populate("userId", "name email")
        .populate("courseId", "title price");
      res.json({ success: true, enrollment: populated });
    } catch (error) {
      next(error);
    }
  },

  getPendingSubscriptionPayments: async (_req, res) => {
    try {
      const result = await paymentsService.listPendingSubscriptionTransfers();
      if (!result.ok) {
        return res.status(result.status || 500).json({ success: false, error: result.error });
      }
      res.json({
        success: true,
        payments: result.payments,
        stats: result.stats || { paidCount: 0, paidTotalAmount: 0 },
      });
    } catch (error) {
      next(error);
    }
  },

  confirmSubscriptionTransferPayment: async (req, res, next) => {
    try {
      const { id } = req.params;
      const force = Boolean(req.body?.force || req.body?.override);
      const forceNote = String(req.body?.forceNote || req.body?.note || "").trim();
      const result = await paymentsService.confirmSubscriptionTransferByAdmin(id, {
        adminUserId: req.userId,
        force,
        forceNote,
      });
      if (!result.ok) {
        return res.status(result.status || 400).json({ success: false, error: result.error });
      }
      res.json({ success: true, payment: result.payment });
    } catch (error) {
      next(error);
    }
  },

  normalizeTransferReferences: async (req, res, next) => {
    try {
      const dryRun = Boolean(req.body?.dryRun);
      const result = await normalizeTransferRefs({ dryRun });
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },

  getTransactionSupport: async (_req, res, next) => {
    try {
      const hello = await mongoose.connection.db.admin().command({ hello: 1 });
      const setName = String(hello?.setName || "").trim();
      const msg = String(hello?.msg || "").trim();
      const supported = Boolean(setName) || msg === "isdbgrid";
      res.json({
        success: true,
        mongo: {
          transactionSupported: supported,
          topology: msg === "isdbgrid" ? "sharded-cluster" : setName ? "replica-set" : "standalone",
          setName: setName || null,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  getContentStats: async (_req, res, next) => {
    try {
      const CVAnalysis = mongoose.model("CVAnalysis");
      const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [
        interviews,
        cvAnalyses,
        publishedCourses,
        completedInterviews,
        sessions7d,
        completed7d,
        scoreAgg7d,
        fewShotReadyCount,
      ] = await Promise.all([
        InterviewSession.countDocuments(),
        CVAnalysis.countDocuments(),
        Course.countDocuments({ status: "published" }),
        InterviewSession.countDocuments({ status: "completed" }),
        InterviewSession.countDocuments({ createdAt: { $gte: since7d } }),
        InterviewSession.countDocuments({ status: "completed", createdAt: { $gte: since7d } }),
        InterviewSession.aggregate([
          {
            $match: {
              status: "completed",
              "feedback.overallScore": { $exists: true, $gt: 0 },
              createdAt: { $gte: since7d },
            },
          },
          { $group: { _id: null, avgScore: { $avg: "$feedback.overallScore" }, count: { $sum: 1 } } },
        ]),
        InterviewSession.countDocuments({
          status: "completed",
          "feedback.overallScore": { $gte: 80 },
        }),
      ]);
      const scoreRow = scoreAgg7d[0] ?? null;
      res.json({
        success: true,
        content: {
          interviewSessions: interviews,
          completedInterviews,
          cvAnalyses,
          publishedCourses,
          interviewOps: {
            periodDays: 7,
            sessions7d,
            completed7d,
            avgScore7d: scoreRow?.avgScore != null ? Math.round(scoreRow.avgScore * 10) / 10 : null,
            scoredSessions7d: scoreRow?.count ?? 0,
            fewShotReadyCount,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/admin/content/interview-sessions — phiên gần đây + câu hỏi LLM đã lưu */
  getRecentInterviewSessions: async (req, res, next) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
      const sessions = await InterviewSession.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("userId", "name email")
        .select(
          "userId status inferredRole inferredSeniority competencyProfile questions answers questionsAllowed createdAt completedAt",
        )
        .lean();

      res.json({
        success: true,
        sessions: sessions.map((s) => {
          const questions = resolveAdminSessionQuestions(s);
          const roleParts = [
            s.inferredRole,
            s.inferredSeniority,
            s.competencyProfile?.roleCategory,
          ].filter(Boolean);
          return {
            id: String(s._id),
            user: s.userId
              ? { name: s.userId.name || "", email: s.userId.email || "" }
              : null,
            status: s.status,
            role: roleParts.length ? roleParts.join(" · ") : "—",
            questionCount: questions.length,
            questionsAllowed: s.questionsAllowed ?? null,
            questions,
            answerCount: Array.isArray(s.answers) ? s.answers.length : 0,
            createdAt: s.createdAt,
            completedAt: s.completedAt || null,
          };
        }),
      });
    } catch (error) {
      next(error);
    }
  },

  getCourseMediaOverview: async (req, res, next) => {
    try {
      const scope = String(req.query.scope || "all").toLowerCase();
      const statusFilter =
        scope === "published"
          ? { status: "published" }
          : scope === "pending"
            ? { status: { $in: ["pending_review", "pending_update"] } }
            : { status: { $in: ["published", "pending_update", "pending_review", "draft"] } };

      const courses = await Course.find(statusFilter)
        .select("title status modules thumbnail updatedAt publishedAt")
        .populate({
          path: "mentorId",
          select: "userId",
          populate: { path: "userId", select: "name email" },
        })
        .sort({ updatedAt: -1 })
        .limit(100)
        .lean();

      const items = courses.map((c) => {
        const modules = Array.isArray(c.modules) ? c.modules : [];
        const lessons = modules.flatMap((m) => (Array.isArray(m.lessons) ? m.lessons : []));
        const videoCount = lessons.filter((l) => String(l?.videoUrl || l?.contentUrl || "").trim()).length;
        return {
          _id: c._id,
          title: c.title,
          status: c.status,
          mentorName: c.mentorId?.userId?.name || "—",
          mentorEmail: c.mentorId?.userId?.email || "",
          lessonCount: lessons.length,
          videoCount,
          thumbnail: c.thumbnail || "",
          updatedAt: c.updatedAt,
          publishedAt: c.publishedAt || null,
        };
      });

      res.json({ success: true, scope, courses: items });
    } catch (error) {
      next(error);
    }
  },

  getSystemOverview: async (_req, res, next) => {
    try {
      let mongo = null;
      try {
        const hello = await mongoose.connection.db.admin().command({ hello: 1 });
        const setName = String(hello?.setName || "").trim();
        const msg = String(hello?.msg || "").trim();
        mongo = {
          transactionSupported: Boolean(setName) || msg === "isdbgrid",
          topology: msg === "isdbgrid" ? "sharded-cluster" : setName ? "replica-set" : "standalone",
          setName: setName || null,
        };
      } catch {
        mongo = { transactionSupported: false, topology: "unknown", setName: null };
      }

      res.json({
        success: true,
        overview: {
          auth: {
            accessTokenTtl: process.env.JWT_ACCESS_EXPIRES_IN || process.env.JWT_EXPIRES_IN || "15m",
            refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS) || 30,
            jtiBlacklistOnLogout: true,
            jtiBlacklistOnRefresh: true,
            sessionFingerprintEnforced: process.env.AUTH_STRICT_SESSION_FINGERPRINT === "true",
          },
          plans: [
            { key: "free", label: "Miễn phí", cvAnalysisLimit: 3, interviewLimit: 1 },
            { key: "starter_pro", label: "Pro", cvAnalysisLimit: 10, interviewLimit: 3 },
            { key: "elite_pro", label: "Elite", cvAnalysisLimit: 30, interviewLimit: 8 },
          ],
          payments: {
            primaryChannel: "bank_transfer",
            note: "Khách CK theo STK trên checkout (VITE_BANK_TRANSFER_*). Admin xác nhận qua payments ledger.",
          },
          mongo,
          services: {
            cvAnalyzer: process.env.CV_ANALYZER_URL ? "configured" : "missing CV_ANALYZER_URL",
            llm: process.env.LLM_API_KEY ? "configured" : "missing LLM_API_KEY",
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // Danh sách khóa học chờ duyệt
  getPendingCourses: async (_req, res, next) => {
    try {
      const courses = await Course.find({ status: { $in: ["pending_review", "pending_update"] } })
        .populate({
          path: "mentorId",
          select: "userId title company",
          populate: { path: "userId", select: "name email avatar" },
        })
        .sort({ updatedAt: -1 });

      const items = courses.map((c) => serializePendingCourseForAdmin(c));
      const countMap = await countPaidEnrollmentsByCourseIds(items.map((i) => i._id));
      const enriched = applyPaidEnrollmentCountsToAdminCourses(items, countMap);
      const counts = {
        total: enriched.length,
        pendingReview: enriched.filter((x) => x.status === "pending_review").length,
        pendingUpdate: enriched.filter((x) => x.status === "pending_update").length,
      };
      res.json({ success: true, courses: enriched, counts });
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/admin/courses/published — khóa đã duyệt / đang public */
  getPublishedCourses: async (req, res, next) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
      const courses = await Course.find({ status: "published" })
        .populate({
          path: "mentorId",
          select: "userId title company",
          populate: { path: "userId", select: "name email avatar" },
        })
        .sort({ publishedAt: -1, updatedAt: -1 })
        .limit(limit);

      const items = courses.map((c) => serializePendingCourseForAdmin(c));
      const countMap = await countPaidEnrollmentsByCourseIds(items.map((i) => i._id));
      res.json({
        success: true,
        courses: applyPaidEnrollmentCountsToAdminCourses(items, countMap),
      });
    } catch (error) {
      next(error);
    }
  },

  // Duyệt khóa học
  approveCourse: async (req, res, next) => {
    try {
      const { id } = req.params;
      const course = await Course.findById(id);
      if (!course) return res.status(404).json({ success: false, error: "Không tìm thấy khóa học" });
      if (course.status === "pending_update" && course.pendingUpdate) {
        const next = course.pendingUpdate;
        course.title = next.title ?? course.title;
        course.description = next.description ?? course.description;
        course.thumbnail = next.thumbnail ?? course.thumbnail;
        course.level = next.level ?? course.level;
        course.price = Number.isFinite(Number(next.price)) ? Number(next.price) : course.price;
        course.isFree = typeof next.isFree === "boolean" ? next.isFree : course.isFree;
        course.tags = Array.isArray(next.tags) ? next.tags : course.tags;
        course.topics = Array.isArray(next.topics) ? next.topics : course.topics;
        course.whatYoullLearn = Array.isArray(next.whatYoullLearn) ? next.whatYoullLearn : course.whatYoullLearn;
        course.modules = Array.isArray(next.modules) ? next.modules : course.modules;
      }
      course.pendingUpdate = null;
      course.status = "published";
      course.publishedAt = new Date();
      course.adminReview = { reason: "", reviewedAt: null, reviewedBy: null, lastAction: "" };
      await course.save();
      res.json({ success: true, course: serializePendingCourseForAdmin(course) });
    } catch (error) {
      next(error);
    }
  },

  // Từ chối khóa học: trả lại nháp để mentor sửa
  rejectCourse: async (req, res, next) => {
    try {
      const { id } = req.params;
      const reason = String(req.body?.reason || "").trim();
      if (!reason) {
        return res.status(400).json({ success: false, error: "Vui lòng nhập lý do từ chối." });
      }

      const course = await Course.findById(id).populate({
        path: "mentorId",
        select: "userId",
        populate: { path: "userId", select: "name email" },
      });
      if (!course) return res.status(404).json({ success: false, error: "Không tìm thấy khóa học" });

      const wasUpdate = course.status === "pending_update";
      if (wasUpdate) {
        course.pendingUpdate = null;
        course.status = "published";
      } else if (course.status === "pending_review") {
        course.status = "draft";
      } else {
        return res.status(400).json({
          success: false,
          error: "Chỉ từ chối được khóa đang chờ duyệt hoặc bản cập nhật chờ duyệt.",
        });
      }

      course.adminReview = {
        reason,
        reviewedAt: new Date(),
        reviewedBy: req.userId || null,
        lastAction: "reject",
      };
      await course.save();

      const mentorUserId = course.mentorId?.userId?._id || course.mentorId?.userId;
      if (mentorUserId) {
        try {
          const title = wasUpdate ? "Bản cập nhật khóa học bị từ chối" : "Khóa học bị từ chối";
          const reasonShort = reason.length > 200 ? `${reason.slice(0, 197)}…` : reason;
          const body = wasUpdate
            ? `Admin không duyệt bản cập nhật "${course.title}". Lý do: ${reasonShort}`
            : `Admin từ chối khóa "${course.title}". Lý do: ${reasonShort}. Vui lòng chỉnh sửa và gửi duyệt lại.`;
          await Notification.create({
            userId: mentorUserId,
            type: "feedback",
            title,
            body,
            metadata: {
              courseId: course._id,
              actionUrl: "/mentor/courses",
            },
          });
        } catch (notifErr) {
          console.error("[Admin] rejectCourse notification:", notifErr);
        }
      }

      res.json({ success: true, course: serializePendingCourseForAdmin(course) });
    } catch (error) {
      next(error);
    }
  },

  /** Gỡ khóa khỏi marketplace (archived). */
  archiveCourse: async (req, res, next) => {
    try {
      const { id } = req.params;
      const reason =
        String(req.body?.reason || "").trim() ||
        "Khóa học đã được gỡ khỏi marketplace bởi quản trị viên.";

      const course = await Course.findById(id).populate({
        path: "mentorId",
        select: "userId",
        populate: { path: "userId", select: "name email" },
      });
      if (!course) return res.status(404).json({ success: false, error: "Không tìm thấy khóa học" });

      if (!["published", "pending_update"].includes(course.status)) {
        return res.status(400).json({
          success: false,
          error: "Chỉ gỡ được khóa đang hiển thị trên marketplace.",
        });
      }

      course.pendingUpdate = null;
      course.status = "archived";
      course.adminReview = {
        reason,
        reviewedAt: new Date(),
        reviewedBy: req.userId || null,
        lastAction: "archive",
      };
      await course.save();

      const mentorUserId = course.mentorId?.userId?._id || course.mentorId?.userId;
      if (mentorUserId) {
        try {
          const reasonShort = reason.length > 200 ? `${reason.slice(0, 197)}…` : reason;
          await Notification.create({
            userId: mentorUserId,
            type: "system",
            title: "Khóa học đã bị gỡ khỏi marketplace",
            body: `Khóa "${course.title}" không còn hiển thị cho học viên. Lý do: ${reasonShort}`,
            metadata: {
              courseId: course._id,
              actionUrl: "/mentor/courses",
            },
          });
        } catch (notifErr) {
          console.error("[Admin] archiveCourse notification:", notifErr);
        }
      }

      res.json({ success: true, course: serializePendingCourseForAdmin(course) });
    } catch (error) {
      next(error);
    }
  },

  getReports: async (req, res, next) => {
    try {
      const { listReportsForAdmin } = await import("../services/reportsService.js");
      const result = await listReportsForAdmin(req.query ?? {});
      if (!result.ok) return res.status(result.status || 500).json({ success: false, error: result.error });
      res.json({
        success: true,
        reports: result.reports,
        counts: result.counts,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  },

  getReviews: async (req, res, next) => {
    try {
      const { listReviewsForAdmin } = await import("../services/reviewsService.js");
      const result = await listReviewsForAdmin(req.query ?? {});
      if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
      res.json({
        success: true,
        reviews: result.reviews,
        counts: result.counts,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  },

  setReviewVisibility: async (req, res, next) => {
    try {
      const { setReviewVisibilityForAdmin } = await import("../services/reviewsService.js");
      const isVisible = req.body?.isVisible !== false;
      const result = await setReviewVisibilityForAdmin(req.params.id, isVisible);
      if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
      res.json({ success: true, review: result.review });
    } catch (error) {
      next(error);
    }
  },

  updateReport: async (req, res, next) => {
    try {
      const { updateReportStatusForAdmin } = await import("../services/reportsService.js");
      const result = await updateReportStatusForAdmin(req.userId, req.params.id, req.body ?? {});
      if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
      res.json({ success: true, report: result.report });
    } catch (error) {
      next(error);
    }
  },

  // Thống kê nhanh cho Dashboard & Phân tích admin
  getStats: async (req, res, next) => {
    try {
      const [
        userCount,
        mentorCount,
        bookingCount,
        recentBookingsRaw,
        planAgg,
        enrollmentsPaid,
        publishedCourses,
        pendingCourses,
        reportsOpen,
        bookingStatusAgg,
      ] = await Promise.all([
        User.countDocuments({ role: "customer" }),
        Mentor.countDocuments(),
        Booking.countDocuments(),
        Booking.find()
          .sort({ createdAt: -1 })
          .limit(8)
          .populate({ path: "userId", select: "name email" })
          .populate({
            path: "mentorId",
            select: "title",
            populate: { path: "userId", select: "name" },
          })
          .select("date timeSlot status paymentStatus totalAmount createdAt userId mentorId")
          .lean(),
        User.aggregate([{ $group: { _id: { $ifNull: ["$plan", "free"] }, count: { $sum: 1 } } }]),
        Enrollment.countDocuments({ paymentStatus: "paid" }),
        Course.countDocuments({ status: "published" }),
        Course.countDocuments({ status: { $in: ["pending_review", "pending_update"] } }),
        Report.countDocuments({ status: { $in: ["pending", "reviewing"] } }),
        Booking.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      ]);

      res.json({
        success: true,
        stats: {
          users: userCount,
          mentors: mentorCount,
          bookings: bookingCount,
          recentBookings: recentBookingsRaw.map(serializeRecentBookingForAdmin),
          plans: planCountsFromAgg(planAgg),
          enrollmentsPaid,
          courses: { published: publishedCourses, pendingReview: pendingCourses },
          reportsOpen,
          bookingsByStatus: statusCountsFromAgg(bookingStatusAgg),
        },
      });
    } catch (error) {
      next(error);
    }
  },

  getPayoutRequests: async (_req, res, next) => {
    try {
      const payouts = await PayoutRequest.find()
        .populate({
          path: "mentorId",
          select: "name userId",
          populate: { path: "userId", select: "name email" },
        })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();
      res.json({ success: true, payouts });
    } catch (error) {
      next(error);
    }
  },

  approvePayoutRequest: async (req, res, next) => {
    try {
      const { id } = req.params;
      const payout = await PayoutRequest.findById(id);
      if (!payout) return res.status(404).json({ success: false, error: "Không tìm thấy yêu cầu rút tiền." });
      if (payout.status !== "pending") {
        return res.status(400).json({ success: false, error: "Yêu cầu đã được xử lý trước đó." });
      }

      payout.status = "approved";
      payout.reviewedAt = new Date();
      payout.reviewedBy = req.userId || null;
      payout.note = String(req.body?.note || "").trim();
      await payout.save();

      const mentorApproved = await Mentor.findById(payout.mentorId).select("userId").lean();
      if (mentorApproved?.userId) {
        await deliverNotification(mentorApproved.userId, {
          mentorPrefKey: "payout_update",
          type: "payment_success",
          title: "Yêu cầu rút tiền đã được duyệt",
          body: `Admin đã duyệt rút ${Math.round(Number(payout.amount || 0)).toLocaleString("vi-VN")}₫ — chờ chuyển khoản.`,
          metadata: { actionUrl: "/mentor/finance" },
        });
      }

      res.json({ success: true, payout });
    } catch (error) {
      next(error);
    }
  },

  /** Sau khi admin chuyển khoản thủ công cho mentor — chỉ từ trạng thái `approved`. */
  markPayoutPaid: async (req, res, next) => {
    try {
      const { id } = req.params;
      const transferRef = String(req.body?.transferRef || "").trim().slice(0, 500);
      const noteExtra = String(req.body?.note || "").trim().slice(0, 2000);

      const existing = await PayoutRequest.findById(id).select("note").lean();
      if (!existing) return res.status(404).json({ success: false, error: "Không tìm thấy yêu cầu rút tiền." });
      const prevNote = String(existing.note || "").trim();
      const nextNote = noteExtra ? (prevNote ? `${prevNote}\n${noteExtra}` : noteExtra) : existing.note;

      // Chuyển trạng thái + điều kiện lọc "approved" trong CÙNG một update nguyên tử — nếu 2 request
      // đến gần như đồng thời (double-click, 2 tab admin), chỉ đúng 1 lệnh khớp filter và được phép
      // trừ pendingBalance; lệnh còn lại nhận về null và không đụng tới số dư mentor.
      const payout = await PayoutRequest.findOneAndUpdate(
        { _id: id, status: "approved" },
        { $set: { status: "paid", paidAt: new Date(), transferRef, note: nextNote } },
        { new: true },
      );
      if (!payout) {
        return res.status(400).json({
          success: false,
          error: "Chỉ xác nhận đã chuyển khoản khi yêu cầu đã được duyệt (chưa ghi nhận chi).",
        });
      }

      await Mentor.updateOne(
        { _id: payout.mentorId },
        { $inc: { "finance.pendingBalance": -Number(payout.amount || 0) } },
      );

      const mentorPaid = await Mentor.findById(payout.mentorId).select("userId").lean();
      if (mentorPaid?.userId) {
        await deliverNotification(mentorPaid.userId, {
          mentorPrefKey: "payout_update",
          type: "payment_success",
          title: "Đã chuyển tiền rút về tài khoản",
          body: `Số tiền ${Math.round(Number(payout.amount || 0)).toLocaleString("vi-VN")}₫ đã được ghi nhận chi.`,
          metadata: { actionUrl: "/mentor/finance" },
        });
      }

      res.json({ success: true, payout });
    } catch (error) {
      next(error);
    }
  },

  rejectPayoutRequest: async (req, res, next) => {
    try {
      const { id } = req.params;
      const reason = String(req.body?.reason || "").trim();

      // Cùng lý do atomic như markPayoutPaid — tránh 2 lệnh reject đồng thời cùng hoàn lại
      // availableBalance cho mentor (cộng khống số dư có thể rút).
      const payout = await PayoutRequest.findOneAndUpdate(
        { _id: id, status: "pending" },
        { $set: { status: "rejected", reviewedAt: new Date(), reviewedBy: req.userId || null, rejectReason: reason } },
        { new: true },
      );
      if (!payout) {
        const exists = await PayoutRequest.exists({ _id: id });
        return res.status(exists ? 400 : 404).json({
          success: false,
          error: exists ? "Yêu cầu đã được xử lý trước đó." : "Không tìm thấy yêu cầu rút tiền.",
        });
      }

      await Mentor.updateOne(
        { _id: payout.mentorId },
        {
          $inc: {
            "finance.availableBalance": Number(payout.amount || 0),
            "finance.pendingBalance": -Number(payout.amount || 0),
          },
        },
      );

      res.json({ success: true, payout });
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/admin/interview-metrics — 7-day operational snapshot */
  getInterviewMetrics: async (req, res) => {
    try {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [
        sessionsByStatus,
        evalDurationStats,
        scoreStats,
        sessionsByDay,
        topRoles,
        fewShotReadyCount,
        totalAllTime,
      ] = await Promise.all([
        // Sessions by status — last 7 days
        InterviewSession.aggregate([
          { $match: { createdAt: { $gte: since } } },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),

        // Avg LLM evaluation latency (feedbackGeneratedAt − completedAt)
        InterviewSession.aggregate([
          { $match: {
            feedbackGeneratedAt: { $exists: true },
            completedAt:         { $exists: true },
            createdAt:           { $gte: since },
          }},
          { $project: {
            evalMs: { $subtract: ["$feedbackGeneratedAt", "$completedAt"] },
          }},
          { $group: {
            _id:   null,
            avgMs: { $avg: "$evalMs" },
            count: { $sum: 1 },
          }},
        ]),

        // Avg overall score for evaluated sessions
        InterviewSession.aggregate([
          { $match: {
            status: "completed",
            "feedback.overallScore": { $exists: true, $gt: 0 },
            createdAt: { $gte: since },
          }},
          { $group: {
            _id:      null,
            avgScore: { $avg: "$feedback.overallScore" },
            count:    { $sum: 1 },
          }},
        ]),

        // Daily session count — last 7 days
        InterviewSession.aggregate([
          { $match: { createdAt: { $gte: since } } },
          { $group: {
            _id:   { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          }},
          { $sort: { _id: 1 } },
        ]),

        // Top role categories in completed sessions
        InterviewSession.aggregate([
          { $match: {
            status: "completed",
            "competencyProfile.roleCategory": { $exists: true, $ne: "" },
            createdAt: { $gte: since },
          }},
          { $group: {
            _id:   "$competencyProfile.roleCategory",
            count: { $sum: 1 },
          }},
          { $sort: { count: -1 } },
          { $limit: 5 },
        ]),

        // Few-shot pool: completed sessions with high scores (eligible as training examples)
        InterviewSession.countDocuments({
          status: "completed",
          "feedback.overallScore": { $gte: 80 },
        }),

        // All-time total
        InterviewSession.countDocuments(),
      ]);

      res.json({
        success: true,
        period: "7d",
        sessionsByStatus,
        evalDuration: evalDurationStats[0] ?? { avgMs: null, count: 0 },
        scoreStats:   scoreStats[0]        ?? { avgScore: null, count: 0 },
        sessionsByDay,
        topRoles,
        fewShotReadyCount,
        totalAllTime,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getUserJourney: async (req, res, next) => {
    try {
      const { id } = req.params;
      const days = req.query.days;
      const limit = req.query.limit;
      const result = await getUserJourney(id, { days, limit });
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.json({ success: true, journey: result.journey });
    } catch (error) {
      next(error);
    }
  },

  getPlatformBehavior: async (req, res, next) => {
    try {
      const result = await getPlatformBehavior({ days: req.query.days });
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.json({ success: true, behavior: result.behavior });
    } catch (error) {
      next(error);
    }
  },
};

function summarizeModules(modules = []) {
  let lessonCount = 0;
  let videoCount = 0;
  let previewCount = 0;
  let durationMinutes = 0;
  const chapters = (Array.isArray(modules) ? modules : []).map((mod, idx) => {
    const lessons = (mod.lessons || []).map((lesson) => {
      lessonCount += 1;
      const videoUrl = String(lesson.videoUrl || lesson.contentUrl || "").trim();
      const hasVideo = Boolean(videoUrl);
      if (hasVideo) videoCount += 1;
      if (lesson.isFree) previewCount += 1;
      durationMinutes += Number(lesson.durationMinutes) || 0;
      return {
        title: lesson.title || "Bài học",
        durationMinutes: Number(lesson.durationMinutes) || 0,
        hasVideo,
        isPreview: Boolean(lesson.isFree),
        videoUrl: videoUrl ? resolveStoredUploadUrl(videoUrl) : "",
      };
    });
    return {
      title: mod.title || `Chương ${idx + 1}`,
      lessonCount: lessons.length,
      lessons,
    };
  });
  return {
    chapterCount: chapters.length,
    lessonCount,
    videoCount,
    previewCount,
    durationMinutes,
    chapters,
  };
}

function pickReviewFields(src = {}) {
  return {
    title: src.title || "",
    description: src.description || "",
    thumbnail: src.thumbnail ? resolveStoredUploadUrl(src.thumbnail) : "",
    level: src.level || "",
    price: Number(src.price) || 0,
    isFree: Boolean(src.isFree),
    topics: Array.isArray(src.topics) ? src.topics : [],
    tags: Array.isArray(src.tags) ? src.tags : [],
    whatYoullLearn: Array.isArray(src.whatYoullLearn) ? src.whatYoullLearn.filter(Boolean) : [],
  };
}

function detectPendingChanges(current, pending) {
  const changes = [];
  const pairs = [
    ["Tiêu đề", "title"],
    ["Mô tả", "description"],
    ["Cấp độ", "level"],
    ["Giá (VND)", "price", (v) => Number(v || 0).toLocaleString("vi-VN")],
  ];
  for (const [label, key, fmt] of pairs) {
    const a = current[key];
    const b = pending[key];
    const left = fmt ? fmt(a) : a;
    const right = fmt ? fmt(b) : b;
    if (b != null && String(left) !== String(right)) {
      changes.push({ label, from: left || "—", to: right || "—" });
    }
  }
  const curMod = current.modules?.length ?? 0;
  const nextMod = pending.modules?.length;
  if (Number.isFinite(nextMod) && nextMod !== curMod) {
    changes.push({ label: "Số chương", from: String(curMod), to: String(nextMod) });
  }
  const curLessons = summarizeModules(current.modules).lessonCount;
  const nextLessons = summarizeModules(pending.modules).lessonCount;
  if (pending.modules && nextLessons !== curLessons) {
    changes.push({ label: "Số bài học", from: String(curLessons), to: String(nextLessons) });
  }
  if (pending.thumbnail && pending.thumbnail !== current.thumbnail) {
    changes.push({ label: "Ảnh bìa", from: "Đã có", to: "Đã đổi" });
  }
  return changes;
}

/** Khóa học chờ admin — nội dung review + thống kê chương/bài. */
export function serializePendingCourseForAdmin(course) {
  const doc = serializeCourseForApi(course);
  const isUpdate = doc.status === "pending_update";
  const pending = doc.pendingUpdate && typeof doc.pendingUpdate === "object" ? doc.pendingUpdate : null;
  const reviewSource = isUpdate && pending ? { ...doc, ...pending } : doc;
  const content = summarizeModules(reviewSource.modules);
  const review = pickReviewFields(reviewSource);
  const mentor = doc.mentorId && typeof doc.mentorId === "object" ? doc.mentorId : null;
  const mentorUser = mentor?.userId && typeof mentor.userId === "object" ? mentor.userId : null;

  return {
    _id: doc._id,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    publishedAt: doc.publishedAt,
    mentor: mentor
      ? {
          name: mentorUser?.name || "Cố vấn",
          email: mentorUser?.email || "",
          avatar: mentorUser?.avatar ? resolveStoredUploadUrl(mentorUser.avatar) : "",
          title: mentor.title || "",
          company: mentor.company || "",
        }
      : { name: "Cố vấn", email: "", avatar: "", title: "", company: "" },
    review: {
      ...review,
      ...content,
      priceLabel: review.isFree || review.price <= 0 ? "Miễn phí" : `${review.price.toLocaleString("vi-VN")} ₫`,
    },
    pendingChanges:
      isUpdate && pending
        ? detectPendingChanges(
            { ...pickReviewFields(doc), modules: doc.modules },
            { ...pickReviewFields(pending), modules: pending.modules },
          )
        : [],
    publishedSnapshot: isUpdate ? pickReviewFields(doc) : null,
    stats: {
      enrollmentCount: Number(doc.stats?.enrollmentCount || 0),
      rating: Number(doc.stats?.rating || 0),
      reviewCount: Number(doc.stats?.reviewCount || 0),
    },
    adminReview: doc.adminReview?.reason
      ? {
          reason: doc.adminReview.reason,
          reviewedAt: doc.adminReview.reviewedAt,
          lastAction: doc.adminReview.lastAction || "",
        }
      : null,
  };
}

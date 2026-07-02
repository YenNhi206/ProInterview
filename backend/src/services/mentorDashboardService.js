import mongoose from "mongoose";
import { Mentor } from "../models/Mentor.js";
import { Booking } from "../models/Booking.js";
import { Enrollment } from "../models/Enrollment.js";
import { PayoutRequest } from "../models/PayoutRequest.js";
import { Review } from "../models/Review.js";
import { Course } from "../models/Course.js";
import { MentorPeerReview } from "../models/MentorPeerReview.js";
import { User } from "../models/User.js";
import { InterviewSession } from "../models/InterviewSession.js";
import { MentorKnowledge } from "../models/MentorKnowledge.js";
import { deliverNotification } from "./notificationDeliveryService.js";
import {
  mentorCommissionConfig,
  resolveBookingPlatformFeeRate,
  resolveCoursePlatformFeeRate,
  isEarlyMentorRateActive,
} from "./mentorCommissionService.js";

const MONGO_ERR = "MongoDB chưa kết nối. Kiểm tra MONGO_URI trong .env.";
function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

function sanitizeText(value) {
  return String(value ?? "").trim();
}

const SUPPORTED_BANKS = new Set([
  "Vietcombank",
  "BIDV",
  "VietinBank",
  "Agribank",
  "Techcombank",
  "MB Bank",
  "ACB",
  "VPBank",
  "TPBank",
  "Sacombank",
  "HDBank",
  "VIB",
  "SHB",
  "OCB",
  "Eximbank",
  "SeABank",
  "PVcomBank",
  "Nam A Bank",
]);

function normalizePayoutAccount(input) {
  const bankName = sanitizeText(input?.bankName);
  const accountNumber = sanitizeText(input?.accountNumber).replace(/\s+/g, "");
  const accountName = sanitizeText(input?.accountName);
  return { bankName, accountNumber, accountName };
}

function maskAccountNumber(value) {
  const digits = sanitizeText(value).replace(/\D/g, "");
  if (!digits) return "";
  const tail = digits.slice(-4);
  return `****${tail}`;
}

function toPayoutHistoryRow(row) {
  const raw = String(row.status || "pending");
  let status = "pending";
  let description = "Yêu cầu rút tiền đang chờ duyệt";
  if (raw === "rejected") {
    status = "failed";
    description = "Yêu cầu rút tiền bị từ chối";
  } else if (raw === "paid") {
    status = "paid";
    description = "Đã chuyển khoản rút tiền";
  } else if (raw === "approved") {
    status = "approved";
    description = "Đã duyệt — chờ chuyển khoản";
  } else if (raw === "pending") {
    status = "pending";
    description = "Yêu cầu rút tiền đang chờ duyệt";
  }
  return {
    id: String(row._id),
    type: "withdraw",
    amount: Number(row.amount || 0),
    status,
    date: row.requestedAt || row.createdAt,
    description,
    rejectReason: String(row.rejectReason || ""),
    reviewedAt: row.reviewedAt || null,
    paidAt: row.paidAt || null,
    transferRef: String(row.transferRef || ""),
    note: String(row.note || ""),
    providerRef: String(row.providerRef || ""),
  };
}

const BANK_NAME_MIN = 2;
const BANK_NAME_MAX = 80;

function isValidBankName(bankName) {
  const name = sanitizeText(bankName);
  if (!name || name.length < BANK_NAME_MIN || name.length > BANK_NAME_MAX) return false;
  if (SUPPORTED_BANKS.has(name)) return true;
  return /^[\p{L}\p{N}\s.&()-]+$/u.test(name);
}

function hasValidPayoutAccount(account) {
  const accountNumberOk = /^\d{8,19}$/.test(account.accountNumber || "");
  const accountNameOk = (account.accountName || "").length >= 2;
  const bankOk = isValidBankName(account.bankName || "");
  return Boolean(bankOk && accountNumberOk && accountNameOk);
}

async function getMentorByUserId(userId) {
  const uid = String(userId ?? "").trim();
  if (!mongoose.isValidObjectId(uid)) return null;
  return Mentor.findOne({ userId: uid }).lean();
}

function parseBookingDateTime(dateStr, timeStr = "00:00") {
  const raw = String(dateStr || "").trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    const [hour, minute] = String(timeStr || "00:00").split(":").map((p) => Number(p));
    const dt = new Date(Number(y), Number(m) - 1, Number(d), hour || 0, minute || 0, 0, 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const parts = raw.split("/").map((p) => Number(p));
  if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;
  const day = parts[0];
  const month = parts[1];
  const year = parts.length >= 3 && Number.isFinite(parts[2]) ? parts[2] : new Date().getFullYear();
  const [hour, minute] = String(timeStr || "00:00").split(":").map((p) => Number(p));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  const dt = new Date(year, month - 1, day, hour, minute, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export async function getMentorDashboard(userId) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const mentor = await getMentorByUserId(userId);
  if (!mentor?._id) return { ok: false, status: 404, error: "Không tìm thấy hồ sơ mentor." };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const total = await Booking.countDocuments({ mentorId: mentor._id });
  const completed = await Booking.countDocuments({ mentorId: mentor._id, status: "completed" });
  const sessionsThisMonth = await Booking.countDocuments({
    mentorId: mentor._id,
    createdAt: { $gte: monthStart },
    status: { $in: ["confirmed", "in_progress", "completed"] },
  });

  const upcomingRaw = await Booking.find({
    mentorId: mentor._id,
    status: { $in: ["pending", "confirmed", "in_progress"] },
  })
    .populate({ path: "userId", select: "name email avatar" })
    .sort({ date: 1, timeSlot: 1 })
    .limit(50)
    .lean();

  const { toPublicBooking } = await import("./bookingsService.js");

  const upcomingWithin7 = upcomingRaw
    .map((b) => ({ booking: b, at: parseBookingDateTime(b.date, b.timeSlot) }))
    .filter(({ at }) => at && at.getTime() > now.getTime() && at.getTime() <= sevenDaysLater.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, 10);

  const reviews = await Review.find({ targetType: "mentor", targetId: mentor._id, isVisible: { $ne: false } })
    .select("rating bookingId")
    .lean();
  const reviewCount = reviews.length;
  const avgRating = reviewCount ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviewCount : 0;

  const ratingByBookingId = {};
  for (const r of reviews) {
    if (r.bookingId) ratingByBookingId[String(r.bookingId)] = Number(r.rating || 0);
  }

  const finance = mentor.finance || {};

  return {
    ok: true,
    dashboard: {
      totalSessions: total,
      completedSessions: completed,
      sessionsThisMonth,
      upcomingWithin7Days: upcomingWithin7.length,
      reviewCount,
      avgRating: Math.round(avgRating * 10) / 10,
      finance: {
        availableBalance: Number(finance.availableBalance || 0),
        totalEarned: Number(finance.totalEarned || 0),
        pendingBalance: Number(finance.pendingBalance || 0),
      },
      ratingByBookingId,
      upcomingBookings: upcomingWithin7.map(({ booking }) => toPublicBooking(booking)),
    },
  };
}

export async function getMentorFinance(userId) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const mentor = await getMentorByUserId(userId);
  if (!mentor?._id) return { ok: false, status: 404, error: "Không tìm thấy hồ sơ mentor." };

  const completed = await Booking.find({
    mentorId: mentor._id,
    status: "completed",
    paymentStatus: "paid",
  })
    .select("price totalAmount platformFee createdAt")
    .lean();
  const bookingIncomeTotal = completed.reduce((sum, b) => {
    const gross = Math.round(Number(b.totalAmount ?? b.price ?? 0));
    const platformFee = Math.round(Number(b.platformFee || 0));
    return sum + Math.max(0, gross - platformFee);
  }, 0);
  const totalSessions = completed.length;

  const mentorCourses = await Course.find({ mentorId: mentor._id }).select("_id").lean();
  const mentorCourseIds = mentorCourses.map((c) => c._id);
  const paidEnrollments =
    mentorCourseIds.length > 0
      ? await Enrollment.find({
          courseId: { $in: mentorCourseIds },
          paymentStatus: "paid",
          pricePaid: { $gt: 0 },
        })
          .select("pricePaid platformFee platformFeeRate paidAt createdAt")
          .lean()
      : [];
  const courseIncomeTotal = paidEnrollments.reduce((sum, row) => {
    const gross = Math.round(Number(row.pricePaid || 0));
    if (gross <= 0) return sum;
    const explicitFee = Number(row.platformFee);
    if (Number.isFinite(explicitFee) && explicitFee >= 0) {
      return sum + Math.max(0, gross - Math.round(explicitFee));
    }
    const rateRaw = Number(row.platformFeeRate);
    const rate = Number.isFinite(rateRaw) && rateRaw >= 0 && rateRaw <= 1 ? rateRaw : Number(process.env.COURSE_PLATFORM_FEE_RATE) || 0.35;
    return sum + Math.max(0, gross - Math.round(gross * rate));
  }, 0);
  const computedTotalEarned = bookingIncomeTotal + courseIncomeTotal;

  const payouts = await PayoutRequest.find({ mentorId: mentor._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  const incomeRows = completed.slice(0, 50).map((b) => ({
    id: String(b._id),
    type: "income",
    amount: Math.max(0, Math.round(Number(b.totalAmount ?? b.price ?? 0)) - Math.round(Number(b.platformFee || 0))),
    status: "completed",
    date: b.createdAt,
    description: "Thu từ booking",
  }));
  const courseIncomeRows = paidEnrollments.slice(0, 50).map((row) => {
    const gross = Math.round(Number(row.pricePaid || 0));
    const explicitFee = Number(row.platformFee);
    const net = Number.isFinite(explicitFee) && explicitFee >= 0
      ? Math.max(0, gross - Math.round(explicitFee))
      : Math.max(
          0,
          gross -
            Math.round(
              gross *
                (Number.isFinite(Number(row.platformFeeRate)) ? Number(row.platformFeeRate) : Number(process.env.COURSE_PLATFORM_FEE_RATE) || 0.35),
            ),
        );
    return {
      id: `enrollment-${String(row._id)}`,
      type: "income",
      amount: net,
      status: "completed",
      date: row.paidAt || row.createdAt,
      description: "Thu từ khóa học",
    };
  });
  const payoutRows = payouts.map(toPayoutHistoryRow);
  const history = [...incomeRows, ...courseIncomeRows, ...payoutRows]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 100);
  const commissionCfg = mentorCommissionConfig();
  const bookingRateInfo = resolveBookingPlatformFeeRate(mentor);
  const courseRateInfo = resolveCoursePlatformFeeRate(mentor);
  const bookingRate = bookingRateInfo.rate;
  const courseRate = courseRateInfo.rate;
  const earlyActive = isEarlyMentorRateActive(mentor);
  const earlyExpiresAt = mentor?.pricing?.earlyMentorExpiresAt || null;
  const earlyRank = Number(mentor?.pricing?.earlyMentorRank || 0) || null;

  return {
    ok: true,
    finance: {
      availableBalance: mentor.finance?.availableBalance ?? 0,
      pendingBalance: mentor.finance?.pendingBalance ?? 0,
      totalEarned: (mentor.finance?.totalEarned > 0 ? mentor.finance.totalEarned : null) ?? computedTotalEarned,
      incomeBreakdown: {
        booking: bookingIncomeTotal,
        course: courseIncomeTotal,
      },
      payoutAccount: normalizePayoutAccount(mentor.finance?.bankAccount || {}),
      payoutAccountMasked: maskAccountNumber(mentor.finance?.bankAccount?.accountNumber || ""),
      payoutAccountOwnerName: sanitizeText(mentor.finance?.bankAccount?.accountName || mentor.name || ""),
      totalSessions,
      history,
      commissionPolicy: {
        bookingRate,
        courseRate,
        bookingRateSource: bookingRateInfo.source,
        courseRateSource: courseRateInfo.source,
        standardBookingRate: commissionCfg.bookingStandardRate,
        standardCourseRate: commissionCfg.courseStandardRate,
        earlyBookingRate: commissionCfg.bookingEarlyRate,
        earlyCourseRate: commissionCfg.courseEarlyRate,
        isEarlyMentor: Boolean(mentor?.pricing?.isEarlyMentor),
        isEarlyMentorActive: earlyActive,
        earlyMentorRank: earlyRank,
        earlyMentorExpiresAt: earlyExpiresAt,
      },
      pricePerHour: mentor.pricePerHour,
      pendingPricePerHour: mentor.pendingPricePerHour || null,
    },
  };
}

function dayRange(daysAgoStart, daysAgoEnd) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgoEnd, 23, 59, 59, 999);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgoStart, 0, 0, 0, 0);
  return { start, end };
}

function filterBookingsInRange(bookings, start, end) {
  const s = start.getTime();
  const e = end.getTime();
  return bookings.filter((b) => {
    const t = new Date(b.createdAt || 0).getTime();
    return t >= s && t <= e;
  });
}

function uniqueMenteeCount(bookings) {
  const ids = new Set();
  for (const b of bookings) {
    const uid = String(b.userId || "");
    if (mongoose.isValidObjectId(uid)) ids.add(uid);
  }
  return ids.size;
}

function countImprovingMentees(bookings, mentorReviews) {
  const menteeIds = Array.from(
    new Set(
      bookings
        .map((b) => String(b.userId || ""))
        .filter((id) => mongoose.isValidObjectId(id)),
    ),
  );
  if (!menteeIds.length) return 0;

  const reviewsByUser = new Map();
  for (const r of mentorReviews) {
    const key = String(r.userId || "");
    if (!reviewsByUser.has(key)) reviewsByUser.set(key, []);
    reviewsByUser.get(key).push(r);
  }

  let improving = 0;
  for (const uid of menteeIds) {
    const rows = bookings.filter((b) => String(b.userId) === uid);
    const done = rows.filter((r) => r.status === "completed").length;
    const cancelledCount = rows.filter((r) => r.status === "cancelled").length;
    const reviews = reviewsByUser.get(uid) || [];
    if (!reviews.length && done === 0) continue;
    if (done >= Math.max(1, cancelledCount)) improving += 1;
  }
  return improving;
}

function avgReviewScoreInRange(reviews, start, end) {
  const s = start.getTime();
  const e = end.getTime();
  const rows = reviews.filter((r) => {
    const t = new Date(r.createdAt || 0).getTime();
    return t >= s && t <= e;
  });
  if (!rows.length) return null;
  return rows.reduce((sum, r) => sum + Number(r.rating || 0), 0) / rows.length;
}

function formatSignedIntDelta(delta) {
  const n = Number(delta) || 0;
  if (n === 0) return "Không đổi";
  return n > 0 ? `+${n}` : `${n}`;
}

function formatSignedScoreDelta(delta) {
  const n = Number(Number(delta).toFixed(1));
  if (!Number.isFinite(n) || n === 0) return "Không đổi";
  return n > 0 ? `+${n.toFixed(1)}` : `${n.toFixed(1)}`;
}

function parseMentorNotesSections(notes) {
  const text = String(notes || "");
  const strengths = [];
  const weaknesses = [];
  const mStrong = text.match(/Điểm mạnh:\s*([^\n]+)/i);
  const mWeak = text.match(/Cần cải thiện:\s*([^\n]+)/i);
  if (mStrong?.[1]?.trim()) strengths.push(mStrong[1].trim());
  if (mWeak?.[1]?.trim()) weaknesses.push(mWeak[1].trim());
  return { strengths, weaknesses };
}

function scoreToFive(score100) {
  const n = Number(score100);
  if (!Number.isFinite(n)) return null;
  return Number((Math.min(100, Math.max(0, n)) / 20).toFixed(1));
}

function sessionOverallScore(session) {
  const star = extractSessionStarScores(session);
  if (!star) return null;
  const vals = [star.situation, star.task, star.action, star.result].filter((v) => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function computeMenteeProgressTrend(uid, reviews, interviewsByUser, starHistory) {
  const MS_DAY = 86400000;
  const now = Date.now();

  const reviewAvgBetween = (startMs, endMs) => {
    const inRange = reviews.filter((r) => {
      const t = new Date(r.createdAt || 0).getTime();
      return t >= startMs && t <= endMs;
    });
    if (!inRange.length) return null;
    return inRange.reduce((sum, r) => sum + Number(r.rating || 0), 0) / inRange.length;
  };

  const recentReviewAvg = reviewAvgBetween(now - 30 * MS_DAY, now);
  const priorReviewAvg = reviewAvgBetween(now - 60 * MS_DAY, now - 30 * MS_DAY);
  if (recentReviewAvg != null && priorReviewAvg != null) {
    const delta = recentReviewAvg - priorReviewAvg;
    if (delta >= 0.25) return "improving";
    if (delta <= -0.25) return "declining";
    return "stable";
  }

  if (reviews.length >= 2) {
    const sorted = [...reviews].sort(
      (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
    );
    const mid = Math.floor(sorted.length / 2);
    const first = sorted.slice(0, mid);
    const second = sorted.slice(mid);
    if (first.length && second.length) {
      const firstAvg = first.reduce((sum, r) => sum + Number(r.rating || 0), 0) / first.length;
      const secondAvg = second.reduce((sum, r) => sum + Number(r.rating || 0), 0) / second.length;
      const delta = secondAvg - firstAvg;
      if (delta >= 0.25) return "improving";
      if (delta <= -0.25) return "declining";
      return "stable";
    }
  }

  const sessions = (interviewsByUser.get(uid) || [])
    .slice()
    .sort(
      (a, b) =>
        new Date(a.completedAt || a.createdAt || 0).getTime() -
        new Date(b.completedAt || b.createdAt || 0).getTime(),
    );
  const sessionScores = sessions.map(sessionOverallScore).filter((v) => v != null);
  if (sessionScores.length >= 2) {
    const last = sessionScores[sessionScores.length - 1];
    const prev = sessionScores[sessionScores.length - 2];
    const delta = last - prev;
    if (delta >= 0.2) return "improving";
    if (delta <= -0.2) return "declining";
    return "stable";
  }

  const weekAvgs = (starHistory || [])
    .map((row) => {
      const vals = [row.situation, row.task, row.action, row.result].filter(
        (v) => v != null && Number.isFinite(Number(v)),
      );
      return vals.length ? vals.reduce((a, b) => a + Number(b), 0) / vals.length : null;
    })
    .filter((v) => v != null);
  if (weekAvgs.length >= 2) {
    const split = Math.ceil(weekAvgs.length / 2);
    const early = weekAvgs.slice(0, split);
    const late = weekAvgs.slice(split);
    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const delta = avg(late) - avg(early);
    if (delta >= 0.2) return "improving";
    if (delta <= -0.2) return "declining";
    return "stable";
  }

  return "unknown";
}

function extractSessionStarScores(session) {
  const perQ = Array.isArray(session?.feedback?.perQuestion) ? session.feedback.perQuestion : [];
  const pick = (key) => {
    const vals = perQ.map((q) => Number(q.scores?.[key])).filter((v) => Number.isFinite(v));
    if (!vals.length) return null;
    return scoreToFive(vals.reduce((a, b) => a + b, 0) / vals.length);
  };
  const situation = pick("structure");
  const task = pick("clarity");
  const action = pick("relevance");
  const result = pick("credibility");
  if ([situation, task, action, result].some((v) => v != null)) {
    return { situation, task, action, result };
  }
  const conf = Number(session?.behavioralSummary?.overallConfidenceScore);
  if (Number.isFinite(conf) && conf > 0) {
    const v = Number(Math.min(5, Math.max(0, conf)).toFixed(1));
    return { situation: v, task: v, action: v, result: v };
  }
  const overallVals = perQ.map((q) => Number(q.overall5)).filter((v) => v > 0);
  if (overallVals.length) {
    const v = Number((overallVals.reduce((a, b) => a + b, 0) / overallVals.length).toFixed(1));
    return { situation: v, task: v, action: v, result: v };
  }
  return null;
}

function buildWeeklyBehaviorStarHistory(sessions, now = new Date()) {
  return Array.from({ length: 4 }, (_, i) => {
    const weekIndex = 3 - i;
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - weekIndex * 7, 23, 59, 59, 999);
    const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6, 0, 0, 0, 0);
    const inWeek = sessions.filter((s) => {
      const t = new Date(s.completedAt || s.createdAt || 0).getTime();
      return t >= start.getTime() && t <= end.getTime();
    });
    const scores = inWeek.map(extractSessionStarScores).filter(Boolean);
    if (!scores.length) {
      return { date: `W${i + 1}`, situation: null, task: null, action: null, result: null };
    }
    const avg = (key) => {
      const vals = scores.map((s) => s[key]).filter((v) => v != null);
      return vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : null;
    };
    return {
      date: `W${i + 1}`,
      situation: avg("situation"),
      task: avg("task"),
      action: avg("action"),
      result: avg("result"),
    };
  });
}

function uniqInsightLines(items, limit = 6) {
  const seen = new Set();
  const out = [];
  for (const raw of items) {
    const t = sanitizeText(raw);
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length >= limit) break;
  }
  return out;
}

function buildMenteeBehaviorProfile(uid, bookings, mentorReviews, knowledgeByBooking, interviewsByUser, now) {
  const rows = bookings.filter((b) => String(b.userId) === uid);
  const done = rows.filter((r) => r.status === "completed").length;
  const reviews = mentorReviews.filter((r) => String(r.userId) === uid);
  const sessions = interviewsByUser.get(uid) || [];

  const strengthPool = [];
  const weaknessPool = [];
  let knowledgeCount = 0;

  for (const b of rows.filter((r) => r.status === "completed")) {
    const parsed = parseMentorNotesSections(b.mentorNotes);
    strengthPool.push(...parsed.strengths);
    weaknessPool.push(...parsed.weaknesses);
    const kn = knowledgeByBooking.get(String(b._id));
    if (kn) {
      knowledgeCount += 1;
      strengthPool.push(...(Array.isArray(kn.keyInsights) ? kn.keyInsights : []));
      weaknessPool.push(...(Array.isArray(kn.commonMistakes) ? kn.commonMistakes : []));
    }
  }

  for (const s of sessions) {
    for (const q of Array.isArray(s?.feedback?.perQuestion) ? s.feedback.perQuestion : []) {
      strengthPool.push(...(Array.isArray(q.strengths) ? q.strengths : []));
      weaknessPool.push(...(Array.isArray(q.improvements) ? q.improvements : []));
    }
  }

  for (const r of reviews) {
    for (const tag of Array.isArray(r.tags) ? r.tags : []) {
      strengthPool.push(tag);
    }
    if (Number(r.rating || 0) <= 3 && r.comment) weaknessPool.push(r.comment);
  }

  let starHistory = buildWeeklyBehaviorStarHistory(sessions, now);
  const hasBehaviorChart = starHistory.some((row) =>
    [row.situation, row.task, row.action, row.result].some((v) => v != null && Number.isFinite(Number(v))),
  );
  if (!hasBehaviorChart) {
    starHistory = buildWeeklyStarHistoryForMentee(uid, mentorReviews, now);
  }

  const strengths = uniqInsightLines(strengthPool);
  const weaknesses = uniqInsightLines(weaknessPool);
  const hasReviewHistory = reviews.length > 0;
  const hasInterviewSessions = sessions.length > 0;
  const hasBehaviorData =
    hasBehaviorChart || strengths.length > 0 || weaknesses.length > 0 || hasInterviewSessions || knowledgeCount > 0;

  return {
    strengths,
    weaknesses,
    starHistory,
    hasBehaviorData,
    hasReviewHistory,
    hasInterviewSessions,
    completedSessions: done,
  };
}

function buildWeeklyStarHistoryForMentee(userId, mentorReviews, now = new Date()) {
  return Array.from({ length: 4 }, (_, i) => {
    const weekIndex = 3 - i;
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - weekIndex * 7, 23, 59, 59, 999);
    const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6, 0, 0, 0, 0);
    const weekReviews = mentorReviews.filter((r) => {
      if (String(r.userId || "") !== userId) return false;
      const t = new Date(r.createdAt || 0).getTime();
      return t >= start.getTime() && t <= end.getTime();
    });
    const avg =
      weekReviews.length > 0
        ? weekReviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / weekReviews.length
        : null;
    const v = avg != null ? Number(avg.toFixed(1)) : null;
    return {
      date: `W${i + 1}`,
      situation: v,
      task: v,
      action: v,
      result: v,
    };
  });
}

function deriveMenteeInsights(userId, mentorReviews, completedSessions = 0) {
  const userReviews = mentorReviews.filter((r) => String(r.userId || "") === userId);
  if (!userReviews.length) {
    if (completedSessions > 0) {
      return {
        strengths: [`Đã hoàn thành ${completedSessions} buổi mentor`],
        weaknesses: [
          "Học viên chưa gửi đánh giá sao — biểu đồ tiến trình sẽ hiện sau khi có review",
        ],
      };
    }
    return { strengths: [], weaknesses: [] };
  }
  const tagSet = new Set();
  for (const r of userReviews) {
    for (const tag of Array.isArray(r.tags) ? r.tags : []) {
      const t = sanitizeText(tag);
      if (t) tagSet.add(t);
    }
  }
  const strengths = [...tagSet].slice(0, 4);
  const weaknesses = userReviews
    .filter((r) => Number(r.rating || 0) <= 3)
    .flatMap((r) => (Array.isArray(r.tags) ? r.tags : []))
    .map((t) => sanitizeText(t))
    .filter(Boolean)
    .filter((t, idx, arr) => arr.indexOf(t) === idx)
    .slice(0, 4);

  if (!strengths.length && userReviews.some((r) => Number(r.rating || 0) >= 4)) {
    strengths.push("Được học viên đánh giá tích cực");
  }
  if (!weaknesses.length && userReviews.some((r) => Number(r.rating || 0) <= 3)) {
    weaknesses.push("Cần cải thiện theo phản hồi gần đây");
  }

  return { strengths, weaknesses };
}

const RADAR_SUBJECTS = ["Tình huống", "Nhiệm vụ", "Hành động", "Kết quả", "Phản hồi"];

function buildMentorRadarAnalytics(interviewRows, mentorReviews) {
  const starRows = interviewRows.map(extractSessionStarScores).filter(Boolean);
  const reviewAvg =
    mentorReviews.length > 0
      ? Number(
          (
            mentorReviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / mentorReviews.length
          ).toFixed(1),
        )
      : null;

  const avgDim = (key) => {
    const vals = starRows.map((s) => s[key]).filter((v) => v != null && Number.isFinite(Number(v)));
    return vals.length ? Number((vals.reduce((a, b) => a + Number(b), 0) / vals.length).toFixed(1)) : null;
  };

  if (starRows.length > 0) {
    const situation = avgDim("situation") ?? 0;
    const task = avgDim("task") ?? 0;
    const action = avgDim("action") ?? 0;
    const result = avgDim("result") ?? 0;
    const dims = [situation, task, action, result].filter((v) => v > 0);
    const feedback =
      reviewAvg != null
        ? reviewAvg
        : dims.length
          ? Number((dims.reduce((a, b) => a + b, 0) / dims.length).toFixed(1))
          : 0;
    const radarSkills = [
      { subject: "Tình huống", value: situation, fullMark: 5 },
      { subject: "Nhiệm vụ", value: task, fullMark: 5 },
      { subject: "Hành động", value: action, fullMark: 5 },
      { subject: "Kết quả", value: result, fullMark: 5 },
      { subject: "Phản hồi", value: feedback, fullMark: 5 },
    ];
    const valuesForAvg = [situation, task, action, result, feedback].filter((v) => v > 0);
    const overallAvgRating =
      valuesForAvg.length > 0
        ? Number((valuesForAvg.reduce((a, b) => a + b, 0) / valuesForAvg.length).toFixed(1))
        : null;
    return { radarSkills, overallAvgRating, radarScoreSource: "interview" };
  }

  if (reviewAvg != null) {
    const radarSkills = RADAR_SUBJECTS.map((subject) => ({
      subject,
      value: reviewAvg,
      fullMark: 5,
    }));
    return { radarSkills, overallAvgRating: reviewAvg, radarScoreSource: "review" };
  }

  return { radarSkills: [], overallAvgRating: null, radarScoreSource: null };
}

export async function getMentorAnalytics(userId) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const mentor = await getMentorByUserId(userId);
  if (!mentor?._id) return { ok: false, status: 404, error: "Không tìm thấy hồ sơ mentor." };

  const bookings = await Booking.find({ mentorId: mentor._id })
    .select("userId status createdAt completedAt mentorNotes")
    .lean();
  const mentorReviews = await Review.find({ targetType: "mentor", targetId: mentor._id, isVisible: { $ne: false } })
    .select("userId rating createdAt tags bookingId")
    .lean();

  const total = bookings.length;
  const completed = bookings.filter((r) => r.status === "completed").length;
  const cancelled = bookings.filter((r) => r.status === "cancelled").length;

  const menteeIds = Array.from(
    new Set(bookings.map((b) => String(b.userId || "")).filter((id) => mongoose.isValidObjectId(id))),
  );
  const mentees = await User.find({ _id: { $in: menteeIds } })
    .select("name avatar desiredPosition currentCompany")
    .lean();
  const menteeMap = new Map(mentees.map((m) => [String(m._id), m]));

  const reviewsByUser = new Map();
  for (const r of mentorReviews) {
    const key = String(r.userId || "");
    if (!reviewsByUser.has(key)) reviewsByUser.set(key, []);
    reviewsByUser.get(key).push(r);
  }

  const now = new Date();

  const mentorBookingIds = bookings.map((b) => b._id);
  const knowledgeRows =
    mentorBookingIds.length > 0
      ? await MentorKnowledge.find({ bookingId: { $in: mentorBookingIds } }).lean()
      : [];
  const knowledgeByBooking = new Map(knowledgeRows.map((k) => [String(k.bookingId), k]));

  const interviewRows =
    menteeIds.length > 0
      ? await InterviewSession.find({
          userId: { $in: menteeIds },
          status: "completed",
        })
          .select("userId createdAt completedAt feedback behavioralSummary")
          .lean()
      : [];
  const interviewsByUser = new Map();
  for (const s of interviewRows) {
    const key = String(s.userId);
    if (!interviewsByUser.has(key)) interviewsByUser.set(key, []);
    interviewsByUser.get(key).push(s);
  }

  const menteeAnalytics = menteeIds.map((uid) => {
    const rows = bookings.filter((b) => String(b.userId) === uid);
    const reviews = reviewsByUser.get(uid) || [];
    const avgStar = reviews.length
      ? reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / reviews.length
      : null;
    const interviewScores = (interviewsByUser.get(uid) || [])
      .map(sessionOverallScore)
      .filter((v) => v != null);
    const avgInterview =
      interviewScores.length > 0
        ? Number(
            (interviewScores.reduce((sum, v) => sum + v, 0) / interviewScores.length).toFixed(1),
          )
        : null;
    const u = menteeMap.get(uid) || {};
    const behavior = buildMenteeBehaviorProfile(
      uid,
      bookings,
      mentorReviews,
      knowledgeByBooking,
      interviewsByUser,
      now,
    );
    return {
      menteeId: uid,
      menteeName: u.name || "Mentee",
      menteeAvatar: u.avatar || "",
      totalSessions: rows.length,
      completedSessions: behavior.completedSessions,
      hasReviewHistory: behavior.hasReviewHistory,
      hasBehaviorData: behavior.hasBehaviorData,
      hasInterviewSessions: behavior.hasInterviewSessions,
      avgStarScore: avgStar != null ? Number(avgStar.toFixed(1)) : null,
      avgInterviewScore: avgInterview,
      scoreSource:
        avgStar != null ? "review" : avgInterview != null ? "interview" : null,
      progressTrend: computeMenteeProgressTrend(
        uid,
        reviews,
        interviewsByUser,
        behavior.starHistory,
      ),
      lastSessionDate: rows
        .map((r) => r.completedAt || r.createdAt)
        .filter(Boolean)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || new Date(),
      strengths: behavior.strengths,
      weaknesses: behavior.weaknesses,
      starHistory: behavior.starHistory,
    };
  });

  const weeklyStats = Array.from({ length: 6 }, (_, i) => {
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7);
    const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6);
    const weekRows = bookings.filter((b) => {
      const t = new Date(b.createdAt).getTime();
      return t >= start.getTime() && t <= end.getTime();
    });
    const weekReviews = mentorReviews.filter((r) => {
      const t = new Date(r.createdAt).getTime();
      return t >= start.getTime() && t <= end.getTime();
    });
    const avg =
      weekReviews.length > 0
        ? weekReviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / weekReviews.length
        : 0;
    return {
      week: `${start.getDate()}/${start.getMonth() + 1}`,
      totalMeetings: weekRows.length,
      avgStarScore: Number(avg.toFixed(2)),
    };
  }).reverse();

  const menteeScores = menteeAnalytics
    .map((m) => m.avgStarScore)
    .filter((v) => v != null && Number.isFinite(v));
  const topAvg = menteeScores.length ? Math.max(...menteeScores) : 0;

  const { radarSkills, overallAvgRating, radarScoreSource } = buildMentorRadarAnalytics(
    interviewRows,
    mentorReviews,
  );

  const weekCurrent = dayRange(6, 0);
  const weekPrevious = dayRange(13, 7);
  const monthCurrent = dayRange(29, 0);
  const monthPrevious = dayRange(59, 30);

  const sessionsCurrent7 = filterBookingsInRange(bookings, weekCurrent.start, weekCurrent.end).length;
  const sessionsPrevious7 = filterBookingsInRange(bookings, weekPrevious.start, weekPrevious.end).length;
  const sessionsDelta7d = sessionsCurrent7 - sessionsPrevious7;

  const menteesCurrent30 = uniqueMenteeCount(
    filterBookingsInRange(bookings, monthCurrent.start, monthCurrent.end),
  );
  const menteesPrevious30 = uniqueMenteeCount(
    filterBookingsInRange(bookings, monthPrevious.start, monthPrevious.end),
  );
  const menteesDelta30d = menteesCurrent30 - menteesPrevious30;

  const improvingCurrent30 = countImprovingMentees(
    filterBookingsInRange(bookings, monthCurrent.start, monthCurrent.end),
    mentorReviews,
  );
  const improvingPrevious30 = countImprovingMentees(
    filterBookingsInRange(bookings, monthPrevious.start, monthPrevious.end),
    mentorReviews,
  );
  const improvingDelta30d = improvingCurrent30 - improvingPrevious30;

  const avgCurrent30 = avgReviewScoreInRange(mentorReviews, monthCurrent.start, monthCurrent.end);
  const avgPrevious30 = avgReviewScoreInRange(mentorReviews, monthPrevious.start, monthPrevious.end);
  const scoreDelta30d =
    avgCurrent30 != null && avgPrevious30 != null ? Number((avgCurrent30 - avgPrevious30).toFixed(1)) : 0;

  return {
    ok: true,
    analytics: {
      total,
      completed,
      cancelled,
      stats: {
        totalSessions: total,
        totalMentees: menteeAnalytics.length,
        improvingCount: menteeAnalytics.filter((m) => m.progressTrend === "improving").length,
        topAvgScore: Number(topAvg.toFixed(1)),
        overallAvgRating,
        radarSkills,
        radarScoreSource,
        trends: {
          sessionsDelta7d,
          sessionsTrendLabel: formatSignedIntDelta(sessionsDelta7d),
          menteesDelta30d,
          menteesTrendLabel: formatSignedIntDelta(menteesDelta30d),
          improvingDelta30d,
          improvingTrendLabel: formatSignedIntDelta(improvingDelta30d),
          scoreDelta30d,
          scoreTrendLabel:
            mentorReviews.length > 0 ? formatSignedScoreDelta(scoreDelta30d) : null,
          scoreScaleLabel: "/ 5.0",
        },
      },
      weeklyStats,
      mentees: menteeAnalytics.sort((a, b) => Number(b.avgStarScore) - Number(a.avgStarScore)),
    },
  };
}

export async function requestPayout(userId, body) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const mentor = await getMentorByUserId(userId);
  if (!mentor?._id) return { ok: false, status: 404, error: "Không tìm thấy hồ sơ mentor." };
  const amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, status: 400, error: "amount không hợp lệ." };
  if (amount < 100000) return { ok: false, status: 400, error: "Số tiền rút tối thiểu là 100.000đ." };
  const roundedAmount = Math.round(amount);
  const availableBalance = Number(mentor.finance?.availableBalance || 0);
  if (roundedAmount > availableBalance) {
    return { ok: false, status: 400, error: "Số dư khả dụng không đủ để rút." };
  }

  const payoutAccount = normalizePayoutAccount(mentor.finance?.bankAccount || {});
  if (!hasValidPayoutAccount(payoutAccount)) {
    return { ok: false, status: 400, error: "Vui lòng cập nhật tài khoản nhận tiền trước khi rút." };
  }

  // Atomic check-and-decrement: nếu balance thay đổi giữa hai request đồng thời, chỉ một request thành công
  const updated = await Mentor.findOneAndUpdate(
    { _id: mentor._id, "finance.availableBalance": { $gte: roundedAmount } },
    { $inc: { "finance.availableBalance": -roundedAmount, "finance.pendingBalance": roundedAmount } },
    { new: true },
  );
  if (!updated) {
    return { ok: false, status: 400, error: "Số dư khả dụng không đủ để rút." };
  }

  const payout = await PayoutRequest.create({
    mentorId: mentor._id,
    amount: roundedAmount,
    status: "pending",
    payoutAccount,
    requestedAt: new Date(),
  });

  await deliverNotification(userId, {
    mentorPrefKey: "payout_update",
    type: "system",
    title: "Đã gửi yêu cầu rút tiền",
    body: `Yêu cầu ${roundedAmount.toLocaleString("vi-VN")}₫ đang chờ admin duyệt.`,
    metadata: { actionUrl: "/mentor/finance" },
  });

  return {
    ok: true,
    payout: {
      id: String(payout._id),
      amount: roundedAmount,
      status: payout.status,
      payoutAccountMasked: maskAccountNumber(payoutAccount.accountNumber),
      bankName: payoutAccount.bankName,
      accountName: payoutAccount.accountName,
    },
  };
}

export async function updatePayoutAccount(userId, body) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const mentor = await getMentorByUserId(userId);
  if (!mentor?._id) return { ok: false, status: 404, error: "Không tìm thấy hồ sơ mentor." };

  const payoutAccount = normalizePayoutAccount({
    ...(body || {}),
    accountName: sanitizeText(mentor.name || ""),
  });
  if (!hasValidPayoutAccount(payoutAccount)) {
    return {
      ok: false,
      status: 400,
      error: "Thông tin tài khoản chưa hợp lệ. Tên ngân hàng 2–80 ký tự và số tài khoản 8–19 chữ số.",
    };
  }

  await Mentor.updateOne(
    { _id: mentor._id },
    {
      $set: {
        "finance.bankAccount.bankName": payoutAccount.bankName,
        "finance.bankAccount.accountNumber": payoutAccount.accountNumber,
        "finance.bankAccount.accountName": payoutAccount.accountName,
      },
    },
  );

  return {
    ok: true,
    payoutAccountMasked: maskAccountNumber(payoutAccount.accountNumber),
    payoutAccountBankName: payoutAccount.bankName,
    payoutAccountOwnerName: payoutAccount.accountName,
  };
}

export async function getMentorPayoutHistory(userId) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const mentor = await getMentorByUserId(userId);
  if (!mentor?._id) return { ok: false, status: 404, error: "Không tìm thấy hồ sơ mentor." };

  const rows = await PayoutRequest.find({ mentorId: mentor._id }).sort({ createdAt: -1 }).limit(100).lean();
  return {
    ok: true,
    items: rows.map((row) => ({
      id: String(row._id),
      amount: Number(row.amount || 0),
      status: row.status,
      requestedAt: row.requestedAt || row.createdAt,
      reviewedAt: row.reviewedAt || null,
      paidAt: row.paidAt || null,
      transferRef: String(row.transferRef || ""),
      rejectReason: row.rejectReason || "",
      note: String(row.note || ""),
      payoutAccountMasked: maskAccountNumber(row.payoutAccount?.accountNumber || ""),
      bankName: row.payoutAccount?.bankName || "",
      accountName: row.payoutAccount?.accountName || "",
      provider: row.provider || "manual",
      providerRef: row.providerRef || "",
    })),
  };
}

export async function getMentorPeerReviewQueue(userId) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const mentor = await getMentorByUserId(userId);
  if (!mentor?._id) return { ok: false, status: 404, error: "Không tìm thấy hồ sơ mentor." };

  const courses = await Course.find({
    mentorId: { $ne: mentor._id },
    status: { $in: ["published", "pending_update"] },
  })
    .populate({ path: "mentorId", select: "name" })
    .sort({ updatedAt: -1 })
    .lean();

  const courseIds = courses.map((c) => c._id);
  const peerReviews = await MentorPeerReview.find({
    reviewerId: mentor._id,
    courseId: { $in: courseIds },
  })
    .select("courseId contentRating qualityRating priceValueRating")
    .lean();
  const reviewMap = new Map(peerReviews.map((r) => [String(r.courseId), r]));

  const rows = courses.map((course) => {
    const review = reviewMap.get(String(course._id));
    const avg =
      review
        ? ((Number(review.contentRating || 0) + Number(review.qualityRating || 0) + Number(review.priceValueRating || 0)) / 3)
        : 0;
    return {
      id: String(course._id),
      title: course.title || "Khóa học",
      mentor: course.mentorId?.name || "Mentor",
      category: course.topics?.[0] || "Other",
      description: course.description || "",
      level: course.level || "",
      price: Number(course.price || 0),
      isFree: Boolean(course.isFree),
      lessonCount: Array.isArray(course.modules)
        ? course.modules.reduce((sum, mod) => sum + (Array.isArray(mod?.lessons) ? mod.lessons.length : 0), 0)
        : 0,
      status: review ? "reviewed" : "pending",
      rating: review ? Math.round(avg * 10) / 10 : 0,
      participants: Number(course.stats?.enrollmentCount || 0),
      cover: course.thumbnail || "",
    };
  });

  return { ok: true, items: rows };
}

export async function submitMentorPeerReview(userId, courseId, body) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const mentor = await getMentorByUserId(userId);
  if (!mentor?._id) return { ok: false, status: 404, error: "Không tìm thấy hồ sơ mentor." };
  if (!mongoose.isValidObjectId(courseId)) return { ok: false, status: 400, error: "courseId không hợp lệ." };

  const course = await Course.findById(courseId).select("_id mentorId status").lean();
  if (!course?._id) return { ok: false, status: 404, error: "Không tìm thấy khóa học." };
  if (String(course.mentorId) === String(mentor._id)) {
    return { ok: false, status: 400, error: "Bạn không thể tự đánh giá khóa học của chính mình." };
  }
  if (!["published", "pending_update"].includes(String(course.status || ""))) {
    return { ok: false, status: 400, error: "Khóa học hiện không ở trạng thái có thể đánh giá." };
  }

  const contentRating = Number(body?.contentRating);
  const qualityRating = Number(body?.qualityRating);
  const priceValueRating = Number(body?.priceValueRating);
  const feedback = String(body?.feedback || "").trim();
  const validRating = (n) => Number.isFinite(n) && n >= 1 && n <= 5;
  if (!validRating(contentRating) || !validRating(qualityRating) || !validRating(priceValueRating)) {
    return { ok: false, status: 400, error: "Điểm đánh giá phải trong khoảng 1-5." };
  }

  const review = await MentorPeerReview.findOneAndUpdate(
    { reviewerId: mentor._id, courseId: course._id },
    {
      $set: {
        contentRating,
        qualityRating,
        priceValueRating,
        feedback,
        isCompleted: true,
        isVisibleToOwner: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  // Đánh giá chéo mentor KHÔNG ảnh hưởng course.stats.rating công khai (xem
  // recalcCourseReviewStats trong reviewsService.js) — chỉ hiển thị riêng qua
  // GET /api/courses/:id/peer-reviews, nên không cần recalc ở đây.

  const avg = (contentRating + qualityRating + priceValueRating) / 3;
  return {
    ok: true,
    review: {
      id: String(review._id),
      courseId: String(course._id),
      rating: Math.round(avg * 10) / 10,
      contentRating,
      qualityRating,
      priceValueRating,
      feedback,
    },
  };
}

export async function getMentorReviews(userId) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  const mentor = await getMentorByUserId(userId);
  if (!mentor?._id) return { ok: false, status: 404, error: "Không tìm thấy hồ sơ mentor." };

  const reviews = await Review.find({
    targetType: "mentor",
    targetId: mentor._id,
    isVisible: { $ne: false },
  })
    .sort({ createdAt: -1 })
    .lean();

  const reviewerIds = Array.from(
    new Set(reviews.map((r) => String(r.userId || "")).filter((id) => mongoose.isValidObjectId(id))),
  );
  const users = await User.find({ _id: { $in: reviewerIds } })
    .select("name avatar desiredPosition currentCompany")
    .lean();
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const items = reviews.map((r) => {
    const u = userMap.get(String(r.userId)) || {};
    return {
      id: String(r._id),
      mentee: {
        name: u.name || u.email || "Thành viên",
        avatar: u.avatar || "",
      },
      position: u.desiredPosition || "",
      company: u.currentCompany || "",
      rating: Number(r.rating || 0),
      comment: r.comment || "",
      wouldRecommend: Number(r.rating || 0) >= 4,
      reviewDate: r.createdAt,
      reply: r.reply?.content ? { content: r.reply.content, repliedAt: r.reply.repliedAt } : null,
    };
  });

  const stats = mentor.stats || {};
  return {
    ok: true,
    items,
    summary: {
      avgRating: Number(stats.rating ?? 0),
      reviewCount: Number(stats.reviewCount ?? items.length),
    },
  };
}


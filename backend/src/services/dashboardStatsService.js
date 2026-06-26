import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Booking } from "../models/Booking.js";
import { CVAnalysis } from "../models/CVAnalysis.js";
import { InterviewSession } from "../models/InterviewSession.js";
import { Enrollment } from "../models/Enrollment.js";
import { Activity } from "../models/Activity.js";
import { computeLearningStreak, toVnDayKey } from "../utils/learningStreak.js";
import { enforceExpiry } from "../utils/planGuard.js";

const MONGO_ERR = "MongoDB chưa kết nối. Kiểm tra MONGO_URI trong .env.";

function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

export async function getDashboardStats(userId) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  if (!mongoose.isValidObjectId(userId)) return { ok: false, status: 401, error: "Phiên không hợp lệ." };

  const uid = new mongoose.Types.ObjectId(userId);

  let user = await User.findById(uid).select("plan planExpiresAt quota name");
  if (user) user = await enforceExpiry(user);

  const [cvCount, interviewCompleted, completedSessions, bookingsTotal, bookingsUpcoming] = await Promise.all([
    CVAnalysis.countDocuments({ userId: uid }),
    InterviewSession.countDocuments({ userId: uid, status: "completed" }),
    InterviewSession.find({ userId: uid, status: "completed" })
      .select("feedback.overallScore")
      .lean()
      .limit(200),
    Booking.countDocuments({ userId: uid }),
    Booking.countDocuments({
      userId: uid,
      status: { $in: ["pending", "confirmed", "in_progress", "rescheduled"] },
    }),
  ]);

  if (!user) return { ok: false, status: 404, error: "Không tìm thấy user." };

  let avgInterviewScore = 0;
  if (completedSessions.length) {
    const scores = completedSessions
      .map((s) => Number(s.feedback?.overallScore))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (scores.length) avgInterviewScore = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  }

  const bestCv = await CVAnalysis.findOne({ userId: uid, "result.matchScore": { $exists: true } })
    .sort({ "result.matchScore": -1 })
    .select("result.matchScore")
    .lean();
  const bestMatchScore = bestCv?.result?.matchScore != null ? Number(bestCv.result.matchScore) : 0;

  const activeDayKeys = await collectLearningActiveDays(uid);
  const streak = computeLearningStreak(activeDayKeys);

  return {
    ok: true,
    stats: {
      plan: user.plan,
      planExpiresAt: user.planExpiresAt,
      quota: user.quota ?? {},
      cvAnalysesCount: cvCount,
      interviewSessionsCompleted: interviewCompleted,
      interviewAverageScore: avgInterviewScore,
      cvBestMatchScore: bestMatchScore,
      mentorBookingsTotal: bookingsTotal,
      mentorBookingsActive: bookingsUpcoming,
      learningStreakDays: streak.days,
      learningStreakNextMilestone: streak.nextMilestone,
      learningStreakDaysUntilNext: streak.daysUntilNextMilestone,
      learningStreakProgressPercent: streak.progressPercent,
    },
  };
}

async function collectLearningActiveDays(userId) {
  const keys = new Set();
  const add = (d) => {
    if (!d) return;
    const t = new Date(d);
    if (Number.isFinite(t.getTime())) keys.add(toVnDayKey(t));
  };

  const [sessions, analyses, enrollments, activities] = await Promise.all([
    InterviewSession.find({ userId, status: "completed" })
      .select("completedAt updatedAt")
      .lean()
      .limit(400),
    CVAnalysis.find({ userId }).select("createdAt").lean().limit(400),
    Enrollment.find({ userId, lastAccessedAt: { $ne: null } })
      .select("lastAccessedAt")
      .lean()
      .limit(200),
    Activity.find({ userId }).select("createdAt").lean().limit(400),
  ]);

  for (const s of sessions) add(s.completedAt || s.updatedAt);
  for (const c of analyses) add(c.createdAt);
  for (const e of enrollments) add(e.lastAccessedAt);
  for (const a of activities) add(a.createdAt);

  return keys;
}

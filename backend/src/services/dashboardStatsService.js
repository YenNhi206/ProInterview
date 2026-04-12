import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Booking } from "../models/Booking.js";
import { CVAnalysis } from "../models/CVAnalysis.js";
import { InterviewSession } from "../models/InterviewSession.js";

const MONGO_ERR = "MongoDB chưa kết nối. Kiểm tra MONGO_URI trong .env.";

function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

export async function getDashboardStats(userId) {
  if (!isMongoReady()) return { ok: false, status: 503, error: MONGO_ERR };
  if (!mongoose.isValidObjectId(userId)) return { ok: false, status: 401, error: "Phiên không hợp lệ." };

  const uid = new mongoose.Types.ObjectId(userId);

  const [user, cvCount, interviewCompleted, completedSessions, bookingsTotal, bookingsUpcoming] = await Promise.all([
    User.findById(uid).select("plan planExpiresAt quota name").lean(),
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
    },
  };
}

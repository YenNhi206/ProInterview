/**
 * N-07 (AIS-07, C-09): buổi phỏng vấn AI `in_progress` tạo quá 24 giờ → `abandoned`.
 *
 * - Chạy trong nhịp 20 phút của `jobs/bookingStaleSweepJob.js` (cùng cách JB-02 đóng job quá hạn).
 * - Cập nhật có điều kiện theo `status: "in_progress"`: chạy lại không đổi gì, buổi vừa `completed` không bị ghi đè.
 * - Không hoàn lượt `interviewUsed` (lượt đã trừ khi tạo buổi).
 * - Buổi `abandoned` bị loại khỏi thống kê (`EXCLUDE_ABANDONED_SESSIONS`) và hồ sơ năng lực (chỉ đọc `completed`).
 */
import { InterviewSession, INTERVIEW_ABANDON_AFTER_MS } from "../models/InterviewSession.js";

/** @returns {Promise<{ abandoned: number }>} */
export async function markAbandonedInterviewSessions(now = new Date()) {
  const cutoff = new Date(now.getTime() - INTERVIEW_ABANDON_AFTER_MS);
  const res = await InterviewSession.updateMany(
    { status: "in_progress", createdAt: { $lte: cutoff } },
    { $set: { status: "abandoned", abandonedAt: now } },
  );
  return { abandoned: res.modifiedCount || 0 };
}

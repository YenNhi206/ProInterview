import { User } from "../models/User.js";
import { InterviewSession } from "../models/InterviewSession.js";
import { Booking } from "../models/Booking.js";
import { interviewEvidenceFilter } from "./competencyEvidence.js";

const SHRM_CORE_FRAMEWORK = [
  {
    competencyId: "shrm_star_method",
    name: "Phương pháp STAR (Tình huống - Nhiệm vụ - Hành động - Kết quả)",
    category: "Cấu trúc phản xạ hành vi (Behavioral)",
  },
  {
    competencyId: "shrm_clarity_comm",
    name: "Giao tiếp rõ ràng & Mạch lạc (Clarity & Communication)",
    category: "Năng lực giao tiếp chuyên nghiệp",
  },
  {
    competencyId: "shrm_problem_solving",
    name: "Tư duy giải quyết vấn đề (Problem Solving & Critical Thinking)",
    category: "Năng lực tư duy & logic",
  },
  {
    competencyId: "shrm_credibility",
    name: "Độ xác thực & Dẫn chứng kinh nghiệm (Credibility & Evidence)",
    category: "Năng lực thực chiến (Technical & Experience)",
  },
  {
    competencyId: "ddi_confidence_delivery",
    name: "Thần thái & Phong thái phỏng vấn (Confidence & Executive Presence)",
    category: "Phong thái & Tâm lý phỏng vấn (DDI Framework)",
  },
];

/**
 * API cũ /api/users/me/verified-competencies (chờ gỡ theo đề xuất (k) trong TASKS.md).
 * Chỉ đọc: không dùng và không ghi `User.verifiedCompetencies`, vì dữ liệu đã lưu không tin được.
 * `competencies` để rỗng: feedback chưa có điểm theo 5 năng lực này, không suy từ điểm tổng.
 */
export async function getVerifiedCompetencyProfile(userId) {
  if (!(await User.exists({ _id: userId }))) return { ok: false, status: 404, error: "Người dùng không tồn tại." };

  const [sessions, mentorSessionsCount] = await Promise.all([
    InterviewSession.find(interviewEvidenceFilter(userId))
      .sort({ createdAt: -1 })
      .limit(20)
      .select("feedback.overallScore createdAt")
      .lean(),
    Booking.countDocuments({ userId, status: "completed" }),
  ]);

  const verified = sessions.length > 0;
  const score = verified
    ? Math.round(sessions.reduce((sum, s) => sum + s.feedback.overallScore, 0) / sessions.length)
    : 0;

  return {
    ok: true,
    profile: {
      isCompetencyVerified: verified,
      verifiedReadinessScore: score,
      verifiedProfileSummary: verified
        ? `Điểm trung bình ${score}/100 từ ${sessions.length} buổi phỏng vấn AI đã chấm.`
        : "Chưa có buổi phỏng vấn AI được chấm đầy đủ để xác thực năng lực.",
      lastVerifiedAt: sessions[0]?.createdAt ?? null,
      competencies: [],
      sessionsCount: sessions.length,
      mentorSessionsCount,
      standards: SHRM_CORE_FRAMEWORK,
    },
  };
}

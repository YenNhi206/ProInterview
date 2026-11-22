import { CandidateProfile } from "../models/CandidateProfile.js";
import { CVDocument } from "../models/CVDocument.js";
import { User } from "../models/User.js";
import { InterviewSession } from "../models/InterviewSession.js";
import { interviewEvidenceFilter } from "./competencyEvidence.js";
import { httpError } from "../utils/apiErrors.js";

const DEFAULT_COMPETENCY_KEYS = [
  { key: "technical_mastery", name: "Chuyên môn kỹ thuật (Technical Mastery)", category: "Kỹ năng chuyên môn" },
  { key: "problem_solving", name: "Giải quyết vấn đề (Problem Solving)", category: "Năng lực tư duy" },
  { key: "communication", name: "Giao tiếp & Truyền đạt (Communication)", category: "Kỹ năng mềm" },
  { key: "teamwork", name: "Làm việc nhóm (Teamwork & Collaboration)", category: "Kỹ năng phối hợp" },
  { key: "leadership", name: "Khả năng dẫn dắt (Leadership)", category: "Năng lực lãnh đạo" },
  { key: "adaptability", name: "Thích ứng & Học hỏi (Adaptability & Learning)", category: "Phát triển bản thân" },
];

/**
 * PR-01: Lấy CandidateProfile của user.
 * Tự động tạo hồ sơ mặc định nếu user lần đầu truy cập.
 */
export async function getOrCreateCandidateProfile(userId) {
  if (!userId) throw httpError(401, "Yêu cầu đăng nhập.");

  let profile = await CandidateProfile.findOne({ userId }).populate("defaultCvId");

  if (!profile) {
    const user = await User.findById(userId).lean();
    if (!user) throw httpError(404, "Người dùng không tồn tại.");

    // Kiểm tra xem user đã có CV nào trong CVDocument chưa
    const defaultCv = await CVDocument.findOne({ userId, isDefault: true }).lean();

    const targetRole = user.desiredPosition || user.position || user.field || (Array.isArray(user.expertise) ? user.expertise[0] : "") || (Array.isArray(user.skills) ? user.skills[0] : "") || "";
    const targetRoles = targetRole ? [targetRole] : (Array.isArray(user.skills) && user.skills.length > 0 ? user.skills : (Array.isArray(user.expertise) ? user.expertise : []));

    // Khởi tạo các competency khung cơ sở
    const initialCompetencies = DEFAULT_COMPETENCY_KEYS.map((k) => ({
      key: k.key,
      name: k.name,
      category: k.category,
      level: 1,
      score: 0,
      evidenceCount: 0,
      sources: [],
    }));

    profile = await CandidateProfile.create({
      userId,
      headline: user.headline || (targetRole ? `${targetRole} | Sẵn sàng cho cơ hội mới` : ""),
      targetRole,
      targetRoles,
      summary: user.bio || "",
      defaultCvId: defaultCv?._id || null,
      competencies: initialCompetencies,
    });

    if (defaultCv) {
      profile.defaultCvId = defaultCv;
    }
  }

  return profile;
}

/**
 * PR-01: Cập nhật CandidateProfile (headline, vị trí mục tiêu, CV mặc định,...)
 */
export async function updateCandidateProfile(userId, updateData) {
  if (!userId) throw httpError(401, "Yêu cầu đăng nhập.");

  let profile = await CandidateProfile.findOne({ userId });
  if (!profile) {
    profile = await getOrCreateCandidateProfile(userId);
  }

  const { headline, targetRole, targetRoles, summary, yearsOfExperience, defaultCvId } = updateData;

  if (headline !== undefined) profile.headline = String(headline).trim().slice(0, 200);
  if (targetRole !== undefined) profile.targetRole = String(targetRole).trim().slice(0, 120);
  if (Array.isArray(targetRoles)) profile.targetRoles = targetRoles.map((r) => String(r).trim()).filter(Boolean);
  if (summary !== undefined) profile.summary = String(summary).trim().slice(0, 3000);
  if (yearsOfExperience !== undefined) profile.yearsOfExperience = Math.max(0, Number(yearsOfExperience) || 0);

  if (defaultCvId !== undefined) {
    if (defaultCvId === null || defaultCvId === "") {
      profile.defaultCvId = null;
    } else {
      const cv = await CVDocument.findOne({ _id: defaultCvId, userId });
      if (!cv) {
        throw httpError(404, "CV mặc định không tồn tại hoặc không thuộc sở hữu của bạn.");
      }
      profile.defaultCvId = cv._id;

      // Đồng bộ isDefault qua CVDocument
      await CVDocument.updateMany({ userId }, { $set: { isDefault: false } });
      cv.isDefault = true;
      await cv.save();
    }
  }

  await profile.save();
  await profile.populate("defaultCvId");
  return profile;
}

/**
 * Năng lực luôn tính lại từ bằng chứng của chính user, chỉ đọc.
 * KHÔNG đọc `profile.competencies` / `isVerified` đã lưu: dữ liệu cũ có booking của user khác và điểm giả.
 */
async function computeVerifiedState(userId) {
  const sessions = await InterviewSession.find(interviewEvidenceFilter(userId))
    .sort({ createdAt: -1 })
    .limit(20)
    .select("feedback.overallScore competencyProfile.roleCategory createdAt")
    .lean();

  const sources = sessions.map((s) => ({
    type: "ai_interview",
    refId: s._id,
    title: `Phỏng vấn AI: ${s.competencyProfile?.roleCategory || "Kỹ thuật"} (${s.feedback.overallScore}/100)`,
    score: s.feedback.overallScore,
    at: s.createdAt,
  }));
  const average = sources.length ? Math.round(sources.reduce((sum, x) => sum + x.score, 0) / sources.length) : 0;

  const competencies = DEFAULT_COMPETENCY_KEYS.map((def) => {
    // Gộp tạm điểm tổng vào một key cho tới khi PR-06 gộp theo competencyId từng câu.
    const own = def.key === "technical_mastery" ? sources : [];
    const score = own.length ? average : 0;
    return {
      ...def,
      level: Math.min(5, Math.max(1, Math.round(score / 20))),
      score,
      evidenceCount: own.length,
      sources: own,
    };
  });

  return { competencies, isVerified: sources.length > 0, verifiedAt: sources[0]?.at ?? null };
}

/** Hồ sơ trả cho client: các field xác thực được tính lại, không lấy từ DB. */
export async function presentCandidateProfile(profile) {
  return { ...profile.toJSON(), ...(await computeVerifiedState(profile.userId)) };
}

/**
 * PR-07: Lấy hồ sơ năng lực đã gộp (competencies) và DTO cho Application snapshot
 */
export async function getProfileCompetencies(userId) {
  const profile = await presentCandidateProfile(await getOrCreateCandidateProfile(userId));
  return {
    competencies: profile.competencies,
    snapshot: toApplicationCompetencySnapshot(profile),
  };
}

/**
 * PR-07: DTO rút gọn dùng cho Application snapshot (Giai đoạn 4: JB-08)
 */
export function toApplicationCompetencySnapshot(profile) {
  if (!profile) return null;
  return {
    headline: profile.headline || "",
    targetRole: profile.targetRole || "",
    yearsOfExperience: profile.yearsOfExperience || 0,
    isVerified: Boolean(profile.isVerified),
    competencies: (profile.competencies || []).map((c) => ({
      key: c.key,
      name: c.name,
      level: c.level,
      score: c.score,
      evidenceCount: c.evidenceCount,
      sourcesCount: (c.sources || []).length,
    })),
    capturedAt: new Date(),
  };
}


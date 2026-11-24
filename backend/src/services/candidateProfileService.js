import { CandidateProfile } from "../models/CandidateProfile.js";
import { CVDocument } from "../models/CVDocument.js";
import { User } from "../models/User.js";
import { COMPETENCY_PROFILE_VERSION, recomputeCompetencyProfile } from "./competencyProfileService.js";
import { httpError } from "../utils/apiErrors.js";

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


    profile = await CandidateProfile.create({
      userId,
      headline: user.headline || (targetRole ? `${targetRole} | Sẵn sàng cho cơ hội mới` : ""),
      targetRole,
      targetRoles,
      summary: user.bio || "",
      defaultCvId: defaultCv?._id || null,
      // PR-06: không tạo sẵn năng lực khung; chỉ năng lực có nguồn thật mới xuất hiện (competencyProfileService).
      competencies: [],
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
 * PR-07 / PR-06: hồ sơ năng lực đã gộp và DTO cho Application snapshot.
 * Hồ sơ gộp bằng cách cũ (hoặc chưa gộp) thì gộp lại một lần theo `competencyProfileService` rồi trả về;
 * các lần sau đọc bản đã lưu (cập nhật theo sự kiện).
 */
export async function getProfileCompetencies(userId) {
  const profile = await getOrCreateCandidateProfile(userId);
  if (profile.competenciesVersion !== COMPETENCY_PROFILE_VERSION) {
    profile.competencies = await recomputeCompetencyProfile(userId);
    profile.isVerified = profile.competencies.some((c) => c.evidenceCount > 0);
  }
  const competencies = (profile.competencies ?? []).map((c) => (c.toObject ? c.toObject() : c));
  return { competencies, snapshot: toApplicationCompetencySnapshot({ ...(profile.toObject?.() ?? profile), competencies }) };
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


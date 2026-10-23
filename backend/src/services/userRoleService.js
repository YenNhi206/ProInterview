import { User, toPublicUser } from "../models/User.js";
import { Mentor } from "../models/Mentor.js";
import { activateMentorCommissionPolicy } from "./mentorCommissionService.js";

/**
 * Role admin được phép gán cho user khác. Cố ý KHÔNG có `admin` — nâng quyền quản trị
 * phải làm thủ công ở DB, tránh một admin bị chiếm tài khoản tự nhân bản quyền.
 */
export const ASSIGNABLE_ROLES = ["customer", "mentor", "moderator", "enterprise"];

/**
 * Admin đặt role cho user khác (không đụng tài khoản admin).
 * Bỏ qua mã mời mentor — dùng khi vận hành / duyệt tay.
 */
export async function setRoleByAdmin(adminId, targetUserId, newRole) {
  const r = typeof newRole === "string" ? newRole.trim().toLowerCase() : "";
  if (!ASSIGNABLE_ROLES.includes(r)) {
    return {
      ok: false,
      status: 400,
      error: `Chỉ được đặt role ${ASSIGNABLE_ROLES.map((x) => `\`${x}\``).join(", ")} (không đổi admin qua API này).`,
    };
  }

  if (String(adminId) === String(targetUserId)) {
    return {
      ok: false,
      status: 403,
      error: "Không đổi role chính mình qua endpoint quản trị này.",
    };
  }

  const target = await User.findById(targetUserId);
  if (!target) {
    return { ok: false, status: 404, error: "Không tìm thấy người dùng." };
  }
  if (target.role === "admin") {
    return {
      ok: false,
      status: 403,
      error: "Không thay đổi role tài khoản quản trị qua API này.",
    };
  }

  const previousRole = target.role;
  target.role = r;
  await target.save();

  // Rời khỏi role mentor sang BẤT KỲ role nào khác → ngừng nhận booking.
  if (r !== "mentor" && previousRole === "mentor") {
    await Mentor.updateMany(
      { userId: target._id },
      { $set: { isActive: false, available: false } },
    ).catch(() => {});
  }
  if (r === "mentor" && previousRole !== "mentor") {
    await Mentor.updateMany(
      { userId: target._id },
      {
        $set: {
          isActive: true,
          available: true,
          isVerified: true,
          verifiedAt: new Date(),
          "adminReview.status": "approved",
          "adminReview.reason": "",
          "adminReview.reviewedAt": new Date(),
        },
      },
    ).catch(() => {});
    let mentorDoc = await Mentor.findOne({ userId: target._id }).select("_id").lean();
    if (!mentorDoc?._id) {
      // post-save hook may have failed; create mentor profile directly as fallback
      try {
        const { createMentorProfileForUser } = await import("./mentorProfileService.js");
        const created = await createMentorProfileForUser(target);
        if (created?._id) {
          await Mentor.updateOne(
            { _id: created._id },
            {
              $set: {
                isActive: true,
                available: true,
                isVerified: true,
                verifiedAt: new Date(),
                "adminReview.status": "approved",
                "adminReview.reason": "",
                "adminReview.reviewedAt": new Date(),
              },
            },
          ).catch(() => {});
          mentorDoc = { _id: created._id };
        }
      } catch {}
    }
    if (mentorDoc?._id) {
      await activateMentorCommissionPolicy(mentorDoc._id).catch(() => {});
    }
  }

  return { ok: true, user: toPublicUser(target) };
}

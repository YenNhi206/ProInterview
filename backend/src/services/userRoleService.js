import { User, toPublicUser } from "../models/User.js";
import { Mentor } from "../models/Mentor.js";

/**
 * Admin đặt role `customer` | `mentor` cho user khác (không đụng tài khoản admin).
 * Bỏ qua mã mời mentor — dùng khi vận hành / duyệt tay.
 */
export async function setRoleByAdmin(adminId, targetUserId, newRole) {
  const r = typeof newRole === "string" ? newRole.trim().toLowerCase() : "";
  if (r !== "customer" && r !== "mentor") {
    return {
      ok: false,
      status: 400,
      error: "Chỉ được đặt role `customer` hoặc `mentor` (không đổi admin qua API này).",
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

  if (r === "customer" && previousRole === "mentor") {
    await Mentor.updateMany(
      { userId: target._id },
      { $set: { isActive: false, available: false } },
    ).catch(() => {});
  }
  if (r === "mentor" && previousRole === "customer") {
    await Mentor.updateMany(
      { userId: target._id },
      { $set: { isActive: true, available: true } },
    ).catch(() => {});
  }

  return { ok: true, user: toPublicUser(target) };
}

import mongoose from "mongoose";
import { User, toPublicUser } from "../models/User.js";

/**
 * Lưu lựa chọn camera của user. Đồng ý → ghi acceptedAt + version; từ chối → xoá (acceptedAt null),
 * phỏng vấn vẫn chạy nhưng tắt camera và bỏ qua phân tích khuôn mặt.
 */
export async function setCameraConsent(userId, { accepted, version }) {
  if (!mongoose.isValidObjectId(userId)) return { ok: false, status: 401, error: "Phiên không hợp lệ." };
  const camera = accepted ? { acceptedAt: new Date(), version } : { acceptedAt: null, version: null };
  const user = await User.findByIdAndUpdate(userId, { $set: { "consent.camera": camera } }, { new: true });
  if (!user) return { ok: false, status: 404, error: "Người dùng không tồn tại." };
  return { ok: true, user: toPublicUser(user) };
}

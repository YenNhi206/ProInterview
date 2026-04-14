import crypto from "crypto";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { User, toPublicUser } from "../models/User.js";

const SALT_ROUNDS = 10;
const MIN_PASSWORD = 6;
const MAX_AUTH_SESSIONS = 10;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

function accessExpiresIn() {
  return process.env.JWT_ACCESS_EXPIRES_IN || process.env.JWT_EXPIRES_IN || "15m";
}

function hashRefreshSecret(secret) {
  const pepper = process.env.REFRESH_TOKEN_PEPPER || process.env.JWT_SECRET || "dev";
  return crypto.createHmac("sha256", pepper).update(secret).digest("hex");
}

function safeEqualStrings(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

function clientMeta(req) {
  if (!req) return { userAgent: "", ip: "" };
  const ua = req.headers["user-agent"];
  return {
    userAgent: typeof ua === "string" ? ua.slice(0, 400) : "",
    ip: req.ip || req.socket?.remoteAddress || "",
  };
}

function trimAuthSessions(user) {
  const arr = user.authSessions;
  if (!Array.isArray(arr) || arr.length < MAX_AUTH_SESSIONS) return;
  while (arr.length >= MAX_AUTH_SESSIONS) {
    let oldest = 0;
    let t = arr[0]?.createdAt?.getTime?.() ?? 0;
    for (let i = 1; i < arr.length; i++) {
      const ct = arr[i]?.createdAt?.getTime?.() ?? 0;
      if (ct < t) {
        t = ct;
        oldest = i;
      }
    }
    arr.splice(oldest, 1);
  }
}

/**
 * Thêm một refresh session; giả sử `user` là Mongoose document có `authSessions` đã select.
 * Trả về chuỗi `sessionId:secret` gửi cho client (chỉ lần đầu).
 */
export function pushNewSession(user, req) {
  trimAuthSessions(user);
  if (!Array.isArray(user.authSessions)) user.authSessions = [];
  const secret = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashRefreshSecret(secret);
  const days = Number(process.env.REFRESH_TOKEN_DAYS) || 30;
  const expiresAt = new Date(Date.now() + days * 864e5);
  const meta = clientMeta(req);
  user.authSessions.push({
    tokenHash,
    expiresAt,
    createdAt: new Date(),
    lastUsedAt: new Date(),
    ...meta,
  });
  const last = user.authSessions[user.authSessions.length - 1];
  return { refreshToken: `${last._id.toString()}:${secret}` };
}

export function issueAccessToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret || !String(secret).trim()) {
    return {
      ok: false,
      status: 503,
      error:
        "Server chưa cấu hình JWT_SECRET trong backend .env. Thêm biến này, lưu file và khởi động lại backend.",
    };
  }
  const expiresIn = accessExpiresIn();
  const tv = Number(user.tokenVersion) || 0;
  const token = jwt.sign({ sub: user._id.toString(), tv }, secret, { expiresIn });
  return { ok: true, token, user: toPublicUser(user) };
}

function accessExpiresInSeconds(token) {
  const decoded = jwt.decode(token);
  if (!decoded?.exp) return 900;
  return Math.max(1, decoded.exp - Math.floor(Date.now() / 1000));
}

/** Đăng xuất: tăng tokenVersion + xóa mọi refresh session. */
export async function logoutUser(userId) {
  const uid = String(userId ?? "").trim();
  if (!mongoose.isValidObjectId(uid)) {
    return { ok: false, status: 401, error: "Phiên đăng nhập không hợp lệ." };
  }
  const r = await User.findByIdAndUpdate(
    uid,
    { $inc: { tokenVersion: 1 }, $set: { authSessions: [] } },
    { new: false },
  );
  if (!r) return { ok: false, status: 404, error: "Tài khoản không tồn tại." };
  return { ok: true };
}

export async function refreshAccessToken(rawRefresh, req) {
  const raw = typeof rawRefresh === "string" ? rawRefresh.trim() : "";
  const idx = raw.indexOf(":");
  if (idx <= 0) {
    return { ok: false, status: 400, error: "Thiếu refresh token." };
  }
  const sidStr = raw.slice(0, idx);
  const secret = raw.slice(idx + 1);
  if (!mongoose.isValidObjectId(sidStr) || !secret) {
    return { ok: false, status: 401, error: "Refresh token không hợp lệ." };
  }
  const sid = new mongoose.Types.ObjectId(sidStr);
  const user = await User.findOne({ "authSessions._id": sid }).select("+authSessions");
  if (!user) {
    return { ok: false, status: 401, error: "Phiên không còn hợp lệ. Đăng nhập lại." };
  }
  const sub = user.authSessions?.find((s) => s._id.equals(sid));
  if (!sub) {
    return { ok: false, status: 401, error: "Phiên không còn hợp lệ. Đăng nhập lại." };
  }
  if (sub.expiresAt && sub.expiresAt.getTime() < Date.now()) {
    user.authSessions = user.authSessions.filter((s) => !s._id.equals(sid));
    await user.save();
    return { ok: false, status: 401, error: "Phiên đã hết hạn. Đăng nhập lại." };
  }
  if (!safeEqualStrings(sub.tokenHash, hashRefreshSecret(secret))) {
    return { ok: false, status: 401, error: "Refresh token không hợp lệ." };
  }

  user.authSessions = user.authSessions.filter((s) => !s._id.equals(sid));
  const { refreshToken } = pushNewSession(user, req);
  await user.save();

  const access = issueAccessToken(user);
  if (!access.ok) return access;
  return {
    ok: true,
    token: access.token,
    refreshToken,
    expiresIn: accessExpiresInSeconds(access.token),
    user: access.user,
  };
}

export async function listAuthSessions(userId) {
  const uid = String(userId ?? "").trim();
  if (!mongoose.isValidObjectId(uid)) {
    return { ok: false, status: 401, error: "Phiên không hợp lệ." };
  }
  const u = await User.findById(uid).select("+authSessions").lean();
  if (!u) return { ok: false, status: 401, error: "Tài khoản không tồn tại." };
  const sessions = (u.authSessions || []).map((s) => ({
    id: s._id.toString(),
    createdAt: s.createdAt,
    lastUsedAt: s.lastUsedAt,
    expiresAt: s.expiresAt,
    userAgent: s.userAgent || "",
    ip: s.ip || "",
  }));
  return { ok: true, sessions };
}

export async function revokeAuthSession(userId, sessionIdStr) {
  const uid = String(userId ?? "").trim();
  if (!mongoose.isValidObjectId(uid) || !mongoose.isValidObjectId(sessionIdStr)) {
    return { ok: false, status: 400, error: "Tham số không hợp lệ." };
  }
  const r = await User.findOneAndUpdate(
    { _id: uid, "authSessions._id": sessionIdStr },
    { $pull: { authSessions: { _id: sessionIdStr } } },
    { new: true },
  );
  if (!r) return { ok: false, status: 404, error: "Không tìm thấy phiên." };
  return { ok: true };
}

export async function registerUser(body) {
  const { name, email, password, role, adminInviteCode } = body ?? {};
  const trimmedName = typeof name === "string" ? name.trim() : "";
  const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!trimmedName || !trimmedEmail || !password) {
    return { ok: false, status: 400, error: "Vui lòng nhập đủ họ tên, email và mật khẩu." };
  }

  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    return {
      ok: false,
      status: 400,
      error: `Mật khẩu cần ít nhất ${MIN_PASSWORD} ký tự.`,
    };
  }

  const adminSecret = typeof process.env.ADMIN_INVITE_CODE === "string" ? process.env.ADMIN_INVITE_CODE.trim() : "";
  const invite =
    typeof adminInviteCode === "string" ? adminInviteCode.trim() : "";

  let userRole = "customer";
  if (role === "mentor") {
    return {
      ok: false,
      status: 403,
      error: "Không đăng ký trực tiếp với vai trò mentor. Đăng ký tài khoản thường; quản trị viên sẽ cấp quyền mentor (PATCH /api/users/:id/role).",
    };
  }
  if (role === "admin") {
    if (!adminSecret) {
      return {
        ok: false,
        status: 503,
        error: "Đăng ký admin chưa bật trên server (thiếu ADMIN_INVITE_CODE trong .env).",
      };
    }
    if (invite !== adminSecret) {
      return { ok: false, status: 403, error: "Mã mời quản trị không đúng." };
    }
    userRole = "admin";
  }

  const exists = await User.findOne({ email: trimmedEmail }).lean();
  if (exists) {
    return { ok: false, status: 409, error: "Email này đã được đăng ký. Vui lòng đăng nhập." };
  }

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await User.create({
      email: trimmedEmail,
      passwordHash,
      name: trimmedName,
      role: userRole,
    });
    return { ok: true };
  } catch (err) {
    if (err.code === 11000) {
      return { ok: false, status: 409, error: "Email này đã được đăng ký. Vui lòng đăng nhập." };
    }
    throw err;
  }
}

export async function loginUser(body, req) {
  const { email, password } = body ?? {};
  const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const plain =
    typeof password === "string" ? password.trim() : String(password ?? "").trim();

  if (!trimmedEmail || !plain) {
    return { ok: false, status: 400, error: "Vui lòng nhập email và mật khẩu." };
  }

  const user = await User.findOne({ email: trimmedEmail }).select(
    "+passwordHash +googleSub +authSessions",
  );
  if (!user) {
    return { ok: false, status: 401, error: "Email hoặc mật khẩu không đúng." };
  }

  if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
    return {
      ok: false,
      status: 429,
      error: "Tài khoản tạm khóa do đăng nhập sai nhiều lần. Thử lại sau ít phút.",
    };
  }

  if (!user.passwordHash) {
    return {
      ok: false,
      status: 401,
      error:
        "Tài khoản chưa có mật khẩu đăng nhập. Hãy đăng nhập Google hoặc đặt mật khẩu trong Cài đặt → Bảo mật.",
    };
  }

  const passwordOk = await bcrypt.compare(plain, user.passwordHash);
  if (!passwordOk) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= MAX_FAILED_LOGINS) {
      user.lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
    }
    await user.save();
    return { ok: false, status: 401, error: "Email hoặc mật khẩu không đúng." };
  }

  if (user.isActive === false) {
    return { ok: false, status: 403, error: "Tài khoản đã bị khóa. Liên hệ quản trị viên." };
  }

  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  user.lastLoginAt = new Date();
  const { refreshToken } = pushNewSession(user, req);
  await user.save();

  const access = issueAccessToken(user);
  if (!access.ok) return access;
  return {
    ok: true,
    token: access.token,
    refreshToken,
    expiresIn: accessExpiresInSeconds(access.token),
    user: access.user,
  };
}

export async function loginWithGoogle(body, req) {
  const audience = process.env.GOOGLE_CLIENT_ID;
  if (!audience || !String(audience).trim()) {
    return {
      ok: false,
      status: 503,
      error:
        "Đăng nhập Google chưa được bật trên server. Vui lòng dùng email và mật khẩu, hoặc cấu hình GOOGLE_CLIENT_ID.",
    };
  }

  const { credential } = body ?? {};
  if (!credential || typeof credential !== "string") {
    return { ok: false, status: 400, error: "Thiếu thông tin xác thực từ Google." };
  }

  const oAuth = new OAuth2Client(audience);
  let payload;
  try {
    const ticket = await oAuth.verifyIdToken({
      idToken: credential,
      audience,
    });
    payload = ticket.getPayload();
  } catch {
    return {
      ok: false,
      status: 401,
      error: "Không xác thực được Google. Thử lại hoặc đăng nhập bằng mật khẩu.",
    };
  }

  if (!payload) {
    return { ok: false, status: 401, error: "Token Google không hợp lệ." };
  }

  const sub = payload.sub;
  const email = (payload.email || "").toLowerCase().trim();
  const name =
    (typeof payload.name === "string" && payload.name.trim()) ||
    email.split("@")[0] ||
    "Người dùng";

  if (!email) {
    return {
      ok: false,
      status: 400,
      error:
        "Tài khoản Google không có email công khai. Chọn tài khoản khác hoặc đăng ký bằng email.",
    };
  }

  let user = await User.findOne({
    $or: [{ googleId: sub }, { googleSub: sub }],
  }).select("+googleSub +authSessions");

  if (!user) {
    const byEmail = await User.findOne({ email }).select("+googleSub +authSessions");
    if (byEmail) {
      const linked = byEmail.googleId || byEmail.googleSub;
      if (linked && linked !== sub) {
        return {
          ok: false,
          status: 409,
          error: "Email này đã liên kết với tài khoản Google khác.",
        };
      }
      const pic = typeof payload.picture === "string" ? payload.picture : undefined;
      await User.findByIdAndUpdate(byEmail._id, {
        $set: {
          googleId: sub,
          ...(pic && !byEmail.avatar ? { avatar: pic } : {}),
        },
        $unset: { googleSub: 1 },
      });
      user = await User.findById(byEmail._id).select("+googleSub +authSessions");
    }
  }

  if (!user) {
    const passwordHash = await bcrypt.hash(crypto.randomBytes(48).toString("hex"), SALT_ROUNDS);
    user = await User.create({
      email,
      passwordHash,
      name,
      role: "customer",
      googleId: sub,
      avatar: typeof payload.picture === "string" ? payload.picture : undefined,
    });
    user = await User.findById(user._id).select("+googleSub +authSessions");
  }

  if (user.isActive === false) {
    return { ok: false, status: 403, error: "Tài khoản đã bị khóa. Liên hệ quản trị viên." };
  }

  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  user.lastLoginAt = new Date();
  const { refreshToken } = pushNewSession(user, req);
  await user.save();

  const access = issueAccessToken(user);
  if (!access.ok) return access;
  return {
    ok: true,
    token: access.token,
    refreshToken,
    expiresIn: accessExpiresInSeconds(access.token),
    user: access.user,
  };
}

export async function getMeUser(userId) {
  const user = await User.findById(userId).select("+googleSub");
  if (!user) {
    return { ok: false, status: 401, error: "Tài khoản không tồn tại." };
  }
  return { ok: true, user: toPublicUser(user) };
}

export async function patchMeUser(userId, body, req) {
  const user = await User.findById(userId).select("+passwordHash +googleSub +authSessions");
  if (!user) {
    return { ok: false, status: 401, error: "Tài khoản không tồn tại." };
  }

  let passwordChanged = false;
  const newPassRaw = body.newPassword ?? body.password;
  if (typeof newPassRaw === "string" && newPassRaw.trim().length > 0) {
    const trimmedNew = newPassRaw.trim();
    if (trimmedNew.length < MIN_PASSWORD) {
      return {
        ok: false,
        status: 400,
        error: `Mật khẩu mới cần ít nhất ${MIN_PASSWORD} ký tự.`,
      };
    }
    const linkedGoogle = Boolean(user.googleId || user.googleSub);
    if (!linkedGoogle) {
      const cur = body.currentPassword;
      const curTrimmed = typeof cur === "string" ? cur.trim() : "";
      if (!curTrimmed) {
        return {
          ok: false,
          status: 400,
          error: "Nhập mật khẩu hiện tại (currentPassword) để đổi mật khẩu.",
        };
      }
      const ok = await bcrypt.compare(curTrimmed, user.passwordHash || "");
      if (!ok) {
        return { ok: false, status: 401, error: "Mật khẩu hiện tại không đúng." };
      }
    }
    user.passwordHash = await bcrypt.hash(trimmedNew, SALT_ROUNDS);
    user.markModified("passwordHash");
    passwordChanged = true;
  }

  if (typeof body.name === "string" && body.name.trim()) user.name = body.name.trim();
  if (typeof body.phone === "string") user.phone = body.phone.trim();
  if (typeof body.position === "string") {
    const p = body.position.trim();
    user.desiredPosition = p;
    user.position = p;
  }
  if (typeof body.school === "string") user.school = body.school.trim();
  if (typeof body.field === "string" && body.field.trim()) {
    const f = body.field.trim();
    const skills = Array.isArray(user.skills) && user.skills.length ? [...user.skills] : [];
    if (!skills.length) skills.push(f);
    else skills[0] = f;
    user.skills = skills;
    user.expertise = skills;
  }
  if (typeof body.avatar === "string") user.avatar = body.avatar;
  if (Array.isArray(body.expertise)) {
    user.expertise = body.expertise;
    user.skills = body.expertise;
  }
  if (typeof body.experience === "string" && body.experience.trim()) {
    const n = parseFloat(body.experience);
    if (Number.isFinite(n)) user.experience = n;
  } else if (typeof body.experience === "number") {
    user.experience = body.experience;
  }
  if (body.hourlyRate != null) {
    const n = Number(body.hourlyRate);
    if (Number.isFinite(n)) user.hourlyRate = n;
  }
  if (typeof body.bio === "string") user.bio = body.bio;

  if (typeof body.email === "string") {
    const e = body.email.trim().toLowerCase();
    if (e && e !== user.email) {
      const clash = await User.findOne({ email: e, _id: { $ne: user._id } });
      if (clash) {
        return { ok: false, status: 409, error: "Email này đã được tài khoản khác sử dụng." };
      }
      user.email = e;
    }
  }

  /** Không tự đổi lên mentor qua /me — chỉ admin (PATCH /api/users/:id/role). */
  if (body.role !== undefined && body.role !== null) {
    const want = String(body.role).trim().toLowerCase();
    if (want === "mentor" && user.role === "customer") {
      return {
        ok: false,
        status: 403,
        error: "Chỉ quản trị viên mới có thể cấp quyền mentor (PATCH /api/users/:id/role).",
      };
    }
    if (want === "customer" && user.role === "mentor") {
      return {
        ok: false,
        status: 403,
        error: "Không thể hạ role từ mentor xuống customer qua PATCH /me.",
      };
    }
  }

  if (passwordChanged) {
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    user.authSessions = [];
  }

  await user.save();

  if (passwordChanged) {
    const t = issueAccessToken(user);
    if (!t.ok) return t;
    const { refreshToken } = pushNewSession(user, req);
    await user.save();
    return {
      ok: true,
      user: t.user,
      token: t.token,
      refreshToken,
      expiresIn: accessExpiresInSeconds(t.token),
    };
  }

  return { ok: true, user: toPublicUser(user) };
}

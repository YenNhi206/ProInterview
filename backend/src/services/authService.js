import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { User, toPublicUser } from "../models/User.js";

const SALT_ROUNDS = 10;
const MIN_PASSWORD = 6;

function issueToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret || !String(secret).trim()) {
    return {
      ok: false,
      status: 503,
      error:
        "Server chưa cấu hình JWT_SECRET trong backend .env. Thêm biến này, lưu file và khởi động lại backend.",
    };
  }
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  const token = jwt.sign({ sub: user._id.toString() }, secret, { expiresIn });
  return { ok: true, token, user: toPublicUser(user) };
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

export async function loginUser(body) {
  const { email, password } = body ?? {};
  const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const plain =
    typeof password === "string" ? password.trim() : String(password ?? "").trim();

  if (!trimmedEmail || !plain) {
    return { ok: false, status: 400, error: "Vui lòng nhập email và mật khẩu." };
  }

  const user = await User.findOne({ email: trimmedEmail }).select("+passwordHash +googleSub");
  if (!user) {
    return { ok: false, status: 401, error: "Email hoặc mật khẩu không đúng." };
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
    return { ok: false, status: 401, error: "Email hoặc mật khẩu không đúng." };
  }

  return issueToken(user);
}

export async function loginWithGoogle(body) {
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
  }).select("+googleSub");

  if (!user) {
    const byEmail = await User.findOne({ email }).select("+googleSub");
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
      user = await User.findById(byEmail._id).select("+googleSub");
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
  }

  return issueToken(user);
}

export async function getMeUser(userId) {
  const user = await User.findById(userId).select("+googleSub");
  if (!user) {
    return { ok: false, status: 401, error: "Tài khoản không tồn tại." };
  }
  return { ok: true, user: toPublicUser(user) };
}

export async function patchMeUser(userId, body) {
  const user = await User.findById(userId).select("+passwordHash +googleSub");
  if (!user) {
    return { ok: false, status: 401, error: "Tài khoản không tồn tại." };
  }

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

  await user.save();
  return { ok: true, user: toPublicUser(user) };
}

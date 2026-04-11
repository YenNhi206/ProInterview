import express from "express";
import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { OAuth2Client } from "google-auth-library";
import { User, toPublicUser } from "../models/User.js";
import { authJwt } from "../middleware/authJwt.js";

const router = express.Router();

const SALT_ROUNDS = 10;
const MIN_PASSWORD = 6;

router.use((req, res, next) => {
  if (mongoose.connection.readyState === 1) return next();
  return res.status(503).json({
    success: false,
    error:
      "Cơ sở dữ liệu chưa kết nối. Kiểm tra MONGO_URI trong backend .env và đảm bảo MongoDB đang chạy.",
  });
});

router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body ?? {};
    const trimmedName = typeof name === "string" ? name.trim() : "";
    const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!trimmedName || !trimmedEmail || !password) {
      return res.status(400).json({
        success: false,
        error: "Vui lòng nhập đủ họ tên, email và mật khẩu.",
      });
    }

    if (typeof password !== "string" || password.length < MIN_PASSWORD) {
      return res.status(400).json({
        success: false,
        error: `Mật khẩu cần ít nhất ${MIN_PASSWORD} ký tự.`,
      });
    }

    const allowedRoles = ["customer", "mentor"];
    const userRole = allowedRoles.includes(role) ? role : "customer";

    const exists = await User.findOne({ email: trimmedEmail }).lean();
    if (exists) {
      return res.status(409).json({
        success: false,
        error: "Email này đã được đăng ký. Vui lòng đăng nhập.",
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await User.create({
      email: trimmedEmail,
      passwordHash,
      name: trimmedName,
      role: userRole,
    });

    res.status(201).json({ success: true });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        error: "Email này đã được đăng ký. Vui lòng đăng nhập.",
      });
    }
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!trimmedEmail || !password) {
      return res.status(400).json({
        success: false,
        error: "Vui lòng nhập email và mật khẩu.",
      });
    }

    const user = await User.findOne({ email: trimmedEmail }).select("+passwordHash");
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Email hoặc mật khẩu không đúng.",
      });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({
        success: false,
        error: "Email hoặc mật khẩu không đúng.",
      });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret || !String(secret).trim()) {
      return res.status(503).json({
        success: false,
        error:
          "Server chưa cấu hình JWT_SECRET trong backend .env. Thêm biến này, lưu file và khởi động lại backend.",
      });
    }
    const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
    const token = jwt.sign({ sub: user._id.toString() }, secret, { expiresIn });
    const publicUser = toPublicUser(user);
    res.json({ success: true, token, user: publicUser });
  } catch (err) {
    next(err);
  }
});

/** Đăng nhập / đăng ký nhanh bằng Google ID token (GIS). Cần GOOGLE_CLIENT_ID trên server. */
router.post("/google", async (req, res, next) => {
  try {
    const audience = process.env.GOOGLE_CLIENT_ID;
    if (!audience || !String(audience).trim()) {
      return res.status(503).json({
        success: false,
        error:
          "Đăng nhập Google chưa được bật trên server. Vui lòng dùng email và mật khẩu, hoặc cấu hình GOOGLE_CLIENT_ID.",
      });
    }

    const { credential } = req.body ?? {};
    if (!credential || typeof credential !== "string") {
      return res.status(400).json({
        success: false,
        error: "Thiếu thông tin xác thực từ Google.",
      });
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
      return res.status(401).json({
        success: false,
        error: "Không xác thực được Google. Thử lại hoặc đăng nhập bằng mật khẩu.",
      });
    }

    if (!payload) {
      return res.status(401).json({ success: false, error: "Token Google không hợp lệ." });
    }

    const sub = payload.sub;
    const email = (payload.email || "").toLowerCase().trim();
    const name =
      (typeof payload.name === "string" && payload.name.trim()) ||
      email.split("@")[0] ||
      "Người dùng";

    if (!email) {
      return res.status(400).json({
        success: false,
        error:
          "Tài khoản Google không có email công khai. Chọn tài khoản khác hoặc đăng ký bằng email.",
      });
    }

    let user = await User.findOne({ googleSub: sub });
    if (!user) {
      const byEmail = await User.findOne({ email });
      if (byEmail) {
        if (byEmail.googleSub && byEmail.googleSub !== sub) {
          return res.status(409).json({
            success: false,
            error: "Email này đã liên kết với tài khoản Google khác.",
          });
        }
        byEmail.googleSub = sub;
        if (payload.picture && !byEmail.avatar) {
          byEmail.avatar = payload.picture;
        }
        await byEmail.save();
        user = byEmail;
      }
    }

    if (!user) {
      const passwordHash = await bcrypt.hash(crypto.randomBytes(48).toString("hex"), SALT_ROUNDS);
      user = await User.create({
        email,
        passwordHash,
        name,
        role: "customer",
        googleSub: sub,
        avatar: typeof payload.picture === "string" ? payload.picture : undefined,
      });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret || !String(secret).trim()) {
      return res.status(503).json({
        success: false,
        error:
          "Server chưa cấu hình JWT_SECRET trong backend .env. Thêm biến này, lưu file và khởi động lại backend.",
      });
    }
    const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
    const token = jwt.sign({ sub: user._id.toString() }, secret, { expiresIn });
    const publicUser = toPublicUser(user);
    res.json({ success: true, token, user: publicUser });
  } catch (err) {
    next(err);
  }
});

router.get("/me", authJwt, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({ success: false, error: "Tài khoản không tồn tại." });
    }
    res.json({ success: true, user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.patch("/me", authJwt, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({ success: false, error: "Tài khoản không tồn tại." });
    }

    const body = req.body ?? {};

    if (typeof body.name === "string" && body.name.trim()) user.name = body.name.trim();
    if (typeof body.phone === "string") user.phone = body.phone.trim();
    if (typeof body.position === "string") user.position = body.position.trim();
    if (typeof body.school === "string") user.school = body.school.trim();
    if (typeof body.field === "string") user.field = body.field.trim();
    if (typeof body.avatar === "string") user.avatar = body.avatar;
    if (Array.isArray(body.expertise)) user.expertise = body.expertise;
    if (typeof body.experience === "string") user.experience = body.experience;
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
          return res.status(409).json({
            success: false,
            error: "Email này đã được tài khoản khác sử dụng.",
          });
        }
        user.email = e;
      }
    }

    await user.save();
    res.json({ success: true, user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

export const authRouter = router;

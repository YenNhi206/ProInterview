import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { getJaasPublicStatus } from "./services/jaasService.js";
import dns from "node:dns";
import helmet from "helmet";
import hpp from "hpp";
import rateLimit from "express-rate-limit";
import { sanitizeObjectKeys } from "./utils/securityGuards.js";
import { isRedisEnabled, getCacheMode } from "./services/cacheService.js";

// TUYỆT CHIÊU CUỐI: Ép Node.js ưu tiên IPv4 trên toàn hệ thống để fix lỗi Render ENETUNREACH IPv6
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

import { mentorsRouter } from "./routes/mentors.js";
import { authRouter } from "./routes/auth.js";
import { bookingsRouter } from "./routes/bookings.js";
import { plansRouter } from "./routes/plans.js";
import { paymentsRouter } from "./routes/payments.js";
import { usersRouter } from "./routes/users.js";
import { reviewsRouter } from "./routes/reviews.js";
import { reportsRouter } from "./routes/reports.js";
import { mentorRouter } from "./routes/mentor.js";
import { coursesRouter } from "./routes/courses.js";
import { notificationsRouter } from "./routes/notifications.js";
import { adminRouter } from "./routes/admin.js";
import { enrollmentsRouter } from "./routes/enrollments.js";
import { cvRouter } from "./routes/cv.js";
import { cvMatchRouter } from "./routes/cvMatch.js";
import { interviewsRouter } from "./routes/interviews.js";
import { uploadRouter } from "./routes/upload.js";
import { mockCoursesRouter } from "./routes/mockCourses.js";
import { aiProvidersRouter } from "./routes/aiProviders.js";
import { achievementsRouter } from "./routes/achievements.js";
import { analyticsRouter } from "./routes/analytics.js";
import { publicRouter } from "./routes/public.js";
import { couponsRouter } from "./routes/coupons.js";
import { notFoundHandler, globalErrorHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();
  const isProd = process.env.NODE_ENV === "production";
  app.disable("x-powered-by");

  if (isProd) {
    app.set("trust proxy", 1);
  }

  const configuredOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const defaultDevOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
  const defaultProdOrigins = ["https://pro-interview-mu.vercel.app"];
  const allowOrigins =
    configuredOrigins.length > 0
      ? configuredOrigins
      : isProd
        ? defaultProdOrigins
        : defaultDevOrigins;
  const staticCorsOrigin = allowOrigins.length > 0 ? allowOrigins : true;

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProd ? 500 : 10_000,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === "/health",
    message: { success: false, error: "Quá nhiều yêu cầu. Vui lòng thử lại sau." },
  });

  app.use(helmet({
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  }));
  app.use(hpp());
  app.use((req, _res, next) => {
    sanitizeObjectKeys(req.body);
    sanitizeObjectKeys(req.params);
    sanitizeObjectKeys(req.query);
    next();
  });
  app.use("/api", apiLimiter);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowOrigins.includes(origin)) return callback(null, true);
        if (isProd && /\.vercel\.app$/i.test(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: false,
    }),
  );

  // Fix lỗi "Cross-Origin-Opener-Policy" cho Google Login trên Render
  app.use(express.json({ limit: "1mb" }));
  app.use("/public", cors({ origin: staticCorsOrigin }), express.static("public"));
  // SPA (5173) / Vercel load ảnh qua origin khác — bỏ CORP same-origin mặc định của Helmet.
  app.use(
    "/uploads",
    cors({ origin: staticCorsOrigin }),
    (_req, res, next) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Disposition", "attachment");
      next();
    },
    express.static("public/uploads"),
  );



  // Route chẩn đoán Email: chỉ mở ở môi trường dev nội bộ
  if (!isProd) {
    app.get("/api/test-email", async (req, res) => {
      try {
        const { sendVerificationEmail } = await import("./services/emailService.js");
        const result = await sendVerificationEmail(
          process.env.MAIL_USER || "test@example.com",
          "Tester",
          "https://prointerview.ai/verify-test"
        );
        res.json({
          message: "Email test result",
          success: result.ok,
          error: result.error || null,
          env: {
            MAIL_USER: process.env.MAIL_USER ? "HIDDEN" : "MISSING",
            MAIL_PASS: process.env.MAIL_PASS ? "HIDDEN" : "MISSING",
          }
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
  }
  
  app.get("/", (_req, res) => {
    res.json({
      message: "ProInterview backend is running",
      docs: "/api/health",
      mentors: "/api/mentors",
      auth: "/api/auth",
      bookings: "/api/bookings",
      plans: "/api/plans",
      payments: "/api/payments",
      users: "/api/users",
      courses: "/api/courses",
      reviews: "/api/reviews",
      reports: "/api/reports",
      notifications: "/api/notifications",
      admin: "/api/admin",
      enrollments: "/api/enrollments",
      achievements: "/api/achievements",

      cv: "/api/cv",
      interviews: "/api/interviews",
      upload: "/api/upload",

    });
  });

  app.get("/api/health", (_req, res) => {
    const connected = mongoose.connection.readyState === 1;
    const db = mongoose.connection.db;
    res.status(200).json({
      ok: true,
      service: "backend",
      database: connected ? "connected" : "disconnected",
      // Trong production: chỉ trả tên DB (không host) để tránh lộ cluster info
      mongo: connected
        ? {
            databaseName: db?.databaseName ?? null,
            ...(isProd ? {} : { host: mongoose.connection.host || null }),
          }
        : null,
      cache: {
        redisConfigured: isRedisEnabled(),
        mode: getCacheMode(),
      },
      // Trong production: che giấu trạng thái cấu hình dịch vụ bên ngoài
      ...(isProd
        ? {}
        : {
            sepayWebhookConfigured: Boolean(
              String(process.env.SEPAY_WEBHOOK_API_KEY || process.env.SEPAY_API_KEY || "").trim(),
            ),
            jaas: getJaasPublicStatus(),
          }),
      timestamp: new Date().toISOString(),
    });
  });

  // Routers theo module
  app.use("/api/auth", authRouter);
  app.use("/api/mentors", mentorsRouter);
  app.use("/api/bookings", bookingsRouter);
  app.use("/api/plans", plansRouter);
  app.use("/api/payments", paymentsRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/courses", coursesRouter);
  app.use("/api/reviews", reviewsRouter);
  app.use("/api/reports", reportsRouter);
  app.use("/api/mentor", mentorRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/enrollments", enrollmentsRouter);
  app.use("/api/cv", cvRouter);
  app.use("/api/cv", cvMatchRouter);
  app.use("/api/interviews", interviewsRouter);
  app.use("/api/upload", uploadRouter);
  app.use("/api/mock", mockCoursesRouter);
  app.use("/api/ai", aiProvidersRouter);
  app.use("/api/achievements", achievementsRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/public", publicRouter);
  app.use("/api/coupons", couponsRouter);

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}

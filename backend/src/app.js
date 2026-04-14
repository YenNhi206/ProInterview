import express from "express";
import cors from "cors";
import mongoose from "mongoose";

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

export function createApp() {
  const app = express();
  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    app.set("trust proxy", 1);
  }

  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
    : true;

  app.use(
    cors({
      origin: corsOrigins,
      credentials: false,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

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
    });
  });

  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: "backend",
      database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
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

  // Error handler cuối
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ success: false, error: "Internal server error" });
  });

  return app;
}

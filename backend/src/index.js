import "./config/loadEnv.js";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { connectDatabase } from "./db/connect.js";
import "./models/index.js";
import { mentorsRouter } from "./routes/mentors.js";
import { authRouter } from "./routes/auth.js";
import { bookingsRouter } from "./routes/bookings.js";
import { plansRouter } from "./routes/plans.js";
import { paymentsRouter } from "./routes/payments.js";
import { usersRouter } from "./routes/users.js";

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
  : true;

app.use(
  cors({
    origin: corsOrigins,
    credentials: false,
  })
);
app.use(express.json());

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

app.use("/api/auth", authRouter);
app.use("/api/mentors", mentorsRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/plans", plansRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/users", usersRouter);

console.log(
  `API: /api/health, /api/auth, /api/mentors, /api/bookings, /api/plans, /api/payments, /api/users — nếu POST /api/auth/google trả 404 HTML thì tiến trình cũ trên cổng ${PORT} cần tắt và chạy lại backend từ repo này.`,
);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ success: false, error: "Internal server error" });
});

const startServer = async () => {
  try {
    if (MONGO_URI) {
      await connectDatabase(MONGO_URI);
      const dbName = mongoose.connection.db?.databaseName ?? "?";
      console.log(`MongoDB connected (database: ${dbName})`);
      if (mongoose.connection.readyState === 1) {
        const { ensureMentorProfilesForAllMentorUsers } = await import("./services/mentorProfileService.js");
        const sync = await ensureMentorProfilesForAllMentorUsers().catch((e) => ({
          ok: false,
          error: e?.message || e,
        }));
        if (sync?.ok && (sync.created > 0 || sync.errors > 0)) {
          console.log(
            `[startup] Đồng bộ hồ sơ mentor: tạo mới ${sync.created}, lỗi ${sync.errors ?? 0}, user role mentor: ${sync.totalMentorUsers ?? "?"}`,
          );
        }
      }
    } else {
      console.warn("MONGO_URI is missing. /api/mentors will return 503 until MongoDB is configured.");
    }

    if (!process.env.JWT_SECRET) {
      console.warn("JWT_SECRET is missing. Đăng nhập /api/auth sẽ lỗi cho đến khi bạn set trong .env");
    }

    const server = app.listen(PORT);
    server.once("listening", () => {
      const addr = server.address();
      const bound = typeof addr === "object" && addr ? addr.port : PORT;
      console.log(`Backend running at http://localhost:${bound}`);
      console.log(`Sanity: GET / phải trả JSON có "auth" và "mentors" — nếu thiếu thì trình duyệt đang trỏ nhầm host/port.`);
    });
    server.on("error", (err) => {
      // Windows đôi khi bắn EADDRINUSE muộn dù đã listen OK — không exit nếu server đang lắng nghe.
      if (err.code === "EADDRINUSE" && server.listening) return;
      if (err.code === "EADDRINUSE") {
        console.error(
          `\nCổng ${PORT} đang bị chiếm (thường là tiến trình Node/backend cũ không có /api/auth).\n` +
            `Chạy: netstat -ano | findstr :${PORT}\n` +
            `Rồi: taskkill /PID <số_PID> /F\n` +
            `Sau đó: npm start lại trong thư mục backend của repo này.\n`
        );
        process.exit(1);
        return;
      }
      console.error(err);
      process.exit(1);
    });
  } catch (error) {
    console.error("Failed to start backend:", error.message);
    process.exit(1);
  }
};

startServer();

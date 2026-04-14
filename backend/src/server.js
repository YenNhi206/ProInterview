import "./config/loadEnv.js";
import mongoose from "mongoose";
import { connectDatabase } from "./db/connect.js";
import "./models/index.js";
import { createApp } from "./app.js";

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const isProd = process.env.NODE_ENV === "production";

const app = createApp();

export async function startServer() {
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
      console.warn("MONGO_URI is missing. Một số route sẽ trả 503 cho đến khi MongoDB được cấu hình.");
    }

    if (!process.env.JWT_SECRET) {
      console.warn("JWT_SECRET is missing. Đăng nhập /api/auth sẽ lỗi cho đến khi bạn set trong .env");
    }

    if (isProd && !process.env.CORS_ORIGIN) {
      console.warn(
        "[deploy] CORS_ORIGIN chưa set — mọi origin được phép. Nên gắn URL frontend (cách nhau bởi dấu phẩy) để chặt chẽ hơn.",
      );
    }

    if (!isProd) {
      console.log(
        "API: /api/health, /api/auth, /api/mentors, /api/bookings, /api/plans, /api/payments, /api/users, /api/courses, /api/reviews, /api/reports, /api/notifications, /api/admin, /api/enrollments",
      );
    }

    const server = app.listen(PORT);
    server.once("listening", () => {
      const addr = server.address();
      const bound = typeof addr === "object" && addr ? addr.port : PORT;
      console.log(`ProInterview backend listening on port ${bound}`);
      if (!isProd) {
        console.log("Dev: GET /api/health — nếu frontend trỏ nhầm host/port, kiểm tra proxy VITE hoặc VITE_API_URL.");
      }
    });
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE" && server.listening) return;
      if (err.code === "EADDRINUSE") {
        console.error(
          `\nCổng ${PORT} đang bị chiếm.\n` +
            `Chạy: netstat -ano | findstr :${PORT}\n` +
            `Rồi: taskkill /PID <số_PID> /F\n` +
            `Sau đó: npm start lại trong thư mục backend.\n`,
        );
        process.exit(1);
        return;
      }
      console.error(err);
      process.exit(1);
    });
  } catch (error) {
    console.error("Failed to start backend:", error?.message || error);
    process.exit(1);
  }
}

startServer();

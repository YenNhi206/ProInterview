import "./config/loadEnv.js";
import { initSentry, Sentry } from "./config/sentry.js";

// Init càng sớm càng tốt — trước khi import app.js/models để bắt được lỗi từ lúc khởi động.
const sentryEnabled = initSentry();

import mongoose from "mongoose";
import { connectDatabase } from "./db/connect.js";
import "./models/index.js";
import { createApp } from "./app.js";
import { isJaasConfigured, getJaasPublicStatus } from "./services/jaasService.js";

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const isProd = process.env.NODE_ENV === "production";

if (sentryEnabled) {
  console.log("✅ Sentry error tracking enabled");
  process.on("uncaughtException", (err) => {
    Sentry.captureException(err);
    console.error("[uncaughtException]", err);
  });
  process.on("unhandledRejection", (reason) => {
    Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));
    console.error("[unhandledRejection]", reason);
  });
}

// ── Env validation ────────────────────────────────────────────────────────────
const REQUIRED_ENV = {
  MONGO_URI:       { critical: true,  feature: "Database" },
  LLM_API_KEY:     { critical: true,  feature: "AI question generation + evaluation" },
  LLM_BASE_URL:    { critical: true,  feature: "LLM API endpoint" },
  CV_ANALYZER_URL: { critical: false, feature: "CV text extraction (Python service)" },
  DID_API_KEY:     { critical: false, feature: "D-ID avatar (fallback Cloudinary)" },
};

function validateEnv() {
  const critical = [];
  const warnings = [];

  for (const [key, config] of Object.entries(REQUIRED_ENV)) {
    if (!process.env[key]) {
      (config.critical ? critical : warnings).push({ key, feature: config.feature });
    }
  }

  if (critical.length > 0) {
    console.error("❌ CRITICAL: Missing required env vars — server cannot start:");
    critical.forEach((i) => console.error(`  - ${i.key}: required for ${i.feature}`));
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn("⚠️  Optional env vars missing (features will degrade gracefully):");
    warnings.forEach((i) => console.warn(`  - ${i.key}: ${i.feature}`));
  }

  console.log("✅ Environment validated");
}

/**
 * Redis (Upstash) là bắt buộc ở production — cacheService.js fail-fast (throw) khi Redis lỗi
 * thay vì fallback im lặng sang in-memory Map (mỗi Render instance có Map riêng, mất khi
 * restart → cache hit rate tụt không ai biết, tốn credit D-ID/LLM lãng phí). Chặn sớm ở đây
 * để server không khởi động được với cấu hình thiếu, thay vì lỗi rải rác ở runtime.
 */
function validateRedisProd() {
  if (!isProd) return;
  const hasRedis = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
  if (!hasRedis) {
    console.error(
      "❌ CRITICAL: UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN chưa cấu hình ở production.\n" +
        "   Cache bắt buộc dùng Redis ở production (fail-fast, không fallback in-memory Map) —\n" +
        "   xem backend/src/services/cacheService.js. Đăng ký free tier tại upstash.com.",
    );
    process.exit(1);
  }
}

validateEnv();
validateRedisProd();

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

        // Tự động thêm dữ liệu mẫu nếu DB hoàn toàn trống (0 Mentor)
        const mentorCount = await mongoose.model("Mentor").countDocuments();
        if (mentorCount === 0) {
          console.log("[startup] DB trống. Tự động thêm Mentor mẫu và đánh giá thực tế...");
          try {
            const { seedDemoData } = await import("./scripts/seedDemoData.js");
            await seedDemoData();
            console.log("[startup] ✅ Đã tự động thêm dữ liệu mẫu thành công.");
          } catch(err) {
            console.error("[startup] ❌ Lỗi thêm dữ liệu mẫu:", err);
          }
        }
        const { startBookingReminderJob } = await import("./jobs/bookingReminderJob.js");
        startBookingReminderJob();
      }
    } else {
      console.warn("MONGO_URI is missing. Một số route sẽ trả 503 cho đến khi MongoDB được cấu hình.");
    }

    // Không phụ thuộc MongoDB — chỉ cần Cloudinary (tự skip nếu chưa cấu hình).
    const { startTtsCleanupJob } = await import("./jobs/ttsCleanupJob.js");
    startTtsCleanupJob();

    if (!process.env.JWT_SECRET) {
      console.warn("JWT_SECRET is missing. Đăng nhập /api/auth sẽ lỗi cho đến khi bạn set trong .env");
    }

    if (isJaasConfigured()) {
      const jaas = getJaasPublicStatus();
      console.log(`[jaas] OK — domain: ${jaas.domain}, kid: ${jaas.kidSuffix}, key: ${jaas.keySource}`);
    } else if (isProd) {
      console.warn(
        "[jaas] Production chưa cấu hình — phòng họp fallback meet.jit.si (giới hạn ~5 phút embed). Set JAAS_* trên Render.",
      );
    } else {
      console.warn("[jaas] Chưa cấu hình — phòng họp fallback meet.jit.si (giới hạn 5 phút embed).");
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
          `\nCổng ${PORT} đang bị chiếm (thường do backend cũ còn chạy).\n` +
            `macOS/Linux: lsof -ti :${PORT} | xargs kill -9\n` +
            `Windows: netstat -ano | findstr :${PORT}  →  taskkill /PID <PID> /F\n` +
            `Hoặc tắt terminal đang chạy npm run dev / dev:full, rồi chạy lại.\n`,
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

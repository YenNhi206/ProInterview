/**
 * Migration N-03: đổi role user từ `enterprise` sang `company_moderator`. Chạy lại nhiều lần không lỗi.
 *
 * Chạy thử (không ghi DB): npm run db:migrate-enterprise-role:dry · Chạy thật: npm run db:migrate-enterprise-role
 * DB khác .env (production): đặt TARGET_MONGO_URI, ví dụ PowerShell:
 *   $env:TARGET_MONGO_URI="mongodb+srv://..."; npm run db:migrate-enterprise-role:dry
 *
 * Đề xuất (n) trong docs/plan/TASKS.md: `loadEnv` nạp `.env` với `override: true`, nên đặt `MONGO_URI`
 * trên dòng lệnh vẫn bị `.env` ghi đè; script phải đọc `TARGET_MONGO_URI` trước và in host đích.
 */
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";
import { connectDatabase } from "../db/connect.js";
import { User } from "../models/User.js";

const FILTER = { role: "enterprise" };

/**
 * Đổi mọi user `enterprise` sang `company_moderator` (dry run chỉ đếm).
 * @returns {Promise<{ found: number, updated: number }>}
 */
export async function migrateEnterpriseRole({ dryRun = false } = {}) {
  const found = await User.countDocuments(FILTER);
  if (dryRun || found === 0) return { found, updated: 0 };
  const result = await User.updateMany(FILTER, { $set: { role: "company_moderator" } });
  return { found, updated: result.modifiedCount };
}

/** Host của chuỗi kết nối, bỏ user:password (để in ra màn hình không lộ mật khẩu). */
export function mongoHost(uri) {
  return String(uri ?? "").replace(/^mongodb(\+srv)?:\/\/([^@/]*@)?/, "").split(/[/?]/)[0];
}

async function main() {
  // Nạp .env chỉ khi chạy từ dòng lệnh: test import module này không bị .env ghi đè biến môi trường.
  await import("../config/loadEnv.js");
  const uri = process.env.TARGET_MONGO_URI?.trim() || process.env.MONGO_URI;
  if (!uri) {
    console.error("Thiếu MONGO_URI (hoặc TARGET_MONGO_URI).");
    process.exit(1);
  }
  const source = process.env.TARGET_MONGO_URI?.trim() ? "TARGET_MONGO_URI" : "MONGO_URI trong .env";
  // PowerShell nuốt `--` nên dùng script :dry; npm đặt npm_config_dry_run khi cờ rơi vào npm.
  const dryRun =
    process.argv.includes("--dry-run") || process.env.DRY_RUN === "1" || process.env.npm_config_dry_run === "true";
  console.log(`[migrateEnterpriseRole] kết nối tới: ${mongoHost(uri)} (${source}) · ${dryRun ? "DRY RUN" : "GHI THẬT"}`);

  await connectDatabase(uri);
  const { found, updated } = await migrateEnterpriseRole({ dryRun });
  if (found === 0) console.log("[migrateEnterpriseRole] Không còn user role 'enterprise'. Không cần migrate.");
  else if (dryRun) console.log(`[migrateEnterpriseRole] DRY RUN (không ghi DB): ${found} user sẽ đổi sang 'company_moderator'.`);
  else console.log(`[migrateEnterpriseRole] Đã đổi ${updated}/${found} user sang 'company_moderator'.`);
  await mongoose.disconnect();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async (err) => {
    console.error("[migrateEnterpriseRole] Lỗi khi migrate:", err);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  });
}

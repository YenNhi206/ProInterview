/**
 * Migration N-03: Đổi role user từ `enterprise` sang `company_moderator`.
 *
 * Chạy được nhiều lần mà không lỗi (idempotent).
 * Hỗ trợ cờ --dry-run để kiểm tra trước số lượng mà không ghi DB.
 *
 * Sử dụng:
 *   node src/scripts/migrateEnterpriseRole.js [--dry-run]
 */
import "../config/loadEnv.js";
import mongoose from "mongoose";
import { connectDatabase } from "../db/connect.js";
import { User } from "../models/User.js";

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Lỗi: Chưa cấu hình MONGO_URI trong môi trường.");
    process.exit(1);
  }

  const dryRun = process.argv.includes("--dry-run");
  await connectDatabase(uri);
  console.log(`[migrateEnterpriseRole] Đã kết nối MongoDB (${dryRun ? "DRY-RUN" : "LIVE"}).`);

  const filter = { role: "enterprise" };
  const count = await User.countDocuments(filter);

  if (count === 0) {
    console.log("[migrateEnterpriseRole] Không tìm thấy user nào có role 'enterprise'. Không cần migrate.");
    await mongoose.disconnect();
    return;
  }

  console.log(`[migrateEnterpriseRole] Tìm thấy ${count} user có role 'enterprise'.`);

  if (dryRun) {
    console.log("[migrateEnterpriseRole] DRY-RUN: Bỏ qua bước cập nhật database.");
  } else {
    const result = await User.updateMany(filter, { $set: { role: "company_moderator" } });
    console.log(`[migrateEnterpriseRole] Đã migrate thành công ${result.modifiedCount} user sang role 'company_moderator'.`);
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("[migrateEnterpriseRole] Lỗi khi thực hiện migrate:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});

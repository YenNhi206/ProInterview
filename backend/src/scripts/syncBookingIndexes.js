/**
 * LP-02: thay index unique cũ `mentorshipRequestId_1` bằng `mentorshipRequestId_regular_unique`
 * (partial filter loại buổi đánh giá 0đ). Chỉ sửa schema thì MongoDB giữ index cũ và vẫn chặn
 * booking thứ hai cùng request, nên phải chạy script này trên staging/production.
 *
 * Chỉ tạo index khai báo trong schema và drop đúng index cũ; KHÔNG dùng syncIndexes để tránh
 * xoá index tạo tay khác trên collection bookings.
 * Chạy thử (không ghi DB): npm run db:sync-booking-indexes:dry · Chạy thật: npm run db:sync-booking-indexes
 * (Windows PowerShell nuốt dấu `--` nên `npm run ... -- --dry-run` vẫn chạy thật; dùng script :dry.)
 * DB khác .env (production): đặt TARGET_MONGO_URI, ví dụ PowerShell:
 *   $env:TARGET_MONGO_URI="mongodb+srv://..."; npm run db:sync-booking-indexes:dry
 */
import "../config/loadEnv.js";
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";
import { connectDatabase } from "../db/connect.js";
import { Booking, LEGACY_REQUEST_INDEX_NAME } from "../models/Booking.js";

export async function syncBookingIndexes({ dryRun = false, log = console.log } = {}) {
  const before = await Booking.collection.indexes();
  const legacy = before.find((ix) => ix.name === LEGACY_REQUEST_INDEX_NAME);
  const diff = await Booking.diffIndexes();
  log(`[Booking] index hiện có: ${before.map((ix) => ix.name).join(", ")}`);
  log(`[Booking] cần tạo: ${JSON.stringify(diff.toCreate)}`);
  log(`[Booking] index cũ ${LEGACY_REQUEST_INDEX_NAME}: ${legacy ? "có, sẽ drop" : "không có"}`);
  if (dryRun) return { dropped: [], indexes: before };

  const dropped = [];
  // Drop trước rồi tạo: tránh lỗi trùng key pattern trên MongoDB không cho 2 index cùng key.
  if (legacy) {
    await Booking.collection.dropIndex(LEGACY_REQUEST_INDEX_NAME);
    dropped.push(LEGACY_REQUEST_INDEX_NAME);
  }
  await Booking.createIndexes();
  const after = await Booking.collection.indexes();
  log(`[Booking] dropped=${JSON.stringify(dropped)}; index sau khi sync: ${after.map((ix) => ix.name).join(", ")}`);
  return { dropped, indexes: after };
}

async function main() {
  // loadEnv dùng dotenv override:true → MONGO_URI đặt ở shell bị .env ghi đè.
  // Muốn chạy trên DB khác (production) thì đặt TARGET_MONGO_URI (không có trong .env).
  const uri = process.env.TARGET_MONGO_URI?.trim() || process.env.MONGO_URI;
  if (!uri) {
    console.error("Thiếu MONGO_URI (hoặc TARGET_MONGO_URI).");
    process.exit(1);
  }
  const host = uri.replace(/^mongodb(\+srv)?:\/\/([^@/]*@)?/, "").split(/[/?]/)[0];
  console.log(`[Booking] kết nối tới: ${host}${process.env.TARGET_MONGO_URI ? " (TARGET_MONGO_URI)" : " (MONGO_URI trong .env)"}`);
  // npm đặt npm_config_dry_run khi cờ --dry-run rơi vào npm thay vì script (PowerShell nuốt `--`).
  const dryRun =
    process.argv.includes("--dry-run") || process.env.DRY_RUN === "1" || process.env.npm_config_dry_run === "true";
  await connectDatabase(uri);
  await syncBookingIndexes({ dryRun });
  console.log(dryRun ? "DRY RUN hoàn tất (không ghi DB)." : "Đã đồng bộ index Booking.");
  await mongoose.disconnect();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async (e) => {
    console.error(e);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  });
}

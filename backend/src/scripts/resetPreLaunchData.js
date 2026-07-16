/**
 * Reset dữ liệu giao dịch test trước khi launch thật — XÓA VĨNH VIỄN, không thể hoàn tác.
 *
 * Mặc định chạy DRY-RUN (chỉ đếm, không xóa gì). Chỉ thực thi khi có CONFIRM_RESET=yes.
 *
 * Phạm vi khi thực thi:
 *   - Xóa toàn bộ `payments` (ledger doanh thu)
 *   - Xóa toàn bộ `bookings`
 *   - Xóa toàn bộ `enrollments`
 *   - Reset `User.plan` → "free", `planExpiresAt` → null, quota CV/interview → mặc định free
 *     (cho user đang KHÔNG phải plan free)
 *   - Reset `Mentor.finance.{availableBalance,pendingBalance,totalEarned}` → 0 (mọi mentor)
 *   - Reset `usedBy` của coupon LAUNCH50 → [] (giữ nguyên mã, chỉ xóa lượt đã dùng test)
 *   - Xóa toàn bộ `PayoutRequest` (yêu cầu rút tiền mentor)
 *
 * Chạy dry-run (mặc định, an toàn):
 *   MONGO_URI="<production-uri>" node src/scripts/resetPreLaunchData.js
 *
 * Chạy thật (XÓA VĨNH VIỄN — backup DB trước bằng mongodump):
 *   MONGO_URI="<production-uri>" CONFIRM_RESET=yes node src/scripts/resetPreLaunchData.js
 */
import "../config/loadEnv.js";
import mongoose from "mongoose";
import { connectDatabase } from "../db/connect.js";
import { Payment } from "../models/Payment.js";
import { Booking } from "../models/Booking.js";
import { Enrollment } from "../models/Enrollment.js";
import { User } from "../models/User.js";
import { Mentor } from "../models/Mentor.js";
import { Coupon } from "../models/Coupon.js";
import { PayoutRequest } from "../models/PayoutRequest.js";

const FREE_QUOTA_DEFAULTS = {
  cvAnalysisLimit: 3,
  interviewLimit: 1,
  interviewQuestionsAllowed: 3,
};

async function main() {
  // TARGET_MONGO_URI ưu tiên trước — backend/.env có override:true nên MONGO_URI truyền qua
  // shell sẽ bị .env local đè mất; dùng biến riêng để chắc chắn nhắm đúng DB muốn.
  const uri = process.env.TARGET_MONGO_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("Thiếu MONGO_URI.");
    process.exit(1);
  }
  await connectDatabase(uri);

  const db = mongoose.connection.db;
  console.log("=".repeat(60));
  console.log(`Đang kết nối DB: ${db.databaseName}  (host: ${mongoose.connection.host})`);
  console.log("=".repeat(60));

  const confirm = String(process.env.CONFIRM_RESET || "").trim().toLowerCase() === "yes";

  const paymentCount = await Payment.countDocuments({});
  const bookingCount = await Booking.countDocuments({});
  const enrollmentCount = await Enrollment.countDocuments({});
  const paidUserCount = await User.countDocuments({ plan: { $ne: "free" } });
  const mentorCount = await Mentor.countDocuments({
    $or: [
      { "finance.availableBalance": { $gt: 0 } },
      { "finance.pendingBalance": { $gt: 0 } },
      { "finance.totalEarned": { $gt: 0 } },
    ],
  });
  const launch50 = await Coupon.findOne({ code: "LAUNCH50" }).select("usedBy").lean();
  const launch50UsedCount = launch50?.usedBy?.length || 0;
  const payoutRequestCount = await PayoutRequest.countDocuments({});

  console.log("\nSẽ XÓA:");
  console.log(`  - Payment (toàn bộ ledger doanh thu): ${paymentCount}`);
  console.log(`  - Booking (toàn bộ): ${bookingCount}`);
  console.log(`  - Enrollment (toàn bộ): ${enrollmentCount}`);
  console.log(`  - PayoutRequest (yêu cầu rút tiền mentor): ${payoutRequestCount}`);
  console.log("\nSẽ RESET:");
  console.log(`  - User có plan != free → free, planExpiresAt=null, quota về mặc định: ${paidUserCount} user`);
  console.log(`  - Mentor.finance (availableBalance/pendingBalance/totalEarned) → 0: ${mentorCount} mentor`);
  console.log(`  - Coupon LAUNCH50.usedBy → [] (đang có ${launch50UsedCount} lượt dùng test)`);

  if (!confirm) {
    console.log("\n>>> ĐÂY LÀ DRY-RUN — CHƯA XÓA/SỬA GÌ CẢ. <<<");
    console.log(">>> Chạy lại với CONFIRM_RESET=yes để thực thi thật (backup DB trước!). <<<");
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log("\n⚠️  CONFIRM_RESET=yes — BẮT ĐẦU XÓA THẬT SAU 5 GIÂY... (Ctrl+C để hủy)");
  await new Promise((r) => setTimeout(r, 5000));

  const pRes = await Payment.deleteMany({});
  const bRes = await Booking.deleteMany({});
  const eRes = await Enrollment.deleteMany({});
  const prRes = await PayoutRequest.deleteMany({});
  const uRes = await User.updateMany(
    { plan: { $ne: "free" } },
    {
      $set: {
        plan: "free",
        planExpiresAt: null,
        "quota.cvAnalysisUsed": 0,
        "quota.interviewUsed": 0,
        "quota.cvAnalysisLimit": FREE_QUOTA_DEFAULTS.cvAnalysisLimit,
        "quota.interviewLimit": FREE_QUOTA_DEFAULTS.interviewLimit,
        "quota.interviewQuestionsAllowed": FREE_QUOTA_DEFAULTS.interviewQuestionsAllowed,
        "quota.resetAt": new Date(),
      },
    },
  );
  const mRes = await Mentor.updateMany(
    {},
    {
      $set: {
        "finance.availableBalance": 0,
        "finance.pendingBalance": 0,
        "finance.totalEarned": 0,
      },
    },
  );
  const cRes = await Coupon.updateOne({ code: "LAUNCH50" }, { $set: { usedBy: [] } });

  console.log("\n✅ Hoàn tất:");
  console.log(`  - Payment xóa: ${pRes.deletedCount}`);
  console.log(`  - Booking xóa: ${bRes.deletedCount}`);
  console.log(`  - Enrollment xóa: ${eRes.deletedCount}`);
  console.log(`  - PayoutRequest xóa: ${prRes.deletedCount}`);
  console.log(`  - User reset về free: ${uRes.modifiedCount}`);
  console.log(`  - Mentor.finance reset: ${mRes.modifiedCount}`);
  console.log(`  - Coupon LAUNCH50 reset usedBy: ${cRes.modifiedCount}`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});

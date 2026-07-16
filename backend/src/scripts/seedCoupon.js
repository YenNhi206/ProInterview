/**
 * Tạo/cập nhật 1 mã giảm giá.
 * Chạy: npm run seed:coupon (mặc định LAUNCH50, giảm 50%, hết hạn 2026-08-05)
 * Tùy chỉnh qua env: COUPON_CODE, COUPON_DISCOUNT_VALUE, COUPON_DISCOUNT_TYPE, COUPON_EXPIRES_AT, COUPON_APPLICABLE_TO
 */
import "../config/loadEnv.js";
import mongoose from "mongoose";
import { connectDatabase } from "../db/connect.js";
import { Coupon } from "../models/Coupon.js";

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Thiếu MONGO_URI trong backend/.env");
    process.exit(1);
  }
  await connectDatabase(uri);

  const code = String(process.env.COUPON_CODE || "LAUNCH50").trim().toUpperCase();
  const discountType = process.env.COUPON_DISCOUNT_TYPE === "fixed" ? "fixed" : "percent";
  const discountValue = Number(process.env.COUPON_DISCOUNT_VALUE || 50);
  // Hết hạn cuối ngày 05/08/2026 (giờ VN, UTC+7 → 16:59:59.999 UTC).
  const expiresAt = process.env.COUPON_EXPIRES_AT
    ? new Date(process.env.COUPON_EXPIRES_AT)
    : new Date("2026-08-05T23:59:59+07:00");
  const applicableTo = process.env.COUPON_APPLICABLE_TO
    ? process.env.COUPON_APPLICABLE_TO.split(",").map((s) => s.trim())
    : ["booking", "enrollment", "subscription"];

  const coupon = await Coupon.findOneAndUpdate(
    { code },
    {
      $set: {
        discountType,
        discountValue,
        expiresAt,
        applicableTo,
        isActive: true,
      },
      $setOnInsert: { usedBy: [] },
    },
    { upsert: true, returnDocument: "after" },
  );

  console.log(`Mã "${coupon.code}" — ${coupon.discountType === "percent" ? coupon.discountValue + "%" : coupon.discountValue + "đ"}`);
  console.log(`Áp dụng: ${coupon.applicableTo.join(", ")}`);
  console.log(`Hết hạn: ${coupon.expiresAt?.toISOString()}`);
  console.log(`Trạng thái: ${coupon.isActive ? "đang bật" : "đang tắt"}`);

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

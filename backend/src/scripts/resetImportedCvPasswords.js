import "../config/loadEnv.js";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { connectDatabase } from "../db/connect.js";
import "../models/index.js";
import { User } from "../models/User.js";

// Đổi mật khẩu các tài khoản được tạo qua tính năng "Import CV" (adminController.importUserAndCV)
// đang còn giữ mật khẩu mặc định cũ "Welcome2026!" sang mật khẩu mặc định mới "Prointerview".
// Không có field đánh dấu nguồn tạo tài khoản nên phải bcrypt.compare từng user.

const OLD_DEFAULT_PASSWORD = "Welcome2026!";
const NEW_DEFAULT_PASSWORD = "Prointerview";

async function main() {
  const uri = process.env.MONGO_URI;
  await connectDatabase(uri);

  const newHash = await bcrypt.hash(NEW_DEFAULT_PASSWORD, 10);

  const candidates = await User.find({ role: "customer" }, "_id email passwordHash");
  console.log(`Đang kiểm tra ${candidates.length} tài khoản customer...`);

  let matched = 0;
  for (const user of candidates) {
    if (!user.passwordHash) continue;
    const isOldDefault = await bcrypt.compare(OLD_DEFAULT_PASSWORD, user.passwordHash);
    if (isOldDefault) {
      await User.updateOne({ _id: user._id }, { $set: { passwordHash: newHash } });
      console.log(`  ✓ Đã đổi mật khẩu: ${user.email}`);
      matched += 1;
    }
  }

  console.log(`Hoàn tất. Đã đổi mật khẩu cho ${matched}/${candidates.length} tài khoản.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

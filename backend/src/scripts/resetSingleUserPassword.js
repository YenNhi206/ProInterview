import "../config/loadEnv.js";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { connectDatabase } from "../db/connect.js";
import "../models/index.js";
import { User } from "../models/User.js";

const NEW_PASSWORD = "Prointerview";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Thiếu email. Dùng: node resetSingleUserPassword.js <email>");
    process.exit(1);
  }

  await connectDatabase(process.env.MONGO_URI);

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    console.log("Không tìm thấy user:", email);
    await mongoose.disconnect();
    return;
  }

  user.passwordHash = await bcrypt.hash(NEW_PASSWORD, 10);
  await user.save();

  console.log(`Đã đặt lại mật khẩu cho ${user.email} → "${NEW_PASSWORD}"`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

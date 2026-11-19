/**
 * AI-02: bật một PromptVersion làm bản active của key (bản cũ tự tắt). Có hiệu lực không cần deploy:
 * instance hiện tại xóa cache ngay, instance khác nhận version mới chậm nhất sau 60 giây.
 *
 *   node src/scripts/activatePromptVersion.js <key> <version> [--note "lý do"]
 *   ví dụ: node src/scripts/activatePromptVersion.js evaluation eval-v2 --note "rollback"
 *
 * Template phải đủ phần, đủ biến (activate() render thử trước khi bật); thiếu thì từ chối.
 * DB khác .env (production): đặt TARGET_MONGO_URI trước khi chạy.
 * Gọi trực tiếp bằng node (không qua npm) để tham số không bị PowerShell/npm nuốt.
 */
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";
import { connectDatabase } from "../db/connect.js";
import { activate } from "../services/promptVersionService.js";

export function parseArgs(argv) {
  const args = [...argv];
  let note = "";
  const i = args.indexOf("--note");
  if (i !== -1) {
    note = args[i + 1] ?? "";
    args.splice(i, 2);
  }
  const [key, version] = args;
  return { key, version, note };
}

async function main() {
  // Nạp .env chỉ khi chạy từ dòng lệnh: import module này (test) không bị .env ghi đè biến môi trường.
  await import("../config/loadEnv.js");
  const { key, version, note } = parseArgs(process.argv.slice(2));
  if (!key || !version) {
    console.error('Cách dùng: node src/scripts/activatePromptVersion.js <key> <version> [--note "lý do"]');
    process.exit(1);
  }
  const uri = process.env.TARGET_MONGO_URI?.trim() || process.env.MONGO_URI;
  if (!uri) {
    console.error("Thiếu MONGO_URI (hoặc TARGET_MONGO_URI).");
    process.exit(1);
  }
  const host = uri.replace(/^mongodb(\+srv)?:\/\/([^@/]*@)?/, "").split(/[/?]/)[0];
  console.log(`[PromptVersion] kết nối tới: ${host}`);
  await connectDatabase(uri);
  const doc = await activate(key, version, { by: null, note: note || "Bật bằng script activatePromptVersion" });
  console.log(`Đã bật ${doc.key}/${doc.version} lúc ${doc.activatedAt?.toISOString?.() ?? doc.activatedAt}.`);
  await mongoose.disconnect();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async (e) => {
    console.error(e?.message || e);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  });
}

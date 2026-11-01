/**
 * Chặn thao tác chỉ dành cho dev (seed dữ liệu mẫu, tài khoản Dev123456, …) khi chạy ở production.
 * Script seed import `scripts/_devOnlyGuard.js` (side-effect) — guard đó gọi assertNotProduction.
 */
export function isProduction(env = process.env) {
  return String(env.NODE_ENV || "").trim().toLowerCase() === "production";
}

/**
 * NODE_ENV=production → in lỗi rõ ràng rồi exit(1). `exit` inject được để unit test.
 * @returns {boolean} true nếu được phép chạy tiếp
 */
export function assertNotProduction(scriptName, { env = process.env, exit = process.exit, log = console.error } = {}) {
  if (!isProduction(env)) return true;
  log(
    `❌ ${scriptName || "Script"} bị chặn: NODE_ENV=production.\n` +
      "   Script seed/demo chỉ dành cho môi trường dev/staging — không chạy trên database production.",
  );
  exit(1);
  return false;
}

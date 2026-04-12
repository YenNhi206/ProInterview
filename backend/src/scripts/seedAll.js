/**
 * Seed users (nếu trống), tạo hồ sơ Mentor cho user role mentor; tùy chọn seed mentor legacy.
 */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(__dirname, "..", "..");

execSync("node src/scripts/seedUsers.js", { cwd: backendRoot, stdio: "inherit", env: process.env });
if (process.env.SEED_LEGACY_MENTORS === "1") {
  execSync("node src/scripts/seedMentors.js", { cwd: backendRoot, stdio: "inherit", env: process.env });
}

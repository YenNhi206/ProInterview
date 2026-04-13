/**
 * Seed user dev (nếu collection users trống); hồ sơ mentor chỉ tạo từ user role mentor (không seed mentor giả).
 */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(__dirname, "..", "..");

execSync("node src/scripts/seedUsers.js", { cwd: backendRoot, stdio: "inherit", env: process.env });

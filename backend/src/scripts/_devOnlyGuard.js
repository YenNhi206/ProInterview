/**
 * Import side-effect ở dòng đầu mọi script seed: `import "./_devOnlyGuard.js";`
 * Load .env trước (để đọc đúng NODE_ENV) rồi exit(1) nếu đang ở production.
 */
import { basename } from "node:path";
import "../config/loadEnv.js";
import { assertNotProduction } from "../utils/prodGuard.js";

assertNotProduction(basename(process.argv[1] || "seed script"));

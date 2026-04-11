import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(here, "..", "..");

let envPath = join(backendRoot, ".env");
if (!existsSync(envPath)) {
  const alt = join(backendRoot, "env");
  if (existsSync(alt)) envPath = alt;
}

dotenv.config({
  path: envPath,
  override: true,
});

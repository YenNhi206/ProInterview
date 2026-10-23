import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isProduction, assertNotProduction } from "./prodGuard.js";

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("prodGuard", () => {
  it("isProduction chỉ true khi NODE_ENV=production", () => {
    assert.equal(isProduction({ NODE_ENV: "production" }), true);
    assert.equal(isProduction({ NODE_ENV: " Production " }), true);
    assert.equal(isProduction({ NODE_ENV: "development" }), false);
    assert.equal(isProduction({}), false);
  });

  it("assertNotProduction exit(1) ở production, cho chạy tiếp ở dev", () => {
    const codes = [];
    const exit = (code) => codes.push(code);
    const log = () => {};
    assert.equal(assertNotProduction("seedX", { env: { NODE_ENV: "production" }, exit, log }), false);
    assert.deepEqual(codes, [1]);
    assert.equal(assertNotProduction("seedX", { env: { NODE_ENV: "development" }, exit, log }), true);
    assert.deepEqual(codes, [1]);
  });

  it("script seed thật (seedUsers.js) exit(1) khi NODE_ENV=production, trước khi kết nối DB", () => {
    const res = spawnSync(process.execPath, ["src/scripts/seedUsers.js"], {
      cwd: backendRoot,
      env: { ...process.env, NODE_ENV: "production", MONGO_URI: "mongodb://127.0.0.1:1/never-connect" },
      encoding: "utf8",
      timeout: 30_000,
    });
    assert.equal(res.status, 1);
    assert.match(res.stderr, /NODE_ENV=production/);
  });

  it("seedDemoData() throw ở production", async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const { seedDemoData } = await import("../scripts/seedDemoData.js");
      await assert.rejects(seedDemoData(), /NODE_ENV=production/);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});

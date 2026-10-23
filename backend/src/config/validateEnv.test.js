import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findMissingEnv } from "./validateEnv.js";
import { resolveRefreshPepper } from "../services/authService.js";

const BASE = { MONGO_URI: "mongodb://x", LLM_API_KEY: "k", LLM_BASE_URL: "https://llm" };

describe("validateEnv", () => {
  it("production thiếu JWT_SECRET / REFRESH_TOKEN_PEPPER → critical (server exit 1)", () => {
    const { critical } = findMissingEnv(BASE, { isProd: true });
    assert.deepEqual(critical.map((c) => c.key).sort(), ["JWT_SECRET", "REFRESH_TOKEN_PEPPER"]);
  });

  it("production đủ key → không critical", () => {
    const { critical } = findMissingEnv({ ...BASE, JWT_SECRET: "s", REFRESH_TOKEN_PEPPER: "p" }, { isProd: true });
    assert.deepEqual(critical, []);
  });

  it("dev thiếu JWT_SECRET / pepper chỉ là warning — dev vẫn chạy", () => {
    const { critical, warnings } = findMissingEnv(BASE, { isProd: false });
    assert.deepEqual(critical, []);
    assert.ok(warnings.some((w) => w.key === "JWT_SECRET"));
  });

  it("chuỗi rỗng / khoảng trắng coi như thiếu", () => {
    const { critical } = findMissingEnv({ ...BASE, JWT_SECRET: "  ", REFRESH_TOKEN_PEPPER: "p" }, { isProd: true });
    assert.deepEqual(critical.map((c) => c.key), ["JWT_SECRET"]);
  });
});

describe("resolveRefreshPepper", () => {
  it("production không fallback 'dev' / JWT_SECRET", () => {
    assert.throws(() => resolveRefreshPepper({ NODE_ENV: "production", JWT_SECRET: "s" }), /REFRESH_TOKEN_PEPPER/);
    assert.equal(resolveRefreshPepper({ NODE_ENV: "production", REFRESH_TOKEN_PEPPER: "p" }), "p");
  });

  it("dev giữ fallback cũ", () => {
    assert.equal(resolveRefreshPepper({ NODE_ENV: "development", JWT_SECRET: "s" }), "s");
    assert.equal(resolveRefreshPepper({}), "dev");
  });
});

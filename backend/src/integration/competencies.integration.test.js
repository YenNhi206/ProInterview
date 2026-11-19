/**
 * Integration: GET /api/competencies (LP-01) — bộ tiêu chí SHRM/DDI cho FE.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  applyTestEnv,
  startMongoHarness,
  stopMongoHarness,
  mintAccessToken,
  startHttpServer,
  stopHttpServer,
} from "../test_helpers/mongoTestHarness.js";

applyTestEnv();

let harness;
let http;
let User;
let createApp;

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ createApp } = await import("../app.js"));
  http = await startHttpServer(createApp());
});

after(async () => {
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

function get(token, extraHeaders = {}) {
  return fetch(`${http.baseUrl}/api/competencies`, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extraHeaders,
    },
  });
}

describe("GET /api/competencies", () => {
  it("không có token → 401", async () => {
    const res = await get(null);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
  });

  it("mọi role hiện có đọc được, trả { success, framework } kèm header cache", async () => {
    // company_moderator chưa có trong enum User.role (N-02) nên chưa tạo được user role này.
    for (const role of ["customer", "mentor", "admin", "moderator", "enterprise"]) {
      const u = await User.create({ name: `Comp ${role}`, email: `comp-${role}-${Date.now()}@test.local`, role });
      const res = await get(mintAccessToken(u._id));
      assert.equal(res.status, 200, `role ${role}`);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(typeof body.framework.version, "string");
      assert.equal(body.framework.passThreshold, 3);
      assert.ok(body.framework.competencies.length >= 20);
      assert.match(res.headers.get("cache-control") ?? "", /max-age=\d+/);
      assert.ok(res.headers.get("etag"));
    }
  });

  it("If-None-Match khớp version → 304", async () => {
    const u = await User.create({ name: "Comp etag", email: `comp-etag-${Date.now()}@test.local`, role: "customer" });
    const token = mintAccessToken(u._id);
    const first = await get(token);
    const etag = first.headers.get("etag");
    await first.arrayBuffer();
    const second = await get(token, { "If-None-Match": etag });
    assert.equal(second.status, 304);
  });
});

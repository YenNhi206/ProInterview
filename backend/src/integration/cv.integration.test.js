/**
 * Integration: CV analyses API + MongoDB (memory server).
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
let CVAnalysis;
let createApp;

const SAVE_BODY = {
  cvFileName: "cv-test.pdf",
  jdFileName: "",
  field: "IT / Công nghệ",
  mode: "field",
  tier: "suggestions",
  planAtTime: "free",
  meta: {
    llmProvider: "unknown",
    fallbackTriggered: false,
  },
  result: {
    matchScore: 65,
    matchedKeywords: ["react", "python"],
    missingKeywords: ["docker"],
    skills: {
      cv: [{ name: "react" }, { name: "python" }],
      jd: [],
      matched: ["react", "python"],
      missing: ["docker"],
    },
    scores: {
      clarity: 4,
      structure: 3.5,
      relevance: 4.5,
      credibility: 3,
    },
    suggestions: {
      rewrittenBullets: [],
      missingSkillSuggestions: [],
      executiveSummary: "CV IT khá ổn",
    },
  },
};

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ CVAnalysis } = await import("../models/CVAnalysis.js"));
  ({ createApp } = await import("../app.js"));
  http = await startHttpServer(createApp());
});

after(async () => {
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

async function authHeaders(user) {
  const token = mintAccessToken(user._id);
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

describe("CV API integration (MongoDB)", () => {
  it("POST /api/cv/analyses lưu result và tăng quota", async () => {
    const user = await User.create({
      name: "CV Test",
      email: `cv-int-${Date.now()}@test.local`,
      role: "customer",
      quota: { cvAnalysisUsed: 0, cvAnalysisLimit: 5 },
    });

    const res = await fetch(`${http.baseUrl}/api/cv/analyses`, {
      method: "POST",
      headers: await authHeaders(user),
      body: JSON.stringify(SAVE_BODY),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.analysis?._id);

    const stored = await CVAnalysis.findById(body.analysis._id).lean();
    assert.equal(stored.mode, "field");
    assert.equal(stored.tier, "suggestions");
    assert.equal(stored.result?.match?.score, 65);
    assert.deepEqual(stored.result?.match?.matchedKeywords, ["react", "python"]);

    const refreshed = await User.findById(user._id);
    assert.equal(refreshed.quota.cvAnalysisUsed, 1);
  });

  it("GET list + GET by id + DELETE", async () => {
    const user = await User.create({
      name: "CV List",
      email: `cv-list-${Date.now()}@test.local`,
      quota: { cvAnalysisUsed: 0, cvAnalysisLimit: 5 },
    });

    const created = await CVAnalysis.create({
      userId: user._id,
      cvFileName: "cv.pdf",
      mode: "field",
      tier: "basic",
      status: "completed",
      result: {
        match: { score: 50, matchedKeywords: ["seo"], missingKeywords: [] },
      },
    });

    const listRes = await fetch(`${http.baseUrl}/api/cv/analyses`, {
      headers: await authHeaders(user),
    });
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json();
    assert.ok(listBody.list.some((d) => String(d._id) === String(created._id)));

    const getRes = await fetch(`${http.baseUrl}/api/cv/analyses/${created._id}`, {
      headers: await authHeaders(user),
    });
    assert.equal(getRes.status, 200);
    const getBody = await getRes.json();
    assert.equal(getBody.analysis.mode, "field");
    assert.equal(getBody.analysis.result.match.score, 50);

    const delRes = await fetch(`${http.baseUrl}/api/cv/analyses/${created._id}`, {
      method: "DELETE",
      headers: await authHeaders(user),
    });
    assert.equal(delRes.status, 200);
    const gone = await CVAnalysis.findById(created._id);
    assert.equal(gone, null);
  });

  it("403 khi hết quota", async () => {
    const user = await User.create({
      name: "CV Quota",
      email: `cv-quota-${Date.now()}@test.local`,
      quota: { cvAnalysisUsed: 5, cvAnalysisLimit: 5 },
    });

    const res = await fetch(`${http.baseUrl}/api/cv/analyses`, {
      method: "POST",
      headers: await authHeaders(user),
      body: JSON.stringify(SAVE_BODY),
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.ok(
      body.error === "quota_exceeded" || /hết lượt/i.test(body.error || body.message || ""),
    );
  });

  it("401 không có token", async () => {
    const res = await fetch(`${http.baseUrl}/api/cv/analyses`, {
      method: "GET",
    });
    assert.equal(res.status, 401);
  });

  it("user B không đọc/xóa bản ghi của user A → 404", async () => {
    const userA = await User.create({
      name: "CV Owner",
      email: `cv-owner-${Date.now()}@test.local`,
      quota: { cvAnalysisUsed: 0, cvAnalysisLimit: 5 },
    });
    const userB = await User.create({
      name: "CV Other",
      email: `cv-other-${Date.now()}@test.local`,
      quota: { cvAnalysisUsed: 0, cvAnalysisLimit: 5 },
    });

    const createRes = await fetch(`${http.baseUrl}/api/cv/analyses`, {
      method: "POST",
      headers: await authHeaders(userA),
      body: JSON.stringify(SAVE_BODY),
    });
    assert.equal(createRes.status, 201);
    const { analysis } = await createRes.json();
    const id = analysis._id;

    const getAsB = await fetch(`${http.baseUrl}/api/cv/analyses/${id}`, {
      headers: await authHeaders(userB),
    });
    assert.equal(getAsB.status, 404);

    const delAsB = await fetch(`${http.baseUrl}/api/cv/analyses/${id}`, {
      method: "DELETE",
      headers: await authHeaders(userB),
    });
    assert.equal(delAsB.status, 404);

    const still = await CVAnalysis.findById(id);
    assert.ok(still);
    assert.equal(String(still.userId), String(userA._id));
  });
});

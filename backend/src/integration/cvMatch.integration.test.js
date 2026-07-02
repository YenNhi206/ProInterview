/**
 * Integration: proxy POST /api/cv/analyze/field (mock Python).
 */
import { describe, it, before, after, mock } from "node:test";
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

const MOCK_PYTHON_FIELD = {
  match: {
    matching: ["react"],
    missing: ["aws"],
    match_score: 55,
    summary: { cv_total: 3, jd_total: 2 },
  },
  scores: {
    clarity: { score: 7, reason: "OK" },
    structure: { score: 6, reason: "OK" },
    relevance: { score: 8, reason: "IT" },
    credibility: { score: 5, reason: "OK" },
    overall: 6.5,
    summary: "Mock",
  },
  suggestions: {
    executive_summary: "Mock field analysis",
    missing_skill_suggestions: [],
    rewritten_bullets: [],
  },
  resume_text: "React developer CV",
  jd_text: "",
  field: "IT / Công nghệ",
  fallback: false,
};

let harness;
let http;
let User;
let createApp;
let fetchMock;

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ createApp } = await import("../app.js"));

  const realFetch = globalThis.fetch;
  const analyzerOrigin = new URL(process.env.CV_ANALYZER_URL || "http://127.0.0.1:8000").origin;
  fetchMock = mock.method(globalThis, "fetch", async (url, init) => {
    const u = String(url);
    if (u.startsWith(analyzerOrigin) && u.includes("/analyze/field")) {
      return new Response(JSON.stringify(MOCK_PYTHON_FIELD), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return realFetch(url, init);
  });

  http = await startHttpServer(createApp());
});

after(async () => {
  fetchMock?.mock?.restore();
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

describe("CV analyze/field proxy", () => {
  it("POST /api/cv/analyze/field trả pipeline JSON", async () => {
    const user = await User.create({
      name: "Field Proxy",
      email: `cv-field-${Date.now()}@test.local`,
    });
    const token = mintAccessToken(user._id);

    const pdfBytes = Buffer.from(
      "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n",
      "utf8",
    );
    const form = new FormData();
    form.append("resume", new Blob([pdfBytes], { type: "application/pdf" }), "cv.pdf");
    form.append("field", "IT / Công nghệ");

    const res = await fetch(`${http.baseUrl}/api/cv/analyze/field`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.field, "IT / Công nghệ");
    assert.equal(json.match?.match_score, 55);
    assert.equal(json.resume_text, "React developer CV");
    assert.ok(fetchMock.mock.calls.some((c) => String(c.arguments[0]).includes("/analyze/field")));
  });

  it("400 khi thiếu file resume", async () => {
    const user = await User.create({
      name: "No File",
      email: `cv-nofile-${Date.now()}@test.local`,
    });
    const token = mintAccessToken(user._id);
    const form = new FormData();
    form.append("field", "Marketing");

    const res = await fetch(`${http.baseUrl}/api/cv/analyze/field`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
  });

  it("401 khi không có JWT", async () => {
    const res = await fetch(`${http.baseUrl}/api/cv/analyze/field`, { method: "POST" });
    assert.equal(res.status, 401);
  });

  it("403 quota_exceeded khi user free đã hết lượt — chặn TRƯỚC khi gọi Python (không phải chỉ lúc lưu)", async () => {
    const user = await User.create({
      name: "Quota Exhausted",
      email: `cv-quota-analyze-${Date.now()}@test.local`,
      plan: "free",
      quota: { cvAnalysisUsed: 3, cvAnalysisLimit: 3 },
    });
    const token = mintAccessToken(user._id);

    const pdfBytes = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "utf8");
    const form = new FormData();
    form.append("resume", new Blob([pdfBytes], { type: "application/pdf" }), "cv.pdf");
    form.append("field", "IT / Công nghệ");

    // Chỉ đếm call NỘI BỘ sang Python analyzer (khác host với request HTTP của chính test này
    // tới Express server, vốn cũng chứa substring "/analyze/field" trong URL).
    const analyzerOrigin = new URL(process.env.CV_ANALYZER_URL || "http://127.0.0.1:8000").origin;
    const countAnalyzerCalls = () =>
      fetchMock.mock.calls.filter(
        (c) => String(c.arguments[0]).startsWith(analyzerOrigin) && String(c.arguments[0]).includes("/analyze/field"),
      ).length;
    const analyzeCallsBefore = countAnalyzerCalls();

    const res = await fetch(`${http.baseUrl}/api/cv/analyze/field`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error, "quota_exceeded");
    // Không được gọi sang Python analyzer khi đã chặn ở quota gate.
    assert.equal(countAnalyzerCalls(), analyzeCallsBefore);
  });
});

/**
 * N-11 (NFR-01, NFR-02, AIS-05): mỗi lần phân tích CV chỉ có 1 bản ghi `CVAnalysis`.
 * Xong khi: mỗi lần phân tích chỉ có 1 bản ghi; lỗi hiện `failed`; có log thời gian (`meta.processingTimeMs`).
 */
import { describe, it, before, after, beforeEach, mock } from "node:test";
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

const PYTHON_OK = {
  match: { matching: ["react", "python"], missing: ["docker"], match_score: 72.4, summary: { jd_total: 3 } },
  scores: { overall: 7 },
  suggestions: { executive_summary: "Ổn", missing_skill_suggestions: [], rewritten_bullets: [] },
  resume_text: "CV",
  jd_text: "JD",
};

const SAVE_BODY = {
  cvFileName: "cv.pdf",
  jdFileName: "jd.pdf",
  mode: "jd",
  tier: "basic",
  planAtTime: "free",
  meta: { llmProvider: "unknown", fallbackTriggered: true, pythonEndpoint: "/analyze" },
  result: {
    matchScore: 72,
    matchedKeywords: ["react", "python"],
    missingKeywords: ["docker"],
    skills: { cv: [{ name: "react" }], jd: [], matched: ["react"], missing: ["docker"] },
    _ui: { summary: "Ổn" },
  },
};

const FIELD_SAVE_BODY = {
  cvFileName: "cv.pdf",
  jdFileName: "",
  field: "IT / Công nghệ",
  mode: "field",
  tier: "suggestions",
  planAtTime: "free",
  meta: { llmProvider: "mock", fallbackTriggered: true, pythonEndpoint: "/analyze/field" },
  result: {
    matchScore: 60,
    matchedKeywords: ["react"],
    missingKeywords: [],
    skills: { cv: [], jd: [], matched: [], missing: [] },
    scores: { clarity: 3, structure: 3, relevance: 3, credibility: 3 },
    suggestions: { rewrittenBullets: [], missingSkillSuggestions: [], executiveSummary: "Mẫu" },
  },
};

let harness, http, User, CVAnalysis, fetchMock, userSeq = 0;
/** path Python → `{ status, body }` | `"throw"` */
let pythonResponses = {};

async function newUser(quota = { cvAnalysisUsed: 0, cvAnalysisLimit: 5 }) {
  userSeq += 1;
  return User.create({ name: `N11 ${userSeq}`, email: `n11-${userSeq}@test.local`, plan: "free", quota });
}

const pdf = () => new Blob([Buffer.from("%PDF-1.4\n%%EOF\n")], { type: "application/pdf" });

async function analyze(user, path, { analysisId, withJd = true, field } = {}) {
  const form = new FormData();
  form.append("resume", pdf(), "cv.pdf");
  if (withJd) form.append("jd", pdf(), "jd.pdf");
  if (field) form.append("field", field);
  if (analysisId) form.append("analysisId", analysisId);
  const res = await fetch(`${http.baseUrl}/api/cv${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${mintAccessToken(user._id)}` },
    body: form,
  });
  return { status: res.status, body: await res.json() };
}

async function save(user, body) {
  const res = await fetch(`${http.baseUrl}/api/cv/analyses`, {
    method: "POST",
    headers: { Authorization: `Bearer ${mintAccessToken(user._id)}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function list(user) {
  const res = await fetch(`${http.baseUrl}/api/cv/analyses`, { headers: { Authorization: `Bearer ${mintAccessToken(user._id)}` } });
  return (await res.json()).list;
}

const used = async (user) => (await User.findById(user._id).lean()).quota.cvAnalysisUsed;
const runs = (user) => CVAnalysis.find({ userId: user._id }).lean();

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ CVAnalysis } = await import("../models/CVAnalysis.js"));
  const { createApp } = await import("../app.js");

  const realFetch = globalThis.fetch;
  const analyzerOrigin = new URL(process.env.CV_ANALYZER_URL || "http://127.0.0.1:8000").origin;
  fetchMock = mock.method(globalThis, "fetch", async (url, init) => {
    const u = String(url);
    if (!u.startsWith(analyzerOrigin)) return realFetch(url, init);
    const path = new URL(u).pathname;
    const reply = pythonResponses[path];
    if (!reply || reply === "throw") throw new TypeError("fetch failed: ECONNREFUSED");
    if (reply.during) await reply.during();
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { "Content-Type": "application/json" } });
  });
  http = await startHttpServer(createApp());
});

after(async () => {
  fetchMock?.mock?.restore();
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

beforeEach(() => {
  pythonResponses = {};
});

describe("Một lần phân tích = một bản ghi (N-11)", () => {
  it("Python trả kết quả: bản ghi completed có điểm, thời gian, trừ 1 lượt; FE lưu đè vào chính bản ghi đó", async () => {
    pythonResponses["/analyze/suggestions"] = { status: 200, body: PYTHON_OK };
    const user = await newUser();

    const res = await analyze(user, "/analyze/suggestions");
    assert.equal(res.status, 200);
    assert.equal(res.body.match.match_score, 72.4, "phản hồi Python giữ nguyên");
    assert.match(res.body.analysisId, /^[a-f0-9]{24}$/);

    let docs = await runs(user);
    assert.equal(docs.length, 1);
    const run = docs[0];
    assert.equal(String(run._id), res.body.analysisId);
    assert.equal(run.status, "completed");
    assert.equal(run.tier, "suggestions");
    assert.equal(run.meta.pythonEndpoint, "/analyze/suggestions");
    assert.equal(typeof run.meta.processingTimeMs, "number");
    assert.equal(run.result.match.score, 72);
    assert.deepEqual(run.result.match.missingKeywords, ["docker"]);
    assert.equal(run.quotaCharged, true);
    assert.equal(await used(user), 1);

    const saved = await save(user, { ...SAVE_BODY, analysisId: res.body.analysisId, meta: { ...SAVE_BODY.meta, processingTimeMs: 1 } });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(String(saved.body.analysis._id), res.body.analysisId);

    docs = await runs(user);
    assert.equal(docs.length, 1, "lưu không tạo bản ghi thứ hai");
    assert.equal(docs[0].status, "completed");
    assert.equal(docs[0].result._ui.summary, "Ổn");
    assert.equal(docs[0].meta.processingTimeMs, run.meta.processingTimeMs, "giữ thời gian đo ở server, không lấy số FE gửi");
    assert.equal(await used(user), 1, "không trừ lượt lần hai");
    assert.equal((await list(user)).length, 1);
  });

  it("chuỗi suggestions → full → basic dùng chung một bản ghi; tier/endpoint theo bậc cuối", async () => {
    pythonResponses["/analyze/suggestions"] = { status: 503, body: { detail: "LLM bận" } };
    pythonResponses["/analyze/full"] = { status: 503, body: { detail: "LLM bận" } };
    pythonResponses["/analyze"] = { status: 200, body: PYTHON_OK };
    const user = await newUser();

    const r1 = await analyze(user, "/analyze/suggestions");
    assert.equal(r1.status, 503);
    assert.equal((await CVAnalysis.findById(r1.body.analysisId).lean()).status, "failed");
    const r2 = await analyze(user, "/analyze/full", { analysisId: r1.body.analysisId });
    assert.equal(r2.body.analysisId, r1.body.analysisId);
    const r3 = await analyze(user, "/analyze", { analysisId: r2.body.analysisId });
    assert.equal(r3.status, 200);
    assert.equal(r3.body.analysisId, r1.body.analysisId);

    const docs = await runs(user);
    assert.equal(docs.length, 1);
    assert.equal(docs[0].status, "completed");
    assert.equal(docs[0].tier, "basic");
    assert.equal(docs[0].meta.pythonEndpoint, "/analyze");
    assert.equal(docs[0].error, undefined, "xóa lỗi của bậc trước");
    assert.equal(await used(user), 1, "chỉ trừ 1 lượt cho cả chuỗi");

    const saved = await save(user, { ...SAVE_BODY, analysisId: r3.body.analysisId });
    assert.equal(saved.status, 200);
    assert.equal((await runs(user)).length, 1);
    assert.equal(await used(user), 1);
  });

  it("Python không chạy: bản ghi failed có lỗi và thời gian, không trừ lượt, không hiện trong lịch sử", async () => {
    pythonResponses["/analyze/suggestions"] = "throw";
    const user = await newUser();

    const res = await analyze(user, "/analyze/suggestions");
    assert.equal(res.status, 503);
    assert.equal(res.body.success, false);
    assert.ok(res.body.error);
    assert.ok(res.body.analysisId);

    const docs = await runs(user);
    assert.equal(docs.length, 1);
    assert.equal(docs[0].status, "failed");
    assert.match(docs[0].error, /fetch_failed/);
    assert.equal(typeof docs[0].meta.processingTimeMs, "number");
    assert.equal(docs[0].result, undefined);
    assert.equal(await used(user), 0);
    assert.equal((await list(user)).length, 0, "lịch sử chỉ có bản phân tích đã xong");
  });

  it("Python trả lỗi 4xx/5xx thường: failed kèm chi tiết lỗi Python", async () => {
    pythonResponses["/analyze/field"] = { status: 422, body: { detail: "PDF không đọc được" } };
    const user = await newUser();
    const res = await analyze(user, "/analyze/field", { withJd: false, field: "Marketing" });
    assert.equal(res.status, 422);
    const doc = await CVAnalysis.findById(res.body.analysisId).lean();
    assert.equal(doc.status, "failed");
    assert.equal(doc.error, "PDF không đọc được");
    assert.equal(doc.mode, "field");
    assert.equal(doc.field, "Marketing");
  });

  it("theo ngành: Python lỗi, FE rơi về dữ liệu mẫu và lưu đè vào bản ghi failed → completed, trừ 1 lượt", async () => {
    pythonResponses["/analyze/field"] = { status: 500, body: { detail: "boom" } };
    const user = await newUser();
    const res = await analyze(user, "/analyze/field", { withJd: false, field: "IT / Công nghệ" });
    assert.equal(res.status, 500);
    assert.equal(await used(user), 0);

    const saved = await save(user, { ...FIELD_SAVE_BODY, analysisId: res.body.analysisId });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const docs = await runs(user);
    assert.equal(docs.length, 1);
    assert.equal(docs[0].status, "completed");
    assert.equal(docs[0].meta.fallbackTriggered, true);
    assert.equal(docs[0].error, undefined);
    assert.equal(await used(user), 1);
  });

  it("hết lượt giữa chừng (đa tab): Python xong nhưng không trừ được lượt → 403 và bản ghi failed", async () => {
    const user = await newUser({ cvAnalysisUsed: 0, cvAnalysisLimit: 1 });
    // Tab khác dùng nốt lượt trong lúc Python đang chạy.
    pythonResponses["/analyze/suggestions"] = {
      status: 200,
      body: PYTHON_OK,
      during: () => User.updateOne({ _id: user._id }, { $set: { "quota.cvAnalysisUsed": 1 } }),
    };
    const res = await analyze(user, "/analyze/suggestions");
    assert.equal(res.status, 403);
    assert.equal(res.body.error, "quota_exceeded");
    const doc = await CVAnalysis.findById(res.body.analysisId).lean();
    assert.equal(doc.status, "failed");
    assert.equal(doc.error, "quota_exceeded");
    assert.equal(doc.quotaCharged, false);
    assert.equal(await used(user), 1);
  });

  it("analysisId của người khác hoặc đã xong không bị dùng lại", async () => {
    pythonResponses["/analyze"] = { status: 200, body: PYTHON_OK };
    const owner = await newUser();
    const other = await newUser();
    const first = await analyze(owner, "/analyze");
    assert.equal(first.status, 200);

    // Đã completed → lần phân tích mới tạo bản ghi mới.
    const second = await analyze(owner, "/analyze", { analysisId: first.body.analysisId });
    assert.notEqual(second.body.analysisId, first.body.analysisId);
    assert.equal((await runs(owner)).length, 2);

    // Người khác gửi id của owner → bản ghi riêng của người đó.
    const stolen = await analyze(other, "/analyze", { analysisId: first.body.analysisId });
    assert.notEqual(stolen.body.analysisId, first.body.analysisId);
    assert.equal((await runs(owner)).length, 2);

    const saveOther = await save(other, { ...SAVE_BODY, analysisId: first.body.analysisId });
    assert.equal(saveOther.status, 404);
    const wrongMode = await save(owner, { ...FIELD_SAVE_BODY, analysisId: first.body.analysisId });
    assert.equal(wrongMode.status, 400);
  });

  it("lưu không có analysisId vẫn tạo bản ghi mới và trừ lượt như cũ", async () => {
    const user = await newUser();
    const saved = await save(user, SAVE_BODY);
    assert.equal(saved.status, 201);
    assert.equal(await used(user), 1);
    const doc = await CVAnalysis.findById(saved.body.analysis._id).lean();
    assert.equal(doc.quotaCharged, true);
  });
});

describe("Bản ghi đang chạy / lỗi không lọt vào thống kê (N-11)", () => {
  it("dashboard ứng viên, tài liệu mentorship, thống kê admin chỉ đếm bản đã xong", async () => {
    const user = await newUser();
    const admin = await User.create({ name: "Admin N11", email: `n11-admin-${Date.now()}@test.local`, role: "admin" });
    const base = { userId: user._id, mode: "jd", tier: "basic", jdFileName: "jd.pdf" };
    await CVAnalysis.create({ ...base, cvFileName: "done.pdf", cvFileUrl: "/uploads/done.pdf", status: "completed", result: { match: { score: 70 } } });
    await CVAnalysis.create({ ...base, cvFileName: "running.pdf", cvFileUrl: "/uploads/running.pdf", status: "processing" });
    await CVAnalysis.create({ ...base, cvFileName: "broken.pdf", cvFileUrl: "/uploads/broken.pdf", status: "failed", error: "boom" });
    const auth = (u) => ({ headers: { Authorization: `Bearer ${mintAccessToken(u._id)}` } });

    const dash = await (await fetch(`${http.baseUrl}/api/users/dashboard-stats`, auth(user))).json();
    assert.equal(dash.success, true, JSON.stringify(dash));
    assert.equal(dash.stats.cvAnalysesCount, 1);
    assert.equal(dash.stats.cvBestMatchScore, 70);

    const docs = await (await fetch(`${http.baseUrl}/api/mentorship-requests/documents`, auth(user))).json();
    assert.equal(docs.success, true, JSON.stringify(docs));
    const names = docs.documents.filter((d) => d.source === "Phân tích CV" && d.kind === "cv").map((d) => d.name);
    assert.deepEqual(names, ["done.pdf"]);

    const content = await (await fetch(`${http.baseUrl}/api/admin/content/stats`, auth(admin))).json();
    assert.equal(content.success, true, JSON.stringify(content));
    const expected = await CVAnalysis.countDocuments({ status: { $nin: ["processing", "failed"] } });
    assert.equal(content.content.cvAnalyses, expected);
    assert.ok(expected < (await CVAnalysis.countDocuments()), "có bản ghi processing/failed bị loại");
  });
});

/**
 * Integration PR-05: POST /api/cv/best-fit — Node kiểm quyền, lấy chữ / file từng CV, JD từ text hoặc
 * job, gọi Python /best-fit (giả lập). "Xong khi": 3 CV trả kết quả trong ≤ 60 giây.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";
process.env.CV_ANALYZER_URL = "http://cv.stub.local";

const UPLOAD_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public/uploads");
const FILE_KEY = `cv_test_pr05_${process.pid}.txt`;

let harness, http, models;
const realFetch = globalThis.fetch;
let pyCalls = [];
let pyReply = null;
let seq = 0;

const JD = "Tuyển Backend Engineer: Python, Docker, PostgreSQL, Kubernetes, REST API, CI/CD.";

before(async () => {
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith("http://cv.stub.local")) {
      const form = init.body;
      const items = JSON.parse(form.get("items"));
      const files = await Promise.all(form.getAll("files").map(async (f) => ({ name: f.name, text: await f.text() })));
      pyCalls.push({ url: String(url), jdText: form.get("jd_text"), items, files });
      if (pyReply instanceof Error) throw pyReply;
      const body = pyReply ?? {
        mode: "llm",
        elapsed_ms: 1200,
        jd_skills: ["python"],
        ranking: items.map((it, i) => ({
          id: it.id, title: it.title, rank: i + 1, score: 90 - i * 10, skill_score: 80, llm_score: 95 - i * 10,
          reason: `Lý do ${i + 1}`, strengths: ["Python"], gaps: [], matching_skills: ["python"], missing_skills: [], error: null,
        })),
      };
      return new Response(JSON.stringify(body), { status: pyReply?.status ?? 200, headers: { "Content-Type": "application/json" } });
    }
    return realFetch(url, init);
  };
  harness = await startMongoHarness();
  models = await import("../models/index.js");
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_ROOT, FILE_KEY), "Backend engineer: Python, Docker, Kubernetes");
  http = await startHttpServer((await import("../app.js")).createApp());
});

after(async () => {
  globalThis.fetch = realFetch;
  await fs.rm(path.join(UPLOAD_ROOT, FILE_KEY), { force: true });
  if (http) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

beforeEach(() => {
  pyCalls = [];
  pyReply = null;
});

async function candidate() {
  seq += 1;
  return models.User.create({ name: `PR05 ${seq}`, email: `pr05-${seq}@test.local`, role: "customer" });
}

function post(user, body) {
  return fetch(`${http.baseUrl}/api/cv/best-fit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${mintAccessToken(user._id)}` },
    body: JSON.stringify(body),
  }).then(async (res) => ({ status: res.status, ...(await res.json()) }));
}

async function threeCvs(user) {
  const uploaded = await models.CVDocument.create({
    userId: user._id, title: "CV tải lên", fileName: "cv.txt", fileKey: FILE_KEY, fileUrl: `/uploads/${FILE_KEY}`, mimeType: "text/plain",
  });
  const edited = await models.CVDocument.create({
    userId: user._id, title: "CV soạn sẵn", fileUrl: "",
    content: { summary: "Kỹ sư backend", skills: ["Python", "Docker"], experiences: [{ company: "ACME", position: "Backend", bullets: ["Giảm 40% độ trễ"] }] },
  });
  const missingFile = await models.CVDocument.create({
    userId: user._id, title: "CV mất file", fileUrl: "/uploads/khong_ton_tai.pdf", fileKey: "khong_ton_tai.pdf",
  });
  return [uploaded, edited, missingFile];
}

describe("POST /api/cv/best-fit (PR-05)", () => {
  it("3 CV + JD text: gửi file / nội dung đúng cho Python, trả xếp hạng kèm lý do trong ≤ 60 giây", async () => {
    const user = await candidate();
    const [uploaded, edited, missingFile] = await threeCvs(user);
    const started = Date.now();
    const res = await post(user, { cvIds: [uploaded, edited, missingFile].map((c) => String(c._id)), jdText: JD });
    assert.ok(Date.now() - started < 60_000);
    assert.equal(res.status, 200, JSON.stringify(res));

    assert.equal(pyCalls.length, 1);
    const call = pyCalls[0];
    assert.equal(call.url, "http://cv.stub.local/best-fit");
    assert.equal(call.jdText, JD);
    assert.equal(call.items[0].file_index, 0);
    assert.equal(call.files[0].text, "Backend engineer: Python, Docker, Kubernetes");
    assert.match(call.items[1].text, /Kỹ năng: Python, Docker/);
    assert.match(call.items[1].text, /Giảm 40% độ trễ/);
    assert.equal(call.items[2].file_index, undefined, "file mất thì gửi nội dung (rỗng), Python báo lỗi");

    const { bestFit } = res;
    assert.equal(bestFit.mode, "ai");
    assert.equal(bestFit.ranking.length, 3);
    assert.equal(bestFit.bestCvId, String(uploaded._id));
    assert.deepEqual(bestFit.jdSource, { type: "text" });
    for (const r of bestFit.ranking) {
      assert.ok(r.reason);
      assert.equal(typeof r.score, "number");
      assert.ok(r.title);
    }
  });

  it("JD lấy từ job đang mở", async () => {
    const user = await candidate();
    const [a, b] = await threeCvs(user);
    const company = await models.Company.create({ name: "Công ty PR05", slug: `pr05-co-${seq}` });
    const job = await models.JobPost.create({
      companyId: company._id, title: "Backend PR05", roleCategory: "backend", level: "middle",
      description: "Xây dựng dịch vụ backend cho nền tảng thanh toán, tối ưu hiệu năng và độ tin cậy.",
      requiredCompetencies: [{ shrmKey: "problem_solving", minLevel: 3 }], requiredSkills: ["Python", "Docker"],
      status: "published", publishedAt: new Date(),
    });
    const res = await post(user, { cvIds: [String(a._id), String(b._id)], jobPostId: String(job._id) });
    assert.equal(res.status, 200);
    assert.equal(res.bestFit.jdSource.type, "job");
    assert.match(pyCalls[0].jdText, /Backend PR05 — Công ty PR05/);
    assert.match(pyCalls[0].jdText, /Kỹ năng yêu cầu: Python, Docker/);
    assert.match(pyCalls[0].jdText, /mức 3\/5/);
  });

  it("kiểm đầu vào và quyền: < 2 CV, trùng, thiếu JD, CV người khác, job đóng", async () => {
    const user = await candidate();
    const other = await candidate();
    const [a, b] = await threeCvs(user);
    const [foreign] = await threeCvs(other);
    const id = (x) => String(x._id);

    assert.equal((await post(user, { cvIds: [id(a)], jdText: JD })).status, 400);
    assert.equal((await post(user, { cvIds: [id(a), id(a)], jdText: JD })).status, 400);
    const noJd = await post(user, { cvIds: [id(a), id(b)] });
    assert.equal(noJd.status, 400);
    assert.match(noJd.error, /mô tả công việc|tin tuyển dụng/i);
    assert.equal((await post(user, { cvIds: [id(a), id(b)], jdText: "ngắn" })).status, 400);
    assert.equal((await post(user, { cvIds: [id(a), id(foreign)], jdText: JD })).status, 404);
    const company = await models.Company.create({ name: "Co đóng", slug: `pr05-closed-${seq}` });
    const closed = await models.JobPost.create({
      companyId: company._id, title: "Job đóng", roleCategory: "backend", level: "middle", description: JD, status: "closed",
    });
    assert.equal((await post(user, { cvIds: [id(a), id(b)], jobPostId: id(closed) })).status, 404);
    assert.equal(pyCalls.length, 0, "lỗi đầu vào không gọi Python");
  });

  it("Python không kết nối được → 503; Python 400 → 400 kèm thông báo", async () => {
    const user = await candidate();
    const [a, b] = await threeCvs(user);
    pyReply = new TypeError("fetch failed");
    const down = await post(user, { cvIds: [String(a._id), String(b._id)], jdText: JD });
    assert.equal(down.status, 503);
    assert.equal(down.success, false);

    pyReply = Object.assign({ detail: "Mô tả công việc quá ngắn (tối thiểu 30 ký tự)." }, { status: 400 });
    const bad = await post(user, { cvIds: [String(a._id), String(b._id)], jdText: JD });
    assert.equal(bad.status, 400);
    assert.match(bad.error, /quá ngắn/);
  });

  it("hết lượt phân tích CV → 403", async () => {
    const user = await candidate();
    await models.User.updateOne({ _id: user._id }, { $set: { "quota.cvAnalysisUsed": 3, "quota.cvAnalysisLimit": 3 } });
    const [a, b] = await threeCvs(user);
    const res = await post(user, { cvIds: [String(a._id), String(b._id)], jdText: JD });
    assert.equal(res.status, 403);
  });
});

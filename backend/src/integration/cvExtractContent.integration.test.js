/**
 * Integration PR-08: POST /api/cvs/:id/extract-content — Node kiểm quyền, đọc tệp CV gốc, gọi Python
 * /extract-content (giả lập), trả `content` cho editor, không ghi DB.
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
const FILE_KEY = `cv_test_pr08_${process.pid}.txt`;
const FILE_TEXT = "NGUYỄN AN\nKINH NGHIỆM\nCông ty A — Dev (2020 - 2022)";

const CONTENT = {
  personalInfo: { fullName: "Nguyễn An", email: "", phone: "", location: "", website: "", linkedin: "", github: "" },
  summary: "",
  experiences: [{ company: "Công ty A", position: "Dev", startDate: "2020", endDate: "2022", isCurrent: false, description: "", bullets: [] }],
  educations: [],
  skills: ["Python"],
  projects: [],
  certifications: [],
};

let harness, http, models;
const realFetch = globalThis.fetch;
let pyCalls = [];
let pyReply = null;
let seq = 0;

before(async () => {
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith("http://cv.stub.local")) {
      const file = init.body.get("file");
      pyCalls.push({ url: String(url), name: file.name, text: await file.text() });
      if (pyReply instanceof Error) throw pyReply;
      const body = pyReply?.body ?? { content: CONTENT, method: "llm", sections: ["personalInfo", "experiences", "skills"], text_chars: 50 };
      return new Response(JSON.stringify(body), { status: pyReply?.status ?? 200, headers: { "Content-Type": "application/json" } });
    }
    return realFetch(url, init);
  };
  harness = await startMongoHarness();
  models = await import("../models/index.js");
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_ROOT, FILE_KEY), FILE_TEXT);
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
  return models.User.create({ name: `PR08 ${seq}`, email: `pr08-${seq}@test.local`, role: "customer" });
}

function uploadedCv(user, extra = {}) {
  return models.CVDocument.create({
    userId: user._id, title: "CV tải lên", fileName: "cv.txt", fileKey: FILE_KEY, fileUrl: `/uploads/${FILE_KEY}`, mimeType: "text/plain",
    ...extra,
  });
}

function extract(user, cvId) {
  return fetch(`${http.baseUrl}/api/cvs/${cvId}/extract-content`, {
    method: "POST",
    headers: { Authorization: `Bearer ${mintAccessToken(user._id)}` },
  }).then(async (res) => ({ status: res.status, ...(await res.json()) }));
}

describe("POST /api/cvs/:id/extract-content (PR-08)", () => {
  it("gửi tệp gốc sang Python, trả content cho editor và không ghi DB", async () => {
    const user = await candidate();
    const cv = await uploadedCv(user);
    const res = await extract(user, cv._id);
    assert.equal(res.status, 200, JSON.stringify(res));

    assert.equal(pyCalls.length, 1);
    assert.equal(pyCalls[0].url, "http://cv.stub.local/extract-content");
    assert.equal(pyCalls[0].name, "cv.txt");
    assert.equal(pyCalls[0].text, FILE_TEXT);

    assert.equal(res.extracted.method, "llm");
    assert.deepEqual(res.extracted.sections, ["personalInfo", "experiences", "skills"]);
    assert.equal(res.extracted.content.experiences[0].company, "Công ty A");
    assert.equal(res.extracted.cvVersion, 1);

    const after = await models.CVDocument.findById(cv._id).lean();
    assert.equal(after.version, 1);
    assert.deepEqual(after.content.experiences, []);
  });

  it("CV của người khác → 404, không gọi Python", async () => {
    const owner = await candidate();
    const other = await candidate();
    const cv = await uploadedCv(owner);
    const res = await extract(other, cv._id);
    assert.equal(res.status, 404);
    assert.equal(pyCalls.length, 0);
  });

  it("CV soạn trong editor không có tệp → 400", async () => {
    const user = await candidate();
    const cv = await models.CVDocument.create({ userId: user._id, title: "CV soạn", fileUrl: "" });
    const res = await extract(user, cv._id);
    assert.equal(res.status, 400);
    assert.match(res.error, /không có tệp/);
  });

  it("tệp gốc mất trên đĩa → 404 tiếng Việt", async () => {
    const user = await candidate();
    const cv = await uploadedCv(user, { fileKey: "khong_ton_tai.pdf", fileUrl: "/uploads/khong_ton_tai.pdf", fileName: "cv.pdf" });
    const res = await extract(user, cv._id);
    assert.equal(res.status, 404);
    assert.match(res.error, /Không đọc được tệp CV gốc/);
  });

  it("mã CV sai định dạng → 400", async () => {
    const user = await candidate();
    const res = await extract(user, "abc");
    assert.equal(res.status, 400);
  });

  it("Python trả 400 → giữ thông báo của Python", async () => {
    const user = await candidate();
    const cv = await uploadedCv(user);
    pyReply = { status: 400, body: { detail: "File không có chữ đọc được để tách nội dung." } };
    const res = await extract(user, cv._id);
    assert.equal(res.status, 400);
    assert.equal(res.error, "File không có chữ đọc được để tách nội dung.");
  });

  it("Python không kết nối được → 503", async () => {
    const user = await candidate();
    const cv = await uploadedCv(user);
    pyReply = new TypeError("fetch failed");
    const res = await extract(user, cv._id);
    assert.equal(res.status, 503);
  });
});

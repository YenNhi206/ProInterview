/**
 * CO-06: câu công ty đã duyệt → render trước video avatar (× 2 giới tính) để buổi luyện theo job
 * trúng cache, không gọi provider video. Từ CO-05 (quyết định CO-16), Company Mod duyệt chỉ đưa câu
 * sang `pending_platform_review` và không render; CO-16 gọi warm lúc Platform Mod duyệt.
 *
 * Phần lớn test thay hàm pregen bằng bản giả (__setCompanyVideoPregenForTest).
 * Test cuối chạy pipeline thật của avatarService với fetch tới api.d-id.com bị chặn, để chứng
 * minh lần gọi sau với cùng câu không tạo job D-ID nào.
 */
import { describe, it, before, after, beforeEach, afterEach } from "node:test";
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
let Company;
let QuestionBank;
let hashQuestionText;
let videoSvc;

let companyA;
let companyB;
let modA;
let pregenCalls;

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ Company } = await import("../models/Company.js"));
  ({ QuestionBank, hashQuestionText } = await import("../models/QuestionBank.js"));
  videoSvc = await import("../services/companyQuestionVideoService.js");
  await QuestionBank.init();
  const { createApp } = await import("../app.js");
  http = await startHttpServer(createApp());

  const stamp = Date.now();
  companyA = await Company.create({ name: "Công ty A", slug: `video-a-${stamp}`, status: "active" });
  companyB = await Company.create({ name: "Công ty B", slug: `video-b-${stamp}`, status: "active" });
  modA = await User.create({ name: "HR A", email: `video-hr-a-${stamp}@test.local`, role: "company_moderator", companyId: companyA._id });
});

after(async () => {
  videoSvc?.__setCompanyVideoPregenForTest(null);
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

beforeEach(async () => {
  await QuestionBank.deleteMany({});
  pregenCalls = [];
  videoSvc.__setCompanyVideoPregenForTest(async (questions, opts) => {
    pregenCalls.push({ questions: [...questions], gender: opts.gender, persistVideo: opts.persistVideo });
    return { videoUrls: questions.map(() => "https://cdn.test/v.mp4"), errors: [], cacheHits: 0, durationMs: 1 };
  });
});

afterEach(() => {
  videoSvc.__setCompanyVideoPregenForTest(null);
});

const headers = (userId) => ({
  Authorization: `Bearer ${mintAccessToken(userId)}`,
  "Content-Type": "application/json",
  Accept: "application/json",
});

function call(method, path, body) {
  return fetch(`${http.baseUrl}/api/company${path}`, {
    method,
    headers: headers(modA._id),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function seedQuestion(text, { orgId = companyA._id, status = "draft" } = {}) {
  return QuestionBank.create({
    text,
    originalText: text,
    textHash: hashQuestionText(text),
    orgId,
    source: "org_template",
    roleCategory: "software_engineer",
    competencyId: "teamwork",
    status,
  });
}

/** Các text đã warm, theo giới tính. */
function warmedBy(gender) {
  return pregenCalls.filter((c) => c.gender === gender).flatMap((c) => c.questions);
}

describe("CO-06 — warm video cho câu công ty đã duyệt", () => {
  it("câu đã duyệt → render cả 2 giới tính, persistVideo bật", async () => {
    const q = await seedQuestion("Kể về lần bạn xử lý xung đột trong nhóm?", { status: "approved" });
    videoSvc.scheduleCompanyQuestionVideoWarm([q]);
    await videoSvc.whenCompanyVideoWarmIdle();

    assert.deepEqual(warmedBy("male"), [q.text]);
    assert.deepEqual(warmedBy("female"), [q.text]);
    assert.ok(pregenCalls.every((c) => c.persistVideo === true));
  });

  it("câu nháp, chờ Platform Mod, bị từ chối hoặc câu pool chung → không render", async () => {
    const qs = [
      await seedQuestion("Câu nháp?"),
      await seedQuestion("Câu chờ Platform Mod?", { status: "pending_platform_review" }),
      await seedQuestion("Câu bị từ chối?", { status: "rejected" }),
      await seedQuestion("Câu pool chung?", { orgId: null, status: "approved" }),
    ];
    videoSvc.scheduleCompanyQuestionVideoWarm(qs);
    await videoSvc.whenCompanyVideoWarmIdle();
    assert.equal(pregenCalls.length, 0);
  });

  it("CO-05: Company Mod duyệt, duyệt hàng loạt, tự thêm, sửa câu → không render (chờ Platform Mod, CO-16)", async () => {
    const single = await seedQuestion("Câu duyệt lẻ?");
    const batch = [await seedQuestion("Câu hàng loạt 1?"), await seedQuestion("Câu hàng loạt 2?")];
    const approved = await seedQuestion("Câu đã được Platform Mod duyệt?", { status: "approved" });

    assert.equal((await call("POST", `/questions/${single._id}/approve`, {})).status, 200);
    assert.equal((await call("POST", "/questions/batch-approve", { ids: batch.map((q) => q._id) })).status, 200);
    assert.equal((await call("POST", "/questions", { text: "Câu tự thêm?", competencyId: "teamwork" })).status, 201);
    assert.equal((await call("PATCH", `/questions/${approved._id}`, { text: "Câu đã duyệt sau khi sửa?" })).status, 200);
    await videoSvc.whenCompanyVideoWarmIdle();

    assert.equal(pregenCalls.length, 0);
  });

  it("duyệt hàng loạt theo id → chỉ render câu đã duyệt của chính công ty, chia lô tối đa WARM_CHUNK_SIZE", async () => {
    const own = [];
    for (let i = 1; i <= 4; i += 1) own.push(await seedQuestion(`Câu hàng loạt số ${i}?`, { status: "approved" }));
    const pending = await seedQuestion("Câu chưa qua Platform Mod?", { status: "pending_platform_review" });
    const other = await seedQuestion("Câu của công ty B?", { orgId: companyB._id, status: "approved" });

    videoSvc.scheduleCompanyQuestionVideoWarmByIds([...own.map((q) => q._id), pending._id, other._id], companyA._id);
    await videoSvc.whenCompanyVideoWarmIdle();

    const male = warmedBy("male");
    assert.deepEqual([...male].sort(), own.map((q) => q.text).sort());
    assert.deepEqual([...warmedBy("female")].sort(), own.map((q) => q.text).sort());
    assert.ok(pregenCalls.every((c) => c.questions.length <= videoSvc.WARM_CHUNK_SIZE));
    assert.equal(pregenCalls.length, 4); // 4 câu = 2 lô × 2 giới tính
  });

  it("lỗi render chỉ ghi log, không ném lỗi ra ngoài", async () => {
    videoSvc.__setCompanyVideoPregenForTest(async () => {
      throw new Error("provider down");
    });
    const q = await seedQuestion("Câu khi provider lỗi?", { status: "approved" });
    videoSvc.scheduleCompanyQuestionVideoWarm([q]);
    await videoSvc.whenCompanyVideoWarmIdle();
    const saved = await QuestionBank.findById(q._id).lean();
    assert.equal(saved.status, "approved");
  });

  it("listApprovedCompanyQuestionTexts chỉ lấy câu công ty đã duyệt (script backfill)", async () => {
    await seedQuestion("Câu công ty đã duyệt?", { status: "approved" });
    await seedQuestion("Câu công ty nháp?");
    await seedQuestion("Câu công ty chờ Platform Mod?", { status: "pending_platform_review" });
    await seedQuestion("Câu pool chung đã duyệt?", { orgId: null, status: "approved" });
    assert.deepEqual(await videoSvc.listApprovedCompanyQuestionTexts(), ["Câu công ty đã duyệt?"]);
  });
});

describe("CO-06 — câu đã warm thì buổi luyện không gọi provider video", () => {
  const saved = {};
  const ENV_KEYS = ["D_ID_API_KEY", "MOCK_AI", "MOCK_AI_SERVICES", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID_MALE", "ELEVENLABS_VOICE_ID_FEMALE", "CLOUDINARY_URL"];
  let originalFetch;
  let didCalls;

  beforeEach(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    for (const k of ENV_KEYS) delete process.env[k];
    process.env.D_ID_API_KEY = "test-key";
    videoSvc.__setCompanyVideoPregenForTest(null); // dùng pipeline thật của avatarService

    didCalls = [];
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init = {}) => {
      const url = String(input?.url ?? input);
      if (url.startsWith("https://api.d-id.com/talks")) {
        didCalls.push({ method: init.method ?? "GET", url });
        if ((init.method ?? "GET") === "POST") {
          return new Response(JSON.stringify({ id: `tlk_${didCalls.length}` }), { status: 201 });
        }
        return new Response(JSON.stringify({ status: "done", result_url: "https://d-id.test/result.mp4" }), { status: 200 });
      }
      // Mirror Cloudinary: trả 404 để không ghi file nào trong test (cache link gốc TTL ngắn).
      if (url.startsWith("https://d-id.test/")) return new Response("", { status: 404 });
      return originalFetch(input, init);
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("warm câu đã duyệt → 2 job D-ID; pregen lại cùng câu (buổi luyện) → 0 job, trúng cache", async () => {
    const text = `Câu kiểm tra cache CO-06 ${Date.now()}?`;
    const q = await seedQuestion(text, { status: "approved" });
    videoSvc.scheduleCompanyQuestionVideoWarm([q]);
    await videoSvc.whenCompanyVideoWarmIdle();

    const creates = didCalls.filter((c) => c.method === "POST");
    assert.equal(creates.length, 2, "render 1 lần cho mỗi giới tính");

    const { pregenerateSync } = await import("../services/videoPregenService.js");
    didCalls = [];
    for (const gender of ["male", "female"]) {
      const result = await pregenerateSync([text], { gender, persistVideo: true });
      assert.equal(result.cacheHits, 1);
      assert.equal(result.videoUrls[0], "https://d-id.test/result.mp4");
    }
    assert.equal(didCalls.length, 0, "không gọi provider video khi đã có cache");
  });
});

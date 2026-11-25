/**
 * Integration AI-18: miner đề xuất `rubric_anchor` từ rubric công ty đã duyệt (ẩn danh).
 * "Xong khi": ≥ 3 công ty cùng `shrmKey` → đúng 1 đề xuất, nội dung không chứa tên công ty; 2 công ty thì
 * không tạo; backtest tăng độ lệch thì đề xuất bị loại.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { applyTestEnv, startMongoHarness, stopMongoHarness } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();
process.env.MAIL_USER = "";
process.env.MAIL_PASS = "";

let harness;
let Company;
let CompanyRubric;
let PromptVersion;
let AIImprovementProposal;
let User;
let pv;
let anchor;
let miner;
let bt;
let fewShot;
let seq = 0;

before(async () => {
  harness = await startMongoHarness();
  ({ Company } = await import("../models/Company.js"));
  ({ CompanyRubric } = await import("../models/CompanyRubric.js"));
  ({ PromptVersion } = await import("../models/PromptVersion.js"));
  ({ AIImprovementProposal } = await import("../models/AIImprovementProposal.js"));
  ({ User } = await import("../models/User.js"));
  pv = await import("../services/promptVersionService.js");
  anchor = await import("../services/rubricAnchorMinerService.js");
  miner = await import("../services/aiImprovementMinerService.js");
  bt = await import("../services/aiImprovementBacktestService.js");
  fewShot = await import("../utils/fewShotMerge.js");
  await Promise.all([PromptVersion.syncIndexes(), AIImprovementProposal.syncIndexes()]);
});

after(async () => {
  await stopMongoHarness(harness);
});

beforeEach(async () => {
  await Promise.all([
    Company.deleteMany({}), CompanyRubric.deleteMany({}), PromptVersion.deleteMany({}),
    AIImprovementProposal.deleteMany({}), User.deleteMany({}),
  ]);
  pv.clearPromptCache();
});

const LEVELS = {
  0: "Không thể hiện", 1: "Nhắc tới, không có ví dụ", 2: "Có ví dụ chung chung",
  3: "Ví dụ cụ thể, rõ phần việc", 4: "Kết quả đo được, có bài học", 5: "Cách làm được nhóm áp dụng lại",
};

async function company(name, { consent = true, website = "" } = {}) {
  seq += 1;
  return Company.create({
    name,
    slug: `${name.toLowerCase().replace(/\s+/g, "-")}-${seq}`,
    website,
    status: "active",
    rubricSharingConsent: consent ? { acceptedAt: new Date(), termsVersion: "v1" } : { acceptedAt: null },
  });
}

async function rubric(c, { shrmKey = "problem_solving", roleCategory = "frontend", status = "approved" } = {}) {
  return CompanyRubric.create({
    companyId: c._id,
    roleCategory,
    title: `Rubric ${c.name}`,
    status,
    criteria: [{
      name: `Giải quyết sự cố trên nền tảng ${c.name}`,
      shrmKey,
      weight: 100,
      description: `Ứng viên xử lý lỗi production của ${c.name} như thế nào`,
      levels: LEVELS,
    }],
  });
}

/** LLM giả: ghi lại nguồn nhận được; cố tình chép tên công ty đầu tiên vào ví dụ mức 3. */
function fakeSummarize({ leakName = "", calls = [] } = {}) {
  return async (args) => {
    calls.push(args);
    return {
      promptVersion: "anchor-v1",
      anchors: [0, 1, 2, 3, 4, 5].map((level) => ({
        level,
        example: level === 3 && leakName ? `Kể sự cố cụ thể như ở ${leakName}, rõ phần việc của mình` : `Mô tả mức ${level}`,
      })),
    };
  };
}

async function threeCompanies() {
  const a = await company("Alpha Soft", { website: "https://www.alphasoft.vn" });
  const b = await company("Bê Ta Group");
  const c = await company("Gamma Labs");
  for (const x of [a, b, c]) await rubric(x);
  return [a, b, c];
}

describe("mineRubricAnchorProposals (AI-18)", () => {
  it("3 công ty cùng shrmKey: đúng 1 đề xuất, LLM và nội dung không có tên công ty", async () => {
    const companies = await threeCompanies();
    const calls = [];
    const { created } = await anchor.mineRubricAnchorProposals({ summarize: fakeSummarize({ leakName: "Alpha Soft", calls }) });

    assert.equal(created.length, 1);
    const [p] = await AIImprovementProposal.find().lean();
    assert.equal(p.kind, "rubric_anchor");
    assert.equal(p.target, "evaluation");
    assert.equal(p.groupKey, "problem_solving");
    assert.equal(p.status, "proposed");
    assert.equal(p.evidence.shrmKey, "problem_solving");
    assert.equal(p.evidence.companyCount, 3);
    assert.equal(p.evidence.rubricIds.length, 3);
    assert.ok(p.evidence.redactedInInput >= 6);
    assert.equal(p.evidence.redactedInOutput, 1);
    assert.equal(p.before.version, "eval-v1");
    assert.equal(p.after.version, "eval-v2");

    // Đầu vào LLM: tên đã thay bằng Nguồn A/B/C.
    assert.equal(calls.length, 1);
    assert.match(calls[0].sources, /Nguồn A/);
    assert.match(calls[0].sources, /Nguồn C/);

    // Không chuỗi nào trong đề xuất / version mới còn tên, slug, tên miền công ty.
    const version = await PromptVersion.findOne({ version: "eval-v2" }).lean();
    assert.equal(version.active, false);
    const content = JSON.stringify({ p, version, sources: calls[0].sources });
    for (const c of companies) {
      for (const id of anchor.companyIdentifiers(c)) {
        assert.ok(!content.toLowerCase().includes(id.toLowerCase()), `còn "${id}"`);
      }
    }
    assert.ok(!/alpha|bê ta|be ta|gamma/i.test(content));

    const anchorExample = version.fewShotExamples.find(fewShot.isAnchorExample);
    assert.equal(anchorExample.note, "rubric_anchor:problem_solving");
    assert.match(anchorExample.output, /Mức 0: .*\nMức 1: /);
    assert.match(anchorExample.output, /\[doanh nghiệp\]/);
    // Bảng mức LP-01 không đổi: prompt mặc định vẫn active.
    assert.equal((await pv.getActivePrompt("evaluation")).version, "eval-v1");
  });

  it("2 công ty: không tạo", async () => {
    for (const name of ["Alpha", "Beta"]) await rubric(await company(name));
    const { created } = await anchor.mineRubricAnchorProposals({ summarize: fakeSummarize() });
    assert.equal(created.length, 0);
    assert.equal(await AIImprovementProposal.countDocuments(), 0);
  });

  it("công ty chưa đồng ý điều khoản, rubric chưa duyệt, cùng công ty 2 rubric: không tính", async () => {
    const a = await company("Alpha");
    const b = await company("Beta");
    await rubric(a);
    await rubric(a, { roleCategory: "backend" });
    await rubric(b);
    await rubric(await company("Gamma", { consent: false }));
    await rubric(await company("Delta"), { status: "pending_review" });
    const { created } = await anchor.mineRubricAnchorProposals({ summarize: fakeSummarize() });
    assert.equal(created.length, 0);
  });

  it("chạy lại: không tạo trùng; bị từ chối rồi thì chỉ tạo lại khi có rubric mới được duyệt", async () => {
    await threeCompanies();
    await anchor.mineRubricAnchorProposals({ summarize: fakeSummarize() });
    const again = await anchor.mineRubricAnchorProposals({ summarize: fakeSummarize() });
    assert.equal(again.created.length, 0);
    assert.equal(again.skipped[0].reason, "open_proposal");

    await AIImprovementProposal.updateMany({}, { $set: { status: "rejected" } });
    const unchanged = await anchor.mineRubricAnchorProposals({ summarize: fakeSummarize() });
    assert.equal(unchanged.created.length, 0);
    assert.equal(unchanged.skipped[0].reason, "unchanged");

    await rubric(await company("Delta"));
    const fresh = await anchor.mineRubricAnchorProposals({ summarize: fakeSummarize() });
    assert.equal(fresh.created.length, 1);
    assert.equal(fresh.created[0].evidence.companyCount, 4);
  });

  it("LLM trả thiếu mức: không tạo đề xuất, không để lại PromptVersion", async () => {
    await threeCompanies();
    const { created, skipped } = await anchor.mineRubricAnchorProposals({
      summarize: async () => ({ anchors: [{ level: 0, example: "x" }] }),
    });
    assert.equal(created.length, 0);
    assert.equal(skipped[0].reason, "error");
    assert.equal(await PromptVersion.countDocuments(), 0);
  });

  it("chạy qua mineImprovementProposals (job AI-03) và báo moderator", async () => {
    await threeCompanies();
    await User.create({ name: "Mod", email: `ai18-mod-${seq}@test.local`, role: "moderator" });
    const { created } = await miner.mineImprovementProposals({ rubricAnchorOptions: { summarize: fakeSummarize() } });
    assert.equal(created.length, 1);
    assert.equal(created[0].kind, "rubric_anchor");
  });

  it("không cấu hình LLM: bỏ qua, không lỗi", async () => {
    await threeCompanies();
    const err = Object.assign(new Error("x"), { code: "llm_not_configured" });
    const { created, skipped } = await anchor.mineRubricAnchorProposals({ summarize: async () => { throw err; } });
    assert.equal(created.length, 0);
    assert.equal(skipped[0].reason, "llm_not_configured");
  });
});

describe("backtest đề xuất rubric_anchor (AI-18)", () => {
  async function anchorProposal() {
    await threeCompanies();
    const { created } = await anchor.mineRubricAnchorProposals({ summarize: fakeSummarize() });
    return created[0];
  }
  const dataset = { version: "test", items: [{ id: "t1", competencyId: "problem_solving", layer: "behavior", question: "Q", transcript: "T", gold: 2 }] };

  it("độ lệch tăng → tự loại", async () => {
    const p = await anchorProposal();
    const evaluate = async ({ answers, prompt }) => ({
      perQuestion: answers.map((a) => ({ questionIndex: a.questionIndex, overall: prompt.version === "eval-v1" ? 3 : 5 })),
    });
    const result = await bt.runBacktest(p._id, { evaluate, dataset });
    assert.equal(result.verdict, "worse");
    assert.equal(result.autoRejected, true);
    const saved = await AIImprovementProposal.findById(p._id).lean();
    assert.equal(saved.status, "rejected");
    assert.equal(saved.review.by, null);
    assert.match(saved.review.note, /Tự loại/);
  });

  it("độ lệch giảm → giữ chờ duyệt", async () => {
    const p = await anchorProposal();
    const evaluate = async ({ answers, prompt }) => ({
      perQuestion: answers.map((a) => ({ questionIndex: a.questionIndex, overall: prompt.version === "eval-v1" ? 5 : 3 })),
    });
    const result = await bt.runBacktest(p._id, { evaluate, dataset });
    assert.equal(result.verdict, "better");
    assert.equal((await AIImprovementProposal.findById(p._id).lean()).status, "proposed");
  });
});

describe("ẩn danh và gộp few-shot (AI-18)", () => {
  it("redactIdentifiers: không phân biệt hoa thường, có dấu hay không, không cắt giữa từ", () => {
    const ids = ["Bê Ta Group", "alphasoft.vn", "Alpha"];
    const { text, count } = anchor.redactIdentifiers("BE TA GROUP và bê ta group, web alphasoft.vn, Alpha; Alphabet giữ nguyên", ids, "X");
    assert.equal(text, "X và X, web X, X; Alphabet giữ nguyên");
    assert.equal(count, 4);
    assert.equal(anchor.containsIdentifier(text, ids), false);
  });

  it("mergeFewShotExamples: ví dụ neo không bị cắt theo trần, cùng key thì bản mới thay", () => {
    const plain = Array.from({ length: 12 }, (_, i) => ({ input: `p${i}`, output: "o", note: "" }));
    const oldAnchor = { input: "cũ", output: "o", note: "rubric_anchor:teamwork" };
    const newAnchor = { input: "mới", output: "o", note: "rubric_anchor:teamwork" };
    const other = { input: "khác", output: "o", note: "rubric_anchor:communication" };
    const merged = fewShot.mergeFewShotExamples([oldAnchor, other, ...plain], [newAnchor]);
    assert.equal(merged.filter((e) => !fewShot.isAnchorExample(e)).length, fewShot.MAX_VERSION_EXAMPLES);
    assert.deepEqual(merged.filter(fewShot.isAnchorExample).map((e) => e.input), ["mới", "khác"]);
  });
});

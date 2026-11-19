/**
 * Integration AI-02: activate() trên replica set (đường transaction, giống Atlas production).
 * File riêng vì cần MongoMemoryReplSet thay cho MongoMemoryServer standalone.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { applyTestEnv } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();

let replSet;
let mongoose;
let PromptVersion;
let svc;
let sync;
let registry;
let supportsTransactions;

before(async () => {
  const { MongoMemoryReplSet } = await import("mongodb-memory-server");
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  mongoose = (await import("mongoose")).default;
  await mongoose.connect(replSet.getUri());
  ({ PromptVersion } = await import("../models/PromptVersion.js"));
  svc = await import("../services/promptVersionService.js");
  sync = await import("../scripts/syncPromptVersions.js");
  ({ PROMPT_REGISTRY: registry } = await import("../prompts/index.js"));
  ({ supportsTransactions } = await import("../helpers/dbHelper.js"));
  await PromptVersion.init();
});

after(async () => {
  await mongoose?.disconnect();
  await replSet?.stop();
});

const v2Template = () => {
  const t = JSON.parse(JSON.stringify(registry.evaluation.default.template));
  t.system = `[TX] ${t.system}`;
  return t;
};

describe("activate trong transaction", () => {
  it("DB hỗ trợ transaction; bật/tắt giữ đúng 1 bản active", async () => {
    assert.equal(await supportsTransactions(), true);
    await sync.syncPromptVersions({ log: () => {} });
    await PromptVersion.create({ key: "evaluation", version: "eval-v2", template: v2Template() });

    await svc.activate("evaluation", "eval-v2", { note: "tx" });
    assert.equal((await PromptVersion.findOne({ key: "evaluation", active: true })).version, "eval-v2");
    assert.equal(await PromptVersion.countDocuments({ key: "evaluation", active: true }), 1);

    await svc.activate("evaluation", "eval-v1");
    assert.equal((await PromptVersion.findOne({ key: "evaluation", active: true })).version, "eval-v1");
    assert.equal((await svc.getActivePrompt("evaluation")).version, "eval-v1");
  });

  it("activate song song: kết thúc vẫn đúng 1 bản active", async () => {
    await PromptVersion.create({ key: "evaluation", version: "eval-v3", template: v2Template() });
    await Promise.allSettled([svc.activate("evaluation", "eval-v2"), svc.activate("evaluation", "eval-v3")]);
    assert.equal(await PromptVersion.countDocuments({ key: "evaluation", active: true }), 1);
  });
});

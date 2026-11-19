/**
 * Integration: script đổi key năng lực tạm của LP-20 sang key bộ tiêu chí LP-01
 * (src/scripts/migrateLearningPathShrmKeys.js).
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { applyTestEnv, startMongoHarness, stopMongoHarness } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();

let harness;
let LearningPathSession;
let mod;
let isValidCompetencyKey;

before(async () => {
  harness = await startMongoHarness();
  ({ LearningPathSession } = await import("../models/LearningPathSession.js"));
  ({ isValidCompetencyKey } = await import("../services/competencyFramework.js"));
  mod = await import("../scripts/migrateLearningPathShrmKeys.js");
});

after(async () => {
  if (harness) await stopMongoHarness(harness);
});

describe("migrateLearningPathShrmKeys", () => {
  it("mọi key đích trong bảng đổi đều hợp lệ theo LP-01", () => {
    for (const [from, to] of Object.entries(mod.LEGACY_LP20_KEY_MAP)) {
      assert.equal(isValidCompetencyKey(from), false, `${from} phải là key cũ`);
      assert.equal(isValidCompetencyKey(to), true, `${to} phải có trong bộ tiêu chí`);
    }
  });

  it("remapShrmKeys đổi key cũ, bỏ trùng, giữ thứ tự", () => {
    assert.deepEqual(mod.remapShrmKeys(["critical_thinking", "communication", "problem_solving"]), ["problem_solving", "communication"]);
  });

  it("dry run không ghi; chạy thật đổi key, báo key lạ khác mà không xoá", async () => {
    const pathId = new mongoose.Types.ObjectId();
    const old = await LearningPathSession.create({ pathId, order: 1, title: "Buổi 1", shrmKeys: ["critical_thinking", "teamwork", "initiative"] });
    const ok = await LearningPathSession.create({ pathId, order: 2, title: "Buổi 2", shrmKeys: ["communication"] });
    const odd = await LearningPathSession.create({ pathId, order: 3, title: "Buổi 3", shrmKeys: ["la_qua"] });
    const log = () => {};

    const dry = await mod.migrateLearningPathShrmKeys({ dryRun: true, log });
    assert.equal(dry.found, 1);
    assert.equal(dry.updated, 0);
    assert.deepEqual((await LearningPathSession.findById(old._id).lean()).shrmKeys, ["critical_thinking", "teamwork", "initiative"]);

    const real = await mod.migrateLearningPathShrmKeys({ log });
    assert.equal(real.updated, 1);
    assert.deepEqual(real.unknown, ["la_qua"]);
    assert.deepEqual((await LearningPathSession.findById(old._id).lean()).shrmKeys, ["problem_solving", "teamwork", "accountability"]);
    assert.deepEqual((await LearningPathSession.findById(ok._id).lean()).shrmKeys, ["communication"]);
    assert.deepEqual((await LearningPathSession.findById(odd._id).lean()).shrmKeys, ["la_qua"]);

    assert.equal((await mod.migrateLearningPathShrmKeys({ log })).found, 0, "chạy lại không đổi gì");
  });
});

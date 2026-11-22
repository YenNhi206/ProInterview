/** PR-07: script audit mặc định chỉ đọc, không bao giờ ghi DB từ xa. */
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyTestEnv, startMongoHarness, stopMongoHarness } from "../test_helpers/mongoTestHarness.js";
import { assertApplyAllowed, parseArgs } from "../scripts/auditVerifiedCompetencies.js";

applyTestEnv();

const script = fileURLToPath(new URL("../scripts/auditVerifiedCompetencies.js", import.meta.url));
let harness, db, uri, dir;

const run = (args = [], env = {}) =>
  spawnSync(process.execPath, [script, ...args], {
    env: { ...process.env, AUDIT_MONGO_URI: uri, ...env },
    encoding: "utf8",
    timeout: 30_000,
  });
const summaryOf = (stdout) => JSON.parse(stdout.match(/^\{\r?\n[\s\S]*?^\}/m)[0]);

async function dump() {
  const names = (await db.listCollections().toArray()).map((c) => c.name).sort();
  const out = {};
  for (const name of names) {
    out[name] = {
      docs: await db.collection(name).find().sort({ _id: 1 }).toArray(),
      indexes: await db.collection(name).indexes(),
    };
  }
  return JSON.stringify(out);
}

before(async () => {
  harness = await startMongoHarness();
  db = harness.mongoose.connection.useDb("pr07_audit").db;
  uri = new URL("pr07_audit", harness.mongod.getUri()).href;
  dir = mkdtempSync(join(tmpdir(), "pr07-audit-"));
});

after(async () => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  if (harness) await stopMongoHarness(harness);
});

beforeEach(async () => {
  await db.dropDatabase();
  const id = () => new harness.mongoose.Types.ObjectId();
  const [A, B, C, D, theirs, own, real] = [id(), id(), id(), id(), id(), id(), id()];
  await db.collection("bookings").insertMany([{ _id: theirs, userId: A }, { _id: own, userId: C }]);
  await db.collection("interview_sessions").insertOne({
    _id: real, userId: D, status: "completed",
    answers: [{ transcript: "Có trả lời" }], feedback: { overallScore: 70, perQuestion: [{ score: 70 }] },
  });
  const profile = (userId, sources) => ({
    userId, isVerified: true, updatedAt: new Date(),
    competencies: [{ key: "problem_solving", score: 85, evidenceCount: 1, sources }],
  });
  await db.collection("candidateprofiles").insertMany([
    profile(B, [{ type: "mentor_session", refId: theirs }]),
    profile(C, [{ type: "mentor_session", refId: own }, { type: "mentor_session", refId: id() }]),
    profile(D, [{ type: "ai_interview", refId: real }]),
  ]);
  await db.collection("users").insertMany([
    { _id: A, name: "A" },
    { _id: B, name: "B", isCompetencyVerified: true, verifiedReadinessScore: 86, lastVerifiedAt: new Date() },
    { _id: D, name: "D", verifiedCompetencies: [{ name: "STAR", score: 88 }] },
  ]);
});

describe("auditVerifiedCompetencies", () => {
  it("mặc định dry-run: phân loại đúng, không đổi document, collection hay index", async () => {
    const original = await dump();
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /DRY-RUN/);
    assert.deepEqual(summaryOf(result.stdout), {
      profilesScanned: 3,
      profilesAffected: 2,
      profilesWithOtherUsersBooking: 1,
      bookingOwnersExposed: 1,
      otherUsersBookingSources: 1,
      ownBookingFakeScoreSources: 1,
      orphanMentorSources: 1,
      invalidOtherSources: 0,
      verifiedProfilesWithoutEvidence: 2,
      usersWithUntrustedVerified: 2,
      usersVerifiedWithoutEvidence: 1,
    });
    assert.equal(await dump(), original);
  });

  it("thiếu URI thì dừng, không lấy từ .env", () => {
    const result = run([], { AUDIT_MONGO_URI: "" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /AUDIT_MONGO_URI/);
  });

  it("--apply thiếu điều kiện thì không ghi gì", async () => {
    const original = await dump();
    const backup = `--backup=${join(dir, "refused.json")}`;
    for (const [args, env] of [
      [["--apply"]],
      [["--apply", "--confirm-db=sai", backup]],
      [["--apply", "--confirm-db=pr07_audit"]],
      [["--apply", "--confirm-db=pr07_audit", backup], { NODE_ENV: "production" }],
    ]) {
      assert.equal(run(args, env).status, 1);
    }
    assert.equal(await dump(), original);
  });

  it("--apply từ chối mọi DB từ xa", () => {
    const options = { confirmDb: "prointerview", backup: "b.json" };
    for (const remote of [
      "mongodb+srv://u:p@cluster.example.net/prointerview",
      "mongodb://db.example.net:27017/prointerview",
      "mongodb://localhost@db.example.net/prointerview",
      "mongodb://localhost.example.net/prointerview",
      "mongodb://localhost:27017,db.example.net:27017/prointerview",
    ]) {
      assert.throws(() => assertApplyAllowed(remote, options, {}), remote);
    }
  });

  it("tham số lạ hoặc mâu thuẫn bị từ chối", () => {
    assert.throws(() => parseArgs(["--aply"]));
    assert.throws(() => parseArgs(["--apply", "--dry-run"]));
    assert.equal(parseArgs([]).apply, false);
  });

  it("--apply local: backup trước, chỉ dọn bản sai, chạy lại không còn gì", async () => {
    const backup = join(dir, "backup.json");
    const args = ["--apply", "--confirm-db=pr07_audit", `--backup=${backup}`];
    const result = run(args);
    assert.equal(result.status, 0, result.stderr);
    const saved = JSON.parse(readFileSync(backup, "utf8"));
    assert.equal(saved.profiles.length, 2);
    assert.equal(saved.users.length, 2);

    const next = summaryOf(run().stdout);
    assert.equal(next.profilesAffected, 0);
    assert.equal(next.usersWithUntrustedVerified, 0);
    assert.equal(await db.collection("candidateprofiles").countDocuments({ isVerified: true }), 1);
    assert.equal((await db.collection("users").findOne({ name: "B" })).name, "B");

    assert.equal(run(args).status, 1, "không ghi đè file backup cũ");
  });
});

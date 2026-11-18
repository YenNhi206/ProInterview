/**
 * LP-03: model LearningPath và LearningPathSession — giá trị mặc định, validate, index.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { applyTestEnv, startMongoHarness, stopMongoHarness } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();

let harness;
let LearningPath;
let LearningPathSession;

const oid = () => new mongoose.Types.ObjectId();
const pathDoc = (overrides = {}) => ({ candidateId: oid(), mentorId: oid(), mentorshipRequestId: oid(), ...overrides });

before(async () => {
  harness = await startMongoHarness();
  const models = await import("../models/index.js");
  ({ LearningPath, LearningPathSession } = models);
  await Promise.all([LearningPath.init(), LearningPathSession.init()]);
});

after(async () => {
  if (harness) await stopMongoHarness(harness);
});

beforeEach(async () => {
  await Promise.all([LearningPath.deleteMany({}), LearningPathSession.deleteMany({})]);
});

describe("LearningPath (LP-03)", () => {
  it("export ở models/index.js, collection learning_paths, giá trị mặc định đúng", async () => {
    assert.equal(LearningPath.collection.collectionName, "learning_paths");
    const path = await LearningPath.create(pathDoc());
    assert.equal(path.status, "draft");
    assert.equal(path.version, 1);
    assert.equal(path.totalAmount, 0);
    assert.equal(path.paymentRef, "");
    assert.equal(path.jobPostId, null);
  });

  it("bắt buộc candidateId, mentorId, mentorshipRequestId; status ngoài enum bị từ chối", async () => {
    await assert.rejects(LearningPath.create({ mentorId: oid(), mentorshipRequestId: oid() }), /candidateId/);
    await assert.rejects(LearningPath.create({ candidateId: oid(), mentorshipRequestId: oid() }), /mentorId/);
    await assert.rejects(LearningPath.create({ candidateId: oid(), mentorId: oid() }), /mentorshipRequestId/);
    await assert.rejects(LearningPath.create(pathDoc({ status: "paid" })), /status/);
  });

  it("totalAmount là số nguyên không âm; platformFeeRate trong [0, 1]", async () => {
    await assert.rejects(LearningPath.create(pathDoc({ totalAmount: 1000.5 })), /totalAmount/);
    await assert.rejects(LearningPath.create(pathDoc({ totalAmount: -1 })), /totalAmount/);
    await assert.rejects(LearningPath.create(pathDoc({ platformFeeRate: 1.2 })), /platformFeeRate/);
    const ok = await LearningPath.create(pathDoc({ totalAmount: 1_000_000, platformFeeRate: 0.15 }));
    assert.equal(ok.totalAmount, 1_000_000);
  });

  it("mỗi yêu cầu mentor chỉ có 1 lộ trình chưa hủy; lộ trình đã hủy không chặn", async () => {
    const mentorshipRequestId = oid();
    const first = await LearningPath.create(pathDoc({ mentorshipRequestId }));
    await assert.rejects(LearningPath.create(pathDoc({ mentorshipRequestId })), /duplicate key/);
    first.status = "cancelled";
    await first.save();
    await LearningPath.create(pathDoc({ mentorshipRequestId }));
  });

  it("paymentRef unique khi pending_payment; lộ trình đã active không chặn mã cũ", async () => {
    await LearningPath.create(pathDoc({ status: "pending_payment", paymentRef: "PI123456" }));
    await assert.rejects(
      LearningPath.create(pathDoc({ status: "pending_payment", paymentRef: "PI123456" })),
      /duplicate key/,
    );
    await LearningPath.create(pathDoc({ status: "active", paymentRef: "PI123456" }));
    // Nhiều lộ trình chưa có mã (draft) không đụng index.
    await LearningPath.create(pathDoc());
    await LearningPath.create(pathDoc());
  });
});

describe("LearningPathSession (LP-03)", () => {
  it("collection learning_path_sessions, giá trị mặc định đúng, lưu shrmKeys và feedback", async () => {
    assert.equal(LearningPathSession.collection.collectionName, "learning_path_sessions");
    const s = await LearningPathSession.create({
      pathId: oid(),
      order: 1,
      title: "Phỏng vấn hành vi theo STAR",
      objectives: ["Kể được 2 tình huống STAR"],
      shrmKeys: ["communication", "problem_solving"],
      shareAmount: 333_333,
    });
    assert.equal(s.status, "planned");
    assert.equal(s.attempt, 1);
    assert.equal(s.outcome, null);
    assert.equal(s.bookingId, null);
    assert.deepEqual([...s.shrmKeys], ["communication", "problem_solving"]);
    assert.equal(s.feedback.summary, "");
  });

  it("validate: order nguyên ≥ 1, shareAmount nguyên ≥ 0, outcome trong enum, shrmKeys không rỗng", async () => {
    const base = { pathId: oid(), title: "Buổi 1" };
    await assert.rejects(LearningPathSession.create({ ...base, order: 0 }), /order/);
    await assert.rejects(LearningPathSession.create({ ...base, order: 1.5 }), /order/);
    await assert.rejects(LearningPathSession.create({ ...base, order: 1, shareAmount: 10.5 }), /shareAmount/);
    await assert.rejects(LearningPathSession.create({ ...base, order: 1, outcome: "failed" }), /outcome/);
    await assert.rejects(LearningPathSession.create({ ...base, order: 1, shrmKeys: ["  "] }), /shrmKeys/);
    await assert.rejects(LearningPathSession.create({ ...base, order: 1, status: "skipped" }), /status/);
  });

  it("(pathId, order, attempt) duy nhất; buổi học lại cùng order với attempt + 1 lưu được", async () => {
    const pathId = oid();
    const first = await LearningPathSession.create({ pathId, order: 2, title: "Buổi 2", shareAmount: 333_333 });
    await assert.rejects(LearningPathSession.create({ pathId, order: 2, title: "Buổi 2 trùng" }), /duplicate key/);
    const retake = await LearningPathSession.create({
      pathId,
      order: 2,
      title: "Buổi 2 (học lại)",
      attempt: 2,
      retakeOf: first._id,
      shareAmount: 0,
    });
    assert.equal(String(retake.retakeOf), String(first._id));
    const list = await LearningPathSession.find({ pathId }).sort({ order: 1, attempt: 1 }).lean();
    assert.deepEqual(list.map((s) => s.attempt), [1, 2]);
  });

  it("một booking chỉ gắn với một buổi; nhiều buổi chưa có booking không đụng index", async () => {
    const pathId = oid();
    const bookingId = oid();
    await LearningPathSession.create({ pathId, order: 1, title: "Buổi 1", bookingId, status: "scheduled" });
    await assert.rejects(
      LearningPathSession.create({ pathId, order: 2, title: "Buổi 2", bookingId }),
      /duplicate key/,
    );
    await LearningPathSession.create({ pathId, order: 2, title: "Buổi 2" });
    await LearningPathSession.create({ pathId, order: 3, title: "Buổi 3" });
  });
});

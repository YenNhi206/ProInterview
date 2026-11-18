/**
 * LP-02: index unique `mentorshipRequestId` trên Booking.
 * - 1 buổi đánh giá 0đ + 3 buổi lộ trình + 1 buổi học lại cùng một request không lỗi E11000.
 * - Booking thường (không phải assessment) vẫn bị chặn trùng trên cùng request.
 * - Script sync drop index cũ `mentorshipRequestId_1` và tạo index mới.
 *
 * `sessionType: "assessment"` và `learningPathId` chỉ được thêm vào schema ở LP-04, nên test
 * ghi thẳng qua driver (bỏ qua validate của Mongoose) để kiểm riêng hành vi của index.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { applyTestEnv, startMongoHarness, stopMongoHarness } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();

let harness;
let Booking;
let REQUEST_UNIQUE_INDEX_NAME;
let LEGACY_REQUEST_INDEX_NAME;
let syncBookingIndexes;

const oid = () => new mongoose.Types.ObjectId();
let slot = 0;

function bookingDoc(overrides = {}) {
  slot += 1;
  return {
    userId: oid(),
    mentorId: oid(),
    date: "01/12/2026",
    timeSlot: `slot-${slot}`,
    durationMinutes: 60,
    sessionType: "mock_interview",
    status: "confirmed",
    paymentStatus: "paid",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const insert = (doc) => Booking.collection.insertOne(bookingDoc(doc));

before(async () => {
  harness = await startMongoHarness();
  ({ Booking, REQUEST_UNIQUE_INDEX_NAME, LEGACY_REQUEST_INDEX_NAME } = await import("../models/Booking.js"));
  ({ syncBookingIndexes } = await import("../scripts/syncBookingIndexes.js"));
  await Booking.init();
});

after(async () => {
  if (harness) await stopMongoHarness(harness);
});

beforeEach(async () => {
  await Booking.deleteMany({});
});

describe("Booking index mentorshipRequestId (LP-02)", () => {
  it("index mới có partial filter loại buổi đánh giá 0đ", async () => {
    const ix = (await Booking.collection.indexes()).find((i) => i.name === REQUEST_UNIQUE_INDEX_NAME);
    assert.ok(ix, "thiếu index mới");
    assert.equal(ix.unique, true);
    assert.deepEqual(ix.partialFilterExpression.sessionType.$in, ["mock_interview", "cv_review", "career_consulting", "custom"]);
    assert.ok(!(await Booking.collection.indexes()).some((i) => i.name === LEGACY_REQUEST_INDEX_NAME));
  });

  it("1 buổi 0đ + 3 buổi lộ trình + 1 buổi học lại cùng một request không lỗi E11000", async () => {
    const mentorshipRequestId = oid();
    const learningPathId = oid();
    await insert({ mentorshipRequestId, sessionType: "assessment", status: "completed" });
    // Booking thường duy nhất của request vẫn đặt được khi đã có buổi 0đ.
    await insert({ mentorshipRequestId, sessionType: "career_consulting", status: "completed" });
    for (let i = 0; i < 3; i += 1) {
      await insert({ learningPathId, sessionType: "mock_interview", status: "completed" });
    }
    await insert({ learningPathId, sessionType: "mock_interview", status: "confirmed" }); // học lại
    assert.equal(await Booking.countDocuments({ $or: [{ mentorshipRequestId }, { learningPathId }] }), 6);
  });

  it("2 buổi 0đ cùng request không bị index chặn (giới hạn số buổi làm ở LP-06)", async () => {
    const mentorshipRequestId = oid();
    await insert({ mentorshipRequestId, sessionType: "assessment", status: "no_show" });
    await insert({ mentorshipRequestId, sessionType: "assessment", status: "pending" });
  });

  it("booking thường vẫn bị chặn trùng trên cùng request", async () => {
    const mentorshipRequestId = oid();
    await insert({ mentorshipRequestId, sessionType: "career_consulting", status: "completed" });
    await assert.rejects(insert({ mentorshipRequestId, sessionType: "cv_review", status: "pending" }), (err) => {
      assert.equal(err.code, 11000);
      assert.deepEqual(Object.keys(err.keyPattern), ["mentorshipRequestId"]);
      return true;
    });
  });

  it("booking cũ đã hủy không chặn booking mới cùng request", async () => {
    const mentorshipRequestId = oid();
    await insert({ mentorshipRequestId, status: "cancelled" });
    await insert({ mentorshipRequestId, status: "pending" });
  });
});

describe("syncBookingIndexes (LP-02)", () => {
  it("drop index cũ mentorshipRequestId_1, tạo index mới; chạy lại không lỗi", async () => {
    // Dựng lại tình trạng staging/production: chỉ có index cũ.
    await Booking.collection.dropIndex(REQUEST_UNIQUE_INDEX_NAME);
    await Booking.collection.createIndex(
      { mentorshipRequestId: 1 },
      {
        name: LEGACY_REQUEST_INDEX_NAME,
        unique: true,
        partialFilterExpression: {
          mentorshipRequestId: { $type: "objectId" },
          status: { $in: ["pending", "confirmed", "in_progress", "completed", "rescheduled"] },
        },
      },
    );
    const mentorshipRequestId = oid();
    await insert({ mentorshipRequestId, sessionType: "assessment" });
    await assert.rejects(insert({ mentorshipRequestId, sessionType: "career_consulting" }), /duplicate key/);

    const silent = () => {};
    const dry = await syncBookingIndexes({ dryRun: true, log: silent });
    assert.deepEqual(dry.dropped, []);
    assert.ok((await Booking.collection.indexes()).some((i) => i.name === LEGACY_REQUEST_INDEX_NAME));

    const res = await syncBookingIndexes({ log: silent });
    assert.deepEqual(res.dropped, [LEGACY_REQUEST_INDEX_NAME]);
    const names = res.indexes.map((i) => i.name);
    assert.ok(names.includes(REQUEST_UNIQUE_INDEX_NAME));
    assert.ok(!names.includes(LEGACY_REQUEST_INDEX_NAME));
    await insert({ mentorshipRequestId, sessionType: "career_consulting" });

    const again = await syncBookingIndexes({ log: silent });
    assert.deepEqual(again.dropped, []);
  });
});

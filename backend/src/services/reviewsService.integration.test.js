/**
 * Integration: reviewsService (pagination admin, visibility, mine).
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { applyTestEnv, startMongoHarness, stopMongoHarness } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();

let harness;
let User;
let Course;
let Review;
let Enrollment;

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ Course } = await import("../models/Course.js"));
  ({ Review } = await import("../models/Review.js"));
  ({ Enrollment } = await import("../models/Enrollment.js"));
});

after(async () => {
  if (harness) await stopMongoHarness(harness);
});

beforeEach(async () => {
  await Promise.all([
    Review?.deleteMany?.({}),
    Enrollment?.deleteMany?.({}),
    Course?.deleteMany?.({}),
    User?.deleteMany?.({}),
  ]);
});

async function createCustomer() {
  return User.create({
    name: "Review Tester",
    email: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`,
    role: "customer",
    plan: "free",
  });
}

function fakeMentorId() {
  return new mongoose.Types.ObjectId();
}

async function createPublishedCourse(mentorId = fakeMentorId()) {
  return Course.create({
    mentorId,
    title: "Khóa test review",
    description: "Test",
    level: "basic",
    topics: ["Technical"],
    price: 100000,
    status: "published",
    publishedAt: new Date(),
  });
}

describe("listReviewsForAdmin", () => {
  it("paginates with page and limit", async () => {
    const user = await createCustomer();
    for (let i = 0; i < 5; i += 1) {
      await Review.create({
        userId: user._id,
        targetType: "course",
        targetId: new mongoose.Types.ObjectId(),
        rating: 4,
        comment: `Review ${i}`,
      });
    }

    const { listReviewsForAdmin } = await import("./reviewsService.js");
    const p1 = await listReviewsForAdmin({ page: 1, limit: 2, targetType: "course" });
    assert.equal(p1.ok, true);
    assert.equal(p1.reviews.length, 2);
    assert.equal(p1.pagination.total, 5);
    assert.equal(p1.pagination.totalPages, 3);
    assert.equal(p1.pagination.hasMore, true);

    const p2 = await listReviewsForAdmin({ page: 2, limit: 2, targetType: "course" });
    assert.equal(p2.reviews.length, 2);
    assert.equal(p2.pagination.page, 2);
  });
});

describe("setReviewVisibilityForAdmin", () => {
  it("recalculates course stats when hidden", async () => {
    const user = await createCustomer();
    const course = await createPublishedCourse();
    await Course.updateOne(
      { _id: course._id },
      { $set: { "stats.rating": 5, "stats.reviewCount": 1 } },
    );
    const review = await Review.create({
      userId: user._id,
      targetType: "course",
      targetId: course._id,
      rating: 5,
      comment: "Great",
      isVisible: true,
    });

    const { setReviewVisibilityForAdmin } = await import("./reviewsService.js");
    const hide = await setReviewVisibilityForAdmin(String(review._id), false);
    assert.equal(hide.ok, true);

    const updated = await Course.findById(course._id).lean();
    assert.equal(updated.stats.reviewCount, 0);
    assert.equal(updated.stats.rating, 0);
  });
});

describe("getMyReviewForTarget", () => {
  it("returns hasReview when user already reviewed", async () => {
    const user = await createCustomer();
    const courseId = new mongoose.Types.ObjectId();
    await Review.create({
      userId: user._id,
      targetType: "course",
      targetId: courseId,
      rating: 3,
      comment: "OK course",
    });

    const { getMyReviewForTarget } = await import("./reviewsService.js");
    const res = await getMyReviewForTarget(String(user._id), {
      targetType: "course",
      targetId: String(courseId),
    });
    assert.equal(res.ok, true);
    assert.equal(res.hasReview, true);
    assert.equal(res.review.rating, 3);
  });
});

describe("createReview", () => {
  it("rejects duplicate review for same target", async () => {
    const user = await createCustomer();
    const course = await createPublishedCourse();
    await Enrollment.create({
      userId: user._id,
      courseId: course._id,
      paymentStatus: "paid",
    });

    const { createReview } = await import("./reviewsService.js");
    const first = await createReview(String(user._id), {
      targetType: "course",
      targetId: String(course._id),
      rating: 4,
      comment: "First review here with enough text for validation.",
    });
    assert.equal(first.ok, true);

    const dup = await createReview(String(user._id), {
      targetType: "course",
      targetId: String(course._id),
      rating: 5,
      comment: "Second attempt should fail duplicate.",
    });
    assert.equal(dup.ok, false);
    assert.equal(dup.status, 409);
  });
});

describe("recalcCourseReviewStats — không trộn đánh giá chéo mentor vào rating công khai", () => {
  it("đánh giá chéo mentor (MentorPeerReview) không ảnh hưởng course.stats", async () => {
    const { Mentor } = await import("../models/Mentor.js");
    const { MentorPeerReview } = await import("../models/MentorPeerReview.js");
    const { recalcCourseReviewStats } = await import("./reviewsService.js");

    const course = await createPublishedCourse();
    const reviewerUser = await User.create({
      name: "Mentor Reviewer",
      email: `peer-reviewer-${Date.now()}@test.local`,
      role: "mentor",
    });
    let reviewerMentor = await Mentor.findOne({ userId: reviewerUser._id });
    if (!reviewerMentor) {
      reviewerMentor = await Mentor.create({
        userId: reviewerUser._id,
        name: "Mentor Reviewer",
        title: "Senior",
        company: "ProInterview",
        pricePerHour: 100000,
      });
    }

    // 2 mentor "thông đồng" tự cho nhau điểm tối đa — không được phép ảnh hưởng rating công khai.
    await MentorPeerReview.create({
      reviewerId: reviewerMentor._id,
      courseId: course._id,
      contentRating: 5,
      qualityRating: 5,
      priceValueRating: 5,
      feedback: "Tuyệt vời",
    });

    await recalcCourseReviewStats(course._id);
    let stored = await Course.findById(course._id).lean();
    assert.equal(stored.stats.rating, 0);
    assert.equal(stored.stats.reviewCount, 0);

    // Học viên thật review 3 sao — chỉ con số này được phản ánh, không bị kéo lên bởi peer review 5/5/5.
    const student = await createCustomer();
    await Enrollment.create({ userId: student._id, courseId: course._id, paymentStatus: "paid" });
    const { createReview } = await import("./reviewsService.js");
    const res = await createReview(String(student._id), {
      targetType: "course",
      targetId: String(course._id),
      rating: 3,
      comment: "Nội dung tạm được, cần cải thiện thêm phần thực hành.",
    });
    assert.equal(res.ok, true);

    stored = await Course.findById(course._id).lean();
    assert.equal(stored.stats.rating, 3);
    assert.equal(stored.stats.reviewCount, 1);
  });
});

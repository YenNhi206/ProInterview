/**
 * Integration: plansService — reset quota khi gia hạn + lazy-downgrade khi hết hạn (MongoDB).
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  applyTestEnv,
  startMongoHarness,
  stopMongoHarness,
} from "../test_helpers/mongoTestHarness.js";

applyTestEnv();

let harness;
let User;
let activatePlan;
let syncPlanExpiry;
let getCurrentPlan;

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ activatePlan, syncPlanExpiry, getCurrentPlan } = await import("../services/plansService.js"));
});

after(async () => {
  if (harness) await stopMongoHarness(harness);
});

describe("plansService — quota reset + expiry", () => {
  it("activatePlan trả lại quota đầy, không cộng dồn used từ chu kỳ trước", async () => {
    const user = await User.create({
      name: "Renew User",
      email: `renew-${Date.now()}@test.local`,
      plan: "starter_pro",
      quota: { cvAnalysisUsed: 10, cvAnalysisLimit: 10, interviewUsed: 3, interviewLimit: 3 },
    });

    const res = await activatePlan(String(user._id), { plan: "starter_pro" });
    assert.equal(res.ok, true);
    assert.equal(res.quota.cvAnalysisUsed, 0);
    assert.equal(res.quota.interviewUsed, 0);
    assert.equal(res.quota.cvAnalysisLimit, 10);
    assert.equal(res.quota.interviewLimit, 3);
    // Mốc reset hàng tháng kế tiếp phải được set (~1 tháng tới) — nền tảng cho gói năm.
    assert.ok(res.quota.resetAt);
    assert.ok(new Date(res.quota.resetAt) > new Date());
  });

  it("syncPlanExpiry hạ về free khi planExpiresAt đã qua", async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const user = await User.create({
      name: "Expired User",
      email: `expired-${Date.now()}@test.local`,
      plan: "elite_pro",
      planExpiresAt: past,
      quota: { cvAnalysisUsed: 30, cvAnalysisLimit: 30, interviewUsed: 5, interviewLimit: 8, interviewQuestionsAllowed: 5 },
    });

    await syncPlanExpiry(String(user._id));

    const refreshed = await User.findById(user._id).lean();
    assert.equal(refreshed.plan, "free");
    assert.equal(refreshed.planExpiresAt, null);
    assert.equal(refreshed.quota.cvAnalysisLimit, 3);
    assert.equal(refreshed.quota.interviewLimit, 1);
    assert.equal(refreshed.quota.interviewQuestionsAllowed, 3);
    // used không reset khi hạ gói — tránh lách luật bằng cách để hết hạn rồi nâng cấp lại
    assert.equal(refreshed.quota.cvAnalysisUsed, 30);
  });

  it("syncPlanExpiry không đụng tới gói còn hiệu lực", async () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const user = await User.create({
      name: "Active Pro User",
      email: `active-${Date.now()}@test.local`,
      plan: "starter_pro",
      planExpiresAt: future,
      quota: { cvAnalysisLimit: 10, interviewLimit: 3 },
    });

    await syncPlanExpiry(String(user._id));

    const refreshed = await User.findById(user._id).lean();
    assert.equal(refreshed.plan, "starter_pro");
    assert.equal(refreshed.quota.cvAnalysisLimit, 10);
  });

  it("getCurrentPlan tự đồng bộ hết hạn trước khi trả kết quả", async () => {
    const past = new Date(Date.now() - 60 * 1000);
    const user = await User.create({
      name: "Expired Via Read",
      email: `expired-read-${Date.now()}@test.local`,
      plan: "starter_pro",
      planExpiresAt: past,
      quota: { cvAnalysisLimit: 10, interviewLimit: 3 },
    });

    const res = await getCurrentPlan(String(user._id));
    assert.equal(res.ok, true);
    assert.equal(res.plan, "free");
    assert.equal(res.quota.cvAnalysisLimit, 3);
  });

  it("gói năm còn hiệu lực nhưng tới hạn reset hàng tháng → lượt dùng về 0, KHÔNG hạ gói", async () => {
    const cycleOverdue = new Date(Date.now() - 24 * 60 * 60 * 1000); // hạn reset tháng đã qua
    const planStillActive = new Date(Date.now() + 300 * 24 * 60 * 60 * 1000); // gói năm còn ~10 tháng
    const user = await User.create({
      name: "Yearly Mid-cycle",
      email: `yearly-cycle-${Date.now()}@test.local`,
      plan: "elite_pro",
      planExpiresAt: planStillActive,
      quota: {
        cvAnalysisUsed: 30,
        cvAnalysisLimit: 30,
        interviewUsed: 8,
        interviewLimit: 8,
        interviewQuestionsAllowed: 5,
        resetAt: cycleOverdue,
      },
    });

    const res = await getCurrentPlan(String(user._id));
    assert.equal(res.ok, true);
    assert.equal(res.plan, "elite_pro"); // gói vẫn còn hiệu lực, không bị hạ về free
    assert.equal(res.planExpiresAt.getTime(), planStillActive.getTime()); // hạn gói không đổi
    assert.equal(res.quota.cvAnalysisUsed, 0); // lượt dùng đã reset
    assert.equal(res.quota.interviewUsed, 0);
    assert.equal(res.quota.cvAnalysisLimit, 30); // hạn mức gói giữ nguyên
    assert.ok(new Date(res.quota.resetAt) > new Date()); // mốc reset kế tiếp đã dời sang tương lai
  });

  it("gói còn hiệu lực và chưa tới hạn reset → không đụng tới lượt dùng", async () => {
    const cycleFuture = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    const planStillActive = new Date(Date.now() + 300 * 24 * 60 * 60 * 1000);
    const user = await User.create({
      name: "Yearly Not Due",
      email: `yearly-notdue-${Date.now()}@test.local`,
      plan: "starter_pro",
      planExpiresAt: planStillActive,
      quota: { cvAnalysisUsed: 7, cvAnalysisLimit: 10, resetAt: cycleFuture },
    });

    const res = await getCurrentPlan(String(user._id));
    assert.equal(res.quota.cvAnalysisUsed, 7); // chưa tới hạn, giữ nguyên
    assert.equal(new Date(res.quota.resetAt).getTime(), cycleFuture.getTime());
  });
});

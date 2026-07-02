import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveSubscriptionAmount, resolvePlanPerkDiscountRate } from "./planCatalog.js";

describe("planCatalog", () => {
  it("resolveSubscriptionAmount starter monthly", () => {
    assert.equal(resolveSubscriptionAmount("starterPro", "monthly"), 99000);
    assert.equal(resolveSubscriptionAmount("starter_pro", "monthly"), 99000);
  });

  it("resolveSubscriptionAmount starter yearly", () => {
    assert.equal(resolveSubscriptionAmount("starterPro", "yearly"), 1188000);
  });

  it("resolveSubscriptionAmount elite yearly", () => {
    assert.equal(resolveSubscriptionAmount("elite_pro", "yearly"), 2388000);
  });

  it("resolveSubscriptionAmount elite monthly", () => {
    assert.equal(resolveSubscriptionAmount("elite_pro", "monthly"), 199000);
  });

  it("resolveSubscriptionAmount invalid plan", () => {
    assert.equal(resolveSubscriptionAmount("free", "monthly"), null);
    assert.equal(resolveSubscriptionAmount("bogus", "monthly"), null);
  });

  it("resolvePlanPerkDiscountRate maps plan keys to the advertised /pricing perk %", () => {
    assert.equal(resolvePlanPerkDiscountRate("starter_pro"), 0.05);
    assert.equal(resolvePlanPerkDiscountRate("starterPro"), 0.05);
    assert.equal(resolvePlanPerkDiscountRate("elite_pro"), 0.1);
    assert.equal(resolvePlanPerkDiscountRate("elitePro"), 0.1);
  });

  it("resolvePlanPerkDiscountRate returns 0 for free/unknown/empty plan", () => {
    assert.equal(resolvePlanPerkDiscountRate("free"), 0);
    assert.equal(resolvePlanPerkDiscountRate("bogus"), 0);
    assert.equal(resolvePlanPerkDiscountRate(null), 0);
    assert.equal(resolvePlanPerkDiscountRate(undefined), 0);
  });
});

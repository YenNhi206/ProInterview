import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  apiPlanToLocalFlags,
  migrateLegacyPlanFlags,
  resolvePlansFromStorageAndUser,
} from "./planSync.js";

describe("apiPlanToLocalFlags", () => {
  it("maps elite_pro to both flags", () => {
    assert.deepEqual(apiPlanToLocalFlags("elite_pro"), { starterPro: true, elitePro: true });
  });

  it("maps starter_pro to starter only", () => {
    assert.deepEqual(apiPlanToLocalFlags("starter_pro"), { starterPro: true, elitePro: false });
  });

  it("defaults unknown to free", () => {
    assert.deepEqual(apiPlanToLocalFlags("unknown"), { starterPro: false, elitePro: false });
    assert.deepEqual(apiPlanToLocalFlags(), { starterPro: false, elitePro: false });
  });
});

describe("migrateLegacyPlanFlags", () => {
  it("migrates voicePro/cvPro legacy keys", () => {
    assert.deepEqual(migrateLegacyPlanFlags({ voicePro: true, cvPro: false }), {
      starterPro: true,
      elitePro: false,
    });
    assert.deepEqual(migrateLegacyPlanFlags({ voicePro: true, cvPro: true }), {
      starterPro: true,
      elitePro: true,
    });
  });

  it("returns defaults for nullish input", () => {
    assert.deepEqual(migrateLegacyPlanFlags(null), { starterPro: false, elitePro: false });
  });

  it("spreads modern flags when no legacy keys", () => {
    assert.deepEqual(migrateLegacyPlanFlags({ starterPro: true, elitePro: false }), {
      starterPro: true,
      elitePro: false,
    });
  });
});

describe("resolvePlansFromStorageAndUser", () => {
  it("resets to false when API confirms user is free (không giữ cache Pro/Elite cũ)", () => {
    const stored = { starterPro: true, elitePro: true };
    assert.deepEqual(resolvePlansFromStorageAndUser(stored, "free"), {
      starterPro: false,
      elitePro: false,
    });
  });

  it("keeps storage when no plan info available yet (chưa biết, không phải free xác thực)", () => {
    const stored = { starterPro: true, elitePro: false };
    assert.deepEqual(resolvePlansFromStorageAndUser(stored, null), stored);
  });

  it("overrides storage when API plan differs", () => {
    assert.deepEqual(
      resolvePlansFromStorageAndUser({ starterPro: false, elitePro: false }, "elite_pro"),
      { starterPro: true, elitePro: true },
    );
  });

  it("keeps storage when API matches", () => {
    const stored = { starterPro: true, elitePro: true };
    assert.deepEqual(resolvePlansFromStorageAndUser(stored, "elite_pro"), stored);
  });
});

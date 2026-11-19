/**
 * LP-01: bộ tiêu chí SHRM/DDI (config/competencies.json) và các hàm quy đổi mức.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  COMPETENCY_LIBRARY,
  ROLE_COMPETENCY_MAP,
  getFramework,
  getCompetency,
  isValidCompetencyKey,
  aiAnswerToLevel,
  suggestOutcome,
  toDisplayLevel,
  buildCompetencyPromptBlock,
  buildDistributionGuide,
  detectCompetenciesFromText,
  resolveTopCompetencies,
} from "./competencyFramework.js";

/** 20 key có từ trước LP-01 — không được đổi tên hay xóa. */
const LEGACY_KEYS = [
  "problem_solving", "communication", "teamwork", "leadership", "adaptability",
  "technical_learning", "planning_execution", "innovation", "customer_focus", "integrity",
  "accountability", "data_driven_decision", "stakeholder_management", "conflict_resolution",
  "coaching_development", "strategic_thinking", "emotional_intelligence", "results_orientation",
  "risk_management", "cross_functional_influence",
];

const CONFIG_URL = new URL("../config/competencies.json", import.meta.url);
const rawConfig = JSON.parse(readFileSync(CONFIG_URL, "utf8"));

describe("competencies.json", () => {
  it("có version, scale 0–5, passThreshold 3, aiCalibration tạm", () => {
    assert.match(rawConfig.version, /^\d{4}-\d{2}-v\d+$/);
    assert.deepEqual(rawConfig.scale, { min: 0, max: 5 });
    assert.equal(rawConfig.passThreshold, 3);
    assert.deepEqual(rawConfig.aiCalibration, { offset: -1, maxLevel: 4, status: "provisional" });
  });

  it("levels đủ 0–5, mỗi mức có nhãn và mô tả", () => {
    assert.deepEqual(rawConfig.levels.map((l) => l.score), [0, 1, 2, 3, 4, 5]);
    for (const l of rawConfig.levels) {
      assert.ok(l.label?.trim(), `mức ${l.score} thiếu label`);
      assert.ok(l.descriptor?.trim(), `mức ${l.score} thiếu descriptor`);
    }
  });

  it("đủ 20 key cũ, không trùng key", () => {
    const keys = rawConfig.competencies.map((c) => c.key);
    assert.equal(new Set(keys).size, keys.length, "có key trùng");
    for (const k of LEGACY_KEYS) assert.ok(keys.includes(k), `thiếu key ${k}`);
  });

  it("mỗi năng lực có nameVi, indicators, anchors 1/3/5 và cờ deprecated", () => {
    for (const c of rawConfig.competencies) {
      assert.ok(c.nameVi?.trim(), `${c.key} thiếu nameVi`);
      assert.ok(Array.isArray(c.indicators) && c.indicators.length > 0, `${c.key} thiếu indicators`);
      for (const lvl of ["1", "3", "5"]) {
        assert.ok(c.anchors?.[lvl]?.trim(), `${c.key} thiếu anchors.${lvl}`);
      }
      assert.equal(typeof c.deprecated, "boolean", `${c.key} thiếu deprecated`);
    }
  });
});

describe("luồng phỏng vấn không đổi hành vi (golden trước LP-01)", () => {
  // Hash chụp từ competencyFramework.js bản khai báo cứng, ngay trước khi chuyển sang JSON.
  // Sửa các field luồng phỏng vấn dùng (nameVi, definition, ddiKeyActions, starRubric,
  // keywords, synonyms, relevantLayers…) thì hash đổi: cập nhật hash có chủ đích.
  // Sửa anchors, levels, aiCalibration không ảnh hưởng hash.
  const h = (v) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
  const samples = [
    ["Frontend Developer", "IT", "React, team, sprint, tối ưu performance, trình bày với stakeholder", "Cần giao tiếp tốt, agile"],
    ["Product Manager", "", "roadmap, khách hàng, data, A/B test, dẫn dắt nhóm", ""],
    ["", "", "", ""],
    ["Data Analyst", "data", "SQL, dashboard, power bi, báo cáo, phân tích", "insight"],
  ];
  const keys = Object.keys(COMPETENCY_LIBRARY);

  it("COMPETENCY_LIBRARY giữ nguyên hình dạng và nội dung", () => {
    assert.deepEqual(keys, LEGACY_KEYS);
    assert.equal(h(COMPETENCY_LIBRARY), "7b16afc71c2f1ef2b59970f5d4dd40107b65c3ec3c7beeea01195b175e2d1797");
    assert.equal(h(ROLE_COMPETENCY_MAP), "787a9345f3426e52767c51cceaaa200a6a0052ba4d8e1aaf151f892c6f835b08");
  });

  it("prompt block, distribution guide, detect, resolve ra y hệt", () => {
    assert.equal(h(buildCompetencyPromptBlock(keys)), "bcbc61119cbe9c88df26cb345a42a703f17d62dfd6cdc8287283b81327a84269");
    assert.equal(h(buildDistributionGuide(keys)), "56476e5bad48069deba07f248d22ebe1f6e52d9069e905e969be4f842be5955d");
    assert.equal(
      h(samples.map(([, , c, j]) => detectCompetenciesFromText(c, j))),
      "cf7b5cb1f378eb5dd34e00d6967a6ec09d830d442427faefb842b0581c7806a8",
    );
    assert.equal(
      h(samples.map(([p, f, c, j]) => resolveTopCompetencies(p, f, c, j, 4))),
      "a807110a9a8b3191114ab3ccf62c7ca3efbd9119dde943d0ecbb949b9966e2d2",
    );
  });
});

describe("getFramework / getCompetency", () => {
  it("getFramework trả bản đóng băng, cùng nội dung file", () => {
    const fw = getFramework();
    assert.ok(Object.isFrozen(fw));
    assert.ok(Object.isFrozen(fw.competencies[0].anchors));
    assert.deepEqual(JSON.parse(JSON.stringify(fw)), rawConfig);
  });

  it("getCompetency theo key, key lạ → null", () => {
    assert.equal(getCompetency("teamwork").nameVi, COMPETENCY_LIBRARY.teamwork.nameVi);
    assert.equal(getCompetency("khong_ton_tai"), null);
  });
});

describe("isValidCompetencyKey", () => {
  it("key thường → true", () => {
    assert.equal(isValidCompetencyKey("problem_solving"), true);
  });

  it("key lạ / không phải chuỗi → false", () => {
    assert.equal(isValidCompetencyKey("Giải quyết vấn đề"), false);
    assert.equal(isValidCompetencyKey(""), false);
    assert.equal(isValidCompetencyKey(null), false);
    assert.equal(isValidCompetencyKey(undefined, { allowDeprecated: true }), false);
  });

  it("key deprecated: bị từ chối mặc định, chấp nhận khi allowDeprecated", async () => {
    // Nạp một bản module riêng đọc config tạm có thêm key deprecated.
    const dir = mkdtempSync(path.join(tmpdir(), "lp01-"));
    try {
      const cfg = structuredClone(rawConfig);
      cfg.competencies.push({ ...cfg.competencies[0], key: "old_skill", deprecated: true });
      mkdirSync(path.join(dir, "services"));
      mkdirSync(path.join(dir, "config"));
      writeFileSync(path.join(dir, "config", "competencies.json"), JSON.stringify(cfg));
      const modPath = path.join(dir, "services", "competencyFramework.js");
      copyFileSync(new URL("./competencyFramework.js", import.meta.url), modPath);
      const mod = await import(pathToFileURL(modPath).href);

      assert.equal(mod.isValidCompetencyKey("old_skill"), false);
      assert.equal(mod.isValidCompetencyKey("old_skill", { allowDeprecated: true }), true);
      assert.equal(mod.getCompetency("old_skill").deprecated, true);
      // Dữ liệu cũ vẫn hiện được tên, nhưng key không được gợi ý cho câu hỏi mới.
      assert.ok(mod.COMPETENCY_LIBRARY.old_skill?.nameVi);
      assert.ok(!mod.detectCompetenciesFromText("bug lỗi debug", "").includes("old_skill"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("aiAnswerToLevel", () => {
  const answered = { transcript: "Em đã xử lý sự cố bằng cách..." };
  const approx = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);

  it("có moderatorOverride → dùng điểm moderator, áp cùng hệ số", () => {
    const answer = { ...answered, moderatorOverride: { overall: 4.5 } };
    approx(aiAnswerToLevel({ overall5: 2, score: 40 }, { answer }), 3.5);
    // Override nằm trên item (dạng response API đã gộp moderationFieldsFor)
    approx(aiAnswerToLevel({ overall: 2, moderatorOverride: { overall: 5 } }), 4);
  });

  it("moderatorOverride thắng cả evaluationIncomplete", () => {
    const answer = { ...answered, evaluationIncomplete: true, moderatorOverride: { overall: 3 } };
    approx(aiAnswerToLevel({ overall5: 3 }, { answer }), 2);
  });

  it("evaluationIncomplete = true → null (trên answer hoặc trên item)", () => {
    assert.equal(aiAnswerToLevel({ overall5: 3 }, { answer: { ...answered, evaluationIncomplete: true } }), null);
    assert.equal(aiAnswerToLevel({ overall: 3, evaluationIncomplete: true }), null);
  });

  it("overall5 = 5 / 4 / 3.5 / 1 → 4 / 3 / 2.5 / 0", () => {
    approx(aiAnswerToLevel({ overall5: 5, score: 100 }, { answer: answered }), 4);
    approx(aiAnswerToLevel({ overall5: 4 }, { answer: answered }), 3);
    approx(aiAnswerToLevel({ overall5: 3.5 }, { answer: answered }), 2.5);
    approx(aiAnswerToLevel({ overall5: 1 }, { answer: answered }), 0);
  });

  it("đọc field overall của response API khi không có overall5", () => {
    approx(aiAnswerToLevel({ overall: 4 }), 3);
  });

  it("không trả lời (transcript rỗng hoặc không có answer) → 0", () => {
    assert.equal(aiAnswerToLevel({ overall5: 0, score: 0 }, { answer: { transcript: "   " } }), 0);
    assert.equal(aiAnswerToLevel({ overall5: 0, score: 0 }, { answer: null }), 0);
  });

  it("chỉ có score (session cũ) → score / 20 rồi áp hệ số", () => {
    approx(aiAnswerToLevel({ overall5: 0, score: 80 }, { answer: answered }), 3);
    approx(aiAnswerToLevel({ score: 70 }), 2.5);
  });

  it("không có điểm nào → null", () => {
    assert.equal(aiAnswerToLevel({ overall5: 0, score: 0 }, { answer: answered }), null);
    assert.equal(aiAnswerToLevel({ overall5: 0, score: 0 }), null);
    assert.equal(aiAnswerToLevel({}), null);
    assert.equal(aiAnswerToLevel(null), null);
  });

  it("không bao giờ đọc shrmLevel", () => {
    assert.equal(aiAnswerToLevel({ shrmLevel: "excellent" }), null);
    approx(aiAnswerToLevel({ overall5: 2, shrmLevel: "excellent" }), 1);
  });

  it("chặn dưới 0; nhận calibration ghi đè (backtest AI-01)", () => {
    approx(aiAnswerToLevel({ overall5: 0.5 }), 0);
    approx(aiAnswerToLevel({ overall5: 5 }, { calibration: { offset: 0, maxLevel: 5 } }), 5);
  });
});

describe("suggestOutcome", () => {
  const keys = ["teamwork", "communication"];

  it("mọi key ≥ 3 → passed (dùng số thập phân, không làm tròn)", () => {
    assert.equal(suggestOutcome({ teamwork: 3, communication: 4.5 }, keys), "passed");
  });

  it("một key dưới ngưỡng → not_passed, kể cả khi trung bình ≥ 3", () => {
    assert.equal(suggestOutcome({ teamwork: 5, communication: 2.5 }, keys), "not_passed");
  });

  it("có key null hoặc thiếu điểm → null (không gợi ý)", () => {
    assert.equal(suggestOutcome({ teamwork: 4, communication: null }, keys), null);
    assert.equal(suggestOutcome({ teamwork: 1 }, keys), null);
  });

  it("nhận Map; buổi không có key → null", () => {
    assert.equal(suggestOutcome(new Map([["teamwork", 3], ["communication", 3]]), keys), "passed");
    assert.equal(suggestOutcome({ teamwork: 4 }, []), null);
  });
});

describe("toDisplayLevel", () => {
  it("Math.round, null giữ nguyên", () => {
    assert.equal(toDisplayLevel(2.5), 3);
    assert.equal(toDisplayLevel(2.4), 2);
    assert.equal(toDisplayLevel(0), 0);
    assert.equal(toDisplayLevel(null), null);
    assert.equal(toDisplayLevel(undefined), null);
  });
});

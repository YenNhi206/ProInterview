/** Unit CO-09: cờ luật và lọc cờ AI khi kiểm tra rubric công ty. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ruleFlags, sanitizeAiFlags, rubricContentHash, buildRubricDigest, buildCompetencyCatalog } from "./rubricReviewService.js";

const LEVELS = {
  0: "Không nêu được ví dụ nào về giao tiếp với người khác.",
  1: "Kể ví dụ nhưng không rõ mình đã nói gì với ai.",
  2: "Có ví dụ cụ thể nhưng thiếu kết quả của cuộc trao đổi.",
  3: "Ví dụ đủ STAR, nói rõ cách điều chỉnh thông điệp cho người nghe.",
  4: "Như mức 3, kèm kết quả đo được (khách hàng đồng ý, giảm hiểu lầm).",
  5: "Như mức 4, chủ động thay đổi cách nhóm trao đổi thông tin.",
};
const crit = (name, shrmKey, weight, levels = LEVELS) => ({ name, shrmKey, weight, description: "", levels });
const codes = (flags) => flags.map((f) => `${f.code}@${f.criterionIndex}`).sort();

describe("ruleFlags (CO-09)", () => {
  it("rubric sạch không có cờ", () => {
    const rubric = { criteria: [crit("Giao tiếp", "communication", 60), crit("Giải quyết vấn đề", "problem_solving", 40, {
      ...Object.fromEntries(Object.entries(LEVELS).map(([k, v]) => [k, `${v} (phân tích)`])),
    })] };
    assert.deepEqual(ruleFlags(rubric), []);
  });

  it("bắt tổng trọng số, key sai, key trùng, tên trùng, thiếu mức, mức chép y hệt, thang chép lại, mức quá ngắn", () => {
    const copiedLevel = { ...LEVELS, 4: LEVELS[3] };
    const shortLevel = { ...LEVELS, 0: "Kém", 5: "Rất tốt" };
    const rubric = {
      criteria: [
        crit("Giao tiếp", "communication", 30),
        crit("Giao tiếp ", "communication", 30),          // tên + key + thang trùng tiêu chí 1
        crit("Kỹ thuật", "technical_mastery", 20, copiedLevel), // key ngoài LP-01, hai mức giống nhau
        crit("Làm việc nhóm", "teamwork", 10, { ...shortLevel, 2: "" }),
      ],
    };
    const flags = ruleFlags(rubric);
    assert.deepEqual(codes(flags), [
      "copied_scale@1",
      "duplicate_level@2",
      "duplicate_name@1",
      "duplicate_shrm_key@1",
      "invalid_shrm_key@2",
      "missing_level@3",
      "short_level@3",
      "weight_sum@null",
    ]);
    assert.ok(flags.every((f) => f.source === "rule"));
    assert.match(flags.find((f) => f.code === "weight_sum").message, /90%/);
    assert.match(flags.find((f) => f.code === "duplicate_level").message, /mức 3 và mức 4/);
    assert.match(flags.find((f) => f.code === "short_level").message, /mức 0, 5/);
  });

  it("rubric không có tiêu chí → 1 cờ critical", () => {
    const flags = ruleFlags({ criteria: [] });
    assert.equal(flags.length, 1);
    assert.equal(flags[0].severity, "critical");
  });

  it("levels dạng Map (document Mongoose) đọc như object", () => {
    const rubric = { criteria: [{ ...crit("Giao tiếp", "communication", 100), levels: new Map(Object.entries(LEVELS)) }] };
    assert.deepEqual(ruleFlags(rubric), []);
    assert.equal(rubricContentHash(rubric), rubricContentHash({ criteria: [crit("Giao tiếp", "communication", 100)] }));
  });
});

describe("sanitizeAiFlags (CO-09)", () => {
  const rubric = { criteria: [crit("Thuyết trình", "problem_solving", 50), crit("Giao tiếp", "communication", 50)] };

  it("giữ mã hợp lệ, đổi số tiêu chí sang 0-based, lọc key gợi ý", () => {
    const out = sanitizeAiFlags([
      { code: "shrm_mismatch", severity: "critical", criterion: 1, message: "Đo giao tiếp chứ không phải giải quyết vấn đề.", suggested_shrm_key: "communication" },
      { code: "shrm_mismatch", criterion: 2, message: "x", suggested_shrm_key: "communication" }, // trùng key đang chọn
      { code: "vague_scale", criterion: 9, message: "Mức 5 'rất tốt'.", suggested_shrm_key: "teamwork" },   // tiêu chí không tồn tại
      { code: "shrm_mismatch", criterion: 1, message: "y", suggested_shrm_key: "technical_mastery" },      // key ngoài LP-01
      { code: "approve_now", criterion: 1, message: "bỏ" },
    ], rubric);
    assert.equal(out.length, 4);
    assert.deepEqual(out[0], {
      code: "shrm_mismatch", severity: "critical", criterionIndex: 0,
      message: "Đo giao tiếp chứ không phải giải quyết vấn đề.", evidence: "", suggestedShrmKey: "communication", source: "ai",
    });
    assert.equal(out[1].suggestedShrmKey, "");
    assert.equal(out[2].criterionIndex, null);
    assert.equal(out[2].suggestedShrmKey, "", "chỉ shrm_mismatch mới có key gợi ý");
    assert.equal(out[2].severity, "warning");
    assert.equal(out[3].suggestedShrmKey, "");
  });

  it("không phải mảng → rỗng", () => {
    assert.deepEqual(sanitizeAiFlags(null, rubric), []);
  });
});

describe("bản gửi LLM (CO-09)", () => {
  it("digest có tên năng lực, trọng số và đủ 6 mức; catalog có key LP-01", () => {
    const digest = buildRubricDigest({ title: "Rubric BE", roleCategory: "backend", criteria: [crit("Giao tiếp", "communication", 100, { ...LEVELS, 5: "" })] });
    assert.match(digest, /Tiêu chí 1: Giao tiếp \(trọng số 100%\)/);
    assert.match(digest, /shrmKey: communication — /);
    assert.match(digest, /Mức 5: \(trống\)/);
    const catalog = buildCompetencyCatalog();
    assert.match(catalog, /^- problem_solving — /m);
    assert.ok(!/technical_mastery/.test(catalog));
  });
});

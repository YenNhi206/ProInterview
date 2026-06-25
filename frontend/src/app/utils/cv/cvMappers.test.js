import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  filterHighlightKeywords,
  formatSkillSuggestionReason,
  formatSuggestionDisplayReason,
  mapAnalysisDocToHistoryItem,
  mapAnalysisDocToUiResult,
  mapPythonCvPipelineToAnalysis,
  buildCvAnalysisSavePayload,
  computeCvRemainingFromQuota,
} from "./cvMappers.js";

const FIELD_PIPELINE_RAW = {
  match: {
    matching: ["react", "python"],
    missing: ["docker", "aws"],
    match_score: 40,
    summary: { cv_total: 5, jd_total: 4 },
  },
  scores: {
    clarity: { score: 7, reason: "Rõ ràng" },
    structure: { score: 6, reason: "OK" },
    relevance: { score: 8, reason: "IT" },
    credibility: { score: 5, reason: "Thiếu số liệu" },
    overall: 6.5,
    summary: "Tóm tắt field",
  },
  suggestions: {
    executive_summary: "Tóm tắt field",
    missing_skill_suggestions: [
      {
        skill: "docker",
        priority: "high",
        reframe_tip: "Học Docker",
        acquisition_path: "Khóa online",
        estimated_effort: "1 tháng",
      },
    ],
    rewritten_bullets: [],
  },
  resume_text: "CV body text",
  jd_text: "",
  field: "IT / Công nghệ",
};

describe("filterHighlightKeywords", () => {
  it("loại bỏ từ 1 ký tự", () => {
    assert.deepEqual(filterHighlightKeywords(["React", "r", "node.js"]), [
      "React",
      "node.js",
    ]);
  });

  it("trả [] khi input null", () => {
    assert.deepEqual(filterHighlightKeywords(null), []);
  });
});

describe("mapPythonCvPipelineToAnalysis", () => {
  it("map pipeline field (không JD)", () => {
    const a = mapPythonCvPipelineToAnalysis(FIELD_PIPELINE_RAW, {
      usedFallback: true,
      field: "IT / Công nghệ",
    });
    assert.equal(a.matchScore, 40);
    assert.equal(a.jdText, "");
    assert.equal(a.field, "IT / Công nghệ");
    assert.equal(a.matchedKeywords.length, 2);
    assert.equal(a.missingKeywords.length, 2);
    assert.ok(a.suggestions.length >= 1);
    assert.equal(a.scoreNotes.clarity, "Rõ ràng");
  });

  it("company luôn null (field mode)", () => {
    const a = mapPythonCvPipelineToAnalysis(FIELD_PIPELINE_RAW, { field: "Marketing" });
    assert.equal(a.company, null);
  });

  it("usedFallback: ghi chú phân tích cơ bản khi không có scores từ LLM", () => {
    const raw = {
      match: { matching: [], missing: [], match_score: 10, summary: {} },
      scores: null,
      suggestions: {},
      resume_text: "",
    };
    const a = mapPythonCvPipelineToAnalysis(raw, { usedFallback: true });
    assert.ok(a.scoreNotes.clarity.includes("cơ bản"));
  });
});

describe("buildCvAnalysisSavePayload", () => {
  it("field mode: mode field, tier suggestions", () => {
    const analysis = mapPythonCvPipelineToAnalysis(FIELD_PIPELINE_RAW, {
      field: "IT / Công nghệ",
    });
    const payload = buildCvAnalysisSavePayload({
      analysis,
      cvFileName: "cv.pdf",
      jdFileName: "",
      analyzeMode: "field",
    });
    assert.equal(payload.mode, "field");
    assert.equal(payload.field, "IT / Công nghệ");
    assert.equal(payload.tier, "suggestions");
    assert.equal(payload.jdFileName, "");
    assert.equal(payload.result.matchScore, 40);
    assert.ok(payload.result.suggestions?.executiveSummary);
    assert.equal(payload.meta.llmProvider, "unknown");
  });

  it("bỏ rewrittenBullets khi original/rewritten rỗng (Joi không cho chuỗi rỗng)", () => {
    const payload = buildCvAnalysisSavePayload({
      analysis: {
        matchScore: 70,
        matchedKeywords: ["react"],
        missingKeywords: [],
        summary: "ok",
        scores: { clarity: 3, structure: 3, relevance: 3, credibility: 3 },
        suggestions: [
          { type: "fix", before: "bullet A", after: "bullet A improved", reason: "" },
          { type: "fix", before: "bullet B", after: "", reason: "thiếu bản viết lại" },
        ],
      },
      cvFileName: "cv.pdf",
      analyzeMode: "field",
      field: "IT / Công nghệ",
      tier: "suggestions",
    });
    assert.equal(payload.result.suggestions.rewrittenBullets.length, 1);
    assert.equal(payload.result.suggestions.rewrittenBullets[0].rewritten, "bullet A improved");
  });

  it("sanitize priority + độ dài reason/summary cho DTO", () => {
    const analysis = mapPythonCvPipelineToAnalysis(
      {
        ...FIELD_PIPELINE_RAW,
        suggestions: {
          ...FIELD_PIPELINE_RAW.suggestions,
          executive_summary: "x".repeat(6000),
          missing_skill_suggestions: [
            {
              skill: "docker",
              priority: "High",
              reframe_tip: "y".repeat(800),
              acquisition_path: "path",
              estimated_effort: "1 tháng",
            },
          ],
        },
      },
      { field: "IT / Công nghệ" }
    );
    const payload = buildCvAnalysisSavePayload({
      analysis,
      cvFileName: "cv.pdf",
      analyzeMode: "field",
      tier: "suggestions",
    });
    assert.equal(payload.result.suggestions.missingSkillSuggestions[0].priority, "high");
    assert.ok(payload.result.suggestions.missingSkillSuggestions[0].reason.length <= 500);
    assert.ok(payload.result.suggestions.executiveSummary.length <= 5000);
  });

  it("meta mock + /analyze/field hợp lệ DTO", () => {
    const analysis = mapPythonCvPipelineToAnalysis(FIELD_PIPELINE_RAW, {
      field: "Marketing",
    });
    const payload = buildCvAnalysisSavePayload({
      analysis,
      cvFileName: "cv.pdf",
      analyzeMode: "field",
      meta: {
        llmProvider: "mock",
        pythonEndpoint: "/analyze/field",
        fallbackTriggered: true,
      },
    });
    assert.equal(payload.meta.llmProvider, "mock");
    assert.equal(payload.meta.pythonEndpoint, "/analyze/field");
    assert.equal(payload.field, "Marketing");
  });

  it("jd mode: mode jd + jdFileName", () => {
    const payload = buildCvAnalysisSavePayload({
      analysis: {
        matchScore: 80,
        summary: "ok",
        matchedKeywords: ["a"],
        missingKeywords: [],
        suggestions: [],
      },
      cvFileName: "c.pdf",
      jdFileName: "j.pdf",
      analyzeMode: "jd",
      tier: "basic",
    });
    assert.equal(payload.mode, "jd");
    assert.equal(payload.jdFileName, "j.pdf");
    assert.equal(payload.tier, "basic");
    assert.equal(payload.result.matchScore, 80);
  });
});

describe("mapAnalysisDocToHistoryItem / mapAnalysisDocToUiResult", () => {
  it("giữ mode field khi không có jdText", () => {
    const doc = {
      _id: "abc123",
      cvText: "text",
      jdText: "",
      cvFileName: "cv.pdf",
      createdAt: "2026-01-01T00:00:00.000Z",
      result: {
        _ui: {
          mode: "field",
          field: "Marketing",
          matchScore: 55,
          matchedKeywords: ["seo"],
        },
        matchScore: 55,
      },
    };
    const item = mapAnalysisDocToHistoryItem(doc);
    assert.equal(item.mode, "field");
    assert.equal(item.field, "Marketing");
    assert.equal(item.analysisId, "abc123");
    assert.equal(item.hasJdFile, false);

    const ui = mapAnalysisDocToUiResult(doc);
    assert.equal(ui.mode, "field");
    assert.equal(ui.matchScore, 55);
    assert.deepEqual(ui.matchedKeywords, ["seo"]);
  });

  it("round-trip: payload DB shape đọc lại UI được", () => {
    const analysis = mapPythonCvPipelineToAnalysis(FIELD_PIPELINE_RAW, {
      field: "IT / Công nghệ",
    });
    const payload = buildCvAnalysisSavePayload({
      analysis,
      cvFileName: "cv.pdf",
      analyzeMode: "field",
    });
    const doc = {
      _id: "id1",
      cvText: analysis.cvText,
      jdText: analysis.jdText,
      cvFileName: payload.cvFileName,
      mode: payload.mode,
      result: {
        match: {
          score: payload.result.matchScore,
          matchedKeywords: payload.result.matchedKeywords,
          missingKeywords: payload.result.missingKeywords,
        },
        skills: payload.result.skills,
        suggestions: payload.result.suggestions,
      },
    };
    const ui = mapAnalysisDocToUiResult(doc);
    assert.equal(ui.matchScore, 40);
    assert.equal(ui.cvText, "CV body text");
  });
});

describe("computeCvRemainingFromQuota", () => {
  it("returns limit minus used for free plan", () => {
    assert.equal(
      computeCvRemainingFromQuota({ cvAnalysisLimit: 5, cvAnalysisUsed: 1 }),
      4,
    );
  });

  it("returns limit minus used for elite_pro", () => {
    assert.equal(
      computeCvRemainingFromQuota({ cvAnalysisLimit: 40, cvAnalysisUsed: 3 }),
      37,
    );
  });

  it("returns 0 when used equals limit", () => {
    assert.equal(
      computeCvRemainingFromQuota({ cvAnalysisLimit: 3, cvAnalysisUsed: 3 }),
      0,
    );
  });

  it("never returns negative remaining", () => {
    assert.equal(
      computeCvRemainingFromQuota({ cvAnalysisLimit: 2, cvAnalysisUsed: 99 }),
      0,
    );
  });
});

describe("formatSkillSuggestionReason", () => {
  it("bỏ qua reframe_tip Không áp dụng, dùng acquisition_path", () => {
    const reason = formatSkillSuggestionReason({
      skill: "scrum",
      reframe_tip: "Không áp dụng",
      acquisition_path: "Khóa Scrum trên Coursera (4 tuần)",
      estimated_effort: "2 tuần",
    });
    assert.match(reason, /Coursera/);
    assert.doesNotMatch(reason, /Không áp dụng/i);
  });

  it("fallback JD khi cả reframe và path đều N/A", () => {
    const reason = formatSkillSuggestionReason({
      skill: "docker",
      reframe_tip: "N/A",
      acquisition_path: "",
      estimated_effort: "1 tháng",
    });
    assert.match(reason, /docker/i);
    assert.match(reason, /1 tháng/);
  });
});

describe("formatSuggestionDisplayReason", () => {
  it("thay lý do placeholder cho gợi ý bổ sung", () => {
    const text = formatSuggestionDisplayReason({
      type: "add",
      title: 'Bổ sung kỹ năng "scrum"',
      reason: "Không áp dụng",
    });
    assert.match(text, /scrum/i);
    assert.doesNotMatch(text, /Không áp dụng/i);
  });
});

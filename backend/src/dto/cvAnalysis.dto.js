import Joi from "joi";

// ============================================================
// SUB-SCHEMAS — match với CVAnalysisResultSchema trong model
// ============================================================

// Skill có thể đến dưới 2 dạng từ frontend:
//   String đơn giản: "React"
//   Object: { name: "React", category: "frontend", confidence: 0.9 }
// Controller sẽ normalize string → object sau khi validate.
const skillItemSchema = Joi.alternatives().try(
  Joi.string().trim().min(1).max(100),
  Joi.object({
    name:       Joi.string().trim().min(1).max(100).required(),
    category:   Joi.string().trim().max(50).optional(),
    aliases:    Joi.array().items(Joi.string().trim().max(100)).max(20).default([]),
    confidence: Joi.number().min(0).max(1).default(1),
  }).unknown(false),
);

const rewrittenBulletSchema = Joi.object({
  original:  Joi.string().required().max(2000),
  rewritten: Joi.string().required().max(2000),
  reasoning: Joi.string().allow("").max(1000).default(""),
  starElements: Joi.object({
    situation: Joi.boolean().default(false),
    task:      Joi.boolean().default(false),
    action:    Joi.boolean().default(false),
    result:    Joi.boolean().default(false),
  }).default({ situation: false, task: false, action: false, result: false }),
}).unknown(true); // allow extra fields từ Python service

const skillSuggestionSchema = Joi.object({
  skill:               Joi.string().required().max(100),
  priority:            Joi.string().valid("high", "medium", "low").default("medium"),
  reason:              Joi.string().allow("").max(500).default(""),
  resources:           Joi.array().items(Joi.string().max(500)).max(10).default([]),
  estimatedTimeWeeks:  Joi.number().min(0).max(260).optional(),
}).unknown(true);

const dimensionScoresSchema = Joi.object({
  clarity:     Joi.number().min(0).max(5).required(),
  structure:   Joi.number().min(0).max(5).required(),
  relevance:   Joi.number().min(0).max(5).required(),
  credibility: Joi.number().min(0).max(5).required(),
});

// ============================================================
// MAIN PAYLOAD SCHEMA
// ============================================================

// Lưu ý: schema này validate FRONTEND format (flat matchScore),
// không phải DB format (nested match.score).
// Controller chịu trách nhiệm transform sau khi validate.
const saveAnalysisSchema = Joi.object({
  // ----- N-11: id bản ghi `processing`/`completed` do POST /api/cv/analyze* tạo — ghi đè thay vì tạo mới -----
  analysisId: Joi.string().hex().length(24).optional(),

  // ----- File metadata -----
  cvFileName: Joi.string().trim().min(1).max(500).required(),
  cvFileId:   Joi.string().max(200).optional(),
  cvFileUrl:  Joi.string().max(2000).optional().allow(""),
  jdFileName: Joi.string().trim().max(500).optional().allow(""),
  jdFileId:   Joi.string().max(200).optional(),
  jdFileUrl:  Joi.string().max(2000).optional().allow(""),

  field:    Joi.string().trim().max(200).optional().allow("", null),
  position: Joi.string().trim().max(200).optional().allow("", null),

  // ----- Analysis configuration -----
  mode: Joi.string().valid("jd", "field").required(),
  tier: Joi.string().valid("suggestions", "full", "basic").required(),

  // ----- Result (flat shape từ frontend) -----
  result: Joi.object({
    matchScore:      Joi.number().min(0).max(100).required(),
    matchedKeywords: Joi.array().items(Joi.string().max(200)).max(200).default([]),
    missingKeywords: Joi.array().items(Joi.string().max(200)).max(200).default([]),

    skills: Joi.object({
      cv:      Joi.array().items(skillItemSchema).max(100).default([]),
      jd:      Joi.array().items(skillItemSchema).max(100).default([]),
      matched: Joi.array().items(Joi.string().max(200)).max(200).default([]),
      missing: Joi.array().items(Joi.string().max(200)).max(200).default([]),
    }).default({ cv: [], jd: [], matched: [], missing: [] }),

    scores: dimensionScoresSchema.optional(),

    suggestions: Joi.object({
      rewrittenBullets:        Joi.array().items(rewrittenBulletSchema).max(50).default([]),
      missingSkillSuggestions: Joi.array().items(skillSuggestionSchema).max(20).default([]),
      executiveSummary:        Joi.string().allow("").max(5000).default(""),
    }).optional(),

    /** Snapshot UI từ FE — đọc lại chi tiết lịch sử field/JD */
    _ui: Joi.object().unknown(true).optional(),
  }).required(),

  // ----- Plan -----
  planAtTime: Joi.string().valid("free", "pro", "enterprise").default("free"),

  // ----- Metadata -----
  meta: Joi.object({
    pythonServiceVersion: Joi.string().max(50).optional(),
    llmModel:             Joi.string().max(100).optional(),
    llmProvider:          Joi.string()
      .valid("groq", "gemini", "openai", "ollama", "deepseek", "glm", "unknown", "mock")
      .default("unknown"),
    processingTimeMs:  Joi.number().min(0).max(600_000).optional(),
    fallbackTriggered: Joi.boolean().default(false),
    fallbackReason:    Joi.string().max(200).optional(),
    pythonEndpoint:    Joi.string()
      .valid("/analyze", "/analyze/full", "/analyze/suggestions", "/analyze/field")
      .optional(),
  }).default({}),
}).required().unknown(false); // strict: reject unknown top-level keys; required() makes undefined invalid

// ============================================================
// BUSINESS RULES VALIDATION (sau khi schema pass)
// ============================================================

function validateBusinessRules(value) {
  const errors = [];

  if (value.tier === "suggestions" && !value.result.suggestions) {
    errors.push({
      field: "result.suggestions",
      message: "tier=suggestions requires result.suggestions to be present",
    });
  }

  if ((value.tier === "full" || value.tier === "suggestions") && !value.result.scores) {
    errors.push({
      field: "result.scores",
      message: `tier=${value.tier} requires result.scores to be present`,
    });
  }

  if (value.tier === "basic") {
    if (value.result.suggestions) {
      errors.push({
        field: "result.suggestions",
        message: "tier=basic should not include suggestions (only /analyze endpoint)",
      });
    }
    if (value.result.scores) {
      errors.push({
        field: "result.scores",
        message: "tier=basic should not include scores",
      });
    }
  }

  if (value.mode === "field" && !String(value.field ?? "").trim()) {
    errors.push({
      field: "field",
      message: "mode=field requires non-empty field (ngành nghề)",
    });
  }

  return errors.length > 0 ? errors : null;
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Validate payload save CV analysis từ frontend.
 *
 * @param {object} data — Raw request body
 * @returns {{ error: object|null, value: object|null, businessErrors: array|null }}
 */
function validateSaveAnalysis(data) {
  const { error, value } = saveAnalysisSchema.validate(data, {
    abortEarly: false,
    stripUnknown: false,
    convert: true,
  });

  if (error) {
    return { error, value: null, businessErrors: null };
  }

  const businessErrors = validateBusinessRules(value);
  return { error: null, value, businessErrors };
}

/**
 * Format Joi error thành response-friendly shape.
 */
function formatValidationError(error) {
  return error.details.map((d) => ({
    field: d.path.join("."),
    message: d.message,
    type: d.type,
  }));
}

const _schemas = {
  saveAnalysisSchema,
  skillItemSchema,
  rewrittenBulletSchema,
  skillSuggestionSchema,
  dimensionScoresSchema,
};

export { validateSaveAnalysis, formatValidationError, _schemas };

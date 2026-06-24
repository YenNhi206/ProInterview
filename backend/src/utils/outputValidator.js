/**
 * outputValidator.js — LLM output guard
 *
 * Validates the parsed JSON object returned by the question-generation LLM call.
 * Two concerns:
 *   1. Structural integrity — right shape, right count, required fields present
 *   2. Suspicious content — LLM exfiltrating credentials or secrets via output injection
 */

const SUSPICIOUS_PATTERNS = [
  /api[_\s]?key/i,
  /password/i,
  /secret[_\s]?key/i,
  /access[_\s]?token/i,
  /credentials/i,
  /bearer\s+[a-z0-9]/i,
  /\.env/i,
  /process\.env/i,
];

/**
 * Validate the full question set returned by the LLM.
 * Field names match the actual SHRM/DDI LLM output schema (snake_case from LLM).
 *
 * @param {unknown} obj
 * @param {number} [expectedCount=5]
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateQuestionSet(obj, expectedCount = 5) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return { valid: false, reason: "not_an_object" };
  }

  if (!Array.isArray(obj.questions)) {
    return { valid: false, reason: "questions_not_array" };
  }

  if (obj.questions.length !== expectedCount) {
    return { valid: false, reason: `expected_${expectedCount}_got_${obj.questions.length}` };
  }

  for (let i = 0; i < obj.questions.length; i++) {
    const q = obj.questions[i];

    // Required string fields (matches LLM output schema — competency_id not competency)
    const requiredFields = ["id", "question", "competency_id"];
    for (const field of requiredFields) {
      if (!q[field] || typeof q[field] !== "string") {
        return { valid: false, reason: `Q${i + 1}_missing_${field}` };
      }
    }

    // Sanity-check question length — too short = boilerplate, too long = hallucination
    if (q.question.length < 20 || q.question.length > 500) {
      return { valid: false, reason: `Q${i + 1}_suspicious_length_${q.question.length}` };
    }

    // Screen question text for credential/secret exfiltration patterns
    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(q.question)) {
        return { valid: false, reason: `Q${i + 1}_suspicious_content` };
      }
    }

    // star_guidance keys must be arrays when present
    if (q.star_guidance) {
      for (const k of ["situation", "task", "action", "result"]) {
        if (q.star_guidance[k] !== undefined && !Array.isArray(q.star_guidance[k])) {
          return { valid: false, reason: `Q${i + 1}_star_${k}_not_array` };
        }
      }
    }
  }

  return { valid: true };
}

export { validateQuestionSet };

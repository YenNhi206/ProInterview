/**
 * Kiểm tra kết quả chấm LLM có đủ 4 tiêu chí cho từng câu không (spec S1 §2.2).
 * Thuần logic — dùng trong evaluateTranscripts (interviewQuestionService.js).
 */
export const SCORE_DIMENSIONS = ["clarity", "structure", "relevance", "credibility"];

/** Điểm hợp lệ: số hữu hạn (hoặc chuỗi số). null / "" / thiếu / NaN = thiếu. */
export function isScoreValue(v) {
  if (v === null || v === undefined || v === "" || typeof v === "boolean") return false;
  return Number.isFinite(Number(v));
}

/** Các tiêu chí còn thiếu của 1 câu LLM trả về (câu không có trong output → thiếu cả 4). */
export function missingDimensions(rawQuestion) {
  if (!rawQuestion) return [...SCORE_DIMENSIONS];
  return SCORE_DIMENSIONS.filter((d) => !isScoreValue(rawQuestion.scores?.[d]));
}

/** Map question_index → câu LLM trả về (bỏ index lạ ngoài danh sách cần chấm). */
export function indexEvaluations(rawQuestions, expectedIndexes) {
  const allowed = new Set(expectedIndexes);
  const map = new Map();
  for (const q of rawQuestions ?? []) {
    const idx = Number(q?.question_index);
    if (Number.isInteger(idx) && allowed.has(idx) && !map.has(idx)) map.set(idx, q);
  }
  return map;
}

/** { questionIndex: missingFields[] } cho các câu còn thiếu tiêu chí. */
export function findIncomplete(byIndex, expectedIndexes) {
  const out = new Map();
  for (const idx of expectedIndexes) {
    const missing = missingDimensions(byIndex.get(idx));
    if (missing.length) out.set(idx, missing);
  }
  return out;
}

/**
 * Gộp kết quả retry vào bản gốc: chỉ lấp tiêu chí còn thiếu, giữ nguyên tiêu chí bản gốc đã có.
 * Câu bản gốc không có → lấy nguyên câu retry.
 */
export function mergeRetry(original, retry) {
  if (!retry) return original;
  if (!original) return retry;
  const scores = { ...(original.scores ?? {}) };
  for (const d of SCORE_DIMENSIONS) {
    if (!isScoreValue(scores[d]) && isScoreValue(retry.scores?.[d])) scores[d] = retry.scores[d];
  }
  return {
    ...retry,
    ...original,
    scores,
    overall: isScoreValue(original.overall) ? original.overall : retry.overall,
  };
}

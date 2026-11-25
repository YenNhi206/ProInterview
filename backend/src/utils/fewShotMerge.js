/**
 * Gộp few-shot của PromptVersion (AI-03, AI-05, AI-18).
 *
 * Few-shot có hai loại:
 *   - ví dụ đã kiểm duyệt (AI-03): cặp câu trả lời + điểm moderator, giữ tối đa `MAX_VERSION_EXAMPLES`
 *     ví dụ mới nhất để prompt không phình;
 *   - ví dụ neo theo năng lực (AI-18): `note` bắt đầu bằng `rubric_anchor:<shrmKey>`, mỗi key tối đa 1,
 *     không bị cắt theo trần trên (bản mới của cùng key thay bản cũ).
 */
export const MAX_VERSION_EXAMPLES = 9;
export const ANCHOR_NOTE_PREFIX = "rubric_anchor:";

export const isAnchorExample = (e) => String(e?.note ?? "").startsWith(ANCHOR_NOTE_PREFIX);
export const anchorKeyOf = (e) => (isAnchorExample(e) ? String(e.note).slice(ANCHOR_NOTE_PREFIX.length) : null);

/**
 * @param {object[]} base   few-shot của bản gốc
 * @param {object[]} added  few-shot thêm vào (ví dụ thường và/hoặc ví dụ neo)
 * @returns {object[]} ví dụ thường (mới nhất, tối đa trần) rồi tới ví dụ neo (mỗi key 1, bản mới thắng)
 */
export function mergeFewShotExamples(base = [], added = [], max = MAX_VERSION_EXAMPLES) {
  const all = [...(base ?? []), ...(added ?? [])];
  const plain = all.filter((e) => !isAnchorExample(e)).slice(-max);
  const anchors = new Map();
  for (const e of all) if (isAnchorExample(e)) anchors.set(anchorKeyOf(e), e);
  return [...plain, ...anchors.values()];
}

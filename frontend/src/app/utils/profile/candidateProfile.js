/**
 * PR-10: khối "Hồ sơ ứng viên" trên /profile — dữ liệu từ `/api/profile/me` (PR-01) và
 * `/api/profile/me/competencies` (PR-07). Tên năng lực ưu tiên bộ tiêu chí LP-01; key lạ thì dùng `name` backend trả.
 */

export const SOURCE_TYPE_LABEL = {
  ai_interview: "Phỏng vấn AI",
  mentor_session: "Buổi mentor",
  course: "Khóa học",
};

export const MAX_TARGET_ROLES = 5;

/** "Frontend, React Developer ,," → ["Frontend", "React Developer"] (bỏ trùng, tối đa 5). */
export function parseTargetRoles(text = "") {
  const seen = new Set();
  return String(text)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()))
    .slice(0, MAX_TARGET_ROLES);
}

/** Năng lực có ít nhất 1 bằng chứng thật (nguồn) mới hiện nhãn "Đã xác thực". */
export const isVerifiedCompetency = (c) => (c?.evidenceCount || c?.sources?.length || 0) > 0;

/** Thẻ năng lực để hiển thị: tên theo LP-01, mức 1–5, số bằng chứng, nguồn mới nhất trước. */
export function competencyCards(competencies = [], framework = null) {
  const nameOf = (c) => framework?.competencies?.find((f) => f.key === c.key)?.nameVi || c.name || c.key;
  return competencies
    .map((c) => ({
      key: c.key,
      name: nameOf(c),
      level: Math.min(5, Math.max(0, Number(c.level) || 0)),
      evidenceCount: c.evidenceCount || c.sources?.length || 0,
      verified: isVerifiedCompetency(c),
      sources: [...(c.sources || [])].sort((a, b) => new Date(b.at) - new Date(a.at)),
    }))
    .sort((a, b) => Number(b.verified) - Number(a.verified) || b.level - a.level);
}

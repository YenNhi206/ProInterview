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

/**
 * PR-06: "Đã xác thực" khi có ít nhất 1 bằng chứng có mức (phỏng vấn AI, buổi mentor) và có mức.
 * Năng lực chỉ có nguồn khóa học (`evidenceCount = 0`, `level = null`) hiện "Chưa đủ dữ liệu".
 */
export const isVerifiedCompetency = (c) => Number(c?.evidenceCount) > 0 && Number.isFinite(Number(c?.level)) && c?.level !== null;

/** Mức hiển thị: làm tròn 1 chữ số thập phân (LP-01: gộp bằng số thập phân, UI làm tròn khi hiển thị). */
export const displayLevel = (level) => (level === null || level === undefined || !Number.isFinite(Number(level)) ? null : Math.round(Number(level) * 10) / 10);

/** Thẻ năng lực để hiển thị: tên theo LP-01, mức 0–5, số bằng chứng, nguồn mới nhất trước. */
export function competencyCards(competencies = [], framework = null) {
  const nameOf = (c) => framework?.competencies?.find((f) => f.key === c.key)?.nameVi || c.name || c.key;
  return competencies
    .map((c) => {
      const verified = isVerifiedCompetency(c);
      return {
        key: c.key,
        name: nameOf(c),
        level: verified ? Math.min(5, Math.max(0, displayLevel(c.level))) : null,
        evidenceCount: Number(c.evidenceCount) || 0,
        verified,
        sources: [...(c.sources || [])].sort((a, b) => new Date(b.at) - new Date(a.at)),
      };
    })
    .sort((a, b) => Number(b.verified) - Number(a.verified) || (b.level ?? 0) - (a.level ?? 0));
}

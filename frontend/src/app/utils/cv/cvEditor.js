/**
 * PR-13: logic thuần cho trình sửa CV `/cvs/:id/edit` (không phụ thuộc React, có test).
 *
 * Nội dung CV theo `CVDocument.content` (backend/src/models/CVDocument.js): personalInfo, summary,
 * experiences[{ company, position, startDate, endDate, isCurrent, description, bullets[] }],
 * educations[], skills[], projects[{ ..., technologies[] }], certifications[].
 * Gợi ý AI lấy từ `result.suggestions.rewrittenBullets[{ original, rewritten, reasoning }]` của các lần
 * phân tích CV (`GET /api/cv/analyses`).
 */

const PERSONAL_FIELDS = ["fullName", "email", "phone", "location", "website", "linkedin", "github"];

export const emptyExperience = () => ({
  company: "",
  position: "",
  startDate: "",
  endDate: "",
  isCurrent: false,
  description: "",
  bullets: [""],
});
export const emptyEducation = () => ({ institution: "", degree: "", fieldOfStudy: "", startDate: "", endDate: "", gpa: "" });
export const emptyProject = () => ({ name: "", role: "", link: "", description: "", technologies: [] });
export const emptyCertification = () => ({ name: "", issuer: "", issueDate: "" });

const str = (v) => (v == null ? "" : String(v));
const strList = (v) => (Array.isArray(v) ? v.map(str) : []);
const pick = (src, keys) => Object.fromEntries(keys.map((k) => [k, str(src?.[k])]));

/** Đưa nội dung CV về đủ shape (mọi field có mặt) để form sửa không phải kiểm undefined. */
export function normalizeCvContent(content) {
  const c = content && typeof content === "object" ? content : {};
  return {
    personalInfo: pick(c.personalInfo, PERSONAL_FIELDS),
    summary: str(c.summary),
    experiences: (Array.isArray(c.experiences) ? c.experiences : []).map((e) => ({
      ...pick(e, ["company", "position", "startDate", "endDate", "description"]),
      isCurrent: Boolean(e?.isCurrent),
      bullets: strList(e?.bullets),
    })),
    educations: (Array.isArray(c.educations) ? c.educations : []).map((e) =>
      pick(e, ["institution", "degree", "fieldOfStudy", "startDate", "endDate", "gpa"]),
    ),
    skills: strList(c.skills),
    projects: (Array.isArray(c.projects) ? c.projects : []).map((p) => ({
      ...pick(p, ["name", "role", "link", "description"]),
      technologies: strList(p?.technologies),
    })),
    certifications: (Array.isArray(c.certifications) ? c.certifications : []).map((x) =>
      pick(x, ["name", "issuer", "issueDate"]),
    ),
  };
}

const hasText = (obj) => Object.values(obj).some((v) => (Array.isArray(v) ? v.some((x) => str(x).trim()) : typeof v === "string" && v.trim()));

/** Tách chuỗi "React, Node.js; MongoDB" thành danh sách, bỏ trùng (không phân biệt hoa thường). */
export function splitList(text) {
  const seen = new Set();
  const out = [];
  for (const raw of str(text).split(/[,;\n]/)) {
    const item = raw.trim();
    const key = item.toLowerCase();
    if (item && !seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

/**
 * Nội dung gửi `PATCH /api/cvs/:id` (`content`): trim chữ, bỏ bullet rỗng, bỏ mục trống hoàn toàn,
 * bỏ kỹ năng trùng. Không đổi thứ tự.
 */
export function toSavePayload(content) {
  const c = normalizeCvContent(content);
  const trimObj = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));
  return {
    personalInfo: trimObj(c.personalInfo),
    summary: c.summary.trim(),
    experiences: c.experiences
      .map((e) => ({ ...trimObj(e), bullets: e.bullets.map((b) => b.trim()).filter(Boolean) }))
      .filter(hasText)
      .map((e) => (e.isCurrent ? { ...e, endDate: "" } : e)),
    educations: c.educations.map(trimObj).filter(hasText),
    skills: splitList(c.skills.join(",")),
    projects: c.projects
      .map((p) => ({ ...trimObj(p), technologies: splitList(p.technologies.join(",")) }))
      .filter(hasText),
    certifications: c.certifications.map(trimObj).filter(hasText),
  };
}

/** Nội dung đã đổi so với bản đã lưu chưa (so theo payload sẽ gửi, nên khoảng trắng / dòng trống không tính). */
export function isContentChanged(saved, draft) {
  return JSON.stringify(toSavePayload(saved)) !== JSON.stringify(toSavePayload(draft));
}

/** Chuẩn hóa bullet để so khớp gợi ý AI: bỏ ký hiệu đầu dòng, gộp khoảng trắng, bỏ dấu câu cuối, chữ thường. */
export function normalizeBulletText(text) {
  return str(text)
    .replace(/^\s*(?:[-*•▪◦]|\d+[.)])\s*/, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.;,!]+$/, "")
    .trim();
}

/**
 * Gom gợi ý viết lại bullet từ danh sách phân tích CV (mới nhất trước), bỏ lần phân tích không có gợi ý.
 * @returns {{ analysisId: string, label: string, createdAt: string, items: {original: string, rewritten: string, reasoning: string}[] }[]}
 */
export function extractBulletSuggestions(analyses) {
  return (Array.isArray(analyses) ? analyses : [])
    .map((a) => {
      const items = (a?.result?.suggestions?.rewrittenBullets || [])
        .map((b) => ({ original: str(b?.original).trim(), rewritten: str(b?.rewritten).trim(), reasoning: str(b?.reasoning).trim() }))
        .filter((b) => b.rewritten && b.rewritten !== b.original);
      const target = str(a?.position || a?.field).trim();
      const label = [target || (a?.mode === "jd" ? "Phân tích CV với JD" : "Phân tích CV"), str(a?.cvFileName).trim()]
        .filter(Boolean)
        .join(" · ");
      return { analysisId: str(a?._id || a?.id), label, createdAt: str(a?.createdAt), items };
    })
    .filter((g) => g.analysisId && g.items.length > 0)
    .sort((x, y) => (y.createdAt > x.createdAt ? 1 : y.createdAt < x.createdAt ? -1 : 0));
}

/**
 * Vị trí các bullet khớp câu gốc của gợi ý. Khớp đúng (sau chuẩn hóa) trước; không có thì khớp chứa nhau
 * khi câu ngắn hơn đủ dài (≥ 20 ký tự) để tránh khớp nhầm.
 * @returns {{ expIndex: number, bulletIndex: number }[]}
 */
export function findBulletMatches(content, original) {
  const target = normalizeBulletText(original);
  if (!target) return [];
  const exps = normalizeCvContent(content).experiences;
  const exact = [];
  const partial = [];
  exps.forEach((e, expIndex) =>
    e.bullets.forEach((b, bulletIndex) => {
      const text = normalizeBulletText(b);
      if (!text) return;
      if (text === target) exact.push({ expIndex, bulletIndex });
      else if (Math.min(text.length, target.length) >= 20 && (text.includes(target) || target.includes(text))) {
        const closeness = Math.min(text.length, target.length) / Math.max(text.length, target.length);
        partial.push({ expIndex, bulletIndex, closeness });
      }
    }),
  );
  if (exact.length) return exact;
  // Khớp chứa nhau: câu dài gần bằng câu gốc nhất đứng đầu.
  return partial.sort((a, b) => b.closeness - a.closeness).map(({ expIndex, bulletIndex }) => ({ expIndex, bulletIndex }));
}

/** Thay một bullet bằng câu AI gợi ý (trả nội dung mới, không sửa bản cũ). */
export function applyBulletSuggestion(content, { expIndex, bulletIndex }, rewritten) {
  const c = normalizeCvContent(content);
  const exp = c.experiences[expIndex];
  if (!exp || bulletIndex < 0 || bulletIndex >= exp.bullets.length) return c;
  const experiences = c.experiences.map((e, i) =>
    i === expIndex ? { ...e, bullets: e.bullets.map((b, j) => (j === bulletIndex ? str(rewritten).trim() : b)) } : e,
  );
  return { ...c, experiences };
}

/** Thêm câu AI gợi ý thành bullet mới cuối một kinh nghiệm (khi không tìm thấy câu gốc trong CV). */
export function appendBullet(content, expIndex, text) {
  const c = normalizeCvContent(content);
  if (!c.experiences[expIndex]) return c;
  const experiences = c.experiences.map((e, i) =>
    i === expIndex ? { ...e, bullets: [...e.bullets.filter((b) => b.trim()), str(text).trim()] } : e,
  );
  return { ...c, experiences };
}

/** Tên file PDF tải về từ tiêu đề CV (giữ chữ có dấu, bỏ ký tự cấm trong tên file). */
export function pdfFileName(title) {
  const base = str(title).replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return `${base || "CV"}.pdf`;
}

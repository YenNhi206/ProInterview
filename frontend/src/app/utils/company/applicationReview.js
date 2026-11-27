/**
 * JB-16 (CM-04): hàm thuần cho trang /company/applications và chi tiết đơn.
 * Dữ liệu từ `GET /api/company/applications[/:id]` (JB-09). Doanh nghiệp chỉ đọc ứng viên qua `snapshot`
 * của đơn có đồng ý; đơn đã rút không còn snapshot (quyết định 14).
 */

export const APPLICATION_STATUS = {
  submitted: "Mới nộp",
  viewed: "Đã xem",
  shortlisted: "Vào danh sách chọn",
  rejected: "Chưa phù hợp",
  withdrawn: "Ứng viên đã rút",
};

/** Thứ tự tab lọc; "" = tất cả. */
export const APPLICATION_STATUS_TABS = ["", "submitted", "viewed", "shortlisted", "rejected", "withdrawn"];

/** Khớp `APPLICATION_NOTE_MAX` ở backend. */
export const APPLICATION_NOTE_MAX = 1000;

/** Nút được bấm theo trạng thái: chỉ đơn `submitted` / `viewed` còn xử lý được. */
export function applicationActions(status) {
  const open = status === "submitted" || status === "viewed";
  return { shortlist: open, reject: open };
}

/** Điểm rubric 0–5 → "4.2/5"; không có điểm → "—". */
export function formatRubricScore(score) {
  const n = Number(score);
  if (score === null || score === undefined || score === "" || !Number.isFinite(n)) return "—";
  return `${Math.round(n * 10) / 10}/5`;
}

export function formatApplicationDate(value, withTime = false) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", withTime
    ? { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Chỉ mở link http(s) (fileUrl, link dự án trong CV) — chặn `javascript:` và giá trị lạ. */
export function isSafeHttpUrl(url) {
  try {
    const u = new URL(String(url ?? "").trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Link file CV mở được: http(s), hoặc đường dẫn nội bộ `/uploads/...` (file lưu trên backend;
 * Vercel chuyển tiếp `/uploads/*` sang backend). Chặn `//host`, `..` và giá trị lạ.
 */
export function isSafeFileUrl(url) {
  const raw = String(url ?? "").trim();
  if (/^\/uploads\/[A-Za-z0-9._-]+$/.test(raw)) return true;
  return isSafeHttpUrl(raw);
}

const text = (v) => String(v ?? "").trim();

/**
 * Tóm tắt CV trong snapshot để hiển thị: bỏ mục rỗng, gộp kỹ năng của CV và nội dung CV (không trùng).
 * @param {object|null} cv snapshot.cv
 */
export function cvSections(cv) {
  if (!cv) return null;
  const c = cv.content || {};
  const seen = new Set();
  const skills = [...(cv.skills || []), ...(c.skills || [])]
    .map(text)
    .filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
  return {
    title: text(cv.title) || "CV",
    targetRole: text(cv.targetRole),
    fileName: text(cv.fileName),
    fileUrl: isSafeFileUrl(cv.fileUrl) ? text(cv.fileUrl) : "",
    summary: text(c.summary),
    skills,
    experiences: (c.experiences || [])
      .filter((e) => text(e.company) || text(e.position))
      .map((e) => ({
        title: [text(e.position), text(e.company)].filter(Boolean).join(" · "),
        period: [text(e.startDate), e.isCurrent ? "nay" : text(e.endDate)].filter(Boolean).join(" – "),
        description: text(e.description),
        bullets: (e.bullets || []).map(text).filter(Boolean),
      })),
    educations: (c.educations || [])
      .filter((e) => text(e.institution))
      .map((e) => ({
        title: [text(e.degree), text(e.fieldOfStudy)].filter(Boolean).join(", "),
        institution: text(e.institution),
        period: [text(e.startDate), text(e.endDate)].filter(Boolean).join(" – "),
      })),
    projects: (c.projects || [])
      .filter((p) => text(p.name))
      .map((p) => ({
        name: text(p.name),
        role: text(p.role),
        description: text(p.description),
        link: isSafeHttpUrl(p.link) ? text(p.link) : "",
        technologies: (p.technologies || []).map(text).filter(Boolean),
      })),
    certifications: (c.certifications || []).filter((x) => text(x.name)).map((x) => ({
      name: text(x.name),
      issuer: text(x.issuer),
    })),
  };
}

/** Câu trả lời trong snapshot, chia theo buổi phỏng vấn (mới nhất trước, giữ thứ tự câu trong buổi). */
export function answersBySession(answers = []) {
  const groups = new Map();
  for (const a of answers || []) {
    const key = a.sessionId || "";
    if (!groups.has(key)) groups.set(key, { sessionId: key, date: a.date ?? null, answers: [] });
    groups.get(key).answers.push(a);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, answers: [...g.answers].sort((x, y) => (x.questionIndex ?? 0) - (y.questionIndex ?? 0)) }))
    .sort((x, y) => new Date(y.date ?? 0) - new Date(x.date ?? 0));
}

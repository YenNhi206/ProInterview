/**
 * AI-11: chuẩn hóa dữ liệu `GET /api/recommendations/me` (AI-10) cho khối gợi ý trên /dashboard.
 * Hàm thuần, không gọi API, để test được bằng node:test.
 */

/** Số mục hiện trên mỗi cột của dashboard (API trả tối đa `limit`). */
export const DASHBOARD_RECOMMENDATION_LIMIT = 3;

/** Giá trị giữ chỗ backend dùng khi thiếu dữ liệu (vd. `company: "—"`), không hiện ra giao diện. */
const PLACEHOLDERS = new Set(["", "—", "-", "–", "n/a"]);

function clean(value) {
  const s = String(value ?? "").trim();
  return PLACEHOLDERS.has(s.toLowerCase()) ? "" : s;
}

/** Chỉ nhận đường dẫn nội bộ (`/...`), chặn `//host` và `javascript:`. */
export function safeInternalPath(url, fallback) {
  const s = String(url ?? "").trim();
  return s.startsWith("/") && !s.startsWith("//") ? s : fallback;
}

/**
 * Trang chi tiết job (`/jobs/:id`, JB-12) chưa có: tạm mở danh sách /jobs đã lọc theo tên job.
 * Khi JB-12 xong, đổi hàm này trả `item.actionUrl`.
 */
export function jobActionUrl(job) {
  const title = clean(job?.title);
  return title ? `/jobs?q=${encodeURIComponent(title)}` : "/jobs";
}

/** Bỏ trùng, giữ thứ tự (so không phân biệt hoa thường). */
export function uniqueLabels(list) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const s = clean(raw);
    const key = s.toLowerCase();
    if (!s || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/** "Senior DevOps Engineer · Zalo"; bỏ phần trống / giữ chỗ. */
export function mentorSubtitle(m) {
  return [clean(m?.title), clean(m?.company)].filter(Boolean).join(" · ");
}

/** "Công ty A · Hà Nội". */
export function jobSubtitle(j) {
  return [clean(j?.company?.name), clean(j?.location)].filter(Boolean).join(" · ");
}

/**
 * Dòng giải thích căn cứ gợi ý, hiện dưới tiêu đề khối.
 * Ưu tiên năng lực còn thiếu, rồi vị trí mục tiêu, cuối cùng là gợi ý chung.
 */
export function basisSummary(basis) {
  const gaps = Array.isArray(basis?.gaps) ? basis.gaps.filter((g) => clean(g?.name)) : [];
  if (gaps.length) {
    const names = gaps.slice(0, 2).map((g) => `"${clean(g.name)}"`).join(", ");
    const more = gaps.length > 2 ? ` và ${gaps.length - 2} năng lực khác` : "";
    return `Dựa trên năng lực bạn cần cải thiện: ${names}${more}.`;
  }
  const roles = uniqueLabels(basis?.targetRoles);
  if (roles.length) return `Dựa trên vị trí mục tiêu: ${roles.slice(0, 3).join(", ")}.`;
  return "Làm một buổi phỏng vấn AI hoặc cập nhật vị trí mục tiêu trong hồ sơ để gợi ý sát với bạn hơn.";
}

/**
 * @param {object|null|undefined} raw  `recommendations` từ API
 * @param {{ limit?: number }} [opts]
 */
export function normalizeRecommendations(raw, { limit = DASHBOARD_RECOMMENDATION_LIMIT } = {}) {
  const take = (list) => (Array.isArray(list) ? list : []).filter((x) => x && x.id != null).slice(0, limit);

  const mentors = take(raw?.mentors).map((m) => ({
    id: String(m.id),
    name: clean(m.name) || "Mentor",
    subtitle: mentorSubtitle(m),
    avatar: clean(m.avatar),
    reason: clean(m.reason),
    href: safeInternalPath(m.actionUrl, `/mentors/${encodeURIComponent(m.id)}`),
  }));
  const courses = take(raw?.courses).map((c) => ({
    id: String(c.id),
    title: clean(c.title) || "Khóa học",
    thumbnail: clean(c.thumbnail),
    price: Number(c.price) || 0,
    isFree: Boolean(c.isFree) || !(Number(c.price) > 0),
    reason: clean(c.reason),
    href: safeInternalPath(c.actionUrl, `/courses/${encodeURIComponent(c.id)}`),
  }));
  const jobs = take(raw?.jobs).map((j) => ({
    id: String(j.id),
    title: clean(j.title) || "Việc làm",
    subtitle: jobSubtitle(j),
    logo: clean(j?.company?.logo),
    companyName: clean(j?.company?.name),
    reason: clean(j.reason),
    href: jobActionUrl(j),
  }));

  return {
    mentors,
    courses,
    jobs,
    summary: basisSummary(raw?.basis),
    hasGaps: Array.isArray(raw?.basis?.gaps) && raw.basis.gaps.length > 0,
    isEmpty: !mentors.length && !courses.length && !jobs.length,
  };
}

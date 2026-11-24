/**
 * JB-15: logic thuần cho trang `/company/jobs` (danh sách + form soạn tin tuyển dụng của Company Moderator).
 * Backend (JB-01, `services/jobPostsService.js`) kiểm lại toàn bộ; các giới hạn ở đây khớp với backend để
 * báo lỗi sớm trên form thay vì đợi API trả 400.
 */

export const JOB_MIN_DESCRIPTION = 50;
export const JOB_MAX_DESCRIPTION = 10000;
export const JOB_MAX_COMPETENCIES = 10;
export const JOB_MAX_SKILLS = 30;
export const JOB_MAX_SKILL_LENGTH = 60;
export const JOB_TITLE_MIN = 3;
export const JOB_TITLE_MAX = 150;
/** Mức tối thiểu gợi ý khi thêm năng lực: mức "Đạt" của thang LP-01. */
export const DEFAULT_MIN_LEVEL = 3;

export const JOB_LEVELS = [
  { id: "intern", label: "Thực tập" },
  { id: "fresher", label: "Fresher" },
  { id: "junior", label: "Junior" },
  { id: "middle", label: "Middle" },
  { id: "senior", label: "Senior" },
  { id: "lead", label: "Lead" },
];
export const EMPLOYMENT_TYPES = [
  { id: "full_time", label: "Toàn thời gian" },
  { id: "part_time", label: "Bán thời gian" },
  { id: "contract", label: "Hợp đồng" },
  { id: "internship", label: "Thực tập" },
];
export const WORK_MODES = [
  { id: "onsite", label: "Tại văn phòng" },
  { id: "hybrid", label: "Kết hợp" },
  { id: "remote", label: "Từ xa" },
];
export const MIN_LEVEL_OPTIONS = [
  { value: 1, label: "Mức 1 · Yếu" },
  { value: 2, label: "Mức 2 · Đang phát triển" },
  { value: 3, label: "Mức 3 · Đạt" },
  { value: 4, label: "Mức 4 · Vững" },
  { value: 5, label: "Mức 5 · Xuất sắc" },
];

export const JOB_STATUS = {
  draft: "Bản nháp",
  published: "Đang đăng",
  hidden: "Bị ẩn",
  closed: "Đã đóng",
};
/** Thứ tự tab trên trang danh sách ("" = tất cả). */
export const JOB_STATUS_TABS = ["", "draft", "published", "hidden", "closed"];

const labelIn = (list, id) => list.find((x) => x.id === id)?.label || id || "";
export const levelLabel = (id) => labelIn(JOB_LEVELS, id);
export const employmentLabel = (id) => labelIn(EMPLOYMENT_TYPES, id);
export const workModeLabel = (id) => labelIn(WORK_MODES, id);

/** Company Mod chỉ sửa nội dung khi `draft` / `published` (tin bị ẩn hoặc đã đóng: backend trả 409). */
export const isJobEditable = (status) => status === "draft" || status === "published";

/**
 * Nút thao tác theo trạng thái: `draft` → sửa, đăng · `published` → sửa, đóng · `hidden` → chỉ đóng
 * (bị Platform Moderator ẩn, JB-04) · `closed` → không còn thao tác.
 */
export function jobActions(status) {
  return {
    edit: isJobEditable(status),
    publish: status === "draft",
    close: status === "published" || status === "hidden",
  };
}

const VN_OFFSET_MS = 7 * 3_600_000;

/** ISO (UTC) → `YYYY-MM-DD` theo giờ Việt Nam, cho `<input type="date">`. `null` → "". */
export function isoToDateInput(iso) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  return new Date(t + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` → ISO của 23:59:59 ngày đó giờ Việt Nam (nhận hồ sơ hết ngày). "" → null. */
export function dateInputToIso(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!m) return null;
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59) - VN_OFFSET_MS;
  return new Date(utc).toISOString();
}

/** Hiển thị ngày giờ Việt Nam `dd/mm/yyyy`; không có → "—". */
export function formatJobDate(iso) {
  const v = isoToDateInput(iso);
  if (!v) return "—";
  const [y, mo, d] = v.split("-");
  return `${d}/${mo}/${y}`;
}

export function emptyJobForm(roleCategory = "") {
  return {
    id: "",
    status: "draft",
    title: "",
    roleCategory,
    level: "junior",
    employmentType: "full_time",
    workMode: "onsite",
    location: "",
    salaryRange: "",
    description: "",
    requiredCompetencies: [],
    requiredSkills: [],
    rubricId: "",
    closesAt: "",
    originalRoleCategory: "",
  };
}

/** Hôm nay theo giờ Việt Nam (`YYYY-MM-DD`) — `min` của ô hạn nhận hồ sơ. */
export const todayDateInput = (now = new Date()) => isoToDateInput(now.toISOString());

/**
 * Danh sách nhóm vị trí cho ô chọn. `GET /api/role-categories` bỏ nhóm đã `deprecated`, nên tin cũ thuộc nhóm đó
 * phải thêm lại chính giá trị hiện tại (đánh dấu `stale`) để ô chọn hiện đúng và không âm thầm đổi vị trí.
 */
export function roleOptionsWithCurrent(options, current, currentLabel = "") {
  const list = [...(options || [])];
  if (current && !list.some((o) => o.id === current)) {
    list.unshift({ id: current, label: `${currentLabel || current} (ngừng dùng)`, stale: true });
  }
  return list;
}

/** Job từ API (DTO `jobPostDTO`) → state form. `null` → form trống. */
export function toJobForm(job, defaultRole = "") {
  if (!job) return emptyJobForm(defaultRole);
  return {
    id: String(job.id || job._id || ""),
    status: job.status || "draft",
    title: job.title || "",
    roleCategory: job.roleCategory || defaultRole,
    level: job.level || "junior",
    employmentType: job.employmentType || "full_time",
    workMode: job.workMode || "onsite",
    location: job.location || "",
    salaryRange: job.salaryRange || "",
    description: job.description || "",
    requiredCompetencies: (job.requiredCompetencies || []).map((c) => ({ shrmKey: c.shrmKey, minLevel: Number(c.minLevel) || DEFAULT_MIN_LEVEL })),
    requiredSkills: [...(job.requiredSkills || [])],
    rubricId: job.rubricId ? String(job.rubricId) : "",
    closesAt: isoToDateInput(job.closesAt),
    // Vị trí lúc mở form: sửa tin mà không đổi vị trí thì không gửi lại (vị trí cũ có thể đã ngừng dùng → backend 400).
    originalRoleCategory: job.roleCategory || "",
  };
}

/**
 * State form → body `POST /api/company/jobs` / `PATCH /api/company/jobs/:id`.
 * Sửa tin (`form.id`) mà giữ nguyên vị trí thì bỏ `roleCategory` khỏi body.
 */
export function toJobPayload(form) {
  const payload = {
    title: form.title.trim(),
    roleCategory: form.roleCategory,
    level: form.level,
    employmentType: form.employmentType,
    workMode: form.workMode,
    location: form.location.trim(),
    salaryRange: form.salaryRange.trim(),
    description: form.description.trim(),
    requiredCompetencies: form.requiredCompetencies
      .filter((c) => c.shrmKey)
      .map((c) => ({ shrmKey: c.shrmKey, minLevel: Number(c.minLevel) })),
    requiredSkills: form.requiredSkills,
    rubricId: form.rubricId || null,
    closesAt: dateInputToIso(form.closesAt),
  };
  if (form.id && form.originalRoleCategory && form.roleCategory === form.originalRoleCategory) delete payload.roleCategory;
  return payload;
}

/**
 * Thêm kỹ năng từ ô nhập: tách theo dấu phẩy / xuống dòng, gộp khoảng trắng, bỏ trùng không phân biệt
 * hoa thường (giống backend `normalizeSkills`), bỏ kỹ năng quá dài, tối đa `JOB_MAX_SKILLS`.
 * @returns {{ skills: string[], rejected: string[] }} `rejected`: kỹ năng bị bỏ vì quá dài hoặc vượt số lượng.
 */
export function addSkills(current, raw) {
  const skills = [...(current || [])];
  const seen = new Set(skills.map((s) => s.toLowerCase()));
  const rejected = [];
  for (const part of String(raw || "").split(/[,\n]/)) {
    const skill = part.replace(/\s+/g, " ").trim();
    if (!skill) continue;
    if (skill.length > JOB_MAX_SKILL_LENGTH || skills.length >= JOB_MAX_SKILLS) {
      rejected.push(skill);
      continue;
    }
    if (seen.has(skill.toLowerCase())) continue;
    seen.add(skill.toLowerCase());
    skills.push(skill);
  }
  return { skills, rejected };
}

/**
 * Gợi ý năng lực theo nhóm vị trí (`suggestedCompetencies` của `GET /api/role-categories`): thêm các key
 * chưa có, mức mặc định 3, chỉ key còn chọn được (`selectableKeys`), không vượt `JOB_MAX_COMPETENCIES`.
 */
export function addSuggestedCompetencies(current, suggestedKeys, selectableKeys = null) {
  const rows = [...(current || [])];
  const have = new Set(rows.map((r) => r.shrmKey));
  for (const key of suggestedKeys || []) {
    if (rows.length >= JOB_MAX_COMPETENCIES) break;
    if (have.has(key) || (selectableKeys && !selectableKeys.has(key))) continue;
    have.add(key);
    rows.push({ shrmKey: key, minLevel: DEFAULT_MIN_LEVEL });
  }
  return rows;
}

/** Lỗi chặn lưu (cả bản nháp): khớp `createInput` / `updateInput` của backend. */
export function jobSaveErrors(form, selectableKeys = null) {
  const errors = [];
  const title = form.title.trim();
  if (title.length < JOB_TITLE_MIN || title.length > JOB_TITLE_MAX) errors.push(`Tiêu đề cần ${JOB_TITLE_MIN}–${JOB_TITLE_MAX} ký tự.`);
  if (!form.roleCategory) errors.push("Chọn nhóm vị trí.");
  if (!form.level) errors.push("Chọn cấp độ.");
  if (form.description.trim().length > JOB_MAX_DESCRIPTION) errors.push(`Mô tả tối đa ${JOB_MAX_DESCRIPTION.toLocaleString("vi-VN")} ký tự.`);
  if (form.location.trim().length > 200) errors.push("Địa điểm tối đa 200 ký tự.");
  if (form.salaryRange.trim().length > 100) errors.push("Mức lương tối đa 100 ký tự.");
  const keys = form.requiredCompetencies.map((c) => c.shrmKey);
  if (keys.some((k) => !k)) errors.push("Chọn năng lực cho mọi dòng năng lực yêu cầu (hoặc xóa dòng trống).");
  if (new Set(keys.filter(Boolean)).size !== keys.filter(Boolean).length) errors.push("Năng lực yêu cầu bị trùng.");
  if (keys.length > JOB_MAX_COMPETENCIES) errors.push(`Tối đa ${JOB_MAX_COMPETENCIES} năng lực yêu cầu.`);
  if (selectableKeys && keys.some((k) => k && !selectableKeys.has(k))) errors.push("Có năng lực đã ngừng dùng, hãy chọn năng lực khác.");
  if (form.requiredCompetencies.some((c) => !Number.isInteger(Number(c.minLevel)) || c.minLevel < 1 || c.minLevel > 5)) {
    errors.push("Mức tối thiểu của năng lực phải từ 1 đến 5.");
  }
  if (form.requiredSkills.length > JOB_MAX_SKILLS) errors.push(`Tối đa ${JOB_MAX_SKILLS} kỹ năng.`);
  if (form.closesAt && !dateInputToIso(form.closesAt)) errors.push("Hạn nhận hồ sơ không hợp lệ.");
  return errors;
}

/**
 * Lỗi chặn đăng (hoặc lưu tin đang đăng): thêm điều kiện `assertPublishable` của backend — mô tả ≥ 50 ký tự,
 * ít nhất 1 năng lực, hạn nhận hồ sơ (nếu có) ở tương lai.
 */
export function jobPublishErrors(form, selectableKeys = null, now = new Date()) {
  const errors = jobSaveErrors(form, selectableKeys);
  if (form.description.trim().length < JOB_MIN_DESCRIPTION) {
    errors.push(`Mô tả công việc cần ít nhất ${JOB_MIN_DESCRIPTION} ký tự để đăng (hiện ${form.description.trim().length}).`);
  }
  if (!form.requiredCompetencies.some((c) => c.shrmKey)) errors.push("Chọn ít nhất 1 năng lực yêu cầu để đăng.");
  const closes = dateInputToIso(form.closesAt);
  if (closes && new Date(closes).getTime() <= now.getTime()) errors.push("Hạn nhận hồ sơ phải ở tương lai.");
  return errors;
}

/** Rubric gắn được: đã duyệt và cùng nhóm vị trí với tin (backend `assertRubricAttachable`). */
export function attachableRubrics(rubrics, roleCategory) {
  return (rubrics || []).filter((r) => r.status === "approved" && r.roleCategory === roleCategory);
}

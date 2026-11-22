/**
 * CO-14: trình soạn rubric của Company Moderator. Năng lực lấy từ bộ tiêu chí LP-01
 * (`GET /api/competencies`, xem utils/learningPath/learningPathEditor.js#competencyOptions) —
 * không đặt danh sách năng lực cứng ở FE. Backend kiểm lại toàn bộ (companyWorkspaceController).
 */

/** Vị trí tuyển mặc định khi chưa tải được `GET /api/role-categories` (nguồn chính: backend config/roleCategories.json). */
export const ROLE_CATEGORIES = [
  { id: "software_engineer", label: "Software Engineer" },
  { id: "frontend", label: "Frontend Developer" },
  { id: "backend", label: "Backend Developer" },
  { id: "fullstack", label: "Fullstack Developer" },
  { id: "devops", label: "DevOps / SRE" },
  { id: "mobile", label: "Mobile Developer" },
  { id: "data_engineer", label: "Data Engineer" },
];

export const roleLabel = (id) => ROLE_CATEGORIES.find((r) => r.id === id)?.label || id;

export const RUBRIC_LEVELS = ["0", "1", "2", "3", "4", "5"];
export const RUBRIC_MAX_CRITERIA = 10;

export const RUBRIC_STATUS = {
  draft: "Bản nháp",
  pending_review: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Bị từ chối",
  archived: "Lưu trữ",
};

/** Chỉ sửa được khi chưa gửi hoặc bị từ chối (backend trả 409 với trạng thái khác). */
export const isRubricEditable = (status) => status === "draft" || status === "rejected";

const emptyLevels = () => Object.fromEntries(RUBRIC_LEVELS.map((l) => [l, ""]));

export function emptyCriterion(shrmKey = "") {
  return { name: "", weight: 0, shrmKey, levels: emptyLevels(), questionIds: [] };
}

/** Rubric từ API (hoặc null = tạo mới) → state của form. `levels` từ Mongoose Map trả về dạng object. */
export function toEditorState(rubric) {
  if (!rubric) {
    return { id: "", title: "", roleCategory: ROLE_CATEGORIES[0].id, description: "", criteria: [emptyCriterion()] };
  }
  return {
    id: String(rubric._id),
    title: rubric.title || "",
    roleCategory: rubric.roleCategory || ROLE_CATEGORIES[0].id,
    description: rubric.description || "",
    criteria: (rubric.criteria?.length ? rubric.criteria : [emptyCriterion()]).map((c) => ({
      name: c.name || "",
      weight: Number(c.weight) || 0,
      shrmKey: c.shrmKey || "",
      levels: { ...emptyLevels(), ...(c.levels || {}) },
      questionIds: (c.questionIds || []).map(String),
    })),
  };
}

/** State → body của POST/PATCH /api/company/rubrics. */
export function toPayload(state) {
  return {
    title: state.title.trim(),
    roleCategory: state.roleCategory,
    description: state.description.trim(),
    criteria: state.criteria.map((c) => ({
      name: c.name.trim(),
      weight: Number(c.weight),
      shrmKey: c.shrmKey,
      levels: Object.fromEntries(RUBRIC_LEVELS.map((l) => [l, (c.levels?.[l] || "").trim()])),
      questionIds: c.questionIds,
    })),
  };
}

/**
 * Gợi ý mô tả 6 mức cho một năng lực từ bộ tiêu chí LP-01: mức 1/3/5 lấy `anchors` riêng của
 * năng lực, mức còn lại lấy mô tả chung `framework.levels[].descriptor`. Chỉ điền mức đang trống.
 */
export function suggestLevels(framework, shrmKey, current = {}) {
  const competency = framework?.competencies?.find((c) => c.key === shrmKey);
  const generic = Object.fromEntries((framework?.levels || []).map((l) => [String(l.score), l.descriptor || ""]));
  return Object.fromEntries(
    RUBRIC_LEVELS.map((l) => [l, (current[l] || "").trim() || competency?.anchors?.[l] || generic[l] || ""]),
  );
}

export const totalWeight =(criteria = []) => criteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);

/** Mức chưa mô tả của một tiêu chí. */
export const missingLevels = (criterion) => RUBRIC_LEVELS.filter((l) => !(criterion.levels?.[l] || "").trim());

/**
 * Lỗi chặn LƯU nháp (cấu trúc). Thiếu mô tả mức không chặn lưu, chỉ chặn gửi duyệt.
 * `selectableKeys`: key năng lực còn dùng được; null = bộ tiêu chí chưa tải xong thì bỏ qua kiểm key.
 */
export function saveErrors(state, selectableKeys = null) {
  const errors = [];
  if (!state.title.trim()) errors.push("Nhập tên rubric.");
  if (!state.criteria.length) errors.push("Thêm ít nhất 1 tiêu chí.");
  if (state.criteria.length > RUBRIC_MAX_CRITERIA) errors.push(`Tối đa ${RUBRIC_MAX_CRITERIA} tiêu chí.`);
  state.criteria.forEach((c, i) => {
    const n = i + 1;
    if (!c.name.trim()) errors.push(`Tiêu chí ${n}: nhập tên.`);
    const w = Number(c.weight);
    if (!Number.isInteger(w) || w < 1 || w > 100) errors.push(`Tiêu chí ${n}: trọng số là số nguyên 1–100.`);
    if (!c.shrmKey) errors.push(`Tiêu chí ${n}: chọn năng lực SHRM/DDI.`);
    else if (selectableKeys && !selectableKeys.has(c.shrmKey)) errors.push(`Tiêu chí ${n}: năng lực này không còn dùng, chọn năng lực khác.`);
  });
  return errors;
}

/** Lỗi chặn GỬI DUYỆT: lỗi lưu + tổng trọng số 100% + đủ 6 mức mỗi tiêu chí (khớp submitRubric ở backend). */
export function submitErrors(state, selectableKeys = null) {
  const errors = saveErrors(state, selectableKeys);
  const total = totalWeight(state.criteria);
  if (total !== 100) errors.push(`Tổng trọng số phải bằng 100% (hiện ${total}%).`);
  state.criteria.forEach((c, i) => {
    const missing = missingLevels(c);
    if (missing.length) errors.push(`Tiêu chí ${i + 1}: còn thiếu mô tả mức ${missing.join(", ")}.`);
  });
  return errors;
}

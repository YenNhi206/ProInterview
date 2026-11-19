/**
 * Logic thuần cho trình soạn lộ trình của Mentor (LP-20). Không phụ thuộc React để test bằng node:test.
 * Giới hạn khớp backend `learningPathsService.js` (LP-07).
 */

export const MAX_SESSIONS = 12;
export const MIN_PRICE = 10_000;
export const MAX_PRICE = 100_000_000;
export const MAX_OBJECTIVES = 10;
export const MAX_SHRM_KEYS = 10;

/*
 * Năng lực SHRM/DDI gắn cho từng buổi lấy từ bộ tiêu chí dùng chung LP-01
 * (`GET /api/competencies`, nguồn `backend/src/config/competencies.json`). Không đặt danh sách
 * cứng ở FE. `framework` dưới đây là object `framework` của API đó.
 */

/** Năng lực mentor được chọn: bỏ key `deprecated`, giữ thứ tự trong file cấu hình. */
export function competencyOptions(framework) {
  return (framework?.competencies || [])
    .filter((c) => !c.deprecated)
    .map((c) => ({ key: c.key, label: c.nameVi || c.key }));
}

/** Tên hiển thị của key (kể cả key deprecated); chưa tải được bộ tiêu chí hoặc key lạ → chính key. */
export function shrmLabel(key, framework) {
  return framework?.competencies?.find((c) => c.key === key)?.nameVi || key;
}

/**
 * Key đã gắn nhưng mentor không chọn lại được nữa: không có trong bộ tiêu chí hoặc đã `deprecated`.
 * Backend từ chối các key này khi lưu, nên editor hiện riêng để mentor bỏ chọn.
 * Chưa có `framework` thì trả [] (không chặn nhầm khi API chưa tải xong).
 */
export function unselectableShrmKeys(keys, framework) {
  if (!framework?.competencies) return [];
  const selectable = new Set(competencyOptions(framework).map((c) => c.key));
  return (keys || []).filter((k) => !selectable.has(k));
}

export const PATH_STATUS = {
  draft: "Bản nháp",
  proposed: "Đã gửi · chờ mentee",
  revision_requested: "Mentee yêu cầu sửa",
  pending_payment: "Chờ thanh toán",
  active: "Đang học",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

/** Mentor chỉ sửa được ở hai trạng thái này (backend trả 409 với trạng thái khác). */
export const EDITABLE_STATUSES = ["draft", "revision_requested"];

export function isEditable(status) {
  return EDITABLE_STATUSES.includes(status || "draft");
}

let keySeq = 0;
/** Buổi trống trong editor; `uid` chỉ dùng làm React key. */
export function emptySession() {
  keySeq += 1;
  return { uid: `s${Date.now().toString(36)}${keySeq}`, title: "", objectivesText: "", shrmKeys: [] };
}

/** DTO backend → state editor (chỉ buổi lần học đầu, attempt = 1). */
export function fromDTO(path) {
  const sessions = (path?.sessions || [])
    .filter((s) => (s.attempt || 1) === 1)
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ uid: s.id, title: s.title || "", objectivesText: (s.objectives || []).join("\n"), shrmKeys: [...(s.shrmKeys || [])] }));
  return {
    goal: path?.goal || "",
    totalAmount: formatPriceInput(path?.totalAmount),
    sessions,
  };
}

/** Số VND → chuỗi có dấu chấm nghìn cho ô nhập ("1.000.000"); 0/rỗng → "". Giữ nguyên chuỗi không hợp lệ. */
export function formatPriceInput(value) {
  const n = typeof value === "number" ? value : parsePrice(value);
  if (!Number.isFinite(n)) return String(value ?? "");
  return n > 0 ? n.toLocaleString("vi-VN") : "";
}

/** Chuỗi giá người dùng nhập ("1.000.000", "1000000") → số nguyên VND, hoặc NaN. */
export function parsePrice(text) {
  const digits = String(text ?? "").replace(/[.\s,_]/g, "");
  if (digits === "") return 0;
  if (!/^\d+$/.test(digits)) return NaN;
  return Number(digits);
}

export function splitObjectives(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.replace(/^[-•*\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, MAX_OBJECTIVES);
}

/** State editor → body PATCH/POST /api/learning-paths. */
export function toPayload(state) {
  const amount = parsePrice(state.totalAmount);
  return {
    goal: String(state.goal || "").trim(),
    totalAmount: Number.isFinite(amount) ? amount : 0,
    sessions: state.sessions.map((s) => ({
      title: String(s.title || "").trim(),
      objectives: splitObjectives(s.objectivesText),
      shrmKeys: [...new Set(s.shrmKeys)].slice(0, MAX_SHRM_KEYS),
    })),
  };
}

/** Lỗi chặn LƯU (backend sẽ trả 400). Trả mảng thông báo tiếng Việt, rỗng = lưu được. */
export function saveErrors(state, framework) {
  const errors = [];
  const amount = parsePrice(state.totalAmount);
  if (!Number.isFinite(amount)) errors.push("Giá trọn gói chỉ gồm chữ số.");
  else if (amount > MAX_PRICE) errors.push(`Giá trọn gói tối đa ${MAX_PRICE.toLocaleString("vi-VN")} VND.`);
  if (state.sessions.length > MAX_SESSIONS) errors.push(`Lộ trình tối đa ${MAX_SESSIONS} buổi.`);
  state.sessions.forEach((s, i) => {
    const title = String(s.title || "").trim();
    if (title.length < 3) errors.push(`Buổi ${i + 1}: tên buổi cần ít nhất 3 ký tự.`);
    if (title.length > 200) errors.push(`Buổi ${i + 1}: tên buổi tối đa 200 ký tự.`);
    const stale = unselectableShrmKeys(s.shrmKeys, framework);
    if (stale.length) {
      errors.push(`Buổi ${i + 1}: bỏ chọn năng lực không còn dùng (${stale.map((k) => shrmLabel(k, framework)).join(", ")}).`);
    }
  });
  return errors;
}

/**
 * Danh sách điều kiện GỬI cho mentee (khớp `proposeLearningPath`): ≥ 1 buổi, giá ≥ 10.000 VND,
 * buổi đánh giá 0đ đã hoàn thành. Dùng hiển thị checklist + khóa nút gửi.
 */
export function proposeChecklist(state, assessmentStatus, framework) {
  const amount = parsePrice(state.totalAmount);
  return [
    { key: "sessions", ok: state.sessions.length >= 1 && saveErrors(state, framework).length === 0, label: "Có ít nhất 1 buổi, tên buổi và năng lực hợp lệ" },
    { key: "price", ok: Number.isFinite(amount) && amount >= MIN_PRICE && amount <= MAX_PRICE, label: `Giá trọn gói từ ${MIN_PRICE.toLocaleString("vi-VN")} VND` },
    { key: "assessment", ok: assessmentStatus === "completed", label: "Đã hoàn thành buổi đánh giá 0đ" },
  ];
}

export function moveSession(sessions, index, direction) {
  const target = index + direction;
  if (target < 0 || target >= sessions.length) return sessions;
  const next = [...sessions];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function toggleShrm(keys, key) {
  if (keys.includes(key)) return keys.filter((k) => k !== key);
  if (keys.length >= MAX_SHRM_KEYS) return keys;
  return [...keys, key];
}

/**
 * Ước tính chia đều để Mentor tham khảo (phần nguyên, buổi cuối nhận phần dư) — cùng công thức
 * DESIGN mục 4. Số chính thức do backend tính ở LP-09.
 */
export function previewShares(totalAmount, count) {
  const total = parsePrice(totalAmount);
  if (!Number.isFinite(total) || total <= 0 || count <= 0) return [];
  const base = Math.floor(total / count);
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? total - base * (count - 1) : base));
}

/** Gom yêu cầu mentor có thể soạn lộ trình: Mentor được chọn, status selected/assessing, chưa có lộ trình. */
export function draftableRequests(requests) {
  return (requests || []).filter((r) => {
    const mine = r.offers?.some((o) => o.id === r.selectedOfferId);
    return mine && ["selected", "assessing"].includes(r.status) && !r.learningPath;
  });
}

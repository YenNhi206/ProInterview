/**
 * LP-18: trang /learning-paths của ứng viên — nhãn trạng thái và việc cần làm tiếp nhìn từ phía ứng viên
 * (nhãn phía mentor ở learningPathEditor.js#PATH_STATUS). Backend không trả bản nháp cho ứng viên.
 */

export const CANDIDATE_PATH_STATUS = {
  proposed: "Chờ bạn xem",
  revision_requested: "Đã yêu cầu sửa",
  pending_payment: "Chờ thanh toán",
  active: "Đang học",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

/** Một dòng gợi ý bước tiếp theo cho từng trạng thái. */
export const CANDIDATE_NEXT_STEP = {
  proposed: "Mentor đã gửi lộ trình. Xem nội dung rồi chấp nhận hoặc yêu cầu sửa.",
  revision_requested: "Mentor đang chỉnh lại theo góp ý của bạn.",
  pending_payment: "Bạn đã chấp nhận. Chuyển khoản trọn gói để bắt đầu học.",
  active: "Đặt lịch và học lần lượt từng buổi.",
  completed: "Bạn đã hoàn thành lộ trình.",
  cancelled: "Lộ trình đã bị hủy.",
};

export const CANDIDATE_PATH_TABS = [
  { key: "all", label: "Tất cả", statuses: null },
  { key: "todo", label: "Cần bạn xử lý", statuses: ["proposed", "pending_payment"] },
  { key: "waiting", label: "Chờ mentor", statuses: ["revision_requested"] },
  { key: "active", label: "Đang học", statuses: ["active"] },
  { key: "closed", label: "Đã kết thúc", statuses: ["completed", "cancelled"] },
];

/** Số lượng theo từng tab (tab "all" = tổng). */
export function countByTab(paths = []) {
  return Object.fromEntries(
    CANDIDATE_PATH_TABS.map((t) => [t.key, t.statuses ? paths.filter((p) => t.statuses.includes(p.status)).length : paths.length]),
  );
}

export function filterByTab(paths = [], tabKey = "all") {
  const statuses = CANDIDATE_PATH_TABS.find((t) => t.key === tabKey)?.statuses;
  return statuses ? paths.filter((p) => statuses.includes(p.status)) : paths;
}

/**
 * Tiến độ theo buổi gốc (attempt 1): buổi học lại (attempt > 1) không tính thêm vào tổng số buổi;
 * một buổi coi là xong khi lần học mới nhất của nó `done` với kết quả không phải `not_passed`.
 */
export function pathProgress(sessions = []) {
  const byOrder = new Map();
  for (const s of sessions) {
    const prev = byOrder.get(s.order);
    if (!prev || (s.attempt || 1) > (prev.attempt || 1)) byOrder.set(s.order, s);
  }
  const latest = [...byOrder.values()];
  const done = latest.filter((s) => s.status === "done" && s.outcome !== "not_passed").length;
  return { done, total: latest.length };
}

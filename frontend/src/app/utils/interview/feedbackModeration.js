/**
 * HITL bước 7 trên trang Feedback (N-10): ứng viên báo sai câu hỏi / điểm AI, xem trạng thái kiểm định
 * và điểm moderator chấm lại. Điểm moderator KHÔNG ghi đè điểm AI gốc ở backend (lưu song song ở
 * `answers[].moderatorOverride`), nên trang này tự chọn điểm nào hiển thị.
 */

/** targetType gửi lên POST /api/reports (khớp AI_REPORT_TARGET_TYPES ở backend). */
export const AI_REPORT_TARGETS = {
  interview_question: "Câu hỏi",
  interview_evaluation: "Điểm chấm",
};

/** reasonCode hợp lệ theo từng loại báo cáo (khớp AI_REPORT_REASON_CODES ở backend). */
export const AI_REPORT_REASONS = {
  interview_question: [
    { id: "irrelevant", label: "Không liên quan đến vị trí" },
    { id: "hallucination", label: "Bịa thông tin (không có trong CV)" },
    { id: "offensive", label: "Phản cảm, xúc phạm" },
    { id: "other", label: "Lý do khác" },
  ],
  interview_evaluation: [
    { id: "inaccurate_scoring", label: "Chấm điểm không đúng" },
    { id: "hallucination", label: "Nhận xét không khớp câu trả lời" },
    { id: "other", label: "Lý do khác" },
  ],
};

export const AI_REPORT_NOTE_MAX = 500;

/**
 * Điểm hiển thị của 1 câu: có `moderatorOverride` thì dùng điểm moderator, giữ `aiOverall` để so sánh.
 * `pending`: còn chờ moderator (AI chấm thiếu tiêu chí hoặc ứng viên đã báo sai) và chưa có điểm chấm lại.
 */
export function effectiveEvaluation(evalQ = {}) {
  const override = evalQ.moderatorOverride ?? null;
  const openReports = evalQ.openReports ?? [];
  const aiOverall = Number(evalQ.overall ?? 0);
  if (override && typeof override.overall === "number") {
    return {
      overall: override.overall,
      scores: { ...evalQ.scores, ...override.scores },
      shrmLevel: override.shrmLevel || evalQ.shrmLevel || "",
      aiOverall,
      reviewedByModerator: true,
      moderatorNote: override.note || "",
      pending: openReports.length > 0,
      openReports,
    };
  }
  return {
    overall: aiOverall,
    scores: evalQ.scores ?? {},
    shrmLevel: evalQ.shrmLevel || "",
    aiOverall,
    reviewedByModerator: false,
    moderatorNote: "",
    pending: Boolean(evalQ.evaluationIncomplete) || openReports.length > 0,
    openReports,
  };
}

/** Loại báo cáo ứng viên còn gửi được cho câu này (mỗi loại 1 lần/câu, backend trả 409 nếu trùng). */
export function reportableTargets(openReports = []) {
  return Object.keys(AI_REPORT_TARGETS).filter((t) => !openReports.includes(t));
}

/** Nhãn khi câu không có mức SHRM hợp lệ (LLM trả lạ hoặc thiếu) — AI-13, không coi là "Đạt yêu cầu". */
export const SHRM_NO_DATA_LABEL = "Chưa đủ dữ liệu";
const SHRM_KNOWN_LEVELS = ["excellent", "proficient", "developing"];

/** Đếm số câu theo mức SHRM; mức rỗng / lạ vào `unknown`. */
export function shrmLevelCounts(questions = []) {
  const counts = { excellent: 0, proficient: 0, developing: 0, unknown: 0 };
  for (const q of questions) {
    if (SHRM_KNOWN_LEVELS.includes(q?.shrmLevel)) counts[q.shrmLevel] += 1;
    else counts.unknown += 1;
  }
  return counts;
}

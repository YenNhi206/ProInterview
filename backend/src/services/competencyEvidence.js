/**
 * PR-07: buổi phỏng vấn nào được tính là bằng chứng năng lực.
 * Không import model: API và script audit (đọc bằng driver thô) dùng chung một luật.
 *
 * Buổi hợp lệ: của chính user, đã completed, có điểm từng câu và điểm tổng > 0, có câu trả lời đã lưu,
 * không có câu chấm thiếu (câu chấm thiếu nhận điểm mặc định 3/5, không phải điểm thật).
 * Buổi mentor chưa có điểm theo năng lực nên chưa phải bằng chứng (PR-06).
 */
export function interviewEvidenceFilter(userId) {
  return {
    userId,
    status: "completed",
    "feedback.overallScore": { $gt: 0 },
    "feedback.perQuestion.0": { $exists: true },
    "answers.transcript": /\S/,
    "answers.evaluationIncomplete": { $ne: true },
  };
}

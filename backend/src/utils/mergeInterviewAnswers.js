/**
 * Hợp nhất transcript đã lưu trong session (nguồn sự thật) với backup answers từ
 * request body — chỉ bù cho câu CHƯA có transcript (race condition với saveAnswer
 * fire-and-forget). Không bao giờ ghi đè transcript đã ghi nhận, để client không thể
 * tự gửi câu trả lời "ảo" nhằm gian lận điểm đánh giá AI.
 */
export function mergeInterviewAnswersForEval(sessionAnswers, backupAnswers) {
  const list = Array.isArray(sessionAnswers) ? sessionAnswers : [];
  const backups = Array.isArray(backupAnswers) ? backupAnswers : [];

  const merged = list.map((a) => {
    const plain = typeof a?.toObject === "function" ? a.toObject() : a;
    if (plain.transcript) return plain;
    const backup = backups.find((b) => b?.questionIndex === plain.questionIndex);
    return backup ? { ...plain, transcript: backup.transcript ?? "" } : plain;
  });

  for (const backup of backups) {
    const idx = backup?.questionIndex;
    if (idx == null) continue;
    if (!merged.some((a) => a.questionIndex === idx)) {
      merged.push({
        questionIndex: idx,
        questionText: backup.questionText ?? "",
        transcript: backup.transcript ?? "",
      });
    }
  }

  return merged;
}

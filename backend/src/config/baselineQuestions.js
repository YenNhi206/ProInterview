/**
 * baselineQuestions.js
 * 3 câu hỏi phỏng vấn "baseline" — CỐ ĐỊNH, dùng chung cho TẤT CẢ user ở stage 1
 * (free trial, không cần đăng nhập / CV).
 *
 * Vì text không đổi, video avatar cho các câu này được cache theo
 * MD5(questionText + avatarImageUrl + voiceId) trong avatarService.js — generate
 * 1 lần / gender, dùng lại cho mọi user sau đó (xem videoPregenService.pregenerateSync).
 *
 * Shape khớp với QUESTION_OBJECTS mà InterviewRoom.jsx kỳ vọng (id, question, layer?, starGuidance?).
 *
 * PR-06 (đề xuất e, quyết định PR-06 ngày 24/11/2026): `competencyId` cố định để điểm câu baseline vào
 * hồ sơ năng lực. Câu 3 (động lực, mức phù hợp) không đo năng lực nào trong bộ LP-01 nên để trống,
 * không cộng vào hồ sơ. Key phải có trong `config/competencies.json` (test kiểm).
 */

export const BASELINE_QUESTIONS = [
  {
    id: "baseline-1",
    competencyId: "communication",
    question:
      "Hãy giới thiệu ngắn gọn về bản thân, kinh nghiệm làm việc/học tập và định hướng nghề nghiệp của bạn.",
  },
  {
    id: "baseline-2",
    layer: "behavior",
    competencyId: "problem_solving",
    question:
      "Hãy kể về một thử thách hoặc khó khăn bạn từng gặp trong công việc hoặc học tập, và cách bạn đã xử lý nó.",
    starGuidance: {
      situation: ["Bối cảnh xảy ra thử thách là gì?"],
      task:      ["Bạn cần đạt được điều gì trong tình huống đó?"],
      action:    ["Bạn đã làm gì cụ thể để giải quyết?"],
      result:    ["Kết quả cuối cùng và bài học rút ra là gì?"],
    },
  },
  {
    id: "baseline-3",
    competencyId: "",
    question:
      "Điều gì khiến bạn quan tâm đến vị trí/lĩnh vực này, và bạn nghĩ điểm mạnh nào của mình phù hợp nhất?",
  },
];

const BASELINE_BY_TEXT = new Map(BASELINE_QUESTIONS.map((q) => [q.question, q]));

/** Câu baseline theo nội dung (session lưu nguyên văn câu hỏi); không phải baseline → null. */
export function baselineQuestionByText(text) {
  return BASELINE_BY_TEXT.get(String(text ?? "")) ?? null;
}

/** Danh sách text thuần — dùng cho pregen video (avatarService/videoPregenService). */
export function getBaselineQuestionTexts() {
  return BASELINE_QUESTIONS.map((q) => q.question);
}

/**
 * Prompt chấm điểm (key `evaluation`) — bản mặc định `eval-v1` (AI-02).
 *
 * Chữ của prompt nằm trong `EVALUATION_DEFAULT_TEMPLATE`; `buildEvaluationPrompt` chỉ chọn nhánh
 * và nối chuỗi. Nội dung trùng từng ký tự với prompt trước AI-02 (test golden). Đổi chữ thì tạo
 * PromptVersion mới, không sửa ở đây.
 */
import { renderPart, part, renderVersionFewShot, VERSION_FEW_SHOT_PARTS, VERSION_FEW_SHOT_TEMPLATE } from "./promptTemplate.js";

export const EVALUATION_KEY = "evaluation";
export const EVALUATION_DEFAULT_VERSION = "eval-v1";

/** Phần và biến bắt buộc của template `evaluation`. */
export const EVALUATION_SPEC = {
  parts: {
    system: { vars: ["versionFewShot"] },
    qa_header: { vars: ["n", "layer", "competencyName"] },
    qa_question: { vars: ["question"] },
    qa_ddi: { vars: ["ddi"] },
    qa_shrm: { vars: ["shrm"] },
    qa_answer: { vars: ["answer"] },
    qa_answer_quoted: { vars: ["transcript"] },
    qa_no_answer: { vars: [] },
    qa_index: { vars: ["index"] },
    qa_separator: { vars: [] },
    json_repair: { vars: [] },
    ...VERSION_FEW_SHOT_PARTS,
  },
};

export const EVALUATION_DEFAULT_TEMPLATE = {
  // Toàn bộ system prompt tĩnh (không phụ thuộc câu hỏi/câu trả lời) → cache được.
  system: `Bạn là chuyên gia đánh giá phỏng vấn được đào tạo theo chuẩn SHRM và DDI Targeted Selection®.
Nhiệm vụ: Đánh giá transcript câu trả lời của ứng viên theo framework SHRM/DDI — KHÔNG dựa trên cảm tính, PHẢI dựa trên evidence trong transcript.

## THANG ĐIỂM 4 CHIỀU (0.0–5.0, bước 0.5)
- **clarity** (Rõ ràng & Mạch lạc):
  5.0 = Hoàn toàn rõ ràng, không cần hỏi lại, luận điểm mạch lạc từ đầu đến cuối
  3.0 = Rõ ràng cơ bản nhưng có vài chỗ mơ hồ hoặc lặp lại
  1.0 = Vòng vo, khó theo dõi, thiếu chủ đề trung tâm

- **structure** (Cấu trúc — STAR/Logic):
  5.0 = STAR đầy đủ với Situation rõ + Task cụ thể + Action 3 bước + Result đo lường được; hoặc logic theory/project rõ ràng
  3.0 = Có cấu trúc nhưng thiếu 1–2 phần (thường thiếu Result số liệu)
  1.0 = Không có cấu trúc, kể lan man, thiếu STAR hoàn toàn

- **relevance** (Liên quan — DDI Key Action):
  5.0 = Trả lời chính xác DDI Key Action được hỏi, thể hiện rõ competency mục tiêu, không lạc đề
  3.0 = Liên quan đến competency nhưng không probe đúng DDI Key Action, hoặc trả lời nửa vời
  1.0 = Trả lời không liên quan, né tránh câu hỏi, hoặc không trả lời

- **credibility** (Thuyết phục — Evidence):
  5.0 = Có ví dụ thực tế cụ thể + số liệu đo lường (%, thời gian, người, tiền) + kết quả rõ ràng
  3.0 = Có ví dụ nhưng không có số liệu, hoặc kết quả mơ hồ ("tốt hơn", "cải thiện")
  1.0 = Chỉ lý thuyết chung, không có ví dụ thực tế, hoặc câu trả lời quá ngắn

## SHRM LEVEL (dựa trên SHRM_RUBRIC_EXCELLENT được cung cấp kèm mỗi câu hỏi)
- "excellent"  : Đáp ứng ≥80% tiêu chí rubric excellent — STAR đầy đủ, DDI Key Action rõ, có số liệu
- "proficient" : Đáp ứng 50–79% — đúng hướng nhưng thiếu depth hoặc số liệu đo lường
- "developing" : Đáp ứng <50% — thiếu cấu trúc, không có ví dụ thực tế, hoặc không trả lời

## QUY TẮC CHẤM ĐIỂM NGHIÊM TÚC
- Nếu transcript "(Ứng viên không trả lời câu này)" → tất cả scores = 0, shrm_level = "developing"
- Câu trả lời < 30 từ → credibility ≤ 2.0, structure ≤ 2.0
- Câu trả lời có nhiều từ đệm (ừm, ừ, à, kiểu như, tức là) → clarity ≤ 3.5
- KHÔNG cho điểm cao chỉ vì câu trả lời dài — phải có EVIDENCE cụ thể

## SUGGESTION — Gợi ý cải thiện
Suggestion PHẢI cụ thể: cung cấp template câu trả lời mẫu theo STAR với placeholder [Tên dự án], [Số liệu], [Kết quả]. KHÔNG nói chung chung như "cần cải thiện cấu trúc".

{{versionFewShot}}Trả về JSON hợp lệ (không markdown, không giải thích thêm):
{
  "overall_comment": "Nhận xét tổng quan 2–3 câu, SHRM level tổng thể, 1 điểm mạnh nổi bật nhất và 1 hành động cải thiện ưu tiên nhất",
  "questions": [
    {
      "question_index": 0,
      "scores": { "clarity": 0.0, "structure": 0.0, "relevance": 0.0, "credibility": 0.0 },
      "overall": 0.0,
      "shrm_level": "excellent|proficient|developing",
      "strengths":    ["điểm mạnh 1 cụ thể", "điểm mạnh 2 cụ thể"],
      "improvements": ["cải thiện 1 với hành động cụ thể", "cải thiện 2 với hành động cụ thể"],
      "suggestion": "Template: 'Trong tình huống [S cụ thể từ kinh nghiệm], tôi phải [T nhiệm vụ]. Tôi đã [A 2-3 hành động]. Kết quả là [R số liệu đo lường].'"
    }
  ]
}`,
  qa_header: "### Câu {{n}} [{{layer}}] — {{competencyName}}",
  qa_question: "Câu hỏi: {{question}}",
  qa_ddi: "DDI Key Action cần kiểm tra: {{ddi}}",
  qa_shrm: "SHRM Rubric Excellent: {{shrm}}",
  qa_answer: "Câu trả lời: {{answer}}",
  qa_answer_quoted: "\"{{transcript}}\"",
  qa_no_answer: "(Ứng viên không trả lời câu này)",
  qa_index: "(question_index = {{index}})",
  qa_separator: "\n\n---\n\n",
  json_repair: "Sửa JSON sau thành hợp lệ, chỉ trả JSON thuần:",
  ...VERSION_FEW_SHOT_TEMPLATE,
};

/**
 * Lắp prompt chấm điểm từ một version.
 * @param {{ template: object, fewShotExamples?: object[] }} prompt  Kết quả `getActivePrompt("evaluation")`
 * @returns {{ system: {static: string, dynamic: string}, buildQaBlocks: (indexes: number[]) => string, jsonRepair: string }}
 */
export function buildEvaluationPrompt(prompt, { questions = [], answers = [] }) {
  const t = prompt.template;
  const noAnswer = part(t, "qa_no_answer");
  const qaBlock = (q, i) => {
    const ans = answers.find((a) => a.questionIndex === i) ?? answers[i] ?? {};
    const answer = ans.transcript?.trim()
      ? renderPart(t, "qa_answer_quoted", { transcript: ans.transcript.trim() })
      : noAnswer;
    return [
      renderPart(t, "qa_header", { n: i + 1, layer: (q.layer || "theory").toUpperCase(), competencyName: q.competencyName || "" }),
      renderPart(t, "qa_question", { question: String(q.question) }),
      q.ddiKeyActionTargeted ? renderPart(t, "qa_ddi", { ddi: q.ddiKeyActionTargeted }) : "",
      q.shrmRubricExcellent ? renderPart(t, "qa_shrm", { shrm: q.shrmRubricExcellent }) : "",
      renderPart(t, "qa_answer", { answer }),
      renderPart(t, "qa_index", { index: i }),
    ].filter(Boolean).join("\n");
  };
  const separator = part(t, "qa_separator");
  return {
    system: { static: renderPart(t, "system", { versionFewShot: renderVersionFewShot(t, prompt.fewShotExamples) }), dynamic: "" },
    buildQaBlocks: (indexes) => indexes.map((i) => qaBlock(questions[i], i)).join(separator),
    jsonRepair: renderPart(t, "json_repair"),
  };
}

/**
 * Prompt AI sàng lọc khóa học khi mentor gửi duyệt (key `course_prescreen`, AI-08, REQ AIS-08).
 *
 * AI chỉ gợi ý cho Platform Moderator (cờ + điểm), không tự duyệt hay từ chối khóa.
 * Phần kiểm tra cấu trúc (thiếu video, thiếu mô tả…) làm bằng luật trong `coursePrescreenService.js`;
 * prompt này chỉ xét nội dung: vi phạm chính sách, cam kết sai sự thật, lạc đề, chất lượng thấp.
 * Đổi chữ thì tạo PromptVersion mới (`prescreen-vN`), không sửa bản mặc định ở đây.
 */
import { renderPart, renderVersionFewShot, VERSION_FEW_SHOT_PARTS, VERSION_FEW_SHOT_TEMPLATE } from "./promptTemplate.js";

export const COURSE_PRESCREEN_KEY = "course_prescreen";
export const COURSE_PRESCREEN_DEFAULT_VERSION = "prescreen-v1";

/** Mã cờ LLM được phép trả; mã khác bị bỏ. */
export const COURSE_PRESCREEN_AI_FLAG_CODES = [
  "policy_violation",
  "misleading_claim",
  "external_contact",
  "off_topic",
  "low_quality_content",
  "copyright_risk",
];

export const COURSE_PRESCREEN_SPEC = {
  parts: {
    system: { vars: ["versionFewShot"] },
    user: { vars: ["course"] },
    json_repair: { vars: [] },
    ...VERSION_FEW_SHOT_PARTS,
  },
};

export const COURSE_PRESCREEN_DEFAULT_TEMPLATE = {
  system: `Bạn là trợ lý kiểm duyệt nội dung cho ProInterview, nền tảng luyện phỏng vấn xin việc. Mentor gửi một khóa học (về phỏng vấn, CV, kỹ năng nghề nghiệp, kỹ thuật chuyên môn) để Platform Moderator duyệt trước khi bán. Bạn đọc bản tóm tắt khóa học và gắn cờ những điểm moderator cần xem kỹ. Bạn KHÔNG quyết định duyệt hay từ chối.

## MÃ CỜ (chỉ dùng các mã này)
- policy_violation: nội dung phản cảm, phân biệt đối xử, bạo lực, chính trị, hướng dẫn gian lận (làm giả bằng cấp, gian lận bài test tuyển dụng).
- misleading_claim: cam kết sai sự thật hoặc không kiểm chứng được ("đảm bảo 100% có việc", "lương nghìn đô sau 1 tháng", "đậu phỏng vấn mọi công ty").
- external_contact: kéo học viên giao dịch ngoài nền tảng (số điện thoại, Zalo, Facebook, nhóm Telegram, chuyển khoản riêng).
- off_topic: nội dung không liên quan tới nghề nghiệp, tuyển dụng hay kỹ năng làm việc.
- low_quality_content: tiêu đề và nội dung bài học không khớp nhau, mô tả sao chép lặp lại, bài học rỗng ý, văn bản vô nghĩa.
- copyright_risk: dấu hiệu dùng lại tài liệu có bản quyền (tên khóa học, sách, chứng chỉ của bên khác) mà không nói rõ nguồn.

## QUY TẮC
1. Chỉ gắn cờ khi có bằng chứng trong nội dung được cung cấp; trích đúng đoạn làm bằng chứng vào "evidence" (tối đa 200 ký tự).
2. "severity": "critical" khi vi phạm rõ ràng phải sửa trước khi bán; "warning" khi đáng nghi, moderator nên kiểm tra.
3. Không gắn cờ vì thiếu video, thiếu mô tả, ít bài học: hệ thống đã kiểm tra các điểm này.
4. "score" 0–100: mức sẵn sàng để bán về mặt nội dung (100 = không thấy vấn đề). Không có cờ thì score ≥ 80.
5. "summary": 1–2 câu tiếng Việt cho moderator.
{{versionFewShot}}## OUTPUT FORMAT
Trả về JSON hợp lệ (không markdown, không giải thích):
{
  "score": 0,
  "summary": "...",
  "flags": [
    { "code": "một mã ở trên", "severity": "critical|warning", "message": "Mô tả vấn đề bằng tiếng Việt", "evidence": "đoạn trích" }
  ]
}`,
  user: "Khóa học cần sàng lọc:\n\n{{course}}",
  json_repair: "Đoạn dưới đây phải là JSON theo định dạng { \"score\": number, \"summary\": string, \"flags\": [...] } nhưng bị lỗi cú pháp. Trả lại đúng nội dung đó dưới dạng JSON hợp lệ, không thêm chữ nào khác.",
  ...VERSION_FEW_SHOT_TEMPLATE,
};

/**
 * @param {{ template: object, fewShotExamples?: object[] }} prompt  Kết quả `getActivePrompt("course_prescreen")`
 * @param {{ course: string }} vars  Bản tóm tắt khóa học (đã cắt độ dài)
 */
export function buildCoursePrescreenPrompt(prompt, { course }) {
  const t = prompt.template;
  return {
    system: renderPart(t, "system", { versionFewShot: renderVersionFewShot(t, prompt.fewShotExamples) }),
    user: renderPart(t, "user", { course }),
    jsonRepair: renderPart(t, "json_repair"),
  };
}

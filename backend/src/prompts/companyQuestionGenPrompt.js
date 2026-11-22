/**
 * Prompt sinh bộ câu nháp cho công ty (key `company_question_gen`, CO-04, quyết định 11).
 *
 * Khác `question_gen`: không có CV/JD của ứng viên. Câu dùng chung cho mọi ứng viên của một
 * nhóm vị trí (`roleCategory`), Company Moderator duyệt / sửa / từ chối trước khi dùng (CO-05).
 * Đổi chữ thì tạo PromptVersion mới (`companyq-vN`), không sửa bản mặc định ở đây.
 */
import { renderPart, renderVersionFewShot, VERSION_FEW_SHOT_PARTS, VERSION_FEW_SHOT_TEMPLATE } from "./promptTemplate.js";

export const COMPANY_QUESTION_GEN_KEY = "company_question_gen";
export const COMPANY_QUESTION_GEN_DEFAULT_VERSION = "companyq-v1";

export const COMPANY_QUESTION_GEN_SPEC = {
  parts: {
    system: { vars: ["versionFewShot", "roleName", "questionCount", "competencyBlock", "distributionGuide", "existingBlock"] },
    existing_block: { vars: ["existing"] },
    existing_item: { vars: ["question"] },
    user: { vars: ["roleName", "questionCount"] },
    json_repair: { vars: [] },
    ...VERSION_FEW_SHOT_PARTS,
  },
};

export const COMPANY_QUESTION_GEN_DEFAULT_TEMPLATE = {
  system: `Bạn là chuyên gia tuyển dụng người Việt, được đào tạo theo chuẩn SHRM và DDI Targeted Selection®. Bạn soạn bộ câu hỏi phỏng vấn nháp cho một công ty, dùng chung cho mọi ứng viên của vị trí "{{roleName}}". Người duyệt (Company Moderator) sẽ đọc, sửa hoặc từ chối từng câu trước khi dùng.

## NHIỆM VỤ
Sinh đúng {{questionCount}} câu hỏi tiếng Việt cho vị trí "{{roleName}}", mỗi câu nhắm vào đúng 1 năng lực trong danh sách bên dưới và 1 DDI Key Action của năng lực đó.

## NĂNG LỰC MỤC TIÊU (chỉ dùng các id này cho competency_id)
{{competencyBlock}}

## PHÂN PHỐI BẮT BUỘC
{{distributionGuide}}
Trong bộ câu: ít nhất một nửa là câu behavior (hỏi một tình huống đã xảy ra, trả lời theo STAR), có ít nhất 2 câu theory về kiến thức chuyên môn của vị trí, có ít nhất 1 câu project về dự án hoặc sản phẩm ứng viên từng làm.

## QUY TẮC CHẤT LƯỢNG
1. Câu phải gắn với công việc thật của vị trí "{{roleName}}" (công cụ, tình huống, rủi ro đặc thù), không hỏi chung chung.
2. Không nhắc tới CV, tên dự án hay chi tiết riêng của một ứng viên cụ thể: câu dùng cho mọi ứng viên.
3. Mỗi câu chỉ hỏi 1 ý chính; dài tối đa 2 câu văn.
4. Không trùng ý với nhau và không trùng ý với các câu công ty đã có (nếu có danh sách bên dưới).
5. Cấm câu generic: "Giới thiệu bản thân", "Điểm mạnh/yếu", "Vì sao muốn vào công ty", "5 năm tới".
6. Không hỏi về tuổi, giới tính, tình trạng hôn nhân, tôn giáo, sức khỏe, quê quán hay thông tin cá nhân không liên quan công việc.
{{existingBlock}}
{{versionFewShot}}## OUTPUT FORMAT
Trả về JSON hợp lệ (không markdown, không giải thích):
{
  "questions": [
    {
      "layer": "theory|project|behavior",
      "seniority": "intern|junior|middle|senior",
      "competency_id": "một id trong danh sách năng lực mục tiêu",
      "ddi_key_action_targeted": "DDI Key Action câu này nhắm tới",
      "question": "Câu hỏi tiếng Việt",
      "star_guidance": { "situation": ["..."], "task": ["..."], "action": ["..."], "result": ["..."] },
      "expected_keywords": ["3–5 từ khóa người phỏng vấn cần nghe"],
      "deep_dive": ["1 câu hỏi đào sâu khi ứng viên trả lời chung chung"],
      "shrm_rubric_excellent": "Mô tả câu trả lời mức xuất sắc"
    }
  ]
}`,
  existing_block: "\n## CÂU CÔNG TY ĐÃ CÓ CHO VỊ TRÍ NÀY (không sinh lại ý tương tự)\n{{existing}}\n",
  existing_item: "- {{question}}",
  user: "Sinh {{questionCount}} câu hỏi nháp cho vị trí \"{{roleName}}\" theo đúng yêu cầu và định dạng JSON ở trên.",
  json_repair: "Đoạn dưới đây phải là JSON theo định dạng { \"questions\": [...] } nhưng bị lỗi cú pháp. Trả lại đúng nội dung đó dưới dạng JSON hợp lệ, không thêm chữ nào khác.",
  ...VERSION_FEW_SHOT_TEMPLATE,
};

/**
 * Lắp prompt từ version đang active.
 * @param {{ template: object, fewShotExamples?: object[] }} prompt
 * @param {{ roleName: string, questionCount: number, competencyBlock: string, distributionGuide: string, existingQuestions?: string[] }} vars
 * @returns {{ system: string, user: string, jsonRepair: string }}
 */
export function buildCompanyQuestionGenPrompt(prompt, { roleName, questionCount, competencyBlock, distributionGuide, existingQuestions = [] }) {
  const t = prompt.template;
  const existingBlock = existingQuestions.length
    ? renderPart(t, "existing_block", {
      existing: existingQuestions.map((q) => renderPart(t, "existing_item", { question: q })).join("\n"),
    })
    : "";
  return {
    system: renderPart(t, "system", {
      versionFewShot: renderVersionFewShot(t, prompt.fewShotExamples),
      roleName,
      questionCount,
      competencyBlock,
      distributionGuide,
      existingBlock,
    }),
    user: renderPart(t, "user", { roleName, questionCount }),
    jsonRepair: renderPart(t, "json_repair"),
  };
}

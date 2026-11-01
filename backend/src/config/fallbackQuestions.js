/**
 * Bộ câu hỏi dự phòng tĩnh — mắt xích CUỐI của chính sách thay câu deprecated
 * (services/questionBankService.js → applyDeprecationPolicy). Bảo đảm buổi phỏng vấn không bao giờ
 * thiếu câu khi LLM sinh lại vẫn ra câu deprecated và kho chưa có câu approved nào.
 *
 * Seed vào QuestionBank (status approved, source moderator) bằng
 * `npm run db:sync-fallback-questions` — idempotent theo textHash, chạy được ở production.
 * Key = competencyId trong competencyFramework.js (COMPETENCY_LIBRARY).
 */
export const FALLBACK_QUESTIONS = {
  problem_solving: [
    "Hãy kể về một vấn đề phức tạp bạn từng giải quyết. Bạn đã phân tích nguyên nhân gốc rễ như thế nào và kết quả ra sao?",
    "Kể về lần bạn phải chọn giữa nhiều giải pháp cho cùng một vấn đề. Bạn so sánh các phương án dựa trên tiêu chí nào?",
  ],
  communication: [
    "Hãy kể về lần bạn phải giải thích một vấn đề phức tạp cho người không có chuyên môn. Bạn làm thế nào để họ hiểu?",
    "Kể về một lần thông tin bị hiểu sai trong nhóm. Bạn đã phát hiện và khắc phục ra sao?",
  ],
  teamwork: [
    "Hãy kể về một dự án nhóm mà bạn đóng góp quan trọng. Vai trò cụ thể của bạn là gì và nhóm đạt được kết quả gì?",
    "Kể về lần một thành viên trong nhóm không hoàn thành phần việc. Bạn đã xử lý tình huống đó thế nào?",
  ],
  leadership: [
    "Hãy kể về lần bạn dẫn dắt một nhóm hoặc một đầu việc dù không có chức danh quản lý. Bạn tạo ảnh hưởng bằng cách nào?",
    "Kể về một quyết định khó bạn phải đưa ra cho cả nhóm. Bạn thuyết phục mọi người đồng thuận ra sao?",
  ],
  adaptability: [
    "Hãy kể về lần yêu cầu dự án thay đổi đột ngột. Bạn đã điều chỉnh kế hoạch và cách làm việc như thế nào?",
    "Kể về một thất bại hoặc sai lầm của bạn. Bạn đã rút ra bài học gì và áp dụng vào lần sau ra sao?",
  ],
  technical_learning: [
    "Hãy kể về lần bạn phải học một công nghệ hoặc kỹ năng mới trong thời gian ngắn để kịp tiến độ. Bạn học bằng cách nào?",
    "Kể về một kiến thức bạn tự học gần đây và cách bạn đã áp dụng nó vào công việc thực tế.",
  ],
  planning_execution: [
    "Hãy kể về một dự án bạn tự lập kế hoạch từ đầu. Bạn chia nhỏ công việc và theo dõi tiến độ như thế nào?",
    "Kể về lần bạn có nhiều việc gấp cùng lúc. Bạn sắp xếp thứ tự ưu tiên ra sao và kết quả thế nào?",
  ],
  innovation: [
    "Hãy kể về một ý tưởng cải tiến bạn đề xuất cho quy trình hoặc sản phẩm. Bạn đã hiện thực hóa nó như thế nào?",
    "Kể về lần bạn thử một cách làm mới thay vì cách quen thuộc. Điều gì khiến bạn thử và kết quả ra sao?",
  ],
  customer_focus: [
    "Hãy kể về lần bạn xử lý một khách hàng hoặc người dùng không hài lòng. Bạn đã làm gì để giải quyết?",
    "Kể về một lần bạn chủ động tìm hiểu nhu cầu thật của khách hàng và điều chỉnh sản phẩm hoặc dịch vụ theo đó.",
  ],
  integrity: [
    "Hãy kể về lần bạn phát hiện một sai sót có thể bị che giấu. Bạn đã xử lý tình huống đó như thế nào?",
    "Kể về một tình huống bạn bị áp lực phải làm điều không đúng nguyên tắc. Bạn đã phản ứng ra sao?",
  ],
  accountability: [
    "Hãy kể về lần bạn mắc lỗi ảnh hưởng tới người khác. Bạn đã nhận trách nhiệm và khắc phục như thế nào?",
    "Kể về một việc không thuộc phạm vi của bạn nhưng bạn vẫn chủ động nhận làm. Vì sao và kết quả ra sao?",
  ],
  data_driven_decision: [
    "Hãy kể về một quyết định bạn đưa ra dựa trên số liệu. Bạn thu thập và phân tích dữ liệu như thế nào?",
    "Kể về lần dữ liệu cho kết quả trái với trực giác của bạn. Bạn đã xử lý mâu thuẫn đó ra sao?",
  ],
  stakeholder_management: [
    "Hãy kể về lần bạn phải cân bằng yêu cầu trái ngược của nhiều bên liên quan. Bạn đạt được thỏa thuận bằng cách nào?",
    "Kể về một lần bạn phải từ chối hoặc đàm phán lại yêu cầu của cấp trên hay khách hàng. Bạn trình bày thế nào?",
  ],
  conflict_resolution: [
    "Hãy kể về một bất đồng giữa bạn và đồng nghiệp. Hai bên đã giải quyết như thế nào?",
    "Kể về lần bạn làm trung gian hòa giải mâu thuẫn giữa các thành viên khác. Bạn đã làm gì?",
  ],
  coaching_development: [
    "Hãy kể về lần bạn hướng dẫn hoặc kèm cặp một người mới. Bạn giúp họ tiến bộ ra sao?",
    "Kể về một lần bạn đưa ra góp ý khó nói cho đồng nghiệp. Bạn chuẩn bị và truyền đạt như thế nào?",
  ],
  strategic_thinking: [
    "Hãy kể về lần bạn nhìn thấy một vấn đề hoặc cơ hội dài hạn mà người khác chưa để ý. Bạn đã làm gì với nó?",
    "Kể về một mục tiêu dài hạn bạn đặt ra và cách bạn chia nó thành các bước cụ thể.",
  ],
  emotional_intelligence: [
    "Hãy kể về lần bạn làm việc dưới áp lực lớn. Bạn kiểm soát cảm xúc và giữ hiệu quả công việc như thế nào?",
    "Kể về một lần bạn nhận ra đồng nghiệp đang gặp khó khăn dù họ không nói ra. Bạn đã phản ứng ra sao?",
  ],
  results_orientation: [
    "Hãy kể về một mục tiêu khó bạn đã đạt được. Bạn đo lường kết quả bằng chỉ số nào?",
    "Kể về lần bạn gặp trở ngại lớn khi đang theo đuổi một mục tiêu. Bạn làm gì để vẫn hoàn thành?",
  ],
  risk_management: [
    "Hãy kể về lần bạn phát hiện sớm một rủi ro trong dự án. Bạn đã đánh giá và giảm thiểu nó như thế nào?",
    "Kể về một quyết định có rủi ro bạn từng đưa ra. Bạn cân nhắc lợi ích và rủi ro ra sao?",
  ],
  cross_functional_influence: [
    "Hãy kể về lần bạn cần sự hỗ trợ của một phòng ban khác để hoàn thành công việc. Bạn thuyết phục họ bằng cách nào?",
    "Kể về một dự án liên phòng ban bạn tham gia. Bạn xử lý khác biệt về mục tiêu giữa các bên ra sao?",
  ],
};

/** Danh sách phẳng { competencyId, text } — dùng cho seed và chọn câu dự phòng. */
export function listFallbackQuestions() {
  return Object.entries(FALLBACK_QUESTIONS).flatMap(([competencyId, texts]) =>
    texts.map((text) => ({ competencyId, text })),
  );
}

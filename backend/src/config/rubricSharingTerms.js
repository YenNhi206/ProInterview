/**
 * CO-02 (bổ sung 23/11/2026, đề xuất aa, quyết định AI-18): điều khoản công ty đồng ý khi nhận lời mời,
 * cho phép ProInterview dùng rubric đã duyệt của công ty ở dạng ẩn danh để cải tiến chuẩn chấm chung.
 *
 * Nguồn duy nhất: `GET /api/company-invites/verify/:token` trả bản này cho trang nhận lời mời, và
 * `POST /api/company-invites/accept` chỉ nhận `termsVersion` trùng `version` hiện tại.
 * Đổi nội dung điều khoản thì tăng `version`; thời điểm đồng ý cũ vẫn giữ kèm version đã đồng ý.
 */
export const RUBRIC_SHARING_TERMS = Object.freeze({
  version: "2026-11-v1",
  title: "Điều khoản dùng rubric ẩn danh để cải tiến chuẩn chấm",
  points: Object.freeze([
    "Rubric của công ty sau khi được Platform Moderator duyệt có thể được ProInterview dùng làm ví dụ neo cho prompt chấm năng lực SHRM/DDI chung.",
    "Trước khi dùng, mọi thông tin nhận diện công ty (tên, sản phẩm, số liệu nội bộ) được loại bỏ. Chỉ dùng khi có ít nhất 3 công ty cùng có tiêu chí cho một năng lực.",
    "Chỉ dùng nội dung rubric. Điểm chấm theo rubric và quyết định tuyển dụng của công ty không được dùng.",
    "Thay đổi prompt chỉ áp dụng sau khi kiểm thử không làm tăng độ lệch điểm và được Platform Moderator duyệt. Rubric của công ty vẫn chỉ chấm câu hỏi của công ty đó.",
  ]),
});

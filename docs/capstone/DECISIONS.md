# Quyết định thiết kế — Capstone FA26

> Nhóm chốt cả 14 quyết định ngày 18/11/2026 (1–10 trong buổi họp, 11–14 bổ sung sau khi đối chiếu code). Cả 14 đều có hiệu lực; code làm theo cột "Đã chốt", không cần hỏi lại.
> Kế hoạch task: [TASKS.md](TASKS.md).

Muốn đổi một quyết định: sửa dòng tương ứng ở đây, ghi ngày và lý do vào cột "Lý do", rồi báo cả nhóm trước khi sửa code liên quan.

## Bảng quyết định

| # | Câu hỏi | Đã chốt | Lý do | Task áp dụng |
|:-:|:--------|:--------|:------|:-------------|
| 1 | Trả tiền lộ trình trọn gói hay từng buổi? | Trọn gói, một `paymentRef` | Đơn ghi "pay for the mentor's learning path"; một QR giống giỏ hàng | LP-10 |
| 2 | Buổi học lại có tính phí? | Miễn phí 1 lần mỗi buổi, tính sẵn trong giá; lần 2 trở đi mentor đề xuất buổi bổ sung có phí | Giữ lời hứa "retaught before moving on" mà không để mentor dạy không giới hạn | LP-13 |
| 3 | Thu nhập mentor ghi khi nào? | Mỗi buổi `done` vào `clearingBalance` | Dùng lại `earningsClearanceJob`; hoàn tiền phần chưa học dễ tính | LP-14 |
| 4 | Phí nền tảng cho lộ trình? | Dùng `Mentor.pricing.platformFeeRate` như booking | Không thêm cấu hình mới | LP-09 |
| 5 | Lộ trình có bắt buộc gắn job post? | Không bắt buộc; có job thì lấy `requiredCompetencies` làm khung | Giảm phụ thuộc vào Job Post, Learning Path làm trước được | LP-05 |
| 6 | Tên role trong code? | `enterprise` → `company_moderator`; giữ `customer`, `moderator` trong DB, đổi nhãn UI | Role `enterprise` chỉ có tài khoản seed (`enterprise@dev.local`), đổi kèm script migrate N-03; hai role kia có dữ liệu thật nên giữ | N-02, N-03, N-13 |
| 7 | Mỗi công ty mấy Company Mod? | 1 người cho MVP, model cho phép nhiều | Khớp phạm vi đã chốt 09/11 | CO-02 |
| 8 | Job post có cần duyệt trước khi đăng? | Không; Platform Mod hậu kiểm (ẩn khi bị báo cáo) | Đơn chỉ ghi "hide reported job posts" | JB-04 |
| 9 | Rubric công ty áp dụng lúc nào? | Chỉ khi luyện theo job của công ty đó; luyện tự do vẫn chấm SHRM/DDI | Tránh trộn tiêu chí giữa các công ty | JB-06, JB-07 |
| 10 | Có đặt deadline theo tuần? | Không; làm theo thứ tự task và cổng giai đoạn (cổng gắn với mốc Review) | Nhóm chọn lập kế hoạch theo task | — |
| 11 | Câu hỏi của công ty lấy từ đâu? | Endpoint sinh bộ 8–12 câu nháp theo `roleCategory` (SHRM/DDI), `orgId = companyId`, `source: org_template`, `status: draft`; Company Mod duyệt, sửa hoặc tự thêm câu | Hiện câu hỏi chỉ sinh giữa buổi cho từng ứng viên (`llm_followup`, `orgId: null`); chưa có bước sinh bộ câu cho công ty | CO-04, CO-05 |
| 12 | Luyện theo job dùng câu nào, tính quota thế nào, user free được luyện không? | Mọi gói đều luyện được; 3 câu baseline + 2 câu công ty đã duyệt cho mọi gói (5 câu), Pro thêm 2 câu follow-up LLM (7 câu); trừ 1 lượt phỏng vấn như buổi thường | User free vẫn có câu công ty nên chấm rubric có ý nghĩa; câu công ty cố định nên cache video được, chi phí thấp | JB-06, CO-06 |
| 13 | Giới hạn buổi đánh giá 0đ? | Mỗi ứng viên tối đa 1 buổi 0đ chưa xong cùng lúc và 2 buổi trong 30 ngày; ứng viên vắng thì tính là đã dùng; mentor vắng thì không tính và được đặt lại | Chặn lạm dụng buổi miễn phí mà vẫn cho ứng viên thử 2 mentor | LP-06, LP-22 |
| 14 | Rút đơn thì công ty còn xem snapshot không? Email được mời đã có tài khoản thì sao? | Rút đơn thì công ty chỉ còn thấy tên ứng viên và trạng thái "Đã rút", snapshot bị ẩn; email đã có tài khoản role khác thì từ chối lời mời, admin mời bằng email công ty khác | Đúng NFR "chỉ chia sẻ khi đồng ý"; `User.role` chỉ có một giá trị nên không trộn quyền ứng viên với quyền xem ứng viên | CO-02, JB-08, JB-09 |

## Quy tắc thiết kế đi kèm

### Nguyên tắc chung

- **Tái dùng Booking cho mọi buổi gặp** (buổi 0đ, buổi lộ trình, buổi học lại). Phần mới chỉ là lớp `LearningPath` bọc quanh.
- **Tái dùng đường ray chuyển khoản** (`recordTransferPending` → SePay webhook / admin xác nhận) cho mọi khoản thu. Không tích hợp cổng thanh toán mới.
- **Mở rộng router có sẵn**, không tạo prefix song song (ví dụ dùng `/api/mentorship-requests`, không tạo `/api/mentor-requests`).
- **ModerationItem chỉ dành cho hàng đợi HITL phỏng vấn** (`question_report`, `evaluation_report`, `evaluation_incomplete`). Rubric duyệt qua `CompanyRubric.status`; báo cáo job dùng type riêng `job_post_report` và màn riêng.

### Ánh xạ tên vai trò (code ↔ đơn đăng ký)

| `User.role` trong code | Tên trong đơn V2 / UI |
|:-----------------------|:----------------------|
| `customer` | Candidate |
| `mentor` | Mentor |
| `admin` | Admin |
| `moderator` | Platform Moderator |
| `company_moderator` (trước là `enterprise`) | Company Moderator |

Lưu ý: chữ `enterprise` còn là **giá trị gói** trong `CVAnalysis.planAtTime` (`free | pro | enterprise`). Không đổi giá trị này.

### Chia tiền lộ trình

Ứng viên trả trọn gói **T** đồng cho **n** buổi:

```
share_i = floor(T / n)              với i < n
share_n = T − (n − 1) × floor(T / n)
```

Ví dụ: T = 1.000.000đ, n = 3 → 333.333đ, 333.333đ, 333.334đ.

Booking của mỗi buổi phải ghi sẵn đủ các field tiền, vì `mentorNetFromBooking` (`mentorEarningsService.js:21`) tính `totalAmount − platformFee` và **không đọc `platformFeeRate`**:

| Field | Buổi lộ trình | Buổi 0đ / học lại miễn phí |
|:------|:--------------|:---------------------------|
| `price`, `totalAmount` | `shareAmount` | 0 |
| `platformFee` | `round(shareAmount × platformFeeRate)` | 0 |
| `vat` | 0 | 0 |
| `paymentMethod` | `"learning_path"` (để báo cáo tài chính không cộng trùng với Payment của lộ trình) | `"learning_path"` |
| `paymentStatus` | `"paid"` (để `bookingStaleSweepJob` không hủy) | `"paid"` |

- Thu nhập mentor mỗi buổi `done` = `totalAmount − platformFee`, qua `tryCreditMentorForCompletedBooking`.
- Hủy lộ trình: hoàn cho ứng viên = T − tổng `shareAmount` các buổi đã `done`. Mentor giữ phần đã nhận.
- Các hàm hủy/vắng mặt cũ không được hoàn tiền hay sinh rebook credit cho booking lộ trình (LP-22).

### State machine mới

| Đối tượng | Trạng thái và ai chuyển |
|:----------|:------------------------|
| LearningPath | `draft` (mentor soạn) → `proposed` → `revision_requested` (ứng viên) → `proposed`; `proposed` → `pending_payment` (ứng viên chấp nhận) → `active` (SePay/admin) → `completed` (buổi cuối đạt); `active` → `cancelled` (hoàn phần buổi chưa học) |
| LearningPathSession | `planned` → `scheduled` (tạo Booking) → `done`; outcome `passed` → mở buổi kế; `not_passed` → tạo buổi `retakeOf`, `attempt + 1` |
| MentorshipRequest | thêm `assessing`, `path_proposed` sau `selected` |
| JobPost | `draft` → `published` → `closed` (Company Mod hoặc hết hạn); `published` → `hidden` → `published` (Platform Mod) |
| Application | `submitted` → `viewed` → `shortlisted` \| `rejected`; `submitted` / `viewed` → `withdrawn` (ứng viên) |
| CompanyRubric | `draft` → `pending_review` → `approved` \| `rejected` → `draft`; `approved` → `archived` khi có version mới |
| QuestionBank (câu công ty) | `draft` → `approved` \| `rejected` (Company Mod), dùng enum `status` đã có |
| AIImprovementProposal | `proposed` → `approved` (kích hoạt PromptVersion) \| `rejected`; `approved` → `rolled_back` |

Khi code xong mỗi state machine, chép vào `docs/STATE_MACHINES.md` kèm bảng "chuyển → hàm/endpoint", và kiểm tra các job trong `backend/src/jobs` có lọc theo status mới không.

### Learning from Reviews (không fine-tune, dùng prompt có phiên bản)

1. `aiImprovementMinerJob` chạy mỗi ngày, gom ModerationItem đã xử lý: điểm bị `override_score`, câu bị sửa hoặc khai tử.
2. Khi một tiêu chí bị sửa điểm đủ ngưỡng (mặc định 5), job tạo `AIImprovementProposal`: cặp câu trả lời + điểm moderator làm few-shot mới, hoặc độ lệch hiệu chỉnh.
3. Platform Mod xem bằng chứng, so trước/sau trên bộ AI-01 và 10 câu trả lời cũ, rồi duyệt. Duyệt thì bật `PromptVersion` mới.
4. `InterviewSession` vốn đã ghi `promptVersion`; Langfuse trace theo version; Quality Dashboard so tỉ lệ bị sửa giữa các version. Có rollback.

Đây là phần "two-tier HITL" trong đơn: Company Mod duyệt câu theo công ty, Platform Mod duyệt rubric và cải tiến AI.

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

### Bộ tiêu chí năng lực SHRM/DDI (LP-01): quy tắc dùng chung

Áp dụng cho mọi task có chọn, lưu, chấm hoặc hiển thị năng lực: LP-13, LP-21 (feedback buổi lộ trình, buổi 0đ), CO-07 (rubric), JB-01 (job post), PR-06 (hồ sơ năng lực), AI-01, AI-02.

**Nguồn duy nhất:** `backend/src/config/competencies.json`. Không đặt danh sách năng lực ở chỗ khác, kể cả danh sách tạm.

| Phía | Đọc thế nào |
|:-----|:------------|
| Backend | Import từ `services/competencyFramework.js`: `getFramework()`, `getCompetency(key)`, `isValidCompetencyKey(key, { allowDeprecated })`, `aiAnswerToLevel(item, { answer })`, `suggestOutcome(scoresByKey, sessionKeys)`, `toDisplayLevel(level)` |
| Frontend | `competenciesApi.getFramework()` → `GET /api/competencies` (mọi role đã đăng nhập). Không import file JSON từ `backend/` |

**Key năng lực**
- Có 20 key, không đổi tên, không xóa. Muốn bỏ một key thì đặt `deprecated: true`: dữ liệu cũ vẫn hiện tên, nhưng form không cho chọn nữa và `isValidCompetencyKey` từ chối.
- Thêm key mới thì báo Janet trước, để không có hai key cho cùng một năng lực (hồ sơ năng lực sẽ bị tách đôi).
- Mọi API nhận key (lộ trình, rubric, job post) đều kiểm bằng `isValidCompetencyKey(key)`. Chỉ khi đọc dữ liệu cũ mới dùng `{ allowDeprecated: true }`.
- Sửa nội dung file (mô tả, anchors, hệ số) thì tăng `version`. Bản ghi điểm nên lưu kèm `frameworkVersion`.

**Thang điểm**
- Có 6 mức, 0–5 (xem `levels` trong file); ngưỡng đạt `passThreshold = 3`.
- Mentor chấm số nguyên 0–5. `null` nghĩa là "Chưa đủ dữ liệu": khác mức 0, không tính vào trung bình. UI hiển thị `nullLabel`.
- Gợi ý đạt/không đạt của một buổi: `suggestOutcome` trả `passed` khi **mọi** key của buổi ≥ 3 (không lấy trung bình); có key chưa chấm thì trả `null`. Mentor là người quyết định cuối cùng.

**Điểm AI**
- Quy đổi bằng `aiAnswerToLevel`: đọc điểm moderator chấm lại nếu có, sau đó `overall5`, sau đó `score / 20`; **không đọc `shrmLevel`**. Sau đó áp `aiCalibration` (tạm thời: −1, tối đa mức 4).
- Kết quả là số thập phân: so ngưỡng và gộp điểm dùng số thập phân, chỉ làm tròn khi hiển thị (`toDisplayLevel`).
- `aiCalibration.status = "provisional"`: trước khi AI-01 hiệu chỉnh xong, UI ghi rõ đây là ước lượng.
- `moderatorOverride` và `evaluationIncomplete` nằm trên `session.answers[i]`, không nằm trên `feedback.perQuestion[i]`. Truyền `{ answer }` vào hàm. Thiếu `answer` thì hàm không phân biệt được câu bỏ trống.

**Còn chờ chốt** (mục "Đề xuất thay đổi kế hoạch" trong TASKS.md): chỗ lưu điểm từng năng lực của buổi lộ trình (a) và của buổi 0đ (b); cách gán key cho 3 câu baseline vốn không có `competencyId` (e).

## Nhật ký quyết định mới

| Ngày | Task | Quyết định | Lý do |
|:-----|:-----|:-----------|:------|
| 18/11/2026 | LP-02 | Index unique `mentorshipRequestId` của Booking đổi tên thành `mentorshipRequestId_regular_unique`, partial filter thêm `sessionType: { $in: ["mock_interview", "cv_review", "career_consulting", "custom"] }` (danh sách `REQUEST_UNIQUE_SESSION_TYPES` trong `Booking.js`). Buổi lộ trình và buổi học lại **không gắn** `mentorshipRequestId`, chỉ gắn `learningPathId` (LP-04, LP-12, LP-13 phải tuân theo). Trên DB thật chạy `npm run db:sync-booking-indexes` để drop `mentorshipRequestId_1` | `partialFilterExpression` không hỗ trợ `$ne`/`$nin`/`$exists: false`, nên không loại được `assessment` hay `learningPathId` bằng điều kiện phủ định. Thêm `sessionType` mới thì quyết định có đưa vào danh sách chặn trùng không |
| 18/11/2026 | LP-03 | Mỗi `MentorshipRequest` chỉ có 1 `LearningPath` chưa `cancelled` (partial unique `mentorshipRequestId_open_unique`). Buổi học lại là document `LearningPathSession` riêng, cùng `order`, `attempt` + 1, `retakeOf` trỏ lần trước (unique `{pathId, order, attempt}`). Session có thêm trạng thái `cancelled` cho LP-15. `LearningPath.platformFeeRate` chụp lại tỉ lệ lúc gửi đề xuất | Chặn mentor tạo trùng bản nháp; giữ lịch sử từng lần học để tính tiền và hồ sơ năng lực; hủy lộ trình cần đánh dấu buổi chưa học; đổi `Mentor.pricing.platformFeeRate` sau khi chốt giá không làm lệch phần chia |
| 18/11/2026 | N-06 | Tên loại thông báo mới: `learning_path_proposed`, `learning_path_accepted`, `learning_path_revision_requested`, `learning_path_paid`, `learning_path_session_result`, `learning_path_cancelled`, `application_submitted`, `application_status_changed`, `company_invite`, `rubric_approved`, `rubric_rejected`, `job_post_hidden`, `ai_improvement_proposed` (danh sách gốc: `NOTIFICATION_TYPE_GROUPS` trong `models/Notification.js`). `metadata` thêm `learningPathId`, `learningPathSessionId`, `jobPostId`, `applicationId`, `companyId`, `rubricId`, `proposalId` | Tiền tố theo luồng để FE chọn icon (`utils/shared/notificationKind.js`); metadata là sub-document strict nên ref chưa khai báo bị bỏ im lặng. Luồng sau cần loại mới thì thêm vào nhóm tương ứng trước khi gọi `Notification.create` |
| 18/11/2026 | LP-04 | Field tiền của booking lộ trình và buổi 0đ chỉ sinh qua `utils/learningPathBookingMoney.js` (`learningPathBookingMoney`, `assessmentBookingMoney`). Buổi 0đ: `paymentMethod: ""` (không thuộc khoản thu nào), `paymentStatus: "paid"`. Báo cáo tài chính booking loại `paymentMethod: learning_path` **và** `sessionType: assessment` (`EXCLUDE_LEARNING_PATH_BOOKINGS`). `isLearningPathOrAssessmentBooking()` dùng cho LP-22 | Một chỗ duy nhất giữ công thức `platformFee = round(share × rate)`; nếu không loại buổi 0đ thì ứng viên chỉ học thử bị đếm vào `paidCustomerCount` |
| 18/11/2026 | LP-22 | Booking lộ trình / buổi 0đ bị hủy (ứng viên hoặc mentor, kể cả mentor hủy gấp < 24h) hay mentor no-show: chỉ đổi `status` + `cancelledBy`, `paymentStatus` giữ `paid`, `cancelRefundAmountVnd = 0`, không `awaiting_user`, không rebook credit; `LearningPathSession` quay về `planned` để đặt lại cùng buổi, không mất phí. Ứng viên hủy không bị phí hủy muộn. Mentor no-show vẫn tăng `noShowCount`. `resolveMentorCancelBooking` trả 400 | Tiền đã thu trọn gói ở LearningPath; hoàn từng buổi sẽ cộng trùng với khoản hoàn khi hủy lộ trình (LP-15). Phạt ứng viên hủy muộn / giới hạn buổi 0đ để LP-06 quyết định dựa trên `cancelledBy` |
| 18/11/2026 | LP-05 | `POST /api/mentorship-requests/:id/accept-assessment` do **Mentor được chọn** gọi, tự chọn ngày giờ; Booking buổi 0đ tạo ở `confirmed` + `paid` (không qua thanh toán) và thông báo `booking_confirmed` cho mentee. Mỗi yêu cầu chỉ có 1 buổi 0đ còn hiệu lực (`assessmentBookingId`); hẹn lại được khi buổi trước `cancelled`/`no_show`, chặn khi đã `completed` hoặc `path_proposed`. `jobPostId` chỉ kiểm định dạng ObjectId (model JobPost có ở JB-01). DTO tách `bookingId` (booking thường) và `assessment` | Đúng "Xong khi: Mentor tạo được buổi 0đ"; mentee hủy được qua luồng LP-22 nếu giờ không hợp. Giới hạn số buổi 0đ của ứng viên để LP-06 xử lý |
| 18/11/2026 | LP-01 | Bộ tiêu chí ở `backend/src/config/competencies.json`; FE đọc qua `GET /api/competencies`, không import chéo thư mục | Một nguồn duy nhất cho BE, FE và các task CO-07, JB-01, LP-03 |
| 18/11/2026 | LP-01 | Giữ nguyên 20 key cũ; chỉ thêm key mới hoặc đánh dấu `deprecated` | `InterviewSession`, `QuestionBank`, DTO moderator đã lưu và kiểm tra theo các key này |
| 18/11/2026 | LP-01 | Thang 0–5 theo bảng 6 mức là định nghĩa chuẩn; `null` = "Chưa đủ dữ liệu"; ngưỡng đạt 3; mentor chấm số nguyên | Mentor và AI dùng chung một thang; `null` không bị tính như mức 0 |
| 18/11/2026 | LP-01 | Quy đổi điểm AI từ `overall5` (không dùng `shrmLevel`), hệ số tạm `offset -1` và tối đa mức 4, giữ số thập phân; lỗi hệ thống (`evaluationIncomplete`) trả `null`; hiệu chỉnh lại bằng AI-01 | `shrmLevel` do LLM cho riêng và có fallback `"proficient"`; AI chấm dễ hơn bảng khoảng một mức |
| 18/11/2026 | LP-01 | Buổi lộ trình gợi ý đạt khi mọi key ≥ ngưỡng; mentor quyết định cuối cùng | Không để một năng lực mạnh che năng lực yếu như khi lấy trung bình |
| 19/11/2026 | LP-07 | API lộ trình mới ở prefix `/api/learning-paths` (theo DESIGN mục 5), quyền dùng chung `requestActor`. Bản nháp: tối đa 12 buổi, `PATCH sessions` thay toàn bộ danh sách, mentee không thấy bản nháp. Gửi đề xuất cần: ≥ 1 buổi, giá trọn gói ≥ 10.000₫ (số nguyên), buổi `assessment` của yêu cầu đã `completed`. `platformFeeRate` chụp lúc gửi bằng `resolveBookingPlatformFeeRate(mentor)` (giống booking, quyết định 4). `shrmKeys` tạm kiểm `^[a-z0-9_]{2,60}$` cho tới khi có bộ tiêu chí LP-01. `shareAmount` = 0 cho tới LP-09 | Prefix mới vì đây là domain mới (không phải mở rộng router có sẵn); ngưỡng giá tối thiểu tránh gửi nhầm lộ trình 0đ; kiểm key SHRM theo LP-01 sẽ thay regex khi Janet xong |
| 19/11/2026 | LP-20 | Màn Mentor lộ trình dựng trên bộ CSS `mr-*` của trang Nhu cầu mentee (thêm `styles/learning-paths.css`, tiền tố `lp-`) để cùng giao diện khu vực mentor. Danh sách năng lực SHRM để chọn cho từng buổi tạm đặt ở `utils/learningPath/learningPathEditor.js` (`SHRM_COMPETENCIES`, 12 key) cho tới khi LP-01 có bộ tiêu chí chung. "Hồ sơ ứng viên" tạm lấy từ yêu cầu mentor (vị trí, nhu cầu, CV/JD, buổi 0đ) cho tới PR-01. Sắp xếp buổi bằng nút lên/xuống (không kéo-thả) | Khớp giao diện hiện có; nút lên/xuống dùng được bằng bàn phím và trên điện thoại; tránh chờ LP-01, PR-01 |
| 19/11/2026 | LP-08 | Mentee chấp nhận gửi kèm `version` đang xem (tùy chọn): lệch thì 409 để không chấp nhận nhầm bản cũ sau khi mentor gửi lại. Yêu cầu sửa bắt buộc ghi chú 5–2000 ký tự. Chấp nhận chỉ đổi sang `pending_payment`, chưa sinh `paymentRef` (LP-10 sinh khi checkout). Thông báo cho mentor dùng khóa cài đặt `booking_request` (mentor tắt nhóm này thì không nhận) | Tránh chấp nhận bản cũ; mentor cần biết mentee muốn sửa gì; tách chấp nhận khỏi thanh toán để LP-10 dùng đúng đường ray chuyển khoản |
| 19/11/2026 | LP-09 | Hàm chia tiền ở `utils/learningPathMoney.js`. `shareAmount` của các buổi gốc được **chốt khi Mentor gửi đề xuất** (`proposeLearningPath`), tính lại mỗi lần gửi lại. Tiền hoàn khi hủy chỉ trừ `shareAmount` của buổi gốc (`attempt = 1`) đã `done`: buổi học lại miễn phí (`attempt = 2`) = 0, buổi bổ sung có phí (`attempt ≥ 3`) thu riêng nên không nằm trong T. Màn soạn (LP-20, `previewShares`) dùng cùng công thức để ước tính | Mentee thấy đúng tiền từng buổi khi xem đề xuất; giá chỉ đổi được khi mentor sửa nên chốt lúc gửi là đủ; tách buổi bổ sung khỏi T tránh hoàn thừa |
| 19/11/2026 | LP-07, LP-20 | Thay danh sách năng lực tạm (12 key ở FE, regex ở BE) bằng bộ tiêu chí LP-01: BE kiểm `isValidCompetencyKey`, FE đọc `GET /api/competencies`. 6 key cũ đổi sang key gần nhất: `critical_thinking` → `problem_solving`, `technical_knowledge` → `technical_learning`, `decision_making` → `data_driven_decision`, `planning_organizing` → `planning_execution`, `initiative` → `accountability`, `relationship_management` → `stakeholder_management` (script `db:migrate-lp-shrm-keys`). PR #204 | Năng lực nào cũng đã có key tương đương; thêm key mới sẽ thành hai key cho cùng một năng lực và hồ sơ năng lực bị tách đôi |
| 19/11/2026 | AI-02 | `PromptVersion` đăng ký 2 key `evaluation` và `question_gen`; prompt khác (CO-04, JB-07, AI-08…) tự đăng ký trong `backend/src/prompts/index.js` khi làm task của mình | Giữ phạm vi nhỏ; mỗi prompt mới có spec và bản mặc định riêng |
| 19/11/2026 | AI-02 | Template chỉ chứa chữ và biến `{{tên}}` (giá trị là chuỗi hoặc mảng chuỗi); logic giữ trong code. **Mọi thay đổi chữ trong prompt từ nay đi qua version mới**, không sửa thẳng trong `prompts/*.js` (sync sẽ cảnh báo template lệch). Bản mặc định: `eval-v1`, `followup-v1` | Đo được drift theo version; rollback bằng `activate` bản cũ |
| 19/11/2026 | AI-02 | Loader cache 60 giây trong bộ nhớ, `activate()` xóa cache. DB lỗi, không có bản active hoặc template trong DB hỏng thì dùng prompt mặc định trong code và ghi log; `promptVersion` ghi vào session là version của prompt **thực sự chạy** (bản mặc định thì `eval-v1` / `followup-v1`) | Phỏng vấn không lỗi vì DB; số liệu Quality Dashboard không gán nhầm version |
| 19/11/2026 | AI-02 | Tên version `<tiền tố>-vN`, duy nhất trên toàn bảng (unique riêng `version`): `eval-vN`, `followup-vN`; prompt mới dùng tiền tố riêng. `activate()` kiểm tra template đủ phần, đủ biến (render thử) trước khi bật, thiếu thì từ chối | Quality Dashboard nhóm theo chuỗi không kèm key; chặn bật bản prompt hỏng |
| 19/11/2026 | AI-02 | **Nội dung prompt = PromptVersion + version bộ tiêu chí LP-01.** Sửa chữ trong `competencies.json` thì phải tăng `version` của file; backtest (AI-04) cố định cả hai version. Trace Langfuse `generate_questions`, `evaluate_session` gắn `metadata.promptVersion` và `metadata.frameworkVersion` | Chữ của khối năng lực trong prompt sinh từ `competencies.json`, chưa nằm trong template (đề xuất (g)) |

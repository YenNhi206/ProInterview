# ProInterview: Kế hoạch task (nguồn đúng duy nhất)

> Mọi task gắn mã REQ trong `docs/plan/REQUIREMENTS.md` (cột REQ, ít nhất một mã).
> Phiên bản: 22/11/2026 (bản 18/11/2026 đã đối chiếu mã nguồn 2 lần; 22/11 đồng bộ trạng thái từ `docs/capstone/TASKS.md` và thêm cột REQ). 109 task, 7 giai đoạn, không gắn ngày.
> File này là **nguồn đúng duy nhất** về tiến độ. Agent đọc file này trước mỗi task và cập nhật cột Trạng thái sau mỗi task.
> Quyết định đã chốt: `docs/plan/DECISIONS.md`. Thiết kế (model, state machine, API, bẫy trong code): `docs/plan/DESIGN.md`.

## Quy ước

- **Trạng thái**: `Todo` → `Doing · <tên>` → `Review · <tên> · PR #<số>` → `Done`. `Blocked · <tên>` kèm lý do ở mục "Ghi chú Blocked" cuối file. Cột Trạng thái là nguồn sự thật duy nhất về ai đang làm gì.
- **REQ**: mã trong `REQUIREMENTS.md`; REQ chính trước, REQ phụ trong ngoặc, ví dụ `C-07 (+A-04, NFR-03)`. `NEN (<REQ>)` là task hạ tầng mở đường cho REQ đó; `NEN (*)` là việc dùng chung cả dự án (hạ tầng, quy trình, hồ sơ môn SWP490).
- **Nhận task**: ai cũng nhận được mọi task, cột "Người" chỉ là gợi ý ban đầu. Chỉ nhận task sẵn sàng. Đổi sang `Doing · <tên>` trong một commit lên `main` (hoặc báo nhóm) **trước khi code**. Mỗi người tối đa 2 task `Doing` cùng lúc.
- **Xong task**: mở PR → `Review`; PR merge vào `main` → `Done`. Task có bước chạy trên DB thật (script migrate, sync index) chỉ `Done` khi đã chạy xong trên production.
- **Cổng giai đoạn**: giai đoạn chỉ đóng khi demo được câu "Cổng" của nó **trên staging**.
- **Mã task**: `N` nền tảng, `LP` Learning Path, `CO` Company và Rubric, `PR` Profile và CV, `JB` Job Post và Ứng tuyển, `AI` vòng AI, `QA` kiểm thử, `DOC` tài liệu. Mã không đổi; task mới lấy số tiếp theo (ví dụ LP-22 đứng sau LP-04).
- **Mức**: P0 bắt buộc cho buổi bảo vệ, P1 nên có, P2 làm nếu còn thời gian.
- **Nhánh và PR**: mỗi task một nhánh `feat/<mã>-<tên-ngắn>`, ví dụ `feat/LP-02-fix-booking-index`. Tên PR bắt đầu bằng mã task.
- **Review chéo**: BE của Trầm do Văn review và ngược lại; FE do Janet review; AI do Trầm review. Janet merge.
- **Task sẵn sàng** = `Todo` và mọi task trong cột "Cần xong trước" đã `Done`.
- **Làm đầu tiên**: LP-02 (index unique Booking) và N-06 (enum Notification).
- **Giao được ngay**: N-01, N-02, N-03, N-05, N-06, N-07, N-10, AI-01, AI-12, LP-02, CO-01.

## Definition of Done (mọi task)

- Code theo quy ước repo: response `{ success, <key> }`, lỗi tiếng Việt, FE dùng `apiUrl()` + `authFetch()`, route gắn `authJwt` và `requireRole`. Mở rộng router có sẵn thay vì tạo prefix song song.
- Task BE có test integration trong `src/integration/` và `npm test` xanh.
- Mọi chuyển trạng thái mà người kia cần biết đều gửi Notification với loại đã có trong enum (N-06).
- Cập nhật tài liệu liên quan: `API_INDEX.md`, `docs/LOGICAL_ERD.md`, `backend/DATABASE.md`, `docs/STATE_MACHINES.md` (nếu đổi model hoặc status).
- Không còn dữ liệu giả hay state demo trong màn hình vừa làm.
- PR được người review đồng ý, staging chạy được.
- Cột Trạng thái trong file này đã cập nhật; quyết định mới (nếu có) đã ghi vào `DECISIONS.md`.

## Mốc kích hoạt

Mỗi cổng giai đoạn gắn với một mốc Review của SWP490. Tới mốc mà cổng chưa qua thì P1 của các giai đoạn chưa bắt đầu tự chuyển sang "Hướng phát triển". Điền tên mốc đúng lịch trường.

| Mốc | Phải qua cổng |
| --- | --- |
| Review 2 | GĐ 0; LP-02 đến LP-04 và CO-01 đến CO-03 xong |
| Review kế tiếp | GĐ 1 và GĐ 2; P0 của GĐ 3 xong |
| Review cuối trước bảo vệ | GĐ 4 và P0 của GĐ 5 |
| Bảo vệ | GĐ 6 |

## Thứ tự giai đoạn

```
GĐ0 Nền tảng ──┬──> GĐ1 Learning Path (Trầm, Nhi) ─────────────┬──────────────┐
               ├──> GĐ2 Company và Rubric (Văn) ──> GĐ3 Profile ┤ (PR-06 cần LP-13)
               │                         └─(JB-01 cần CO-03)──> GĐ4 Job Post ──> GĐ6 Kiểm thử
               └──> GĐ5 Vòng AI (Janet; AI-01, AI-02, AI-12 làm sớm) ─────────────────┘
```

Sau GĐ0, ba luồng chạy song song: Learning Path (Trầm), Company và Rubric (Văn), vòng AI (Janet). Văn làm Company trước Profile vì Job Post của Trầm cần Company.

## Phân công

| Người | Vai trò | Sở hữu | P0 | P1 | P2 | Tổng |
| --- | --- | --- | --- | --- | --- | --- |
| Trầm | Backend | Index Booking, Learning Path, chặn luồng hủy cũ, chia tiền và đường ray thanh toán lộ trình, enum Notification, doanh thu theo nguồn, trạng thái CVAnalysis, Job Post, Ứng tuyển, đo SePay; FE `/company/jobs`, xác nhận tay lộ trình | 30 | 2 | 0 | 32 |
| Văn | Backend | Đổi role và migrate, Node 22 + test glob, Company, lời mời, phân quyền, Rubric, Profile, kho CV, xuất PDF, test tải, đo CV/avatar, seed demo; FE admin công ty, `/company` layout + câu hỏi, moderator rubric, báo cáo job, AI improvements | 24 | 4 | 1 | 29 |
| Nhi | Frontend | Luồng ứng viên và mentor (lộ trình, hồ sơ, CV, job, ứng tuyển), trang nhận lời mời, trình soạn rubric, chi tiết đơn ứng tuyển, gỡ số liệu giả, HITL bước 7, kiểm thử thủ công | 16 | 7 | 0 | 23 |
| Janet | Lead, AI | Tiêu chí SHRM/DDI, sinh câu và cache video câu công ty, CV validate và best-fit, hồ sơ năng lực, khoảng thiếu, luyện theo job, chấm rubric, vòng cải tiến AI, sàng lọc khóa, gợi ý, SRS/SDD, hồ sơ Review, merge | 17 | 8 | 0 | 25 |
| **Cộng** | | | **87** | **21** | **1** | **109** |

---

## GĐ 0: Nền tảng và dọn nợ

**Cổng:** không còn trang nào hiện số liệu giả; role `company_moderator` đăng nhập được và tài khoản cũ đã migrate; mọi loại Notification mới lưu được; `npm test` tự nhận file test mới trên Node 22; có log thời gian thật cho CV và avatar.

| Mã | REQ | Trạng thái | Task | Người | Cần xong trước | Xong khi | Mức |
| --- | --- | --- | --- | --- | --- | --- | --- |
| N-01 | NEN (C-01) | Todo | Merge PR #187, set `REFRESH_TOKEN_PEPPER` trên Render | Trầm |  | Đăng nhập, refresh, đăng xuất chạy trên production | P0 |
| N-02 | NEN (CM-01) | Done | Đổi role `enterprise` → `company_moderator` **đúng 8 chỗ**: `User.role`, `requireRole.js`, `userRoleService` (ASSIGNABLE_ROLES), `seedUsers.js`, `backend/src/data/usersSeed.json` (dòng 29), test `rbacRoles`, `docs/database/prointerview_schema.mongodb.js`, comment trong `frontend/src/app/utils/auth/roleLoader.js`. **Không tìm-thay hàng loạt**: `enterprise` còn là giá trị gói trong `CVAnalysis.planAtTime`, `CVAnalysis.jsx`, `adminController.js` | Văn |  | Chạy lại seed không tạo role cũ; test RBAC xanh | P0 |
| N-03 | NEN (CM-01) | Review · Văn · PR #210 | Script migrate user có role `enterprise` sang `company_moderator` (chạy lại nhiều lần không lỗi) | Văn | N-02 | `enterprise@dev.local` đăng nhập được với role mới | P0 |
| N-04 | NEN (CM-01) | Done | Thêm `User.companyId` + index; helper `assertSameCompany(req, companyId)` | Văn | N-02 | Helper có unit test cho trường hợp khác công ty | P0 |
| N-05 | NEN (*) | Done | Cố định Node 22: `engines` và thêm `NODE_VERSION=22` vào `render.yaml`; đổi `test:node` sang glob | Văn |  | Thêm file test mới không phải sửa `package.json`; Render build bằng Node 22 | P0 |
| N-06 | NEN (C-07) (+A-02, CM-04, PM-02, PM-05, PM-04) | Done | Mở rộng enum `Notification.type`: lộ trình (đề xuất, chấp nhận, yêu cầu sửa, đã thanh toán, kết quả buổi, hủy), ứng tuyển (nộp, đổi trạng thái), lời mời công ty, rubric (duyệt, từ chối), job bị ẩn, đề xuất cải tiến AI | Trầm |  | Test lưu được từng loại; làm trước mọi luồng mới | P0 |
| N-07 | AIS-07 (+C-09) | Todo | Job đánh `abandoned` cho InterviewSession `in_progress` quá 24h; loại khỏi thống kê | Trầm |  | Test integration; enum cập nhật trong `STATE_MACHINES.md` | P0 |
| N-08 | A-05 | Todo | Bổ sung doanh thu theo nguồn (booking, khóa, gói, lộ trình) vào API analytics admin. Các API khác đã có: `/analytics/user-behavior`, `/analytics/users/:id/journey`, `/users/:id`, content stats | Trầm |  | Số khớp truy vấn tay trên DB | P0 |
| N-09 | A-05 (+A-01) | Todo | FE gỡ lớp bơm số liệu giả ở **5 file**: `AdminAnalytics.jsx`, `AdminUsers.jsx`, `AdminUserDetail` + `AdminContentQuestions` (trong `AdminPlaceholders.jsx`), `components/admin/UserJourneyPanel.jsx` (`ensureRichJourney`); dùng số thật từ API. Sau đó xóa `utils/analytics/mock*.js` | Nhi | N-08 | Không còn số cứng hay số sinh ngẫu nhiên trong 5 file | P0 |
| N-10 | C-10 (+PM-03) | Done | FE HITL bước 7: nút "Báo sai", nhãn "Đang chờ kiểm định", ưu tiên `moderatorOverride.overall` trên `InterviewFeedback.jsx` | Nhi |  | Báo sai tạo được ModerationItem; điểm moderator hiện thay điểm AI | P0 |
| N-11 | NFR-01 (+NFR-02, AIS-05) | Todo | `cvMatch.js` tạo bản ghi `CVAnalysis` với status `processing` trước khi gọi Python, ghi `failed` hoặc kết quả + `durationMs` sau; FE cập nhật bản ghi đó thay vì tạo mới. Log `durationMs` từng bước pipeline avatar (TTS, D-ID, mirror) | Trầm |  | Mỗi lần phân tích chỉ có 1 bản ghi; lỗi hiện `failed`; có log thời gian trên Render | P0 |
| N-12 | NEN (*) | Done | Sửa các chỗ lệch trong `CLAUDE.md` (router, thư mục `api/`, danh sách model, trạng thái FE); thêm quy ước tên role, mã task, các bẫy | Janet | N-02 | Thành viên mới đọc không bị dẫn sai | P1 |
| N-13 | A-01 (+CM-01, PM-01) | Todo | Nhãn UI theo tên trong đơn: Candidate, Platform Moderator, Company Moderator | Nhi | N-02 | Không còn chữ "customer" hay "enterprise" (role) trên giao diện | P1 |
| N-14 | NEN (*) | Done | Dọn `scratch_*`, `debug_*`, `*.ps1`, `line501.txt` ở gốc backend; sửa `dev:full` chạy được trên Windows | Văn |  | Gốc backend chỉ còn file của ứng dụng | P2 |

## GĐ 1: Learning Path

**Cổng:** ứng viên gửi yêu cầu, học buổi đánh giá 0đ, nhận lộ trình 3 buổi, chuyển khoản trọn gói và SePay tự xác nhận, bị "không đạt" ở một buổi, học lại miễn phí, hoàn thành; cả 5 booking cùng một yêu cầu không lỗi; mentor thấy thu nhập từng buổi; admin thấy doanh thu lộ trình.

Áp dụng quyết định 1 đến 5 và 13, cùng công thức chia tiền trong `DESIGN.md`.

| Mã | REQ | Trạng thái | Task | Người | Cần xong trước | Xong khi | Mức |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LP-01 | M-04 (+M-02, AIS-02) | Done | Bộ tiêu chí SHRM/DDI dùng chung cho buổi 0đ và feedback từng buổi: key năng lực (lấy từ `COMPETENCY_LIBRARY` trong `competencyFramework.js`), **thang 6 mức 0–5** có mô tả, ngưỡng đạt, hệ số `aiCalibration`, và hàm quy đổi điểm AI sang mức. Đặc tả ở [mục dưới bảng](#đặc-tả-lp-01-thang-6-mức-và-quy-đổi-điểm-ai). Không sửa prompt chấm AI | Janet |  | File cấu hình trong `config/` là nguồn duy nhất; BE đọc trực tiếp, FE đọc qua `GET /api/competencies`; `competencyFramework.js` đọc lại từ file này, luồng phỏng vấn không đổi hành vi; unit test hàm quy đổi đủ các nhánh: `moderatorOverride`, `overall5`, `score / 20`, không trả lời, `evaluationIncomplete`, chặn trên mức 4 | P0 |
| LP-02 | NEN (C-07) | Done | **Sửa index unique `mentorshipRequestId` (`Booking.js:152`)**: partial filter loại `sessionType: assessment` và booking có `learningPathId`; buổi lộ trình chỉ gắn `learningPathId`. Kèm **script drop index cũ `mentorshipRequestId_1` rồi sync** theo mẫu `scripts/syncModerationIndexes.js` (chỉ sửa schema thì MongoDB báo `IndexOptionsConflict` và index cũ vẫn chặn). Làm đầu tiên | Trầm |  | Test: 1 buổi 0đ + 3 buổi + 1 buổi học lại cùng request không lỗi `E11000`; booking thường vẫn bị chặn trùng. Chạy script trên staging, `getIndexes()` đúng partial filter mới | P0 |
| LP-03 | M-03 (+C-07) | Done | Model `LearningPath`, `LearningPathSession` (`shrmKeys: [String]`, `shareAmount`) + index | Trầm |  | Export ở `models/index.js`; ERD cập nhật | P0 |
| LP-04 | C-07 (+M-02) | Done | Booking: `sessionType` `assessment`, `learningPathId`, `learningPathSessionId`; thêm `"learning_path"` vào enum `paymentMethod`. Booking lộ trình ghi đủ: `paymentStatus: "paid"`, `price = totalAmount = shareAmount`, `platformFee = round(shareAmount × rate)`, `vat = 0`, `paymentMethod: "learning_path"`. Buổi 0đ và học lại: mọi field tiền bằng 0 | Trầm | LP-02, LP-03 | Test: `bookingStaleSweepJob` không hủy; `mentorNetFromBooking` ra đúng `share − platformFee`; báo cáo tài chính không cộng trùng | P0 |
| LP-22 | C-07 (+A-04) | Done | **Chặn các luồng có sẵn với booking lộ trình và buổi 0đ**: `cancelMyBooking`, `cancelMentorBooking`, `processBookingNoShow`, `resolveMentorCancelBooking` kiểm tra `learningPathId` hoặc `sessionType: assessment`, rồi chặn hoàn tiền/rebook credit từng buổi và chuyển sang logic lộ trình (hủy buổi → đặt lại buổi đó; vắng mặt buổi 0đ → theo quyết định 13) | Trầm | LP-04 | Test từng hàm: không phát sinh refund hay credit cho booking lộ trình; booking thường giữ nguyên hành vi | P0 |
| LP-05 | M-02 (+C-06) | Done | Mở rộng router có sẵn `/api/mentorship-requests`: `jobPostId` tùy chọn, `assessmentBookingId`, status `assessing` / `path_proposed`, `POST /:id/accept-assessment` tạo buổi 0đ. Sửa điều kiện `request.status === "selected"` ở `mentorshipRequestsService.js:125` để status mới không chặn luồng cũ | Trầm | LP-04 | Mentor tạo được buổi 0đ; luồng đặt lịch thường từ yêu cầu không bị 403 | P0 |
| LP-06 | C-06 (+M-02) | Todo | Giới hạn buổi 0đ theo quyết định 13 (1 buổi chưa xong cùng lúc, 2 buổi/30 ngày; ứng viên vắng tính đã dùng, mentor vắng không tính) | Trầm | LP-05, LP-22 | Test đủ 4 trường hợp | P0 |
| LP-07 | M-03 | Done | API mentor: tạo/sửa bản nháp, `propose` (≥ 1 buổi, có giá, buổi 0đ đã `completed`) | Trầm | LP-05 | `draft → proposed` có test, kể cả trường hợp bị chặn | P0 |
| LP-08 | C-07 | Done | API ứng viên: xem, `accept`, `request-revision` kèm ghi chú; `version` tăng mỗi lần gửi lại | Trầm | LP-07 | Vòng sửa → gửi lại → chấp nhận có test | P0 |
| LP-09 | C-07 (+M-06) | Done | Hàm chia tiền trong `utils/`: T → `shareAmount` từng buổi (chia đều phần nguyên, buổi cuối nhận phần dư), `platformFee` từng buổi, học lại = 0; hàm tính tiền hoàn | Trầm | LP-03 | Unit test: tổng luôn bằng T với T không chia hết | P0 |
| LP-10 | C-07 (+A-04, NFR-03) | Done | Đường ray chuyển khoản cho lộ trình: `Payment.type` `learning_path`; `paymentRef` sinh bằng `utils/orderRef.js` (mã `PI…` để `parsePiOrderFromText` nhận ra); target mới trong `sepayWebhookService.findPendingTargets` + hàm xác nhận; `SepayWebhookEvent.entityType`; hết hạn qua `transferPaymentExpiryService`; path sang `active` | Trầm | LP-08, LP-09 | Test: đúng tiền, sai tiền, webhook gửi lại 2 lần, hết hạn | P0 |
| LP-11 | A-04 | Done | Xác nhận tay chuyển khoản lộ trình: thêm loại `learning_path` vào trang đối soát admin có sẵn (BE + FE) | Trầm | LP-10 | Admin xác nhận được trên UI | P0 |
| LP-12 | C-07 | Todo | Đặt lịch từng buổi: tạo Booking gắn session theo LP-04, chỉ mở khi buổi trước `passed` | Trầm | LP-10 | Không đặt được buổi 3 khi buổi 2 chưa đạt | P0 |
| LP-13 | M-04 | Todo | Ghi kết quả: `passed`/`not_passed` + feedback theo LP-01; `not_passed` lần đầu tạo buổi `retakeOf` 0đ, lần 2 trở đi mentor đề xuất buổi bổ sung có phí; buổi cuối đạt thì path `completed`. Lưu điểm từng năng lực ở `LearningPathSession.feedback.scores[] {shrmKey, score (0–5 hoặc null), note}` + `frameworkVersion` (đề xuất a); kết quả buổi 0đ ở `LearningPath.assessment.scores[]` + `frameworkVersion` (đề xuất b) | Trầm | LP-01, LP-12 | Đủ nhánh đạt, không đạt lần 1, lần 2 có test | P0 |
| LP-14 | M-06 | Todo | Thu nhập mentor qua `tryCreditMentorForCompletedBooking` / `mentorNetFromBooking` (`totalAmount − platformFee`) với booking ghi theo LP-04 | Trầm | LP-13 | Mentor nhận đúng `share − platformFee` mỗi buổi, 0 cho buổi 0đ và học lại; `earningsClearanceJob` chuyển đúng | P0 |
| LP-15 | A-04 | Todo | Hủy lộ trình: hoàn = T − tổng phần chia các buổi đã `done`, qua luồng refund có sẵn | Trầm | LP-14, LP-22 | Test hủy sau buổi 1 và sau buổi học lại; không hoàn trùng | P1 |
| LP-16 | A-05 | Todo | Doanh thu lộ trình trong báo cáo tài chính admin; thu nhập mentor hiện theo lộ trình (đóng mục 16 và 21) | Trầm | LP-14 | Số khớp tổng Payment `learning_path`, không cộng thêm booking `paymentMethod: learning_path` | P0 |
| LP-17 | C-07 (+M-04, M-06) | Todo | Test integration trọn luồng từ yêu cầu đến `completed` | Trầm | LP-14 | Một file test chạy cả luồng | P0 |
| LP-18 | C-06 (+C-07) | Done | FE ứng viên: trang `/learning-paths` (ô chọn job trong form yêu cầu mentor chuyển sang JB-12, đề xuất i) | Nhi | LP-05 | Danh sách hiện đúng trạng thái từ API | P0 |
| LP-19 | C-07 | Todo | FE ứng viên: `/learning-paths/:id` dạng timeline, chấp nhận / yêu cầu sửa, thanh toán (dùng lại `/checkout`), đặt lịch buổi, xem đạt/học lại và feedback | Nhi | LP-08, LP-10 | Đi hết luồng trên UI không cần Postman | P0 |
| LP-20 | M-03 | Done | FE mentor: `/mentor/learning-paths` và trình soạn (thêm, sắp xếp buổi, mục tiêu, năng lực SHRM, giá trọn gói, xem hồ sơ ứng viên) | Nhi | LP-07 | Soạn và gửi được lộ trình 3 buổi | P0 |
| LP-21 | M-04 (+M-02) | Todo | FE mentor: form đánh giá đầu vào (buổi 0đ) và form đạt/không đạt + feedback, gắn vào trang có sẵn `/mentor/session-feedback/:sessionId`; chấm điểm từng năng lực, lưu vào field của đề xuất (a), (b) | Nhi | LP-01, LP-13 | Ghi kết quả xong thì timeline ứng viên cập nhật | P0 |
| LP-23 | M-03 | Todo | Trình soạn lộ trình hiện năng lực còn thiếu từ hồ sơ ứng viên (PR-07) và `requiredCompetencies` của job nếu yêu cầu có job (JB-01) để gợi ý buổi; mentor vẫn sửa tự do (quyết định 5) | Nhi | LP-20, PR-07, JB-01 | Soạn lộ trình cho một yêu cầu có job thì thấy danh sách năng lực gợi ý lấy từ hồ sơ và job | P1 |

### Đặc tả LP-01: thang 6 mức và quy đổi điểm AI

**Bảng 6 mức** là định nghĩa chuẩn, dùng chung cho mentor và AI. Không chỉnh bảng theo prompt AI hiện tại: prompt chỉ mô tả mức 5/3/1 cho 4 tiêu chí và không định nghĩa `overall`.

| Mức | Nhãn | Mô tả |
|:---:|:-----|:------|
| 0 | Không thể hiện | Không trả lời, hoặc nội dung không dính tới câu hỏi |
| 1 | Yếu | Có cố trả lời nhưng ví dụ không thể hiện năng lực được hỏi |
| 2 | Đang phát triển | Có ý đúng nhưng chung chung ("thường thì em sẽ…"), thiếu ví dụ cụ thể, hoặc thiếu phần Hành động hay Kết quả |
| 3 | **Đạt** | Ví dụ cụ thể, đủ Tình huống, Nhiệm vụ, Hành động, Kết quả; nói rõ phần việc của bản thân |
| 4 | Vững | Như mức 3, cộng kết quả đo được, rút ra bài học, xử lý được tình huống khó hoặc có xung đột |
| 5 | Xuất sắc | Như mức 4, cộng ảnh hưởng vượt phạm vi công việc (dẫn dắt, thay đổi cách làm của nhóm) và nhất quán ở nhiều tình huống. Ý "nhất quán" chỉ xét được qua nhiều câu hoặc nhiều buổi |

**Ngưỡng đạt:** mức 3. Buổi lộ trình gợi ý "đạt" khi mọi key năng lực của buổi ≥ 3; mentor là người quyết định cuối (LP-13). Mentor chấm số nguyên 0–5.

**Quy đổi điểm AI sang mức**

| Bước | Quy tắc |
|:-----|:--------|
| Nguồn điểm | `answers[i].moderatorOverride.overall` nếu có; không thì `feedback.perQuestion[i].overall5`; session cũ chỉ có `score` thì `score / 20`. **Không dùng `shrmLevel`**, vì LLM cho chữ này riêng, không suy từ điểm |
| Không trả lời | Mức 0 |
| `evaluationIncomplete = true` hoặc không có điểm | `null`: hiển thị "Chưa đủ dữ liệu", không tính vào trung bình |
| Công thức tạm | `mức = min(4, max(0, overall5 − 1))`, giữ số thập phân. Hệ số lưu ở `aiCalibration` trong file config, chỉnh lại bằng bộ AI-01. AI chấm từng câu không cho ra mức 5 |
| Gộp và hiển thị | Gộp và so ngưỡng dùng số thập phân; UI làm tròn khi hiển thị. Trước khi AI-01 hiệu chỉnh xong, điểm quy đổi chỉ là ước lượng, không hiển thị như điểm chuẩn |

Lý do trừ 1: đối chiếu prompt hiện tại cho thấy AI chấm dễ hơn bảng khoảng một mức. Điểm 5 của AI (đủ STAR, có số liệu) chỉ tương đương mức 4; câu thiếu phần STAR được AI cho 3, bảng cho 2.

**Ngoài phạm vi LP-01**
- Bỏ fallback `"proficient"` ở `interviewQuestionService.js:895` và `interviewsController.js:612`: tách thành AI-13.
- Đưa bảng 6 mức vào prompt chấm (định nghĩa `overall`, kiểm tra "tôi" hay "chúng tôi", bài học, tình huống khó, câu lạc đề về 0), backtest trên AI-01 rồi bỏ công thức tạm: làm trong AI-02 bằng một PromptVersion mới.

## GĐ 2: Company và Rubric

**Cổng:** Admin tạo công ty và mời HR; HR nhận lời mời, sinh bộ câu nháp cho một vị trí, duyệt câu, soạn rubric và gửi duyệt; Platform Moderator duyệt rubric; Company Moderator công ty A không đọc được gì của công ty B.

Đi trước Profile, chạy song song với Learning Path. Áp dụng quyết định 7, 9, 11 và 14.

| Mã | REQ | Trạng thái | Task | Người | Cần xong trước | Xong khi | Mức |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CO-01 | A-02 | Done | Model `Company`; API admin tạo, sửa, tạm khóa, danh sách. Đổi `QuestionBank.orgId` từ `ref: "Organization"` sang `ref: "Company"` | Văn | N-04 | Công ty bị khóa thì Company Mod bị chặn vào; `populate("orgId")` chạy được | P0 |
| CO-02 | A-02 | Done | Model `CompanyInvite`; email có token (lưu hash, hết hạn 7 ngày); `accept` tạo tài khoản mới role `company_moderator`. Email đã có tài khoản role khác thì từ chối (quyết định 14) | Văn | CO-01, N-06 | Token dùng 1 lần; test hết hạn, dùng lại, email trùng | P0 |
| CO-03 | NEN (CM-01) | Done | Middleware `requireCompanyModerator` + lọc theo `companyId` cho mọi route `/api/company/*` | Văn | CO-02 | Test truy cập chéo công ty trả 403 cho từng route | P0 |
| CO-04 | CM-01 (+AIS-01) | Todo | `POST /api/company/questions/generate`: sinh 8–12 câu nháp theo `roleCategory` (SHRM/DDI), `orgId = companyId`, `source: org_template`, `status: draft` (quyết định 11) | Janet | CO-03 | Không trùng `textHash`; ghi `provenance.promptVersion`; câu không hiện ở trang câu hỏi của Platform Mod (đã lọc `orgId: null`) | P0 |
| CO-05 | CM-01 | Done | API company xem, duyệt, sửa, từ chối, tự thêm câu. **Dùng lại** `QuestionBank.status` (`draft`, `rejected` đã có) và `roleCategory` (đã có index); không thêm field mới | Văn | CO-04 | Sửa câu ghi vào `history`; test | P0 |
| CO-06 | AIS-04 | Todo | Pregen và cache video avatar cho câu công ty đã duyệt, giống câu baseline (mirror Cloudinary, 180 ngày). P0 vì user free luyện theo job sẽ tạo video D-ID riêng mỗi buổi | Janet | CO-05 | Buổi luyện theo job không gọi D-ID cho câu công ty đã có cache | P0 |
| CO-07 | CM-02 | Done | Model `CompanyRubric` (`roleCategory`, status `draft → pending_review → approved \| rejected`, `archived`); API soạn (tiêu chí, trọng số, `shrmKey`, mô tả thang 0–5, câu áp dụng), `submit` chuyển `pending_review`. **Không tạo ModerationItem**, để rubric không lọt vào hàng đợi HITL | Văn | CO-05 | Tổng trọng số bằng 100%; test; `/moderator/queue` không hiện rubric | P0 |
| CO-08 | PM-02 | Done | API Platform Mod: danh sách rubric `pending_review`, duyệt/từ chối kèm ghi chú; version mới được duyệt thì version cũ `archived` | Văn | CO-07 | Mỗi `roleCategory` của mỗi công ty chỉ có 1 rubric `approved` | P0 |
| CO-09 | PM-02 | Todo | AI gợi ý cho Platform Mod: tiêu chí map đúng SHRM chưa, mô tả thang có mơ hồ hay trùng lặp | Janet | CO-07 | Hiện cảnh báo trong màn duyệt rubric | P1 |
| CO-10 | A-02 | Done | FE admin `/admin/companies`, `/admin/companies/:id`, nút mời Company Moderator | Văn | CO-02 | Tạo công ty và mời được trên UI | P0 |
| CO-11 | A-02 | Done | FE trang nhận lời mời `/company-invite/:token` (đặt mật khẩu) | Nhi | CO-02 | Vào thẳng `/company` sau khi nhận | P0 |
| CO-12 | NEN (CM-01) | Done | FE layout `/company` (sidebar, loader theo role), dashboard tóm tắt; thêm nhánh `company_moderator` vào `roleHomeLoader` trong `routes.js` | Văn | CO-03 | Role khác bị đẩy ra; Company Mod vào `/` được chuyển về `/company` | P0 |
| CO-13 | CM-01 | Done | FE `/company/questions` dạng bảng: nút sinh bộ câu, lọc theo vị trí, duyệt, sửa, từ chối, thêm câu | Văn | CO-05, CO-12 | Thao tác hàng loạt được | P0 |
| CO-14 | CM-02 | Review · Nhi · PR #211 | FE `/company/rubrics` và trình soạn rubric (tiêu chí, trọng số, chọn SHRM, mô tả từng mức, gắn câu hỏi) | Nhi | CO-07, CO-12 | Gửi duyệt được, thấy lý do bị từ chối | P0 |
| CO-15 | PM-02 | Done | FE `/moderator/rubrics` dạng bảng: danh sách `pending_review`, xem chi tiết, duyệt/từ chối | Văn | CO-08 | Duyệt xong công ty thấy trạng thái mới | P0 |

## GĐ 3: Candidate Profile và kho CV

**Cổng:** ứng viên có 2 CV trong kho; file không phải CV bị từ chối; dán một JD thì hệ thống chỉ ra CV hợp nhất; trang hồ sơ hiện thẻ năng lực gộp từ phỏng vấn AI và kết quả mentor, mỗi điểm có nguồn; sửa CV và tải về PDF tiếng Việt đúng dấu.

Văn làm sau khi xong Company. Hiện chưa có model CV nào (chỉ có `CVAnalysis`).

| Mã | REQ | Trạng thái | Task | Người | Cần xong trước | Xong khi | Mức |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PR-01 | C-02 | Done | Model `CandidateProfile`; API `GET/PATCH /api/profile/me` (headline, vị trí mục tiêu, CV mặc định) | Văn | CO-03 | Profile tự tạo khi user vào lần đầu; test | P0 |
| PR-02 | C-02 | Done | Model mới `CVDocument` (tái dùng cách lưu file của `mentorshipDocumentsService`); API CRUD, `duplicate`, đặt mặc định, `version` | Văn | PR-01 | Một user có nhiều CV, đúng một CV mặc định | P0 |
| PR-03 | AIS-05 | Todo | Python `POST /validate`: kiểm tra file có phải CV (mục Kinh nghiệm, Học vấn, Kỹ năng, liên hệ; LLM phán khi không chắc) | Janet |  | Bộ 20 file mẫu (10 CV, 10 không phải) đúng ≥ 18 | P1 |
| PR-04 | AIS-05 | Done | Nối validate vào upload CV và phân tích CV/JD; lỗi tiếng Việt rõ ràng | Văn | PR-02, PR-03 | Upload ảnh hoặc hóa đơn bị từ chối | P1 |
| PR-05 | C-04 (+AIS-05) | Todo | Best-fit: Python chấm nhiều CV với một JD, trả xếp hạng và lý do; Node `POST /api/cv/best-fit` | Janet | PR-02 | 3 CV trả kết quả trong ≤ 60 giây | P1 |
| PR-06 | AIS-07 (+C-02) | Todo | Dịch vụ gộp hồ sơ năng lực: `competencyProfile` từng buổi phỏng vấn, kết quả buổi lộ trình, khóa học hoàn thành; cập nhật theo sự kiện; bỏ session `abandoned`. Gắn `competencyId` cố định cho 3 câu baseline trong `config/baselineQuestions.js`, kiểm `competency_id` câu follow-up bằng `isValidCompetencyKey` (đề xuất e); gộp theo `competencyId` từng câu, đổi `technical_mastery` ở câu fallback và seed (m); gỡ hệ A `/api/users/me/cvs`, `/api/users/me/verified-competencies` cùng service, `ProfileMultiCvVault.jsx`, `ProfileVerifiedCompetencies.jsx`, `candidateProfileApi.js` (k) | Janet | PR-01, LP-13, N-07 | Mỗi năng lực có level, số bằng chứng và danh sách nguồn | P0 |
| PR-07 | C-02 (+CM-04) | Done | API `GET /api/profile/me/competencies` và DTO rút gọn dùng cho Application snapshot | Văn | PR-06 | Đúng định dạng DTO, có test | P0 |
| PR-08 | C-04 | Todo | Trích nội dung PDF đã tải lên thành `content` JSON để mở trong editor | Janet | PR-02 | CV mẫu tách đúng các mục chính | P1 |
| PR-09 | C-04 | Done | Xuất PDF ở backend: `POST /api/cvs/:id/export-pdf` bằng `pdfkit` + font DejaVu đang dùng cho hóa đơn (`react-pdf` chỉ xem được, không tạo được PDF) | Văn | PR-02 | PDF mở được, tiếng Việt đúng dấu, 1 mẫu chuẩn ATS | P1 |
| PR-10 | C-02 | Review · Nhi · PR #214 | FE `/profile` viết lại: thông tin, vị trí mục tiêu, CV mặc định, thẻ năng lực "đã xác thực" bấm ra xem nguồn | Nhi | PR-01, PR-07 | Hiện đúng dữ liệu tài khoản seed | P0 |
| PR-11 | C-02 | Review · Nhi · PR #213 | FE `/cvs`: kho CV, tải lên, nhân bản, đặt mặc định, xóa | Nhi | PR-02 | Thao tác đủ 4 việc trên UI | P0 |
| PR-12 | C-04 | Todo | FE best-fit trong `CVAnalysisHub`: chọn nhiều CV, dán JD, xem xếp hạng và khoảng thiếu | Nhi | PR-05 | Chọn CV hợp nhất rồi sang phân tích chi tiết | P1 |
| PR-13 | C-04 | Todo | FE CV editor `/cvs/:id/edit`: sửa theo mục, áp gợi ý AI vào bullet, lưu version, nút tải PDF gọi PR-09 | Nhi | PR-09 | Sửa, lưu và tải được | P1 |

## GĐ 4: Job Post và Ứng tuyển

**Cổng:** Company Mod đăng job; ứng viên (kể cả gói free) xem job, thấy khoảng thiếu, luyện phỏng vấn theo job với câu công ty đã duyệt và được chấm thêm theo rubric, ứng tuyển kèm CV và đồng ý; Company Mod xem đơn, CV, hồ sơ, điểm rubric và shortlist; đơn đã rút không còn lộ snapshot.

Áp dụng quyết định 8, 9, 12 và 14.

| Mã | REQ | Trạng thái | Task | Người | Cần xong trước | Xong khi | Mức |
| --- | --- | --- | --- | --- | --- | --- | --- |
| JB-01 | CM-03 | Done | Model `JobPost`; API company tạo, sửa, `publish`, `close` (`roleCategory`, năng lực yêu cầu, kỹ năng, `rubricId` tùy chọn, `closesAt`) | Trầm | CO-03 | Chỉ gắn rubric `approved` của cùng công ty; test | P0 |
| JB-02 | CM-03 | Done | Tự đóng job quá `closesAt` (thêm vào job định kỳ có sẵn) | Trầm | JB-01 | Test với đồng hồ giả | P1 |
| JB-03 | C-05 | Done | API công khai `GET /api/jobs` (lọc vị trí, công ty, cấp độ) và `GET /api/jobs/:id` | Trầm | JB-01 | Không trả job `draft`, `closed`, `hidden` | P0 |
| JB-04 | PM-05 (+C-10, PM-03) | Todo | Báo cáo job: `Report.targetType` `job_post`; sửa `createItemForReport` (`moderationQueueService.js:39`) map sang type `job_post_report` thay vì `evaluation_report`; lọc hàng đợi HITL (`moderationQueueService.js:83`) chỉ lấy 3 loại cũ; API Platform Mod ẩn/hiện job | Trầm | JB-03 | Job bị ẩn biến mất khỏi danh sách công khai; `/moderator/queue` không hiện báo cáo job; test map đúng loại | P0 |
| JB-05 | C-05 | Todo | API khoảng thiếu `GET /api/jobs/:id/gap`: hồ sơ năng lực so với `requiredCompetencies`, CV mặc định so với `requiredSkills` | Janet | JB-03, PR-07 | Trả danh sách thiếu có mức độ và gợi ý bước tiếp | P0 |
| JB-06 | C-05 (+C-03, AIS-01) | Todo | Luyện theo job `POST /api/jobs/:id/practice` (quyết định 12): mọi gói; 3 câu baseline + 2 câu công ty đã duyệt theo `roleCategory`; Pro thêm 2 câu follow-up LLM từ mô tả job; trừ 1 lượt `interviewUsed`; session gắn `jobPostId`, `companyId`, `rubricId`. **Sửa 3 chỗ**: (1) `interviewsController.js:476` không trả `alreadyGenerated` chỉ vì đủ 5 câu, mà xét đã có câu follow-up hay chưa; (2) `questionsAllowed` cho buổi theo job là 5 (free) / 7 (Pro), không lấy theo quota thường; (3) logic kết thúc buổi ở `InterviewRoom` | Janet | JB-03, CO-05, CO-06 | Free đủ 5 câu, Pro đủ 7 câu; buổi thường không đổi hành vi; không dùng câu bị từ chối | P0 |
| JB-07 | AIS-02 (+C-03) | Todo | Chấm theo rubric công ty: mỗi câu có `rubricScores[]` {tiêu chí, điểm, trích dẫn bằng chứng} bên cạnh điểm SHRM/DDI; lưu để không chấm lại; ghi CostEvent `rubric_scoring` | Janet | JB-06, CO-08, AI-12 | Trích dẫn là câu có thật trong transcript; chạy trên bộ AI-01 | P0 |
| JB-08 | C-05 (+NFR-06) | Todo | Model `Application`; `POST /api/jobs/:id/apply` (cvId, `consent` bắt buộc, snapshot hồ sơ + điểm rubric buổi luyện gần nhất); `withdraw` ẩn snapshot, công ty chỉ còn thấy tên và "Đã rút"; `GET /api/applications/me` | Trầm | JB-03, PR-07, JB-07 | Không consent thì 400; mỗi job mỗi người 1 đơn | P0 |
| JB-09 | CM-04 | Todo | API company xem danh sách/chi tiết đơn, đổi trạng thái `viewed`/`shortlisted`/`rejected`, gửi Notification | Trầm | JB-08 | Chỉ đọc được dữ liệu qua đơn có consent và chưa rút | P0 |
| JB-10 | NFR-06 | Todo | Test integration: consent, rút đơn, truy cập chéo công ty, job bị ẩn | Trầm | JB-09 | Một file test riêng chạy xanh | P0 |
| JB-11 | C-05 | Todo | FE `/jobs`: danh sách, lọc, thẻ job | Nhi | JB-03 | Lọc đúng theo API | P0 |
| JB-12 | C-05 | Todo | FE `/jobs/:id`: mô tả, khoảng thiếu, nút Luyện theo job, Ứng tuyển (chọn CV + ô đồng ý), Báo cáo, gửi yêu cầu mentor gắn job (`jobPostId`, đề xuất i) | Nhi | JB-05, JB-06, JB-08 | Đi hết luồng trên UI | P0 |
| JB-13 | C-05 | Todo | FE `/my-applications`: trạng thái đơn, rút đơn | Nhi | JB-08 | Trạng thái đổi khi công ty xử lý | P0 |
| JB-14 | C-03 | Todo | FE trang feedback phỏng vấn: hiện điểm rubric công ty và trích dẫn khi buổi gắn job | Nhi | JB-07 | Buổi luyện tự do không hiện phần này | P0 |
| JB-15 | CM-03 | Todo | FE `/company/jobs` dạng bảng và form soạn job (năng lực, kỹ năng, chọn rubric, ngày đóng) | Trầm | JB-01, CO-12 | Đăng và đóng job trên UI | P0 |
| JB-16 | CM-04 | Todo | FE `/company/applications` và chi tiết đơn (xem CV, thẻ năng lực, câu trả lời kèm điểm rubric, shortlist/từ chối) | Nhi | JB-09, CO-12 | Shortlist xong ứng viên nhận thông báo | P0 |
| JB-17 | PM-05 | Todo | FE moderator: màn xử lý báo cáo job (loại `job_post_report`, tách khỏi hàng đợi phỏng vấn), nút ẩn/hiện | Văn | JB-04 | Xử lý được một báo cáo job trên UI | P0 |

## GĐ 5: Vòng AI và gợi ý

**Cổng:** sau ít nhất 5 lượt Platform Mod chấm lại, job tự tạo một đề xuất cải tiến có bằng chứng và bảng trước/sau; Platform Mod duyệt thì prompt mới chạy, rollback được; Quality Dashboard so sánh được theo version.

`promptVersion` đã được ghi ở `questions[]`, `feedback`, `QuestionBank.provenance` và `moderationQualityService` đang dùng, nên `PromptVersion` chỉ là bảng đăng ký. AI-01 và AI-12 làm sớm, ngay từ GĐ 0.

| Mã | REQ | Trạng thái | Task | Người | Cần xong trước | Xong khi | Mức |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AI-01 | AIS-02 (+AIS-06) | Todo | Bộ 20 câu trả lời chuẩn: cả nhóm chấm độc lập theo SHRM/DDI, Janet tổng hợp điểm chuẩn | Janet | LP-01 | File dữ liệu trong repo, có độ lệch giữa người chấm | P0 |
| AI-02 | AIS-06 (+PM-04) | Review · Janet · PR #205 | Model `PromptVersion` làm bảng đăng ký cho các chuỗi `promptVersion` đã có; seed version hiện tại; loader đọc prompt theo version `active`; không thêm field mới vào `InterviewSession` | Janet |  | Đổi version không cần deploy lại; chuỗi cũ vẫn khớp; đã chạy `db:sync-prompt-versions` trên staging và production, mỗi key có đúng một bản active | P0 |
| AI-03 | AIS-06 | Todo | Model `AIImprovementProposal`; `aiImprovementMinerJob` gom ModerationItem đã xử lý (`override_score`, sửa hoặc khai tử câu) theo ngưỡng cấu hình (mặc định 5); thêm `createVersion(key, { baseVersion, template, fewShotExamples })` vào `promptVersionService`, kiểm tên `<tiền tố>-vN` và `validateTemplate` như `activate()` (đề xuất h) | Janet | AI-02 | Test: đủ ngưỡng thì tạo đúng 1 đề xuất | P0 |
| AI-04 | AIS-06 | Todo | Backtest: chạy đề xuất trên AI-01 và 10 câu trả lời cũ, lưu điểm trước/sau vào đề xuất; backtest cần đổi phần chữ do `competencyFramework.js` sinh thì chuyển phần đó vào template PromptVersion (đề xuất g) | Janet | AI-01, AI-03 | Hiện được độ lệch so với điểm chuẩn | P0 |
| AI-05 | PM-04 | Todo | API Platform Mod duyệt, từ chối, rollback; duyệt thì bật PromptVersion mới | Janet | AI-04 | Rollback trả về version trước; test | P0 |
| AI-06 | PM-04 | Todo | FE `/moderator/ai-improvements` dạng bảng: bằng chứng, trước/sau, duyệt, từ chối, rollback | Văn | AI-05 | Duyệt được một đề xuất trên UI | P0 |
| AI-07 | PM-06 | Todo | Quality Dashboard thêm: rubric chờ duyệt, thời gian duyệt rubric, tỉ lệ bị sửa trước/sau mỗi lần đổi version (BE + FE) | Văn | AI-05, CO-08 | Số khớp truy vấn tay | P1 |
| AI-08 | AIS-08 | Todo | AI sàng lọc khóa học khi mentor gửi duyệt: đủ nội dung, video, mô tả, dấu hiệu vi phạm; ghi `Course.aiPrescreen` + ModerationItem `course_prescreen`; model rẻ; CostEvent `course_prescreen` | Janet | AI-12 | Mỗi khóa gửi duyệt có kết quả và cờ cụ thể | P1 |
| AI-09 | PM-05 | Todo | FE: nhãn sàng lọc trên `/moderator/courses`; mentor thấy cảnh báo trước khi gửi | Văn | AI-08 | Hiện đúng cờ từ API | P1 |
| AI-10 | AIS-07 (+C-09) | Todo | API `GET /api/recommendations/me`: khóa học, mentor (chuyên môn khớp năng lực còn thiếu, đánh giá), job (năng lực khớp yêu cầu); chấm theo luật có trọng số | Janet | PR-07, JB-03 | Mỗi gợi ý kèm một dòng lý do | P1 |
| AI-11 | C-09 | Todo | FE khối gợi ý trên `/dashboard` (mentor, khóa, job) | Nhi | AI-10 | Bấm vào được trang chi tiết | P1 |
| AI-12 | AIS-08 | Done | Thêm kind `rubric_scoring`, `course_prescreen` vào `CostEvent`; ngưỡng cảnh báo Slack cho hai loại | Janet |  | Lưu được CostEvent mới; làm trước JB-07 và AI-08 | P0 |
| AI-13 | AIS-02 (+C-03) | Todo | Bỏ fallback `shrmLevel = "proficient"` khi LLM trả giá trị lạ hoặc thiếu ở 4 chỗ: `interviewQuestionService.js:737`, `interviewsController.js:635` (đọc lại feedback đã cache), `frontend/src/app/utils/interview/feedbackModeration.js:42` và `:53`; thay bằng `""` và để FE hiện "Chưa đủ dữ liệu" | Janet |  | Câu thiếu `shrm_level` không còn hiện nhãn "Tốt"; test cả backend và FE | P1 |

## GĐ 6: Kiểm thử, đo NFR, tài liệu, demo

**Cổng:** chạy trọn kịch bản demo 7 bước trên **staging** với dữ liệu seed demo, không lỗi; production chỉ cần smoke test luồng chính; 4 NFR có số đo trong `docs/report/nfr-results.md`; SRS, SDD và hồ sơ Review nộp được.

| Mã | REQ | Trạng thái | Task | Người | Cần xong trước | Xong khi | Mức |
| --- | --- | --- | --- | --- | --- | --- | --- |
| QA-01 | NEN (NFR-04) | Done | Chế độ mock LLM, D-ID, ElevenLabs bằng biến môi trường để test tải không tốn tiền | Văn |  | Bật cờ thì không phát sinh CostEvent | P0 |
| QA-02 | NFR-04 | Done | Script k6 100 người dùng đồng thời (đăng nhập, xem mentor, xem job, tạo session, đặt lịch); nới rate limit riêng cho môi trường test; ghi p95 và tỉ lệ lỗi | Văn | QA-01 | Kết quả ghi vào `nfr-results.md` | P0 |
| QA-03 | NFR-01 (+NFR-02) | Done | Đo CV/JD ≤ 60 giây (30 CV) và avatar ≤ 130 giây (20 câu mới, 20 câu đã cache) từ log N-11; báo p50/p95 | Văn | N-11 | Kết quả ghi vào `nfr-results.md` | P0 |
| QA-04 | NFR-03 | Todo | Đo thời gian đối soát SePay trên 20 giao dịch (webhook đến → Payment `success`) | Trầm | LP-10 | Kết quả ghi vào `nfr-results.md` | P0 |
| QA-05 | AIS-06 (+A-02, CM-01, CM-02, CM-03, C-05, C-07, CM-04) | Done | Seed dữ liệu demo cho **staging**: 2 công ty, 3 job, rubric đã duyệt, 3 mentor, ứng viên có lịch sử phỏng vấn và lộ trình, **ít nhất 5 lượt chấm lại** để miner đủ ngưỡng. Giữ `_devOnlyGuard.js` (chặn production) | Văn | JB-09, LP-13, AI-03 | Một lệnh ra đủ dữ liệu kịch bản demo trên staging | P0 |
| QA-06 | C-07 (+A-02, CM-01, CM-02, PM-02, C-05, C-03, CM-04, PM-03, PM-04) | Todo | Kiểm thử thủ công trên staging theo kịch bản demo 7 bước và theo từng vai trò; ghi lỗi vào issue có mã task | Nhi | QA-05 | Không còn lỗi chặn luồng | P0 |
| QA-07 | C-02 (+C-04, C-05, C-07, CM-01, CM-02, CM-03, CM-04) | Todo | Kiểm tra responsive và sửa lỗi giao diện các màn hình mới | Nhi | QA-06 | Mọi màn hình mới dùng được ở bề ngang điện thoại | P1 |
| DOC-01 | C-01..AIS-08 | Todo | SRS: bảng ánh xạ 39 chức năng ↔ use case ↔ màn hình ↔ API; bảng tên role; mục "Chức năng bổ trợ" (giỏ hàng, coupon, gói Pro) | Janet |  | Mọi dòng trong đơn V2 có use case | P0 |
| DOC-02 | C-07 (+C-05, NFR-06) | Todo | SDD và sequence diagram: Learning Path (có chia tiền và chặn luồng hủy cũ), Job Post, Ứng tuyển | Trầm | LP-17, JB-10 | Sequence khớp code | P0 |
| DOC-03 | A-02 (+CM-01, CM-02, PM-02, C-02) | Done | SDD và sequence diagram: Company, lời mời, duyệt câu, Rubric, Profile và kho CV | Văn | CO-08, PR-07 | Sequence khớp code | P0 |
| DOC-04 | AIS-02 (+AIS-06, AIS-07, AIS-08) | Todo | SDD và sequence diagram: chấm rubric, Learning from Reviews, hồ sơ năng lực, sàng lọc khóa | Janet | JB-07, AI-05 | Sequence khớp code | P0 |
| DOC-05 | NEN (*) | Todo | Hồ sơ Review BM01 Design Brief, BM02 Self-Review, BM03 Record of Changes, BM04 Commitment | Janet |  | Nộp đủ 4 biểu mẫu | P0 |
| DOC-06 | C-01..CM-04 | Todo | Hướng dẫn sử dụng theo 5 vai trò, có ảnh chụp | Nhi | QA-06 | Mỗi vai trò có luồng chính | P1 |
| DOC-07 | C-07 (+A-02, CM-01, CM-02, PM-02, C-05, C-03, CM-04, PM-03, PM-04) | Todo | Kịch bản demo chi tiết trên staging (tài khoản, thứ tự thao tác, phương án dự phòng khi D-ID lỗi) và slide bảo vệ | Janet | QA-06 | Cả nhóm chạy thử trọn vẹn một lần | P0 |

## Kịch bản demo xuyên suốt (P0)

1. Admin tạo công ty và mời Company Mod.
2. Company Mod duyệt câu hỏi, soạn rubric; Platform Mod duyệt rubric; Company Mod đăng job.
3. Ứng viên có 2 CV, xem job, thấy khoảng thiếu, luyện phỏng vấn theo job, được chấm theo SHRM/DDI và rubric công ty.
4. Ứng viên gửi yêu cầu mentor gắn job; buổi đánh giá 0đ; mentor gửi lộ trình 3 buổi; ứng viên chuyển khoản, SePay xác nhận.
5. Buổi 2 "không đạt" → buổi học lại → "đạt"; hồ sơ năng lực cập nhật.
6. Ứng viên ứng tuyển kèm consent; Company Mod xem CV, hồ sơ, điểm rubric và shortlist.
7. Ứng viên báo sai điểm; Platform Mod chấm lại; cải tiến AI được đề xuất và duyệt.

---

## Đề xuất thay đổi kế hoạch

> Agent ghi vào đây khi thấy mô tả task sai so với code. Không tự sửa phạm vi task. Janet duyệt rồi mới sửa bảng ở trên.

Loại: `bat-buoc`, `chi-tiet`, `ngoai-don`, `no-ky-thuat` (xem `START_HERE.md` mục "Luật task phát sinh"). Các dòng (a)–(m) chuyển từ `docs/capstone/TASKS.md` ngày 22/11/2026; (d) trùng với dòng AI-13 nên gộp vào đó.

| Ngày | Task gốc | REQ | Loại | Vấn đề tìm thấy | Đề xuất | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- |
| 18/11/2026 | LP-03 | M-04 | chi-tiet | (a) `LearningPathSession` chỉ có `shrmKeys` và `feedback {summary, strengths, improvements}`, nên mentor chưa lưu được điểm từng năng lực để `suggestOutcome` dùng | Thêm `feedback.scores[] {shrmKey, score, note}` (mức 0–5 hoặc `null`) và `frameworkVersion` (lấy `version` của `competencies.json`) vào `LearningPathSession`. Đề xuất từ LP-01 | Đã duyệt 22/11/2026: ghi vào LP-13 |
| 18/11/2026 | LP-21 | M-02 | chi-tiet | (b) Chưa rõ kết quả buổi đánh giá 0đ lưu ở đâu (buổi 0đ là Booking `assessment`, không phải `LearningPathSession`) | `LearningPath.assessment.scores[] {shrmKey, score, note}` + `frameworkVersion`. Đề xuất từ LP-01 | Đã duyệt 22/11/2026: ghi vào LP-13, LP-21 |
| 18/11/2026 | AI-01 | AIS-02 (+AIS-06) | chi-tiet | (c) Bộ câu chuẩn cần chấm theo thang 6 mức và `aiCalibration` của LP-01 | Thêm LP-01 vào cột "Cần xong trước" của AI-01; kết quả AI-01 dùng để chỉnh `offset`/`maxLevel` và đổi `status` khỏi `provisional` | Đã duyệt 22/11/2026: AI-01 cần LP-01 |
| 18/11/2026 | PR-06 | AIS-07 (+C-02) | chi-tiet | (e) 3 câu baseline (`config/baselineQuestions.js`) không có `competencyId`, nên buổi của user free không có câu nào gắn key năng lực; câu follow-up lấy `competency_id` từ LLM mà không kiểm tra với bộ tiêu chí; `moderatorOverride` và `evaluationIncomplete` nằm trên `answers[i]`, không nằm trên `perQuestion` | PR-06 chốt cách gán key cho câu baseline (gắn key cố định trong config, hoặc bỏ qua) | Đã duyệt 22/11/2026: gắn key cố định, ghi vào PR-06 |
| 19/11/2026 | LP-07, LP-20 | M-03 | bat-buoc | (f) Danh sách năng lực tạm của LP-20 có 6 key không nằm trong bộ tiêu chí LP-01; backend LP-07 chỉ kiểm bằng regex | Đã sửa ở PR #204: backend kiểm bằng `isValidCompetencyKey`, FE đọc `GET /api/competencies`, script `db:migrate-lp-shrm-keys` đổi key cũ. Còn phải chạy script trên production (bản `:dry` trước) | Đã làm, chờ chạy script production |
| 19/11/2026 | AI-02 | AIS-06 | no-ky-thuat | (g) Chữ do `buildCompetencyPromptBlock` / `buildDistributionGuide` (`competencyFramework.js`) sinh ra vẫn nằm trong code, chưa vào template PromptVersion | Làm cùng AI-02 phase sau hoặc trong AI-04 nếu backtest cần đổi phần này. Tạm thời nội dung prompt = PromptVersion + `version` của `competencies.json` | Đã duyệt 22/11/2026: ghi vào AI-04 |
| 19/11/2026 | AI-05 | PM-04 (+AIS-06) | bat-buoc | (h) AI-02 chỉ có `activate()`, chưa có hàm tạo version mới | AI-05 (hoặc AI-03 khi tạo đề xuất) thêm `createVersion(key, { baseVersion, template, fewShotExamples })`, kiểm tên `<tiền tố>-vN` và `validateTemplate` như `activate()` | Đã duyệt 22/11/2026: làm trong AI-03, ghi vào AI-03 |
| 19/11/2026 | LP-18 | C-06 | chi-tiet | (i) Ô "chọn tin tuyển dụng" trong form yêu cầu mentor chưa làm vì chưa có Job Post; API `/api/mentorship-requests` đã nhận `jobPostId` tùy chọn (LP-05) | Chuyển phần này sang JB-12 (trang `/jobs/:id` có nút gửi yêu cầu mentor gắn job); LP-18 chỉ còn trang `/learning-paths` | Đã duyệt 22/11/2026: ghi vào LP-18, JB-12 |
| 21/11/2026 | N-03, CO-14, N-01, N-08 | NEN (CM-01) (+CM-02, C-01, A-05) | bat-buoc | (j) Sau khi merge PR #210 (nhánh `viet-van`): N-03 chưa chạy `npm run db:migrate-enterprise-role` trên production; CO-14 chưa đối chiếu đủ tiêu chí; N-01 và N-08 chưa thấy trong code dù commit ghi tên | Giữ N-03 ở `Review` tới khi chạy script; N-01, N-08 giữ `Todo` | Đã ghi nhận trong cột Trạng thái |
| 21/11/2026 | PR-06, PR-07, PR-10 | AIS-07 (+C-02) | bat-buoc | (k) Có 2 hệ thống CV + năng lực song song từ PR #210: (A) `/api/users/me/cvs` + `/api/users/me/verified-competencies`, trong đó `syncVerifiedCompetencies` với `sampleIfEmpty` tự sinh điểm "đã xác thực" 84–88 khi chưa có dữ liệu; (B) `CVDocument` `/api/cvs` + `CandidateProfile` `/api/profile/me*`. PR-07 đang gộp tạm: mọi buổi AI cộng vào `technical_mastery` (không thuộc LP-01), mọi buổi mentor cộng vào `problem_solving` | Gỡ route + service + component của (A) sau khi nhóm xác nhận không còn nơi dùng; PR-06 thay phần gộp tạm bằng gộp theo `competencyId` từng câu và bộ tiêu chí LP-01 | Đã duyệt 22/11/2026: gỡ hệ A trong PR-06 (FE không còn trang nào import) |
| 22/11/2026 | JB-01, JB-06, CO-04 | CM-03 (+CM-01, CM-02, C-05) | bat-buoc | (l) Chưa có danh sách `roleCategory` chung giữa phỏng vấn AI, câu hỏi công ty, rubric và job | Một danh sách `roleCategory` trong `config/`, BE đọc trực tiếp, FE qua API | Đã làm 22/11/2026 (nhánh JB-03): `config/roleCategories.json`, `GET /api/role-categories` |
| 22/11/2026 | PR-06 | AIS-07 | bat-buoc | (m) Key `technical_mastery` (không có trong LP-01) còn ở câu fallback `interviewQuestionService.js:248` và seed `CandidateProfile` (`scripts/seedStagingDemo.js`) | PR-06 đổi hai chỗ này cùng lúc bỏ danh sách 6 key tự đặt trong `candidateProfileService.js` | Đã duyệt 22/11/2026: ghi vào PR-06 |
| 22/11/2026 | AI-13 (từ `docs/capstone/TASKS.md`, gộp (d)) | AIS-02 (+C-03) | chi-tiet | Khi LLM trả `shrm_level` lạ hoặc thiếu, hệ thống gán `"proficient"`, nên câu thiếu dữ liệu vẫn hiện nhãn "Tốt". Còn ở 4 chỗ trên `main`: `interviewQuestionService.js:737`, `interviewsController.js:635`, `frontend/src/app/utils/interview/feedbackModeration.js:42` và `:53` | Thêm task AI-13 (Janet, P1) | Đã duyệt 22/11/2026: thêm AI-13 vào GĐ 5 |
| 22/11/2026 | LP-07, LP-20 | M-03 | chi-tiet | Đơn ghi "based on the candidate's profile and target job post", nhưng trình soạn lộ trình chưa lấy năng lực còn thiếu từ hồ sơ và `requiredCompetencies` của job làm khung (quyết định 5) | Thêm task LP-23 (Nhi, P1): hiện năng lực còn thiếu từ hồ sơ (PR-07) và `requiredCompetencies` của job (JB-01) để gợi ý buổi; mentor vẫn sửa tự do | Đã duyệt 22/11/2026: thêm LP-23 vào GĐ 1 |
| 22/11/2026 | CO-05, PR-04, PR-07, QA-03, QA-05 | CM-01, AIS-05, C-02 (+CM-04), NFR-01 (+NFR-02), AIS-06 | bat-buoc | Khi đồng bộ trạng thái từ `docs/capstone/TASKS.md`, 5 task là `Done` trong khi task ở cột "Cần xong trước" chưa `Done`: CO-05 (CO-04), PR-04 (PR-03), PR-07 (PR-06), QA-03 (N-11), QA-05 (JB-09, LP-13, AI-03) | Kiểm lại 5 task bằng Prompt B; chưa đạt "Xong khi" thì đổi về `Doing` và ghi lý do vào "Ghi chú Blocked" | Chờ Prompt B |

## Hướng phát triển

> Việc loại `ngoai-don` (không chỉ ra được REQ nào), hoặc P1 tự chuyển ra khi tới mốc mà cổng chưa qua. Không làm trong capstone.

| Ngày | Nguồn (task) | Ý tưởng | Lý do không làm trong capstone |
| --- | --- | --- | --- |

## Ghi chú Blocked

| Task | Lý do | Cần ai gỡ |
| --- | --- | --- |

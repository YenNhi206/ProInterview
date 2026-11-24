# ProInterview: Kế hoạch task (nguồn đúng duy nhất)

> Mọi task gắn mã REQ trong `docs/plan/REQUIREMENTS.md` (cột REQ, ít nhất một mã).
> Phiên bản: 22/11/2026 (bản 18/11/2026 đã đối chiếu mã nguồn 2 lần; 22/11 đồng bộ trạng thái từ `docs/capstone/TASKS.md` và thêm cột REQ; 23/11 duyệt đề xuất (u)–(z): thêm JB-19, JB-20, JB-21, CO-16; duyệt (aa): thêm AI-18). 119 task, 7 giai đoạn, không gắn ngày.
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
- **Nhóm làm việc**: phần AI do Janet làm trọn, không chia cho người khác. Văn và Nhi làm cặp (Company, Profile, CV, giao diện job và ứng tuyển). Trầm làm riêng (Learning Path, Job Post, Ứng tuyển, thanh toán). Task của Janet và Trầm không giao cho Văn.
- **Review chéo**: Văn và Nhi review chéo nhau; Trầm và Janet review chéo nhau (BE của Trầm do Janet review, AI do Trầm review). Janet merge.
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
| Trầm | Backend | Index Booking, Learning Path, chặn luồng hủy cũ, chia tiền và đường ray thanh toán lộ trình, enum Notification, doanh thu theo nguồn, trạng thái CVAnalysis, Job Post, Ứng tuyển, job xem gần đây, đo SePay; FE `/company/jobs`, xác nhận tay lộ trình, màn moderator xử lý báo cáo job | 31 | 3 | 0 | 34 |
| Văn | Backend + Frontend (cặp với Nhi) | Đổi role và migrate, Node 22 + test glob, Company, lời mời, phân quyền, Rubric, Profile, kho CV, xuất PDF, test tải, đo CV/avatar, seed demo; FE admin công ty, `/company` layout + câu hỏi, moderator rubric, Platform Mod duyệt câu doanh nghiệp, nhãn vai trò, `/jobs`, `/company/applications`, CV editor, responsive | 25 | 5 | 1 | 31 |
| Nhi | Frontend (cặp với Văn) | Luồng ứng viên và mentor (lộ trình, hồ sơ, CV, job, ứng tuyển, chọn job trước phòng phỏng vấn), trang nhận lời mời, trình soạn rubric, gỡ số liệu giả, HITL bước 7, kiểm thử thủ công | 14 | 4 | 0 | 18 |
| Janet | Lead, AI | Tiêu chí SHRM/DDI, sinh câu và cache video câu công ty, CV validate và best-fit, hồ sơ năng lực, khoảng thiếu, chèn câu doanh nghiệp vào phỏng vấn AI, chấm rubric, chỉ số theo doanh nghiệp, vòng cải tiến AI (kể cả ví dụ neo từ rubric công ty), sàng lọc khóa, gợi ý, chuyển video avatar D-ID sang ElevenLabs và đo lại, toàn bộ màn hình AI (duyệt cải tiến AI, Quality Dashboard, nhãn sàng lọc khóa, khối gợi ý), SRS/SDD, hồ sơ Review, merge | 23 | 13 | 0 | 36 |
| **Cộng** | | | **93** | **25** | **1** | **119** |

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
| N-08 | A-05 | Review · Trầm · PR #240 | Bổ sung doanh thu theo nguồn (booking, khóa, gói, lộ trình) vào API analytics admin. Các API khác đã có: `/analytics/user-behavior`, `/analytics/users/:id/journey`, `/users/:id`, content stats. **Đã làm (Trầm, nhánh `feat/N-08-revenue-by-source`):** `GET /api/admin/analytics/revenue?days=` / `?month=` (`services/revenueAnalyticsService.js`), chuỗi theo ngày giờ VN, `adminApi.getRevenueBySource` cho N-09; test đối chiếu từng nguồn với aggregate viết tay | Trầm |  | Số khớp truy vấn tay trên DB | P0 |
| N-09 | A-05 (+A-01) | Done | FE gỡ lớp bơm số liệu giả ở **5 file**: `AdminAnalytics.jsx`, `AdminUsers.jsx`, `AdminUserDetail` + `AdminContentQuestions` (trong `AdminPlaceholders.jsx`), `components/admin/UserJourneyPanel.jsx` (`ensureRichJourney`); dùng số thật từ API. Sau đó xóa `utils/analytics/mock*.js` | Nhi | N-08 | Không còn số cứng hay số sinh ngẫu nhiên trong 5 file | P0 |
| N-10 | C-10 (+PM-03) | Done | FE HITL bước 7: nút "Báo sai", nhãn "Đang chờ kiểm định", ưu tiên `moderatorOverride.overall` trên `InterviewFeedback.jsx` | Nhi |  | Báo sai tạo được ModerationItem; điểm moderator hiện thay điểm AI | P0 |
| N-11 | NFR-01 (+NFR-02, AIS-05) | Review · Trầm · PR #241 | `cvMatch.js` tạo bản ghi `CVAnalysis` với status `processing` trước khi gọi Python, ghi `failed` hoặc kết quả + `durationMs` sau; FE cập nhật bản ghi đó thay vì tạo mới. Log `durationMs` từng bước pipeline avatar (TTS, D-ID, mirror). **Đã làm (Trầm, nhánh `feat/N-11-cv-analysis-status`):** `cvAnalysisRunService.js` mở/đóng bản ghi, chuỗi suggestions → full → basic và lưu của FE dùng chung `analysisId`, lịch sử và thống kê bỏ `processing`/`failed`; log `cv_analysis_timing` và `avatar_video_timing` (TTS, D-ID tạo, D-ID render, mirror). Còn: xem log trên Render sau khi deploy | Trầm |  | Mỗi lần phân tích chỉ có 1 bản ghi; lỗi hiện `failed`; có log thời gian trên Render | P0 |
| N-12 | NEN (*) | Done | Sửa các chỗ lệch trong `CLAUDE.md` (router, thư mục `api/`, danh sách model, trạng thái FE); thêm quy ước tên role, mã task, các bẫy | Janet | N-02 | Thành viên mới đọc không bị dẫn sai | P1 |
| N-13 | A-01 (+CM-01, PM-01) | Done | Nhãn UI theo tên trong đơn: Candidate, Platform Moderator, Company Moderator | Văn | N-02 | Không còn chữ "customer" hay "enterprise" (role) trên giao diện | P1 |
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
| LP-06 | C-06 (+M-02) | Review · Trầm · PR #244 | Giới hạn buổi 0đ theo quyết định 13 (1 buổi chưa xong cùng lúc, 2 buổi/30 ngày; ứng viên vắng tính đã dùng, mentor vắng không tính). **Đã làm (Trầm, nhánh `feat/LP-06-assessment-limits`):** `utils/assessmentLimits.js` (hàm thuần) + kiểm trong `acceptAssessment` trước và sau khi tạo buổi (chặn hai mentor hẹn cùng lúc); test unit + integration đủ 4 trường hợp, thêm hủy không tính và hẹn đồng thời. Cách hiểu chỗ quyết định chưa nói ở đề xuất (ac) | Trầm | LP-05, LP-22 | Test đủ 4 trường hợp | P0 |
| LP-07 | M-03 | Done | API mentor: tạo/sửa bản nháp, `propose` (≥ 1 buổi, có giá, buổi 0đ đã `completed`) | Trầm | LP-05 | `draft → proposed` có test, kể cả trường hợp bị chặn | P0 |
| LP-08 | C-07 | Done | API ứng viên: xem, `accept`, `request-revision` kèm ghi chú; `version` tăng mỗi lần gửi lại | Trầm | LP-07 | Vòng sửa → gửi lại → chấp nhận có test | P0 |
| LP-09 | C-07 (+M-06) | Done | Hàm chia tiền trong `utils/`: T → `shareAmount` từng buổi (chia đều phần nguyên, buổi cuối nhận phần dư), `platformFee` từng buổi, học lại = 0; hàm tính tiền hoàn | Trầm | LP-03 | Unit test: tổng luôn bằng T với T không chia hết | P0 |
| LP-10 | C-07 (+A-04, NFR-03) | Done | Đường ray chuyển khoản cho lộ trình: `Payment.type` `learning_path`; `paymentRef` sinh bằng `utils/orderRef.js` (mã `PI…` để `parsePiOrderFromText` nhận ra); target mới trong `sepayWebhookService.findPendingTargets` + hàm xác nhận; `SepayWebhookEvent.entityType`; hết hạn qua `transferPaymentExpiryService`; path sang `active` | Trầm | LP-08, LP-09 | Test: đúng tiền, sai tiền, webhook gửi lại 2 lần, hết hạn | P0 |
| LP-11 | A-04 | Done | Xác nhận tay chuyển khoản lộ trình: thêm loại `learning_path` vào trang đối soát admin có sẵn (BE + FE) | Trầm | LP-10 | Admin xác nhận được trên UI | P0 |
| LP-12 | C-07 | Done | Đặt lịch từng buổi: tạo Booking gắn session theo LP-04, chỉ mở khi buổi trước `passed` | Trầm | LP-10 | Không đặt được buổi 3 khi buổi 2 chưa đạt | P0 |
| LP-13 | M-04 | Done | Ghi kết quả: `passed`/`not_passed` + feedback theo LP-01; `not_passed` lần đầu tạo buổi `retakeOf` 0đ, lần 2 trở đi mentor đề xuất buổi bổ sung có phí; buổi cuối đạt thì path `completed`. Lưu điểm từng năng lực ở `LearningPathSession.feedback.scores[] {shrmKey, score (0–5 hoặc null), note}` + `frameworkVersion` (đề xuất a); kết quả buổi 0đ ở `LearningPath.assessment.scores[]` + `frameworkVersion` (đề xuất b). **Đã làm (Trầm, nhánh `feat/LP-13-LP-19-LP-21-learning-path-outcome-ui`):** ghi kết quả, học lại 0đ, buổi bổ sung có phí (`pending_payment`), hoàn thành lộ trình, `feedback.scores` (đề xuất a), 3 nhánh + 65 tình huống có test. **Chưa làm:** lưu điểm buổi 0đ `LearningPath.assessment` (đề xuất b). | Trầm | LP-01, LP-12 | Đủ nhánh đạt, không đạt lần 1, lần 2 có test | P0 |
| LP-14 | M-06 | Review · Trầm · PR #243 | Thu nhập mentor qua `tryCreditMentorForCompletedBooking` / `mentorNetFromBooking` (`totalAmount − platformFee`) với booking ghi theo LP-04. **Đã làm (Trầm, nhánh `feat/LP-14-learning-path-earnings`):** test đầu-cuối `learningPathEarnings.integration.test.js` qua API thật (`PATCH /api/bookings/:id/complete`): buổi 0đ và học lại nhận 0, mỗi buổi gốc nhận `share − platformFee`, tổng = T − phí, đối soát khớp, `releaseEligibleEarnings` chuyển đúng và không trùng. Luồng có sẵn đã đúng nhờ LP-04 ghi sẵn tiền, không phải sửa code | Trầm | LP-13 | Mentor nhận đúng `share − platformFee` mỗi buổi, 0 cho buổi 0đ và học lại; `earningsClearanceJob` chuyển đúng | P0 |
| LP-15 | A-04 | Todo | Hủy lộ trình: hoàn = T − tổng phần chia các buổi đã `done`, qua luồng refund có sẵn | Trầm | LP-14, LP-22 | Test hủy sau buổi 1 và sau buổi học lại; không hoàn trùng | P1 |
| LP-16 | A-05 | Todo | Doanh thu lộ trình trong báo cáo tài chính admin; thu nhập mentor hiện theo lộ trình (đóng mục 16 và 21) | Trầm | LP-14 | Số khớp tổng Payment `learning_path`, không cộng thêm booking `paymentMethod: learning_path` | P0 |
| LP-17 | C-07 (+M-04, M-06) | Todo | Test integration trọn luồng từ yêu cầu đến `completed` | Trầm | LP-14 | Một file test chạy cả luồng | P0 |
| LP-18 | C-06 (+C-07) | Done | FE ứng viên: trang `/learning-paths` (ô chọn job trong form yêu cầu mentor chuyển sang JB-12, đề xuất i) | Nhi | LP-05 | Danh sách hiện đúng trạng thái từ API | P0 |
| LP-19 | C-07 | Done | FE ứng viên: `/learning-paths/:id` dạng timeline, chấp nhận / yêu cầu sửa, thanh toán (dùng lại `/checkout`), đặt lịch buổi, xem đạt/học lại và feedback. **Đã làm (Trầm):** chấp nhận / yêu cầu sửa, thanh toán QR + tự cập nhật khi tiền về, timeline, đặt lịch theo giờ rảnh mentor, xem nhận xét. Thanh toán buổi bổ sung chờ đề xuất (s). | Trầm | LP-08, LP-10 | Đi hết luồng trên UI không cần Postman | P0 |
| LP-20 | M-03 | Done | FE mentor: `/mentor/learning-paths` và trình soạn (thêm, sắp xếp buổi, mục tiêu, năng lực SHRM, giá trọn gói, xem hồ sơ ứng viên) | Nhi | LP-07 | Soạn và gửi được lộ trình 3 buổi | P0 |
| LP-21 | M-04 (+M-02) | Done | FE mentor: form đánh giá đầu vào (buổi 0đ) và form đạt/không đạt + feedback, gắn vào trang có sẵn `/mentor/session-feedback/:sessionId`; chấm điểm từng năng lực, lưu vào field của đề xuất (a), (b). **Đã làm (Trầm):** form đạt / chưa đạt + nhận xét + điểm năng lực, nút kết thúc buổi, đề xuất buổi bổ sung, tiến độ trong trình soạn. **Chưa làm:** form đánh giá đầu vào buổi 0đ (chờ phần đề xuất b của LP-13). | Trầm | LP-01, LP-13 | Ghi kết quả xong thì timeline ứng viên cập nhật | P0 |
| LP-23 | M-03 | Done | Trình soạn lộ trình hiện năng lực còn thiếu từ hồ sơ ứng viên (PR-07) và `requiredCompetencies` của job nếu yêu cầu có job (JB-01) để gợi ý buổi; mentor vẫn sửa tự do (quyết định 5) | Nhi | LP-20, PR-07, JB-01 | Soạn lộ trình cho một yêu cầu có job thì thấy danh sách năng lực gợi ý lấy từ hồ sơ và job | P1 |

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

**Cổng:** Admin tạo công ty và mời HR; HR nhận lời mời, sinh bộ câu nháp cho một vị trí, duyệt câu, soạn rubric và gửi duyệt; Platform Moderator duyệt câu doanh nghiệp và rubric; Company Moderator công ty A không đọc được gì của công ty B.

Đi trước Profile, chạy song song với Learning Path. Áp dụng quyết định 7, 9, 11 và 14.

| Mã | REQ | Trạng thái | Task | Người | Cần xong trước | Xong khi | Mức |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CO-01 | A-02 | Done | Model `Company`; API admin tạo, sửa, tạm khóa, danh sách. Đổi `QuestionBank.orgId` từ `ref: "Organization"` sang `ref: "Company"` | Văn | N-04 | Công ty bị khóa thì Company Mod bị chặn vào; `populate("orgId")` chạy được | P0 |
| CO-02 | A-02 (+AIS-06) | Done | Đã xong: model `CompanyInvite`; email có token (lưu hash, hết hạn 7 ngày); `accept` tạo tài khoản mới role `company_moderator`. Email đã có tài khoản role khác thì từ chối (quyết định 14). **Bổ sung 23/11/2026 (đề xuất aa)**: khi nhận lời mời, công ty đồng ý điều khoản cho phép dùng rubric đã duyệt ở dạng ẩn danh để cải tiến chuẩn chấm chung; lưu thời điểm đồng ý | Văn | CO-01, N-06 | Token dùng 1 lần; test hết hạn, dùng lại, email trùng; không đồng ý điều khoản thì không nhận lời mời được; thời điểm đồng ý được lưu | P0 |
| CO-03 | NEN (CM-01) | Done | Middleware `requireCompanyModerator` + lọc theo `companyId` cho mọi route `/api/company/*` | Văn | CO-02 | Test truy cập chéo công ty trả 403 cho từng route | P0 |
| CO-04 | CM-01 (+AIS-01) | Done | `POST /api/company/questions/generate`: sinh 8–12 câu nháp theo `roleCategory` (SHRM/DDI), `orgId = companyId`, `source: org_template`, `status: draft` (quyết định 11) | Janet | CO-03 | Không trùng `textHash`; ghi `provenance.promptVersion` (bỏ điều kiện "không hiện ở trang của Platform Mod" theo đề xuất z) | P0 |
| CO-05 | CM-01 | Done | Đã xong: API company xem, duyệt, sửa, từ chối, tự thêm câu, dùng lại `QuestionBank.status` và `roleCategory`. **Bổ sung 23/11/2026 (đề xuất z)**: câu doanh nghiệp có `jobPostId`; API tải câu lên hàng loạt theo job; doanh nghiệp duyệt xong thì chuyển `pending_platform_review` thay cho `approved` (quyết định CO-16) | Văn | CO-04 | Sửa câu ghi vào `history`; tải lên hàng loạt bỏ câu trùng `textHash`; câu doanh nghiệp duyệt xong ở `pending_platform_review`; test | P0 |
| CO-06 | AIS-04 | Done | Pregen và cache video avatar cho câu công ty đã duyệt, giống câu baseline (mirror Cloudinary, 180 ngày). P0 vì câu doanh nghiệp được chèn vào phỏng vấn AI ở mọi gói (quyết định JB-06 ngày 23/11/2026), mỗi buổi sẽ tạo video avatar riêng nếu không cache. Dùng provider video đang chạy (`AVATAR_PROVIDER`, ElevenLabs sau AI-15) | Janet | CO-05 | Buổi có câu doanh nghiệp không gọi provider video cho câu đã có cache | P0 |
| CO-07 | CM-02 | Done | Model `CompanyRubric` (`roleCategory`, status `draft → pending_review → approved \| rejected`, `archived`); API soạn (tiêu chí, trọng số, `shrmKey`, mô tả thang 0–5, câu áp dụng), `submit` chuyển `pending_review`. **Không tạo ModerationItem**, để rubric không lọt vào hàng đợi HITL | Văn | CO-05 | Tổng trọng số bằng 100%; test; `/moderator/queue` không hiện rubric | P0 |
| CO-08 | PM-02 | Done | API Platform Mod: danh sách rubric `pending_review`, duyệt/từ chối kèm ghi chú; version mới được duyệt thì version cũ `archived` | Văn | CO-07 | Mỗi `roleCategory` của mỗi công ty chỉ có 1 rubric `approved` | P0 |
| CO-09 | PM-02 | Todo | AI gợi ý cho Platform Mod: tiêu chí map đúng SHRM chưa, mô tả thang có mơ hồ hay trùng lặp | Janet | CO-07 | Hiện cảnh báo trong màn duyệt rubric | P1 |
| CO-10 | A-02 | Done | FE admin `/admin/companies`, `/admin/companies/:id`, nút mời Company Moderator | Văn | CO-02 | Tạo công ty và mời được trên UI | P0 |
| CO-11 | A-02 | Done | FE trang nhận lời mời `/company-invite/:token` (đặt mật khẩu) | Nhi | CO-02 | Vào thẳng `/company` sau khi nhận | P0 |
| CO-12 | NEN (CM-01) | Done | FE layout `/company` (sidebar, loader theo role), dashboard tóm tắt; thêm nhánh `company_moderator` vào `roleHomeLoader` trong `routes.js` | Văn | CO-03 | Role khác bị đẩy ra; Company Mod vào `/` được chuyển về `/company` | P0 |
| CO-13 | CM-01 | Done | Đã xong: FE `/company/questions` dạng bảng, nút sinh bộ câu, lọc theo vị trí, duyệt, sửa, từ chối, thêm câu. **Bổ sung 23/11/2026 (đề xuất z)**: nút tải câu lên theo job, lọc theo job, hiện trạng thái chờ Platform Mod duyệt | Văn | CO-05, CO-12 | Thao tác hàng loạt được; tải lên được bộ câu cho một job | P0 |
| CO-14 | CM-02 | Done | FE `/company/rubrics` và trình soạn rubric (tiêu chí, trọng số, chọn SHRM, mô tả từng mức, gắn câu hỏi) | Nhi | CO-07, CO-12 | Gửi duyệt được, thấy lý do bị từ chối | P0 |
| CO-15 | PM-02 | Done | FE `/moderator/rubrics` dạng bảng: danh sách `pending_review`, xem chi tiết, duyệt/từ chối | Văn | CO-08 | Duyệt xong công ty thấy trạng thái mới | P0 |
| CO-16 | CM-01 (+PM-01) | Done | API và màn hình Platform Moderator duyệt câu doanh nghiệp: `pending_platform_review` → `approved` hoặc `rejected`, tách khỏi ngân hàng câu chung `/moderator/questions` (quyết định CO-16). Chuyển chỗ render video của CO-06 sang lúc Platform Mod duyệt. Thêm trạng thái vào `STATE_MACHINES.md` | Văn | CO-05 | Câu doanh nghiệp chỉ vào phỏng vấn sau khi Platform Mod duyệt; trang ngân hàng câu chung không lẫn câu doanh nghiệp; video chỉ render cho câu Platform Mod đã duyệt; test | P0 |

## GĐ 3: Candidate Profile và kho CV

**Cổng:** ứng viên có 2 CV trong kho; file không phải CV bị từ chối; dán một JD thì hệ thống chỉ ra CV hợp nhất; trang hồ sơ hiện thẻ năng lực gộp từ phỏng vấn AI và kết quả mentor, mỗi điểm có nguồn; sửa CV và tải về PDF tiếng Việt đúng dấu.

Văn làm sau khi xong Company. Hiện chưa có model CV nào (chỉ có `CVAnalysis`).

| Mã | REQ | Trạng thái | Task | Người | Cần xong trước | Xong khi | Mức |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PR-01 | C-02 | Done | Model `CandidateProfile`; API `GET/PATCH /api/profile/me` (headline, vị trí mục tiêu, CV mặc định) | Văn | CO-03 | Profile tự tạo khi user vào lần đầu; test | P0 |
| PR-02 | C-02 | Done | Model mới `CVDocument` (tái dùng cách lưu file của `mentorshipDocumentsService`); API CRUD, `duplicate`, đặt mặc định, `version` | Văn | PR-01 | Một user có nhiều CV, đúng một CV mặc định | P0 |
| PR-03 | AIS-05 | Todo | Python `POST /validate`: kiểm tra file có phải CV (mục Kinh nghiệm, Học vấn, Kỹ năng, liên hệ; LLM phán khi không chắc) | Janet |  | Bộ 20 file mẫu (10 CV, 10 không phải) đúng ≥ 18 | P1 |
| PR-04 | AIS-05 | Done | Nối validate vào upload CV và phân tích CV/JD; lỗi tiếng Việt rõ ràng | Văn | PR-02, PR-03 | Upload ảnh hoặc hóa đơn bị từ chối | P1 |
| PR-05 | C-04 (+AIS-05) | Review · Janet · PR #254 | Best-fit: Python chấm nhiều CV với một JD, trả xếp hạng và lý do; Node `POST /api/cv/best-fit` | Janet | PR-02 | 3 CV trả kết quả trong ≤ 60 giây | P1 |
| PR-06 | AIS-07 (+C-02) | Todo | Dịch vụ gộp hồ sơ năng lực: `competencyProfile` từng buổi phỏng vấn, kết quả buổi lộ trình, khóa học hoàn thành; cập nhật theo sự kiện; bỏ session `abandoned`. Gắn `competencyId` cố định cho 3 câu baseline trong `config/baselineQuestions.js`, kiểm `competency_id` câu follow-up bằng `isValidCompetencyKey` (đề xuất e); gộp theo `competencyId` từng câu, đổi `technical_mastery` ở câu fallback và seed (m); gỡ hệ A `/api/users/me/cvs`, `/api/users/me/verified-competencies` cùng service, `ProfileMultiCvVault.jsx`, `ProfileVerifiedCompetencies.jsx`, `candidateProfileApi.js` (k) | Janet | PR-01, LP-13, N-07 | Mỗi năng lực có level, số bằng chứng và danh sách nguồn | P0 |
| PR-07 | C-02 (+CM-04) | Done | API `GET /api/profile/me/competencies` và DTO rút gọn dùng cho Application snapshot | Văn | PR-06 | Đúng định dạng DTO, có test | P0 |
| PR-08 | C-04 | Todo | Trích nội dung PDF đã tải lên thành `content` JSON để mở trong editor | Janet | PR-02 | CV mẫu tách đúng các mục chính | P1 |
| PR-09 | C-04 | Done | Xuất PDF ở backend: `POST /api/cvs/:id/export-pdf` bằng `pdfkit` + font DejaVu đang dùng cho hóa đơn (`react-pdf` chỉ xem được, không tạo được PDF) | Văn | PR-02 | PDF mở được, tiếng Việt đúng dấu, 1 mẫu chuẩn ATS | P1 |
| PR-10 | C-02 | Done | FE `/profile` viết lại: thông tin, vị trí mục tiêu, CV mặc định, thẻ năng lực "đã xác thực" bấm ra xem nguồn | Nhi | PR-01, PR-07 | Hiện đúng dữ liệu tài khoản seed | P0 |
| PR-11 | C-02 | Done | FE `/cvs`: kho CV, tải lên, nhân bản, đặt mặc định, xóa | Nhi | PR-02 | Thao tác đủ 4 việc trên UI | P0 |
| PR-12 | C-04 | Done | FE best-fit trong `CVAnalysisHub`: chọn nhiều CV, dán JD, xem xếp hạng và khoảng thiếu | Nhi | PR-05 | Chọn CV hợp nhất rồi sang phân tích chi tiết | P1 |
| PR-13 | C-04 | Done | FE CV editor `/cvs/:id/edit`: sửa theo mục, áp gợi ý AI vào bullet, lưu version, nút tải PDF gọi PR-09 | Văn | PR-09 | Sửa, lưu và tải được | P1 |

## GĐ 4: Job Post và Ứng tuyển

**Cổng:** Company Mod đăng job; ứng viên (kể cả gói free) xem job, thấy khoảng thiếu, chọn job từ gợi ý trước phòng phỏng vấn AI (hoặc nhận câu chèn ngẫu nhiên), trả lời câu doanh nghiệp đã duyệt và được chấm thêm theo rubric, ứng tuyển kèm CV và đồng ý; Company Mod xem đơn, CV, hồ sơ, điểm rubric và shortlist; đơn đã rút không còn lộ snapshot.

Áp dụng quyết định 8, 9, 12 và 14.

| Mã | REQ | Trạng thái | Task | Người | Cần xong trước | Xong khi | Mức |
| --- | --- | --- | --- | --- | --- | --- | --- |
| JB-01 | CM-03 | Done | Model `JobPost`; API company tạo, sửa, `publish`, `close` (`roleCategory`, năng lực yêu cầu, kỹ năng, `rubricId` tùy chọn, `closesAt`) | Trầm | CO-03 | Chỉ gắn rubric `approved` của cùng công ty; test | P0 |
| JB-02 | CM-03 | Done | Tự đóng job quá `closesAt` (thêm vào job định kỳ có sẵn) | Trầm | JB-01 | Test với đồng hồ giả | P1 |
| JB-03 | C-05 | Done | API công khai `GET /api/jobs` (lọc vị trí, công ty, cấp độ) và `GET /api/jobs/:id` | Trầm | JB-01 | Không trả job `draft`, `closed`, `hidden` | P0 |
| JB-04 | PM-05 (+C-10, PM-03) | Review · Trầm · PR #250 | Báo cáo job: `Report.targetType` `job_post`; sửa `createItemForReport` (`moderationQueueService.js:39`) map sang type `job_post_report` thay vì `evaluation_report`; lọc hàng đợi HITL (`moderationQueueService.js:83`) chỉ lấy 3 loại cũ; API Platform Mod ẩn/hiện job. **Đã làm (Trầm, nhánh `feat/JB-04-job-post-reports`):** `jobPostModerationService.js` (báo cáo theo đúng quy tắc hiển thị công khai, chặn báo trùng kể cả hai request cùng lúc), item `job_post_report`, `hide_job` / `dismiss`, `PATCH /api/moderator/jobs/:id/visibility`, `GET /api/moderator/jobs` cho JB-17; Quality Dashboard và trang support admin không đếm báo cáo job; 25 test integration. Sau khi deploy chạy `npm run db:sync-moderation-indexes -- --dry-run` (Git Bash; script đọc cờ `--dry-run`) (index mới trên `reports`) | Trầm | JB-03 | Job bị ẩn biến mất khỏi danh sách công khai; `/moderator/queue` không hiện báo cáo job; test map đúng loại | P0 |
| JB-05 | C-05 | Review · Janet · PR #247 | API khoảng thiếu `GET /api/jobs/:id/gap`: hồ sơ năng lực so với `requiredCompetencies`, CV mặc định so với `requiredSkills` | Janet | JB-03, PR-07 | Trả danh sách thiếu có mức độ và gợi ý bước tiếp | P0 |
| JB-06 | C-05 (+C-03, AIS-01) | Doing · Văn | Chèn câu doanh nghiệp vào phỏng vấn AI chung (quyết định JB-06 ngày 23/11/2026, thay quyết định 12): `POST /api/interviews/sessions` nhận `jobPostId` tùy chọn; có thì lấy tối đa 2 câu của job đó, không có thì chọn ngẫu nhiên một doanh nghiệp có câu hợp lệ cùng `roleCategory` rồi lấy tối đa 2 câu. Câu hợp lệ: `approved`, thuộc job đang mở, nằm trong "câu áp dụng" của rubric đã duyệt (quyết định JB-07). Câu doanh nghiệp đi sau 3 câu baseline; mọi gói; trừ 1 lượt như buổi thường. Session lưu `companyQuestions[] {questionId, companyId, jobPostId, rubricId}`. **Sửa 3 chỗ**: (1) `interviewsController.js:476` không trả `alreadyGenerated` chỉ vì đủ 5 câu, mà xét đã có câu follow-up hay chưa; (2) `questionsAllowed` cho buổi có câu doanh nghiệp là 5 (free) / 7 (Pro), không lấy theo quota thường; (3) logic kết thúc buổi ở `InterviewRoom` | Văn | JB-03, CO-05, CO-06, CO-08, CO-16 | Có `jobPostId` thì đúng câu của job đó; không có thì tối đa 2 câu của một doanh nghiệp cùng vị trí; không có câu hợp lệ thì buổi chạy như cũ; không dùng câu bị từ chối hoặc chưa qua Platform Mod; test | P0 |
| JB-07 | AIS-02 (+C-03) | Todo | Chấm theo rubric công ty (quyết định JB-07 ngày 23/11/2026): mỗi câu doanh nghiệp có `rubricScores[]` {tiêu chí, điểm, trích dẫn bằng chứng} bên cạnh điểm SHRM/DDI; lưu để không chấm lại; ghi CostEvent `rubric_scoring` | Janet | JB-06, CO-08, AI-12 | Trích dẫn là câu có thật trong transcript; chạy trên bộ AI-01 | P0 |
| JB-08 | C-05 (+NFR-06) | Todo | Model `Application`; `POST /api/jobs/:id/apply` (cvId, `consent` bắt buộc, snapshot hồ sơ + chỉ số JB-19 của ứng viên với doanh nghiệp này); `withdraw` ẩn snapshot, công ty chỉ còn thấy tên và "Đã rút"; `GET /api/applications/me` | Trầm | JB-03, PR-07, JB-07, JB-19 | Không consent thì 400; mỗi job mỗi người 1 đơn | P0 |
| JB-09 | CM-04 | Todo | API company xem danh sách/chi tiết đơn, đổi trạng thái `viewed`/`shortlisted`/`rejected`, gửi Notification | Trầm | JB-08 | Chỉ đọc được dữ liệu qua đơn có consent và chưa rút | P0 |
| JB-10 | NFR-06 | Todo | Test integration: consent, rút đơn, truy cập chéo công ty, job bị ẩn | Trầm | JB-09 | Một file test riêng chạy xanh | P0 |
| JB-11 | C-05 | Done | FE `/jobs`: danh sách, lọc, thẻ job | Văn | JB-03 | Lọc đúng theo API | P0 |
| JB-12 | C-05 | Todo | FE `/jobs/:id`: mô tả, khoảng thiếu, chỉ số của ứng viên với doanh nghiệp này (JB-19; chưa có thì ghi "Bạn chưa trả lời câu nào của doanh nghiệp này" kèm nút mở phỏng vấn AI đã chọn sẵn job), Ứng tuyển (chọn CV + ô đồng ý), Báo cáo, gửi yêu cầu mentor gắn job (`jobPostId`, đề xuất i) | Nhi | JB-05, JB-06, JB-08, JB-19 | Đi hết luồng trên UI | P0 |
| JB-13 | C-05 | Todo | FE `/my-applications`: trạng thái đơn, rút đơn | Nhi | JB-08 | Trạng thái đổi khi công ty xử lý | P0 |
| JB-14 | C-03 | Todo | FE trang feedback phỏng vấn: câu doanh nghiệp hiện tên doanh nghiệp, điểm rubric và trích dẫn | Nhi | JB-07 | Câu không phải của doanh nghiệp không hiện phần này | P0 |
| JB-15 | CM-03 | Todo | FE `/company/jobs` dạng bảng và form soạn job (năng lực, kỹ năng, chọn rubric, ngày đóng) | Trầm | JB-01, CO-12 | Đăng và đóng job trên UI | P0 |
| JB-16 | CM-04 | Todo | FE `/company/applications` và chi tiết đơn (xem CV, thẻ năng lực, chỉ số JB-19, câu trả lời kèm điểm rubric, shortlist/từ chối) | Văn | JB-09, CO-12, JB-19 | Shortlist xong ứng viên nhận thông báo | P0 |
| JB-17 | PM-05 | Todo | FE moderator: màn xử lý báo cáo job (loại `job_post_report`, tách khỏi hàng đợi phỏng vấn), nút ẩn/hiện | Trầm | JB-04 | Xử lý được một báo cáo job trên UI | P0 |
| JB-19 | CM-04 (+C-02, AIS-07) | Todo | Chỉ số theo cặp ứng viên và doanh nghiệp (quyết định JB-19 ngày 23/11/2026): số câu đã trả lời, điểm trung bình từng tiêu chí rubric, ngày gần nhất, danh sách buổi; API cho ứng viên xem chỉ số của mình; DTO đưa vào snapshot của JB-08. Doanh nghiệp chỉ xem qua đơn ứng tuyển có đồng ý | Janet | JB-07 | Chỉ số khớp truy vấn tay trên dữ liệu test; doanh nghiệp không đọc được chỉ số khi chưa có đơn kèm đồng ý; test | P0 |
| JB-20 | C-05 | Doing · Văn | Lưu tối đa 5 job xem gần nhất của ứng viên khi gọi `GET /api/jobs/:id`; API `GET /api/jobs/recent`, chỉ trả job đang mở và có câu doanh nghiệp hợp lệ | Văn | JB-03 | Xem job thứ 6 thì job cũ nhất bị bỏ; job đóng hoặc không có câu hợp lệ không được trả; test | P1 |
| JB-21 | C-05 (+C-03) | Todo | FE màn cài đặt buổi phỏng vấn AI: thẻ "Luyện theo job bạn quan tâm gần đây" (tối đa 3 job từ `GET /api/jobs/recent`); chọn thì gửi `jobPostId`, bỏ qua thì chạy ngẫu nhiên | Nhi | JB-06, JB-20 | Chọn job thì buổi có câu của doanh nghiệp đó; không có job gần đây thì không hiện thẻ | P1 |

## GĐ 5: Vòng AI và gợi ý

**Cổng:** sau ít nhất 5 lượt Platform Mod chấm lại, job tự tạo một đề xuất cải tiến có bằng chứng và bảng trước/sau; Platform Mod duyệt thì prompt mới chạy, rollback được; Quality Dashboard so sánh được theo version.

`promptVersion` đã được ghi ở `questions[]`, `feedback`, `QuestionBank.provenance` và `moderationQualityService` đang dùng, nên `PromptVersion` chỉ là bảng đăng ký. AI-01 và AI-12 làm sớm, ngay từ GĐ 0.

| Mã | REQ | Trạng thái | Task | Người | Cần xong trước | Xong khi | Mức |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AI-01 | AIS-02 (+AIS-06) | Todo | Bộ 20 câu trả lời chuẩn: cả nhóm chấm độc lập theo SHRM/DDI, Janet tổng hợp điểm chuẩn | Janet | LP-01 | File dữ liệu trong repo, có độ lệch giữa người chấm | P0 |
| AI-02 | AIS-06 (+PM-04) | Done | Model `PromptVersion` làm bảng đăng ký cho các chuỗi `promptVersion` đã có; seed version hiện tại; loader đọc prompt theo version `active`; không thêm field mới vào `InterviewSession` | Janet |  | Đổi version không cần deploy lại; chuỗi cũ vẫn khớp; đã chạy `db:sync-prompt-versions` trên staging và production, mỗi key có đúng một bản active | P0 |
| AI-03 | AIS-06 | Review · Janet · PR #246 | Model `AIImprovementProposal`; `aiImprovementMinerJob` gom ModerationItem đã xử lý (`override_score`, sửa hoặc khai tử câu) theo ngưỡng cấu hình (mặc định 5); thêm `createVersion(key, { baseVersion, template, fewShotExamples })` vào `promptVersionService`, kiểm tên `<tiền tố>-vN` và `validateTemplate` như `activate()` (đề xuất h) | Janet | AI-02 | Test: đủ ngưỡng thì tạo đúng 1 đề xuất | P0 |
| AI-04 | AIS-06 | Todo | Backtest: chạy đề xuất trên AI-01 và 10 câu trả lời cũ, lưu điểm trước/sau vào đề xuất; backtest cần đổi phần chữ do `competencyFramework.js` sinh thì chuyển phần đó vào template PromptVersion (đề xuất g) | Janet | AI-01, AI-03 | Hiện được độ lệch so với điểm chuẩn | P0 |
| AI-05 | PM-04 | Todo | API Platform Mod duyệt, từ chối, rollback; duyệt thì bật PromptVersion mới | Janet | AI-04 | Rollback trả về version trước; test | P0 |
| AI-06 | PM-04 | Todo | FE `/moderator/ai-improvements` dạng bảng: bằng chứng, trước/sau, duyệt, từ chối, rollback | Janet | AI-05 | Duyệt được một đề xuất trên UI | P0 |
| AI-07 | PM-06 | Todo | Quality Dashboard thêm: rubric chờ duyệt, thời gian duyệt rubric, tỉ lệ bị sửa trước/sau mỗi lần đổi version (BE + FE) | Janet | AI-05, CO-08 | Số khớp truy vấn tay | P1 |
| AI-08 | AIS-08 | Review · Janet · PR #249 | AI sàng lọc khóa học khi mentor gửi duyệt: đủ nội dung, video, mô tả, dấu hiệu vi phạm; ghi `Course.aiPrescreen` + ModerationItem `course_prescreen`; model rẻ; CostEvent `course_prescreen` | Janet | AI-12 | Mỗi khóa gửi duyệt có kết quả và cờ cụ thể | P1 |
| AI-09 | PM-05 | Done | FE: nhãn sàng lọc trên `/moderator/courses`; mentor thấy cảnh báo trước khi gửi | Janet | AI-08 | Hiện đúng cờ từ API | P1 |
| AI-10 | AIS-07 (+C-09) | Review · Janet · PR #252 | API `GET /api/recommendations/me`: khóa học, mentor (chuyên môn khớp năng lực còn thiếu, đánh giá), job (năng lực khớp yêu cầu); chấm theo luật có trọng số | Janet | PR-07, JB-03 | Mỗi gợi ý kèm một dòng lý do | P1 |
| AI-11 | C-09 | Done | FE khối gợi ý trên `/dashboard` (mentor, khóa, job) | Janet | AI-10 | Bấm vào được trang chi tiết | P1 |
| AI-12 | AIS-08 | Done | Thêm kind `rubric_scoring`, `course_prescreen` vào `CostEvent`; ngưỡng cảnh báo Slack cho hai loại | Janet |  | Lưu được CostEvent mới; làm trước JB-07 và AI-08 | P0 |
| AI-13 | AIS-02 (+C-03) | Review · Janet · PR #248 | Bỏ fallback `shrmLevel = "proficient"` khi LLM trả giá trị lạ hoặc thiếu ở 4 chỗ: `interviewQuestionService.js:737`, `interviewsController.js:635` (đọc lại feedback đã cache), `frontend/src/app/utils/interview/feedbackModeration.js:42` và `:53`; thay bằng `""` và để FE hiện "Chưa đủ dữ liệu" | Janet |  | Câu thiếu `shrm_level` không còn hiện nhãn "Tốt"; test cả backend và FE | P1 |
| AI-14 | AIS-04 (+NFR-02) | Todo | Chạy thử video avatar ElevenLabs `POST /v1/flows/video` (gói Pro, bất đồng bộ, poll cách ≥ 10 giây): `creatify-aurora` và các model có cử chỉ gọi được qua API (OmniHuman 1.5, HeyGen Avatar 4; model ByteDance có thể phải xin duyệt). Dùng ảnh `AI-female`/`AI-male`, audio tiếng Việt ElevenLabs, 3 câu baseline và câu dài nhất trong bộ câu hỏi | Janet |  | Có bảng theo model: thời gian tạo, credit, độ dài clip tối đa, khẩu hình tiếng Việt, cử chỉ; chọn 1 model. Không model nào đạt p95 ≤ 130 giây thì dừng, giữ D-ID, báo nhóm | P0 |
| AI-15 | AIS-04 (+NFR-02) | Todo | Tách lớp provider trong `avatarService.js` (D-ID đang viết thẳng: `createDIDTalk`, `pollDIDTalk`, `didCircuit`), thêm provider `elevenlabs`; `AVATAR_PROVIDER=did \| elevenlabs`, bỏ `tavus` (không có code); circuit breaker theo provider; giữ mirror Cloudinary, cache 180 ngày, fallback giọng trình duyệt cộng ảnh tĩnh; cache key có provider và model | Janet | AI-14 | Đặt `AVATAR_PROVIDER=elevenlabs` thì buổi phỏng vấn chạy video ElevenLabs; không trả lại video D-ID cũ từ cache; `GET /api/ai/config` báo provider đang chạy; có test với provider giả lập | P0 |
| AI-16 | AIS-08 (+AIS-04) | Todo | Chi phí video ElevenLabs: `calcAvatarVideoCost` tính theo credit ElevenLabs thay giá D-ID, ghi `CostEvent`; chế độ mock của QA-01 phủ provider mới | Janet | AI-15 | `CostEvent` của video ElevenLabs đúng đơn giá; bật mock thì không phát sinh `CostEvent` | P0 |
| AI-17 | AIS-04 | Todo | Gỡ D-ID: code D-ID trong `avatarService.js`, `getDIDUsage`/`listDIDPresenters`, biến `D_ID_API_KEY`; sửa CLAUDE.md, `API_INDEX.md`, AIS-04 trong `REQUIREMENTS.md`, DOC-04 | Janet | QA-08 | Không còn lời gọi `api.d-id.com`; `npm test` chạy qua; tài liệu không còn nói D-ID là provider đang chạy | P1 |
| AI-18 | AIS-06 (+PM-04, PM-02) | Todo | Miner thêm loại đề xuất `rubric_anchor` (quyết định AI-18): gom tiêu chí rubric công ty đã duyệt theo `shrmKey` (và `roleCategory`), chỉ lấy công ty đã đồng ý điều khoản CO-02; khi ≥ 3 công ty khác nhau cùng có tiêu chí cho một key thì LLM tóm tắt ví dụ neo từng mức 0–5, bỏ thông tin nhận diện công ty (tên, sản phẩm, số liệu nội bộ), tạo PromptVersion mới cho prompt chấm; backtest AI-01 (AI-04), độ lệch so với điểm chuẩn tăng thì tự loại; Platform Mod duyệt hoặc rollback như AI-05. Nguồn học là nội dung rubric, không dùng điểm rubric (JB-07) hay quyết định shortlist. **Không sửa** bảng 6 mức LP-01; rubric công ty vẫn chỉ chấm câu của công ty đó | Janet | AI-05, CO-08, CO-02 | Dữ liệu có ≥ 3 công ty cùng `shrmKey` thì tạo đúng 1 đề xuất `rubric_anchor`, nội dung không chứa tên công ty; 2 công ty thì không tạo; backtest tăng độ lệch thì đề xuất bị loại; test | P1 |

## GĐ 6: Kiểm thử, đo NFR, tài liệu, demo

**Cổng:** chạy trọn kịch bản demo 7 bước trên **staging** với dữ liệu seed demo, không lỗi; production chỉ cần smoke test luồng chính; 4 NFR có số đo trong `docs/report/nfr-results.md`; SRS, SDD và hồ sơ Review nộp được.

| Mã | REQ | Trạng thái | Task | Người | Cần xong trước | Xong khi | Mức |
| --- | --- | --- | --- | --- | --- | --- | --- |
| QA-01 | NEN (NFR-04) | Done | Chế độ mock LLM, D-ID, ElevenLabs bằng biến môi trường để test tải không tốn tiền | Văn |  | Bật cờ thì không phát sinh CostEvent | P0 |
| QA-02 | NFR-04 | Done | Script k6 100 người dùng đồng thời (đăng nhập, xem mentor, xem job, tạo session, đặt lịch); nới rate limit riêng cho môi trường test; ghi p95 và tỉ lệ lỗi | Văn | QA-01 | Kết quả ghi vào `nfr-results.md` | P0 |
| QA-03 | NFR-01 (+NFR-02) | Done | Đo CV/JD ≤ 60 giây (30 CV) và avatar ≤ 130 giây (20 câu mới, 20 câu đã cache) từ log N-11; báo p50/p95 | Văn | N-11 | Kết quả ghi vào `nfr-results.md` | P0 |
| QA-04 | NFR-03 | Todo | Đo thời gian đối soát SePay trên 20 giao dịch (webhook đến → Payment `success`) | Trầm | LP-10 | Kết quả ghi vào `nfr-results.md` | P0 |
| QA-05 | AIS-06 (+A-02, CM-01, CM-02, CM-03, C-05, C-07, CM-04) | Todo | Đã xong: seed dữ liệu demo cho **staging**: 2 công ty, 3 job, rubric đã duyệt, 3 mentor, ứng viên có lịch sử phỏng vấn và lộ trình, **ít nhất 5 lượt chấm lại** để miner đủ ngưỡng. Giữ `_devOnlyGuard.js` (chặn production). **Bổ sung 23/11/2026 (đề xuất aa)**: thêm ít nhất 1 công ty, để ≥ 3 công ty có rubric đã duyệt cùng một `shrmKey` và đã đồng ý điều khoản CO-02 | Văn | JB-09, LP-13, AI-03 | Một lệnh ra đủ dữ liệu kịch bản demo trên staging; miner AI-18 tạo được đề xuất `rubric_anchor` từ dữ liệu seed | P0 |
| QA-06 | C-07 (+A-02, CM-01, CM-02, PM-02, C-05, C-03, CM-04, PM-03, PM-04) | Todo | Kiểm thử thủ công trên staging theo kịch bản demo 7 bước và theo từng vai trò; ghi lỗi vào issue có mã task | Nhi | QA-05 | Không còn lỗi chặn luồng | P0 |
| QA-07 | C-02 (+C-04, C-05, C-07, CM-01, CM-02, CM-03, CM-04) | Todo | Kiểm tra responsive và sửa lỗi giao diện các màn hình mới | Văn | QA-06 | Mọi màn hình mới dùng được ở bề ngang điện thoại | P1 |
| QA-08 | NFR-02 (+AIS-04) | Todo | Đo lại phần avatar của QA-03 với ElevenLabs (20 câu mới, 20 câu đã cache), chạy lại `npm run warmup:baseline-videos` | Janet | AI-15 | Kết quả p50/p95 ghi vào `nfr-results.md`, ghi rõ provider và model | P0 |
| DOC-01 | C-01..AIS-08 | Todo | SRS: bảng ánh xạ 39 chức năng ↔ use case ↔ màn hình ↔ API; bảng tên role; mục "Chức năng bổ trợ" (giỏ hàng, coupon, gói Pro) | Janet |  | Mọi dòng trong đơn V2 có use case | P0 |
| DOC-02 | C-07 (+C-05, NFR-06) | Todo | SDD và sequence diagram: Learning Path (có chia tiền và chặn luồng hủy cũ), Job Post, Ứng tuyển | Trầm | LP-17, JB-10 | Sequence khớp code | P0 |
| DOC-03 | A-02 (+CM-01, CM-02, PM-02, C-02) | Done | SDD và sequence diagram: Company, lời mời, duyệt câu, Rubric, Profile và kho CV | Văn | CO-08, PR-07 | Sequence khớp code | P0 |
| DOC-04 | AIS-02 (+AIS-06, AIS-07, AIS-08) | Todo | SDD và sequence diagram: chấm rubric, Learning from Reviews, hồ sơ năng lực, sàng lọc khóa | Janet | JB-07, AI-05 | Sequence khớp code | P0 |
| DOC-05 | NEN (*) | Todo | Hồ sơ Review BM01 Design Brief, BM02 Self-Review, BM03 Record of Changes, BM04 Commitment | Janet |  | Nộp đủ 4 biểu mẫu | P0 |
| DOC-06 | C-01..CM-04 | Todo | Hướng dẫn sử dụng theo 5 vai trò, có ảnh chụp | Nhi | QA-06 | Mỗi vai trò có luồng chính | P1 |
| DOC-07 | C-07 (+A-02, CM-01, CM-02, PM-02, C-05, C-03, CM-04, PM-03, PM-04) | Todo | Kịch bản demo chi tiết trên staging (tài khoản, thứ tự thao tác, phương án dự phòng khi ElevenLabs lỗi: mất cả giọng lẫn video, chạy bằng giọng trình duyệt và ảnh tĩnh) và slide bảo vệ | Janet | QA-06 | Cả nhóm chạy thử trọn vẹn một lần | P0 |

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
| 19/11/2026 | LP-07, LP-20 | M-03 | bat-buoc | (f) Danh sách năng lực tạm của LP-20 có 6 key không nằm trong bộ tiêu chí LP-01; backend LP-07 chỉ kiểm bằng regex | Đã sửa ở PR #204: backend kiểm bằng `isValidCompetencyKey`, FE đọc `GET /api/competencies`, script `db:migrate-lp-shrm-keys` đổi key cũ. Còn phải chạy script trên production (bản `:dry` trước) | Xong 22/11/2026: `db:migrate-lp-shrm-keys:dry` trên production báo 0 buổi có key cũ, không cần chạy bản thật |
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
| 22/11/2026 | N-03 | NEN (CM-01) | bat-buoc | (n) `scripts/migrateEnterpriseRole.js` chỉ đọc `MONGO_URI`, mà `loadEnv` nạp `.env` với `override: true`, nên đặt `$env:MONGO_URI=<production>` vẫn chạy trên DB trong `.env` và báo thành công. Chưa có lệnh `:dry` trong `package.json` | Sửa theo mẫu `syncPromptVersions.js`: đọc `TARGET_MONGO_URI` trước, in host đích, thêm `db:migrate-enterprise-role:dry`; sau đó mới chạy trên production để N-03 sang `Done` | Đã làm 23/11/2026 (Văn, sửa nhỏ bat-buoc): đọc `TARGET_MONGO_URI` trước, in host đích, thêm `db:migrate-enterprise-role:dry`, có test. Còn chạy trên production để N-03 sang `Done` |
| 22/11/2026 | CO-05, CO-13 | CM-01 | bat-buoc | (o) `POST /api/company/questions/generate-starter` lỗi với mọi vị trí: mẫu viết cứng dùng `layer` `system` / `technical` / `behavioral`, schema `QuestionBank` chỉ nhận `theory` / `project` / `behavior` (kiểm bằng `validateSync`). FE đã chuyển sang `POST /api/company/questions/generate` của CO-04 (PR #226) | Gỡ route, handler `generateStarterQuestions` và mẫu viết cứng sau khi PR #226 merge | Đã làm 23/11/2026 (Văn, trong PR #251): gỡ route, handler `generateStarterQuestions` và bộ câu mẫu; FE không còn gọi. Chờ Janet duyệt khi review PR |
| 22/11/2026 | AIS-04 (CO-06, QA-01, QA-03, DOC-07) | AIS-04 (+NFR-02) | chi-tiet | (p) Nhóm thống nhất bỏ hẳn D-ID, chuyển video avatar sang ElevenLabs (`POST /v1/flows/video`, bất đồng bộ, cần gói Pro trở lên). D-ID chỉ ghép khẩu hình lên ảnh tĩnh, không có cử chỉ. Đơn V2 ghi "text-to-speech and lip-sync API integration", không nêu tên D-ID, nên vẫn trong phạm vi. Code hiện tại: D-ID viết thẳng trong `avatarService.js` (`createDIDTalk`, `pollDIDTalk`, `didCircuit`), chưa có lớp provider; `AVATAR_PROVIDER=did \| tavus` nhưng `tavus` không có code; `calcAvatarVideoCost` tính theo giá D-ID. Chưa kiểm chứng: model có cử chỉ (OmniHuman 1.5, HeyGen Avatar 4) có gọi được qua API không (OmniHuman là model ByteDance, có thể phải xin duyệt), credit mỗi video, giới hạn độ dài clip. API yêu cầu poll cách nhau ≥ 10 giây (D-ID đang poll 2–8 giây) | Thêm 5 task, làm theo thứ tự: **AI-14** (Janet, P0) chạy thử `/v1/flows/video` với `creatify-aurora` và các model có cử chỉ gọi được, ảnh `AI-female`/`AI-male`, audio tiếng Việt ElevenLabs, 3 câu baseline và câu dài nhất trong bộ câu hỏi; xong khi có bảng theo model: thời gian tạo (poll 10 giây), credit, độ dài tối đa, khẩu hình tiếng Việt, cử chỉ, và chọn 1 model. Nếu không model nào đạt p95 ≤ 130 giây thì dừng, giữ D-ID, báo lại nhóm. **AI-15** (Janet, P0, cần AI-14) tách lớp provider trong `avatarService.js`, thêm provider `elevenlabs`, `AVATAR_PROVIDER=did \| elevenlabs` (bỏ `tavus`); circuit breaker theo provider; giữ nguyên mirror Cloudinary, cache 180 ngày, fallback giọng trình duyệt cộng ảnh tĩnh; cache key có provider và model để không trả video D-ID cũ; `GET /api/ai/config` báo provider đang chạy; có test với provider giả lập. **AI-16** (Janet, P0, cần AI-15) chi phí: `calcAvatarVideoCost` theo credit ElevenLabs, ghi `CostEvent` đúng, chế độ mock của QA-01 phủ provider mới. **QA-08** (Văn, P0, cần AI-15) đo lại phần avatar của QA-03 với ElevenLabs (20 câu mới, 20 câu đã cache), chạy lại `warmup:baseline-videos`, cập nhật `nfr-results.md`. **AI-17** (Janet, P1, cần QA-08 đạt) gỡ D-ID: code, `D_ID_API_KEY`, `getDIDUsage`/`listDIDPresenters`, tài liệu (CLAUDE.md, `API_INDEX.md`, AIS-04 trong `REQUIREMENTS.md`, DOC-04). Sửa dòng có sẵn: CO-06 bỏ chữ "D-ID", dùng provider đang chạy; DOC-07 đổi phương án dự phòng "khi D-ID lỗi" thành "khi ElevenLabs lỗi". Rủi ro mới: TTS và video cùng một nhà cung cấp, ElevenLabs lỗi là mất cả hai (trước đây D-ID còn tự dùng Azure TTS); chỉ còn fallback giọng trình duyệt. Sau khi duyệt, thêm quyết định này vào `DECISIONS.md` | Đã duyệt 22/11/2026: thêm AI-14, AI-15, AI-16, AI-17 vào GĐ 5, QA-08 vào GĐ 6; sửa CO-06, DOC-07 |
| 22/11/2026 | JB-09 (+JB-16) | NFR-06 (+CM-04) | chi-tiet | (q) Nhật ký thao tác (`adminAuditLog` → `SecurityLog` type `admin_action`) chỉ ghi admin và Platform Moderator, không có dấu vết Company Moderator đã xem dữ liệu ứng viên nào. NFR-06 cam kết "chỉ chia sẻ khi ứng viên ứng tuyển và đồng ý" nhưng không có bằng chứng để kiểm | Thêm task JB-xx: ghi nhật ký khi Company Moderator mở chi tiết đơn, xem/tải CV, xem hồ sơ năng lực, đổi trạng thái đơn (chỉ ghi ai, đơn nào, lúc nào; không ghi nội dung CV). Thêm `type` mới vào enum `SecurityLog`, `/admin/audit-log` lọc được theo vai trò. Làm cùng hoặc ngay sau JB-09 | Đề xuất |
| 22/11/2026 | LP-14 (+mentor payout có sẵn) | A-04 (+M-06) | chi-tiet | (r) Mentor đổi tài khoản ngân hàng nhận tiền (`PATCH /api/mentor/payout-account`), gửi yêu cầu rút tiền và xin đổi giá không được ghi nhật ký; khi có tranh chấp chi trả không tra được mentor khai tài khoản nào, lúc nào | Thêm task: ghi `SecurityLog` cho 3 thao tác này (che số tài khoản, chỉ giữ 4 số cuối); hiện trong `/admin/audit-log` | Đề xuất |
| 23/11/2026 | CO-06 | AIS-04 (+NFR-02) | no-ky-thuat | (s) CO-06 và CLAUDE.md ghi video đã mirror Cloudinary "cache 180 ngày", nhưng code cache **không TTL** (`avatarService.js`, `persistVideo` → `cacheSet(key, url, null)`). CO-06 giữ hành vi của code | Sửa chữ "180 ngày" thành "không TTL" ở CO-06 và CLAUDE.md; nếu muốn có hạn thì làm trong AI-15 (đổi chung cho baseline) | |
| 23/11/2026 | CO-06 | AIS-08 (+AIS-04) | chi-tiet | (t) `getCacheMetrics` (`costLedgerService.js`) coi mọi render `avatar_video_did` có `persistVideo: true` là render baseline và báo Slack khi quá 6 lần/tháng. `POST /api/ai/interview/pregenerate` (câu follow-up) và câu công ty (CO-06) cũng render với `persistVideo: true`, nên cảnh báo báo sai | Gắn `metadata.videoScope` (`baseline` / `company_question` / `session`) khi ghi CostEvent video, cảnh báo chỉ đếm `baseline`. Làm cùng AI-16 (sửa chi phí video) để không đụng `avatarService.js` hai lần | |
| 23/11/2026 | JB-06 | C-05 (+C-03, AIS-01) | chi-tiet | (u) Bỏ chức năng "Luyện theo job" riêng theo quyết định mới 23/11 | Viết lại JB-06 (Janet, P0): khi tạo buổi phỏng vấn AI, nhận `jobPostId` tùy chọn; có thì lấy tối đa 2 câu của job đó, không có thì chọn ngẫu nhiên một doanh nghiệp có câu hợp lệ cùng `roleCategory` rồi lấy tối đa 2 câu. Câu doanh nghiệp đi sau 3 câu baseline. Session lưu `companyQuestions[] {questionId, companyId, jobPostId, rubricId}`. Không có câu hợp lệ thì buổi chạy như cũ. Giữ 3 chỗ sửa (1), (2), (3) đã ghi | Đã duyệt 23/11/2026: viết lại JB-06 |
| 23/11/2026 | JB-19 (mới) | CM-04 (+C-02, AIS-07) | chi-tiet | (v) Chưa có nơi gộp kết quả trả lời câu doanh nghiệp để doanh nghiệp xem | Task mới JB-19 (Janet, P0, cần JB-07): gộp theo cặp ứng viên và doanh nghiệp (số câu đã trả lời, điểm trung bình từng tiêu chí rubric, ngày gần nhất, danh sách buổi); API cho ứng viên xem chỉ số của mình; DTO đưa vào snapshot của JB-08 | Đã duyệt 23/11/2026: thêm JB-19 |
| 23/11/2026 | JB-20 (mới) | C-05 | chi-tiet | (w) Gợi ý "job quan tâm gần đây" cần biết ứng viên đã xem job nào | Task mới JB-20 (Trầm, P1, cần JB-03): lưu tối đa 5 job xem gần nhất của ứng viên khi gọi `GET /api/jobs/:id`; API `GET /api/jobs/recent`, chỉ trả job đang mở và có câu doanh nghiệp hợp lệ | Đã duyệt 23/11/2026: thêm JB-20 |
| 23/11/2026 | JB-21 (mới) | C-05 (+C-03) | chi-tiet | (x) Chưa có màn hình chọn job trước phòng phỏng vấn | Task mới JB-21 (Nhi, P1, cần JB-06, JB-20): ở màn cài đặt buổi phỏng vấn AI, hiện thẻ "Luyện theo job bạn quan tâm gần đây" (tối đa 3 job), chọn thì gửi `jobPostId`, bỏ qua thì chạy ngẫu nhiên | Đã duyệt 23/11/2026: thêm JB-21 |
| 23/11/2026 | JB-08, JB-12, JB-14, JB-16 | C-05 (+CM-04, NFR-06) | chi-tiet | (y) Các task này đang mô tả theo luồng "Luyện theo job" cũ | JB-08: snapshot lấy chỉ số JB-19 thay cho "điểm rubric buổi luyện gần nhất". JB-12: bỏ nút "Luyện theo job"; hiện chỉ số của ứng viên với doanh nghiệp này, chưa có thì ghi "Bạn chưa trả lời câu nào của doanh nghiệp này" kèm nút mở phỏng vấn AI đã chọn sẵn job. JB-14: ghi tên doanh nghiệp cạnh câu doanh nghiệp. JB-16: hiện chỉ số JB-19 | Đã duyệt 23/11/2026: sửa JB-08, JB-12, JB-14, JB-16 |
| 23/11/2026 | CO-05, CO-13, CO-16 (mới) | CM-01 (+PM-01) | chi-tiet | (z) Doanh nghiệp tải câu theo job; câu cần Platform Moderator duyệt | CO-05: câu doanh nghiệp có `jobPostId`, thêm tải lên hàng loạt; doanh nghiệp duyệt xong chuyển `pending_platform_review`. CO-13: thêm nút tải lên, lọc theo job. Task mới CO-16 (Văn, P0, cần CO-05): API và màn hình Platform Moderator duyệt câu doanh nghiệp, tách khỏi ngân hàng câu chung. CO-04 bỏ điều kiện "câu không hiện ở trang của Platform Mod" | Đã duyệt 23/11/2026: sửa CO-04, CO-05, CO-13; thêm CO-16 (kèm chuyển chỗ render video CO-06 sang lúc Platform Mod duyệt) |
| 23/11/2026 | N-08 | A-05 | bat-buoc | (aa) `getPlatformFinanceSummary` tính phí khóa học bằng `Number.isFinite(Number(row.platformFee))`, mà `Enrollment.platformFee` mặc định `null` và `Number(null) = 0`, nên enrollment chưa ghi phí bị tính phí nền tảng 0% (mentor nhận 100% trong báo cáo) | Đã sửa trong N-08: `getPlatformFinanceSummary` và API doanh thu theo nguồn dùng chung `bookingRevenueRow` / `courseRevenueRow` (`revenueAnalyticsService.js`), coi `null` là chưa ghi và tính theo tỉ lệ | Đã làm trong N-08 |
| 23/11/2026 | N-11 | NFR-01 (+AIS-05) | chi-tiet | (ab) Trước N-11, lượt phân tích CV chỉ bị trừ khi FE gọi `POST /api/cv/analyses` lưu kết quả; gọi thẳng `/api/cv/analyze*` mà không lưu thì không tốn lượt. Khi server tự ghi kết quả (N-11) phải chọn lúc trừ lượt | Đã làm trong N-11: trừ 1 lượt khi Python trả kết quả (`finishAnalysisRun`, đánh dấu `quotaCharged`); FE lưu với `analysisId` không trừ lần nữa; Python lỗi không trừ; FE lưu kết quả dự phòng (theo ngành) thì trừ như trước. Client cũ không gửi `analysisId` vẫn chạy (tạo bản ghi mới, trừ lượt khi lưu) | Đã làm trong N-11, chờ Janet xem |
| 23/11/2026 | LP-06 | C-06 | chi-tiet | (ac) Quyết định 13 không nói: buổi 0đ bị **hủy** trước khi diễn ra có tính lượt không; "30 ngày" tính theo mốc nào; chưa có luồng nào ghi **ứng viên vắng** buổi 0đ (báo vắng hiện chỉ ghi mentor vắng, `cancelledBy: "mentor"`; buổi ứng viên bỏ không ai báo thì tự `completed` sau thời gian chờ) | Đã làm trong LP-06: buổi `cancelled` (ai hủy cũng vậy) không tính vì chưa diễn ra; 30 ngày tính theo `createdAt` của booking; `no_show` có `cancelledBy` khác `mentor` coi là ứng viên vắng và tính lượt; buổi ứng viên bỏ mà tự `completed` cũng tính. Nếu nhóm muốn mentor có nút "ứng viên vắng" thì thêm task riêng | Chờ Janet duyệt |

## Hướng phát triển

> Việc loại `ngoai-don` (không chỉ ra được REQ nào), hoặc P1 tự chuyển ra khi tới mốc mà cổng chưa qua. Không làm trong capstone.

| Ngày | Nguồn (task) | Ý tưởng | Lý do không làm trong capstone |
| --- | --- | --- | --- |
| 22/11/2026 | đề xuất (q), (r) | Ghi nhật ký thao tác bảo mật của ứng viên: đổi mật khẩu/email, xóa tài khoản, bị khóa do đăng nhập sai | `ngoai-don`: đơn đăng ký không có dòng nào về nhật ký bảo mật tài khoản ứng viên (C-01 chỉ nói đăng ký, đăng nhập). Đồng ý chia sẻ khi ứng tuyển đã có ở JB-08 |

## Ghi chú Blocked

| Task | Lý do | Cần ai gỡ |
| --- | --- | --- |

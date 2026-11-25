# ProInterview: Mã yêu cầu (REQ) theo đơn đăng ký V3

> Phiên bản: 23/11/2026. Nguồn phạm vi duy nhất: `docs/plan/REGISTRATION_V3.md`. V3 sửa nội dung 9 dòng của V2 (Context: Enterprise Collaboration và Key differentiator; C-03, C-05, PM-01, CM-01, CM-04, AIS-02, AIS-06), không đổi số lượng hay thứ tự chức năng nên mã REQ giữ nguyên.

## Mục đích

File này neo mọi task vào một dòng trong đơn đăng ký V3. Mỗi chức năng và NFR của đơn có một mã REQ, giữ đúng thứ tự trong đơn. Cột REQ trong `TASKS.md` trỏ về các mã này. Task không chỉ ra được REQ nào thì không làm, mà chuyển sang "Hướng phát triển".

Tổng cộng 45 REQ: 39 chức năng (C-01..C-10, M-01..M-06, A-01..A-05, PM-01..PM-06, CM-01..CM-04, AIS-01..AIS-08) và 6 NFR (NFR-01..NFR-06).

## Quy ước

### Gắn REQ cho task

- Mỗi task gắn **ít nhất một** mã REQ. Task chạm nhiều REQ thì ghi REQ chính trước, REQ phụ trong ngoặc, ví dụ `C-07 (+A-04, NFR-03)`. Task không gắn được REQ nào: dừng và báo.
- `NEN (<REQ>)`: task hạ tầng thuần mở đường cho REQ đó, ví dụ `NEN (C-07)`.
- `NEN (*)`: việc dùng chung cho cả dự án, không mở đường riêng cho REQ nào (hạ tầng, quy trình, hồ sơ bắt buộc của môn SWP490). Không chuyển "Hướng phát triển". Prompt F mục (e) liệt kê riêng các task này.
- Cột Task của bảng REQ chỉ liệt kê task xây chức năng. Task kiểm thử, tài liệu và `NEN (*)` ghi REQ ở bảng "Task kiểm thử, tài liệu và NEN (*)" bên dưới và ở cột REQ của `TASKS.md`.

### Cột "Phủ"

| Giá trị | Nghĩa |
| --- | --- |
| `Có sẵn` | Đã có trong code trước capstone. Ghi chú phải nêu đường dẫn file chứng minh. Mốc kiểm tra: commit `0192f2b` (09/11/2026), ngay trước khi có kế hoạch capstone |
| `Có task` | Chưa có sẵn; có ít nhất 1 task trong `TASKS.md` bao |
| `Có sẵn + task` | Có sẵn một phần; task bổ sung phần còn thiếu |
| `Thiếu` | Không có sẵn và chưa task nào bao |

Không đoán `Có sẵn`: không tìm thấy file chứng minh thì ghi `Có task` hoặc `Thiếu`.

### Cột "Đạt khi"

Một câu kiểm tra được trên staging (ai làm gì, thấy gì). Mọi ô đang là bản nháp, ghi "(nháp)" ở cuối. Câu trong đơn mơ hồ thì ghi `CẦN CHỐT` kèm điểm cần chốt, không tự đoán. Janet chốt rồi mới bỏ chữ "(nháp)".

## Luật task phát sinh

Chép từ `START_HERE.md`. Mọi việc mới phát hiện trong lúc làm đều được phân loại bằng một câu hỏi: **"Việc này phục vụ REQ nào trong `REQUIREMENTS.md`?"**

| Loại | Dấu hiệu | Xử lý |
| --- | --- | --- |
| `bat-buoc` (phát sinh bắt buộc) | Không làm thì task hiện tại không đạt "Xong khi" (bẫy trong code, field thiếu, luồng cũ chặn) | Nếu là **sửa nhỏ**: làm luôn trong phiên, ghi rõ trong PR, người phụ trách tự duyệt. Nếu không: đề xuất task mới cùng REQ, cùng mức với task gốc |
| `chi-tiet` (chi tiết hóa REQ) | Phục vụ một REQ nhưng chưa task nào bao | Đề xuất task mới gắn REQ đó; Janet chọn mức |
| `ngoai-don` (ngoài đơn) | Không chỉ ra được REQ nào | **Không làm.** Ghi vào mục "Hướng phát triển" của `TASKS.md` |
| `no-ky-thuat` (nợ kỹ thuật) | Làm cho gọn hơn, không đổi hành vi người dùng | Đề xuất P2, chỉ làm khi còn thời gian |

**Sửa nhỏ** nghĩa là đủ cả 3 điều: không thêm model, route hay collection mới; không đổi request/response của API đã có; sửa không quá 3 file (không tính file test).

Agent **không tự thêm task vào bảng chính**. Ai duyệt:
- `bat-buoc` là sửa nhỏ: người phụ trách task tự duyệt, chỉ cần ghi trong PR.
- `bat-buoc` không phải sửa nhỏ, `chi-tiet`, `ngoai-don`: ghi vào "Đề xuất thay đổi kế hoạch", Janet duyệt bằng Prompt E rồi mới lên bảng.
- `no-ky-thuat`: người phụ trách ghi đề xuất, Janet duyệt gom một lần mỗi mốc Review.

Mỗi task gắn **ít nhất một** mã REQ. Task hạ tầng thuần (Node, test, dọn file) gắn `NEN` kèm REQ mà nó mở đường, ví dụ `NEN (C-07)`.

## Bảng REQ

| Mã REQ | Dòng trong đơn | Diễn giải tiếng Việt | Đạt khi | Phủ | Task | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- |
| C-01 | Register & Login | Ứng viên đăng ký, đăng nhập bằng email hoặc Google OAuth. | Người mới đăng ký bằng email (xác thực email) và bằng Google, đăng nhập, được làm mới phiên và đăng xuất được trên staging (nháp) | Có sẵn + task | N-01 | Có sẵn: `backend/src/routes/auth.js` (`/register`, `/login`, `/google`, `/refresh`), `frontend/src/app/pages/auth/Login.jsx`, `Register.jsx`. N-01 chỉ bật `REFRESH_TOKEN_PEPPER` trên production |
| C-02 | Manage Candidate Profile | Ứng viên quản lý thông tin cá nhân, vị trí mục tiêu, nhiều CV và xem kết quả năng lực đã được hệ thống xác thực. | CẦN CHỐT: "verified competency results" gồm những nguồn nào (phỏng vấn AI, buổi mentor, khóa học) và thế nào thì một năng lực được coi là "đã xác thực". Phần chắc chắn: ứng viên sửa thông tin và vị trí mục tiêu, có ≥ 2 CV với đúng 1 CV mặc định | Có sẵn + task | PR-01, PR-02, PR-06, PR-07, PR-10, PR-11 | Có sẵn phần thông tin cá nhân: `frontend/src/app/pages/account/Profile.jsx`, `PATCH /api/auth/me`. Chưa có trước capstone: vị trí mục tiêu, kho nhiều CV, năng lực đã xác thực |
| C-03 | Practice AI Interview | Ứng viên trả lời câu hỏi của avatar AI, được chấm theo SHRM/DDI; câu doanh nghiệp được chèn vào buổi thì chấm thêm theo rubric của doanh nghiệp đó (quyết định JB-06, JB-07 ngày 23/11/2026, thay quyết định 9). | Ứng viên làm một buổi với avatar, trang feedback hiện điểm từng câu theo năng lực SHRM/DDI; câu doanh nghiệp hiện thêm tên doanh nghiệp và điểm rubric, câu khác thì không (nháp) | Có sẵn + task | JB-06, JB-07, JB-14, AI-13 | Có sẵn: `backend/src/routes/interviews.js` (`/sessions`, `/evaluate`), `frontend/src/app/pages/interview/InterviewRoom.jsx`, `InterviewFeedback.jsx`, chấm SHRM/DDI ở `backend/src/services/interviewQuestionService.js`. Phần rubric công ty là task |
| C-04 | JD Best-Fit Matcher & CV Editor | Ứng viên so nhiều CV với một JD, xem khoảng thiếu, sửa CV theo gợi ý AI và xuất PDF. | Ứng viên chọn 3 CV và dán một JD, thấy xếp hạng CV hợp nhất kèm khoảng thiếu, áp một gợi ý AI vào CV, lưu và tải PDF tiếng Việt đúng dấu (nháp) | Có sẵn + task | PR-05, PR-08, PR-09, PR-12, PR-13 | Có sẵn so 1 CV với 1 JD, khoảng thiếu và gợi ý: `backend/src/routes/cvMatch.js` (`/analyze`, `/analyze/full`, `/analyze/suggestions`), `frontend/src/app/pages/cv/CVAnalysisHub.jsx`, `cv_jd_matching/`. ⚠️ Cả 5 task bổ sung đều P1 |
| C-05 | Browse Job Posts & Apply | Ứng viên xem job của công ty đối tác, xem khoảng thiếu so với từng job, trả lời câu của doanh nghiệp trong phỏng vấn AI (chọn job từ gợi ý "job quan tâm gần đây" trước khi vào phòng, hoặc câu được chèn ngẫu nhiên; mọi gói, quyết định JB-06 ngày 23/11/2026, thay quyết định 12) và ứng tuyển kèm CV. | Ứng viên gói free lọc danh sách job, mở một job thấy khoảng thiếu, chọn job đó ở gợi ý trước phòng phỏng vấn AI và trả lời câu của doanh nghiệp, ứng tuyển kèm CV và ô đồng ý, thấy đơn ở `/my-applications` (nháp) | Có task | JB-03, JB-05, JB-06, JB-08, JB-11, JB-12, JB-13, JB-20, JB-21 | |
| C-06 | Request Mentorship | Ứng viên chọn mentor và job mục tiêu (job không bắt buộc, quyết định 5), gửi hồ sơ để được buổi đánh giá 0đ (giới hạn theo quyết định 13). | Ứng viên gửi yêu cầu mentor có chọn job kèm CV; mentor được chọn tạo buổi đánh giá 0đ; ứng viên thấy buổi đó trong lịch và bị chặn khi tạo buổi 0đ thứ hai lúc buổi đầu chưa xong (nháp) | Có sẵn + task | LP-05, LP-06, LP-18 | Có sẵn: `backend/src/routes/mentorshipRequests.js` (đăng yêu cầu, nhận đề nghị, chọn mentor, tải CV/JD), `frontend/src/app/pages/mentorship/MentorshipRequests.jsx`. Chưa có: buổi 0đ, chọn job |
| C-07 | Follow Learning Path | Ứng viên xem và trả trọn gói lộ trình của mentor (quyết định 1), đặt và học từng buổi, xem feedback, học lại buổi chưa đạt (quyết định 2) và theo dõi tiến độ. | Ứng viên yêu cầu sửa rồi chấp nhận lộ trình 3 buổi, chuyển khoản trọn gói được SePay tự xác nhận, đặt từng buổi, xem feedback, học lại miễn phí buổi chưa đạt và thấy lộ trình chuyển `completed` (nháp) | Có task | LP-02, LP-03, LP-04, LP-08, LP-09, LP-10, LP-12, LP-18, LP-19, LP-22, N-06 | |
| C-08 | Enroll in Courses | Ứng viên mua và xem khóa học video do mentor tạo. | Ứng viên mua một khóa bằng chuyển khoản, vào `/courses/:id/learn` xem bài, thoát ra vào lại vẫn giữ tiến độ (nháp) | Có sẵn | | Có sẵn: `backend/src/routes/courses.js` (`POST /:id/enroll`), `backend/src/routes/enrollments.js`, `backend/src/routes/cart.js`, `frontend/src/app/pages/courses/CourseDetail.jsx`, `CourseLearning.jsx`, `MyCourses.jsx` |
| C-09 | Track Progress & Recommendations | Ứng viên xem lịch sử phỏng vấn, bảng tiến độ và gợi ý mentor, khóa học, job. | Ứng viên mở `/dashboard` thấy lịch sử phỏng vấn (không tính buổi bỏ dở), tiến độ, và gợi ý mentor, khóa, job, mỗi gợi ý có một dòng lý do và bấm vào được (nháp) | Có sẵn + task | N-07, AI-10, AI-11 | Có sẵn lịch sử và dashboard: `GET /api/interviews/sessions` (`backend/src/routes/interviews.js`), `frontend/src/app/pages/account/Dashboard.jsx`. ⚠️ Phần gợi ý (AI-10, AI-11) là P1 |
| C-10 | Rate, Review & Report | Ứng viên đánh giá mentor, báo cáo mentor, nội dung không phù hợp hoặc kết quả AI sai. | Ứng viên đánh giá mentor sau buổi, báo cáo một mentor và một khóa, báo sai một kết quả AI rồi thấy nhãn "Đang chờ kiểm định" trên trang feedback (nháp) | Có sẵn + task | N-10, JB-04 | Có sẵn: `backend/src/routes/reviews.js`, `POST /api/bookings/:id/review`, `backend/src/routes/reports.js`, `backend/src/models/Report.js` (`targetType` có `mentor`, `course`, `review`, `interview_question`, `interview_evaluation`). N-10 thêm nút báo sai AI; JB-04 thêm báo cáo job |
| M-01 | Manage Availability | Mentor đặt khung giờ rảnh và giá buổi. | Mentor đặt khung giờ và gửi đổi giá; ứng viên đặt lịch chỉ thấy giờ còn trống và đúng giá đã duyệt (nháp) | Có sẵn | | Có sẵn: `backend/src/routes/mentors.js` (`PATCH /me/availability`, `/me/availability/block`), `backend/src/routes/mentor.js` (`/request-price-change`), `Mentor.pricing` trong `backend/src/models/Mentor.js`, `frontend/src/app/pages/mentor/MentorSchedule.jsx` |
| M-02 | Assess Candidate | Mentor xử lý yêu cầu mentor và đánh giá ứng viên trong buổi đánh giá 0đ. | Mentor gửi đề nghị cho một yêu cầu, được chọn, tạo buổi 0đ và sau buổi ghi đánh giá đầu vào theo bộ tiêu chí LP-01 (nháp) | Có sẵn + task | LP-01, LP-04, LP-05, LP-06, LP-21 | Có sẵn phần xử lý yêu cầu: `POST /api/mentorship-requests/:id/offers` (`backend/src/routes/mentorshipRequests.js`). Buổi 0đ và form đánh giá là task |
| M-03 | Build Learning Path | Mentor soạn lộ trình từng buổi dựa trên hồ sơ ứng viên và job mục tiêu (có job thì lấy `requiredCompetencies` làm khung, quyết định 5). | Mentor mở trình soạn, thấy hồ sơ ứng viên và năng lực yêu cầu của job (nếu có), soạn lộ trình 3 buổi có mục tiêu, năng lực và giá trọn gói, rồi gửi cho ứng viên (nháp) | Có task | LP-03, LP-07, LP-20, LP-23 | Phần "dựa trên hồ sơ và job mục tiêu" do LP-23 (P1) bao, thêm theo đề xuất `chi-tiet` đã duyệt 22/11/2026 |
| M-04 | Session Feedback & Retake | Mentor ghi feedback sau mỗi buổi, đánh đạt hoặc chưa đạt, và dạy lại buổi chưa đạt (miễn phí 1 lần, quyết định 2). | Mentor đánh "không đạt" một buổi kèm feedback, hệ thống tạo buổi học lại 0đ; mentor đánh "đạt" buổi học lại thì ứng viên đặt được buổi tiếp theo (nháp) | Có sẵn + task | LP-01, LP-13, LP-21 | Có sẵn feedback sau buổi mentor thường: `frontend/src/app/pages/mentor/MentorSessionFeedback.jsx`. Đạt/chưa đạt và học lại là task |
| M-05 | Create & Manage Courses | Mentor tạo và sửa nội dung khóa học video. | Mentor tạo khóa có ít nhất một video, sửa nội dung và gửi duyệt (nháp) | Có sẵn | | Có sẵn: `backend/src/routes/courses.js` (`POST /`, `PUT /:id`, `PATCH /:id/publish`), `frontend/src/app/pages/mentor/MentorCourseManagement.jsx`, `MentorCourseEdit.jsx` |
| M-06 | View Earnings | Mentor theo dõi thu nhập (ghi khi mỗi buổi `done`, quyết định 3) và gửi yêu cầu rút tiền. | Mentor thấy thu nhập từng buổi, kể cả buổi lộ trình (0đ cho buổi 0đ và học lại), chuyển từ đang chờ sang khả dụng, rồi gửi yêu cầu rút tiền (nháp) | Có sẵn + task | LP-09, LP-14 | Có sẵn: `backend/src/routes/mentor.js` (`/finance`, `/payout`, `/payouts`), `backend/src/services/mentorEarningsService.js`, `frontend/src/app/pages/mentor/MentorFinance.jsx`. Thu nhập theo lộ trình là task |
| A-01 | Manage Users & Mentors | Admin duyệt mentor mới, tạm khóa và mở lại tài khoản. | Admin duyệt một mentor mới, khóa một tài khoản (tài khoản đó không đăng nhập được) rồi mở lại (nháp) | Có sẵn + task | N-09, N-13 | Có sẵn: `backend/src/routes/admin.js` (`/mentors/:id/status`, `/mentors/:id/reject`, `/users/:id/status`), `frontend/src/app/pages/admin/AdminMentorsPending.jsx`, `AdminUsers.jsx`. N-09 gỡ số liệu giả; N-13 đổi nhãn vai trò |
| A-02 | Manage Partner Companies | Admin tạo công ty đối tác và mời Company Moderator (1 người cho MVP, quyết định 7; email đã có role khác thì từ chối, quyết định 14). | Admin tạo công ty và mời Company Moderator qua email; người nhận đặt mật khẩu, đăng nhập được và vào thẳng `/company`; mời email đã có role khác thì bị từ chối (nháp) | Có task | CO-01, CO-02, CO-10, CO-11, N-06 | CO-02 thêm điều khoản đồng ý dùng rubric ẩn danh (quyết định AI-18) |
| A-03 | Moderate Reviews & Reports | Admin ẩn/hiện đánh giá và xử lý báo cáo lạm dụng. | Admin ẩn rồi hiện lại một đánh giá trên trang mentor và đóng một báo cáo lạm dụng kèm ghi chú (nháp) | Có sẵn | | Có sẵn: `backend/src/routes/admin.js` (`/reviews/:id/visibility`, `GET /reports`, `PATCH /reports/:id`), `frontend/src/app/pages/admin/AdminReviews.jsx`, `AdminSupport.jsx` |
| A-04 | Reconcile Payments & Refunds | Admin xác nhận chuyển khoản (tự động qua webhook, thủ công khi lỗi), xử lý hoàn tiền, tranh chấp và chi trả mentor. | Admin thấy một giao dịch tự khớp qua webhook, xác nhận tay một chuyển khoản lộ trình, xử lý một yêu cầu hoàn tiền và duyệt một yêu cầu rút tiền của mentor (nháp) | Có sẵn + task | LP-10, LP-11, LP-15, LP-22 | Có sẵn: `POST /api/payments/webhook/sepay` (`backend/src/routes/payments.js`), `backend/src/routes/admin.js` (`/cart-orders/:id/confirm-transfer`, `/bookings/:id/confirm-refund`, `/payouts/:id/approve`, `/finance/reconciliation`), `frontend/src/app/pages/admin/AdminFinanceOperations.jsx`. LP-15 (hoàn khi hủy lộ trình) là P1 |
| A-05 | Monitor Platform Finance | Admin theo dõi doanh thu từ lộ trình, khóa học và gói. | Admin xem doanh thu tách theo lộ trình, khóa học và gói; số khớp tổng Payment trên DB, không cộng trùng booking lộ trình (nháp) | Có sẵn + task | N-08, N-09, LP-16 | Có sẵn doanh thu khóa và gói: `backend/src/routes/admin.js` (`/finance/platform-summary`, `/finance/courses`, `/finance/subscriptions`). Doanh thu lộ trình và theo nguồn là task |
| PM-01 | Review Question Bank | Platform Moderator xem, sửa, duyệt hoặc khai tử câu hỏi do AI sinh; duyệt tầng hai câu doanh nghiệp đã được doanh nghiệp duyệt (quyết định CO-16 ngày 23/11/2026). | Platform Moderator sửa, duyệt và khai tử một câu hỏi AI sinh; câu bị khai tử không xuất hiện trong buổi phỏng vấn mới; câu doanh nghiệp chỉ vào phỏng vấn sau khi Platform Moderator duyệt (nháp) | Có sẵn + task | N-13, CO-16 | Có sẵn: `backend/src/routes/moderator.js` (`/questions`, `PATCH /questions/:id`, `/approve`, `/deprecate`), `frontend/src/app/pages/moderator/ModeratorQuestions.jsx`. N-13 chỉ đổi nhãn vai trò |
| PM-02 | Approve Company Rubrics | Platform Moderator kiểm rubric công ty theo khung SHRM/DDI trước khi dùng (status riêng `pending_review`, không qua ModerationItem). | CẦN CHỐT: "validate against the SHRM/DDI framework" kiểm những gì (mỗi tiêu chí map đúng một key năng lực? tổng trọng số? mô tả từng mức?). Phần chắc chắn: Platform Moderator duyệt hoặc từ chối kèm ghi chú một rubric `pending_review`, công ty thấy trạng thái mới | Có task | CO-08, CO-09, CO-15, N-06 | |
| PM-03 | Review Queue | Platform Moderator xử lý câu hỏi và kết quả chấm AI bị báo sai hoặc thiếu. | Platform Moderator nhận một item báo sai trong hàng đợi và chấm lại; ứng viên thấy điểm moderator thay điểm AI (nháp) | Có sẵn + task | N-10, JB-04 | Có sẵn: `backend/src/routes/moderator.js` (`/queue`, `/queue/:id/claim`, `/queue/:id/resolve`), `backend/src/services/moderationQueueService.js`, `frontend/src/app/pages/moderator/ModeratorQueue.jsx`. N-10 nối phía ứng viên; JB-04 giữ hàng đợi chỉ 3 loại phỏng vấn |
| PM-04 | Approve AI Improvements | Platform Moderator duyệt cải tiến sinh câu và chấm điểm rút ra từ kết quả kiểm định. | Platform Moderator mở một đề xuất cải tiến có bằng chứng và bảng điểm trước/sau, duyệt thì buổi mới chạy prompt mới, rollback thì trở về bản trước (nháp) | Có task | AI-02, AI-05, AI-06, AI-18, N-06 | |
| PM-05 | Approve Courses & Job Posts | Platform Moderator duyệt cuối khóa học đã được AI sàng lọc; ẩn job bị báo cáo (job không cần duyệt trước, quyết định 8). | Platform Moderator duyệt một khóa có nhãn sàng lọc AI và ẩn một job bị báo cáo; job bị ẩn biến khỏi `/jobs` (nháp) | Có sẵn + task | JB-04, JB-17, AI-09, N-06 | Có sẵn duyệt khóa: `backend/src/routes/moderator.js` (`/courses/pending`, `/courses/:id/approve`, `/reject`), `frontend/src/app/pages/admin/AdminContentCourses.jsx`. ⚠️ Phần "AI-prescreened" (AI-08, AI-09) là P1 |
| PM-06 | Quality Dashboard | Platform Moderator theo dõi chỉ số chất lượng AI và kết quả kiểm định. | Platform Moderator mở Quality Dashboard thấy tỉ lệ đồng thuận AI–moderator, số item chờ và so sánh theo version prompt; số khớp truy vấn tay (nháp) | Có sẵn + task | AI-07 | Có sẵn: `GET /api/moderator/quality/stats` (`backend/src/routes/moderator.js`), `backend/src/services/moderationQualityService.js`, `frontend/src/app/pages/moderator/ModeratorQuality.jsx`. AI-07 (P1) thêm số liệu rubric và so sánh theo version |
| CM-01 | Review Interview Questions | Company Moderator duyệt, sửa hoặc từ chối câu hỏi AI sinh cho vị trí của công ty (bộ 8–12 câu nháp theo `roleCategory`, quyết định 11), hoặc tải câu lên theo job; câu đã duyệt chuyển Platform Moderator duyệt tầng hai (quyết định CO-16 ngày 23/11/2026). | Company Moderator sinh bộ câu nháp cho một vị trí hoặc tải câu lên cho một job, sửa, duyệt và từ chối câu; câu đã duyệt chờ Platform Moderator; Company Moderator công ty khác không thấy các câu này (nháp) | Có task | N-02, N-03, N-04, CO-03, CO-04, CO-05, CO-12, CO-13, CO-16, N-13 | N-02..N-04, CO-03, CO-12 là `NEN (CM-01)` (role, `companyId`, phân quyền, khung `/company`) |
| CM-02 | Build Company Rubric | Company Moderator định nghĩa tiêu chí chấm riêng của công ty cho các câu đã duyệt. | Company Moderator soạn rubric (tiêu chí, trọng số tổng 100%, năng lực, mô tả từng mức, câu áp dụng) và gửi duyệt; bị từ chối thì thấy lý do và sửa gửi lại được (nháp) | Có task | CO-07, CO-14 | |
| CM-03 | Manage Job Posts | Company Moderator đăng và đóng job kèm năng lực yêu cầu. | Company Moderator đăng một job có năng lực yêu cầu và rubric đã duyệt, rồi đóng job; job đóng không còn nhận đơn (nháp) | Có task | JB-01, JB-02, JB-15 | |
| CM-04 | Review Applications | Company Moderator xem CV, hồ sơ đã xác thực và câu trả lời chấm theo rubric của ứng viên; shortlist hoặc từ chối. | Company Moderator mở một đơn, xem CV, thẻ năng lực, chỉ số của ứng viên với doanh nghiệp (số câu đã trả lời, điểm từng tiêu chí rubric) và câu trả lời kèm điểm rubric, bấm shortlist; ứng viên nhận thông báo (nháp) | Có task | PR-07, JB-09, JB-16, JB-19, N-06 | |
| AIS-01 | Generate Interview Questions | AI sinh câu hỏi bám khung SHRM/DDI, cá nhân hóa theo CV và job. | Buổi luyện có CV và job sinh câu follow-up gắn key năng lực có trong bộ tiêu chí LP-01 và nhắc tới nội dung cụ thể của CV hoặc job (nháp) | Có sẵn + task | CO-04, JB-06 | Có sẵn sinh câu theo SHRM/DDI và CV/JD: `backend/src/services/interviewQuestionService.js`, `POST /api/interviews/sessions/:id/generate-followup-questions`. Theo job và câu công ty là task |
| AIS-02 | Evaluate Answers | AI chấm câu trả lời theo SHRM/DDI và rubric công ty, kèm bằng chứng. | Mỗi câu trả lời có điểm từng năng lực SHRM/DDI; câu doanh nghiệp có thêm điểm rubric, mỗi điểm kèm trích dẫn có thật trong transcript; điểm trên bộ 20 câu chuẩn AI-01 có độ lệch được ghi lại (nháp) | Có sẵn + task | LP-01, AI-01, JB-07, AI-13 | Có sẵn chấm SHRM/DDI: `POST /api/interviews/sessions/:id/evaluate` (`backend/src/controllers/interviewsController.js`). Rubric công ty và trích dẫn bằng chứng là JB-07 |
| AIS-03 | Multi-modal Behavioral Analysis | AI phân tích giọng nói, ánh mắt, độ ổn định đầu và nét mặt theo thời gian thực. | Trong buổi phỏng vấn, chỉ số giọng (khoảng lặng, độ to, độ trễ), ánh mắt, độ ổn định đầu và cảm xúc được ghi theo từng câu và hiện trên trang feedback (nháp) | Có sẵn | | Có sẵn: `answers[].behavioralData` trong `backend/src/models/InterviewSession.js` (giọng: `silenceRatio`, `avgAmplitude`, `responseLatencyMs`; `eyeContactScore`, `headStabilityScore`; `emotion` từ Google Vision), `POST /api/interviews/sessions/:id/analyze-face`, `frontend/src/app/hooks/useFaceAnalysis.js` |
| AIS-04 | AI Avatar Pipeline | Chuyển văn bản thành giọng nói và video lip-sync cho người phỏng vấn ảo. | Câu hỏi được đọc bằng video avatar lip-sync; khi ElevenLabs lỗi (mất cả giọng lẫn video), buổi vẫn chạy bằng giọng trình duyệt và ảnh tĩnh (nháp) | Có sẵn + task | CO-06, AI-14, AI-15, AI-17 | Có sẵn: `backend/src/services/avatarService.js`, `avatarProviders/` (ElevenLabs `POST /v1/flows/video`; D-ID gỡ ở AI-17), `ttsService.js`, `backend/src/config/baselineQuestions.js`, `POST /api/ai/interview/pregenerate`. CO-06 cache video câu công ty |
| AIS-05 | CV Validation & CV-JD Matching | Kiểm tra file tải lên có phải CV, trích kỹ năng và chấm độ khớp CV với JD. | Tải ảnh hoặc hóa đơn vào kho CV bị từ chối kèm lỗi tiếng Việt; CV thật được trích kỹ năng và chấm điểm khớp với JD (nháp) | Có sẵn + task | N-11, PR-03, PR-04, PR-05 | Có sẵn trích kỹ năng và chấm khớp: `cv_jd_matching/main.py`, `backend/src/routes/cvMatch.js`. ⚠️ Kiểm tra file là CV (PR-03, PR-04) là P1 |
| AIS-06 | Learning from Reviews | Dùng quyết định của moderator, và rubric công ty đã duyệt (ẩn danh, công ty đồng ý), để cải tiến sinh câu và chấm điểm (không fine-tune, đổi prompt qua `PromptVersion`; quyết định AI-18). | CẦN CHỐT: "Learning from Reviews" đo bằng gì (sau bao nhiêu lượt chấm lại thì sinh đề xuất; "cải tiến" phải giảm độ lệch so với bộ AI-01 bao nhiêu mới được duyệt). Phần chắc chắn: sau đủ ngưỡng lượt chấm lại, hệ thống tự tạo một đề xuất có bằng chứng | Có task | AI-01, AI-02, AI-03, AI-04, AI-18 | |
| AIS-07 | Profile Aggregation & Recommendations | Cập nhật hồ sơ năng lực của ứng viên và gợi ý mentor, khóa học, job. | CẦN CHỐT: hồ sơ năng lực gộp từ nguồn nào và quy tắc tính mức (liên quan đề xuất (k) trong `docs/capstone/TASKS.md`: hiện có 2 hệ thống năng lực song song). Phần chắc chắn: sau một buổi lộ trình "đạt", thẻ năng lực tương ứng cập nhật và ghi nguồn; mỗi gợi ý có một dòng lý do | Có task | N-07, PR-06, AI-10 | ⚠️ Phần gợi ý (AI-10) là P1 |
| AIS-08 | Course Pre-screening & Cost Monitoring | AI sàng lọc khóa học trước khi moderator duyệt; theo dõi chi phí AI và cảnh báo bất thường. | Mỗi khóa gửi duyệt có kết quả sàng lọc AI kèm cờ cụ thể; mỗi lời gọi AI ghi `CostEvent` và vượt ngưỡng ngày thì có cảnh báo Slack (nháp) | Có sẵn + task | AI-08, AI-12 | Có sẵn theo dõi chi phí và cảnh báo: `backend/src/services/costLedgerService.js` (Slack alert), `backend/src/models/CostEvent.js`, `GET /api/admin/cost-dashboard`. ⚠️ Sàng lọc khóa (AI-08) là P1 |
| NFR-01 | CV/JD analysis ≤ 60 seconds | Phân tích CV/JD trả kết quả trong tối đa 60 giây. | p95 thời gian phân tích trên 30 cặp CV/JD ≤ 60 giây, ghi trong `docs/report/nfr-results.md` (nháp) | Có task | N-11, QA-03 | Chưa có số đo |
| NFR-02 | Avatar video ≤ 130 seconds; cached almost instantly | Sinh video avatar cá nhân hóa tối đa 130 giây; video đã cache trả gần như ngay. | CẦN CHỐT: "almost instantly" là bao nhiêu giây với câu đã cache. Phần chắc chắn: p95 sinh video trên 20 câu mới ≤ 130 giây, ghi trong `nfr-results.md` | Có task | N-11, QA-03 | Chưa có số đo |
| NFR-03 | Bank transfers auto-reconciled within seconds | Chuyển khoản được đối soát tự động trong vài giây sau giao dịch. | CẦN CHỐT: "within seconds" là bao nhiêu giây. Cách đo: p95 từ lúc webhook SePay đến lúc Payment `success` trên 20 giao dịch, ghi trong `nfr-results.md` | Có sẵn + task | LP-10, QA-04 | Có sẵn đối soát tự động: `POST /api/payments/webhook/sepay`, `backend/src/services/sepayWebhookService.js`. Chưa có số đo (QA-04) |
| NFR-04 | At least 100 concurrent users | Chịu được tối thiểu 100 người dùng đồng thời (mục tiêu MVP). | CẦN CHỐT: ngưỡng p95 và tỉ lệ lỗi chấp nhận được. Cách đo: k6 100 người dùng đồng thời chạy kịch bản chính trên staging, ghi trong `nfr-results.md` | Có task | QA-01, QA-02 | Chưa có số đo |
| NFR-05 | No user facial video stored | Không lưu video khuôn mặt người dùng; chỉ giữ chỉ số phân tích hành vi. | Sau một buổi phỏng vấn, không có video hay ảnh khuôn mặt nào trong MongoDB, Cloudinary hay `public/uploads`; chỉ có số trong `behavioralData` (nháp) | Có sẵn | | Có sẵn: `analyzeFace` trong `backend/src/controllers/interviewsController.js` chỉ chuyển `imageBase64` sang Google Vision, không lưu; `InterviewSession` chỉ lưu `behavioralData` dạng số. Chưa có task kiểm chứng hay test |
| NFR-06 | Share candidate data only on apply with consent | Dữ liệu ứng viên chỉ chia sẻ cho công ty khi ứng viên ứng tuyển và đồng ý; rút đơn thì ẩn snapshot (quyết định 14). | Company Moderator không xem được hồ sơ ứng viên chưa ứng tuyển; ứng tuyển không tích ô đồng ý bị từ chối; rút đơn thì công ty chỉ còn thấy tên và "Đã rút" (nháp) | Có task | JB-08, JB-10 | |

## Task kiểm thử, tài liệu và NEN (*)

| Task | REQ | Căn cứ |
| --- | --- | --- |
| N-05 | NEN (*) | Node 22 + test glob, dùng cho mọi task backend |
| N-06 | NEN (C-07) (+A-02, CM-04, PM-02, PM-05, PM-04) | Các nhóm thông báo trong mô tả task: lộ trình, lời mời công ty, ứng tuyển, rubric, job bị ẩn, đề xuất AI |
| N-12 | NEN (*) | Sửa `CLAUDE.md` (quy trình) |
| N-13 | A-01 (+CM-01, PM-01) | Nhãn vai trò theo đơn trên các cổng |
| N-14 | NEN (*) | Dọn file, sửa `dev:full`. Giữ P2 |
| LP-17 | C-07 (+M-04, M-06) | Test integration trọn luồng lộ trình từ yêu cầu đến `completed` |
| QA-05 | AIS-06 (+A-02, CM-01, CM-02, CM-03, C-05, C-07, CM-04) | ≥ 5 lượt chấm lại để miner đủ ngưỡng; dữ liệu kịch bản demo |
| QA-06 | C-07 (+A-02, CM-01, CM-02, PM-02, C-05, C-03, CM-04, PM-03, PM-04) | Kiểm thử theo 7 bước kịch bản demo |
| QA-07 | C-02 (+C-04, C-05, C-07, CM-01, CM-02, CM-03, CM-04) | Responsive các màn hình mới |
| DOC-01 | C-01..AIS-08 | SRS: mọi dòng chức năng của đơn có use case |
| DOC-02 | C-07 (+C-05, NFR-06) | SDD Learning Path, Job Post, Ứng tuyển |
| DOC-03 | A-02 (+CM-01, CM-02, PM-02, C-02) | SDD Company, lời mời, duyệt câu, Rubric, Profile và kho CV |
| DOC-04 | AIS-02 (+AIS-06, AIS-07, AIS-08) | SDD chấm rubric, Learning from Reviews, hồ sơ năng lực, sàng lọc khóa |
| DOC-05 | NEN (*) | Hồ sơ Review BM01–BM04 của môn SWP490 |
| DOC-06 | C-01..CM-04 | Hướng dẫn sử dụng luồng chính của 5 vai trò |
| DOC-07 | C-07 (+A-02, CM-01, CM-02, PM-02, C-05, C-03, CM-04, PM-03, PM-04) | Kịch bản demo trên staging |

## Phần 3.2 của đơn

### Theory and practice (3.2a)

| Ý trong đơn | REQ bao |
| --- | --- |
| RESTful API | Mọi REQ chức năng (C-01..AIS-08) |
| JWT authentication | C-01 |
| Role-based access control (RBAC) | A-01, A-02, CM-01..CM-04, PM-01..PM-06, NFR-06 |
| NoSQL database design | Mọi REQ chức năng (MongoDB) |
| LLM prompt engineering and human-in-the-loop AI evaluation | AIS-01, AIS-02, AIS-06, PM-01, PM-03, PM-04, CM-01 |
| Text-to-speech and lip-sync API integration | AIS-04, NFR-02 |
| Computer vision for behavioral analysis | AIS-03, NFR-05 |
| NLP for CV/JD matching | AIS-05, C-04, NFR-01 |
| Webhook-based payment reconciliation | A-04, C-07, NFR-03 |
| Caching | AIS-04, NFR-02 |
| Web Audio/Web Speech API | AIS-03 (Web Audio), AIS-04 (Web Speech làm phương án dự phòng) |

### Products (3.2b)

| Ý trong đơn | REQ bao |
| --- | --- |
| Web Application: portals cho Candidate, Mentor, Admin, Platform Moderator, Company Moderator, có RBAC | C-01..C-10, M-01..M-06, A-01..A-05, PM-01..PM-06, CM-01..CM-04 |
| Backend API: authentication | C-01 |
| Backend API: profile | C-02 |
| Backend API: mentorship | C-06, C-07, M-02..M-04 |
| Backend API: job posts and applications | C-05, CM-03, CM-04 |
| Backend API: payment | A-04, C-07, C-08, M-06 |
| Backend API: notification services | Không REQ nào nêu trực tiếp. Bao gián tiếp qua các luồng có thông báo (CM-04 "shortlist", C-07, A-02) và task N-06 |
| AI Services Module: question generation, answer evaluation, behavioral analysis, CV-JD matching | AIS-01, AIS-02, AIS-03, AIS-05 |
| AI Avatar Pipeline | AIS-04 |

### Proposed Tasks (3.2c)

| Task package | REQ ứng với |
| --- | --- |
| 1. Candidate features (profile, AI interview, CV/JD, job posts and applications, courses, dashboard) | C-01, C-02, C-03, C-04, C-05, C-08, C-09, C-10, NFR-01, NFR-06 |
| 2. Personalized Mentorship Program (mentor assessment, learning path, session feedback, payment and payout) | C-06, C-07, M-02, M-03, M-04, M-06 |
| 3. Admin, Platform Moderator, Company Moderator (administration, payment reconciliation, question and rubric review, job posts, application review) | A-01..A-05, PM-01..PM-06, CM-01..CM-04, NFR-03 |
| 4. AI module (question generation, evaluation, learning from reviews, behavioral analysis, avatar pipeline, recommendations) | AIS-01, AIS-02, AIS-03, AIS-04, AIS-06, AIS-07, NFR-02, NFR-05 |

Các REQ không được nêu tên trong ngoặc của task package nào, chỉ được xếp theo vai trò:
- **M-01** (khung giờ và giá) và **M-05** (khóa học của mentor): xếp vào package 2 theo vai trò Mentor.
- **AIS-05** (CV validation): xếp vào package 4, cùng nhóm với "CV/JD" của package 1.
- **AIS-08** (sàng lọc khóa, theo dõi chi phí): xếp vào package 4.
- **C-10** (đánh giá, báo cáo): xếp vào package 1.
- **NFR-04** (100 người dùng đồng thời): không thuộc package nào, đo ở GĐ 6.

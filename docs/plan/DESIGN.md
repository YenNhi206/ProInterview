# ProInterview: Thiết kế cho phần capstone

> Tham chiếu khi làm task. Chi tiết field cuối cùng ghi vào `docs/LOGICAL_ERD.md` và `backend/DATABASE.md` khi code xong (theo Definition of Done).
> Đã đối chiếu mã nguồn 18/11/2026. Khi thấy lệch với code: tin code, ghi đề xuất vào `TASKS.md`.

## 1. Model mới (11)

| Model | Field chính | Chức năng trong đơn |
| --- | --- | --- |
| `CandidateProfile` | `userId` (unique), `headline`, `targetRoles[]`, `defaultCvId`, `competencies[]` {key SHRM, level, evidenceCount, sources[] {type: ai_interview \| mentor_session \| course, refId, at}} | #2, #9, #38 |
| `CVDocument` (hiện chỉ có `CVAnalysis`, chưa có model CV) | `userId`, `title`, `targetRole`, `fileUrl`, `content` (JSON cho editor), `skills[]`, `version`, `parentCvId`, `isDefault`, `isValidCv`, `lastAnalysisId`. Lưu file theo cách của `mentorshipDocumentsService` | #2, #4, #36 |
| `Company` | `name`, `slug`, `logoUrl`, `industry`, `status` active \| suspended, `createdBy` | #18 |
| `CompanyInvite` | `companyId`, `email`, `tokenHash`, `expiresAt`, `acceptedAt` | #18 |
| `CompanyRubric` | `companyId`, `roleCategory`, `version`, `status` draft \| pending_review \| approved \| rejected \| archived (Platform Mod duyệt qua status này, không dùng ModerationItem), `criteria[]` {key, name, weight, `shrmKey`, levels[] {score 0–5, descriptor}}, `questionIds[]`, `reviewNote` | #23, #29, #33 |
| `JobPost` | `companyId`, `title`, `roleCategory`, `level`, `location`, `description`, `requiredCompetencies[]` {shrmKey, minLevel}, `requiredSkills[]`, `rubricId`, `status`, `closesAt` | #5, #26, #30 |
| `Application` | `jobPostId`, `companyId`, `candidateId`, `cvId`, `practiceSessionId`, `consent` {at, scope}, `snapshot` {profile, rubricScores}, `status`, `history[]`; unique {jobPostId, candidateId} | #5, #31 |
| `LearningPath` | `candidateId`, `mentorId`, `mentorshipRequestId`, `jobPostId`, `assessmentBookingId`, `goal`, `status`, `totalAmount`, `platformFeeRate`, `paymentRef` (sinh bằng `utils/orderRef.js`), `version` | #6, #7, #12, #13, #16 |
| `LearningPathSession` | `pathId`, `order`, `title`, `objectives[]`, `shrmKeys: [String]`, `shareAmount`, `bookingId`, `attempt`, `retakeOf`, `outcome`, `feedback` {summary, strengths, improvements} | #13, #14 |
| `AIImprovementProposal` | `target` question_gen \| evaluation, `kind` few_shot \| prompt_change \| calibration, `evidence` {moderationItemIds[], overrideCount, avgScoreDelta}, `before`, `after`, `status` | #25, #37 |
| `PromptVersion` | Bảng đăng ký cho chuỗi `promptVersion` đã có: `key`, `version`, `template`, `fewShotExamples[]`, `active` | #25, #37 |

## 2. Model có sẵn cần sửa (12)

| Model | Thay đổi |
| --- | --- |
| `User` | Chỉ đổi giá trị role `enterprise` thành `company_moderator` (KHÔNG đụng giá trị gói `enterprise`); thêm `companyId`; script migrate |
| `Booking` | `sessionType` thêm `assessment`; thêm `learningPathId`, `learningPathSessionId`; `paymentMethod` thêm `learning_path`; **sửa index unique `mentorshipRequestId`** (loại `assessment` và booking có `learningPathId`) kèm script drop và sync index trên DB thật. Booking lộ trình: `paymentStatus: "paid"`, `price = totalAmount = shareAmount`, `platformFee = round(shareAmount × rate)`, `vat = 0` |
| `MentorshipRequest` | Thêm `jobPostId`, `assessmentBookingId`; status thêm `assessing`, `path_proposed`; sửa điều kiện `status === "selected"` ở `mentorshipRequestsService.js:125`. Mở rộng router `/api/mentorship-requests` |
| `Payment` | `type` thêm `learning_path`, `referenceModel` LearningPath |
| `SepayWebhookEvent` | `entityType` thêm `learning_path` |
| `Notification` | `type` thêm các loại: lộ trình, ứng tuyển, lời mời công ty, rubric, job bị ẩn, cải tiến AI |
| `CostEvent` | kind thêm `rubric_scoring`, `course_prescreen` |
| `InterviewSession` | Thêm `jobPostId`, `companyId`, `rubricId`; mỗi answer thêm `rubricScores[]` {criterionKey, score, evidenceQuote}; `questionsAllowed` riêng cho buổi theo job (5 free / 7 Pro). `promptVersion` đã có, không thêm |
| `QuestionBank` | `orgId` đổi `ref` từ `"Organization"` sang `"Company"`; câu công ty dùng `source: org_template`. **Dùng lại** `status` (`draft`, `rejected` đã có) và `roleCategory` (đã có index), không thêm field mới |
| `Course` | Thêm `aiPrescreen` {status, flags[], score, model, at} |
| `Report` | `targetType` thêm `job_post` |
| `ModerationItem` | `type` thêm `job_post_report`, `course_prescreen`, `ai_improvement`; sửa `createItemForReport` map đúng loại; hàng đợi HITL lọc theo 3 loại cũ |

## 3. State machine mới

| Đối tượng | Trạng thái và ai chuyển |
| --- | --- |
| LearningPath | `draft` (mentor soạn) → `proposed` → `revision_requested` (ứng viên) → `proposed`; `proposed` → `pending_payment` (ứng viên chấp nhận) → `active` (SePay/admin) → `completed` (buổi cuối đạt); `active` → `cancelled` (hoàn phần buổi chưa học) |
| LearningPathSession | `planned` → `scheduled` (tạo Booking) → `done`; outcome `passed` → mở buổi kế; `not_passed` → tạo buổi `retakeOf`, `attempt + 1` |
| JobPost | `draft` → `published` → `closed` (Company Mod hoặc hết hạn); `published` → `hidden` → `published` (Platform Mod) |
| Application | `submitted` → `viewed` → `shortlisted` \| `rejected`; `submitted`/`viewed` → `withdrawn` (ứng viên) |
| CompanyRubric | `draft` → `pending_review` → `approved` \| `rejected` → `draft`; `approved` → `archived` khi có version mới |
| AIImprovementProposal | `proposed` → `approved` (kích hoạt PromptVersion) \| `rejected`; `approved` → `rolled_back` |

Luồng Learning Path: gửi yêu cầu (+ job tùy chọn) → buổi đánh giá 0đ → mentor soạn lộ trình (ứng viên có thể yêu cầu sửa) → chấp nhận + trả tiền (SePay xác nhận) → học buổi N → đạt? Không đạt thì dạy lại buổi đó → còn buổi thì sang buổi kế, hết buổi thì hoàn thành và cập nhật hồ sơ năng lực.

Nhớ cập nhật `docs/STATE_MACHINES.md` và kiểm tra các job có lọc theo status mới.

## 4. Chia tiền lộ trình

Ứng viên trả trọn gói T đồng cho n buổi. `mentorNetFromBooking` (`mentorEarningsService.js:21`) tính `totalAmount − platformFee` và KHÔNG đọc `platformFeeRate`, nên booking mỗi buổi phải ghi sẵn đủ các field tiền.

```
share_i = floor(T / n)                    với i < n
share_n = T − (n − 1) × floor(T / n)
```

- Ví dụ: T = 1.000.000đ, n = 3 → 333.333đ, 333.333đ, 333.334đ.
- Booking mỗi buổi: `price = totalAmount = shareAmount`, `platformFee = round(shareAmount × platformFeeRate)`, `vat = 0`, `paymentMethod = "learning_path"` (để báo cáo tài chính không cộng trùng với Payment của lộ trình), `paymentStatus = "paid"`.
- Buổi đánh giá 0đ và buổi học lại miễn phí: mọi field tiền bằng 0, mentor không nhận thêm.
- Thu nhập mentor mỗi buổi `done` = `totalAmount − platformFee`, qua `tryCreditMentorForCompletedBooking`.
- Hủy lộ trình: hoàn cho ứng viên = T − tổng `shareAmount` của các buổi đã `done`. Mentor giữ phần đã nhận. Các hàm hủy/vắng mặt cũ không được hoàn tiền từng buổi (LP-22).

## 5. API và màn hình

Quy trình thêm API của repo: model → service → controller → route → mount trong `app.js` → test integration → cập nhật `API_INDEX.md`.

| Nhóm | API chính | Màn hình FE |
| --- | --- | --- |
| Candidate Profile | `GET/PATCH /api/profile/me`; `GET /api/profile/me/competencies`; `GET/POST/PATCH/DELETE /api/cvs`, `POST /api/cvs/:id/duplicate`, `POST /api/cvs/:id/export-pdf` (backend `pdfkit` + font DejaVu như hóa đơn); `POST /api/cv/validate`; `POST /api/cv/best-fit` | `/profile`, `/cvs`, `/cvs/:id/edit` |
| Learning Path | Mở rộng `/api/mentorship-requests` (thêm `jobPostId`, `POST /:id/accept-assessment`); `POST/PATCH /api/learning-paths`; `POST /api/learning-paths/:id/propose`, `accept`, `request-revision`, `checkout`, `cancel`; `POST /api/learning-paths/:id/sessions/:sid/schedule`; `PATCH /api/learning-paths/:id/sessions/:sid/outcome`; target `learning_path` trong SePay webhook và xác nhận tay | Ứng viên: `/learning-paths`, `/learning-paths/:id`. Mentor: `/mentor/learning-paths`, `/mentor/learning-paths/:id/edit`, form trong `/mentor/session-feedback/:sessionId`. Admin: loại `learning_path` trong trang đối soát |
| Job Post & Application | `GET /api/jobs`, `GET /api/jobs/:id`, `GET /api/jobs/:id/gap`; `POST /api/jobs/:id/practice`; `POST /api/jobs/:id/apply`; `GET /api/applications/me`, `PATCH /api/applications/:id/withdraw`; Company: `POST/PATCH /api/company/jobs`, `PATCH /api/company/jobs/:id/status`, `GET /api/company/applications`, `PATCH /api/company/applications/:id/status`; Platform Mod: `PATCH /api/moderator/jobs/:id/visibility` | `/jobs`, `/jobs/:id`, `/my-applications`; `/company/jobs`, `/company/jobs/:id/edit`, `/company/applications`, `/company/applications/:id` |
| Company & Rubric | Admin: `POST/GET/PATCH /api/admin/companies`, `POST /api/admin/companies/:id/invites`; `POST /api/company-invites/:token/accept`; Company: `POST /api/company/questions/generate`, `GET /api/company/questions`, `PATCH /api/company/questions/:id`, `POST/PATCH /api/company/rubrics`, `POST /api/company/rubrics/:id/submit`; Platform Mod: `GET /api/moderator/rubrics`, `PATCH /api/moderator/rubrics/:id` | `/admin/companies`, `/admin/companies/:id`; `/company-invite/:token`; `/company`, `/company/questions`, `/company/rubrics`, `/company/rubrics/:id/edit`; `/moderator/rubrics` |
| Vòng AI | `GET /api/moderator/ai-improvements`, `PATCH /api/moderator/ai-improvements/:id` (approve \| reject \| rollback); job `aiImprovementMinerJob`; `GET /api/recommendations/me`; course prescreen chạy khi mentor gửi duyệt | `/moderator/ai-improvements`; khối gợi ý trên `/dashboard`; nhãn sàng lọc trên `/moderator/courses` |
| Dọn nợ | Bổ sung doanh thu theo nguồn vào analytics (các API analytics khác đã có); `POST /api/reports` từ trang feedback | Gỡ số liệu giả ở 4 trang admin + `UserJourneyPanel.jsx`; nút "Báo sai" + nhãn "Đang chờ kiểm định" trên `InterviewFeedback.jsx` |

## 6. Learning from Reviews (prompt có phiên bản, không fine-tune)

1. `aiImprovementMinerJob` chạy mỗi ngày, gom ModerationItem đã xử lý: điểm bị `override_score`, câu bị sửa hoặc khai tử.
2. Khi một tiêu chí bị sửa điểm đủ ngưỡng (mặc định 5), job tạo `AIImprovementProposal`: cặp câu trả lời + điểm moderator làm few-shot mới, hoặc độ lệch hiệu chỉnh.
3. Platform Mod xem bằng chứng, xem bảng trước/sau trên bộ 20 câu chuẩn (AI-01) và 10 câu trả lời cũ, rồi duyệt. Duyệt thì tạo `PromptVersion` mới và bật `active`.
4. InterviewSession vốn đã ghi `promptVersion`; Langfuse trace theo version; Quality Dashboard so sánh tỉ lệ bị sửa giữa các version; có rollback.

Two-tier HITL trong đơn: Company Mod duyệt câu theo công ty, Platform Mod duyệt rubric và cải tiến AI.

## 7. Bẫy đã tìm thấy trong code (đọc trước khi sửa vùng liên quan)

| Bẫy | Hậu quả nếu bỏ qua | Task xử lý |
| --- | --- | --- |
| Index unique `mentorshipRequestId` (`Booking.js:152`) cho mọi booking `pending` đến `completed`; index mới trùng tên `mentorshipRequestId_1` | Buổi thứ hai cùng yêu cầu lỗi `E11000`. Chỉ sửa schema thì MongoDB báo `IndexOptionsConflict`, index cũ vẫn chặn trên staging/production dù test memory-server xanh | LP-02 |
| `cancelMyBooking`, `cancelMentorBooking`, `processBookingNoShow`, `resolveMentorCancelBooking` xử lý mọi booking `paid` | Hoàn tiền từng buổi lộ trình, cộng thêm khoản hoàn của lộ trình | LP-22 |
| `mentorNetFromBooking` tính `totalAmount − platformFee`, không đọc `platformFeeRate` | Thiếu `platformFee` thì mentor nhận 100% | LP-04, LP-14 |
| `bookingStaleSweepJob` hủy booking `pending` chưa trả đã qua giờ | Hủy buổi lộ trình và buổi 0đ | LP-04 |
| `sepayWebhookService.findPendingTargets` chỉ nhận 5 loại; `parsePiOrderFromText` chỉ nhận mã `PI…` | Tiền lộ trình về mà không ai xác nhận | LP-10 |
| `mentorshipRequestsService.js:125` chỉ cho tạo booking khi `status === "selected"` | Thêm status mới làm luồng cũ lỗi 403 | LP-05 |
| `Notification.type` là enum | Loại mới bị Mongoose từ chối, không báo lỗi | N-06 |
| `interviewsController.js:476` trả `alreadyGenerated` khi ≥ 5 câu; `questionsAllowed` lấy theo quota | Pro không bao giờ nhận câu follow-up ở buổi theo job; buổi kết thúc sớm | JB-06 |
| `moderationQueueService.js:83` không lọc `type`; `createItemForReport` (dòng 39) map mọi `targetType` khác thành `evaluation_report` | Rubric và báo cáo job lọt vào hàng đợi phỏng vấn, sai loại | JB-04, CO-07 |
| `QuestionBank.orgId` đang `ref: "Organization"` | `populate` lỗi | CO-01 |
| Chữ `enterprise` vừa là role vừa là giá trị gói (`CVAnalysis.planAtTime`); role còn trong `usersSeed.json` | Tìm-thay hàng loạt làm hỏng gói; seed lại tạo role cũ | N-02, N-03 |
| `react-pdf` trong `package.json` chỉ là thư viện xem PDF | Không tạo được PDF ở FE | PR-09 |
| Frontend tự lưu `CVAnalysis` sau khi phân tích xong | Không ghi được `processing`, dễ tạo bản ghi trùng | N-11 |
| `_devOnlyGuard.js` chặn chạy trên production | Seed demo không chạy được trên production | QA-05 (demo trên staging) |
| `node --test` chỉ nhận glob từ Node 21; `render.yaml` chưa cố định Node | Test glob hỏng trên Render | N-05 |
| User free luyện theo job tạo video D-ID riêng mỗi buổi | Tốn credit D-ID | CO-06 |
| Trang câu hỏi của moderator đã lọc `orgId: null` (`questionBankService.js:272`) | Tin tốt: câu công ty không lẫn vào | |

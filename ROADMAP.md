# Lộ trình phát triển ProInterview (BE theo FE)

**Base URL API:** `/api` · **Auth:** `Authorization: Bearer <jwt>` (JWT Express), trừ route ghi rõ public/webhook.

Nguyên tắc: **đối chiếu từng màn** trong `frontend/src/app/pages/` *(nhóm theo thư mục: `auth/`, `booking/`, `mentor/`, …)* → implement endpoint dưới đây rồi nối `fetch` trong FE.

### Đồng bộ với `API_INDEX.md`

Hai file dùng **cùng contract**: mọi endpoint 📋 trong các bảng phase bên dưới đều có bản tổng hợp phẳng trong **[`API_INDEX.md`](./API_INDEX.md) — Phần C** (C.1–C.13). Ngược lại, mọi dòng Phần C đều được gán phase ở đây (hoặc mục *Bổ sung auth / mentor*).

| | `ROADMAP.md` | `API_INDEX.md` |
|:--|:-------------|:---------------|
| **Roadmap** | Bảng theo **phase + màn FE** | **Phần C** — cùng path/method |
| **Đã chạy** | Bảng “API đã có” | **Phần A** |
| **Ngoài Express** | Ghi nhắc Supabase / D-ID | **Phần B** |

Khi merge xong một route: cập nhật **Phần A** trong `API_INDEX`, đổi **📋 → ✅** ở đây.

---

## Ký hiệu

| Ký hiệu | Ý nghĩa |
|:--------|:--------|
| ✅ | Đã có route trong Express (chi tiết `API_INDEX.md` Phần A / file `routes/`) |
| 📋 | Chưa có route — cần code backend |
| 🔧 FE | Backend ✅ nhưng FE chưa nối đầy đủ hoặc còn fallback mock/Supabase |
| ✅ FE | FE đã gọi API Express cho luồng chính |
| `[AUTH]` | Cần đăng nhập |
| `[MENTOR]` | `role === "mentor"` |
| `[ADMIN]` | `role === "admin"` |

**Lưu ý:** Cột **Trạng thái** trong Phase 1–4 = **backend**. Tiến độ tích hợp FE: xem [Trạng thái Frontend](#trạng-thái-frontend-theo-domain).

---

## API đã có (Express) — tóm tắt nhanh

| Method | Endpoint | Ghi chú |
|:-------|:-----------|:--------|
| POST | `/api/auth/register` | |
| POST | `/api/auth/login` | |
| POST | `/api/auth/google` | |
| POST | `/api/auth/refresh` | |
| GET | `/api/auth/me` | `[AUTH]` |
| PATCH | `/api/auth/me` | `[AUTH]` — profile + đổi mật khẩu |
| POST | `/api/auth/logout` | `[AUTH]` |
| DELETE | `/api/auth/me` | `[AUTH]` |
| GET | `/api/auth/sessions` | `[AUTH]` |
| DELETE | `/api/auth/sessions/:sessionId` | `[AUTH]` |
| GET | `/api/mentors` | Public |
| GET | `/api/mentors/:id` | Public |
| GET | `/api/health` | |
| GET | `/api/users/dashboard-stats` | `[AUTH]` |
| PATCH | `/api/users/:id/role` | `[ADMIN]` — gán role (vd. mentor) |
| GET | `/api/admin/stats` | `[ADMIN]` |
| GET | `/api/admin/users` | `[ADMIN]` |
| GET | `/api/admin/users/:id` | `[ADMIN]` — chi tiết user + stats |
| GET | `/api/admin/bookings` | `[ADMIN]` |
| GET | `/api/admin/bookings/:id` | `[ADMIN]` — chi tiết booking |
| GET | `/api/admin/mentors` | `[ADMIN]` |
| GET | `/api/admin/mentors/:id` | `[ADMIN]` — chi tiết mentor |
| GET | `/api/admin/reports` | `[ADMIN]` |
| PATCH | `/api/admin/reports/:id` | `[ADMIN]` — cập nhật trạng thái báo cáo |
| PATCH | `/api/admin/users/:id/status` | `[ADMIN]` |
| PATCH | `/api/admin/mentors/:id/status` | `[ADMIN]` |
| POST | `/api/auth/presence` | `[AUTH]` — heartbeat trạng thái online |
| POST | `/api/analytics/events` | `[AUTH]` — ghi page view / hành động |
| GET | `/api/achievements`, `/api/achievements/:id` | Public — tin tức & hoạt động |
| GET | `/api/admin/analytics/user-behavior` | `[ADMIN]` — funnel / hành vi nền tảng |
| GET | `/api/admin/analytics/users/:id/journey` | `[ADMIN]` — hành trình từng user |
| PATCH | `/api/bookings/mentor/:id/check-in` | `[AUTH][MENTOR]` — webcam trước phòng họp |
| POST | `/api/upload/achievement-image` | `[AUTH][ADMIN]` |

Các nhóm endpoint theo phase (bookings, payments, plans, courses, enrollments, mentor, reviews, reports, notifications, …): xem **bảng Phase 1–4** bên dưới — cột **Trạng thái (BE)** đã đồng bộ với code hiện tại.

**Mở rộng sau Phase 4:** auth email, booking/payment CK, admin finance, `/api/ai/*`, **user presence**, **platform analytics**, **achievements** — xem [Phase 5 — Mở rộng](#phase-5--mở-rộng-đã-có-trong-code).

**Ngoài Express:** Avatar — D-ID qua FE (`useDIDStream`) và/hoặc proxy `/api/ai/*` (`API_INDEX.md` phần B). **CV:** Express `/api/cv/analyses` + proxy `/api/cv/analyze*` → Python `cv_jd_matching` (FE: `cvApi.js`, `CVAnalysis.jsx`).

---

## Phase 1 — Booking + thanh toán + dashboard (ưu tiên khách hàng)

**FE cần nối:** `Booking.jsx`, `SessionDetail.jsx`, `Checkout.jsx`, `Dashboard.jsx`

| Trạng thái (BE) | Method | Endpoint | Auth | Mô tả ngắn |
|:----------------|:-------|:---------|:-----|:-----------|
| ✅ | POST | `/api/bookings` | `[AUTH]` | Tạo lịch: `mentorId`, `date`, `timeSlot`, `sessionType`, `notes`, `price`… (khớp `Booking.jsx`) |
| ✅ | GET | `/api/bookings` | `[AUTH]` | Danh sách booking của user hiện tại |
| ✅ | GET | `/api/bookings/:id` | `[AUTH]` | Chi tiết 1 booking (session detail) |
| ✅ | DELETE | `/api/bookings/:id` | `[AUTH]` | Hủy — cập nhật `status` (vd. `cancelled`), giữ bản ghi nếu cần lịch sử |
| ✅ | PATCH | `/api/bookings/:id/reschedule` | `[AUTH]` | Dời lịch — body khớp reschedule trong schema `Booking` |
| ✅ | POST | `/api/payments/initiate` | `[AUTH]` | Tạo đơn MoMo/ZaloPay sandbox → trả `qr` / `payUrl` cho `Checkout.jsx` |
| ✅ | POST | `/api/payments/webhook/momo` | *(server secret / IP whitelist)* | Xác nhận thanh toán |
| ✅ | POST | `/api/payments/webhook/zalopay` | *(tương tự)* | |
| ✅ | POST | `/api/payments/webhook/sepay` | `Authorization: Apikey SEPAY_WEBHOOK_API_KEY` | Webhook tiền vào TPBank — tự xác nhận đơn `PI…` |
| ✅ | GET | `/api/payments/transfer-status` | Bearer JWT | Poll trạng thái CK (checkout SePay) |
| ✅ | GET | `/api/payments/history` | `[AUTH]` | *(tuỳ chọn)* Lịch sử giao dịch |
| ✅ | GET | `/api/plans/current` | `[AUTH]` | Plan + quota — khớp `Pricing` / hiển thị sau checkout |
| ✅ | POST | `/api/plans/activate` | `[AUTH]` | Kích hoạt plan sau payment (hoặc gộp vào webhook) |
| ✅ | POST | `/api/plans/cancel` | `[AUTH]` | Hủy / downgrade plan (khớp C.11) |
| ✅ | GET | `/api/users/dashboard-stats` | `[AUTH]` | Số liệu tổng hợp cho `Dashboard.jsx` (thay `mockData`) |

**Gợi ý model:** `backend/src/models/Booking.js`, `Payment.js`, `User.plan` (đã có field trên User).

---

## Phase 2 — Mentor vận hành + review + báo cáo

**FE cần nối:** `MentorDashboard`, `MentorSchedule`, `MentorMeetingDetail`, `MeetingRoom`, `MentorFinance`, `MentorAnalytics`, `MentorReviews`, `ReportMentorModal`

| Trạng thái (BE) | Method | Endpoint | Auth | Mô tả ngắn |
|:----------------|:-------|:---------|:-----|:-----------|
| ✅ | GET | `/api/bookings/mentor/list` | `[AUTH][MENTOR]` | Booking của mentor đăng nhập |
| ✅ | PATCH | `/api/bookings/:id/confirm` | `[AUTH][MENTOR]` | Xác nhận |
| ✅ | PATCH | `/api/bookings/:id/complete` | `[AUTH][MENTOR]` | Hoàn thành |
| ✅ | PATCH | `/api/bookings/:id/notes` | `[AUTH][MENTOR]` | Ghi chú sau buổi |
| ✅ | POST | `/api/bookings/:id/review` | `[AUTH]` | Alias gửi review theo booking — body `{ rating, comment?, tags? }` |
| ✅ | GET | `/api/mentors/:id/availability` | Public hoặc `[AUTH]` | Lịch rảnh (khớp C.2) |
| ✅ | GET | `/api/mentors/:id/reviews` | Public | Review theo mentor (khớp C.2) |
| ✅ | PATCH | `/api/mentors/me` | `[AUTH][MENTOR]` | Profile mentor (khớp C.2) |
| ✅ | PATCH | `/api/mentors/me/availability` | `[AUTH][MENTOR]` | Lịch rảnh (khớp C.2) |
| ✅ | PATCH | `/api/mentors/me/availability/block` | `[AUTH][MENTOR]` | Chặn ngày (khớp C.2) |
| ✅ | GET | `/api/mentor/dashboard` | `[AUTH][MENTOR]` | KPI — thay `mentorMockData` dashboard |
| ✅ | GET | `/api/mentor/finance` | `[AUTH][MENTOR]` | Thu nhập — thay `MentorFinance` mock |
| ✅ | GET | `/api/mentor/analytics` | `[AUTH][MENTOR]` | *(tuỳ chọn)* Biểu đồ |
| ✅ | POST | `/api/mentor/payout` | `[AUTH][MENTOR]` | Yêu cầu chi trả (khớp C.12) |
| ✅ | GET | `/api/reviews` | Public hoặc `[AUTH]` | Query: `?targetType=mentor&targetId=` — list review |
| ✅ | GET | `/api/reviews/mine` | `[AUTH]` | Đánh giá của user cho `targetType` + `targetId` |
| ✅ | POST | `/api/reviews` | `[AUTH]` | Tạo review sau session — thay `saveReview` local |
| ✅ | PATCH | `/api/reviews/:id/reply` | `[AUTH][MENTOR]` | Mentor trả lời |
| ✅ | DELETE | `/api/reviews/:id` | `[AUTH]` | Xóa review (owner / policy) |
| ✅ | GET | `/api/admin/reviews` | `[AUTH][ADMIN]` | Moderation — `?targetType`, `?visible`, `?limit` |
| ✅ | PATCH | `/api/admin/reviews/:id/visibility` | `[AUTH][ADMIN]` | Ẩn/hiện + recalc stats |
| ✅ | POST | `/api/reports` | `[AUTH]` | Báo cáo mentor — modal report |

---

## Phase 3 — Khóa học + ghi danh + tiến độ

**FE cần nối:** `Courses.jsx`, `CourseDetail.jsx`, `CourseLearning.jsx`, `MentorCourseManagement`, `MentorCourseEdit`

| Trạng thái (BE) | Method | Endpoint | Auth | Mô tả ngắn |
|:----------------|:-------|:---------|:-----|:-----------|
| ✅ | GET | `/api/courses` | Public | List + filter (khớp `Courses.jsx`) |
| ✅ | GET | `/api/courses/:id` | Public | Chi tiết — thay `getCourseById` tĩnh |
| ✅ | POST | `/api/courses/:id/enroll` | `[AUTH]` | Ghi danh — thay `localStorage` enroll |
| ✅ | GET | `/api/enrollments/my` | `[AUTH]` | Khóa học của tôi |
| ✅ | PATCH | `/api/enrollments/:id/progress` | `[AUTH]` | Cập nhật bài học đã xem — thay `PROGRESS_KEY` |
| ✅ | GET | `/api/enrollments/:id/certificate` | `[AUTH]` | URL / metadata chứng chỉ (khớp C.7) |
| ✅ | GET | `/api/courses/:id/lessons/:lessonId` | `[AUTH]` | *(tuỳ thiết kế)* Nội dung bài |
| ✅ | GET | `/api/courses/:id/lessons/:lessonId/qa` | `[AUTH]` | Danh sách Q&A bài học (học viên) |
| ✅ | POST | `/api/courses/:id/lessons/:lessonId/qa` | `[AUTH]` | Gửi câu hỏi — thay `localStorage` Q&A |
| ✅ | GET | `/api/courses/:id/lessons/:lessonId/notes` | `[AUTH]` | Ghi chú bài học (học viên) |
| ✅ | PUT | `/api/courses/:id/lessons/:lessonId/notes` | `[AUTH]` | Lưu ghi chú `{ content }` |
| ✅ | POST | `/api/courses` | `[AUTH][MENTOR]` | Tạo khóa |
| ✅ | PUT | `/api/courses/:id` | `[AUTH][MENTOR]` | Sửa khóa |
| ✅ | PATCH | `/api/courses/:id/publish` | `[AUTH][MENTOR]` | Xuất bản |
| ✅ | DELETE | `/api/courses/:id` | `[AUTH][MENTOR]` | Archive / xóa mềm |

**Gợi ý model:** `Course.js`, `Enrollment.js` (đã có file trong `backend/src/models/`).

---

## Phase 4 — CV trên BE + interview session + thông báo + upload

**FE cần nối:** `CVAnalysis.jsx` (migrate), `Interview*`, `AnalysisHistory`, `Settings`

| Trạng thái (BE) | Method | Endpoint | Auth | Mô tả ngắn |
|:----------------|:-------|:---------|:-----|:-----------|
| ✅ | POST | `/api/cv/analyses` | `[AUTH]` | Lưu kết quả phân tích (sau Python/Edge) |
| ✅ | GET | `/api/cv/analyses` | `[AUTH]` | Lịch sử |
| ✅ | GET | `/api/cv/analyses/:id` | `[AUTH]` | Chi tiết |
| ✅ | DELETE | `/api/cv/analyses/:id` | `[AUTH]` | Xóa |
| ✅ | GET | `/api/cv/quota` | `[AUTH]` | Quota còn — đồng bộ với `User.quota` |
| ✅ | POST | `/api/interviews/sessions` | `[AUTH]` | Tạo session phỏng vấn AI |
| ✅ | PATCH | `/api/interviews/sessions/:id` | `[AUTH]` | Cập nhật câu trả lời / transcript |
| ✅ | POST | `/api/interviews/sessions/:id/complete` | `[AUTH]` | Kết thúc + feedback |
| ✅ | GET | `/api/interviews/sessions` | `[AUTH]` | Lịch sử |
| ✅ | GET | `/api/interviews/sessions/:id` | `[AUTH]` | Chi tiết một session (khớp C.5) |
| ✅ | GET | `/api/notifications` | `[AUTH]` | Danh sách thông báo |
| ✅ | PATCH | `/api/notifications/:id/read` | `[AUTH]` | Đã đọc |
| ✅ | POST | `/api/notifications/read-all` | `[AUTH]` | Đánh dấu tất cả đã đọc *(trong code là `POST`, không phải `PATCH`)* |
| ✅ | DELETE | `/api/notifications/:id` | `[AUTH]` | Xóa thông báo |
| ✅ | GET | `/api/notifications/unread-count` | `[AUTH]` | Badge |
| ✅ | POST | `/api/upload/avatar` | `[AUTH]` | Upload ảnh → URL lưu `PATCH /me` `avatar` |
| ✅ | POST | `/api/upload/cv` | `[AUTH]` | Upload CV (nếu chuyển từ Edge) |
| ✅ | POST | `/api/upload/course-thumbnail` | `[AUTH][MENTOR]` | Ảnh bìa khóa học |

---

## Bổ sung auth — khớp API_INDEX C.1

**FE liên quan:** đăng xuất server-side (`tokenVersion` + refresh), xóa tài khoản (Settings / tương lai).

| Trạng thái (BE) | Method | Endpoint | Auth | Mô tả ngắn |
|:----------------|:-------|:---------|:-----|:-----------|
| ✅ | POST | `/api/auth/logout` | `[AUTH]` | Blacklist jti access + xóa refresh sessions |
| ✅ | POST | `/api/auth/refresh` | — (+ Bearer khuyến nghị) | Làm mới access; blacklist jti access cũ |
| ✅ | GET / DELETE | `/api/auth/sessions`, `/api/auth/sessions/:id` | `[AUTH]` | Phiên + fingerprint; `?currentSessionId=` |
| ✅ | DELETE | `/api/auth/me` | `[AUTH]` | Xóa tài khoản (Settings → Vùng nguy hiểm) |

*Ghi chú:* `change-password` không dùng — đã gộp `PATCH /api/auth/me` (xem Phần A trong `API_INDEX.md`).

**Auth bổ sung (có route, chưa liệt kê ở bảng trên):** `GET /api/auth/verify-email`, `POST /api/auth/resend-verification`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `POST /api/auth/presence`.

---

## Phase 5 — Mở rộng (đã có trong code)

Các endpoint triển khai sau Phase 1–4 gốc. Chi tiết contract: [`API_INDEX.md`](./API_INDEX.md) Phần A.

### Auth & mentors

| BE | Method | Endpoint | Auth |
|:---|:-------|:---------|:-----|
| ✅ | GET | `/api/auth/verify-email` | — |
| ✅ | POST | `/api/auth/resend-verification` | — |
| ✅ | POST | `/api/auth/forgot-password` | — |
| ✅ | POST | `/api/auth/reset-password` | — |
| ✅ | POST | `/api/auth/presence` | `[AUTH]` |
| ✅ | POST | `/api/mentors/apply` | `[AUTH]` |
| ✅ | GET | `/api/mentors/me` | `[AUTH]` |

### CV proxy Python (`cvMatch.js`)

| BE | Method | Endpoint | Auth |
|:---|:-------|:---------|:-----|
| ✅ | POST | `/api/cv/analyze` | `[AUTH]` |
| ✅ | POST | `/api/cv/analyze/full` | `[AUTH]` |
| ✅ | POST | `/api/cv/analyze/suggestions` | `[AUTH]` |
| ✅ | POST | `/api/cv/analyze/field` | `[AUTH]` |

### Payments & enrollments (chuyển khoản)

| BE | Method | Endpoint | Auth |
|:---|:-------|:---------|:-----|
| ✅ | POST | `/api/payments/subscription/transfer-pending` | `[AUTH]` |
| ✅ | PATCH | `/api/payments/subscription/:paymentId/submit-transfer` | `[AUTH]` |
| ✅ | GET | `/api/payments/vnpay/ipn` | — |
| ✅ | GET | `/api/payments/vnpay/vnpay-return` | — |
| ✅ | PATCH | `/api/enrollments/:id/submit-transfer` | `[AUTH]` |

### Coupons — mã giảm giá tại Checkout

| BE | Method | Endpoint | Auth |
|:---|:-------|:---------|:-----|
| ✅ | POST | `/api/coupons/validate` | `[AUTH]` — preview mã trước khi tạo đơn |

Áp dụng trực tiếp trong `createBooking`, `EnrollmentController.enroll`, `createSubscriptionTransferPending` qua field `couponCode` trong body — server tự tính lại `totalAmount`/`pricePaid`/`amount` sau giảm giá (không tin số tiền client gửi). Mỗi user dùng 1 lần/mã (`Coupon.usedBy`). Tạo mã: `npm run seed:coupon`. Chi tiết: **API_INDEX.md A.15**.

### Bookings mở rộng (một số tiêu biểu)

| BE | Method | Endpoint | Auth |
|:---|:-------|:---------|:-----|
| ✅ | PATCH | `/api/bookings/:id/submit-transfer` | `[AUTH]` |
| ✅ | PATCH | `/api/bookings/:id/start` | `[AUTH]` |
| ✅ | PATCH | `/api/bookings/mentor/:id/start` | `[AUTH][MENTOR]` |
| ✅ | PATCH | `/api/bookings/mentor/:id/check-in` | `[AUTH][MENTOR]` — body `{ imageUrl }` |
| ✅ | PATCH | `/api/bookings/mentor/:id/session-capture` | `[AUTH][MENTOR]` |
| ✅ | GET | `/api/bookings/mentor/:id` | `[AUTH][MENTOR]` |
| ✅ | GET | `/api/bookings/mentor/:id/booked-slots` | Public / mentor |
| ✅ | PATCH | `/api/bookings/mentor/:id/reschedule` | `[AUTH][MENTOR]` |
| ✅ | PATCH | `/api/bookings/mentor/:id/cancel` | `[AUTH][MENTOR]` |
| ✅ | PATCH | `/api/bookings/:id/refund-destination` | `[AUTH]` |
| ✅ | PATCH | `/api/bookings/:id/mentor-cancel-resolution` | `[AUTH]` |
| ✅ | POST | `/api/bookings/:id/report-no-show` | `[AUTH]` |
| ✅ | GET | `/api/bookings/:id/rebook-credit` | `[AUTH]` |
| ✅ | POST | `/api/bookings/:id/mentor-knowledge` | `[AUTH][MENTOR]` |

*Xem đầy đủ:* `backend/src/routes/bookings.js`.

### User presence & platform analytics

| BE | Method | Endpoint | Auth |
|:---|:-------|:---------|:-----|
| ✅ | POST | `/api/auth/presence` | `[AUTH]` — heartbeat; cập nhật `User.lastSeenAt` |
| ✅ | POST | `/api/analytics/events` | `[AUTH]` — batch `{ events: [{ type, route, action?, durationMs?, metadata? }] }` |
| ✅ | GET | `/api/admin/analytics/user-behavior` | `[ADMIN]` — query `?days=` funnel / top routes / actions |
| ✅ | GET | `/api/admin/analytics/users/:id/journey` | `[ADMIN]` — timeline hành trình user |

**Model:** `UserEvent.js` · **Service:** `analyticsService.js` · **FE:** `usePageAnalytics`, `useUserPresence`, `trackAction`, `AdminAnalytics`, `UserJourneyPanel`.

Admin list user/mentor trả thêm `isOnline`, `lastSeenAt` (cửa sổ 3 phút qua `userPresence.js`).

### Achievements (tin tức & hoạt động)

| BE | Method | Endpoint | Auth |
|:---|:-------|:---------|:-----|
| ✅ | GET | `/api/achievements` | Public — query `?all=true` (admin xem cả bản nháp) |
| ✅ | GET | `/api/achievements/:id` | Public |
| ✅ | POST | `/api/achievements` | `[AUTH][ADMIN]` |
| ✅ | PUT | `/api/achievements/:id` | `[AUTH][ADMIN]` |
| ✅ | DELETE | `/api/achievements/:id` | `[AUTH][ADMIN]` |
| ✅ | POST | `/api/upload/achievement-image` | `[AUTH][ADMIN]` |

**FE:** `/achievements`, `/achievements/:id` (public) · `/admin/achievements` (CMS).

### Interviews & AI providers

| BE | Method | Endpoint | Auth |
|:---|:-------|:---------|:-----|
| ✅ | POST | `/api/interviews/sessions/:id/evaluate` | `[AUTH]` |
| ✅ | POST | `/api/interviews/sessions/:id/analyze-face` | `[AUTH]` |
| ✅ | POST | `/api/interviews/generate-questions` | `[AUTH]` |
| ✅ | POST | `/api/interviews/extract-cv-text` | `[AUTH]` |
| ✅ | GET | `/api/ai/config` | — |
| ✅ | POST | `/api/ai/transcribe`, `/api/ai/tts`, `/api/ai/emotion` | `[AUTH]` |
| ✅ | GET | `/api/ai/tts/voices`, `/api/ai/avatar/presenters`, `/api/ai/avatar/usage` | `[AUTH]` |
| ✅ | POST | `/api/ai/interview/pregenerate`, `/api/ai/interview/pregen/start` | `[AUTH]` |
| ✅ | GET | `/api/ai/interview/pregen/:jobId` | `[AUTH]` |

### Upload, mentor, courses, admin

| BE | Method | Endpoint | Auth |
|:---|:-------|:---------|:-----|
| ✅ | POST | `/api/upload/jd` | `[AUTH]` |
| ✅ | POST | `/api/upload/course-video` | `[AUTH][MENTOR]` |
| ✅ | POST | `/api/upload/achievement-image` | `[AUTH][ADMIN]` |
| ✅ | GET | `/api/mentor/payouts`, `PATCH /api/mentor/payout-account` | `[AUTH][MENTOR]` |
| ✅ | GET/POST | `/api/mentor/peer-reviews`, `/api/mentor/peer-reviews/:courseId` | `[AUTH][MENTOR]` |
| ✅ | GET | `/api/courses/me`, mentor QA routes | `[AUTH][MENTOR]` |
| ✅ | PATCH | `/api/admin/mentors/:id/reject` | `[ADMIN]` — từ chối hồ sơ mentor |
| ✅ | PATCH | `/api/admin/mentors/:id/commission` | `[ADMIN]` |
| ✅ | GET | `/api/admin/system/overview`, `/api/admin/system/transaction-support` | `[ADMIN]` |
| ✅ | GET | `/api/admin/content/stats`, `/api/admin/content/interview-sessions`, `/api/admin/content/course-media` | `[ADMIN]` |
| ✅ | GET | `/api/admin/finance/courses`, `/api/admin/finance/platform-summary` | `[ADMIN]` |
| ✅ | GET | `/api/admin/interview-metrics` | `[ADMIN]` |
| ✅ | GET | `/api/admin/analytics/user-behavior`, `/api/admin/analytics/users/:id/journey` | `[ADMIN]` |
| ✅ | *Nhiều route* | `/api/admin/*` (finance CK, payouts, enrollments CK, course approve/reject/archive, …) | `[ADMIN]` |

*Admin đầy đủ:* `backend/src/routes/admin.js`, [`API_INDEX.md`](./API_INDEX.md) A.10.

---

## Trạng thái Frontend (theo domain)

Đối chiếu `frontend/src/app/pages/` — **không** thay cho cột BE ✅ ở trên.

| Domain | FE | Ghi chú |
|:-------|:---|:--------|
| Auth (login/register/Google/reset/verify) | ✅ FE | `auth.js`; Settings gửi lại xác minh email + xóa tài khoản + phiên đăng nhập |
| Dashboard | ✅ FE | Route `/dashboard` → `Dashboard.jsx` + `dashboardApi.js` |
| Mentors + booking + checkout CK | ✅ FE | SePay/transfer; ưu tiên CK thật |
| My bookings (`/my-bookings`) | ✅ FE | `MyBookings.jsx` + `bookingsApi.js` |
| Session detail | 🔧 FE | Chủ yếu `GET /api/bookings/:id`; một số UI demo |
| CV Analysis | 🔧 FE | Phân tích: Express `/api/cv/analyze*`; lịch sử: `cvApi.js` (không còn demo/localStorage) |
| Analysis history | ✅ FE | `/api/cv/analyses` |
| Interview AI | 🔧 FE | Session CRUD + `/api/ai/*`; lịch sử qua API (không localStorage) |
| Courses + enrollment | ✅ FE | |
| Achievements (tin tức) | ✅ FE | `/achievements`, `/achievements/:id` + admin CMS |
| Mentor dashboard/schedule/finance | ✅ FE | |
| Mentor meeting room | 🔧 FE | Check-in webcam API + phòng họp; một phần state local |
| User presence (online) | ✅ FE | `useUserPresence` heartbeat; admin cột **Trực tuyến** (users/mentors) |
| Platform analytics (tracking) | ✅ FE | `usePageAnalytics`, `trackAction` (CV, interview, checkout, courses, pricing) |
| Admin list (users/mentors/bookings/content) | ✅ FE | `adminApi.js` |
| Admin detail & vận hành | ✅ FE | User/mentor/booking detail, finance, transactions, payouts, CK khóa/gói, support, reviews — trong `AdminPlaceholders.jsx` (tên file legacy) + các trang riêng |
| Admin analytics | ✅ FE | `/admin/analytics` — stats + funnel `getUserBehavior` |
| Admin user journey | ✅ FE | `UserJourneyPanel` trên `/admin/users/:id` |
| Admin mentor pending | ✅ FE | `/admin/mentors/pending` — duyệt/từ chối hồ sơ |
| Admin booking check-ins | ✅ FE | `/admin/bookings/check-ins` — ảnh webcam mentor |
| Admin achievements CMS | ✅ FE | `/admin/achievements` |
| Admin content (courses/questions) | ✅ FE | `/admin/content/courses`, `/admin/content/questions` (interview sessions) |
| Admin system settings | ✅ FE | `/admin/settings` — `getSystemOverview` (read-only) |
| Notifications | ✅ FE | `GET /api/notifications/unread-count` + danh sách khi mở dropdown |
| Upload | ✅ FE | `uploadApi.js` — avatar, CV/JD, course media, check-in, achievement image |
| Static pages (Terms/Privacy/About) | ✅ FE | Không cần API |

**Còn thiếu / mỏng:** một số luồng Session detail demo, avatar D-ID prod hardening, vài màn admin chỉ read-only (settings).

---

## Query chung (khi làm list API)

| Tham số | Ví dụ |
|:--------|:------|
| Phân trang | `?page=1&limit=10` |
| Sắp xếp | `?sortBy=createdAt&order=desc` |
| Lọc | `?status=pending` |

Chi tiết response lỗi / thành công: tham chiếu `API_INDEX.md` (phần định dạng).

---

## Cách làm việc mỗi sprint

1. Chọn **một nhóm endpoint** trong bảng (vd. chỉ `POST/GET /api/bookings`).
2. Đối chiếu **object mock** trong FE (`mockData`, `bookings.js`).
3. Implement **route → controller → service** (theo pattern hiện có).
4. Thay **`fetch(apiUrl(...))`** trong đúng trang — giữ mock làm fallback nếu cần.

---

## Postman — gom endpoint theo folder (test API)

**Base URL dev:** `http://localhost:5000`. **`{{token}}` / `{{refresh_token}}`:** biến trong **Postman Environment** (không phải file `.env` backend). Sau `POST /api/auth/login`, copy `token` và `refreshToken` vào env → các request dùng `Authorization: Bearer {{token}}`.

### Folder Auth — đăng ký / đăng nhập / làm mới token

*(Không dùng `{{token}}` trước khi có access token; `refresh` dùng body `refreshToken`.)*

| Endpoint | Mục đích |
|:---------|:---------|
| `POST /api/auth/register` | Tạo tài khoản |
| `POST /api/auth/login` | Đăng nhập → lưu `token`, `refreshToken` vào env Postman |
| `POST /api/auth/google` | Đăng nhập Google *(Postman khó test — cần `credential` từ web)* |
| `POST /api/auth/refresh` | Body `{ "refreshToken": "..." }` → nhận access + refresh mới |

### Folder Public — không gửi `Authorization`

| Endpoint | Mục đích |
|:---------|:---------|
| `GET /` | Thông tin API |
| `GET /api/health` | Health + trạng thái DB |
| `GET /api/mentors` | Danh sách mentor |
| `GET /api/mentors/:id` | Chi tiết mentor |
| `GET /api/mentors/:id/availability` | Lịch rảnh |
| `GET /api/mentors/:id/reviews` | Review theo mentor |
| `GET /api/courses` | Danh sách khóa học |
| `GET /api/courses/:id` | Chi tiết khóa học |
| `GET /api/reviews` | Danh sách review *(query nếu API hỗ trợ)* |
| `GET /api/achievements` | Tin tức & hoạt động |
| `POST /api/payments/webhook/momo` | Webhook MoMo *(gateway/server gọi, không phải JWT user)* |
| `POST /api/payments/webhook/zalopay` | Webhook ZaloPay |

### Folder Authed — `Authorization: Bearer {{token}}`

*(User đã đăng nhập; không yêu cầu role mentor/admin.)*

| Endpoint | Mục đích |
|:---------|:---------|
| `GET /api/auth/me` | Profile |
| `PATCH /api/auth/me` | Cập nhật profile / đổi mật khẩu |
| `POST /api/auth/logout` | Đăng xuất |
| `GET /api/auth/sessions` | Danh sách phiên (thiết bị) |
| `DELETE /api/auth/sessions/:sessionId` | Thu hồi một phiên |
| `GET /api/bookings` | Booking của tôi |
| `POST /api/bookings` | Tạo booking |
| `PATCH /api/bookings/:id/reschedule` | Đổi lịch (học viên) |
| `GET /api/bookings/:id` | Chi tiết booking |
| `DELETE /api/bookings/:id` | Hủy booking |
| `GET /api/plans/current` | Plan hiện tại |
| `POST /api/plans/activate` | Kích hoạt plan |
| `POST /api/plans/cancel` | Hủy plan |
| `POST /api/payments/initiate` | Khởi tạo thanh toán |
| `GET /api/payments/history` | Lịch sử thanh toán |
| `GET /api/users/dashboard-stats` | Thống kê dashboard |
| `POST /api/courses/:id/enroll` | Ghi danh khóa |
| `POST /api/reviews` | Tạo review |
| `DELETE /api/reviews/:id` | Xóa review *(theo policy API)* |
| `POST /api/reports` | Gửi báo cáo |
| `GET /api/notifications` | Thông báo |
| `GET /api/notifications/unread-count` | Badge chưa đọc |
| `PATCH /api/notifications/:id/read` | Đánh dấu đã đọc |
| `POST /api/notifications/read-all` | Đọc hết |
| `POST /api/auth/presence` | Heartbeat online |
| `POST /api/analytics/events` | Ghi page view / action |
| `GET /api/enrollments/my` | Khóa đã ghi danh |
| `PATCH /api/enrollments/:id/progress` | Cập nhật tiến độ bài học |

### Folder Mentor — Bearer `{{token}}`, user có `role: mentor`

| Endpoint | Mục đích |
|:---------|:---------|
| `PATCH /api/mentors/me` | Sửa hồ sơ mentor |
| `PATCH /api/mentors/me/availability` | Lịch rảnh |
| `PATCH /api/mentors/me/availability/block` | Chặn ngày |
| `GET /api/bookings/mentor/list` | Booking phía mentor |
| `PATCH /api/bookings/:id/confirm` | Xác nhận booking |
| `PATCH /api/bookings/:id/complete` | Hoàn thành session |
| `PATCH /api/bookings/:id/notes` | Ghi chú booking |
| `PATCH /api/bookings/mentor/:id/check-in` | Check-in webcam trước phòng họp |
| `PATCH /api/reviews/:id/reply` | Trả lời review |
| `GET /api/mentor/dashboard` | Dashboard mentor |
| `GET /api/mentor/finance` | Tài chính |
| `GET /api/mentor/analytics` | Thống kê |
| `POST /api/mentor/payout` | Rút tiền / payout |

### Folder Admin — Bearer `{{token}}`, user có `role: admin`

| Endpoint | Mục đích |
|:---------|:---------|
| `PATCH /api/users/:id/role` | Đổi role *(vd. cấp mentor)* |
| `GET /api/admin/stats` | Thống kê admin |
| `GET /api/admin/users` | Danh sách user |
| `GET /api/admin/users/:id` | Chi tiết user (+ bookings/enrollments count) |
| `PATCH /api/admin/users/:id/status` | Khóa / mở user |
| `GET /api/admin/mentors` | Danh sách mentor |
| `GET /api/admin/mentors/:id` | Chi tiết mentor (+ sessions count) |
| `PATCH /api/admin/mentors/:id/status` | Bật / tắt mentor |
| `GET /api/admin/bookings` | Tất cả booking |
| `GET /api/admin/bookings/:id` | Chi tiết booking (user + mentor populate) |
| `GET /api/admin/reports` | Danh sách báo cáo mentor |
| `PATCH /api/admin/reports/:id` | Cập nhật trạng thái (`reviewing` / `resolved` / `dismissed`) |
| `GET /api/admin/analytics/user-behavior` | Funnel / hành vi nền tảng (`?days=`) |
| `GET /api/admin/analytics/users/:id/journey` | Hành trình user |
| `GET /api/admin/finance/platform-summary` | Tài chính nền tảng |
| `GET /api/admin/payouts` | Yêu cầu rút tiền mentor |
| `PATCH /api/admin/mentors/:id/reject` | Từ chối hồ sơ mentor |
| `POST /api/achievements` | Tạo tin tức (admin) |
| `POST /api/upload/achievement-image` | Ảnh bài viết achievements |

---

## Tài liệu liên quan

| File | Nội dung |
|:-----|:---------|
| [API_INDEX.md](./API_INDEX.md) | API đang chạy + Supabase + D-ID |
| [backend/DATABASE.md](./backend/DATABASE.md) | Collection / field MongoDB |

---

*Cập nhật lần cuối: đồng bộ BE Phase 1–5 (presence, analytics, achievements, check-in) + trạng thái FE admin/analytics. Đánh dấu 📋 → ✅ khi đã có route Express; cập nhật cột FE khi nối xong màn.*

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
| ✅ | Đã có route trong Express (chi tiết `API_INDEX.md` Phần C / file `routes/`) |
| 📋 | Chưa có route — cần code backend (và thường nối FE sau) |
| `[AUTH]` | Cần đăng nhập |
| `[MENTOR]` | `role === "mentor"` |
| `[ADMIN]` | `role === "admin"` |

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
| GET | `/api/auth/sessions` | `[AUTH]` |
| DELETE | `/api/auth/sessions/:sessionId` | `[AUTH]` |
| GET | `/api/mentors` | Public |
| GET | `/api/mentors/:id` | Public |
| GET | `/api/health` | |
| GET | `/api/users/dashboard-stats` | `[AUTH]` |
| PATCH | `/api/users/:id/role` | `[ADMIN]` — gán role (vd. mentor) |
| GET | `/api/admin/stats` | `[ADMIN]` |
| GET | `/api/admin/users` | `[ADMIN]` |
| GET | `/api/admin/bookings` | `[ADMIN]` |
| GET | `/api/admin/mentors` | `[ADMIN]` |
| PATCH | `/api/admin/users/:id/status` | `[ADMIN]` |
| PATCH | `/api/admin/mentors/:id/status` | `[ADMIN]` |

Các nhóm endpoint theo phase (bookings, payments, plans, courses, enrollments, mentor, reviews, reports, notifications, …): xem **bảng Phase 1–4** bên dưới — cột **Trạng thái** đã đồng bộ với code hiện tại.

**Ngoài Express (giữ nguyên hoặc migrate sau):** CV — Supabase Edge; avatar stream — D-ID (`API_INDEX.md` phần B).

---

## Phase 1 — Booking + thanh toán + dashboard (ưu tiên khách hàng)

**FE cần nối:** `Booking.jsx`, `SessionDetail.jsx`, `Checkout.jsx`, `Dashboard.jsx`

| Trạng thái | Method | Endpoint | Auth | Mô tả ngắn |
|:-----------|:-------|:---------|:-----|:-----------|
| ✅ | POST | `/api/bookings` | `[AUTH]` | Tạo lịch: `mentorId`, `date`, `timeSlot`, `sessionType`, `notes`, `price`… (khớp `Booking.jsx`) |
| ✅ | GET | `/api/bookings` | `[AUTH]` | Danh sách booking của user hiện tại |
| ✅ | GET | `/api/bookings/:id` | `[AUTH]` | Chi tiết 1 booking (session detail) |
| ✅ | DELETE | `/api/bookings/:id` | `[AUTH]` | Hủy — cập nhật `status` (vd. `cancelled`), giữ bản ghi nếu cần lịch sử |
| ✅ | PATCH | `/api/bookings/:id/reschedule` | `[AUTH]` | Dời lịch — body khớp reschedule trong schema `Booking` |
| ✅ | POST | `/api/payments/initiate` | `[AUTH]` | Tạo đơn MoMo/ZaloPay sandbox → trả `qr` / `payUrl` cho `Checkout.jsx` |
| ✅ | POST | `/api/payments/webhook/momo` | *(server secret / IP whitelist)* | Xác nhận thanh toán |
| ✅ | POST | `/api/payments/webhook/zalopay` | *(tương tự)* | |
| ✅ | GET | `/api/payments/history` | `[AUTH]` | *(tuỳ chọn)* Lịch sử giao dịch |
| ✅ | GET | `/api/plans/current` | `[AUTH]` | Plan + quota — khớp `Pricing` / hiển thị sau checkout |
| ✅ | POST | `/api/plans/activate` | `[AUTH]` | Kích hoạt plan sau payment (hoặc gộp vào webhook) |
| ✅ | POST | `/api/plans/cancel` | `[AUTH]` | Hủy / downgrade plan (khớp C.11) |
| ✅ | GET | `/api/users/dashboard-stats` | `[AUTH]` | Số liệu tổng hợp cho `Dashboard.jsx` (thay `mockData`) |

**Gợi ý model:** `backend/src/models/Booking.js`, `Payment.js`, `User.plan` (đã có field trên User).

---

## Phase 2 — Mentor vận hành + review + báo cáo

**FE cần nối:** `MentorDashboard`, `MentorSchedule`, `MentorMeetingDetail`, `MeetingRoom`, `MentorFinance`, `MentorAnalytics`, `MentorReviews`, `ReportMentorModal`

| Trạng thái | Method | Endpoint | Auth | Mô tả ngắn |
|:-----------|:-------|:---------|:-----|:-----------|
| ✅ | GET | `/api/bookings/mentor/list` | `[AUTH][MENTOR]` | Booking của mentor đăng nhập |
| ✅ | PATCH | `/api/bookings/:id/confirm` | `[AUTH][MENTOR]` | Xác nhận |
| ✅ | PATCH | `/api/bookings/:id/complete` | `[AUTH][MENTOR]` | Hoàn thành |
| ✅ | PATCH | `/api/bookings/:id/notes` | `[AUTH][MENTOR]` | Ghi chú sau buổi |
| 📋 | POST | `/api/bookings/:id/review` | `[AUTH]` | *(chưa có alias route)* — dùng `POST /api/reviews` (gắn `bookingId` trong body nếu service hỗ trợ) |
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
| ✅ | POST | `/api/reviews` | `[AUTH]` | Tạo review sau session — thay `saveReview` local |
| ✅ | PATCH | `/api/reviews/:id/reply` | `[AUTH][MENTOR]` | Mentor trả lời |
| ✅ | DELETE | `/api/reviews/:id` | `[AUTH]` | Xóa review (owner / policy) |
| ✅ | POST | `/api/reports` | `[AUTH]` | Báo cáo mentor — modal report |

---

## Phase 3 — Khóa học + ghi danh + tiến độ

**FE cần nối:** `Courses.jsx`, `CourseDetail.jsx`, `CourseLearning.jsx`, `MentorCourseManagement`, `MentorCourseEdit`

| Trạng thái | Method | Endpoint | Auth | Mô tả ngắn |
|:-----------|:-------|:---------|:-----|:-----------|
| ✅ | GET | `/api/courses` | Public | List + filter (khớp `Courses.jsx`) |
| ✅ | GET | `/api/courses/:id` | Public | Chi tiết — thay `getCourseById` tĩnh |
| ✅ | POST | `/api/courses/:id/enroll` | `[AUTH]` | Ghi danh — thay `localStorage` enroll |
| ✅ | GET | `/api/enrollments/my` | `[AUTH]` | Khóa học của tôi |
| ✅ | PATCH | `/api/enrollments/:id/progress` | `[AUTH]` | Cập nhật bài học đã xem — thay `PROGRESS_KEY` |
| ✅ | GET | `/api/enrollments/:id/certificate` | `[AUTH]` | URL / metadata chứng chỉ (khớp C.7) |
| ✅ | GET | `/api/courses/:id/lessons/:lessonId` | `[AUTH]` | *(tuỳ thiết kế)* Nội dung bài |
| ✅ | POST | `/api/courses` | `[AUTH][MENTOR]` | Tạo khóa |
| ✅ | PUT | `/api/courses/:id` | `[AUTH][MENTOR]` | Sửa khóa |
| ✅ | PATCH | `/api/courses/:id/publish` | `[AUTH][MENTOR]` | Xuất bản |
| ✅ | DELETE | `/api/courses/:id` | `[AUTH][MENTOR]` | Archive / xóa mềm |

**Gợi ý model:** `Course.js`, `Enrollment.js` (đã có file trong `backend/src/models/`).

---

## Phase 4 — CV trên BE + interview session + thông báo + upload

**FE cần nối:** `CVAnalysis.jsx` (migrate), `Interview*`, `AnalysisHistory`, `Settings`

| Trạng thái | Method | Endpoint | Auth | Mô tả ngắn |
|:-----------|:-------|:---------|:-----|:-----------|
| 📋 | POST | `/api/cv/analyses` | `[AUTH]` | Upload phân tích — nếu migrate từ Edge |
| 📋 | GET | `/api/cv/analyses` | `[AUTH]` | Lịch sử |
| 📋 | GET | `/api/cv/analyses/:id` | `[AUTH]` | Chi tiết |
| 📋 | DELETE | `/api/cv/analyses/:id` | `[AUTH]` | Xóa |
| 📋 | GET | `/api/cv/quota` | `[AUTH]` | Quota còn — đồng bộ với `User.quota` |
| 📋 | POST | `/api/interviews/sessions` | `[AUTH]` | Tạo session phỏng vấn AI |
| 📋 | PATCH | `/api/interviews/sessions/:id` | `[AUTH]` | Cập nhật câu trả lời / transcript |
| 📋 | POST | `/api/interviews/sessions/:id/complete` | `[AUTH]` | Kết thúc + feedback |
| 📋 | GET | `/api/interviews/sessions` | `[AUTH]` | Lịch sử |
| 📋 | GET | `/api/interviews/sessions/:id` | `[AUTH]` | Chi tiết một session (khớp C.5) |
| ✅ | GET | `/api/notifications` | `[AUTH]` | Danh sách thông báo |
| ✅ | PATCH | `/api/notifications/:id/read` | `[AUTH]` | Đã đọc |
| ✅ | POST | `/api/notifications/read-all` | `[AUTH]` | Đánh dấu tất cả đã đọc *(trong code là `POST`, không phải `PATCH`)* |
| 📋 | DELETE | `/api/notifications/:id` | `[AUTH]` | Xóa thông báo |
| 📋 | GET | `/api/notifications/unread-count` | `[AUTH]` | Badge |
| 📋 | POST | `/api/upload/avatar` | `[AUTH]` | Upload ảnh → URL lưu `PATCH /me` `avatar` |
| 📋 | POST | `/api/upload/cv` | `[AUTH]` | Upload CV (nếu chuyển từ Edge) |
| 📋 | POST | `/api/upload/course-thumbnail` | `[AUTH][MENTOR]` | Ảnh bìa khóa học |

---

## Bổ sung auth — khớp API_INDEX C.1

**FE liên quan:** đăng xuất server-side (`tokenVersion` + refresh), xóa tài khoản (Settings / tương lai).

| Trạng thái | Method | Endpoint | Auth | Mô tả ngắn |
|:-----------|:-------|:---------|:-----|:-----------|
| ✅ | POST | `/api/auth/logout` | `[AUTH]` | Vô hiệu access + xóa refresh sessions |
| ✅ | POST | `/api/auth/refresh` | — | Làm mới access từ refresh token |
| ✅ | GET / DELETE | `/api/auth/sessions`, `/api/auth/sessions/:id` | `[AUTH]` | Danh sách / thu hồi phiên |
| 📋 | DELETE | `/api/auth/me` | `[AUTH]` | Xóa tài khoản |

*Ghi chú:* `change-password` không dùng — đã gộp `PATCH /api/auth/me` (xem Phần A trong `API_INDEX.md`).

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
| `PATCH /api/notifications/:id/read` | Đánh dấu đã đọc |
| `POST /api/notifications/read-all` | Đọc hết |
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
| `GET /api/admin/mentors` | Danh sách mentor |
| `PATCH /api/admin/mentors/:id/status` | Bật / tắt mentor |
| `GET /api/admin/users` | Danh sách user |
| `PATCH /api/admin/users/:id/status` | Khóa / mở user |
| `GET /api/admin/bookings` | Tất cả booking |

---

## Tài liệu liên quan

| File | Nội dung |
|:-----|:---------|
| [API_INDEX.md](./API_INDEX.md) | API đang chạy + Supabase + D-ID |
| [backend/DATABASE.md](./backend/DATABASE.md) | Collection / field MongoDB |

---

*Đánh dấu 📋 → ✅ khi đã có route Express; nối FE có thể làm sau (theo từng màn).*

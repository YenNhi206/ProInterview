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
| ✅ | Đã có trong Express (xem `API_INDEX.md`) |
| 📋 | Cần code backend + nối FE |
| `[AUTH]` | Cần đăng nhập |
| `[MENTOR]` | `role === "mentor"` |
| `[ADMIN]` | `role === "admin"` |

---

## API đã có (Express) — không lặp chi tiết

| Method | Endpoint | Ghi chú |
|:-------|:-----------|:--------|
| POST | `/api/auth/register` | |
| POST | `/api/auth/login` | |
| POST | `/api/auth/google` | |
| GET | `/api/auth/me` | `[AUTH]` |
| PATCH | `/api/auth/me` | `[AUTH]` — profile + đổi mật khẩu |
| GET | `/api/mentors` | Public |
| GET | `/api/mentors/:id` | Public |
| GET | `/api/health` | |

**Ngoài Express (giữ nguyên hoặc migrate sau):** CV — Supabase Edge; avatar stream — D-ID (`API_INDEX.md` phần B).

---

## Phase 1 — Booking + thanh toán + dashboard (ưu tiên khách hàng)

**FE cần nối:** `Booking.jsx`, `SessionDetail.jsx`, `Checkout.jsx`, `Dashboard.jsx`

| Trạng thái | Method | Endpoint | Auth | Mô tả ngắn |
|:-----------|:-------|:---------|:-----|:-----------|
| 📋 | POST | `/api/bookings` | `[AUTH]` | Tạo lịch: `mentorId`, `date`, `timeSlot`, `sessionType`, `notes`, `price`… (khớp `Booking.jsx`) |
| 📋 | GET | `/api/bookings` | `[AUTH]` | Danh sách booking của user hiện tại |
| 📋 | GET | `/api/bookings/:id` | `[AUTH]` | Chi tiết 1 booking (session detail) |
| 📋 | DELETE | `/api/bookings/:id` | `[AUTH]` | Hủy — cập nhật `status` (vd. `cancelled`), giữ bản ghi nếu cần lịch sử |
| 📋 | PATCH | `/api/bookings/:id/reschedule` | `[AUTH]` | Dời lịch — body khớp reschedule trong schema `Booking` |
| 📋 | POST | `/api/payments/initiate` | `[AUTH]` | Tạo đơn MoMo/ZaloPay sandbox → trả `qr` / `payUrl` cho `Checkout.jsx` |
| 📋 | POST | `/api/payments/webhook/momo` | *(server secret / IP whitelist)* | Xác nhận thanh toán |
| 📋 | POST | `/api/payments/webhook/zalopay` | *(tương tự)* | |
| 📋 | GET | `/api/payments/history` | `[AUTH]` | *(tuỳ chọn)* Lịch sử giao dịch |
| 📋 | GET | `/api/plans/current` | `[AUTH]` | Plan + quota — khớp `Pricing` / hiển thị sau checkout |
| 📋 | POST | `/api/plans/activate` | `[AUTH]` | Kích hoạt plan sau payment (hoặc gộp vào webhook) |
| 📋 | POST | `/api/plans/cancel` | `[AUTH]` | Hủy / downgrade plan (khớp C.11) |
| 📋 | GET | `/api/users/dashboard-stats` | `[AUTH]` | Số liệu tổng hợp cho `Dashboard.jsx` (thay `mockData`) |

**Gợi ý model:** `backend/src/models/Booking.js`, `Payment.js`, `User.plan` (đã có field trên User).

---

## Phase 2 — Mentor vận hành + review + báo cáo

**FE cần nối:** `MentorDashboard`, `MentorSchedule`, `MentorMeetingDetail`, `MeetingRoom`, `MentorFinance`, `MentorAnalytics`, `MentorReviews`, `ReportMentorModal`

| Trạng thái | Method | Endpoint | Auth | Mô tả ngắn |
|:-----------|:-------|:---------|:-----|:-----------|
| 📋 | GET | `/api/bookings/mentor/list` | `[AUTH][MENTOR]` | Booking của mentor đăng nhập |
| 📋 | PATCH | `/api/bookings/:id/confirm` | `[AUTH][MENTOR]` | Xác nhận |
| 📋 | PATCH | `/api/bookings/:id/complete` | `[AUTH][MENTOR]` | Hoàn thành |
| 📋 | PATCH | `/api/bookings/:id/notes` | `[AUTH][MENTOR]` | Ghi chú sau buổi |
| 📋 | POST | `/api/bookings/:id/review` | `[AUTH]` | Tạo review gắn booking (FE có thể gọi; server map sang `Review` / `POST /api/reviews`) |
| 📋 | GET | `/api/mentors/:id/availability` | Public hoặc `[AUTH]` | Lịch rảnh (khớp C.2) |
| 📋 | GET | `/api/mentors/:id/reviews` | Public | Review theo mentor (khớp C.2) |
| 📋 | PATCH | `/api/mentors/me` | `[AUTH][MENTOR]` | Profile mentor (khớp C.2) |
| 📋 | PATCH | `/api/mentors/me/availability` | `[AUTH][MENTOR]` | Lịch rảnh (khớp C.2) |
| 📋 | PATCH | `/api/mentors/me/availability/block` | `[AUTH][MENTOR]` | Chặn ngày (khớp C.2) |
| 📋 | GET | `/api/mentor/dashboard` | `[AUTH][MENTOR]` | KPI — thay `mentorMockData` dashboard |
| 📋 | GET | `/api/mentor/finance` | `[AUTH][MENTOR]` | Thu nhập — thay `MentorFinance` mock |
| 📋 | GET | `/api/mentor/analytics` | `[AUTH][MENTOR]` | *(tuỳ chọn)* Biểu đồ |
| 📋 | POST | `/api/mentor/payout` | `[AUTH][MENTOR]` | Yêu cầu chi trả (khớp C.12) |
| 📋 | GET | `/api/reviews` | Public hoặc `[AUTH]` | Query: `?targetType=mentor&targetId=` — list review |
| 📋 | POST | `/api/reviews` | `[AUTH]` | Tạo review sau session — thay `saveReview` local |
| 📋 | PATCH | `/api/reviews/:id/reply` | `[AUTH][MENTOR]` | Mentor trả lời |
| 📋 | DELETE | `/api/reviews/:id` | `[AUTH]` | Xóa review (owner / policy) |
| 📋 | POST | `/api/reports` | `[AUTH]` | Báo cáo mentor — modal report |

---

## Phase 3 — Khóa học + ghi danh + tiến độ

**FE cần nối:** `Courses.jsx`, `CourseDetail.jsx`, `CourseLearning.jsx`, `MentorCourseManagement`, `MentorCourseEdit`

| Trạng thái | Method | Endpoint | Auth | Mô tả ngắn |
|:-----------|:-------|:---------|:-----|:-----------|
| 📋 | GET | `/api/courses` | Public | List + filter (khớp `Courses.jsx`) |
| 📋 | GET | `/api/courses/:id` | Public | Chi tiết — thay `getCourseById` tĩnh |
| 📋 | POST | `/api/courses/:id/enroll` | `[AUTH]` | Ghi danh — thay `localStorage` enroll |
| 📋 | GET | `/api/enrollments/my` | `[AUTH]` | Khóa học của tôi |
| 📋 | PATCH | `/api/enrollments/:id/progress` | `[AUTH]` | Cập nhật bài học đã xem — thay `PROGRESS_KEY` |
| 📋 | GET | `/api/enrollments/:id/certificate` | `[AUTH]` | URL / metadata chứng chỉ (khớp C.7) |
| 📋 | GET | `/api/courses/:id/lessons/:lessonId` | `[AUTH]` | *(tuỳ thiết kế)* Nội dung bài |
| 📋 | POST | `/api/courses` | `[AUTH][MENTOR]` | Tạo khóa |
| 📋 | PUT | `/api/courses/:id` | `[AUTH][MENTOR]` | Sửa khóa |
| 📋 | PATCH | `/api/courses/:id/publish` | `[AUTH][MENTOR]` | Xuất bản |
| 📋 | DELETE | `/api/courses/:id` | `[AUTH][MENTOR]` | Archive / xóa mềm |

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
| 📋 | GET | `/api/notifications` | `[AUTH]` | Danh sách thông báo |
| 📋 | PATCH | `/api/notifications/:id/read` | `[AUTH]` | Đã đọc |
| 📋 | PATCH | `/api/notifications/read-all` | `[AUTH]` | |
| 📋 | DELETE | `/api/notifications/:id` | `[AUTH]` | Xóa thông báo |
| 📋 | GET | `/api/notifications/unread-count` | `[AUTH]` | Badge |
| 📋 | POST | `/api/upload/avatar` | `[AUTH]` | Upload ảnh → URL lưu `PATCH /me` `avatar` |
| 📋 | POST | `/api/upload/cv` | `[AUTH]` | Upload CV (nếu chuyển từ Edge) |
| 📋 | POST | `/api/upload/course-thumbnail` | `[AUTH][MENTOR]` | Ảnh bìa khóa học |

---

## Bổ sung auth — khớp API_INDEX C.1

**FE liên quan:** đăng xuất server-side, xóa tài khoản (Settings / tương lai).

| Trạng thái | Method | Endpoint | Auth | Mô tả ngắn |
|:-----------|:-------|:---------|:-----|:-----------|
| 📋 | POST | `/api/auth/logout` | `[AUTH]` | *(tuỳ chọn)* Invalidate token phía server |
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

## Tài liệu liên quan

| File | Nội dung |
|:-----|:---------|
| [API_INDEX.md](./API_INDEX.md) | API đang chạy + Supabase + D-ID |
| [backend/DATABASE.md](./backend/DATABASE.md) | Collection / field MongoDB |

---

*Đánh dấu 📋 → ✅ trong bảng trên khi endpoint đã merge và FE đã nối.*

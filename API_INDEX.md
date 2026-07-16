# ProInterview — Tài liệu API & tích hợp (đầy đủ)

File trong repo: `API_INDEX.md`. Cập nhật khi thêm route, đổi FE hoặc đổi provider (Supabase / thanh toán).

| Phần | Nội dung |
|:-----|:---------|
| **A** | Backend Express — entrypoint `backend/src/server.js` |
| **B** | Supabase Edge (CV), D-ID — FE gọi trực tiếp |
| **C** | Tham chiếu contract (method/path); **BE/FE** xem [`ROADMAP.md`](./ROADMAP.md) Phase 1–5 |

---

## Mục lục

1. [Chú giải trạng thái](#chú-giải-trạng-thái)
2. [Biến môi trường liên quan](#biến-môi-trường-liên-quan)
3. [Base URL & xác thực](#base-url--xác-thực)
4. [Phần A — Backend Express](#phần-a--backend-express-đã-có-trong-repo)
5. [Phần B — Tích hợp ngoài](#phần-b--tích-hợp-ngoài-fe-gọi-trực-tiếp)
6. [Phần C — Roadmap API (tham chiếu)](#phần-c--roadmap-api-tham-chiếu)
7. [Query params chuẩn (dự kiến)](#query-params-chuẩn-dự-kiến)
8. [Định dạng response](#định-dạng-response)
9. [Mã lỗi gợi ý](#mã-lỗi-gợi-ý)
10. [Roadmap triển khai (gợi ý sprint)](#roadmap-triển-khai-gợi-ý-sprint)
11. [Model MongoDB](#model-mongodb)
12. [Bản đồ file trong repo](#bản-đồ-file-trong-repo)

---

## Chú giải trạng thái

| Ký hiệu | Ý nghĩa |
|:--------|:--------|
| ✅ | Đã có backend Express và đang dùng / có thể gọi từ FE. |
| 🔧 | Đã có backend nhưng FE chưa nối, hoặc chỉ một phía. |
| 📋 | Chưa có route trong Express — đặt tên theo kế hoạch / spec. |
| 🌐 | API bên thứ ba (không phải server trong repo). |
| `[AUTH]` | Cần `Authorization: Bearer <token>`. |
| `[MENTOR]` | Cần role `mentor`. |
| `[ADMIN]` | Cần role `admin`. |

---

## Biến môi trường liên quan

| Biến | Vai trò |
|:-----|:--------|
| `MONGO_URI`    | Kết nối MongoDB (backend). |
| `JWT_SECRET`   | Ký / verify JWT cho `/api/auth`. |
| `JWT_EXPIRES_IN` | Thời hạn token (mặc định `7d`). |
| `GOOGLE_CLIENT_ID` | Xác thực Google (`POST /api/auth/google`). |
| `PORT` | Cổng backend (mặc định `5000`). |
| `CORS_ORIGIN` | Danh sách origin CORS (tùy chọn). |
| `VITE_API_URL` | FE: base URL backend production (`frontend/src/app/utils/api.js`). |
| D-ID API key | FE phỏng vấn AI — `useDIDStream` / cấu hình trang Interview. |

---

## Base URL & xác thực

| Nguồn | Base URL |
|:------|:---------|
| **Express** | Dev: cùng origin, Vite proxy `/api` → `http://localhost:5000`. Prod: `VITE_API_URL` (bỏ `/` cuối) hoặc `http://localhost:5000`. |
| **Supabase Edge** | `https://<projectId>.supabase.co/functions/v1/make-server-64a0c849/` — `projectId` từ `/utils/supabase/info.js`. |
| **D-ID** | `https://api.d-id.com` |

| Nguồn | Header / auth |
|:------|:--------------|
| **Express** | `Authorization: Bearer <access_token>` từ `POST /api/auth/login` hoặc `/google`. **Không** dùng JWT Supabase cho `/api/*`. |
| **Supabase Edge** | `Authorization: Bearer <token>` khi có. Edge có thể từ chối JWT backend — FE có fallback demo. **Không** gửi `apikey` (CORS). |
| **D-ID** | `Authorization: Basic base64(<API_KEY> + ":")` và `Content-Type: application/json`. |

---

## Phần A — Backend Express (đã có trong repo)

**Entrypoint:** `backend/src/server.js`  
Routers mount: `/api/auth`, `/api/mentors`, `/api/bookings`, `/api/plans`, `/api/payments`, `/api/users`, `/api/courses`, `/api/reviews`, `/api/reports`, `/api/mentor`, `/api/notifications`, `/api/admin`, `/api/enrollments`, `/api/cv`, `/api/interviews`, `/api/upload`, `/api/ai`, `/api/achievements`, `/api/analytics`, `/api/mock`, `/api/coupons`.

### A.1. `GET /`

| | |
|:--|:--|
| **Auth** | Không |
| **Response** | JSON giới thiệu service; gợi ý `/api/health`, `/api/auth`, `/api/mentors`. |

### A.2. `GET /api/health`

| | |
|:--|:--|
| **Auth** | Không |
| **Response** | `ok`, `service`, `database` (`connected` / `disconnected`), `timestamp` |

```json
{
  "ok": true,
  "service": "backend",
  "database": "connected",
  "timestamp": "2026-04-12T12:00:00.000Z"
}
```

`database` = `connected` khi `mongoose.connection.readyState === 1`.

---

### A.3. Module Auth — `/api/auth`

**File:** `backend/src/routes/auth.js`  
**Lưu ý:** Toàn bộ route auth cần MongoDB; nếu không → `503` `{ success: false, error: ... }`.

| Method | Path | Auth | Mô tả |
|:-------|:-----|:-----|:------|
| POST | `/api/auth/register` | — | Đăng ký (rate limit theo IP) |
| POST | `/api/auth/login` | — | Email + mật khẩu → access + **refresh token** |
| POST | `/api/auth/google` | — | Google ID token (GIS) → access + refresh |
| POST | `/api/auth/refresh` | — (tuỳ chọn Bearer access cũ) | Body `{ refreshToken }` → access + refresh mới; **blacklist jti** access cũ nếu gửi Bearer |
| GET | `/api/auth/me` | Bearer | Profile hiện tại |
| POST | `/api/auth/logout` | Bearer | Blacklist **jti** access hiện tại + `tokenVersion++` + xóa refresh sessions |
| GET | `/api/auth/sessions` | Bearer | `?currentSessionId=` (id từ refresh token) → phiên + `security` |
| DELETE | `/api/auth/sessions/:sessionId` | Bearer | Thu hồi phiên; nếu là phiên hiện tại → blacklist jti access |
| PATCH | `/api/auth/me` | Bearer | Profile + **đặt/đổi mật khẩu** |
| DELETE | `/api/auth/me` | Bearer | Xóa tài khoản (Settings) |
| GET | `/api/auth/verify-email` | — | Xác thực email (`?token=`) |
| POST | `/api/auth/resend-verification` | — | Gửi lại email xác thực |
| POST | `/api/auth/forgot-password` | — | Yêu cầu reset mật khẩu |
| POST | `/api/auth/reset-password` | — | Đặt mật khẩu mới (`token` + `password`) |
| POST | `/api/auth/presence` | Bearer | Heartbeat online — cập nhật `User.lastSeenAt` → `{ success, lastSeenAt }` |

#### Chi tiết từng endpoint

| Endpoint | Body / header | Response thành công | Lỗi thường gặp |
|:---------|:--------------|:---------------------|:---------------|
| `POST /register` | `name`, `email`, `password`, `role?` (`admin` cần `adminInviteCode`) | `201` `{ success: true }` — **không** có `token` | `400`, `403`, `409` |
| `POST /login` | `email`, `password` | `{ success, token, refreshToken, expiresIn, user }` | `401`, `429`, `503` |
| `POST /google` | `credential` | `{ success, token, refreshToken, expiresIn, user }` | `400`–`503` |
| `POST /refresh` | `{ refreshToken }` + header `Authorization: Bearer` (access cũ, khuyến nghị) | `{ success, token, refreshToken, expiresIn, user }` — access cũ bị blacklist theo **jti** | `400`, `401` |
| `GET /me` | `Authorization: Bearer` | `{ success, user }` | `401` nếu token hết hạn, `tv` lệch, hoặc **jti** đã thu hồi |
| `GET /sessions` | Bearer; query `?currentSessionId=<sessionId từ refresh>` | `{ success, sessions: [{ id, createdAt, lastUsedAt, expiresAt, userAgent, ip, fingerprint, fingerprintShort, deviceLabel, isCurrent, isSuspicious, matchesCurrentDevice }], security: { suspiciousCount, majorityFingerprintShort, currentSessionId } }` | `401` |
| `DELETE /sessions/:sessionId` | Bearer | `{ success: true }` — thu hồi refresh; phiên hiện tại → blacklist access **jti** | `400`, `401`, `404` |
| `POST /logout` | `Authorization: Bearer` | `{ success: true }` — blacklist **jti** access + `tokenVersion++` + xóa mọi refresh | `401` |
| `PATCH /me` | JSON: mật khẩu +/ hoặc profile | `{ success, user }`; **đổi mật khẩu** thêm `token`, `refreshToken`, `expiresIn` | `400`, `401`, `409` |

**Đổi mật khẩu (`PATCH /me`):** gửi `newPassword` hoặc `password`. Chưa liên kết Google → bắt buộc `currentPassword`. Đã liên kết Google → `currentPassword` tùy chọn. Đổi mật khẩu → `tokenVersion++`, xóa mọi refresh cũ, trả **access + refresh mới**.  
**Không** dùng `POST /api/auth/change-password` — gộp trong `PATCH /me`.

**Token:** Access JWT có claim `tv` khớp `User.tokenVersion` và **`jti`** (UUID). Blacklist jti lưu trên `User.revokedAccessJtis` (tự prune theo `expAt`) khi logout, refresh (xoay token), thu hồi phiên hiện tại, đổi mật khẩu. **Refresh** dạng `sessionObjectId:secret` (opaque), lưu hash trong `authSessions` (tối đa 10 phiên/user). FE gửi `Authorization: Bearer` kèm `POST /refresh` để vô hiệu access cũ ngay. Env gợi ý: `JWT_ACCESS_EXPIRES_IN` hoặc `JWT_EXPIRES_IN` (mặc định access **15m** nếu không set), `REFRESH_TOKEN_DAYS` (mặc định 30), `REFRESH_TOKEN_PEPPER` (tuỳ chọn, mặc định dùng `JWT_SECRET`), `AUTH_STRICT_SESSION_FINGERPRINT=true` (prod).

**Khóa tài khoản (admin):** `PATCH /api/admin/users/:id/status` với `isActive: false` → tăng `tokenVersion`, xóa `authSessions`, user không dùng được access/refresh.

**Profile (`PATCH /me` — một phần):** `name`, `phone`, `position`, `school`, `field`, `avatar`, `expertise`, `experience`, `hourlyRate`, `bio`, `email` (check trùng). **Không** tự đổi `role` lên mentor qua `/me` — chỉ **admin** gán qua `PATCH /api/users/:id/role` (Bearer admin).

#### `user` public (`toPublicUser`)

| Field | Mô tả |
|:------|:------|
| `id` | `_id` string |
| `email`, `name`, `role`, `avatar` | |
| `phone` | Mặc định `""` |
| `position` | `desiredPosition` / `position` |
| `school` | |
| `field` | Skill đầu (alias) |
| `expertise` | Mảng skills |
| `experience` | Chuỗi |
| `hourlyRate`, `bio` | |
| `plan`, `planExpiresAt` | |
| `hasGoogleLogin` | `true` nếu có `googleId` / `googleSub` (không rỗng) |
| `isEmailVerified` | Trạng thái xác minh email (tài khoản email/password) |
| `notificationPrefs` | Tuỳ chọn thông báo theo role |

**FE:** `frontend/src/app/utils/auth.js`, `Settings.jsx`, …

**Logout:** `POST /api/auth/logout` (Bearer) — blacklist jti + tăng `tokenVersion`; FE `logout()` gọi API rồi xóa `localStorage` (`prointerview_auth`, `prointerview_access_token`, `prointerview_refresh_token`).

---

### A.4. Module Mentors — `/api/mentors`

**File:** `backend/src/routes/mentors.js` — cần MongoDB; danh sách chỉ gồm mentor có `userId` (tài khoản thật).

| Method | Path | Auth | Mô tả |
|:-------|:-----|:-----|:------|
| GET | `/api/mentors` | — | Danh sách |
| GET | `/api/mentors/me` | Bearer | Hồ sơ mentor của user đăng nhập |
| POST | `/api/mentors/apply` | Bearer | Đăng ký làm mentor |
| GET | `/api/mentors/:id/availability` | — | Lịch rảnh |
| GET | `/api/mentors/:id/reviews` | — | Review theo mentor |
| PATCH | `/api/mentors/me` | Bearer + Mentor | Sửa profile mentor |
| PATCH | `/api/mentors/me/availability` | Bearer + Mentor | Cập nhật lịch rảnh |
| PATCH | `/api/mentors/me/availability/block` | Bearer + Mentor | Chặn ngày |
| GET | `/api/mentors/:id` | — | Chi tiết — `id` = `publicId` hoặc `_id` |

---

### A.5. Module Courses — `/api/courses`

**File:** `backend/src/routes/courses.js`

| Method | Path | Auth | Mô tả |
|:-------|:-----|:-----|:------|
| GET | `/api/courses` | — | Danh sách khóa học (published) |
| GET | `/api/courses/:id` | — | Chi tiết khóa học |
| GET | `/api/courses/:id/lessons/:lessonId` | Bearer | Nội dung bài học (có kiểm tra ghi danh) |
| GET | `/api/courses/:id/lessons/:lessonId/qa` | Bearer | Danh sách Q&A theo bài (học viên đã ghi danh / bài preview) |
| POST | `/api/courses/:id/lessons/:lessonId/qa` | Bearer | Gửi câu hỏi `{ question }` — lưu `CourseQA` |
| GET | `/api/courses/:id/lessons/:lessonId/notes` | Bearer | Ghi chú bài học (học viên đã ghi danh) |
| PUT | `/api/courses/:id/lessons/:lessonId/notes` | Bearer | Lưu ghi chú `{ content }` trên `Enrollment` |
| POST | `/api/courses` | Bearer + Mentor | Tạo khóa học mới |
| PUT | `/api/courses/:id` | Bearer + Mentor | Cập nhật khóa học |
| PATCH | `/api/courses/:id/publish` | Bearer + Mentor | Xuất bản khóa học |
| DELETE | `/api/courses/:id` | Bearer + Mentor | Lưu trữ / xóa mềm khóa học |

---

### A.6. Module Enrollments — `/api/enrollments`

**File:** `backend/src/routes/enrollments.js`

| Method | Path | Auth | Mô tả |
|:-------|:-----|:-----|:------|
| GET | `/api/enrollments/my` | Bearer | Khóa học tôi đã ghi danh |
| POST | `/api/courses/:id/enroll` | Bearer | Ghi danh khóa học (nằm trong `courses.js`) |
| PATCH | `/api/enrollments/:id/progress` | Bearer | Cập nhật tiến độ học tập |
| PATCH | `/api/enrollments/:id/submit-transfer` | Bearer | Gửi mã CK ghi danh khóa |
| GET | `/api/enrollments/:id/certificate` | Bearer | Lấy hoặc tạo chứng chỉ hoàn thành |

---

### A.7. Module CV — `/api/cv`

**File:** `backend/src/routes/cv.js`

| Method | Path | Auth | Mô tả |
|:-------|:-----|:-----|:------|
| GET | `/api/cv/quota` | Bearer | Kiểm tra quota phân tích CV |
| POST | `/api/cv/analyses` | Bearer | Lưu kết quả phân tích (sau khi chạy Python) |
| GET | `/api/cv/analyses` | Bearer | Danh sách lịch sử phân tích |
| GET | `/api/cv/analyses/:id` | Bearer | Chi tiết bản phân tích |
| DELETE | `/api/cv/analyses/:id` | Bearer | Xóa bản phân tích |

**Proxy Python** (`backend/src/routes/cvMatch.js`, cần `CV_ANALYZER_URL`):

| Method | Path | Mô tả |
|:-------|:-----|:------|
| POST | `/api/cv/analyze` | Khớp từ khóa CV+JD (không LLM) |
| POST | `/api/cv/analyze/full` | Khớp + chấm điểm (LLM/Ollama) |
| POST | `/api/cv/analyze/suggestions` | Pipeline đầy đủ + gợi ý (JD) |
| POST | `/api/cv/analyze/field` | Phân tích theo ngành (`field` form field) |

**FE:** `cvApi.js` (lịch sử CRUD), `CVAnalysis.jsx` (phân tích qua `/api/cv/analyze*`). **Production:** Express + Python. **Supabase Edge:** chỉ khi `VITE_SUPABASE_PROJECT_ID` — fallback tùy env, không bắt buộc.

---

### A.8. Module Interviews — `/api/interviews`

**File:** `backend/src/routes/interviews.js`

| Method | Path | Auth | Mô tả |
|:-------|:-----|:-----|:------|
| POST | `/api/interviews/sessions` | Bearer | Tạo phiên phỏng vấn thử |
| PATCH | `/api/interviews/sessions/:id` | Bearer | Cập nhật câu trả lời |
| POST | `/api/interviews/sessions/:id/complete` | Bearer | Hoàn thành và nhận feedback |
| POST | `/api/interviews/sessions/:id/evaluate` | Bearer | Chấm điểm / feedback bổ sung |
| POST | `/api/interviews/sessions/:id/analyze-face` | Bearer | Vision — cảm xúc khuôn mặt (body `imageBase64`) |
| POST | `/api/interviews/generate-questions` | Bearer | Sinh câu hỏi (LLM) |
| POST | `/api/interviews/extract-cv-text` | Bearer | Trích text từ CV upload |
| GET | `/api/interviews/sessions` | Bearer | Lịch sử phỏng vấn |
| GET | `/api/interviews/sessions/:id` | Bearer | Chi tiết phiên phỏng vấn |

---

### A.9. Module Upload — `/api/upload`

**File:** `backend/src/routes/upload.js`

| Method | Path | Auth | Mô tả |
|:-------|:-----|:-----|:------|
| POST | `/api/upload/avatar` | Bearer | Ảnh đại diện → Cloudinary hoặc `/uploads` local |
| POST | `/api/upload/cv` | Bearer | CV (PDF/DOC) |
| POST | `/api/upload/jd` | Bearer | JD (PDF) |
| POST | `/api/upload/course-thumbnail` | Bearer + Mentor | Ảnh bìa khóa |
| POST | `/api/upload/course-video` | Bearer + Mentor | Video bài học |
| POST | `/api/upload/achievement-image` | Bearer + Admin | Ảnh tin tức / hoạt động (CMS achievements) |

### A.10. Module Admin — `/api/admin`

**File:** `backend/src/routes/admin.js` · **Auth:** `[ADMIN]`

| Method | Path | Mô tả |
|:-------|:-----|:------|
| GET | `/api/admin/stats` | Thống kê tổng quan: users, mentors, bookings, `plans`, `enrollmentsPaid`, `courses`, `reportsOpen`, `bookingsByStatus`, `recentBookings` |
| GET | `/api/admin/users` | Danh sách user — mỗi item có `isOnline`, `lastSeenAt` |
| GET | `/api/admin/users/:id` | Chi tiết user + `stats.bookingsCount`, `stats.enrollmentsCount`, `isOnline`, `lastSeenAt` |
| PATCH | `/api/admin/users/:id/status` | Khóa / mở — body `{ isActive: boolean }` |
| GET | `/api/admin/mentors` | Danh sách mentor — `isOnline`, `lastSeenAt` (từ `userId`) |
| GET | `/api/admin/mentors/:id` | Chi tiết mentor + `stats.sessionsCount`, `isOnline`, `lastSeenAt` |
| PATCH | `/api/admin/mentors/:id/status` | Bật / tắt mentor |
| PATCH | `/api/admin/mentors/:id/reject` | Từ chối đơn đăng ký mentor — body `{ reason? }` |
| PATCH | `/api/admin/mentors/:id/commission` | Cập nhật hoa hồng mentor |
| GET | `/api/admin/bookings` | Tất cả booking |
| GET | `/api/admin/bookings/:id` | Chi tiết booking (populate user/mentor) |
| GET | `/api/admin/reports` | Danh sách báo cáo (`?status`, `?targetType`, `?page`, `?limit`) → `counts`, `pagination` |
| PATCH | `/api/admin/reports/:id` | Cập nhật trạng thái — `{ status, resolution? }` (`reviewing` / `resolved` / `dismissed`); đóng ticket → thông báo người gửi |
| GET | `/api/admin/reviews` | Tất cả đánh giá (`?page=1`, `?limit=50` max 100, `?targetType`, `?visible`) → `reviews`, `counts`, `pagination` |
| PATCH | `/api/admin/reviews/:id/visibility` | Ẩn/hiện — body `{ isVisible: boolean }`, cập nhật lại stats mentor/khóa |
| GET | `/api/reviews/mine` | `[AUTH]` Đánh giá của user cho `targetType` + `targetId` → `{ hasReview, review? }` |
| GET | `/api/admin/system/overview` | Auth, gói, dịch vụ, Mongo topology |
| GET | `/api/admin/system/transaction-support` | Kiểm tra MongoDB transactions |
| GET | `/api/admin/content/stats` | Thống kê phiên AI, CV, khóa + `interviewOps` (7 ngày, few-shot) |
| GET | `/api/admin/content/interview-sessions` | Phiên phỏng vấn AI gần đây + câu hỏi đã lưu (`?limit=30`) |
| GET | `/api/admin/content/course-media` | Danh sách khóa + số bài video (`?scope=all\|published\|pending`) |
| GET | `/api/admin/courses/pending` | Khóa chờ duyệt (`pending_review`, `pending_update`) + `stats.enrollmentCount` (đếm ghi danh `paid`) |
| GET | `/api/admin/courses/published` | Khóa đã xuất bản (`?limit=50`, tối đa 100) + `stats` |
| PATCH | `/api/admin/courses/:id/approve` | Duyệt → `status: published`, xóa `adminReview` |
| PATCH | `/api/admin/courses/:id/reject` | Từ chối — body `{ reason }` (bắt buộc) → `draft`, lưu `adminReview`, thông báo mentor |
| PATCH | `/api/admin/courses/:id/archive` | Gỡ marketplace — body `{ reason? }` → `archived`, lưu `adminReview`, thông báo mentor |
| PATCH | `/api/admin/bookings/:id/confirm-transfer-payment` | Xác nhận CK booking |
| PATCH | `/api/admin/bookings/:id/confirm-refund` | Xác nhận hoàn tiền |
| PATCH | `/api/admin/bookings/:id/status` | Cập nhật trạng thái booking |
| GET | `/api/admin/enrollments/pending-transfer` | Ghi danh chờ xác nhận CK |
| GET | `/api/admin/enrollments/course-payments` | Thanh toán khóa học |
| PATCH | `/api/admin/enrollments/:id/confirm-transfer-payment` | Xác nhận CK ghi danh |
| GET | `/api/admin/payments/subscription-pending` | Gói subscription chờ CK |
| PATCH | `/api/admin/payments/:id/confirm-subscription-transfer` | Xác nhận CK gói |
| POST | `/api/admin/payments/normalize-transfer-refs` | Chuẩn hóa mã tham chiếu CK |
| GET | `/api/admin/finance/courses` | Tổng hợp doanh thu khóa |
| GET | `/api/admin/finance/platform-summary` | Tài chính nền tảng — query `?month=YYYY-MM` (tuỳ chọn) |
| GET | `/api/admin/payouts` | Yêu cầu rút tiền mentor |
| PATCH | `/api/admin/payouts/:id/approve` | Duyệt payout |
| PATCH | `/api/admin/payouts/:id/mark-paid` | Đánh dấu đã chi |
| PATCH | `/api/admin/payouts/:id/reject` | Từ chối payout |
| GET | `/api/admin/interview-metrics` | Metric phỏng vấn AI |
| GET | `/api/admin/analytics/user-behavior` | Hành vi nền tảng — query `?days=` (1–90, mặc định 7) → `{ behavior }` |
| GET | `/api/admin/analytics/users/:id/journey` | Hành trình user — query `?days=`, `?limit=` → `{ journey }` |

**Online presence:** `isOnline` = `lastSeenAt` trong cửa sổ **3 phút** (`backend/src/utils/userPresence.js`). Heartbeat FE: `POST /api/auth/presence` + `authJwt` tự touch mỗi request.

**FE:** `adminApi.js` — list + detail + finance + analytics ✅; `UserJourneyPanel` trên `/admin/users/:id`; `AdminAnalytics.jsx`.

---

### A.11. Module AI providers — `/api/ai`

**File:** `backend/src/routes/aiProviders.js` — proxy STT/TTS/emotion/avatar pregen (thay gọi key trực tiếp từ FE khi bật).

| Method | Path | Auth | Mô tả |
|:-------|:-----|:-----|:------|
| GET | `/api/ai/config` | — | Cấu hình provider công khai |
| POST | `/api/ai/transcribe` | Bearer | Speech-to-text |
| POST | `/api/ai/tts` | Bearer | Text-to-speech |
| GET | `/api/ai/tts/voices` | Bearer | Danh sách giọng |
| POST | `/api/ai/emotion` | Bearer | Phân tích cảm xúc audio |
| GET | `/api/ai/avatar/presenters` | Bearer | Presenter D-ID |
| GET | `/api/ai/avatar/usage` | Bearer | Usage quota avatar |
| POST | `/api/ai/interview/pregenerate` | Bearer | Pregen câu hỏi + TTS (sync) |
| POST | `/api/ai/interview/pregen/start` | Bearer | Pregen async → `jobId` |
| GET | `/api/ai/interview/pregen/:jobId` | Bearer | Poll trạng thái pregen |

**FE:** Interview room, `interviewsApi.js`.

---

### A.12. Bookings & payments mở rộng (tham chiếu)

**File:** `backend/src/routes/bookings.js`, `payments.js` — ngoài contract Phase 1 trong `ROADMAP.md`:

| Method | Path | Auth | Ghi chú |
|:-------|:-----|:-----|:--------|
| PATCH | `/api/bookings/:id/submit-transfer` | Bearer | Gửi mã CK booking |
| PATCH | `/api/bookings/:id/start` | Bearer | Học viên bắt đầu buổi |
| PATCH | `/api/bookings/mentor/:id/start` | Bearer + Mentor | Mentor bắt đầu buổi |
| PATCH | `/api/bookings/mentor/:id/check-in` | Bearer + Mentor | Check-in webcam — body `{ imageUrl }` |
| PATCH | `/api/bookings/mentor/:id/session-capture` | Bearer + Mentor | Lưu ảnh/chụp phiên |
| GET | `/api/bookings/mentor/:id` | Bearer + Mentor | Chi tiết booking phía mentor |
| GET | `/api/bookings/mentor/:id/booked-slots` | — / Mentor | Slot đã đặt |
| PATCH | `/api/bookings/mentor/:id/reschedule` | Bearer + Mentor | Dời lịch (mentor) |
| PATCH | `/api/bookings/mentor/:id/cancel` | Bearer + Mentor | Hủy (mentor) |
| PATCH | `/api/bookings/:id/refund-destination` | Bearer | Cập nhật tài khoản hoàn tiền |
| PATCH | `/api/bookings/:id/mentor-cancel-resolution` | Bearer | Xử lý hủy từ mentor |
| POST | `/api/bookings/:id/report-no-show` | Bearer | Báo no-show |
| GET | `/api/bookings/:id/rebook-credit` | Bearer | Credit đặt lại |
| POST | `/api/bookings/:id/mentor-knowledge` | Bearer + Mentor | Ghi chú kiến thức sau buổi |

**Payments:** `POST /api/payments/subscription/transfer-pending`, `PATCH .../submit-transfer`, VNPay return/IPN, webhook SePay.

**FE check-in:** `MentorMeetingCheckIn.jsx` → `uploadApi` + `submitMentorMeetingCheckIn` · Admin: `/admin/bookings/check-ins`.

---

### A.13. Module Analytics — `/api/analytics`

**File:** `backend/src/routes/analytics.js` · **Model:** `UserEvent` · **Service:** `analyticsService.js`

| Method | Path | Auth | Mô tả |
|:-------|:-----|:-----|:------|
| POST | `/api/analytics/events` | Bearer | Ghi sự kiện hành vi user |

**Body:** `{ events: [{ type, route, action?, durationMs?, metadata?, clientSessionId? }] }` — tối đa **30** sự kiện/request.

| `type` | Bắt buộc thêm | Ghi chú |
|:-------|:--------------|:--------|
| `page_view` | `route` | Thời gian trên trang qua `durationMs` |
| `action` | `route`, `action` | VD: `cv_analyze_start`, `interview_complete`, `checkout_start` |

**Response:** `{ success: true, inserted: number }`

**Admin read** (mount dưới `/api/admin`, xem A.10):

| Method | Path | Response key |
|:-------|:-----|:-------------|
| GET | `/api/admin/analytics/user-behavior` | `behavior` — funnel, top routes, recent actions |
| GET | `/api/admin/analytics/users/:id/journey` | `journey` — timeline, `topRoutes`, `lastStop`, `lastAction` |

**FE:** `usePageAnalytics.js`, `analyticsApi.js`, `trackAction`, `AdminAnalytics.jsx`, `UserJourneyPanel.jsx`.

---

### A.14. Module Achievements — `/api/achievements`

**File:** `backend/src/routes/achievements.js` · **Model:** `Achievement`

| Method | Path | Auth | Mô tả |
|:-------|:-----|:-----|:------|
| GET | `/api/achievements` | — | Tin tức & hoạt động đã publish; query `?all=true` + Bearer admin → gồm bản nháp |
| GET | `/api/achievements/:id` | — | Chi tiết bài viết |
| POST | `/api/achievements` | Bearer + Admin | Tạo — body: `title`, `content`, `category?`, `imageUrl?`, `images?`, `isPublished?`, `date?` |
| PUT | `/api/achievements/:id` | Bearer + Admin | Cập nhật |
| DELETE | `/api/achievements/:id` | Bearer + Admin | Xóa |

**`category`:** `Tin tức` \| `Hoạt động` \| `Sự kiện`

**FE:** `/achievements`, `/achievements/:id` (`Achievements.jsx`, `AchievementDetail.jsx`) · Admin CMS: `/admin/achievements` · Upload ảnh: `POST /api/upload/achievement-image`.

---

### A.15. Module Coupons — `/api/coupons`

**File:** `backend/src/routes/coupons.js` · **Model:** `Coupon` · **Service:** `couponService.js`

| Method | Path | Auth | Ghi chú |
|:-------|:-----|:-----|:--------|
| POST | `/api/coupons/validate` | Bearer | Kiểm tra mã giảm giá — body `{ code, type: "booking"\|"enrollment"\|"subscription", amount }`, trả `{ coupon, discountAmount }`. Chỉ để preview UI ở Checkout; số tiền cuối cùng luôn tính lại ở server khi tạo đơn (booking/enrollment/subscription transfer-pending nhận thêm `couponCode` trong body). |

**Quy tắc:** mỗi user chỉ dùng được 1 lần/mã (`Coupon.usedBy`, đánh dấu atomic qua `claimCouponUsage` khi đơn được tạo thành công — không rollback khi đơn bị hủy sau đó). Hết hạn theo `expiresAt`, có thể giới hạn `applicableTo` (booking/enrollment/subscription/all). Tạo mã mới: `npm run seed:coupon` (mặc định `LAUNCH50`, 50%, hết hạn 05/08/2026 — tùy chỉnh qua env `COUPON_CODE`, `COUPON_DISCOUNT_VALUE`, `COUPON_EXPIRES_AT`, `COUPON_APPLICABLE_TO`).

---

## Phần B — Tích hợp ngoài (FE gọi trực tiếp)

### B.1. Supabase Edge — CV (fallback, không bắt buộc)

| | |
|:--|:--|
| **Luồng chính** | **A.7** — `/api/cv/analyze*` + `/api/cv/analyses` |
| **Supabase** | Chỉ khi `VITE_SUPABASE_PROJECT_ID` — `CVAnalysis.jsx` có nhánh Edge legacy |
| **Khuyến nghị prod** | Chỉ Express + `CV_ANALYZER_URL`; không set Supabase env |

---

### B.2. D-ID — streaming avatar

| | |
|:--|:--|
| **File** | `frontend/src/app/hooks/useDIDStream.js` |
| **Host** | `https://api.d-id.com` |
| **Auth** | `Authorization: Basic base64(<API_KEY> + ":")` |

| # | Method | Path | Mô tả |
|--:|:-------|:-----|:------|
| 1 | POST | `/talks/streams` | Tạo stream — ví dụ `{ "source_url": "..." }` |
| 2 | POST | `/talks/streams/{id}/ice` | ICE |
| 3 | POST | `/talks/streams/{id}/sdp` | SDP answer |
| 4 | POST | `/talks/streams/{id}` | Script (audio / text) |
| 5 | DELETE | `/talks/streams/{id}` | Đóng stream |

---

## Phần C — Roadmap API (tham chiếu)

Danh sách phẳng method/path (C.1–C.17) để tra cứu nhanh. **Đã có route Express hay chưa:** xem cột **Trạng thái** trong [`ROADMAP.md`](./ROADMAP.md) (Phase 1–5). Entrypoint: `backend/src/server.js`.

**Đồng bộ với [`ROADMAP.md`](./ROADMAP.md):** cùng method + path; `ROADMAP.md` gom theo **phase** (1–4) + mục *Bổ sung auth*. Khi đổi contract, sửa **cả hai** file.

### C.1. Auth bổ sung

| Method | Path | Ghi chú |
|:-------|:-----|:--------|
| POST | `/api/auth/logout` | Bearer — `tokenVersion++`, xóa refresh sessions |
| POST | `/api/auth/refresh` | Body `refreshToken` — access ngắn + refresh xoay vòng |
| GET | `/api/auth/sessions` | Bearer — danh sách phiên |
| DELETE | `/api/auth/sessions/:id` | Bearer — thu hồi một phiên |
| POST | `/api/auth/change-password` | **Không cần** — đã gộp `PATCH /api/auth/me` |
| DELETE | `/api/auth/me` | Xóa tài khoản |
| GET | `/api/auth/verify-email` | Xác thực email |
| POST | `/api/auth/resend-verification` | Gửi lại email xác thực |
| POST | `/api/auth/forgot-password` | Quên mật khẩu |
| POST | `/api/auth/reset-password` | Reset mật khẩu |
| POST | `/api/auth/presence` | Heartbeat online (`lastSeenAt`) |

### C.2. Mentors mở rộng

| Method | Path | Ghi chú |
|:-------|:-----|:--------|
| GET | `/api/mentors/:id/availability` | Lịch rảnh |
| GET | `/api/mentors/:id/reviews` | Review |
| PATCH | `/api/mentors/me` | `[AUTH][MENTOR]` Profile mentor |
| PATCH | `/api/mentors/me/availability` | `[AUTH][MENTOR]` Lịch rảnh |
| PATCH | `/api/mentors/me/availability/block` | `[AUTH][MENTOR]` Chặn ngày |
| POST | `/api/mentors/apply` | `[AUTH]` Đăng ký mentor |
| GET | `/api/mentors/me` | `[AUTH]` Profile mentor của user |

### C.3. Bookings — `/api/bookings`

**POST `/api/bookings` `[AUTH]`** — tạo lịch mentor. Body (JSON) tối thiểu:

| Field | Bắt buộc | Ghi chú |
|:------|:---------|:--------|
| `mentorId` | ✓ | `publicId` hoặc `_id` Mongo |
| `date` | ✓ | Chuỗi như Booking.jsx (vd. `Thứ 4, 01/03`) |
| `timeSlot` hoặc `time` | ✓ | `HH:mm` |
| `sessionType` | | Mặc định `mock_interview` |
| `notes` | | Hoặc gửi `position`, `note`, `cvFile`, `jdFile` để ghép `notes` |
| `price` | | So khớp giá mentor (lệch quá 5% so với giá server → 400) |
| `durationMinutes` | | Mặc định 60 |
| `meetingLink`, `orderNum`, `paymentMethod` | | Checkout mock: `paymentStatus: "paid"` → `status: confirmed` |
| `timezone` | | Mặc định `Asia/Ho_Chi_Minh` |

| Method | Path |
|:-------|:-----|
| POST | `/api/bookings` |
| GET | `/api/bookings` |
| GET | `/api/bookings/:id` |
| DELETE | `/api/bookings/:id` |
| PATCH | `/api/bookings/:id/reschedule` |
| POST | `/api/bookings/:id/review` |
| GET | `/api/bookings/mentor/list` |
| PATCH | `/api/bookings/:id/confirm` |
| PATCH | `/api/bookings/:id/complete` |
| PATCH | `/api/bookings/:id/notes` |
| PATCH | `/api/bookings/:id/submit-transfer` |
| PATCH | `/api/bookings/:id/start` |
| PATCH | `/api/bookings/mentor/:id/start` |
| PATCH | `/api/bookings/mentor/:id/check-in` |
| PATCH | `/api/bookings/mentor/:id/session-capture` |
| GET | `/api/bookings/mentor/:id` |
| GET | `/api/bookings/mentor/:id/booked-slots` |
| PATCH | `/api/bookings/mentor/:id/reschedule` |
| PATCH | `/api/bookings/mentor/:id/cancel` |
| PATCH | `/api/bookings/:id/refund-destination` |
| PATCH | `/api/bookings/:id/mentor-cancel-resolution` |
| POST | `/api/bookings/:id/report-no-show` |
| GET | `/api/bookings/:id/rebook-credit` |
| POST | `/api/bookings/:id/mentor-knowledge` |

*Hủy booking:* chỉ dùng **`DELETE /api/bookings/:id`** (cập nhật trạng thái, vd. `cancelled` — không dùng `PATCH .../cancel` để tránh trùng contract).

### C.4. CV trên Express — `/api/cv`

| Method | Path |
|:-------|:-----|
| POST | `/api/cv/analyses` |
| GET | `/api/cv/analyses` |
| GET | `/api/cv/analyses/:id` |
| DELETE | `/api/cv/analyses/:id` |
| GET | `/api/cv/quota` |
| POST | `/api/cv/analyze` |
| POST | `/api/cv/analyze/full` |
| POST | `/api/cv/analyze/suggestions` |
| POST | `/api/cv/analyze/field` |

### C.5. Interview — `/api/interviews`

| Method | Path |
|:-------|:-----|
| POST | `/api/interviews/sessions` |
| PATCH | `/api/interviews/sessions/:id` |
| POST | `/api/interviews/sessions/:id/complete` |
| POST | `/api/interviews/sessions/:id/evaluate` |
| POST | `/api/interviews/sessions/:id/analyze-face` |
| POST | `/api/interviews/generate-questions` |
| POST | `/api/interviews/extract-cv-text` |
| GET | `/api/interviews/sessions` |
| GET | `/api/interviews/sessions/:id` |

### C.6. Courses — `/api/courses`

| Method | Path |
|:-------|:-----|
| GET | `/api/courses` |
| GET | `/api/courses/:id` |
| POST | `/api/courses/:id/enroll` |
| GET | `/api/courses/:id/lessons/:lessonId` |
| GET | `/api/courses/:id/lessons/:lessonId/qa` |
| POST | `/api/courses/:id/lessons/:lessonId/qa` |
| GET | `/api/courses/:id/lessons/:lessonId/notes` |
| PUT | `/api/courses/:id/lessons/:lessonId/notes` |
| POST | `/api/courses` |
| PUT | `/api/courses/:id` |
| PATCH | `/api/courses/:id/publish` |
| DELETE | `/api/courses/:id` |

### C.7. Enrollments — `/api/enrollments`

| Method | Path |
|:-------|:-----|
| GET | `/api/enrollments/my` |
| PATCH | `/api/enrollments/:id/progress` |
| PATCH | `/api/enrollments/:id/submit-transfer` |
| GET | `/api/enrollments/:id/certificate` |

### C.8. Reviews — `/api/reviews`

| Method | Path |
|:-------|:-----|
| POST | `/api/reviews` |
| GET | `/api/reviews?targetType=mentor&targetId=:id` |
| GET | `/api/reviews/mine` |
| PATCH | `/api/reviews/:id/reply` |
| DELETE | `/api/reviews/:id` |

### C.9. Notifications — `/api/notifications`

| Method | Path |
|:-------|:-----|
| GET | `/api/notifications` |
| PATCH | `/api/notifications/:id/read` |
| POST | `/api/notifications/read-all` |
| DELETE | `/api/notifications/:id` |
| GET | `/api/notifications/unread-count` |

### C.10. Payments — `/api/payments`

| Method | Path |
|:-------|:-----|
| POST | `/api/payments/initiate` |
| POST | `/api/payments/webhook/momo` |
| POST | `/api/payments/webhook/zalopay` |
| POST | `/api/payments/webhook/sepay` — header `Authorization: Apikey <SEPAY_WEBHOOK_API_KEY>`; body JSON SePay (`transferType: in`, `transferAmount`, `content` chứa mã `PI…`); trả `{ success: true }` |
| GET | `/api/payments/transfer-status?orderRef=PI…` — Bearer JWT; poll checkout (`status`: `pending` \| `submitted` \| `paid` \| `not_found`) |
| GET | `/api/payments/history` |
| POST | `/api/payments/subscription/transfer-pending` |
| PATCH | `/api/payments/subscription/:paymentId/submit-transfer` |

### C.11. Plans — `/api/plans`

| Method | Path |
|:-------|:-----|
| GET | `/api/plans/current` |
| POST | `/api/plans/activate` |
| POST | `/api/plans/cancel` |

*Plan hiện có field trên `User` (Mongo) — có thể đồng bộ sau.*

### C.12. Dashboard

| Method | Path |
|:-------|:-----|
| GET | `/api/users/dashboard-stats` |
| PATCH | `/api/users/:id/role` `[ADMIN]` — JSON `{ "role": "mentor" }` hoặc `"customer"` |
| GET | `/api/mentor/dashboard` |
| GET | `/api/mentor/finance` |
| GET | `/api/mentor/analytics` |
| POST | `/api/mentor/payout` |

### C.13. Reports & upload

| Method | Path |
|:-------|:-----|
| POST | `/api/reports` |
| GET | `/api/admin/reports` |
| PATCH | `/api/admin/reports/:id` |
| POST | `/api/upload/avatar` |
| POST | `/api/upload/cv` |
| POST | `/api/upload/jd` |
| POST | `/api/upload/course-thumbnail` |
| POST | `/api/upload/course-video` |
| POST | `/api/upload/achievement-image` |

### C.14. Admin — `/api/admin`

| Method | Path |
|:-------|:-----|
| GET | `/api/admin/stats` |
| GET | `/api/admin/users` |
| GET | `/api/admin/users/:id` |
| PATCH | `/api/admin/users/:id/status` |
| GET | `/api/admin/mentors` |
| GET | `/api/admin/mentors/:id` |
| PATCH | `/api/admin/mentors/:id/status` |
| GET | `/api/admin/bookings` |
| GET | `/api/admin/bookings/:id` |
| PATCH | `/api/admin/bookings/:id/status` |
| PATCH | `/api/admin/bookings/:id/confirm-transfer-payment` |
| PATCH | `/api/admin/bookings/:id/confirm-refund` |
| PATCH | `/api/admin/mentors/:id/reject` |
| PATCH | `/api/admin/mentors/:id/commission` |
| GET | `/api/admin/payouts` |
| GET | `/api/admin/finance/platform-summary` |
| GET | `/api/admin/finance/courses` |
| GET | `/api/admin/enrollments/pending-transfer` |
| GET | `/api/admin/enrollments/course-payments` |
| PATCH | `/api/admin/enrollments/:id/confirm-transfer-payment` |
| GET | `/api/admin/payments/subscription-pending` |
| PATCH | `/api/admin/payments/:id/confirm-subscription-transfer` |
| POST | `/api/admin/payments/normalize-transfer-refs` |
| GET | `/api/admin/courses/pending` |
| GET | `/api/admin/courses/published` |
| PATCH | `/api/admin/courses/:id/approve` |
| PATCH | `/api/admin/courses/:id/reject` |
| PATCH | `/api/admin/courses/:id/archive` |
| GET | `/api/admin/content/stats` |
| GET | `/api/admin/content/interview-sessions` |
| GET | `/api/admin/content/course-media` |
| GET | `/api/admin/system/overview` |
| GET | `/api/admin/system/transaction-support` |
| GET | `/api/admin/reviews` |
| PATCH | `/api/admin/reviews/:id/visibility` |
| GET | `/api/admin/interview-metrics` |
| GET | `/api/admin/analytics/user-behavior` |
| GET | `/api/admin/analytics/users/:id/journey` |

### C.15. AI providers — `/api/ai`

| Method | Path |
|:-------|:-----|
| GET | `/api/ai/config` |
| POST | `/api/ai/transcribe` |
| POST | `/api/ai/tts` |
| GET | `/api/ai/tts/voices` |
| POST | `/api/ai/emotion` |
| GET | `/api/ai/avatar/presenters` |
| GET | `/api/ai/avatar/usage` |
| POST | `/api/ai/interview/pregenerate` |
| POST | `/api/ai/interview/pregen/start` |
| GET | `/api/ai/interview/pregen/:jobId` |

### C.16. Analytics — `/api/analytics` & admin read

| Method | Path | Auth |
|:-------|:-----|:-----|
| POST | `/api/analytics/events` | Bearer |
| GET | `/api/admin/analytics/user-behavior` | Admin — `?days=` |
| GET | `/api/admin/analytics/users/:id/journey` | Admin — `?days=`, `?limit=` |

### C.17. Achievements — `/api/achievements`

| Method | Path | Auth |
|:-------|:-----|:-----|
| GET | `/api/achievements` | Public — `?all=true` (admin) |
| GET | `/api/achievements/:id` | Public |
| POST | `/api/achievements` | Admin |
| PUT | `/api/achievements/:id` | Admin |
| DELETE | `/api/achievements/:id` | Admin |

---

## Query params chuẩn (dự kiến)

| Mục đích | Ví dụ |
|:---------|:------|
| Phân trang | `?page=1&limit=10` |
| Sắp xếp | `?sortBy=createdAt&order=desc` |
| Khoảng ngày | `?from=2026-01-01&to=2026-02-01` |
| Lọc | `?status=confirmed&field=IT` |

---

## Định dạng response

### Thực tế (Express auth & mentors)

- Thành công: `{ "success": true, ... }` — key trực tiếp `user`, `token`, `mentors`, `mentor` (không bắt buộc bọc `data`).
- Lỗi: `{ "success": false, "error": "..." }`.

### Chuẩn dự kiến (thống nhất sau này)

**Một object:**

```json
{ "success": true, "data": { } }
```

**Danh sách + phân trang:**

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": { "total": 100, "page": 1, "limit": 10, "totalPages": 10 }
  }
}
```

**Lỗi:**

```json
{
  "success": false,
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Bạn đã hết lượt phân tích CV.",
    "statusCode": 403
  }
}
```

---

## Mã lỗi gợi ý

| Code | HTTP | Ý nghĩa |
|:-----|:-----|:--------|
| `UNAUTHORIZED` | 401 | Token hết hạn / không hợp lệ |
| `FORBIDDEN` | 403 | Không đủ quyền |
| `QUOTA_EXCEEDED` | 403 | Hết quota theo plan |
| `NOT_FOUND` | 404 | Không tìm thấy |
| `VALIDATION_ERROR` | 422 | Dữ liệu không hợp lệ |
| `BOOKING_CONFLICT` | 409 | Trùng slot |
| `PAYMENT_REQUIRED` / `PAYMENT_FAILED` | 402 | Thanh toán |
| `AI_SERVICE_ERROR` | 503 | Lỗi dịch vụ AI |
| `UPLOAD_FAILED` | 500 | Lỗi upload |

---

## Roadmap triển khai (gợi ý sprint)

Chi tiết endpoint theo phase và màn FE: **[`ROADMAP.md`](./ROADMAP.md)** (Phase 1–4 + *Bổ sung auth*).

| Sprint | Nội dung gợi ý *(khớp phase trong `ROADMAP.md`)* |
|:-------|:---------------|
| **1** | Phase 1 — booking + payments + plans + `dashboard-stats` |
| **2** | Phase 2 — mentor vận hành, reviews, reports, availability mentor |
| **3** | Phase 3 — courses, enrollments, certificate |
| **4** | Phase 4 — CV Express, interview sessions, notifications, upload |
| **5** | Mở rộng — auth email, CK admin, `/api/ai`, booking/payment mở rộng (xem `ROADMAP.md` Phase 5) |

*(Điều chỉnh theo ưu tiên sản phẩm.)*

---

## Model MongoDB

Chi tiết collection và field: [`backend/DATABASE.md`](./backend/DATABASE.md).

**Bổ sung (ngoài 17 schema gốc):**

| Collection | Model | Ghi chú |
|:-----------|:------|:--------|
| `user_events` | `UserEvent.js` | Page view / action tracking — analytics |
| `achievements` | `Achievement.js` | Tin tức & hoạt động công khai + CMS admin |
| `coupons` | `Coupon.js` | Mã giảm giá Checkout (booking/enrollment/subscription), 1 lần/user |

Field presence trên `User`: `lastSeenAt` (heartbeat `/api/auth/presence` + `authJwt`).

---

## Bản đồ file trong repo

| Nội dung | Đường dẫn |
|:---------|:----------|
| `apiUrl`, proxy dev | `frontend/src/app/utils/api.js` |
| Auth client | `frontend/src/app/utils/auth/auth.js` |
| Admin client | `frontend/src/app/api/adminApi.js` |
| Analytics client | `frontend/src/app/utils/analytics/analyticsApi.js`, `hooks/usePageAnalytics.js` |
| Presence heartbeat | `frontend/src/app/hooks/useUserPresence.js` |
| Achievements client | `frontend/src/app/api/achievementsApi.js` |
| Notifications client | `frontend/src/app/api/notificationApi.js` |
| Upload client | `frontend/src/app/api/uploadApi.js` |
| Mentor client | `frontend/src/app/utils/mentorApi.js` |
| CV (Express + Python) | `frontend/src/app/utils/cv/cvApi.js`, `pages/cv/CVAnalysis.jsx` |
| D-ID stream | `frontend/src/app/hooks/useDIDStream.js` |
| AI proxy routes | `backend/src/routes/aiProviders.js` |
| Analytics routes | `backend/src/routes/analytics.js` |
| Achievements routes | `backend/src/routes/achievements.js` |
| User presence util | `backend/src/utils/userPresence.js` |
| Analytics service | `backend/src/services/analyticsService.js` |
| Entry server | `backend/src/server.js` |
| Auth controller | `backend/src/controllers/authController.js` |
| Mentors controller | `backend/src/controllers/mentorsController.js` |
| Auth service (logic) | `backend/src/services/authService.js` |
| Mentors service (logic) | `backend/src/services/mentorsService.js` |
| Auth routes | `backend/src/routes/auth.js` |
| Mentors routes | `backend/src/routes/mentors.js` |
| JWT middleware | `backend/src/middleware/authJwt.js` |
| User public JSON | `backend/src/models/User.js` |

---

*Tài liệu gồm: (1) API Express đang chạy (A.1–A.15), (2) Supabase & D-ID mà FE dùng, (3) roadmap endpoint Phần C (C.1–C.17). Cập nhật lần cuối: thêm module Coupons (mã giảm giá tại Checkout).*

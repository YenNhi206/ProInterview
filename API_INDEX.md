# ProInterview — Tài liệu API & tích hợp (đầy đủ)

File trong repo: `API_INDEX.md`. Cập nhật khi thêm route, đổi FE hoặc đổi provider (Supabase / thanh toán).

| Phần | Nội dung |
|:-----|:---------|
| **A** | Backend Express — đã mount trong `backend/src/index.js` |
| **B** | Supabase Edge (CV), D-ID — FE gọi trực tiếp |
| **C** | Roadmap — chưa có route Express / FE đang mock |

---

## Mục lục

1. [Chú giải trạng thái](#chú-giải-trạng-thái)
2. [Biến môi trường liên quan](#biến-môi-trường-liên-quan)
3. [Base URL & xác thực](#base-url--xác-thực)
4. [Phần A — Backend Express](#phần-a--backend-express-đã-có-trong-repo)
5. [Phần B — Tích hợp ngoài](#phần-b--tích-hợp-ngoài-fe-gọi-trực-tiếp)
6. [Phần C — Roadmap API](#phần-c--roadmap-api-chưa-có-route-express--fe-đang-mock)
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

**Mount:** `backend/src/index.js`  
`app.use("/api/auth", authRouter)` · `app.use("/api/mentors", mentorsRouter)`

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
| POST | `/api/auth/register` | — | Đăng ký |
| POST | `/api/auth/login` | — | Email + mật khẩu |
| POST | `/api/auth/google` | — | Google ID token (GIS) |
| GET | `/api/auth/me` | Bearer | Profile hiện tại |
| PATCH | `/api/auth/me` | Bearer | Profile + **đặt/đổi mật khẩu** |

#### Chi tiết từng endpoint

| Endpoint | Body / header | Response thành công | Lỗi thường gặp |
|:---------|:--------------|:---------------------|:---------------|
| `POST /register` | `name`, `email`, `password`, `role?` | `201` `{ success: true }` — **không** có `token` | `400`, `409` |
| `POST /login` | `email`, `password` | `{ success, token, user }` | `401`, `503` |
| `POST /google` | `credential` | `{ success, token, user }` | `400`–`503` |
| `GET /me` | `Authorization: Bearer` | `{ success, user }` | `401` |
| `PATCH /me` | JSON: mật khẩu +/ hoặc profile | `{ success, user }` | `400`, `401`, `409` |

**Đổi mật khẩu (`PATCH /me`):** gửi `newPassword` hoặc `password`. Chưa liên kết Google → bắt buộc `currentPassword`. Đã liên kết Google → `currentPassword` tùy chọn.  
**Không** dùng `POST /api/auth/change-password` — gộp trong `PATCH /me`.

**Profile (`PATCH /me` — một phần):** `name`, `phone`, `position`, `school`, `field`, `avatar`, `expertise`, `experience`, `hourlyRate`, `bio`, `email` (check trùng).

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

**FE:** `frontend/src/app/utils/auth.js`, `Settings.jsx`, …

**Logout:** không có `POST /logout` server — FE `logout()` xóa `localStorage` (`prointerview_auth`, `prointerview_access_token`).

---

### A.4. Module Mentors — `/api/mentors`

**File:** `backend/src/routes/mentors.js` — cần MongoDB; có thể seed `mentorsSeed.json` nếu rỗng.

| Method | Path | Auth | Mô tả |
|:-------|:-----|:-----|:------|
| GET | `/api/mentors` | — | Danh sách |
| GET | `/api/mentors/:id` | — | Chi tiết — `id` = `publicId` hoặc `_id` |

| Trường hợp | Response |
|:-----------|:---------|
| `GET /api/mentors` | `{ success: true, mentors: [...] }` |
| `GET /api/mentors/:id` | `{ success: true, mentor: {...} }` |
| Không tìm thấy | `404` `{ success: false, error: "Not found" }` |
| MongoDB lỗi | `503` |

**FE:** `frontend/src/app/utils/mentorApi.js` — dùng tại `Mentors.jsx`, `MentorProfile.jsx`, `Booking.jsx`, `Checkout.jsx`.

---

## Phần B — Tích hợp ngoài (FE gọi trực tiếp)

### B.1. Supabase Edge — phân tích CV

| | |
|:--|:--|
| **File FE** | `frontend/src/app/pages/cv/CVAnalysis.jsx` |
| **Base** | `https://${projectId}.supabase.co/functions/v1/make-server-64a0c849/` |

| Method | Path (sau base) | Mô tả |
|:-------|:----------------|:------|
| GET | `cv/analyses` | Lịch sử — FE đọc `data.analyses` |
| POST | `cv-analysis` | Upload — `FormData`, không set `Content-Type` tay |
| GET | `cv/analyses/:id` | Chi tiết |
| DELETE | `cv/analyses/:id` | Xóa |

**FormData (`buildFd`):**

| Key | Khi nào |
|:----|:--------|
| `cv` | File CV mới |
| `cvPath` | Tái sử dụng CV đã lưu |
| `jd` | File JD (mode JD) |
| `jdPath` | JD đã lưu |
| `mode` | Ví dụ `field`, `jd` |
| `field` | Lĩnh vực (optional) |

Token: `getFreshAccessToken()` (JWT backend). Không token hoặc `401` → FE có thể chạy **demo mock**.  
**Tương lai:** có thể chuẩn hóa `POST /api/cv/analyses` trên Express.

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

## Phần C — Roadmap API (chưa có route Express / FE đang mock)

📋 Kế hoạch thiết kế — `backend/src/index.js` **chưa** mount các router này. Nhiều màn FE dùng **mock / localStorage**.

**Đồng bộ với [`ROADMAP.md`](./ROADMAP.md):** cùng method + path; bảng dưới là danh sách phẳng (C.1–C.13), `ROADMAP.md` gom theo **phase** (1–4) + mục *Bổ sung auth*. Khi đổi contract, sửa **cả hai** file.

### C.1. Auth bổ sung

| Method | Path | Ghi chú |
|:-------|:-----|:--------|
| POST | `/api/auth/logout` | Invalidate token server (blacklist / refresh) |
| POST | `/api/auth/change-password` | **Không cần** — đã gộp `PATCH /api/auth/me` |
| DELETE | `/api/auth/me` | Xóa tài khoản |

### C.2. Mentors mở rộng

| Method | Path | Ghi chú |
|:-------|:-----|:--------|
| GET | `/api/mentors/:id/availability` | Lịch rảnh |
| GET | `/api/mentors/:id/reviews` | Review |
| PATCH | `/api/mentors/me` | `[AUTH][MENTOR]` Profile mentor |
| PATCH | `/api/mentors/me/availability` | `[AUTH][MENTOR]` Lịch rảnh |
| PATCH | `/api/mentors/me/availability/block` | `[AUTH][MENTOR]` Chặn ngày |

### C.3. Bookings — `/api/bookings`

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

*Hủy booking:* chỉ dùng **`DELETE /api/bookings/:id`** (cập nhật trạng thái, vd. `cancelled` — không dùng `PATCH .../cancel` để tránh trùng contract).

### C.4. CV trên Express — `/api/cv`

| Method | Path |
|:-------|:-----|
| POST | `/api/cv/analyses` |
| GET | `/api/cv/analyses` |
| GET | `/api/cv/analyses/:id` |
| DELETE | `/api/cv/analyses/:id` |
| GET | `/api/cv/quota` |

### C.5. Interview — `/api/interviews`

| Method | Path |
|:-------|:-----|
| POST | `/api/interviews/sessions` |
| PATCH | `/api/interviews/sessions/:id` |
| POST | `/api/interviews/sessions/:id/complete` |
| GET | `/api/interviews/sessions` |
| GET | `/api/interviews/sessions/:id` |

### C.6. Courses — `/api/courses`

| Method | Path |
|:-------|:-----|
| GET | `/api/courses` |
| GET | `/api/courses/:id` |
| POST | `/api/courses/:id/enroll` |
| GET | `/api/courses/:id/lessons/:lessonId` |
| POST | `/api/courses` |
| PUT | `/api/courses/:id` |
| PATCH | `/api/courses/:id/publish` |
| DELETE | `/api/courses/:id` |

### C.7. Enrollments — `/api/enrollments`

| Method | Path |
|:-------|:-----|
| GET | `/api/enrollments/my` |
| PATCH | `/api/enrollments/:id/progress` |
| GET | `/api/enrollments/:id/certificate` |

### C.8. Reviews — `/api/reviews`

| Method | Path |
|:-------|:-----|
| POST | `/api/reviews` |
| GET | `/api/reviews?targetType=mentor&targetId=:id` |
| PATCH | `/api/reviews/:id/reply` |
| DELETE | `/api/reviews/:id` |

### C.9. Notifications — `/api/notifications`

| Method | Path |
|:-------|:-----|
| GET | `/api/notifications` |
| PATCH | `/api/notifications/:id/read` |
| PATCH | `/api/notifications/read-all` |
| DELETE | `/api/notifications/:id` |
| GET | `/api/notifications/unread-count` |

### C.10. Payments — `/api/payments`

| Method | Path |
|:-------|:-----|
| POST | `/api/payments/initiate` |
| POST | `/api/payments/webhook/momo` |
| POST | `/api/payments/webhook/zalopay` |
| GET | `/api/payments/history` |

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
| GET | `/api/mentor/dashboard` |
| GET | `/api/mentor/finance` |
| GET | `/api/mentor/analytics` |
| POST | `/api/mentor/payout` |

### C.13. Reports & upload

| Method | Path |
|:-------|:-----|
| POST | `/api/reports` |
| POST | `/api/upload/avatar` |
| POST | `/api/upload/cv` |
| POST | `/api/upload/course-thumbnail` |

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

*(Điều chỉnh theo ưu tiên sản phẩm.)*

---

## Model MongoDB

Chi tiết collection và field: [`backend/DATABASE.md`](./backend/DATABASE.md).

---

## Bản đồ file trong repo

| Nội dung | Đường dẫn |
|:---------|:----------|
| `apiUrl`, proxy dev | `frontend/src/app/utils/api.js` |
| Auth client | `frontend/src/app/utils/auth.js` |
| Mentor client | `frontend/src/app/utils/mentorApi.js` |
| CV + Supabase Edge | `frontend/src/app/pages/cv/CVAnalysis.jsx` |
| D-ID stream | `frontend/src/app/hooks/useDIDStream.js` |
| Mount API | `backend/src/index.js` |
| Auth controller | `backend/src/controllers/authController.js` |
| Mentors controller | `backend/src/controllers/mentorsController.js` |
| Auth service (logic) | `backend/src/services/authService.js` |
| Mentors service (logic) | `backend/src/services/mentorsService.js` |
| Auth routes | `backend/src/routes/auth.js` |
| Mentors routes | `backend/src/routes/mentors.js` |
| JWT middleware | `backend/src/middleware/authJwt.js` |
| User public JSON | `backend/src/models/User.js` |

---

*Tài liệu gồm: (1) API Express đang chạy, (2) Supabase & D-ID mà FE dùng, (3) roadmap endpoint.*

# Postman cheat sheet — ProInterview API (dev)

File này giúp bạn **test nhanh trên Postman** theo đúng flow hiện tại của backend (Express + MongoDB).

---

## Endpoint đã có trong backend (✅)

Mục này là “checklist quản lý” — các endpoint dưới đây là **đã implement** (khác với `ROADMAP.md` còn 📋).

### A) Public

- **Health**
  - ✅ `GET /api/health`
  - ✅ `GET /` (trả JSON giới thiệu service)
- **Mentors**
  - ✅ `GET /api/mentors`
  - ✅ `GET /api/mentors/:id`
  - ✅ `GET /api/mentors/:id/availability`
  - ✅ `GET /api/mentors/:id/reviews`
- **Reviews**
  - ✅ `GET /api/reviews?targetType=mentor&targetId=...`

### B) Auth / Account (`[AUTH]`)

- ✅ `POST /api/auth/register` (chỉ register customer; admin cần `adminInviteCode`; **không** register mentor)
- ✅ `POST /api/auth/login`
- ✅ `POST /api/auth/google`
- ✅ `GET /api/auth/me`
- ✅ `PATCH /api/auth/me` (profile + đổi mật khẩu; **không** tự nâng mentor)

### C) Admin (`[AUTH][ADMIN]`)

- ✅ `PATCH /api/users/:id/role` (đặt `role: "mentor"` hoặc `"customer"`)

### D) Customer bookings / payments / plans (`[AUTH]`)

- **Bookings**
  - ✅ `GET /api/bookings`
  - ✅ `POST /api/bookings`
  - ✅ `GET /api/bookings/:id`
  - ✅ `DELETE /api/bookings/:id`
  - ✅ `PATCH /api/bookings/:id/reschedule`
- **Payments**
  - ✅ `POST /api/payments/initiate`
  - ✅ `POST /api/payments/webhook/momo`
  - ✅ `POST /api/payments/webhook/zalopay`
  - ✅ `GET /api/payments/history`
- **Plans**
  - ✅ `GET /api/plans/current`
  - ✅ `POST /api/plans/activate`
  - ✅ `POST /api/plans/cancel`
- **Dashboard**
  - ✅ `GET /api/users/dashboard-stats`

### E) Mentor ops (`[AUTH][MENTOR]`)

- **Bookings (mentor)**
  - ✅ `GET /api/bookings/mentor/list`
  - ✅ `PATCH /api/bookings/:id/confirm`
  - ✅ `PATCH /api/bookings/:id/complete`
  - ✅ `PATCH /api/bookings/:id/notes`
- **Mentor self**
  - ✅ `PATCH /api/mentors/me`
  - ✅ `PATCH /api/mentors/me/availability`
  - ✅ `PATCH /api/mentors/me/availability/block`
- **Mentor dashboard/finance**
  - ✅ `GET /api/mentor/dashboard`
  - ✅ `GET /api/mentor/finance`
  - ✅ `GET /api/mentor/analytics`
  - ✅ `POST /api/mentor/payout`
- **Reviews**
  - ✅ `PATCH /api/reviews/:id/reply`

### F) Reports (`[AUTH]`)

- ✅ `POST /api/reports`

---

## 0) Chuẩn bị

### Base URL

- **Dev default**: `http://localhost:5000`
- Nếu bạn đổi `PORT` trong `backend/.env` thì thay `5000` tương ứng.

### Header chung

- **JSON**
  - `Content-Type: application/json`
  - `Accept: application/json`
- **Auth (khi endpoint có `[AUTH]`)**
  - `Authorization: Bearer <token>`

### Biến môi trường (Postman Environment)

Tạo các variables sau (gợi ý):

- `BASE_URL` = `http://localhost:5000`
- `ADMIN_TOKEN`
- `USER_TOKEN`
- `USER_ID` (ObjectId string)
- `MENTOR_PUBLIC_ID` (vd. `u69da9b73...`)
- `BOOKING_ID`
- `REVIEW_ID`

---

## 1) Health check

### 1.1 `GET /api/health`

**GET** `{{BASE_URL}}/api/health`

Kỳ vọng:

- `ok: true`
- `database: "connected"`

---

## 2) Auth

### 2.1 Register (customer)

> Lưu ý: **không đăng ký role mentor** qua API. Mentor chỉ do admin cấp quyền.

**POST** `{{BASE_URL}}/api/auth/register`

Body:

```json
{
  "name": "Test User",
  "email": "test_user_01@dev.local",
  "password": "Dev123456"
}
```

Kỳ vọng: `201 { success: true }`

### 2.2 Login (lấy token)

**POST** `{{BASE_URL}}/api/auth/login`

Body:

```json
{
  "email": "customer@dev.local",
  "password": "Dev123456"
}
```

Kỳ vọng:

- `success: true`
- có `token`
- có `user`

Gán:

- `USER_TOKEN` = `token`
- `USER_ID` = `user.id`

### 2.3 Me

**GET** `{{BASE_URL}}/api/auth/me` `[AUTH]`

Header:

- `Authorization: Bearer {{USER_TOKEN}}`

---

## 3) Admin cấp quyền mentor (bắt buộc)

### 3.1 Login admin

**POST** `{{BASE_URL}}/api/auth/login`

Body:

```json
{
  "email": "admin@dev.local",
  "password": "Dev123456"
}
```

Gán:

- `ADMIN_TOKEN` = `token`

### 3.2 Cấp quyền mentor cho user

**PATCH** `{{BASE_URL}}/api/users/{{USER_ID}}/role` `[AUTH][ADMIN]`

Header:

- `Authorization: Bearer {{ADMIN_TOKEN}}`

Body:

```json
{ "role": "mentor" }
```

Kỳ vọng:

- `success: true`
- `user.role: "mentor"`

---

## 4) Mentors (public + mentor self)

### 4.1 Danh sách mentor (public)

**GET** `{{BASE_URL}}/api/mentors`

Kỳ vọng: `success: true`, `mentors: []`

Chọn mentor mới, gán:

- `MENTOR_PUBLIC_ID` = `mentor.id` (thường dạng `u<ObjectId>`)

### 4.2 Mentor update profile (self)

**PATCH** `{{BASE_URL}}/api/mentors/me` `[AUTH][MENTOR]`

Header:

- `Authorization: Bearer {{USER_TOKEN}}`

Body ví dụ:

```json
{
  "title": "Senior Developer",
  "company": "FPT",
  "bio": "Mình hỗ trợ mock interview và review CV.",
  "pricePerHour": 400000,
  "fields": ["Backend"],
  "specialties": ["Node.js", "System Design"]
}
```

### 4.3 Mentor set availability (self)

**PATCH** `{{BASE_URL}}/api/mentors/me/availability` `[AUTH][MENTOR]`

Body ví dụ:

```json
{
  "recurringSchedule": [
    { "dayOfWeek": 0, "slots": ["09:00", "10:00"] },
    { "dayOfWeek": 2, "slots": ["14:00", "15:00"] }
  ],
  "availableSlots": {
    "2026-04-20": ["09:00", "11:00"]
  }
}
```

### 4.4 Mentor block dates (self)

**PATCH** `{{BASE_URL}}/api/mentors/me/availability/block` `[AUTH][MENTOR]`

Body:

```json
{ "dates": ["2026-04-21", "2026-04-22"] }
```

### 4.5 Get availability (public)

**GET** `{{BASE_URL}}/api/mentors/{{MENTOR_PUBLIC_ID}}/availability`

---

## 5) Bookings (customer + mentor ops)

### 5.1 Customer tạo booking

**POST** `{{BASE_URL}}/api/bookings` `[AUTH]`

Header:

- `Authorization: Bearer {{USER_TOKEN}}`

Body ví dụ:

```json
{
  "mentorId": "{{MENTOR_PUBLIC_ID}}",
  "date": "20/04/2026",
  "timeSlot": "09:00",
  "sessionType": "mock_interview",
  "price": 400000,
  "notes": "Test booking"
}
```

Gán:

- `BOOKING_ID` = `booking.id`

### 5.2 Mentor list bookings

**GET** `{{BASE_URL}}/api/bookings/mentor/list` `[AUTH][MENTOR]`

Header:

- `Authorization: Bearer {{USER_TOKEN}}`

### 5.3 Mentor confirm booking

**PATCH** `{{BASE_URL}}/api/bookings/{{BOOKING_ID}}/confirm` `[AUTH][MENTOR]`

### 5.4 Mentor add notes

**PATCH** `{{BASE_URL}}/api/bookings/{{BOOKING_ID}}/notes` `[AUTH][MENTOR]`

Body:

```json
{ "notes": "Đã confirm, chuẩn bị STAR questions." }
```

### 5.5 Mentor complete booking

**PATCH** `{{BASE_URL}}/api/bookings/{{BOOKING_ID}}/complete` `[AUTH][MENTOR]`

---

## 6) Reviews

### 6.1 Tạo review (sau khi booking completed)

**POST** `{{BASE_URL}}/api/reviews` `[AUTH]`

Header:

- `Authorization: Bearer {{USER_TOKEN}}`

Body:

```json
{
  "targetType": "mentor",
  "targetId": "{{MENTOR_PUBLIC_ID}}",
  "bookingId": "{{BOOKING_ID}}",
  "rating": 5,
  "comment": "Mentor rất nhiệt tình, góp ý rõ ràng.",
  "tags": ["feedback", "communication"]
}
```

Gán:

- `REVIEW_ID` = `review.id`

### 6.2 List reviews (public)

**GET** `{{BASE_URL}}/api/reviews?targetType=mentor&targetId={{MENTOR_PUBLIC_ID}}`

### 6.3 List reviews theo mentor (public)

**GET** `{{BASE_URL}}/api/mentors/{{MENTOR_PUBLIC_ID}}/reviews`

### 6.4 Mentor reply review

**PATCH** `{{BASE_URL}}/api/reviews/{{REVIEW_ID}}/reply` `[AUTH][MENTOR]`

Header:

- `Authorization: Bearer {{USER_TOKEN}}`

Body:

```json
{ "content": "Cảm ơn bạn! Hẹn gặp lại ở buổi tiếp theo." }
```

### 6.5 Delete review (owner)

**DELETE** `{{BASE_URL}}/api/reviews/{{REVIEW_ID}}` `[AUTH]`

Header:

- `Authorization: Bearer {{USER_TOKEN}}`

---

## 7) Reports

### 7.1 Report mentor

**POST** `{{BASE_URL}}/api/reports` `[AUTH]`

Header:

- `Authorization: Bearer {{USER_TOKEN}}`

Body (reason enum: `late|unprofessional|inappropriate|no_show|fraud|other`):

```json
{
  "targetType": "mentor",
  "targetId": "{{MENTOR_PUBLIC_ID}}",
  "reason": "unprofessional",
  "title": "Mentor dời lịch nhiều lần",
  "description": "Mentor dời lịch 3 lần sát giờ, làm mình không sắp xếp được.",
  "evidenceUrls": []
}
```

---

## 8) Mentor dashboard / finance / analytics / payout

### 8.1 Dashboard

**GET** `{{BASE_URL}}/api/mentor/dashboard` `[AUTH][MENTOR]`

Header:

- `Authorization: Bearer {{USER_TOKEN}}`

### 8.2 Finance

**GET** `{{BASE_URL}}/api/mentor/finance` `[AUTH][MENTOR]`

### 8.3 Analytics

**GET** `{{BASE_URL}}/api/mentor/analytics` `[AUTH][MENTOR]`

### 8.4 Payout request (minimal)

**POST** `{{BASE_URL}}/api/mentor/payout` `[AUTH][MENTOR]`

Body:

```json
{ "amount": 100000 }
```

---

## 9) Ghi chú lỗi hay gặp

- **401 Chưa đăng nhập**: thiếu header `Authorization: Bearer ...`
- **403 Chỉ mentor/admin**: token đúng nhưng `user.role` chưa phải `mentor/admin`.
- **503 MongoDB chưa kết nối**: thiếu `MONGO_URI` hoặc MongoDB chưa chạy.
- **Review booking**: chỉ tạo review khi booking đã `completed` và booking thuộc user đó.


# Database — MongoDB & Mongoose (ProInterview backend)

**Vị trí file:** `backend/DATABASE.md` (cùng cấp với `package.json` của backend).

Tài liệu mô tả kết nối MongoDB, các collection/model, lệnh seed, test nhanh và lưu ý migration.

**Tham chiếu API (HTTP routes, tích hợp ngoài):** xem [`../API_INDEX.md`](../API_INDEX.md) ở thư mục gốc repo.

---

## Mục lục

1. [Tham khảo nhanh](#ref-quick) — lệnh, tài khoản dev, URL test, đường dẫn file  
2. [Yêu cầu & `.env`](#ref-env)  
3. [Luồng kết nối trong code](#ref-flow)  
4. [Bảng model → collection](#ref-models)  
5. [Import model trong code](#ref-import)  
6. [Seed dữ liệu (mentor, user)](#ref-seed)  
7. [Google: `googleId` / `googleSub`](#ref-google)  
8. [Mentor: `id` cũ vs `publicId`](#ref-mentor-id)  
9. [Kiểm tra kết nối & xem dữ liệu](#ref-test)  
10. [Mở rộng (thêm model / route)](#ref-extend)

---

<a id="ref-quick"></a>

## 1. Tham khảo nhanh (dùng hàng ngày)

### Lệnh npm (chạy trong thư mục `backend/`)

| Lệnh | Khi nào dùng |
|------|----------------|
| `npm run dev` | Chạy backend có nodemon (sửa code tự restart). |
| `npm start` | Chạy backend một lần (`node src/server.js`). |
| `npm run seed` | Giống `seed:users`: nạp **user dev** từ `src/data/usersSeed.json` khi `users` trống. |
| `npm run seed:users` | Nạp **user dev** từ `src/data/usersSeed.json` — **chỉ khi** collection `users` đang trống. |
| `npm run seed:all` | Seed user dev (không còn seed mentor giả). |
| `npm run db:prune-fake-mentors` | Xóa trong MongoDB các document `mentors` **không có `userId`** (catalog cũ). |

### Tài khoản dev mặc định (sau `seed:users`)

Mật khẩu mặc định nằm trong `src/data/usersSeed.json` (thường là `Dev123456`).

| Email | Vai trò |
|--------|---------|
| `customer@dev.local` | customer |
| `mentor@dev.local` | mentor |
| `admin@dev.local` | admin |

### Biến môi trường tối thiểu (file `backend/.env`)

```env
MONGO_URI=mongodb://127.0.0.1:27017/prointerview
JWT_SECRET=chuoi-bi-mat-du-dai
```

`JWT_SECRET` cần khi gọi đăng ký / đăng nhập / `/api/auth/me`.

### URL test nhanh (backend mặc định `PORT=5000`)

| Mục đích | URL |
|----------|-----|
| Server + DB có nối không | `GET http://localhost:5000/api/health` — trong JSON cần `"database": "connected"`. |
| Danh sách mentor (chỉ mentor có tài khoản, `userId`) | `GET http://localhost:5000/api/mentors` |
| Đăng nhập (sau khi có user) | `POST http://localhost:5000/api/auth/login` — body JSON: `email`, `password` |

**PowerShell** (ví dụ):

```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/health"
Invoke-RestMethod -Uri "http://localhost:5000/api/mentors"
```

### File / thư mục hay cần

| Nội dung | Đường dẫn |
|----------|-----------|
| Model (schema) | `backend/src/models/*.js` |
| Export tập trung | `backend/src/models/index.js` |
| Kết nối DB | `backend/src/db/connect.js` |
| Seed user dev | `backend/src/data/usersSeed.json`, script `backend/src/scripts/seedUsers.js` |
| Xóa mentor không user | `backend/src/scripts/pruneFakeMentors.js` (`npm run db:prune-fake-mentors`) |
| Entry server | `backend/src/server.js` |

---

<a id="ref-env"></a>

## 2. Yêu cầu & `.env`

- MongoDB đang chạy (local, Atlas, Docker, …).
- **`MONGO_URI`**: connection string đầy đủ, có tên database (ví dụ `mongodb://127.0.0.1:27017/prointerview`).

Tạo **`backend/.env`** với tối thiểu:

```env
MONGO_URI=mongodb://127.0.0.1:27017/prointerview
JWT_SECRET=chuoi-bi-mat-du-dai
```

CORS, Google OAuth, … không bắt buộc chỉ để đọc/ghi DB, nhưng cần khi dùng đủ tính năng auth (Google, v.v.).

---

<a id="ref-flow"></a>

## 3. Luồng kết nối trong code

1. `src/server.js` gọi `connectDatabase(MONGO_URI)` từ `src/db/connect.js`.
2. App import **`./models/index.js`** một lần để đăng ký toàn bộ schema Mongoose.

Nếu **thiếu `MONGO_URI`**, server vẫn có thể chạy nhưng route phụ thuộc DB trả **503** (ví dụ `/api/mentors`, `/api/auth`).

---

<a id="ref-models"></a>

## 4. Bảng model → collection

Mỗi domain một file trong **`src/models/`**. Import chung: **`src/models/index.js`**.

| File model | Collection (trong MongoDB) | Ghi chú ngắn |
|------------|----------------------------|--------------|
| `User.js` | `users` | Tài khoản, plan, quota, profile… |
| `Mentor.js` | `mentors` | Hồ sơ mentor; `publicId` cho URL/seed |
| `Booking.js` | `bookings` | Đặt lịch với mentor |
| `CVAnalysis.js` | `cv_analyses` | Phân tích CV / JD |
| `InterviewSession.js` | `interview_sessions` | Phiên phỏng vấn AI |
| `Course.js` | `courses` | Khóa học |
| `Enrollment.js` | `enrollments` | Ghi danh khóa học |
| `Review.js` | `reviews` | Đánh giá mentor/course |
| `Notification.js` | `notifications` | Thông báo |
| `Payment.js` | `payments` | Thanh toán |
| `Subscription.js` | `subscriptions` | Gói đăng ký |
| `Report.js` | `reports` | Báo cáo / khiếu nại |
| `Activity.js` | `activities` | Feed hoạt động dashboard |
| `CourseQA.js` | `courseqas` | Q&A theo bài học |
| `MentorPeerReview.js` | `mentorpeerreviews` | Mentor review khóa (đồng nghiệp) |

Tên collection chính xác có trong từng file (`collection: "..."` trong `Schema`).

---

<a id="ref-import"></a>

## 5. Import model trong code

```js
import { User, Booking } from "../models/index.js";
// hoặc
import { User } from "../models/User.js";

const user = await User.findById(id).lean();
await Booking.create({ /* ... */ });
```

App đã import `models/index.js` trong `src/server.js`. Script độc lập nên tự `connectDatabase`, import model, cuối cùng `mongoose.disconnect()`:

```js
import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDatabase } from "./db/connect.js";
import "./models/index.js";
import { User } from "./models/User.js";

dotenv.config();
await connectDatabase(process.env.MONGO_URI);
// ... thao tác DB ...
await mongoose.disconnect();
```

---

<a id="ref-seed"></a>

## 6. Seed dữ liệu (user dev; mentor chỉ từ tài khoản thật)

### Mentor

- **Không** còn file seed mentor giả. Document `mentors` được tạo khi user có `role: mentor` (admin cấp quyền) và hook/sync — luôn có `userId`.
- Nếu DB còn document cũ không có `userId`: chạy **`npm run db:prune-fake-mentors`** (hoặc xóa tay trong Compass).

### User mặc định (dev)

- File: **`src/data/usersSeed.json`** — email, tên, `role`, mật khẩu dạng plain (script **bcrypt** trước khi lưu).
- **`npm run seed:users`** — chỉ chạy khi collection **`users` trống** (đã có user thì bỏ qua).
- **`npm run seed:all`** — chỉ seed user (và script user sẽ đồng bộ hồ sơ mentor cho dòng `role: mentor` trong seed).

Không dùng mật khẩu seed trên môi trường thật; có thể sửa `usersSeed.json` hoặc xóa user sau khi test.

---

<a id="ref-google"></a>

## 7. Google: `googleId` / `googleSub`

- Schema dùng **`googleId`** cho `sub` từ Google.
- Bản ghi cũ có thể chỉ có **`googleSub`**.
- API đăng nhập Google tìm theo **`googleId` hoặc `googleSub`**.
- Khi liên kết Google với email đã có, server ghi **`googleId`** và xóa **`googleSub`**.

---

<a id="ref-mentor-id"></a>

## 8. Mentor: `id` cũ vs `publicId`

- Seed mới map `id` (JSON) → **`publicId`** trong MongoDB.
- Mentor rất cũ chỉ có field `id` mà không có **`publicId`** có thể khiến API lệch — trên dev: xóa collection `mentors` rồi chạy lại app hoặc **`npm run seed`**.

---

<a id="ref-test"></a>

## 9. Kiểm tra kết nối & xem dữ liệu

- **`GET /api/health`**: `database` phải là `"connected"` khi Mongoose đã nối.
- **MongoDB Compass** hoặc **`mongosh`**: kết nối cùng URI như `MONGO_URI`, xem database và từng collection.

---

<a id="ref-extend"></a>

## 10. Mở rộng (thêm model / route)

- Thêm file trong **`src/models/`**, **export** trong **`src/models/index.js`** để schema được đăng ký khi app chạy.
- Route CRUD: import đúng model, tuân validation/index trong schema.

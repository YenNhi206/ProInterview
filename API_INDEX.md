# ProInterview — Tài liệu API & tích hợp (đầy đủ)

File trong repo: `API_INDEX.md`. Cập nhật khi thêm route, đổi FE hoặc đổi provider (Supabase / thanh toán).

## Role và phân quyền

5 role: `customer`, `mentor`, `admin`, `moderator`, `enterprise` (enum trong `models/User.js`).

| Cổng | Middleware | Ghi chú |
|:--|:--|:--|
| `[AUTH]` | `authJwt` | Bearer access JWT, claim `tv` khớp `User.tokenVersion` |
| `[MENTOR]` | `requireMentor` | Thêm điều kiện `Mentor.isActive && isVerified` |
| `[ADMIN]` | `requireAdmin` | |
| `[MODERATOR]` | `requireModerator` | **Admin KHÔNG đi vòng được** — kiểm định nội dung tách khỏi vận hành |
| `[ENTERPRISE]` | `requireEnterprise` | Credit tổ chức là trục riêng, không phải giá trị của `plan` |

`requireRole(...roles)` trong `middleware/requireRole.js` là cổng dùng chung; nó gắn `req.userRole`
để handler phía sau khỏi query lại `User`.

**Duyệt khóa học đã chuyển sang moderator:** `/api/admin/courses/*` không còn tồn tại (trả 404),
thay bằng `/api/moderator/courses/*`. Router moderator vẫn gắn `adminAuditLog` nên mọi thao tác
duyệt vẫn ghi vào `SecurityLog` (`type: moderator_action`; trước 22/11/2026 là `admin_action`) và hiện ở trang `/admin/audit-log` (lọc `?actor=moderator`).

Gán role: `PATCH /api/users/:id/role` — `ASSIGNABLE_ROLES` = `customer | mentor | moderator | enterprise`.
Không nâng `admin` qua API (phải sửa trực tiếp DB).

---

## Giỏ hàng và thanh toán nhiều khóa học — đã tích hợp

| Method | Path | Quyền | Contract |
|:--|:--|:--|:--|
| GET | `/api/cart` | AUTH | `{ success, cart: { items, totalAmount, pendingOrder } }`; giá hiện hành từ server |
| POST | `/api/cart/items` | AUTH | Body `{ courseId }`; mỗi khóa tối đa một lần, tối đa 20 khóa |
| DELETE | `/api/cart/items/:courseId` | AUTH | Xóa khỏi giỏ; đơn đã tạo giữ nguyên danh sách và tổng tiền |
| POST | `/api/cart/checkout` | AUTH | Body `{ couponCode? }`; trả `{ success, order }`, tự dùng lại đơn đang chờ |
| GET | `/api/cart/orders/:id` | AUTH, chủ đơn | Trả `{ success, order }`; trạng thái `preparing/pending/processing/paid/expired` |
| POST | `/api/admin/cart-orders/:id/confirm-transfer` | ADMIN | Body `{ force: true, forceNote, amount }`; đối soát đúng **tổng đơn** |

`order` có `id`, `orderRef`, `items`, `totalAmount`, `couponCode`, `status`, `paymentExpiresAt`.
Webhook SePay hiện có và `/api/payments/transfer-status` hỗ trợ `entityType: "cart"` (và `"learning_path"` từ LP-10, xem A.17).
Đơn giữ nguyên giá/ưu đãi sau khi tạo QR; server áp dụng Pro/Elite và coupon trên tổng tiền.
`CartOrder` quản lý mã chuyển khoản chung; `Enrollment.cartOrderId` liên kết từng khóa, giữ nguyên index mã thanh toán riêng và ledger từng enrollment.
Xác nhận từng enrollment thuộc giỏ qua endpoint cũ trả 409. Đơn quá hạn giải phóng toàn bộ ghi danh pending, giữ giỏ; tiền đã nhận được lưu trước khi mở quyền học để có thể tiếp tục khi gián đoạn.
Trang `/cart` cho phép xem giỏ, tạo đơn và mở lại `/cart?order=<id>`; sau khi đủ quyền học, trạng thái là `paid`.

Job `bookingStaleSweepJob` chạy ngay khi backend kết nối DB, rồi mỗi 20 phút:
hủy booking `pending` chưa trả tiền đã quá giờ bắt đầu; với booking đã trả tiền quá giờ kết thúc + 60 phút, ghi `staleFlaggedAt` và gửi thông báo một lần cho học viên/mentor/admin.
Job không tự phạt, hoàn tiền hoặc đổi trạng thái buổi đã trả tiền. Admin có bộ lọc **Quá giờ cần rà soát**.
Chi tiết triển khai và kiểm thử: [`docs/CART_BOOKING_PORT.md`](./docs/CART_BOOKING_PORT.md).

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
Routers mount: `/api/auth`, `/api/mentors`, `/api/bookings`, `/api/plans`, `/api/payments`, `/api/users`, `/api/courses`, `/api/reviews`, `/api/reports`, `/api/mentor`, `/api/notifications`, `/api/admin`, `/api/enrollments`, `/api/cv`, `/api/interviews`, `/api/upload`, `/api/ai`, `/api/achievements`, `/api/analytics`, `/api/mock` *(chỉ ngoài production)*, `/api/coupons`, `/api/competencies`, `/api/mentorship-requests`, `/api/learning-paths`.

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
| POST | `/api/courses/prescreen-preview` | Bearer + Mentor | **AI-09.** Xem trước cờ sàng lọc theo luật (`ruleFlags` của AI-08) trên nội dung đang soạn, body cùng dạng tạo / sửa khóa (`chapters`, `outcomes`). Trả `{ flags[] { code, severity, message, evidence, source: "rule" }, rules }`. Không gọi LLM, không ghi DB |
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
| POST | `/api/cv/analyses` | Bearer | Lưu kết quả phân tích (sau khi chạy Python). N-11: gửi `analysisId` (từ `/api/cv/analyze*`) thì ghi đè vào bản ghi đó → `200`, không trừ lượt nếu đã trừ; không có `analysisId` → tạo mới `201` như cũ |
| GET | `/api/cv/analyses` | Bearer | Danh sách lịch sử phân tích (chỉ bản đã xong; bỏ `processing`/`failed`) |
| GET | `/api/cv/analyses/:id` | Bearer | Chi tiết bản phân tích |
| DELETE | `/api/cv/analyses/:id` | Bearer | Xóa bản phân tích |

**Proxy Python** (`backend/src/routes/cvMatch.js`, cần `CV_ANALYZER_URL`):

| Method | Path | Mô tả |
|:-------|:-----|:------|
| POST | `/api/cv/analyze` | Khớp từ khóa CV+JD (không LLM) |
| POST | `/api/cv/analyze/full` | Khớp + chấm điểm (LLM/Ollama) |
| POST | `/api/cv/analyze/suggestions` | Pipeline đầy đủ + gợi ý (JD) |
| POST | `/api/cv/analyze/field` | Phân tích theo ngành (`field` form field) |
| POST | `/api/cv/best-fit` | PR-05, `cvBestFitService.js`. JSON `{ cvIds: [2–5 id CV trong kho /api/cvs, không trùng], jdText? (30–20.000 ký tự) \| jobPostId? (job đang mở) }`. Cần còn lượt phân tích CV (không trừ lượt), rate limit như `/analyze`. Node gửi file đã tải lên (PDF / DOCX / TXT) hoặc chữ soạn trong editor (`content`) sang Python `POST /best-fit` (multipart `jd_text`, `items` JSON, `files[]`). Một lượt LLM cho cả bộ; `score = 0,7 × điểm AI + 0,3 × điểm kỹ năng`; LLM lỗi hoặc thiếu CV trong kết quả → xếp theo kỹ năng (`mode: "skills"`). → `{ success, bestFit: { ranking[] { cvId, title, rank, score \| null, skillScore, aiScore, reason, strengths[], gaps[], matchingSkills[], missingSkills[], error }, bestCvId, mode ai \| skills, jdSource { type text \| job, jobPostId?, title? }, elapsedMs } }`. CV không đọc được đứng cuối, `score: null`, có `error`. Lỗi: 400 đầu vào, 404 CV không thuộc user / job không mở, 403 hết lượt, 503 / 504 / 502 Python |

**Python `POST /validate` (PR-03, `cv_jd_matching/cv_validator.py`):** multipart `file` (PDF / DOCX / TXT) hoặc form `text`, `use_llm` (mặc định `true`). Luật đếm 4 nhóm mục (Kinh nghiệm, Học vấn, Kỹ năng, Liên hệ) và dấu hiệu giấy tờ khác (hóa đơn, JD, thư xin việc, hợp đồng, sao kê, bảng điểm, báo cáo, biên bản, hướng dẫn sử dụng, công thức); chỉ gọi LLM khi luật không chắc, LLM lỗi thì quyết theo điểm luật. Luôn `200` → `{ is_cv, confidence, method heuristic | llm | heuristic_fallback | file_type, doc_type, reason (tiếng Việt), signals, missing_sections[] }`; `400` khi thiếu cả file lẫn text. Ảnh → `doc_type: "image"`; định dạng khác hoặc PDF không đọc được → `"unreadable"`. Chưa có route Express gọi tới: upload CV (PR-04) đang kiểm bằng `services/cvValidator.js`.

**N-11:** cả 4 route nhận form field `analysisId` (tùy chọn) và luôn trả `analysisId` (kể cả khi lỗi). Server mở `CVAnalysis` `processing` trước khi gọi Python; Python 2xx → `completed` + `result.match` + trừ 1 lượt quota; lỗi → `failed` + `error`. Mỗi lần gọi ghi `meta.processingTimeMs` và log `cv_analysis_timing` (`durationMs`, `pythonMs`, `endpoint`, `httpStatus`). FE gửi lại `analysisId` khi thử bậc thấp hơn (suggestions → full → basic) và khi lưu.

**FE:** `cvApi.js` (lịch sử CRUD), `CVAnalysis.jsx` (phân tích qua `/api/cv/analyze*`). **Production:** Express + Python. **Supabase Edge:** chỉ khi `VITE_SUPABASE_PROJECT_ID` — fallback tùy env, không bắt buộc.

---

### A.8. Module Interviews — `/api/interviews`

**File:** `backend/src/routes/interviews.js`

| Method | Path | Auth | Mô tả |
|:-------|:-----|:-----|:------|
| POST | `/api/interviews/sessions` | Bearer | Tạo phiên phỏng vấn thử. **JB-06:** body nhận `jobPostId` tùy chọn (sai định dạng → 400, không trừ lượt). Server chèn tối đa 2 câu doanh nghiệp sau 3 câu baseline: có `jobPostId` (job đang mở) thì câu của job đó, không có thì câu của **một** doanh nghiệp ngẫu nhiên cùng vị trí (`competencyProfile.roleCategory` → `roleCategoryKeysForInterviewRole`). Câu hợp lệ: `approved`, trong câu áp dụng của rubric `approved` gắn với job, thuộc job đó hoặc dùng chung. Mỗi câu có `source` (`baseline` / `company` / `llm_followup`); session lưu `companyQuestions[] { questionId, companyId, jobPostId, rubricId }`; có câu doanh nghiệp thì `questionsAllowed` = 5 (free) / 7 (Pro). Không có câu hợp lệ → buổi như cũ. FE đọc `session.questions` từ response |
| PATCH | `/api/interviews/sessions/:id` | Bearer | Cập nhật câu trả lời |
| POST | `/api/interviews/sessions/:id/complete` | Bearer | Hoàn thành và nhận feedback |
| POST | `/api/interviews/sessions/:id/evaluate` | Bearer | Chấm điểm / feedback bổ sung. Mỗi `perQuestion[]` kèm trạng thái kiểm định: `evaluationIncomplete`, `incompleteFields`, `moderatorOverride` (điểm moderator chấm lại, không ghi đè điểm AI) và `openReports` (loại báo cáo AI `interview_question` / `interview_evaluation` của chính user còn chưa xử lý; chỉ có khi phiên đã chấm trước đó). Trang Feedback dùng để hiện "Đang chờ kiểm định" và ưu tiên điểm moderator (N-10). `freeQuestionCount` (JB-06): số câu đầu buổi user free xem được kết quả (3 baseline + câu doanh nghiệp). Câu doanh nghiệp (JB-07) có thêm `company` {id, name}, `rubricStatus` (`scored` \| `no_answer` \| `failed` \| `pending`) và `rubricScores[]` {criterionKey, criterionName, shrmKey, weight, score 0–5, evidenceQuote}; câu khác không có các trường này. Chấm rubric chạy song song lần chấm đầu; đã chấm thì không chấm lại, `failed` được chấm bù ở lần gọi sau; trích dẫn luôn là đoạn có trong transcript (không khớp thì rỗng). Chi phí ghi CostEvent `rubric_scoring` |
| POST | `/api/interviews/sessions/:id/analyze-face` | Bearer | Vision — cảm xúc khuôn mặt (body `imageBase64`, JSON limit riêng 1.5mb). Chưa có `consent.camera` → trả `emotion: null, reason: "no_camera_consent"`, không gọi Vision |
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
| GET | `/api/moderator/content/stats` | `[MODERATOR]` Bản dùng cho hàng đợi duyệt (cùng handler với `/api/admin/content/stats`) |
| GET | `/api/moderator/courses/pending` | `[MODERATOR]` Khóa chờ duyệt (`pending_review`, `pending_update`) + `stats.enrollmentCount` (đếm ghi danh `paid`) + `aiPrescreen` (AI-08) `{ status pending \| done \| failed, score, summary, flags[] { code, severity, message, evidence, source rule \| ai }, target, model, promptVersion, error, at }` hoặc `null` |
| GET | `/api/moderator/courses/published` | `[MODERATOR]` Khóa đã xuất bản (`?limit=50`, tối đa 100) + `stats` |
| PATCH | `/api/moderator/courses/:id/approve` | `[MODERATOR]` Duyệt → `status: published`, xóa `adminReview` |
| PATCH | `/api/moderator/courses/:id/reject` | `[MODERATOR]` Từ chối — body `{ reason }` (bắt buộc) → `draft`, lưu `adminReview`, thông báo mentor |
| PATCH | `/api/moderator/courses/:id/archive` | `[MODERATOR]` Gỡ marketplace — body `{ reason? }` → `archived`, lưu `adminReview`, thông báo mentor |
| GET | `/api/moderator/queue` | `[MODERATOR]` Hàng đợi kiểm định. **JB-04:** không truyền `type` thì chỉ trả 3 loại phỏng vấn (`question_report`, `evaluation_report`, `evaluation_incomplete`); báo cáo tin tuyển dụng lấy bằng `?type=job_post_report` |
| PATCH | `/api/moderator/queue/:id/resolve` | `[MODERATOR]` **JB-04:** item `job_post_report` chỉ nhận `action` `dismiss` (giữ tin, report `dismissed`) hoặc `hide_job` (`note` = lý do ẩn ≥ 5 ký tự; ẩn tin, đóng mọi báo cáo đang mở của tin, báo người báo cáo và Company Moderator). Item phỏng vấn không nhận `hide_job`; sai loại → 400. Tin đã đóng / đã xóa sau khi bị báo cáo → `hide_job` trả 409 gợi ý `dismiss` (item vẫn mở, `dismiss` đóng được) |
| GET | `/api/moderator/jobs` | `[MODERATOR]` **JB-04 (cho JB-17).** Tin `published` / `hidden`; query `status` (`published` hoặc `hidden`), `reported=true` (chỉ tin có báo cáo đang mở), `q` (tìm theo tiêu đề), `page`, `limit` → `{ jobs[] {id, title, companyId, companyName, roleCategory, level, status, publishedAt, closesAt, hiddenAt, hiddenReason, openReports}, pagination }`, tin nhiều báo cáo lên trước |
| PATCH | `/api/moderator/jobs/:id/visibility` | `[MODERATOR]` **JB-04.** Body `{ hidden: true, reason (≥ 5 ký tự) }` → `published → hidden` (ghi `hiddenAt`, `hiddenBy`, `hiddenReason`; đóng báo cáo đang mở; Notification `job_post_hidden` cho Company Moderator của công ty) · `{ hidden: false }` → `hidden → published` (xóa 3 field, Notification `system`). 409: đã ở trạng thái đó, bản nháp / đã đóng, bỏ ẩn tin đã quá `closesAt`. Tin bị ẩn không hiện ở `GET /api/jobs`; Company Mod không sửa được, vẫn đóng được |
| POST | `/api/reports` | **JB-04:** `{ targetType: "job_post", targetId, reason: fraud \| misleading \| discriminatory \| inappropriate \| other, description (≥ 10 ký tự), evidenceUrls? }` → `201 { reportId, moderationItemId }` (item `job_post_report`; `fraud` / `discriminatory` ưu tiên cao). Chỉ tin công chúng đang thấy, cùng quy tắc `GET /api/jobs/:id` (`published`, chưa quá `closesAt`, công ty không bị khóa; khác → 404); Company Mod không báo cáo tin công ty mình (400); đang có báo cáo chờ xử lý cho cùng tin → 409, kể cả hai request cùng lúc (unique index `{reportedBy, targetId}` partial `targetType: job_post, status: pending`) |
| PATCH | `/api/admin/bookings/:id/confirm-transfer-payment` | Xác nhận CK booking |
| PATCH | `/api/admin/bookings/:id/confirm-refund` | Xác nhận hoàn tiền |
| PATCH | `/api/admin/bookings/:id/status` | Cập nhật trạng thái booking |
| GET | `/api/admin/enrollments/pending-transfer` | Ghi danh chờ xác nhận CK |
| GET | `/api/admin/enrollments/course-payments` | Thanh toán khóa học |
| PATCH | `/api/admin/enrollments/:id/confirm-transfer-payment` | Xác nhận CK ghi danh |
| GET | `/api/admin/payments/subscription-pending` | Gói subscription chờ CK |
| PATCH | `/api/admin/payments/:id/confirm-subscription-transfer` | Xác nhận CK gói |
| GET | `/api/admin/payments/learning-path-transfers?status=` | **LP-11.** CK lộ trình: `pending` (mặc định, mã còn hạn), `expired` (mã hết hạn mà lộ trình vẫn `pending_payment`, có thể tiền đến muộn), `paid`. Trả `{ success, payments[] { paymentId, learningPathId, orderRef, amount, status (pending \| submitted \| expired \| paid), createdAt, paymentExpiresAt, submittedAt, paidAt, confirmedVia (sepay \| admin), forceConfirm, forceNote, candidate { id, name, email }, mentor { name, publicId }, learningPath { status, totalAmount, version, paymentRef } }, stats { paidCount, paidTotalAmount, pendingCount, submittedCount } }`. FE `/admin/learning-path-payments` |
| PATCH | `/api/admin/payments/:id/confirm-learning-path-transfer` | **LP-11.** Body `{ force?, forceNote?, amount? }`. Không `force`: ứng viên phải đã báo «Đã chuyển» (400). `force` cần `forceNote` ≥ 3 ký tự; chỉ `force` mới xác nhận được giao dịch đã hết hạn (tiền đến muộn, khác → 409). `amount` (số tiền trên sao kê) lệch giá lộ trình → 400. Thành công: Payment `success`, lộ trình `active`, thông báo `learning_path_paid`; gọi lại → `idempotent: true`. Trả `{ success, payment, learningPath, idempotent }` |
| GET | `/api/admin/learning-paths/:id/cancel-preview` | **LP-15.** Xem trước khi hủy: `{ preview { totalAmount, learnedSessions, learnedShare, refundAmount, openBookings, hasPayment } }`. Lộ trình không `active` → 409 |
| POST | `/api/admin/learning-paths/:id/cancel` | **LP-15.** Body `{ reason }` (≥ 5 ký tự). Chỉ lộ trình `active`. Hoàn = T − tổng `shareAmount` các buổi gốc đã học (`done`, hoặc booking `completed`). Lộ trình → `cancelled` (lệnh có điều kiện, hủy 2 lần → 409); booking chưa học → `cancelled`, buổi chưa học → `cancelled`; Payment → `refund_pending` + `refundAmount` (hoàn 0 thì giữ `success`); thông báo `learning_path_cancelled` cho ứng viên và mentor. Mentor giữ thu nhập đã nhận |
| PATCH | `/api/admin/payments/:id/confirm-learning-path-refund` | **LP-15.** Body `{ transferRef }` (≥ 3 ký tự). Chỉ từ `refund_pending` (lần 2 → 409) → `refunded` (hoàn toàn bộ) hoặc `partial_refund`, ghi `refundedAt`, `providerResponse.refundTransferRef`; thông báo ứng viên. `GET .../learning-path-transfers?status=refund` liệt kê giao dịch hủy / hoàn |
| POST | `/api/admin/payments/normalize-transfer-refs` | Chuẩn hóa mã tham chiếu CK |
| GET | `/api/admin/finance/courses` | Tổng hợp doanh thu khóa |
| GET | `/api/admin/finance/platform-summary` | Tài chính nền tảng — query `?month=YYYY-MM` (tuỳ chọn). Trả `platformFinance { totals, booking, course, subscription, learningPath }`. **LP-16:** `learningPath` tính từ Payment `learning_path` đã thu (`success` / `partial_refund`, trừ phần hoàn, bỏ Payment demo), phí = phí nền tảng các buổi gốc, cùng công thức analytics N-08 (`learningPathRevenueRows`); booking lộ trình không cộng vào `booking` |
| GET | `/api/admin/payouts` | Yêu cầu rút tiền mentor |
| PATCH | `/api/admin/payouts/:id/approve` | Duyệt payout |
| PATCH | `/api/admin/payouts/:id/mark-paid` | Đánh dấu đã chi |
| PATCH | `/api/admin/payouts/:id/reject` | Từ chối payout |
| GET | `/api/admin/interview-metrics` | Metric phỏng vấn AI |
| GET | `/api/admin/analytics/user-behavior` | Hành vi nền tảng — query `?days=` (1–90, mặc định 7) → `{ behavior }` |
| GET | `/api/admin/analytics/users/:id/journey` | Hành trình user — query `?days=`, `?limit=` → `{ journey }` |
| GET | `/api/admin/analytics/revenue` | Doanh thu theo nguồn (N-08) — query `?days=` (1–366, mặc định 30, tính cả hôm nay) hoặc `?month=YYYY-MM` (giờ VN) → `{ revenue: { period, totals, sources[], series[] } }`. `sources[]`: `booking` (Booking `paid`/`partial_refund`, loại booking lộ trình và buổi 0đ), `course` (Enrollment `paid`, `pricePaid > 0`), `subscription` (Payment `subscription` `success`), `learning_path` (Payment `learning_path` `success`/`partial_refund`); mỗi nguồn `{ key, label, grossCollected, platformRevenue, mentorNet, count, sharePct }`, `grossCollected` đã trừ tiền hoàn; mốc thời gian `paidAt` ?? `createdAt`; bỏ Payment demo `UIMOCK-`. `series[]`: mỗi ngày `{ date, booking, course, subscription, learning_path, total }` |

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
| GET | `/api/bookings/mentor/:id` | Bearer + Mentor | Chi tiết booking phía mentor. Booking buổi lộ trình có thêm `learningPathId`, `learningPathSessionId` (rỗng với booking thường; LP-21 dùng để mở form chấm đạt / chưa đạt) |
| GET | `/api/bookings/mentor/:id/booked-slots` | — / Mentor | Slot đã đặt |
| PATCH | `/api/bookings/mentor/:id/reschedule` | Bearer + Mentor | Dời lịch (mentor). 409 nếu mentee có buổi khác chồng giờ mới (xem C.3 "Chặn ứng viên trùng giờ") |
| PATCH | `/api/bookings/mentor/:id/cancel` | Bearer + Mentor | Hủy (mentor) |
| PATCH | `/api/bookings/:id/refund-destination` | Bearer | Cập nhật tài khoản hoàn tiền |
| PATCH | `/api/bookings/:id/mentor-cancel-resolution` | Bearer | Xử lý hủy từ mentor. Chọn `reschedule` mà giờ mới chồng buổi khác của mình → 409, lựa chọn chưa được ghi |
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
| GET | `/api/admin/analytics/revenue` | `revenue` — doanh thu theo nguồn (booking, khóa, gói, lộ trình) + chuỗi theo ngày (N-08) |

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

### A.16. Module Yêu cầu mentor — `/api/mentorship-requests`

**File:** `backend/src/routes/mentorshipRequests.js` · **Service:** `mentorshipRequestsService.js` · **Model:** `MentorshipRequest`

Mọi route gắn `authJwt`; chỉ `customer` (mentee) và Mentor đã duyệt (`isActive`, `isVerified`) được dùng. Response `{ success, request }` hoặc `{ success, requests }`.

| Method | Path | Ai | Ghi chú |
|:-------|:-----|:---|:--------|
| GET | `/api/mentorship-requests?scope=open\|mine` | Mentee / Mentor | Mentee: yêu cầu của mình. Mentor: `open` = đang mở, `mine` = đã gửi đề nghị |
| POST | `/api/mentorship-requests` | Mentee | multipart: `position`, `description`, `sessionType`, `availability?`, `budget?`, **`jobPostId?`** (LP-05; từ JB-03 phải là job **đang mở**: `published`, chưa quá `closesAt`, công ty không bị khóa, khác → 400; bỏ trống = null), `cv`/`jd` (file) hoặc `cvSource`/`jdSource` |
| GET | `/api/mentorship-requests/documents` | Mentee | CV/JD đã lưu để dùng lại |
| GET | `/api/mentorship-requests/:id` | Chủ yêu cầu / Mentor liên quan | DTO: `status`, `offers`, `bookingId` (booking thường), **`jobPostId`**, **`jobPost`** (tóm tắt job gắn kèm, xem A.19 `jobPostSummary`) \| null, **`assessment`** `{ bookingId, status, date, timeSlot, durationMinutes, cancelledBy }` \| null, **`learningPath`** `{ id, status }` \| null (LP-20: lộ trình chưa hủy; mentee không thấy khi còn `draft`) |
| POST | `/api/mentorship-requests/:id/offers` | Mentor | Gửi đề nghị (`message`, `availability`) |
| POST | `/api/mentorship-requests/:id/offers/:offerId/select` | Mentee | `open → selected` |
| POST | `/api/mentorship-requests/:id/offers/:offerId/withdraw` | Mentor | Rút đề nghị |
| POST | **`/api/mentorship-requests/:id/accept-assessment`** | Mentor được chọn | **LP-05.** Body `{ date: "DD/MM/YYYY", timeSlot: "HH:mm", durationMinutes?: 30–120 (mặc định 60), note? }`. Tạo Booking `sessionType: "assessment"` (mọi field tiền 0, `paid`, `confirmed`), request `selected\|assessing → assessing`, thông báo `booking_confirmed` cho mentee. **201** `{ success, request }`. Lỗi: 400 sai định dạng / giờ đã qua; 403 không phải Mentor được chọn; 409 đang có buổi 0đ chưa diễn ra, buổi 0đ đã hoàn thành, đã `path_proposed`, trùng khung giờ của mentor, hoặc mentee đã có buổi khác chồng giờ (thông báo không lộ lịch của mentee). Hẹn lại được khi buổi trước `cancelled`/`no_show`. **LP-06 (quyết định 13):** 409 khi ứng viên (gộp mọi yêu cầu, mọi mentor) đang có 1 buổi 0đ chưa xong, hoặc đã dùng 2 buổi 0đ trong 30 ngày (tính theo lúc tạo buổi; tính buổi đang mở, `completed`, `no_show` do ứng viên; không tính `no_show` do mentor và buổi `cancelled`) — thông báo kèm ngày được hẹn lại |
| POST | `/api/mentorship-requests/:id/close` | Mentee | `open → closed` |
| GET | `/api/mentorship-requests/:id/files/:kind` | Mentee / Mentor được chọn | Tải CV/JD (`kind` = `cv` \| `jd`) |

**Status:** `open → selected → assessing → path_proposed`; `open → closed`. Đặt booking thường qua `POST /api/bookings` kèm `mentorshipRequestId` được phép ở `selected`, `assessing`, `path_proposed` (`resolveRequestBooking`). `path_proposed` do LP-07 ghi.

### A.17. Module Lộ trình học — `/api/learning-paths`

**File:** `backend/src/routes/learningPaths.js` · **Service:** `learningPathsService.js`, `learningPathPaymentService.js` (LP-10), `learningPathSessionsService.js` (LP-12) · **Model:** `LearningPath`, `LearningPathSession`, `Payment` (`type: learning_path`)

Mọi route gắn `authJwt`; chỉ mentee (`customer`) và Mentor đã duyệt (dùng chung `requestActor` với A.16). Response `{ success, learningPath }` hoặc `{ success, learningPaths }`.

**DTO `learningPath`:** `id, candidateId, mentorId, mentorshipRequestId, jobPostId, jobPost (tóm tắt job, quyết định 5: `requiredCompetencies` làm khung chọn `shrmKeys`) | null, assessmentBookingId, goal, status, version, revisionNote, totalAmount, platformFeeRate, proposedAt, acceptedAt, createdAt, updatedAt, candidate { name }, request { title, position, description, sessionType, cvName, jdName } | null, assessment { bookingId, status, date, timeSlot, durationMinutes } | null, sessions[] { id, order, attempt, title, objectives[], shrmKeys[], shareAmount, status, outcome, bookingId, retakeOf, canSchedule, booking { id, status, date, timeSlot, durationMinutes } | null }`. `canSchedule` (LP-12) là `true` ở đúng một buổi khi lộ trình `active` và mọi buổi trước đã `passed`. `candidate`, `request`, `assessment` thêm ở LP-20 để Mentor xem hồ sơ mentee khi soạn.

| Method | Path | Ai | Ghi chú |
|:-------|:-----|:---|:--------|
| GET | `/api/learning-paths` | Mentor / Mentee | Mentor: lộ trình mình soạn. Mentee: lộ trình đã gửi cho mình (**không thấy bản nháp**). Mỗi lộ trình có `mentor: { name, title, avatar, publicId }` (LP-18, trang `/learning-paths` của ứng viên) |
| GET | `/api/learning-paths/:id` | Mentor soạn / Mentee của lộ trình | Mentee gọi bản nháp → 404 |
| GET | `/api/learning-paths/:id/competency-hints` | Mentor của lộ trình | **LP-23.** Năng lực gợi ý cho trình soạn: `{ hints: { items[], hasJob, hasEvidence, jobTitle, passThreshold } }`. Mỗi item `{ shrmKey, name, fromJob, requiredLevel, currentLevel, gap, status }`; `status` = `gap` (dưới yêu cầu job / dưới mức đạt), `unknown` (job yêu cầu, ứng viên chưa có bằng chứng), `met`. Nguồn: `requiredCompetencies` của job gắn lộ trình + hồ sơ năng lực ứng viên (PR-07); chỉ key hợp lệ LP-01. Mentor khác / mentee → 404; id sai → 400 |
| POST | `/api/learning-paths` | Mentor được chọn | **LP-07.** Body `{ mentorshipRequestId, goal?, totalAmount? (VND nguyên, 0–100.000.000), sessions?: [{ title, objectives?[], shrmKeys?[] }] (≤ 12) }`. `shrmKeys` phải là key trong bộ tiêu chí LP-01 (`GET /api/competencies`) và không `deprecated`, nếu không trả 400. Request phải ở `selected`/`assessing`. **201** bản nháp (`draft`). 409 nếu yêu cầu đã có lộ trình chưa hủy |
| PATCH | `/api/learning-paths/:id` | Mentor soạn | **LP-07.** Body `{ goal?, totalAmount?, sessions? }`; `sessions` thay **toàn bộ** danh sách buổi. Chỉ khi `draft` hoặc `revision_requested` (khác → 409) |
| POST | `/api/learning-paths/:id/propose` | Mentor soạn | **LP-07.** `draft`/`revision_requested → proposed`. Chặn (400): chưa có buổi; giá < 10.000₫; buổi đánh giá 0đ chưa `completed`. Chụp `platformFeeRate` theo Mentor (`resolveBookingPlatformFeeRate`); gửi lại sau sửa thì `version + 1`. Yêu cầu mentor → `path_proposed`; thông báo `learning_path_proposed` cho mentee |
| POST | `/api/learning-paths/:id/accept` | Mentee của lộ trình | **LP-08.** Body `{ version? }`. `proposed → pending_payment`, ghi `acceptedAt`. Gửi `version` đang xem thì 409 nếu mentor đã gửi phiên bản khác. 409 khi không ở `proposed`; mentor gọi → 403; bản nháp / lộ trình của người khác → 404. Thông báo `learning_path_accepted` cho mentor |
| POST | `/api/learning-paths/:id/request-revision` | Mentee của lộ trình | **LP-08.** Body `{ note }` (5–2000 ký tự, bắt buộc). `proposed → revision_requested`, lưu `revisionNote`. Mentor sửa (`PATCH`) rồi gửi lại (`propose`) → `version + 1`. Thông báo `learning_path_revision_requested` cho mentor |
| POST | `/api/learning-paths/:id/checkout` | Mentee của lộ trình | **LP-10.** Chỉ khi `pending_payment` (khác → 409; đã `active`/`completed` → 409 "đã thanh toán"). Trả `{ success, learningPath, payment }`. Tạo Payment `type: learning_path`, `provider: transfer`, `amount = totalAmount`, `providerRef` = mã `PI` + 12 số (`generatePiOrderRef`), hết hạn sau `TRANSFER_PAYMENT_TIMEOUT_MINUTES` (mặc định 15). Gọi lại khi mã còn hạn → trả **đúng mã cũ, không gia hạn**; mã đã hết hạn → mã mới trên cùng bản ghi Payment. Hai lần bấm cùng lúc: một lần nhận 409 |
| POST | `/api/learning-paths/:id/sessions/:sid/schedule` | Mentee của lộ trình | **LP-12.** Body `{ date (DD/MM/YYYY), timeSlot (HH:mm), durationMinutes? (30–120, mặc định 60), note? (≤ 1000) }`. **201** `{ success, learningPath, booking { id, status, date, timeSlot, durationMinutes, learningPathSessionId } }`. Buổi `planned → scheduled`, tạo Booking `confirmed` gắn `learningPathId` + `learningPathSessionId` (**không** gắn `mentorshipRequestId`), tiền ghi sẵn theo LP-04 (`price = totalAmount = shareAmount`, `platformFee = round(shareAmount × platformFeeRate)`, `paid`, `paymentMethod: learning_path`; buổi học lại = 0). Chỉ đặt được buổi đang mở: lộ trình `active`, đi theo `order`, mỗi `order` xét lần học mới nhất; buổi trước chưa `passed` (đang `scheduled` hoặc `not_passed`) → **409**. Khung giờ: tương lai, trong lịch mentor mở (cùng quy tắc `POST /api/bookings`), mentor chưa có lịch trùng (đơn CK hết hạn đang giữ giờ được giải phóng), mentee không có buổi khác chồng giờ (kể cả với mentor khác) → 400/409. Bấm 2 lần cùng lúc chỉ tạo 1 booking. Mentor gọi → 403; lộ trình / buổi của người khác → 404. Thông báo `booking_confirmed` cho mentor. Hủy buổi qua `DELETE /api/bookings/:id` (LP-22) → buổi về `planned`, đặt lại được |
| PATCH | `/api/learning-paths/:id/sessions/:sid/outcome` | Mentor của lộ trình | **LP-13.** Body `{ outcome: "passed" \| "not_passed", feedback: { summary (10–4000, bắt buộc), strengths?: string[], improvements?: string[] }, scores?: [{ shrmKey, score (0–5 hoặc null), note? }] }`. `scores` chỉ nhận key trong `shrmKeys` của buổi (khác hoặc trùng → 400); `not_passed` phải có ≥ 1 `improvements` (400). Điều kiện: lộ trình `active`, buổi `scheduled`, booking của buổi đã `completed` (mentor kết thúc buổi trước) → khác 409. Trả `{ success, learningPath, nextStep, suggestedOutcome }`: `nextStep` = `open_next` (mở buổi kế) \| `complete_path` (mọi buổi đạt → lộ trình `completed`, `completedAt`) \| `free_retake` (lần chưa đạt đầu: tạo buổi cùng `order`, `attempt` 2, `retakeOf`, `shareAmount` 0, `planned`) \| `supplementary_required` (học lại vẫn chưa đạt: không tự tạo buổi). `suggestedOutcome` = `suggestOutcome` của LP-01 từ `scores` (mentor vẫn quyết định). Lưu `feedback.scores`, `frameworkVersion`. Ghi 2 lần cùng lúc: một lần 409. Mentee gọi → 403; mentor khác → 404. Thông báo `learning_path_session_result` cho mentee |
| POST | `/api/learning-paths/:id/sessions/:sid/supplementary` | Mentor của lộ trình | **LP-13 (quyết định 2).** Body `{ price (10.000–100.000.000, số nguyên), note? (≤ 2000) }`. Chỉ cho lần học lại mới nhất `done` + `not_passed` (`attempt ≥ 2`); lần trượt đầu hoặc đã đề xuất → 409. **201** `{ success, learningPath }`. Tạo buổi `attempt + 1`, `retakeOf`, `shareAmount = price` (thu riêng, ngoài T), `status: pending_payment`: chưa đặt lịch được (409) và chặn các buổi sau tới khi thanh toán. Thông báo `learning_path_session_result` cho mentee |
| PATCH | `/api/learning-paths/:id/submit-transfer` | Mentee của lộ trình | **LP-10.** Ứng viên báo "Tôi đã chuyển khoản": ghi `Payment.providerResponse.submittedAt` (giúp admin đối soát tay, LP-11). 404 chưa checkout; 409 mã đã hết hạn hoặc lộ trình không còn chờ thanh toán. Trả `{ success, learningPath, payment }` |

**DTO `sessions[]` (LP-13 thêm):** `feedback { summary, strengths[], improvements[], scores[] { shrmKey, score, note }, frameworkVersion, suggestedOutcome }`, `doneAt`, `supplementaryNote`. `status` có thêm `pending_payment` (buổi bổ sung chờ thanh toán, `canSchedule: false`).

**DTO `payment` (LP-10):** `paymentId, orderRef, amount, status (pending | submitted | paid | expired), submittedAt, paymentExpiresAt, expiresInMs, timeoutMinutes`. FE hiện QR theo `orderRef` + `amount` như checkout giỏ hàng, rồi poll `GET /api/payments/transfer-status?orderRef=…` (trả `entityType: "learning_path"`, `entityId` = id lộ trình, `redirectTo: /learning-paths/:id` khi `paid`).

**Xác nhận tiền lộ trình (LP-10):** SePay webhook khớp mã `PI…` của Payment `learning_path` đang chờ và **đúng** `totalAmount` → `confirmLearningPathTransfer`: Payment `success`, lộ trình `pending_payment → active` (`paidAt`), thông báo `learning_path_paid` cho mentee và mentor. Sai tiền / mã hết hạn / mã cũ → `SepayWebhookEvent.status = unmatched`, lộ trình giữ nguyên. Webhook trùng `id` → idempotent. Tài khoản ứng viên ngừng hoạt động → `held_inactive_account`, không kích hoạt. Admin xác nhận tay (LP-11): A.10 `/api/admin/payments/learning-path-transfers`, `/api/admin/payments/:id/confirm-learning-path-transfer`.

Sắp có: `cancel` (LP-15); thanh toán buổi bổ sung có phí (đề xuất (s) trong `docs/plan/TASKS.md`). `shareAmount` từng buổi gốc được chốt khi `propose` (LP-09: `splitLearningPathShares`, tổng = `totalAmount`, buổi cuối nhận phần dư); bản nháp còn 0.

---

### A.18. Tin tuyển dụng của công ty — `/api/company/jobs` (JB-01)

**File:** `backend/src/routes/company.js` · **Controller:** `companyJobsController.js` · **Service:** `jobPostsService.js` · **Model:** `JobPost`

Mọi route `/api/company/*` gắn `authJwt` + `requireCompanyModerator` (CO-03): role `company_moderator`, đã gắn `companyId`, công ty không bị `suspended` (khác → 401/403). Mọi truy vấn lọc theo công ty của người gọi: job công ty khác trả **404**. Không cần duyệt trước khi đăng (quyết định 8).

**DTO `job`:** `id, companyId, title, roleCategory, roleCategoryName, level, employmentType, workMode, location, salaryRange, description, requiredCompetencies[] { shrmKey, minLevel, name }, requiredSkills[], rubricId, rubric { id, title, version, status, roleCategory } | null, status, closesAt, publishedAt, closedAt, closedReason, createdAt, updatedAt`. `name` lấy `nameVi` từ bộ tiêu chí LP-01.

| Method | Path | Ghi chú |
|:-------|:-----|:--------|
| GET | `/api/company/jobs` | Query `status?` (`draft` \| `published` \| `closed` \| `hidden`), `roleCategory?`, `page` (mặc định 1), `limit` (1–100, mặc định 20). Trả `{ success, jobs, pagination { page, limit, total, totalPages }, counts { draft, published, closed, hidden } }` (`counts` của cả công ty, cho các tab) |
| POST | `/api/company/jobs` | Tạo **bản nháp**, **201** `{ success, job }`. Body: `title` (3–150, bắt buộc), `roleCategory` (bắt buộc, key trong `GET /api/role-categories`), `level` (`intern` \| `fresher` \| `junior` \| `middle` \| `senior` \| `lead`, bắt buộc), `employmentType?` (`full_time` mặc định \| `part_time` \| `contract` \| `internship`), `workMode?` (`onsite` mặc định \| `hybrid` \| `remote`), `location?` (≤ 200), `salaryRange?` (≤ 100, chữ tự do), `description?` (≤ 10.000), `requiredCompetencies?: [{ shrmKey, minLevel }]` (≤ 10, key hợp lệ theo `isValidCompetencyKey`, không trùng, `minLevel` nguyên 1–5), `requiredSkills?: string[]` (≤ 30, mỗi cái 1–60 ký tự; bỏ trùng không phân biệt hoa thường), `rubricId?` (null/"" để bỏ), `closesAt?` (ISO, phải ở tương lai; null = không hạn) |
| GET | `/api/company/jobs/:id` | `{ success, job }`. Id sai định dạng → 400; job công ty khác → 404 |
| PATCH | `/api/company/jobs/:id` | Body: các field như POST (ít nhất 1; `status`, `companyId` bị bỏ qua). Chỉ khi `draft` hoặc `published` (`hidden`/`closed` → 409). Job đang đăng phải vẫn đủ điều kiện đăng. Hai người sửa cùng lúc → 409 cho người sau |
| PATCH | `/api/company/jobs/:id/status` | Body `{ status: "published" \| "closed" }`. **Đăng** (`draft → published`, ghi `publishedAt`): cần mô tả ≥ 50 ký tự, ≥ 1 năng lực yêu cầu, `closesAt` (nếu có) ở tương lai, rubric (nếu có) vẫn hợp lệ. **Đóng** (`published` \| `hidden` → `closed`, `closedReason: "company"`). Đăng lại job đã đóng / bỏ ẩn / đóng bản nháp → 409 |

**Rubric gắn vào job:** chỉ rubric `approved` của **cùng công ty** và **cùng `roleCategory`** với job; khác → 400 (rubric công ty khác báo như không tồn tại). Đổi `roleCategory` khi đang gắn rubric thì phải đổi rubric theo. Rubric bị lưu trữ (có version mới được duyệt) sau khi gắn vào bản nháp → không đăng được tới khi chọn rubric mới.

**Tự đóng (JB-02):** job `published` / `hidden` có `closesAt <= now` chuyển `closed`, `closedReason: "expired"`, trong nhịp 20 phút của `bookingStaleSweepJob` (`closeExpiredJobPosts`). API công khai đã loại job quá hạn ngay lúc truy vấn.

**Kiểm tra key ở API công ty khác (đề xuất (l)):** `POST/PATCH /api/company/questions`, `POST /api/company/questions/upload` (job), `POST /api/company/rubrics` nhận `roleCategory` trong `GET /api/role-categories` (khác → 400). `competencyId` của câu hỏi và `criteria[].shrmKey` của rubric (`POST`, `PATCH`, `submit`) phải là key bộ tiêu chí LP-01 (khác → 400). `competencyId` mặc định của câu hỏi công ty là `technical_learning`.

Sắp có: ẩn/hiện của Platform Mod (JB-04), FE `/company/jobs` (JB-15).

---

### A.19. Tin tuyển dụng công khai — `/api/jobs` (JB-03) và nhóm vị trí — `/api/role-categories`

**File:** `backend/src/routes/jobs.js`, `routes/roleCategories.js` · **Service:** `publicJobsService.js`, `roleCategories.js` · **Dữ liệu nhóm vị trí:** `backend/src/config/roleCategories.json` (nguồn duy nhất)

Không cần đăng nhập (trừ `/:id/gap`). Job **đang mở** = `status: published`, `closesAt` null hoặc ở tương lai, công ty không `suspended`. Không bao giờ trả `draft`, `closed`, `hidden`.

**DTO công khai `job`:** `id, title, roleCategory, roleCategoryName, level, employmentType, workMode, location, salaryRange, summary (≤ 280 ký tự), description (chỉ ở chi tiết), requiredCompetencies[] { shrmKey, minLevel, name }, requiredSkills[], hasRubric, closesAt, publishedAt, company { id, name, slug, logo, industry, website, size, address }`. Không có `createdBy`, `rubricId`, nội dung rubric, `status`.

| Method | Path | Ghi chú |
|:-------|:-----|:--------|
| GET | `/api/jobs` | Query: `q?` (≤ 100 ký tự, tìm trong tiêu đề, kỹ năng, địa điểm, không phân biệt hoa thường), `roleCategory?`, `level?`, `employmentType?`, `workMode?`, `company?` (slug; công ty không có / bị khóa → danh sách rỗng), `page` (mặc định 1), `limit` (1–50, mặc định 12). Mới đăng trước (`publishedAt`). Trả `{ success, jobs, pagination { page, limit, total, totalPages } }`. Bộ lọc sai → 400 |
| GET | `/api/jobs/:id` | `{ success, job }` có `description` đầy đủ. Không mở → 404; id sai → 400. Có Bearer của ứng viên (`customer`) thì ghi lượt xem cho JB-20 (khách và role khác không ghi) |
| GET | `/api/jobs/recent` | Bearer, chỉ ứng viên (khác → 403). Tối đa 5 job xem gần nhất (mới nhất trước), **chỉ job đang mở và có câu doanh nghiệp hợp lệ**: câu `approved`, nằm trong câu áp dụng của rubric `approved` gắn với job, thuộc job đó hoặc dùng chung (`companyInterviewQuestionService.js`, dùng chung với JB-06). Trả `{ success, jobs: [DTO job + viewedAt, companyQuestionCount] }` (JB-20) |
| GET | `/api/jobs/:id/gap` | `[AUTH][customer]` khoảng thiếu (JB-05, `jobGapService.js`, chỉ đọc). `{ success, gap: { job { id, title, company }, competencies[], skills { cv { id, title } \| null, matched[], missing[] { skill, nextStep } }, summary { competenciesMet, competenciesTotal, competenciesNoEvidence, skillsMatched, skillsTotal } } }`. Mỗi `competencies[]`: `shrmKey, name, requiredLevel, currentLevel \| null, evidenceCount, gap \| null, status met \| below \| no_evidence, severity null \| medium (thiếu 1 bậc) \| high (≥ 2 bậc) \| unknown (chưa có bằng chứng), nextStep { type ai_interview \| mentor_request, label, actionUrl } \| null`. Năng lực có `evidenceCount = 0` trong `CandidateProfile` tính là `no_evidence`, không tính level mặc định. Kỹ năng so với CV mặc định (`defaultCvId` của hồ sơ, hoặc CV `isDefault`): `skills`, `content.skills`, `content.projects[].technologies`, so sau khi bỏ dấu, hoa/thường, ký tự đặc biệt, đuôi `js`; `nextStep.type` `course` (có CV) hoặc `update_cv` (chưa có CV). Chưa đăng nhập 401, không phải ứng viên 403, job không mở 404, id sai 400 |
| GET | `/api/role-categories` | `{ success, version, roleCategories: [{ key, nameVi, nameEn, interviewRole, suggestedCompetencies[] }] }`. `interviewRole` = key trong `ROLE_COMPETENCY_MAP` (phỏng vấn AI, JB-06); `suggestedCompetencies` = năng lực ưu tiên của vị trí (gợi ý khi soạn job). `Cache-Control: public, max-age=3600`, `ETag` theo `version` (`If-None-Match` khớp → 304). FE: `api/roleCategoriesApi.js`, hook `useRoleCategories()` |

**`jobPostSummary`** (DTO `jobPost` trong yêu cầu mentor và lộ trình): `id, title, roleCategory, roleCategoryName, level, isOpen, company { name, slug } | null, requiredCompetencies[], requiredSkills[]`. Đọc cả job đã đóng (`isOpen: false`) vì job có thể đóng sau khi gửi yêu cầu.

Sắp có trên `/api/jobs`: `/:id/apply` (JB-08). Luồng ứng viên cần job hợp lệ dùng `findPublicJob(id)` của `publicJobsService.js`.

---

### A.16. Bộ tiêu chí năng lực SHRM/DDI — `/api/competencies` (LP-01)

**File:** `backend/src/routes/competencies.js` · **Dữ liệu:** `backend/src/config/competencies.json` (nguồn duy nhất) · **Service:** `competencyFramework.js` · **FE:** `frontend/src/app/api/competenciesApi.js`

| Method | Path | Auth | Ghi chú |
|:-------|:-----|:-----|:--------|
| GET | `/api/competencies` | Bearer; role `customer`, `mentor`, `admin`, `moderator`, `enterprise` / `company_moderator` | Trả `{ success, framework }`: `version`, `scale {min, max}`, `passThreshold`, `aiCalibration {offset, maxLevel, status}`, `levels[] {score, label, descriptor}`, `nullLabel`, `competencies[] {key, nameVi, nameEn, shrm, ddi, definition, indicators, anchors {1,3,5}, deprecated, ...}`. Header `Cache-Control: private, max-age=3600`, `ETag` theo `version` (`If-None-Match` khớp → 304). Không token → 401 |

**Quy tắc:** key năng lực giữ nguyên 20 key cũ; bỏ key thì đặt `deprecated: true` (vẫn hiện tên cho dữ liệu cũ, form mentor/rubric không cho chọn). Mức `null` = "Chưa đủ dữ liệu", khác mức 0. BE dùng `isValidCompetencyKey`, `aiAnswerToLevel`, `suggestOutcome`, `toDisplayLevel` trong `competencyFramework.js`.


### A.18. AI sinh bộ câu nháp cho công ty — `POST /api/company/questions/generate` (CO-04)

| Method | Endpoint | Auth | Mô tả |
|:-------|:---------|:-----|:------|
| POST | `/api/company/questions/generate` | Company Moderator; rate limit 10 lần / 15 phút / user | Body `{ roleCategory, count? }`: `roleCategory` là key trong `GET /api/role-categories`, `count` nguyên 8–12 (mặc định 10); sai → **400**, không gọi LLM. AI sinh câu theo năng lực của vị trí (`interviewRole` → `ROLE_COMPETENCY_MAP`, chỉ key bộ tiêu chí LP-01). Lưu vào `QuestionBank`: `orgId = companyId`, `source: "org_template"`, `status: "draft"`, `provenance.promptVersion` / `generatedBy.promptVersion` = version prompt thực sự chạy (`companyq-vN`). Câu trùng `textHash` với câu đã có của công ty (mọi trạng thái) hoặc trùng nhau trong lượt bị bỏ qua. **201** `{ success, message, count, skippedDuplicates, promptVersion, questions }`. Chưa cấu hình LLM → **503**; LLM trả kết quả không dùng được sau 1 lần sửa JSON → **502** (không lưu gì) |

Prompt key `company_question_gen` (PromptVersion, tiền tố `companyq`), bản mặc định `companyq-v1` trong `prompts/companyQuestionGenPrompt.js`. Câu đã có (chưa bị từ chối) của cùng vị trí được đưa vào prompt (tối đa 30) để tránh lặp ý. Trang câu hỏi của Platform Moderator (`GET /api/moderator/questions`) chỉ đọc `orgId: null` nên không thấy các câu này.

#### Quản lý câu hỏi công ty (CO-05)

Vòng đời câu doanh nghiệp (quyết định CO-16, 23/11/2026): `draft` → `pending_platform_review` (Company Mod duyệt) → `approved` \| `rejected` (Platform Mod, CO-16); `draft` → `rejected` (Company Mod). **Chỉ câu `approved` mới vào buổi phỏng vấn.** Câu có `jobPostId` (tin tuyển dụng của chính công ty) hoặc `null` (dùng chung theo `roleCategory`).

| Method | Endpoint | Mô tả |
|:-------|:---------|:------|
| GET | `/api/company/questions` | Query `status?` (giá trị trong enum, sai → 400), `roleCategory?`, `jobPostId?` (id job, hoặc `none` = câu không gắn job; id sai → 400), `page`, `limit` (1–100, mặc định 50). Trả `{ success, questions, pagination }` |
| POST | `/api/company/questions` | Tự thêm một câu. Body `{ text, jobPostId?, roleCategory?, competencyId?, layer?, seniority?, status? }`. Có `jobPostId` thì `roleCategory` mặc định lấy của job. Mặc định `pending_platform_review`; `status: "draft"` để lưu nháp. Trùng `textHash` với câu đã có của công ty → **409**; job công ty khác → **403**; job không có → **404** |
| POST | `/api/company/questions/upload` | Tải lên hàng loạt cho một job. Body `{ jobPostId, questions: [string \| { text, competencyId?, layer?, seniority? }], status? }`, tối đa **50** câu, mỗi câu ≤ 1000 ký tự. `roleCategory` lấy của job; `seniority` lấy cấp độ job nếu thuộc thang `intern/junior/middle/senior`, không thì `middle`; `competencyId` mặc định `technical_learning`. Một dòng sai → **400** `{ errors: [{ line, error }] }`, không lưu câu nào. Câu trùng `textHash` với câu đã có của công ty (mọi trạng thái) hoặc trùng nhau trong lượt bị bỏ qua. Mặc định `pending_platform_review`; `status: "draft"` để lưu nháp. **201** `{ success, message, count, skippedDuplicates, questions }` |
| PATCH | `/api/company/questions/:id` | Sửa `text`, `roleCategory`, `competencyId`, `jobPostId` (null/"" = bỏ gắn job), kèm `reason?`. Mỗi lần sửa ghi `history` (`action: "edit"`, `previousQuestion`). Đổi chữ câu `approved` → quay về `pending_platform_review`. Đổi chữ trùng câu khác của công ty → **409** |
| POST | `/api/company/questions/:id/approve` | Chỉ từ `draft` hoặc `rejected` → `pending_platform_review`. Câu đã ở `pending_platform_review` / `approved` → **409** |
| POST | `/api/company/questions/:id/reject` | → `rejected`, ghi `history` |
| POST | `/api/company/questions/batch-approve` | Body `{ ids, reason? }`. Chỉ chuyển câu `draft` / `rejected` của chính công ty sang `pending_platform_review`; câu khác giữ nguyên. Trả `modifiedCount`. Id sai → **400** |
| POST | `/api/company/questions/batch-reject` | Body `{ ids, reason? }` → `rejected`. Id sai → **400** |

`GET /api/company/dashboard` trả thêm `stats.questions.pendingPlatformReview`. Rubric công ty gắn được câu `pending_platform_review` hoặc `approved` của chính công ty.

#### Platform Moderator duyệt câu doanh nghiệp — `/api/moderator/company-questions` (CO-16)

**File:** `routes/moderator.js` (`requireModerator`, ghi `moderator_action`) · **Controller:** `moderatorCompanyQuestionController.js` · **Service:** `companyQuestionReviewService.js` · **FE:** `/moderator/company-questions` (`ModeratorCompanyQuestions.jsx`)

| Method | Endpoint | Mô tả |
|:-------|:---------|:------|
| GET | `/api/moderator/company-questions` | Query `status?` (`pending_platform_review` mặc định \| `approved` \| `rejected`; khác → 400), `companyId?`, `jobPostId?`, `roleCategory?`, `q?` (≤ 100 ký tự), `page`, `limit` (1–100, mặc định 20). Chỉ câu `orgId != null`. Tab chờ duyệt xếp cũ nhất trước. Trả `{ success, questions: [{ ..., company { _id, name, slug, logo }, jobPost { _id, title, status, level } \| null, lastEdit }], counts { pending_platform_review, approved, rejected }, pagination }` |
| POST | `/api/moderator/company-questions/:id/approve` | Body `{ note? }`. `pending_platform_review` → `approved`, ghi `review`, `moderation`, `history`; xếp hàng render video avatar (CO-06). Câu khác trạng thái → **409**; câu pool chung / không có → **404** |
| POST | `/api/moderator/company-questions/:id/reject` | Body `{ reason }` (bắt buộc, ≤ 500). → `rejected`; lý do lưu ở `moderation.reason` (công ty xem ở `GET /api/company/questions`) |
| POST | `/api/moderator/company-questions/bulk` | Body `{ action: "approve" \| "reject", ids (≤ 100), reason? }` (`reject` bắt buộc `reason`). Chỉ đổi câu đang `pending_platform_review`, câu khác bỏ qua. Trả `{ updated, skipped }` |

Route duyệt của ngân hàng câu chung (`PATCH /api/moderator/questions/:id/approve`, `POST /api/moderator/questions/bulk`) chỉ tác động câu `orgId: null`, nên không đi vòng được luồng này.

Video avatar câu công ty (CO-06): chỉ render cho câu công ty `approved`, tức là lúc Platform Mod duyệt (CO-16). Company Mod duyệt không xếp hàng render. Render nền cho cả 2 giới tính (`persistVideo: true`, mirror Cloudinary), không chặn response. Cache tính theo nội dung câu, nên buổi luyện theo job gọi `POST /api/ai/interview/pregenerate` với câu này sẽ trúng cache, không gọi provider video. Backfill hoặc render lại sau khi đổi provider: `npm run warmup:company-videos`.


### A.18. Rubric công ty — `/api/company/rubrics`, `/api/moderator/rubrics` (CO-07, CO-08, CO-09, CO-14)

**File:** `backend/src/routes/company.js` (`requireCompanyModerator`, lọc theo `companyId`) · `backend/src/routes/moderator.js` · **Model:** `CompanyRubric`

| Method | Path | Auth | Ghi chú |
|:-------|:-----|:-----|:--------|
| GET | `/api/company/rubrics` | Company Moderator | Rubric của công ty mình. Query `roleCategory` tùy chọn |
| GET | `/api/company/rubrics/:id` | Company Moderator | Khác công ty → 403. Lý do từ chối ở `moderationNote.comment` |
| POST | `/api/company/rubrics` | Company Moderator | Body `{ title, roleCategory, description?, criteria?: [{ name, weight (nguyên 1–100), shrmKey, levels: {"0".."5": string ≤ 500}, questionIds?[] }] }` (≤ 10 tiêu chí). `shrmKey` phải thuộc bộ tiêu chí LP-01 và không `deprecated`; `questionIds` phải là câu `approved` của chính công ty; field ngoài model bị bỏ. **201** bản nháp (`version` tự tăng theo `roleCategory`) |
| PATCH | `/api/company/rubrics/:id` | Company Moderator | Sửa `title`, `description`, `criteria` (kiểm như POST). Chỉ khi `draft` / `rejected`; `pending_review` → 409; `approved` / `archived` → 400 |
| POST | `/api/company/rubrics/:id/submit` | Company Moderator | Chỉ từ `draft` / `rejected` (khác → 409). Cần ≥ 1 tiêu chí, tổng trọng số 100%, **mỗi tiêu chí đủ mô tả 6 mức 0–5** (thiếu → 400). Chuyển `pending_review`, không tạo ModerationItem. CO-09: chạy nền AI kiểm tra rubric, ghi `aiReview` |
| GET | `/api/moderator/rubrics` | Platform Moderator | Query `status` (vd `pending_review`) |
| POST | `/api/moderator/rubrics/:id/approve` | Platform Moderator | Duyệt; bản `approved` cũ cùng công ty + `roleCategory` → `archived` |
| POST | `/api/moderator/rubrics/:id/reject` | Platform Moderator | Body `{ comment }` bắt buộc → `rejected`, lưu `moderationNote.comment` |
| POST | `/api/moderator/rubrics/:id/ai-review` | Platform Moderator | CO-09, `rubricReviewService.js`. Body `{ force? }`. Chạy (lại) AI kiểm tra rubric; nội dung không đổi và lần trước `done` thì trả kết quả cũ, trừ khi `force: true`. Chỉ là gợi ý, không đổi `status`. → `{ success, aiReview }`. 400 mã sai, 404 không có rubric |

**`aiReview` (CO-09)** có trong `GET /api/moderator/rubrics` và `/:id`: `{ status pending \| done \| failed \| null, summary, flags[] { code, severity info \| warning \| critical, criterionIndex (0-based) \| null, message, evidence, suggestedShrmKey, source rule \| ai }, model, promptVersion, contentHash, error, at }`. Cờ luật: `no_criteria`, `weight_sum`, `invalid_shrm_key`, `duplicate_shrm_key`, `duplicate_name`, `missing_level`, `duplicate_level`, `short_level` (< 15 ký tự), `copied_scale`. Cờ AI (prompt `rubric_review`, model `activeLLMModel("prescreen")`): `shrm_mismatch` (kèm `suggestedShrmKey` thuộc LP-01), `vague_scale`, `overlapping_levels`, `non_progressive_scale`, `duplicate_criteria`. LLM lỗi → `status: "failed"`, cờ luật vẫn ghi.

`questionIds` gắn được câu `pending_platform_review` hoặc `approved` của chính công ty (CO-05).

### A.18. Lời mời Company Moderator — `/api/company-invites` (CO-02)

**File:** `routes/companyInvites.js` (công khai, không cần token) · **Service:** `companyService.js` (`verifyInviteToken`, `acceptInvite`) · **Điều khoản:** `config/rubricSharingTerms.js` · **FE:** `/company-invite/:token`

| Method | Path | Ghi chú |
|:-------|:-----|:--------|
| GET | `/api/company-invites/verify/:token` | `{ success, invite { id, email, company { id, name, slug, logo, industry }, expiresAt }, terms { version, title, points[] } }`. Token sai / đã dùng / thu hồi → 400; hết hạn → 400 và lời mời chuyển `expired`; công ty bị khóa → 403 |
| POST | `/api/company-invites/accept` | Body `{ token, name, password (≥ 6), acceptRubricTerms: true, termsVersion }`. Không đồng ý điều khoản (`acceptRubricTerms` khác `true`) → **400**; `termsVersion` khác bản hiện tại → **409** (tải lại trang). Email đã có tài khoản role khác → 400 (quyết định 14). Token dùng 1 lần, giành bằng lệnh nguyên tử (hai lần nhận cùng lúc chỉ một lần thành công). **201** `{ user, token, refreshToken }` |

**Điều khoản dùng rubric ẩn danh (quyết định AI-18):** khi nhận lời mời, thời điểm và version đồng ý lưu ở `CompanyInvite.rubricTermsAcceptedAt` / `rubricTermsVersion`; lần đồng ý đầu tiên của công ty lưu ở `Company.rubricSharingConsent { acceptedAt, acceptedBy, termsVersion }`. Miner AI-18 chỉ lấy rubric của công ty có `rubricSharingConsent.acceptedAt`. Đổi nội dung điều khoản thì tăng `version` trong `config/rubricSharingTerms.js`.

### A.19. Kho CV — `/api/cvs` (PR-02, PR-09; FE `/cvs` PR-11, `/cvs/:id/edit` PR-13)

**File:** `backend/src/routes/cvs.js` · **Model:** `CVDocument` · Chỉ chủ CV đọc/ghi được (lọc theo `userId`)

| Method | Path | Auth | Ghi chú |
|:-------|:-----|:-----|:--------|
| GET | `/api/cvs` | Bearer | `{ items, cvs }` (cùng dữ liệu): CV mặc định trước, rồi mới cập nhật trước. Mỗi CV có `id`, `title`, `targetRole`, `fileName`, `fileUrl`, `fileSize`, `version`, `isDefault`, `content` |
| POST | `/api/cvs` | Bearer | multipart `file` (PDF/DOCX/DOC/TXT, ≤ 5 MB, kiểm có phải CV — PR-04) + `title?`, `targetRole?`; hoặc JSON `content` để tạo CV soạn sẵn. CV đầu tiên tự là mặc định. **201** |
| GET / PATCH | `/api/cvs/:id` | Bearer | Xem / sửa (`title`, `targetRole`, `content`…) |
| POST | `/api/cvs/:id/duplicate` | Bearer | Bản sao tên `[Bản sao] …`, không mặc định. **201** |
| POST | `/api/cvs/:id/set-default` | Bearer | Đặt mặc định (bỏ mặc định CV khác, cập nhật `CandidateProfile.defaultCvId`). Alias `PATCH /:id/default` |
| DELETE | `/api/cvs/:id` | Bearer | Xóa; xóa CV mặc định thì CV mới cập nhật gần nhất thành mặc định |
| GET / POST | `/api/cvs/:id/export-pdf` | Bearer | Xuất PDF (pdfkit + DejaVu) — PR-09 |
| POST | `/api/cvs/:id/extract-content` | Bearer | PR-08, `cvContentExtractService.js`. CV phải của user và có tệp gốc PDF / DOCX / TXT; rate limit như `/api/cv/analyze`, không trừ lượt. Node gửi tệp sang Python `POST /extract-content` (multipart `file`): một lượt LLM trả đúng shape `CVDocument.content`, LLM lỗi hoặc trả rỗng thì tách theo tiêu đề mục (`method: "rules"`). **Không ghi DB**: editor điền vào bản nháp, người dùng bấm Lưu (`PATCH /api/cvs/:id`). → `{ success, extracted: { content, method llm \| rules, sections[], cvVersion } }`. Lỗi: 400 mã sai / CV không có tệp / định dạng khác / Python 400 (giữ `detail`), 404 CV không thuộc user hoặc mất tệp gốc, 503 / 504 / 502 Python |

### A.20. Gợi ý mentor, khóa học, job — `/api/recommendations` (AI-10)

**File:** `backend/src/routes/recommendations.js` · **Service:** `recommendationsService.js` · Chấm theo luật có trọng số (`RECOMMENDATION_WEIGHTS`), không gọi LLM, không ghi DB.

| Method | Path | Auth | Ghi chú |
|:-------|:-----|:-----|:--------|
| GET | `/api/recommendations/me` | `[AUTH][customer]` | Query `limit?` 1–10 (mặc định 5; sai → 400). `{ success, recommendations: { basis { gaps[] { key, name, level }, targetRoles[], passThreshold }, mentors[], courses[], jobs[] } }`. Mỗi gợi ý có `score` (0–1), `reason` (một dòng) và `actionUrl`. **Năng lực còn thiếu** = năng lực trong `CandidateProfile` có bằng chứng, key có trong bộ tiêu chí LP-01, `level < passThreshold`. **Mentor** (đã xác minh, đang hoạt động; `id` = `publicId`, `actionUrl /mentors/:id`): 0,6 × khớp năng lực thiếu (đã dạy buổi lộ trình `done` có `shrmKeys` đó = 1, khớp từ khóa năng lực trong chức danh / lĩnh vực / chuyên môn / giới thiệu = 0,7; trọng số theo độ thiếu) + 0,3 × sao + 0,1 × số lượt đánh giá. **Khóa** (`published`, `pending_update`; bỏ khóa đã ghi danh; `actionUrl /courses/:id`): như mentor, khớp từ khóa trong tiêu đề / thẻ / mô tả / "bạn sẽ học được". **Job** (đang mở; `actionUrl /jobs/:id`): 0,7 × tỉ lệ năng lực yêu cầu đã đạt + 0,3 × đúng vị trí mục tiêu của hồ sơ. Mục khớp đứng trước, thiếu thì lấp bằng mục còn lại theo điểm. Chưa có hồ sơ → gợi ý theo đánh giá / tin mới |


### A.21. Hồ sơ ứng viên — `/api/profile` (PR-01, PR-07; gộp năng lực PR-06)

**File:** `backend/src/routes/profile.js` · **Service:** `candidateProfileService.js`, `competencyProfileService.js` · **Model:** `CandidateProfile` · Mọi route cần Bearer.

| Method | Path | Ghi chú |
|:-------|:-----|:--------|
| GET | `/api/profile/me` | `{ success, profile }`; chưa có thì tạo (headline, vị trí mục tiêu lấy từ tài khoản), `competencies: []` (không tạo năng lực khung) |
| PATCH | `/api/profile/me` | `headline`, `targetRole`, `targetRoles[]`, `summary`, `yearsOfExperience`, `defaultCvId` (CV của chính user, đồng bộ `CVDocument.isDefault`) |
| GET | `/api/profile/me/competencies` | `{ success, competencies[], snapshot }`. Mỗi năng lực: `key` (LP-01), `name`, `level` 0–5 thập phân hoặc `null` (chỉ có nguồn khóa học, "Chưa đủ dữ liệu"), `score` (= level × 20), `evidenceCount` (bằng chứng có mức), `sources[] { type ai_interview \| mentor_session \| course, refId, title, level, score, at }` (mới nhất trước, tối đa 20). Gộp bằng `competencyProfileService` (PR-06): câu phỏng vấn AI theo key từng câu (`aiAnswerToLevel`, điểm moderator chấm lại nếu có), điểm mentor buổi lộ trình `done`; mức = trung bình có trọng số 5 điểm AI + 3 điểm mentor gần nhất, mentor hệ số 2; khóa học hoàn thành chỉ ghi nguồn. Hồ sơ gộp bằng cách cũ thì gộp lại khi gọi API này. `snapshot` là DTO rút gọn cho đơn ứng tuyển (JB-08) |

| GET | `/api/profile/me/company-metrics` | **JB-19** `[CUSTOMER]` `{ success, companies[] }`: mọi doanh nghiệp ứng viên đã gặp câu hỏi trong phỏng vấn AI (buổi `completed`), mỗi dòng `company` {id, name, slug}, `questionCount`, `answeredCount`, `scoredCount`, `rubricScoreAvg`, `lastAnsweredAt`, `sessionCount`; mới nhất trước |
| GET | `/api/profile/me/company-metrics/:companyId` | **JB-19** `[CUSTOMER]` `{ success, metrics }`: `company`, `questionCount`, `answeredCount` (transcript không rỗng), `scoredCount` (JB-07 `rubricScoring.status = scored`), `pendingScoringCount`, `rubricScoreAvg` (0–5), `criteria[]` {criterionKey, criterionName, shrmKey, rubricId, avgScore, count}, `lastAnsweredAt`, `sessionCount`, `sessions[]` (tối đa 20) {sessionId, date, questionCount, answeredCount, rubricScore}, `answers[]` (JB-16, tối đa 20, mới nhất trước) {sessionId, date, questionIndex, question, transcript (≤ 2000 ký tự), scoringStatus `scored` | `pending`, rubricScore, scores[] {criterionKey, criterionName, score, evidenceQuote}}, `computedAt`. Chưa trả lời câu nào → các số 0. Mã sai 400, doanh nghiệp không tồn tại 404, role khác 403. Doanh nghiệp không có API đọc chỉ số; chỉ xem bản chụp trong đơn ứng tuyển có đồng ý (JB-08) |

Hệ A cũ `/api/users/me/cvs*`, `/api/users/me/verified-competencies*` đã gỡ ở PR-06 (đề xuất k); kho CV dùng `/api/cvs`.

### A.22. Ứng tuyển — `POST /api/jobs/:id/apply`, `/api/applications`, `/api/company/applications` (JB-08, JB-09)

**File:** `backend/src/routes/jobs.js`, `routes/applications.js`, `routes/company.js` · **Service:** `applicationsService.js` · **Model:** `Application`. Trạng thái và chuyển: `docs/STATE_MACHINES.md` mục 18.

| Method | Path | Ghi chú |
|:-------|:-----|:--------|
| POST | `/api/jobs/:id/apply` | `[CUSTOMER]` body `{ cvId, consent: true }`. `consent` phải đúng `true` (thiếu / false / chuỗi → 400 "Bạn cần đồng ý chia sẻ…"); thiếu `cvId` 400; CV không phải của mình 404; CV `isValidCv: false` 400; job không mở (draft, hidden, closed, quá hạn, công ty bị khóa) 404; đã có đơn (kể cả đã rút) 409. Lưu `consent` {given, at, scope, version} và `snapshot` {candidate {name, email}, profile (DTO PR-07), cv, companyMetrics (DTO JB-19), capturedAt}; báo `application_submitted` cho Company Mod của công ty. Trả 201 `{ success, application }` |
| GET | `/api/applications/me` | `[CUSTOMER]` `{ success, applications[] }` mới nhất trước: `id`, `status`, `statusLabel`, `canWithdraw`, `submittedAt`, `viewedAt`, `decidedAt`, `withdrawnAt`, `cv` {id, title} (null sau khi rút), `job` {id, title, status, company {id, name, slug}} |
| PATCH | `/api/applications/:id/withdraw` | `[CUSTOMER]` chỉ đơn của mình ở `submitted` / `viewed` → `withdrawn`, **xóa snapshot** (quyết định 14); đã rút / đã xử lý 409; đơn người khác 404. Báo `application_status_changed` cho Company Mod |
| GET | `/api/company/applications` | `[COMPANY_MOD]` `{ success, applications[], pagination, counts }`; lọc `status`, `jobPostId`; `page`, `limit` (≤ 50). Chỉ đơn của công ty mình có `consent.given`. Mỗi dòng: `candidate` {name, email}, `cv` {id, title}, `competencyCount`, `isVerified`, `companyMetrics` {answeredCount, scoredCount, rubricScoreAvg}, `status`, mốc thời gian. Đơn đã rút chỉ có `candidateName`, `status: withdrawn`, `withdrawnAt` |
| GET | `/api/company/applications/:id` | `[COMPANY_MOD]` chi tiết kèm `snapshot`, `consent`, `history[]`. `snapshot.companyMetrics.answers[]` là câu trả lời kèm điểm rubric (JB-16, cùng dạng API JB-19); danh sách không trả trường này. FE: `/company/applications/:id` (JB-16). Đơn `submitted` mở lần đầu → `viewed` + báo ứng viên. Đơn công ty khác 404; đơn đã rút chỉ trả tên và "Đã rút" |
| PATCH | `/api/company/applications/:id/status` | `[COMPANY_MOD]` `{ status: "viewed" \| "shortlisted" \| "rejected", note? }`; trạng thái khác 400; đơn `shortlisted` / `rejected` / `withdrawn` 409. Báo `application_status_changed` cho ứng viên (từ chối kèm `note`) |

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

**Chặn ứng viên trùng giờ** (`services/bookingConflictService.js`): ứng viên không được có 2 buổi chồng khoảng `[giờ bắt đầu, + durationMinutes)`, **kể cả với 2 mentor khác nhau**; buổi nối tiếp (19:00–20:00 rồi 20:00) vẫn được. Tính mọi booking của ứng viên đang `pending` / `confirmed` / `in_progress`, trừ đơn CK đã quá hạn. Áp dụng cho `POST /api/bookings`, `PATCH /api/bookings/mentor/:id/reschedule`, `PATCH /api/bookings/:id/mentor-cancel-resolution` (chọn `reschedule`), `POST /api/mentorship-requests/:id/accept-assessment` và `POST /api/learning-paths/:id/sessions/:sid/schedule`. Bị chặn → **409**: ứng viên thấy giờ của buổi đang trùng; mentor (dời lịch, hẹn buổi 0đ) chỉ thấy "Mentee đã có lịch hẹn khác trùng khung giờ này", không lộ lịch của mentee với mentor khác. Đặt lại đúng slot của mình khi tải lại trang checkout không bị coi là trùng.

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
| GET | `/api/payments/transfer-status?orderRef=PI…` — Bearer JWT; poll checkout (`status`: `pending` \| `submitted` \| `paid` \| `expired` \| `not_found`; `entityType`: `cart` \| `booking` \| `course` \| `subscription` \| `learning_path`) |
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
| PUT | `/api/users/me/consent/camera` — JSON `{ "accepted": true, "version": "camera-v1" }`; trả `user.consent.camera` |
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
| GET | `/api/moderator/courses/pending` |
| GET | `/api/moderator/courses/published` |
| PATCH | `/api/moderator/courses/:id/approve` |
| PATCH | `/api/moderator/courses/:id/reject` |
| PATCH | `/api/moderator/courses/:id/archive` |
| GET | `/api/moderator/content/stats` |
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
| GET | `/api/admin/analytics/revenue` |

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
| GET | `/api/admin/analytics/revenue` | Admin — `?days=` hoặc `?month=YYYY-MM` |

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

## Lịch sử, hóa đơn và vận hành tài chính (2026-09-18)

| Method | Endpoint | Quyền / nội dung |
|---|---|---|
| GET | `/api/payments/history?page=&limit=&type=&status=` | Chủ tài khoản; trả `payments`, `pagination`; khóa trong giỏ có `cartOrderId` |
| GET | `/api/payments/:id/invoice` | Chủ giao dịch hoặc admin; PDF của payment thành công |
| GET | `/api/bookings/:id/invoice` | Chủ giao dịch hoặc admin; PDF booking đã thanh toán |
| GET | `/api/enrollments/:id/invoice` | Chủ giao dịch hoặc admin; PDF học phí |
| GET | `/api/cart/orders/:id/invoice` | Chủ đơn hoặc admin; PDF toàn đơn đã hoàn tất |
| GET | `/api/admin/audit-log` | Admin; phân trang, lọc `actor` (`admin`, `moderator` = Platform Moderator (`moderator_action`, kèm dòng `admin_action` cũ trên `/api/moderator/*`), `company_moderator` = Company Moderator (`company_moderator_action`, ghi ở mọi thao tác ghi trên `/api/company/*`; `userId.companyId.name` cho biết công ty), `mentor` = thao tác tiền của mentor; bỏ trống = tất cả, giá trị khác → 400), `adminId`, `method`, `success`, `from`, `to`. Mentor ghi `SecurityLog` `type: mentor_action` ở `POST /api/mentor/payout`, `PATCH /api/mentor/payout-account`, `POST /api/mentor/request-price-change`; `accountNumber` chỉ giữ 4 số cuối (`****1234`) |
| GET | `/api/admin/finance/reconciliation` | Admin; `report.mismatches`, `payoutMismatches`, `alerts`; chỉ đọc |
| POST | `/api/admin/finance/release-earnings` | Admin; giải phóng khoản đủ 3 ngày, không có report mở |
| GET | `/api/admin/users/:id/impact` | Admin; số dư, nghĩa vụ, `canClose`, `blockers` |
| GET | `/api/auth/me/closure-impact` | Chủ tài khoản; xem trước tác động đóng |
| POST | `/api/admin/users/:id/close` | Admin; `{confirmUserId, reason}`; 409 nếu còn ràng buộc |
| DELETE | `/api/auth/me` | Đổi sang đóng mềm qua cùng cổng kiểm tra; giữ chứng từ |
| POST | `/api/admin/mentors/:id/payouts` | Admin; `{amount, reason}`, dùng tài khoản ngân hàng mentor đã lưu |
| GET | `/api/admin/payments/held?page=` | Admin; tiền nhận lúc người trả bị khóa |
| PATCH | `/api/admin/payments/:id/refund-held` | Admin; `{amount, transferRef, reason}`, ghi nhận đã hoàn đúng số tiền |

Các route payout approve/reject/mark-paid giữ URL hiện tại; `mark-paid` bắt buộc `transferRef`, reject cần lý do. Giữ số dư bằng cập nhật có điều kiện và transaction khi DB hỗ trợ. `GET /api/mentor/finance` thêm `clearingBalance`, `holdDays: 3`. Job clearance chạy mỗi giờ. Xem [hướng dẫn vận hành](docs/FINANCE_OPERATIONS_PORT.md).
